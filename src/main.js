import './styles.css';

import { world, initCanvas, resizeCanvas, clearWorld, compact } from './core/world.js';
import { state, SCREEN, resetState, recomputeMods } from './core/state.js';
import { clock, advanceClock, resetClock } from './core/clock.js';
import { initInput, resetInput } from './core/input.js';
import { Player } from './entities/player.js';
import {
  clearFx, updateFx, updateSparks, spawnParticles,
  setSparkTarget, setSparkArrivalHandler, spawnXpSpark,
} from './entities/fx.js';
import { enemyGrid } from './systems/spatial.js';
import {
  updateBullets, updateEnemyBullets, updateZones, resolveDash, schleppnetzNova,
} from './systems/combat.js';
import { updateDirector, resetDirector } from './systems/director.js';
import { render, updateSweep, resetSweep } from './render/renderer.js';
import { updateJuice, resetJuice, isStopped, ring, flash, shake } from './render/juice.js';
import { initHud, updateHud, resetHudCache, pulseXpBar, getXpBarCentre } from './ui/hud.js';
import { initCards, showLevelUp, showPactOffer, hideAllCardScreens } from './ui/cards.js';
import { initLogbook, refreshLogbook } from './ui/logbook.js';
import { updateLoadout, resetLoadout } from './systems/loadout.js';
import { resetCouplingCooldowns } from './systems/damage.js';
import { resetLedger } from './systems/ledger.js';
import { initScreens, showGameOver, showPause, hidePause, isPauseVisible } from './ui/screens.js';
import { initAudio, suspendAudio, resumeAudio, setEnabled } from './audio/synth.js';
import { settings, onSettingChange, vibrate } from './core/settings.js';
import { initSettingsPanel } from './ui/settings-panel.js';
import { sfxLevelUp, sfxHullAlarm, sfxSweepPing, sfxGameOver, sfxOrb, resetSfxState } from './audio/sfx.js';
import { TITLE, SUBTITLE, PALETTE } from './config/theme.js';
import { FIRST_OFFER_S, OFFER_INTERVAL_S, BORED_HP_RATIO, BORED_UNHURT_S, MAX_PACTS } from './config/pacts.js';

/**
 * Die gesamte Bewegungslogik des Prototyps war framebasiert: `timeScale` war
 * außerhalb der Slow-Motion-Rampe konstant 1.0, und die tatsächlich
 * verstrichene Zeit floss nie ein. Auf einem 120-Hz-Display lief das Spiel
 * damit doppelt so schnell — bei einem Mobile-First-Titel der gravierendste
 * technische Mangel.
 *
 * `NOMINAL_FRAME_MS` ist der Bezugspunkt: Ein 60-Hz-Frame hat den Faktor 1,0.
 */
const NOMINAL_FRAME_MS = 1000 / 60;
/** Deckel gegen Sprünge nach App-Wechsel oder langem Frame. */
const MAX_FRAME_MS = 50;

/**
 * Dauer der Zeitlupe vor einem Auswahlbildschirm.
 *
 * Ein harter Schnitt mitten in der Bewegung reißt aus dem Spiel heraus. Die
 * Welt langsam zum Stehen zu bringen gibt dem Aufstieg einen Moment und lässt
 * den Blick noch erfassen, was gerade passiert ist.
 */
const RAMP_DOWN_MS = 520;
const RAMP_FLOOR = 0.05;

let lastTimestamp = 0;
let pendingLevelUps = 0;
let wakeLock = null;
let rampDownStart = 0;

