// Pikachu — move data from the decomp (src/chars/data/pikachu.js); model in models_pikachu.js, specials in
// specials_pikachu.js.
import { pikachu as model, PIKA_PROPS, PIKA_EXTRA_BONES } from './models_pikachu.js';
import { makeChar } from './build.js';
import { thunderJolt, quickAttack, thunder, thunderHit } from './specials_pikachu.js';
import { P, walkPose } from '../render/anims.js';
import { sampleKeys } from '../render/rig.js';
import data from './data/pikachu.js';

const PI = Math.PI;
const clamp01 = v => Math.max(0, Math.min(1, v));
const ss = t => t * t * (3 - 2 * t);
const keyAnim = (keys) => (f, mf) => sampleKeys(keys, mf);

// VS palettes (reference/chars/pikachu_palette_ssb.png): plain, then party hats (red / blue / green).
export const PIKA_PALETTES = [
  { body: 0xffd820, icon: 0xffd820 },
  { body: 0xffc828, hat: 0xd82020, hatDot: 0xf8e040, hatTip: 0xf070a0, icon: 0xd82020 },
  { body: 0xffda30, hat: 0x2040d8, hatDot: 0xffffff, hatTip: 0xe8e8f0, icon: 0x2040d8 },
  { body: 0xf0d828, hat: 0x20a030, hatDot: 0xe0f040, hatTip: 0xa0f040, icon: 0x20a030 },
];

// ---- stance / locomotion ----
const STANCE = { root: [0, -0.01, 0], spine: [0.22, 0, 0], neck: [-0.15, 0, 0], head: [0, 0, 0], upperArmL: [-0.9, 0, 0.25], upperArmR: [-0.9, 0, -0.25], foreArmL: [-0.9, 0, 0], foreArmR: [-0.9, 0, 0],
  thighL: [-0.35, 0, 0.12], thighR: [-0.35, 0, -0.12], shinL: [0.55, 0, 0], shinR: [0.55, 0, 0], footL: [-0.2, 0, 0], footR: [-0.2, 0, 0], extra1: [0, 0, 0] };
function idle(f, t) {
  const s = Math.sin((t % 50) / 50 * 2 * PI);
  return { ...STANCE, root: [0, -0.01 + Math.abs(s) * 0.012, 0], spine: [0.22 + s * 0.03, 0, 0], extra1: [s * 0.08, Math.sin(t * 0.07) * 0.15, 0] };
}
// on all fours: body pitched forward, front paws reaching for the ground
function quad(ph, amp = 1) {
  const s = Math.sin(ph * 2 * PI), c = Math.cos(ph * 2 * PI);
  return { body: [1.35, 0, 0], root: [0, 0.13 + Math.abs(c) * 0.035 * amp, -0.2], spine: [0.0, 0, 0], neck: [-0.15, 0, 0], head: [-0.75, 0, 0],
    upperArmL: [-1.35 + 0.65 * s * amp, 0, 0.12], upperArmR: [-1.35 + 0.65 * s * amp, 0, -0.12], foreArmL: [0.1, 0, 0], foreArmR: [0.1, 0, 0],
    thighL: [-1.25 - 0.6 * s * amp, 0, 0.12], thighR: [-1.25 - 0.6 * s * amp, 0, -0.12], shinL: [0.3 + 0.4 * Math.max(0, c), 0, 0], shinR: [0.3 + 0.4 * Math.max(0, c), 0, 0], footL: [0.4, 0, 0], footR: [0.4, 0, 0],
    extra1: [-0.5 + s * 0.15, 0, 0] };
}
function run(f, t) { return quad(((f.walkPhase ?? t / 15) % 1), 1); }
function walk(f, t) {
  const p = walkPose(((f.walkPhase ?? 0) % 1), Math.min(1, Math.abs(f.vx) / 33 + 0.3));
  return { ...p, spine: [0.25, 0, 0], upperArmL: [-0.9, 0, 0.3], upperArmR: [-0.9, 0, -0.3], foreArmL: [-0.8, 0, 0], foreArmR: [-0.8, 0, 0], extra1: [0, Math.sin((f.walkPhase ?? 0) * 2 * PI) * 0.25, 0] };
}

