// Ness — move data from the decomp (src/chars/data/ness.js); model in models_ness.js, specials in specials_ness.js.
import { ness as model, NESS_PROPS, NESS_EXTRA_BONES } from './models_ness.js';
import { makeChar } from './build.js';
import { pkFire, pkThunder, pkThunder2, psiMagnet, installNessHooks } from './specials_ness.js';
import { P, walkPose, runPose } from '../render/anims.js';
import { sampleKeys } from '../render/rig.js';
import data from './data/ness.js';

const PI = Math.PI;
const clamp01 = v => Math.max(0, Math.min(1, v));
const lerp = (a, b, t) => a + (b - a) * t;
const keyAnim = (keys) => (f, mf) => sampleKeys(keys, mf);

// VS palettes (reference/chars/ness_palette_ssb.png): red cap / purple bill, yellow-purple stripes, purple
// shorts, red shoes; yellow+black; blue cap / pink bill with magenta shorts; green cap / orange bill & shorts.
export const NESS_PALETTES = [
  { cap: 0xe01818, bill: 0x5038c0, stripe1: 0xf0d020, stripe2: 0x5a40c8, shorts: 0x5a3cc8, shoe: 0xe02020, pack: 0xc87828, pack2: 0x8a4a18, icon: 0xe01818 },
  { cap: 0xf0c018, bill: 0x202020, stripe1: 0xf0d020, stripe2: 0x262626, shorts: 0x262626, shoe: 0xf0c018, pack: 0xc87828, pack2: 0x8a4a18, icon: 0xf0c018 },
  { cap: 0x2034e0, bill: 0xe060a0, stripe1: 0xf0d020, stripe2: 0x5a40c8, shorts: 0xc03080, shoe: 0x2034e0, pack: 0xc87828, pack2: 0x8a4a18, icon: 0x2034e0 },
  { cap: 0x20a030, bill: 0xf07020, stripe1: 0xe8d838, stripe2: 0x6a8a30, shorts: 0xf07020, shoe: 0x20a030, pack: 0xc87828, pack2: 0x8a4a18, icon: 0x20a030 },
];

// ---- stance / locomotion ----
const STANCE = { ...P.idle, root: [0, -0.012, 0], spine: [0.05, 0, 0], upperArmL: [-0.2, 0, 0.3], upperArmR: [-0.2, 0, -0.3], foreArmL: [-0.7, 0, 0], foreArmR: [-0.7, 0, 0],
  thighL: [-0.15, 0, 0.08], thighR: [0.05, 0, -0.08], shinL: [0.25, 0, 0], shinR: [0.2, 0, 0] };
function idle(f, t) { const s = Math.sin((t % 70) / 70 * 2 * PI); return { ...STANCE, root: [0, -0.012 + s * 0.008, 0], head: [s * 0.03, 0, 0] }; }
function run(f, t) { const p = runPose(((f.walkPhase ?? t / 20) % 1)); return { ...p, spine: [0.3, 0, 0], neck: [-0.2, 0, 0] }; }

// ---- yo-yo path (game units: [forward, up]) ----
const HAND = [55, 105];
function arcPos(th, R, cy = 160) { return [Math.cos(th) * R, cy + Math.sin(th) * R]; }
export function yoyoPos(id, mf) {
  if (id === 'usmash') {
    if (mf < 10) return HAND;
    if (mf < 13) { const k = (mf - 10) / 3; const p = arcPos(25 * PI / 180, 230); return [lerp(HAND[0], p[0], k), lerp(HAND[1], p[1], k)]; }
    if (mf <= 25) return arcPos((25 + (mf - 13) / 12 * 140) * PI / 180, 230);
    const k = clamp01((mf - 25) / 8), p = arcPos(165 * PI / 180, 230);
    return [lerp(p[0], HAND[0], k), lerp(p[1], HAND[1], k)];
  }
  if (id === 'dsmash') {
    const keys = [[0, HAND], [10, [70, 60]], [13, [240, 40]], [20, [330, 40]], [24, [330, 40]], [34, [-310, 40]], [50, [-330, 40]], [54, HAND]];
    for (let i = 1; i < keys.length; i++) if (mf <= keys[i][0]) {
      const [f0, p0] = keys[i - 1], [f1, p1] = keys[i], k = (mf - f0) / (f1 - f0);
      return [lerp(p0[0], p1[0], k), lerp(p0[1], p1[1], k)];
    }
    return HAND;
  }
  return HAND;
}
const yoyoHitboxes = (id) => data.moves[id].hitboxes.map(h => {
  const path = {}; for (let f = h.frames[0]; f <= h.frames[1]; f++) path[f] = yoyoPos(id, f).map(Math.round);
  return { ...h, size: h.r, path, pos: path[h.frames[0]] };
});

