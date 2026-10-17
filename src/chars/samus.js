// Samus — move data from the decomp (src/chars/data/samus.js); Varia Suit model, animations and specials.
import * as THREE from 'three';
import { samusModel, SAMUS_PROPS } from './models_samus.js';
import { makeChar } from './build.js';
import { chargeShot, screwAttack, bomb, kf, spinAbout, lerpP } from './specials_samus.js';
import { P } from '../render/anims.js';
import data from './data/samus.js';

const PI = Math.PI;
// palettes: Varia (orange, default), pink, black, green, purple (team blue)
export const SAMUS_PALETTES = [
  { suit: 0xe06a10, thigh: 0xf0c020, chest: 0xd02818, helmet: 0xd02818, joint: 0x4a4a38, band: 0x8a8a5a, icon: 0xe06a10 },
  { suit: 0xe880b0, thigh: 0xf8b8d8, chest: 0xd02818, helmet: 0xd02818, joint: 0x5a4050, band: 0xb08098, icon: 0xe880b0 },
  { suit: 0x3a2622, thigh: 0x5a3e30, chest: 0xb02010, helmet: 0xb02010, joint: 0x241a18, band: 0x584038, icon: 0x3a2622 },
  { suit: 0x4a9a18, thigh: 0x98d040, chest: 0xd02818, helmet: 0xd02818, joint: 0x2e4a20, band: 0x7a8a50, icon: 0x4a9a18 },
  { suit: 0x5838b8, thigh: 0x8a78e0, chest: 0xd02818, helmet: 0xd02818, joint: 0x302858, band: 0x7068a0, icon: 0x5838b8 },
];

// Samus' stance: legs apart, cannon held forward/low, left arm bent
const SI = { spine: [0.06, -0.25, 0], chest: [0, -0.1, 0], neck: [0, 0.2, 0], upperArmR: [-0.75, 0, -0.2], foreArmR: [-0.55, 0, 0], upperArmL: [-0.35, 0, 0.35], foreArmL: [-1.1, 0, 0],
  thighL: [-0.3, 0, 0.12], shinL: [0.4, 0, 0], footL: [-0.1, 0, 0], thighR: [0.18, 0, -0.12], shinR: [0.3, 0, 0], root: [0, -0.02, 0] };
const idle = t => { const b = Math.sin(t * 2 * PI) * 0.012; return { ...SI, root: [0, -0.02 + b, 0], spine: [0.06 + b * 2, -0.25, 0] }; };

const crouch = { ...P.crouch, upperArmR: [-0.9, 0, -0.3], foreArmR: [-0.4, 0, 0] };
const ftiltAt = (lift) => kf([[0, SI], [5, { ...SI, thighR: [-0.6 - lift * 0.5, 0, 0], shinR: [1.6, 0, 0], spine: [-0.1, 0, 0] }],
  [7, { ...SI, thighR: [-1.45 - lift, 0, 0], shinR: [0.05, 0, 0], spine: [-0.3 - lift * 0.2, 0.2, 0], thighL: [0.1, 0, 0.1], upperArmR: [-0.3, 0, -0.6] }],
  [12, { ...SI, thighR: [-1.45 - lift, 0, 0], shinR: [0.05, 0, 0], spine: [-0.3 - lift * 0.2, 0.2, 0], thighL: [0.1, 0, 0.1], upperArmR: [-0.3, 0, -0.6] }], [31, SI]]);
