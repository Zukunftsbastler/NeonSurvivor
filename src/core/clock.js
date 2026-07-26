/**
 * Spieluhr.
 *
 * Getrennt von `performance.now()`, weil die Weltzeit gedehnt und angehalten
 * werden kann. Der Prototyp maß Feuerpausen in Echtzeit, während die
 * Slow-Motion-Rampe nach jedem Level-Up alles andere bis auf ein Zehntel
 * verlangsamte — der Spieler feuerte also mit voller Rate in eine
 * eingefrorene Welt. Bei häufigen Level-Ups war das ein spürbarer Exploit.
 *
 * Alles, was Spielverhalten steuert (Feuerpausen, Cooldowns, Schutzfenster),
 * liest `clock.now`. Nur echte Wanduhr-Werte wie die Fahrtdauer für die
 * Bestenliste benutzen weiterhin `performance.now()`.
 */

export const clock = { now: 0 };

export function advanceClock(ms) {
  clock.now += ms;
}

export function resetClock() {
  clock.now = 0;
}
