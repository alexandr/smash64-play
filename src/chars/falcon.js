// Captain Falcon — move data from the decomp (src/chars/data/falcon.js); model in models_falcon.js,
// specials in specials_falcon.js.
import { falcon as model, FALCON_PROPS, FALCON_PALETTES } from './models_falcon.js';
import { makeChar } from './build.js';
import { adaptData, hbs, falconPunch, falconDive, diveCatch, diveThrow, falconKick, falconFx } from './specials_falcon.js';
import { P, ATK, keyed, mix, rotAbout, mirrorPose, spinAnim } from '../render/anims.js';
import raw from './data/falcon.js';

const PI = Math.PI;
const S = 80;
// decomp model height ~675 units -> offsets scaled to our 400-unit model; joint sides are swapped in the
// research labels except the Falcon Punch fist (j16 = right hand) and the foot j28 (right foot).
const data = adaptData(raw, { scale: 1, swapSides: true, keep: (id, h) => h.bone === 'handR' && id === 'nspecial' || h.bone === 'footR' });
const M = data.moves;

// ---------------- move animations ----------------
// jab 3: knee (right)
// rapid jab: right fist hammering out every 8 frames (hits at 10,18,26,34,41), left fist out of phase
const rapid = (f, mf) => {
  const k = 0.5 + 0.5 * Math.cos(2 * PI * (mf - 10) / 8), j = 1 - k;
  const base = mix(P.idle, { spine: [0.2, 0, 0], chest: [0, 0.25 * k - 0.1, 0], thighL: [-0.55, 0, 0.15], shinL: [0.7, 0, 0], thighR: [0.35, 0, -0.12], shinR: [0.3, 0, 0], root: [0, -0.03, 0] });
  if (mf < 6) return sampleRest(base, mf / 6);
  return mix(base, { upperArmR: [-1.55 + 0.5 * j, 0, 0.1], foreArmR: [-1.6 * j, 0, 0], upperArmL: [-1.55 + 0.5 * k, 0, -0.1], foreArmL: [-1.6 * k, 0, 0] });
};
function sampleRest(p, k) { return mix(P.idle, Object.fromEntries(Object.entries(p).map(([b, v]) => { const r = P.idle[b] ?? [0, 0, 0]; return [b, v.map((x, i) => r[i] + (x - r[i]) * k)]; }))); }
const rapidEnd = keyed([[0, mix(P.idle, { upperArmR: [-1.55, 0, 0.1], foreArmR: [0, 0, 0], spine: [0.2, 0, 0] })], [9, P.idle]]);
// forward tilt: straight kick with the left leg, five angles
const ftiltV = up => ({ wind: mirrorPose(ATK.ftilt.wind), strike: mirrorPose(mix(ATK.ftilt.strike, { thighR: [-1.5 - up, 0, -0.05], spine: [-0.35 - up * 0.25, 0, 0] })) });
// up tilt: axe kick (right leg up over the head, then down in front)
const utiltK = keyed([[0, P.idle], [6, mix(P.idle, { thighR: [-0.8, 0, 0], shinR: [1.6, 0, 0], spine: [0.15, 0, 0] })],
  [9, mix(P.idle, { thighR: [-2.3, 0, -0.1], shinR: [0.1, 0, 0], footR: [0.4, 0, 0], spine: [-0.35, 0, 0], thighL: [0.1, 0, 0.1], shinL: [0.25, 0, 0], upperArmL: [0.2, 0, 0.8], upperArmR: [0.3, 0, -0.8] })],
  [15, mix(P.idle, { thighR: [-3.0, 0, -0.1], shinR: [0.05, 0, 0], footR: [0.4, 0, 0], spine: [-0.5, 0, 0], thighL: [0.15, 0, 0.1], shinL: [0.2, 0, 0], upperArmL: [0.3, 0, 0.9], upperArmR: [0.4, 0, -0.9] })],
  [19, mix(P.idle, { thighR: [-2.3, 0, -0.1], shinR: [0.05, 0, 0], footR: [0.4, 0, 0], spine: [0.0, 0, 0], thighL: [0.1, 0, 0.1], shinL: [0.25, 0, 0], upperArmL: [0.2, 0, 0.8], upperArmR: [0.2, 0, -0.8] })],
  [23, mix(P.idle, { thighR: [-1.3, 0, -0.1], shinR: [0.1, 0, 0], footR: [0.3, 0, 0], spine: [0.35, 0, 0], thighL: [0.0, 0, 0.1], shinL: [0.4, 0, 0], root: [0, -0.02, 0] })],
  [39, P.idle]]);
