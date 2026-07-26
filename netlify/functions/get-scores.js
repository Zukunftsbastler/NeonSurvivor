import Redis from 'ioredis';

/**
 * Liest die besten Einträge der Bestenliste.
 *
 * Ist `REDIS_URL` nicht gesetzt, gilt die Bestenliste als abgeschaltet. Der
 * Client blendet die Oberfläche dann aus, statt in Fehler zu laufen — und ein
 * späteres Wiedereinschalten ist nur ein Setzen der Umgebungsvariable, ohne
 * Codeänderung und ohne neuen Build.
 */

const LEADERBOARD_KEY = 'neon_leaderboard';
const TOP_N = 10;

let client = null;

function getClient() {
  if (!client) {
    client = new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: 2,
      enableOfflineQueue: false,
    });
    client.on('error', (err) => console.error('Redis:', err.message));
  }
  return client;
}

export default async () => {
  const headers = {
    'Content-Type': 'application/json',
    // Kurz zwischenspeicherbar: Die Liste ändert sich selten, und das
    // entlastet die Datenbank spürbar.
    'Cache-Control': 'public, max-age=15, s-maxage=30',
  };

  if (!process.env.REDIS_URL) {
    return new Response(JSON.stringify({ disabled: true, entries: [] }), { status: 200, headers });
  }

  try {
    const raw = await getClient().zrevrange(LEADERBOARD_KEY, 0, TOP_N - 1, 'WITHSCORES');

    const entries = [];
    for (let i = 0; i < raw.length; i += 2) {
      entries.push({
        name: raw[i].split(':::')[0],
        score: Number.parseInt(raw[i + 1], 10) || 0,
      });
    }

    return new Response(JSON.stringify({ disabled: false, entries }), { status: 200, headers });
  } catch (error) {
    console.error('get-scores:', error);
    // Leere Liste mit 200: Für den Client ist "noch keine Daten" der gleiche
    // Fall, und ein Fehlerstatus würde nur unnötig Konsolenrauschen erzeugen.
    return new Response(JSON.stringify({ disabled: false, entries: [] }), { status: 200, headers });
  }
};
