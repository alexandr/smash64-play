// Fox — move data from the decomp (src/chars/data/fox.js); model in models_fox.js, specials in specials_fox.js.
import { fox as model, FOX_PROPS, FOX_EXTRA_BONES } from './models_fox.js';
import { makeChar } from './build.js';
import { blaster, fireFox, fireFoxExtra, reflector, installFoxHooks, keyAnim } from './specials_fox.js';
import { P, runPose, walkPose } from '../render/anims.js';
import data from './data/fox.js';

const PI = Math.PI;
const ss = t => t * t * (3 - 2 * t);
const clamp01 = v => Math.max(0, Math.min(1, v));

// VS palettes per reference/chars/fox_palette_ssb.png: default (pale jacket, olive trousers, white boots),
// orange (red team), purple/navy (blue team), green/black (green team).
export const FOX_PALETTES = [
  { jacket: 0xd8dcc0, pants: 0x5c6a26, boot: 0xf2f2f2, scarf: 0xd02020, icon: 0xd88a38 },
  { jacket: 0xe07028, pants: 0x6a3a18, boot: 0xf0b020, scarf: 0xd02020, icon: 0xe07028 },
  { jacket: 0x7050c8, pants: 0x203878, boot: 0xd040d0, scarf: 0xd02020, icon: 0x7050c8 },
  { jacket: 0x30a040, pants: 0x262626, boot: 0xe02020, scarf: 0xd02020, icon: 0x30a040 },
];

// ---- stance / locomotion ----
const STANCE = { ...P.idle, root: [0, -0.035, 0], spine: [0.15, 0, 0], neck: [-0.05, 0, 0], thighL: [-0.45, 0, 0.12], thighR: [-0.1, 0, -0.12], shinL: [0.65, 0, 0], shinR: [0.5, 0, 0],
  footL: [-0.2, 0, 0], footR: [-0.35, 0, 0], upperArmL: [-0.35, 0, 0.3], upperArmR: [-0.2, 0, -0.35], foreArmL: [-1.0, 0, 0], foreArmR: [-0.9, 0, 0], extra1: [-0.3, 0, 0] };
function idle(f, t) {
  const s = Math.sin((t % 80) / 80 * 2 * PI);
  return { ...STANCE, root: [0, -0.035 + s * 0.008, 0], spine: [0.15 + s * 0.02, 0, 0], extra1: [-0.3 + s * 0.08, Math.sin(t * 0.05) * 0.2, 0] };
}
function run(f, t) {
  const ph = ((f.walkPhase ?? t / 20) % 1);
  const p = runPose(ph);
  const s = Math.sin(ph * 2 * PI);
  return { ...p, spine: [0.6, 0, 0], neck: [-0.45, 0, 0], upperArmL: [1.1, 0, 0.25], upperArmR: [1.1, 0, -0.25], foreArmL: [-0.3, 0, 0], foreArmR: [-0.3, 0, 0], extra1: [0.1 + s * 0.1, s * 0.2, 0] };
}
function walk(f, t) {
  const p = walkPose(((f.walkPhase ?? 0) % 1), Math.min(1, Math.abs(f.vx) / 36 + 0.3));
  return { ...p, extra1: [0.2, Math.sin((f.walkPhase ?? 0) * 2 * PI) * 0.25, 0] };
}

// ---- normals (data frame windows in comments) ----
const UTILT = { wind: { thighR: [0.5, 0, 0], shinR: [0.6, 0, 0], spine: [0.25, 0, 0] },
  strike: { thighR: [-2.9, 0, 0.1], shinR: [0.05, 0, 0], spine: [-0.35, 0, 0], thighL: [0.15, 0, 0.05], shinL: [0.3, 0, 0], upperArmL: [0.4, 0, 0.9], upperArmR: [0.6, 0, -0.7], root: [0, 0.02, 0] } };
const FTILT = (lift) => ({ wind: { thighR: [-0.5, 0, 0], shinR: [1.6, 0, 0], spine: [-0.1, 0.3, 0] },
  strike: { thighR: [-1.45 - lift, 0, 0.1], shinR: [0.05, 0, 0], spine: [-0.3 - lift * 0.3, -0.2, 0], thighL: [0.15, 0, 0], shinL: [0.35, 0, 0], upperArmL: [0.3, 0, 0.8], upperArmR: [-0.4, 0, -0.7], extra1: [0.4, 0, 0] } });
