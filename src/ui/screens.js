/**
 * Start-, Pausen- und Abschlussbildschirm.
 *
 * Die Bestenliste ist lokal: Jede beendete Fahrt wird im Browser dieses
 * Geräts eingetragen. Übertragen wird nichts.
 */

import { state, SCREEN } from '../core/state.js';
import { recordScore, sanitizeName, loadNickname, saveNickname } from '../core/storage.js';

let el = null;
let onStart = null;
let onResume = null;
let onQuit = null;

export function initScreens(handlers) {
  onStart = handlers.onStart;
  onResume = handlers.onResume;
  onQuit = handlers.onQuit;

  el = {
    start: document.getElementById('startScreen'),
    pause: document.getElementById('pauseScreen'),
    over: document.getElementById('gameOverScreen'),
    nickname: document.getElementById('nicknameInput'),
    finalScore: document.getElementById('finalScore'),
    finalTime: document.getElementById('finalTime'),
    finalLevel: document.getElementById('finalLevel'),
    finalKills: document.getElementById('finalKills'),
    finalPacts: document.getElementById('finalPacts'),
    board: document.getElementById('leaderboardList'),
    boardNote: document.getElementById('boardNote'),
  };

  el.nickname.value = loadNickname();

  // Ohne diese Zeile weicht der angezeigte Wert (CSS `text-transform`) vom
  // gespeicherten ab.
  el.nickname.addEventListener('input', () => {
    el.nickname.value = el.nickname.value.toUpperCase();
  });

  document.getElementById('startBtn').addEventListener('click', () => {
    const name = sanitizeName(el.nickname.value);
    saveNickname(name);
    el.start.classList.add('hidden');
    onStart?.(name);
  });

  document.getElementById('pauseBtn').addEventListener('click', () => showPause());
  document.getElementById('resumeBtn').addEventListener('click', () => {
    hidePause();
    onResume?.();
  });
  document.getElementById('quitBtn').addEventListener('click', () => {
    hidePause();
    onQuit?.();
  });

  document.getElementById('restartBtn').addEventListener('click', () => {
    el.over.classList.add('hidden');
    el.start.classList.remove('hidden');
  });

}

export function showPause() {
  if (state.screen !== SCREEN.PLAY) return;
  state.screen = SCREEN.PAUSE;
  state.paused = true;
  el.pause.classList.remove('hidden');
}

export function hidePause() {
  el.pause.classList.add('hidden');
}

export function isPauseVisible() {
  return el && !el.pause.classList.contains('hidden');
}

function renderLeaderboard(entries, currentTs) {
  if (!entries.length) {
    el.board.innerHTML = '<li class="board-empty">Noch keine Einträge.</li>';
    return;
  }

  el.board.innerHTML = entries
    .map((entry, i) => {
      const classes = ['board-row'];
      if (i === 0) classes.push('is-first');
      if (entry.ts === currentTs) classes.push('is-current');
      return `
        <li class="${classes.join(' ')}">
          <span class="board-rank">${String(i + 1).padStart(2, '0')}</span>
          <span class="board-name">${escapeHtml(entry.name)}</span>
          <span class="board-score">${Number(entry.score).toLocaleString('de-DE')}</span>
        </li>`;
    })
    .join('');
}

function rankNote(rank, total) {
  if (!rank) return '';
  if (rank === 1) return total > 1 ? 'Neuer Rekord auf diesem Gerät!' : 'Deine erste Fahrt auf diesem Gerät.';
  if (rank <= 10) return `Platz ${rank} auf diesem Gerät.`;
  return 'Diesmal nicht unter den besten zehn.';
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[c]);
}

export function showGameOver(stats) {
  el.over.classList.remove('hidden');
  el.finalScore.textContent = Math.floor(state.score).toLocaleString('de-DE');
  el.finalTime.textContent = stats.time;
  el.finalLevel.textContent = String(stats.level);
  el.finalKills.textContent = String(stats.kills);
  el.finalPacts.textContent = String(state.activePacts.length);

  const { entries, rank, ts } = recordScore(state.nickname, state.score);
  renderLeaderboard(entries, ts);
  el.boardNote.textContent = rankNote(rank, entries.length);
}
