// Mushroom Kingdom visuals (low-poly, canvas textures). Everything is placed in game units * rs.
import * as THREE from 'three';
import { mat, kit } from '../render/rig.js';
import { backdrop, gradient, canvasTex } from './common.js';
import { MK } from './mushroom.js';

const texCache = new Map();
function tex(key, w, h, draw) {
  if (!texCache.has(key)) texCache.set(key, canvasTex(w, h, draw, { nearest: false }));
  return texCache.get(key);
}
// clone of a cached texture with its own repeat
function rep(t, rx, ry) { const c = t.clone(); c.wrapS = c.wrapT = THREE.RepeatWrapping; c.repeat.set(rx, ry); c.needsUpdate = true; return c; }
const lam = (o) => new THREE.MeshLambertMaterial(o);

// ---- textures ----
const groundTex = () => tex('ground', 64, 64, (c, w, h) => {
  // SMB ground block: dark brown slab with lighter cracked-stone ridges
  c.fillStyle = '#2a1a0a'; c.fillRect(0, 0, w, h);
  c.fillStyle = '#301e0c'; c.fillRect(2, 2, w - 4, h - 4);
  c.strokeStyle = '#5a4430'; c.lineWidth = 2;
  c.beginPath();
  c.moveTo(2, 2); c.lineTo(62, 2); c.moveTo(2, 2); c.lineTo(2, 62);
  c.moveTo(22, 2); c.lineTo(26, 20); c.lineTo(8, 30); c.lineTo(2, 30);
  c.moveTo(26, 20); c.lineTo(44, 24); c.lineTo(52, 2);
  c.moveTo(44, 24); c.lineTo(40, 44); c.lineTo(62, 48);
  c.moveTo(40, 44); c.lineTo(20, 46); c.lineTo(14, 62);
  c.moveTo(20, 46); c.lineTo(8, 30);
  c.stroke();
  c.strokeStyle = '#150c04'; c.lineWidth = 2; c.strokeRect(1, 1, w - 2, h - 2);
});
const groundTopTex = () => tex('groundTop', 64, 64, (c, w, h) => {
  c.fillStyle = '#b89478'; c.fillRect(0, 0, w, h);
  c.fillStyle = '#d4b49a'; c.fillRect(3, 3, w - 6, h - 6);
  c.fillStyle = '#c09a7e'; c.fillRect(8, 30, 48, 8);
  c.strokeStyle = '#6a4a34'; c.lineWidth = 3; c.strokeRect(1.5, 1.5, w - 3, h - 3);
});
const brickTex = () => tex('brick', 64, 64, (c, w, h) => {
  c.fillStyle = '#1e1006'; c.fillRect(0, 0, w, h);
  for (let r = 0; r < 4; r++) for (let k = -1; k < 3; k++) {
    const x = k * 32 + (r % 2) * 16, y = r * 16;
    c.fillStyle = '#5a3216'; c.fillRect(x + 1, y + 1, 30, 14);
    c.fillStyle = '#74441e'; c.fillRect(x + 1, y + 1, 30, 4);
  }
});
const blockTex = () => tex('block', 64, 64, (c, w, h) => {
  // floating brick block (red-brown, bevelled)
  c.fillStyle = '#7a3418'; c.fillRect(0, 0, w, h);
  c.fillStyle = '#a24e26'; c.beginPath(); c.moveTo(0, 0); c.lineTo(w, 0); c.lineTo(w - 8, 8); c.lineTo(8, 8); c.lineTo(8, h - 8); c.lineTo(0, h); c.fill();
  c.fillStyle = '#4a1c0a'; c.beginPath(); c.moveTo(w, h); c.lineTo(0, h); c.lineTo(8, h - 8); c.lineTo(w - 8, h - 8); c.lineTo(w - 8, 8); c.lineTo(w, 0); c.fill();
  c.fillStyle = '#8c4020'; c.fillRect(8, 8, w - 16, h - 16);
  c.fillStyle = '#6a2c12'; c.fillRect(10, 30, w - 20, 3);
});
const stoneTex = () => tex('stone', 64, 64, (c, w, h) => {
  // grey hard block
  c.fillStyle = '#5a5450'; c.fillRect(0, 0, w, h);
  c.fillStyle = '#8a8480'; c.beginPath(); c.moveTo(0, 0); c.lineTo(w, 0); c.lineTo(w - 9, 9); c.lineTo(9, 9); c.lineTo(9, h - 9); c.lineTo(0, h); c.fill();
  c.fillStyle = '#3a3634'; c.beginPath(); c.moveTo(w, h); c.lineTo(0, h); c.lineTo(9, h - 9); c.lineTo(w - 9, h - 9); c.lineTo(w - 9, 9); c.lineTo(w, 0); c.fill();
  c.fillStyle = '#6c6662'; c.fillRect(9, 9, w - 18, h - 18);
});
const wallTex = () => tex('wall', 64, 64, (c, w, h) => {
  c.fillStyle = '#4a4644'; c.fillRect(0, 0, w, h);
  for (let r = 0; r < 4; r++) for (let k = -1; k < 3; k++) {
    const x = k * 32 + (r % 2) * 16, y = r * 16;
    c.fillStyle = r % 2 ? '#76706a' : '#6c6660'; c.fillRect(x + 1, y + 1, 30, 14);
  }
});
const scaleSideTex = () => tex('scaleSide', 128, 32, (c, w, h) => {
  c.fillStyle = '#1a1208'; c.fillRect(0, 0, w, h);
  c.fillStyle = '#f0a020'; for (let i = 0; i < 8; i++) { c.beginPath(); c.ellipse(8 + i * 16, h / 2, 5, 7, 0, 0, Math.PI * 2); c.fill(); }
});
const pipeTex = () => tex('pipe', 128, 8, (c, w, h) => {
  gradient(c, w, h, [[0, '#1e5a10'], [0.18, '#3c8c20'], [0.32, '#8ce050'], [0.42, '#5cb030'], [0.75, '#3c8c20'], [1, '#1e5a10']], true);
});
const powTex = () => tex('pow', 64, 64, (c, w, h) => {
  c.fillStyle = '#2040c8'; c.fillRect(0, 0, w, h);
  c.strokeStyle = '#90a8ff'; c.lineWidth = 4; c.strokeRect(3, 3, w - 6, h - 6);
  c.fillStyle = '#ffffff'; c.font = 'bold 24px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('POW', w / 2, h / 2 + 1);
});
const capTex = () => tex('cap', 128, 64, (c, w, h) => {
  c.fillStyle = '#7fa688'; c.fillRect(0, 0, w, h);
  c.fillStyle = '#e8f0e0';
  for (const [x, y, r] of [[18, 22, 11], [58, 34, 14], [100, 20, 11], [38, 52, 7], [84, 52, 8], [124, 44, 8]]) { c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill(); }
});
const stalkTex = () => tex('stalk', 64, 64, (c, w, h) => {
  c.fillStyle = '#d8ccb4'; c.fillRect(0, 0, w, h);
  c.strokeStyle = '#b09878'; c.lineWidth = 3; c.beginPath();
  for (let i = 0; i <= 8; i++) c.lineTo(i * 8, 8 + (i % 2) * 8); c.stroke();
});

