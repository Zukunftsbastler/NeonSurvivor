/**
 * Systemverwaltung.
 *
 * Führt die Hooks der eingebauten Systeme aus und stellt das `api`-Bündel
 * bereit, über das Systeme UND Kopplungen ihre Wirkungen auslösen. Alles läuft
 * über dieselben Aufrufe — deshalb hebt ein „+Druckwelle"-Verstärker
 * gleichermaßen die Wasserbombe, die Seemine und die Kopplung Kettenschlag.
 */

import { world, compact } from '../core/world.js';
import { clock } from '../core/clock.js';
import { PALETTE } from '../config/theme.js';
import { TAG } from '../config/tags.js';
import { spawnZone } from '../entities/orb.js';
import { Orb } from '../entities/orb.js';
import { Escort, Drone, Mine, Beacon } from '../entities/allies.js';
import { spawnParticles, spawnLabel } from '../entities/fx.js';
import { dealDamage, areaDamage, countNear, arcTo, registerDamageApi } from './damage.js';
import { enemyGrid } from './spatial.js';
import { ring, flash, shake } from '../render/juice.js';
import { sfxDetonate, sfxNova, sfxFreeze } from '../audio/sfx.js';
import { vibrate } from '../core/settings.js';

const neighbours = [];

/**
 * Verstärkung, wenn die Druckwelle auf eine Ölspur trifft.
 *
 * Systemkette: Ölspur legt brennbaren Grund, Wasserbombe entzündet ihn. Die
 * Ölspur allein zersetzt langsam, die Bombe allein trifft einmal — zusammen
 * ergibt sich ein Feuerball, den keines der beiden Systeme hergibt.
 */
function oilBonus(x, y, radius) {
  for (const z of world.zones) {
    if (z.dead || !z.flammable) continue;
    const d = Math.hypot(z.x - x, z.y - y);
    if (d < radius + z.radius) return 1.9;
  }
  return 1;
}

/**
 * Zündet eigene Seeminen im Umkreis.
 *
 * Systemkette: Wasserbombe und Sturmflut lösen den ganzen gelegten Teppich
 * auf einmal aus. Zwei Systeme, die einzeln solide sind und zusammen etwas
 * ergeben, das keines von beiden kann.
 */
function detonateMinesIn(x, y, radius) {
  const r2 = radius * radius;
  for (const m of world.mines) {
    if (m.dead || m.armIn > 0) continue;
    if ((m.x - x) ** 2 + (m.y - y) ** 2 > r2) continue;
    m.detonate();
  }
}

/** Fegt Gegnerprojektile aus einem Umkreis. */
function clearEnemyShots(x, y, radius) {
  const r2 = radius * radius;
  for (const b of world.enemyBullets) {
    if (b.dead || b.reflected) continue;
    if ((b.x - x) ** 2 + (b.y - y) ** 2 > r2) continue;
    b.dead = true;
    spawnParticles(b.x, b.y, 2, PALETTE.system, 0.8);
  }
}

/** Kurzlebige Sichtlinien für Überschlag und Suchscheinwerfer. */
const arcs = [];
let searchlightState = null;

export function resetLoadout() {
  arcs.length = 0;
  searchlightState = null;
}

// --- Wirkungsbündel -------------------------------------------------------

