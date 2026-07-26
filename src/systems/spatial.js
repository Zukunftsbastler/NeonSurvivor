/**
 * Uniformes Raster für Nachbarschaftsabfragen.
 *
 * Der Prototyp iterierte bei jedem Grundminen-Treffer über ALLE Kontakte.
 * Mit 20 Projektilen pro Salve und 100 Kontakten waren das bis zu 2.000
 * Distanzprüfungen pro Frame — jede mit einem DOM-Popup als Folge.
 *
 * Das Raster wird einmal pro Frame gefüllt (O(n)) und beantwortet Radius-
 * Abfragen in praktisch konstanter Zeit.
 */

const CELL = 72;

export class SpatialGrid {
  constructor() {
    this.cells = new Map();
  }

  static key(cx, cy) {
    return cx * 46341 + cy;
  }

  clear() {
    this.cells.clear();
  }

  rebuild(items) {
    this.cells.clear();
    for (const item of items) {
      const key = SpatialGrid.key(Math.floor(item.x / CELL), Math.floor(item.y / CELL));
      const bucket = this.cells.get(key);
      if (bucket) bucket.push(item);
      else this.cells.set(key, [item]);
    }
  }

  /** Alle Einträge in Zellen, die den Kreis (x, y, radius) berühren. */
  query(x, y, radius, out = []) {
    out.length = 0;
    const minX = Math.floor((x - radius) / CELL);
    const maxX = Math.floor((x + radius) / CELL);
    const minY = Math.floor((y - radius) / CELL);
    const maxY = Math.floor((y + radius) / CELL);

    for (let cx = minX; cx <= maxX; cx++) {
      for (let cy = minY; cy <= maxY; cy++) {
        const bucket = this.cells.get(SpatialGrid.key(cx, cy));
        if (bucket) out.push(...bucket);
      }
    }
    return out;
  }
}

export const enemyGrid = new SpatialGrid();
