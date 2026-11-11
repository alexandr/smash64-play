// Saffron City door Pokémon: low-poly models (kit primitives) and per-frame visuals for the Pokémon,
// their projectiles (flames, razor leaves), Electrode's blast and Chansey's egg. Models face -x (out of the door).
import * as THREE from 'three';
import { kit, mat } from '../render/rig.js';

const S = (rs) => (v) => v * rs;

function charmander(rs) {
  const s = S(rs), g = new THREE.Group(), o = 0xf08838, belly = 0xf8e090;
  const body = new THREE.Group(); g.add(body);
  body.add(kit.sphere(s(130), o, [0, s(170), 0], { seg: 8, scale: [1, 1.15, 0.95] }));
  body.add(kit.sphere(s(95), belly, [s(-55), s(160), 0], { seg: 7, scale: [0.6, 1, 0.9] }));
  body.add(kit.sphere(s(115), o, [s(-30), s(370), 0], { seg: 8, scale: [1.1, 1, 0.95] }));       // head
  body.add(kit.sphere(s(55), o, [s(-120), s(350), 0], { seg: 6 }));                                 // snout
  for (const z of [-55, 55]) {
    body.add(kit.sphere(s(22), 0x101830, [s(-105), s(400), s(z)], { seg: 5 }));
    body.add(kit.sphere(s(9), 0xffffff, [s(-115), s(410), s(z)], { seg: 4 }));
    body.add(kit.sphere(s(40), o, [s(-60), s(200), s(z * 2.2)], { seg: 5, scale: [1.4, 0.7, 0.7] })); // arms
    body.add(kit.sphere(s(55), o, [s(-10), s(40), s(z * 1.4)], { seg: 6, scale: [1.3, 0.7, 0.9] }));   // feet
  }
  const tail = kit.cyl(s(25), s(45), s(220), o, [s(90), s(90), 0], { seg: 6, rot: [0, 0, -1.0] });
  body.add(tail);
  const flame = kit.cone(s(55), s(140), 0xffb020, [s(270), s(210), 0], { seg: 5, emissive: 0x804000 });
  body.add(flame);
  g.userData = { body, flame };
  return g;
}

function venusaur(rs) {
  const s = S(rs), g = new THREE.Group(), skin = 0x58a8a0, dark = 0x3a7870;
  const body = new THREE.Group(); g.add(body);
  body.add(kit.sphere(s(330), skin, [0, s(280), 0], { seg: 9, scale: [1.3, 0.8, 1] }));
  body.add(kit.sphere(s(190), skin, [s(-380), s(330), 0], { seg: 8, scale: [1.1, 0.85, 1] }));       // head
  for (const z of [-110, 110]) {
    body.add(kit.sphere(s(30), 0xc02020, [s(-520), s(390), s(z)], { seg: 5 }));
    body.add(kit.sphere(s(40), skin, [s(-400), s(480), s(z * 1.2)], { seg: 4, scale: [0.6, 1, 0.6] }));
  }
  body.add(kit.box(s(170), s(20), s(200), 0x302020, [s(-470), s(260), 0]));                        // mouth
  for (const [x, z] of [[-250, -230], [-250, 230], [230, -230], [230, 230]]) body.add(kit.cyl(s(85), s(95), s(170), dark, [s(x), 0, s(z)], { seg: 6 }));
  // palm leaves and the big flower on the back
  for (let i = 0; i < 6; i++) {
    const a = i / 6 * Math.PI * 2;
    const leaf = kit.sphere(s(200), 0x38a040, [s(Math.cos(a) * 220), s(520), s(Math.sin(a) * 220)], { seg: 5, scale: [1.4, 0.18, 0.55] });
    leaf.rotation.y = -a; g.add(leaf);
  }
  body.add(kit.cyl(s(60), s(90), s(120), 0x8a5a30, [0, s(470), 0], { seg: 6 }));
  for (let i = 0; i < 5; i++) {
    const a = i / 5 * Math.PI * 2;
    const p = kit.sphere(s(170), 0xf08098, [s(Math.cos(a) * 180), s(640), s(Math.sin(a) * 180)], { seg: 6, scale: [1.2, 0.35, 0.8] });
    p.rotation.y = -a; p.rotation.z = 0.35; body.add(p);
    body.add(kit.sphere(s(28), 0xf8f0f0, [s(Math.cos(a) * 200), s(690), s(Math.sin(a) * 200)], { seg: 4 }));
  }
  body.add(kit.sphere(s(100), 0xf8e070, [0, s(660), 0], { seg: 6, scale: [1, 0.6, 1] }));
  g.userData = { body };
  return g;
}