// box spanning x0..x1, y0..y1, z0..z1 (game units). mats: { front, top, side } materials
function box(x0, x1, y0, y1, z0, z1, rs, mats) {
  const m = new THREE.Mesh(new THREE.BoxGeometry((x1 - x0) * rs, (y1 - y0) * rs, (z1 - z0) * rs),
    [mats.side, mats.side, mats.top ?? mats.side, mats.bottom ?? mats.side, mats.front, mats.back ?? mats.side]);
  m.position.set((x0 + x1) / 2 * rs, (y0 + y1) / 2 * rs, (z0 + z1) / 2 * rs);
  return m;
}
const B = 450;                       // ground block size (game units)
function groundBlock(x0, x1, top, bottom, rs, z0 = -650, z1 = 550) {
  const w = x1 - x0, h = top - bottom, d = z1 - z0;
  const front = lam({ map: rep(groundTex(), w / B, h / B) });
  const side = lam({ map: rep(groundTex(), d / B, h / B) });
  const topM = lam({ map: rep(groundTopTex(), w / B, d / B) });
  return box(x0, x1, bottom, top, z0, z1, rs, { front, side, top: topM, back: front });
}
function brickRow(x0, x1, y0, y1, rs, z0, z1, t = blockTex(), size = null) {
  const w = x1 - x0, h = y1 - y0, d = z1 - z0, s = size ?? h;
  return box(x0, x1, y0, y1, z0, z1, rs, { front: lam({ map: rep(t, w / s, h / s) }), side: lam({ map: rep(t, d / s, h / s) }), top: lam({ map: rep(t, w / s, d / s) }) });
}
function pipe(x, yBot, top, r, rs) {
  const g = new THREE.Group();
  const lipH = 130;
  const pm = lam({ map: pipeTex() });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.86 * rs, r * 0.86 * rs, (top - lipH - yBot) * rs, 16, 1, false), pm);
  body.position.set(x * rs, (yBot + top - lipH) / 2 * rs, 0);
  const lip = new THREE.Mesh(new THREE.CylinderGeometry(r * rs, r * rs, lipH * rs, 16, 1, false), pm);
  lip.position.set(x * rs, (top - lipH / 2) * rs, 0);
  const hole = new THREE.Mesh(new THREE.CircleGeometry(r * 0.8 * rs, 16), mat(0x0a1a04));
  hole.rotation.x = -Math.PI / 2; hole.position.set(x * rs, (top + 1) * rs, 0);
  g.add(body, lip, hole);
  return g;
}
// background mushroom platform: spotted cap + striped stalk
function mushroomTree(x, capY, w, z, rs, stalkBottom = -200) {
  const g = new THREE.Group();
  const capH = 260, sw = Math.min(380, w * 0.28);
  const st = new THREE.Mesh(new THREE.BoxGeometry(sw * rs, (capY - stalkBottom) * rs, sw * 0.8 * rs), lam({ map: rep(stalkTex(), 1, (capY - stalkBottom) / 400) }));
  st.position.set(x * rs, (capY + stalkBottom) / 2 * rs, (z - 60) * rs); g.add(st);
  const shape = new THREE.Shape();
  const hw = w / 2 * rs, hh = capH / 2 * rs, rr = hh;
  shape.moveTo(-hw + rr, -hh); shape.lineTo(hw - rr, -hh); shape.absarc(hw - rr, 0, rr, -Math.PI / 2, Math.PI / 2, false);
  shape.lineTo(-hw + rr, hh); shape.absarc(-hw + rr, 0, rr, Math.PI / 2, Math.PI * 1.5, false);
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 300 * rs, bevelEnabled: false, curveSegments: 5 });
  geo.translate(0, 0, -150 * rs);
  const ct = rep(capTex(), 1 / (2 * hw), 1 / (2 * hh)); ct.offset.set(0.5, 0.5);
  const cap = new THREE.Mesh(geo, [lam({ map: ct }), mat(0x7fa688)]);
  cap.position.set(x * rs, capY * rs, z * rs); g.add(cap);
  return g;
}
function bush(x, z, s, rs) {
  const g = new THREE.Group();
  for (const [dx, h] of [[-0.6, 0.7], [0, 1], [0.6, 0.75]]) g.add(kit.sphere(220 * s * rs, 0x3a7a2a, [(x + dx * 260 * s) * rs, 0, z * rs], { seg: 7, scale: [1, h * 1.2, 0.5] }));
  return g;
}
function lollipop(x, z, rs) {
  const g = new THREE.Group();
  g.add(kit.cyl(18 * rs, 22 * rs, 160 * rs, 0xe8e0d0, [x * rs, 0, z * rs], { seg: 5 }));
  g.add(kit.sphere(80 * rs, 0x8cc070, [x * rs, 240 * rs, z * rs], { seg: 7, scale: [1, 1.5, 1] }));
  return g;
}
function fence(x0, x1, z, rs) {
  const g = new THREE.Group();
  for (let x = x0; x <= x1; x += 95) g.add(kit.box(34 * rs, 190 * rs, 26 * rs, 0xe8e0c8, [x * rs, 95 * rs, z * rs]));
  for (const y of [55, 135]) g.add(kit.box((x1 - x0 + 40) * rs, 22 * rs, 18 * rs, 0xd8ccb0, [(x0 + x1) / 2 * rs, y * rs, (z - 18) * rs]));
  return g;
}
function stairs(x0, steps, size, z, rs, dir = 1) {
  // grey hard-block staircase (columns of increasing height)
  const g = new THREE.Group();
  for (let i = 0; i < steps; i++) {
    const x = x0 + dir * i * size, h = (i + 1) * size;
    g.add(brickRow(Math.min(x, x + dir * size), Math.max(x, x + dir * size), 0, h, rs, z - size, z, stoneTex(), size));
  }
  return g;
}

