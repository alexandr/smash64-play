// Luigi — move data from the decomp (src/chars/data/luigi.js); model in models_luigi.js.
// Specials reuse the shared Mario-family builders with Luigi's numbers from the decomp notes:
// green fireball (36 u/f straight, no gravity, life 80), Super Jump Punch (frame-2 fire sweetspot,
// higher and more vertical), Luigi Cyclone (single strong spin hits + final hit).
import { luigi as model, LUIGI_PROPS } from './models_luigi.js';
import { makeChar } from './build.js';
import { fireball, superJumpPunch, tornado } from './specials.js';
import { sampleKeys } from '../render/rig.js';
import { P } from '../render/anims.js';
import data from './data/luigi.js';

const PI = Math.PI;
// keyframed animation helper: keys = [[frame, pose], ...]
const keyed = keys => { const k = keys.map(([f, pose]) => ({ f, pose })); return (f, mf) => sampleKeys(k, mf); };

export const LUIGI_PALETTES = [
  { cap: 0x2ea043, shirt: 0x2ea043, pants: 0x3a2fc0, skin: 0xf4b98a, hair: 0x4a2a14, glove: 0xffffff, shoe: 0x6a3b1f, emblem: 0x2ea043, icon: 0x2ea043, team: 'green' },
  { cap: 0xf4f4f0, shirt: 0xf0a030, pants: 0x2a8a30, skin: 0xf4b98a, hair: 0x4a2a14, glove: 0xffffff, shoe: 0x6a3b1f, emblem: 0xf08020, icon: 0xf4f4f0 },
  { cap: 0x30b8f0, shirt: 0x30b8f0, pants: 0x1a2040, skin: 0xf4b98a, hair: 0x2a1a0a, glove: 0xffffff, shoe: 0x6a3b1f, emblem: 0x2090e0, icon: 0x30b8f0, team: 'blue' },
  { cap: 0xf4a0c4, shirt: 0xf4a0c4, pants: 0xe02020, skin: 0xf4b98a, hair: 0x4a2a14, glove: 0xffffff, shoe: 0x6a3b1f, emblem: 0xe02060, icon: 0xf4a0c4, team: 'red' },
];