export const api = {
  amplify(tags) {
    return world.player ? world.player.amplify(tags) : 1;
  },

  blast(x, y, raw, radius, silent = false, source = 'Kopplung') {
    areaDamage(x, y, raw, radius, [TAG.DRUCKWELLE], PALETTE.contact, null, source);
    ring(x, y, 6, radius, PALETTE.contact, 280, 2.5);
    if (!silent) sfxDetonate();
  },

  corrosionCloud(x, y, damage) {
    spawnZone(x, y, 74, 110, '#b6ff5c', (zone) => {
      areaDamage(zone.x, zone.y, damage * 0.25, zone.radius,
        [TAG.ZERSETZUNG, TAG.ZONE], '#b6ff5c', null, 'Schmauchspur');
    });
  },

  freeze(enemy, frames) {
    enemy.freezeTimer = Math.max(enemy.freezeTimer, frames);
  },

  countNear,

  arc(enemy, raw, radius) {
    arcTo(enemy, raw, radius);
  },

  drawArc(x1, y1, x2, y2) {
    arcs.push({ x1, y1, x2, y2, until: clock.now + 110 });
    if (arcs.length > 24) arcs.shift();
  },

  /** Vorübergehend schnellere Schlagzahl (Kopplung Steuerbordfeuer). */
  hasten(amount, durationMs) {
    const p = world.player;
    if (!p) return;
    p.tempHasteUntil = clock.now + durationMs;
    p.tempHaste = Math.max(p.tempHaste ?? 0, amount);
  },

  bonusOrb(x, y, value) {
    world.orbs.push(new Orb(x, y, value));
  },

  mendEscorts() {
    for (const e of world.escorts) e.intact = true;
  },

  freeVolley() {
    const p = world.player;
    if (!p) return;
    p.signalCount = (p.signalCount ?? 0) + 1;
    if (p.signalCount % 10 !== 0) return;
    for (const w of p.weapons) w.lastShot = -Infinity;
    spawnLabel(p.x, p.y - 30, 'GRATISSALVE', PALETTE.salvage);
  },

  // --- von Systemen benutzt ---------------------------------------------

  syncEscorts(level) {
    world.escorts.length = 0;
    for (let i = 0; i < level; i++) world.escorts.push(new Escort(i, level));
  },

  depthCharge(x, y, raw, radius, clearsShots = false) {
    const oil = oilBonus(x, y, radius);
    const hits = areaDamage(x, y, raw * oil, radius, [TAG.DRUCKWELLE, TAG.ZONE],
      PALETTE.contact, null, oil > 1 ? 'Wasserbombe (Ölbrand)' : 'Wasserbombe');
    if (oil > 1) {
      flash('#ffb000', 0.2, 260);
      spawnParticles(x, y, 18, '#ffb000', 2.2);
      spawnLabel(x, y - 34, 'ÖLBRAND', '#ffb000');
    }

    // Systemkette: Die Druckwelle zündet alle scharfen Seeminen im Umkreis.
    // Wer Minenleger UND Wasserbombe fährt, bekommt daraus eine Kettenreaktion,
    // die keines der beiden Systeme allein hergibt.
    detonateMinesIn(x, y, radius);
    ring(x, y, 12, radius, PALETTE.contact, 480, 4);
    flash(PALETTE.contact, 0.12, 180);
    shake(hits > 0 ? 6 : 3);

    // Ab Stufe 3 fegt die Druckwelle auch Gegnerprojektile weg. Genau die
    // waren im Spieltest das eigentliche Navigationsproblem.
    if (clearsShots) clearEnemyShots(x, y, radius);

    sfxNova();
    vibrate(16);
  },

  /**
   * Sturmflut — der Notausgang.
   *
   * Räumt den ganzen Schirm samt Projektilen. Im Spieltest fehlte genau das:
   * Ab einem gewissen Gedränge war die Lage nicht mehr aufzulösen, weil es
   * kein Werkzeug gab, das den Schirm wieder lesbar macht.
   */
  stormSurge(raw) {
    const p = world.player;
    if (!p) return;

    const reach = Math.hypot(world.width, world.height);
    areaDamage(p.x, p.y, raw, reach, [TAG.DRUCKWELLE, TAG.ZONE],
      PALETTE.system, null, 'Sturmflut');
    clearEnemyShots(p.x, p.y, reach);
    detonateMinesIn(p.x, p.y, reach);

    for (const e of world.enemies) {
      if (!e.dead) e.freezeTimer = Math.max(e.freezeTimer, 90);
    }

    ring(p.x, p.y, 20, reach, PALETTE.system, 900, 6);
    ring(p.x, p.y, 20, reach * 0.6, PALETTE.salvage, 700, 4);
    flash(PALETTE.system, 0.34, 420);
    shake(16);
    spawnLabel(p.x, p.y - 40, 'STURMFLUT', PALETTE.system);
    spawnParticles(p.x, p.y, 28, PALETTE.system, 2.4);
    sfxNova();
    vibrate([30, 40, 60]);
  },

  /** Grundschleppnetz: zieht sämtliche Signale heran. */
  trawl() {
    const p = world.player;
    if (!p || !world.orbs.length) return;

    for (const o of world.orbs) {
      if (o.dead) continue;
      o.magnetized = true;
      // Anstoß zum Spieler hin, damit die Bahn sichtbar bleibt statt zu springen.
      const dx = p.x - o.x;
      const dy = p.y - o.y;
      const d = Math.hypot(dx, dy) || 1;
      o.vx = (dx / d) * 14;
      o.vy = (dy / d) * 14;
    }

    ring(p.x, p.y, 30, Math.hypot(world.width, world.height) * 0.7, PALETTE.salvage, 700, 3);
    spawnLabel(p.x, p.y - 30, 'GRUNDSCHLEPPNETZ', PALETTE.salvage);
    sfxNova();
  },

  dropMine(x, y, damage) {
    if (world.mines.length >= 26) world.mines.shift();
    world.mines.push(new Mine(x, y, damage));
  },

  oilPatch(x, y, radius, damage) {
    if (world.zones.length >= 40) return;
    const zone = spawnZone(x, y, radius, 90, '#b6ff5c', (z) => {
      areaDamage(z.x, z.y, damage * 0.2, z.radius,
        [TAG.ZERSETZUNG, TAG.ZONE], '#b6ff5c', null, 'Ölspur');
    });
    if (zone) zone.flammable = true;
  },

  dragField(radius) {
    const p = world.player;
    if (!p) return;
    const hit = enemyGrid.query(p.x, p.y, radius, neighbours);
    const r2 = radius * radius;
    for (const e of hit) {
      if (e.dead) continue;
      const dx = e.x - p.x;
      const dy = e.y - p.y;
      if (dx * dx + dy * dy > r2) continue;
      e.dragged = 2;
    }
  },

  searchlight(angle, spread, range, damagePerTick) {
    const p = world.player;
    if (!p) return;
    searchlightState = { angle, spread, range };

    const hit = enemyGrid.query(p.x, p.y, range, neighbours);
    for (const e of hit) {
      if (e.dead) continue;
      const dx = e.x - p.x;
      const dy = e.y - p.y;
      if (dx * dx + dy * dy > range * range) continue;

      let diff = Math.abs(((Math.atan2(dy, dx) - angle + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
      if (diff > spread) continue;

      e.revealed = 12;
      dealDamage(e, damagePerTick, [TAG.FERNBEREICH], PALETTE.system, 'Suchscheinwerfer');
    }
  },

  launchDrone(damage) {
    const p = world.player;
    if (!p || world.drones.length >= 14) return;
    world.drones.push(new Drone(p.x, p.y, damage));
  },

  dropBeacon(x, y, lifeMs) {
    world.beacons.length = 0;
    const beacon = new Beacon(x, y, lifeMs);
    world.beacons.push(beacon);
    world.decoy = beacon;
  },

  smokeScreen(durationMs) {
    world.smokeUntil = clock.now + durationMs;
    spawnParticles(world.player.x, world.player.y, 14, PALETTE.chrome, 1.6);
    sfxFreeze();
  },
};

registerDamageApi(api);

// --- Ablauf ---------------------------------------------------------------

export function updateLoadout(player, dtMs, ts) {
  for (const slot of player.systems) {
    slot.def.update?.(player, slot, dtMs, api);
  }

  const level = player.systemLevel('geleitboot');
  for (const e of world.escorts) e.update(dtMs, level);

  for (const d of world.drones) if (!d.dead) d.update(dtMs, ts);
  compact(world.drones, (d) => !d.dead);

  for (const m of world.mines) if (!m.dead) m.update(dtMs);
  compact(world.mines, (m) => !m.dead);

  for (const b of world.beacons) if (!b.dead) b.update(dtMs);
  compact(world.beacons, (b) => !b.dead);
  if (world.decoy?.dead) world.decoy = null;

  for (let i = arcs.length - 1; i >= 0; i--) {
    if (arcs[i].until <= clock.now) arcs.splice(i, 1);
  }
}

export function drawLoadout(ctx) {
  const p = world.player;

  if (searchlightState && p) {
    const { angle, spread, range } = searchlightState;
    ctx.save();
    ctx.globalAlpha = 0.09;
    ctx.fillStyle = PALETTE.system;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.arc(p.x, p.y, range, angle - spread, angle + spread);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  for (const b of world.beacons) b.draw(ctx);
  for (const m of world.mines) m.draw(ctx);
  for (const d of world.drones) d.draw(ctx);
  for (const e of world.escorts) e.draw(ctx);

  if (arcs.length) {
    ctx.strokeStyle = '#9fe8ff';
    ctx.lineWidth = 1.6;
    ctx.globalAlpha = 0.6;
    ctx.beginPath();
    for (const a of arcs) {
      ctx.moveTo(a.x1, a.y1);
      ctx.lineTo(a.x2, a.y2);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
}
