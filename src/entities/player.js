import { world } from '../core/world.js';
import { clock } from '../core/clock.js';
import { state } from '../core/state.js';
import { getMoveVector, input } from '../core/input.js';
import { PALETTE } from '../config/theme.js';
import { drawGlow } from '../render/glow.js';
import { spawnParticles, spawnLabel } from './fx.js';
import { acquireBullet } from './bullet.js';
import { shake, flash, ring, hitStop } from '../render/juice.js';
import { vibrate } from '../core/settings.js';
import { noteTaken } from '../systems/ledger.js';
import { TAG, MAX_AMPLIFICATION } from '../config/tags.js';
import { MAX_SYSTEM_SLOTS, maxLevelOf } from '../config/systems.js';
import { api as loadoutApi } from '../systems/loadout.js';
import { COUPLINGS } from '../config/couplings.js';
import { sfxShoot, sfxCharged, sfxDash, sfxPlayerHit } from '../audio/sfx.js';
import {
  WEAPONS, TRAIT,
  BRANDUNG_RECOIL,
  TAKT_INTERVAL, TAKT_BONUS, TAKT_PIERCE,
  PEILUNG_FULL_MS, PEILUNG_MAX_BONUS, PEILUNG_STILL_THRESHOLD,
} from '../config/weapons.js';

/** Marken je Kopplung — für die Quellenzählung im Bordbuch. */
const COUPLING_TAGS = Object.fromEntries(COUPLINGS.map((c) => [c.id, c.listens]));

const BASE = {
  maxHp: 100,
  speed: 4,
  damage: 20,
  fireRate: 400,
  projectileSpeed: 8,
  pickupRange: 100,
  dashCooldown: 2000,
  dashSpeed: 12,
};

export const MAX_WEAPON_SLOTS = 3;

/** Dauer des Manövers und des daran hängenden Schutzfensters. */
const DASH_MS = 200;
const DASH_IFRAME_MS = 220;
/** Schutzfenster nach einem Treffer — nötig, seit Kontakte den Aufprall überleben. */
const HIT_IFRAME_MS = 620;

// Im Schadensbuch war die Druckwelle mit 45 % die mit Abstand stärkste Quelle
// der ganzen Fahrt. Seltener und schwächer — sie soll ein Höhepunkt sein,
// nicht die Hauptwaffe.
const NOVA_EVERY = 40;

export class Player {
  constructor() {
    this.x = world.width / 2;
    this.y = world.height / 2;
    this.radius = 15;

    this.level = 1;
    this.xp = 0;
    this.xpToNext = xpForLevel(1);

    this.hp = BASE.maxHp;
    this.bonusMaxHp = 0;
    this.damageMult = 1;

    // Additive Stapel. Die Umrechnung in Endwerte passiert in den Gettern —
    // dadurch kann kein Wert negativ oder null werden, egal wie viel stapelt.
    this.stacks = { haste: 0, dash: 0, speed: 0, magnet: 0, hull: 0 };

    this.weapons = [{ ...WEAPONS.taktgeber, lastShot: 0, shotCount: 0 }];

    this.isDashing = false;
    this.dashTimer = 0;
    this.dashVector = { x: 1, y: 0 };
    this.lastDashTime = -Infinity;
    this.dashHitList = new Set();

    /** Marken-Verstärkung: Marke -> additiv gestapelter Anteil. */
    this.amp = Object.create(null);
    /** Eingebaute Systeme: { def, level, … systemeigener Zustand }. */
    this.systems = [];
    /** Erworbene Kopplungen. */
    this.couplings = new Set();

    /** Sturmjäger: hebt die Chance auf seltene Karten. */
    this.luck = 0;
    this.shieldPulse = 0;
    this.tempHaste = 0;
    this.tempHasteUntil = 0;
    this.signalCount = 0;

    this.invulnUntil = 0;
    this.stillMs = 0;
    this.moveFraction = 0;
    this.orbsCollected = 0;
    this.slowFactor = 1;
  }

