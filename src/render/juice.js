/**
 * Rückmeldung, die nichts mit Regeln zu tun hat und trotzdem den Unterschied macht.
 *
 * Vier Werkzeuge, alle in Echtzeit gemessen (nicht in Spielzeit — sie sollen
 * auch dann laufen, wenn die Welt selbst gerade steht):
 *
 * - HIT-STOP: ein paar Bilder Stillstand beim Einschlag. Das mit Abstand
 *   wirksamste Mittel für Wucht, weil das Gehirn den Treffer erst dadurch
 *   als Ereignis liest statt als Zustandsänderung.
 * - KAMERARUCKELN, in Stärke gestaffelt.
 * - BILDBLITZE für seltene, große Momente.
 * - SCHOCKWELLEN als expandierende Ringe.
 */

import { world } from '../core/world.js';
import { hexToRgba } from './glow.js';
import { settings } from '../core/settings.js';

const MAX_RINGS = 18;

const state = {
  shake: 0,
  shakeX: 0,
  shakeY: 0,
  stopUntil: 0,
  flashes: [],
  rings: Array.from({ length: MAX_RINGS }, () => ({
    active: false, x: 0, y: 0, from: 0, to: 0, life: 0, maxLife: 0, color: '#fff', width: 3,
  })),
};

let ringCursor = 0;

export function resetJuice() {
  state.shake = 0;
  state.shakeX = 0;
  state.shakeY = 0;
  state.stopUntil = 0;
  state.flashes.length = 0;
  for (const r of state.rings) r.active = false;
  ringCursor = 0;
}

/** Kurzer Stillstand der Spielzeit. Wird nicht gestapelt, nur verlängert. */
export function hitStop(ms) {
  if (!settings.hitStop) return;
  const until = performance.now() + ms;
  if (until > state.stopUntil) state.stopUntil = until;
}

export function isStopped() {
  return performance.now() < state.stopUntil;
}

export function shake(amount) {
  if (!settings.shake) return;
  state.shake = Math.min(26, state.shake + amount);
}

export function flash(color = '#ffffff', alpha = 0.3, ms = 140) {
  if (!settings.flashes) return;
  state.flashes.push({ color, alpha, life: ms, maxLife: ms });
}

export function ring(x, y, from, to, color, ms = 380, width = 3) {
  const r = state.rings[ringCursor];
  ringCursor = (ringCursor + 1) % MAX_RINGS;

  r.active = true;
  r.x = x; r.y = y;
  r.from = from; r.to = to;
  r.life = ms; r.maxLife = ms;
  r.color = color; r.width = width;
}

/** Wird mit ECHTER Framezeit gefüttert, damit Effekte im Stillstand weiterlaufen. */
export function updateJuice(realDtMs) {
  if (state.shake > 0.05) {
    const a = Math.random() * Math.PI * 2;
    state.shakeX = Math.cos(a) * state.shake;
    state.shakeY = Math.sin(a) * state.shake;
    // Zeitbasierter Abfall statt fester Rate pro Bild.
    state.shake *= Math.pow(0.0035, realDtMs / 1000);
  } else {
    state.shake = 0;
    state.shakeX = 0;
    state.shakeY = 0;
  }

  for (let i = state.flashes.length - 1; i >= 0; i--) {
    state.flashes[i].life -= realDtMs;
    if (state.flashes[i].life <= 0) state.flashes.splice(i, 1);
  }

  for (const r of state.rings) {
    if (!r.active) continue;
    r.life -= realDtMs;
    if (r.life <= 0) r.active = false;
  }
}

export function pushCamera(ctx) {
  ctx.save();
  if (state.shakeX || state.shakeY) ctx.translate(state.shakeX, state.shakeY);
}

export function popCamera(ctx) {
  ctx.restore();
}

export function drawRings(ctx) {
  for (const r of state.rings) {
    if (!r.active) continue;

    const t = 1 - r.life / r.maxLife;
    // Schnell raus, langsam aus — liest sich als Druckwelle, nicht als Blase.
    const eased = 1 - Math.pow(1 - t, 3);
    const radius = r.from + (r.to - r.from) * eased;

    ctx.globalAlpha = (1 - t) * 0.85;
    ctx.strokeStyle = r.color;
    ctx.lineWidth = Math.max(0.5, r.width * (1 - t));
    ctx.beginPath();
    ctx.arc(r.x, r.y, radius, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

export function drawFlashes(ctx) {
  for (const f of state.flashes) {
    const t = f.life / f.maxLife;
    ctx.fillStyle = hexToRgba(f.color, f.alpha * t * t);
    ctx.fillRect(0, 0, world.width, world.height);
  }
}
