// Link — move data from the decomp (src/chars/data/link.js); model in models_link.js; specials in
// specials_link.js. The Master Sword is in the LEFT hand on an extra 'sword' bone whose +z runs along the
// blade, so the decomp sword hitboxes (bone 'sword', offset z along the blade) follow the drawn blade.
// Pose convention for the sword: with handL x = +1.57 the blade continues the arm's direction.
import { link as model, LINK_PROPS, LINK_SWORD_BONE } from './models_link.js';
import { makeChar, moveTiming } from './build.js';
import { sampleKeys } from '../render/rig.js';
import { P, sampleMove } from '../render/anims.js';
import { boomerang, spinAttack, spinTrailHitboxes, bombPull, bombThrow, BOMB_DIR, dropBomb, hookPath, hookVisual, countJab, jabRapidLoop, dairBounce } from './specials_link.js';
import data from './data/link.js';

const PI = Math.PI, SW = 1.57;
const keyed = keys => { const k = keys.map(([f, pose]) => ({ f, pose })); return (f, mf) => sampleKeys(k, mf); };
const add = (a, b) => { const o = { ...a }; for (const k in b) o[k] = b[k]; return o; };

export const LINK_PALETTES = [
  { tunic: 0x2e8b3a, shirt: 0xe8e0c8, leather: 0x6b4423, hair: 0xe8c860, skin: 0xf2c8a0, icon: 0x2e8b3a, team: 'green' },
  { tunic: 0xa82020, shirt: 0xe8e0c8, leather: 0x6b4423, hair: 0xe8c860, skin: 0xf2c8a0, icon: 0xa82020, team: 'red' },
  { tunic: 0x2a5ad0, shirt: 0xe8e0c8, leather: 0x6b4423, hair: 0xe8c860, skin: 0xf2c8a0, icon: 0x2a5ad0, team: 'blue' },
  { tunic: 0xc8b8f0, shirt: 0xf4f4f4, leather: 0x6b4423, hair: 0xe8c860, skin: 0xf2c8a0, icon: 0xc8b8f0 },
];

// ---- base poses ----
const IDLE = { root: [0, -0.025, 0], spine: [0.12, 0.25, 0], neck: [0, -0.2, 0],
  upperArmL: [-0.35, 0, 0.25], foreArmL: [-0.5, 0, 0], handL: [1.15, 0, 0],
  upperArmR: [-0.75, 0, -0.15], foreArmR: [-1.1, 0, 0], handR: [0, 0, 0],
  thighL: [-0.45, 0, 0.08], thighR: [0.15, 0, -0.08], shinL: [0.55, 0, 0], shinR: [0.35, 0, 0], footL: [-0.1, 0, 0] };
const FALL = { ...P.fall, handL: [1.2, 0, 0] };
const CROUCH = { ...P.crouch, handL: [1.4, 0, 0] };
const swordArm = (a, hand = SW, z = 0.15, fore = 0) => ({ upperArmL: [a, 0, z], foreArmL: [fore, 0, 0], handL: [hand, 0, 0] });

function idle(f, t) {
  if (typeof f === 'number') t = f * 80;          // the view may call custom.idle(phase) for entry/respawn
  const s = Math.sin(((t ?? 0) % 80) / 80 * 2 * PI);
  return { ...IDLE, root: [0, -0.025 + s * 0.006, 0], spine: [0.12 + s * 0.015, 0.25, 0] };
}
// phased archetype with Link's rest pose; timing from the move's data hitboxes
const phased = (id, wind, strike, follow, rest = IDLE) => {
  const src = data.moves[id];
  const timing = moveTiming({ hitboxes: src.hitboxes, throwData: src.throw, total: src.total });
  const a = { wind: add(rest, wind), strike: add(rest, strike), follow: follow && add(rest, follow) };
  return (f, mf) => sampleMove(a, mf, timing, rest);
};

