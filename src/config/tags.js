/**
 * Marken (Wirkketten).
 *
 * Jedes Schadens- und Wirkereignis trägt eine oder mehrere Marken. Verstärker
 * wirken auf MARKEN, nicht auf einzelne Waffen — dadurch hebt ein
 * „+40 % Druckwelle" gleichzeitig Grundmine, Wasserbombe, Schleppnetz-Nova und
 * die Salven der Geleitboote, auch wenn man sie erst später erwirbt.
 *
 * Das ist der Unterschied zwischen additivem Zuwachs und einem Build, der sich
 * rückwirkend verstärkt — und die Voraussetzung dafür, dass Kombinationen
 * entstehen, die niemand einzeln verdrahtet hat.
 */

export const TAG = {
  /** Direkter Projektiltreffer. */
  IMPULS: 'impuls',
  /** Flächenwirkung, Detonation, Druckwelle. */
  DRUCKWELLE: 'druckwelle',
  /** Verlangsamt oder friert ein. */
  KAELTE: 'kaelte',
  /** Schaden über Zeit. */
  ZERSETZUNG: 'zersetzung',
  /** Am Notmanöver hängend. */
  MANOEVER: 'manoever',
  /** Autonome Einheiten, die für dich kämpfen. */
  GELEIT: 'geleit',
  /** Ortsfeste Dauerwirkung. */
  ZONE: 'zone',
  /** Wirtschaft: Signalaufnahme, Reichweite, Ausbeute. */
  SIGNAL: 'signal',
  /** Wirkt im Nahbereich. */
  NAHBEREICH: 'nahbereich',
  /** Wirkt auf Distanz. */
  FERNBEREICH: 'fernbereich',
  /** Heilung und Lebensraub. */
  BERGUNG: 'bergung',
};

/** Anzeigenamen und Farben fürs Bordbuch. */
export const TAG_INFO = {
  [TAG.IMPULS]:      { name: 'Impuls',      color: '#3dfb87' },
  [TAG.DRUCKWELLE]:  { name: 'Druckwelle',  color: '#ffb000' },
  [TAG.KAELTE]:      { name: 'Kälte',       color: '#9fe8ff' },
  [TAG.ZERSETZUNG]:  { name: 'Zersetzung',  color: '#b6ff5c' },
  [TAG.MANOEVER]:    { name: 'Manöver',     color: '#7fd9a8' },
  [TAG.GELEIT]:      { name: 'Geleit',      color: '#d8fff0' },
  [TAG.ZONE]:        { name: 'Zone',        color: '#ffd166' },
  [TAG.SIGNAL]:      { name: 'Signal',      color: '#ffffff' },
  [TAG.NAHBEREICH]:  { name: 'Nahbereich',  color: '#ff7a3d' },
  [TAG.FERNBEREICH]: { name: 'Fernbereich', color: '#7fb8ff' },
  [TAG.BERGUNG]:     { name: 'Bergung',     color: '#ff6b6b' },
};

/** Ab dieser Entfernung gilt ein Treffer als Fernbereich. */
export const FERNBEREICH_DISTANCE = 400;
/** Bis zu dieser Entfernung gilt ein Treffer als Nahbereich. */
export const NAHBEREICH_DISTANCE = 150;

/**
 * Obergrenze der Gesamtverstärkung.
 *
 * Marken multiplizieren sich untereinander — und das ist ausdrücklich das
 * Ziel: Wer zwei Zweige tief ausbaut, SOLL der Horde davonziehen. Der Deckel
 * ist deshalb bewusst hoch angesetzt und fängt nur den Zahlenüberlauf ab,
 * statt Kombinationen zu bremsen.
 *
 * Phasen der Übermacht sind Teil des Spiels. Der Ausgleich kommt nicht von
 * hier, sondern von der Gefechtserfahrung der Kontakte und den Wagnissen.
 */
export const MAX_AMPLIFICATION = 60;
