// Low-poly item models built from primitives (no ripped assets). Shapes/colours follow the SSB64 items:
// sizes are in SSB64 units (Mario ≈ 320 tall) and scaled by RS at render time.
// Battering items and the hammer are modelled with the grip at the origin and the item along +y, so the
// renderer can hang them from the hand bone along the same axis the hitboxes use (src/items/swing.js).
import * as THREE from 'three';
import { GRIP_AXIS } from './swing.js';

const PI = Math.PI;
const mats = new Map();
function M(color, o) {
  o = o || {};
  const k = color + JSON.stringify(o);
  let m = mats.get(k);
  if (!m) {
    m = o.basic ? new THREE.MeshBasicMaterial({ color, transparent: !!o.opacity, opacity: o.opacity ?? 1, depthWrite: !o.opacity, blending: o.add ? THREE.AdditiveBlending : THREE.NormalBlending, side: o.side ?? THREE.FrontSide })
      : new THREE.MeshLambertMaterial({ color, emissive: o.emissive ?? 0, flatShading: !!o.flat, transparent: !!o.opacity, opacity: o.opacity ?? 1, side: o.side ?? THREE.FrontSide });
    mats.set(k, m);
  }
  return m;
}
const mesh = (g, m, p = [0, 0, 0], r = null, s = null) => { const o = new THREE.Mesh(g, m); o.position.set(...p); if (r) o.rotation.set(...r); if (s) o.scale.set(...s); return o; };
const box = (w, h, d, c, p, r, o) => mesh(new THREE.BoxGeometry(w, h, d), M(c, o), p, r);
const sph = (rad, c, p, s, o, seg = 10) => mesh(new THREE.SphereGeometry(rad, seg, Math.max(6, Math.round(seg * 0.7))), M(c, o), p, null, s);
const cyl = (rt, rb, h, c, p, r, o, seg = 10) => mesh(new THREE.CylinderGeometry(rt, rb, h, seg), M(c, o), p, r);
const torus = (R, t, c, p, r, o) => mesh(new THREE.TorusGeometry(R, t, 6, 14), M(c, o), p, r);
function starShape(R, inner = 0.45, n = 5) {
  const s = new THREE.Shape();
  for (let i = 0; i < n * 2; i++) { const r = i % 2 ? R * inner : R, a = PI / 2 + i * PI / n; i ? s.lineTo(Math.cos(a) * r, Math.sin(a) * r) : s.moveTo(Math.cos(a) * r, Math.sin(a) * r); }
  return s;
}
const star3d = (R, depth, c, o) => { const g = new THREE.ExtrudeGeometry(starShape(R), { depth, bevelEnabled: false }); g.translate(0, 0, -depth / 2); return new THREE.Mesh(g, M(c, o)); };
function heartShape(s) {
  const h = new THREE.Shape();
  h.moveTo(0, -s); h.bezierCurveTo(s * 0.2, -s * 0.6, s, -s * 0.3, s, s * 0.25);
  h.bezierCurveTo(s, s * 0.8, s * 0.35, s * 0.95, 0, s * 0.5);
  h.bezierCurveTo(-s * 0.35, s * 0.95, -s, s * 0.8, -s, s * 0.25);
  h.bezierCurveTo(-s, -s * 0.3, -s * 0.2, -s * 0.6, 0, -s);
  return h;
}
const grp = (...ch) => { const g = new THREE.Group(); for (const c of ch) if (c) g.add(c); return g; };