const fsmashAt = (aim) => kf([[0, SI],
  [9, { ...SI, spine: [-0.05, 0.6, 0], chest: [0, 0.3, 0], upperArmR: [-0.6, 0, -0.5], foreArmR: [-1.4, 0, 0], thighL: [-0.4, 0, 0.1], shinL: [0.5, 0, 0], thighR: [0.4, 0, -0.1] }],
  [12, { ...SI, spine: [0.3, -0.05, 0], chest: [0, 0, 0], upperArmR: [-1.55 - aim, 0, 0], foreArmR: [0, 0, 0], upperArmL: [0.3, 0, 0.6], foreArmL: [-0.8, 0, 0], thighL: [-0.9, 0, 0.1], shinL: [0.9, 0, 0], thighR: [0.5, 0, -0.1], shinR: [0.2, 0, 0], root: [0, -0.04, 0.03] }],
  [16, { ...SI, spine: [0.3, -0.05, 0], chest: [0, 0, 0], upperArmR: [-1.55 - aim, 0, 0], foreArmR: [0, 0, 0], upperArmL: [0.3, 0, 0.6], foreArmL: [-0.8, 0, 0], thighL: [-0.9, 0, 0.1], shinL: [0.9, 0, 0], thighR: [0.5, 0, -0.1], shinR: [0.2, 0, 0], root: [0, -0.04, 0.03] }],
  [41, SI]]);
const air = P.fall;
const nairSpin = { thighR: [-1.55, 0, 0], shinR: [0, 0, 0], thighL: [1.2, 0, 0], shinL: [0.1, 0, 0], spine: [-0.1, 0, 0], upperArmL: [0, 0, 1.3], upperArmR: [0, 0, -1.3] };

