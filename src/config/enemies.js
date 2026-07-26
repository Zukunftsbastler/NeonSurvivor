/**
 * Kontakte (Gegner).
 *
 * Im Prototyp verhielten sich alle drei Typen identisch — sie unterschieden
 * sich nur in HP, Tempo und Größe, und der Farbton wurde per HSL-Shift aus
 * der Schwierigkeit abgeleitet. Das war weder lesbar noch abwechslungsreich.
 *
 * Jetzt trägt jeder Typ ein eigenes VERHALTEN und eine eigene SILHOUETTE.
 * Bewegung ist die günstigste und unverwechselbarste Art Direction, die
 * Canvas hergibt — und auf einem kleinen Display deutlich besser lesbar als
 * Farbnuancen.
 */

export const BEHAVIOR = {
  /** Direkt auf den Spieler zu. */
  JAEGER: 'jaeger',
  /** Hält Abstand und feuert. */
  SCHUETZE: 'schuetze',
  /** Umkreist den Spieler und nähert sich spiralförmig. */
  KREISER: 'kreiser',
  /** Langsam, erzeugt ein verlangsamendes Feld. */
  FELD: 'feld',
};

export const SHAPE = {
  BUG: 'bug',           // spitzes Dreieck
  RUMPF: 'rumpf',       // Rechteck mit Aufbau
  KEIL: 'keil',         // schmaler, schneller Keil
  TURM: 'turm',         // Ring mit Geschützkranz
  SEGMENTE: 'segmente', // drei rotierende Striche
  SCHWARM: 'schwarm',   // zitterndes Punktecluster
  BANK: 'bank',         // weiche, pulsierende Wolke
};

/**
 * `hp`, `speed` und `damage` sind Grundwerte vor der Schwierigkeitsskalierung.
 * `minute` gibt an, ab welcher Spielminute der Typ auftauchen darf.
 */
export const ENEMY_TYPES = {
  kontakt: {
    id: 'kontakt', name: 'Kontakt',
    hp: 30, speed: 1.5, size: 12, damage: 10,
    behavior: BEHAVIOR.JAEGER, shape: SHAPE.BUG,
    minute: 0, weight: 100,
  },
  schnellboot: {
    id: 'schnellboot', name: 'Schnellboot',
    hp: 15, speed: 3.4, size: 8, damage: 8,
    behavior: BEHAVIOR.JAEGER, shape: SHAPE.KEIL,
    minute: 0.5, weight: 45,
  },
  frachter: {
    id: 'frachter', name: 'Frachter',
    hp: 90, speed: 0.95, size: 20, damage: 16,
    behavior: BEHAVIOR.JAEGER, shape: SHAPE.RUMPF,
    minute: 1, weight: 26,
  },
  kanonenboot: {
    id: 'kanonenboot', name: 'Kanonenboot',
    hp: 34, speed: 1.7, size: 13, damage: 12,
    behavior: BEHAVIOR.SCHUETZE, shape: SHAPE.TURM,
    minute: 1.5, weight: 30,
    /** Wunschabstand zum Spieler. */
    standoff: 265,
    fireIntervalMs: 1900,
    shotSpeed: 3.1,
    shotDamage: 9,
  },
  aufklaerer: {
    id: 'aufklaerer', name: 'Aufklärer',
    hp: 26, speed: 2.5, size: 10, damage: 10,
    behavior: BEHAVIOR.KREISER, shape: SHAPE.SEGMENTE,
    minute: 2.5, weight: 26,
    orbitRadius: 175,
    /** Wie schnell er sich pro Sekunde weiter hereinschraubt. */
    closeRate: 9,
  },
  schwarm: {
    id: 'schwarm', name: 'Schwarm',
    hp: 46, speed: 1.9, size: 15, damage: 9,
    behavior: BEHAVIOR.JAEGER, shape: SHAPE.SCHWARM,
    minute: 3.5, weight: 22,
    /** Zerfällt beim Tod — bestraft blindes Flächenfeuer. */
    splitsInto: 2,
    splitGeneration: 1,
  },
  nebelbank: {
    id: 'nebelbank', name: 'Nebelbank',
    hp: 70, speed: 0.8, size: 24, damage: 6,
    behavior: BEHAVIOR.FELD, shape: SHAPE.BANK,
    minute: 5, weight: 14,
    fieldRadius: 130,
    /** Bewegungsdämpfung des Spielers im Feld. */
    fieldSlow: 0.55,
  },
};

/** Leitschiffe (Elites). */
export const ELITE_CHANCE = 0.05;
export const ELITE_HP_MULT = 3.0;
export const ELITE_SIZE_MULT = 1.3;
export const ELITE_XP_MULT = 5.0;

/**
 * Schwierigkeitsskalierung.
 *
 * Das Tempo lief im Prototyp nur mit einem Zehntel der Schwierigkeit mit
 * (`1 + (mult-1) * 0.1`), weshalb ab Minute 5 nichts mehr aufschließen konnte.
 * Jetzt nähert es sich zügig einem Deckel: Kontakte holen einen stehenden
 * Spieler ein, überrennen einen fahrenden aber nicht.
 */
export const SPEED_APPROACH = 0.35;
export const SPEED_CEILING = 0.8;

export function enemySpeedFactor(difficultyMult) {
  return 1 + (1 - Math.exp(-(difficultyMult - 1) * SPEED_APPROACH)) * SPEED_CEILING;
}

/** Kontakt-Cooldown in normierten Frames, bevor derselbe Kontakt erneut trifft. */
export const CONTACT_COOLDOWN_FRAMES = 45;
/** Rückstoß, den ein Kontakt nach einem Treffer erfährt. */
export const CONTACT_KNOCKBACK = 14;
