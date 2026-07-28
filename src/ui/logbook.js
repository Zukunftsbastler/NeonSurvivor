/**
 * Bordbuch — zugeklappte Übersicht über den gesamten Fahrtstand.
 *
 * Nicht nur Anzeige: Sobald Verstärker auf MARKEN wirken statt auf einzelne
 * Waffen, muss man sehen können, welche Marken man verstärkt hat. Sonst bleibt
 * unsichtbar, dass die angebotene „Kühlanlage" gleich drei Quellen hebt — und
 * damit bliebe die Emergenz unlesbar.
 *
 * Wird in mehrere Behälter gerendert (Ausrüstung, Wagnis, Pause), damit der
 * Stand überall dort erreichbar ist, wo man eine Entscheidung trifft.
 */

import { state } from '../core/state.js';
import { world } from '../core/world.js';
import { TAG_INFO } from '../config/tags.js';
import { maxLevelOf, MAX_SYSTEM_SLOTS } from '../config/systems.js';
import { couplingById } from '../config/couplings.js';
import { PACTS } from '../config/pacts.js';
import { MAX_WEAPON_SLOTS } from '../entities/player.js';
import { damageReport, takenReport } from '../systems/ledger.js';

const containers = [];

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[c]);
}

function section(title, rows) {
  if (!rows.length) return '';
  return `<div class="log-section"><h4>${title}</h4>${rows.join('')}</div>`;
}

function weaponRows(p) {
  const rows = p.weapons.map(
    (w) => `<div class="log-row">
        <span class="log-name"${w.tint ? ` style="color:${esc(w.tint)}"` : ''}>${esc(w.name)}</span>
        <span class="log-meta">${esc(w.rarity?.name ?? 'Werft')}</span>
      </div>`,
  );

  for (let i = p.weapons.length; i < MAX_WEAPON_SLOTS; i++) {
    rows.push('<div class="log-row is-empty"><span class="log-name">— Platz frei —</span></div>');
  }
  return rows;
}

function systemRows(p) {
  const rows = p.systems.map((slot) => {
    const cap = maxLevelOf(slot.def);
    const dots = '●'.repeat(slot.level) + '○'.repeat(Math.max(0, cap - slot.level));
    return `<div class="log-row">
        <span class="log-name">${esc(slot.def.name)}</span>
        <span class="log-dots">${dots}</span>
        <span class="log-meta">${esc(slot.def.describe(slot.level))}</span>
      </div>`;
  });

  for (let i = p.systems.length; i < MAX_SYSTEM_SLOTS; i++) {
    rows.push('<div class="log-row is-empty"><span class="log-name">— Platz frei —</span></div>');
  }
  return rows;
}

function amplifierRows(p) {
  const entries = Object.entries(p.amp)
    .filter(([, v]) => v > 0.001)
    .sort((a, b) => b[1] - a[1]);

  if (!entries.length) return [];

  const max = entries[0][1];
  return entries.map(([tag, value]) => {
    const info = TAG_INFO[tag];
    const filled = Math.max(1, Math.round((value / max) * 10));
    const sources = p.tagSources(tag);
    return `<div class="log-row">
        <span class="log-name" style="color:${esc(info.color)}">${esc(info.name)}</span>
        <span class="log-meta">+${Math.round(value * 100)} %</span>
        <span class="log-bar" style="--fill:${filled * 10}%; --tint:${esc(info.color)}"></span>
        <span class="log-meta">${sources} Quelle${sources === 1 ? '' : 'n'}</span>
      </div>`;
  });
}

function couplingRows(p) {
  return [...p.couplings].map((id) => {
    const c = couplingById(id);
    if (!c) return '';
    return `<div class="log-row">
        <span class="log-name">⚡ ${esc(c.name)}</span>
        <span class="log-meta">${esc(c.hint)}</span>
      </div>`;
  });
}

function statRows(p) {
  const rows = [];
  if (p.luck > 0) {
    rows.push(`<div class="log-row">
        <span class="log-name">Sturmneigung</span>
        <span class="log-meta">+${Math.round(p.luck * 100)} %</span>
      </div>`);
  }
  return rows;
}

function pactRows() {
  return state.activePacts.map((id) => {
    const pact = PACTS.find((x) => x.id === id);
    return `<div class="log-row"><span class="log-name">${esc(pact?.name ?? id)}</span></div>`;
  });
}

/**
 * Schadensbuch. Beantwortet die Frage, die man sich nach einer Fahrt stellt:
 * Was hat eigentlich getragen — und woran bin ich gestorben?
 */
function ledgerRows(report, unit) {
  if (!report.total) return [];
  return report.rows.slice(0, 8).map((r) => {
    const pct = Math.round(r.share * 100);
    return `<div class="log-row">
        <span class="log-name">${esc(r.name)}</span>
        <span class="log-meta">${pct} %</span>
        <span class="log-bar" style="--fill:${Math.max(2, pct)}%; --tint:var(--system)"></span>
        <span class="log-meta">${Math.round(r.value).toLocaleString('de-DE')}${unit}${
          r.kills ? ` · ${r.kills} Abschüsse` : ''
        }</span>
      </div>`;
  });
}

function render(root) {
  const p = world.player;
  if (!p) return;

  const summary = root.querySelector('.log-summary');
  if (summary) summary.textContent = `Stufe ${p.level} · ${state.rerolls}× Auswurf`;

  const body = root.querySelector('.log-body');
  if (!body) return;

  // Die Schadensauswertung steht nur im Abschluss: Während der Fahrt wäre sie
  // eine Ablenkung, danach ist sie die interessanteste Zahl auf dem Schirm.
  const withLedger = root.dataset.ledger === 'true';

  body.innerHTML =
    (withLedger ? section('Ausgeteilter Schaden', ledgerRows(damageReport(), '')) : '') +
    (withLedger ? section('Erlittener Schaden', ledgerRows(takenReport(), '')) : '') +
    section('Signalgeber', weaponRows(p)) +
    section('Systeme', systemRows(p)) +
    section('Verstärkung', amplifierRows(p)) +
    section('Kopplungen', couplingRows(p)) +
    section('Sonstiges', statRows(p)) +
    section('Wagnisse', pactRows());
}

export function initLogbook(selector) {
  for (const root of document.querySelectorAll(selector)) {
    root.innerHTML = `
      <summary><span>Bordbuch</span><span class="log-summary"></span></summary>
      <div class="log-body"></div>`;
    containers.push(root);
  }
}

/** Vor dem Anzeigen eines Auswahlbildschirms aufrufen. */
export function refreshLogbook() {
  for (const root of containers) render(root);
}
