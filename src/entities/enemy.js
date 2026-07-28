import { world } from '../core/world.js';
import { clock } from '../core/clock.js';
import { state, addScore } from '../core/state.js';
import { PALETTE, SWEEP_MIN_ALPHA } from '../config/theme.js';
import { drawGlow } from '../render/glow.js';
import { spawnParticles, spawnDamageNumber, spawnLabel } from './fx.js';
import { Orb, spawnZone } from './orb.js';
import { EnemyBullet } from './bullet.js';
import { hitStop, shake, ring, flash } from '../render/juice.js';
import { sfxKill, sfxKillElite, sfxComboStep } from '../audio/sfx.js';
import { vibrate } from '../core/settings.js';
import {
  ENEMY_TYPES, BEHAVIOR, SHAPE, TRAITS, TRAIT_LIST, traitCountFor,
  ELITE_CHANCE, ELITE_HP_MULT, ELITE_SIZE_MULT, ELITE_XP_MULT, ELITE_TRAIT_MINUTE,
  enemySpeedFactor, CONTACT_COOLDOWN_FRAMES, CONTACT_KNOCKBACK,
  RANK_INTERVAL_S, MAX_RANK, rankSpeedMult, rankDamageMult, rankArmor,
  rankFireMult, rankXpMult, TRAIT_DRAW_BUDGET, MAX_ENEMY_SHOTS,
} from '../config/enemies.js';
import { VEREISUNG_SLOW, KORROSION_TICK_FRAMES, KORROSION_TICK_SHARE } from '../config/weapons.js';

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
    const minutes = state.elapsedTime / 60;
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

    this.traits = [];
    if (generation === 0 && (!this.isElite || minutes >= ELITE_TRAIT_MINUTE)) {
      this.assignTraits(minutes);
    }

    this.dead = false;
    this.freezeTimer = 0;
    this.corrosionTimer = 0;
    this.corrosionTick = 0;
    this.corrosionDamage = 0;
    this.contactCd = 0;

    /** Gefechtserfahrung: Sekunden auf dem Schirm und daraus die Stufe. */
    this.ageS = 0;
    this.rank = 0;

    this.phase = Math.random() * Math.PI * 2;
    this.orbitDir = Math.random() < 0.5 ? 1 : -1;
    this.orbitRadius = def.orbitRadius ?? 0;
    this.lastShotAt = clock.now + Math.random() * 1200;
    this.lastActionAt = clock.now + Math.random() * 900;
    this.spin = 0;
    this.heading = 0;
    this.paint = 1;
    /** Vom Schleppanker gebremst (Frames). */
    this.dragged = 0;
    /** Vom Suchscheinwerfer aufgedeckt (Frames). */
    this.revealed = 0;
    this.partner = null;
    this.chargeState = 'ruhe';
    this.chargeUntil = 0;
    this.chargeVector = null;
    this.phased = false;
  }

  assignTraits(minutes) {
    const want = traitCountFor(minutes);
    if (!want) return;

    const pool = TRAIT_LIST.filter((t) => minutes >= t.minute);
    if (!pool.length) return;

    let total = 0;
    for (const t of pool) total += t.weight;

    for (let i = 0; i < want; i++) {
      let roll = Math.random() * total;
      for (const t of pool) {
        roll -= t.weight;
        if (roll <= 0) {
          if (!this.traits.includes(t)) this.traits.push(t);
          break;
        }
      }
    }

    for (const t of this.traits) {
      if (t.speedMult) this.baseSpeed *= t.speedMult;
    }
  }

  hasTrait(id) {
    return this.traits.some((t) => t.id === id);
  }

  get frozen() {
    return this.freezeTimer > 0;
  }

  /**
   * Schadensfaktor aus Panzerung, Merkmalen und Phase.
   * Wird ausschließlich von `systems/damage.js` aufgerufen — dadurch bleibt
   * die Regel an einer Stelle statt über Waffen und Zonen verteilt.
   */
  resistance(tags) {
    if (this.phased) return 0.15;

    let factor = 1 - rankArmor(this.rank);
    for (const t of this.traits) {
      if (t.resist) factor *= t.resist(tags, this);
    }
    return Math.max(0.25, factor);
  }

  /** Zielpunkt: Funkfeuer schlägt den Spieler, Nebelwand macht orientierungslos. */
  targetPoint() {
    const p = world.player;
    if (world.decoy) {
      const d = Math.hypot(world.decoy.x - this.x, world.decoy.y - this.y);
      if (d < world.decoy.radius) return world.decoy;
    }
    if (clock.now < world.smokeUntil) {
      return { x: p.x + Math.cos(this.phase) * 220, y: p.y + Math.sin(this.phase) * 220 };
    }
    return p;
  }

  update(ts, dtMs) {
    const p = world.player;
    if (!p) return;

    this.ageS += dtMs / 1000;
    const wantRank = Math.min(MAX_RANK, Math.floor(this.ageS / RANK_INTERVAL_S));
    if (wantRank > this.rank) this.promote(wantRank);

    let speed = this.baseSpeed * state.mods.enemySpeed * rankSpeedMult(this.rank);

    if (this.freezeTimer > 0) {
      this.freezeTimer -= ts;
      speed *= VEREISUNG_SLOW;
      if (Math.random() < 0.06) spawnParticles(this.x, this.y, 1, '#9fe8ff', 0.4);
    }
    if (this.dragged > 0) {
      this.dragged -= ts;
      speed *= 0.55;
    }
    if (this.revealed > 0) this.revealed -= ts;

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

    this.runBehavior(this.targetPoint(), speed, ts, dtMs);

    if (this.hasTrait('magnetisch')) this.pullPlayer(p, dtMs);

    if (this.contactCd > 0) this.contactCd -= ts;
    this.checkContact(p);
  }

  promote(rank) {
    const before = rankXpMult(this.rank);
    this.rank = rank;
    this.xpValue = Math.max(1, Math.floor((this.xpValue * rankXpMult(rank)) / before));
    spawnParticles(this.x, this.y, 3, PALETTE.contact, 0.8);
  }

  runBehavior(target, speed, ts, dtMs) {
    switch (this.behavior) {
      case BEHAVIOR.SCHUETZE:
        this.moveStandoff(target, speed, ts, this.def.standoff);
        this.tryShoot(target);
        break;
      case BEHAVIOR.KREISER:
        this.moveOrbit(target, speed, ts, dtMs);
        break;
      case BEHAVIOR.FELD:
        this.moveChase(target, speed * 0.85, ts);
        this.applyField();
        break;
      case BEHAVIOR.LEGER:
        this.moveStandoff(target, speed, ts, this.def.standoff);
        this.tryLayMine();
        break;
      case BEHAVIOR.TRAEGER:
        this.moveStandoff(target, speed, ts, this.def.standoff);
        this.tryLaunch();
        break;
      case BEHAVIOR.RAMMER:
        this.runCharge(target, speed, ts);
        break;
      case BEHAVIOR.STOERER:
        this.moveChase(target, speed, ts);
        this.applyJam();
        break;
      case BEHAVIOR.SANITAETER:
        this.moveStandoff(target, speed, ts, 300);
        this.mendNearby(dtMs);
        break;
      case BEHAVIOR.GEIST:
        this.movePhase(target, speed, ts);
        break;
      default:
        this.moveChase(target, speed, ts);
    }
  }

  // --- Bewegungsmuster ----------------------------------------------------

  moveChase(target, speed, ts) {
    const angle = Math.atan2(target.y - this.y, target.x - this.x);
    this.heading = angle;

    // „Flink" weicht seitlich aus, statt stur geradeaus zu laufen.
    const wobble = this.hasTrait('flink') ? Math.sin(this.phase * 3) * 0.5 : 0;
    this.x += Math.cos(angle + wobble) * speed * ts;
    this.y += Math.sin(angle + wobble) * speed * ts;
  }

  moveStandoff(target, speed, ts, want) {
    const dx = target.x - this.x;
    const dy = target.y - this.y;
    const dist = Math.hypot(dx, dy) || 1;
    this.heading = Math.atan2(dy, dx);

    let dir = 0;
    if (dist > want + 30) dir = 1;
    else if (dist < want - 30) dir = -1;

    this.x += (dx / dist) * speed * dir * ts;
    this.y += (dy / dist) * speed * dir * ts;
    this.x += (-dy / dist) * speed * 0.35 * this.orbitDir * ts;
    this.y += (dx / dist) * speed * 0.35 * this.orbitDir * ts;
  }

  moveOrbit(target, speed, ts, dtMs) {
    this.orbitRadius = Math.max(38, this.orbitRadius - (this.def.closeRate * dtMs) / 1000);

    const dx = this.x - target.x;
    const dy = this.y - target.y;
    const dist = Math.hypot(dx, dy) || 1;
    const angle = Math.atan2(dy, dx) + ((speed * this.orbitDir) / Math.max(60, dist)) * ts;

    const wantX = target.x + Math.cos(angle) * this.orbitRadius;
    const wantY = target.y + Math.sin(angle) * this.orbitRadius;
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

  /** Rammer: aufladen (sichtbar), stürmen, erholen. */
  runCharge(target, speed, ts) {
    const d = this.def;

    if (this.chargeState === 'ruhe') {
      this.moveChase(target, speed * 0.6, ts);
      if (clock.now > this.chargeUntil) {
        this.chargeState = 'laden';
        this.chargeUntil = clock.now + d.windupMs;
      }
      return;
    }

    if (this.chargeState === 'laden') {
      this.heading = Math.atan2(target.y - this.y, target.x - this.x);
      if (clock.now > this.chargeUntil) {
        this.chargeState = 'sturm';
        this.chargeUntil = clock.now + d.chargeMs;
        this.chargeVector = { x: Math.cos(this.heading), y: Math.sin(this.heading) };
      }
      return;
    }

    this.x += this.chargeVector.x * d.chargeSpeed * ts;
    this.y += this.chargeVector.y * d.chargeSpeed * ts;
    if (Math.random() < 0.4) spawnParticles(this.x, this.y, 1, PALETTE.alarm, 0.6);
    if (clock.now > this.chargeUntil) {
      this.chargeState = 'ruhe';
      this.chargeUntil = clock.now + d.restMs;
    }
  }

  /** Geist: getaktet unverwundbar — berechenbar, nicht willkürlich. */
  movePhase(target, speed, ts) {
    const d = this.def;
    const cycle = d.phaseMs + d.solidMs;
    this.phased = (clock.now + this.lastActionAt) % cycle > d.solidMs;
    this.moveChase(target, speed * (this.phased ? 1.25 : 1), ts);
  }

  applyField() {
    const p = world.player;
    if (Math.hypot(p.x - this.x, p.y - this.y) < this.def.fieldRadius) {
      p.slowFactor = Math.min(p.slowFactor, this.def.fieldSlow);
    }
  }

  applyJam() {
    const p = world.player;
    if (Math.hypot(p.x - this.x, p.y - this.y) < this.def.jamRadius) world.jammed = 3;
  }

  pullPlayer(p, dtMs) {
    const dx = this.x - p.x;
    const dy = this.y - p.y;
    const d = Math.hypot(dx, dy) || 1;
    if (d > 260) return;
    const f = (TRAITS.magnetisch.pull * dtMs) / 1000;
    p.x += (dx / d) * f;
    p.y += (dy / d) * f;
  }

  mendNearby(dtMs) {
    const rate = this.def.mendPerSecond * (dtMs / 1000);
    for (const e of world.enemies) {
      if (e === this || e.dead) continue;
      if (Math.hypot(e.x - this.x, e.y - this.y) > this.def.mendRadius) continue;
      e.hp = Math.min(e.maxHp, e.hp + e.maxHp * rate);
    }
  }

  tryShoot(target) {
    const now = clock.now;
    if (now - this.lastShotAt < this.def.fireIntervalMs * rankFireMult(this.rank)) return;
    if (this.frozen) return;

    // Deckel: Ältestes Projektil weicht, statt den Schirm zuzupflastern.
    if (world.enemyBullets.length >= MAX_ENEMY_SHOTS) {
      const oldest = world.enemyBullets.find((b) => !b.dead && !b.reflected);
      if (oldest) oldest.dead = true;
      else return;
    }

    this.lastShotAt = now;
    const angle = Math.atan2(target.y - this.y, target.x - this.x);
    world.enemyBullets.push(
      new EnemyBullet(this.x, this.y, angle, this.def.shotSpeed,
        this.def.shotDamage * state.difficultyMultiplier * rankDamageMult(this.rank)),
    );
  }

  tryLayMine() {
    const now = clock.now;
    if (now - this.lastActionAt < this.def.layIntervalMs * rankFireMult(this.rank)) return;
    if (this.frozen) return;
    this.lastActionAt = now;

    const damage = this.def.mineDamage * state.difficultyMultiplier;

    // Gegnerminen sind Zonen: Sie nutzen dieselbe Maschinerie wie unsere
    // Wolken und brauchen keinen eigenen Objekttyp.
    spawnZone(this.x, this.y, this.def.mineRadius, 300, PALETTE.alarm, (zone) => {
      const p = world.player;
      if (!p || p.invulnerable) return;
      if (Math.hypot(p.x - zone.x, p.y - zone.y) > zone.radius * 0.55) return;
      zone.dead = true;
      p.takeDamage(damage, 'Seemine (Kontakt)');
      spawnParticles(zone.x, zone.y, 10, PALETTE.alarm, 1.6);
    });
  }

  tryLaunch() {
    const now = clock.now;
    if (now - this.lastActionAt < this.def.launchIntervalMs || this.frozen) return;
    this.lastActionAt = now;
    if (world.enemies.length > 100) return;

    for (let i = 0; i < this.def.broodSize; i++) {
      const a = Math.random() * Math.PI * 2;
      world.enemies.push(
        new Enemy('schnellboot', { x: this.x + Math.cos(a) * 20, y: this.y + Math.sin(a) * 20 }, 1),
      );
    }
  }

  checkContact(p) {
    const dist = Math.hypot(p.x - this.x, p.y - this.y);
    if (dist >= this.radius + p.radius) return;
    if (this.contactCd > 0) return;

    this.contactCd = CONTACT_COOLDOWN_FRAMES;

    if (!this.hasTrait('schwer')) {
      const angle = Math.atan2(this.y - p.y, this.x - p.x);
      this.x += Math.cos(angle) * CONTACT_KNOCKBACK;
      this.y += Math.sin(angle) * CONTACT_KNOCKBACK;
    }

    if (!p.invulnerable) p.takeDamage(this.damage * rankDamageMult(this.rank), this.def.name);

    // Ein Sturmlauf ist nach dem Einschlag verausgabt.
    if (this.chargeState === 'sturm') {
      this.chargeState = 'ruhe';
      this.chargeUntil = clock.now + this.def.restMs;
    }
  }

  /** Wendet Schaden an. Verstärkung und Widerstand sind bereits verrechnet. */
  takeDamage(amount, tint = PALETTE.salvage) {
    if (this.dead) return;

    this.hp -= amount;
    if (amount > 0) spawnDamageNumber(this.x, this.y - this.radius - 4, amount, tint, this);

    const coupled = this.traits.find((t) => t.id === 'gekoppelt');
    if (coupled && this.partner && !this.partner.dead && amount > 0) {
      this.partner.hp -= amount * coupled.shareRatio;
      if (this.partner.hp <= 0) this.partner.die();
    }

    if (this.hp <= 0) this.die();
  }

  die() {
    if (this.dead) return;
    this.dead = true;

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

    if (this.hasTrait('verstrahlt')) {
      const dmg = this.maxHp * 0.08;
      spawnZone(this.x, this.y, 70, 150, '#b6ff5c', (zone) => {
        for (const e of world.enemies) {
          if (e.dead) continue;
          if (Math.hypot(e.x - zone.x, e.y - zone.y) > zone.radius) continue;
          e.corrosionTimer = Math.max(e.corrosionTimer, 90);
          e.corrosionDamage = Math.max(e.corrosionDamage, dmg);
        }
      });
    }

    world.orbs.push(new Orb(this.x, this.y, this.xpValue));

    const before = Math.floor(state.combo);
    state.combo = Math.min(10, state.combo + 0.08);
    const after = Math.floor(state.combo);
    if (after > before && after >= 2 && world.player) {
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
          new Enemy(this.type, { x: this.x + Math.cos(a) * 16, y: this.y + Math.sin(a) * 16 }, this.generation + 1),
        );
      }
    }
  }

  color() {
    if (this.isElite) return PALETTE.alarm;
    if (this.frozen) return '#9fe8ff';
    if (this.chargeState === 'laden') return PALETTE.alarm;
    return PALETTE.contact;
  }

  draw(ctx, withTraits = true) {
    const submerged = this.hasTrait('getaucht') && this.paint < 0.25 && this.revealed <= 0;
    let alpha = SWEEP_MIN_ALPHA + (1 - SWEEP_MIN_ALPHA) * this.paint;
    if (submerged) alpha *= 0.35;
    if (this.phased) alpha *= 0.4;

    const col = this.color();

    // Die Trosse zum Partner liegt außerhalb der Objekttransformation.
    if (withTraits && this.hasTrait('gekoppelt') && this.partner && !this.partner.dead) {
      ctx.strokeStyle = col;
      ctx.globalAlpha = alpha * 0.4;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(this.x, this.y);
      ctx.lineTo(this.partner.x, this.partner.y);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.globalAlpha = alpha;

    drawGlow(ctx, col, this.radius * 1.7, 0, 0, this.isElite ? 0.95 : 0.7);

    ctx.fillStyle = col;
    ctx.strokeStyle = col;
    ctx.lineWidth = 2;

    const oriented =
      this.shape === SHAPE.BUG || this.shape === SHAPE.RUMPF ||
      this.shape === SHAPE.SPORN || this.shape === SHAPE.LEGER ||
      this.shape === SHAPE.TRAEGER || this.shape === SHAPE.PHANTOM;

    if (oriented) ctx.rotate(this.heading ?? 0);
    drawShape(ctx, this.shape, this.radius, this.spin, this.phase, this);
    if (oriented) ctx.rotate(-(this.heading ?? 0));

    if (withTraits) {
      for (const t of this.traits) t.draw?.(ctx, this.radius, this);
      if (this.rank > 0) drawPennants(ctx, this.radius, this.rank, col);
    }

    if (this.isElite) {
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(0, 0, this.radius + 5, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Der Rammer kündigt seinen Sturmlauf an — sonst wäre er unfair.
    if (this.chargeState === 'laden') {
      const t = 1 - (this.chargeUntil - clock.now) / this.def.windupMs;
      ctx.strokeStyle = PALETTE.alarm;
      ctx.lineWidth = 2;
      ctx.globalAlpha = alpha * (0.3 + t * 0.7);
      ctx.beginPath();
      ctx.moveTo(Math.cos(this.heading) * this.radius, Math.sin(this.heading) * this.radius);
      ctx.lineTo(
        Math.cos(this.heading) * (this.radius + 60 * t),
        Math.sin(this.heading) * (this.radius + 60 * t),
      );
      ctx.stroke();
    }

    ctx.restore();
    ctx.globalAlpha = 1;
  }
}

/**
 * Wimpel zeigen die Gefechtserfahrung.
 *
 * Signalflaggen sind auf einen Blick zählbar, brauchen keine eigene Farbe und
 * kosten drei Striche — der Spieler liest die Bedrohung, ohne eine Zahl zu lesen.
 */
function drawPennants(ctx, r, rank, color) {
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 1;

  const mastY = -r - 4;
  ctx.beginPath();
  ctx.moveTo(0, -r);
  ctx.lineTo(0, mastY - rank * 4);
  ctx.stroke();

  for (let i = 0; i < rank; i++) {
    const y = mastY - i * 4;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(5, y + 1.6);
    ctx.lineTo(0, y + 3.2);
    ctx.closePath();
    ctx.fill();
  }
}

function drawShape(ctx, shape, r, spin, phase, enemy) {
  switch (shape) {
    case SHAPE.RUMPF:
      ctx.fillRect(-r, -r * 0.62, r * 2, r * 1.24);
      ctx.fillRect(-r * 0.3, -r, r * 0.6, r * 0.5);
      break;

    case SHAPE.KEIL:
      ctx.rotate(spin * 0.5);
      ctx.beginPath();
      ctx.moveTo(r * 1.5, 0);
      ctx.lineTo(-r * 0.7, r * 0.55);
      ctx.lineTo(-r * 0.35, 0);
      ctx.lineTo(-r * 0.7, -r * 0.55);
      ctx.closePath();
      ctx.fill();
      break;

    case SHAPE.TURM:
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.62, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.rotate(spin * 0.35);
      for (let i = 0; i < 4; i++) {
        ctx.rotate(Math.PI / 2);
        ctx.beginPath();
        ctx.moveTo(r * 0.7, 0);
        ctx.lineTo(r * 1.25, 0);
        ctx.stroke();
      }
      break;

    case SHAPE.SEGMENTE:
      ctx.rotate(spin);
      ctx.lineWidth = 3;
      for (let i = 0; i < 3; i++) {
        ctx.rotate((Math.PI * 2) / 3);
        ctx.beginPath();
        ctx.arc(0, 0, r, -0.5, 0.5);
        ctx.stroke();
      }
      break;

    case SHAPE.SCHWARM:
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2 + phase;
        const d = r * (0.45 + 0.35 * Math.sin(phase * 3 + i));
        ctx.beginPath();
        ctx.arc(Math.cos(a) * d, Math.sin(a) * d, r * 0.26, 0, Math.PI * 2);
        ctx.fill();
      }
      break;

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

    case SHAPE.LEGER:
      // Breiter Heckspiegel mit Ablaufschiene.
      ctx.fillRect(-r * 0.9, -r * 0.5, r * 1.6, r);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(-r * 0.9, -r * 0.75);
      ctx.lineTo(-r * 1.6, 0);
      ctx.lineTo(-r * 0.9, r * 0.75);
      ctx.stroke();
      break;

    case SHAPE.TRAEGER:
      // Flaches Deck mit seitlichem Aufbau.
      ctx.fillRect(-r, -r * 0.34, r * 2, r * 0.68);
      ctx.fillRect(r * 0.2, -r * 0.9, r * 0.45, r * 0.6);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(-r, 0);
      ctx.lineTo(r, 0);
      ctx.stroke();
      break;

    case SHAPE.SPORN:
      // Überlanger Rammsporn — die Absicht ist der Silhouette anzusehen.
      ctx.beginPath();
      ctx.moveTo(r * 1.8, 0);
      ctx.lineTo(-r * 0.5, r * 0.7);
      ctx.lineTo(-r * 0.8, 0);
      ctx.lineTo(-r * 0.5, -r * 0.7);
      ctx.closePath();
      ctx.fill();
      break;

    case SHAPE.ANTENNE: {
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = 1.4;
      const wob = Math.sin(phase * 2) * 0.25;
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2 + spin * 0.6 + wob;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(a) * r * 1.5, Math.sin(a) * r * 1.5);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(Math.cos(a) * r * 1.5, Math.sin(a) * r * 1.5, 1.8, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }

    case SHAPE.KREUZ:
      ctx.fillRect(-r * 0.28, -r, r * 0.56, r * 2);
      ctx.fillRect(-r, -r * 0.28, r * 2, r * 0.56);
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(0, 0, r * 1.25, 0, Math.PI * 2);
      ctx.stroke();
      break;

    case SHAPE.PHANTOM: {
      // Doppelte, versetzte Kontur — wirkt „nicht ganz da".
      ctx.lineWidth = 1.6;
      for (const off of [-1.5, 1.5]) {
        ctx.beginPath();
        ctx.moveTo(r + off, off);
        ctx.lineTo(-r * 0.7 + off, r * 0.8 + off);
        ctx.lineTo(-r * 0.4 + off, off);
        ctx.lineTo(-r * 0.7 + off, -r * 0.8 + off);
        ctx.closePath();
        ctx.stroke();
      }
      if (!enemy.phased) {
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.3, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }

    default:
      ctx.beginPath();
      ctx.moveTo(r, 0);
      ctx.lineTo(-r * 0.75, r * 0.8);
      ctx.lineTo(-r * 0.4, 0);
      ctx.lineTo(-r * 0.75, -r * 0.8);
      ctx.closePath();
      ctx.fill();
  }
}

/**
 * Verbindet „gekoppelte" Kontakte paarweise — ein Partner muss erst existieren,
 * deshalb geschieht das nach dem Spawnen statt im Konstruktor.
 */
export function pairCoupled(list) {
  const singles = list.filter(
    (e) => !e.dead && e.hasTrait('gekoppelt') && (!e.partner || e.partner.dead),
  );
  for (let i = 0; i + 1 < singles.length; i += 2) {
    singles[i].partner = singles[i + 1];
    singles[i + 1].partner = singles[i];
  }
}

export { TRAIT_DRAW_BUDGET };