// ---- animations ----
const ftiltVariant = up => ({
  wind: { thighR: [-0.4, 0, 0], shinR: [1.5, 0, 0], spine: [-0.1, 0, 0] },
  strike: { thighR: [-1.4 - up, 0, 0], shinR: [0.05, 0, 0], spine: [-0.25 - up * 0.3, 0, 0], thighL: [0.1, 0, 0], upperArmL: [0.3, 0, 0.7], upperArmR: [-0.4, 0, -0.7] },
});
const fsmashVariant = up => ({
  wind: { spine: [0.0, 0.7, 0], chest: [-0.2, 0.3, 0], upperArmR: [0.8, 0, -0.5], foreArmR: [-1.2, 0, 0], thighL: [-0.5, 0, 0], shinL: [0.6, 0, 0] },
  strike: { spine: [0.35, -0.5, 0], chest: [0, -0.3, 0], upperArmR: [-1.6 - up, 0, 0], foreArmR: [0, 0, 0], handR: [0.5, 0, 0], thighL: [-0.9, 0, 0], shinL: [1.0, 0, 0], thighR: [0.4, 0, 0], root: [0, -0.04, 0.04] },
});
const dtiltL = {
  wind: { ...P.crouch },
  strike: { ...P.crouch, thighL: [-1.7, 0, 0.1], shinL: [0.3, 0, 0], footL: [0.3, 0, 0], spine: [0.25, 0, 0], body: [0, -0.3, 0] },
};
const usmashHead = {
  wind: { root: [0, -0.06, 0], spine: [0.6, 0, 0], neck: [0.3, 0, 0], thighL: [-0.6, 0, 0.1], thighR: [-0.6, 0, -0.1], shinL: [1.0, 0, 0], shinR: [1.0, 0, 0], upperArmL: [0.6, 0, 0.4], upperArmR: [0.6, 0, -0.4] },
  strike: { root: [0, 0.05, 0], spine: [0.05, 0, 0], neck: [-0.1, 0, 0], head: [-0.25, 0, 0], upperArmL: [0.5, 0, 0.5], upperArmR: [0.5, 0, -0.5], thighL: [0.1, 0, 0], thighR: [0.1, 0, 0] },
  follow: { root: [0, 0.02, 0], spine: [-0.1, 0, 0], neck: [-0.2, 0, 0], head: [-0.3, 0, 0], upperArmL: [0.3, 0, 0.4], upperArmR: [0.3, 0, -0.4] },
};
// alternating fists while running forward (6 windows)
const dashKeys = (() => {
  const k = [[0, P.idle]];
  const L = { spine: [0.3, -0.3, 0], upperArmL: [-1.6, 0, 0.1], foreArmL: [0, 0, 0], upperArmR: [0.4, 0, -0.3], foreArmR: [-1.4, 0, 0], thighL: [-0.8, 0, 0], shinL: [0.8, 0, 0], thighR: [0.4, 0, 0], shinR: [0.6, 0, 0] };
  const R = { spine: [0.3, 0.3, 0], upperArmR: [-1.6, 0, -0.1], foreArmR: [0, 0, 0], upperArmL: [0.4, 0, 0.3], foreArmL: [-1.4, 0, 0], thighR: [-0.8, 0, 0], shinR: [0.8, 0, 0], thighL: [0.4, 0, 0], shinL: [0.6, 0, 0] };
  [3, 7, 11, 18, 25, 32].forEach((s, i) => k.push([s, i % 2 ? R : L]));
  k.push([40, { ...L, upperArmL: [-1.0, 0, 0.4] }], [60, P.idle]);
  return k;
})();
const fairKeys = [
  [0, P.fall],
  [7, { body: [-0.8, 0, 0], thighR: [-2.3, 0, 0], shinR: [1.6, 0, 0], thighL: [-1.2, 0, 0], shinL: [1.8, 0, 0], upperArmL: [-0.5, 0, 1.0], upperArmR: [-0.5, 0, -1.0] }],
  [11, { body: [-0.45, 0, 0], thighR: [-1.8, 0, 0], shinR: [0, 0, 0], thighL: [-1.0, 0, 0], shinL: [1.6, 0, 0], upperArmL: [0.3, 0, 1.2], upperArmR: [0.3, 0, -1.2] }],
  [18, { body: [0.5, 0, 0], thighR: [-1.6, 0, 0], shinR: [0, 0, 0], thighL: [-0.8, 0, 0], shinL: [1.4, 0, 0], upperArmL: [0.4, 0, 1.2], upperArmR: [0.4, 0, -1.2] }],
  [26, { body: [1.1, 0, 0], thighR: [-1.4, 0, 0], shinR: [0.2, 0, 0], thighL: [-0.8, 0, 0], shinL: [1.4, 0, 0], upperArmL: [0.4, 0, 1.0], upperArmR: [0.4, 0, -1.0] }],
  [39, P.fall],
];
const dairKeys = (() => {
  const k = [[0, P.fall], [8, { spine: [-0.2, 0, 0], thighR: [-0.4, 0, 0], shinR: [0.2, 0, 0], thighL: [-1.4, 0, 0.2], shinL: [2.0, 0, 0], upperArmL: [0, 0, 1.5], upperArmR: [0, 0, -1.5] }]];
  for (let f = 10; f <= 32; f += 2) k.push([f, { body: [0, (f - 10) * 0.75, 0], spine: [-0.2, 0, 0], thighR: [-0.3, 0, 0], shinR: [0.1, 0, 0], thighL: [-1.4, 0, 0.2], shinL: [2.0, 0, 0], upperArmL: [0, 0, 1.5], upperArmR: [0, 0, -1.5] }]);
  k.push([38, P.fall]);
  return k;
})();
const tauntKeys = [
  [0, P.idle],
  [12, { ...P.idle, neck: [0.45, 0, 0], head: [0.2, 0.2, 0], upperArmL: [0.5, 0, 0.3], upperArmR: [0.5, 0, -0.3], foreArmL: [-1.2, 0, 0], foreArmR: [-1.2, 0, 0], spine: [0.15, 0, 0] }],
  [42, { ...P.idle, neck: [0.5, 0, 0], head: [0.2, -0.2, 0], upperArmL: [0.5, 0, 0.3], upperArmR: [0.5, 0, -0.3], foreArmL: [-1.2, 0, 0], foreArmR: [-1.2, 0, 0], thighL: [0.6, 0, 0], shinL: [1.0, 0, 0], spine: [0.15, 0, 0] }],
  [49, { ...P.idle, neck: [0.5, 0, 0], upperArmL: [0.5, 0, 0.3], upperArmR: [0.5, 0, -0.3], foreArmL: [-1.2, 0, 0], foreArmR: [-1.2, 0, 0], thighL: [-0.5, 0, 0], shinL: [0.3, 0, 0], footL: [0.4, 0, 0], spine: [0.15, 0, 0] }],
  [64, { ...P.idle, neck: [0.4, 0, 0], upperArmL: [0.5, 0, 0.3], upperArmR: [0.5, 0, -0.3], foreArmL: [-1.2, 0, 0], foreArmR: [-1.2, 0, 0], spine: [0.15, 0, 0] }],
  [80, P.idle],
];
const cyclone = (f, mf) => ({ ...P.idle, root: [0, -0.03, 0], spine: [0.15, 0, 0], upperArmL: [0, 0, 1.55], upperArmR: [0, 0, -1.55], foreArmL: [0, 0, 0], foreArmR: [0, 0, 0],
  thighL: [-0.3, 0, 0.15], thighR: [-0.3, 0, -0.15], shinL: [0.5, 0, 0], shinR: [0.5, 0, 0], body: [0, mf * 0.8, 0] });

