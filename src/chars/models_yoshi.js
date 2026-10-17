// Yoshi model: upright-leaning dinosaur. Model units: 1.0 = standing height (400 u).
// Big head with a long bulbous snout and eyes on top, white belly/muzzle, red saddle with white rim,
// red back spikes, short arms, thick legs with big shoes, tapering tail (extra bones for tail hitboxes).
import * as THREE from 'three';
import { makeSkeleton, kit } from '../render/rig.js';

export const YOSHI_PROPS = { hipY: 0.37, spine: 0.13, chest: 0.11, neck: 0.12, shoulderX: 0.1, shoulderY: 0.03, upperArm: 0.085, foreArm: 0.075, hipX: 0.085, thigh: 0.17, shin: 0.16 };
// extra bones: tail base (pivot) and mid-tail (hitbox joint), tongue tip is placed in code
export const YOSHI_EXTRA_BONES = [['extra1', 'hips', [0, 0.03, -0.11]], ['extra2', 'extra1', [0, -0.02, -0.17]]];

// Yoshi egg: white with spots (used for Egg Lay, Egg Throw and the egg shield)
export function eggMesh(spot = 0x30c818, r = 1, opts = {}) {
  const g = new THREE.SphereGeometry(r, 12, 10); g.scale(1, 1.22, 1);
  const egg = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ color: 0xfafaf0, transparent: !!opts.transparent }));
  const spots = [[0.45, 0.6, 0.65], [-0.6, 0.2, 0.7], [0.1, -0.35, 0.95], [0.85, -0.25, 0.4], [-0.3, 0.85, 0.3], [-0.8, -0.5, 0.1], [0.5, 0.3, -0.8], [-0.4, -0.2, -0.9], [0.0, 0.9, -0.4]];
  const sm = new THREE.MeshLambertMaterial({ color: spot });
  for (const [x, y, z] of spots) {
    const l = Math.hypot(x, y, z), s = new THREE.Mesh(new THREE.SphereGeometry(r * 0.24, 7, 5), sm);
    s.position.set(x / l * r * 0.93, y / l * r * 1.13, z / l * r * 0.93); s.scale.set(1, 1, 0.45); s.lookAt(0, 0, 0);
    egg.add(s);
  }
  return egg;
}

