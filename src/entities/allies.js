/**
 * Eigene Einheiten und Auslagen: Geleitboote, Bordflieger, Seeminen, Funkfeuer.
 *
 * Alle vier hängen an Marken und laufen damit automatisch in den Wirkketten
 * mit — ein „+Geleit"-Verstärker hebt Boote und Flieger, ohne dass hier etwas
 * davon steht.
 */

import { world } from '../core/world.js';
import { clock } from '../core/clock.js';
import { PALETTE } from '../config/theme.js';
import { TAG } from '../config/tags.js';
import { drawGlow } from '../render/glow.js';
import { spawnParticles } from './fx.js';
import { dealDamage, areaDamage, nearestOther } from '../systems/damage.js';
import { systemPower } from '../systems/power.js';
import { sfxShoot, sfxDetonate } from '../audio/sfx.js';

/** Begleitboot: kreist um den Spieler und feuert selbständig. */
export class Escort {
  constructor(index, total) {
    this.index = index;
    this.total = total;
    this.angle = (index / Math.max(1, total)) * Math.PI * 2;
    this.radius = 66;
    this.x = 0;
    this.y = 0;
    this.lastShot = 0;
    this.intact = true;
    this.dead = false;
  }

  update(dtMs, level) {
    const p = world.player;
    if (!p) return;

    this.angle += (dtMs / 1000) * 1.25;
    this.radius = 60 + level * 5;
    this.x = p.x + Math.cos(this.angle) * this.radius;
    this.y = p.y + Math.sin(this.angle) * this.radius;

    const interval = 900 - level * 90;
    if (clock.now - this.lastShot < interval) return;

    const target = nearestOther(this.x, this.y, 340, null);
    if (!target) return;

    this.lastShot = clock.now;

    // Das Geleit feuert direkt statt über Projektile: Bei fünf Booten wären
    // das sonst hunderte zusätzliche Objekte pro Sekunde auf dem Handy.
    const bonus = this.intact ? 1.25 : 1;
    dealDamage(target, systemPower(world.player, 0.3 + level * 0.22) * bonus,
      [TAG.GELEIT, TAG.IMPULS], PALETTE.salvage, 'Geleitboot');
    spawnParticles(target.x, target.y, 2, PALETTE.salvage, 0.9);
    this.beamUntil = clock.now + 90;
    this.beamTo = { x: target.x, y: target.y };
    sfxShoot('dauerstrich');
  }

