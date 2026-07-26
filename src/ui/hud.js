/**
 * HUD.
 *
 * Der Prototyp löste bei jedem Aufruf sieben `getElementById` auf und schrieb
 * bedingungslos in den DOM — und rief das nicht nur pro Frame auf, sondern
 * zusätzlich bei jedem Abschuss und jedem XP-Gewinn. Bei 40 Abschüssen pro
 * Sekunde waren das hunderte layoutrelevante Schreibvorgänge pro Frame.
 *
 * Jetzt: Referenzen einmal auflösen, nur bei tatsächlicher Änderung schreiben,
 * und das Ganze auf 10 Hz drosseln.
 */

import { state } from '../core/state.js';
import { clock } from '../core/clock.js';
import { world } from '../core/world.js';
import { PACTS } from '../config/pacts.js';

const UPDATE_INTERVAL_MS = 100;

let el = null;
let lastUpdate = 0;
const shown = {
  hp: -1, xp: -1, level: -1, score: -1, time: -1,
  dash: null, rerolls: -1, pacts: -1, weapons: '',
};

export function initHud() {
  el = {
    hull: document.getElementById('hullBar'),
    hullText: document.getElementById('hullText'),
    xp: document.getElementById('xpBar'),
    level: document.getElementById('levelValue'),
    score: document.getElementById('scoreValue'),
    time: document.getElementById('timeValue'),
    dashBtn: document.getElementById('dashBtn'),
    dashRing: document.getElementById('dashRing'),
    rerolls: document.getElementById('rerollCount'),
    pacts: document.getElementById('pactStrip'),
    weapons: document.getElementById('weaponStrip'),
  };
}

function formatTime(seconds) {
  const total = Math.floor(seconds);
  const m = String(Math.floor(total / 60)).padStart(2, '0');
  const s = String(total % 60).padStart(2, '0');
  return `${m}:${s}`;
}

export function updateHud(force = false) {
  const now = clock.now;
  if (!force && now - lastUpdate < UPDATE_INTERVAL_MS) return;
  lastUpdate = now;

  const p = world.player;
  if (!p || !el) return;

  const hpPct = Math.max(0, Math.min(100, (p.hp / p.maxHp) * 100));
  if (Math.abs(hpPct - shown.hp) > 0.4) {
    shown.hp = hpPct;
    el.hull.style.width = `${hpPct}%`;
    el.hull.classList.toggle('is-critical', hpPct < 35);
    el.hullText.textContent = `${Math.max(0, Math.round(p.hp))}/${Math.round(p.maxHp)}`;
  }

  const xpPct = Math.max(0, Math.min(100, (p.xp / p.xpToNext) * 100));
  if (Math.abs(xpPct - shown.xp) > 0.4) {
    shown.xp = xpPct;
    el.xp.style.width = `${xpPct}%`;
  }

  if (p.level !== shown.level) {
    shown.level = p.level;
    el.level.textContent = String(p.level);
  }

  const score = Math.floor(state.score);
  if (score !== shown.score) {
    shown.score = score;
    el.score.textContent = score.toLocaleString('de-DE');
  }

  const t = Math.floor(state.elapsedTime);
  if (t !== shown.time) {
    shown.time = t;
    el.time.textContent = formatTime(state.elapsedTime);
  }

  const ready = clock.now - p.lastDashTime >= p.dashCooldown;
  if (ready !== shown.dash) {
    shown.dash = ready;
    el.dashBtn.classList.toggle('is-cooling', !ready);
  }
  if (!ready) {
    const pct = Math.min(1, (clock.now - p.lastDashTime) / p.dashCooldown);
    el.dashRing.style.setProperty('--fill', `${pct * 100}%`);
  } else {
    el.dashRing.style.setProperty('--fill', '100%');
  }

  if (state.rerolls !== shown.rerolls) {
    shown.rerolls = state.rerolls;
    el.rerolls.textContent = String(state.rerolls);
  }

  if (state.activePacts.length !== shown.pacts) {
    shown.pacts = state.activePacts.length;
    el.pacts.innerHTML = state.activePacts
      .map((id) => {
        const pact = PACTS.find((x) => x.id === id);
        return `<span class="pact-chip">${pact ? pact.name : id}</span>`;
      })
      .join('');
  }

  const sig = p.weapons.map((w) => w.name).join('|');
  if (sig !== shown.weapons) {
    shown.weapons = sig;
    el.weapons.innerHTML = p.weapons
      .map((w) => `<span class="weapon-chip"${w.tint ? ` style="--tint:${w.tint}"` : ''}>${w.name}</span>`)
      .join('');
  }
}

/** Bildschirmmitte der Erfahrungsleiste — Ziel der XP-Funken. */
export function getXpBarCentre() {
  const bar = el?.xp?.parentElement;
  if (!bar) return null;
  const r = bar.getBoundingClientRect();
  if (!r.width) return null;
  return { x: r.left + r.width * 0.5, y: r.top + r.height * 0.5 };
}

/** Kurzes Aufleuchten, wenn ein Funke ankommt. */
export function pulseXpBar() {
  const bar = el?.xp;
  if (!bar) return;
  bar.classList.remove('is-pulsing');
  // Reflow erzwingen, damit die Animation bei schneller Folge neu startet.
  void bar.offsetWidth;
  bar.classList.add('is-pulsing');
}

export function resetHudCache() {
  // Muss mit zurückgesetzt werden: Die Drossel misst in Spielzeit, und die
  // beginnt bei jeder Fahrt wieder bei null.
  lastUpdate = 0;
  shown.hp = -1; shown.xp = -1; shown.level = -1; shown.score = -1;
  shown.time = -1; shown.dash = null; shown.rerolls = -1;
  shown.pacts = -1; shown.weapons = '';
}
