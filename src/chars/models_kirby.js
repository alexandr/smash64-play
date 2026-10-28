// Kirby model: pink puffball with tiny arms and big red feet. Model units: 1.0 = standing height (230 u).
// Copy-ability hats for every character are built hidden and toggled in animExtra; Final Cutter blade and
// the Stone form are extra meshes too.
import * as THREE from 'three';
import { makeSkeleton, kit } from '../render/rig.js';

export const KIRBY_PROPS = { hipY: 0.2, spine: 0.12, chest: 0.12, neck: 0.04, shoulderX: 0.34, shoulderY: 0.05, upperArm: 0.09, foreArm: 0.06, hipX: 0.15, thigh: 0.07, shin: 0.06 };
const BODY_C = [0, 0.32, 0];   // body-sphere centre in spine space (world y ~0.52)
const R = 0.44;

function hats() {
  const H = {};
  const cap = (col, emblem, brim = col) => {
    const g = new THREE.Group();
    g.add(kit.sphere(R * 1.02, col, [0, 0.12, 0], { seg: 12, scale: [1.02, 0.62, 1.02] }));
    g.add(kit.box(0.42, 0.04, 0.2, brim, [0, 0.22, 0.38]));
    if (emblem) { g.add(kit.sphere(0.075, 0xffffff, [0, 0.33, 0.33], { seg: 8, scale: [1, 1, 0.35] })); g.add(kit.box(0.06, 0.06, 0.02, emblem, [0, 0.33, 0.36])); }
    return g;
  };
  H.mario = cap(0xe02818, 0xe02818);
  H.luigi = cap(0x20a030, 0x20a030);
  H.ness = cap(0xe02020, null, 0x2040c0);
  // Fox: ears + headset
  const ear = (col, tip, s, h = 0.3, r = 0.1, tilt = 0.35) => {
    const g = new THREE.Group(); g.position.set(s * 0.19, 0.33, -0.02); g.rotation.z = -s * tilt;
    g.add(kit.cone(r, h, col, [0, 0, 0], { seg: 5 }));
    if (tip) g.add(kit.cone(r * 0.38, h * 0.36, tip, [0, h * 0.64, 0], { seg: 5 }));
    return g;
  };
  H.fox = new THREE.Group();
  for (const s of [1, -1]) { H.fox.add(ear(0xc88040, null, s, 0.28, 0.11)); const inner = ear(0xf8e8c8, null, s, 0.18, 0.06); inner.position.z += 0.03; H.fox.add(inner); }
  const band = new THREE.Mesh(new THREE.TorusGeometry(R * 1.03, 0.022, 5, 18, Math.PI), new THREE.MeshLambertMaterial({ color: 0x606068 }));
  band.position.set(0, 0, 0.0); H.fox.add(band);
  H.fox.add(kit.sphere(0.06, 0x606068, [R * 1.0, -0.02, 0.04], { seg: 6 }));
  H.fox.add(kit.box(0.025, 0.025, 0.22, 0x606068, [R * 0.95, -0.06, 0.16]));
  // Samus helmet
  H.samus = new THREE.Group();
  H.samus.add(kit.sphere(R * 1.05, 0xd03018, [0, 0.06, -0.02], { seg: 12, scale: [1.03, 0.85, 1.0] }));
  H.samus.add(kit.box(0.4, 0.13, 0.12, 0x30c838, [0, 0.16, 0.38]));
  H.samus.add(kit.box(0.04, 0.12, 0.3, 0xf0c030, [0, 0.47, 0.0]));
  // DK: brown hair tuft
  H.dk = new THREE.Group();
  for (let i = 0; i < 5; i++) H.dk.add(kit.cone(0.1, 0.3, 0x5a3010, [(i - 2) * 0.08, 0.34 + (i % 2) * 0.03, 0.06 - Math.abs(i - 2) * 0.04], { seg: 5, rot: [-0.35, 0, -(i - 2) * 0.3] }));
  H.dk.add(kit.sphere(R * 0.9, 0x5a3010, [0, 0.12, -0.08], { seg: 10, scale: [1, 0.55, 1] }));
  // Link: long green cap + hair
  H.link = new THREE.Group();
  H.link.add(kit.sphere(R * 1.02, 0x30a030, [0, 0.14, -0.02], { seg: 12, scale: [1.02, 0.58, 1.02] }));
  H.link.add(kit.cone(0.2, 0.55, 0x30a030, [0, 0.32, -0.25], { seg: 7, rot: [-2.1, 0, 0] }));
  H.link.add(kit.box(0.34, 0.06, 0.08, 0xf0d040, [0, 0.23, 0.4]));
  // Yoshi: green dome with white muzzle edge and red spikes
  H.yoshi = new THREE.Group();
  H.yoshi.add(kit.sphere(R * 1.03, 0x30c818, [0, 0.12, -0.03], { seg: 12, scale: [1.03, 0.62, 1.03] }));
  for (let i = 0; i < 3; i++) H.yoshi.add(kit.cone(0.07, 0.14, 0xd81818, [0, 0.42 - i * 0.12, -0.2 - i * 0.1], { seg: 4, rot: [-1.4 - i * 0.3, 0, 0] }));
  H.yoshi.add(kit.sphere(0.07, 0xffffff, [0.12, 0.42, 0.18], { seg: 7 })); H.yoshi.add(kit.sphere(0.07, 0xffffff, [-0.12, 0.42, 0.18], { seg: 7 }));
  // C. Falcon helmet
  H.falcon = new THREE.Group();
  H.falcon.add(kit.sphere(R * 1.04, 0x2040b0, [0, 0.08, -0.02], { seg: 12, scale: [1.03, 0.75, 1.02] }));
  H.falcon.add(kit.cone(0.1, 0.16, 0xf0c020, [0, 0.36, 0.3], { seg: 4, rot: [1.2, 0, 0] }));
  H.falcon.add(kit.box(0.42, 0.05, 0.06, 0xf0c020, [0, 0.24, 0.41]));
  // Pikachu: long yellow ears with black tips
  H.pikachu = new THREE.Group();
  for (const s of [1, -1]) H.pikachu.add(ear(0xf8d820, 0x101010, s, 0.36, 0.085, 0.45));
  // Jigglypuff: pink curl
  H.jigglypuff = new THREE.Group();
  H.jigglypuff.add(kit.sphere(0.13, 0xf8b0c8, [0, 0.42, 0.18], { seg: 8, scale: [0.6, 1, 1] }));
  H.jigglypuff.add(kit.sphere(0.07, 0xf8b0c8, [0, 0.36, 0.32], { seg: 7 }));
  for (const k of Object.values(H)) k.visible = false;
  return H;
}

