/**
 * Kontakte.
 *
 * Zwei Achsen erzeugen die Vielfalt, statt sie einzeln zu zeichnen:
 *
 * 1. RUMPF — Silhouette und Verhalten (13 Stück).
 * 2. MERKMALE — je 0–2 Eigenschaften, die gleichzeitig Mechanik UND Aussehen
 *    sind. Wer eine gestrichelte Kontur sieht, weiß: warten, bis der Sweep
 *    drüber geht. Das Aussehen IST die Information.
 *
 * Dazu kommt die GEFECHTSERFAHRUNG: Kontakte, die lange auf dem Schirm
 * überleben, steigen in Stufen auf und werden sichtbar gefährlicher. Das macht
 * „alles am Leben lassen" zur schlechtesten Strategie und schafft eine
 * Zielpriorität, die es vorher nicht gab.
 */

import { TAG } from './tags.js';

export const BEHAVIOR = {
  /** Direkt auf den Spieler zu. */
  JAEGER: 'jaeger',
  /** Hält Abstand und feuert. */
  SCHUETZE: 'schuetze',
  /** Umkreist den Spieler und nähert sich spiralförmig. */
  KREISER: 'kreiser',
  /** Langsam, erzeugt ein verlangsamendes Feld. */
  FELD: 'feld',
  /** Hält Abstand und legt ortsfeste Minen. */
  LEGER: 'leger',
  /** Bleibt weit weg und entlässt kleine Drohnen. */
  TRAEGER: 'traeger',
  /** Lädt auf und stürmt dann geradeaus — deutlich angekündigt. */
  RAMMER: 'rammer',
  /** Verfolgt und stört im Umkreis die Zielerfassung. */
  STOERER: 'stoerer',
  /** Hält sich hinter anderen und heilt sie. */
  SANITAETER: 'sanitaeter',
  /** Verfolgt, ist aber getaktet unverwundbar. */
  GEIST: 'geist',
};

export const SHAPE = {
  BUG: 'bug',
  RUMPF: 'rumpf',
  KEIL: 'keil',
  TURM: 'turm',
  SEGMENTE: 'segmente',
  SCHWARM: 'schwarm',
  BANK: 'bank',
  LEGER: 'leger',
  TRAEGER: 'traeger',
  SPORN: 'sporn',
  ANTENNE: 'antenne',
  KREUZ: 'kreuz',
  PHANTOM: 'phantom',
};

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
    minute: 1.5, weight: 22,
    standoff: 265, fireIntervalMs: 2200, shotSpeed: 3.1, shotDamage: 9,
  },
  aufklaerer: {
    id: 'aufklaerer', name: 'Aufklärer',
    hp: 26, speed: 2.5, size: 10, damage: 10,
    behavior: BEHAVIOR.KREISER, shape: SHAPE.SEGMENTE,
    minute: 2.5, weight: 26,
    orbitRadius: 175, closeRate: 9,
  },
  schwarm: {
    id: 'schwarm', name: 'Schwarm',
    hp: 46, speed: 1.9, size: 15, damage: 9,
    behavior: BEHAVIOR.JAEGER, shape: SHAPE.SCHWARM,
    minute: 3.5, weight: 22,
    splitsInto: 2, splitGeneration: 1,
  },
  nebelbank: {
    id: 'nebelbank', name: 'Nebelbank',
    hp: 70, speed: 0.8, size: 24, damage: 6,
    behavior: BEHAVIOR.FELD, shape: SHAPE.BANK,
    minute: 5, weight: 14,
    fieldRadius: 130, fieldSlow: 0.55,
  },

  // --- Neue Rümpfe -------------------------------------------------------

  minenleger: {
    id: 'minenleger', name: 'Minenleger',
    hp: 55, speed: 1.3, size: 16, damage: 10,
    behavior: BEHAVIOR.LEGER, shape: SHAPE.LEGER,
    minute: 4, weight: 18,
    standoff: 210, layIntervalMs: 2600, mineDamage: 14, mineRadius: 62,
  },
  traeger: {
    id: 'traeger', name: 'Träger',
    hp: 120, speed: 0.75, size: 22, damage: 12,
    behavior: BEHAVIOR.TRAEGER, shape: SHAPE.TRAEGER,
    minute: 6, weight: 12,
    standoff: 340, launchIntervalMs: 3400, broodSize: 2,
  },
  rammer: {
    id: 'rammer', name: 'Rammer',
    hp: 60, speed: 1.2, size: 14, damage: 26,
    behavior: BEHAVIOR.RAMMER, shape: SHAPE.SPORN,
    minute: 3, weight: 20,
    windupMs: 900, chargeSpeed: 9.5, chargeMs: 750, restMs: 1400,
  },
  funkstoerer: {
    id: 'funkstoerer', name: 'Funkstörer',
    hp: 44, speed: 1.6, size: 13, damage: 8,
    behavior: BEHAVIOR.STOERER, shape: SHAPE.ANTENNE,
    minute: 5.5, weight: 14,
    jamRadius: 190,
  },
  bergungsschiff: {
    id: 'bergungsschiff', name: 'Bergungsschiff',
    hp: 80, speed: 1.15, size: 17, damage: 8,
    behavior: BEHAVIOR.SANITAETER, shape: SHAPE.KREUZ,
    minute: 7, weight: 11,
    mendRadius: 150, mendPerSecond: 0.05,
  },
  geist: {
    id: 'geist', name: 'Geist',
    hp: 40, speed: 2.1, size: 12, damage: 14,
    behavior: BEHAVIOR.GEIST, shape: SHAPE.PHANTOM,
    minute: 8, weight: 13,
    phaseMs: 1800, solidMs: 2200,
  },
};