// ---------- item models (origin: grip for battering items, bottom-centre otherwise) ----------
const BUILD = {
  crate() {
    const g = grp(box(300, 300, 300, 0xc68a4c, [0, 150, 0], null, { flat: true }));
    const dark = 0x6e4320;
    for (const y of [12, 288]) for (const z of [-145, 145]) g.add(box(310, 26, 14, dark, [0, y, z]));
    for (const x of [-145, 145]) for (const z of [-145, 145]) g.add(box(18, 300, 18, dark, [x, 150, z]));
    for (const z of [-152, 152]) { g.add(box(14, 400, 6, dark, [0, 150, z], [0, 0, PI / 4])); }
    return g;
  },
  barrel() {
    const g = grp(cyl(130, 130, 300, 0xa8682e, [0, 150, 0], null, { flat: true }, 12));
    g.add(sph(128, 0xa8682e, [0, 150, 0], [1, 1.12, 1], { flat: true }, 12));
    for (const y of [40, 260]) g.add(torus(134, 10, 0x3a3a40, [0, y, 0], [PI / 2, 0, 0]));
    g.add(cyl(118, 118, 6, 0x6a4018, [0, 302, 0], null, null, 12));
    return g;
  },
  capsule() {
    const L = 70, r = 55;
    return grp(cyl(r, r, L, 0xe03028, [-L / 2, r, 0], [0, 0, PI / 2]), sph(r, 0xe03028, [-L, r, 0]),
      cyl(r, r, L, 0xf2f2f2, [L / 2, r, 0], [0, 0, PI / 2]), sph(r, 0xf2f2f2, [L, r, 0]), torus(r + 1, 5, 0x909090, [0, r, 0], [0, PI / 2, 0]));
  },
  egg() {
    const g = grp(sph(62, 0xf8f8f0, [0, 78, 0], [1, 1.25, 1]));
    for (const [x, y, z] of [[40, 110, 30], [-35, 70, 42], [10, 40, -50], [-20, 120, -35], [45, 60, -25], [0, 95, 58]]) g.add(sph(17, 0x2ea83a, [x, y, z], [1, 1, 0.5]));
    return g;
  },
  maxim_tomato() {
    const g = grp(sph(70, 0xe01818, [0, 66, 0], [1, 0.92, 1]));
    g.add(cone(30, 40, 0x2c9a2c, [0, 128, 0]));
    for (let i = 0; i < 5; i++) { const a = i * 2 * PI / 5; g.add(box(42, 6, 14, 0x2c9a2c, [Math.cos(a) * 22, 128, Math.sin(a) * 22], [0, -a, 0.3])); }
    // the white "M"
    for (const [x, r] of [[-18, 0], [18, 0], [-9, 0.5], [9, -0.5]]) g.add(box(9, 44, 4, 0xffffff, [x, 70, 66], [0, 0, r]));
    return g;
  },
  heart_container() {
    const g = new THREE.Group();
    const geo = new THREE.ExtrudeGeometry(heartShape(70), { depth: 40, bevelEnabled: true, bevelSize: 8, bevelThickness: 8, bevelSegments: 1 });
    geo.translate(0, 0, -20);
    g.add(mesh(geo, M(0xff2848, { emissive: 0x400010 }), [0, 80, 0]));
    const fr = new THREE.ExtrudeGeometry(heartShape(84), { depth: 20, bevelEnabled: false }); fr.translate(0, 0, -34);
    g.add(mesh(fr, M(0xe8c040), [0, 80, 0]));
    return g;
  },
  star() { const s = star3d(80, 40, 0xffe23a, { emissive: 0x806000 }); s.position.y = 80; return grp(s); },
  beam_sword() {
    return grp(cyl(20, 22, 110, 0x50586a, [0, 45, 0]), cyl(26, 26, 18, 0x2a2e38, [0, 2, 0]), box(70, 16, 34, 0x8890a0, [0, 104, 0]),
      cyl(30, 34, 360, 0xe8a0ff, [0, 290, 0], null, { basic: true, opacity: 0.55, add: true }),
      cyl(13, 15, 350, 0xffffff, [0, 290, 0], null, { basic: true }));
  },
  home_run_bat() {
    return grp(cyl(17, 15, 90, 0x5a2a12, [0, 25, 0]), sph(20, 0x5a2a12, [0, -22, 0]),
      cyl(40, 18, 230, 0xd9a65e, [0, 185, 0], null, { flat: true }), sph(40, 0xd9a65e, [0, 300, 0], [1, 0.5, 1]));
  },
  fan() {
    const g = grp(cyl(16, 16, 80, 0xd02828, [0, 20, 0]), torus(18, 6, 0xd02828, [0, -22, 0], [PI / 2, 0, 0]));
    for (let i = -3; i <= 3; i++) g.add(box(30, 220, 6, i % 2 ? 0xffffff : 0xe8e4d8, [i * 28, 170, (i % 2) * 6], [0, 0, i * 0.05], { flat: true }));
    g.add(box(210, 12, 14, 0xd02828, [0, 66, 0]));
    return g;
  },
  star_rod() {
    const g = grp(cyl(14, 14, 230, 0xffffff, [0, 95, 0]));
    for (const y of [20, 80, 140, 200]) g.add(cyl(15, 15, 22, 0xff70b0, [0, y, 0]));
    const s = star3d(75, 30, 0xffe030, { emissive: 0x705000 }); s.position.y = 270; g.add(s);
    return g;
  },
  ray_gun() {
    return grp(box(120, 55, 40, 0x6c7688, [0, 70, 0], null, { flat: true }), cyl(16, 20, 90, 0xb8c0cc, [100, 76, 0], [0, 0, -PI / 2]),
      sph(14, 0xff3020, [146, 76, 0]), box(36, 70, 32, 0x3a3e48, [-30, 25, 0], [0, 0, 0.25]), box(40, 22, 44, 0xe03020, [10, 104, 0]));
  },
  fire_flower() {
    const g = grp(cyl(9, 11, 110, 0x2c9a3a, [0, 55, 0]));
    g.add(sph(34, 0x2c9a3a, [-28, 40, 0], [1, 0.4, 0.6]), sph(34, 0x2c9a3a, [28, 50, 0], [1, 0.4, 0.6]));
    const head = grp(sph(60, 0xff6a1a, [0, 0, 0], [1, 1, 0.5]), sph(44, 0xffd23a, [0, 0, 6], [1, 1, 0.5]), sph(30, 0xfff4d0, [0, 0, 14], [1, 1, 0.5]),
      box(6, 18, 4, 0x101010, [-9, 3, 30]), box(6, 18, 4, 0x101010, [9, 3, 30]));
    head.position.y = 150; g.add(head);
    return g;
  },
  hammer() {
    return grp(cyl(16, 18, 300, 0xb07a40, [0, 140, 0], null, { flat: true }), cyl(70, 70, 180, 0xa36a32, [0, 330, 0], [0, 0, PI / 2], { flat: true }),
      cyl(73, 73, 22, 0x6a3e18, [-70, 330, 0], [0, 0, PI / 2]), cyl(73, 73, 22, 0x6a3e18, [70, 330, 0], [0, 0, PI / 2]));
  },
  motion_sensor_bomb() {
    const g = grp(cyl(30, 34, 22, 0x4a5058, [0, 14, 0], null, { flat: true }), box(44, 8, 20, 0x2a2e34, [0, 28, 0]));
    const l = sph(9, 0xff2020, [0, 30, 14], null, { basic: true }); l.name = 'light'; g.add(l);
    return g;
  },
  bob_omb() {
    const g = grp(sph(70, 0x1c1c26, [0, 82, 0]), cyl(12, 12, 30, 0xe8d8a8, [0, 160, 0]), sph(10, 0xffd040, [0, 178, 0], null, { basic: true }));
    for (const s of [-1, 1]) {
      g.add(box(14, 34, 6, 0xffffff, [s * 22, 92, 66])); g.add(box(7, 16, 4, 0x101010, [s * 22, 90, 70]));
      g.add(box(36, 18, 56, 0xf0a020, [s * 34, 10, 10]));
    }
    const key = grp(cyl(8, 8, 40, 0xe0c040, [0, 0, 0], [PI / 2, 0, 0]), torus(22, 7, 0xe0c040, [0, 26, -20], [0, PI / 2, 0]), torus(22, 7, 0xe0c040, [0, -26, -20], [0, PI / 2, 0]));
    key.position.set(0, 82, -80); key.name = 'key'; g.add(key);
    return g;
  },
  bumper() {
    const g = grp(cyl(100, 100, 50, 0xe02850, [0, 100, 0], [PI / 2, 0, 0], { flat: true }, 16), torus(98, 10, 0xffb0c8, [0, 100, 0], null),
      cyl(62, 62, 56, 0xff6aa0, [0, 100, 0], [PI / 2, 0, 0], null, 16));
    const s = star3d(42, 20, 0xffe030, { emissive: 0x605000 }); s.position.set(0, 100, 30); g.add(s);
    return g;
  },
  green_shell() { return shell(0x2ab84a); },
  red_shell() { return shell(0xe02424); },
  poke_ball() {
    const top = new THREE.Mesh(new THREE.SphereGeometry(55, 12, 6, 0, PI * 2, 0, PI / 2), M(0xe82020));
    const bot = new THREE.Mesh(new THREE.SphereGeometry(55, 12, 6, 0, PI * 2, PI / 2, PI / 2), M(0xf4f4f4));
    top.position.y = bot.position.y = 55;
    const g = grp(top, bot, cyl(56, 56, 10, 0x181818, [0, 55, 0], null, null, 12), cyl(16, 16, 10, 0x181818, [0, 55, 52], [PI / 2, 0, 0]),
      cyl(11, 11, 12, 0xffffff, [0, 55, 55], [PI / 2, 0, 0]));
    top.name = 'lid';
    return g;
  },
};
function cone(r, h, c, p) { const g = new THREE.ConeGeometry(r, h, 6); return mesh(g, M(c), p); }
function shell(col) {
  const dome = new THREE.Mesh(new THREE.SphereGeometry(78, 12, 6, 0, PI * 2, 0, PI / 2), M(col, { flat: true }));
  dome.position.y = 30; dome.scale.y = 0.85;
  const g = grp(dome, torus(76, 12, 0xffffff, [0, 30, 0], [PI / 2, 0, 0]), cyl(72, 60, 30, 0xf0e0a0, [0, 15, 0], null, null, 12));
  for (let i = 0; i < 6; i++) { const a = i * PI / 3; g.add(sph(20, 0xffffff, [Math.cos(a) * 46, 70, Math.sin(a) * 46], [1, 0.5, 1])); }
  return g;
}

