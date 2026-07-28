/**
 * Auswahlbildschirme: Ausrüstung (Level-Up) und Wagnisse.
 *
 * Neuauswurf und Streichung sind der billigste Weg zu echtem
 * Optimierungsdruck: zwei Tap-Ziele auf einem ohnehin pausierten Bildschirm.
 */

import { state } from '../core/state.js';
import { world } from '../core/world.js';
import { generateUpgradeCards } from '../config/upgrades.js';
import { PACTS } from '../config/pacts.js';
import { PALETTE } from '../config/theme.js';
import { ring, flash, shake } from '../render/juice.js';
import { vibrate } from '../core/settings.js';
import { spawnParticles } from '../entities/fx.js';
import { sfxCardSelect, sfxBanish, sfxReroll, sfxUiTick, sfxPact } from '../audio/sfx.js';
import { refreshLogbook } from './logbook.js';

let cardsEl, levelUpEl, rerollBtn, banishHintEl, pactEl, pactListEl, pactSkipBtn;
let currentCards = [];
let banishMode = false;
let resolving = false;

/** Muss zur Dauer von .is-chosen / .is-dismissed in styles.css passen. */
const CHOICE_ANIM_MS = 320;
let onChosen = null;

export function initCards() {
  levelUpEl = document.getElementById('levelUpScreen');
  cardsEl = document.getElementById('cardsContainer');
  rerollBtn = document.getElementById('rerollBtn');
  banishHintEl = document.getElementById('banishHint');
  pactEl = document.getElementById('pactScreen');
  pactListEl = document.getElementById('pactList');
  pactSkipBtn = document.getElementById('pactSkipBtn');

  rerollBtn.addEventListener('click', () => {
    if (state.rerolls <= 0) return;
    state.rerolls--;
    sfxReroll();
    currentCards = generateUpgradeCards(world.player, state.banished);
    renderCards();
  });

  document.getElementById('banishBtn').addEventListener('click', () => {
    banishMode = !banishMode;
    sfxUiTick();
    renderCards();
  });
}

function rarityStyle(rarity) {
  return `--rarity:${rarity.color}; --rarity-glow:${rarity.glow};`;
}

function renderCards() {
  cardsEl.innerHTML = '';
  banishHintEl.textContent = banishMode
    ? 'Tippe eine Karte, um ihren Typ dauerhaft aus dem Pool zu nehmen.'
    : '';
  banishHintEl.classList.toggle('is-visible', banishMode);

  rerollBtn.disabled = state.rerolls <= 0;
  rerollBtn.querySelector('.count').textContent = String(state.rerolls);

  for (const card of currentCards) {
    const node = document.createElement('button');
    node.type = 'button';
    node.className = 'boon-card';
    if (card.rarity.id === 7) node.classList.add('rarity-mahlstrom');
    if (banishMode) node.classList.add('is-banishing');
    node.setAttribute('style', rarityStyle(card.rarity));

    node.classList.add(`kind-${card.kind}`);
    node.innerHTML = `
      <span class="boon-head">
        <span class="boon-kind">${card.kindLabel ?? ''}</span>
        <span class="boon-rarity">${card.rarity.name}</span>
      </span>
      <span class="boon-name">${card.name}</span>
      <span class="boon-value">${card.desc}</span>
      <span class="boon-detail">${card.detail ?? ''}</span>
    `;

    node.addEventListener('click', () => {
      if (banishMode) {
        state.banished.add(card.id);
        banishMode = false;
        sfxBanish();
        currentCards = generateUpgradeCards(world.player, state.banished);
        renderCards();
        return;
      }

      if (resolving) return;
      resolving = true;

      // Wirkung sofort, Optik danach: Die Karte quittiert die Wahl, die
      // übrigen treten zurück. Ohne diesen Moment fühlt sich eine Entscheidung
      // wie ein Menüklick an statt wie eine Errungenschaft.
      card.apply(world.player);
      sfxCardSelect();
      vibrate(14);

      node.classList.add('is-chosen');
      for (const other of cardsEl.children) {
        if (other !== node) other.classList.add('is-dismissed');
      }

      const p = world.player;
      ring(p.x, p.y, 10, 150, card.rarity.color, 620, 3);
      ring(p.x, p.y, 10, 96, PALETTE.salvage, 420, 2);
      flash(card.rarity.color, card.rarity.id >= 5 ? 0.3 : 0.16, 260);
      spawnParticles(p.x, p.y, card.rarity.id >= 5 ? 22 : 12, card.rarity.color, 1.8);
      if (card.rarity.id >= 4) shake(6);

      setTimeout(() => {
        hideLevelUp();
        resolving = false;
        onChosen?.();
      }, CHOICE_ANIM_MS);
    });

    cardsEl.appendChild(node);
  }
}

export function showLevelUp(onDone) {
  onChosen = onDone;
  banishMode = false;
  refreshLogbook();
  currentCards = generateUpgradeCards(world.player, state.banished);
  renderCards();
  levelUpEl.classList.remove('hidden');
}

function hideLevelUp() {
  levelUpEl.classList.add('hidden');
}

// --- Wagnisse ------------------------------------------------------------

export function showPactOffer(onDone) {
  const available = PACTS.filter((p) => !state.activePacts.includes(p.id));
  if (!available.length) {
    onDone?.();
    return;
  }

  refreshLogbook();
  const offer = [...available].sort(() => 0.5 - Math.random()).slice(0, 3);
  pactListEl.innerHTML = '';

  for (const pact of offer) {
    const node = document.createElement('button');
    node.type = 'button';
    node.className = 'pact-card';
    node.innerHTML = `
      <span class="pact-name">${pact.name}</span>
      <span class="pact-cost">− ${pact.cost}</span>
      <span class="pact-gain">+ ${pact.gain}</span>
    `;
    node.addEventListener('click', () => {
      state.activePacts.push(pact.id);
      sfxPact();
      vibrate([18, 40, 60]);

      const p = world.player;
      ring(p.x, p.y, 10, 210, PALETTE.contact, 760, 4);
      flash(PALETTE.contact, 0.26, 380);
      shake(9);

      node.classList.add('is-chosen');
      for (const other of pactListEl.children) {
        if (other !== node) other.classList.add('is-dismissed');
      }

      setTimeout(() => {
        hidePact();
        onDone?.();
      }, CHOICE_ANIM_MS);
    });
    pactListEl.appendChild(node);
  }

  pactSkipBtn.onclick = () => {
    sfxUiTick();
    hidePact();
    onDone?.();
  };

  pactEl.classList.remove('hidden');
}

function hidePact() {
  pactEl.classList.add('hidden');
}

export function hideAllCardScreens() {
  hideLevelUp();
  hidePact();
}