export function kirbyModel(pal) {
  const b = makeSkeleton(KIRBY_PROPS);
  const body = new THREE.Group(); body.position.set(...BODY_C); b.spine.add(body);
  body.add(kit.sphere(R, pal.body, [0, 0, 0], { seg: 14, scale: [1.0, 0.98, 0.96] }));
  // face (features sit on the sphere surface, facing outward)
  const surf = (x, y, out = 0) => { const z = 0.96 * Math.sqrt(Math.max(0, R * R - x * x - (y / 0.98) ** 2)); const k = 1 + out / R; return [x * k, y * k, z * k]; };
  const onFace = (mesh, x, y, out) => { mesh.position.set(...surf(x, y, out)); mesh.lookAt(mesh.position.clone().multiplyScalar(2)); body.add(mesh); return mesh; };
  for (const s of [1, -1]) {
    const eye = new THREE.Group();
    eye.add(kit.sphere(0.05, 0x101018, [0, 0, 0], { seg: 8, scale: [0.72, 1.75, 0.35] }));
    eye.add(kit.sphere(0.036, 0x2848e0, [0, -0.045, 0.008], { seg: 7, scale: [0.72, 0.9, 0.3] }));
    eye.add(kit.sphere(0.02, 0xffffff, [0, 0.04, 0.014], { seg: 6, scale: [0.85, 1.4, 0.4] }));
    onFace(eye, s * 0.095, 0.075, -0.005);
    onFace(kit.sphere(0.06, pal.cheek, [0, 0, 0], { seg: 7, scale: [1.25, 0.6, 0.25] }), s * 0.2, -0.04, -0.008);
  }
  const mouth = onFace(kit.sphere(0.024, 0x401018, [0, 0, 0], { seg: 6, scale: [0.9, 0.8, 0.4] }), 0, -0.05, -0.002);
  // open mouth (inhale)
  const mouthOpen = onFace(kit.sphere(0.12, 0x701028, [0, 0, 0], { seg: 10, scale: [1.0, 0.9, 0.4] }), 0, -0.05, -0.03);
  mouthOpen.visible = false;
  // stubby arms: nubs hanging from the shoulders; feet: big red ovals
  for (const s of ['L', 'R']) {
    b['upperArm' + s].add(kit.sphere(0.1, pal.body, [0, -0.07, 0], { seg: 8, scale: [0.75, 1.15, 0.75] }));
    b['hand' + s].add(kit.sphere(0.06, pal.body, [0, 0, 0], { seg: 6 }));
    b['foot' + s].add(kit.sphere(0.14, pal.foot, [0, 0.0, 0.09], { seg: 10, scale: [0.85, 0.58, 1.45] }));
  }
  const H = hats(); for (const h of Object.values(H)) body.add(h);
  // Final Cutter blade (on the right hand)
  const blade = new THREE.Group();
  blade.add(kit.box(0.05, 0.12, 0.05, 0x8a5a20, [0, -0.02, 0]));
  blade.add(kit.box(0.14, 0.03, 0.05, 0xd0b040, [0, -0.09, 0]));
  blade.add(kit.box(0.07, 0.5, 0.015, 0xe8f0ff, [0, -0.34, 0], { emissive: 0x304060 }));
  blade.visible = false; b.handR.add(blade);
  // Stone form
  const stone = new THREE.Group();
  stone.add(new THREE.Mesh(new THREE.DodecahedronGeometry(0.5, 0), new THREE.MeshLambertMaterial({ color: 0x8a8a90, flatShading: true })));
  stone.children[0].scale.set(1.05, 0.95, 1.0);
  stone.add(kit.box(0.5, 0.12, 0.3, 0x6a6a70, [0, -0.38, 0], { flat: true }));
  stone.position.set(0, 0.48, 0); stone.visible = false; b.root.add(stone);
  // inhale wind: streaks flowing into the mouth (animated in animExtra)
  const suck = new THREE.Group();
  const sm = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55, depthWrite: false });
  for (let i = 0; i < 7; i++) {
    const st = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.018, 0.35), sm);
    const a = (i / 7) * Math.PI * 2; st.userData = { a, r: 0.12 + (i % 3) * 0.06, ph: i / 7 };
    suck.add(st);
  }
  suck.position.set(0, -0.05, R); suck.visible = false; body.add(suck);
  return { bones: b, extra: { hats: H, blade, stone, mouth, mouthOpen, suck, bodyMesh: body } };
}