// ---------- Pokémon models (origin at the feet) ----------
const POKE = {
  onix() {
    const g = new THREE.Group();
    for (let i = 0; i < 7; i++) g.add(sph(95 - i * 6, 0x8c8c90, [Math.sin(i * 0.9) * 60, 90 + i * 170, 0], null, { flat: true }, 7));
    g.add(box(20, 70, 20, 0x8c8c90, [0, 1260, 0], null, { flat: true }));
    for (const s of [-1, 1]) g.add(box(18, 14, 6, 0x101010, [s * 30, 1110 + 60, 80]));
    return g;
  },
  snorlax() {
    return grp(sph(170, 0x2a5a6e, [0, 170, 0], [1.1, 1, 0.9]), sph(120, 0xf0e2c0, [0, 150, 70], [1, 1, 0.5]), sph(95, 0x2a5a6e, [0, 360, 0]),
      sph(70, 0xf0e2c0, [0, 345, 50], [1, 0.8, 0.6]), cone(30, 50, 0x2a5a6e, [-60, 440, 0]), cone(30, 50, 0x2a5a6e, [60, 440, 0]),
      sph(50, 0xf0e2c0, [-90, 20, 60], [1, 0.6, 0.6]), sph(50, 0xf0e2c0, [90, 20, 60], [1, 0.6, 0.6]));
  },
  goldeen() {
    const g = grp(sph(70, 0xf8f8f8, [0, 60, 0], [1.4, 0.8, 0.5]), sph(30, 0xf06820, [30, 80, 20]), sph(25, 0xf06820, [-40, 50, 22]),
      cone(10, 50, 0xf8e0c0, [100, 80, 0]), sph(40, 0xf06820, [-110, 60, 0], [0.6, 1.2, 0.2]));
    g.children[3].rotation.z = -PI / 2;
    return g;
  },
  meowth() {
    return grp(sph(50, 0xf0e0b0, [0, 60, 0], [0.9, 1, 0.8]), sph(55, 0xf0e0b0, [0, 150, 0]), cone(16, 40, 0x6a4a30, [-40, 200, 0]), cone(16, 40, 0x6a4a30, [40, 200, 0]),
      cyl(18, 18, 6, 0xffd040, [0, 180, 50], [PI / 2, 0, 0]), box(8, 14, 4, 0x101010, [-18, 150, 52]), box(8, 14, 4, 0x101010, [18, 150, 52]));
  },
  charizard() {
    const g = grp(sph(100, 0xf08a30, [0, 140, 0], [0.9, 1.2, 0.8]), sph(70, 0xf8e0a0, [0, 120, 50], [0.8, 1, 0.5]), sph(55, 0xf08a30, [0, 300, 30], [1, 0.9, 1.2]),
      box(30, 30, 40, 0xf8e0a0, [0, 280, 80]));
    for (const s of [-1, 1]) { const w = box(170, 10, 120, 0x2a7a8a, [s * 130, 230, -30], [0, 0, s * 0.5]); g.add(w); }
    const tail = grp(cyl(18, 30, 120, 0xf08a30, [0, 0, 0], [PI / 2.5, 0, 0]), sph(26, 0xffd020, [0, 50, -60], null, { basic: true }));
    tail.position.set(0, 80, -80); g.add(tail);
    return g;
  },
  beedrill() {
    return grp(sph(55, 0xf0d020, [0, 120, 0], [1, 0.8, 0.8]), sph(60, 0xf0d020, [-80, 90, 0], [1.4, 0.8, 0.8]), box(10, 50, 100, 0x101010, [-80, 90, 0]),
      box(10, 50, 100, 0x101010, [-40, 92, 0]), box(90, 6, 70, 0xe0f0ff, [0, 180, -30], [0.3, 0, 0.3], { opacity: 0.6 }),
      cone(14, 70, 0xe8e8e8, [60, 80, 0]), cone(14, 70, 0xe8e8e8, [-150, 70, 0]));
  },
  blastoise() {
    return grp(sph(110, 0x7a5030, [0, 140, -30], [1, 1.1, 0.8]), sph(95, 0x4a7ad8, [0, 140, 20], [0.9, 1, 0.7]), sph(80, 0xf0e0a0, [0, 120, 70], [0.8, 1, 0.4]),
      sph(60, 0x4a7ad8, [0, 290, 30]), cyl(22, 22, 90, 0xb0b0b8, [-80, 260, -10], [PI / 2, 0, 0]), cyl(22, 22, 90, 0xb0b0b8, [80, 260, -10], [PI / 2, 0, 0]));
  },
  chansey() {
    return grp(sph(110, 0xffb8c8, [0, 120, 0], [1, 1.15, 0.9]), sph(40, 0xffffff, [0, 90, 90], [1, 1.2, 0.6]), cone(20, 50, 0xffb8c8, [-60, 240, 0]), cone(20, 50, 0xffb8c8, [60, 240, 0]),
      box(10, 16, 4, 0x101010, [-30, 170, 98]), box(10, 16, 4, 0x101010, [30, 170, 98]));
  },
  starmie() {
    const a = star3d(110, 40, 0xa070c0, { flat: true }), b = star3d(110, 40, 0x8050a0, { flat: true });
    b.rotation.z = PI / 5; b.position.z = -30;
    const g = grp(a, b, sph(30, 0xff2040, [0, 0, 30], null, { emissive: 0x600010 }), torus(36, 6, 0xffd040, [0, 0, 26]));
    g.children.forEach(c => { c.position.y += 120; });
    g.name = 'spin';
    return g;
  },
  hitmonlee() {
    return grp(sph(70, 0xb8885a, [0, 230, 0], [0.9, 1.3, 0.8]), cyl(22, 26, 160, 0xb8885a, [-30, 80, 0]), cyl(22, 26, 160, 0xb8885a, [30, 80, 0]),
      box(40, 20, 70, 0xb8885a, [-30, 6, 20]), box(40, 20, 70, 0xb8885a, [30, 6, 20]), cyl(14, 14, 120, 0xb8885a, [-80, 230, 0], [0, 0, 0.5]),
      cyl(14, 14, 120, 0xb8885a, [80, 230, 0], [0, 0, -0.5]), box(40, 10, 4, 0x101010, [0, 260, 58]));
  },
  koffing() {
    const g = grp(sph(100, 0x7a5aa0, [0, 120, 0], null, { flat: true }, 9));
    for (const [x, y, z] of [[60, 190, 40], [-70, 170, 50], [90, 80, 30], [-50, 50, 60]]) g.add(cyl(18, 24, 30, 0x7a5aa0, [x, y, z], [x / 100, 0, -y / 300]));
    g.add(box(40, 40, 6, 0xf0e8a0, [0, 90, 98])); g.add(box(14, 10, 4, 0x101010, [-20, 140, 98])); g.add(box(14, 10, 4, 0x101010, [20, 140, 98]));
    return g;
  },
  clefairy() {
    return grp(sph(80, 0xffc0d0, [0, 100, 0], [1, 1.1, 0.9]), cone(22, 60, 0xffc0d0, [-50, 190, 0]), cone(22, 60, 0xffc0d0, [50, 190, 0]),
      sph(14, 0xffc0d0, [0, 190, 40]), box(10, 14, 4, 0x101010, [-25, 120, 74]), box(10, 14, 4, 0x101010, [25, 120, 74]));
  },
  mew() {
    return grp(sph(45, 0xffc8e0, [0, 60, 0], [1, 0.9, 0.8]), sph(42, 0xffc8e0, [0, 125, 10]), cone(14, 30, 0xffc8e0, [-25, 165, 0]), cone(14, 30, 0xffc8e0, [25, 165, 0]),
      cyl(6, 6, 160, 0xffc8e0, [-70, 60, -30], [0, 0, 1.2]), sph(12, 0xffc8e0, [-140, 90, -30]));
  },
};

