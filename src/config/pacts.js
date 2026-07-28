/**
 * Wagnisse.
 *
 * Antwort auf das Kernproblem: Ab einem gewissen Punkt war keine Interaktion
 * mehr nötig. Phasen der Übermacht sollen möglich bleiben — deshalb wird die
 * Schwierigkeit nicht heimlich nachgezogen, sondern dem Spieler zum
 * FREIWILLIGEN Kauf angeboten.
 *
 * Nach dem Spieltest grundlegend überarbeitet. Zwei Fehler steckten drin:
 *
 * 1. `damageMult` war der übliche Ertrag — seit dem Marken-Umbau aber fast
 *    wertlos, weil der Spielerschaden nur noch ein kleiner Grundwert ist und
 *    alles Wachstum über Marken-Verstärker läuft. „Rumpf halbiert für +50 %
 *    Sendeleistung" war deshalb ein schlechtes Geschäft.
 * 2. `scoreMult` half beim Überleben überhaupt nicht. „Sturmfahrt" war im
 *    laufenden Spiel reiner Nachteil.
 *
 * Der neue Leitgedanke: Der Ertrag muss MITWACHSEN. `ampAll` hebt jede
 * Markenverstärkung — je tiefer der Build, desto mehr bringt das Wagnis.
 * Die Kosten greifen dabei nicht mehr an die Werkzeuge, die das Überleben
 * überhaupt erst ermöglichen (Manöver, Zielerfassung), sondern an die Dichte
 * und das Tempo der Horde.
 *
 * Die Höhe der Kosten ist gemessen: Mit milderen Werten sanken die Tode je
 * Fahrt von 85 auf 59 — ein Wagnis, das einen SICHERER macht, ist keines.
 * Jetzt kommt man deutlich weiter und lebt dabei gefährlicher.
 */

export const PACTS = [
  {
    id: 'volle_fahrt',
    name: 'Volle Fahrt',
    cost: 'Kontakte laufen 70 % dichter auf',
    gain: '+35 % Signalausbeute, +30 % Erfahrung',
    effects: { spawnRate: 1.7, orbValue: 1.35, xpGain: 1.3 },
  },
  {
    id: 'ballast',
    name: 'Ballast über Bord',
    cost: 'Rumpf sinkt auf die Hälfte',
    gain: 'Alle Marken +30 %',
    effects: { maxHpMult: 0.5, ampAll: 1.3 },
  },
  {
    id: 'funkstille',
    name: 'Funkstille',
    cost: 'Zielerfassung 25 % kürzer',
    gain: 'Signale zählen doppelt, +20 % auf alle Marken',
    effects: { aimRange: 0.75, orbValue: 2.0, ampAll: 1.2 },
  },
  {
    id: 'sturmfahrt',
    name: 'Sturmfahrt',
    cost: 'Kontakte laufen 45 % schneller',
    gain: 'Punktefaktor ×2, +30 % Erfahrung',
    effects: { enemySpeed: 1.45, scoreMult: 2.0, xpGain: 1.3 },
  },
  {
    id: 'untiefe',
    name: 'Untiefe',
    cost: 'Manöver braucht 60 % länger',
    gain: '+55 % Schlagzahl',
    effects: { dashCdMult: 1.6, hasteMult: 1.55 },
  },
  {
    id: 'kaperfahrt',
    name: 'Kaperfahrt',
    cost: 'Kontakte lassen halb so viele Signale fallen',
    gain: 'Alle Marken +35 %',
    effects: { orbValue: 0.5, ampAll: 1.35 },
  },
  {
    id: 'tiefgang',
    name: 'Tiefgang',
    cost: 'Kontakte 35 % schneller UND 45 % dichter',
    gain: 'Alle Marken +50 %',
    effects: { enemySpeed: 1.35, spawnRate: 1.45, ampAll: 1.5 },
  },
];

/** Frühestens nach dieser Fahrtzeit wird das erste Wagnis angeboten. */
export const FIRST_OFFER_S = 75;
/** Mindestabstand zwischen zwei Angeboten. */
export const OFFER_INTERVAL_S = 90;
/**
 * Zusätzlicher Auslöser: Wenn der Spieler offensichtlich unterfordert ist —
 * fast voller Rumpf und lange kein Treffer — wird früher gefragt.
 */
export const BORED_HP_RATIO = 0.9;
export const BORED_UNHURT_S = 30;

/** Wie viele Wagnisse eine Fahrt höchstens tragen kann. */
export const MAX_PACTS = 5;

/** Neutrale Ausgangswerte; `applyPacts` multipliziert die aktiven darauf. */
export function baseModifiers() {
  return {
    spawnRate: 1, xpGain: 1, maxHpMult: 1, damageMult: 1,
    aimRange: 1, orbValue: 1, enemySpeed: 1, scoreMult: 1,
    dashCdMult: 1, hasteMult: 1,
    /** Hebt JEDE Markenverstärkung — wächst also mit dem Build mit. */
    ampAll: 1,
  };
}

export function applyPacts(activeIds) {
  const mods = baseModifiers();
  for (const id of activeIds) {
    const pact = PACTS.find((p) => p.id === id);
    if (!pact) continue;
    for (const [key, val] of Object.entries(pact.effects)) {
      mods[key] *= val;
    }
  }
  return mods;
}