function castle(cx, z, rs) {
  const g = new THREE.Group();
  const wm = (w, h) => lam({ map: rep(wallTex(), w / 240, h / 240) });
  const body = (x0, x1, y0, y1, d = 600) => {
    const m = box(x0, x1, y0, y1, z - d / 2, z + d / 2, rs, { front: wm(x1 - x0, y1 - y0), side: wm(d, y1 - y0), top: mat(0x5a5652) });
    g.add(m);
    // crenellations
    for (let x = x0; x < x1 - 50; x += 240) g.add(box(x, x + 140, y1, y1 + 160, z + d / 2 - 140, z + d / 2, rs, { front: wm(140, 160), side: wm(140, 160) }));
  };
  body(cx - 1100, cx + 1100, 0, 1350);
  body(cx - 1250, cx + 1250, 1350, 1550, 700);
  body(cx - 550, cx + 550, 1550, 2450, 500);
  const dark = mat(0x141010);
  const arch = (x, y, w, h, zz) => {
    g.add(kit.box(w * rs, h * rs, 20 * rs, 0x141010, [x * rs, (y + h / 2) * rs, zz * rs]));
    const c = new THREE.Mesh(new THREE.CircleGeometry(w / 2 * rs, 8, 0, Math.PI), dark); c.position.set(x * rs, (y + h) * rs, (zz + 11) * rs); g.add(c);
  };
  for (const x of [-700, 0, 700]) arch(cx + x, 0, 300, 380, z + 301);
  for (const x of [-700, 0, 700]) arch(cx + x, 800, 220, 260, z + 301);
  for (const x of [-260, 260]) arch(cx + x, 1800, 200, 280, z + 251);
  // flag with star
  g.add(kit.cyl(14 * rs, 14 * rs, 700 * rs, 0x806040, [cx * rs, 2610 * rs, z * rs], { seg: 5 }));
  const flag = kit.box(330 * rs, 230 * rs, 8 * rs, 0xffffff, [(cx + 175) * rs, 3170 * rs, z * rs]); g.add(flag);
  const star = new THREE.Shape();
  for (let i = 0; i < 10; i++) { const a = Math.PI / 2 + i * Math.PI / 5, r = (i % 2 ? 40 : 95) * rs; i ? star.lineTo(Math.cos(a) * r, Math.sin(a) * r) : star.moveTo(Math.cos(a) * r, Math.sin(a) * r); }
  const sm = new THREE.Mesh(new THREE.ShapeGeometry(star), mat(0xe02020)); sm.position.set((cx + 175) * rs, 3170 * rs, (z + 6) * rs); g.add(sm);
  return g;
}

