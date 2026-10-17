// Kirby — move data from the decomp (src/chars/data/kirby.js); puffball model, waddle animations,
// Inhale/copy abilities, Final Cutter and Stone (src/chars/specials_kirby.js).
import { kirbyModel, KIRBY_PROPS } from './models_kirby.js';
import { makeChar } from './build.js';
import { kf, spinAbout, lerpP } from './specials_samus.js';
import { inhale, inhaleCatch, inhaleWait, inhaleSpit, inhaleCopy, inhaleRelease, finalCutter, finalCutterLand, stone, copyMoves, COPYABLE } from './specials_kirby.js';
import { P } from '../render/anims.js';
import data from './data/kirby.js';

const PI = Math.PI;
// palettes: pink (default), yellow, light blue (blue team), red (red team), green (green team)
export const KIRBY_PALETTES = [
  { body: 0xf8a8c8, foot: 0xe01818, cheek: 0xf06090, icon: 0xf8a8c8 },
  { body: 0xf8e818, foot: 0xe06810, cheek: 0xf07080, icon: 0xf8e818 },
  { body: 0x30e0f0, foot: 0x1830e0, cheek: 0x2060e0, icon: 0x30e0f0 },
  { body: 0xf05018, foot: 0x6a3010, cheek: 0xc04050, icon: 0xf05018 },
  { body: 0x30e070, foot: 0x108030, cheek: 0x108040, icon: 0x30e070 },
];

const KI = { upperArmL: [0, 0, 0.45], upperArmR: [0, 0, -0.45], thighL: [0, 0, 0.05], thighR: [0, 0, -0.05] };
const KA = { upperArmL: [-0.3, 0, 1.3], upperArmR: [-0.3, 0, -1.3], thighL: [-0.4, 0, 0.1], thighR: [-0.2, 0, -0.1], spine: [0.05, 0, 0] };   // air
const SQ = { ...KI, scale: [1.18, 0.72, 1.18], upperArmL: [0, 0, 0.9], upperArmR: [0, 0, -0.9] };
const ARMS_F = { upperArmL: [-1.5, 0, 0.3], upperArmR: [-1.5, 0, -0.3] };
const waddle = (t, amp = 1, lean = 0) => {
  const s = Math.sin(t * 2 * PI), c = Math.cos(t * 2 * PI);
  return { body: [0, 0, 0.13 * s * amp], spine: [lean, 0, 0], root: [0, Math.abs(c) * 0.035 * amp, 0],
    thighL: [-0.7 * s * amp, 0, 0.05], thighR: [0.7 * s * amp, 0, -0.05], footL: [0.3 * s, 0, 0], footR: [-0.3 * s, 0, 0],
    upperArmL: [0.7 * s * amp, 0, 0.5], upperArmR: [-0.7 * s * amp, 0, -0.5] };
};

