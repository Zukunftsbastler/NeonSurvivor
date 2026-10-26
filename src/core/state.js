import { baseModifiers, applyPacts } from '../config/pacts.js';

export const SCREEN = {
  START: 'START',
  PLAY: 'PLAY',
  LEVELUP: 'LEVELUP',
  PACT: 'PACT',
  PAUSE: 'PAUSE',
  GAMEOVER: 'GAMEOVER',
};

/** Wie viele Neuauswürfe eine Fahrt startet. */
export const START_REROLLS = 3;

export const state = {
  screen: SCREEN.START,
  nickname: '',
  score: 0,
  elapsedTime: 0,
  paused: false,

  difficultyMultiplier: 1,
  enemiesKilledTotal: 0,
  enemiesKilledRecent: 0,
  lastDirectorCheck: 0,

  /** Slow-Motion-Rampe nach dem Fortsetzen. */
  resumeRampStart: 0,

  /** Punktefaktor aus Abschussfolge. Bricht bei Rumpfschaden ein. */
  combo: 1,
  lastKillAt: 0,

  rerolls: START_REROLLS,
  banished: new Set(),

  activePacts: [],
  mods: baseModifiers(),
  lastPactOfferS: 0,
  lastHitAt: 0,
};

export function resetState(nickname) {
  state.screen = SCREEN.PLAY;
  state.nickname = nickname;
  state.score = 0;
  state.elapsedTime = 0;
  state.paused = false;

  state.difficultyMultiplier = 1;
  state.enemiesKilledTotal = 0;
  state.enemiesKilledRecent = 0;
  state.lastDirectorCheck = 0;
  state.resumeRampStart = 0;

  state.combo = 1;
  state.lastKillAt = 0;

  state.rerolls = START_REROLLS;
  state.banished = new Set();

  state.activePacts = [];
  state.mods = baseModifiers();
  state.lastPactOfferS = 0;
  state.lastHitAt = 0;
}

export function recomputeMods() {
  state.mods = applyPacts(state.activePacts);
}

/** Sammelbare Punkte inklusive Abschussfolge und Wagnis-Faktor. */
export function addScore(base) {
  state.score += base * state.combo * state.mods.scoreMult;
}