  draw(ctx) {
    if (this.beamUntil > clock.now && this.beamTo) {
      ctx.strokeStyle = PALETTE.salvage;
      ctx.globalAlpha = 0.45;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(this.x, this.y);
      ctx.lineTo(this.beamTo.x, this.beamTo.y);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    drawGlow(ctx, PALETTE.salvage, 13, this.x, this.y, this.intact ? 0.8 : 0.45);
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle + Math.PI / 2);
    ctx.fillStyle = this.intact ? PALETTE.salvage : PALETTE.chrome;
    ctx.beginPath();
    ctx.moveTo(0, -6);
    ctx.lineTo(4, 5);
    ctx.lineTo(-4, 5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}

/** Bordflieger: sucht sich ein Ziel, rammt es und zerlegt sich dabei. */
export class Drone {
  constructor(x, y, damage) {
    this.x = x;
    this.y = y;
    this.vx = (Math.random() - 0.5) * 4;
    this.vy = (Math.random() - 0.5) * 4;
    this.damage = damage;
    this.life = 9000;
    this.dead = false;
    this.target = null;
  }

  update(dtMs, ts) {
    this.life -= dtMs;
    if (this.life <= 0) {
      this.dead = true;
      return;
    }

    if (!this.target || this.target.dead) this.target = nearestOther(this.x, this.y, 520, null);

    if (this.target) {
      const dx = this.target.x - this.x;
      const dy = this.target.y - this.y;
      const d = Math.hypot(dx, dy) || 1;
      this.vx += (dx / d) * 0.55 * ts;
      this.vy += (dy / d) * 0.55 * ts;

      const speed = Math.hypot(this.vx, this.vy);
      const cap = 7.5;
      if (speed > cap) {
        this.vx = (this.vx / speed) * cap;
        this.vy = (this.vy / speed) * cap;
      }

      if (d < this.target.radius + 7) {
        dealDamage(this.target, this.damage, [TAG.GELEIT, TAG.IMPULS], PALETTE.salvage, 'Bordflieger');
        spawnParticles(this.x, this.y, 6, PALETTE.salvage, 1.4);
        this.dead = true;
        return;
      }
    }

    this.x += this.vx * ts;
    this.y += this.vy * ts;
  }

  draw(ctx) {
    drawGlow(ctx, PALETTE.salvage, 9, this.x, this.y, 0.7);
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(Math.atan2(this.vy, this.vx));
    ctx.strokeStyle = PALETTE.salvage;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(5, 0);
    ctx.lineTo(-4, 3);
    ctx.moveTo(5, 0);
    ctx.lineTo(-4, -3);
    ctx.stroke();
    ctx.restore();
  }
}

/** Seemine: scharf nach kurzer Verzögerung, zündet bei Annäherung. */
export class Mine {
  constructor(x, y, damage) {
    this.x = x;
    this.y = y;
    this.damage = damage;
    this.armIn = 700;
    this.life = 14000;
    this.dead = false;
    this.phase = Math.random() * Math.PI * 2;
  }

  update(dtMs) {
    this.armIn -= dtMs;
    this.life -= dtMs;
    this.phase += dtMs / 260;

    if (this.life <= 0) {
      this.dead = true;
      return;
    }
    if (this.armIn > 0) return;

    const near = nearestOther(this.x, this.y, 34, null);
    if (near) this.detonate();
  }

  detonate() {
    if (this.dead) return;
    this.dead = true;
    areaDamage(this.x, this.y, this.damage, 84, [TAG.DRUCKWELLE, TAG.ZONE], PALETTE.contact, null, 'Seemine');
    spawnParticles(this.x, this.y, 10, PALETTE.contact, 1.6);
    sfxDetonate();
  }

  draw(ctx) {
    const armed = this.armIn <= 0;
    const pulse = armed ? 0.6 + Math.sin(this.phase) * 0.4 : 0.25;
    drawGlow(ctx, PALETTE.contact, 14, this.x, this.y, pulse * 0.7);

    ctx.strokeStyle = PALETTE.contact;
    ctx.globalAlpha = armed ? 0.9 : 0.4;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(this.x, this.y, 6, 0, Math.PI * 2);
    ctx.stroke();

    // Hörner — macht die Mine auch bei kleiner Größe eindeutig.
    for (let i = 0; i < 4; i++) {
      const a = this.phase * 0.2 + (i / 4) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(this.x + Math.cos(a) * 6, this.y + Math.sin(a) * 6);
      ctx.lineTo(this.x + Math.cos(a) * 10, this.y + Math.sin(a) * 10);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
}

/** Funkfeuer: bindet Kontakte an sich, statt sie auf den Spieler zu lassen. */
export class Beacon {
  constructor(x, y, lifeMs) {
    this.x = x;
    this.y = y;
    this.life = lifeMs;
    this.maxLife = lifeMs;
    this.radius = 260;
    this.dead = false;
    this.phase = 0;
  }

  update(dtMs) {
    this.life -= dtMs;
    this.phase += dtMs / 400;
    if (this.life <= 0) this.dead = true;
  }

  draw(ctx) {
    const t = this.life / this.maxLife;
    drawGlow(ctx, PALETTE.system, 18, this.x, this.y, 0.7 * t + 0.2);

    ctx.strokeStyle = PALETTE.system;
    ctx.globalAlpha = 0.35 * t;
    ctx.lineWidth = 1;
    for (let i = 0; i < 2; i++) {
      const r = ((this.phase + i * 0.5) % 1) * this.radius;
      ctx.beginPath();
      ctx.arc(this.x, this.y, r, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.globalAlpha = 0.9 * t;
    ctx.fillStyle = PALETTE.system;
    ctx.beginPath();
    ctx.arc(this.x, this.y, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}
