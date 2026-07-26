import Redis from 'ioredis';

/** Liest die besten Einträge der Bestenliste. */

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

  try {
    const raw = await getClient().zrevrange(LEADERBOARD_KEY, 0, TOP_N - 1, 'WITHSCORES');

    const entries = [];
    for (let i = 0; i < raw.length; i += 2) {
      entries.push({
        name: raw[i].split(':::')[0],
        score: Number.parseInt(raw[i + 1], 10) || 0,
      });
    }

    return new Response(JSON.stringify(entries), { status: 200, headers });
  } catch (error) {
    console.error('get-scores:', error);
    // Leere Liste mit 200: Für den Client ist "noch keine Daten" der gleiche
    // Fall, und ein Fehlerstatus würde nur unnötig Konsolenrauschen erzeugen.
    return new Response('[]', { status: 200, headers });
  }
};