const ANIMS = {
  jab1: kf([[0, KI], [2, { ...KI, upperArmL: [-0.6, 0, 0.5], spine: [0, 0.3, 0] }], [3, { ...KI, upperArmL: [-1.6, 0, 0.05], spine: [0.1, -0.35, 0] }], [6, { ...KI, upperArmL: [-1.6, 0, 0.05], spine: [0.1, -0.35, 0] }], [17, KI]]),
  jab2: kf([[0, KI], [2, { ...KI, upperArmR: [-0.6, 0, -0.5], spine: [0, -0.3, 0] }], [3, { ...KI, upperArmR: [-1.6, 0, -0.05], spine: [0.1, 0.35, 0] }], [7, { ...KI, upperArmR: [-1.6, 0, -0.05], spine: [0.1, 0.35, 0] }], [19, KI]]),
  jabRapid: (f, mf) => {
    if (mf < 8) return lerpP(KI, { ...KI, ...ARMS_F, spine: [0.15, 0, 0] }, mf / 8);
    const s = Math.sin(mf * 1.25), c = Math.cos(mf * 1.25);
    return { ...KI, spine: [0.15, 0.2 * s, 0], upperArmR: [-1.55 + 0.4 * s, 0, -0.1], upperArmL: [-1.55 + 0.4 * c, 0, 0.1] };
  },
  dashattack: kf([[0, KI], [4, { ...KI, ...spinAbout(0.5, 0.45) }], [5, { ...KI, ...spinAbout(1.25, 0.45), upperArmL: [1.0, 0, 0.6], upperArmR: [1.0, 0, -0.6], thighL: [0.8, 0, 0.1], thighR: [0.8, 0, -0.1] }],
    [18, { ...KI, ...spinAbout(1.25, 0.45), upperArmL: [1.0, 0, 0.6], upperArmR: [1.0, 0, -0.6], thighL: [0.8, 0, 0.1], thighR: [0.8, 0, -0.1] }], [40, KI]]),
  ftilt: kf([[0, KI], [3, { ...KI, thighL: [-0.4, 0, 0.1], spine: [0.1, 0.4, 0] }], [4, { ...KI, thighL: [-1.62, 0, 0.0], footL: [-0.2, 0, 0], spine: [-0.3, -0.3, 0], upperArmL: [0, 0, 1.0], upperArmR: [0.5, 0, -0.8] }],
    [9, { ...KI, thighL: [-1.62, 0, 0.0], footL: [-0.2, 0, 0], spine: [-0.3, -0.3, 0], upperArmL: [0, 0, 1.0], upperArmR: [0.5, 0, -0.8] }], [27, KI]]),
  utilt: kf([[0, KI], [3, { ...KI, thighR: [-0.8, 0, 0], spine: [0.2, 0, 0] }], [4, { ...KI, thighR: [-2.9, 0, -0.05], spine: [-0.45, 0, 0], upperArmL: [0, 0, 1.2], upperArmR: [0, 0, -1.2] }],
    [11, { ...KI, thighR: [-3.3, 0, -0.05], spine: [-0.5, 0, 0], upperArmL: [0, 0, 1.2], upperArmR: [0, 0, -1.2] }], [17, KI]]),
  dtilt: kf([[0, KI], [3, { ...SQ }], [4, { ...SQ, thighL: [-1.55, 0, 0.0], footL: [0.3, 0, 0], spine: [0.3, 0, 0] }], [10, { ...SQ, thighL: [-1.55, 0, 0.0], footL: [0.3, 0, 0], spine: [0.3, 0, 0] }], [29, KI]]),
  fsmash: kf([[0, KI], [8, { ...KI, spine: [-0.2, 0.3, 0], thighL: [0.5, 0, 0.1], root: [0, 0, -0.08], upperArmL: [0.6, 0, 0.6], upperArmR: [0.6, 0, -0.6] }],
    [10, { ...KI, spine: [-0.35, -0.2, 0], thighL: [-1.65, 0, 0.0], footL: [-0.25, 0, 0], thighR: [0.4, 0, 0], root: [0, 0.03, 0.18], upperArmL: [0.2, 0, 1.2], upperArmR: [0.2, 0, -1.2] }],
    [23, { ...KI, spine: [-0.35, -0.2, 0], thighL: [-1.65, 0, 0.0], footL: [-0.25, 0, 0], thighR: [0.4, 0, 0], root: [0, 0.03, 0.18], upperArmL: [0.2, 0, 1.2], upperArmR: [0.2, 0, -1.2] }], [39, KI]]),
  usmash: kf([[0, KI], [10, { ...SQ, spine: [0.3, 0, 0] }], [14, { ...KI, thighR: [-1.6, 0, 0], footR: [0.3, 0, 0], ...spinAbout(-1.55, 0.4) }],
    [23, { ...KI, thighR: [-1.6, 0, 0], footR: [0.3, 0, 0], ...spinAbout(-3.6, 0.4) }, true], [49, { ...KI, ...spinAbout(-2 * PI, 0.4) }]]),
  dsmash: (f, mf) => {
    const split = { ...KI, root: [0, -0.05, 0], thighL: [-1.6, 0, 0], thighR: [1.6, 0, 0], footL: [-0.15, 0, 0], footR: [0.15, 0, 0], upperArmL: [0, 0, 1.4], upperArmR: [0, 0, -1.4] };
    if (mf < 7) return lerpP(KI, split, mf / 7);
    if (mf <= 26) return { ...split, body: [0, 0.35 * Math.sin((mf - 7) * 0.9), 0] };
    return lerpP(split, KI, Math.min(1, (mf - 26) / 20));
  },
  nair: (f, mf) => {
    const out = { ...KA, thighL: [-1.5, 0, 0], footL: [-0.1, 0, 0], thighR: [0.2, 0, 0], upperArmL: [0, 0, 1.4], upperArmR: [0, 0, -1.4] };
    if (mf < 3) return lerpP(KA, out, mf / 3);
    if (mf <= 30) return { ...out, body: [0, -(mf - 3) * 0.47, 0] };
    return lerpP({ ...out, body: [0, -27 * 0.47, 0] }, { ...KA, body: [0, -4 * PI, 0] }, Math.min(1, (mf - 30) / 15));
  },
  fair: (f, mf) => {
    const kick = { ...KA, thighL: [-1.5, 0, 0.05], thighR: [-1.3, 0, -0.05], footL: [0.3, 0, 0], footR: [0.3, 0, 0], upperArmL: [0, 0, 1.1], upperArmR: [0, 0, -1.1] };
    if (mf < 7) return lerpP(KA, kick, mf / 7);
    if (mf <= 28) return { ...kick, ...spinAbout((mf - 7) * 0.9, 0.45) };
    return lerpP({ ...kick, ...spinAbout(21 * 0.9, 0.45) }, { ...KA, ...spinAbout(6 * PI, 0.45) }, Math.min(1, (mf - 28) / 10));
  },
  bair: kf([[0, KA], [5, { ...KA, spine: [0.5, 0, 0], thighL: [1.4, 0, 0.1], thighR: [1.4, 0, -0.1], footL: [-0.3, 0, 0], footR: [-0.3, 0, 0], upperArmL: [-0.8, 0, 0.8], upperArmR: [-0.8, 0, -0.8] }],
    [25, { ...KA, spine: [0.5, 0, 0], thighL: [1.4, 0, 0.1], thighR: [1.4, 0, -0.1], footL: [-0.3, 0, 0], footR: [-0.3, 0, 0], upperArmL: [-0.8, 0, 0.8], upperArmR: [-0.8, 0, -0.8] }], [39, KA]]),
  uair: (f, mf) => {
    const sp = { ...KA, thighL: [-0.4, 0, 0.6], thighR: [-0.4, 0, -0.6], upperArmL: [0, 0, 1.6], upperArmR: [0, 0, -1.6] };
    if (mf < 10) return lerpP(KA, { ...sp, ...spinAbout(0, 0.45) }, mf / 10);
    if (mf <= 30) return { ...sp, ...spinAbout(-(mf - 10) * 0.65, 0.45) };
    return lerpP({ ...sp, ...spinAbout(-20 * 0.65, 0.45) }, { ...KA, ...spinAbout(-6 * PI, 0.45) }, Math.min(1, (mf - 30) / 20));
  },
  dair: (f, mf) => {
    const drill = { ...KA, spine: [0.25, 0, 0], thighL: [-0.45, 0, 0.12], thighR: [-0.45, 0, -0.12], footL: [0.4, 0, 0], footR: [0.4, 0, 0], upperArmL: [0, 0, 0.6], upperArmR: [0, 0, -0.6], root: [0, 0.08, 0] };
    if (mf < 4) return lerpP(KA, drill, mf / 4);
    if (mf <= 32) return { ...drill, body: [0.35, -(mf - 4) * 0.9, 0] };
    return lerpP({ ...drill, body: [0.35, -28 * 0.9, 0] }, { ...KA, body: [0, -8 * PI, 0] }, Math.min(1, (mf - 32) / 12));
  },
  grab: kf([[0, KI], [5, { ...KI, ...ARMS_F, spine: [0.25, 0, 0] }], [9, { ...KI, ...ARMS_F, spine: [0.25, 0, 0] }], [15, KI]]),
  fthrow: (f, mf) => {
    if (mf < 6) return lerpP(KI, { ...SQ, ...ARMS_F }, mf / 6);
    if (mf < 44) return { ...KA, upperArmL: [-2.6, 0, 0.3], upperArmR: [-2.6, 0, -0.3], ...spinAbout(Math.min(PI, (mf - 6) / 20 * PI), 0.45) };
    if (mf < 56) return { ...KA, upperArmL: [-2.6, 0, 0.3], upperArmR: [-2.6, 0, -0.3], ...spinAbout(PI, 0.45), scale: [1.15, 0.85, 1.15] };
    return lerpP({ ...KA, ...spinAbout(PI, 0.45) }, { ...KI, ...spinAbout(2 * PI, 0.45) }, Math.min(1, (mf - 56) / 14));
  },
  bthrow: kf([[0, { ...KI, ...ARMS_F }], [10, { ...SQ, ...ARMS_F }], [24, { ...KI, ...ARMS_F, ...spinAbout(-PI * 0.8, 0.4), root: [0, 0.3, -0.2] }], [49, KI]]),
  taunt: (f, mf) => {
    if (mf < 24) return { ...KI, body: [0, (mf / 24) * 2 * PI, 0], upperArmL: [0, 0, 1.5], upperArmR: [0, 0, -1.5], root: [0, Math.sin(mf / 24 * PI) * 0.1, 0] };
    const pose = { ...KI, upperArmR: [-2.8, 0, -0.4], upperArmL: [0, 0, 0.8], thighL: [-0.3, 0, 0.1] };
    return mf < 30 ? lerpP(KI, pose, (mf - 24) / 6) : mf < 50 ? { ...pose, upperArmR: [-2.8, 0, -0.4 + 0.3 * Math.sin(mf * 0.8)] } : lerpP(pose, KI, (mf - 50) / 9);
  },
  // specials
  inhale: (f, mf) => {
    const suck = { ...KI, spine: [-0.3, 0, 0], upperArmL: [-0.4, 0, 1.0], upperArmR: [-0.4, 0, -1.0], thighL: [-0.3, 0, 0.15], thighR: [0.2, 0, -0.15] };
    const end = f.vars?.endAt;
    if (end != null && mf > end - 20) return lerpP(suck, KI, Math.min(1, (mf - (end - 20)) / 20));
    if (mf < 20) return lerpP(KI, suck, mf / 20);
    return { ...suck, root: [0, 0, Math.sin(mf * 1.6) * 0.01] };
  },
  inhaleCatch: (f, mf) => ({ ...KI, spine: [-0.3, 0, 0], scale: [1 + mf * 0.006, 1 + mf * 0.004, 1 + mf * 0.006], upperArmL: [-0.4, 0, 1.0], upperArmR: [-0.4, 0, -1.0] }),
  stuffed: (f, mf) => {
    const w = f.grounded === false ? KA : (Math.abs(f.vx ?? 0) > 1 ? waddle(((f.walkPhase ?? 0) % 1), 0.6) : { ...KI, root: [0, Math.sin(mf * 0.12) * 0.01, 0] });
    return { ...w, scale: [1.12, 1.08, 1.12] };
  },
  spit: kf([[0, { ...KI, scale: [1.12, 1.08, 1.12] }], [5, { ...KI, spine: [-0.3, 0, 0], scale: [1.15, 1.05, 1.15] }], [8, { ...KI, spine: [0.4, 0, 0], ...ARMS_F, scale: [0.95, 1.05, 0.95] }], [28, KI]]),
  copy: (f, mf) => {
    if (mf < 8) return { ...SQ, scale: [1.2 - mf * 0.01, 0.75 + mf * 0.03, 1.2 - mf * 0.01] };
    return { ...KI, body: [0, Math.min(1, (mf - 8) / 16) * 2 * PI, 0], root: [0, Math.sin(Math.min(1, (mf - 8) / 16) * PI) * 0.25, 0], upperArmL: [0, 0, 1.5], upperArmR: [0, 0, -1.5] };
  },
  release: kf([[0, { ...KI, spine: [-0.4, 0, 0], scale: [1.1, 0.9, 1.1] }], [12, { ...KI, head: [0.3, 0, 0], spine: [0.3, 0, 0] }], [40, KI]]),
  cutter: (f, mf) => {
    const crouch = { ...SQ, upperArmR: [0.6, 0, -0.4], spine: [0.3, 0, 0] };
    const up = { ...KA, upperArmR: [-3.0, 0, -0.1], upperArmL: [0, 0, 1.0], thighL: [-0.6, 0, 0.1], thighR: [-0.2, 0, -0.1], spine: [-0.2, 0, 0] };
    const top = { ...KA, upperArmR: [-2.9, 0, -0.1], upperArmL: [0, 0, 1.2], ...spinAbout(-0.4, 0.45) };
    const plunge = { ...KA, upperArmR: [-0.9, 0, -0.1], upperArmL: [0, 0, 1.2], ...spinAbout(0.6, 0.45), thighL: [0.3, 0, 0.1], thighR: [0.3, 0, -0.1] };
    if (mf < 12) return lerpP(KI, crouch, mf / 12);
    if (mf < 20) return crouch;
    if (mf < 24) return lerpP(crouch, up, (mf - 20) / 3);
    if (mf < 38) return lerpP(up, top, Math.min(1, (mf - 24) / 10));
    if (mf < 44) return lerpP(top, plunge, (mf - 38) / 6);
    return plunge;
  },
  cutterLand: kf([[0, { ...SQ, upperArmR: [-0.4, 0, -0.1], spine: [0.6, 0, 0] }], [10, { ...SQ, upperArmR: [-0.4, 0, -0.1], spine: [0.6, 0, 0] }], [35, KI]]),
  stone: (f, mf) => {
    const v = f.vars ?? {};
    if (v.endAt != null) return lerpP({ ...SQ }, KI, Math.min(1, (mf - (v.endAt - 30)) / 30));
    return lerpP(KI, { ...SQ, upperArmL: [0, 0, 2.4], upperArmR: [0, 0, -2.4] }, Math.min(1, mf / Math.max(1, (v.on ?? 6))));
  },
  // copied abilities
  shoot: kf([[0, KI], [12, { ...KI, upperArmR: [-0.4, 0, -0.7], spine: [0, 0.4, 0] }], [16, { ...KI, upperArmR: [-1.6, 0, -0.1], spine: [0.15, -0.3, 0] }], [24, { ...KI, upperArmR: [-1.6, 0, -0.1], spine: [0.15, -0.3, 0] }], [45, KI]]),
  blaster: (f, mf) => {
    const aim = { ...KI, upperArmR: [-1.55, 0, -0.1], upperArmL: [-1.2, 0, 0.3], spine: [0.05, -0.2, 0] };
    return mf < 10 ? lerpP(KI, aim, mf / 10) : mf > (f.move?.total ?? 55) - 12 ? lerpP(aim, KI, (mf - ((f.move?.total ?? 55) - 12)) / 12) : aim;
  },
  charge: (f, mf) => {
    const aim = { ...KI, upperArmR: [-1.55, 0, -0.1], upperArmL: [-1.3, 0, 0.4], spine: [0.0, -0.25, 0] };
    const v = f.vars ?? {};
    if (v.phase === 'charge') return { ...aim, root: [0, Math.sin(mf * 1.7) * 0.01, 0] };
    if (v.phase === 'shoot') { const k = mf - v.ps; return k < 16 ? { ...aim, spine: [-0.2 * Math.max(0, 1 - k / 6), -0.25, 0] } : lerpP(aim, KI, Math.min(1, (k - 16) / 13)); }
    return lerpP(KI, aim, Math.min(1, mf / 10));
  },
  punch: (f, mf) => {
    const v = f.vars ?? {};
    if (v.phase === 'charge') return { ...KI, upperArmR: [-(mf * 0.5) % (2 * PI), 0, -0.3], spine: [0.1, 0.3, 0] };
    if (v.phase === 'punch') {
      const k = mf - v.ps;
      const hit = { ...KI, upperArmR: [-1.6, 0, -0.05], spine: [0.3, -0.5, 0], thighL: [-0.8, 0, 0.1], root: [0, 0, 0.08] };
      return k < 9 ? lerpP({ ...KI, upperArmR: [0.8, 0, -0.4], spine: [0, 0.6, 0] }, hit, k / 9) : k < 20 ? hit : lerpP(hit, KI, Math.min(1, (k - 20) / 16));
    }
    return lerpP(KI, { ...KI, upperArmR: [0.8, 0, -0.4], spine: [0, 0.6, 0] }, Math.min(1, mf / 8));
  },
  toss: kf([[0, KI], [20, { ...KI, upperArmR: [-2.8, 0, -0.3], spine: [-0.2, 0.4, 0] }], [26, { ...KI, upperArmR: [-1.2, 0, -0.1], spine: [0.3, -0.3, 0] }], [46, KI]]),
  lunge: kf([[0, KI], [12, { ...KI, spine: [-0.3, 0, 0] }], [18, { ...KI, spine: [0.5, 0, 0], root: [0, 0, 0.08], ...ARMS_F }], [23, { ...KI, spine: [0.5, 0, 0], root: [0, 0, 0.08], ...ARMS_F }], [37, KI]]),
  gulp: (f, mf) => mf < 25 ? { ...KI, spine: [-0.2, 0, 0], scale: [1.1, 1.05, 1.1] } : mf < 40 ? lerpP({ ...SQ }, KI, (mf - 25) / 15) : KI,
  falcon: kf([[0, KI], [12, { ...KI, spine: [0, 0.9, 0], upperArmR: [0.9, 0, -0.5], thighR: [0.4, 0, 0] }], [38, { ...KI, spine: [-0.1, 1.2, 0], upperArmR: [1.2, 0, -0.6], thighR: [0.5, 0, 0], root: [0, -0.03, -0.05] }],
    [42, { ...KI, spine: [0.3, -0.6, 0], upperArmR: [-1.6, 0, 0], thighL: [-0.9, 0, 0.1], thighR: [0.6, 0, 0], root: [0, -0.03, 0.12] }],
    [55, { ...KI, spine: [0.3, -0.6, 0], upperArmR: [-1.6, 0, 0], thighL: [-0.9, 0, 0.1], thighR: [0.6, 0, 0], root: [0, -0.03, 0.12] }], [89, KI]]),
  jolt: kf([[0, KI], [16, { ...SQ, spine: [0.3, 0, 0], upperArmL: [0, 0, 1.6], upperArmR: [0, 0, -1.6] }], [21, { ...KI, spine: [0.5, 0, 0], ...ARMS_F }], [40, { ...KI, spine: [0.3, 0, 0] }], [63, KI]]),
  pound: kf([[0, KI], [9, { ...KI, upperArmR: [-2.4, 0, -0.6], spine: [-0.1, 0.4, 0] }], [12, { ...KI, upperArmR: [-1.4, 0, 0], spine: [0.3, -0.3, 0], root: [0, 0, 0.05] }],
    [27, { ...KI, upperArmR: [-0.9, 0, 0.2], spine: [0.35, -0.4, 0], root: [0, 0, 0.05] }], [54, KI]]),
};