function chansey(rs) {
  const s = S(rs), g = new THREE.Group(), pink = 0xf4b0c0;
  const body = new THREE.Group(); g.add(body);
  body.add(kit.sphere(s(190), pink, [0, s(200), 0], { seg: 10, scale: [1, 1.1, 0.95] }));
  body.add(kit.sphere(s(80), 0xffffff, [s(-150), s(150), 0], { seg: 7, scale: [0.6, 0.9, 1.1] }));   // pouch egg
  for (const z of [-80, 80]) {
    body.add(kit.sphere(s(20), 0x101010, [s(-170), s(290), s(z)], { seg: 4 }));
    body.add(kit.cone(s(40), s(110), pink, [s(-40), s(380), s(z * 1.3)], { seg: 4, rot: [z > 0 ? 0.4 : -0.4, 0, 0.3] }));
    body.add(kit.sphere(s(45), pink, [s(-130), s(200), s(z * 2.2)], { seg: 5, scale: [1, 0.6, 0.6] }));
    body.add(kit.sphere(s(55), pink, [s(-30), s(25), s(z * 1.2)], { seg: 5, scale: [1.4, 0.5, 0.8] }));
  }
  body.add(kit.box(s(80), s(20), s(10), 0xd06070, [s(-185), s(240), 0]));
  g.userData = { body };
  return g;
}

function electrode(rs) {
  const s = S(rs), g = new THREE.Group();
  const body = new THREE.Group(); body.position.y = s(225); g.add(body);
  const top = new THREE.Mesh(new THREE.SphereGeometry(s(225), 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), mat(0xf4f4f4));
  const bot = new THREE.Mesh(new THREE.SphereGeometry(s(225), 12, 6, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), mat(0xe03028));
  body.add(top, bot);
  const eyes = new THREE.Group(); body.add(eyes);
  for (const z of [-70, 70]) {
    const e = kit.box(s(30), s(70), s(70), 0xffffff, [s(-210), s(40), s(z)]); e.rotation.x = z > 0 ? -0.5 : 0.5; eyes.add(e);
    eyes.add(kit.box(s(32), s(30), s(30), 0x101010, [s(-218), s(35), s(z * 0.9)]));
  }
  eyes.add(kit.box(s(28), s(20), s(140), 0x601010, [s(-212), s(-60), 0]));
  g.userData = { body, top, bot };
  return g;
}

function porygon(rs) {
  const s = S(rs), g = new THREE.Group(), pink = 0xf07898, blue = 0x48a8d8;
  const body = new THREE.Group(); g.add(body);
  const torso = kit.box(s(260), s(220), s(220), pink, [0, s(200), 0], { flat: true }); torso.rotation.y = 0.3; body.add(torso);
  const tail = kit.box(s(160), s(160), s(160), blue, [s(170), s(170), 0], { flat: true }); tail.rotation.z = 0.5; body.add(tail);
  const head = kit.cone(s(150), s(260), pink, [s(-180), s(300), 0], { seg: 4, rot: [0, 0, Math.PI / 2], flat: true }); body.add(head);
  body.add(kit.box(s(90), s(60), s(240), blue, [s(-260), s(300), 0], { flat: true }));                // beak
  for (const z of [-90, 90]) {
    body.add(kit.box(s(40), s(50), s(30), 0xffffff, [s(-170), s(360), s(z)]));
    body.add(kit.box(s(42), s(26), s(16), 0x101010, [s(-180), s(360), s(z * 1.05)]));
    body.add(kit.box(s(90), s(110), s(70), blue, [s(-20), s(60), s(z)], { flat: true }));            // feet
  }
  g.userData = { body };
  return g;
}

export function buildMons(root, rs) {
  const models = { charmander: charmander(rs), venusaur: venusaur(rs), chansey: chansey(rs), electrode: electrode(rs), porygon: porygon(rs) };
  for (const m of Object.values(models)) { m.visible = false; m.position.z = 0; root.add(m); }
  const blast = kit.sphere(1, 0xffd040, [0, 0, 0], { seg: 10, opacity: 0.85, emissive: 0xff6000 });
  blast.visible = false; root.add(blast);
  return { models, blast, blastT: 99, root };
}

