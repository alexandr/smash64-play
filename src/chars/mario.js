// Mario — move data from the decomp (src/chars/data/mario.js); model, animation choices and specials here.
import { mario as model, MARIO_PROPS } from './models.js';
import { makeChar } from './build.js';
import { fireball, tornado } from './specials.js';
import { marioSJP } from './specials_mario.js';
import { adaptData, hbs } from './specials_falcon.js';
import { P, ATK, keyed, mix, rotAbout, mirrorPose, spinAnim } from '../render/anims.js';
import raw from './data/mario.js';

const PI = Math.PI;
// decomp model ~374 units tall (head hurtbox top) -> hitbox offsets scaled to our 320-unit model
const data = adaptData(raw, { scale: 1 });

// palette sheet reference/chars/mario_palette_ssb.png: 1P red/blue (also red team), 2P yellow/purple (Wario colours),
// 3P brown/cream "Blackie", 4P blue/red (also blue team), green team green/orange
const MB = { skin: 0xf6bf8c, hair: 0x6a3414, mustache: 0x1a1008, glove: 0xf4f4f4, button: 0xf0d000, eye: 0x2850b8 };
export const MARIO_PALETTES = [
  { ...MB, cap: 0xe81410, shirt: 0xe81410, pants: 0x1834e8, shoe: 0x7a2a18, icon: 0xe81410, team: 'red' },
  { ...MB, cap: 0xf0d800, shirt: 0xf0d800, pants: 0xa01898, shoe: 0x0c6a14, icon: 0xf0d800 },
  { ...MB, cap: 0x7a2418, shirt: 0xe8dc94, pants: 0x5a1408, shoe: 0x283098, icon: 0x7a2418 },
  { ...MB, cap: 0x4a3cf0, shirt: 0x4a3cf0, pants: 0xd81020, shoe: 0x4a1a08, icon: 0x4a3cf0, team: 'blue' },
  { ...MB, cap: 0x10c010, shirt: 0x10c010, pants: 0xe06808, shoe: 0x701060, icon: 0x10c010, team: 'green' },
];

// ---------------- move animations ----------------
// forward smash: open-palm shove (no cape), angled variants tilt the arm
const palm = up => ({ wind: ATK.palm.wind, strike: mix(ATK.palm.strike, { upperArmR: [-1.5 - up, 0, 0.12], spine: [0.3 - up * 0.4, 0.15, 0] }) });
const ftiltV = up => ({ wind: ATK.ftilt.wind, strike: mix(ATK.ftilt.strike, { thighR: [-1.5 - up, 0, -0.05], spine: [-0.35 - up * 0.25, 0, 0] }) });
// up smash: headbutt straight up
const usmashHead = {
  wind: { root: [0, -0.07, 0], spine: [0.6, 0, 0], neck: [0.3, 0, 0], thighL: [-0.75, 0, 0.12], thighR: [-0.75, 0, -0.12], shinL: [1.2, 0, 0], shinR: [1.2, 0, 0],
    footL: [-0.4, 0, 0], footR: [-0.4, 0, 0], upperArmL: [0.7, 0, 0.45], upperArmR: [0.7, 0, -0.45], foreArmL: [-0.6, 0, 0], foreArmR: [-0.6, 0, 0] },
  strike: { root: [0, 0.05, 0], spine: [-0.2, 0, 0], neck: [-0.25, 0, 0], head: [-0.3, 0, 0], upperArmL: [0.55, 0, 0.6], upperArmR: [0.55, 0, -0.6], foreArmL: [-0.4, 0, 0], foreArmR: [-0.4, 0, 0],
    thighL: [0.05, 0, 0.1], thighR: [0.05, 0, -0.1], shinL: [0.1, 0, 0], shinR: [0.1, 0, 0], footL: [0.5, 0, 0], footR: [0.5, 0, 0] },
  follow: { root: [0, 0.02, 0], spine: [-0.1, 0, 0], neck: [-0.2, 0, 0], head: [-0.2, 0, 0], upperArmL: [0.3, 0, 0.45], upperArmR: [0.3, 0, -0.45] },
};
// down smash: breakdance sweep, both legs out, spinning through the active window (8-29)
const dsmashSpin = (f, mf) => {
  const base = mix(P.crouch, { root: [0, -0.2, 0], spine: [0.75, 0, 0], upperArmL: [-1.2, 0, 0.6], upperArmR: [-1.2, 0, -0.6], foreArmL: [-0.4, 0, 0], foreArmR: [-0.4, 0, 0],
    thighL: [-1.45, 0, 1.0], shinL: [0.15, 0, 0], thighR: [-1.45, 0, -1.0], shinR: [0.15, 0, 0], footL: [0.3, 0, 0], footR: [0.3, 0, 0] });
  if (mf < 7) return sampleK(dsK, mf);
  if (mf > 30) return sampleK(dsK, mf);
  return { ...base, body: [0, (mf - 7) * 0.55 - 0.6, 0] };
};
const dsK = keyed([[0, P.idle], [7, mix(P.crouch, { body: [0, -0.6, 0], thighR: [-1.0, 0, -0.6], shinR: [1.2, 0, 0] })], [30, mix(P.crouch, { body: [0, 12.05, 0] })], [44, mix(P.idle, { body: [0, 4 * PI, 0] })]]);
function sampleK(fn, mf) { return fn(null, mf); }
// dash attack: low sliding kick
const slide = mix(P.idle, { root: [0, -0.2, 0], spine: [-0.5, 0, 0], neck: [0.3, 0, 0], thighR: [-1.45, 0, -0.05], shinR: [0.05, 0, 0], footR: [0.5, 0, 0],
  thighL: [-1.2, 0, 0.1], shinL: [0.9, 0, 0], upperArmL: [0.8, 0, 0.5], upperArmR: [0.8, 0, -0.5], foreArmL: [-0.3, 0, 0], foreArmR: [-0.3, 0, 0] });