// Final Cutter: keep the rising slash data, put the plunging hits on the blade (in front of/below Kirby), drop the
// cutter-wave entry (it is the landing projectile).
const fcHB = data.moves.uspecial.hitboxes.filter(h => !(h.frames[0] === 4 && h.frames[1] === 22)).map(h => ({ ...h, size: h.r, ...(h.frames[0] >= 46 ? { pos: [130, 60] } : {}) }));

export const kirby = makeChar({
  id: 'kirby', name: 'Kirby', series: 'kirby', data, model: kirbyModel, props: KIRBY_PROPS,
  palettes: KIRBY_PALETTES,
  doubleJumpFlip: false,
  anims: {
    idle: (f, t) => { const b = Math.sin((t % 80) / 80 * 2 * PI); return { ...KI, scale: [1 + b * 0.015, 1 - b * 0.015, 1 + b * 0.015], upperArmL: [0, 0, 0.45 + b * 0.1], upperArmR: [0, 0, -0.45 - b * 0.1] }; },
    walk: (f) => waddle(((f.walkPhase ?? 0) % 1), Math.min(1, Math.abs(f.vx) / 28 + 0.35)),
    dash: (f, t) => ({ ...waddle(((f.walkPhase ?? (t / 20)) % 1) * 1.0, 1.3, 0.3), upperArmL: [0.8, 0, 0.9], upperArmR: [0.8, 0, -0.9] }),
    run: (f, t) => ({ ...waddle(((f.walkPhase ?? (t / 20)) % 1) * 1.0, 1.3, 0.3), upperArmL: [0.8, 0, 0.9], upperArmR: [0.8, 0, -0.9] }),
    jump: (f) => lerpP({ ...KI, upperArmL: [0, 0, 2.3], upperArmR: [0, 0, -2.3], thighL: [-0.5, 0, 0.1], thighR: [0.2, 0, -0.1] }, KA, Math.min(1, Math.max(0, (f.sf - 8) / 20))),
    // midair jumps: puffed up, flapping
    jumpaerial: (f) => { const s = Math.sin(f.sf * 0.45); const k = Math.min(1, f.sf / 6); return { ...KA, scale: [1 + 0.16 * k, 1 + 0.12 * k, 1 + 0.16 * k], upperArmL: [0, 0, 1.1 + 0.7 * s], upperArmR: [0, 0, -1.1 - 0.7 * s], thighL: [-0.2, 0, 0.2], thighR: [-0.2, 0, -0.2] }; },
    fall: () => KA,
    squat: (f) => lerpP(KI, SQ, Math.min(1, f.sf / 3)),
    squatwait: () => SQ,
    landing: () => ({ ...SQ, scale: [1.12, 0.82, 1.12] }),
    jumpsquat: () => ({ ...SQ, scale: [1.12, 0.82, 1.12] }),
  },
  moves: {
    ...Object.fromEntries(Object.entries(ANIMS).filter(([k]) => data.moves[k]).map(([k, a]) => [k, { anim: a }])),
    jab2: { anim: ANIMS.jab2, next: 'jabRapid', nextAt: 8, nextFrom: 8 },
    jabRapid: { anim: ANIMS.jabRapid, loop: [8, 32] },
    dashattack: { anim: ANIMS.dashattack, traction: 0.35, onStart(f) { f.vx = Math.sign(f.vx || f.facing) * Math.max(Math.abs(f.vx), 40); } },
    grab: { anim: ANIMS.grab, onStart(f) { f.onGrab = null; } },
    // forward throw: leap up carrying the victim, hang at frame 44 until landing, slam (release 53)
    fthrow: {
      anim: ANIMS.fthrow, groundOK: true, keepOnFall: true,
      script(f, mf) {
        if (mf === 6 && f.grounded) { f.grounded = false; f.ground = null; f.y += 1; f.vy = 62; f.vx = 6 * f.facing; }
        if (mf === 44 && f.vars.victim) f.hitVictims.set(0, new Set([f.vars.victim]));
        if (mf >= 44 && !f.grounded) { f.mf = 43; if (f.vy > -60) f.vy -= 2; }
        if (mf === 45) f.match.emit('sfx', { name: 'bump' });
      },
    },
    taunt: { anim: ANIMS.taunt, onStart(f) { f.special.copy = null; } },
    nspecial: inhale({ anim: ANIMS.inhale }),
    nspecialAir: inhale({ anim: ANIMS.inhale, air: true }),
    inhaleCatch: inhaleCatch({ anim: ANIMS.inhaleCatch }),
    inhaleWait: inhaleWait({ anim: ANIMS.stuffed }),
    inhaleSpit: inhaleSpit({ anim: ANIMS.spit }),
    inhaleCopy: inhaleCopy({ anim: ANIMS.copy }),
    inhaleRelease: inhaleRelease({ anim: ANIMS.release }),
    uspecial: { ...finalCutter({ anim: ANIMS.cutter }), hitboxes: fcHB },
    uspecialAir: { ...finalCutter({ anim: ANIMS.cutter }), hitboxes: fcHB },
    uspecialLand: finalCutterLand({ anim: ANIMS.cutterLand }),
    dspecial: stone({ anim: ANIMS.stone }),
    dspecialAir: stone({ anim: ANIMS.stone }),
    ...copyMoves(ANIMS),
  },
  extraMoves: {
    nspecialAir: { total: 99999 }, inhaleCatch: { total: 19 }, inhaleWait: { total: 99999 }, inhaleSpit: { total: 28 }, inhaleCopy: { total: 30 }, inhaleRelease: { total: 40 },
    uspecialAir: { total: 57 }, uspecialLand: { total: 35 }, dspecialAir: { total: 99999 },
    copy_mario: { total: 45 }, copy_marioAir: { total: 45 }, copy_luigi: { total: 45 }, copy_luigiAir: { total: 45 },
    copy_fox: { total: 55 }, copy_foxAir: { total: 45 }, copy_samus: { total: 9999 }, copy_samusAir: { total: 9999 },
    copy_dk: { total: 99999 }, copy_dkAir: { total: 99999 }, copy_link: { total: 46 }, copy_linkAir: { total: 46 },
    copy_yoshi: { total: 37 }, copy_yoshiAir: { total: 37 }, copy_yoshiCatch: { total: 55 },
    copy_falcon: { total: 89 }, copy_falconAir: { total: 89 }, copy_pikachu: { total: 63 }, copy_pikachuAir: { total: 63 },
    copy_jigglypuff: { total: 54 }, copy_jigglypuffAir: { total: 54 }, copy_ness: { total: 71 }, copy_nessAir: { total: 60 },
  },
  init(f) {
    // own copy of the attributes (stuffed Kirby doubles his max fall speed)
    f.a = { ...f.a };
    const base = f.a.tvel;
    const setState = Object.getPrototypeOf(f).setState;
    f.setState = function (s) { this.a.tvel = base; return setState.call(this, s); };
    // a hit has a 1/12 chance to knock the copy ability off
    const takeHit = Object.getPrototypeOf(f).takeHit;
    f.takeHit = function (hit) {
      const r = takeHit.call(this, hit);
      if (this.special.copy && r && r.kb > 0 && !r.armored && !r.held && Math.random() < 1 / 12) { this.special.copy = null; this.match.emit('sfx', { name: 'bump' }); }
      return r;
    };
  },
  animExtra: kirbyExtra,
});