const ANIMS = {
  jab2: kf([[0, SI], [5, { ...SI, upperArmR: [-2.7, 0, -0.2], foreArmR: [-0.7, 0, 0], spine: [-0.1, 0.3, 0] }],
    [7, { ...SI, upperArmR: [-1.4, 0, 0], foreArmR: [0, 0, 0], spine: [0.3, -0.35, 0], thighL: [-0.6, 0, 0.1], shinL: [0.6, 0, 0] }],
    [11, { ...SI, upperArmR: [-1.0, 0, 0], foreArmR: [0, 0, 0], spine: [0.35, -0.35, 0], thighL: [-0.6, 0, 0.1], shinL: [0.6, 0, 0] }], [29, SI]]),
  dashattack: kf([[0, SI], [5, { ...SI, spine: [0.2, 0.5, 0], upperArmR: [-0.2, 0, -0.5] }],
    [7, { spine: [0.55, -0.2, 0], chest: [0, -0.3, 0], upperArmR: [0.1, 0, -0.9], foreArmR: [-0.6, 0, 0], upperArmL: [0.4, 0, 0.5], thighL: [-1.0, 0, 0], shinL: [0.8, 0, 0], thighR: [0.6, 0, 0], shinR: [0.4, 0, 0], root: [0, -0.04, 0] }],
    [26, { spine: [0.55, -0.2, 0], chest: [0, -0.3, 0], upperArmR: [0.1, 0, -0.9], foreArmR: [-0.6, 0, 0], upperArmL: [0.4, 0, 0.5], thighL: [-1.0, 0, 0], shinL: [0.8, 0, 0], thighR: [0.6, 0, 0], shinR: [0.4, 0, 0], root: [0, -0.04, 0] }], [40, SI]]),
  ftilt: ftiltAt(0), ftiltHi: ftiltAt(0.5), ftiltMidHi: ftiltAt(0.25), ftiltMidLo: ftiltAt(-0.2), ftiltLo: ftiltAt(-0.4),
  utilt: kf([[0, SI], [6, { ...SI, thighR: [-1.0, 0, 0], shinR: [1.4, 0, 0] }], [8, { ...SI, thighR: [-1.9, 0, 0], shinR: [0.5, 0, 0], spine: [-0.2, 0, 0] }],
    [20, { ...SI, thighR: [-2.9, 0, -0.1], shinR: [0.05, 0, 0], spine: [-0.35, 0, 0], thighL: [0.1, 0, 0.1], upperArmR: [0.2, 0, -0.7] }],
    [25, { ...SI, thighR: [-1.6, 0, 0], shinR: [0, 0, 0], spine: [0.1, 0, 0] }], [29, { ...SI, thighR: [-0.9, 0, 0], shinR: [0.2, 0, 0], spine: [0.2, 0, 0] }], [43, SI]]),
  dtilt: kf([[0, SI], [6, { ...crouch, thighR: [-0.8, 0, -0.1], shinR: [1.6, 0, 0] }], [8, { ...crouch, thighR: [-1.55, 0, -0.1], shinR: [0.25, 0, 0], footR: [0.3, 0, 0], spine: [0.25, 0, 0] }],
    [12, { ...crouch, thighR: [-1.55, 0, -0.1], shinR: [0.25, 0, 0], footR: [0.3, 0, 0], spine: [0.25, 0, 0] }], [39, crouch]]),
  fsmash: fsmashAt(0), fsmashHi: fsmashAt(0.45), fsmashMidHi: fsmashAt(0.22), fsmashMidLo: fsmashAt(-0.2), fsmashLo: fsmashAt(-0.4),
  usmash: kf([[0, SI], [12, { ...SI, root: [0, -0.06, 0], spine: [0.3, 0, 0], upperArmR: [-0.9, 0, -0.1], foreArmR: [0, 0, 0], thighL: [-0.7, 0, 0.15], shinL: [1.0, 0, 0], thighR: [-0.4, 0, -0.15], shinR: [0.8, 0, 0] }],
    [17, { ...SI, spine: [0, 0, 0], upperArmR: [-2.1, 0, -0.1], foreArmR: [0, 0, 0] }],
    [34, { ...SI, spine: [-0.4, 0, 0], head: [-0.3, 0, 0], upperArmR: [-4.1, 0, -0.1], foreArmR: [0, 0, 0] }, true], [59, SI]]),
  dsmash: kf([[0, SI], [6, { ...crouch, body: [0, 0.4, 0] }], [8, { ...crouch, thighR: [-1.6, 0, -0.35], shinR: [0.1, 0, 0], spine: [0.2, 0, 0] }],
    [12, { ...crouch, thighR: [-1.6, 0, -0.35], shinR: [0.1, 0, 0], spine: [0.2, 0, 0], body: [0, -0.3, 0] }],
    [19, { ...crouch, thighR: [-1.6, 0, -0.35], shinR: [0.1, 0, 0], spine: [0.2, 0, 0], body: [0, -PI, 0] }],
    [22, { ...crouch, thighR: [-1.6, 0, -0.35], shinR: [0.1, 0, 0], spine: [0.2, 0, 0], body: [0, -PI - 0.3, 0] }], [49, { ...SI, body: [0, -2 * PI, 0] }]]),
  nair: (f, mf) => {
    if (mf < 4) return lerpP(air, nairSpin, mf / 4);
    if (mf <= 27) return { ...nairSpin, body: [0, -(mf - 4) * 0.42, 0] };
    return lerpP({ ...nairSpin, body: [0, -23 * 0.42, 0] }, { ...air, body: [0, -4 * PI, 0] }, Math.min(1, (mf - 27) / 14));
  },
  fair: kf([[0, air], [4, { ...air, spine: [-0.2, 0, 0], upperArmR: [-2.7, 0, 0], foreArmR: [0, 0, 0] }],
    [27, { ...air, spine: [0.4, 0, 0], upperArmR: [-0.5, 0, 0], foreArmR: [0, 0, 0] }, true], [51, air]]),
  bair: kf([[0, air], [4, { ...air, spine: [0.4, 0, 0], thighR: [-0.9, 0, 0], shinR: [1.6, 0, 0] }],
    [5, { ...air, spine: [0.6, 0.3, 0], thighR: [1.45, 0, 0], shinR: [0.05, 0, 0], thighL: [-0.8, 0, 0], shinL: [1.2, 0, 0], head: [-0.4, 0, 0] }],
    [16, { ...air, spine: [0.6, 0.3, 0], thighR: [1.45, 0, 0], shinR: [0.05, 0, 0], thighL: [-0.8, 0, 0], shinL: [1.2, 0, 0], head: [-0.4, 0, 0] }], [39, air]]),
  uair: (f, mf) => {
    const up = { thighL: [-2.95, 0, 0.05], shinL: [0, 0, 0], thighR: [-0.4, 0, -0.1], shinR: [1.2, 0, 0], spine: [-0.15, 0, 0], upperArmL: [0, 0, 1.1], upperArmR: [0, 0, -1.1], root: [0, -0.15, 0] };
    if (mf < 6) return lerpP(air, up, mf / 6);
    if (mf <= 20) return { ...up, body: [0, -(mf - 6) * 0.9, 0] };
    return lerpP({ ...up, body: [0, -14 * 0.9, 0] }, { ...air, body: [0, -4 * PI, 0] }, Math.min(1, (mf - 20) / 15));
  },
  dair: kf([[0, air], [3, { ...air, spine: [-0.2, 0, 0], upperArmR: [-2.8, 0, -0.1], foreArmR: [-0.2, 0, 0] }],
    [4, { ...air, spine: [0, 0, 0], upperArmR: [-2.2, 0, -0.1], foreArmR: [0, 0, 0] }],
    [12, { ...air, spine: [0.5, 0, 0], upperArmR: [0.2, 0, -0.1], foreArmR: [0, 0, 0], thighL: [-0.9, 0, 0], shinL: [1.3, 0, 0] }, true], [39, air]]),
  grab: kf([[0, SI], [10, { ...SI, spine: [0.1, -0.4, 0], upperArmR: [-1.5, 0, -0.05], foreArmR: [0, 0, 0], upperArmL: [-1.1, 0, 0.5], foreArmL: [-0.9, 0, 0] }],
    [60, { ...SI, spine: [0.1, -0.4, 0], upperArmR: [-1.5, 0, -0.05], foreArmR: [0, 0, 0], upperArmL: [-1.1, 0, 0.5], foreArmL: [-0.9, 0, 0] }], [99, SI]]),
  taunt: (f, mf) => {
    const up = { ...SI, upperArmR: [-2.9, 0, -0.25], foreArmR: [-0.1, 0, 0], spine: [-0.1, -0.2, 0], head: [-0.2, 0, 0] };
    if (mf < 10) return lerpP(SI, up, mf / 10);
    if (mf < 45) { const s = Math.sin((mf - 10) * 0.9) * 0.18; return { ...up, upperArmR: [-2.9 + s, 0, -0.25], foreArmR: [-0.1 - s, 0, 0] }; }
    return lerpP(up, SI, Math.min(1, (mf - 45) / 14));
  },
};