export function yoshiModel(pal) {
  const b = makeSkeleton(YOSHI_PROPS);
  const P = b.props;
  const body = pal.body, white = 0xf8f8f0, red = 0xd81818;
  for (const [name, parent, pos] of YOSHI_EXTRA_BONES) { const g = new THREE.Group(); g.name = name; g.position.set(...pos); b[parent].add(g); b[name] = g; }
  // torso: egg-shaped body with white belly
  b.spine.add(kit.sphere(0.15, body, [0, 0.07, -0.01], { seg: 10, scale: [1.0, 1.15, 1.12] }));
  b.spine.add(kit.sphere(0.12, white, [0, 0.07, 0.065], { seg: 9, scale: [0.85, 1.12, 0.75] }));
  // saddle: red shell with white rim on the back
  b.spine.add(kit.sphere(0.13, red, [0, 0.13, -0.11], { seg: 10, scale: [1.1, 0.75, 0.7] }));
  b.spine.add(kit.sphere(0.138, white, [0, 0.11, -0.1], { seg: 10, scale: [1.1, 0.72, 0.62] }));
  b.chest.add(kit.sphere(0.11, body, [0, 0.02, 0.02], { seg: 9, scale: [0.95, 1.0, 1.0] }));
  b.chest.add(kit.sphere(0.085, white, [0, 0.02, 0.07], { seg: 8, scale: [0.85, 1.0, 0.7] }));
  // neck
  b.neck.add(kit.cyl(0.065, 0.08, 0.15, body, [0, -0.02, 0.0], { seg: 8, rot: [0.25, 0, 0] }));
  b.neck.add(kit.cyl(0.05, 0.06, 0.13, white, [0, -0.02, 0.03], { seg: 7, rot: [0.25, 0, 0] }));
  // head: cranium + big bulbous snout, eyes on top, red spikes behind
  const h = b.head;
  h.add(kit.sphere(0.12, body, [0, 0.1, 0.03], { seg: 10, scale: [0.95, 1.0, 1.05] }));
  h.add(kit.sphere(0.13, body, [0, 0.08, 0.17], { seg: 10, scale: [1.0, 0.82, 1.18] }));     // snout
  h.add(kit.sphere(0.05, body, [0, 0.11, 0.3], { seg: 7, scale: [1.3, 1, 1] }));               // nose tip
  h.add(kit.sphere(0.1, white, [0, 0.0, 0.12], { seg: 9, scale: [0.95, 0.6, 1.25] }));        // white jaw/cheeks
  h.add(kit.box(0.14, 0.012, 0.16, 0x601818, [0, 0.025, 0.2]));                               // mouth line
  for (const s of [1, -1]) {
    h.add(kit.sphere(0.055, white, [s * 0.05, 0.22, 0.09], { seg: 8, scale: [0.75, 1.15, 0.7] }));
    h.add(kit.sphere(0.022, 0x101010, [s * 0.05, 0.225, 0.13], { seg: 6, scale: [0.8, 1.3, 0.6] }));
    h.add(kit.sphere(0.03, body, [s * 0.06, 0.12, 0.27], { seg: 5 }));                        // nostrils bump
  }
  const spike = (at, rot, s) => kit.cone(0.05 * s, 0.11 * s, red, at, { seg: 4, rot });
  h.add(spike([0, 0.17, -0.08], [-1.9, 0, 0], 1.25));
  h.add(spike([0, 0.08, -0.1], [-2.2, 0, 0], 1.0));
  b.neck.add(spike([0, 0.06, -0.07], [-2.3, 0, 0], 0.8));
  b.chest.add(spike([0, 0.08, -0.1], [-2.3, 0, 0], 0.7));
  // tongue (scaled out along +z for Egg Lay / grab) and its tip
  const tongue = new THREE.Group();
  const tg = new THREE.CylinderGeometry(0.022, 0.022, 1, 6); tg.rotateX(Math.PI / 2); tg.translate(0, 0, 0.5);
  tongue.add(new THREE.Mesh(tg, new THREE.MeshLambertMaterial({ color: 0xf04060 })));
  const ttip = kit.sphere(0.045, 0xf04060, [0, 0, 1], { seg: 7 }); tongue.add(ttip);
  tongue.position.set(0, 0.03, 0.22); tongue.visible = false; h.add(tongue);
  // arms (short) and legs (thick) with big shoes
  for (const s of ['L', 'R']) {
    b['upperArm' + s].add(kit.limb(0.034, P.upperArm, body));
    b['foreArm' + s].add(kit.limb(0.032, P.foreArm, body));
    b['hand' + s].add(kit.sphere(0.04, body, [0, -0.015, 0.01], { seg: 6, scale: [1, 1, 1.2] }));
    b['thigh' + s].add(kit.sphere(0.085, body, [0, -0.05, 0.0], { seg: 8, scale: [0.9, 1.2, 1.0] }));
    b['thigh' + s].add(kit.limb(0.06, P.thigh, body));
    b['shin' + s].add(kit.limb(0.045, P.shin, body, { r2: 0.05 }));
    b['foot' + s].add(kit.sphere(0.075, pal.shoe, [0, -0.01, 0.045], { seg: 8, scale: [1.0, 0.75, 1.55] }));
    b['foot' + s].add(kit.box(0.11, 0.025, 0.2, white, [0, -0.055, 0.04]));
  }
  // tail: tapering cone from the hips backwards (pivot extra1)
  b.extra1.add(kit.cone(0.1, 0.36, body, [0, 0, 0.02], { seg: 7, rot: [-Math.PI / 2 - 0.25, 0, 0] }));
  b.extra1.add(kit.sphere(0.1, body, [0, 0, 0], { seg: 7 }));
  // egg held in hand (Egg Throw)
  const held = eggMesh(pal.body, 0.075); held.position.set(0, -0.06, 0.03); held.visible = false; b.handR.add(held);
  return { bones: b, extra: { tongue, held } };
}