const DASH = { wind: { spine: [0.4, 0, 0], thighR: [-0.6, 0, 0], shinR: [0.9, 0, 0] },
  strike: { spine: [-0.3, 0, 0], thighL: [-1.55, 0, 0.05], shinL: [0.05, 0, 0], thighR: [0.35, 0, 0], shinR: [1.0, 0, 0], upperArmL: [0.4, 0, 1.2], upperArmR: [0.4, 0, -1.2], root: [0, 0.08, 0], extra1: [0.5, 0, 0] } };
const FSMASH = { wind: { spine: [0.25, 0.7, 0], chest: [0, 0.2, 0], thighL: [-1.0, 0, 0], shinL: [1.8, 0, 0], thighR: [-0.4, 0, 0], shinR: [0.8, 0, 0], root: [0, -0.07, 0], upperArmL: [-0.5, 0, 0.6], upperArmR: [0.4, 0, -0.6] },
  strike: { spine: [-0.4, -0.25, 0], thighL: [-1.62, 0, 0.1], shinL: [0.0, 0, 0], footL: [0.3, 0, 0], thighR: [0.3, 0, -0.05], shinR: [0.5, 0, 0], upperArmL: [0.6, 0, 0.9], upperArmR: [0.3, 0, -1.0], root: [0, 0.02, 0], extra1: [0.5, 0, 0] },
  follow: { spine: [-0.1, -0.5, 0], thighL: [-1.0, 0, 0.1], shinL: [0.6, 0, 0], thighR: [0.1, 0, 0], shinR: [0.4, 0, 0] } };
const NAIR = { wind: { thighL: [-0.6, 0, 0], shinL: [1.2, 0, 0], thighR: [-0.6, 0, 0], shinR: [1.6, 0, 0] },
  strike: { thighR: [-1.5, 0, 0], shinR: [0, 0, 0], thighL: [-0.3, 0, 0], shinL: [1.7, 0, 0], spine: [-0.3, 0, 0], upperArmL: [0, 0, 1.4], upperArmR: [0, 0, -1.4], extra1: [0.4, 0, 0] } };
const FAIR = { wind: { thighR: [-0.9, 0, 0], shinR: [1.8, 0, 0], spine: [0.3, 0, 0], thighL: [-0.6, 0, 0], shinL: [1.2, 0, 0] },
  strike: { thighR: [-1.55, 0, 0.1], shinR: [0.05, 0, 0], thighL: [-0.5, 0, 0], shinL: [1.5, 0, 0], spine: [-0.15, 0, 0], upperArmL: [0, 0, 1.2], upperArmR: [0.4, 0, -1.0], extra1: [0.5, 0, 0] } };
const BAIR = { wind: { spine: [0.4, 0, 0], thighR: [-0.9, 0, 0], shinR: [1.7, 0, 0] },
  strike: { spine: [0.55, 0, 0], thighR: [1.45, 0, 0], shinR: [0.05, 0, 0], thighL: [-0.8, 0, 0], shinL: [1.3, 0, 0], head: [-0.4, 0, 0], extra1: [0.6, 0, 0] } };
const UAIR = { wind: { spine: [0.4, 0, 0], thighR: [-0.5, 0, 0], shinR: [1.4, 0, 0] },
  strike: { spine: [-0.6, 0, 0], neck: [0.3, 0, 0], thighR: [-2.95, 0, 0], shinR: [0, 0, 0], thighL: [0.25, 0, 0], shinL: [0.7, 0, 0], upperArmL: [0.3, 0, 1.0], upperArmR: [0.3, 0, -1.0], extra1: [-0.6, 0, 0] } };
const JAB_L = { wind: { upperArmL: [-0.4, 0, 0.3], foreArmL: [-1.8, 0, 0], spine: [0.1, -0.3, 0] },
  strike: { upperArmL: [-1.55, 0, 0], foreArmL: [0, 0, 0], spine: [0.15, 0.35, 0], chest: [0, 0.2, 0], thighL: [-0.45, 0, 0.12], shinL: [0.6, 0, 0] } };
const JAB_R = { wind: { upperArmR: [-0.4, 0, -0.3], foreArmR: [-1.8, 0, 0], spine: [0.1, 0.3, 0] },
  strike: { upperArmR: [-1.55, 0, 0], foreArmR: [0, 0, 0], spine: [0.15, -0.35, 0], chest: [0, -0.2, 0], thighL: [-0.45, 0, 0.12], shinL: [0.6, 0, 0] } };

