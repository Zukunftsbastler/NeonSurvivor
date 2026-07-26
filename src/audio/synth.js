/**
 * Klangerzeugung.
 *
 * Alles wird zur Laufzeit synthetisiert — keine Audiodateien, kein zusätzlicher
 * Netzwerkabruf, keine Fremdquelle in der Content-Security-Policy. Für ein
 * Sonar-Thema ist das ohnehin die passende Technik: Pings, Blips und
 * gefiltertes Rauschen sind genau das, was ein Radarraum hergibt.
 *
 * Der Kontext entsteht erst bei der ersten Nutzergeste — Browser lassen Ton
 * vorher nicht zu.
 */

let ctx = null;
let master = null;
let dry = null;
let echoSend = null;
let noiseBuffer = null;
let ready = false;

/** Aktive Stimmen begrenzen, damit dichte Salven nicht in Matsch enden. */
let activeVoices = 0;
const MAX_VOICES = 24;

export const audioState = {
  enabled: true,
  volume: 0.55,
};

export function isReady() {
  return ready;
}

/**
 * Baut den Signalweg auf. Muss aus einem Klick/Tap heraus aufgerufen werden.
 * Mehrfachaufrufe sind harmlos.
 */
export function initAudio() {
  if (ctx) {
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return;
  }

  const AC = window.AudioContext ?? window.webkitAudioContext;
  if (!AC) return;

  try {
    ctx = new AC({ latencyHint: 'interactive' });
  } catch {
    return;
  }

  master = ctx.createGain();
  master.gain.value = audioState.enabled ? audioState.volume : 0;
  master.connect(ctx.destination);

  dry = ctx.createGain();
  dry.gain.value = 1;
  dry.connect(master);

  // Sehr sparsamer Nachhall: eine Rückkopplungsverzögerung mit Tiefpass.
  // Ein echter Faltungshall wäre auf Mobilgeräten zu teuer, aber ohne
  // jeden Raum klingen die Pings tot.
  const delay = ctx.createDelay(1);
  delay.delayTime.value = 0.19;

  const feedback = ctx.createGain();
  feedback.gain.value = 0.34;

  const damp = ctx.createBiquadFilter();
  damp.type = 'lowpass';
  damp.frequency.value = 1900;

  const wet = ctx.createGain();
  wet.gain.value = 0.5;

  echoSend = ctx.createGain();
  echoSend.gain.value = 1;

  echoSend.connect(delay);
  delay.connect(damp);
  damp.connect(feedback);
  feedback.connect(delay);
  damp.connect(wet);
  wet.connect(master);

  // Ein einziger Rauschpuffer, der für alle Geräusche wiederverwendet wird.
  const seconds = 2;
  noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
  const data = noiseBuffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

  ready = true;
}

export function setEnabled(on) {
  audioState.enabled = on;
  if (master && ctx) {
    master.gain.cancelScheduledValues(ctx.currentTime);
    master.gain.setTargetAtTime(on ? audioState.volume : 0, ctx.currentTime, 0.02);
  }
}

export function suspendAudio() {
  ctx?.suspend?.().catch(() => {});
}

export function resumeAudio() {
  if (ctx?.state === 'suspended') ctx.resume().catch(() => {});
}

function canPlay() {
  return ready && audioState.enabled && ctx.state === 'running' && activeVoices < MAX_VOICES;
}

function trackVoice(node, endTime) {
  activeVoices++;
  const release = () => {
    activeVoices--;
    try { node.disconnect(); } catch { /* bereits getrennt */ }
  };
  node.onended = release;
  // Rückfalltimer, falls `onended` ausbleibt (kommt auf iOS gelegentlich vor).
  setTimeout(release, Math.max(60, (endTime - ctx.currentTime) * 1000 + 260));
}

/**
 * Tonaler Impuls mit Tonhöhenverlauf.
 * `to` ist die Zielfrequenz am Ende der Dauer, `send` der Hallanteil.
 */
export function blip({
  from, to = from, dur = 0.12, type = 'sine',
  gain = 0.2, attack = 0.004, send = 0.12, delay = 0, detune = 0,
}) {
  if (!canPlay()) return;

  const t = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const amp = ctx.createGain();

  osc.type = type;
  osc.detune.value = detune;
  osc.frequency.setValueAtTime(Math.max(20, from), t);
  if (to !== from) osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);

  amp.gain.setValueAtTime(0.0001, t);
  amp.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t + attack);
  amp.gain.exponentialRampToValueAtTime(0.0001, t + dur);

  osc.connect(amp);
  amp.connect(dry);
  if (send > 0) {
    const s = ctx.createGain();
    s.gain.value = send;
    amp.connect(s);
    s.connect(echoSend);
  }

  osc.start(t);
  osc.stop(t + dur + 0.02);
  trackVoice(osc, t + dur);
}

/** Gefiltertes Rauschen — Treffer, Zischen, Manöver. */
export function noise({
  dur = 0.14, gain = 0.18, type = 'bandpass',
  from = 1200, to = from, q = 1.2, send = 0.08, delay = 0,
}) {
  if (!canPlay()) return;

  const t = ctx.currentTime + delay;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer;
  src.loop = true;
  // Zufälliger Einstiegspunkt, damit wiederholte Treffer nicht identisch klingen.
  const offset = Math.random() * (noiseBuffer.duration - dur - 0.05);

  const filter = ctx.createBiquadFilter();
  filter.type = type;
  filter.Q.value = q;
  filter.frequency.setValueAtTime(Math.max(40, from), t);
  if (to !== from) filter.frequency.exponentialRampToValueAtTime(Math.max(40, to), t + dur);

  const amp = ctx.createGain();
  amp.gain.setValueAtTime(0.0001, t);
  amp.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t + 0.005);
  amp.gain.exponentialRampToValueAtTime(0.0001, t + dur);

  src.connect(filter);
  filter.connect(amp);
  amp.connect(dry);
  if (send > 0) {
    const s = ctx.createGain();
    s.gain.value = send;
    amp.connect(s);
    s.connect(echoSend);
  }

  src.start(t, Math.max(0, offset), dur + 0.05);
  src.stop(t + dur + 0.05);
  trackVoice(src, t + dur);
}

/** Tiefer Bauchschlag — Einschläge, Detonationen, Rumpftreffer. */
export function thud({ from = 150, to = 42, dur = 0.3, gain = 0.5, delay = 0 }) {
  blip({ from, to, dur, type: 'sine', gain, attack: 0.002, send: 0.05, delay });
}

export function now() {
  return ctx ? ctx.currentTime : 0;
}
