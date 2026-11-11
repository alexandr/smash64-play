// Donkey Kong model: huge hunched gorilla (ECB top 500). Brown fur, tan face/muzzle/chest/palms/feet,
// massive long arms with big fists reaching the ground, short bowed legs, red necktie with yellow "DK".
// The hunch is baked into the meshes (torso barrel leans forward, head sits low and forward between the
// shoulders) so the skeleton stays upright and hitbox forward kinematics match the visuals.
import * as THREE from 'three';
import { makeSkeleton, kit, mat } from '../render/rig.js';

export const DK_PROPS = { hipY: 0.3, spine: 0.16, chest: 0.16, neck: 0.03, shoulderX: 0.2, shoulderY: 0.12, upperArm: 0.22, foreArm: 0.29, hipX: 0.1, thigh: 0.16, shin: 0.13 };

let tieTex = null;
function dkTieTexture() {
  if (tieTex || typeof document === 'undefined') return tieTex;
  const c = document.createElement('canvas'); c.width = 64; c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = '#d21e1e'; g.fillRect(0, 0, 64, 64);
  g.font = 'bold 34px Arial Black, Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.lineWidth = 5; g.strokeStyle = '#7a2a00'; g.strokeText('DK', 32, 34);
  g.fillStyle = '#f2d22a'; g.fillText('DK', 32, 34);
  tieTex = new THREE.CanvasTexture(c);
  return tieTex;
}

export function dk(pal) {
  const b = makeSkeleton(DK_PROPS);
  const P = b.props;
  const fur = pal.fur, skin = pal.skin;
  // hips / belly
  b.spine.add(kit.sphere(0.17, fur, [0, 0.06, 0.0], { seg: 9, scale: [1.15, 0.95, 1.0] }));
  b.spine.add(kit.sphere(0.13, skin, [0, 0.07, 0.07], { seg: 8, scale: [1.0, 0.95, 0.75] }));      // tan belly
  // barrel chest leaning forward, big shoulder humps
  const torso = new THREE.Group(); torso.rotation.x = 0.45; b.chest.add(torso);
  torso.add(kit.sphere(0.2, fur, [0, 0.06, 0.02], { seg: 10, scale: [1.3, 1.0, 1.0] }));
  torso.add(kit.sphere(0.13, skin, [0, 0.03, 0.13], { seg: 8, scale: [1.15, 0.9, 0.6] }));          // tan chest
  b.chest.add(kit.sphere(0.12, fur, [0.15, 0.12, 0.02], { seg: 8 }));                                // shoulders
  b.chest.add(kit.sphere(0.12, fur, [-0.15, 0.12, 0.02], { seg: 8 }));
  // necktie: knot + blade with "DK"
  b.chest.add(kit.box(0.07, 0.05, 0.04, 0xd21e1e, [0, 0.1, 0.2]));
  const tex = dkTieTexture();
  const tie = new THREE.Group(); tie.position.set(0, -0.0, 0.22); tie.rotation.x = 0.25; b.chest.add(tie);
  tie.add(kit.box(0.13, 0.17, 0.025, 0xd21e1e));
  if (tex) {   // "DK" letters on a plane just in front of the tie (single material per mesh: tints clone it)
    const letters = new THREE.Mesh(new THREE.PlaneGeometry(0.13, 0.13), new THREE.MeshLambertMaterial({ map: tex }));
    letters.position.set(0, -0.01, 0.0135); tie.add(letters);
  }
  b.chest.add(kit.cone(0.065, 0.05, 0xd21e1e, [0, -0.11, 0.24], { rot: [Math.PI + 0.25, 0, 0], seg: 4 }));
  // head: low and forward between the shoulders
  const h = new THREE.Group(); h.position.set(0, -0.03, 0.12); b.head.add(h);
  h.add(kit.sphere(0.125, fur, [0, 0.07, 0], { seg: 10, scale: [1.05, 1.0, 1.0] }));
  h.add(kit.sphere(0.1, skin, [0, 0.06, 0.07], { seg: 9, scale: [1.05, 0.95, 0.75] }));             // face mask
  h.add(kit.sphere(0.085, skin, [0, 0.0, 0.12], { seg: 9, scale: [1.35, 0.8, 0.95] }));              // muzzle
  h.add(kit.box(0.08, 0.012, 0.02, 0x3a1a0a, [0, -0.02, 0.2]));                                      // mouth line
  h.add(kit.sphere(0.012, 0x2a1408, [0.025, 0.035, 0.205], { seg: 4 }));                             // nostrils
  h.add(kit.sphere(0.012, 0x2a1408, [-0.025, 0.035, 0.205], { seg: 4 }));
  h.add(kit.box(0.2, 0.035, 0.07, fur, [0, 0.115, 0.1]));                                             // brow ridge
  h.add(kit.sphere(0.026, 0xffffff, [0.04, 0.085, 0.135], { seg: 6 }));                             // eyes
  h.add(kit.sphere(0.026, 0xffffff, [-0.04, 0.085, 0.135], { seg: 6 }));
  h.add(kit.sphere(0.014, 0x201008, [0.04, 0.085, 0.157], { seg: 5 }));
  h.add(kit.sphere(0.014, 0x201008, [-0.04, 0.085, 0.157], { seg: 5 }));
  h.add(kit.sphere(0.035, skin, [0.12, 0.07, 0.0], { seg: 6, scale: [0.5, 1, 1] }));                 // ears
  h.add(kit.sphere(0.035, skin, [-0.12, 0.07, 0.0], { seg: 6, scale: [0.5, 1, 1] }));
  h.add(kit.cone(0.05, 0.08, fur, [0, 0.17, 0.0], { rot: [-0.5, 0, 0], seg: 5 }));                  // hair tuft
  // arms: thick, long, big tan fists
  for (const s of ['L', 'R']) {
    b['upperArm' + s].add(kit.limb(0.07, P.upperArm, fur, { r2: 0.085 }));
    b['foreArm' + s].add(kit.limb(0.07, P.foreArm, fur, { r2: 0.075 }));
    b['hand' + s].add(kit.sphere(0.085, skin, [0, -0.04, 0.01], { seg: 8, scale: [1.0, 1.0, 1.15] }));
    b['thigh' + s].add(kit.limb(0.075, P.thigh, fur, { r2: 0.09 }));
    b['shin' + s].add(kit.limb(0.065, P.shin, fur));
    b['foot' + s].add(kit.sphere(0.07, skin, [0, -0.02, 0.05], { seg: 7, scale: [1.1, 0.55, 1.8] }));
  }
  return { bones: b };
}
