// Ness model (SSB64 look): big round head, baseball cap with a contrasting bill, black hair, striped shirt,
// shorts, sneakers, backpack with straps. Bat (bone extra1 on the right hand, along the hand's -y) and yo-yo
// (on the root, placed each frame by Ness's animExtra) appear only during their smash attacks. Extras:
// PSI Magnet bubble, PK Thunder 2 aura.
import * as THREE from 'three';
import { makeSkeleton, kit, mat } from '../render/rig.js';

const PI = Math.PI;
// effect material: unlit look via emissive (MeshBasic breaks the view's hurt/flash tint, which sets .emissive)
export const glowMat = (c, o, add = false, side = THREE.FrontSide) => new THREE.MeshLambertMaterial({ color: 0x000000, emissive: c, transparent: true, opacity: o, depthWrite: false, side, blending: add ? THREE.AdditiveBlending : THREE.NormalBlending });

export const NESS_PROPS = { hipY: 0.27, spine: 0.1, chest: 0.1, neck: 0.025, shoulderX: 0.115, shoulderY: 0.075, upperArm: 0.1, foreArm: 0.09, hipX: 0.06, thigh: 0.125, shin: 0.115 };
export const NESS_EXTRA_BONES = [['extra1', 'handR', [0, -0.025, 0.0]]];
export const BAT_LEN = 0.92;

const SKIN = 0xf8c8a0, HAIR = 0x1e1610;

function stripes(parent, rTop, rBot, h, y0, n, c1, c2) {
  for (let i = 0; i < n; i++) {
    const t0 = i / n, t1 = (i + 1) / n;
    const r0 = rBot + (rTop - rBot) * t0, r1 = rBot + (rTop - rBot) * t1;
    parent.add(kit.cyl(r1, r0, h / n, i % 2 ? c2 : c1, [0, y0 + h * t0, 0], { seg: 9 }));
  }
}

