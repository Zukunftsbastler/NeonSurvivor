/**
 * Benannte Klänge.
 *
 * Klangbild: ein Radarraum. Sonar-Pings mit Nachhall, kurze gefilterte
 * Rauschimpulse für Treffer, tiefe Bauchschläge für Einschläge. Nichts davon
 * ist eine Datei — alles entsteht zur Laufzeit.
 *
 * Wichtig ist die Drosselung: Bei hoher Schlagzahl entstehen zehn und mehr
 * Schüsse pro Sekunde. Ungebremst wäre das kein Klang mehr, sondern Lärm.
 */

import { blip, noise, thud, isReady, audioState } from './synth.js';

const lastPlayed = Object.create(null);

/** Lässt einen Klang frühestens nach `minGap` Millisekunden wieder zu. */
function gate(key, minGap) {
  const t = performance.now();
  if (lastPlayed[key] && t - lastPlayed[key] < minGap) return false;
  lastPlayed[key] = t;
  return true;
}

function can() {
  return isReady() && audioState.enabled;
}

/** Pentatonik — aufeinanderfolgende Aufnahmen sollen musikalisch steigen. */
const LADDER = [1, 9 / 8, 5 / 4, 3 / 2, 5 / 3, 2, 9 / 4, 5 / 2];
const ORB_BASE = 520;

let orbStreak = 0;
let lastOrbAt = 0;

export function sfxShoot(trait) {
  if (!can() || !gate('shoot', 42)) return;

  // Je Signalgeber ein eigener Anschlag, aber alle bewusst leise: Dieser
  // Klang läuft dauerhaft und darf nichts zudecken.
  switch (trait) {
    case 'peilung':
      blip({ from: 1500, to: 620, dur: 0.16, type: 'sawtooth', gain: 0.05, send: 0.2 });
      break;
    case 'brandung':
      noise({ dur: 0.09, gain: 0.06, type: 'bandpass', from: 900, to: 380, q: 0.9 });
      break;
    case 'echo':
      blip({ from: 760, to: 940, dur: 0.1, type: 'triangle', gain: 0.045, send: 0.25 });
      break;
    case 'dauerstrich':
      blip({ from: 1180, to: 980, dur: 0.045, type: 'square', gain: 0.028, send: 0.05 });
      break;
    default:
      blip({ from: 980, to: 760, dur: 0.06, type: 'triangle', gain: 0.04, send: 0.1 });
  }
}

/** Geladener Schuss — hebt sich hörbar vom Grundrhythmus ab. */
export function sfxCharged() {
  if (!can() || !gate('charged', 90)) return;
  blip({ from: 2200, to: 480, dur: 0.22, type: 'sawtooth', gain: 0.13, send: 0.3 });
  thud({ from: 180, to: 60, dur: 0.18, gain: 0.16 });
}

export function sfxHit() {
  if (!can() || !gate('hit', 28)) return;
  noise({ dur: 0.045, gain: 0.05, type: 'highpass', from: 2600, q: 0.7, send: 0.03 });
}

export function sfxKill() {
  if (!can() || !gate('kill', 34)) return;
  blip({ from: 420, to: 190, dur: 0.09, type: 'square', gain: 0.075, send: 0.14 });
}

export function sfxKillElite() {
  if (!can()) return;
  noise({ dur: 0.3, gain: 0.16, type: 'bandpass', from: 2400, to: 260, q: 0.8, send: 0.3 });
  blip({ from: 620, to: 150, dur: 0.32, type: 'sawtooth', gain: 0.13, send: 0.35 });
  thud({ from: 210, to: 44, dur: 0.4, gain: 0.34 });
}

/**
 * Signalaufnahme. Aufeinanderfolgende Orbs steigen die Tonleiter hinauf —
 * eine schnelle Serie klingt dadurch wie eine aufsteigende Figur statt wie
 * derselbe Ton in Wiederholung.
 */
export function sfxOrb() {
  if (!can()) return;

  const t = performance.now();
  if (t - lastOrbAt > 900) orbStreak = 0;
  lastOrbAt = t;

  if (!gate('orb', 34)) return;

  const step = LADDER[Math.min(orbStreak, LADDER.length - 1)];
  orbStreak++;

  blip({
    from: ORB_BASE * step,
    to: ORB_BASE * step * 1.5,
    dur: 0.09,
    type: 'sine',
    gain: 0.075,
    send: 0.22,
  });
}

/** Meilenstein der Abschussfolge — steigt mit jeder Stufe. */
export function sfxComboStep(step) {
  if (!can()) return;
  const base = 330 * Math.pow(2, Math.min(step, 10) / 12);
  blip({ from: base, to: base * 1.5, dur: 0.18, type: 'triangle', gain: 0.08, send: 0.4 });
  blip({ from: base * 2, to: base * 3, dur: 0.14, type: 'sine', gain: 0.05, send: 0.45, delay: 0.05 });
}

