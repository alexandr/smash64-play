// Samus model: Varia Suit from primitives. Model units: 1.0 = standing height (500 u).
// Big round shoulder pads, arm cannon replacing the RIGHT forearm, round helmet with green visor.
import * as THREE from 'three';
import { makeSkeleton, kit } from '../render/rig.js';

export const SAMUS_PROPS = { hipY: 0.46, spine: 0.11, chest: 0.13, neck: 0.06, shoulderX: 0.15, shoulderY: 0.09, upperArm: 0.13, foreArm: 0.13, hipX: 0.075, thigh: 0.21, shin: 0.21 };

export function samusModel(pal) {
  const b = makeSkeleton(SAMUS_PROPS);
  const P = b.props;
  const suit = pal.suit, chest = pal.chest ?? 0xd02818, thigh = pal.thigh, joint = pal.joint ?? 0x4a4a38, helmet = pal.helmet ?? 0xd02818;
  // waist / abdomen
  b.spine.add(kit.sphere(0.085, joint, [0, 0.01, 0], { seg: 8, scale: [1.15, 0.75, 0.95] }));
  b.spine.add(kit.cyl(0.07, 0.075, 0.09, joint, [0, 0.0, 0], { seg: 8 }));
  b.spine.add(kit.box(0.17, 0.04, 0.14, thigh, [0, -0.01, 0.0]));                         // belt
  // chest plate (red) + back pack
  b.chest.add(kit.sphere(0.12, chest, [0, 0.05, 0.0], { seg: 9, scale: [1.25, 0.95, 0.95] }));
  b.chest.add(kit.sphere(0.07, chest, [0, 0.085, 0.07], { seg: 7, scale: [1.6, 0.7, 0.8] }));
  b.chest.add(kit.box(0.16, 0.12, 0.08, joint, [0, 0.03, -0.09]));
  // helmet
  const h = b.head;
  h.add(kit.sphere(0.095, helmet, [0, 0.085, 0], { seg: 10, scale: [1, 1.08, 1.05] }));
  h.add(kit.sphere(0.096, 0x30c040, [0, 0.075, 0.016], { seg: 12, scale: [0.9, 0.48, 1.0] }));        // visor band
  h.add(kit.sphere(0.05, 0x1a8a20, [0, 0.07, 0.07], { seg: 8, scale: [1.3, 0.7, 0.75] }));
  h.add(kit.box(0.018, 0.03, 0.13, 0xf0c030, [0, 0.178, 0.0]));                                       // crest ridge
  h.add(kit.sphere(0.04, 0xf0c030, [0.08, 0.07, 0.0], { seg: 6, scale: [0.6, 1, 1] }));               // ear pieces
  h.add(kit.sphere(0.04, 0xf0c030, [-0.08, 0.07, 0.0], { seg: 6, scale: [0.6, 1, 1] }));
  b.neck.add(kit.cyl(0.05, 0.055, 0.07, joint, [0, -0.01, 0], { seg: 7 }));
  for (const s of ['L', 'R']) {
    const sx = s === 'L' ? 1 : -1;
    // huge round pauldron with yellow trim
    b['upperArm' + s].add(kit.sphere(0.108, suit, [sx * 0.03, 0.025, 0], { seg: 10, scale: [1.05, 0.95, 1.05] }));
    b['upperArm' + s].add(kit.cyl(0.085, 0.085, 0.022, 0xf0c030, [sx * 0.03, -0.07, 0], { seg: 10 }));
    b['upperArm' + s].add(kit.limb(0.042, P.upperArm, suit));
    b['thigh' + s].add(kit.limb(0.058, P.thigh, thigh, { r2: 0.07 }));
    b['shin' + s].add(kit.sphere(0.063, suit, [0, 0, 0.012], { seg: 7 }));                         // knee
    b['shin' + s].add(kit.limb(0.06, P.shin, suit, { r2: 0.05 }));
    b['foot' + s].add(kit.sphere(0.065, suit, [0, -0.02, 0.035], { seg: 7, scale: [0.95, 0.55, 1.6] }));
  }
  // left forearm + hand
  b.foreArmL.add(kit.limb(0.046, P.foreArm, suit, { r2: 0.05 }));
  b.handL.add(kit.sphere(0.045, suit, [0, -0.02, 0], { seg: 7 }));
  // right arm cannon: thick cylinder ~1.8x forearm length, grey bands, dark muzzle
  const cannon = new THREE.Group();
  cannon.add(kit.cyl(0.058, 0.064, 0.25, suit, [0, 0, 0], { hang: true, seg: 9 }));
  cannon.add(kit.cyl(0.067, 0.067, 0.03, pal.band ?? 0x8a8a5a, [0, -0.06, 0], { hang: true, seg: 9 }));
  cannon.add(kit.cyl(0.062, 0.062, 0.03, pal.band ?? 0x8a8a5a, [0, -0.2, 0], { hang: true, seg: 9 }));
  cannon.add(kit.cyl(0.035, 0.035, 0.02, 0x101010, [0, -0.25, 0], { hang: true, seg: 8 }));
  b.foreArmR.add(cannon);
  // charge ball at the muzzle (scaled by charge level in animExtra)
  const charge = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffe860, transparent: true, opacity: 0.85 }));
  charge.position.set(0, -0.27, 0); charge.visible = false; b.foreArmR.add(charge);
  // flame burst at the muzzle (usmash / fair)
  const flame = new THREE.Group();
  for (let i = 0; i < 3; i++) {
    const c = new THREE.Mesh(new THREE.ConeGeometry(0.07 - i * 0.015, 0.28 - i * 0.05, 7), new THREE.MeshBasicMaterial({ color: [0xff5010, 0xffa020, 0xfff080][i], transparent: true, opacity: 0.85 }));
    c.rotation.x = Math.PI; c.position.y = -0.38 + i * 0.02; flame.add(c);
  }
  flame.visible = false; b.foreArmR.add(flame);
  // grapple beam (unit length along +z, aimed at the beam tip and scaled in animExtra)
  const beamG = new THREE.CylinderGeometry(0.012, 0.012, 1, 5); beamG.rotateX(Math.PI / 2); beamG.translate(0, 0, 0.5);
  const beam = new THREE.Group();
  beam.add(new THREE.Mesh(beamG, new THREE.MeshBasicMaterial({ color: 0x60ff90 })));
  const tip = kit.sphere(0.035, 0x90ffb0, [0, 0, 1], { seg: 6 }); beam.add(tip);
  beam.position.set(0, -0.26, 0); beam.visible = false; b.foreArmR.add(beam);
  // morph ball (on root, shown during Bomb)
  const ball = new THREE.Group();
  ball.add(kit.sphere(0.14, suit, [0, 0, 0], { seg: 10 }));
  ball.add(kit.cyl(0.145, 0.145, 0.04, pal.thigh, [0, -0.02, 0], { seg: 12 }));
  ball.add(kit.cyl(0.145, 0.145, 0.04, pal.thigh, [0, -0.02, 0], { seg: 12, rot: [Math.PI / 2, 0, 0] }));
  ball.position.set(0, 0.14, 0); ball.visible = false; b.root.add(ball);
  // screw attack energy shell
  const screw = new THREE.Mesh(new THREE.SphereGeometry(0.42, 10, 8), new THREE.MeshBasicMaterial({ color: 0xfff060, transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending }));
  screw.position.set(0, 0.45, 0); screw.visible = false; b.root.add(screw);
  return { bones: b, extra: { charge, flame, beam, ball, screw } };
}