  // --- Abgeleitete Werte -------------------------------------------------

  get maxHp() {
    return Math.max(1, (BASE.maxHp + this.bonusMaxHp) * state.mods.maxHpMult);
  }

  get fireRate() {
    const temp = clock.now < this.tempHasteUntil ? this.tempHaste : 0;
    return BASE.fireRate / (1 + this.stacks.haste + temp) / state.mods.hasteMult;
  }

  /**
   * Gesamtverstärkung eines Ereignisses.
   *
   * Marken multiplizieren sich untereinander — das ist der Grund, warum sich
   * zwei ausgebaute Zweige gegenseitig tragen. Der Deckel verhindert, dass ein
   * zweigleisiger Build davonläuft.
   */
  amplify(tags) {
    if (!tags || !tags.length) return 1;
    let m = 1;
    for (const t of tags) m *= 1 + (this.amp[t] ?? 0);
    // Wagnisse mit `ampAll` heben jede Marke. Der Ertrag wächst dadurch mit
    // dem Build mit, statt eine feste Zahl zu bleiben.
    return Math.min(MAX_AMPLIFICATION, m * state.mods.ampAll);
  }

  addAmp(tag, value) {
    this.amp[tag] = (this.amp[tag] ?? 0) + value;
  }

  addCoupling(id) {
    this.couplings.add(id);
  }

  systemLevel(id) {
    return this.systems.find((s) => s.def.id === id)?.level ?? 0;
  }

  findSystem(id) {
    return this.systems.find((s) => s.def.id === id) ?? null;
  }

  /**
   * Baut ein System ein oder aus.
   *
   * `grant` kommt aus der Seltenheit der Karte. Vorher hatte die Seltenheit
   * bei Systemkarten überhaupt keine Wirkung — eine „Sturm"-Systemkarte war
   * exakt dasselbe wie eine aus Windstille. Jetzt bringt sie mehrere Stufen
   * auf einmal, und der Sturmjäger zahlt auch auf Systeme ein.
   */
  addSystem(def, grant = 1) {
    const cap = maxLevelOf(def);
    const existing = this.findSystem(def.id);

    if (existing) {
      if (existing.level >= cap) return;
      existing.level = Math.min(cap, existing.level + grant);
      def.onLevel?.(this, existing, loadoutApi);
      return;
    }

    if (this.systems.length >= MAX_SYSTEM_SLOTS) return;

    // Ein frisch eingebautes System läuft nicht auf Stufe 1 an: Bei vier
    // Plätzen à fünf Stufen wären sonst zwanzig Karten nötig, um die Systeme
    // überhaupt auszufahren — mehr, als eine Fahrt hergibt.
    const slot = { def, level: Math.min(cap, 1 + grant) };
    this.systems.push(slot);
    def.onAcquire?.(this, slot, loadoutApi);
    def.onLevel?.(this, slot, loadoutApi);
  }

  /**
   * Wie viele Quellen an Bord diese Marke erzeugen. Steht auf den Karten
   * („wirkt auf 3 deiner Quellen") und macht Synergie ohne Handbuch sichtbar.
   */
  tagSources(tag) {
    let n = 0;
    for (const w of this.weapons) {
      if (w.tags?.includes(tag) || w.affinity?.includes(tag)) n++;
    }
    for (const s of this.systems) {
      if (s.def.tags?.includes(tag)) n++;
    }
    for (const id of this.couplings) {
      const c = COUPLING_TAGS[id];
      if (c && c.includes(tag)) n++;
    }
    // Notmanöver und Schleppnetz sind eigene Quellen, ohne Karte zu sein.
    if (tag === TAG.MANOEVER) n++;
    if (tag === TAG.SIGNAL && this.stacks.magnet > 0) n++;
    return n;
  }

