/**
 * Gemeinsamer Spielraum: Leinwand, Maße und die Objektlisten.
 *
 * Eigenes Modul, damit Entitäten und Systeme darauf zugreifen können, ohne
 * sich gegenseitig zu importieren (Zirkelbezüge).
 */

export const world = {
  canvas: null,
  ctx: null,
  /** Maße in CSS-Pixeln — die Spiellogik rechnet nie in Gerätepixeln. */
  width: 0,
  height: 0,
  dpr: 1,

  player: null,
  bullets: [],
  enemyBullets: [],
  enemies: [],
  orbs: [],
  /** Kurzlebige Flächenwirkungen (Korrosionswolken, Druckwellen). */
  zones: [],

  /** Eigene Einheiten und Auslagen aus den Systemen. */
  escorts: [],
  drones: [],
  mines: [],
  beacons: [],

  /**
   * Ein aktives Funkfeuer zieht Kontakte auf sich statt auf den Spieler.
   * Liegt hier, damit die Gegnerlogik es lesen kann, ohne die Systeme zu kennen.
   */
  decoy: null,
  /** Solange gesetzt, verlieren Kontakte den Spieler (Nebelwand). */
  smokeUntil: 0,
  /** Frames, in denen ein Funkstörer die Zielerfassung drückt. */
  jammed: 0,
};

/**
 * Gerätepixelverhältnis auf 2 gedeckelt: Bei DPR 3 wäre es die neunfache
 * Pixelmenge, was den Gewinn aus dem vorgerenderten Leuchten wieder auffräße.
 */
const MAX_DPR = 2;

export function initCanvas(canvas) {
  world.canvas = canvas;
  world.ctx = canvas.getContext('2d', { alpha: false });
  resizeCanvas();
}

export function resizeCanvas() {
  const { canvas, ctx } = world;
  if (!canvas) return;

  // visualViewport folgt auf iOS der ein- und ausfahrenden Adressleiste;
  // innerHeight tut das nur verzögert und lässt das Bild springen.
  const vv = window.visualViewport;
  const w = Math.round(vv?.width ?? window.innerWidth);
  const h = Math.round(vv?.height ?? window.innerHeight);
  const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);

  world.width = w;
  world.height = h;
  world.dpr = dpr;

  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.imageSmoothingEnabled = true;
}

export function clearWorld() {
  world.bullets.length = 0;
  world.enemyBullets.length = 0;
  world.enemies.length = 0;
  world.orbs.length = 0;
  world.zones.length = 0;
  world.escorts.length = 0;
  world.drones.length = 0;
  world.mines.length = 0;
  world.beacons.length = 0;
  world.decoy = null;
  world.smokeUntil = 0;
  world.jammed = 0;
  world.player = null;
}

/**
 * Entfernt inaktive Einträge in-place. Ersetzt `Array.filter`, das pro Frame
 * und Liste ein neues Array angelegt hat.
 */
export function compact(list, isAlive) {
  let write = 0;
  for (let read = 0; read < list.length; read++) {
    const item = list[read];
    if (isAlive(item)) {
      if (write !== read) list[write] = item;
      write++;
    }
  }
  list.length = write;
}