function boot() {
  document.getElementById('gameTitle').textContent = TITLE;
  document.getElementById('gameSubtitle').textContent = SUBTITLE;
  document.title = `${TITLE} — ${SUBTITLE}`;

  initCanvas(document.getElementById('gameCanvas'));
  initHud();
  initCards();
  initSettingsPanel('.settings-grid');
  initLogbook('.logbook');

  // Tonschalter an den Synthesizer koppeln.
  setEnabled(settings.sound);
  onSettingChange((key) => {
    if (key === 'sound') {
      if (settings.sound) initAudio();
      setEnabled(settings.sound);
    }
  });

  // Ein angekommener Funke lässt die Erfahrungsleiste aufblitzen — damit
  // Ursache und Wirkung sichtbar zusammengehören.
  setSparkArrivalHandler(pulseXpBar);

  initInput({
    controls: document.getElementById('controls'),
    dashButton: document.getElementById('dashBtn'),
    pauseButton: document.getElementById('pauseBtn'),
    onPause: togglePause,
  });

  initScreens({
    onStart: startRun,
    onResume: resumeFromPause,
    onQuit: quitToStart,
  });

  window.addEventListener('resize', onViewportChange);
  window.visualViewport?.addEventListener('resize', onViewportChange);
  document.addEventListener('visibilitychange', onVisibilityChange);

  syncSparkTarget();
  requestAnimationFrame(loop);
}

let resizeTimer = 0;
function onViewportChange() {
  // Auf iOS feuert das Ereignis beim Ein- und Ausfahren der Adressleiste
  // laufend; ohne Entprellung würde die Leinwand mitten im Spiel flackern.
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    resizeCanvas();
    syncSparkTarget();
  }, 120);
}

/** Holt die echte Bildschirmlage der Erfahrungsleiste als Ziel für die Funken. */
function syncSparkTarget() {
  const centre = getXpBarCentre();
  if (centre) setSparkTarget(centre.x, centre.y);
}

/**
 * Ohne diesen Handler lief `requestAnimationFrame` beim App-Wechsel gedrosselt
 * weiter; nach der Rückkehr sprang die Fahrtzeit um mehrere Sekunden, während
 * die Figur ungeschützt dastand. Auf Mobilgeräten ist der App-Wechsel der
 * Normalfall.
 */
function onVisibilityChange() {
  if (document.hidden) {
    if (state.screen === SCREEN.PLAY) showPause();
    suspendAudio();
    releaseWakeLock();
  } else {
    lastTimestamp = 0;
    if (state.screen === SCREEN.PLAY) {
      resumeAudio();
      requestWakeLock();
    }
  }
}

/** Verhindert, dass der Bildschirm während einer ruhigen Phase abschaltet. */
async function requestWakeLock() {
  try {
    wakeLock = await navigator.wakeLock?.request('screen');
  } catch {
    /* Nicht unterstützt oder abgelehnt — unkritisch. */
  }
}

function releaseWakeLock() {
  wakeLock?.release?.().catch(() => {});
  wakeLock = null;
}

// --- Ablaufsteuerung ------------------------------------------------------

function startRun(nickname) {
  unlockAudio();
  resetInput();
  resetClock();
  resetDirector();
  resetSweep();
  resetHudCache();
  resetJuice();
  resetSfxState();
  resetLoadout();
  resetCouplingCooldowns();
  resetLedger();
  clearFx();
  clearWorld();
  hideAllCardScreens();

  resetState(nickname);
  world.player = new Player();
  pendingLevelUps = 0;
  rampDownStart = 0;
  lastTimestamp = 0;

  document.getElementById('hud').classList.remove('hidden');
  document.getElementById('controls').classList.remove('hidden');

  syncSparkTarget();
  updateHud(true);
  requestWakeLock();
}

function togglePause() {
  if (state.screen === SCREEN.PLAY) showPause();
  else if (state.screen === SCREEN.PAUSE && isPauseVisible()) resumeFromPause();
}

function resumeFromPause() {
  hidePause();
  state.screen = SCREEN.PLAY;
  state.paused = false;
  state.resumeRampStart = clock.now;
  lastTimestamp = 0;
  resetInput();
  resumeAudio();
  requestWakeLock();
}

function quitToStart() {
  state.screen = SCREEN.START;
  state.paused = true;
  releaseWakeLock();
  resetInput();
  clearWorld();
  document.getElementById('hud').classList.add('hidden');
  document.getElementById('controls').classList.add('hidden');
  document.getElementById('startScreen').classList.remove('hidden');
}

function queueLevelUp() {
  pendingLevelUps++;
}