// --- Gefechtserfahrung ----------------------------------------------------

/** Sekunden auf dem Schirm je Stufe. */
export const RANK_INTERVAL_S = 22;
export const MAX_RANK = 4;

export const RANK_NAMES = ['Neuzugang', 'Eingespielt', 'Erfahren', 'Veteran', 'Flaggschiff'];

/** Tempo-, Schaden- und Panzerungszuwachs je Stufe. */
export function rankSpeedMult(rank) {
  return 1 + rank * 0.1 + (rank >= MAX_RANK ? 0.25 : 0);
}
export function rankDamageMult(rank) {
  return 1 + Math.max(0, rank - 1) * 0.1;
}
/** Schadensminderung — bewusst nicht als nachträgliche HP-Erhöhung. */
export function rankArmor(rank) {
  // Bewusst moderat: In der Messung ließ eine Panzerung von bis zu 50 % die
  // Abschusszahl um zwei Drittel einbrechen — die Kontakte alterten dann
  // schneller, als man sie abarbeiten konnte, und das schaukelte sich auf.
  return Math.min(0.3, rank * 0.075);
}
export function rankFireMult(rank) {
  // Im Spieltest war das Ausweichen zwischen Projektilen der schwierigste
  // Teil. Erfahrung beschleunigt das Feuer deshalb nur noch maßvoll.
  return Math.max(0.75, 1 - rank * 0.05);
}
/** Erfahrung lohnt sich auch: Wer wartet, erntet mehr. */
export function rankXpMult(rank) {
  return 1 + rank * 0.2;
}

// --- Merkmale -------------------------------------------------------------

/**
 * Jedes Merkmal ist Mechanik UND Aussehen. Die Zeichnung liegt bewusst hier,
 * damit beides nicht auseinanderlaufen kann.
 */