const dashK = keyed([[0, P.idle], [4, mix(P.idle, { spine: [0.5, 0, 0], thighL: [-0.8, 0, 0.1], shinL: [1.0, 0, 0], thighR: [0.4, 0, 0], shinR: [0.9, 0, 0], root: [0, -0.05, 0] })],
  [8, rotAbout(slide, -0.35, 0, 0, 0.2)], [28, rotAbout(slide, -0.3, 0, 0, 0.2)], [40, P.idle]]);
// forward air: forward somersault kick — the right leg sweeps down in front (strong 11-14, weak 15-26)
const legOut = { thighR: [-2.1, 0, -0.05], shinR: [0.05, 0, 0], footR: [0.4, 0, 0], thighL: [-1.4, 0, 0.1], shinL: [2.0, 0, 0], upperArmL: [0.4, 0, 1.2], upperArmR: [0.4, 0, -1.2] };
const tuck = { thighL: [-1.6, 0, 0.1], shinL: [2.1, 0, 0], thighR: [-1.9, 0, -0.1], shinR: [1.9, 0, 0], upperArmL: [-0.5, 0, 1.0], upperArmR: [-0.5, 0, -1.0] };
const fairK = spinAnim([[0, P.fall], [8, mix(P.fall, tuck)], [11, mix(P.fall, legOut)], [24, mix(P.fall, legOut, { thighR: [-1.7, 0, -0.05] })], [32, mix(P.fall, tuck)], [39, P.fall]],
  [[0, 0], [8, -0.4], [11, 0.1], [26, 2.4], [36, 2 * PI], [39, 2 * PI]]);
// up air: backflip kick — the right leg is already overhead on frame 2, body flips back through the move
const legUp = { thighR: [-2.7, 0, -0.05], shinR: [0.05, 0, 0], footR: [0.4, 0, 0], thighL: [-0.6, 0, 0.1], shinL: [1.4, 0, 0], upperArmL: [0.5, 0, 1.3], upperArmR: [0.5, 0, -1.3] };
const uairK = spinAnim([[0, P.fall], [2, mix(P.fall, legUp)], [11, mix(P.fall, legUp, { thighR: [-2.3, 0, -0.05] })], [20, mix(P.fall, tuck)], [30, P.fall]],
  [[0, 0], [2, -0.6], [11, -2.9], [20, -4.9], [28, -2 * PI], [39, -2 * PI]]);
// down air: drill — feet together pointing down, spinning about the vertical axis (hits every 3 frames 10-32)
const drill = (yaw) => mix(P.fall, { body: [0.25, yaw, 0], spine: [-0.15, 0, 0], thighL: [0.05, 0, 0.04], thighR: [0.05, 0, -0.04], shinL: [0.05, 0, 0], shinR: [0.05, 0, 0],
  footL: [0.7, 0, 0], footR: [0.7, 0, 0], upperArmL: [-0.2, 0, 1.6], upperArmR: [-0.2, 0, -1.6], foreArmL: [0, 0, 0], foreArmR: [0, 0, 0], root: [0, 0.05, 0] });
