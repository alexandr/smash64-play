// Planet Zebes art: dark cavern backdrop with purple starry openings, the Norfair rock island with spires and
// canisters, Brinstar bubble platforms, the elevator, and the glowing acid lake.
import * as THREE from 'three';
import { mat, kit } from '../render/rig.js';
import { backdrop, canvasTex, prism } from './common.js';

function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
const tex = (w, h, draw, rep) => { const t = canvasTex(w, h, draw); t.wrapS = t.wrapT = THREE.RepeatWrapping; if (rep) t.repeat.set(...rep); return t; };
const tmat = (t, o = {}) => new THREE.MeshLambertMaterial({ map: t, ...o });

function paintCavern(c, w, h) {
  const R = rng(31);
  c.fillStyle = '#000000'; c.fillRect(0, 0, w, h);
  // purple starry openings in the cave ceiling
  const holes = [[0.1, 0.2, 190, 230], [0.36, 0.13, 170, 170], [0.62, 0.15, 160, 190], [0.88, 0.22, 200, 250]];
  for (const [fx, fy, rx, ry] of holes) {
    const x = fx * w, y = fy * h;
    c.save(); c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, 7); c.clip();
    const g = c.createRadialGradient(x, y, 10, x, y, Math.max(rx, ry));
    g.addColorStop(0, '#6a3ab0'); g.addColorStop(0.5, '#3a2080'); g.addColorStop(1, '#0c0a30');
    c.fillStyle = g; c.fillRect(x - rx, y - ry, rx * 2, ry * 2);
    for (let i = 0; i < 700; i++) { c.fillStyle = R() < 0.3 ? '#ffffff' : R() < 0.5 ? '#c8b8ff' : '#7a6ad0'; c.fillRect(x + (R() - 0.5) * rx * 2, y + (R() - 0.5) * ry * 2, R() < 0.1 ? 2 : 1, R() < 0.1 ? 2 : 1); }
    c.restore();
    c.strokeStyle = '#141a5a'; c.lineWidth = 14; c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, 7); c.stroke();
    c.strokeStyle = '#0a0c2a'; c.lineWidth = 6; c.beginPath(); c.ellipse(x, y, rx + 10, ry + 10, 0, 0, 7); c.stroke();
  }
  // faint cave walls
  for (let i = 0; i < 40; i++) { c.fillStyle = `rgba(${18 + R() * 20 | 0},${16 + R() * 14 | 0},${8 + R() * 10 | 0},0.3)`; c.beginPath(); c.ellipse(R() * w, h * 0.3 + R() * h * 0.5, 40 + R() * 160, 80 + R() * 200, 0, 0, 7); c.fill(); }
  // yellow acid haze near the bottom
  const g = c.createRadialGradient(w / 2, h * 1.02, 0, w / 2, h * 1.02, w * 0.3);
  g.addColorStop(0, 'rgba(255,240,90,0.75)'); g.addColorStop(0.45, 'rgba(200,180,30,0.35)'); g.addColorStop(1, 'rgba(120,110,0,0)');
  c.fillStyle = g; c.fillRect(0, h * 0.5, w, h * 0.5);
  // floating spores
  for (let i = 0; i < 120; i++) { c.fillStyle = R() < 0.5 ? '#30d040' : R() < 0.5 ? '#e03020' : '#a040e0'; c.fillRect(R() * w, R() * h * 0.8, 3, 3); }
}

