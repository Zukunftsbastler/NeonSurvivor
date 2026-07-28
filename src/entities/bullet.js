import { world } from '../core/world.js';
import { drawGlow } from '../render/glow.js';
import { PALETTE } from '../config/theme.js';
import { ECHO_TURN_AT, TRAIT } from '../config/weapons.js';

/**
 * Eigenes Projektil.
 *
 * `hitList` ist ein Set statt eines Arrays: Bei `pierce: 99` (Peilstrahl)
 * wuchs die Liste, und `Array.includes` suchte für jeden Kontakt linear.
 */
export class Bullet {
  constructor(opts) {
    this.reset(opts);
  }

  reset({ x, y, angle, damage, speed, life, pierce, color, effect, trait, charged, tags, sourceName }) {
    this.x = x;
    this.y = y;
    this.originX = x;
    this.originY = y;
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.speed = speed;
    this.damage = damage;
    this.radius = charged ? 6 : 4;
    this.life = life;
    this.maxLife = life;
    this.pierce = pierce;
    this.color = color;
    this.effect = effect;
    this.trait = trait;
    this.charged = !!charged;
    /** Marken des Ereignisses. Nah-/Fernbereich kommen beim Treffer dazu. */
    this.tags = tags ?? [];
    /** Klartextname für das Schadensbuch. */
    this.sourceName = sourceName ?? 'Signalgeber';
    this.dead = false;
    this.returning = false;
    this.hitList = new Set();
    return this;
  }

  update(ts) {
    this.x += this.vx * ts;
    this.y += this.vy * ts;
    this.life -= ts;

    if (this.trait === TRAIT.ECHO && !this.returning && this.life <= this.maxLife * ECHO_TURN_AT) {
      this.turnAround();
    }

    if (this.returning) {
      // Zurück zum Spieler steuern — der Treffer auf dem Rückweg ist der
      // eigentliche Reiz des Echolots.
      const p = world.player;
      if (p) {
        const angle = Math.atan2(p.y - this.y, p.x - this.x);
        this.vx += Math.cos(angle) * 0.45 * ts;
        this.vy += Math.sin(angle) * 0.45 * ts;
        const len = Math.hypot(this.vx, this.vy) || 1;
        this.vx = (this.vx / len) * this.speed;
        this.vy = (this.vy / len) * this.speed;
      }
    }

    if (this.life <= 0) this.dead = true;

    const m = 60;
    if (this.x < -m || this.x > world.width + m || this.y < -m || this.y > world.height + m) {
      if (!this.returning) this.dead = true;
    }
  }

  turnAround() {
    this.returning = true;
    this.vx *= -1;
    this.vy *= -1;
    // Auf dem Rückweg zählt jeder Kontakt wieder als neues Ziel.
    this.hitList.clear();
    this.pierce = Math.max(this.pierce, 2);
  }

  /** Zurückgelegte Strecke — der Brandungsfächer wertet sie aus. */
  travelled() {
    return Math.hypot(this.x - this.originX, this.y - this.originY);
  }

  draw(ctx) {
    drawGlow(ctx, this.color, this.radius * 2.2, this.x, this.y, this.charged ? 1 : 0.85);
    ctx.fillStyle = this.charged ? '#ffffff' : PALETTE.salvage;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius * 0.55, 0, Math.PI * 2);
    ctx.fill();
  }
}

/**
 * Projektil-Pool.
 *
 * Bei hoher Salvenzahl entstehen mehrere hundert Projektile pro Sekunde.
 * Sie wiederzuverwenden hält den Allokationsdruck niedrig — auf Mobilgeräten
 * zeigen sich GC-Pausen sonst als Mikroruckler.
 */
const pool = [];

export function acquireBullet(opts) {
  const b = pool.pop();
  return b ? b.reset(opts) : new Bullet(opts);
}

export function releaseBullet(b) {
  // Verweise lösen, damit der Pool keine toten Kontakte am Leben hält.
  b.hitList.clear();
  if (pool.length < 800) pool.push(b);
}

export function clearBulletPool() {
  pool.length = 0;
}

/** Projektil eines Kanonenboots. Langsam und gut lesbar — es soll fair sein. */
export class EnemyBullet {
  constructor(x, y, angle, speed, damage) {
    this.x = x;
    this.y = y;
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.damage = damage;
    this.radius = 5;
    this.life = 260;
    this.dead = false;
    this.reflected = false;
    this.hitList = new Set();
  }

  /** Kehrt die Flugrichtung um und macht das Projektil zu unserem. */
  reflect(damage) {
    this.vx *= -1.15;
    this.vy *= -1.15;
    this.reflected = true;
    this.damage = damage;
    this.life = 200;
    this.hitList = new Set();
  }

  update(ts) {
    this.x += this.vx * ts;
    this.y += this.vy * ts;
    this.life -= ts;

    const m = 40;
    if (
      this.life <= 0 ||
      this.x < -m || this.x > world.width + m ||
      this.y < -m || this.y > world.height + m
    ) {
      this.dead = true;
    }
  }

  draw(ctx) {
    const col = this.reflected ? PALETTE.system : PALETTE.alarm;
    drawGlow(ctx, col, this.radius * 2.4, this.x, this.y, 0.9);
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius * 0.6, 0, Math.PI * 2);
    ctx.fill();
  }
}