  get dashCooldown() {
    return Math.max(250, (BASE.dashCooldown / (1 + this.stacks.dash)) * state.mods.dashCdMult);
  }

  get speed() {
    const s = this.stacks.speed;
    return BASE.speed * (1 + 1.2 * (s / (1 + s))) * this.slowFactor;
  }

  get pickupRange() {
    const m = this.stacks.magnet;
    return BASE.pickupRange * (1 + 4 * (m / (1 + m)));
  }

  get aimRange() {
    // Ein Funkstörer in der Nähe drückt die Erfassung — deshalb lohnt es sich,
    // ihn zuerst zu nehmen.
    const jam = world.jammed > 0 ? 0.45 : 1;
    return 800 * state.mods.aimRange * jam;
  }

  /**
   * Momentum (Ruderanlage) und Kampfmoral (Rumpfschott) machen aus zwei
   * reinen Komfortwerten offensive Entscheidungen.
   */
  get damage() {
    const momentum = 1 + Math.min(0.3, this.stacks.speed * 0.15) * this.moveFraction;
    const missing = Math.max(0, this.maxHp - this.hp);
    const moral = this.stacks.hull > 0 ? 1 + (missing / 100) * 0.08 : 1;
    return BASE.damage * this.damageMult * state.mods.damageMult * momentum * moral;
  }

  /** 0 … 1 — wie weit der Peilstrahl aufgeladen ist. */
  get peilungCharge() {
    return Math.min(1, this.stillMs / PEILUNG_FULL_MS);
  }

  get invulnerable() {
    return clock.now < this.invulnUntil;
  }

  // --- Kartenwirkungen ---------------------------------------------------

  equipWeapon(weapon) {
    const slot = { ...weapon, lastShot: 0, shotCount: 0 };

    if (this.weapons.length < MAX_WEAPON_SLOTS) {
      this.weapons.push(slot);
      return;
    }

    // Ersetzt wird der schwächste Platz, nicht blind der aktuelle — im
    // Prototyp konnte eine hochseltene Waffenkarte ein Rückschritt sein.
    let worst = 0;
    for (let i = 1; i < this.weapons.length; i++) {
      const a = this.weapons[i].rarity?.id ?? 0;
      const b = this.weapons[worst].rarity?.id ?? 0;
      if (a < b) worst = i;
    }
    this.weapons[worst] = slot;
  }

  addProjectiles(n) {
    this.extraProjectiles = (this.extraProjectiles ?? 0) + n;
    this.damageMult *= 0.92;
  }

  addDamage(v) { this.damageMult *= 1 + v; }
  addHaste(v) { this.stacks.haste += v; }
  addSpeed(v) { this.stacks.speed += v; }
  addMagnet(v) { this.stacks.magnet += v; }
  addDash(v) { this.stacks.dash += v; }
  addLuck(v) { this.luck += v; }

  addHull(v) {
    this.stacks.hull += 1;
    this.bonusMaxHp += v;
    // Ohne Deckelung lief die Rumpfanzeige im Prototyp über 100 %.
    this.hp = Math.min(this.maxHp, this.hp + v * 1.5);
  }

  get projectileCount() {
    return 1 + (this.extraProjectiles ?? 0);
  }

  // --- Ablauf ------------------------------------------------------------

  update(ts, dtMs) {
    const move = getMoveVector();
    const mag = Math.hypot(move.x, move.y);
    this.moveFraction = Math.min(1, mag);

    // Peilstrahl lädt nur auf ruhiger Plattform. Das gibt zum ersten Mal
    // einen Grund, bewusst STEHEN ZU BLEIBEN — die Gegenbewegung zum
    // Dauerlauf, der bisher die dominante Strategie war.
    if (mag < PEILUNG_STILL_THRESHOLD) this.stillMs += dtMs;
    else this.stillMs = 0;

    this.updateDash(move, ts, dtMs);

    const speed = this.isDashing ? BASE.dashSpeed : this.speed;
    const vec = this.isDashing ? this.dashVector : move;

    this.x += vec.x * speed * ts;
    this.y += vec.y * speed * ts;

    this.x = Math.max(this.radius, Math.min(world.width - this.radius, this.x));
    this.y = Math.max(this.radius, Math.min(world.height - this.radius, this.y));

    this.fireWeapons(dtMs);

    // Nebelbänke setzen den Faktor jeden Frame neu; ohne Rücksetzung bliebe
    // der Spieler nach dem Verlassen des Feldes langsam.
    this.slowFactor = 1;
  }

