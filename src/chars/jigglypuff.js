// Jigglypuff — move data from the decomp (src/chars/data/jigglypuff.js); model in models_jigglypuff.js,
// specials in specials_jigglypuff.js. Five midair jumps (aerialJumpVels -> attr.multiJump) and floaty air
// physics come straight from the data.
import { jigglypuff as model, JIGGLY_PROPS, JIGGLY_PALETTES } from './models_jigglypuff.js';
import { makeChar } from './build.js';
import { adaptData, hbs } from './specials_falcon.js';
import { pound, sing, rest, puffFx } from './specials_jigglypuff.js';
import { P, ATK, keyed, mix, rotAbout, mirrorPose, spinAnim } from '../render/anims.js';
import raw from './data/jigglypuff.js';

const PI = Math.PI;
const C = 0.53;        // ball centre height (model units) for rolls/flips
// decomp model ~330 units tall -> scale offsets to our 230-unit model; research joint sides are swapped.
const data = adaptData(raw, { scale: 1, swapSides: true });
const M = data.moves;

// ---------------- locomotion / state overrides (a ball squashes, rolls and bobs) ----------------
const bob = t => Math.sin(t * 2 * PI);
const anims = {
  idle: (f, t) => { const b = bob((t % 70) / 70); return mix(P.idle, { spine: [0.05, 0, 0], scale: [1 + 0.03 * b, 1 - 0.03 * b, 1 + 0.03 * b], upperArmL: [0, 0, 0.5 + 0.1 * b], upperArmR: [0, 0, -0.5 - 0.1 * b], foreArmL: [-0.3, 0, 0], foreArmR: [-0.3, 0, 0] }); },
  squat: f => mix(P.idle, { root: [0, -0.04 * Math.min(1, f.sf / 3), 0], scale: [1 + 0.15 * Math.min(1, f.sf / 3), 1 - 0.22 * Math.min(1, f.sf / 3), 1 + 0.15 * Math.min(1, f.sf / 3)] }),
  squatwait: () => mix(P.idle, { root: [0, -0.04, 0], scale: [1.15, 0.78, 1.15], upperArmL: [0, 0, 1.0], upperArmR: [0, 0, -1.0] }),
  squatrv: f => mix(P.idle, { scale: [1.15 - 0.15 * Math.min(1, f.sf / 3), 0.78 + 0.22 * Math.min(1, f.sf / 3), 1.15 - 0.15 * Math.min(1, f.sf / 3)] }),
  jumpsquat: () => mix(P.idle, { scale: [1.18, 0.8, 1.18], root: [0, -0.03, 0] }),
  jumpaerial: f => {
    // each midair jump: a quick flap of the stubby arms and a forward somersault
    const k = Math.min(1, f.sf / 22);
    return rotAbout(mix(P.fall, { upperArmL: [0, 0, 1.2 + 0.8 * Math.sin(f.sf * 0.8)], upperArmR: [0, 0, -1.2 - 0.8 * Math.sin(f.sf * 0.8)] }), 2 * PI * k, 0, 0, C);
  },
};
const roll = (f, total) => {
  const k = Math.min(1, f.sf / total);
  const dirSign = (f.rollDir ?? 1) === f.facing ? 1 : -1;
  return rotAbout(mix(P.idle, { scale: [1.05, 0.95, 1.05], upperArmL: [0, 0, 0.3], upperArmR: [0, 0, -0.3] }), dirSign * 2 * PI * k, 0, 0, C);
};
anims.ledge = () => mix(P.idle, { root: [0, -0.16, -0.08], upperArmL: [-2.9, 0, 0.3], upperArmR: [-2.9, 0, -0.3], foreArmL: [0, 0, 0], foreArmR: [0, 0, 0], thighL: [0.2, 0, 0.1], thighR: [0.2, 0, -0.1] });
anims.roll = f => roll(f, f.a.roll?.total ?? 30);
anims.getuproll = f => roll(f, 35);
anims.techroll = f => roll(f, 35);

// ---------------- move animations ----------------
// up tilt: right foot swung up over the head
const utiltA = { wind: mix(P.idle, { thighR: [-0.6, 0, 0], shinR: [1.2, 0, 0] }),
  strike: rotAbout(mix(P.idle, { thighR: [-2.9, 0, -0.1], shinR: [0.05, 0, 0], footR: [0.4, 0, 0], upperArmL: [0, 0, 0.9], upperArmR: [0, 0, -0.9] }), -0.35, 0, 0, C),
  follow: rotAbout(mix(P.idle, { thighR: [-2.3, 0, -0.1], shinR: [0.4, 0, 0] }), -0.2, 0, 0, C) };
