/**
 * Kartenangebot.
 *
 * Fünf Kartenarten:
 *   WAFFE        — Signalgeber auf einen der drei Plätze
 *   WERT         — klassische Kennwerte (Rumpf, Fahrt, Schlagzahl, …)
 *   VERSTAERKER  — hebt eine MARKE, also alles, was diese Marke trägt
 *   SYSTEM       — neues System oder Ausbau eines vorhandenen
 *   KOPPLUNG     — leitet eine Marke in eine andere um
 *
 * Gegen Verdünnung des Pools haben die drei Plätze unterschiedliche Rollen:
 * Vertiefung zieht nur aus dem, was man schon hat, Breite nur aus dem Rest,
 * der dritte Platz ist frei. Damit ist ein Build immer entwickelbar, und
 * trotzdem kommt in jedem Aufstieg etwas Neues ins Bild.
 */

import { rollRarity } from './rarities.js';
import { WEAPONS, EFFECTS } from './weapons.js';
import { TAG, TAG_INFO } from './tags.js';
import { SYSTEM_LIST, maxLevelOf, MAX_SYSTEM_SLOTS } from './systems.js';
import { COUPLINGS } from './couplings.js';

export const CARD_KIND = {
  WAFFE: 'waffe',
  WERT: 'wert',
  VERSTAERKER: 'verstaerker',
  SYSTEM: 'system',
  KOPPLUNG: 'kopplung',
};

/**
 * Beschriftung der Kartenart auf der Karte selbst.
 *
 * Ohne sie sieht man einer Karte nicht an, ob sie einen Signalgeber, einen
 * Begleiter oder eine reine Zahl bringt — und kann damit auch nicht erkennen,
 * ob sie zum eigenen Kurs passt.
 */
export const KIND_LABEL = {
  [CARD_KIND.WAFFE]: 'Signalgeber',
  [CARD_KIND.WERT]: 'Ausrüstung',
  [CARD_KIND.VERSTAERKER]: 'Verstärker',
  [CARD_KIND.SYSTEM]: 'System',
  [CARD_KIND.KOPPLUNG]: 'Kopplung',
};