// ---------- projectiles ----------
const PROJ = {
  laser: () => { const g = grp(cyl(18, 18, 240, 0xff4040, [0, 0, 0], [0, 0, PI / 2], { basic: true }), cyl(8, 8, 250, 0xffffff, [0, 0, 0], [0, 0, PI / 2], { basic: true })); return g; },
  flame: () => grp(sph(70, 0xff7a10, [0, 0, 0], null, { basic: true, opacity: 0.85, add: true }), sph(40, 0xffe060, [0, 0, 10], null, { basic: true, opacity: 0.9, add: true })),
  star: () => { const s = star3d(70, 20, 0xffe030, { emissive: 0x806000 }); return grp(s); },
  starBig: () => { const s = star3d(110, 30, 0xffe030, { emissive: 0x806000 }); return grp(s); },
  rock: () => grp(sph(170, 0x8a8478, [0, 0, 0], null, { flat: true }, 6)),
  coin: () => grp(cyl(40, 40, 10, 0xffd030, [0, 0, 0], [PI / 2, 0, 0], { emissive: 0x403000 })),
  bee: () => grp(sph(60, 0xf0d020, [0, 0, 0], [1.6, 0.8, 0.8]), box(10, 50, 90, 0x101010, [-20, 0, 0]), box(90, 6, 60, 0xe0f0ff, [0, 50, 0], null, { opacity: 0.6 })),
  water: () => grp(sph(90, 0x60a0ff, [0, 0, 0], [1.5, 1, 1], { basic: true, opacity: 0.7 })),
  smog: () => grp(sph(110, 0x8a6aa8, [0, 0, 0], null, { basic: true, opacity: 0.55 }), sph(70, 0xa080c0, [40, 30, 20], null, { basic: true, opacity: 0.5 })),
};
export function projView(scene, kind, p) {
  const outer = new THREE.Group();
  const inner = (PROJ[kind] ?? PROJ.star)();
  outer.add(inner);
  outer.scale.setScalar(0.01);
  outer.userData.anim = (v, pp, fr) => {
    if (pp.facing < 0) v.rotation.y = PI;
    if (kind === 'star' || kind === 'starBig' || kind === 'coin') inner.rotation.z = fr * 0.3;
    if (kind === 'flame' || kind === 'smog') { const k = Math.min(1, pp.t / (pp.life || 1)); inner.scale.setScalar(0.6 + k * 0.8); }
    if (kind === 'rock') inner.rotation.z = fr * 0.1;
  };
  scene.add(outer);
  return outer;
}