// Rapid kicks: 8-frame start, 38-frame loop (frames 9-46) with a kick extended every 7 frames (10, 17, ...)
function jabRapid(f, mf) {
  const base = { ...STANCE, spine: [-0.15, 0, 0], upperArmL: [0.2, 0, 0.6], upperArmR: [0.2, 0, -0.6], thighR: [0.15, 0, -0.1], shinR: [0.4, 0, 0] };
  if (mf < 8) return { ...base, thighL: [-0.4 - mf * 0.1, 0, 0], shinL: [1.5, 0, 0] };
  if (mf > 46) { const k = clamp01((mf - 46) / 7); return { ...base, thighL: [-1.2 + k * 0.75, 0, 0.12], shinL: [1.5 - k * 0.85, 0, 0] }; }
  const k = 0.5 + 0.5 * Math.cos(2 * PI * (mf - 10) / 7);
  return { ...base, thighL: [-0.7 - 0.9 * k, 0, 0.05], shinL: [1.5 * (1 - k) + 0.05, 0, 0], body: [0, Math.sin(mf * 0.9) * 0.08, 0] };
}
// Tail sweep: crouch and spin so the tail sweeps through the front on frames 6-9
function dtilt(f, mf) {
  const c = { ...P.crouch, extra1: [-0.25, 0, 0], upperArmL: [-0.2, 0, 0.8], upperArmR: [-0.2, 0, -0.8] };
  const k = mf <= 4 ? ss(mf / 4) * 0.7 : mf <= 10 ? 0.7 + (mf - 4) / 6 * 0.6 : 1.3 + 0.7 * ss(clamp01((mf - 10) / 12));
  return { ...c, body: [0, -PI * k, 0] };
}
// Back-flip kick: right leg up on frames 6-9 (16%), late hit to 21
function usmash(f, mf) {
  const tt = clamp01((mf - 4) / 15), th = mf < 4 ? 0 : -2 * PI * (1 - (1 - tt) * (1 - tt));
  const air = mf >= 5 && mf <= 22 ? Math.sin(PI * (mf - 5) / 17) * 0.12 : 0;
  const pre = { ...P.crouch, root: [0, -0.1, 0] };
  const flip = { spine: [-0.1, 0, 0], thighR: [-0.6, 0, 0], shinR: [0, 0, 0], thighL: [-0.3, 0, 0], shinL: [1.1, 0, 0], upperArmL: [0, 0, 1.3], upperArmR: [0, 0, -1.3], extra1: [0.3, 0, 0] };
  let p;
  if (mf < 4) p = keyAnim([{ f: 0, pose: STANCE }, { f: 4, pose: pre }])(f, mf);
  else if (mf <= 21) p = { ...flip };
  else p = keyAnim([{ f: 21, pose: { ...P.land } }, { f: 30, pose: P.land }, { f: 59, pose: STANCE }])(f, mf);
  const c = 0.5;
  return { ...p, body: [th, 0, 0], root: [0, c - c * Math.cos(th) + air + (mf < 4 ? p.root?.[1] ?? 0 : 0), -c * Math.sin(th)] };
}
const DSMASH_STRIKE = { root: [0, -0.24, 0], spine: [0.05, 0, 0], thighL: [-1.5, 0, 0.1], shinL: [0, 0, 0], footL: [0.4, 0, 0], thighR: [1.45, 0, -0.1], shinR: [0, 0, 0], footR: [-0.4, 0, 0],
  upperArmL: [0, 0, 1.3], upperArmR: [0, 0, -1.3], extra1: [0.6, 0, 0] };
const dsmash = keyAnim([{ f: 0, pose: STANCE }, { f: 4, pose: { ...P.crouch, root: [0, -0.14, 0] } }, { f: 6, pose: DSMASH_STRIKE }, { f: 12, pose: DSMASH_STRIKE },
  { f: 26, pose: { ...DSMASH_STRIKE, root: [0, -0.2, 0], thighL: [-1.2, 0, 0.1], thighR: [1.1, 0, -0.1] } }, { f: 49, pose: STANCE }]);
function dair(f, mf) {
  const base = { spine: [-0.15, 0, 0], thighL: [-0.25, 0, 0.12], thighR: [-0.25, 0, -0.12], shinL: [0.1, 0, 0], shinR: [0.1, 0, 0], footL: [0.5, 0, 0], footR: [0.5, 0, 0],
    upperArmL: [0, 0, 1.4], upperArmR: [0, 0, -1.4], extra1: [0.8, 0, 0] };
  if (mf < 3) return keyAnim([{ f: 0, pose: P.fall }, { f: 3, pose: base }])(f, mf);
  if (mf <= 24) return { ...base, body: [0, (mf - 3) * 0.9, 0] };
  return keyAnim([{ f: 24, pose: base }, { f: 49, pose: P.fall }])(f, mf);
}
const TAUNT_A = { ...STANCE, thighL: [-0.3, 0, 0.35], thighR: [0.0, 0, -0.35], shinL: [0.4, 0, 0], shinR: [0.4, 0, 0], upperArmR: [-1.3, -0.3, -0.2], foreArmR: [-0.2, 0, 0], handR: [0, 0, 0],
  upperArmL: [0.0, 0, 0.35], foreArmL: [-1.6, 0, 0], head: [-0.1, 0.2, 0], spine: [0.05, 0, 0] };