// ---- normals ----
const HEADBUTT = { ...STANCE, spine: [0.75, 0, 0], neck: [0.25, 0, 0], head: [0.15, 0, 0], root: [0, -0.02, 0.1], thighL: [-0.8, 0, 0.1], shinL: [0.7, 0, 0], thighR: [0.2, 0, -0.1], shinR: [0.4, 0, 0], upperArmL: [0.6, 0, 0.4], upperArmR: [0.6, 0, -0.4] };
const jab1 = keyAnim([{ f: 0, pose: STANCE }, { f: 2, pose: HEADBUTT }, { f: 6, pose: HEADBUTT }, { f: 16, pose: STANCE }]);
// both-feet kick, leaning back on the tail
const FTILT = (lift) => ({ wind: { ...STANCE, spine: [0.3, 0, 0], thighL: [-1.3, 0, 0.1], thighR: [-1.3, 0, -0.1], shinL: [1.5, 0, 0], shinR: [1.5, 0, 0], root: [0, -0.05, 0] },
  strike: { root: [0, -0.07 + lift * 0.1, 0.08], spine: [-0.55, 0, 0], neck: [0.35, 0, 0], thighL: [-1.5 - lift, 0, 0.12], thighR: [-1.5 - lift, 0, -0.12], shinL: [0.0, 0, 0], shinR: [0.0, 0, 0], footL: [0.5, 0, 0], footR: [0.5, 0, 0],
    upperArmL: [0.9, 0, 0.3], upperArmR: [0.9, 0, -0.3], extra1: [-0.7, 0, 0] } });
// tail swipe up and over the head (frames 5-14)
const utilt = keyAnim([{ f: 0, pose: STANCE }, { f: 4, pose: { ...STANCE, spine: [0.4, 0, 0], extra1: [-0.7, 0, 0] } }, { f: 5, pose: { ...STANCE, spine: [0.3, 0, 0], extra1: [-0.2, 0, 0] } },
  { f: 9, pose: { ...STANCE, spine: [0.1, 0, 0], head: [0.2, 0, 0], extra1: [1.0, 0, 0] } }, { f: 14, pose: { ...STANCE, spine: [0.3, 0, 0], extra1: [2.0, 0, 0] } }, { f: 25, pose: STANCE }]);
// low tail sweep: crouch and spin, tail level with the floor (frames 6-13)
function dtilt(f, mf) {
  const c = { ...P.crouch, root: [0, -0.06, 0], spine: [0.6, 0, 0], neck: [-0.5, 0, 0], extra1: [-0.85, 0, 0] };
  const k = mf <= 5 ? ss(mf / 5) * 0.75 : mf <= 13 ? 0.75 + (mf - 5) / 8 * 0.6 : 1.35 + 0.65 * ss(clamp01((mf - 13) / 8));
  return { ...c, body: [0, -PI * k, 0] };
}
const DASH = keyAnim([{ f: 0, pose: STANCE }, { f: 3, pose: { ...STANCE, spine: [0.5, 0, 0], root: [0, -0.06, 0] } },
  { f: 5, pose: { body: [1.35, 0, 0], root: [0, 0.18, 0.05], neck: [-0.4, 0, 0], upperArmL: [-2.6, 0, 0.3], upperArmR: [-2.6, 0, -0.3], thighL: [0.5, 0, 0.1], thighR: [0.5, 0, -0.1], shinL: [0.3, 0, 0], shinR: [0.3, 0, 0], extra1: [-1.2, 0, 0] } },
  { f: 18, pose: { body: [1.4, 0, 0], root: [0, 0.1, 0.1], neck: [-0.4, 0, 0], upperArmL: [-2.6, 0, 0.3], upperArmR: [-2.6, 0, -0.3], thighL: [0.5, 0, 0.1], thighR: [0.5, 0, -0.1], extra1: [-1.2, 0, 0] } },
  { f: 30, pose: { ...P.crouch, body: [2 * PI, 0, 0] } }, { f: 57, pose: { ...STANCE, body: [2 * PI, 0, 0] } }]);
