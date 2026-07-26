/**
 * Bestenliste und lokale Ablage.
 *
 * Datenschutz: Die Übertragung an die Bestenliste geschieht NUR auf
 * ausdrückliche Aktion des Spielers (Einwilligung nach Art. 6 Abs. 1 lit. a
 * DSGVO). Im Prototyp wurde der Score beim Tod automatisch verschickt — das
 * ließ sich nicht sauber begründen.
 *
 * Der lokale Speicher hält ausschließlich Funktionsdaten (zuletzt genutztes
 * Rufzeichen, lokale Bestwerte). Sie verlassen das Gerät nie von selbst.
 */

const LOCAL_SCORES = 'seegang_lokale_bestwerte';
const LOCAL_NAME = 'seegang_rufzeichen';

function isLocalEnvironment() {
  return window.location.protocol === 'file:' || window.location.hostname === 'localhost';
}

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

/**
 * Trägt einen Wert ein. Gibt `{ ok, error }` zurück, damit die Oberfläche
 * Rückmeldung geben kann statt still zu scheitern.
 */
export async function submitScore(name, score, durationMs) {
  const clean = sanitizeName(name);
  const value = Math.floor(score);

  if (!Number.isFinite(value) || value < 0 || value > 5_000_000) {
    return { ok: false, error: 'Ungültiger Punktestand.' };
  }

  if (isLocalEnvironment()) {
    const scores = readLocal(LOCAL_SCORES, []);
    scores.push({ name: clean, score: value, ts: Date.now() });
    writeLocal(LOCAL_SCORES, scores.sort((a, b) => b.score - a.score).slice(0, 50));
    return { ok: true, local: true };
  }

  try {
    const res = await fetch('/.netlify/functions/save-scores', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: clean, score: value, durationMs: Math.floor(durationMs) }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      return { ok: false, error: text || `Serverfehler ${res.status}` };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: 'Keine Verbindung zur Bestenliste.' };
  }
}

/**
 * Liefert `{ disabled, entries }`.
 *
 * `disabled` meldet, dass serverseitig keine Bestenliste angebunden ist. Die
 * Oberfläche blendet dann Liste und Eintragsknopf aus, statt einen Knopf
 * anzubieten, der sicher fehlschlägt.
 */
export async function fetchLeaderboard() {
  if (isLocalEnvironment()) {
    return {
      disabled: false,
      entries: readLocal(LOCAL_SCORES, []).sort((a, b) => b.score - a.score).slice(0, 10),
    };
  }

  try {
    const res = await fetch('/.netlify/functions/get-scores');
    if (!res.ok) return { disabled: true, entries: [] };
    const data = await res.json();

    // Ältere Auslieferungen antworteten mit einem nackten Array.
    if (Array.isArray(data)) return { disabled: false, entries: data };
    return { disabled: !!data.disabled, entries: Array.isArray(data.entries) ? data.entries : [] };
  } catch {
    return { disabled: true, entries: [] };
  }
}