// rock top: dark olive moss with fine brushed streaks and brown patches (one tile = 400 u)
function rockTop() {
  return tex(256, 256, (c, w, h) => {
    const R = rng(8);
    c.fillStyle = '#4e5020'; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 40; i++) { c.fillStyle = R() < 0.5 ? 'rgba(90,64,28,0.35)' : 'rgba(96,104,40,0.4)'; c.beginPath(); c.ellipse(R() * w, R() * h, 14 + R() * 30, 8 + R() * 16, R() * 3, 0, 7); c.fill(); }
    c.lineCap = 'round';
    for (let i = 0; i < 900; i++) {
      const x = R() * w, y = R() * h, l = 3 + R() * 7, a = -0.6 + R() * 0.5;
      c.strokeStyle = R() < 0.45 ? 'rgba(122,128,52,0.75)' : R() < 0.6 ? 'rgba(52,52,18,0.8)' : 'rgba(104,84,40,0.6)'; c.lineWidth = 1 + R();
      c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); c.stroke();
    }
    for (let i = 0; i < 70; i++) { c.fillStyle = 'rgba(150,170,70,0.5)'; c.fillRect(R() * w, R() * h, 2, 2); }
  }, [0.25, 0.25]);
}
// rock face: one tile spans 600 u wide and the full face height (world y +700 .. -1700): dark olive-brown
// drip streaks at the top, lit ever more yellow toward the acid below, with dark purple organic sockets
export const FACE_TOP = 700, FACE_H = 2400;
function rockSide() {
  return tex(256, 1024, (c, w, h) => {
    const R = rng(12);
    const g = c.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#585020'); g.addColorStop(0.3, '#686024'); g.addColorStop(0.55, '#86782a'); g.addColorStop(0.8, '#a89430'); g.addColorStop(1, '#c8b440');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
    // vertical drip streaks
    for (let i = 0; i < 700; i++) {
      const x = R() * w, y = R() * h, l = 12 + R() * 50, k = y / h;
      c.fillStyle = R() < 0.5 ? `rgba(${30 + k * 40 | 0},${26 + k * 30 | 0},8,0.45)` : `rgba(${150 + k * 90 | 0},${130 + k * 80 | 0},${40 + k * 20 | 0},${0.25 + k * 0.25})`;
      c.fillRect(x, y, 1.5 + R() * 2.5, l);
    }
    // small lumps
    for (let i = 0; i < 160; i++) { const x = R() * w, y = R() * h, r = 2 + R() * 5, k = y / h; c.fillStyle = `rgba(${80 + k * 140 | 0},${70 + k * 120 | 0},20,0.5)`; c.beginPath(); c.ellipse(x, y, r, r * 1.6, 0, 0, 7); c.fill(); }
    // dark purple organic sockets (lower half)
    for (let i = 0; i < 7; i++) {
      const x = 20 + R() * (w - 40), y = h * (0.42 + R() * 0.5), r = 9 + R() * 8;
      c.fillStyle = '#24102c'; c.beginPath(); c.ellipse(x, y, r, r * 1.35, R() * 0.6 - 0.3, 0, 7); c.fill();
      c.strokeStyle = '#4a3020'; c.lineWidth = 2; c.stroke();
      c.strokeStyle = '#2a1430'; c.lineWidth = 3; for (let k = 0; k < 3; k++) { const a = R() * 7; c.beginPath(); c.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r * 1.3); c.lineTo(x + Math.cos(a) * r * 2, y + Math.sin(a) * r * 2.3); c.stroke(); }
      c.fillStyle = '#8a3a50'; c.beginPath(); c.arc(x, y, 2.5, 0, 7); c.fill();
    }
  }, [1 / 6, 1 / (FACE_H / 100)]);
}
function bubbleFront() {
  return tex(256, 64, (c, w, h) => {
    c.fillStyle = '#0c140a'; c.fillRect(0, 0, w, h);
    c.fillStyle = '#4a8a3a'; c.fillRect(0, 0, w, 12); c.fillStyle = '#9ad070'; c.fillRect(0, 2, w, 3);
    for (let x = 0; x < w; x += 32) {
      c.strokeStyle = '#88b840'; c.lineWidth = 3; c.beginPath(); c.arc(x + 16, 34, 13, 0, 7); c.stroke();
      const g = c.createRadialGradient(x + 13, 31, 1, x + 16, 34, 12); g.addColorStop(0, '#ff9070'); g.addColorStop(0.5, '#c02818'); g.addColorStop(1, '#500808');
      c.fillStyle = g; c.beginPath(); c.arc(x + 16, 34, 11, 0, 7); c.fill();
      c.strokeStyle = '#60a040'; c.lineWidth = 2; c.beginPath(); c.arc(x + 16, 54, 9, Math.PI, 0); c.stroke();
    }
  }, [1, 1]);
}
function plateTop() {
  return tex(128, 64, (c, w, h) => { c.fillStyle = '#5a8a6a'; c.fillRect(0, 0, w, h); for (let x = 0; x < w; x += 32) { c.fillStyle = '#2a4a3a'; c.fillRect(x, 0, 3, h); c.fillStyle = '#9ac8a0'; c.fillRect(x + 4, 4, 22, 4); } }, [1, 1]);
}
function acidTex() {
  return tex(256, 256, (c, w, h) => {
    const R = rng(77);
    c.fillStyle = '#f0e030'; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 160; i++) { const r = 6 + R() * 20; c.strokeStyle = `rgba(255,255,200,${0.4 + R() * 0.5})`; c.lineWidth = 2 + R() * 2; c.beginPath(); c.arc(R() * w, R() * h, r, 0, 7); c.stroke(); }
    for (let i = 0; i < 60; i++) { c.fillStyle = 'rgba(200,170,0,0.35)'; c.beginPath(); c.arc(R() * w, R() * h, 4 + R() * 10, 0, 7); c.fill(); }
  }, [0.08, 0.08]);
}

