/**
 * Treffer, Statuseffekte und Synergien.
 *
 * Alle Nachbarschaftsabfragen laufen über das Raster aus `spatial.js` statt
 * über vollständige Durchläufe — der Grundminen-Flächenschaden war im
 * Prototyp die teuerste Stelle im ganzen Frame.
 */

import { world, compact } from '../core/world.js';
import { enemyGrid } from './spatial.js';
import { spawnParticles, spawnLabel } from '../entities/fx.js';
import { spawnZone } from '../entities/orb.js';
import { releaseBullet } from '../entities/bullet.js';
import { hitStop, shake, ring, flash } from '../render/juice.js';
import { vibrate } from '../core/settings.js';
import { sfxHit, sfxDetonate, sfxNova, sfxFreeze } from '../audio/sfx.js';
import { PALETTE } from '../config/theme.js';
import {
  TRAIT, EFFECTS,
  BRANDUNG_RANGE, BRANDUNG_BONUS,
  VEREISUNG_FRAMES, KORROSION_FRAMES,
  GRUNDMINE_RADIUS, GRUNDMINE_SHARE,
  BERGUNG_CHANCE, BERGUNG_HEAL,
  SYNERGY,
} from '../config/weapons.js';

const neighbours = [];

export function freeze(enemy, frames = VEREISUNG_FRAMES) {
  enemy.freezeTimer = Math.max(enemy.freezeTimer, frames);
}

export function corrode(enemy, damage, frames = KORROSION_FRAMES) {
  enemy.corrosionTimer = Math.max(enemy.corrosionTimer, frames);
  enemy.corrosionDamage = Math.max(enemy.corrosionDamage, damage);
}

/**
 * Grundminen-Detonation.
 *
 * Synergien greifen hier über den ZUSTAND des Ziels, nicht über die Waffe.
 * Dadurch entsteht der Anreiz, zwei Signalgeber zu kombinieren — was die
 * Waffenplätze überhaupt erst interessant macht.
 */
export function detonate(origin, damage, sourceEnemy) {
  spawnParticles(origin.x, origin.y, 8, PALETTE.contact, 1.3);
  ring(origin.x, origin.y, 6, GRUNDMINE_RADIUS, PALETTE.contact, 300, 3);
  sfxDetonate();
  shake(2.2);

  const hit = enemyGrid.query(origin.x, origin.y, GRUNDMINE_RADIUS, neighbours);
  const r2 = GRUNDMINE_RADIUS * GRUNDMINE_RADIUS;

  for (const other of hit) {
    if (other === sourceEnemy || other.dead) continue;

    const dx = other.x - origin.x;
    const dy = other.y - origin.y;
    if (dx * dx + dy * dy > r2) continue;

    // Vereisung + Grundmine: gefrorene Kontakte zersplittern.
    const mult = other.frozen ? SYNERGY.SPLITTER_MULT : 1;
    other.takeDamage(damage * GRUNDMINE_SHARE * mult, PALETTE.contact);
  }

  // Korrosion + Grundmine: die Detonation reißt eine Korrosionswolke auf.
  if (sourceEnemy?.corrosionTimer > 0) {
    const cloudDamage = sourceEnemy.corrosionDamage;
    spawnZone(origin.x, origin.y, GRUNDMINE_RADIUS * 1.2, SYNERGY.WOLKE_FRAMES, EFFECTS.korrosion.color, (zone) => {
      const inside = enemyGrid.query(zone.x, zone.y, zone.radius, neighbours);
      for (const e of inside) {
        if (e.dead) continue;
        if (Math.hypot(e.x - zone.x, e.y - zone.y) <= zone.radius) corrode(e, cloudDamage);
      }
    });
  }
}

function applyEffect(bullet, enemy, player) {
  switch (bullet.effect) {
    case 'vereisung':
      freeze(enemy);
      sfxFreeze();
      break;

    case 'korrosion':
      corrode(enemy, bullet.damage);
      break;

    case 'grundmine':
      detonate(enemy, bullet.damage, enemy);
      break;

    case 'bergung': {
      // Bergung + Vereisung: an gefrorenen Zielen dreifache Ausbeute.
      const chance = BERGUNG_CHANCE * (enemy.frozen ? SYNERGY.BERGUNG_FROZEN_MULT : 1);
      if (Math.random() < chance) {
        player.heal(BERGUNG_HEAL);
        spawnLabel(player.x, player.y - 24, '+RUMPF', EFFECTS.bergung.color);
      }
      break;
    }

    default:
      break;
  }
}