  updateDash(move, ts, dtMs) {
    const now = clock.now;

    if (input.dash && !this.isDashing && now - this.lastDashTime >= this.dashCooldown) {
      this.isDashing = true;
      this.dashTimer = DASH_MS;
      this.lastDashTime = now;
      this.dashHitList.clear();

      // Im Prototyp machte `x: dx || 1` aus einem reinen Aufwärts-Manöver
      // eine Diagonale, und der Vektor war nicht normiert.
      let dx = move.x;
      let dy = move.y;
      if (dx === 0 && dy === 0) dx = 1;
      const len = Math.hypot(dx, dy) || 1;
      this.dashVector = { x: dx / len, y: dy / len };

      this.invulnUntil = Math.max(this.invulnUntil, now + DASH_IFRAME_MS);
      spawnParticles(this.x, this.y, 10, PALETTE.system, 1.4);
      ring(this.x, this.y, this.radius, this.radius + 58, PALETTE.system, 300, 2.5);
      sfxDash();
    }

    if (this.isDashing) {
      this.dashTimer -= dtMs;
      if (this.dashTimer <= 0) this.isDashing = false;
      if (Math.random() < 0.6) spawnParticles(this.x, this.y, 1, PALETTE.system, 0.5);
    }
  }

  /** Erstattet einen Teil des Cooldowns — Belohnung für ein Manöver durch Kontakte. */
  refundDash(ratio = 0.35) {
    this.lastDashTime -= this.dashCooldown * ratio;
  }

  fireWeapons(dtMs) {
    const now = clock.now;

    for (const w of this.weapons) {
      const interval = this.fireRate * w.rate;
      if (now - w.lastShot <= interval) continue;

      const target = findTarget(this.x, this.y, this.aimRange);
      if (!target) continue;

      w.lastShot = now;
      this.shoot(w, target);
    }
  }

  shoot(w, target) {
    const baseAngle = Math.atan2(target.y - this.y, target.x - this.x);
    const count = this.projectileCount + w.count;

    w.shotCount++;

    let damage = this.damage * w.damage;
    let pierce = w.pierce;
    let charged = false;

    if (w.trait === TRAIT.TAKT && w.shotCount % TAKT_INTERVAL === 0) {
      damage *= TAKT_BONUS;
      pierce = Math.max(pierce, TAKT_PIERCE);
      charged = true;
    }

    if (w.trait === TRAIT.PEILUNG) {
      const charge = this.peilungCharge;
      damage *= 1 + charge * (PEILUNG_MAX_BONUS - 1);
      charged = charge > 0.75;
      this.stillMs = 0;
    }

    if (w.trait === TRAIT.BRANDUNG) {
      // Rückstoß: Der Fächer schiebt den Spieler aus der Gefahrenzone heraus,
      // in die er für den Nahbereichsbonus hinein muss.
      this.x -= Math.cos(baseAngle) * BRANDUNG_RECOIL;
      this.y -= Math.sin(baseAngle) * BRANDUNG_RECOIL;
    }

    if (charged) {
      // Ein geladener Schuss darf sich anders anfühlen als der Grundtakt.
      sfxCharged();
      shake(2.5);
      ring(this.x, this.y, 6, 34, PALETTE.salvage, 220, 2);
    } else {
      sfxShoot(w.trait);
    }

    // Streuung wächst mit der Projektilzahl. Im Prototyp war sie konstant:
    // 20 Projektile lagen in einem 5,7°-Kegel und trafen alle denselben
    // Kontakt — Salve war damit ein reiner Schadensmultiplikator und hob die
    // Eigenart des Fächers vollständig auf.
    const spread = w.spread * (1 + Math.log2(1 + count) * 0.55);
    const color = w.tint ?? PALETTE.system;

    for (let i = 0; i < count; i++) {
      let offset = (Math.random() - 0.5) * spread;
      if (count > 1) {
        offset = (i / (count - 1) - 0.5) * spread + (Math.random() - 0.5) * 0.08;
      }

      world.bullets.push(
        acquireBullet({
          x: this.x,
          y: this.y,
          angle: baseAngle + offset,
          damage,
          speed: BASE.projectileSpeed * w.speed,
          life: 100 * w.life,
          pierce,
          color,
          effect: w.effect,
          trait: w.trait,
          charged,
          tags: w.tags ?? [TAG.IMPULS],
          sourceName: w.name,
        }),
      );
    }
  }