const flameMat = () => new THREE.MeshBasicMaterial({ color: 0xff9020, transparent: true, opacity: 0.85, depthWrite: false });

export function syncMons(obj, m, rs, st) {
  const M = obj.mons, mon = st.mon;
  for (const [k, model] of Object.entries(M.models)) {
    const on = !!mon && mon.kind === k && !mon.gone;
    model.visible = on;
    if (!on) continue;
    const t = mon.t, u = model.userData;
    model.position.x = mon.x * rs;
    model.position.y = (mon.y + (mon.shake ?? 0)) * rs;
    // walking bob / per-kind animation
    const walking = (k === 'charmander' && (t < 30 || t > 150)) || (k === 'venusaur' && (t < 40 || t > 160)) || (k === 'chansey' && (t < 40 || t > 120));
    if (k !== 'electrode') u.body.position.y = walking ? Math.abs(Math.sin(t * 0.35)) * 30 * rs : 0;
    if (k === 'charmander') { u.flame.scale.setScalar(1 + 0.2 * Math.sin(t * 0.9)); u.body.rotation.z = t >= 40 && t <= 120 ? -0.15 : 0; }
    if (k === 'electrode') {
      u.body.rotation.z = mon.roll ?? 0;
      const flashing = t > 60 && Math.floor(t / Math.max(2, 10 - (t - 60) / 10)) % 2 === 0;
      u.top.material = flashing ? mat(0xffffa0, { emissive: 0x808020 }) : mat(0xf4f4f4);
    }
    if (k === 'chansey') u.body.rotation.z = t >= 75 && t <= 90 ? 0.25 : 0;
    if (k === 'venusaur') u.body.rotation.z = t < 8 ? -0.1 : 0;
  }
  // Electrode blast
  if (st.boom) { M.blastT = 0; M.blastX = st.boom.x; M.blastY = st.boom.y; }
  if (M.blastT < 30) {
    M.blastT++;
    const k = M.blastT / 30;
    M.blast.visible = true;
    M.blast.position.set(M.blastX * rs, M.blastY * rs, 0.5);
    M.blast.scale.setScalar((200 + 500 * Math.sqrt(k)) * rs);
    M.blast.material.opacity = 0.9 * (1 - k);
  } else M.blast.visible = false;
  // flames / razor leaves
  const meshes = obj.shotMeshes;
  while (meshes.length < st.shots.length) {
    const g = new THREE.Group();
    const fl = new THREE.Mesh(new THREE.SphereGeometry(1, 7, 5), flameMat()); g.add(fl);
    const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.4, 1.6, 4), mat(0x58c040, { flat: true })); leaf.rotation.z = Math.PI / 2; g.add(leaf);
    g.userData = { fl, leaf };
    M.root.add(g); meshes.push(g);
  }
  meshes.forEach((g, i) => {
    const s = st.shots[i];
    g.visible = !!s; if (!s) return;
    g.position.set(s.x * rs, s.y * rs, 0.2);
    const isFlame = s.kind === 'flame';
    g.userData.fl.visible = isFlame; g.userData.leaf.visible = !isFlame;
    if (isFlame) {
      const k = 1 - s.life / 20;
      g.scale.setScalar((90 + 90 * k) * rs);
      g.userData.fl.material.color.setHex(k < 0.4 ? 0xffe060 : k < 0.7 ? 0xff9020 : 0xe04010);
      g.userData.fl.material.opacity = 0.9 - 0.5 * k;
    } else { g.scale.setScalar(110 * rs); g.rotation.z = s.spin; }
  });
  // eggs
  const em = obj.eggMeshes;
  while (em.length < st.eggs.length) {
    const g = new THREE.Group();
    g.add(kit.sphere(90 * rs, 0xfaf6ea, [0, 90 * rs, 0], { seg: 8, scale: [0.85, 1.1, 0.85] }));
    g.add(kit.sphere(22 * rs, 0x50b050, [-50 * rs, 110 * rs, 40 * rs], { seg: 4 }));
    g.add(kit.sphere(18 * rs, 0x50b050, [30 * rs, 60 * rs, 70 * rs], { seg: 4 }));
    M.root.add(g); em.push(g);
  }
  em.forEach((g, i) => { const e = st.eggs[i]; g.visible = !!e; if (e) g.position.set(e.x * rs, e.y * rs, 0); });
}