/** Der Aufstieg selbst — noch im Spiel, bevor der Bildschirm kommt. */
function celebrateLevelUp() {
  const p = world.player;
  ring(p.x, p.y, 12, 240, PALETTE.salvage, 700, 4);
  ring(p.x, p.y, 12, 150, PALETTE.system, 520, 3);
  flash(PALETTE.system, 0.14, 260);
  spawnParticles(p.x, p.y, 20, PALETTE.salvage, 2);
  shake(4);
  sfxLevelUp();
  vibrate([12, 30, 22]);
}

/** Zeigt anstehende Auswahlbildschirme nacheinander. */
function processQueues() {
  if (pendingLevelUps > 0) {
    pendingLevelUps--;
    state.screen = SCREEN.LEVELUP;
    state.paused = true;
    resetInput();
    showLevelUp(afterChoice);
    return true;
  }

  if (shouldOfferPact()) {
    state.lastPactOfferS = state.elapsedTime;
    state.screen = SCREEN.PACT;
    state.paused = true;
    resetInput();
    showPactOffer(() => {
      recomputeMods();
      // "Ballast über Bord" halbiert den Rumpf — ohne Nachziehen stünde die
      // Anzeige über 100 %.
      world.player.hp = Math.min(world.player.hp, world.player.maxHp);
      afterChoice();
    });
    return true;
  }

  return false;
}

function afterChoice() {
  if (processQueues()) return;

  state.screen = SCREEN.PLAY;
  state.paused = false;
  state.resumeRampStart = clock.now;
  rampDownStart = 0;
  lastTimestamp = 0;
  updateHud(true);
}

/**
 * Wagnisse werden angeboten, wenn genug Zeit vergangen ist — oder früher,
 * wenn der Spieler offensichtlich unterfordert ist. Das ist die Antwort auf
 * "irgendwann ist keine Interaktion mehr nötig": Statt die Schwierigkeit
 * heimlich nachzuziehen, bekommt der Spieler sie zum freiwilligen Kauf.
 */
function shouldOfferPact() {
  if (state.elapsedTime < FIRST_OFFER_S) return false;
  if (state.activePacts.length >= MAX_PACTS) return false;

  const since = state.elapsedTime - state.lastPactOfferS;
  if (since >= OFFER_INTERVAL_S) return true;

  const p = world.player;
  const bored =
    p.hp / p.maxHp >= BORED_HP_RATIO &&
    state.elapsedTime - state.lastHitAt >= BORED_UNHURT_S;

  return bored && since >= OFFER_INTERVAL_S * 0.5;
}

async function endRun() {
  state.screen = SCREEN.GAMEOVER;
  state.paused = true;
  releaseWakeLock();
  resetInput();
  sfxGameOver();
  vibrate([40, 60, 120]);

  document.getElementById('hud').classList.add('hidden');
  document.getElementById('controls').classList.add('hidden');

  // Muss VOR dem Aufräumen laufen — danach ist der Spieler fort und der
  // Ausbaustand wäre nicht mehr auslesbar.
  refreshLogbook();

  const total = Math.floor(state.elapsedTime);
  showGameOver({
    time: `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`,
    level: world.player.level,
    kills: state.enemiesKilledTotal,
  });
}

// --- Schleife -------------------------------------------------------------

function loop(timestamp) {
  requestAnimationFrame(loop);

  if (!lastTimestamp) lastTimestamp = timestamp;
  const realDt = Math.min(timestamp - lastTimestamp, MAX_FRAME_MS);
  lastTimestamp = timestamp;

  if (state.screen !== SCREEN.PLAY || state.paused) return;

  // Effekte laufen in Echtzeit — sie sollen auch dann weiterlaufen, wenn die
  // Welt gerade durch Hit-Stop oder Zeitlupe still steht.
  updateJuice(realDt);
  updateSparks(realDt / NOMINAL_FRAME_MS);

  const slow = currentTimeScale();

  // Ist die Zeitlupe durchgelaufen, kommt jetzt der Auswahlbildschirm.
  if (rampDownStart && performance.now() - rampDownStart >= RAMP_DOWN_MS) {
    rampDownStart = 0;
    render();
    processQueues();
    return;
  }

  const dtMs = realDt * slow;
  const ts = dtMs / NOMINAL_FRAME_MS;

  advanceClock(dtMs);
  state.elapsedTime += dtMs / 1000;

  step(ts, dtMs);
  render();
  updateHud();
}

