/**
 * Partikel und Schadenszahlen — beide gepoolt.
 *
 * Zwei Probleme des Prototyps:
 *
 * 1. `Array.filter` legte fünfmal pro Frame neue Arrays an, dazu laufend
 *    `new Particle` / `new Popup`. Auf Mobilgeräten zeigte sich das als
 *    Mikroruckler durch Garbage Collection.
 * 2. Für JEDEN Treffer entstand eine eigene Schadenszahl. Mit Salve und
 *    Flächenschaden waren das hunderte pro Frame, jede mit einem
 *    Font-Wechsel — und bei hohem Schaden ohnehin unlesbar.
 *
 * Jetzt: feste Pools, In-Place-Kompaktierung, und Schadenszahlen werden pro
 * Kontakt AUFSUMMIERT statt einzeln gezeichnet.
 */

import { PALETTE, FONT_UI } from '../config/theme.js';
import { world } from '../core/world.js';
import { drawGlow } from '../render/glow.js';

const MAX_PARTICLES = 320;
const MAX_POPUPS = 40;

class Particle {
  constructor() {
    this.active = false;
    this.x = 0; this.y = 0; this.vx = 0; this.vy = 0;
    this.life = 0; this.decay = 0; this.size = 0; this.color = '#fff';
  }

  spawn(x, y, size, color, speedScale) {
    this.active = true;
    this.x = x; this.y = y;
    const angle = Math.random() * Math.PI * 2;
    const speed = Math.random() * 3 * speedScale;
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.life = 1;
    this.decay = 0.05 + Math.random() * 0.05;
    this.size = size;
    this.color = color;
  }

  update(ts) {
    this.x += this.vx * ts;
    this.y += this.vy * ts;
    this.life -= this.decay * ts;
    if (this.life <= 0) this.active = false;
  }
}

class Popup {
  constructor() {
    this.active = false;
    this.x = 0; this.y = 0; this.amount = 0; this.text = '';
    this.color = '#fff'; this.life = 0; this.owner = null;
  }

  spawn(x, y, color, owner, amount, text) {
    this.active = true;
    this.x = x; this.y = y;
    this.color = color;
    this.owner = owner;
    this.amount = amount;
    this.text = text;
    this.life = 1;
  }

  update(ts) {
    this.y -= 0.9 * ts;
    this.life -= 0.018 * ts;
    if (this.life <= 0) {
      this.active = false;
      this.owner = null;
    }
  }
}

/**
 * Funke, der ein aufgenommenes Signal zur Erfahrungsleiste trägt.
 *
 * Der Zweck ist rein psychologisch: Ohne ihn verschwindet ein Orb im Spieler
 * und die Leiste rückt irgendwo am Bildrand ein Stück weiter — zwei Ereignisse
 * ohne sichtbaren Zusammenhang. Der Funke verbindet sie und macht aus dem
 * Einsammeln einen abgeschlossenen Vorgang.
 */
class Spark {
  constructor() {
    this.active = false;
    this.x = 0; this.y = 0;
    this.sx = 0; this.sy = 0;
    this.cx = 0; this.cy = 0;
    this.t = 0; this.speed = 0;
  }

  spawn(x, y, tx, ty) {
    this.active = true;
    this.sx = x; this.sy = y;
    this.x = x; this.y = y;
    this.t = 0;
    // Kontrollpunkt seitlich versetzt: ergibt einen ausholenden Bogen statt
    // einer geraden Linie.
    const mx = (x + tx) / 2;
    const my = (y + ty) / 2;
    const dx = tx - x;
    const dy = ty - y;
    const swing = 0.34 * (Math.random() < 0.5 ? -1 : 1);
    this.cx = mx - dy * swing;
    this.cy = my + dx * swing;
    this.speed = 1.6 + Math.random() * 0.7;
  }

  update(ts) {
    this.t = Math.min(1, this.t + 0.026 * this.speed * ts);

    // Quadratische Bézier von Startpunkt über Kontrollpunkt zum Ziel.
    const e = this.t * this.t * (3 - 2 * this.t);
    const u = 1 - e;
    this.x = u * u * this.sx + 2 * u * e * this.cx + e * e * hudTarget.x;
    this.y = u * u * this.sy + 2 * u * e * this.cy + e * e * hudTarget.y;

    if (this.t >= 1) {
      this.active = false;
      onSparkArrive?.();
    }
  }
}

