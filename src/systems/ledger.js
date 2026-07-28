/**
 * Schadensbuch.
 *
 * Zählt mit, woher der Schaden kommt und woran man stirbt. Ohne diese Zahlen
 * ist Balancing Raterei: Im Spieltest wirkte die Wasserbombe wirkungslos —
 * sie war es nicht, sie machte nur ein Zwanzigstel dessen, was der Signalgeber
 * daneben machte. Das sieht man einer Fahrt nicht an, einer Aufstellung schon.
 *
 * Bewusst schlicht: zwei flache Zähltabellen, keine Zeitreihen. Das kostet
 * nichts und beantwortet die Frage, die zählt — was trägt, und was nicht.
 */

const dealt = new Map();
const taken = new Map();
const kills = new Map();

let totalDealt = 0;
let totalTaken = 0;

export function resetLedger() {
  dealt.clear();
  taken.clear();
  kills.clear();
  totalDealt = 0;
  totalTaken = 0;
}

/** Schaden, den der Spieler ausgeteilt hat. */
export function noteDealt(source, amount) {
  if (!source || !(amount > 0)) return;
  dealt.set(source, (dealt.get(source) ?? 0) + amount);
  totalDealt += amount;
}

/** Abschuss einer Quelle zuschreiben. */
export function noteKill(source) {
  if (!source) return;
  kills.set(source, (kills.get(source) ?? 0) + 1);
}

/** Schaden, den der Spieler kassiert hat. */
export function noteTaken(source, amount) {
  if (!source || !(amount > 0)) return;
  taken.set(source, (taken.get(source) ?? 0) + amount);
  totalTaken += amount;
}

function toRows(map, total) {
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([name, value]) => ({
      name,
      value,
      share: total > 0 ? value / total : 0,
      kills: kills.get(name) ?? 0,
    }));
}

export function damageReport() {
  return { rows: toRows(dealt, totalDealt), total: totalDealt };
}

export function takenReport() {
  return { rows: toRows(taken, totalTaken), total: totalTaken };
}