/** Klassische Kennwerte — alles, was keine Marke ist. */
export const VALUE_CARDS = [
  {
    id: 'salve',
    name: 'Salve',
    baseVal: 1,
    format: (v) => `+${v} Projektil${v === 1 ? '' : 'e'}`,
    detail: () => 'Breitere Streuung pro Projektil',
    apply: (p, v) => p.addProjectiles(v),
    quantize: (mult) => Math.max(1, Math.round(Math.sqrt(mult) * 1.2)),
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
    id: 'sturmjaeger',
    name: 'Sturmjäger',
    baseVal: 0.4,
    format: (v) => `+${Math.round(v * 100)} % Sturmneigung`,
    detail: () => 'Seltenere Karten werden wahrscheinlicher',
    apply: (p, v) => p.addLuck(v),
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

/** Verstärker — je Marke einer. */
export const AMPLIFIER_CARDS = [
  { id: 'sendeleistung',     name: 'Sendeleistung',     tag: TAG.IMPULS },
  { id: 'sprengkopf',        name: 'Sprengkopf',        tag: TAG.DRUCKWELLE },
  { id: 'kuehlanlage',       name: 'Kühlanlage',        tag: TAG.KAELTE },
  { id: 'beizmittel',        name: 'Beizmittel',        tag: TAG.ZERSETZUNG },
  { id: 'geleitordnung',     name: 'Geleitordnung',     tag: TAG.GELEIT },
  { id: 'revierkenntnis',    name: 'Revierkenntnis',    tag: TAG.ZONE },
  { id: 'rudergaenger',      name: 'Rudergänger',       tag: TAG.MANOEVER },
  { id: 'peilempfaenger',    name: 'Peilempfänger',     tag: TAG.SIGNAL },
  { id: 'enterhaken',        name: 'Enterhaken',        tag: TAG.NAHBEREICH },
  { id: 'entfernungsmesser', name: 'Entfernungsmesser', tag: TAG.FERNBEREICH },
  { id: 'bergungsgeschirr',  name: 'Bergungsgeschirr',  tag: TAG.BERGUNG },
];

const AMP_BASE = 0.13;

/**
 * Baut eine Waffe aus Vorlage, Seltenheit und ggf. Effekt.
 * Die Seltenheit wirkt auf die Werte, nicht nur auf die Effektchance — sonst
 * wäre eine hochseltene Waffenkarte oft ein Rückschritt.
 */
function buildWeapon(rarity, player = null) {
  // Bevorzugt Signalgeber, die noch nicht an Bord sind. Im Spieltest bot das
  // Spiel zweimal denselben Taktgeber an, während zwei Plätze frei blieben.
  const owned = new Set(player?.weapons.map((w) => w.id) ?? []);
  const all = Object.keys(WEAPONS);
  const fresh = all.filter((k) => !owned.has(k));
  const keys = fresh.length ? fresh : all;
  const template = WEAPONS[keys[Math.floor(Math.random() * keys.length)]];

  const weapon = { ...template, tags: [...(template.tags ?? [])] };
  weapon.rarity = rarity;
  weapon.damage *= 1 + rarity.id * 0.18;

  if (Math.random() < rarity.id * 0.15) {
    const effectKeys = Object.keys(EFFECTS);
    const effect = EFFECTS[effectKeys[Math.floor(Math.random() * effectKeys.length)]];
    weapon.effect = effect.id;
    weapon.name = `${weapon.name} (${effect.name})`;
    weapon.hint = `${weapon.hint} · ${effect.hint}`;
    weapon.tint = effect.color;
    if (effect.tag && !weapon.tags.includes(effect.tag)) weapon.tags.push(effect.tag);
  }

  return weapon;
}

// --- Angebotsbau ----------------------------------------------------------

function weaponOffer(rarity, player = null) {
  const weapon = buildWeapon(rarity, player);
  return {
    kind: CARD_KIND.WAFFE,
    kindLabel: KIND_LABEL[CARD_KIND.WAFFE],
    id: `waffe_${weapon.id}`,
    // Innerhalb eines Angebots soll höchstens EIN Signalgeber stehen — zwei
    // Karten mit derselben Überschrift „Bestückung" lesen sich wie ein Fehler.
    group: 'waffe',
    name: 'Bestückung',
    desc: `${weapon.name} aufschalten`,
    detail: weapon.hint,
    tags: weapon.tags,
    rarity,
    apply: (p) => p.equipWeapon(weapon),
  };
}

function valueOffer(def, rarity) {
  const value = def.quantize ? def.quantize(rarity.mult) : def.baseVal * rarity.mult;
  return {
    kind: CARD_KIND.WERT,
    kindLabel: KIND_LABEL[CARD_KIND.WERT],
    id: def.id,
    name: def.name,
    desc: def.format(value),
    detail: def.detail(value),
    tags: [],
    rarity,
    apply: (p) => def.apply(p, value),
  };
}

function amplifierOffer(def, rarity, player) {
  const value = AMP_BASE * rarity.mult;
  const sources = player ? player.tagSources(def.tag) : 0;
  return {
    kind: CARD_KIND.VERSTAERKER,
    kindLabel: KIND_LABEL[CARD_KIND.VERSTAERKER],
    id: def.id,
    name: def.name,
    desc: `+${Math.round(value * 100)} % ${TAG_INFO[def.tag].name}`,
    detail:
      sources > 0
        ? `Wirkt auf ${sources} deiner Quellen`
        : 'Noch keine Quelle dafür an Bord',
    tags: [def.tag],
    rarity,
    apply: (p) => p.addAmp(def.tag, value),
  };
}

/** Wie viele Systemstufen eine Karte dieser Seltenheit bringt. */
function systemGrant(rarity) {
  return 1 + Math.floor(rarity.id / 2.5);
}

function systemOffer(def, rarity, player) {
  const level = player ? player.systemLevel(def.id) : 0;
  const isNew = level === 0;
  const grant = systemGrant(rarity);
  const cap = maxLevelOf(def);
  const target = Math.min(cap, isNew ? 1 + grant : level + grant);
  return {
    kind: CARD_KIND.SYSTEM,
    // Überleben oder Angriff mit anzeigen: Das ist die Unterscheidung, die
    // beim Systemplatz tatsächlich zählt.
    kindLabel: `${KIND_LABEL[CARD_KIND.SYSTEM]} · ${def.category === 'ueberleben' ? 'Überleben' : 'Angriff'}`,
    id: `system_${def.id}`,
    name: def.name,
    desc: isNew
      ? `System einbauen${cap > 1 ? ` — Stufe ${target}` : ''}`
      : `Ausbau auf Stufe ${target}`,
    detail: `${def.hint} · ${def.describe(target)}`,
    tags: def.tags,
    rarity,
    apply: (p) => p.addSystem(def, grant),
  };
}

function couplingOffer(def, rarity) {
  return {
    kind: CARD_KIND.KOPPLUNG,
    kindLabel: KIND_LABEL[CARD_KIND.KOPPLUNG],
    id: `kopplung_${def.id}`,
    name: def.name,
    desc: 'Kopplung',
    detail: def.hint,
    tags: def.listens,
    rarity,
    apply: (p) => p.addCoupling(def.id),
  };
}

// --- Auswahl je Platz -----------------------------------------------------

/** Relative Häufigkeit der Kartenarten im Angebot. */
const WEIGHT = {
  waffe: 7,
  systemNeu: 4.5,
  systemAusbau: 5,
  verstaerker: 3.2,
  wert: 3,
  /** Bewusst selten: Kopplungen sollen Funde sein, keine Grundausstattung. */
  kopplung: 1.1,
};

function pickWeighted(entries) {
  if (!entries.length) return null;
  let total = 0;
  for (const e of entries) total += e.weight;
  let roll = Math.random() * total;
  for (const e of entries) {
    roll -= e.weight;
    if (roll <= 0) return e.make();
  }
  return entries[entries.length - 1].make();
}

/** Alles, was den vorhandenen Bestand vertieft. */
function deepeningCandidates(player, rarity) {
  const out = [];

  for (const def of SYSTEM_LIST) {
    const lvl = player.systemLevel(def.id);
    if (lvl > 0 && lvl < maxLevelOf(def)) {
      out.push({ weight: WEIGHT.systemAusbau, make: () => systemOffer(def, rarity, player) });
    }
  }

  for (const def of AMPLIFIER_CARDS) {
    const sources = player.tagSources(def.tag);
    if (sources > 0) {
      // Je mehr Quellen, desto eher wird der passende Verstärker angeboten.
      out.push({
        weight: WEIGHT.verstaerker * (1 + Math.min(3, sources) * 0.4),
        make: () => amplifierOffer(def, rarity, player),
      });
    }
  }

  for (const def of VALUE_CARDS) {
    out.push({ weight: WEIGHT.wert, make: () => valueOffer(def, rarity) });
  }

  return out;
}

/** Alles, was den Bestand verbreitert. */
function breadthCandidates(player, rarity) {
  const out = [];
  const slotsFree = player.systems.length < MAX_SYSTEM_SLOTS;

  for (const def of SYSTEM_LIST) {
    if (player.systemLevel(def.id) > 0 || !slotsFree) continue;
    if ((def.minRarity ?? 0) > rarity.id) continue;
    out.push({ weight: WEIGHT.systemNeu, make: () => systemOffer(def, rarity, player) });
  }

  // Verstärker OHNE Quelle wären tote Karten — sie stehen nur im
  // Vertiefungs-Platz zur Wahl. Der Breite-Platz bietet ausschließlich Dinge
  // an, die neue Quellen SCHAFFEN: Systeme, Kopplungen, Signalgeber.
  for (const def of COUPLINGS) {
    if (!player.couplings.has(def.id)) {
      out.push({ weight: WEIGHT.kopplung, make: () => couplingOffer(def, rarity) });
    }
  }

  if (player.weapons.length < 3) {
    out.push({ weight: WEIGHT.waffe, make: () => weaponOffer(rarity, player) });
  }

  return out;
}

/** Der freie Platz zieht aus allem. */
function freeCandidates(player, rarity) {
  return [
    ...deepeningCandidates(player, rarity),
    ...breadthCandidates(player, rarity),
    { weight: WEIGHT.waffe * 0.6, make: () => weaponOffer(rarity, player) },
  ];
}

/**
 * Erzeugt das Angebot. `banished` enthält Karten-IDs, die der Spieler
 * dauerhaft aus dem Pool genommen hat.
 */
export function generateUpgradeCards(player, banished = new Set(), count = 3) {
  const level = player.level;
  const builders = [deepeningCandidates, breadthCandidates, freeCandidates];
  const cards = [];
  const used = new Set(banished);

  const luck = player.luck ?? 0;

  for (let i = 0; i < count; i++) {
    const rarity = rollRarity(level, luck);
    const make = builders[Math.min(i, builders.length - 1)];

    // Bis zu ein paar Versuchen ziehen, bis etwas noch nicht Belegtes kommt —
    // billiger als alle Kandidaten vorab zu erzeugen.
    let chosen = null;
    for (const source of [make, freeCandidates]) {
      const entries = source(player, rarity);
      if (!entries.length) continue;
      for (let tries = 0; tries < 12 && !chosen; tries++) {
        const candidate = pickWeighted(entries);
        if (!candidate) continue;
        if (used.has(candidate.id)) continue;
        if (candidate.group && used.has(candidate.group)) continue;
        chosen = candidate;
      }
      if (chosen) break;
    }
    if (!chosen) continue;

    used.add(chosen.id);
    if (chosen.group) used.add(chosen.group);
    cards.push(chosen);
  }

  return cards;
}