export const TRAITS = {
  gepanzert: {
    id: 'gepanzert', name: 'Gepanzert',
    minute: 2, weight: 26,
    /** Blockt Impuls, aber nicht Druckwelle — belohnt eine zweite Schadensart. */
    resist: (tags) => (tags.includes(TAG.IMPULS) && !tags.includes(TAG.DRUCKWELLE) ? 0.6 : 1),
    draw(ctx, r) {
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.rect(-r * 1.25, -r * 1.25, r * 2.5, r * 2.5);
      ctx.stroke();
    },
  },
  getaucht: {
    id: 'getaucht', name: 'Getaucht',
    minute: 4, weight: 18,
    /** Nur verwundbar, solange der Sweep ihn erfasst hat. */
    resist: (tags, enemy) => (enemy.paint > 0.25 || enemy.revealed > 0 ? 1 : 0.4),
    draw(ctx, r) {
      ctx.setLineDash([3, 4]);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(0, 0, r * 1.35, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    },
  },
  magnetisch: {
    id: 'magnetisch', name: 'Magnetisch',
    minute: 5, weight: 15,
    pull: 0.55,
    draw(ctx, r) {
      ctx.lineWidth = 1.2;
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.arc(0, 0, r * 1.5, s * 0.5, s * 0.5 + 1.2);
        ctx.stroke();
      }
    },
  },
  verstrahlt: {
    id: 'verstrahlt', name: 'Verstrahlt',
    minute: 6, weight: 15,
    leavesZone: true,
    draw(ctx, r) {
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2 + 0.4;
        ctx.beginPath();
        ctx.arc(Math.cos(a) * r * 1.2, Math.sin(a) * r * 1.2, 1.4, 0, Math.PI * 2);
        ctx.fill();
      }
    },
  },
  schwer: {
    id: 'schwer', name: 'Schwer',
    minute: 3, weight: 20,
    noKnockback: true,
    speedMult: 0.8,
    draw(ctx, r) {
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.arc(0, 0, r * 1.18, 0, Math.PI * 2);
      ctx.stroke();
    },
  },
  flink: {
    id: 'flink', name: 'Flink',
    minute: 4.5, weight: 18,
    speedMult: 1.35,
    /** Weicht gelegentlich seitlich aus. */
    evades: 0.25,
    draw(ctx, r, enemy) {
      ctx.lineWidth = 1.2;
      const a = (enemy.heading ?? 0) + Math.PI;
      for (const off of [-0.3, 0, 0.3]) {
        ctx.beginPath();
        ctx.moveTo(Math.cos(a + off) * r * 1.1, Math.sin(a + off) * r * 1.1);
        ctx.lineTo(Math.cos(a + off) * r * 1.9, Math.sin(a + off) * r * 1.9);
        ctx.stroke();
      }
    },
  },
  vereist: {
    id: 'vereist', name: 'Vereist',
    minute: 5, weight: 14,
    resist: (tags) => {
      if (tags.includes(TAG.KAELTE)) return 0.35;
      if (tags.includes(TAG.DRUCKWELLE)) return 1.5;
      return 1;
    },
    draw(ctx, r) {
      ctx.lineWidth = 1.4;
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * r * 0.9, Math.sin(a) * r * 0.9);
        ctx.lineTo(Math.cos(a) * r * 1.7, Math.sin(a) * r * 1.7);
        ctx.stroke();
      }
    },
  },
  gekoppelt: {
    id: 'gekoppelt', name: 'Gekoppelt',
    minute: 7, weight: 12,
    /** Teilt einen Anteil des Schadens mit dem Partner. */
    shareRatio: 0.5,
    draw() { /* Die Trosse wird in enemy.js gezeichnet, sie braucht den Partner. */ },
  },
};

export const TRAIT_LIST = Object.values(TRAITS);

/** Wie viele Merkmale ein Kontakt zu welcher Fahrtzeit tragen darf. */
export function traitCountFor(minutes) {
  if (minutes < 2) return 0;
  if (minutes < 6) return Math.random() < 0.35 ? 1 : 0;
  if (minutes < 10) return Math.random() < 0.55 ? (Math.random() < 0.25 ? 2 : 1) : 0;
  return Math.random() < 0.75 ? (Math.random() < 0.45 ? 2 : 1) : 0;
}

/** Leitschiffe bekommen Merkmale erst später — vorher wären sie unfair. */
export const ELITE_TRAIT_MINUTE = 6;

/** Leitschiffe. */
export const ELITE_CHANCE = 0.05;
export const ELITE_HP_MULT = 3.0;
export const ELITE_SIZE_MULT = 1.3;
export const ELITE_XP_MULT = 5.0;

/** Schwierigkeitsskalierung des Tempos. */
export const SPEED_APPROACH = 0.35;
export const SPEED_CEILING = 0.8;

export function enemySpeedFactor(difficultyMult) {
  return 1 + (1 - Math.exp(-(difficultyMult - 1) * SPEED_APPROACH)) * SPEED_CEILING;
}

export const CONTACT_COOLDOWN_FRAMES = 45;
export const CONTACT_KNOCKBACK = 14;

/**
 * Sichtbudget: Ab dieser Zahl gleichzeitiger Kontakte werden Merkmale nur noch
 * für die nächstgelegenen gezeichnet. Sonst wird der Schirm auf einem Telefon
 * unlesbar — und der Zeichenpfad teuer.
 */
export const TRAIT_DRAW_BUDGET = 34;

/**
 * Obergrenze gleichzeitiger Gegnerprojektile.
 *
 * Ohne Deckel wuchs die Zahl mit den Kanonenbooten mit, bis der Schirm nicht
 * mehr zu lesen war — der Spieltest nannte genau das als schwierigsten Punkt.
 */
export const MAX_ENEMY_SHOTS = 55;
