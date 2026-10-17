// Low-poly character models built from primitives. Each builder takes a palette and returns
// { bones, rest } where bones come from makeSkeleton(). Model units: 1.0 = standing height.
import * as THREE from 'three';
import { makeSkeleton, kit, mat } from '../render/rig.js';

const PI = Math.PI;

// Helper: attach standard limbs with given radii/colors
function limbs(b, o) {
  const P = b.props;
  for (const s of ['L', 'R']) {
    const sx = s === 'L' ? 1 : -1;
    b['upperArm' + s].add(kit.limb(o.armR, P.upperArm, o.sleeve));
    b['foreArm' + s].add(kit.limb(o.armR * 0.95, P.foreArm, o.forearm ?? o.sleeve));
    if (o.hand) b['hand' + s].add(kit.sphere(o.handR ?? o.armR * 1.5, o.hand, [0, -0.02, 0], { seg: 7 }));
    b['thigh' + s].add(kit.limb(o.legR, P.thigh, o.pants));
    b['shin' + s].add(kit.limb(o.legR * 0.95, P.shin, o.shin ?? o.pants));
    if (o.shoe) {
      const shoe = kit.sphere(o.shoeR ?? o.legR * 1.4, o.shoe, [0, -0.02, (o.shoeZ ?? 0.03)], { seg: 7, scale: o.shoeScale ?? [1, 0.7, 1.6] });
      b['foot' + s].add(shoe);
    }
  }
}