export function sfxPlayerHit() {
  if (!can() || !gate('playerHit', 120)) return;
  thud({ from: 240, to: 40, dur: 0.42, gain: 0.55 });
  noise({ dur: 0.22, gain: 0.2, type: 'lowpass', from: 900, to: 180, q: 0.6, send: 0.2 });
}

export function sfxDash() {
  if (!can() || !gate('dash', 90)) return;
  noise({ dur: 0.24, gain: 0.13, type: 'bandpass', from: 380, to: 2600, q: 2.4, send: 0.2 });
}

export function sfxFreeze() {
  if (!can() || !gate('freeze', 160)) return;
  blip({ from: 2600, to: 3400, dur: 0.14, type: 'sine', gain: 0.05, send: 0.4 });
}

export function sfxDetonate() {
  if (!can() || !gate('detonate', 70)) return;
  noise({ dur: 0.2, gain: 0.12, type: 'lowpass', from: 1600, to: 300, q: 0.8, send: 0.2 });
  thud({ from: 160, to: 48, dur: 0.24, gain: 0.22 });
}

export function sfxNova() {
  if (!can()) return;
  noise({ dur: 0.55, gain: 0.2, type: 'bandpass', from: 260, to: 4200, q: 1.6, send: 0.45 });
  blip({ from: 300, to: 1200, dur: 0.4, type: 'triangle', gain: 0.12, send: 0.4 });
  thud({ from: 120, to: 40, dur: 0.5, gain: 0.3 });
}

/** Stufenaufstieg: aufsteigender Dreiklang mit Sonar-Nachhall. */
export function sfxLevelUp() {
  if (!can()) return;
  const root = 440;
  [0, 0.075, 0.15, 0.235].forEach((delay, i) => {
    blip({
      from: root * [1, 5 / 4, 3 / 2, 2][i],
      to: root * [1, 5 / 4, 3 / 2, 2][i] * 1.004,
      dur: i === 3 ? 0.7 : 0.26,
      type: 'triangle',
      gain: i === 3 ? 0.16 : 0.11,
      send: 0.5,
      delay,
    });
  });
}

/** Kartenwahl — kurze Bestätigung, dann ein Ping als „aufgeschaltet“. */
export function sfxCardSelect() {
  if (!can()) return;
  blip({ from: 720, to: 1080, dur: 0.09, type: 'square', gain: 0.09, send: 0.2 });
  blip({ from: 1440, to: 1440, dur: 0.42, type: 'sine', gain: 0.11, send: 0.55, delay: 0.07 });
}

export function sfxUiTick() {
  if (!can() || !gate('ui', 40)) return;
  blip({ from: 1250, to: 1250, dur: 0.035, type: 'square', gain: 0.05, send: 0.06 });
}

export function sfxReroll() {
  if (!can()) return;
  noise({ dur: 0.16, gain: 0.1, type: 'bandpass', from: 900, to: 2400, q: 2, send: 0.2 });
}

export function sfxBanish() {
  if (!can()) return;
  blip({ from: 520, to: 160, dur: 0.24, type: 'sawtooth', gain: 0.1, send: 0.25 });
}

/** Wagnis angenommen: dunkler, tiefer Akkord — es soll sich nach Preis anfühlen. */
export function sfxPact() {
  if (!can()) return;
  [110, 130.8, 164.8].forEach((f, i) =>
    blip({ from: f, to: f, dur: 0.9, type: 'sawtooth', gain: 0.07, send: 0.5, delay: i * 0.02 }),
  );
  thud({ from: 90, to: 34, dur: 0.8, gain: 0.3 });
}

/** Radar-Sweep: ein Ping pro Umlauf. Gibt dem Spiel seinen Puls. */
export function sfxSweepPing() {
  if (!can()) return;
  blip({ from: 1320, to: 1180, dur: 0.5, type: 'sine', gain: 0.045, send: 0.75 });
}

/** Warnton bei kritischem Rumpf. */
export function sfxHullAlarm() {
  if (!can() || !gate('alarm', 900)) return;
  blip({ from: 380, to: 300, dur: 0.22, type: 'square', gain: 0.07, send: 0.15 });
}

export function sfxGameOver() {
  if (!can()) return;
  blip({ from: 420, to: 55, dur: 1.5, type: 'sawtooth', gain: 0.2, send: 0.6 });
  noise({ dur: 1.4, gain: 0.12, type: 'lowpass', from: 1400, to: 120, q: 0.7, send: 0.4 });
  thud({ from: 120, to: 28, dur: 1.2, gain: 0.4 });
}

export function resetSfxState() {
  orbStreak = 0;
  lastOrbAt = 0;
}
