// Captain Falcon model (low-poly, primitives only). Model units: 1.0 = standing height.
// Proportions follow the decomp skeleton (src/relocData/332_CaptainModel.c joint tree, total height
// ~675 model units): long legs (hip joint at 0.55), V-shaped torso, small helmeted head.
import * as THREE from 'three';
import { makeSkeleton, kit, mat } from '../render/rig.js';

const PI = Math.PI;
export const FALCON_PROPS = { hipY: 0.546, spine: 0.113, chest: 0.133, neck: 0.04, shoulderX: 0.135, shoulderY: 0.118, upperArm: 0.172, foreArm: 0.15, hipX: 0.058, thigh: 0.236, shin: 0.27 };

// triangular prism (shoulder pads, emblem wings): a 3-sided cylinder
function prism(r, h, color, at, rot, scale) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 3), mat(color));
  m.position.set(...at); if (rot) m.rotation.set(...rot); if (scale) m.scale.set(...scale);
  return m;
}

export function falcon(pal) {
  const P = FALCON_PROPS;
  const b = makeSkeleton(P);
  const suit = pal.suit, dark = pal.suitDark ?? suit;
  // ---- pelvis & belt ----
  b.hips.add(kit.sphere(0.085, suit, [0, -0.01, 0], { seg: 8, scale: [1.15, 0.85, 0.8] }));
  b.spine.add(kit.cyl(0.075, 0.088, 0.035, pal.belt, [0, 0.01, 0], { seg: 8 }));       // belt
  const buckle = kit.cyl(0.03, 0.03, 0.012, pal.buckle, [0, 0.03, 0.068], { seg: 8, rot: [PI / 2, 0, 0] });
  b.spine.add(buckle);
  b.spine.add(kit.cyl(0.016, 0.016, 0.014, pal.buckleIn ?? 0x40a050, [0, 0.03, 0.072], { seg: 6, rot: [PI / 2, 0, 0] }));
  // holster on the right hip
  b.thighR.add(kit.box(0.045, 0.11, 0.06, pal.holster, [-0.06, -0.05, -0.005], {}));
  // ---- torso: V shape ----
  b.spine.add(kit.cyl(0.07, 0.07, 0.07, suit, [0, 0.04, 0], { seg: 8 }));              // waist
  const torso = kit.cyl(0.14, 0.08, 0.15, suit, [0, 0.0, 0], { seg: 8 });
  torso.scale.set(1, 1, 0.66); b.chest.add(torso);
  b.chest.add(kit.sphere(0.065, dark, [0.05, 0.1, 0.045], { seg: 6, scale: [1, 0.75, 0.6] }));   // pecs
  b.chest.add(kit.sphere(0.065, dark, [-0.05, 0.1, 0.045], { seg: 6, scale: [1, 0.75, 0.6] }));
  b.chest.add(kit.sphere(0.07, suit, [0, 0.11, -0.03], { seg: 6, scale: [1.6, 0.8, 0.7] }));    // upper back / traps
  b.chest.add(kit.box(0.07, 0.035, 0.02, pal.trim ?? pal.scarf, [0, 0.135, 0.07], {}));      // collar flap
  // scarf: ring around the neck + tail flowing back
  b.neck.add(kit.cyl(0.05, 0.062, 0.05, pal.scarf, [0, -0.025, 0], { seg: 8 }));
  const tail = kit.box(0.07, 0.15, 0.02, pal.scarf, [0.03, -0.07, -0.06], {});
  tail.rotation.set(-0.5, 0, 0.25); b.neck.add(tail);
  // shoulder pads: silver wedges pointing outward
  for (const s of ['L', 'R']) {
    const sx = s === 'L' ? 1 : -1;
    const pad = prism(0.07, 0.035, pal.pad, [sx * 0.035, 0.03, 0], [0, 0, 0], [1.5, 1, 1]);
    pad.rotation.set(PI / 2, 0, sx * -0.35); b['shoulder' + s].add(pad);
    b['shoulder' + s].add(kit.sphere(0.048, suit, [0, -0.005, 0], { seg: 7 }));
  }
  // ---- head: red helmet, gold emblem, dark visor, chin ----
  const h = b.head;
  h.add(kit.sphere(0.08, pal.helmet, [0, 0.078, -0.008], { seg: 9, scale: [0.95, 1.08, 1.1] }));
  h.add(kit.sphere(0.05, pal.skin, [0, 0.035, 0.03], { seg: 7, scale: [0.95, 0.95, 0.95] }));          // jaw/face
  h.add(kit.box(0.112, 0.03, 0.07, pal.visor ?? 0x101018, [0, 0.07, 0.045], {}));                      // visor band
  h.add(kit.box(0.026, 0.012, 0.01, pal.lens ?? 0xf0f0f0, [0.022, 0.071, 0.081], {}));                  // eyes behind the visor
  h.add(kit.box(0.026, 0.012, 0.01, pal.lens ?? 0xf0f0f0, [-0.022, 0.071, 0.081], {}));
  h.add(kit.box(0.03, 0.006, 0.01, 0x502010, [0, 0.022, 0.078], {}));                                   // mouth
  // emblem: gold falcon (body + two swept wings) on the forehead and a gold crest ridge
  h.add(kit.cone(0.016, 0.055, pal.emblem, [0, 0.098, 0.078], { seg: 4, rot: [0.25, 0, 0] }));
  for (const sx of [1, -1]) {
    const w = kit.box(0.05, 0.014, 0.01, pal.emblem, [sx * 0.024, 0.12, 0.074], {});
    w.rotation.set(-0.3, 0, sx * 0.55); h.add(w);
  }
  h.add(kit.box(0.014, 0.03, 0.12, pal.emblem, [0, 0.158, 0.0], {}));
  // ---- arms: suit upper arm, gloves with flared cuffs, fists ----
  for (const s of ['L', 'R']) {
    b['upperArm' + s].add(kit.limb(0.04, P.upperArm, suit, { r2: 0.05 }));
    b['foreArm' + s].add(kit.limb(0.036, P.foreArm * 0.45, suit));
    b['foreArm' + s].add(kit.cyl(0.056, 0.038, P.foreArm * 0.6, pal.glove, [0, -P.foreArm * 0.42, 0], { hang: true, seg: 7 }));
    b['hand' + s].add(kit.box(0.066, 0.075, 0.07, pal.glove, [0, -0.028, 0.004], {}));
    // ---- legs: suit thighs, tall boots with knee guards ----
    b['thigh' + s].add(kit.limb(0.052, P.thigh, suit, { r2: 0.064 }));
    b['shin' + s].add(kit.cyl(0.054, 0.038, P.shin, pal.boot, [0, 0, 0], { hang: true, seg: 7 }));
    b['shin' + s].add(kit.cone(0.035, 0.07, pal.boot, [0, -0.02, 0.03], { seg: 4, rot: [0.15, 0, 0] }));   // knee guard
    b['shin' + s].add(kit.box(0.012, 0.11, 0.008, pal.bootTrim ?? 0xf0f0e0, [0, -0.12, 0.042], {}));       // boot emblem stripe
    const foot = kit.sphere(0.042, pal.boot, [0, -0.012, 0.035], { seg: 7, scale: [0.9, 0.6, 1.9] });
    b['foot' + s].add(foot);
  }
  return { bones: b };
}

