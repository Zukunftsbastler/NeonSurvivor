import { world } from '../core/world.js';
import { clock } from '../core/clock.js';
import { state, addScore } from '../core/state.js';
import { PALETTE, SWEEP_MIN_ALPHA } from '../config/theme.js';
import { drawGlow } from '../render/glow.js';
import { spawnParticles, spawnDamageNumber, spawnLabel } from './fx.js';
import { Orb } from './orb.js';
import { EnemyBullet } from './bullet.js';
import { hitStop, shake, ring, flash } from '../render/juice.js';
import { vibrate } from '../core/settings.js';
import { sfxKill, sfxKillElite, sfxComboStep } from '../audio/sfx.js';
import {
  ENEMY_TYPES, BEHAVIOR, SHAPE,
  ELITE_CHANCE, ELITE_HP_MULT, ELITE_SIZE_MULT, ELITE_XP_MULT,
  enemySpeedFactor, CONTACT_COOLDOWN_FRAMES, CONTACT_KNOCKBACK,
} from '../config/enemies.js';
import {
  VEREISUNG_SLOW, KORROSION_TICK_FRAMES, KORROSION_TICK_SHARE,
} from '../config/weapons.js';

export class Enemy {
  constructor(typeId, spawnAt = null, generation = 0) {
    const def = ENEMY_TYPES[typeId] ?? ENEMY_TYPES.kontakt;
    this.def = def;
    this.type = def.id;
    this.behavior = def.behavior;
    this.shape = def.shape;
    this.generation = generation;

    if (spawnAt) {
      this.x = spawnAt.x;
      this.y = spawnAt.y;
    } else {
      const edge = Math.floor(Math.random() * 4);
      const m = 34;
      if (edge === 0) { this.x = Math.random() * world.width; this.y = -m; }
      else if (edge === 1) { this.x = world.width + m; this.y = Math.random() * world.height; }
      else if (edge === 2) { this.x = Math.random() * world.width; this.y = world.height + m; }
      else { this.x = -m; this.y = Math.random() * world.height; }
    }

    const mult = state.difficultyMultiplier;
    // Abgespaltene Einheiten sind schwächer, sonst würde der Schwarm den
    // Flächenschaden belohnen, den er eigentlich bestrafen soll.
    const genScale = Math.pow(0.55, generation);

    this.maxHp = def.hp * mult * genScale;
    this.hp = this.maxHp;
    this.baseSpeed = def.speed * enemySpeedFactor(mult);
    this.damage = def.damage * mult;
    this.xpValue = Math.floor(10 * mult * genScale);
    this.radius = def.size * Math.min(1.5, 1 + (mult - 1) * 0.08) * Math.pow(0.7, generation);

    this.isElite = generation === 0 && Math.random() < ELITE_CHANCE;
    if (this.isElite) {
      this.hp *= ELITE_HP_MULT;
      this.maxHp *= ELITE_HP_MULT;
      this.radius *= ELITE_SIZE_MULT;
      this.xpValue = Math.floor(this.xpValue * ELITE_XP_MULT);
    }

    this.dead = false;
    this.freezeTimer = 0;
    this.corrosionTimer = 0;
    this.corrosionTick = 0;
    this.corrosionDamage = 0;
    this.contactCd = 0;

    this.phase = Math.random() * Math.PI * 2;
    this.orbitDir = Math.random() < 0.5 ? 1 : -1;
    this.orbitRadius = def.orbitRadius ?? 0;
    this.lastShotAt = clock.now + Math.random() * 1200;
    this.spin = 0;
    this.heading = 0;
    /** 0 … 1 — wie frisch der Radar-Sweep diesen Kontakt erfasst hat. */
    this.paint = 1;
  }

  get frozen() {
    return this.freezeTimer > 0;
  }

