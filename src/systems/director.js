/**
 * Wellensteuerung und Schwierigkeit.
 *
 * Der Spawn-Abstand des Prototyps kannte nur eine Richtung: Er sank bei guter
 * Abschussrate auf den Boden von 10 und stieg praktisch nie wieder. Jetzt
 * atmet er in beide Richtungen und ist an die Fahrtzeit gekoppelt.
 */

import { world } from '../core/world.js';
import { state } from '../core/state.js';
import { clock } from '../core/clock.js';
import { Enemy } from '../entities/enemy.js';
import { ENEMY_TYPES } from '../config/enemies.js';

const MAX_ENEMIES = 110;
const BASE_INTERVAL = 60;
const MIN_INTERVAL = 12;
const MAX_INTERVAL = 100;

let spawnTimer = 0;
let spawnInterval = BASE_INTERVAL;

export function resetDirector() {
  spawnTimer = 0;
  spawnInterval = BASE_INTERVAL;
}

/** Gewichtete Auswahl unter den Typen, die zur aktuellen Fahrtzeit freigeschaltet sind. */
function pickType(minutes) {
  const pool = Object.values(ENEMY_TYPES).filter((t) => minutes >= t.minute);
  if (!pool.length) return 'kontakt';

  let total = 0;
  for (const t of pool) total += t.weight;

  let roll = Math.random() * total;
  for (const t of pool) {
    if (roll < t.weight) return t.id;
    roll -= t.weight;
  }
  return pool[0].id;
}

export function updateDirector(ts) {
  // Spielzeit, nicht Wanduhrzeit: Während einer Pause oder eines
  // Auswahlbildschirms darf das Beobachtungsfenster nicht weiterlaufen,
  // sonst wertet der Director eine Abschussrate von null.
  const now = clock.now;
  const minutes = state.elapsedTime / 60;

  state.difficultyMultiplier = 1 + minutes * 0.5;

  if (now - state.lastDirectorCheck > 5000) {
    const killRate = state.enemiesKilledRecent / 5;
    state.enemiesKilledRecent = 0;
    state.lastDirectorCheck = now;

    if (killRate > 3) spawnInterval = Math.max(MIN_INTERVAL, spawnInterval - 5);
    else if (killRate < 1.2) spawnInterval = Math.min(MAX_INTERVAL, spawnInterval + 4);
  }

  spawnTimer -= ts;
  if (spawnTimer > 0) return;

  if (world.enemies.length < MAX_ENEMIES) {
    world.enemies.push(new Enemy(pickType(minutes)));
  }

  const rate = state.difficultyMultiplier * state.mods.spawnRate;
  spawnTimer = Math.max(2, spawnInterval / rate);
}