// ---- ground attacks ----
const jab1 = phased('jab1', { ...swordArm(-2.3, 1.4, 0.3), spine: [0.0, 0.5, 0] }, { ...swordArm(-1.3, 1.35, -0.1), spine: [0.2, -0.2, 0] });
const jab2 = phased('jab2', { ...swordArm(-0.6, 1.5, 0.4), spine: [0.2, -0.2, 0] }, { ...swordArm(-2.1, 1.5, 0.1), spine: [0.0, 0.4, 0] });
const jab3 = phased('jab3', { upperArmL: [0.25, 0, 0.3], foreArmL: [-1.85, 0, 0], handL: [SW, 0, 0], spine: [0.0, 0.5, 0] },
  { ...swordArm(-1.5, 1.5, -0.05), spine: [0.3, -0.3, 0], thighL: [-0.9, 0, 0], shinL: [0.9, 0, 0], thighR: [0.4, 0, 0], root: [0, -0.04, 0.05] });
const ftiltK = keyed([[0, IDLE], [11, add(IDLE, { ...swordArm(-3.3, 1.5, 0.2, -0.3), spine: [-0.2, 0, 0], upperArmR: [-1.0, 0, -0.3] })],
  [15, add(IDLE, { ...swordArm(-2.0, 1.5, 0), spine: [0.2, 0, 0] })], [20, add(IDLE, { ...swordArm(-0.9, 1.5, 0), spine: [0.45, 0, 0], thighL: [-0.8, 0, 0], shinL: [0.9, 0, 0], root: [0, -0.05, 0.03] })],
  [30, add(IDLE, { ...swordArm(-0.7, 1.5, 0), spine: [0.4, 0, 0], thighL: [-0.8, 0, 0], shinL: [0.9, 0, 0], root: [0, -0.05, 0.03] })], [39, IDLE]]);
const utiltK = keyed([[0, IDLE], [5, add(IDLE, { ...swordArm(-1.0, 1.5, 0.2), spine: [0.1, 0, 0] })], [8, add(IDLE, { ...swordArm(-2.0, 1.5, 0.1), spine: [0, 0, 0] })],
  [12, add(IDLE, { ...swordArm(-2.9, 1.5, 0.05), spine: [-0.15, 0, 0] })], [16, add(IDLE, { ...swordArm(-3.8, 1.5, 0.05), spine: [-0.25, 0, 0] })], [29, IDLE]]);
const dtiltK = phased('dtilt', { ...CROUCH, upperArmL: [0.3, 0, 0.3], foreArmL: [-1.4, 0, 0], handL: [1.3, 0, 0] },
  { ...CROUCH, ...swordArm(-1.65, 1.5, 0.05), spine: [0.35, 0, 0] }, null, CROUCH);
const dashK = keyed([[0, IDLE], [6, add(IDLE, { ...swordArm(-3.1, 1.5, 0.2), spine: [-0.2, 0, 0], thighL: [-1.0, 0, 0], shinL: [1.2, 0, 0], root: [0, 0.05, 0] })],
  [9, add(IDLE, { ...swordArm(-1.7, 1.5, 0), spine: [0.3, 0, 0], thighL: [-1.0, 0, 0], shinL: [1.0, 0, 0], thighR: [0.5, 0, 0], root: [0, 0.04, 0] })],
  [20, add(IDLE, { ...swordArm(-1.3, 1.5, 0), spine: [0.35, 0, 0], thighL: [-1.1, 0, 0], shinL: [1.0, 0, 0], thighR: [0.4, 0, 0], root: [0, -0.06, 0] })],
  [34, add(IDLE, { ...swordArm(-1.2, 1.5, 0), spine: [0.35, 0, 0], thighL: [-1.0, 0, 0], shinL: [1.0, 0, 0], root: [0, -0.06, 0] })], [46, IDLE]]);
