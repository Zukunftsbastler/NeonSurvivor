/**
 * Art Direction — Hafenradar.
 *
 * Das Spiel zeigt einen Radarschirm der Hafenwache. Der Spieler ist ein Signal,
 * Gegner sind Kontakte. Daraus leiten sich Palette, Formen und Vokabular ab —
 * alles hier an einer Stelle, damit die Festlegung durchgehalten wird.
 *
 * Die Palette hat genau fünf Rollen. Volle Sättigung ist ALARM vorbehalten;
 * dadurch trägt sie Bedeutung, statt nur laut zu sein.
 */

export const PALETTE = {
  /** Schirmhintergrund. */
  screen: '#02070a',
  /** Rasterringe und Peilstriche. */
  grid: '#0c2a24',
  /** Helle Rasterlinien (jeder vierte Ring). */
  gridMajor: '#12463a',
  /** Eigenes Signal, Systemtext, Aufbauten. */
  system: '#3dfb87',
  /** Fremde Kontakte. Gefahr, aber neutral. */
  contact: '#ffb000',
  /** Aufgefasste Signale (XP), Belohnung. */
  salvage: '#d8fff0',
  /** Nur für unmittelbare Bedrohung: Rumpfschaden, Leitschiffe. */
  alarm: '#ff3b30',
  /** Gedämpftes Grün für UI-Rahmen und Sekundärtext. */
  chrome: '#5f8f7c',
};

/** Anzeigename. Eine Zeile — bewusst leicht austauschbar. */
export const TITLE = 'SEEGANG';
export const SUBTITLE = 'Radarwache — Hafenrevier';

/**
 * Schriften. Bewusst systemeigen: kein externer Font-Request, also
 * keine Drittlandübermittlung und kein blockierender Ladepfad auf Mobilfunk.
 * Zahlen laufen in Monospace — HUD-Werte sollen wie Messdaten lesen, nicht
 * wie Dekoration.
 */
export const FONT_UI =
  'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace';

/** Radar-Sweep: Umlaufdauer in Millisekunden. */
export const SWEEP_PERIOD_MS = 3400;

/**
 * Kontakte außerhalb des Sweeps bleiben sichtbar, nur gedämpft. Vollständiges
 * Ausblenden wäre auf einem 5-Zoll-Display unfair — die Spannung entsteht aus
 * dem Helligkeitsunterschied, nicht aus fehlender Information.
 */
export const SWEEP_MIN_ALPHA = 0.42;
