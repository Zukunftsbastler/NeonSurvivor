/**
 * Spielereinstellungen.
 *
 * Alles hier ist Rückmeldung, die manche Menschen ausdrücklich NICHT wollen:
 * Kameraruckeln bei Bewegungsempfindlichkeit, Bildblitze bei Photosensibilität,
 * Zeitanhalten bei Reisekrankheit. Das gehört abschaltbar — und zwar schon vor
 * dem ersten Start, nicht erst, nachdem es einmal ausgelöst hat.
 *
 * `prefers-reduced-motion` des Systems setzt die Voreinstellung, die manuelle
 * Wahl sticht sie danach.
 */

import { readLocal, writeLocal } from './storage.js';

const KEY = 'seegang_einstellungen';

const prefersReducedMotion =
  typeof window !== 'undefined' && window.matchMedia
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false;

const DEFAULTS = {
  sound: true,
  /** Kameraruckeln bei Treffern und Detonationen. */
  shake: !prefersReducedMotion,
  /** Bildschirmfüllende Blitze. Für Photosensible der wichtigste Schalter. */
  flashes: !prefersReducedMotion,
  /** Kurzes Anhalten der Zeit beim Einschlag. */
  hitStop: !prefersReducedMotion,
  /** Zeitlupe vor Auswahlbildschirmen. */
  slowMotion: true,
  vibration: true,
};

export const settings = { ...DEFAULTS, ...readLocal(KEY, {}) };

/** Reihenfolge und Beschriftung der Schalter in der Oberfläche. */
export const SETTING_LABELS = [
  { key: 'sound', label: 'Ton', hint: 'Sonar, Treffer, Signale' },
  { key: 'shake', label: 'Bildruckeln', hint: 'Kamera zittert bei Einschlägen' },
  { key: 'flashes', label: 'Blitze', hint: 'Helle Bildaufheller bei großen Ereignissen' },
  { key: 'hitStop', label: 'Trefferstopp', hint: 'Zeit hält bei schweren Treffern kurz an' },
  { key: 'slowMotion', label: 'Zeitlupe', hint: 'Welt rollt vor der Auswahl aus' },
  { key: 'vibration', label: 'Vibration', hint: 'Nur auf Geräten, die es können' },
];

const listeners = new Set();

export function onSettingChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function setSetting(key, value) {
  if (!(key in DEFAULTS)) return;
  settings[key] = !!value;
  writeLocal(KEY, settings);
  for (const fn of listeners) fn(key, settings[key]);
}

export function toggleSetting(key) {
  setSetting(key, !settings[key]);
  return settings[key];
}

/** Einzige Stelle, an der vibriert wird — respektiert die Einstellung. */
export function vibrate(pattern) {
  if (!settings.vibration) return;
  navigator.vibrate?.(pattern);
}