// forward smash: sword (and shield arm) raised high, one big downward slash
const fsmashK = keyed([[0, IDLE], [12, add(IDLE, { ...swordArm(-3.4, 1.5, 0.15, -0.3), upperArmR: [-3.0, 0, -0.2], foreArmR: [-0.4, 0, 0], spine: [-0.3, 0, 0], thighL: [-0.2, 0, 0], root: [0, 0.01, 0] })],
  [15, add(IDLE, { ...swordArm(-3.3, 1.5, 0.15, -0.3), upperArmR: [-2.9, 0, -0.2], spine: [-0.32, 0, 0] })],
  [16, add(IDLE, { ...swordArm(-2.1, 1.5, 0.05), upperArmR: [-2.0, 0, -0.1], spine: [0.15, 0, 0], thighL: [-0.7, 0, 0], shinL: [0.7, 0, 0] })],
  [20, add(IDLE, { ...swordArm(-1.1, 1.5, 0.0), upperArmR: [-1.2, 0, -0.1], spine: [0.45, 0, 0], thighL: [-1.0, 0, 0], shinL: [1.0, 0, 0], thighR: [0.5, 0, 0], root: [0, -0.06, 0.05] })],
  [25, add(IDLE, { ...swordArm(-0.85, 1.5, 0.0), upperArmR: [-0.7, 0, -0.1], spine: [0.5, 0, 0], thighL: [-1.1, 0, 0], shinL: [1.1, 0, 0], thighR: [0.5, 0, 0], root: [0, -0.08, 0.05] })],
  [40, add(IDLE, { ...swordArm(-0.8, 1.5, 0.0), spine: [0.45, 0, 0], thighL: [-1.0, 0, 0], shinL: [1.0, 0, 0], root: [0, -0.07, 0.04] })], [57, IDLE]]);
// up smash: three overhead arcs (front -> back)
const usmashK = (() => {
  const A = a => add(IDLE, { ...swordArm(a, 1.5, 0.05), spine: [-0.1, 0, 0], neck: [-0.3, 0, 0] });
  return keyed([[0, IDLE], [8, A(-1.3)], [11, A(-2.1)], [16, A(-3.6)], [19, A(-1.6)], [21, A(-2.2)], [25, A(-3.6)], [28, A(-1.6)], [31, A(-2.2)], [35, A(-3.7)], [44, A(-3.0)], [54, IDLE]]);
})();
// down smash: low sweep in front, then turn and sweep behind
const dsmashK = (() => {
  const low = (body, a) => add(CROUCH, { ...swordArm(a, 1.5, 0.1), spine: [0.5, 0, 0], body: [0, body, 0] });
  return keyed([[0, IDLE], [6, low(0.5, 0.2)], [9, low(0, -1.5)], [13, low(-0.5, -1.6)], [18, low(-PI + 0.4, 0.1)], [21, low(-PI, -1.5)], [23, low(-PI - 0.4, -1.6)], [35, low(-PI - 0.4, -1.2)], [49, add(IDLE, { body: [0, -2 * PI, 0] })]]);
})();
const grabK = keyed([[0, IDLE], [10, add(IDLE, { upperArmR: [-1.55, 0, 0.05], foreArmR: [0, 0, 0], handR: [0, 0, 0], spine: [0.1, -0.2, 0] })],
  [40, add(IDLE, { upperArmR: [-1.55, 0, 0.05], foreArmR: [0, 0, 0], spine: [0.1, -0.2, 0] })], [60, add(IDLE, { upperArmR: [-1.2, 0, 0], foreArmR: [-0.6, 0, 0] })], [84, IDLE]]);
const fthrowK = keyed([[0, IDLE], [8, add(IDLE, { thighR: [-0.4, 0, 0], shinR: [1.5, 0, 0], spine: [-0.1, 0, 0] })], [12, add(IDLE, { thighR: [-1.5, 0, 0], shinR: [0.1, 0, 0], spine: [-0.25, 0, 0] })],
  [20, add(IDLE, { thighR: [-1.5, 0, 0], shinR: [0.1, 0, 0], spine: [-0.25, 0, 0] })], [39, IDLE]]);
// back throw: swing round behind (body yaw), kick; the fighter's facing flips on the release frame (20)
const bthrowK = keyed([[0, IDLE], [8, add(IDLE, { body: [0, PI * 0.6, 0], thighL: [-0.3, 0, 0], shinL: [1.4, 0, 0] })], [12, add(IDLE, { body: [0, PI, 0], thighL: [-1.5, 0, 0], shinL: [0.1, 0, 0], spine: [-0.25, 0, 0] })],
  [19, add(IDLE, { body: [0, PI, 0], thighL: [-1.5, 0, 0], shinL: [0.1, 0, 0], spine: [-0.25, 0, 0] })], [20, add(IDLE, { thighL: [-1.3, 0, 0], shinL: [0.2, 0, 0], spine: [-0.2, 0, 0] })], [39, IDLE]]);