// dash attack: right-shoulder tackle
const tackle = mix(P.idle, { spine: [0.45, 0, 0], chest: [0, 0.7, 0], neck: [-0.4, -0.4, 0], upperArmR: [-0.35, 0, 0.45], foreArmR: [-1.6, 0, 0], upperArmL: [0.6, 0, 0.5], foreArmL: [-1.2, 0, 0],
  thighL: [-1.0, 0, 0.12], shinL: [1.1, 0, 0], thighR: [0.6, 0, -0.12], shinR: [0.4, 0, 0], footR: [-0.4, 0, 0], root: [0, -0.07, 0.05] });
const dashK = keyed([[0, P.idle], [4, mix(P.idle, { spine: [0.3, 0, 0], chest: [0, -0.3, 0], root: [0, -0.04, 0] })], [6, tackle], [25, tackle], [40, P.idle]]);
// forward smash: Fire Kick (right leg, flames), three angles
const fireKick = up => ({
  wind: mix(P.idle, { body: [0, 0.35, 0], thighR: [-1.3, 0, -0.05], shinR: [2.2, 0, 0], spine: [0.05, 0, 0], upperArmL: [-0.8, 0, 0.4], upperArmR: [0.4, 0, -0.5], root: [0, -0.02, 0] }),
  strike: mix(P.idle, { body: [0, -0.45, 0], thighR: [-1.55 - up, 0, -0.05], shinR: [0.02, 0, 0], footR: [0.45, 0, 0], spine: [-0.45 - up * 0.2, 0, 0], neck: [0.3, 0, 0],
    thighL: [0.2, 0, 0.1], shinL: [0.25, 0, 0], upperArmL: [0.2, 0, 0.9], upperArmR: [-0.4, 0, -0.9], root: [0, -0.01, 0] }),
});
// down smash: low kick in front, spin, low kick behind
const lowKick = mix(P.crouch, { thighR: [-1.6, 0, -0.1], shinR: [0.08, 0, 0], footR: [0.4, 0, 0], thighL: [-1.5, 0, 0.25], shinL: [2.2, 0, 0], spine: [0.3, 0, 0], root: [0, -0.2, 0] });
const dsmashK = keyed([[0, P.idle], [6, mix(P.crouch, { thighR: [-1.0, 0, -0.2], shinR: [2.0, 0, 0] })], [8, lowKick], [12, lowKick],
  [16, mix(P.crouch, { body: [0, PI * 0.6, 0] })], [19, { ...lowKick, body: [0, PI, 0] }], [22, { ...lowKick, body: [0, PI, 0] }], [34, mix(P.crouch, { body: [0, PI * 1.6, 0] })], [49, mix(P.idle, { body: [0, 2 * PI, 0] })]]);
