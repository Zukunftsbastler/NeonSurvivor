/**
 * Start-, Pausen- und Abschlussbildschirm.
 *
 * Die Übertragung an die Bestenliste ist bewusst OPT-IN: Sie geschieht erst,
 * wenn der Spieler sie ausdrücklich auslöst. Im Prototyp lief sie beim Tod
 * automatisch mit, was sich datenschutzrechtlich nicht sauber begründen ließ.
 */

import { state, SCREEN } from '../core/state.js';
import { fetchLeaderboard, submitScore, sanitizeName, loadNickname, saveNickname } from '../core/storage.js';

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
    submitBtn: document.getElementById('submitScoreBtn'),
    submitNote: document.getElementById('submitNote'),
    submitRow: document.getElementById('submitRow'),
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

  el.submitBtn.addEventListener('click', handleSubmit);
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

async function handleSubmit() {
  el.submitBtn.disabled = true;
  el.submitNote.textContent = 'Wird übertragen …';

  const duration = performance.now() - state.runStartedAt;
  const result = await submitScore(state.nickname, state.score, duration);

  if (result.ok) {
    el.submitNote.textContent = result.local
      ? 'Lokal gespeichert (Testbetrieb).'
      : 'Eingetragen. Danke!';
    await renderLeaderboard();
  } else {
    el.submitNote.textContent = result.error ?? 'Übertragung fehlgeschlagen.';
    el.submitBtn.disabled = false;
  }
}

async function renderLeaderboard() {
  el.board.innerHTML = '<li class="board-empty">Lade Daten …</li>';
  const { disabled, entries } = await fetchLeaderboard();

  // Ist keine Datenbank angebunden, verschwindet der ganze Block. Ein
  // Eintragsknopf, der garantiert fehlschlägt, wäre schlechter als keiner.
  el.submitRow.classList.toggle('hidden', disabled);
  el.board.classList.toggle('hidden', disabled);
  el.boardNote.classList.toggle('hidden', !disabled);
  if (disabled) return;

  if (!entries.length) {
    el.board.innerHTML = '<li class="board-empty">Noch keine Einträge.</li>';
    return;
  }

  el.board.innerHTML = entries
    .map(
      (entry, i) => `
        <li class="board-row${i === 0 ? ' is-first' : ''}">
          <span class="board-rank">${String(i + 1).padStart(2, '0')}</span>
          <span class="board-name">${escapeHtml(entry.name)}</span>
          <span class="board-score">${Number(entry.score).toLocaleString('de-DE')}</span>
        </li>`,
    )
    .join('');
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[c]);
}

export async function showGameOver(stats) {
  el.over.classList.remove('hidden');
  el.finalScore.textContent = Math.floor(state.score).toLocaleString('de-DE');
  el.finalTime.textContent = stats.time;
  el.finalLevel.textContent = String(stats.level);
  el.finalKills.textContent = String(stats.kills);
  el.finalPacts.textContent = String(state.activePacts.length);

  el.submitBtn.disabled = false;
  el.submitNote.textContent = '';

  await renderLeaderboard();
}