function kirbyExtra(view, f) {
  const ex = view.extra; if (!ex.hats) return;
  const m = f.state === 'attack' ? f.move : null;
  const cp = f.special.copy;
  for (const [id, h] of Object.entries(ex.hats)) h.visible = id === cp;
  const open = !!(m && ((m.inhale && f.mf >= 6 && (f.vars.endAt == null || f.mf < f.vars.endAt - 12)) || m.id === 'inhaleCatch' || (m.eggLay && f.mf >= 14 && f.mf <= 26)));
  ex.mouthOpen.visible = open; ex.mouth.visible = !open;
  const suck = !!(m?.inhale && f.mf >= 21 && f.vars.endAt == null);
  ex.suck.visible = suck;
  if (suck) for (const st of ex.suck.children) {
    const u = st.userData, k = ((f.mf / 14) + u.ph) % 1;            // 0 far .. 1 at the mouth
    const r = u.r * (1 - k) + 0.02;
    st.position.set(Math.cos(u.a) * r, Math.sin(u.a) * r, 0.25 + (1 - k) * 1.3);
  }
  ex.blade.visible = !!(m && (m.finalCutter || m.id === 'uspecialLand'));
  const st = !!(m?.stone && f.vars.isStone);
  ex.stone.visible = st; view.bones.body.visible = !st;
}
export { COPYABLE };
