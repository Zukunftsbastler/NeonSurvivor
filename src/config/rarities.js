/**
 * Seltenheitsstufen als Beaufort-Skala.
 *
 * Die Grundgewichte sind gegenüber dem Prototyp drastisch gestrafft: dort lag
 * die Chance auf "Legendär oder besser" schon auf Stufe 1 bei rund 26 %, und
 * das Luck-System bewegte über 50 Stufen fast nichts. Jetzt beginnt ein Run
 * bei ~58 % "Windstille", und die Progression ist tatsächlich spürbar.
 */

export const RARITIES = [
  { id: 0, name: 'Windstille',    color: '#8fa8a0', glow: '#4a5f59', mult: 1.0,  weight: 1000 },
  { id: 1, name: 'Leichte Brise', color: '#7fd9a8', glow: '#2f7a54', mult: 1.5,  weight: 420 },
  { id: 2, name: 'Frischer Wind', color: '#3dfb87', glow: '#1c8a48', mult: 2.2,  weight: 170 },
  { id: 3, name: 'Steifer Wind',  color: '#ffd166', glow: '#a87b1e', mult: 3.5,  weight: 62 },
  { id: 4, name: 'Sturm',         color: '#ffb000', glow: '#b06f00', mult: 5.5,  weight: 20 },
  { id: 5, name: 'Orkanartig',    color: '#ff7a3d', glow: '#a33d10', mult: 8.5,  weight: 6 },
  { id: 6, name: 'Orkan',         color: '#ff3b30', glow: '#8f1409', mult: 14.0, weight: 1.6 },
  { id: 7, name: 'Mahlstrom',     color: '#ffffff', glow: '#ffffff', mult: 25.0, weight: 0.3 },
];

/** Wie stark höhere Stufen pro Spielerstufe an Gewicht gewinnen. */
const LUCK_PER_LEVEL = 0.06;

/**
 * Zieht eine Seltenheit.
 *
 * Höhere Stufen profitieren überproportional von Level und Glück, die
 * Grundstufe nie — sonst verschöbe sich nur alles gemeinsam nach oben und die
 * Leiter verlöre ihre Bedeutung.
 *
 * `bonusLuck` kommt vom Sturmjäger und addiert sich auf den Levelanteil.
 */
export function rollRarity(level, bonusLuck = 0) {
  const luck = level * LUCK_PER_LEVEL + bonusLuck;

  let total = 0;
  const weights = RARITIES.map((r) => {
    const w = r.id === 0 ? r.weight : r.weight * (1 + luck * r.id * 0.5);
    total += w;
    return w;
  });

  let roll = Math.random() * total;
  for (let i = 0; i < RARITIES.length; i++) {
    if (roll < weights[i]) return RARITIES[i];
    roll -= weights[i];
  }
  return RARITIES[0];
}