function taunt(f, mf) {
  if (mf < 10) return keyAnim([{ f: 0, pose: STANCE }, { f: 10, pose: TAUNT_A }])(f, mf);
  if (mf > 48) return keyAnim([{ f: 48, pose: TAUNT_A }, { f: 59, pose: STANCE }])(f, mf);
  const k = 0.5 + 0.5 * Math.sin((mf - 10) * 0.45);
  return { ...TAUNT_A, foreArmR: [-0.2 - 1.3 * k, 0, 0], handR: [-0.6 * k, 0, 0] };
}

export const fox = makeChar({
  id: 'fox', name: 'Fox', series: 'starfox', data, model, props: FOX_PROPS, extraBones: FOX_EXTRA_BONES,
  palettes: FOX_PALETTES,
  boneMap: { tail: 'extra1', item: 'handR' },
  anims: { idle, run, dash: run, walk },
  moves: {
    jab1: { anim: JAB_L },
    jab2: { anim: JAB_R, next: 'jabRapid', nextAt: 10 },
    jabRapid: { anim: jabRapid, loop: [9, 46] },
    ftilt: { anim: FTILT(0) }, ftiltHi: { anim: FTILT(0.45) }, ftiltMidHi: { anim: FTILT(0.22) }, ftiltMidLo: { anim: FTILT(-0.2) }, ftiltLo: { anim: FTILT(-0.4) },
    utilt: { anim: UTILT },
    dtilt: { anim: dtilt, endSquat: true },
    dashattack: { anim: DASH },
    fsmash: { anim: FSMASH },
    usmash: { anim: usmash },
    dsmash: { anim: dsmash },
    nair: { anim: NAIR }, fair: { anim: FAIR }, bair: { anim: BAIR }, uair: { anim: UAIR }, dair: { anim: dair },
    taunt: { anim: taunt },
    bthrow: { anim: { wind: { ...P.grabhold }, strike: { body: [0, PI, 0], spine: [-0.2, 0, 0], thighL: [-1.55, 0, 0.1], shinL: [0.05, 0, 0], thighR: [0.2, 0, 0], shinR: [0.4, 0, 0], upperArmL: [0.3, 0, 1.0], upperArmR: [0.3, 0, -1.0] } } },
    nspecial: blaster(false),
    nspecialAir: blaster(true),
    uspecial: fireFox(),
    uspecialAir: fireFox(),
    dspecial: reflector(),
    dspecialAir: reflector(),
    ...fireFoxExtra,
  },
  extraMoves: { ...fireFoxExtra, nspecialAir: data.moves.nspecial, uspecialAir: data.moves.uspecial, dspecialAir: data.moves.dspecial },
  init(f) { installFoxHooks(f); },
  animExtra(view, f, pose) {
    const x = view.extra; if (!x.gunHand) return;
    const id = f.state === 'attack' ? f.move?.id : null;
    const gun = id === 'nspecial' || id === 'nspecialAir';
    x.gunHand.visible = gun; x.gunHip.visible = !gun;
    x.refl.visible = !!f.reflecting;
    if (x.refl.visible) { const s = 1 + Math.sin(f.mf * 1.3) * 0.04; x.refl.scale.setScalar(s); x.refl.rotation.x = f.mf * 0.05; }
    const ff = id === 'uspecial' || id === 'uspecialAir';
    x.fire.visible = ff && f.mf > 4;
    if (x.fire.visible) {
      const travel = f.mf >= 43;
      const s = travel ? 1.15 : 0.8 + Math.sin(f.mf * 2.1) * 0.1;
      x.fire.scale.set(s, travel ? s * 1.4 : s, s);
      x.flames.forEach((c, i) => { c.scale.y = 0.7 + 0.5 * Math.abs(Math.sin(f.mf * 0.9 + i * 1.7)); });
      x.core.material.opacity = travel ? 0.5 : 0.25;
    }
  },
});