// forward air: rotary kick — right leg (7-12), spin, then left leg (21-28)
const kickR = { thighR: [-1.6, 0, -0.05], shinR: [0.05, 0, 0], footR: [0.4, 0, 0], thighL: [-0.9, 0, 0.1], shinL: [1.8, 0, 0], spine: [-0.25, 0, 0], upperArmL: [0.3, 0, 1.1], upperArmR: [0.3, 0, -1.1] };
const kickL = mirrorPose(kickR);
const fairK = keyed([[0, P.fall], [5, mix(P.fall, { thighR: [-1.3, 0, -0.1], shinR: [2.0, 0, 0], thighL: [-0.8, 0, 0.1], shinL: [1.7, 0, 0], body: [0, -0.4, 0] })],
  [7, mix(P.fall, kickR, { body: [0, 0.3, 0] })], [12, mix(P.fall, kickR, { body: [0, 0.5, 0] })],
  [17, mix(P.fall, { thighL: [-1.3, 0, 0.1], shinL: [2.1, 0, 0], thighR: [-0.8, 0, -0.1], shinR: [1.6, 0, 0], body: [0, 1.2, 0] })],
  [21, mix(P.fall, kickL, { body: [0, 2 * PI - 0.3, 0] })], [28, mix(P.fall, kickL, { body: [0, 2 * PI - 0.5, 0] })], [44, mix(P.fall, { body: [0, 2 * PI, 0] })]]);
// up air: overhead flip kick with the left leg (strong 5-7, mid 8-9, late 10-13)
const legUpL = { thighL: [-2.7, 0, 0.05], shinL: [0.05, 0, 0], footL: [0.4, 0, 0], thighR: [-0.6, 0, -0.1], shinR: [1.4, 0, 0], upperArmL: [0.5, 0, 1.3], upperArmR: [0.5, 0, -1.3] };
const tuck = { thighL: [-1.6, 0, 0], shinL: [1.9, 0, 0], thighR: [-1.6, 0, 0], shinR: [1.9, 0, 0], upperArmL: [0.2, 0, 1.2], upperArmR: [0.2, 0, -1.2] };
const uairK = spinAnim([[0, P.fall], [3, mix(P.fall, { thighL: [-1.2, 0, 0.1], shinL: [1.9, 0, 0] })], [5, mix(P.fall, legUpL)], [13, mix(P.fall, legUpL, { thighL: [-2.2, 0, 0.05] })], [22, mix(P.fall, tuck)], [33, P.fall]],
  [[0, 0], [3, 0.3], [5, -0.4], [9, -1.4], [13, -2.6], [22, -4.6], [30, -2 * PI], [33, -2 * PI]], 'x', 0.5);
// Falcon Punch: long coil, fist pulled back, explosive straight right
const coil = mix(P.idle, { body: [0, 0.2, 0], chest: [-0.1, -1.0, 0], spine: [0.05, -0.3, 0], neck: [0, 0.9, 0], upperArmR: [1.0, 0, -0.55], foreArmR: [-1.9, 0, 0], handR: [0.3, 0, 0],
  upperArmL: [-1.3, 0, 0.35], foreArmL: [-0.4, 0, 0], thighL: [-0.75, 0, 0.18], shinL: [0.9, 0, 0], thighR: [0.45, 0, -0.18], shinR: [0.35, 0, 0], footR: [-0.3, 0, 0], root: [0, -0.07, -0.03] });
const punch = mix(P.idle, { body: [0, -0.15, 0], chest: [0, 0.6, 0], spine: [0.35, 0.2, 0], neck: [0, -0.5, 0], upperArmR: [-1.57, 0, 0.12], foreArmR: [0, 0, 0], handR: [0.2, 0, 0],
  upperArmL: [0.6, 0, 0.55], foreArmL: [-1.3, 0, 0], thighL: [-1.15, 0, 0.15], shinL: [1.25, 0, 0], thighR: [0.75, 0, -0.15], shinR: [0.25, 0, 0], footR: [-0.5, 0, 0], root: [0, -0.1, 0.07] });
