// Fox McCloud model (SSB64 look): orange fur, white muzzle/chest, tall ears, metal head plate, short flight
// jacket over a white jumpsuit, red neckerchief, coloured trousers + boots, bushy white-tipped tail (bone
// extra1 on the hips), blaster in a hip holster (drawn into the right hand for Blaster), hexagonal Reflector
// and Fire Fox flames as toggled extras (see FOX animExtra in fox.js).
import * as THREE from 'three';
import { makeSkeleton, kit, mat } from '../render/rig.js';

const PI = Math.PI;
// effect material: unlit look via emissive (MeshBasic breaks the view's hurt/flash tint, which sets .emissive)
export const glowMat = (c, o, add = false, side = THREE.FrontSide) => new THREE.MeshLambertMaterial({ color: 0x000000, emissive: c, transparent: true, opacity: o, depthWrite: false, side, blending: add ? THREE.AdditiveBlending : THREE.NormalBlending });
export const FOX_PROPS = { hipY: 0.45, spine: 0.1, chest: 0.13, neck: 0.035, shoulderX: 0.115, shoulderY: 0.1, upperArm: 0.13, foreArm: 0.12, hipX: 0.06, thigh: 0.21, shin: 0.21 };
// tail bone: hips, slightly behind & up; tail geometry runs along local -z
export const FOX_EXTRA_BONES = [['extra1', 'hips', [0, 0.02, -0.07]]];

const FUR = 0xd88a38, WHITE = 0xfffaf0, METAL = 0xa8acb4, DARK = 0x303034;

function blasterMesh() {
  const g = new THREE.Group();
  g.add(kit.box(0.035, 0.05, 0.11, 0x50545c, [0, 0, 0.03]));        // body
  g.add(kit.box(0.025, 0.025, 0.08, 0x8a8e96, [0, 0.012, 0.11]));   // barrel
  g.add(kit.box(0.03, 0.07, 0.035, 0x3a3c42, [0, -0.04, -0.005]));  // grip
  return g;
}