// Default + alternate costumes (palette sheet reference/chars/captain_falcon_palette_ssb.png):
// 1P purple, 2P grey, 3P red (Blood Falcon colours, also red team), 4P white, then green team and blue team.
const base = { skin: 0xd89a68, visor: 0x101018, lens: 0xe8e8f0, belt: 0x2a2030, buckle: 0xb8b8b0, buckleIn: 0x40a050, bootTrim: 0xf4f0d8 };
export const FALCON_PALETTES = [
  { ...base, suit: 0x6a3a9c, suitDark: 0x5a2e88, helmet: 0xd42010, emblem: 0xf0c020, scarf: 0xf04a10, pad: 0xd0ccc4, glove: 0xe8b818, boot: 0xe8c020, holster: 0x2e7a28, icon: 0x6a3a9c },
  { ...base, suit: 0x4c4c50, suitDark: 0x3e3e42, helmet: 0x8a2a1c, emblem: 0xb8a070, scarf: 0x8c8c84, pad: 0xc8c4bc, glove: 0x7a7468, boot: 0xa8a8a0, holster: 0x5a3820, buckleIn: 0x806040, icon: 0x4c4c50 },
  { ...base, suit: 0xd8124c, suitDark: 0xb80c3c, helmet: 0x8a3478, emblem: 0xb06898, scarf: 0x7a68b8, pad: 0xb4a8d8, glove: 0x8a5a98, boot: 0xb494c8, holster: 0x303034, buckleIn: 0x606060, icon: 0xd8124c, team: 'red' },
  { ...base, suit: 0xe8ecf6, suitDark: 0xd0d4e0, helmet: 0xe05878, emblem: 0xe01a3c, scarf: 0xf0106a, pad: 0xf4f4f4, glove: 0xd01058, boot: 0xe0306c, holster: 0x202020, buckleIn: 0x606060, icon: 0xe8ecf6 },
  { ...base, suit: 0x8a9a28, suitDark: 0x76861e, helmet: 0xd4ac30, emblem: 0x8a6e60, scarf: 0xd4b400, pad: 0xd0c030, glove: 0x9a96aa, boot: 0xa8a8bc, holster: 0x8a3010, buckleIn: 0x7a5040, icon: 0x8a9a28, team: 'green' },
  { ...base, suit: 0x1414f0, suitDark: 0x1010c8, helmet: 0xd42010, emblem: 0xf0c020, scarf: 0xf08000, pad: 0xd0ccc4, glove: 0xe8b818, boot: 0xe8c020, holster: 0x2e7a28, icon: 0x1414f0, team: 'blue' },
];