const dairK = (() => {
  const k = [[0, P.fall], [8, mix(P.fall, { thighL: [-1.4, 0, 0.1], thighR: [-1.4, 0, -0.1], shinL: [2.0, 0, 0], shinR: [2.0, 0, 0], upperArmL: [-0.3, 0, 1.4], upperArmR: [-0.3, 0, -1.4] })]];
  for (let f = 10; f <= 32; f += 2) k.push([f, drill((f - 10) * 0.95), true]);
  k.push([38, mix(P.fall, { body: [0, 22 * 0.95 + 0.6, 0] })]);
  return keyed(k);
})();
const dairHits = (() => {
  const out = [];
  for (let s = 10; s <= 31; s += 3) for (const h of data.moves.dair.hitboxes) out.push({ ...h, size: h.r, frames: [s, s + 1] });
  return out;
})();
// back throw: swing the victim around (airplane spin) and let go
const bthrowK = (() => {
  const hold = { ...P.grabhold, upperArmL: [-1.4, 0, 0.6], upperArmR: [-1.4, 0, -0.6], spine: [-0.2, 0, 0], root: [0, -0.03, 0] };
  const k = [[0, P.grabhold], [16, { ...hold, body: [0, 0.6, 0] }]];
  for (let f = 18; f <= 46; f += 4) k.push([f, { ...hold, body: [0, 0.6 + (f - 16) * 0.33, 0] }, true]);
  k.push([66, { ...P.idle, body: [0, 0.6 + 30 * 0.33 + 0.5, 0] }]);
  return keyed(k);
})();
// back throw's swing hitbox hits bystanders, never the held victim
const skipVictim = (f, mf) => { if (mf === 1 && f.vars.victim) for (let g = 0; g < 4; g++) f.hitVictims.set(g, new Set([f.vars.victim])); };
// taunt: turns to the camera and grows big (Super Mushroom), then shrinks back
const tauntK = keyed([[0, P.idle], [12, mix(P.idle, { body: [0, -1.1, 0] })], [30, mix(P.victory, { body: [0, -1.1, 0], scale: [1.4, 1.4, 1.4] })],
  [140, mix(P.victory, { body: [0, -1.1, 0], scale: [1.4, 1.4, 1.4] })], [165, mix(P.idle, { body: [0, -1.1, 0] })], [180, P.idle]]);
// tornado: arms out, spinning
const tornadoAnim = (f, mf) => mix(P.idle, { root: [0, -0.02, 0], spine: [0.1, 0, 0], upperArmL: [0, 0, 1.55], upperArmR: [0, 0, -1.55], foreArmL: [0, 0, 0], foreArmR: [0, 0, 0],
  thighL: [-0.2, 0, 0.12], thighR: [-0.2, 0, -0.12], shinL: [0.35, 0, 0], shinR: [0.35, 0, 0], body: [0, mf * 0.85, 0] });

export const mario = makeChar({
  id: 'mario', name: 'Mario', series: 'mario', data, model, props: MARIO_PROPS,
  palettes: MARIO_PALETTES,
  anims: { ledge: () => ({ ...P.ledgehang, root: [0, 0.1, -0.06] }) },
  moves: {
    ftiltHi: { anim: ftiltV(0.45) }, ftilt: { anim: ftiltV(0) }, ftiltLo: { anim: ftiltV(-0.4) },
    fsmashHi: { anim: palm(0.45) }, fsmashMidHi: { anim: palm(0.22) }, fsmash: { anim: palm(0) }, fsmashMidLo: { anim: palm(-0.22) }, fsmashLo: { anim: palm(-0.45) },
    usmash: { anim: usmashHead },
    dsmash: { anim: dsmashSpin },
    dashattack: { anim: dashK },
    fair: { anim: fairK },
    uair: { anim: uairK },
    dair: { anim: dairK, hitboxes: dairHits, multihit: true },
    bthrow: { anim: bthrowK, script: skipVictim },
    taunt: { anim: tauntK },
    nspecial: { ...fireball({ color: 0xff6010 }), activeFrame: 16 },
    nspecialAir: { ...fireball({ color: 0xff6010, air: true }), activeFrame: 16 },
    uspecial: marioSJP({}),
    uspecialAir: marioSJP({ air: true }),
    dspecial: { ...tornado({}), anim: tornadoAnim },
    dspecialAir: { ...tornado({ air: true }), anim: tornadoAnim },
  },
});
