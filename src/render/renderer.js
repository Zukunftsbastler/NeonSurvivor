/**
 * Zeichenpfad.
 *
 * Der Hintergrund ist kein statisches Raster mehr, sondern ein Radarschirm mit
 * umlaufender Peilung. Der Sweep ist nicht nur Zierde: Er "malt" Kontakte an,
 * die danach abklingen. Dadurch entsteht Spannung aus unvollständiger
 * Information — ohne die Kontakte je ganz zu verstecken, was auf einem
 * Telefondisplay unfair wäre.
 */

import { world } from '../core/world.js';
import { state } from '../core/state.js';
import { PALETTE, SWEEP_PERIOD_MS } from '../config/theme.js';
import { hexToRgba } from './glow.js';
import { drawParticles, drawPopups, drawSparks } from '../entities/fx.js';
import { pushCamera, popCamera, drawRings, drawFlashes } from './juice.js';

let sweepAngle = 0;

export function resetSweep() {
  sweepAngle = 0;
}

/**
 * Aktualisiert Peilwinkel und die Anmalung aller Kontakte.
 * Gibt `true` zurück, wenn der Strahl gerade einen Umlauf vollendet hat —
 * daran hängt der Sonar-Ping, der dem Spiel seinen Puls gibt.
 */
export function updateSweep(dtMs) {
  const previous = sweepAngle;
  sweepAngle = (sweepAngle + (dtMs / SWEEP_PERIOD_MS) * Math.PI * 2) % (Math.PI * 2);
  const wrapped = sweepAngle < previous;

  const cx = world.width / 2;
  const cy = world.height / 2;
  const decay = dtMs / 900;

  for (const e of world.enemies) {
    const a = Math.atan2(e.y - cy, e.x - cx);
    let diff = Math.abs(((a - sweepAngle + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
    if (diff < 0.28) e.paint = 1;
    else e.paint = Math.max(0, e.paint - decay);
  }

  return wrapped;
}

function drawBackground(ctx) {
  const { width: w, height: h } = world;

  ctx.fillStyle = PALETTE.screen;
  ctx.fillRect(0, 0, w, h);

  const cx = w / 2;
  const cy = h / 2;
  const maxR = Math.hypot(w, h) / 2;

  // Entfernungsringe statt kartesischem Raster: jeder vierte Ring hell.
  const step = 62;
  ctx.lineWidth = 1;
  for (let i = 1, r = step; r < maxR; i++, r += step) {
    ctx.strokeStyle = i % 4 === 0 ? PALETTE.gridMajor : PALETTE.grid;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Peilstrahlen alle 30°.
  ctx.strokeStyle = PALETTE.grid;
  ctx.beginPath();
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(a) * maxR, cy + Math.sin(a) * maxR);
  }
  ctx.stroke();

  // Nachleuchtender Sweep-Sektor.
  const trail = 0.55;
  const grad = ctx.createConicGradient?.(sweepAngle - trail, cx, cy);
  if (grad) {
    grad.addColorStop(0, hexToRgba(PALETTE.system, 0));
    grad.addColorStop(trail / (Math.PI * 2), hexToRgba(PALETTE.system, 0.14));
    grad.addColorStop(trail / (Math.PI * 2) + 0.001, hexToRgba(PALETTE.system, 0));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
  }

  ctx.strokeStyle = hexToRgba(PALETTE.system, 0.35);
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + Math.cos(sweepAngle) * maxR, cy + Math.sin(sweepAngle) * maxR);
  ctx.stroke();
}

/** Roter Randpuls, wenn der Rumpf kritisch steht. */
function drawDamageVignette(ctx, player) {
  const ratio = player.hp / player.maxHp;
  if (ratio > 0.35) return;

  const intensity = (1 - ratio / 0.35) * (0.35 + 0.15 * Math.sin(performance.now() / 220));
  const { width: w, height: h } = world;
  const grad = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.32, w / 2, h / 2, Math.max(w, h) * 0.72);
  grad.addColorStop(0, hexToRgba(PALETTE.alarm, 0));
  grad.addColorStop(1, hexToRgba(PALETTE.alarm, Math.max(0, intensity)));
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
}

export function render() {
  const { ctx, player } = world;
  if (!ctx) return;

  // Hintergrund liegt außerhalb des Kameraversatzes — sonst zeigten sich beim
  // Ruckeln schwarze Ränder am Bildrand.
  drawBackground(ctx);

  pushCamera(ctx);

  for (const z of world.zones) z.draw(ctx);
  drawParticles(ctx);
  for (const o of world.orbs) o.draw(ctx);
  for (const e of world.enemies) e.draw(ctx);
  for (const b of world.enemyBullets) b.draw(ctx);
  for (const b of world.bullets) b.draw(ctx);

  if (player) player.draw(ctx);

  drawRings(ctx);
  drawPopups(ctx);

  popCamera(ctx);

  // Funken und Blitze zielen auf feste Bildschirmpunkte und dürfen deshalb
  // nicht mitwackeln.
  drawSparks(ctx);
  if (player) drawDamageVignette(ctx, player);
  drawFlashes(ctx);

  if (state.combo > 1.4) drawCombo(ctx);
}

function drawCombo(ctx) {
  const { width: w } = world;
  ctx.save();
  ctx.textAlign = 'center';
  // Unterhalb der Pausentaste: Auf 26 px lag der Text vorher hinter ihr.
  const y = 82;
  const strength = Math.min(1, (state.combo - 1) / 3);
  ctx.font = `700 ${13 + strength * 5}px ui-monospace, monospace`;
  ctx.fillStyle = hexToRgba(PALETTE.salvage, 0.35 + strength * 0.65);
  ctx.fillText(`FOLGE ×${state.combo.toFixed(1)}`, w / 2, y);
  ctx.restore();
}