const tauntK = keyed([[0, IDLE], [12, add(IDLE, { ...swordArm(-3.05, 1.6, 0.1), spine: [-0.1, 0, 0], neck: [-0.3, 0, 0], upperArmR: [-0.3, 0, -0.4], foreArmR: [-0.6, 0, 0] })],
  [40, add(IDLE, { ...swordArm(-3.05, 1.6, 0.1), spine: [-0.1, 0, 0], neck: [-0.35, 0, 0], upperArmR: [-0.3, 0, -0.4], foreArmR: [-0.6, 0, 0] })], [52, add(IDLE, { ...swordArm(-0.6, 1.4, 0.2) })], [60, IDLE]]);

// ---- aerials ----
const nairK = 'nair';
const fairK = keyed([[0, FALL], [10, add(FALL, { ...swordArm(-3.3, 1.5, 0.15, -0.3), spine: [-0.3, 0, 0] })], [15, add(FALL, { ...swordArm(-2.0, 1.5, 0.05), spine: [0.1, 0, 0] })],
  [18, add(FALL, { ...swordArm(-1.3, 1.5, 0.0), spine: [0.3, 0, 0] })], [26, add(FALL, { ...swordArm(-0.5, 1.5, 0.0), spine: [0.45, 0, 0] })],
  [30, add(FALL, { ...swordArm(-1.5, 1.5, 0.1), spine: [0.2, 0, 0] })], [34, add(FALL, { ...swordArm(-2.4, 1.5, 0.1), spine: [0.0, 0, 0] })], [55, FALL]]);
const bairK = keyed([[0, FALL], [4, add(FALL, { thighR: [-0.6, 0, 0], shinR: [1.8, 0, 0], spine: [0.3, 0, 0] })], [6, add(FALL, { thighR: [1.3, 0, 0], shinR: [0.1, 0, 0], spine: [0.5, 0, 0], neck: [-0.4, 0, 0] })],
  [13, add(FALL, { thighR: [1.3, 0, 0], shinR: [0.1, 0, 0], spine: [0.5, 0, 0], neck: [-0.4, 0, 0] })], [16, add(FALL, { thighL: [-0.6, 0, 0], shinL: [1.8, 0, 0], spine: [0.3, 0, 0] })],
  [18, add(FALL, { thighL: [1.3, 0, 0], shinL: [0.1, 0, 0], spine: [0.5, 0, 0], neck: [-0.4, 0, 0] })], [26, add(FALL, { thighL: [1.3, 0, 0], shinL: [0.1, 0, 0], spine: [0.5, 0, 0] })], [39, FALL]]);
const UAIR = add(FALL, { ...swordArm(-3.1, 1.57, 0.05), spine: [-0.1, 0, 0], neck: [-0.2, 0, 0], thighL: [-0.9, 0, 0.1], shinL: [1.4, 0, 0], thighR: [-0.3, 0, -0.1], shinR: [0.8, 0, 0] });
const uairK = keyed([[0, FALL], [5, UAIR], [48, UAIR], [69, FALL]]);
const DAIR = add(FALL, { ...swordArm(0.05, 1.57, 0.0), spine: [0.15, 0, 0], thighL: [-1.2, 0, 0.15], shinL: [1.9, 0, 0], thighR: [-1.0, 0, -0.15], shinR: [1.7, 0, 0], upperArmR: [-0.8, 0, -0.6] });
const dairK = keyed([[0, FALL], [5, DAIR], [64, DAIR], [89, FALL]]);

// ---- rapid jab: quick stabs every 7 frames ----
const STAB_IN = add(IDLE, { upperArmL: [0.0, 0, 0.3], foreArmL: [-1.5, 0, 0], handL: [SW, 0, 0], spine: [0.2, 0.3, 0] });
const STAB_OUT = add(IDLE, { ...swordArm(-1.45, 1.5, -0.05), spine: [0.3, -0.25, 0], thighL: [-0.8, 0, 0], shinL: [0.8, 0, 0], root: [0, -0.03, 0.03] });
const rapidK = (() => { const k = [[0, STAB_IN]]; for (const s of [3, 10, 17, 24, 31]) k.push([s, s % 2 ? STAB_OUT : add(STAB_OUT, { upperArmL: [-1.25, 0, 0.1] })], [s + 3, STAB_IN]); return keyed(k); })();
const rapidStartK = keyed([[0, IDLE], [7, STAB_IN]]);
const rapidEndK = keyed([[0, STAB_IN], [3, STAB_OUT], [10, IDLE]]);

