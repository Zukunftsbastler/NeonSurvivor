import Redis from 'ioredis';
import { createHash } from 'node:crypto';

/**
 * Eintrag in die Bestenliste.
 *
 * Gegenüber der Erstfassung:
 * - Der Client wird modulweit gehalten statt pro Aufruf geöffnet. Bei
 *   Lastspitzen konnten sonst die Verbindungen ausgehen.
 * - Der Punktestand wird gegen die gemeldete Fahrtdauer plausibilisiert.
 *   Ein reines Client-Spiel lässt sich nie vollständig absichern, aber ein
 *   `fetch` aus der Browserkonsole reicht jetzt nicht mehr für Platz 1.
 * - Rate-Limit je IP. Die IP wird dabei NICHT gespeichert, sondern nur als
 *   Hash mit kurzer Lebensdauer als Zählerschlüssel benutzt.
 */

const LEADERBOARD_KEY = 'neon_leaderboard';
const KEEP_ENTRIES = 100;

const MAX_NAME_LENGTH = 12;
const MAX_SCORE = 50_000_000;
const MIN_DURATION_MS = 10_000;
const MAX_DURATION_MS = 4 * 60 * 60 * 1000;

/**
 * Obergrenze für plausible Punktestände, hergeleitet aus der Punktemechanik:
 * Der Wert je Kontakt wächst linear mit der Fahrtzeit, deshalb wächst der
 * erreichbare Gesamtwert quadratisch. Die Koeffizienten liegen rund fünffach
 * über dem, was eine simulierte Dauer-Bestleistung erreicht — die Prüfung
 * soll offensichtliche Fälschungen abfangen, nicht gutes Spiel bestrafen.
 */
const SCORE_BASELINE = 30_000;
const SCORE_PER_SECOND = 9_000;
const SCORE_PER_SECOND_SQ = 40;

const RATE_LIMIT_WINDOW_S = 60;
const RATE_LIMIT_MAX = 10;

let client = null;

function getClient() {
  if (!client) {
    client = new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: 2,
      enableOfflineQueue: false,
      lazyConnect: false,
    });
    client.on('error', (err) => console.error('Redis:', err.message));
  }
  return client;
}

function clientKey(req, context) {
  const ip =
    req.headers.get('x-nf-client-connection-ip') ??
    context?.ip ??
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    'unknown';

  // Nur ein Hash wandert in den Speicher, und der verfällt nach 60 Sekunden.
  return createHash('sha256')
    .update(`${ip}|${process.env.RATE_SALT ?? 'seegang'}`)
    .digest('hex')
    .slice(0, 24);
}

function sanitizeName(raw) {
  const name = String(raw ?? '')
    .trim()
    .slice(0, MAX_NAME_LENGTH)
    .replace(/[\u0000-\u001f<>&"'`\\]/g, '');
  return name.trim() || 'ANON';
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

export default async (req, context) => {
  if (req.method !== 'POST') return json({ error: 'Nur POST.' }, 405);

  let body;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Ungültige Anfrage.' }, 400);
  }

  const name = sanitizeName(body?.name);
  const score = Number(body?.score);
  const durationMs = Number(body?.durationMs);

  if (!Number.isFinite(score) || !Number.isInteger(score) || score < 0 || score > MAX_SCORE) {
    return json({ error: 'Punktestand außerhalb des gültigen Bereichs.' }, 400);
  }

  if (!Number.isFinite(durationMs) || durationMs < MIN_DURATION_MS || durationMs > MAX_DURATION_MS) {
    return json({ error: 'Fahrtdauer unplausibel.' }, 400);
  }

  const seconds = durationMs / 1000;
  const ceiling = SCORE_BASELINE + seconds * SCORE_PER_SECOND + seconds * seconds * SCORE_PER_SECOND_SQ;
  if (score > ceiling) {
    return json({ error: 'Punktestand passt nicht zur Fahrtdauer.' }, 422);
  }

  try {
    const redis = getClient();

    const rateKey = `rl:${clientKey(req, context)}`;
    const hits = await redis.incr(rateKey);
    if (hits === 1) await redis.expire(rateKey, RATE_LIMIT_WINDOW_S);
    if (hits > RATE_LIMIT_MAX) {
      return json({ error: 'Zu viele Einträge. Bitte kurz warten.' }, 429);
    }

    await redis
      .multi()
      .zadd(LEADERBOARD_KEY, score, `${name}:::${Date.now()}`)
      // Ohne Trimmen wüchse das Sorted Set unbegrenzt, obwohl nur die
      // besten zehn je gelesen werden.
      .zremrangebyrank(LEADERBOARD_KEY, 0, -(KEEP_ENTRIES + 1))
      .exec();

    return json({ ok: true });
  } catch (error) {
    console.error('save-scores:', error);
    return json({ error: 'Bestenliste nicht erreichbar.' }, 503);
  }
};