// ---- normals ----
const FTILT = (lift) => ({ wind: { thighL: [-0.5, 0, 0], shinL: [1.6, 0, 0], spine: [-0.1, -0.3, 0] },
  strike: { thighL: [-1.45 - lift, 0, 0.1], shinL: [0.05, 0, 0], spine: [-0.3, 0.2, 0], thighR: [0.15, 0, 0], shinR: [0.35, 0, 0], upperArmL: [0.4, 0, 0.8], upperArmR: [-0.3, 0, -0.8] } });
const JAB3 = { wind: { thighL: [-0.6, 0, 0], shinL: [1.6, 0, 0], spine: [-0.1, 0, 0] },
  strike: { thighL: [-1.5, 0, 0], shinL: [0, 0, 0], spine: [-0.3, 0, 0], upperArmL: [0.5, 0, 0.6], upperArmR: [0.5, 0, -0.6] } };
const UTILT = { wind: { upperArmL: [-0.5, 0, 0.2], upperArmR: [-0.5, 0, -0.2], foreArmL: [-0.3, 0, 0], foreArmR: [-0.3, 0, 0], spine: [0.25, 0, 0], root: [0, -0.03, 0] },
  strike: { upperArmL: [-3.0, 0, 0.15], upperArmR: [-3.0, 0, -0.15], foreArmL: [-0.2, 0, 0], foreArmR: [-0.2, 0, 0], spine: [-0.2, 0, 0], head: [-0.3, 0, 0] },
  follow: { upperArmL: [-3.6, 0, 0.3], upperArmR: [-3.6, 0, -0.3], spine: [-0.3, 0, 0], head: [-0.3, 0, 0] } };
const DASH = { wind: { spine: [0.1, 0, 0], upperArmL: [0.3, 0, 0.3], upperArmR: [0.3, 0, -0.3], foreArmL: [-1.4, 0, 0], foreArmR: [-1.4, 0, 0] },
  strike: { spine: [0.3, 0, 0], upperArmL: [-1.5, 0, 0.12], upperArmR: [-1.5, 0, -0.12], foreArmL: [0, 0, 0], foreArmR: [0, 0, 0], handL: [0.6, 0, 0], handR: [0.6, 0, 0],
    thighL: [-0.8, 0, 0], shinL: [0.6, 0, 0], thighR: [0.4, 0, 0], shinR: [0.3, 0, 0], root: [0, -0.02, 0.05] } };
// bat swing: wind back over the shoulder, horizontal swing on frames 18-21
const BAT_WIND = { ...STANCE, spine: [0.0, 0.7, 0], chest: [0, 0.3, 0], upperArmR: [2.3, 0, -0.35], foreArmR: [-0.3, 0, 0], upperArmL: [1.6, 0, 0.6], foreArmL: [-0.6, 0, 0],
  thighL: [-0.6, 0, 0.1], shinL: [0.6, 0, 0], thighR: [0.2, 0, -0.1], shinR: [0.4, 0, 0], extra1: [0, 0, 0] };
const BAT_HIT = { ...STANCE, spine: [0.0, -0.5, 0], chest: [0, -0.2, 0], upperArmR: [-1.85, 0, 0], foreArmR: [0, 0, 0], upperArmL: [-1.3, 0, 0.1], foreArmL: [-0.3, 0, 0],
  thighL: [-0.9, 0, 0.1], shinL: [0.9, 0, 0], thighR: [0.45, 0, -0.1], shinR: [0.3, 0, 0], root: [0, -0.03, 0.04] };
const BAT_FOLLOW = { ...BAT_HIT, spine: [0.1, -0.9, 0], upperArmR: [-2.4, 0, 0.2], upperArmL: [-2.1, 0, 0.3] };
const fsmash = keyAnim([{ f: 0, pose: STANCE }, { f: 6, pose: { ...BAT_WIND, upperArmR: [1.2, 0, -0.3] } }, { f: 15, pose: BAT_WIND }, { f: 18, pose: BAT_HIT }, { f: 21, pose: BAT_HIT },
  { f: 28, pose: BAT_FOLLOW }, { f: 38, pose: BAT_FOLLOW }, { f: 49, pose: STANCE }]);
