// Donkey Kong — move data from the decomp (src/chars/data/dk.js); model in models_dk.js; specials and the
// cargo carry in specials_dk.js. Animations are DK-specific (hunched gorilla, knuckle walk, long arms).
import { dk as model, DK_PROPS } from './models_dk.js';
import { makeChar } from './build.js';
import { sampleKeys } from '../render/rig.js';
import { P } from '../render/anims.js';
import { giantPunchStart, giantPunchLoop, giantPunch, giantPunchHitReset, spinningKong, handSlap, cargoLift, cargoHold, cargoThrow } from './specials_dk.js';
import data from './data/dk.js';

const PI = Math.PI;
const keyed = keys => { const k = keys.map(([f, pose]) => ({ f, pose })); return (f, mf) => sampleKeys(k, mf); };

export const DK_PALETTES = [
  { fur: 0x7a4a24, skin: 0xe8b888, icon: 0x7a4a24 },
  { fur: 0x3c3a3a, skin: 0xdcb48c, icon: 0x3c3a3a },
  { fur: 0xc81c18, skin: 0xf2c8a0, icon: 0xc81c18, team: 'red' },
  { fur: 0x1a2aa8, skin: 0xe8b888, icon: 0x1a2aa8, team: 'blue' },
  { fur: 0x1e8a2a, skin: 0xbfe8a8, icon: 0x1e8a2a, team: 'green' },
];

// ---- base poses (the hunch is in the meshes; poses add bowed legs and hanging arms) ----
const IDLE = { root: [0, -0.03, 0], spine: [0.12, 0, 0], neck: [-0.1, 0, 0],
  upperArmL: [-0.15, 0, 0.18], upperArmR: [-0.15, 0, -0.18], foreArmL: [-0.35, 0, 0], foreArmR: [-0.35, 0, 0], handL: [0.3, 0, 0], handR: [0.3, 0, 0],
  thighL: [-0.4, 0, 0.18], thighR: [-0.4, 0, -0.18], shinL: [0.6, 0, 0], shinR: [0.6, 0, 0], footL: [-0.2, 0, 0], footR: [-0.2, 0, 0] };
const CROUCH = { ...P.crouch, root: [0, -0.1, 0], upperArmL: [-0.7, 0, 0.3], upperArmR: [-0.7, 0, -0.3], foreArmL: [-0.4, 0, 0], foreArmR: [-0.4, 0, 0] };
const add = (a, b) => { const o = { ...a }; for (const k in b) o[k] = a[k] ? [a[k][0] + b[k][0], a[k][1] + b[k][1], a[k][2] + b[k][2]] : b[k]; return o; };

function idle(f, t) {
  if (typeof f === 'number') t = f * 70;          // the view may call custom.idle(phase) for entry/respawn
  const s = Math.sin(((t ?? 0) % 70) / 70 * 2 * PI);
  return add(IDLE, { root: [0, s * 0.008, 0], upperArmL: [s * 0.04, 0, 0], upperArmR: [s * 0.04, 0, 0], spine: [s * 0.02, 0, 0] });
}
// knuckle walk: arms and legs alternate, body rolls
function walk(f) {
  const t = (f.walkPhase ?? 0) % 1, s = Math.sin(t * 2 * PI), c = Math.cos(t * 2 * PI);
  return { ...IDLE, root: [0, -0.03 + Math.abs(c) * 0.015, 0], spine: [0.25, s * 0.15, s * 0.05],
    thighL: [-0.4 - 0.45 * s, 0, 0.18], thighR: [-0.4 + 0.45 * s, 0, -0.18], shinL: [0.6 + 0.4 * Math.max(0, c), 0, 0], shinR: [0.6 + 0.4 * Math.max(0, -c), 0, 0],
    upperArmL: [-0.35 + 0.55 * s, 0, 0.15], upperArmR: [-0.35 - 0.55 * s, 0, -0.15], foreArmL: [-0.2, 0, 0], foreArmR: [-0.2, 0, 0] };
}
// gallop: front arms reach together, legs push together
function run(f, t) {
  const ph = ((f.walkPhase ?? t / 20) % 1), s = Math.sin(ph * 2 * PI), c = Math.cos(ph * 2 * PI);
  return { root: [0, -0.06 + Math.max(0, c) * 0.06, 0], spine: [0.6 + 0.1 * s, 0, 0], neck: [-0.55, 0, 0], head: [-0.2, 0, 0],
    upperArmL: [-0.9 + 0.8 * s, 0, 0.15], upperArmR: [-0.75 + 0.8 * s, 0, -0.15], foreArmL: [-0.2, 0, 0], foreArmR: [-0.2, 0, 0],
    thighL: [-0.6 - 0.8 * s, 0, 0.15], thighR: [-0.5 - 0.8 * s, 0, -0.15], shinL: [0.8 + 0.5 * Math.max(0, -c), 0, 0], shinR: [0.8 + 0.5 * Math.max(0, -c), 0, 0] };
}