export function buildMushroomArt(scene, rs, d, st) {
  const root = new THREE.Group(); scene.add(root);
  const bg = backdrop(scene, rs, (c, w, h) => {
    gradient(c, w, h, [[0, '#5c78b0'], [0.5, '#7590c4'], [0.8, '#8aa2cc'], [1, '#a4b8d8']]);
    // puffy SMB clouds
    const cloud = (x, y, s) => { c.fillStyle = '#eef4ff'; for (const [dx, dy, r] of [[-30, 6, 20], [0, -4, 28], [30, 6, 20], [-12, 12, 18], [14, 12, 18]]) { c.beginPath(); c.arc(x + dx * s, y + dy * s, r * s, 0, Math.PI * 2); c.fill(); }
      c.fillStyle = '#c8d4f0'; c.fillRect(x - 46 * s, y + 18 * s, 92 * s, 6 * s); };
    for (const [x, y, s] of [[60, 175, 0.4], [210, 160, 0.3], [330, 200, 0.35], [470, 168, 0.45], [600, 190, 0.3], [700, 150, 0.35], [830, 180, 0.4], [960, 160, 0.3], [140, 230, 0.25], [540, 235, 0.25], [900, 225, 0.3]]) cloud(x, y, s);
    // distant green hills along the bottom
    c.fillStyle = '#5c8c58'; for (let i = 0; i < 9; i++) { c.beginPath(); c.ellipse(i * 130 + 30, h, 90, 70 + (i % 3) * 20, 0, Math.PI, 0); c.fill(); }
  }, { y: 1500, w: 40000, h: 20000 });

  // ---- ground (y 0) with the central pit ----
  root.add(groundBlock(-7935, -885, 0, -4000, rs));
  root.add(groundBlock(870, 8115, 0, -4000, rs));
  // pit backdrop: green haze
  const pitTex = canvasTex(8, 128, (c, w, h) => gradient(c, w, h, [[0, '#3a6a48'], [0.5, '#428c5b'], [1, '#2c5a3a']]));
  const pit = new THREE.Mesh(new THREE.PlaneGeometry(1800 * rs, 4600 * rs), new THREE.MeshBasicMaterial({ map: pitTex }));
  pit.position.set(-10 * rs, -2300 * rs, -660 * rs); root.add(pit);
  // fences along the front edge
  root.add(fence(-2350, -1500, 420, rs));
  root.add(fence(1250, 2000, 420, rs));
  // ---- upper-left brick shelf + wall under it ----
  root.add(brickRow(-7616, -3012, 1320, 1605, rs, -380, 380, brickTex(), 140));
  root.add(brickRow(-7600, -3700, 0, 1320, rs, -640, -380, wallTex(), 240));
  // ---- pipes ----
  const pl = MK.pipes.pipe_left, pr = MK.pipes.pipe_right;
  root.add(pipe(pl.x, 1320, pl.top, pl.half, rs));
  root.add(pipe(pr.x, -150, pr.top, pr.half, rs));
  // ---- floating brick rows (pass-through floors) ----
  for (const f of d.groups.find(g => g.id === 5).floors.filter(f => f.pass)) {
    const x0 = f.pts[0][0], x1 = f.pts[f.pts.length - 1][0], y = f.pts[0][1];
    root.add(brickRow(x0, x1, y - 145, y, rs, -150, 150, blockTex(), (x1 - x0) / Math.round((x1 - x0) / 145)));
  }
  // ---- background scenery ----
  root.add(mushroomTree(0, 1350, 1700, -1700, rs, -4000));
  root.add(mushroomTree(-2000, 1250, 1400, -1400, rs, 0));
  root.add(mushroomTree(1900, 1900, 1500, -2000, rs, 0));
  root.add(mushroomTree(3200, 2250, 1200, -2600, rs, 0));
  root.add(mushroomTree(-4200, 2500, 1300, -2600, rs, 1605));
  root.add(stairs(-2300, 4, 300, -500, rs, 1));
  root.add(stairs(-1150, 3, 300, -500, rs, -1));
  root.add(castle(4500, -1500, rs));
  for (const [x, z, s] of [[-2500, -600, 1.2], [-500 - 1400, -700, 0.9], [2300, -700, 1.1], [3200, -900, 1.4], [-5000, -700, 1.3]]) root.add(bush(x, z, s, rs));
  for (const [x, z] of [[-3500, -420], [-3250, -460], [1350, -460], [2700, -440], [3700, -480], [5800, -480], [-6000, -440]]) root.add(lollipop(x, z, rs));
  // goal-style flagpole
  const pole = new THREE.Group(); root.add(pole);
  pole.add(kit.cyl(16 * rs, 16 * rs, 2700 * rs, 0xd8d0c0, [1550 * rs, 0, -1100 * rs], { seg: 6 }));
  pole.add(kit.sphere(55 * rs, 0xe8c040, [1550 * rs, 2730 * rs, -1100 * rs], { seg: 6 }));
  const flagShape = new THREE.Shape(); flagShape.moveTo(0, 0); flagShape.lineTo(-380 * rs, -110 * rs); flagShape.lineTo(0, -220 * rs);
  const flag = new THREE.Mesh(new THREE.ShapeGeometry(flagShape), mat(0xf0f0f0, { side: THREE.DoubleSide })); flag.position.set(1535 * rs, 2620 * rs, -1100 * rs); pole.add(flag);
  pole.add(box(1450, 1650, 0, 200, -1200, -1000, rs, { front: lam({ map: stoneTex() }), side: lam({ map: stoneTex() }) }));

  // ---- scale platforms + ropes ----
  const scaleMeshes = {};
  for (const id of [1, 2]) {
    const g = new THREE.Group(); root.add(g);
    const top = kit.box(756 * rs, 40 * rs, 300 * rs, 0xf0a828, [0, 43 * rs, 0]);
    const side = new THREE.Mesh(new THREE.BoxGeometry(756 * rs, 110 * rs, 300 * rs),
      [mat(0x1a1208), mat(0x1a1208), mat(0xc08018), mat(0x1a1208), lam({ map: rep(scaleSideTex(), 3, 1) }), mat(0x1a1208)]);
    side.position.set(0, -32 * rs, 0);
    g.add(top, side);
    g.add(kit.sphere(30 * rs, 0xd8c070, [0, 70 * rs, 0], { seg: 6 }));
    scaleMeshes[id] = g;
  }
  const ropeMat = mat(0xf4f4f0);
  const ropes = {};
  for (const id of [1, 2]) {
    const r = new THREE.Mesh(new THREE.CylinderGeometry(16 * rs, 16 * rs, 1, 4), ropeMat); root.add(r); ropes[id] = r;
    const bx = MK.scaleBase[id][0];
    const pul = kit.cyl(55 * rs, 55 * rs, 40 * rs, 0xc8a050, [bx * rs, MK.pulleyY * rs, -20 * rs], { seg: 10, rot: [Math.PI / 2, 0, 0] });
    root.add(pul);
    root.add(kit.sphere(35 * rs, 0xe0b040, [bx * rs, MK.pulleyY * rs, 10 * rs], { seg: 6 }));
  }
  const bar = kit.box((MK.scaleBase[2][0] - MK.scaleBase[1][0]) * rs, 16 * rs, 16 * rs, 0xf4f4f0, [(MK.scaleBase[1][0] + MK.scaleBase[2][0]) / 2 * rs, (MK.pulleyY + 55) * rs, 0]);
  root.add(bar);

  // ---- POW block ----
  const powM = lam({ map: powTex() });
  const pow = new THREE.Mesh(new THREE.BoxGeometry(2 * MK.powHalf * rs, 2 * MK.powHalf * rs, 2 * MK.powHalf * rs), powM);
  pow.visible = false; root.add(pow);

  // ---- Piranha plants ----
  const plants = MK.plants.map(() => {
    const g = new THREE.Group(); root.add(g);
    g.add(kit.cyl(32 * rs, 38 * rs, 200 * rs, 0x2a8a20, [0, 0, 0], { seg: 6 }));
    for (const s of [-1, 1]) g.add(kit.sphere(70 * rs, 0x38a028, [s * 70 * rs, 60 * rs, 0], { seg: 5, scale: [1.3, 0.4, 0.7] }));
    const head = new THREE.Group(); head.position.y = 200 * rs; g.add(head);
    const upper = new THREE.Group(), lower = new THREE.Group(); head.add(upper, lower);
    const hemi = (flip) => { const m = new THREE.Mesh(new THREE.SphereGeometry(120 * rs, 9, 5, 0, Math.PI * 2, 0, Math.PI / 2), mat(0xd82020)); if (flip) m.rotation.x = Math.PI; return m; };
    upper.add(hemi(false)); lower.add(hemi(true));
    upper.add(new THREE.Mesh(new THREE.CircleGeometry(118 * rs, 9), mat(0xf0f0e0, { side: THREE.DoubleSide })).rotateX(Math.PI / 2));
    for (const [a, b] of [[0.6, 0.5], [-0.7, 0.4], [0, 0.9], [2.4, 0.5], [-2.4, 0.5], [1.6, 0.7], [-1.6, 0.7]])
      upper.add(kit.sphere(24 * rs, 0xffffff, [Math.sin(a) * Math.cos(b) * 112 * rs, Math.sin(b) * 112 * rs, Math.cos(a) * Math.cos(b) * 112 * rs], { seg: 4 }));
    for (const s of [-1, 1]) for (let i = 0; i < 3; i++) upper.add(kit.cone(14 * rs, 40 * rs, 0xffffff, [s * (40 + i * 25) * rs, 0, (60 - i * 30) * rs], { seg: 3, rot: [Math.PI, 0, 0] }));
    g.visible = false;
    return { g, upper, lower };
  });

  return { group: root, background: bg, scaleMeshes, ropes, pow, plants };
}