// ---- specials ----
const boomK = keyed([[0, IDLE], [20, add(IDLE, { upperArmR: [0.5, 0, -0.9], foreArmR: [-0.9, 0, 0], spine: [0.0, 0.6, 0] })],
  [26, add(IDLE, { upperArmR: [-1.5, 0, -0.2], foreArmR: [0, 0, 0], spine: [0.25, -0.4, 0], thighL: [-0.6, 0, 0], shinL: [0.6, 0, 0] })], [45, IDLE]]);
const boomAirK = keyed([[0, FALL], [20, add(FALL, { upperArmR: [0.5, 0, -0.9], foreArmR: [-0.9, 0, 0], spine: [0.0, 0.6, 0] })], [26, add(FALL, { upperArmR: [-1.5, 0, -0.2], foreArmR: [0, 0, 0], spine: [0.25, -0.4, 0] })], [45, FALL]]);
const catchK = keyed([[0, add(IDLE, { upperArmR: [-2.4, 0, -0.2], foreArmR: [-0.3, 0, 0] })], [8, add(IDLE, { upperArmR: [-1.8, 0, -0.3], foreArmR: [-0.6, 0, 0] })], [19, IDLE]]);
const SPIN_ARM = { upperArmL: [0.0, 0, 1.45], foreArmL: [0, 0, 0], handL: [SW, 0, 0], upperArmR: [-0.6, 0, -0.9], foreArmR: [-1.0, 0, 0] };
function spinGround(f, mf) {
  if (mf < 8) return sampleKeys([{ f: 0, pose: IDLE }, { f: 7, pose: add(CROUCH, { ...SPIN_ARM, body: [0, -0.9, 0], root: [0, -0.12, 0] }) }], mf);
  const k = Math.min(1, (mf - 8) / 31);
  const spin = -0.9 + k * 4 * PI * (1 - 0.25 * k);
  const base = add(CROUCH, { ...SPIN_ARM, body: [0, spin, 0], root: [0, -0.12, 0], spine: [0.25, 0, 0] });
  if (mf <= 40) return base;
  return sampleKeys([{ f: 40, pose: base }, { f: 70, pose: add(IDLE, { body: [0, spin, 0] }) }, { f: 99, pose: add(IDLE, { body: [0, 2 * PI, 0] }) }], mf);
}
function spinAir(f, mf) {
  if (mf < 8) return sampleKeys([{ f: 0, pose: FALL }, { f: 7, pose: add(FALL, { ...SPIN_ARM, body: [0, -0.9, 0] }) }], mf);
  const spin = -0.9 + (mf - 8) * (mf < 40 ? 0.42 : 0.42 * Math.max(0.15, 1 - (mf - 40) / 40));
  return add(FALL, { ...SPIN_ARM, body: [0, mf < 40 ? spin : -0.9 + 32 * 0.42 + (mf - 40) * 0.2, 0], thighL: [-0.3, 0, 0.3], thighR: [-0.3, 0, -0.3], shinL: [0.5, 0, 0], shinR: [0.5, 0, 0] });
}
const bombK = keyed([[0, IDLE], [16, add(IDLE, { upperArmR: [0.9, 0, -0.4], foreArmR: [-1.3, 0, 0], spine: [0.1, -0.5, 0] })], [29, add(IDLE, { upperArmR: [-1.0, 0, -0.3], foreArmR: [-0.6, 0, 0], spine: [0.1, 0, 0] })], [44, IDLE]]);
const bombAirK = keyed([[0, FALL], [16, add(FALL, { upperArmR: [0.9, 0, -0.4], foreArmR: [-1.3, 0, 0] })], [29, add(FALL, { upperArmR: [-1.0, 0, -0.3], foreArmR: [-0.6, 0, 0] })], [44, FALL]]);
const bombThrowK = (f, mf) => {
  const up = /hi/i.test(f.vars?.dir ?? ''), dn = /lw/i.test(f.vars?.dir ?? '');
  const base = f.grounded === false ? FALL : IDLE;
  const rel = add(base, { upperArmR: [up ? -3.0 : dn ? -0.6 : -1.6, 0, -0.2], foreArmR: [0, 0, 0], spine: [dn ? 0.4 : 0.2, -0.3, 0] });
  return sampleKeys([{ f: 0, pose: base }, { f: 4, pose: add(base, { upperArmR: [up ? -1.2 : 0.8, 0, -0.4], foreArmR: [-1.2, 0, 0], spine: [-0.1, 0.4, 0] }) }, { f: 6, pose: rel }, { f: 24, pose: base }], mf);
};