  // --- Zustandsänderungen -------------------------------------------------

  gainXp(amount, onLevelUp) {
    this.xp += amount * state.mods.xpGain;

    let levelled = false;
    while (this.xp >= this.xpToNext) {
      this.xp -= this.xpToNext;
      this.level++;
      this.xpToNext = xpForLevel(this.level);
      levelled = true;
    }

    if (levelled) onLevelUp?.();
  }

  collectOrb() {
    this.orbsCollected++;
    if (this.stacks.magnet > 0 && this.orbsCollected % NOVA_EVERY === 0) return true;
    return false;
  }

  takeDamage(amount, source = 'Kontakt') {
    if (this.invulnerable) return false;

    // Wellenbrecher schluckt den Treffer vollständig, bevor irgendetwas
    // anderes greift — sonst wäre die Schadensminderung darauf verschwendet.
    const shield = this.findSystem('wellenbrecher');
    if (shield && shield.def.absorb(this, shield)) {
      this.invulnUntil = clock.now + HIT_IFRAME_MS;
      this.shieldPulse = 1;
      spawnParticles(this.x, this.y, 12, '#9fe8ff', 1.6);
      spawnLabel(this.x, this.y - 22, 'ABGEWEHRT', '#9fe8ff');
      vibrate(14);
      return false;
    }

    const schotten = this.findSystem('schotten');
    if (schotten) amount *= schotten.def.mitigate(this, schotten);

    this.hp -= amount;
    this.invulnUntil = clock.now + HIT_IFRAME_MS;
    noteTaken(source, amount);

    for (const slot of this.systems) slot.def.onPlayerHit?.(this, slot, loadoutApi);

    state.combo = 1;
    state.lastHitAt = state.elapsedTime;

    spawnLabel(this.x, this.y - 20, `−${Math.round(amount)}`, PALETTE.alarm);
    spawnParticles(this.x, this.y, 8, PALETTE.alarm, 1.2);

    // Ein Rumpftreffer ist das wichtigste negative Ereignis im Spiel und
    // muss auch dann ankommen, wenn der Blick woanders klebt.
    const severity = Math.min(1, amount / Math.max(1, this.maxHp * 0.35));
    hitStop(55);
    shake(7 + severity * 9);
    flash(PALETTE.alarm, 0.12 + severity * 0.16, 190);
    sfxPlayerHit();
    vibrate(28);

    if (this.hp > 0) return false;

    // Rettungsinsel: einmal pro Fahrt geht es weiter statt unterzugehen.
    const raft = this.systems.find((sl) => sl.def.id === 'rettungsinsel' && !sl.used);
    if (raft) {
      raft.used = true;
      this.hp = this.maxHp * 0.35;
      this.invulnUntil = clock.now + 3000;
      spawnLabel(this.x, this.y - 34, 'RETTUNGSINSEL', PALETTE.system);
      spawnParticles(this.x, this.y, 26, PALETTE.system, 2.2);
      vibrate([40, 60, 40]);
      return false;
    }

    return true;
  }