// Screw Attack hitboxes: the data lists ground (r100/r90/r70, final 32-33) and air (r80, final 30-31) sets together
const USP = data.moves.uspecial.hitboxes.map(h => ({ ...h, size: h.r }));
const isAirFinal = h => h.frames[0] === 30 && h.element === 'electric';
const screwGround = USP.filter(h => h.r !== 80 && !isAirFinal(h));
const screwAir = USP.filter(h => h.r === 80 || isAirFinal(h));

// Grapple Beam: grab boxes on the beam tip (bone 36) — tip ~620 u out at cannon height, second box 200 behind it
const beamPath = (dist) => { const p = {}; for (let f = 20; f <= 38; f++) p[f] = [dist, 280]; return p; };
const grabHB = data.moves.grab.hitboxes;

export const samus = makeChar({
  id: 'samus', name: 'Samus', series: 'metroid', data, model: samusModel, props: SAMUS_PROPS,
  palettes: SAMUS_PALETTES,
  attr: { metallic: true },
  anims: { idle: (f, t) => idle((t % 120) / 120), entry: (f, t) => idle((t % 120) / 120) },
  moves: {
    ...Object.fromEntries(Object.entries(ANIMS).map(([k, a]) => [k, { anim: a }])),
    jab1: { anim: 'jab2', nextAt: 12 },
    grab: { anim: ANIMS.grab, hitboxes: [{ ...grabHB[0], size: grabHB[0].r, path: beamPath(620) }, { ...grabHB[1], size: grabHB[1].r, path: beamPath(420) }] },
    nspecial: chargeShot({}),
    uspecial: screwAttack({ hitboxes: screwGround }),
    dspecial: bomb({}),
    nspecialAir: chargeShot({ air: true }),
    uspecialAir: screwAttack({ air: true, hitboxes: screwAir }),
    dspecialAir: bomb({ air: true }),
  },
  extraMoves: { nspecialAir: { total: 9999 }, uspecialAir: { total: 47 }, dspecialAir: { total: 56 } },
  init(f) {
    // Morph Ball: smaller hurtbox while curled (frames 10-43)
    f.hurtCapsule = function () {
      const c = Object.getPrototypeOf(this).hurtCapsule.call(this);
      if (this.state === 'attack' && this.move?.morph && this.mf >= 10 && this.mf <= 43) {
        const r = this.H * 0.16; return { x1: this.x, y1: this.y + r, x2: this.x, y2: this.y + r, r };
      }
      return c;
    };
  },
  animExtra: samusExtra,
});

