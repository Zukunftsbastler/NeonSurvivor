/**
 * Zentrale Schadensauflösung.
 *
 * ALLER Schaden am Gegner läuft durch `dealDamage`. Das ist der einzige Ort,
 * an dem Markenverstärkung, Panzerung, Merkmale und Kopplungen greifen —
 * dadurch bleibt das Regelwerk an einer Stelle nachvollziehbar, statt sich
 * über Waffen, Systeme und Zonen zu verteilen.
 */

import { world } from '../core/world.js';
import { clock } from '../core/clock.js';
import { enemyGrid } from './spatial.js';
import { COUPLINGS, couplingById } from '../config/couplings.js';
import { TAG } from '../config/tags.js';
import { PALETTE } from '../config/theme.js';
import { spawnParticles } from '../entities/fx.js';
import { noteDealt, noteKill } from './ledger.js';

/** Wirkungen, die eine Kopplung oder ein System auslösen darf. */
let api = null;

export function registerDamageApi(bundle) {
  api = bundle;
}

const couplingCooldowns = Object.create(null);

export function resetCouplingCooldowns() {
  for (const k of Object.keys(couplingCooldowns)) delete couplingCooldowns[k];
}

function couplingReady(def) {
  if (!def.cooldownMs) return true;
  const last = couplingCooldowns[def.id] ?? -Infinity;
  if (clock.now - last < def.cooldownMs) return false;
  couplingCooldowns[def.id] = clock.now;
  return true;
}

function activeCouplings(player) {
  if (!player.couplings.size) return [];
  return COUPLINGS.filter((c) => player.couplings.has(c.id));
}

/**
 * Fügt Schaden zu und wickelt alles daran Hängende ab.
 *
 * @param enemy   Ziel
 * @param raw     Schaden VOR Verstärkung
 * @param tags    Marken des Ereignisses
 * @param tint    Farbe der Schadenszahl
 * @param source  Klartextname für das Schadensbuch
 * @returns tatsächlich zugefügter Schaden
 */
export function dealDamage(enemy, raw, tags, tint = PALETTE.salvage, source = null) {
  const player = world.player;
  if (!player || enemy.dead) return 0;

  let amount = raw * player.amplify(tags);

  // Kopplungen dürfen den Schaden vorher anheben (z. B. Eisbruch).
  const couplings = activeCouplings(player);
  for (const c of couplings) {
    if (!c.boost) continue;
    if (!tags.some((t) => c.listens.includes(t))) continue;
    amount *= c.boost({ enemy, amount, tags, player, api });
  }

  // Merkmale und Gefechtserfahrung mindern danach.
  amount *= enemy.resistance(tags);

  const before = enemy.hp;
  enemy.takeDamage(amount, tint);

  // Nur die tatsächlich abgezogenen Punkte buchen — Überschlag auf einen
  // Kontakt mit 5 Rest-HP zählt als 5, nicht als 200.
  noteDealt(source, Math.min(amount, Math.max(0, before)));
  if (enemy.dead && before > 0) noteKill(source);

  // Nebenwirkungen laufen NACH dem Schaden, damit `enemy.dead` bereits stimmt
  // (die Kopplung „Beizbeute" wertet genau das aus).
  for (const c of couplings) {
    if (!c.after) continue;
    if (!tags.some((t) => c.listens.includes(t))) continue;
    if (!couplingReady(c)) continue;
    c.after({ enemy, amount, tags, player, api });
  }

  return amount;
}

/**
 * Flächenwirkung. Wird von Grundmine, Wasserbombe, Minen und der Kopplung
 * „Kettenschlag" gleichermaßen benutzt.
 */
const neighbours = [];

export function areaDamage(x, y, raw, radius, tags, tint = PALETTE.contact, skip = null, source = null) {
  const hit = enemyGrid.query(x, y, radius, neighbours);
  const r2 = radius * radius;
  let count = 0;

  // Kopie, weil `dealDamage` über Kopplungen neue Kontakte erzeugen kann.
  for (const e of [...hit]) {
    if (e === skip || e.dead) continue;
    const dx = e.x - x;
    const dy = e.y - y;
    if (dx * dx + dy * dy > r2) continue;
    dealDamage(e, raw, tags, tint, source);
    count++;
  }

  return count;
}

export function countNear(x, y, radius) {
  const hit = enemyGrid.query(x, y, radius, neighbours);
  const r2 = radius * radius;
  let n = 0;
  for (const e of hit) {
    if (e.dead) continue;
    const dx = e.x - x;
    const dy = e.y - y;
    if (dx * dx + dy * dy <= r2) n++;
  }
  return n;
}

/** Nächstes Ziel außer `except` — für Überschlag und Bordflieger. */
export function nearestOther(x, y, radius, except = null) {
  const hit = enemyGrid.query(x, y, radius, neighbours);
  let best = null;
  let bestD = radius * radius;
  for (const e of hit) {
    if (e.dead || e === except) continue;
    const dx = e.x - x;
    const dy = e.y - y;
    const d = dx * dx + dy * dy;
    if (d < bestD) {
      bestD = d;
      best = e;
    }
  }
  return best;
}

/** Sichtbarer Überschlag von einem Ziel zum nächsten. */
export function arcTo(from, raw, radius) {
  const target = nearestOther(from.x, from.y, radius, from);
  if (!target) return;

  dealDamage(target, raw, [TAG.IMPULS], '#9fe8ff', 'Überschlag');
  spawnParticles(target.x, target.y, 3, '#9fe8ff', 1.2);

  api?.drawArc?.(from.x, from.y, target.x, target.y);
}

export { couplingById };
