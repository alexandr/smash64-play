// Pikachu model (SSB64 look): round yellow body, very large head with long black-tipped ears, red cheeks,
// tiny arms, stubby feet, brown back stripes, zigzag lightning tail (bone extra1 on the hips; the tail runs
// up-and-back from it). Alternate costumes add a party hat. Extras: electric aura (aerials / Thunder),
// Thunder Shock field (fsmash), Quick Attack streak.
import * as THREE from 'three';
import { makeSkeleton, kit, mat } from '../render/rig.js';

const PI = Math.PI;
// effect material: unlit look via emissive (MeshBasic breaks the view's hurt/flash tint, which sets .emissive)
export const glowMat = (c, o, add = false, side = THREE.FrontSide) => new THREE.MeshLambertMaterial({ color: 0x000000, emissive: c, transparent: true, opacity: o, depthWrite: false, side, blending: add ? THREE.AdditiveBlending : THREE.NormalBlending });
export const PIKA_PROPS = { hipY: 0.2, spine: 0.11, chest: 0.1, neck: 0.02, shoulderX: 0.105, shoulderY: 0.06, upperArm: 0.075, foreArm: 0.065, hipX: 0.075, thigh: 0.105, shin: 0.08 };
export const PIKA_EXTRA_BONES = [['extra1', 'hips', [0, 0.03, -0.13]]];
// tail direction in the extra1 bone frame (up and back); hitbox offsets for tail moves use this
export const PIKA_TAIL_DIR = [0, Math.sin(0.75), -Math.cos(0.75)];

const BLACK = 0x1a1410, BROWN = 0x8b5a2b, RED = 0xe83020;

function tailMesh(color) {
  // zigzag lightning bolt in the y/z plane of a group pointing along +y; group rotated to PIKA_TAIL_DIR
  const g = new THREE.Group();
  const seg = (len, w, ang, at, c) => { const m = kit.box(0.022, len, w, c, at); m.rotation.x = ang; g.add(m); return m; };
  seg(0.08, 0.04, 0.0, [0, 0.04, 0], BROWN);
  seg(0.12, 0.07, -0.9, [0, 0.12, 0.04], color);
  seg(0.14, 0.09, 0.9, [0, 0.2, 0.02], color);
  seg(0.2, 0.17, -0.7, [0, 0.33, 0.03], color);
  return g;
}