// Thunder Shock (fsmash): charge, then lean in with the field in front (frames 21-42)
const FS_WIND = { ...STANCE, root: [0, -0.06, 0], spine: [-0.15, 0, 0], head: [-0.2, 0, 0], upperArmL: [0.3, 0, 0.9], upperArmR: [0.3, 0, -0.9], thighL: [-0.7, 0, 0.2], thighR: [-0.7, 0, -0.2], shinL: [1.0, 0, 0], shinR: [1.0, 0, 0], extra1: [0.4, 0, 0] };
const FS_HIT = { ...STANCE, root: [0, -0.03, 0.04], spine: [0.55, 0, 0], neck: [-0.2, 0, 0], upperArmL: [-1.4, 0, 0.3], upperArmR: [-1.4, 0, -0.3], foreArmL: [0, 0, 0], foreArmR: [0, 0, 0], thighL: [-0.7, 0, 0.12], shinL: [0.8, 0, 0], thighR: [0.3, 0, -0.12], shinR: [0.3, 0, 0], extra1: [0.6, 0, 0] };
const fsmash = keyAnim([{ f: 0, pose: STANCE }, { f: 12, pose: FS_WIND }, { f: 19, pose: FS_WIND }, { f: 21, pose: FS_HIT }, { f: 42, pose: FS_HIT }, { f: 61, pose: STANCE }]);
// front flip swinging the tail overhead (tail on top at frames 10-12)
function usmash(f, mf) {
  const k = clamp01((mf - 7) / 22);
  const th = Math.min(2 * PI, Math.max(0, (mf - 8) * 0.3));
  const tuck = { root: [0, 0, 0], spine: [0.3, 0, 0], upperArmL: [-0.5, 0, 0.5], upperArmR: [-0.5, 0, -0.5], thighL: [-1.0, 0, 0.1], thighR: [-1.0, 0, -0.1], shinL: [1.3, 0, 0], shinR: [1.3, 0, 0], extra1: [0.2, 0, 0] };
  if (mf < 7) return { ...keyAnim([{ f: 0, pose: STANCE }, { f: 7, pose: { ...P.crouch, root: [0, -0.08, 0], extra1: [-0.5, 0, 0] } }])(f, mf) };
  if (mf > 29) return keyAnim([{ f: 29, pose: { ...P.land, body: [2 * PI, 0, 0] } }, { f: 39, pose: { ...STANCE, body: [2 * PI, 0, 0] } }])(f, mf);
  const c = 0.3, air = Math.sin(PI * k) * 0.25;
  return { ...tuck, body: [th, 0, 0], root: [0, c - c * Math.cos(th) + air, -c * Math.sin(th)] };
}
const DS_BASE = { root: [0, -0.07, 0], spine: [0.3, 0, 0], neck: [-0.2, 0, 0], thighL: [-1.45, 0, 0.2], thighR: [1.3, 0, -0.2], shinL: [0.1, 0, 0], shinR: [0.1, 0, 0], upperArmL: [0.2, 0, 1.2], upperArmR: [0.2, 0, -1.2], extra1: [-0.6, 0, 0] };
function dsmash(f, mf) {
  if (mf < 8) return keyAnim([{ f: 0, pose: STANCE }, { f: 8, pose: { ...P.crouch, root: [0, -0.1, 0] } }])(f, mf);
  if (mf > 32) return keyAnim([{ f: 32, pose: { ...DS_BASE, body: [0, 0, 0] } }, { f: 53, pose: STANCE }])(f, mf);
  return { ...DS_BASE, body: [0, (mf - 8) * 0.52 * (mf > 28 ? 0 : 1) + (mf > 28 ? 20 * 0.52 : 0), 0] };
}
// curled spinning body (nair), electric drills (fair / dair), back kick, tail flip (uair)
const BALL = { spine: [0.6, 0, 0], neck: [0.3, 0, 0], upperArmL: [-1.5, 0, 0.3], upperArmR: [-1.5, 0, -0.3], foreArmL: [-1.2, 0, 0], foreArmR: [-1.2, 0, 0],
  thighL: [-1.8, 0, 0.15], thighR: [-1.8, 0, -0.15], shinL: [1.6, 0, 0], shinR: [1.6, 0, 0], extra1: [-0.3, 0, 0] };
