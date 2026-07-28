/**
 * Treffer, Statuseffekte, Synergien.
 *
 * Der Schaden selbst wird hier nicht mehr berechnet — das macht
 * `systems/damage.js`. Diese Datei entscheidet nur noch, WAS getroffen wird
 * und WELCHE MARKEN das Ereignis trägt.
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
import { TAG, NAHBEREICH_DISTANCE, FERNBEREICH_DISTANCE } from '../config/tags.js';
import { dealDamage, areaDamage } from './damage.js';
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

/** Grundminen-Detonation. */
export function detonate(origin, damage, sourceEnemy) {
  spawnParticles(origin.x, origin.y, 8, PALETTE.contact, 1.3);
  ring(origin.x, origin.y, 6, GRUNDMINE_RADIUS, PALETTE.contact, 300, 3);
  sfxDetonate();
  shake(2.2);

  areaDamage(
    origin.x, origin.y,
    damage * GRUNDMINE_SHARE, GRUNDMINE_RADIUS,
    [TAG.DRUCKWELLE], PALETTE.contact, sourceEnemy, 'Grundmine',
  );

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
      const chance = BERGUNG_CHANCE * (enemy.frozen ? SYNERGY.BERGUNG_FROZEN_MULT : 1);
      if (Math.random() < chance) {
        player.heal(BERGUNG_HEAL * player.amplify([TAG.BERGUNG]));
        spawnLabel(player.x, player.y - 24, '+RUMPF', EFFECTS.bergung.color);
        // Eigenes Ereignis mit Bergungsmarke — sonst griffe die Kopplung
        // „Prisenkommando" nie.
        dealDamage(enemy, 0, [TAG.BERGUNG], EFFECTS.bergung.color, 'Bergung');
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

      let raw = b.damage;

      // Nah- und Fernbereich ergeben sich aus der tatsächlich zurückgelegten
      // Strecke, nicht aus der Waffe. Deshalb entstehen die Marken erst hier.
      const travelled = b.travelled();
      const tags = [...(b.tags ?? [TAG.IMPULS])];
      if (travelled < NAHBEREICH_DISTANCE) tags.push(TAG.NAHBEREICH);
      else if (travelled > FERNBEREICH_DISTANCE) tags.push(TAG.FERNBEREICH);

      if (b.trait === TRAIT.BRANDUNG && travelled < BRANDUNG_RANGE) raw *= BRANDUNG_BONUS;

      const dealt = dealDamage(e, raw, tags, b.color, b.sourceName ?? 'Signalgeber');
      applyEffect(b, e, player);

      b.hitList.add(e);
      b.pierce--;
      spawnParticles(e.x, e.y, 2, b.color, 0.8);
      sfxHit();

      if (!e.dead && dealt > e.maxHp * 0.4) hitStop(28);

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
  const prallblech = player.findSystem('prallblech');

  for (const b of world.enemyBullets) {
    if (b.dead) continue;
    b.update(ts);
    if (b.dead) continue;

    // Zurückgeworfene Projektile suchen sich ihre ehemaligen Absender.
    if (b.reflected) {
      const near = enemyGrid.query(b.x, b.y, b.radius + 26, neighbours);
      for (const e of near) {
        if (e.dead || b.hitList.has(e)) continue;
        const rr = e.radius + b.radius;
        if ((b.x - e.x) ** 2 + (b.y - e.y) ** 2 > rr * rr) continue;
        b.hitList.add(e);
        dealDamage(e, b.damage, [TAG.IMPULS, TAG.NAHBEREICH], PALETTE.system, 'Prallblech');
        b.dead = true;
        break;
      }
      continue;
    }

    const r = b.radius + player.radius;
    const dx = b.x - player.x;
    const dy = b.y - player.y;
    if (dx * dx + dy * dy > r * r) continue;

    // Prallblech wirft das Projektil zurück, statt es einzustecken.
    if (prallblech && Math.random() < prallblech.def.reflectChance(prallblech)) {
      b.reflect(player.damage * 0.8);
      spawnParticles(player.x, player.y, 6, PALETTE.system, 1.4);
      sfxFreeze();
      continue;
    }

    b.dead = true;
    if (!player.invulnerable) player.takeDamage(b.damage, 'Beschuss');
  }

  compact(world.enemyBullets, (b) => !b.dead);
}

/** Durchfahrt — macht das Manöver zum Positionierungswerkzeug mit Belohnung. */
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
    dealDamage(e, player.damage * 1.5, [TAG.MANOEVER, TAG.NAHBEREICH], PALETTE.system, 'Notmanöver');
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

  // NUR Druckwelle, nicht zusätzlich Signal: Mit beiden Marken wirkten
  // Peilempfänger UND Sprengkopf auf dieselbe Wirkung, und die Druckwelle
  // machte im Schadensbuch 45 % der gesamten Fahrt. Die Signalmarke gehört
  // zur Wirtschaft, nicht zum Schaden.
  areaDamage(player.x, player.y, player.damage * 1.6, radius,
    [TAG.DRUCKWELLE], PALETTE.salvage, null, 'Schleppnetz');

  const hit = enemyGrid.query(player.x, player.y, radius, neighbours);
  for (const e of hit) if (!e.dead) freeze(e, 45);

  spawnZone(player.x, player.y, radius, 26, PALETTE.salvage, null);
  spawnLabel(player.x, player.y - 34, 'DRUCKWELLE', PALETTE.salvage);
  ring(player.x, player.y, 10, radius, PALETTE.salvage, 520, 5);
  flash(PALETTE.salvage, 0.16, 200);
  shake(8);
  hitStop(60);
  sfxNova();
  vibrate(18);
}
