/**
 * Vorgerendertes Leuchten.
 *
 * Der Prototyp setzte `ctx.shadowBlur` für JEDES Objekt in JEDEM Frame.
 * Canvas-2D-Schatten sind auf mobilen GPUs mit Abstand die teuerste Operation
 * und erzwingen je Aufruf einen eigenen Rendering-Durchgang; bei ein paar
 * hundert Objekten war das der limitierende Faktor.
 *
 * Statt dessen wird der Halo einmal je (Farbe, Radius) in ein Offscreen-Canvas
 * gezeichnet und danach nur noch geblittet. Nebeneffekt: Das Leuchten ist
 * gestaltbar — harter Kern, weicher Abfall — statt gleichförmigem Matsch.
 */

const cache = new Map();
const MAX_ENTRIES = 160;

/** Auf 2-px-Stufen gerundet, damit der Cache nicht je Pixelwert wächst. */
function quantize(radius) {
  return Math.max(2, Math.round(radius / 2) * 2);
}

export function getGlow(color, radius) {
  const r = quantize(radius);
  const key = `${color}|${r}`;

  const hit = cache.get(key);
  if (hit) return hit;

  const size = r * 4;
  const sprite = document.createElement('canvas');
  sprite.width = size;
  sprite.height = size;

  const g = sprite.getContext('2d');
  const half = size / 2;
  const grad = g.createRadialGradient(half, half, 0, half, half, half);

  grad.addColorStop(0.0, color);
  grad.addColorStop(0.22, color);
  grad.addColorStop(0.45, hexToRgba(color, 0.45));
  grad.addColorStop(1.0, hexToRgba(color, 0));

  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);

  if (cache.size > MAX_ENTRIES) cache.clear();
  cache.set(key, sprite);
  return sprite;
}

/** Zeichnet den Halo mittig um (x, y). */
export function drawGlow(ctx, color, radius, x, y, alpha = 1) {
  const sprite = getGlow(color, radius);
  const half = sprite.width / 2;

  if (alpha !== 1) {
    const prev = ctx.globalAlpha;
    ctx.globalAlpha = prev * alpha;
    ctx.drawImage(sprite, x - half, y - half);
    ctx.globalAlpha = prev;
    return;
  }
  ctx.drawImage(sprite, x - half, y - half);
}

export function hexToRgba(hex, alpha) {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

export function clearGlowCache() {
  cache.clear();
}