const fpK = keyed([[0, P.idle], [8, mix(coil, { chest: [-0.1, -0.7, 0] })], [30, coil], [38, mix(coil, { chest: [-0.1, -1.2, 0], upperArmR: [1.2, 0, -0.6] })], [42, punch], [56, punch], [89, P.idle]]);
// Falcon Dive: crouch, leap with both hands reaching up/forward
const reach = mix(P.jump, { spine: [0.2, 0, 0], upperArmR: [-2.3, 0, 0.1], foreArmR: [-0.1, 0, 0], upperArmL: [-2.0, 0, 0.3], foreArmL: [-0.3, 0, 0], thighL: [-1.0, 0, 0.1], shinL: [1.6, 0, 0], thighR: [0.2, 0, 0], shinR: [0.5, 0, 0] });
const diveK = keyed([[0, P.idle], [6, P.jumpsquat], [13, reach], [34, mix(reach, { spine: [0.35, 0, 0], upperArmR: [-1.9, 0, 0.1], upperArmL: [-1.7, 0, 0.3] })], [52, P.helpless], [64, P.helpless]]);
const catchPose = mix(P.fall, { upperArmL: [-1.55, 0, 0.1], upperArmR: [-1.55, 0, -0.1], foreArmL: [-0.3, 0, 0], foreArmR: [-0.3, 0, 0], spine: [0.2, 0, 0] });
const diveThrowK = spinAnim([[0, catchPose], [3, mix(P.fall, tuck)], [24, mix(P.fall, tuck)], [34, P.fall], [60, P.fall]], [[0, 0], [3, -0.6], [22, -2 * PI], [60, -2 * PI]], 'x', 0.5);
// Falcon Kick: low slide with the left leg out (ground); diving down-forward in the air
const fkPose = mix(P.idle, { thighL: [-1.5, 0, 0.05], shinL: [0.05, 0, 0], footL: [0.45, 0, 0], thighR: [-0.3, 0, -0.1], shinR: [1.9, 0, 0], footR: [-0.4, 0, 0], spine: [-0.5, 0, 0], neck: [0.35, 0, 0],
  upperArmL: [0.6, 0, 0.7], upperArmR: [0.9, 0, -0.5], foreArmL: [-0.5, 0, 0], foreArmR: [-0.5, 0, 0], root: [0, -0.16, 0] });
const fkK = keyed([[0, P.idle], [8, mix(P.crouch, { thighL: [-1.4, 0, 0.1], shinL: [2.2, 0, 0] })], [12, fkPose], [31, fkPose], [50, mix(P.crouch, {})], [84, P.idle]]);
const fkAirPose = rotAbout(mix(P.fall, fkPose, { root: [0, 0, 0] }), 0.75, 0, 0, 0.5);
const fkAirK = keyed([[0, P.fall], [8, mix(P.fall, { thighL: [-1.4, 0, 0.1], shinL: [2.2, 0, 0], thighR: [-1.2, 0, -0.1], shinR: [2.0, 0, 0] })], [12, fkAirPose], [49, fkAirPose]]);
const fkLandK = keyed([[0, P.land], [30, P.land], [45, P.idle]]);
// taunt: turn to the camera, touch the helmet, then point ("Show me your moves!")
const tauntK = keyed([[0, P.idle], [10, mix(P.idle, { body: [0, -1.0, 0] })],
  [18, mix(P.idle, { body: [0, -1.0, 0], upperArmR: [-2.4, 0, -0.6], foreArmR: [-2.0, 0, 0], neck: [0.1, 0, 0] })], [32, mix(P.idle, { body: [0, -1.0, 0], upperArmR: [-2.4, 0, -0.6], foreArmR: [-2.0, 0, 0] })],
  [38, mix(P.idle, { body: [0, -0.8, 0], upperArmR: [-1.6, 0, 0.1], foreArmR: [0, 0, 0], chest: [0, 0.3, 0] })], [50, mix(P.idle, { body: [0, -0.8, 0], upperArmR: [-1.6, 0, 0.1], foreArmR: [0, 0, 0], chest: [0, 0.3, 0] })],
  [59, P.idle]]);