// Hookshot grab box: explicit path along the claw
const hookHitboxes = data.moves.grab.hitboxes.map(h => ({ ...h, size: h.r, path: hookPath(data.attr.height), pos: hookPath(data.attr.height)[h.frames[0]] }));
// throw collateral hitboxes must not hit the held victim
const skipVictim = (f, mf) => { if (mf === 1 && f.vars.victim) for (let g = 0; g < 4; g++) f.hitVictims.set(g, new Set([f.vars.victim])); };

export const link = makeChar({
  id: 'link', name: 'Link', series: 'zelda', data, model, props: LINK_PROPS,
  palettes: LINK_PALETTES,
  extraBones: [LINK_SWORD_BONE],
  anims: { idle },
  animExtra: (view, f) => hookVisual(view, f),
  moves: {
    jab1: { anim: jab1, onStart(f) { f.special.jabInputs = 0; }, script: (f, mf, c) => countJab(f, c) },
    jab2: { anim: jab2, script(f, mf, c) { countJab(f, c); if ((f.special.jabInputs ?? 0) >= 5) f.startMove(f.def.moves.jabRapidStart); } },
    jab3: { anim: jab3 },
    jabRapidStart: { anim: rapidStartK, after: 'jabRapid' },
    jabRapid: { anim: rapidK, ...jabRapidLoop() },
    jabRapidEnd: { anim: rapidEndK },
    ftilt: { anim: ftiltK }, utilt: { anim: utiltK }, dtilt: { anim: dtiltK }, dashattack: { anim: dashK },
    fsmash: { anim: fsmashK }, usmash: { anim: usmashK }, dsmash: { anim: dsmashK },
    nair: { anim: nairK }, fair: { anim: fairK }, bair: { anim: bairK, multihit: true }, uair: { anim: uairK },
    dair: { anim: dairK, ...dairBounce() },
    grab: { anim: grabK, hitboxes: hookHitboxes },
    fthrow: { anim: fthrowK, script: skipVictim }, bthrow: { anim: bthrowK, script: skipVictim },
    taunt: { anim: tauntK },
    nspecial: { ...boomerang(), anim: boomK },
    nspecialAir: { ...boomerang({ air: true }), anim: boomAirK },
    nspecialCatch: { anim: catchK, groundOK: true, keepOnFall: true, drift: true },
    uspecial: { ...spinAttack(spinGround, false), multihit: false, hitboxes: [...data.moves.uspecial.hitboxes.map(h => ({ ...h, size: h.r, group: h.frames[0] < 12 ? 0 : 1 })), ...spinTrailHitboxes()] },
    uspecialAir: { ...spinAttack(spinAir, true), multihit: false, hitboxes: [...data.moves.uspecialAir.hitboxes.map(h => ({ ...h, size: h.r, group: h.frames[0] < 12 ? 0 : 1 })), ...spinTrailHitboxes()] },
    dspecial: { ...bombPull(bombK, false) },
    dspecialAir: { ...bombPull(bombAirK, true) },
    bombThrow: bombThrow(bombThrowK),
  },
  extraMoves: { bombThrow: { total: 24, hitboxes: [] } },
  init(f) {
    // a held bomb is thrown by the attack / grab / down-B inputs (like any held item)
    const sm = f.startMove;
    f.startMove = function (m, opts) {
      const b = this.special.bomb;
      if (b && b.held && !b.dead && m && BOMB_DIR[m.id]) {
        let dir = BOMB_DIR[m.id];
        if (!this.grounded && !dir.startsWith('air')) dir = 'airF4';
        return sm.call(this, this.def.moves.bombThrow, { vars: { dir } });
      }
      return sm.call(this, m, opts);
    };
    const th = f.takeHit;
    f.takeHit = function (hit) {
      const r = th.call(this, hit);
      const b = this.special.bomb;
      if (b && b.held && r?.kb > 0 && hit.damage > Math.random() * 60) dropBomb(b);
      return r;
    };
  },
});
