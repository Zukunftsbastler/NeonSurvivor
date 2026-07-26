import { world } from '../core/world.js';
import { state } from '../core/state.js';
import { PALETTE } from '../config/theme.js';
import { drawGlow } from '../render/glow.js';

/** Aufgefasstes Signal (XP). */
export class Orb {
  constructor(x, y, value) {
    this.x = x;
    this.y = y;
    this.value = value;
    this.radius = 4;
    this.magnetized = false;
    this.dead = false;
    this.wobble = Math.random() * Math.PI * 2;

    this.vx = 0;
    this.vy = 0;
    // Spur der letzten Positionen für den Schweif.
    this.trail = [];
  }

  /**
   * Anziehung über Beschleunigung statt über direktes Zusteuern.
   *
   * Vorher fuhr das Signal schnurgerade auf den Spieler zu. Jetzt bekommt es
   * beim Erfassen einen seitlichen Anstoß und wird dann herangezogen — das
   * ergibt eine ausholende Kurve, die sich zum Schluss beschleunigt. Der
   * Unterschied ist rein optisch, macht das Einsammeln aber erst zu einer
   * sichtbaren Bewegung statt zu einem Verschwinden.
   */
  update(ts, player) {
    this.wobble += ts * 0.12;

    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const dist = Math.hypot(dx, dy) || 1;

    if (!this.magnetized) {
      if (dist >= player.pickupRange) return;

      this.magnetized = true;
      // Seitlicher Anstoß senkrecht zur Verbindungslinie.
      const side = Math.random() < 0.5 ? 1 : -1;
      const kick = 2.6 + Math.random() * 2.2;
      this.vx = (-dy / dist) * kick * side;
      this.vy = (dx / dist) * kick * side;
    }

    // Anziehung wächst mit der Nähe — das Signal „fällt“ zum Schluss hinein.
    const pull = 0.9 + (1 - Math.min(1, dist / 260)) * 1.9;
    this.vx += (dx / dist) * pull * ts;
    this.vy += (dy / dist) * pull * ts;

    // Reibung begrenzt die Endgeschwindigkeit, ohne die Kurve zu töten.
    const drag = Math.pow(0.86, ts);
    this.vx *= drag;
    this.vy *= drag;

    const speed = Math.hypot(this.vx, this.vy);
    const cap = 16;
    if (speed > cap) {
      this.vx = (this.vx / speed) * cap;
      this.vy = (this.vy / speed) * cap;
    }

    this.x += this.vx * ts;
    this.y += this.vy * ts;

    this.trail.push(this.x, this.y);
    if (this.trail.length > 12) this.trail.splice(0, 2);

    if (Math.hypot(player.x - this.x, player.y - this.y) < player.radius + 7) this.dead = true;
  }

  get worth() {
    return this.value * state.mods.orbValue;
  }

  draw(ctx) {
    const r = this.radius + Math.sin(this.wobble) * 0.6;

    // Schweif zeichnet die gefahrene Kurve nach.
    if (this.trail.length >= 4) {
      ctx.strokeStyle = PALETTE.salvage;
      ctx.lineWidth = 1.4;
      ctx.globalAlpha = 0.3;
      ctx.beginPath();
      ctx.moveTo(this.trail[0], this.trail[1]);
      for (let i = 2; i < this.trail.length; i += 2) ctx.lineTo(this.trail[i], this.trail[i + 1]);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    drawGlow(ctx, PALETTE.salvage, r * 2.4, this.x, this.y, 0.75);
    ctx.fillStyle = PALETTE.salvage;
    ctx.beginPath();
    ctx.arc(this.x, this.y, r * 0.6, 0, Math.PI * 2);
    ctx.fill();
  }
}

/**
 * Kurzlebige Flächenwirkung: Korrosionswolke (aus der Synergie Korrosion +
 * Grundmine) oder Druckwelle des Schleppnetzes.
 */
export class Zone {
  constructor(x, y, radius, life, color, onTick) {
    this.x = x;
    this.y = y;
    this.radius = radius;
    this.life = life;
    this.maxLife = life;
    this.color = color;
    this.onTick = onTick;
    this.dead = false;
    this.tickAcc = 0;
  }

  update(ts) {
    this.life -= ts;
    this.tickAcc += ts;

    if (this.tickAcc >= 15) {
      this.tickAcc = 0;
      this.onTick?.(this);
    }

    if (this.life <= 0) this.dead = true;
  }

  draw(ctx) {
    const t = Math.max(0, this.life / this.maxLife);
    ctx.globalAlpha = t * 0.28;
    drawGlow(ctx, this.color, this.radius, this.x, this.y, 1);
    ctx.globalAlpha = t * 0.5;
    ctx.strokeStyle = this.color;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius * (0.6 + 0.4 * (1 - t)), 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
}

export function spawnZone(x, y, radius, life, color, onTick) {
  world.zones.push(new Zone(x, y, radius, life, color, onTick));
}