export function syncMushroomArt(obj, m, rs, st) {
  if (!obj || !st.scale) return;
  const s = st.scale;
  for (const [id, g] of [[1, s.gL], [2, s.gR]]) {
    const mesh = obj.scaleMeshes[id];
    mesh.position.set(g.ox * rs, g.oy * rs, 0);
    mesh.visible = s.state !== 'gone';
    const rope = obj.ropes[id];
    const y0 = g.oy + 70;
    if (s.state === 'normal') {
      const len = Math.max(1, MK.pulleyY - y0);
      rope.visible = true; rope.scale.set(1, len * rs, 1); rope.position.set(g.ox * rs, (y0 + len / 2) * rs, 0);
    } else {
      // snapped: rope ends dangle from the pulleys
      rope.visible = true; rope.scale.set(1, 500 * rs, 1); rope.position.set(g.ox * rs, (MK.pulleyY - 250) * rs, 0);
    }
  }
  const pw = st.pow;
  obj.pow.visible = pw.state === 'live';
  if (obj.pow.visible) {
    const bob = Math.sin(m.frame * 0.08) * 0;
    obj.pow.position.set(pw.x * rs, (pw.y + bob) * rs, 0);
    const k = Math.min(1, pw.t / 10); obj.pow.scale.setScalar(Math.max(0.01, k));
  }
  st.plants.forEach((p, i) => {
    const v = obj.plants[i];
    const show = p.rise > 0 || p.state === 'ko';
    v.g.visible = show && p.state !== 'dead';
    if (!v.g.visible) return;
    v.g.position.set((p.x + p.kx) * rs, (p.y + p.rise + p.ky) * rs, 0);
    v.g.rotation.z = p.state === 'ko' ? m.frame * 0.3 : 0;
    const open = p.state === 'up' || p.state === 'rise' ? 0.25 + 0.25 * Math.abs(Math.sin(p.bite * 0.15)) : 0.1;
    v.upper.rotation.x = -open; v.lower.rotation.x = open * 0.6;
    v.upper.parent.rotation.y = p.x < 0 ? 0.6 : -0.6;
  });
  // POW quake: shake the world
  const sh = st.shake > 0 ? (st.shake / 40) * 60 * rs : 0;
  obj.group.position.set(0, sh ? (Math.random() - 0.5) * sh : 0, 0);
}