// down tilt: low kick with the left foot, squashed
const dtiltA = { wind: mix(P.idle, { scale: [1.12, 0.85, 1.12], thighL: [-0.8, 0, 0.1], shinL: [1.4, 0, 0] }),
  strike: mix(P.idle, { scale: [1.12, 0.85, 1.12], root: [0, -0.03, 0], spine: [0.2, 0, 0], thighL: [-1.65, 0, 0.05], shinL: [0.05, 0, 0], footL: [0.4, 0, 0], upperArmL: [0, 0, 0.9], upperArmR: [0, 0, -0.9] }) };
// dash attack: body tackle, leaning into it
const dashK = keyed([[0, P.idle], [3, rotAbout(mix(P.idle, { upperArmL: [0.6, 0, 0.8], upperArmR: [0.6, 0, -0.8] }), -0.3, 0, 0, C)],
  [5, rotAbout(mix(P.idle, { upperArmL: [0.9, 0, 1.0], upperArmR: [0.9, 0, -1.0], thighL: [0.5, 0, 0.1], thighR: [0.5, 0, -0.1] }), 0.75, 0, 0, C)],
  [17, rotAbout(mix(P.idle, { upperArmL: [0.9, 0, 1.0], upperArmR: [0.9, 0, -1.0], thighL: [0.5, 0, 0.1], thighR: [0.5, 0, -0.1] }), 0.6, 0, 0, C)], [40, P.idle]]);
// forward smash: lunging two-footed kick (body tipped back, both feet forward)
const feetFwd = mix(P.idle, { thighL: [-1.6, 0, 0.08], thighR: [-1.6, 0, -0.08], shinL: [0.05, 0, 0], shinR: [0.05, 0, 0], footL: [0.5, 0, 0], footR: [0.5, 0, 0], upperArmL: [0.5, 0, 1.2], upperArmR: [0.5, 0, -1.2] });
const fsmashK = keyed([[0, P.idle], [9, rotAbout(mix(P.idle, { thighL: [-1.2, 0, 0.1], thighR: [-1.2, 0, -0.1], shinL: [2.0, 0, 0], shinR: [2.0, 0, 0] }), 0.35, 0, 0, C)],
  [12, rotAbout(feetFwd, -0.8, 0, 0, C)], [19, rotAbout(feetFwd, -0.7, 0, 0, C)], [39, P.idle]]);
// up smash: headbutt straight up (stretching tall)
const usmashA = { wind: mix(P.idle, { scale: [1.18, 0.8, 1.18], root: [0, -0.02, 0], upperArmL: [0, 0, 0.3], upperArmR: [0, 0, -0.3] }),
  strike: mix(P.idle, { scale: [0.88, 1.2, 0.88], root: [0, 0.08, 0], upperArmL: [-0.2, 0, 1.5], upperArmR: [-0.2, 0, -1.5], thighL: [0.1, 0, 0.1], thighR: [0.1, 0, -0.1] }),
  follow: mix(P.idle, { scale: [0.95, 1.08, 0.95], root: [0, 0.03, 0] }) };
// down smash: split kick to both sides while spinning
const split = yaw => ({ ...mix(P.idle, { root: [0, -0.04, 0], thighL: [-0.2, 0, 1.45], thighR: [-0.2, 0, -1.45], shinL: [0.05, 0, 0], shinR: [0.05, 0, 0], footL: [0.3, 0, 0], footR: [0.3, 0, 0],
  upperArmL: [-1.5, 0, 0.3], upperArmR: [-1.5, 0, -0.3] }), body: [0, yaw, 0] });
const dsmashK = (() => { const k = [[0, P.idle], [5, mix(P.idle, { scale: [1.15, 0.85, 1.15] })], [7, split(PI / 2)]]; for (let f = 9; f <= 27; f += 2) k.push([f, split(PI / 2 + (f - 7) * 0.5), true]); k.push([40, mix(P.idle, { body: [0, PI / 2 + 20 * 0.5 + 0.6, 0] })], [54, mix(P.idle, { body: [0, 4 * PI, 0] })]); return keyed(k); })();
// forward air: two-footed dropkick
const fairA = { wind: mix(P.fall, { thighL: [-1.3, 0, 0.1], thighR: [-1.3, 0, -0.1], shinL: [2.0, 0, 0], shinR: [2.0, 0, 0] }), strike: rotAbout(feetFwd, -0.9, 0, 0, C), hold: rotAbout(feetFwd, -0.8, 0, 0, C) };
// down air: drill kick — feet down, spinning about the vertical axis
const drill = yaw => mix(P.fall, { body: [0.2, yaw, 0], thighL: [0.0, 0, 0.05], thighR: [0.0, 0, -0.05], shinL: [0, 0, 0], shinR: [0, 0, 0], footL: [0.7, 0, 0], footR: [0.7, 0, 0],
  upperArmL: [0, 0, 1.4], upperArmR: [0, 0, -1.4], root: [0, 0.06, 0] });
