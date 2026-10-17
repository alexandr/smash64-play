// Yoshi — move data from the decomp (src/chars/data/yoshi.js); model, animations and specials here.
import * as THREE from 'three';
import { yoshiModel, YOSHI_PROPS, YOSHI_EXTRA_BONES, eggMesh } from './models_yoshi.js';
import { makeChar } from './build.js';
import { kf, spinAbout, lerpP } from './specials_samus.js';
import { eggLay, eggCatch, eggThrow, yoshiBomb, yoshiBombLand } from './specials_yoshi.js';
import { P, walkPose, runPose } from '../render/anims.js';
import data from './data/yoshi.js';

const PI = Math.PI;
// palettes: green (default, red shoes), red (purple shoes), light blue (purple), yellow (green), pink (yellow), blue (magenta)
export const YOSHI_PALETTES = [
  { body: 0x30c818, shoe: 0xe81010, icon: 0x30c818 },
  { body: 0xe02848, shoe: 0x8010e0, icon: 0xe02848 },
  { body: 0x18d0e8, shoe: 0x9010f0, icon: 0x18d0e8 },
  { body: 0xf0e010, shoe: 0x20d020, icon: 0xf0e010 },
  { body: 0xf088b0, shoe: 0xf8e020, icon: 0xf088b0 },
  { body: 0x2028c8, shoe: 0xd010d0, icon: 0x2028c8 },
];

// Yoshi's stance: leaning forward, knees bent, arms held in front, head up, tail slightly down
const LEAN = { spine: [0.28, 0, 0], chest: [0.08, 0, 0], neck: [-0.22, 0, 0], head: [-0.14, 0, 0], extra1: [0.12, 0, 0] };
const YI = { ...LEAN, upperArmL: [-0.75, 0, 0.25], upperArmR: [-0.75, 0, -0.25], foreArmL: [-0.9, 0, 0], foreArmR: [-0.9, 0, 0],
  thighL: [-0.5, 0, 0.06], thighR: [-0.35, 0, -0.06], shinL: [0.75, 0, 0], shinR: [0.65, 0, 0], footL: [-0.25, 0, 0], footR: [-0.3, 0, 0], root: [0, -0.04, 0] };
const lean = (p, k = 1) => { const o = { ...p }; for (const [b, r] of Object.entries(LEAN)) { const a = o[b] ?? [0, 0, 0]; o[b] = [a[0] + r[0] * k, a[1], a[2]]; } return o; };
const AIR = lean(P.fall);
const CR = { ...YI, root: [0, -0.14, 0], spine: [0.6, 0, 0], neck: [-0.4, 0, 0], thighL: [-1.3, 0, 0.12], thighR: [-1.3, 0, -0.12], shinL: [1.9, 0, 0], shinR: [1.9, 0, 0], footL: [-0.6, 0, 0], footR: [-0.6, 0, 0] };
const LUNGE = { ...YI, spine: [0.85, 0, 0], chest: [0.15, 0, 0], neck: [0.25, 0, 0], head: [0.2, 0, 0], thighL: [-1.0, 0, 0.06], shinL: [1.0, 0, 0], thighR: [0.2, 0, -0.06], shinR: [0.4, 0, 0], upperArmL: [0.3, 0, 0.4], upperArmR: [0.3, 0, -0.4] };

const ftiltA = (lift) => kf([[0, YI], [6, { ...YI, thighR: [-0.5, 0, 0], shinR: [1.6, 0, 0], spine: [0.0, 0, 0] }],
  [8, { ...YI, thighR: [-1.5 - lift, 0, 0], shinR: [0.05, 0, 0], footR: [0.3, 0, 0], spine: [-0.15, 0, 0], thighL: [-0.2, 0, 0.06], shinL: [0.5, 0, 0] }],
  [11, { ...YI, thighR: [-1.5 - lift, 0, 0], shinR: [0.05, 0, 0], footR: [0.3, 0, 0], spine: [-0.15, 0, 0], thighL: [-0.2, 0, 0.06], shinL: [0.5, 0, 0] }], [29, YI]]);