// ---- move animations ----
const arch = (wind, strike, follow) => ({ wind: add(IDLE, wind), strike: add(IDLE, strike), follow: follow && add(IDLE, follow) });
const jabL = arch({ upperArmL: [-0.2, 0, 0.5], foreArmL: [-1.3, 0, 0], spine: [0, 0.35, 0] },
  { upperArmL: [-1.3, 0, -0.35], foreArmL: [0.2, 0, 0], spine: [0.15, -0.45, 0], thighL: [-0.2, 0, 0] });
const jabR = arch({ upperArmR: [-0.2, 0, -0.5], foreArmR: [-1.3, 0, 0], spine: [0, -0.35, 0] },
  { upperArmR: [-1.35, 0, 0.3], foreArmR: [0.25, 0, 0], spine: [0.15, 0.45, 0], thighR: [-0.2, 0, 0] });
const ftiltV = up => arch({ spine: [0.05, -0.35, 0], upperArmR: [-1.0, 0, 0.7], foreArmR: [-1.2, 0, 0] },
  { spine: [0.15, 0.5, 0], upperArmR: [-1.3 - up, 0, 0.05], foreArmR: [0.3, 0, 0], handR: [-0.3, 0, 0], thighL: [-0.3, 0, 0], shinL: [0.2, 0, 0] });
const utiltL = arch({ upperArmL: [0.6, 0, 0.35], foreArmL: [-0.6, 0, 0], spine: [0.1, 0, 0] },
  { upperArmL: [-2.6, 0, 0.1], foreArmL: [-0.4, 0, 0], spine: [-0.35, 0, 0], neck: [-0.2, 0, 0] },
  { upperArmL: [-3.4, 0, 0.1], foreArmL: [-0.2, 0, 0], spine: [-0.45, 0, 0] });
const dtiltR = { wind: add(CROUCH, { upperArmR: [-0.6, 0, -0.1], foreArmR: [-1.0, 0, 0] }), strike: add(CROUCH, { upperArmR: [-1.2, 0, 0.25], foreArmR: [0.4, 0, 0], spine: [0.2, 0, 0] }) };
const dash = arch({ spine: [0.4, 0, 0], thighL: [-0.4, 0, 0], shinL: [1.0, 0, 0] },
  { spine: [-0.65, 0, 0], neck: [0.3, 0, 0], thighL: [-1.2, 0, -0.18], thighR: [-1.2, 0, 0.18], shinL: [-0.5, 0, 0], shinR: [-0.5, 0, 0], footL: [0.6, 0, 0], footR: [0.6, 0, 0], upperArmL: [0.4, 0, 0.6], upperArmR: [0.4, 0, -0.6], root: [0, 0.06, 0] });
// forward smash: arms spread wide, then a two-handed clap in front
const fsmashV = up => arch({ spine: [-0.25, 0, 0], upperArmL: [-1.0 - up, 0, 1.25], upperArmR: [-1.0 - up, 0, -1.25], foreArmL: [-0.3, 0, 0], foreArmR: [-0.3, 0, 0], thighL: [-0.1, 0, 0] },
  { spine: [0.35, 0, 0], upperArmL: [-1.35 - up, 0, -0.18], upperArmR: [-1.35 - up, 0, 0.18], foreArmL: [0, 0, 0], foreArmR: [0, 0, 0], thighL: [-0.4, 0, 0], shinL: [0.3, 0, 0], root: [0, 0, 0.03] });