/**
 * Fasst alle Zeitdehnungen zusammen: Hit-Stop, Zeitlupe vor der Auswahl und
 * die Anlauframpe danach.
 */
function currentTimeScale() {
  if (isStopped()) return 0;

  if (rampDownStart) {
    if (!settings.slowMotion) return 1;
    const t = Math.min(1, (performance.now() - rampDownStart) / RAMP_DOWN_MS);
    // Kubisch: zunächst kaum langsamer, dann deutlich — liest sich als
    // Ausrollen, nicht als Bremsen.
    return Math.max(RAMP_FLOOR, 1 - t * t * t * (1 - RAMP_FLOOR));
  }

  if (state.resumeRampStart > 0) {
    const since = clock.now - state.resumeRampStart;
    if (since < 900) return Math.max(0.15, since / 900);
    state.resumeRampStart = 0;
  }

  return 1;
}

function step(ts, dtMs) {
  const player = world.player;
  if (!player) return;

  // Abschussfolge verfällt, wenn eine Weile nichts getroffen wurde.
  if (state.combo > 1 && state.elapsedTime - state.lastKillAt > 2) {
    state.combo = Math.max(1, state.combo - 0.5 * (dtMs / 1000));
  }

  updateDirector(ts);
  enemyGrid.rebuild(world.enemies);

  player.update(ts, dtMs);
  updateLoadout(player, dtMs, ts);
  resolveDash(player);

  updateBullets(ts, player);
  updateEnemyBullets(ts, player);

  // Kontakte können beim Sterben neue erzeugen (Schwarm). Die Länge wird
  // vorher festgehalten, damit Nachzügler erst im nächsten Frame laufen.
  const enemyCount = world.enemies.length;
  for (let i = 0; i < enemyCount; i++) {
    const e = world.enemies[i];
    if (!e.dead) e.update(ts, dtMs);
  }
  compact(world.enemies, (e) => !e.dead);

  for (const orb of world.orbs) {
    if (orb.dead) continue;
    orb.update(ts, player);
    if (orb.dead) {
      spawnXpSpark(orb.x, orb.y);
      sfxOrb();
      player.gainXp(orb.worth, queueLevelUp);
      if (player.collectOrb()) schleppnetzNova(player);
    }
  }
  compact(world.orbs, (o) => !o.dead);

  updateZones(ts);
  updateFx(ts);
  if (world.jammed > 0) world.jammed -= ts;
  if (updateSweep(dtMs)) sfxSweepPing();

  if (player.hp / player.maxHp < 0.3) sfxHullAlarm();

  if (player.hp <= 0) {
    spawnParticles(player.x, player.y, 24, PALETTE.alarm, 2);
    ring(player.x, player.y, 10, 320, PALETTE.alarm, 900, 5);
    flash(PALETTE.alarm, 0.5, 500);
    shake(20);
    endRun();
    return;
  }

  // Auswahl steht an: Welt ausrollen lassen, statt hart anzuhalten.
  if (!rampDownStart && (pendingLevelUps > 0 || shouldOfferPact())) {
    // Ohne Zeitlupe rutscht die Marke so weit in die Vergangenheit, dass die
    // Schleife im nächsten Bild sofort auf den Auswahlbildschirm schaltet.
    rampDownStart = settings.slowMotion ? performance.now() : performance.now() - RAMP_DOWN_MS;
    if (pendingLevelUps > 0) celebrateLevelUp();
  }
}

/**
 * Die Tonerzeugung darf erst nach einer Nutzergeste starten.
 *
 * Bewusst an DREI Wegen aufgehängt: `pointerdown` deckt Touch und Maus ab,
 * `keydown` die Tastatur, und der Startknopf ist der garantierte Rückfall.
 * Hing das vorher nur an `pointerdown`, bekam niemand Ton, der das Spiel
 * ausschließlich über die Tastatur bedient.
 */
function unlockAudio() {
  if (!settings.sound) return;
  initAudio();
  setEnabled(true);
}

document.addEventListener('pointerdown', unlockAudio, { once: true });
document.addEventListener('keydown', unlockAudio, { once: true });

boot();