function nair(f, mf) {
  if (mf < 3) return keyAnim([{ f: 0, pose: P.fall }, { f: 3, pose: BALL }])(f, mf);
  if (mf > 28) return keyAnim([{ f: 28, pose: BALL }, { f: 36, pose: P.fall }])(f, mf);
  return { ...BALL, body: [(mf - 3) * 0.55, 0, 0], root: [0, 0.3 - 0.3 * Math.cos((mf - 3) * 0.55), -0.3 * Math.sin((mf - 3) * 0.55)] };
}
const DRILL = { spine: [0.1, 0, 0], neck: [0.4, 0, 0], upperArmL: [-2.8, 0, 0.2], upperArmR: [-2.8, 0, -0.2], thighL: [0.3, 0, 0.05], thighR: [0.3, 0, -0.05], shinL: [0.2, 0, 0], shinR: [0.2, 0, 0], extra1: [-1.4, 0, 0] };
function fair(f, mf) {
  if (mf < 6) return keyAnim([{ f: 0, pose: P.fall }, { f: 6, pose: { ...DRILL, body: [1.3, 0, 0], root: [0, 0.3, -0.25] } }])(f, mf);
  if (mf > 27) return keyAnim([{ f: 27, pose: { ...DRILL, body: [1.3, 0, 0], root: [0, 0.3, -0.25] } }, { f: 39, pose: P.fall }])(f, mf);
  return { ...DRILL, body: [1.3, 0, 0], root: [0, 0.3, -0.25], spine: [0.1, (mf - 6) * 0.9, 0] };
}
function dair(f, mf) {
  const D = { ...DRILL, body: [PI * 0.92, 0, 0], root: [0, 0.75, 0.05] };
  if (mf < 7) return keyAnim([{ f: 0, pose: P.fall }, { f: 7, pose: D }])(f, mf);
  if (mf > 26) return keyAnim([{ f: 26, pose: D }, { f: 44, pose: P.fall }])(f, mf);
  return { ...D, spine: [0.1, (mf - 7) * 0.9, 0] };
}
const BAIR = { wind: { spine: [0.4, 0, 0], thighR: [-1.0, 0, 0], thighL: [-1.0, 0, 0], shinR: [1.6, 0, 0], shinL: [1.6, 0, 0] },
  strike: { body: [0.5, 0, 0], spine: [0.3, 0, 0], neck: [-0.6, 0, 0], thighR: [1.5, 0, -0.1], shinR: [0.05, 0, 0], thighL: [1.2, 0, 0.1], shinL: [0.3, 0, 0], upperArmL: [-0.5, 0, 0.6], upperArmR: [-0.5, 0, -0.6], extra1: [0.8, 0, 0] } };
function uair(f, mf) {
  const th = Math.min(2 * PI, Math.max(0, (mf - 2) * 0.33));
  if (mf > 21) return keyAnim([{ f: 21, pose: { ...P.fall, body: [2 * PI, 0, 0] } }, { f: 33, pose: { ...P.fall, body: [2 * PI, 0, 0] } }])(f, mf);
  const tuck = { spine: [0.4, 0, 0], thighL: [-1.2, 0, 0.1], thighR: [-1.2, 0, -0.1], shinL: [1.4, 0, 0], shinR: [1.4, 0, 0], upperArmL: [-0.8, 0, 0.4], upperArmR: [-0.8, 0, -0.4], extra1: [0.3, 0, 0] };
  const c = 0.3;
  return { ...tuck, body: [th, 0, 0], root: [0, c - c * Math.cos(th), -c * Math.sin(th)] };
}
// "Pika pika!": turns to the camera, arms up
const TAUNT = { ...STANCE, body: [0, -1.2, 0], spine: [0.0, 0, 0], head: [-0.15, 0, 0], upperArmL: [-0.4, 0, 2.3], upperArmR: [-0.4, 0, -2.3], foreArmL: [-0.4, 0, 0], foreArmR: [-0.4, 0, 0] };
function taunt(f, mf) {
  if (mf < 10) return keyAnim([{ f: 0, pose: STANCE }, { f: 10, pose: TAUNT }])(f, mf);
  if (mf > 66) return keyAnim([{ f: 66, pose: TAUNT }, { f: 79, pose: STANCE }])(f, mf);
  const s = Math.sin((mf - 10) * 0.4);
  return { ...TAUNT, root: [0, Math.abs(s) * 0.05, 0], upperArmL: [-0.4, 0, 2.0 + s * 0.4], upperArmR: [-0.4, 0, -2.0 - s * 0.4] };
}
const TAIL_TIP = [0, 82, -88];

