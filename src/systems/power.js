/**
 * Wirkstärke der Systeme.
 *
 * Der Spieltest hat hier einen echten Konstruktionsfehler offengelegt:
 * Systemschaden war eine feste Zahl (`26 + Stufe * 12`), während Signalgeber
 * über Marken-Verstärker multiplikativ wachsen. Die Wasserbombe machte auf
 * Stufe 3 rund 9 Schaden pro Sekunde, der Signalgeber daneben ein Vielfaches —
 * sie wirkte deshalb völlig folgenlos, obwohl sie mechanisch funktionierte.
 *
 * Jetzt hängen Systeme am selben Grundwert wie Waffen UND wachsen mit der
 * Spielerstufe mit. Damit bleibt ein System, das man früh einbaut, auch spät
 * noch relevant — und der Ausbau lohnt sich sichtbar.
 */

/** Wie stark der Systemschaden mit der Spielerstufe mitwächst. */
const LEVEL_SCALE = 0.16;

/**
 * @param player  aktueller Spieler
 * @param factor  systemeigener Multiplikator (meist aus der Ausbaustufe)
 */
export function systemPower(player, factor) {
  if (!player) return 0;
  return player.damage * (1 + player.level * LEVEL_SCALE) * factor;
}