  update(ts, dtMs) {
    const p = world.player;
    if (!p) return;

    let speed = this.baseSpeed * state.mods.enemySpeed;

    if (this.freezeTimer > 0) {
      this.freezeTimer -= ts;
      speed *= VEREISUNG_SLOW;
      if (Math.random() < 0.06) spawnParticles(this.x, this.y, 1, '#9fe8ff', 0.4);
    }

    if (this.corrosionTimer > 0) {
      this.corrosionTimer -= ts;
      this.corrosionTick += ts;
      if (this.corrosionTick >= KORROSION_TICK_FRAMES) {
        this.corrosionTick = 0;
        this.takeDamage(this.corrosionDamage * KORROSION_TICK_SHARE, '#b6ff5c');
        if (this.dead) return;
      }
    }

    this.spin += ts * 0.06;
    this.phase += ts * 0.04;

    switch (this.behavior) {
      case BEHAVIOR.SCHUETZE:
        this.moveStandoff(p, speed, ts);
        this.tryShoot(p);
        break;
      case BEHAVIOR.KREISER:
        this.moveOrbit(p, speed, ts, dtMs);
        break;
      case BEHAVIOR.FELD:
        this.moveChase(p, speed * 0.85, ts);
        this.applyField(p);
        break;
      default:
        this.moveChase(p, speed, ts);
    }

    if (this.contactCd > 0) this.contactCd -= ts;
    this.checkContact(p);
  }

  moveChase(p, speed, ts) {
    const angle = Math.atan2(p.y - this.y, p.x - this.x);
    this.heading = angle;
    this.x += Math.cos(angle) * speed * ts;
    this.y += Math.sin(angle) * speed * ts;
  }

  /** Hält Wunschabstand: nähert sich von außen, weicht von innen zurück. */
  moveStandoff(p, speed, ts) {
    const dx = p.x - this.x;
    const dy = p.y - this.y;
    const dist = Math.hypot(dx, dy) || 1;
    const want = this.def.standoff;

    let dir = 0;
    if (dist > want + 30) dir = 1;
    else if (dist < want - 30) dir = -1;

    this.x += (dx / dist) * speed * dir * ts;
    this.y += (dy / dist) * speed * dir * ts;

    // Seitwärtsdrift, damit Kanonenboote nicht auf einer Linie einfrieren.
    this.x += (-dy / dist) * speed * 0.35 * this.orbitDir * ts;
    this.y += (dx / dist) * speed * 0.35 * this.orbitDir * ts;
  }

  /**
   * Umkreist den Spieler und schraubt sich langsam herein.
   *
   * Wichtig: Der Aufklärer wird auf einen Zielpunkt ZUBEWEGT, statt direkt aus
   * der Spielerposition berechnet zu werden. Sonst klebte er am Spieler — jede
   * eigene Bewegung hätte ihn verlustfrei mitgezogen, und man käme ihm nie
   * davon. So bleibt Wegfahren eine wirksame Antwort, nur eine langsame.
   */
  moveOrbit(p, speed, ts, dtMs) {
    this.orbitRadius = Math.max(38, this.orbitRadius - (this.def.closeRate * dtMs) / 1000);

    const dx = this.x - p.x;
    const dy = this.y - p.y;
    const dist = Math.hypot(dx, dy) || 1;

    const angle = Math.atan2(dy, dx) + ((speed * this.orbitDir) / Math.max(60, dist)) * ts;
    const wantX = p.x + Math.cos(angle) * this.orbitRadius;
    const wantY = p.y + Math.sin(angle) * this.orbitRadius;

    const toX = wantX - this.x;
    const toY = wantY - this.y;
    const toLen = Math.hypot(toX, toY);
    const step = speed * 1.35 * ts;

    if (toLen <= step) {
      this.x = wantX;
      this.y = wantY;
    } else {
      this.x += (toX / toLen) * step;
      this.y += (toY / toLen) * step;
    }

    this.heading = Math.atan2(toY, toX);
  }

  applyField(p) {
    const dist = Math.hypot(p.x - this.x, p.y - this.y);
    if (dist < this.def.fieldRadius) p.slowFactor = Math.min(p.slowFactor, this.def.fieldSlow);
  }