// up smash: overhead clap
const usmashA = arch({ root: [0, -0.04, 0], spine: [0.2, 0, 0], upperArmL: [-0.4, 0, 1.4], upperArmR: [-0.4, 0, -1.4], foreArmL: [-0.2, 0, 0], foreArmR: [-0.2, 0, 0] },
  { root: [0, 0.03, 0], spine: [-0.3, 0, 0], neck: [-0.2, 0, 0], upperArmL: [-2.75, 0, -0.25], upperArmR: [-2.75, 0, 0.25], foreArmL: [0.1, 0, 0], foreArmR: [0.1, 0, 0] });
// down smash: fists slammed out low on both sides (front and back)
const dsmashA = { wind: add(CROUCH, { upperArmL: [-2.6, 0, 0.4], upperArmR: [-2.6, 0, -0.4], foreArmL: [-0.4, 0, 0], foreArmR: [-0.4, 0, 0], spine: [-0.1, 0, 0] }),
  strike: add(CROUCH, { spine: [-0.4, 0, 0], upperArmL: [-0.65, 0, 0.1], upperArmR: [1.95, 0, -0.1], foreArmL: [0.35, 0, 0], foreArmR: [0.35, 0, 0], body: [0, 0.25, 0] }) };
const nairKeys = (() => {
  const T = { upperArmL: [0, 0, 1.45], upperArmR: [0, 0, -1.45], foreArmL: [0, 0, 0], foreArmR: [0, 0, 0], thighL: [-0.6, 0, 0.2], thighR: [-0.6, 0, -0.2], shinL: [0.9, 0, 0], shinR: [0.9, 0, 0] };
  return [[0, P.fall], [4, { ...T, body: [0, 0, 0] }], [29, { ...T, body: [0, 4 * PI, 0] }], [42, { ...P.fall, body: [0, 4 * PI, 0] }], [59, { ...P.fall, body: [0, 4 * PI, 0] }]];
})();
const fairA = { wind: { ...P.fall, spine: [-0.5, 0, 0], upperArmL: [-3.0, 0, -0.2], upperArmR: [-3.0, 0, 0.2], foreArmL: [-0.4, 0, 0], foreArmR: [-0.4, 0, 0] },
  strike: { ...P.fall, spine: [0.75, 0, 0], upperArmL: [-0.9, 0, -0.15], upperArmR: [-0.9, 0, 0.15], foreArmL: [0, 0, 0], foreArmR: [0, 0, 0] },
  follow: { ...P.fall, spine: [0.6, 0, 0], upperArmL: [-0.3, 0, 0], upperArmR: [-0.3, 0, 0] } };
const uairA = { wind: { ...P.fall, upperArmL: [0.5, 0, 0.4], spine: [0.3, 0, 0] },
  strike: { ...P.fall, upperArmL: [-2.7, 0, 0.1], foreArmL: [-0.2, 0, 0], spine: [-0.4, 0, 0], neck: [-0.4, 0, 0] },
  follow: { ...P.fall, upperArmL: [-3.5, 0, 0.1], spine: [-0.3, 0, 0] } };
const dairA = { wind: { ...P.fall, thighL: [-1.4, 0, 0.2], thighR: [-1.4, 0, -0.2], shinL: [2.0, 0, 0], shinR: [2.0, 0, 0], upperArmL: [-0.5, 0, 1.2], upperArmR: [-0.5, 0, -1.2] },
  strike: { ...P.fall, thighL: [0.15, 0, 0.15], thighR: [0.15, 0, -0.15], shinL: [0.1, 0, 0], shinR: [0.1, 0, 0], footL: [0.6, 0, 0], footR: [0.6, 0, 0], spine: [-0.2, 0, 0], upperArmL: [0, 0, 1.4], upperArmR: [0, 0, -1.4] } };
const grabA = arch({ upperArmL: [-0.5, 0, 0.5], upperArmR: [-0.5, 0, -0.5] },
  { upperArmL: [-1.45, 0, -0.12], upperArmR: [-1.45, 0, 0.12], foreArmL: [0.35, 0, 0], foreArmR: [0.35, 0, 0], spine: [0.15, 0, 0] });