export function ness(pal) {
  const b = makeSkeleton(NESS_PROPS);
  for (const [name, parent, pos] of NESS_EXTRA_BONES) { const g = new THREE.Group(); g.name = name; g.position.set(...pos); b[parent].add(g); b[name] = g; }
  // torso: striped shirt (spine + chest), shorts on the hips
  stripes(b.spine, 0.105, 0.115, 0.1, 0.0, 2, pal.stripe2, pal.stripe1);
  stripes(b.chest, 0.09, 0.105, 0.1, 0.0, 2, pal.stripe2, pal.stripe1);
  b.chest.add(kit.sphere(0.09, pal.stripe2, [0, 0.1, 0], { seg: 8, scale: [1, 0.35, 0.9] }));
  b.hips.add(kit.cyl(0.115, 0.12, 0.07, pal.shorts, [0, -0.05, 0], { seg: 9 }));
  // backpack + straps
  b.chest.add(kit.box(0.15, 0.15, 0.08, pal.pack, [0, 0.03, -0.13]));
  b.chest.add(kit.box(0.13, 0.03, 0.06, pal.pack2, [0, 0.11, -0.13]));
  for (const s of [1, -1]) b.chest.add(kit.box(0.025, 0.2, 0.02, pal.pack2, [s * 0.06, 0.03, 0.098]));
  // head: big round face, hair, cap with bill
  const h = b.head;
  h.add(kit.sphere(0.165, SKIN, [0, 0.15, 0.0], { seg: 11, scale: [1.0, 0.98, 0.95] }));
  h.add(kit.sphere(0.168, HAIR, [0, 0.165, -0.025], { seg: 10, scale: [1.0, 0.92, 0.92] }));
  for (const s of [1, -1]) {
    h.add(kit.sphere(0.022, 0x18120e, [s * 0.06, 0.16, 0.148], { seg: 5, scale: [0.8, 1.2, 0.5] }));    // eyes
    h.add(kit.sphere(0.03, SKIN, [s * 0.16, 0.14, 0.0], { seg: 5, scale: [0.5, 1, 0.8] }));               // ears
  }
  h.add(kit.sphere(0.018, 0xf0a888, [0, 0.12, 0.162], { seg: 5 }));                                       // nose
  h.add(kit.box(0.04, 0.008, 0.01, 0x8a3020, [0, 0.085, 0.152]));                                         // mouth
  h.add(kit.sphere(0.172, pal.cap, [0, 0.21, -0.01], { seg: 11, scale: [1.02, 0.62, 1.02] }));            // cap dome
  const bill = kit.cyl(0.13, 0.13, 0.02, pal.bill, [0, 0.215, 0.0], { seg: 10 });
  bill.scale.set(0.9, 1, 1.0); bill.position.set(0.0, 0.21, 0.12); bill.rotation.set(-0.12, 0, 0); h.add(bill);
  h.add(kit.box(0.07, 0.03, 0.015, pal.bill, [0, 0.27, 0.15]));                                           // cap badge
  // arms: short striped sleeves, skin
  for (const s of ['L', 'R']) {
    b['upperArm' + s].add(kit.limb(0.037, 0.045, pal.stripe1));
    b['upperArm' + s].add(kit.cyl(0.033, 0.033, NESS_PROPS.upperArm - 0.04, SKIN, [0, -0.04, 0], { hang: true }));
    b['foreArm' + s].add(kit.limb(0.032, NESS_PROPS.foreArm, SKIN));
    b['hand' + s].add(kit.sphere(0.04, SKIN, [0, -0.02, 0.005], { seg: 6 }));
    b['thigh' + s].add(kit.limb(0.048, NESS_PROPS.thigh * 0.45, pal.shorts));
    b['thigh' + s].add(kit.cyl(0.036, 0.036, NESS_PROPS.thigh * 0.6, SKIN, [0, -NESS_PROPS.thigh * 0.4, 0], { hang: true }));
    b['shin' + s].add(kit.limb(0.035, NESS_PROPS.shin, SKIN));
    b['shin' + s].add(kit.cyl(0.04, 0.04, 0.03, 0xf4f4f4, [0, -NESS_PROPS.shin + 0.03, 0], { hang: true }));  // socks
    b['foot' + s].add(kit.sphere(0.055, pal.shoe, [0, -0.015, 0.035], { seg: 7, scale: [0.9, 0.65, 1.55] }));
    b['foot' + s].add(kit.box(0.08, 0.02, 0.15, 0xf0f0f0, [0, -0.045, 0.035]));                             // soles
  }
  // bat on the right hand (along the hand's -y)
  const bat = new THREE.Group(); b.extra1.add(bat);
  bat.add(kit.cyl(0.018, 0.022, 0.25, 0x6a4a2a, [0, 0, 0], { hang: true, seg: 6 }));
  bat.add(kit.cyl(0.024, 0.05, BAT_LEN - 0.25, 0xd8b070, [0, -0.25, 0], { hang: true, seg: 7 }));
  bat.add(kit.sphere(0.05, 0xd8b070, [0, -BAT_LEN, 0], { seg: 6, scale: [1, 0.4, 1] }));
  bat.visible = false;
  // yo-yo (root space, placed by animExtra) and its string
  const yoyo = new THREE.Group(); b.root.add(yoyo);
  const disc = new THREE.Group(); yoyo.add(disc);
  for (const s of [1, -1]) disc.add(kit.cyl(0.06, 0.06, 0.03, s > 0 ? 0xe02020 : 0xf0f0f0, [s * 0.017, 0, 0], { seg: 10, rot: [0, 0, PI / 2] }));
  disc.add(kit.cyl(0.02, 0.02, 0.07, 0x404040, [0.035, 0, 0], { seg: 6, rot: [0, 0, PI / 2] }));
  yoyo.visible = false;
  const string = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 1, 4), mat(0xf0f0f0));
  string.geometry.translate(0, 0.5, 0); b.root.add(string); string.visible = false;
  // PSI Magnet bubble (in front of the chest) and PK Thunder 2 aura
  const magnet = new THREE.Group(); magnet.position.set(0, 0.62, 0.18); b.body.add(magnet);
  magnet.add(new THREE.Mesh(new THREE.SphereGeometry(0.42, 12, 9), glowMat(0x50a0ff, 0.3, true)));
  magnet.add(new THREE.Mesh(new THREE.SphereGeometry(0.25, 10, 8), glowMat(0xa0e0ff, 0.35, true)));
  const rings = [];
  for (let i = 0; i < 3; i++) { const r = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.02, 5, 16), glowMat(0xc0f0ff, 0.6, true)); r.rotation.set(i * 1.05, i * 0.7, 0); magnet.add(r); rings.push(r); }
  magnet.visible = false;
  const aura = new THREE.Group(); aura.position.set(0, 0.45, 0); b.body.add(aura);
  aura.add(new THREE.Mesh(new THREE.SphereGeometry(0.55, 10, 8), glowMat(0x80d0ff, 0.4, true)));
  for (let i = 0; i < 8; i++) { const c = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.5, 3), glowMat(0xffffff, 0.9, true)); const a = i / 8 * PI * 2; c.position.set(0, Math.sin(a) * 0.5, Math.cos(a) * 0.5); c.rotation.x = a + PI / 2; aura.add(c); }
  aura.visible = false;
  return { bones: b, extra: { bat, yoyo, disc, string, magnet, rings, aura } };
}