  tryShoot(p) {
    const now = clock.now;
    if (now - this.lastShotAt < this.def.fireIntervalMs) return;
    if (this.frozen) return;

    this.lastShotAt = now;
    const angle = Math.atan2(p.y - this.y, p.x - this.x);
    world.enemyBullets.push(
      new EnemyBullet(this.x, this.y, angle, this.def.shotSpeed, this.def.shotDamage * state.difficultyMultiplier),
    );
  }

  /**
   * Kontakt tötet den Gegner NICHT mehr.
   *
   * Im Prototyp löste sich ein Kontakt beim Berühren auf. Eine Horde richtete
   * damit einmalig Schaden an und verschwand — es gab keinen anhaltenden
   * Druck und keinen Grund, sich zu positionieren statt nur wegzulaufen.
   */
  checkContact(p) {
    const dist = Math.hypot(p.x - this.x, p.y - this.y);
    if (dist >= this.radius + p.radius) return;
    if (this.contactCd > 0) return;

    this.contactCd = CONTACT_COOLDOWN_FRAMES;

    const angle = Math.atan2(this.y - p.y, this.x - p.x);
    this.x += Math.cos(angle) * CONTACT_KNOCKBACK;
    this.y += Math.sin(angle) * CONTACT_KNOCKBACK;

    if (!p.invulnerable) p.takeDamage(this.damage);
  }

  takeDamage(amount, tint = PALETTE.salvage) {
    if (this.dead) return;

    this.hp -= amount;
    spawnDamageNumber(this.x, this.y - this.radius - 4, amount, tint, this);

    if (this.hp <= 0) this.die();
  }

  die() {
    if (this.dead) return;
    this.dead = true;

    // Rückmeldung nach Bedeutung gestaffelt: Ein gewöhnlicher Kontakt gibt
    // einen Funken, ein Leitschiff hält kurz die Zeit an. Wäre alles gleich
    // laut, hieße das: nichts ist besonders.
    if (this.isElite) {
      spawnParticles(this.x, this.y, 14, PALETTE.alarm, 1.8);
      hitStop(85);
      shake(9);
      ring(this.x, this.y, this.radius, this.radius + 130, PALETTE.alarm, 480, 4);
      flash(PALETTE.alarm, 0.14, 130);
      sfxKillElite();
      vibrate(35);
    } else {
      spawnParticles(this.x, this.y, 5, this.color(), 1);
      ring(this.x, this.y, this.radius * 0.6, this.radius + 16, this.color(), 210, 2);
      sfxKill();
    }

    world.orbs.push(new Orb(this.x, this.y, this.xpValue));

    // Volle Stufen der Abschussfolge quittieren — eine Leiter aus kleinen
    // Belohnungen für ununterbrochenes Spiel, die bei jedem Rumpftreffer
    // wieder von vorn beginnt.
    const before = Math.floor(state.combo);
    state.combo = Math.min(10, state.combo + 0.08);
    const after = Math.floor(state.combo);
    if (after > before && after >= 2) {
      spawnLabel(world.player.x, world.player.y - 46, `FOLGE ×${after}`, PALETTE.salvage);
      ring(world.player.x, world.player.y, 18, 60 + after * 8, PALETTE.salvage, 340, 2);
      sfxComboStep(after);
    }

    state.lastKillAt = state.elapsedTime;
    addScore(this.xpValue);

    state.enemiesKilledRecent++;
    state.enemiesKilledTotal++;

    if (this.def.splitsInto && this.generation < (this.def.splitGeneration ?? 1)) {
      for (let i = 0; i < this.def.splitsInto; i++) {
        const a = Math.random() * Math.PI * 2;
        world.enemies.push(
          new Enemy(this.type, {
            x: this.x + Math.cos(a) * 16,
            y: this.y + Math.sin(a) * 16,
          }, this.generation + 1),
        );
      }
    }
  }

  color() {
    if (this.isElite) return PALETTE.alarm;
    if (this.frozen) return '#9fe8ff';
    return PALETTE.contact;
  }