function samusExtra(view, f) {
  const ex = view.extra; if (!ex.charge) return;
  const m = f.state === 'attack' ? f.move : null;
  // charge ball: grows while charging, glows when a charge is stored
  let lvl = -1;
  if (m?.chargeShot && f.vars.phase === 'charge') lvl = f.vars.lvl + ((f.mf - f.vars.ps) % 20) / 20;
  else if (m?.chargeShot && f.vars.phase === 'start') lvl = f.special.charge ?? 0;
  else if ((f.special.charge ?? 0) > 0) lvl = f.special.charge;
  ex.charge.visible = lvl >= 0 && !(m?.chargeShot && f.vars.phase === 'shoot');
  if (ex.charge.visible) {
    const t = view.f.match.frame;
    ex.charge.scale.setScalar((0.025 + 0.011 * lvl) * (1 + 0.12 * Math.sin(t * 0.8)));
    ex.charge.material.color.setHex(lvl >= 7 && t % 6 < 3 ? 0xffffff : 0xffd040);
  }
  ex.flame.visible = !!(m && (m.id === 'usmash' || m.id === 'fair') && f.activeHitboxes.length);
  if (ex.flame.visible) ex.flame.scale.setScalar(0.85 + Math.random() * 0.35);
  // grapple beam: from the muzzle to the beam tip (grab box), extended by fraction `ext`
  let ext = 0, tgt = null;
  if (m?.id === 'grab') { const k = f.mf; ext = k < 12 ? 0 : k < 20 ? (k - 12) / 8 : k <= 38 ? 1 : k < 58 ? 1 - (k - 38) / 20 : 0; tgt = [f.x + f.facing * 620, f.y + 280]; }
  else if (f.state === 'grabbing' && f.grabbing) { ext = 1; tgt = [f.grabbing.x, f.grabbing.y + f.grabbing.H * 0.5]; }
  ex.beam.visible = ext > 0.01;
  if (ex.beam.visible) {
    view.root.updateMatrixWorld(true);
    const RS = view.root.scale.x / f.H;
    const w = new THREE.Vector3(tgt[0] * RS, tgt[1] * RS, 0);
    ex.beam.lookAt(w);
    const o = new THREE.Vector3(); ex.beam.getWorldPosition(o);
    const len = Math.max(0.01, o.distanceTo(w) / view.root.scale.x * ext);
    ex.beam.scale.set(1, 1, len); ex.beam.children[1].scale.set(1, 1, 1 / len);
  }
  // morph ball
  const morph = !!(m?.morph && f.mf >= 4 && f.mf <= 50);
  ex.ball.visible = morph; view.bones.body.visible = !morph;
  if (morph) ex.ball.rotation.x += 0.25;
  ex.screw.visible = !!(m?.screw && f.mf >= 3 && f.mf <= 40);
  if (ex.screw.visible) { ex.screw.material.opacity = 0.25 + 0.2 * Math.random(); ex.screw.scale.set(1, 1.15, 1); }
}