// back throw: swing the victim round behind; facing flips on the release frame (9)
const throwB = keyed([[0, IDLE], [4, add(IDLE, { upperArmL: [-1.3, 0, 0.2], upperArmR: [-1.3, 0, -0.2], body: [0, PI * 0.4, 0] })],
  [8, add(IDLE, { body: [0, PI, 0], upperArmL: [-1.6, 0, 0.3], upperArmR: [-1.6, 0, -0.3], spine: [0.2, 0, 0] })],
  [9, add(IDLE, { upperArmL: [-1.6, 0, 0.3], upperArmR: [-1.6, 0, -0.3], spine: [0.3, 0, 0] })], [21, IDLE]]);
// carrying the victim on his shoulders: arms up behind the head, walk cycle when moving
const CARRY = { upperArmL: [-2.7, 0, 0.35], upperArmR: [-2.7, 0, -0.35], foreArmL: [-1.0, 0, 0], foreArmR: [-1.0, 0, 0], spine: [-0.05, 0, 0], neck: [0.15, 0, 0] };
const carry = (f) => {
  const base = f.grounded && Math.abs(f.vx) > 1 ? walk(f) : f.grounded ? IDLE : P.fall;
  return { ...base, ...CARRY };
};
const liftKeys = [[0, add(IDLE, { upperArmL: [-1.3, 0, 0.2], upperArmR: [-1.3, 0, -0.2] })], [12, { ...IDLE, ...CARRY }], [19, { ...IDLE, ...CARRY }]];
const cargoThrowKeys = [[0, { ...IDLE, ...CARRY }], [14, { ...IDLE, ...CARRY, spine: [-0.3, 0, 0] }],
  [18, add(IDLE, { upperArmL: [-1.6, 0, 0.1], upperArmR: [-1.6, 0, -0.1], spine: [0.35, 0, 0] })], [39, IDLE]];
const tauntKeys = (() => {
  const L = add(IDLE, { upperArmL: [-0.9, 0, 0.3], foreArmL: [-1.6, 0, 0], upperArmR: [-0.6, 0, -0.5], foreArmR: [-1.0, 0, 0], neck: [-0.4, 0, 0], spine: [-0.25, 0, 0] });
  const R = add(IDLE, { upperArmR: [-0.9, 0, -0.3], foreArmR: [-1.6, 0, 0], upperArmL: [-0.6, 0, 0.5], foreArmL: [-1.0, 0, 0], neck: [-0.4, 0, 0], spine: [-0.25, 0, 0] });
  const k = [[0, IDLE]];
  for (let i = 0; i < 8; i++) k.push([8 + i * 5, i % 2 ? R : L]);
  k.push([50, add(IDLE, { neck: [-0.3, 0, 0] })], [60, IDLE]);
  return k;
})();
// Giant Punch: wind-up pulls the right arm back; charging windmills it; the punch lunges forward
const gpWind = add(IDLE, { spine: [-0.05, 0.6, 0], upperArmR: [0.9, 0, -0.5], foreArmR: [-0.8, 0, 0], thighL: [-0.3, 0, 0] });
const gpStart = keyed([[0, IDLE], [7, gpWind]]);
const gpLoop = (f) => {
  const ph = ((f.vars.lf ?? 0) / 12) * 2 * PI * (f.special.dkCharge >= 9 ? 2 : 1);
  return add(gpWind, { upperArmR: [-0.9 * Math.sin(ph) - 0.3, 0, -0.35 * Math.cos(ph)], root: [0, 0.008 * Math.sin(ph * 2), 0] });
};
const gpPunch = keyed([[0, gpWind], [6, add(IDLE, { spine: [-0.1, 0.8, 0], upperArmR: [1.1, 0, -0.4], foreArmR: [-1.2, 0, 0], thighL: [-0.4, 0, 0] })],
  [10, add(IDLE, { spine: [0.4, -0.45, 0], upperArmR: [-1.45, 0, 0.05], foreArmR: [0, 0, 0], handR: [0.2, 0, 0], thighL: [-0.9, 0, 0], shinL: [0.7, 0, 0], thighR: [0.4, 0, 0], root: [0, -0.02, 0.05] })],
  [20, add(IDLE, { spine: [0.4, -0.45, 0], upperArmR: [-1.45, 0, 0.05], foreArmR: [0, 0, 0], thighL: [-0.9, 0, 0], shinL: [0.7, 0, 0], thighR: [0.4, 0, 0], root: [0, -0.02, 0.05] })],
  [60, IDLE]]);