const dairK = (() => { const k = [[0, P.fall], [3, drill(0)]]; for (let f = 4; f <= 33; f += 2) k.push([f, drill((f - 3) * 0.9), true]); k.push([49, mix(P.fall, { body: [0, 30 * 0.9 + 0.5, 0] })]); return keyed(k); })();
// Pound: wind-up then a big right-hand slap with the whole body leaning in
const poundK = keyed([[0, P.idle], [9, rotAbout(mix(P.idle, { upperArmR: [0.9, 0, -0.9], foreArmR: [-0.6, 0, 0], body: [0, 0.4, 0], upperArmL: [-0.6, 0, 0.6] }), -0.3, 0, 0, C)],
  [12, rotAbout(mix(P.idle, { upperArmR: [-1.6, 0, 0.2], foreArmR: [0, 0, 0], handR: [0.5, 0, 0], body: [0, -0.3, 0], upperArmL: [0.6, 0, 0.8] }), 0.5, 0, 0, C)],
  [27, rotAbout(mix(P.idle, { upperArmR: [-1.4, 0, 0.3], foreArmR: [0, 0, 0], body: [0, -0.4, 0], upperArmL: [0.6, 0, 0.8] }), 0.4, 0, 0, C)], [54, P.idle]]);
// Sing: swaying side to side, arms out
const singA = (f, mf) => { const s = Math.sin(mf * 0.12); return mix(P.idle, { body: [0, 0, 0.18 * s], spine: [-0.1, 0, 0], upperArmL: [-0.6, 0, 1.0 + 0.2 * s], upperArmR: [-0.6, 0, -1.0 + 0.2 * s], scale: [1, 1 + 0.03 * Math.sin(mf * 0.3), 1] }); };
// Rest: drops asleep on the spot, tipped back, slow breathing
const restA = (f, mf) => {
  const k = Math.min(1, mf / 6), br = Math.sin(mf * 0.07);
  return rotAbout(mix(f.grounded === false ? P.fall : P.idle, { scale: [1 + 0.04 * br, 1 - 0.04 * br, 1 + 0.04 * br], upperArmL: [0, 0, 0.9], upperArmR: [0, 0, -0.9], thighL: [-0.6, 0, 0.2], thighR: [-0.6, 0, -0.2] }), -0.45 * k, 0, 0.15 * k, C);
};
// taunt: inflates and rocks side to side
const tauntA = (f, mf) => { const k = Math.min(1, mf / 12) * Math.min(1, Math.max(0, (89 - mf) / 12)); return mix(P.idle, { scale: [1 + 0.3 * k, 1 + 0.3 * k, 1 + 0.3 * k], body: [0, 0, 0.25 * k * Math.sin(mf * 0.18)] }); };

export const jigglypuff = makeChar({
  id: 'jigglypuff', name: 'Jigglypuff', series: 'pokemon', data, model, props: JIGGLY_PROPS,
  palettes: JIGGLY_PALETTES, anims,
  boneMap: { j26: 'shinR' },
  moves: {
    utilt: { anim: utiltA },
    dtilt: { anim: dtiltA },
    dashattack: { anim: dashK },
    fsmash: { anim: fsmashK },
    usmash: { anim: usmashA },
    dsmash: { anim: dsmashK },
    fair: { anim: fairA },
    bair: { hitboxPatch: () => ({ bone: 'shinR' }) },             // j26 = right shin (backward kick)
    uair: { anim: 'utiltM' },                                       // left-arm swipe overhead
    dair: { anim: dairK },
    nspecial: { ...pound(), anim: poundK },
    uspecial: { ...sing(), anim: singA, hitboxes: hbs(M.uspecial.hitboxes, { ground: true, air: false }) },
    dspecial: { ...rest(), anim: restA },
    taunt: { anim: tauntA },
  },
  animExtra: (view, f) => puffFx(view, f),
});
