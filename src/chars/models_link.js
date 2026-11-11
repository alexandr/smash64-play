// Link model (adult Link, Ocarina of Time): slim, green tunic and long floppy cap, cream undershirt/tights,
// brown belt/boots/gauntlets, blond hair, pointed ears. Master Sword in the LEFT hand (extra 'sword' bone,
// blade along the bone's +z so decomp sword hitbox offsets land on the blade), Hylian Shield on the right
// forearm, scabbard on the back.
import * as THREE from 'three';
import { makeSkeleton, kit, mat } from '../render/rig.js';

export const LINK_PROPS = { hipY: 0.43, spine: 0.12, chest: 0.13, neck: 0.04, shoulderX: 0.105, shoulderY: 0.1, upperArm: 0.15, foreArm: 0.14, hipX: 0.055, thigh: 0.215, shin: 0.2 };
export const LINK_SWORD_BONE = ['sword', 'handL', [0, -0.03, 0]];
export const BLADE_LEN = 0.6;

export function buildSword(scale = 1) {
  const g = new THREE.Group();
  g.add(kit.box(0.03, 0.03, 0.09, 0x4a3aa0, [0, 0, -0.03]));                 // grip (blue-purple)
  g.add(kit.sphere(0.022, 0x8070d0, [0, 0, -0.08], { seg: 5 }));             // pommel
  g.add(kit.box(0.13, 0.03, 0.03, 0x5a4ab8, [0, 0, 0.025]));                // cross-guard (wings)
  g.add(kit.box(0.02, 0.02, 0.02, 0xf0d040, [0, 0, 0.03]));                 // gem
  g.add(kit.box(0.045, 0.012, BLADE_LEN - 0.06, 0xd0d8e0, [0, 0, 0.04 + (BLADE_LEN - 0.06) / 2]));   // blade
  const tip = kit.cone(0.0225, 0.07, 0xd0d8e0, [0, 0, BLADE_LEN - 0.02], { rot: [Math.PI / 2, 0, 0], seg: 4 });
  tip.scale.set(1, 1, 0.27); g.add(tip);
  g.scale.setScalar(scale);
  return g;
}