// yo-yo smashes: the arm follows the yo-yo
function usmash(f, mf) {
  const [x, y] = yoyoPos('usmash', mf);
  const th = Math.atan2(y - 165, x);
  const p = { ...STANCE, spine: [-0.1, 0, 0], head: [-0.3, 0, 0], upperArmL: [0.2, 0, 0.5], thighL: [-0.3, 0, 0.15], thighR: [-0.1, 0, -0.15], shinL: [0.4, 0, 0], shinR: [0.3, 0, 0] };
  if (mf >= 10 && mf <= 30) { p.upperArmR = [-(PI / 2 + th), 0, -0.1]; p.foreArmR = [0, 0, 0]; }
  else { const k = mf < 10 ? clamp01(mf / 8) : clamp01((39 - mf) / 9); p.upperArmR = [-1.0 * k, 0, -0.3]; p.foreArmR = [-1.2 * k, 0, 0]; }
  return p;
}
function dsmash(f, mf) {
  const [x, y] = yoyoPos('dsmash', mf);
  const c = { ...P.crouch, root: [0, -0.1, 0], spine: [0.35, 0, 0] };
  const th = Math.atan2(y - 110, x);
  if (mf >= 10 && mf <= 50) {
    c.upperArmR = [-(PI / 2 + th), 0, -0.1]; c.foreArmR = [0, 0, 0];
    if (x < 0) { c.body = [0, PI * clamp01((mf - 24) / 8), 0]; c.upperArmR = [-(PI / 2 + Math.atan2(y - 110, -x)), 0, -0.1]; }
  }
  if (mf > 34 && mf <= 54) c.body = [0, PI * (1 - clamp01((mf - 46) / 8)), 0];
  return c;
}
const NAIR_BALL = { spine: [0.5, 0, 0], neck: [0.2, 0, 0], upperArmL: [-1.2, 0, 0.5], upperArmR: [-1.2, 0, -0.5], foreArmL: [-1.3, 0, 0], foreArmR: [-1.3, 0, 0],
  thighL: [-1.5, 0, 0.3], thighR: [-1.5, 0, -0.3], shinL: [1.0, 0, 0], shinR: [1.0, 0, 0] };
function nair(f, mf) {
  if (mf < 5) return keyAnim([{ f: 0, pose: P.fall }, { f: 5, pose: NAIR_BALL }])(f, mf);
  if (mf > 30) return keyAnim([{ f: 30, pose: NAIR_BALL }, { f: 39, pose: P.fall }])(f, mf);
  return { ...NAIR_BALL, body: [0, (mf - 5) * 0.55, 0] };
}
const FAIR = { wind: { upperArmL: [0.4, 0, 0.4], upperArmR: [0.4, 0, -0.4], foreArmL: [-1.4, 0, 0], foreArmR: [-1.4, 0, 0], spine: [-0.1, 0, 0] },
  strike: { upperArmL: [-1.5, 0, 0.1], upperArmR: [-1.5, 0, -0.1], foreArmL: [0, 0, 0], foreArmR: [0, 0, 0], handL: [0.7, 0, 0], handR: [0.7, 0, 0], spine: [0.25, 0, 0], thighL: [-0.6, 0, 0], shinL: [1.0, 0, 0] } };
const BAIR = { wind: { spine: [0.4, 0, 0], thighL: [-1.0, 0, 0], thighR: [-1.0, 0, 0], shinL: [1.6, 0, 0], shinR: [1.6, 0, 0] },
  strike: { spine: [0.6, 0, 0], neck: [-0.5, 0, 0], thighL: [1.45, 0, 0.1], thighR: [1.35, 0, -0.1], shinL: [0.05, 0, 0], shinR: [0.1, 0, 0], upperArmL: [-0.4, 0, 0.8], upperArmR: [-0.4, 0, -0.8] } };
const UAIR = { wind: { spine: [0.4, 0, 0], neck: [0.3, 0, 0] },
  strike: { spine: [-0.15, 0, 0], neck: [-0.15, 0, 0], head: [-0.2, 0, 0], upperArmL: [0.5, 0, 0.9], upperArmR: [0.5, 0, -0.9], thighL: [-0.5, 0, 0.1], thighR: [-0.5, 0, -0.1], shinL: [0.9, 0, 0], shinR: [0.9, 0, 0] } };
const DAIR = { wind: { thighL: [-1.2, 0, 0.2], thighR: [-1.2, 0, -0.2], shinL: [1.8, 0, 0], shinR: [1.8, 0, 0], upperArmL: [-0.5, 0, 1.0], upperArmR: [-0.5, 0, -1.0] },
  strike: { thighL: [0.0, 0, 0.12], thighR: [0.05, 0, -0.12], shinL: [0.05, 0, 0], shinR: [0.05, 0, 0], footL: [0.6, 0, 0], footR: [0.6, 0, 0], spine: [0.3, 0, 0], upperArmL: [0.4, 0, 1.4], upperArmR: [0.4, 0, -1.4] } };