// ---------- GameView hooks ----------
const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _up = new THREE.Vector3(0, 1, 0);
export function makeView(scene, it) {
  const outer = new THREE.Group();
  let inner;
  if (it.id === 'explosion') {
    // own materials: opacity is animated per explosion
    const ball = (r, c, z) => mesh(new THREE.SphereGeometry(r, 14, 10), new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.9, depthWrite: false }), [0, 0, z]);
    inner = grp(ball(1, 0xe04010, 0), ball(0.75, 0xff9a20, 0.3), ball(0.45, 0xfff070, 0.6));
  }
  else if (it.def.pokemon) inner = POKE[it.id]();
  else inner = BUILD[it.id] ? BUILD[it.id]() : grp(sph(it.r, 0xff00ff));
  outer.add(inner);
  outer.userData.inner = inner;
  scene.add(outer);
  return outer;
}
export function syncView(v, it, m, RS, gv) {
  const inner = v.userData.inner;
  v.visible = !(it.blink && (m.frame >> 1) % 2 === 0) && !it.hidden;
  if (!v.visible) return;
  const grip = it.def.swing || it.def.gripAxis;
  v.scale.setScalar(RS * (it.scale ?? 1));
  v.quaternion.identity(); inner.rotation.set(0, 0, 0); inner.position.set(0, 0, 0);
  if (it.id === 'explosion') {
    const k = it.t / (it.sched[it.sched.length - 1].frame + 12);
    const r = Math.max(it.curR || 0, it.maxR * (1 - k) * 0.8, 1);
    v.position.set(it.x * RS, it.y * RS, 0.4);
    v.scale.setScalar(r * RS);
    inner.children.forEach(c => { c.material.opacity = 0.9 * (1 - k * 0.8); });
    return;
  }
  if (it.state === 'held' && it.holder) {
    const fv = gv?.fviews?.find(x => x.f === it.holder);
    if (fv && !it.def.heavy) {
      fv.root.updateMatrixWorld(true);
      const hand = fv.bones.handR;
      hand.getWorldPosition(v.position);
      if (grip) {
        hand.getWorldQuaternion(_q);
        _q2.setFromUnitVectors(_up, it.def.gripAxis ?? GRIP_AXIS);
        v.quaternion.copy(_q).multiply(_q2);
      } else {
        v.rotation.set(0, it.holder.facing > 0 ? 0 : PI, 0);
        inner.position.y = -it.r;
      }
      return;
    }
    v.position.set(it.x * RS, it.y * RS, 0);
    return;
  }
  v.position.set(it.x * RS, it.y * RS, 0);
  if (it.appearT > 0) v.scale.setScalar(RS * (1 - it.appearT / 20 * 0.9));
  if (it.def.pokemon) {
    if (inner.name === 'spin') { inner.rotation.z = m.frame * 0.3; return; }      // Starmie faces the camera and spins
    v.rotation.y = (it.facing ?? 1) > 0 ? PI / 2 - 0.3 : -PI / 2 + 0.3;
    if (it.id === 'goldeen') inner.rotation.z = Math.sin(m.frame * 0.4) * 0.5;
    return;
  }
  if (grip) {
    // lying on the ground: rotate the item flat, centred on its position
    inner.rotation.z = -PI / 2 + (it.spin || 0);
    inner.position.set(it.thrown ? 0 : -120, it.r * 0.6, 0);
    if (it.thrown) inner.position.y = it.r;
    return;
  }
  if (it.id === 'barrel' && it.rolling) { inner.rotation.set(PI / 2, 0, it.spin); inner.position.set(0, 130, -150); inner.rotation.order = 'XYZ'; return; }
  if (it.id === 'green_shell' || it.id === 'red_shell') { inner.rotation.y = it.spin || 0; return; }
  if (it.id === 'star') { inner.rotation.y = m.frame * 0.12; return; }
  if (it.id === 'heart_container') { inner.rotation.y = Math.sin(m.frame * 0.05) * 0.5; return; }
  if (it.id === 'bob_omb') {
    v.rotation.y = (it.facing ?? 1) > 0 ? PI / 2 : -PI / 2;
    const key = inner.getObjectByName('key'); if (key) key.rotation.z = m.frame * 0.15;
    return;
  }
  if (it.id === 'bumper') { const s = 1 + (it.pulse > 0 ? Math.sin(it.pulse * 0.8) * 0.25 : 0); inner.scale.set(s, s, 1); return; }
  if (it.id === 'motion_sensor_bomb') {
    const l = inner.getObjectByName('light'); if (l) l.visible = !it.stuck || it.armT > 0 ? (m.frame >> 3) % 2 === 0 : (m.frame >> 1) % 2 === 0;
    if (it.state === 'stuck') inner.rotation.z = it.vars.wallDir ? PI / 2 : PI;
    return;
  }
  if (it.id === 'poke_ball') { const lid = inner.getObjectByName('lid'); if (lid) lid.rotation.x = it.opened ? -1.2 : 0; }
  if (it.spin) { inner.position.y = it.r; inner.rotation.z = it.spin; inner.position.y = 0; }
}