export function link(pal) {
  const b = makeSkeleton(LINK_PROPS);
  const P = b.props;
  // tunic: chest + flared skirt, belt with buckle
  b.chest.add(kit.sphere(0.1, pal.tunic, [0, 0.04, 0], { seg: 9, scale: [1.05, 1.15, 0.8] }));
  b.spine.add(kit.cyl(0.085, 0.13, 0.22, pal.tunic, [0, -0.13, 0], { seg: 8 }));
  b.spine.add(kit.cyl(0.092, 0.092, 0.035, pal.leather, [0, 0.07, 0], { seg: 8 }));
  b.spine.add(kit.box(0.04, 0.035, 0.02, 0xc0c0c8, [0, 0.087, 0.09]));
  const strap = kit.box(0.025, 0.24, 0.02, pal.leather, [0.0, 0.03, 0.082]); strap.rotation.z = 0.7; b.chest.add(strap);
  // scabbard diagonally on the back
  const sc = kit.box(0.045, 0.34, 0.03, 0x3a40a0, [0.0, 0.04, -0.09]); sc.rotation.z = 0.7; b.chest.add(sc);
  // head: face, blond hair, pointed ears, long green cap drooping back
  const h = b.head;
  h.add(kit.sphere(0.085, pal.skin, [0, 0.09, 0.01], { seg: 9, scale: [0.95, 1.1, 1] }));
  h.add(kit.sphere(0.09, pal.hair, [0, 0.12, -0.02], { seg: 8, scale: [1.05, 0.95, 1.0] }));       // hair
  h.add(kit.box(0.055, 0.03, 0.035, pal.hair, [0.035, 0.158, 0.072], {}));                         // bangs
  h.add(kit.box(0.055, 0.03, 0.035, pal.hair, [-0.035, 0.158, 0.072], {}));
  h.add(kit.box(0.03, 0.09, 0.03, pal.hair, [0.07, 0.08, 0.06]));                                   // side locks
  h.add(kit.box(0.03, 0.09, 0.03, pal.hair, [-0.07, 0.08, 0.06]));
  h.add(kit.cone(0.025, 0.09, pal.skin, [0.08, 0.09, 0.0], { rot: [0, 0, -1.35], seg: 4 }));      // ears
  h.add(kit.cone(0.025, 0.09, pal.skin, [-0.08, 0.09, 0.0], { rot: [0, 0, 1.35], seg: 4 }));
  h.add(kit.sphere(0.012, 0x2a6ad0, [0.03, 0.105, 0.085], { seg: 5 }));                              // eyes
  h.add(kit.sphere(0.012, 0x2a6ad0, [-0.03, 0.105, 0.085], { seg: 5 }));
  h.add(kit.sphere(0.092, pal.tunic, [0, 0.16, -0.01], { seg: 8, scale: [1.05, 0.7, 1.05] }));       // cap base
  h.add(kit.cone(0.075, 0.3, pal.tunic, [0, 0.18, -0.03], { rot: [-2.05, 0, 0], seg: 6 }));          // floppy tail
  // arms: cream sleeves, brown gauntlets, skin hands; legs: cream tights, brown boots
  for (const s of ['L', 'R']) {
    b['upperArm' + s].add(kit.limb(0.03, P.upperArm, pal.shirt));
    b['upperArm' + s].add(kit.sphere(0.042, pal.tunic, [0, -0.01, 0], { seg: 6 }));                 // tunic sleeve cap
    b['foreArm' + s].add(kit.limb(0.033, P.foreArm, pal.leather, { r2: 0.028 }));
    b['hand' + s].add(kit.sphere(0.035, pal.skin, [0, -0.02, 0], { seg: 6 }));
    b['thigh' + s].add(kit.limb(0.038, P.thigh, pal.shirt));
    b['shin' + s].add(kit.limb(0.04, P.shin, pal.leather, { r2: 0.045 }));
    b['foot' + s].add(kit.sphere(0.042, pal.leather, [0, -0.015, 0.03], { seg: 6, scale: [1, 0.7, 1.7] }));
  }
  // Master Sword on its own bone (child of the left hand)
  const sw = new THREE.Group(); sw.name = 'sword'; sw.position.set(...LINK_SWORD_BONE[2]);
  b.handL.add(sw); b.sword = sw;
  sw.add(buildSword());
  // Hylian Shield on the right forearm, facing outward
  const shield = new THREE.Group(); shield.position.set(-0.045, -0.08, 0.0); shield.rotation.set(1.85, -Math.PI / 2, 0);   // spun in its plane so it stands upright in the guard pose
  shield.add(kit.box(0.2, 0.26, 0.02, 0xb8c0cc, [0, 0, -0.005]));                                    // silver rim
  shield.add(kit.box(0.17, 0.23, 0.02, 0x2a4aa0, [0, 0, 0.004]));
  const tri = (pts, color, z) => { const sh = new THREE.Shape(); sh.moveTo(...pts[0]); sh.lineTo(...pts[1]); sh.lineTo(...pts[2]); sh.closePath();
    const m = new THREE.Mesh(new THREE.ShapeGeometry(sh), mat(color, { side: THREE.DoubleSide })); m.position.z = z; return m; };
  shield.add(tri([[-0.075, 0.02], [0.075, 0.02], [0, -0.09]], 0xd02020, 0.016));                    // red bird body/tail
  shield.add(kit.box(0.15, 0.025, 0.01, 0xd02020, [0, 0.035, 0.016]));                               // wings
  shield.add(tri([[-0.03, 0.06], [0.03, 0.06], [0, 0.11]], 0xe8c040, 0.016));                        // triforce
  b.foreArmR.add(shield); b.shield = shield;
  return { bones: b };
}