const fsmashA = (aim) => kf([[0, YI], [14, { ...YI, spine: [-0.25, 0, 0], neck: [-0.5, 0, 0], head: [-0.5, 0, 0], thighL: [-0.2, 0, 0.06], thighR: [-0.6, 0, -0.06], shinR: [1.0, 0, 0], extra1: [-0.3, 0, 0] }],
  [18, { ...LUNGE, spine: [0.75 - aim * 0.5, 0, 0], neck: [0.3 - aim, 0, 0], head: [0.25 - aim * 0.5, 0, 0], root: [0, -0.03, 0.05] }],
  [24, { ...LUNGE, spine: [0.75 - aim * 0.5, 0, 0], neck: [0.3 - aim, 0, 0], head: [0.25 - aim * 0.5, 0, 0], root: [0, -0.03, 0.05] }], [50, YI]]);
const flutter = (mf, amp = 0.7, rate = 1.6) => {
  const s = Math.sin(mf * rate);
  return { thighL: [-1.0 + amp * s, 0, 0.08], thighR: [-1.0 - amp * s, 0, -0.08], shinL: [0.9 - 0.5 * s, 0, 0], shinR: [0.9 + 0.5 * s, 0, 0], footL: [0.3, 0, 0], footR: [0.3, 0, 0] };
};

