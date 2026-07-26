/**
 * Ausrüstungskarten.
 *
 * Zwei Konstruktionsfehler des Prototyps sind hier behoben:
 *
 * 1. Feuerrate und Notmanöver rechneten `x *= (1 - v * 0.5)` ohne Untergrenze.
 *    Ab "Orkan" wurde der Faktor negativ — negative Feuerrate feuert in jedem
 *    Frame, negativer Cooldown macht den Spieler dauerhaft unverwundbar.
 *    Jetzt stapeln beide ADDITIV und gehen durch `basis / (1 + stapel)`.
 *    Das ist mathematisch nie ≤ 0 und hat von selbst abnehmenden Grenznutzen.
 *
 * 2. Vier von acht Karten waren reine Komfort-Werte ohne Kampfrelevanz. Jede
 *    trägt jetzt eine offensive Nebenwirkung — damit steht der Spieler bei
 *    jedem Level-Up vor einer echten Abwägung statt vor einer Rangliste.
 */

import { rollRarity } from './rarities.js';
import { WEAPONS, EFFECTS } from './weapons.js';

export const UPGRADE_TYPES = [
  {
    id: 'bestueckung',
    name: 'Bestückung',
    baseVal: 0,
    format: (w) => `${w.name} aufschalten`,
    detail: (w) => w.hint,
    apply: (p, w) => p.equipWeapon(w),
  },
  {
    id: 'salve',
    name: 'Salve',
    baseVal: 1,
    format: (v) => `+${v} Projektil${v === 1 ? '' : 'e'}`,
    detail: () => 'Breitere Streuung pro Projektil',
    apply: (p, v) => p.addProjectiles(v),
  },
  {
    id: 'sendeleistung',
    name: 'Sendeleistung',
    baseVal: 0.15,
    format: (v) => `+${Math.round(v * 100)} % Schaden`,
    detail: () => 'Wirkt auf alle Signalgeber',
    apply: (p, v) => p.addDamage(v),
  },
  {
    id: 'taktfrequenz',
    name: 'Taktfrequenz',
    baseVal: 0.1,
    format: (v) => `+${Math.round(v * 100)} % Schlagzahl`,
    detail: () => 'Kürzere Pause zwischen Salven',
    apply: (p, v) => p.addHaste(v),
  },
  {
    id: 'ruderanlage',
    name: 'Ruderanlage',
    baseVal: 0.1,
    format: (v) => `+${Math.round(v * 100)} % Fahrt`,
    detail: () => 'Bei voller Fahrt bis +30 % Schaden',
    apply: (p, v) => p.addSpeed(v),
  },
  {
    id: 'rumpfschott',
    name: 'Rumpfschott',
    baseVal: 20,
    format: (v) => `+${Math.round(v)} Rumpf, repariert`,
    detail: () => 'Je 100 fehlende Rumpfpunkte +8 % Schaden',
    apply: (p, v) => p.addHull(v),
  },
  {
    id: 'schleppnetz',
    name: 'Schleppnetz',
    baseVal: 0.25,
    format: (v) => `+${Math.round(v * 100)} % Fassreichweite`,
    detail: () => 'Jedes 25. Signal löst eine Druckwelle aus',
    apply: (p, v) => p.addMagnet(v),
  },
  {
    id: 'notmanoever',
    name: 'Notmanöver',
    baseVal: 0.15,
    format: (v) => `+${Math.round(v * 100)} % Manöverrate`,
    detail: () => 'Durchfahrt schädigt und vereist Kontakte',
    apply: (p, v) => p.addDash(v),
  },
];

/**
 * Salvenstärke wächst mit der Wurzel der Seltenheit statt linear.
 * Linear hätte "Mahlstrom" +25 Projektile auf einen Schlag gegeben.
 */
function salveValue(mult) {
  return Math.max(1, Math.round(Math.sqrt(mult) * 1.2));
}

/**
 * Baut eine Waffe aus Vorlage, Seltenheit und ggf. Effekt.
 * Anders als im Prototyp wirkt die Seltenheit jetzt tatsächlich auf die
 * Waffenwerte — dort beeinflusste sie nur die Effektchance, weshalb eine
 * hochseltene Waffenkarte oft ein Rückschritt war.
 */
function buildWeapon(rarity) {
  const keys = Object.keys(WEAPONS);
  const template = WEAPONS[keys[Math.floor(Math.random() * keys.length)]];

  const weapon = { ...template };
  weapon.rarity = rarity;
  weapon.damage *= 1 + rarity.id * 0.18;

  const effectChance = rarity.id * 0.15;
  if (Math.random() < effectChance) {
    const effectKeys = Object.keys(EFFECTS);
    const effect = EFFECTS[effectKeys[Math.floor(Math.random() * effectKeys.length)]];
    weapon.effect = effect.id;
    weapon.name = `${weapon.name} (${effect.name})`;
    weapon.hint = `${weapon.hint} · ${effect.hint}`;
    weapon.tint = effect.color;
  }

  return weapon;
}

/**
 * Zieht drei unterschiedliche Kartentypen. `banished` enthält Typ-IDs, die der
 * Spieler dauerhaft aus dem Pool genommen hat.
 */
export function generateUpgradeCards(level, banished = new Set(), count = 3) {
  const pool = UPGRADE_TYPES.filter((t) => !banished.has(t.id));
  const source = pool.length >= count ? pool : UPGRADE_TYPES;

  const shuffled = [...source].sort(() => 0.5 - Math.random()).slice(0, count);

  return shuffled.map((type) => {
    const rarity = rollRarity(level);
    let value;

    if (type.id === 'bestueckung') {
      value = buildWeapon(rarity);
    } else if (type.id === 'salve') {
      value = salveValue(rarity.mult);
    } else {
      value = type.baseVal * rarity.mult;
    }

    return {
      type,
      rarity,
      value,
      desc: type.format(value),
      detail: type.detail(value),
    };
  });
}