export function pikachu(pal) {
  const b = makeSkeleton(PIKA_PROPS);
  for (const [name, parent, pos] of PIKA_EXTRA_BONES) { const g = new THREE.Group(); g.name = name; g.position.set(...pos); b[parent].add(g); b[name] = g; }
  const Y = pal.body;
  // body: pear-shaped torso
  b.spine.add(kit.sphere(0.165, Y, [0, 0.07, -0.01], { seg: 10, scale: [1.0, 0.95, 0.95] }));
  b.chest.add(kit.sphere(0.13, Y, [0, 0.03, -0.005], { seg: 9, scale: [1.0, 0.9, 0.9] }));
  // brown back stripes
  b.chest.add(kit.box(0.16, 0.025, 0.04, BROWN, [0, 0.02, -0.115]));
  b.chest.add(kit.box(0.14, 0.025, 0.04, BROWN, [0, -0.04, -0.12]));
  // head
  const h = b.head;
  h.add(kit.sphere(0.19, Y, [0, 0.15, 0.02], { seg: 11, scale: [1.12, 0.92, 0.95] }));
  for (const s of [1, -1]) {
    h.add(kit.sphere(0.042, RED, [s * 0.15, 0.085, 0.11], { seg: 7, scale: [0.6, 1, 1] }));              // cheeks
    h.add(kit.sphere(0.034, BLACK, [s * 0.08, 0.17, 0.165], { seg: 6, scale: [0.9, 1.15, 0.6] }));      // eyes
    h.add(kit.sphere(0.012, 0xffffff, [s * 0.072, 0.185, 0.185], { seg: 4 }));                             // glint
    // ears: long, angled up and out, black tips
    const ear = new THREE.Group(); ear.position.set(s * 0.1, 0.27, -0.01); ear.rotation.set(-0.15, 0, -s * 0.5); h.add(ear);
    ear.add(kit.cone(0.058, 0.27, Y, [0, 0, 0], { seg: 6 }));
    ear.add(kit.cone(0.03, 0.12, BLACK, [0, 0.165, 0], { seg: 6 }));
    ear.children[0].scale.set(1, 1, 0.6); ear.children[1].scale.set(1, 1, 0.6);
  }
  h.add(kit.sphere(0.01, BLACK, [0, 0.135, 0.2], { seg: 4 }));                                            // nose
  h.add(kit.box(0.05, 0.008, 0.01, 0x602010, [0, 0.105, 0.195]));                                          // mouth
  // party hat (alternate costumes)
  if (pal.hat) {
    const hat = new THREE.Group(); hat.position.set(0, 0.29, 0.0); hat.rotation.x = -0.15; h.add(hat);
    hat.add(kit.cone(0.085, 0.2, pal.hat, [0, 0, 0], { seg: 8 }));
    for (let i = 0; i < 5; i++) { const a = i / 5 * PI * 2; hat.add(kit.sphere(0.016, pal.hatDot, [Math.cos(a) * 0.055, 0.06 + (i % 2) * 0.04, Math.sin(a) * 0.055], { seg: 4 })); }
    hat.add(kit.box(0.045, 0.045, 0.045, pal.hatTip, [0, 0.22, 0], { flat: true }));
    hat.children[hat.children.length - 1].rotation.set(PI / 4, 0, PI / 4);
  }
  // arms (tiny) & legs (stubby, big feet)
  for (const s of ['L', 'R']) {
    b['upperArm' + s].add(kit.limb(0.035, PIKA_PROPS.upperArm, Y));
    b['foreArm' + s].add(kit.limb(0.032, PIKA_PROPS.foreArm, Y));
    b['hand' + s].add(kit.sphere(0.034, Y, [0, -0.01, 0.005], { seg: 6 }));
    b['thigh' + s].add(kit.limb(0.06, PIKA_PROPS.thigh, Y));
    b['shin' + s].add(kit.limb(0.048, PIKA_PROPS.shin, Y));
    b['foot' + s].add(kit.sphere(0.05, Y, [0, -0.01, 0.04], { seg: 6, scale: [0.9, 0.55, 1.6] }));
  }
  // tail
  const tail = tailMesh(Y);
  tail.rotation.x = 0.75 - PI / 2;   // +y of the mesh -> PIKA_TAIL_DIR (up & back)
  b.extra1.add(tail);
  // electric aura (centered on the body), Thunder Shock field (fsmash), Quick Attack streak
  const add = (c, o) => glowMat(c, o, true);
  const aura = new THREE.Group(); aura.position.set(0, 0.4, 0); b.body.add(aura);
  aura.add(new THREE.Mesh(new THREE.SphereGeometry(0.5, 10, 8), add(0xfff060, 0.35)));
  const bolts = [];
  for (let i = 0; i < 8; i++) { const c = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.45, 3), add(0xffffa0, 0.9)); const a = i / 8 * PI * 2; c.position.set(0, Math.sin(a) * 0.45, Math.cos(a) * 0.45); c.rotation.x = a + PI / 2; aura.add(c); bolts.push(c); }
  aura.visible = false;
  const field = new THREE.Group(); field.position.set(0, 0.33, 0); b.body.add(field);
  const fs = [[0.67, 0.27], [1.42, 0.43], [2.5, 0.53]];
  for (const [z, r] of fs) {
    const ball = new THREE.Mesh(new THREE.SphereGeometry(r, 9, 7), add(0xffe840, 0.4)); ball.position.set(0, 0, z); field.add(ball);
    for (let k = 0; k < 3; k++) { const c = new THREE.Mesh(new THREE.ConeGeometry(0.04, r * 1.8, 3), add(0xffffc0, 0.95)); c.position.set(0, 0, z); c.rotation.set(k * 1.1, 0, k * 0.7); field.add(c); }
  }
  field.visible = false;
  const streak = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.02, 1.6, 7), add(0xffffff, 0.55));
  streak.geometry.translate(0, -0.8, 0); const streakG = new THREE.Group(); streakG.position.set(0, 0.35, 0); streakG.add(streak); b.root.add(streakG); streakG.visible = false;
  return { bones: b, extra: { aura, bolts, field, streak: streakG } };
}