  heal(amount) {
    this.hp = Math.min(this.maxHp, this.hp + amount);
  }

  draw(ctx) {
    const flashing = this.invulnerable && Math.floor(clock.now / 60) % 2 === 0;

    // Fassreichweite als dezenter Ring. Wird gedeckelt gezeichnet — im
    // Prototyp konnte der Radius auf mehrere tausend Pixel wachsen.
    ctx.strokeStyle = 'rgba(61, 251, 135, 0.10)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(this.x, this.y, Math.min(this.pickupRange, Math.max(world.width, world.height)), 0, Math.PI * 2);
    ctx.stroke();

    // Ladeanzeige des Peilstrahls direkt am Signal — kein Blick zum HUD nötig.
    if (this.weapons.some((w) => w.trait === TRAIT.PEILUNG) && this.peilungCharge > 0.02) {
      const c = this.peilungCharge;
      ctx.strokeStyle = c >= 1 ? '#ffffff' : PALETTE.salvage;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius + 8, -Math.PI / 2, -Math.PI / 2 + c * Math.PI * 2);
      ctx.stroke();
    }

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.globalAlpha = flashing ? 0.35 : 1;

    drawGlow(ctx, PALETTE.system, this.radius * 1.9, 0, 0, 0.9);

    ctx.fillStyle = PALETTE.system;
    ctx.beginPath();

    if (this.isDashing) {
      ctx.rotate(Math.atan2(this.dashVector.y, this.dashVector.x));
      ctx.moveTo(16, 0);
      ctx.lineTo(-10, 9);
      ctx.lineTo(-6, 0);
      ctx.lineTo(-10, -9);
    } else {
      // Peilzeichen statt Kreis: Raute mit Innenkreuz — auf kleinem Display
      // eindeutig vom runden Kontaktsymbol zu unterscheiden.
      ctx.moveTo(0, -this.radius);
      ctx.lineTo(this.radius * 0.78, 0);
      ctx.lineTo(0, this.radius);
      ctx.lineTo(-this.radius * 0.78, 0);
    }

    ctx.closePath();
    ctx.fill();

    if (!this.isDashing) {
      ctx.strokeStyle = PALETTE.screen;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-5, 0); ctx.lineTo(5, 0);
      ctx.moveTo(0, -5); ctx.lineTo(0, 5);
      ctx.stroke();
    }

    ctx.restore();
    ctx.globalAlpha = 1;
  }
}

/**
 * XP-Bedarf.
 *
 * Der Prototyp multiplizierte mit 1,5 pro Stufe: Stufe 22 verlangte
 * kumuliert rund 1,5 Mio. XP, weshalb ab Stufe ~21 gar keine Karten mehr
 * kamen — genau der Punkt, an dem das Spiel aufhörte, Entscheidungen zu
 * verlangen. Jetzt werden Stufen seltener, hören aber nie auf.
 */
/**
 * Steilheit der Aufstiegskurve. Kleiner = schnellere Stufen, mehr Karten
 * je Fahrt. Der Wert ist die zentrale Stellschraube dafür, wie tief ein Build
 * innerhalb einer Fahrt überhaupt wachsen kann.
 */
export const XP_CURVE = 18;

export function xpForLevel(level) {
  return Math.floor(70 + level * level * XP_CURVE);
}

export function findTarget(x, y, maxRange) {
  let best = null;
  let bestDist = maxRange * maxRange;

  for (const e of world.enemies) {
    if (e.dead) continue;
    const dx = e.x - x;
    const dy = e.y - y;
    const d = dx * dx + dy * dy;
    if (d < bestDist) {
      bestDist = d;
      best = e;
    }
  }
  return best;
}

export { BASE as PLAYER_BASE, DASH_MS };
