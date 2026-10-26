/**
 * Lokale Bestenliste und lokale Ablage.
 *
 * Datenschutz: Alles bleibt im lokalen Speicher des Browsers. Es gibt keine
 * globale Bestenliste und keinen Server mehr; nichts verlässt das Gerät.
 *
 * Der lokale Speicher hält ausschließlich Funktionsdaten (zuletzt genutztes
 * Rufzeichen, lokale Bestwerte).
 */

const LOCAL_SCORES = 'seegang_lokale_bestwerte';
const LOCAL_NAME = 'seegang_rufzeichen';

/** So viele Fahrten werden aufbewahrt; angezeigt werden die besten zehn. */
const KEEP_ENTRIES = 50;
const TOP_N = 10;

export function readLocal(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

export function writeLocal(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* Privater Modus o. Ä. — Speichern ist optional, kein Fehlerfall. */
  }
}

export function loadNickname() {
  return readLocal(LOCAL_NAME, '');
}

export function saveNickname(name) {
  writeLocal(LOCAL_NAME, name);
}

export function sanitizeName(raw) {
  const name = String(raw ?? '')
    .trim()
    .slice(0, 12)
    .replace(/[<>&"'`\\]/g, '');
  return name || 'ANON';
}

/** Gespeicherte Fahrten, bereinigt und absteigend sortiert. */
function readScores() {
  const raw = readLocal(LOCAL_SCORES, []);
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((e) => e && Number.isFinite(e.score))
    .map((e) => ({ name: sanitizeName(e.name), score: Math.floor(e.score), ts: Number(e.ts) || 0 }))
    .sort((a, b) => b.score - a.score);
}

/** Die besten zehn Fahrten auf diesem Gerät. */
export function loadLeaderboard() {
  return readScores().slice(0, TOP_N);
}

/**
 * Trägt eine beendete Fahrt in die lokale Bestenliste ein.
 * Gibt die besten zehn zurück, dazu den Platz dieser Fahrt (1-basiert) und
 * ihren Zeitstempel, über den die Oberfläche die Zeile hervorheben kann.
 */
export function recordScore(name, score) {
  const value = Math.floor(score);
  if (!Number.isFinite(value) || value < 0) {
    return { entries: loadLeaderboard(), rank: null, ts: null };
  }

  const entry = { name: sanitizeName(name), score: value, ts: Date.now() };
  // Bei Gleichstand steht die ältere Fahrt vorn.
  const scores = [...readScores(), entry].sort((a, b) => b.score - a.score || a.ts - b.ts);
  const rank = scores.indexOf(entry) + 1;
  writeLocal(LOCAL_SCORES, scores.slice(0, KEEP_ENTRIES));

  return { entries: scores.slice(0, TOP_N), rank, ts: entry.ts };
}