export function buildZebes(scene, rs, d) {
  const root = new THREE.Group(); scene.add(root);
  const R = rng(5);
  const bg = backdrop(scene, rs, paintCavern, { tw: 2048, th: 1024, w: 40000, h: 20000, y: 2500, z: -10000 });
  const O = (x, y, z = 0) => [x * rs, y * rs, z * rs];
  const main = d.groups[0].floors.find(f => !f.pass).pts;
  // ---------- rock island: top slab following the floor, thick jagged underside ----------
  const under = [];
  for (let x = main[main.length - 1][0]; x >= main[0][0]; x -= 260) {
    const k = (x - main[0][0]) / (main[main.length - 1][0] - main[0][0]);
    under.push([x, -700 - Math.sin(k * Math.PI) * 500 - R() * 260]);
  }
  under.push([main[0][0], main[0][1] - 500]);
  const island = [...main, [main[main.length - 1][0], main[main.length - 1][1] - 300], ...under];
  const sideT = rockSide(); sideT.offset.y = -(FACE_TOP - FACE_H) / FACE_H;   // v = (y - (FACE_TOP - FACE_H)) / FACE_H
  const top = tmat(rockTop()), side = tmat(sideT, { emissive: 0x2a2208, emissiveMap: sideT });
  root.add(prism(island, 1700, [side, top], rs, -150));
  // stalactites hanging from the underside
  for (let i = 0; i < 16; i++) {
    const x = main[0][0] + 200 + R() * (main[main.length - 1][0] - main[0][0] - 400);
    const k = (x - main[0][0]) / (main[main.length - 1][0] - main[0][0]);
    const y = -700 - Math.sin(k * Math.PI) * 500 - 120;
    const st = kit.cone((70 + R() * 70) * rs, (300 + R() * 500) * rs, R() < 0.5 ? 0x8a6a1a : 0x6a5014, O(x, y, (R() - 0.5) * 1400), { seg: 5, rot: [Math.PI, 0, 0] });
    root.add(st);
  }
  // spiky brown spires and chozo pipe frames on the left hill
  for (const [x, z, h] of [[-2500, -450, 1300], [-1850, -550, 1100], [2000, -600, 800]]) {
    const y = sampleY(main, x);
    for (let k = 0; k < 4; k++) root.add(kit.cone((140 - k * 30) * rs, (h * 0.35) * rs, k % 2 ? 0x7a4a18 : 0xb07a2a, O(x, y + k * h * 0.22, z), { seg: 6 }));
  }
  const pipeM = mat(0x2a3a2a);
  for (const [x0, z] of [[-2350, -620], [1500, -700]]) {
    const y = sampleY(main, x0);
    root.add(kit.box(40 * rs, 900 * rs, 40 * rs, 0x2a3a2a, O(x0, y + 450, z)));
    root.add(kit.box(500 * rs, 40 * rs, 40 * rs, 0x2a3a2a, O(x0 + 250, y + 880, z)));
    root.add(kit.box(40 * rs, 400 * rs, 40 * rs, 0x2a3a2a, O(x0 + 500, y + 680, z)));
    root.add(kit.box(300 * rs, 40 * rs, 40 * rs, 0x2a3a2a, O(x0 + 350, y + 500, z)));
  }
  // green canisters with glowing tops (pink on the left one), set behind the fighting plane
  for (const [x, z, glowC] of [[-2650, -420, 0xff90a0], [-60, -460, 0x90ffb0], [560, -400, 0x90ffb0]]) {
    const y = sampleY(main, x) - 20;
    root.add(kit.cyl(150 * rs, 160 * rs, 220 * rs, 0x1e4a2a, O(x, y, z), { seg: 8 }));
    root.add(kit.cyl(155 * rs, 155 * rs, 30 * rs, 0x3a7a4a, O(x, y + 210, z), { seg: 8 }));
    const g = new THREE.Mesh(new THREE.CylinderGeometry(120 * rs, 120 * rs, 12 * rs, 10), new THREE.MeshBasicMaterial({ color: glowC }));
    g.position.set(x * rs, (y + 240) * rs, z * rs); root.add(g);
    const halo = new THREE.Mesh(new THREE.CylinderGeometry(150 * rs, 120 * rs, 140 * rs, 10, 1, true), new THREE.MeshBasicMaterial({ color: glowC, transparent: true, opacity: 0.25, depthWrite: false, side: THREE.DoubleSide }));
    halo.position.set(x * rs, (y + 310) * rs, z * rs); root.add(halo);
  }
  // teal metal trim with white light strips along the front edge of the rock top
  {
    const trimT = tex(128, 16, (c, w, h) => { c.fillStyle = '#1e5a4e'; c.fillRect(0, 0, w, h); c.fillStyle = '#4aa088'; c.fillRect(0, 0, w, 4); c.fillStyle = '#0c2a24'; c.fillRect(0, h - 3, w, 3); c.fillStyle = '#e8fff0'; c.fillRect(20, 7, 50, 4); }, [1, 1]);
    const FZ = -150 + 850;
    for (let i = 0; i < main.length - 1; i++) {
      const a = main[i], b = main[i + 1], len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const t = trimT.clone(); t.needsUpdate = true; t.repeat.set(Math.max(1, Math.round(len / 500)), 1);
      const strip = new THREE.Mesh(new THREE.PlaneGeometry(len * rs, 70 * rs), new THREE.MeshLambertMaterial({ map: t, emissive: 0x0c2a24 }));
      strip.position.set((a[0] + b[0]) / 2 * rs, ((a[1] + b[1]) / 2 - 36) * rs, (FZ + 2) * rs); strip.rotation.z = Math.atan2(b[1] - a[1], b[0] - a[0]);
      root.add(strip);
    }
  }
  void pipeM;
  // ---------- Brinstar platforms (pass-through) ----------
  const bf = tmat(bubbleFront()), pt = tmat(plateTop());
  for (const f of d.groups[0].floors.filter(f => f.pass)) {
    const a = f.pts[0], b = f.pts[f.pts.length - 1];
    const poly = [a, b, [b[0], b[1] - 180], [a[0], a[1] - 180]];
    const ft = bubbleFront(); ft.repeat.set(Math.max(1, Math.round((b[0] - a[0]) / 720)), 1);
    const pm = prism(poly, 360, [tmat(ft), pt], rs);
    // remap cap UVs so the bubble strip spans the front face once vertically
    remapCapUV(pm.geometry, a, b, 180, rs);
    root.add(pm);
  }
  // ---------- elevator (yakumono 2) ----------
  const groups = new Map();
  const el = new THREE.Group(); root.add(el); groups.set(2, el);
  const ft = bubbleFront(); ft.repeat.set(1, 1);
  const em = prism([[-359, 130], [355, 130], [355, -120], [-359, -120]], 420, [tmat(ft), pt], rs);
  remapCapUV(em.geometry, [-359, 130], [355, 130], 250, rs);
  el.add(em);
  // ---------- acid lake ----------
  const at = acidTex();
  // the lake glows brightest under the island and fades into the dark cavern toward the edges
  const fade = canvasTex(256, 128, (c, w, h) => { c.fillStyle = '#000'; c.fillRect(0, 0, w, h); c.save(); c.translate(w / 2, h * 0.6); c.scale(1, 0.75); const g = c.createRadialGradient(0, 0, 0, 0, 0, w * 0.2); g.addColorStop(0, '#fff'); g.addColorStop(0.4, '#c8c8c8'); g.addColorStop(0.8, '#383838'); g.addColorStop(1, '#000'); c.fillStyle = g; c.fillRect(-w, -h * 2, w * 2, h * 4); c.restore(); return; c.fillStyle = g; c.fillRect(0, 0, w, h); });
  const acid = new THREE.Mesh(new THREE.PlaneGeometry(40000 * rs, 14000 * rs), new THREE.MeshBasicMaterial({ map: at, alphaMap: fade, transparent: true, opacity: 0.95, depthWrite: false }));
  acid.rotation.x = -Math.PI / 2; acid.position.set(0, -3000 * rs, -2000 * rs); root.add(acid);
  at.repeat.set(40, 14);
  const fadeX = canvasTex(256, 64, (c, w, h) => { const g = c.createLinearGradient(0, 0, w, 0); g.addColorStop(0, '#000'); g.addColorStop(0.3, '#606060'); g.addColorStop(0.5, '#fff'); g.addColorStop(0.7, '#606060'); g.addColorStop(1, '#000'); c.fillStyle = g; c.fillRect(0, 0, w, h); });
  const acidFront = new THREE.Mesh(new THREE.PlaneGeometry(40000 * rs, 9000 * rs), new THREE.MeshBasicMaterial({ color: 0xd8c020, alphaMap: fadeX, transparent: true, opacity: 0.55, depthWrite: false }));
  acidFront.position.set(0, -3000 * rs, 5000 * rs); root.add(acidFront);
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(14000 * rs, 5000 * rs), new THREE.MeshBasicMaterial({ map: glowTex(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  glow.position.set(0, -1800 * rs, -1200 * rs); root.add(glow);
  // spores drifting in the air
  const spores = [];
  for (let i = 0; i < 30; i++) {
    const s = new THREE.Mesh(new THREE.SphereGeometry(18 * rs, 4, 3), new THREE.MeshBasicMaterial({ color: [0x40ff50, 0xff4030, 0xc060ff][i % 3] }));
    s.position.set((R() - 0.5) * 12000 * rs, (R() * 7000 - 500) * rs, (-1500 - R() * 3000) * rs); root.add(s); spores.push(s);
  }
  return { root, background: bg, groups, acid, acidFront, glow, at, spores };
}

function glowTex() {
  return canvasTex(256, 128, (c, w, h) => { const g = c.createRadialGradient(w / 2, h, 0, w / 2, h, w / 2); g.addColorStop(0, 'rgba(255,240,120,0.9)'); g.addColorStop(0.5, 'rgba(220,180,40,0.35)'); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(0, 0, w, h); });
}

function sampleY(pts, x) { for (let i = 0; i < pts.length - 1; i++) { const a = pts[i], b = pts[i + 1]; if (x >= a[0] && x <= b[0]) return a[1] + (b[1] - a[1]) * (x - a[0]) / (b[0] - a[0]); } return pts[0][1]; }

// ExtrudeGeometry caps get world-unit UVs; map the front/back caps so u spans the platform once and v spans its height
function remapCapUV(geo, a, b, hgt, rs) {
  const pos = geo.attributes.position, uv = geo.attributes.uv, n = geo.groups[0]?.count ?? 0;
  for (let i = 0; i < n; i++) {
    const x = pos.getX(i) / rs, y = pos.getY(i) / rs;
    uv.setXY(i, (x - a[0]) / (b[0] - a[0]), 1 - (a[1] - y) / hgt);
  }
  uv.needsUpdate = true;
}

export function syncZebes(obj, m, rs, st) {
  if (!obj) return;
  for (const g of m.col.groups) { const gg = obj.groups.get(g.id); if (gg && g.moving) gg.position.set(g.ox * rs, g.oy * rs, 0); }
  const y = st.acidY ?? -3283;
  const q = st.acid?.quake > 0 ? Math.sin(m.frame * 2.1) * 25 : 0;
  obj.acid.position.y = y * rs; obj.acidFront.position.y = (y - 4500) * rs;
  obj.glow.position.y = (y + 1200) * rs;
  obj.at.offset.set((m.frame * 0.0007) % 1, (m.frame * 0.0004) % 1);
  obj.background.position.x += q * rs;
  for (const [i, s] of obj.spores.entries()) { s.position.y += Math.sin(m.frame * 0.01 + i) * 0.01; s.position.x += Math.cos(m.frame * 0.008 + i * 2) * 0.008; }
}
