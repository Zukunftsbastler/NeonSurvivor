/**
 * Systeme.
 *
 * Eigenständige Mechanismen, die man einmal erwirbt und danach in Stufen
 * ausbaut. Jedes trägt Marken und hängt damit automatisch an den Wirkketten —
 * ein „+Geleit"-Verstärker hebt das Geleitboot, ohne dass die beiden
 * voneinander wissen müssen.
 *
 * Vier Plätze. Die Knappheit ist Absicht: Sie zwingt zum Profil und ist der
 * Grund, warum sich zwei Fahrten überhaupt unterscheiden können.
 *
 * Die Hooks werden von `systems/loadout.js` aufgerufen. `api` bündelt alles,
 * was ein System auslösen darf; dadurch bleibt diese Datei reine Konfiguration
 * und erzeugt keine Zirkelbezüge.
 */

import { TAG } from './tags.js';
import { systemPower } from '../systems/power.js';

export const MAX_SYSTEM_SLOTS = 4;
export const MAX_SYSTEM_LEVEL = 5;

/** Punkte auf der Stufenanzeige im Bordbuch. */
export function levelDots(level) {
  return '●'.repeat(level) + '○'.repeat(MAX_SYSTEM_LEVEL - level);
}

export const SYSTEMS = {
  // --- Überleben ---------------------------------------------------------

  lenzpumpe: {
    id: 'lenzpumpe',
    name: 'Lenzpumpe',
    category: 'ueberleben',
    hint: 'Dichtet den Rumpf laufend ab',
    tags: [TAG.BERGUNG],
    describe: (lvl) => `${(0.5 + lvl * 0.55).toFixed(1)} Rumpf/s`,
    update(p, slot, dtMs, api) {
      const perSecond = (0.5 + slot.level * 0.55) * api.amplify([TAG.BERGUNG]);
      p.heal((perSecond * dtMs) / 1000);
    },
  },

  wellenbrecher: {
    id: 'wellenbrecher',
    name: 'Wellenbrecher',
    category: 'ueberleben',
    hint: 'Schluckt einen Treffer vollständig',
    tags: [],
    describe: (lvl) => `${Math.max(1, Math.round(16 - lvl * 2.2))} s Nachladezeit`,
    onAcquire(p, slot) {
      slot.charged = true;
      slot.rechargeLeft = 0;
    },
    update(p, slot, dtMs) {
      if (slot.charged) return;
      slot.rechargeLeft -= dtMs;
      if (slot.rechargeLeft <= 0) {
        slot.charged = true;
        p.shieldPulse = 1;
      }
    },
    /** Gibt true zurück, wenn der Treffer geschluckt wurde. */
    absorb(p, slot) {
      if (!slot.charged) return false;
      slot.charged = false;
      slot.rechargeLeft = Math.max(1000, (16 - slot.level * 2.2) * 1000);
      return true;
    },
  },

  rettungsinsel: {
    id: 'rettungsinsel',
    name: 'Rettungsinsel',
    category: 'ueberleben',
    hint: 'Einmal pro Fahrt: Rumpf verloren, Fahrt geht weiter',
    tags: [],
    /** Bewusst teuer: erst ab „Sturm" im Angebot. */
    minRarity: 4,
    maxLevel: 1,
    describe: () => 'einmalig, 35 % Rumpf',
    onAcquire(p, slot) {
      slot.used = false;
    },
  },

  schotten: {
    id: 'schotten',
    name: 'Schotten dicht',
    category: 'ueberleben',
    hint: 'Schadensminderung, die mit fallendem Rumpf steigt',
    tags: [],
    describe: (lvl) => `bis −${Math.round((0.1 + lvl * 0.05) * 100)} % Schaden`,
    /** Faktor auf eingehenden Schaden. */
    mitigate(p, slot) {
      const missing = 1 - Math.max(0, p.hp / p.maxHp);
      return 1 - (0.1 + slot.level * 0.05) * (0.35 + 0.65 * missing);
    },
  },

  nebelwand: {
    id: 'nebelwand',
    name: 'Nebelwand',
    category: 'ueberleben',
    hint: 'Nach einem Treffer verlieren Kontakte dich kurz',
    tags: [TAG.ZONE],
    describe: (lvl) => `${(1.2 + lvl * 0.45).toFixed(1)} s Deckung`,
    onPlayerHit(p, slot, api) {
      api.smokeScreen((1.2 + slot.level * 0.45) * 1000);
    },
  },

  // --- Angriff -----------------------------------------------------------

  geleitboot: {
    id: 'geleitboot',
    name: 'Geleitboot',
    category: 'angriff',
    hint: 'Begleiter kreisen und feuern selbständig',
    tags: [TAG.GELEIT, TAG.IMPULS],
    describe: (lvl) => `${lvl} Boot${lvl === 1 ? '' : 'e'}`,
    onAcquire(p, slot, api) { api.syncEscorts(slot.level); },
    onLevel(p, slot, api) { api.syncEscorts(slot.level); },
  },

  wasserbombe: {
    id: 'wasserbombe',
    name: 'Wasserbombe',
    category: 'angriff',
    hint: 'Zündet in fester Folge rings um dich',
    tags: [TAG.DRUCKWELLE, TAG.ZONE],
    describe: (lvl) => `alle ${(8.2 - lvl * 1.0).toFixed(1)} s · ${Math.round(170 + lvl * 45)} px`,
    onAcquire(p, slot) { slot.timer = 2500; },
    update(p, slot, dtMs, api) {
      slot.timer -= dtMs;
      if (slot.timer > 0) return;
      slot.timer = (8.2 - slot.level * 1.0) * 1000;
      // Reichweite und Wucht deutlich angehoben: Auf Stufe 3 waren 186 px und
      // 62 Schaden im Spiel schlicht nicht wahrnehmbar.
      api.depthCharge(
        p.x, p.y,
        systemPower(p, 1.1 + slot.level * 0.75),
        170 + slot.level * 45,
        slot.level >= 3,
      );
    },
  },

  sturmflut: {
    id: 'sturmflut',
    name: 'Sturmflut',
    category: 'angriff',
    hint: 'Räumt in großer Not den ganzen Schirm',
    tags: [TAG.DRUCKWELLE, TAG.ZONE],
    /** Bewusst teuer: das ist der Notausgang, nicht die Grundausstattung. */
    minRarity: 3,
    describe: (lvl) => `alle ${Math.round(46 - lvl * 5)} s, ganzer Schirm`,
    onAcquire(p, slot) { slot.timer = 20000; },
    update(p, slot, dtMs, api) {
      slot.timer -= dtMs;
      if (slot.timer > 0) return;
      slot.timer = (46 - slot.level * 5) * 1000;
      api.stormSurge(systemPower(p, 2.4 + slot.level * 1.3));
    },
  },

  grundschleppnetz: {
    id: 'grundschleppnetz',
    name: 'Grundschleppnetz',
    category: 'angriff',
    hint: 'Holt sämtliche Signale vom Schirm',
    tags: [TAG.SIGNAL],
    minRarity: 2,
    describe: (lvl) => `alle ${Math.round(24 - lvl * 3)} s`,
    onAcquire(p, slot) { slot.timer = 8000; },
    update(p, slot, dtMs, api) {
      slot.timer -= dtMs;
      if (slot.timer > 0) return;
      slot.timer = (24 - slot.level * 3) * 1000;
      api.trawl();
    },
  },

  minenleger: {
    id: 'minenleger',
    name: 'Minenleger',
    category: 'angriff',
    hint: 'Legt Seeminen ins Fahrtwasser',
    tags: [TAG.ZONE, TAG.DRUCKWELLE],
    describe: (lvl) => `alle ${(3.4 - lvl * 0.4).toFixed(1)} s`,
    onAcquire(p, slot) { slot.timer = 1200; },
    update(p, slot, dtMs, api) {
      slot.timer -= dtMs;
      if (slot.timer > 0) return;
      slot.timer = (3.4 - slot.level * 0.4) * 1000;
      api.dropMine(p.x, p.y, systemPower(p, 0.55 + slot.level * 0.35));
    },
  },

  oelspur: {
    id: 'oelspur',
    name: 'Ölspur',
    category: 'angriff',
    hint: 'Hinterlässt eine zersetzende Spur',
    tags: [TAG.ZONE, TAG.ZERSETZUNG],
    describe: (lvl) => `Stufe ${lvl} · zersetzende Spur`,
    onAcquire(p, slot) { slot.timer = 0; },
    update(p, slot, dtMs, api) {
      slot.timer -= dtMs;
      if (slot.timer > 0) return;
      slot.timer = 420;
      api.oilPatch(p.x, p.y, 34 + slot.level * 7, systemPower(p, 0.06 + slot.level * 0.05));
    },
  },

  schleppanker: {
    id: 'schleppanker',
    name: 'Schleppanker',
    category: 'angriff',
    hint: 'Bremst alles in deiner Nähe',
    tags: [TAG.KAELTE, TAG.ZONE],
    describe: (lvl) => `${Math.round(110 + lvl * 26)} px Reichweite`,
    update(p, slot, dtMs, api) {
      api.dragField(110 + slot.level * 26);
    },
  },

  suchscheinwerfer: {
    id: 'suchscheinwerfer',
    name: 'Suchscheinwerfer',
    category: 'angriff',
    hint: 'Rotierender Kegel, deckt Getauchte auf',
    tags: [TAG.FERNBEREICH],
    describe: (lvl) => `Stufe ${lvl} · deckt Getauchte auf`,
    onAcquire(p, slot) { slot.angle = 0; },
    update(p, slot, dtMs, api) {
      slot.angle = (slot.angle + (dtMs / 1000) * 1.15) % (Math.PI * 2);
      api.searchlight(slot.angle, 0.42, 330,
        systemPower(p, 0.05 + slot.level * 0.035) * (dtMs / 1000) * 6);
    },
  },

  bordflieger: {
    id: 'bordflieger',
    name: 'Bordflieger',
    category: 'angriff',
    hint: 'Startet Aufklärer auf einzelne Ziele',
    tags: [TAG.GELEIT],
    describe: (lvl) => `alle ${(4.2 - lvl * 0.5).toFixed(1)} s`,
    onAcquire(p, slot) { slot.timer = 1500; },
    update(p, slot, dtMs, api) {
      slot.timer -= dtMs;
      if (slot.timer > 0) return;
      slot.timer = (4.2 - slot.level * 0.5) * 1000;
      api.launchDrone(systemPower(p, 0.7 + slot.level * 0.45));
    },
  },

  funkfeuer: {
    id: 'funkfeuer',
    name: 'Funkfeuer',
    category: 'angriff',
    hint: 'Setzt einen Köder, der Kontakte bindet',
    tags: [TAG.ZONE, TAG.SIGNAL],
    describe: (lvl) => `${(5 + lvl * 1.2).toFixed(0)} s Standzeit`,
    onAcquire(p, slot) { slot.timer = 2000; },
    update(p, slot, dtMs, api) {
      slot.timer -= dtMs;
      if (slot.timer > 0) return;
      slot.timer = (11 - slot.level) * 1000;
      api.dropBeacon(p.x, p.y, (5 + slot.level * 1.2) * 1000);
    },
  },

  prallblech: {
    id: 'prallblech',
    name: 'Prallblech',
    category: 'angriff',
    hint: 'Wirft Gegnerprojektile zurück',
    tags: [TAG.NAHBEREICH],
    describe: (lvl) => `${Math.round(20 + lvl * 14)} % Rückwurf`,
    /** Wahrscheinlichkeit, ein eingehendes Projektil zurückzuwerfen. */
    reflectChance(slot) {
      return 0.2 + slot.level * 0.14;
    },
  },
};

export const SYSTEM_LIST = Object.values(SYSTEMS);

export function systemById(id) {
  return SYSTEMS[id];
}

export function maxLevelOf(def) {
  return def.maxLevel ?? MAX_SYSTEM_LEVEL;
}
