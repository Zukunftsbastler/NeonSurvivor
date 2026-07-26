/**
 * Wagnisse.
 *
 * Antwort auf das Kernproblem: Ab einem gewissen Punkt war keine Interaktion
 * mehr nötig. Phasen der Übermacht sollen möglich bleiben — deshalb wird die
 * Schwierigkeit nicht heimlich nachgezogen, sondern dem Spieler zum FREIWILLIGEN
 * Kauf angeboten. Wer zu stark geworden ist, bekommt einen Grund, sich wieder
 * in Gefahr zu bringen, und die Bestenliste belohnt es.
 *
 * Jedes Wagnis kann einmal pro Fahrt eingegangen werden.
 */

export const PACTS = [
  {
    id: 'volle_fahrt',
    name: 'Volle Fahrt',
    cost: 'Kontakte laufen 40 % dichter auf',
    gain: '+25 % Signalausbeute',
    effects: { spawnRate: 1.4, xpGain: 1.25 },
  },
  {
    id: 'ballast',
    name: 'Ballast über Bord',
    cost: 'Rumpf halbiert sich',
    gain: '+50 % Sendeleistung',
    effects: { maxHpMult: 0.5, damageMult: 1.5 },
  },
  {
    id: 'funkstille',
    name: 'Funkstille',
    cost: 'Zielerfassung nur halb so weit',
    gain: 'Signale zählen doppelt',
    effects: { aimRange: 0.5, orbValue: 2.0 },
  },
  {
    id: 'sturmfahrt',
    name: 'Sturmfahrt',
    cost: 'Kontakte laufen 30 % schneller',
    gain: 'Punktefaktor ×1,5',
    effects: { enemySpeed: 1.3, scoreMult: 1.5 },
  },
  {
    id: 'untiefe',
    name: 'Untiefe',
    cost: 'Manöver braucht doppelt so lange',
    gain: '+35 % Schlagzahl',
    effects: { dashCdMult: 2.0, hasteMult: 1.35 },
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

/** Neutrale Ausgangswerte; `applyPacts` multipliziert die aktiven darauf. */
export function baseModifiers() {
  return {
    spawnRate: 1, xpGain: 1, maxHpMult: 1, damageMult: 1,
    aimRange: 1, orbValue: 1, enemySpeed: 1, scoreMult: 1,
    dashCdMult: 1, hasteMult: 1,
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