  draw(ctx) {
    const alpha = SWEEP_MIN_ALPHA + (1 - SWEEP_MIN_ALPHA) * this.paint;
    const col = this.color();

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.globalAlpha = alpha;

    drawGlow(ctx, col, this.radius * 1.7, 0, 0, this.isElite ? 0.95 : 0.7);

    ctx.fillStyle = col;
    ctx.strokeStyle = col;
    ctx.lineWidth = 2;

    // Rumpfformen zeigen in Fahrtrichtung; rotationssymmetrische nicht.
    if (this.shape === SHAPE.BUG || this.shape === SHAPE.RUMPF) {
      ctx.rotate(this.heading ?? 0);
    }

    drawShape(ctx, this.shape, this.radius, this.spin, this.phase);

    if (this.isElite) {
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(0, 0, this.radius + 5, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.restore();
    ctx.globalAlpha = 1;
  }
}

/**
 * Silhouetten.
 *
 * Der Prototyp unterschied Gegner nur über einen HSL-Farbton, der aus der
 * Schwierigkeit abgeleitet war — auf einem kleinen Display praktisch nicht
 * lesbar. Form und Eigenbewegung sind die günstigste und deutlichste
 * Unterscheidung, die Canvas hergibt.
 */
function drawShape(ctx, shape, r, spin, phase) {
  switch (shape) {
    case SHAPE.RUMPF: {
      ctx.fillRect(-r, -r * 0.62, r * 2, r * 1.24);
      ctx.fillRect(-r * 0.3, -r, r * 0.6, r * 0.5);
      break;
    }

    case SHAPE.KEIL: {
      ctx.rotate(spin * 0.5);
      ctx.beginPath();
      ctx.moveTo(r * 1.5, 0);
      ctx.lineTo(-r * 0.7, r * 0.55);
      ctx.lineTo(-r * 0.35, 0);
      ctx.lineTo(-r * 0.7, -r * 0.55);
      ctx.closePath();
      ctx.fill();
      break;
    }

    case SHAPE.TURM: {
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.62, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.stroke();
      // Geschützkranz: vier kurze Striche, langsam rotierend.
      ctx.rotate(spin * 0.35);
      for (let i = 0; i < 4; i++) {
        ctx.rotate(Math.PI / 2);
        ctx.beginPath();
        ctx.moveTo(r * 0.7, 0);
        ctx.lineTo(r * 1.25, 0);
        ctx.stroke();
      }
      break;
    }

    case SHAPE.SEGMENTE: {
      ctx.rotate(spin);
      ctx.lineWidth = 3;
      for (let i = 0; i < 3; i++) {
        ctx.rotate((Math.PI * 2) / 3);
        ctx.beginPath();
        ctx.arc(0, 0, r, -0.5, 0.5);
        ctx.stroke();
      }
      break;
    }

    case SHAPE.SCHWARM: {
      // Zitterndes Punktecluster — verrät schon vor dem Tod, dass es zerfällt.
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2 + phase;
        const d = r * (0.45 + 0.35 * Math.sin(phase * 3 + i));
        ctx.beginPath();
        ctx.arc(Math.cos(a) * d, Math.sin(a) * d, r * 0.26, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }

    case SHAPE.BANK: {
      const pulse = 1 + Math.sin(phase * 1.6) * 0.08;
      ctx.globalAlpha *= 0.55;
      ctx.beginPath();
      ctx.arc(0, 0, r * pulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha /= 0.55;
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.42, 0, Math.PI * 2);
      ctx.fill();
      break;
    }

    default: {
      // Spitzer Bug, in Fahrtrichtung geneigt.
      ctx.beginPath();
      ctx.moveTo(r, 0);
      ctx.lineTo(-r * 0.75, r * 0.8);
      ctx.lineTo(-r * 0.4, 0);
      ctx.lineTo(-r * 0.75, -r * 0.8);
      ctx.closePath();
      ctx.fill();
    }
  }
}