export function fox(pal) {
  const b = makeSkeleton(FOX_PROPS);
  for (const [name, parent, pos] of FOX_EXTRA_BONES) { const g = new THREE.Group(); g.name = name; g.position.set(...pos); b[parent].add(g); b[name] = g; }
  // ---- torso: white jumpsuit belly, belt, jacket with open white chest, red neckerchief
  b.spine.add(kit.sphere(0.085, WHITE, [0, 0.05, 0], { seg: 8, scale: [1.05, 1.1, 0.9] }));
  b.spine.add(kit.box(0.17, 0.035, 0.14, DARK, [0, 0.0, 0]));                             // belt
  b.spine.add(kit.box(0.04, 0.04, 0.02, METAL, [0, 0.0, 0.07]));                           // buckle (reflector unit)
  b.chest.add(kit.sphere(0.1, pal.jacket, [0, 0.055, -0.01], { seg: 8, scale: [1.12, 1.0, 0.92] }));
  b.chest.add(kit.sphere(0.07, WHITE, [0, 0.06, 0.04], { seg: 7, scale: [0.85, 1.1, 0.8] }));  // white chest fur
  b.chest.add(kit.box(0.2, 0.03, 0.13, pal.jacket, [0, -0.02, -0.005]));                   // jacket hem
  const scarf = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.018, 5, 8), mat(pal.scarf ?? 0xd02020));
  scarf.rotation.x = PI / 2; scarf.position.set(0, 0.125, 0.005); b.chest.add(scarf);
  b.chest.add(kit.cone(0.03, 0.06, pal.scarf ?? 0xd02020, [0, 0.125, 0.05], { rot: [PI, 0, 0], seg: 4 }));  // knot
  // shoulder pads
  for (const s of [1, -1]) b.chest.add(kit.sphere(0.05, pal.jacket, [s * 0.1, 0.09, -0.005], { seg: 6, scale: [1.1, 0.8, 1] }));
  // ---- head (base at neck top): skull, muzzle, cheeks, ears, eyes, metal plate
  const h = new THREE.Group(); h.scale.setScalar(1.12); b.head.add(h);
  h.add(kit.sphere(0.085, FUR, [0, 0.085, -0.005], { seg: 8, scale: [1.0, 0.95, 1.05] }));
  h.add(kit.cone(0.05, 0.12, FUR, [0, 0.075, 0.04], { rot: [PI / 2, 0, 0], seg: 5 }));            // upper snout
  h.add(kit.cone(0.04, 0.1, WHITE, [0, 0.045, 0.04], { rot: [PI / 2 + 0.12, 0, 0], seg: 5 }));    // lower jaw
  h.add(kit.sphere(0.017, 0x181818, [0, 0.083, 0.16], { seg: 5 }));                              // nose
  for (const s of [1, -1]) {
    h.add(kit.cone(0.045, 0.09, WHITE, [s * 0.075, 0.045, 0.015], { rot: [0, 0, s * 2.1], seg: 4 }));  // cheek tufts
    const ear = kit.cone(0.035, 0.11, FUR, [s * 0.05, 0.14, -0.02], { rot: [-0.15, 0, -s * 0.22], seg: 4 });
    h.add(ear);
    h.add(kit.cone(0.02, 0.07, 0x2a2018, [s * 0.052, 0.15, -0.005], { rot: [-0.15, 0, -s * 0.22], seg: 3 }));
    h.add(kit.sphere(0.018, 0x38a848, [s * 0.04, 0.1, 0.07], { seg: 5, scale: [0.9, 1.2, 0.6] }));     // eyes
    h.add(kit.sphere(0.009, 0x101010, [s * 0.04, 0.1, 0.082], { seg: 4 }));
  }
  h.add(kit.box(0.09, 0.025, 0.07, METAL, [0, 0.165, 0.005], { flat: true }));                    // head plate
  h.add(kit.box(0.012, 0.04, 0.03, METAL, [0.085, 0.085, 0.0]));                                 // headset
  h.add(kit.box(0.008, 0.008, 0.06, METAL, [0.085, 0.065, 0.035]));                              // mic boom
  // ---- arms: jacket sleeves, white gloves
  for (const s of ['L', 'R']) {
    b['upperArm' + s].add(kit.limb(0.04, FOX_PROPS.upperArm, pal.jacket));
    b['foreArm' + s].add(kit.limb(0.033, FOX_PROPS.foreArm, WHITE));
    b['foreArm' + s].add(kit.cyl(0.038, 0.038, 0.03, METAL, [0, -0.075, 0]));                    // wrist band
    b['hand' + s].add(kit.sphere(0.042, WHITE, [0, -0.025, 0.005], { seg: 6 }));
    b['thigh' + s].add(kit.limb(0.048, FOX_PROPS.thigh, pal.pants));
    b['shin' + s].add(kit.limb(0.038, FOX_PROPS.shin * 0.55, pal.pants, { noJoint: false }));
    b['shin' + s].add(kit.cyl(0.042, 0.048, FOX_PROPS.shin * 0.5, pal.boot, [0, -FOX_PROPS.shin * 0.5, 0]));
    b['shin' + s].add(kit.cyl(0.05, 0.05, 0.025, METAL, [0, -FOX_PROPS.shin * 0.45, 0]));        // boot band
    b['foot' + s].add(kit.sphere(0.05, pal.boot, [0, -0.015, 0.035], { seg: 6, scale: [0.9, 0.6, 1.7] }));
  }
  // ---- holster + blaster on the right hip; a second blaster in the right hand (Blaster only)
  const holster = new THREE.Group(); holster.position.set(-0.095, -0.02, 0.0); b.hips.add(holster);
  holster.add(kit.box(0.025, 0.07, 0.05, 0x4a3a2a, [0, -0.02, 0]));
  holster.scale.setScalar(0.8);
  const gunHip = blasterMesh(); gunHip.rotation.x = PI / 2; gunHip.position.set(-0.01, -0.03, 0); holster.add(gunHip);
  const gunHand = blasterMesh(); gunHand.position.set(0, -0.04, 0.02); gunHand.rotation.x = -PI / 2; b.handR.add(gunHand);
  gunHand.visible = false;
  // ---- tail (extra1): bushy, white tip
  const t = b.extra1;
  t.add(kit.sphere(0.035, FUR, [0, 0, -0.03], { seg: 6 }));
  t.add(kit.sphere(0.055, FUR, [0, -0.005, -0.11], { seg: 7, scale: [0.9, 0.9, 1.4] }));
  t.add(kit.sphere(0.06, FUR, [0, 0.025, -0.2], { seg: 7, scale: [0.95, 0.95, 1.3] }));
  t.add(kit.sphere(0.045, WHITE, [0, 0.06, -0.28], { seg: 6, scale: [1, 1, 1.4] }));
  // ---- Reflector hexagon (faces the camera: normal along local x) and Fire Fox flames, on the body
  const refl = new THREE.Group(); refl.position.set(0, 0.5, 0); b.body.add(refl);
  const hexM = glowMat(0x60c0ff, 0.6, false, THREE.DoubleSide);
  const hex = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.02, 6, 1, true), hexM); hex.rotation.z = PI / 2; refl.add(hex);
  const hexFill = new THREE.Mesh(new THREE.CircleGeometry(0.6, 6), glowMat(0x90e0ff, 0.35, false, THREE.DoubleSide));
  hexFill.rotation.y = PI / 2; refl.add(hexFill);
  const hexEdge = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.CircleGeometry(0.62, 6)), new THREE.LineBasicMaterial({ color: 0xe0ffff }));
  hexEdge.rotation.y = PI / 2; refl.add(hexEdge);
  refl.visible = false;
  const fire = new THREE.Group(); fire.position.set(0, 0.5, 0); b.body.add(fire);
  const fm = (c, o) => glowMat(c, o);
  const flames = [];
  for (let i = 0; i < 7; i++) {
    const c = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.5, 5), fm(i % 2 ? 0xffb020 : 0xff4a10, 0.8));
    const a = (i / 7) * PI * 2; c.position.set(Math.cos(a) * 0.12, Math.sin(a) * 0.25, 0); c.rotation.z = a - PI / 2;
    fire.add(c); flames.push(c);
  }
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 6), fm(0xff8020, 0.45)); fire.add(core);
  fire.visible = false;
  return { bones: b, extra: { gunHip, gunHand, refl, fire, flames, core } };
}