// Spinning Kong: arms straight out, whirling
const spinK = (f, mf) => add(IDLE, { upperArmL: [0.15, 0, 1.3], upperArmR: [0.15, 0, -1.3], foreArmL: [0.35, 0, 0], foreArmR: [0.35, 0, 0], body: [0, mf * 0.75, 0], spine: [-0.1, 0, 0] });
// Hand Slap: two-handed ground slaps in front
const slapUp = add(IDLE, { spine: [-0.2, 0, 0], upperArmL: [-2.7, 0, 0.3], upperArmR: [-2.7, 0, -0.3], foreArmL: [-0.4, 0, 0], foreArmR: [-0.4, 0, 0] });
const slapDn = add(IDLE, { spine: [0.45, 0, 0], neck: [-0.3, 0, 0], upperArmL: [-0.55, 0, 0.25], upperArmR: [-0.55, 0, -0.25], foreArmL: [0, 0, 0], foreArmR: [0, 0, 0], root: [0, -0.03, 0] });
const slapKeys = [[0, IDLE], [3, add(IDLE, { spine: [0.2, 0, 0] })], [12, slapUp], [19, slapDn], [24, slapUp], [29, slapDn], [37, slapUp], [41, IDLE]];

export const dk = makeChar({
  id: 'dk', name: 'Donkey Kong', series: 'dk', data, model, props: DK_PROPS,
  palettes: DK_PALETTES, short: 'DK',
  boneMap: { item: 'handR' },
  anims: { idle, walk, run, dash: run },
  moves: {
    jab1: { anim: jabL }, jab2: { anim: jabR },
    ftiltHi: { anim: ftiltV(0.35) }, ftilt: { anim: ftiltV(0) }, ftiltLo: { anim: ftiltV(-0.35) },
    utilt: { anim: utiltL },
    dtilt: { anim: dtiltR },
    dashattack: { anim: dash },
    fsmashHi: { anim: fsmashV(0.4) }, fsmashMidHi: { anim: fsmashV(0.2) }, fsmash: { anim: fsmashV(0) }, fsmashMidLo: { anim: fsmashV(-0.2) }, fsmashLo: { anim: fsmashV(-0.4) },
    usmash: { anim: usmashA },
    // the decomp labels these joints shin/foot; the move is a two-fisted slam on both sides, so follow the forearms
    dsmash: { anim: dsmashA, hitboxPatch: h => ({ bone: h.bone === 'shinL' ? 'foreArmL' : 'foreArmR' }) },
    nair: { anim: keyed(nairKeys) }, fair: { anim: fairA }, bair: { anim: 'bair' }, uair: { anim: uairA }, dair: { anim: dairA },
    grab: { anim: grabA },
    fthrow: { ...cargoLift(), anim: keyed(liftKeys) },
    bthrow: { anim: throwB },
    taunt: { anim: keyed(tauntKeys) },
    nspecial: giantPunchStart(gpStart),
    nspecialLoop: giantPunchLoop(gpLoop),
    nspecialPunch: giantPunch(gpPunch, false),
    nspecialFull: giantPunch(gpPunch, true),
    uspecial: spinningKong(spinK, false),
    uspecialAir: spinningKong(spinK, true),
    dspecial: { ...handSlap(keyed(slapKeys)) },
    dspecialAir: { total: 1, hitboxes: [], anim: (f, mf, P) => P.fall },
    cargoHold: cargoHold(carry),
    cargoThrow: cargoThrow(keyed(cargoThrowKeys)),
  },
  extraMoves: {
    nspecialPunch: data.moves.nspecial,
    dspecialAir: { total: 1, hitboxes: [] },
    cargoHold: { total: 99999, hitboxes: [] },
  },
  init(f) {
    const th = f.takeHit;
    f.takeHit = function (hit) { giantPunchHitReset(this); return th.call(this, hit); };
    const up = f.update;
    f.update = function () {
      up.call(this);
      if ((this.special.dkCharge ?? 0) >= 10 && this.match.frame % 45 < 4 && this.flash <= 0) this.flash = 3;   // stored full charge glints
    };
  },
});