// jab 2 -> rapid jabs when A is mashed (2+ presses) or held through jab 2, otherwise the knee
const jab2Script = (f, mf, c) => {
  if (mf === 1) { f.vars.presses = 0; f.vars.held = c.held('A'); }
  if (c.pressed('A')) f.vars.presses++;
  if (!c.held('A')) f.vars.held = false;
  if (mf >= (f.move.nextAt ?? 10) && (f.vars.presses >= 2 || (f.vars.held && mf >= 10))) f.startMove(f.def.moves.jabRapid);
};
// rapid jab loop continues while A is held or was pressed within the last 10 frames
const rapidScript = (f, mf, c) => {
  if (c.pressed('A') || mf === 1) f.vars.lastA = f.match.frame;
  f.vars.loopHold = c.held('A') || f.match.frame - (f.vars.lastA ?? -99) <= 10;
};

const groundFP = hbs(M.nspecial.hitboxes.filter(h => h.label === 'ground'));
const airFP = hbs(M.nspecial.hitboxes.filter(h => h.label === 'air'));
const kickHB = M.dspecial.hitboxes.filter(h => !/^landing/.test(h.label ?? ''));
const landHB = M.dspecial.hitboxes.filter(h => /^landing/.test(h.label ?? '')).map(h => ({ ...h, frames: [1, 1] }));
const diveHB = hbs(M.uspecial.hitboxes, h => h.hid === 1 ? { ground: true, air: false } : { grabAir: true });

export const falcon = makeChar({
  id: 'falcon', name: 'Captain Falcon', series: 'fzero', data, model, props: FALCON_PROPS,
  palettes: FALCON_PALETTES,
  anims: { ledge: () => ({ ...P.ledgehang, root: [0, -0.27, -0.05] }) },
  extraMoves: {
    nspecialAir: { total: 89, hitboxes: M.nspecial.hitboxes.filter(h => h.label === 'air') },
    dspecialAir: { total: 49, hitboxes: kickHB },
    dspecialLand: { total: 45, hitboxes: landHB },
    diveCatch: { total: 20 }, diveThrow: { total: 60 }, jabRapidEnd: { total: 9 },
  },
  moves: {
    jab2: { script: jab2Script },
    jab3: { anim: 'knee' },
    jabRapid: { anim: rapid, loop: [7, 46], after: 'jabRapidEnd', script: rapidScript, next: undefined },
    jabRapidEnd: { anim: rapidEnd, noStale: true },
    ftiltHi: { anim: ftiltV(0.5) }, ftiltMidHi: { anim: ftiltV(0.25) }, ftilt: { anim: ftiltV(0) }, ftiltMidLo: { anim: ftiltV(-0.22) }, ftiltLo: { anim: ftiltV(-0.42) },
    utilt: { anim: utiltK },
    dashattack: { anim: dashK },
    fsmashHi: { anim: fireKick(0.4) }, fsmash: { anim: fireKick(0) }, fsmashLo: { anim: fireKick(-0.35) },
    usmash: { anim: 'elbowUp' },
    dsmash: { anim: dsmashK },
    fair: { anim: fairK },
    bair: { anim: 'backfistM' },
    uair: { anim: uairK },
    nspecial: { ...falconPunch(), anim: fpK, hitboxes: groundFP },
    nspecialAir: { ...falconPunch(), anim: fpK, hitboxes: airFP },
    uspecial: { ...falconDive(), anim: diveK, hitboxes: diveHB },
    diveCatch: { ...diveCatch(), anim: (f, mf) => catchPose },
    diveThrow: { ...diveThrow(), anim: diveThrowK },
    dspecial: { ...falconKick({}), anim: fkK, hitboxes: hbs(kickHB) },
    dspecialAir: { ...falconKick({ air: true }), anim: fkAirK },
    dspecialLand: { anim: fkLandK, noStale: true },
    taunt: { anim: tauntK },
  },
  init(f) {
    // Falcon Dive grab boxes catch -> CatchingEnemyWhileDiving (doGrab put us in 'grabbing'; take over)
    f.onGrab = v => { if (f.diveFrame === f.match.frame) f.startMove(f.def.moves.diveCatch, { vars: { victim: v } }); };
  },
  animExtra: (view, f) => falconFx(view, f),
});