const ANIMS = {
  jab1: kf([[0, YI], [2, { ...YI, thighL: [-0.6, 0, 0.06], shinL: [1.5, 0, 0] }], [3, { ...YI, thighL: [-1.45, 0, 0.06], shinL: [0.1, 0, 0], footL: [0.3, 0, 0], spine: [0.05, 0, 0] }],
    [6, { ...YI, thighL: [-1.45, 0, 0.06], shinL: [0.1, 0, 0], footL: [0.3, 0, 0], spine: [0.05, 0, 0] }], [23, YI]]),
  jab2: kf([[0, { ...YI, thighR: [-1.5, 0, -0.06], shinR: [0.1, 0, 0], footR: [0.3, 0, 0], spine: [0.05, 0, 0] }], [4, { ...YI, thighR: [-1.5, 0, -0.06], shinR: [0.1, 0, 0], footR: [0.3, 0, 0], spine: [0.05, 0, 0] }], [20, YI]]),
  dashattack: kf([[0, YI], [6, { ...YI, spine: [0.1, 0, 0], neck: [-0.5, 0, 0] }],
    [9, { ...LUNGE, spine: [1.1, 0, 0], neck: [0.35, 0, 0], head: [0.25, 0, 0], thighL: [-1.2, 0, 0], shinL: [1.0, 0, 0], thighR: [0.6, 0, 0], shinR: [0.7, 0, 0], upperArmL: [0.8, 0, 0.5], upperArmR: [0.8, 0, -0.5], root: [0, -0.06, 0] }],
    [22, { ...LUNGE, spine: [1.1, 0, 0], neck: [0.35, 0, 0], head: [0.25, 0, 0], thighL: [-1.2, 0, 0], shinL: [1.0, 0, 0], thighR: [0.6, 0, 0], shinR: [0.7, 0, 0], upperArmL: [0.8, 0, 0.5], upperArmR: [0.8, 0, -0.5], root: [0, -0.06, 0] }], [36, YI]]),
  ftilt: ftiltA(0), ftiltHi: ftiltA(0.4), ftiltLo: ftiltA(-0.35),
  utilt: kf([[0, YI], [5, { ...YI, spine: [0.6, 0, 0], neck: [0.3, 0, 0], head: [0.3, 0, 0], root: [0, -0.07, 0] }],
    [7, { ...YI, spine: [0.05, 0, 0], neck: [-0.25, 0, 0], head: [-0.55, 0, 0], root: [0, 0.02, 0], upperArmL: [0.4, 0, 0.6], upperArmR: [0.4, 0, -0.6] }],
    [10, { ...YI, spine: [0.0, 0, 0], neck: [-0.3, 0, 0], head: [-0.65, 0, 0], root: [0, 0.02, 0], upperArmL: [0.4, 0, 0.6], upperArmR: [0.4, 0, -0.6] }], [25, YI]]),
  dtilt: kf([[0, YI], [5, { ...CR, body: [0, 0.5, 0] }], [8, { ...CR, body: [0, -2.3, 0], extra1: [0.55, 0, 0] }], [10, { ...CR, body: [0, -2.9, 0], extra1: [0.55, 0, 0] }],
    [23, { ...YI, body: [0, -2 * PI, 0] }]]),
  fsmash: fsmashA(0), fsmashHi: fsmashA(0.4), fsmashLo: fsmashA(-0.35),
  usmash: kf([[0, YI], [6, { ...CR, neck: [0.3, 0, 0], head: [0.4, 0, 0] }],
    [9, { ...YI, spine: [-0.05, 0, 0], neck: [-0.3, 0, 0], head: [-0.6, 0, 0], root: [0, 0.05, 0], thighL: [-0.1, 0, 0.06], thighR: [0, 0, -0.06], shinL: [0.1, 0, 0], shinR: [0.1, 0, 0], upperArmL: [0.4, 0, 0.7], upperArmR: [0.4, 0, -0.7] }],
    [15, { ...YI, spine: [-0.1, 0, 0], neck: [-0.35, 0, 0], head: [-0.7, 0, 0], root: [0, 0.05, 0], thighL: [-0.1, 0, 0.06], thighR: [0, 0, -0.06], shinL: [0.1, 0, 0], shinR: [0.1, 0, 0], upperArmL: [0.4, 0, 0.7], upperArmR: [0.4, 0, -0.7] }], [47, YI]]),
  dsmash: kf([[0, YI], [4, { ...CR, body: [0, 0.6, 0] }], [6, { ...CR, body: [0, -PI + 0.3, 0], extra1: [0.6, 0, 0] }], [8, { ...CR, body: [0, -PI - 0.3, 0], extra1: [0.6, 0, 0] }],
    [21, { ...CR, body: [0, -2 * PI + 0.3, 0], extra1: [0.6, 0, 0] }], [23, { ...CR, body: [0, -2 * PI - 0.3, 0], extra1: [0.6, 0, 0] }], [59, { ...YI, body: [0, -2 * PI, 0] }]]),
  nair: kf([[0, AIR], [4, { ...AIR, thighR: [-0.6, 0, 0], shinR: [1.6, 0, 0] }],
    [5, { ...AIR, thighR: [-1.5, 0, -0.05], shinR: [0.05, 0, 0], footR: [0.4, 0, 0], thighL: [-0.4, 0, 0.1], shinL: [1.6, 0, 0], spine: [-0.1, 0, 0], upperArmL: [0, 0, 1.2], upperArmR: [0, 0, -1.2] }],
    [38, { ...AIR, thighR: [-1.5, 0, -0.05], shinR: [0.05, 0, 0], footR: [0.4, 0, 0], thighL: [-0.4, 0, 0.1], shinL: [1.6, 0, 0], spine: [-0.1, 0, 0], upperArmL: [0, 0, 1.2], upperArmR: [0, 0, -1.2] }], [49, AIR]]),
  fair: kf([[0, AIR], [8, { ...AIR, spine: [-0.45, 0, 0], neck: [-0.7, 0, 0], head: [-0.6, 0, 0] }],
    [11, { ...AIR, spine: [0.7, 0, 0], neck: [0.6, 0, 0], head: [0.5, 0, 0] }], [15, { ...AIR, spine: [1.0, 0, 0], neck: [0.9, 0, 0], head: [0.8, 0, 0] }], [39, AIR]]),
  bair: kf([[0, AIR], [8, { ...AIR, spine: [0.4, 0, 0], thighR: [-1.0, 0, 0], shinR: [1.7, 0, 0] }],
    [10, { ...AIR, spine: [0.75, 0.3, 0], thighR: [1.4, 0, 0], shinR: [0.05, 0, 0], thighL: [-0.9, 0, 0], shinL: [1.3, 0, 0], neck: [-0.5, 0, 0], extra1: [-0.4, 0, 0] }],
    [19, { ...AIR, spine: [0.75, 0.3, 0], thighR: [1.4, 0, 0], shinR: [0.05, 0, 0], thighL: [-0.9, 0, 0], shinL: [1.3, 0, 0], neck: [-0.5, 0, 0], extra1: [-0.4, 0, 0] }], [41, AIR]]),
  uair: kf([[0, AIR], [7, { ...AIR, ...spinAbout(-0.5, 0.45), extra1: [0.4, 0, 0] }], [9, { ...AIR, ...spinAbout(1.5, 0.45), extra1: [-0.3, 0, 0] }],
    [10, { ...AIR, ...spinAbout(1.9, 0.45), extra1: [-0.4, 0, 0] }], [41, AIR]]),
  dair: (f, mf) => {
    const base = { ...AIR, spine: [0.35, 0, 0], neck: [-0.4, 0, 0], upperArmL: [0, 0, 0.9], upperArmR: [0, 0, -0.9] };
    if (mf < 4) return lerpP(AIR, { ...base, ...flutter(0) }, mf / 4);
    if (mf <= 31) return { ...base, ...flutter(mf, 0.8, 2.1) };
    return lerpP({ ...base, ...flutter(31, 0.8, 2.1) }, AIR, Math.min(1, (mf - 31) / 12));
  },
  grab: kf([[0, YI], [10, { ...YI, spine: [0.1, 0, 0], neck: [-0.4, 0, 0] }], [15, LUNGE], [24, LUNGE], [69, YI]]),
  taunt: (f, mf) => {
    const up = { ...YI, spine: [0.0, 0, 0], neck: [-0.4, 0, 0], head: [-0.4, 0, 0], upperArmL: [-2.6, 0, 0.4], upperArmR: [-2.6, 0, -0.4], foreArmL: [-0.4, 0, 0], foreArmR: [-0.4, 0, 0],
      thighL: [-0.2, 0, 0.06], thighR: [-0.1, 0, -0.06], shinL: [0.3, 0, 0], shinR: [0.3, 0, 0] };
    if (mf < 12) return lerpP(YI, CR, mf / 12);
    if (mf < 50) { const k = (mf - 12) / 38; const hop = Math.sin(Math.min(1, k * 2) * PI) * 0.12; return { ...up, root: [0, hop, 0], head: [-0.4 + Math.sin(mf * 0.5) * 0.2, 0, 0] }; }
    return lerpP(up, YI, Math.min(1, (mf - 50) / 20));
  },
  nspecial: kf([[0, YI], [12, { ...YI, spine: [0.0, 0, 0], neck: [-0.5, 0, 0], head: [-0.3, 0, 0] }], [18, LUNGE], [23, LUNGE], [37, YI]]),
  nspecialCatch: (f, mf) => {
    if (mf <= 25) return lerpP(LUNGE, { ...YI, head: [-0.3, 0, 0] }, Math.min(1, mf / 20));
    if (mf < 31) return { ...YI, head: [-0.3 + Math.sin(mf * 1.2) * 0.25, 0, 0] };          // gulp
    if (mf < 40) return lerpP({ ...CR, extra1: [-0.4, 0, 0] }, YI, (mf - 31) / 9);
    return YI;
  },
  uspecial: kf([[0, YI], [5, { ...YI, upperArmR: [0.2, 0, -0.3], foreArmR: [-0.6, 0, 0] }],
    [18, { ...YI, spine: [-0.25, 0, 0], neck: [-0.5, 0, 0], upperArmR: [-3.2, 0, -0.2], foreArmR: [-1.4, 0, 0], thighL: [-0.7, 0, 0.06], shinL: [0.9, 0, 0] }],
    [23, { ...YI, spine: [0.45, 0, 0], upperArmR: [-2.1, 0, -0.1], foreArmR: [0, 0, 0], thighL: [-0.8, 0, 0.06], shinL: [0.9, 0, 0], thighR: [0.1, 0, 0] }],
    [32, { ...YI, spine: [0.5, 0, 0], upperArmR: [-0.9, 0, -0.1], foreArmR: [-0.2, 0, 0] }], [71, YI]]),
  dspecial: (f, mf) => {
    const HIT = f.vars?.fromAir ? 24 : 30;
    const tuck = { ...AIR, thighL: [-1.6, 0, 0.2], thighR: [-1.6, 0, -0.2], shinL: [2.0, 0, 0], shinR: [2.0, 0, 0], spine: [0.4, 0, 0] };
    const drop = { ...AIR, spine: [-0.15, 0, 0], neck: [0.1, 0, 0], thighL: [-1.4, 0, 0.45], thighR: [-1.4, 0, -0.45], shinL: [0.5, 0, 0], shinR: [0.5, 0, 0], upperArmL: [-0.3, 0, 1.2], upperArmR: [-0.3, 0, -1.2], extra1: [0.6, 0, 0], root: [0, 0.1, 0] };
    if (mf < 6) return lerpP(YI, tuck, mf / 6);
    if (mf < HIT - 4) return { ...tuck, ...spinAbout((mf - 6) / (HIT - 10) * 2 * PI, 0.4) };
    return lerpP(tuck, drop, Math.min(1, (mf - HIT + 4) / 4));
  },
  dspecialLand: kf([[0, { ...CR, root: [0, -0.2, 0], thighL: [-1.5, 0, 0.45], thighR: [-1.5, 0, -0.45] }], [10, { ...CR, root: [0, -0.18, 0] }], [44, YI]]),
};