const particles = Array.from({ length: MAX_PARTICLES }, () => new Particle());
const popups = Array.from({ length: MAX_POPUPS }, () => new Popup());
const sparks = Array.from({ length: 48 }, () => new Spark());

const hudTarget = { x: 40, y: 40 };
let onSparkArrive = null;

/** Zielpunkt der Funken — die tatsächliche Bildschirmlage der Erfahrungsleiste. */
export function setSparkTarget(x, y) {
  hudTarget.x = x;
  hudTarget.y = y;
}

export function setSparkArrivalHandler(fn) {
  onSparkArrive = fn;
}

export function spawnXpSpark(x, y) {
  const free = sparks.find((s) => !s.active);
  if (free) free.spawn(x, y, hudTarget.x, hudTarget.y);
}

let particleCursor = 0;

export function spawnParticles(x, y, count, color, speedScale = 1) {
  for (let i = 0; i < count; i++) {
    // Ringpuffer: Bei Überlast werden die ältesten Partikel überschrieben,
    // statt die Obergrenze zu sprengen oder Effekte ganz zu verschlucken.
    const p = particles[particleCursor];
    particleCursor = (particleCursor + 1) % MAX_PARTICLES;
    p.spawn(x, y, 4, color, speedScale);
  }
}

/**
 * Schadenszahl. Existiert für `owner` bereits eine lebende Zahl, wird der
 * Betrag aufaddiert statt eine zweite anzulegen.
 */
export function spawnDamageNumber(x, y, amount, color = PALETTE.salvage, owner = null) {
  if (owner) {
    for (const p of popups) {
      if (p.active && p.owner === owner) {
        p.amount += amount;
        p.text = String(Math.round(p.amount));
        p.life = Math.min(1, p.life + 0.25);
        p.x = x;
        p.y = y;
        return;
      }
    }
  }

  const free = popups.find((p) => !p.active) ?? popups.reduce((a, b) => (a.life < b.life ? a : b));
  free.spawn(x, y, color, owner, amount, String(Math.round(amount)));
}

/** Freitext (z. B. "+RUMPF") ohne Aufsummierung. */
export function spawnLabel(x, y, text, color) {
  const free = popups.find((p) => !p.active);
  if (!free) return;
  free.spawn(x, y, color, null, 0, text);
}

export function updateFx(ts) {
  for (const p of particles) if (p.active) p.update(ts);
  for (const p of popups) if (p.active) p.update(ts);
}

/** Funken laufen in ECHTZEIT weiter, auch wenn die Welt gerade steht. */
export function updateSparks(realTs) {
  for (const s of sparks) if (s.active) s.update(realTs);
}

export function drawSparks(ctx) {
  for (const s of sparks) {
    if (!s.active) continue;
    const fade = 1 - Math.pow(s.t, 3);
    ctx.globalAlpha = 0.35 + 0.65 * fade;
    drawGlow(ctx, PALETTE.salvage, 9, s.x, s.y, 0.8);
    ctx.fillStyle = PALETTE.salvage;
    ctx.beginPath();
    ctx.arc(s.x, s.y, 1.9, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

export function drawParticles(ctx) {
  for (const p of particles) {
    if (!p.active) continue;
    ctx.globalAlpha = Math.max(0, p.life);
    ctx.fillStyle = p.color;
    const s = p.size * p.life;
    ctx.fillRect(p.x - s / 2, p.y - s / 2, s, s);
  }
  ctx.globalAlpha = 1;
}

export function drawPopups(ctx) {
  // Font einmal pro Frame setzen statt einmal pro Zahl.
  ctx.font = `600 12px ${FONT_UI}`;
  ctx.textAlign = 'center';

  for (const p of popups) {
    if (!p.active) continue;
    ctx.globalAlpha = Math.max(0, Math.min(1, p.life));
    ctx.fillStyle = p.color;
    // In den Bildausschnitt zwingen: Am Rand wurden Zahlen sonst angeschnitten.
    const x = Math.max(22, Math.min(world.width - 22, p.x));
    ctx.fillText(p.text, x, p.y);
  }

  ctx.globalAlpha = 1;
  ctx.textAlign = 'left';
}

export function clearFx() {
  for (const s of sparks) s.active = false;
  for (const p of particles) p.active = false;
  for (const p of popups) {
    p.active = false;
    p.owner = null;
  }
  particleCursor = 0;
}