// "Okay!": hands on hips, turn, nod
const TAUNT = { ...STANCE, body: [0, -0.9, 0], upperArmL: [0.2, 0, 0.9], upperArmR: [0.2, 0, -0.9], foreArmL: [-2.0, 0.6, 0], foreArmR: [-2.0, -0.6, 0], thighL: [-0.1, 0, 0.2], thighR: [0.0, 0, -0.2] };
function taunt(f, mf) {
  if (mf < 10) return keyAnim([{ f: 0, pose: STANCE }, { f: 10, pose: TAUNT }])(f, mf);
  if (mf > 48) return keyAnim([{ f: 48, pose: TAUNT }, { f: 59, pose: STANCE }])(f, mf);
  const k = Math.max(0, Math.sin((mf - 18) * 0.35));
  return { ...TAUNT, head: [mf > 18 && mf < 36 ? 0.35 * k : 0, 0, 0] };
}
// PSI throws: the victim spins around Ness, then is hurled
const THROW = { wind: { ...P.grabhold, upperArmL: [-1.9, 0, 0.3], upperArmR: [-1.9, 0, -0.3] },
  strike: { upperArmL: [-1.6, 0, 0.6], upperArmR: [-1.6, 0, -0.6], foreArmL: [0, 0, 0], foreArmR: [0, 0, 0], handL: [0.7, 0, 0], handR: [0.7, 0, 0], spine: [0.3, 0, 0], thighL: [-0.6, 0, 0], shinL: [0.7, 0, 0] } };

export const ness = makeChar({
  id: 'ness', name: 'Ness', series: 'earthbound', data, model, props: NESS_PROPS, extraBones: NESS_EXTRA_BONES,
  palettes: NESS_PALETTES,
  boneMap: { sword: 'extra1', item: 'handR' },
  anims: { idle, run, dash: run },
  doubleJumpFlip: true,
  moves: {
    jab1: { anim: 'jab' }, jab2: { anim: 'jab2' }, jab3: { anim: JAB3 },
    ftilt: { anim: FTILT(0) }, ftiltHi: { anim: FTILT(0.4) }, ftiltLo: { anim: FTILT(-0.35) },
    utilt: { anim: UTILT },
    dtilt: { iasa: 11 },
    dashattack: { anim: DASH },
    fsmash: { anim: fsmash, hitboxPatch: h => ({ off: [0, -h.off[1], 0] }) },
    usmash: { anim: usmash, hitboxes: yoyoHitboxes('usmash') },
    dsmash: { anim: dsmash, hitboxes: yoyoHitboxes('dsmash') },
    nair: { anim: nair }, fair: { anim: FAIR }, bair: { anim: BAIR }, uair: { anim: UAIR }, dair: { anim: DAIR },
    fthrow: { anim: THROW }, bthrow: { anim: { ...THROW, strike: { ...THROW.strike, body: [0, PI, 0] } } },
    taunt: { anim: taunt },
    nspecial: pkFire(false), nspecialAir: pkFire(true),
    uspecial: pkThunder(), uspecialAir: pkThunder(),
    dspecial: psiMagnet(), dspecialAir: psiMagnet(),
    pkThunder2,
  },
  extraMoves: { pkThunder2, nspecialAir: data.moves.nspecial, uspecialAir: data.moves.uspecial, dspecialAir: data.moves.dspecial },
  init(f) { installNessHooks(f); },
  animExtra(view, f) {
    const x = view.extra; if (!x.bat) return;
    const id = f.state === 'attack' ? f.move?.id : null, mf = f.mf;
    x.bat.visible = id === 'fsmash' && mf >= 2;
    const yo = (id === 'usmash' || id === 'dsmash') && mf >= 2;
    x.yoyo.visible = yo; x.string.visible = yo;
    if (yo) {
      const H = f.H, [fx, fy] = yoyoPos(id, mf);
      x.yoyo.position.set(0, fy / H, fx / H);
      x.disc.rotation.x = mf * 0.9;
      // string from the right hand to the yo-yo (root space)
      view.root.updateMatrixWorld(true);
      const hp = view.bones.handR.getWorldPosition(x.string.position.clone());
      view.root.worldToLocal(hp);
      const dx = 0, dy = fy / H - hp.y, dz = fx / H - hp.z, L = Math.hypot(dy, dz) || 1e-3;
      x.string.position.copy(hp); x.string.scale.set(1, L, 1);
      x.string.rotation.set(Math.atan2(dz, dy), 0, 0);
    }
    x.magnet.visible = !!f.absorbing;
    if (x.magnet.visible) { x.magnet.scale.setScalar(1 + Math.sin(mf * 0.8) * 0.05 + (f.vars.hitT > 0 ? 0.15 : 0)); x.rings.forEach((r, i) => { r.rotation.y += 0.08 + i * 0.03; r.rotation.x += 0.05; }); }
    x.aura.visible = id === 'pkThunder2' && mf <= 24;
    if (x.aura.visible) { x.aura.rotation.x = mf * 0.5; x.aura.scale.setScalar(1 + Math.sin(mf * 1.7) * 0.08); }
  },
});
