/**
 * Kopplungen.
 *
 * Seltene Karten, die eine Marke in eine andere umleiten. Sie sind der
 * eigentliche Emergenzerzeuger: Aus zwei unabhängigen Zweigen entsteht ein
 * dritter, den niemand einzeln entworfen hat.
 *
 * Aufbau einer Kopplung:
 *   listens  — auf welche Marken sie anspringt
 *   boost    — optionaler Schadensfaktor VOR der Anwendung
 *   after    — optionale Nebenwirkung NACH der Anwendung
 *
 * Der Kontext (`ctx`) enthält { enemy, amount, tags, player, api }.
 * `api` bündelt die Wirkungen, die eine Kopplung auslösen darf — dadurch
 * bleibt diese Datei frei von Importen aus der Kampflogik und es entstehen
 * keine Zirkelbezüge.
 */

import { TAG } from './tags.js';

export const COUPLINGS = [
  {
    id: 'eisbruch',
    name: 'Eisbruch',
    hint: 'Druckwellen zersplittern gefrorene Kontakte',
    listens: [TAG.DRUCKWELLE],
    boost: (ctx) => (ctx.enemy.frozen ? 2.0 : 1),
  },
  {
    id: 'schmauchspur',
    name: 'Schmauchspur',
    hint: 'Jede Druckwelle hinterlässt eine Zersetzungswolke',
    listens: [TAG.DRUCKWELLE],
    cooldownMs: 400,
    after: (ctx) => ctx.api.corrosionCloud(ctx.enemy.x, ctx.enemy.y, ctx.amount * 0.35),
  },
  {
    id: 'kielwasserdruck',
    name: 'Kielwasserdruck',
    hint: 'Jede Durchfahrt löst eine Druckwelle aus',
    listens: [TAG.MANOEVER],
    cooldownMs: 260,
    after: (ctx) => ctx.api.blast(ctx.enemy.x, ctx.enemy.y, ctx.amount * 0.6, 70, false, 'Kielwasserdruck'),
  },
  {
    id: 'frostbruch',
    name: 'Frostbruch',
    hint: 'Kälte auf bereits gefrorene Ziele wirkt dreifach',
    listens: [TAG.KAELTE],
    boost: (ctx) => (ctx.enemy.frozen ? 3.0 : 1),
  },
  {
    id: 'untiefe',
    name: 'Untiefe',
    hint: 'Zonen verlangsamen zusätzlich',
    listens: [TAG.ZONE],
    after: (ctx) => ctx.api.freeze(ctx.enemy, 45),
  },
  {
    id: 'kettenschlag',
    name: 'Kettenschlag',
    hint: 'Große Druckwellen lösen eine zweite aus',
    listens: [TAG.DRUCKWELLE],
    cooldownMs: 900,
    after: (ctx) => {
      if (ctx.api.countNear(ctx.enemy.x, ctx.enemy.y, 70) >= 3) {
        ctx.api.blast(ctx.enemy.x, ctx.enemy.y, ctx.amount * 0.5, 95, true, 'Kettenschlag');
      }
    },
  },
  {
    id: 'ueberschlag',
    name: 'Überschlag',
    hint: 'Impulstreffer springen auf ein nahes Ziel über',
    listens: [TAG.IMPULS],
    cooldownMs: 90,
    after: (ctx) => ctx.api.arc(ctx.enemy, ctx.amount * 0.45, 120),
  },
  {
    id: 'steuerbordfeuer',
    name: 'Steuerbordfeuer',
    hint: 'Nahbereichstreffer verkürzen die Feuerpause',
    listens: [TAG.NAHBEREICH],
    cooldownMs: 250,
    after: (ctx) => ctx.api.hasten(0.35, 1400),
  },
  {
    id: 'rueckkopplung',
    name: 'Rückkopplung',
    hint: 'Fernbereichstreffer laden das Notmanöver auf',
    listens: [TAG.FERNBEREICH],
    cooldownMs: 400,
    after: (ctx) => ctx.player.refundDash(0.12),
  },
  {
    id: 'beizbeute',
    name: 'Beizbeute',
    hint: 'An Zersetzung gestorbene Kontakte geben doppelte Signale',
    listens: [TAG.ZERSETZUNG],
    after: (ctx) => {
      if (ctx.enemy.dead) ctx.api.bonusOrb(ctx.enemy.x, ctx.enemy.y, ctx.enemy.xpValue);
    },
  },
  {
    id: 'prisenkommando',
    name: 'Prisenkommando',
    hint: 'Bergung heilt auch das Geleit und stärkt es',
    listens: [TAG.BERGUNG],
    after: (ctx) => ctx.api.mendEscorts(),
  },
  {
    id: 'peilkopplung',
    name: 'Peilkopplung',
    hint: 'Jedes 10. Signal feuert eine Gratissalve',
    listens: [TAG.SIGNAL],
    after: (ctx) => ctx.api.freeVolley(),
  },
];

export function couplingById(id) {
  return COUPLINGS.find((c) => c.id === id);
}
