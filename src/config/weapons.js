/**
 * Signalgeber (Waffen).
 *
 * Jede Waffe hat GENAU EINE exklusive Mechanik, die keine andere über
 * Feuerrate erreichen kann. Das ist die Antwort auf die Dominanz schnell
 * feuernder Waffen: Der Störsender behält seinen Dauerschaden unverändert,
 * die anderen bekommen eigene Wertachsen dazu.
 *
 * Zur Erinnerung, warum das nötig war: Schaden und Rate wirken multiplikativ,
 * `count` dagegen additiv. Waffen, die ihre Stärke mit `count` bezahlen,
 * werden mit jedem Salven-Upgrade relativ schwächer. Traits sind nicht von
 * dieser Skalierung betroffen.
 */

import { TAG } from './tags.js';

/** Trait-Kennungen. Die Logik dazu liegt in systems/combat.js und entities/. */
export const TRAIT = {
  /** Jeder n-te Schuss durchschlägt und trifft härter. */
  TAKT: 'takt',
  /** Nahbereich verdreifacht den Schaden, dafür Rückstoß auf den Spieler. */
  BRANDUNG: 'brandung',
  /** Lädt auf, während der Spieler stillsteht. Ruhige Plattform = harter Schuss. */
  PEILUNG: 'peilung',
  /** Kein Trait — reiner, verlässlicher Dauerschaden. */
  DAUERSTRICH: 'dauerstrich',
  /** Projektile kehren zum Spieler zurück und treffen auf dem Rückweg erneut. */
  ECHO: 'echo',
};

export const WEAPONS = {
  taktgeber: {
    id: 'taktgeber',
    tags: [TAG.IMPULS], affinity: [],
    name: 'Taktgeber',
    hint: 'Jeder 5. Impuls durchschlägt',
    damage: 1.0, rate: 1.0, speed: 1.0, count: 0, spread: 0.1, life: 1.0, pierce: 1,
    trait: TRAIT.TAKT,
  },
  brandungsfaecher: {
    id: 'brandungsfaecher',
    tags: [TAG.IMPULS], affinity: [TAG.NAHBEREICH],
    name: 'Brandungsfächer',
    hint: 'Dreifach im Nahbereich, mit Rückstoß',
    damage: 0.6, rate: 2.2, speed: 0.8, count: 4, spread: 0.6, life: 0.4, pierce: 1,
    trait: TRAIT.BRANDUNG,
  },
  peilstrahl: {
    id: 'peilstrahl',
    tags: [TAG.IMPULS], affinity: [TAG.FERNBEREICH],
    name: 'Peilstrahl',
    hint: 'Lädt auf, solange du stillstehst',
    damage: 4.0, rate: 3.0, speed: 2.5, count: 0, spread: 0.0, life: 1.5, pierce: 99,
    trait: TRAIT.PEILUNG,
  },
  stoersender: {
    id: 'stoersender',
    tags: [TAG.IMPULS], affinity: [],
    name: 'Störsender',
    hint: 'Hohe, gleichmäßige Schlagzahl',
    damage: 0.4, rate: 0.2, speed: 1.3, count: 0, spread: 0.4, life: 0.7, pierce: 1,
    trait: TRAIT.DAUERSTRICH,
  },
  echolot: {
    id: 'echolot',
    tags: [TAG.IMPULS], affinity: [],
    name: 'Echolot',
    hint: 'Projektile kehren zurück',
    damage: 0.8, rate: 1.5, speed: 0.6, count: 2, spread: 0.2, life: 2.0, pierce: 3,
    trait: TRAIT.ECHO,
  },
};

/** Nahbereichsgrenze des Brandungsfächers in Pixeln. */
export const BRANDUNG_RANGE = 150;
export const BRANDUNG_BONUS = 3.0;
/** Rückstoß auf den Spieler pro Salve. */
export const BRANDUNG_RECOIL = 3.2;

/** Jeder n-te Schuss des Taktgebers ist geladen. */
export const TAKT_INTERVAL = 5;
export const TAKT_BONUS = 3.0;
export const TAKT_PIERCE = 5;

/** Peilstrahl: Millisekunden Stillstand bis zur vollen Ladung. */
export const PEILUNG_FULL_MS = 1800;
export const PEILUNG_MAX_BONUS = 4.0;
/** Ab welcher Bewegungsstärke die Ladung wieder abfällt. */
export const PEILUNG_STILL_THRESHOLD = 0.12;

/** Echolot: Anteil der Lebensdauer, nach dem das Projektil umkehrt. */
export const ECHO_TURN_AT = 0.45;

/**
 * Statuseffekte. Der Prototyp hatte hier die kanonischen vier Elemente jedes
 * Loot-Spiels; die Begriffe kommen jetzt aus der Seefahrt.
 */
export const EFFECTS = {
  vereisung: { id: 'vereisung', name: 'Vereisung', color: '#9fe8ff', hint: 'verlangsamt', tag: TAG.KAELTE },
  korrosion: { id: 'korrosion', name: 'Korrosion', color: '#b6ff5c', hint: 'Schaden über Zeit', tag: TAG.ZERSETZUNG },
  grundmine: { id: 'grundmine', name: 'Grundmine', color: '#ffb000', hint: 'Flächenschaden', tag: TAG.DRUCKWELLE },
  bergung:   { id: 'bergung',   name: 'Bergung',   color: '#ff6b6b', hint: 'Lebensraub', tag: TAG.BERGUNG },
};

/** Wirkdauer in normierten Frames (60 = 1 s bei 60 fps). */
export const VEREISUNG_FRAMES = 120;
export const VEREISUNG_SLOW = 0.4;
export const KORROSION_FRAMES = 180;
export const KORROSION_TICK_FRAMES = 20;
/** Anteil des Projektilschadens pro Korrosions-Tick. */
export const KORROSION_TICK_SHARE = 0.35;
export const GRUNDMINE_RADIUS = 60;
export const GRUNDMINE_SHARE = 0.5;
export const BERGUNG_CHANCE = 0.05;
export const BERGUNG_HEAL = 2;

/**
 * Synergien. Sie kosten kaum Code, geben dem Spieler aber zum ersten Mal
 * einen Grund, gezielt auf eine Kombination hinzuarbeiten.
 */
export const SYNERGY = {
  /** Vereisung + Grundmine: gefrorene Kontakte zersplittern. */
  SPLITTER_MULT: 2.0,
  /** Korrosion + Grundmine: Explosion hinterlässt eine Korrosionswolke. */
  WOLKE_FRAMES: 120,
  /** Bergung + Vereisung: Lebensraub an gefrorenen Zielen. */
  BERGUNG_FROZEN_MULT: 3.0,
};