export const yoshi = makeChar({
  id: 'yoshi', name: 'Yoshi', series: 'yoshi', data, model: yoshiModel, props: YOSHI_PROPS, extraBones: YOSHI_EXTRA_BONES,
  palettes: YOSHI_PALETTES,
  attr: { djArmor: 140, djvx: 0.4, shieldFull: true },
  boneMap: { j6: 'neck', tail: 'extra2' },
  doubleJumpFlip: false,
  anims: {
    idle: (f, t) => { const b = Math.sin((t % 100) / 100 * 2 * PI); return { ...YI, root: [0, -0.04 + b * 0.012, 0], spine: [0.28 + b * 0.03, 0, 0], extra1: [0.12 + b * 0.08, b * 0.1, 0] }; },
    walk: (f) => lean(walkPose(((f.walkPhase ?? 0) % 1), Math.min(1, Math.abs(f.vx) / 30 + 0.3))),
    dash: (f, t) => lean(runPose(((f.walkPhase ?? (t / 20)) % 1)), 0.6),
    run: (f, t) => lean(runPose(((f.walkPhase ?? (t / 20)) % 1)), 0.6),
    jump: (f) => lean(lerpP(P.jump, P.fall, Math.min(1, Math.max(0, (f.sf - 10) / 25)))),
    fall: () => AIR,
    // double jump: flutter kick
    jumpaerial: (f) => ({ ...AIR, spine: [0.15, 0, 0], neck: [-0.35, 0, 0], upperArmL: [-0.4, 0, 0.9], upperArmR: [-0.4, 0, -0.9], ...flutter(f.sf, f.sf < 40 ? 0.75 : 0.2, 1.9) }),
    squatwait: () => CR,
  },
  moves: {
    ...Object.fromEntries(Object.entries(ANIMS).map(([k, a]) => [k, { anim: a }])),
    grab: {
      anim: ANIMS.grab, onStart(f) { f.onGrab = null; },
      hitboxes: [
        { frames: [15, 20], damage: 1, angle: 361, bkb: 0, kbg: 100, fkb: 0, r: 110, size: 110, grab: true, pos: [360, 230] },
        { frames: [15, 20], damage: 1, angle: 361, bkb: 0, kbg: 100, fkb: 0, r: 90, size: 90, grab: true, pos: [190, 230] },
      ],
    },
    nspecial: eggLay({ anim: ANIMS.nspecial }),
    nspecialAir: eggLay({ anim: ANIMS.nspecial, air: true }),
    nspecialCatch: eggCatch({ anim: ANIMS.nspecialCatch, mouth: [150, 270] }),
    uspecial: eggThrow({ anim: ANIMS.uspecial }),
    uspecialAir: eggThrow({ anim: ANIMS.uspecial }),
    dspecial: yoshiBomb({ anim: ANIMS.dspecial }),
    dspecialAir: yoshiBomb({ anim: ANIMS.dspecial, air: true }),
    dspecialLand: yoshiBombLand({ anim: ANIMS.dspecialLand }),
  },
  extraMoves: { nspecialAir: { total: 37 }, nspecialCatch: { total: 55 }, uspecialAir: { total: 71 }, dspecialAir: { total: 9999 }, dspecialLand: { total: 44 } },
  animExtra: yoshiExtra,
});