export const pikachu = makeChar({
  id: 'pikachu', name: 'Pikachu', series: 'pokemon', data, model, props: PIKA_PROPS, extraBones: PIKA_EXTRA_BONES,
  palettes: PIKA_PALETTES, modelScale: 1,
  boneMap: { tail: 'extra1', item: 'handR' },
  anims: { idle, run, dash: run, walk },
  moves: {
    jab1: { anim: jab1 },
    ftilt: { anim: FTILT(0) }, ftiltHi: { anim: FTILT(0.3) }, ftiltLo: { anim: FTILT(-0.3) },
    utilt: { anim: utilt, hitboxPatch: h => (h.off?.[0] ? { off: TAIL_TIP } : {}) },
    dtilt: { anim: dtilt, endSquat: true, hitboxPatch: h => (h.off?.[0] ? { off: TAIL_TIP } : {}) },
    dashattack: { anim: DASH },
    fsmash: { anim: fsmash, sfx: 'elec' },
    usmash: { anim: usmash, hitboxPatch: h => (h.off?.[0] ? { off: TAIL_TIP } : {}) },
    dsmash: { anim: dsmash },
    nair: { anim: nair }, fair: { anim: fair, sfx: 'elec' }, bair: { anim: BAIR },
    uair: { anim: uair, hitboxPatch: h => (h.off?.[0] ? { off: TAIL_TIP } : {}) },
    dair: { anim: dair, sfx: 'elec' },
    taunt: { anim: taunt },
    nspecial: thunderJolt(), nspecialAir: thunderJolt(),
    uspecial: quickAttack(), uspecialAir: quickAttack(),
    dspecial: thunder(), dspecialAir: thunder(),
    thunderHit,
  },
  extraMoves: { thunderHit, nspecialAir: data.moves.nspecial, uspecialAir: data.moves.uspecial, dspecialAir: data.moves.dspecial },
  init(f) { f.onLand = (st) => (st === 'attack' && f.move?.landHook ? f.move.landHook(f, st) === true : false); },
  animExtra(view, f) {
    const x = view.extra; if (!x.aura) return;
    const id = f.state === 'attack' ? f.move?.id : null, mf = f.mf;
    const aura = (id === 'fair' && mf >= 6 && mf <= 27) || (id === 'dair' && mf >= 7 && mf <= 26) || (id === 'thunderHit' && mf <= 20) ||
      ((id === 'dspecial' || id === 'dspecialAir') && mf >= 10 && mf <= 30) || ((id === 'nspecial' || id === 'nspecialAir') && mf >= 14 && mf <= 22);
    x.aura.visible = aura;
    if (aura) { const s = id === 'thunderHit' ? 1.6 + mf * 0.03 : id?.startsWith('nspecial') ? 0.7 + Math.sin(mf * 1.9) * 0.1 : 1 + Math.sin(mf * 1.9) * 0.1; x.aura.scale.setScalar(s); x.bolts.forEach((b, i) => { b.scale.y = 0.6 + Math.abs(Math.sin(mf * 1.3 + i)); }); x.aura.rotation.x = mf * 0.4; }
    x.field.visible = id === 'fsmash' && mf >= 20 && mf <= 42;
    if (x.field.visible) x.field.children.forEach((c, i) => { c.rotation.y += 0.7; if (c.material) c.material.opacity = 0.3 + 0.5 * Math.abs(Math.sin(mf * 1.7 + i)); });
    const zip = (id === 'uspecial' || id === 'uspecialAir') && f.vars.phase === 'zip';
    x.streak.visible = zip;
    if (zip) { const a = Math.atan2(f.vars.zvy, Math.abs(f.vars.zvx)); x.streak.rotation.set(PI / 2 - a, 0, 0); }
  },
});
