/**
 * Einstellungsschalter.
 *
 * Wird in mehrere Behälter gerendert (Startbildschirm und Pause), damit die
 * Abschaltmöglichkeit erreichbar ist, BEVOR der erste Blitz ausgelöst hat.
 */

import { settings, SETTING_LABELS, toggleSetting, onSettingChange } from '../core/settings.js';
import { sfxUiTick } from '../audio/sfx.js';

const containers = [];

function paint() {
  for (const root of containers) {
    for (const btn of root.querySelectorAll('[data-setting]')) {
      const on = settings[btn.dataset.setting];
      btn.setAttribute('aria-pressed', String(on));
      btn.querySelector('.toggle-state').textContent = on ? 'an' : 'aus';
    }
  }
}

export function initSettingsPanel(selector) {
  for (const root of document.querySelectorAll(selector)) {
    root.innerHTML = SETTING_LABELS.map(
      ({ key, label, hint }) => `
        <button type="button" class="toggle" data-setting="${key}" title="${hint}">
          <span class="toggle-label">${label}</span>
          <span class="toggle-state">an</span>
        </button>`,
    ).join('');

    root.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-setting]');
      if (!btn) return;
      toggleSetting(btn.dataset.setting);
      // Bewusst nach dem Umschalten: Wer den Ton einschaltet, hört sofort,
      // dass es gewirkt hat.
      sfxUiTick();
      paint();
    });

    containers.push(root);
  }

  onSettingChange(paint);
  paint();
}