// Luigi Cyclone hitboxes: the spin boxes hit once (one group); the final hit is its own group
const cycloneGroups = h => ({ group: h.frames[0] >= 43 ? 1 : 0 });
// down air: one hitbox set refreshed every 3 frames from frame 10 (RefreshHitbox events 13..31)
const dairHits = (() => {
  const base = data.moves.dair.hitboxes;
  const out = [];
  for (let s = 10; s <= 31; s += 3) for (const h of base) out.push({ ...h, size: h.r, frames: [s, Math.min(32, s + 2)] });
  return out;
})();
// back throw: the swing's collateral hitbox must not hit the held victim
const skipVictim = (f, mf) => { if (mf === 1 && f.vars.victim) for (let g = 0; g < 4; g++) f.hitVictims.set(g, new Set([f.vars.victim])); };

export const luigi = makeChar({
  id: 'luigi', name: 'Luigi', series: 'mario', data, model, props: LUIGI_PROPS,
  palettes: LUIGI_PALETTES,
  boneMap: { item: 'handR' },
  moves: {
    jab1: { anim: 'jab2' },            // left jab (data: L hand)
    jab2: { anim: 'jab' },             // right jab
    ftiltHi: { anim: ftiltVariant(0.5) }, ftilt: { anim: ftiltVariant(0) }, ftiltLo: { anim: ftiltVariant(-0.45) },
    dtilt: { anim: dtiltL },
    dashattack: { anim: keyed(dashKeys), multihit: true },
    fsmashHi: { anim: fsmashVariant(0.45) }, fsmashMidHi: { anim: fsmashVariant(0.22) }, fsmash: { anim: fsmashVariant(0) },
    fsmashMidLo: { anim: fsmashVariant(-0.22) }, fsmashLo: { anim: fsmashVariant(-0.45) },
    usmash: { anim: usmashHead },
    fair: { anim: keyed(fairKeys) },
    dair: { anim: keyed(dairKeys), hitboxes: dairHits, multihit: true },
    bthrow: { script: skipVictim },
    taunt: { anim: keyed(tauntKeys) },
    nspecial: fireball({ color: 0x30e040, speed: 36, angle: 0, gravity: 0, life: 80, damage: 6, kbg: 25, bkb: 10, luigi: true }),
    nspecialAir: fireball({ color: 0x30e040, speed: 36, angle: 0, gravity: 0, life: 80, damage: 6, kbg: 25, bkb: 10, luigi: true, air: true }),
    uspecial: superJumpPunch({ up: 1191, fwd: 380 }),
    uspecialAir: superJumpPunch({ up: 1191, fwd: 380, air: true }),
    dspecial: { ...tornado({}), anim: cyclone, hitboxPatch: cycloneGroups, multihit: false },
    dspecialAir: { ...tornado({ air: true }), anim: cyclone, hitboxPatch: cycloneGroups, multihit: false },
  },
});
