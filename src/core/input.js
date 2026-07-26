/**
 * Eingabe für Touch (führend) und Tastatur (Zweitweg).
 *
 * Gegenüber dem Prototyp behoben:
 * - `touchcancel` wurde nicht behandelt. Ein eingehender Anruf oder eine
 *   Systemgeste ließ den Joystick aktiv stehen, und die Figur lief bis zum
 *   Tod in eine Richtung weiter. Auf Mobilgeräten passiert das regelmäßig.
 * - `e.key` wurde ungefiltert als Schlüssel benutzt; bei gehaltener
 *   Umschalttaste liefert der Browser 'W' statt 'w' und die Steuerung setzte aus.
 */

export const input = {
  keys: Object.create(null),
  joystick: { active: false, x: 0, y: 0, originX: 0, originY: 0, id: null },
  dash: false,
};

const JOY_MAX_DIST = 50;

let controlsEl = null;
let stickBase = null;
let stickKnob = null;

/** Normierter Bewegungsvektor, Länge ≤ 1. */
export function getMoveVector() {
  if (input.joystick.active) {
    return { x: input.joystick.x, y: input.joystick.y };
  }

  let x = 0;
  let y = 0;
  if (input.keys.w || input.keys.arrowup) y -= 1;
  if (input.keys.s || input.keys.arrowdown) y += 1;
  if (input.keys.a || input.keys.arrowleft) x -= 1;
  if (input.keys.d || input.keys.arrowright) x += 1;

  const len = Math.hypot(x, y);
  if (len > 1) {
    x /= len;
    y /= len;
  }
  return { x, y };
}

export function resetInput() {
  input.keys = Object.create(null);
  input.dash = false;
  input.joystick.active = false;
  input.joystick.id = null;
  input.joystick.x = 0;
  input.joystick.y = 0;
  removeJoystickVisual();
}

function createJoystickVisual(x, y) {
  removeJoystickVisual();

  stickBase = document.createElement('div');
  stickBase.className = 'joystick-base joystick-part';
  stickBase.style.left = `${x}px`;
  stickBase.style.top = `${y}px`;

  stickKnob = document.createElement('div');
  stickKnob.className = 'joystick-knob joystick-part';
  stickKnob.style.left = `${x}px`;
  stickKnob.style.top = `${y}px`;

  controlsEl.append(stickBase, stickKnob);
}

function removeJoystickVisual() {
  stickBase = null;
  stickKnob = null;
  document.querySelectorAll('.joystick-part').forEach((el) => el.remove());
}

function updateJoystickVector(cx, cy) {
  let dx = cx - input.joystick.originX;
  let dy = cy - input.joystick.originY;
  const dist = Math.hypot(dx, dy);

  if (dist > JOY_MAX_DIST) {
    dx = (dx / dist) * JOY_MAX_DIST;
    dy = (dy / dist) * JOY_MAX_DIST;
  }

  input.joystick.x = dx / JOY_MAX_DIST;
  input.joystick.y = dy / JOY_MAX_DIST;
  if (stickKnob) stickKnob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
}

function releaseJoystick() {
  input.joystick.active = false;
  input.joystick.id = null;
  input.joystick.x = 0;
  input.joystick.y = 0;
  removeJoystickVisual();
}

export function initInput({ controls, dashButton, pauseButton, onPause }) {
  controlsEl = controls;

  // Die Pausentaste sitzt inzwischen in der HUD-Zeile, also außerhalb der
  // Steuerfläche. Der Riegel bleibt: Er kostet nichts und schützt davor, dass
  // eine spätere Umgruppierung wieder einen Joystick unter der Taste erzeugt.
  pauseButton?.addEventListener('touchstart', (e) => e.stopPropagation(), { passive: true });

  window.addEventListener('keydown', (e) => {
    const key = e.key.toLowerCase();
    input.keys[key] = true;
    if (e.code === 'Space') {
      input.dash = true;
      e.preventDefault();
    }
    if (key === 'escape' || key === 'p') onPause?.();
  });

  window.addEventListener('keyup', (e) => {
    input.keys[e.key.toLowerCase()] = false;
    if (e.code === 'Space') input.dash = false;
  });

  // Verliert das Fenster den Fokus, bleiben sonst Tasten "gedrückt".
  window.addEventListener('blur', resetInput);

  const pressDash = (e) => {
    e.preventDefault();
    e.stopPropagation();
    input.dash = true;
  };
  const releaseDash = (e) => {
    e.preventDefault();
    e.stopPropagation();
    input.dash = false;
  };

  dashButton.addEventListener('touchstart', pressDash, { passive: false });
  dashButton.addEventListener('touchend', releaseDash, { passive: false });
  dashButton.addEventListener('touchcancel', releaseDash, { passive: false });
  dashButton.addEventListener('mousedown', pressDash);
  dashButton.addEventListener('mouseup', releaseDash);
  dashButton.addEventListener('mouseleave', releaseDash);

  controls.addEventListener(
    'touchstart',
    (e) => {
      for (const t of e.changedTouches) {
        if (t.clientX < window.innerWidth / 2 && !input.joystick.active) {
          input.joystick.id = t.identifier;
          input.joystick.active = true;
          input.joystick.originX = t.clientX;
          input.joystick.originY = t.clientY;
          input.joystick.x = 0;
          input.joystick.y = 0;
          createJoystickVisual(t.clientX, t.clientY);
        }
      }
    },
    { passive: false },
  );

  controls.addEventListener(
    'touchmove',
    (e) => {
      e.preventDefault();
      for (const t of e.changedTouches) {
        if (t.identifier === input.joystick.id) updateJoystickVector(t.clientX, t.clientY);
      }
    },
    { passive: false },
  );

  const endTouch = (e) => {
    for (const t of e.changedTouches) {
      if (t.identifier === input.joystick.id) releaseJoystick();
    }
  };

  controls.addEventListener('touchend', endTouch);
  controls.addEventListener('touchcancel', endTouch);
}