// Mario: proportions from the decomp skeleton (296_MarioModel.c joint tree; head hurtbox top ~374 model units):
// hip joint at 0.35, shoulders at 0.55, head joint at 0.63 -> a big head ~40% of the height, stubby legs,
// chunky white fists and big brown shoes.
export const MARIO_PROPS = { hipY: 0.346, spine: 0.06, chest: 0.19, neck: 0.035, shoulderX: 0.137, shoulderY: 0.14, upperArm: 0.108, foreArm: 0.096, hipX: 0.085, thigh: 0.149, shin: 0.177 };
let emblemTex = null;
function capEmblem(cap) {
  // white circle with a red "M" (drawn on a canvas when one is available)
  if (typeof document === 'undefined') return mat(0xffffff);
  if (!emblemTex) {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const g = c.getContext('2d');
    g.fillStyle = '#fff'; g.beginPath(); g.arc(32, 32, 31, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#fff'; g.font = 'bold 44px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    emblemTex = c;
  }
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d'); g.drawImage(emblemTex, 0, 0);
  g.fillStyle = '#' + cap.toString(16).padStart(6, '0'); g.font = 'bold 46px Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('M', 32, 35);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return new THREE.MeshLambertMaterial({ map: t, transparent: true, alphaTest: 0.5 });
}
export function mario(pal) {
  const P = MARIO_PROPS;
  const b = makeSkeleton(P);
  // torso: overalls belly, shirt chest, bib + straps + yellow buttons
  b.spine.add(kit.sphere(0.135, pal.pants, [0, 0.04, 0.0], { seg: 9, scale: [1.1, 1.0, 0.95] }));
  b.chest.add(kit.sphere(0.125, pal.shirt, [0, 0.07, -0.012], { seg: 9, scale: [1.15, 0.95, 0.9] }));
  b.chest.add(kit.box(0.15, 0.1, 0.05, pal.pants, [0, 0.035, 0.085]));
  for (const sx of [1, -1]) {
    const strap = kit.box(0.04, 0.13, 0.03, pal.pants, [sx * 0.065, 0.085, 0.095]); strap.rotation.x = -0.25; b.chest.add(strap);
    b.chest.add(kit.sphere(0.022, pal.button ?? 0xf0d000, [sx * 0.055, 0.06, 0.12], { seg: 6, scale: [1, 1.1, 0.6] }));
  }
  // head
  const h = b.head;
  h.add(kit.sphere(0.165, pal.skin, [0, 0.16, 0.01], { seg: 11, scale: [1, 1.0, 0.98] }));
  h.add(kit.sphere(0.162, pal.hair, [0, 0.165, -0.03], { seg: 9, scale: [1.03, 0.9, 0.95] }));        // hair (back/sides)
  for (const sx of [1, -1]) {
    h.add(kit.box(0.025, 0.07, 0.04, pal.hair, [sx * 0.155, 0.14, 0.02]));                              // sideburns
    h.add(kit.sphere(0.04, pal.skin, [sx * 0.168, 0.15, 0.0], { seg: 6, scale: [0.6, 1, 0.8] }));       // ears
    h.add(kit.sphere(0.04, 0xffffff, [sx * 0.055, 0.2, 0.142], { seg: 7, scale: [0.8, 1.3, 0.5] }));     // eye whites
    h.add(kit.sphere(0.024, pal.eye ?? 0x2850b8, [sx * 0.052, 0.198, 0.16], { seg: 6, scale: [0.8, 1.2, 0.5] }));
    h.add(kit.sphere(0.055, pal.mustache ?? 0x1a1008, [sx * 0.05, 0.088, 0.158], { seg: 7, scale: [1.3, 0.55, 0.55] }));  // mustache
  }
  h.add(kit.sphere(0.058, pal.skin, [0, 0.135, 0.172], { seg: 8 }));                                    // big nose
  // cap: dome + brim + white emblem with the letter
  h.add(kit.sphere(0.178, pal.cap, [0, 0.215, -0.008], { seg: 11, scale: [1.02, 0.62, 1.04] }));
  const brim = kit.cyl(0.13, 0.13, 0.025, pal.cap, [0, 0.235, 0.09], { seg: 10 });
  brim.scale.set(1.25, 1, 0.95); brim.rotation.x = 0.18; h.add(brim);
  const em = new THREE.Mesh(new THREE.CircleGeometry(0.052, 12), capEmblem(pal.cap));
  em.position.set(0, 0.262, 0.172); em.rotation.x = -0.35; h.add(em);
  // arms: sleeves and big white fists
  for (const s of ['L', 'R']) {
    b['upperArm' + s].add(kit.limb(0.042, P.upperArm, pal.shirt, { r2: 0.046 }));
    b['foreArm' + s].add(kit.limb(0.04, P.foreArm, pal.shirt));
    const fist = kit.box(0.1, 0.1, 0.1, pal.glove, [0, -0.035, 0.005], { flat: false });
    fist.rotation.y = 0.15; b['hand' + s].add(fist);
    b['hand' + s].add(kit.cyl(0.05, 0.05, 0.03, pal.glove, [0, 0.01, 0], { seg: 7 }));                    // glove cuff
    // legs: overalls and big brown shoes
    b['thigh' + s].add(kit.limb(0.06, P.thigh, pal.pants, { r2: 0.065 }));
    b['shin' + s].add(kit.limb(0.055, P.shin, pal.pants));
    b['foot' + s].add(kit.sphere(0.075, pal.shoe, [0, -0.012, 0.04], { seg: 8, scale: [0.95, 0.62, 1.6] }));
  }
  return { bones: b };
}

// Generic fallback humanoid (used until a character's own model is written)
export function generic(pal) {
  const b = makeSkeleton();
  b.spine.add(kit.sphere(0.12, pal.body ?? 0x888888, [0, 0.08, 0], { seg: 8 }));
  b.chest.add(kit.sphere(0.12, pal.body ?? 0x888888, [0, 0.05, 0], { seg: 8 }));
  b.head.add(kit.sphere(0.12, pal.skin ?? 0xffccaa, [0, 0.12, 0], { seg: 8 }));
  limbs(b, { armR: 0.035, sleeve: pal.body ?? 0x888888, hand: pal.skin ?? 0xffccaa, legR: 0.045, pants: pal.legs ?? 0x444444, shoe: 0x333333 });
  return { bones: b };
}