export function updateBullets(ts, player) {
  for (const b of world.bullets) {
    if (b.dead) continue;
    b.update(ts);
    if (b.dead) continue;

    const hit = enemyGrid.query(b.x, b.y, b.radius + 26, neighbours);

    for (const e of hit) {
      if (e.dead || b.hitList.has(e)) continue;

      const r = e.radius + b.radius;
      const dx = b.x - e.x;
      const dy = b.y - e.y;
      if (dx * dx + dy * dy > r * r) continue;

      let damage = b.damage;

      // Brandungsfächer: der Nahbereichsbonus ist die Wertachse, die eine
      // schnellere Waffe nicht über Feuerrate kaufen kann.
      if (b.trait === TRAIT.BRANDUNG && b.travelled() < BRANDUNG_RANGE) {
        damage *= BRANDUNG_BONUS;
      }

      e.takeDamage(damage, b.color);
      applyEffect(b, e, player);

      b.hitList.add(e);
      b.pierce--;
      spawnParticles(e.x, e.y, 2, b.color, 0.8);
      sfxHit();

      // Hit-Stop nur bei Treffern, die wirklich etwas bewegen — sonst
      // stotterte das Spiel bei jeder Salve.
      if (!e.dead && damage > e.maxHp * 0.4) hitStop(28);

      if (b.pierce <= 0) {
        b.dead = true;
        break;
      }
    }
  }

  for (const b of world.bullets) if (b.dead) releaseBullet(b);
  compact(world.bullets, (b) => !b.dead);
}

export function updateEnemyBullets(ts, player) {
  for (const b of world.enemyBullets) {
    if (b.dead) continue;
    b.update(ts);
    if (b.dead) continue;

    const r = b.radius + player.radius;
    const dx = b.x - player.x;
    const dy = b.y - player.y;

    if (dx * dx + dy * dy <= r * r) {
      b.dead = true;
      if (!player.invulnerable) player.takeDamage(b.damage);
    }
  }

  compact(world.enemyBullets, (b) => !b.dead);
}

/**
 * Durchfahrt.
 *
 * Macht aus dem Manöver ein Positionierungswerkzeug mit Belohnung statt eines
 * reinen Unverwundbarkeitsknopfs — im Prototyp war das Halten der Taste bei
 * kurzem Cooldown die vollständige Lösung des Spiels.
 */
export function resolveDash(player) {
  if (!player.isDashing) return;

  const reach = player.radius + 12;
  const hit = enemyGrid.query(player.x, player.y, reach + 24, neighbours);

  for (const e of hit) {
    if (e.dead || player.dashHitList.has(e)) continue;

    const r = e.radius + reach;
    const dx = e.x - player.x;
    const dy = e.y - player.y;
    if (dx * dx + dy * dy > r * r) continue;

    player.dashHitList.add(e);
    e.takeDamage(player.damage * 1.5, PALETTE.system);
    freeze(e, 60);
    spawnParticles(e.x, e.y, 4, PALETTE.system, 1);

    if (e.dead) player.refundDash();
  }
}

export function updateZones(ts) {
  for (const z of world.zones) if (!z.dead) z.update(ts);
  compact(world.zones, (z) => !z.dead);
}

/** Druckwelle des Schleppnetzes — jedes 25. aufgefasste Signal. */
export function schleppnetzNova(player) {
  const radius = 190;
  spawnParticles(player.x, player.y, 16, PALETTE.salvage, 2);

  const hit = enemyGrid.query(player.x, player.y, radius, neighbours);
  for (const e of hit) {
    if (e.dead) continue;
    if (Math.hypot(e.x - player.x, e.y - player.y) > radius) continue;
    e.takeDamage(player.damage * 2.2, PALETTE.salvage);
    freeze(e, 45);
  }

  spawnZone(player.x, player.y, radius, 26, PALETTE.salvage, null);
  spawnLabel(player.x, player.y - 34, 'DRUCKWELLE', PALETTE.salvage);
  ring(player.x, player.y, 10, radius, PALETTE.salvage, 520, 5);
  flash(PALETTE.salvage, 0.16, 200);
  shake(8);
  hitStop(60);
  sfxNova();
  vibrate(18);
}