function yoshiExtra(view, f) {
  const ex = view.extra; if (!ex.tongue) return;
  // egg shield (always full size): swap the bubble for an opaque spotted egg once
  if (!view._eggShield) {
    view._eggShield = true;
    const pal = f.def.palettes[f.color % f.def.palettes.length];
    const egg = eggMesh(pal.body, 1);
    view.shield.geometry = egg.geometry; view.shield.material = egg.material;
    for (const c of [...egg.children]) view.shield.add(c);
  }
  const m = f.state === 'attack' ? f.move : null, k = f.mf;
  // tongue: aimed from the mouth at a target point (game units, relative to Yoshi), extended by fraction `ext`
  let ext = 0, tgt = null;
  if (m?.eggLay) { ext = k < 12 ? 0 : k < 18 ? (k - 12) / 6 : k <= 23 ? 1 : k < 30 ? 1 - (k - 23) / 7 : 0; tgt = [f.x + f.facing * 430, f.y + 250]; }
  else if (m?.id === 'grab') { ext = k < 10 ? 0 : k < 15 ? (k - 10) / 5 : k <= 20 ? 1 : k < 28 ? 1 - (k - 20) / 8 : 0; tgt = [f.x + f.facing * 360, f.y + 230]; }
  else if (m?.eggCatch && k < 24 && f.vars.victim) { ext = 1; const v = f.vars.victim; tgt = [v.x, v.y + v.H * 0.5]; }
  else if (f.state === 'grabbing' && f.grabbing) { ext = 1; tgt = [f.grabbing.x, f.grabbing.y + f.grabbing.H * 0.5]; }
  ex.tongue.visible = ext > 0.01;
  if (ex.tongue.visible) {
    view.root.updateMatrixWorld(true);
    const RS = view.root.scale.x / f.H;          // render units per game unit
    const w = new THREE.Vector3(tgt[0] * RS, tgt[1] * RS, 0);
    ex.tongue.lookAt(w);
    const o = new THREE.Vector3(); ex.tongue.getWorldPosition(o);
    const len = Math.max(0.01, o.distanceTo(w) / view.root.scale.x * ext);
    ex.tongue.scale.set(1, 1, len);
    ex.tongue.children[1].scale.set(1, 1, 1 / len);
  }
  ex.held.visible = !!(m?.eggThrow && k >= 4 && k < 23);
}
