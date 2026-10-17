// Congo Jungle art: sunset backdrop with jungle silhouettes, palm rows, the wooden treehouse deck on trestles,
// tree trunks with treetop platforms, ferris-wheel platforms and the Barrel Cannon.
import * as THREE from 'three';
import { mat, kit } from '../render/rig.js';
import { backdrop, canvasTex, prism } from './common.js';

function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
const tex = (w, h, draw, rep) => { const t = canvasTex(w, h, draw); t.wrapS = t.wrapT = THREE.RepeatWrapping; if (rep) t.repeat.set(...rep); return t; };
const tmat = (t, o = {}) => new THREE.MeshLambertMaterial({ map: t, ...o });

function paintSunset(c, w, h) {
  const R = rng(21);
  const g = c.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#3a0400'); g.addColorStop(0.12, '#8a1000'); g.addColorStop(0.3, '#d42a04'); g.addColorStop(0.45, '#f46a10');
  g.addColorStop(0.53, '#ffc63a'); g.addColorStop(0.58, '#d84a08'); g.addColorStop(0.66, '#300800'); g.addColorStop(1, '#070200');
  c.fillStyle = g; c.fillRect(0, 0, w, h);
  // streaky clouds
  for (let i = 0; i < 70; i++) {
    const y = h * (0.08 + R() * 0.4), x = R() * w, l = 120 + R() * 380;
    c.fillStyle = `rgba(${R() < 0.5 ? '255,160,40' : '140,20,0'},${0.12 + R() * 0.18})`; c.fillRect(x - l / 2, y, l, 3 + R() * 9);
  }
  // sun glow
  const sx = w * 0.5, sy = h * 0.52;
  let gr = c.createRadialGradient(sx, sy, 0, sx, sy, 380); gr.addColorStop(0, 'rgba(255,255,210,1)'); gr.addColorStop(0.2, 'rgba(255,240,120,0.95)'); gr.addColorStop(0.5, 'rgba(255,170,40,0.5)'); gr.addColorStop(1, 'rgba(255,120,20,0)');
  c.fillStyle = gr; c.fillRect(sx - 380, sy - 380, 760, 760);
  // big dark canopy silhouettes in the top corners
  const blobTree = (x, y, s) => { c.fillStyle = 'rgba(30,2,0,0.85)'; for (let i = 0; i < 26; i++) { c.beginPath(); c.arc(x + (R() - 0.5) * s * 2, y + (R() - 0.5) * s * 1.6, s * (0.25 + R() * 0.35), 0, 7); c.fill(); } };
  blobTree(w * 0.06, h * 0.18, 150); blobTree(w * 0.94, h * 0.2, 150); blobTree(w * 0.2, h * 0.32, 90); blobTree(w * 0.8, h * 0.34, 90);
  // rows of palm silhouettes on the horizon
  const palm = (x, y, s, col) => {
    c.strokeStyle = col; c.fillStyle = col; c.lineWidth = s * 0.12;
    c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + s * 0.1, y - s * 0.5, x, y - s); c.stroke();
    for (let k = 0; k < 7; k++) { const a = -Math.PI / 2 + (k - 3) * 0.45; c.beginPath(); c.moveTo(x, y - s); c.quadraticCurveTo(x + Math.cos(a) * s * 0.5, y - s + Math.sin(a) * s * 0.3 - s * 0.15, x + Math.cos(a) * s * 0.75, y - s + s * 0.35); c.lineWidth = s * 0.09; c.stroke(); }
  };
  for (let i = 0; i < 40; i++) palm(R() * w, h * 0.6 + R() * 10, 70 + R() * 50, '#1a0400');
  c.fillStyle = '#0c0300'; c.fillRect(0, h * 0.6, w, h * 0.4);
  for (let i = 0; i < 26; i++) palm(R() * w, h * 0.72 + R() * 20, 110 + R() * 60, '#0e1a06');
}

function woodTex(base, dark, light, rep, vertical = false, n = 8) {
  return tex(256, 256, (c, w, h) => {
    const R = rng(9);
    c.fillStyle = base; c.fillRect(0, 0, w, h);
    const span = (vertical ? w : h) / n;
    for (let i = 0; i < n; i++) {
      const p = i * span;
      // per-plank tint so neighbouring boards read separately
      c.fillStyle = R() < 0.5 ? `rgba(255,190,90,${0.08 + R() * 0.12})` : `rgba(120,50,0,${0.06 + R() * 0.12})`;
      vertical ? c.fillRect(p, 0, span, h) : c.fillRect(0, p, w, span);
      c.fillStyle = dark; vertical ? c.fillRect(p, 0, 4, h) : c.fillRect(0, p, w, 4);
      c.fillStyle = light; vertical ? c.fillRect(p + 5, 0, 3, h) : c.fillRect(0, p + 5, w, 3);
      for (let k = 0; k < 7; k++) { c.fillStyle = 'rgba(110,50,8,0.28)'; const q = p + 9 + R() * (span - 12); vertical ? c.fillRect(q, R() * h, 2, 40 + R() * 80) : c.fillRect(R() * w, q, 40 + R() * 80, 2); }
      // nail heads at the board ends
      c.fillStyle = 'rgba(60,30,10,0.7)';
      if (vertical) { c.fillRect(p + span * 0.3, 10, 3, 3); c.fillRect(p + span * 0.7, 10, 3, 3); c.fillRect(p + span * 0.3, h - 14, 3, 3); c.fillRect(p + span * 0.7, h - 14, 3, 3); }
    }
  }, rep);
}

function leafTex(col = '#2a8a34', rib = '#8ad070', hi = '#56b04c') {
  return canvasTex(128, 256, (c, w, h) => {
    c.clearRect(0, 0, w, h);
    c.lineCap = 'round';
    // leaflets: long diagonal blades either side of the rib, shorter toward the tip
    for (let y = 6; y < h - 4; y += 7) {
      const k = Math.sin(Math.min(1, (y + 30) / h) * Math.PI) * 0.95 + 0.05, len = w * 0.5 * k;
      for (const sd of [-1, 1]) {
        c.strokeStyle = col; c.lineWidth = 7;
        c.beginPath(); c.moveTo(w / 2, y); c.quadraticCurveTo(w / 2 + sd * len * 0.6, y + 6, w / 2 + sd * len, y + 22); c.stroke();
        c.strokeStyle = hi; c.lineWidth = 2;
        c.beginPath(); c.moveTo(w / 2, y - 1); c.quadraticCurveTo(w / 2 + sd * len * 0.6, y + 4, w / 2 + sd * len * 0.95, y + 19); c.stroke();
      }
    }
    c.strokeStyle = rib; c.lineWidth = 4; c.beginPath(); c.moveTo(w / 2, 0); c.lineTo(w / 2, h); c.stroke();
  });
}

// low-poly palm: trunk + drooping fronds. Returns a group with its base at (0,0,0).
// Fronds radiate around the top, arch slightly and droop; each blade is banked toward vertical so it
// reads broad from the battle camera. o.crownOnly skips the trunk; o.flatZ squashes the crown in depth.
function makeFrond(rs, L, wid, leafMat, phi, lift, droop) {
  const seg = 6, pos = [], uv = [], idx = [];
  const dx = Math.cos(phi), dz = Math.sin(phi);
  // width direction: horizontal perpendicular, banked toward vertical
  const px = -dz, pz = dx;
  for (let i = 0; i <= seg; i++) {
    const v = i / seg, r = v * L, y = L * (lift * v - droop * v * v);
    const cx = dx * r, cz = dz * r, ww = wid * (0.35 + 0.65 * Math.sin(Math.min(1, v * 1.1 + 0.15) * Math.PI));
    for (const sd of [-0.5, 0.5]) {
      pos.push((cx + px * sd * ww * 0.45) * rs, (y + sd * ww * 0.9 - ww * 0.15) * rs, (cz + pz * sd * ww * 0.45) * rs);
      uv.push(sd + 0.5, 1 - v);
    }
    if (i) { const a = (i - 1) * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals();
  return new THREE.Mesh(g, leafMat);
}
function makeCrown(rs, L, leafMat, R, fronds = 12, o = {}) {
  const top = new THREE.Group();
  for (let k = 0; k < fronds; k++) {
    const phi = k / fronds * Math.PI * 2 + R() * 0.3;
    const up = k % 3 === 0;
    top.add(makeFrond(rs, L * (0.8 + R() * 0.3), L * 0.42, leafMat, phi, up ? 0.5 : 0.25 + R() * 0.15, up ? 0.85 : 0.75 + R() * 0.3));
  }
  if (o.flatZ) top.scale.z = o.flatZ;
  return top;
}
function makePalm(rs, h, trunkMat, leafMat, R, fronds = 9, o = {}) {
  const g = new THREE.Group();
  const segs = 5; let x = 0, y = 0; const lean = (R() - 0.5) * 0.25;
  for (let i = 0; i < segs; i++) {
    const sh = h / segs, r = (90 - i * 10) * h / 1600;
    const s = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.9 * rs, r * rs, sh * rs, 7).translate(0, sh * rs / 2, 0), trunkMat);
    s.position.set(x * rs, y * rs, 0); s.rotation.z = lean * i * 0.4; g.add(s);
    x -= Math.sin(lean * i * 0.4) * sh; y += Math.cos(lean * i * 0.4) * sh;
  }
  const top = makeCrown(rs, h * (o.frond ?? 0.5), leafMat, R, fronds, o); top.position.set(x * rs, y * rs, 0); g.add(top);
  return g;
}

export function buildCongo(scene, rs, d) {
  const root = new THREE.Group(); scene.add(root);
  const R = rng(4);
  const bg = backdrop(scene, rs, paintSunset, { tw: 2048, th: 1024, w: 40000, h: 20000, y: 1500, z: -10000 });
  const O = (x, y, z = 0) => [x * rs, y * rs, z * rs];
  // wide boards (~110 u) running front to back on top, warm orange; horizontal boards on the front face
  const plankTop = woodTex('#ec9632', '#7a3608', '#ffc468', [0.12, 0.08], true);
  const plankSide = woodTex('#c86e22', '#5e2c06', '#e89640', [0.12, 0.25], false, 4);
  const trunkT = tex(128, 128, (c, w, h) => { c.fillStyle = '#c08a3a'; c.fillRect(0, 0, w, h); for (let y = 0; y < h; y += 16) { c.fillStyle = '#7a4a18'; c.fillRect(0, y, w, 4); c.fillStyle = '#e0b060'; c.fillRect(0, y + 6, w, 3); } }, [2, 4]);
  const trunkM = tmat(trunkT), leafM = new THREE.MeshLambertMaterial({ map: leafTex('#2c9a34', '#a0e070', '#66c050'), color: 0xd0ffc0, side: THREE.DoubleSide, alphaTest: 0.4, emissive: 0x1a5a14 });
  const DEPTH = 1300;
  // ---------- main deck (yakumono 3 main line, no walls: the deck is a raised floor) ----------
  const main = d.groups.find(g => g.id === 3).floors.find(f => !f.pass).pts;
  const deckPoly = [...main, ...[...main].reverse().map(([x, y]) => [x, y - 120])];
  root.add(prism(deckPoly, DEPTH, [tmat(plankSide), tmat(plankTop)], rs));
  // rope rails along the front and back edges: lashed posts with sagging rope between them
  const postM = mat(0x8a4a18), lashM = mat(0x5a8a30), ropeM = mat(0xe0c880);
  for (const zr of [DEPTH / 2 - 40, -DEPTH / 2 + 40]) {
    const posts = [];
    for (let i = 0; i < main.length - 1; i++) {
      const [a, b] = [main[i], main[i + 1]];
      const n = Math.max(1, Math.round((b[0] - a[0]) / 300));
      for (let k = 0; k < n; k++) { const t = k / n; posts.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]); }
    }
    posts.push(main[main.length - 1]);
    for (const [x, y] of posts) {
      root.add(kit.cyl(18 * rs, 22 * rs, 170 * rs, 0x8a4a18, O(x, y, zr), { seg: 6 }));
      const l = new THREE.Mesh(new THREE.CylinderGeometry(27 * rs, 27 * rs, 34 * rs, 6), lashM); l.position.set(x * rs, (y + 128) * rs, zr * rs); root.add(l);
    }
    for (let i = 0; i < posts.length - 1; i++) {
      const [x0, y0] = posts[i], [x1, y1] = posts[i + 1];
      const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(x0 * rs, (y0 + 128) * rs, zr * rs), new THREE.Vector3((x0 + x1) / 2 * rs, ((y0 + y1) / 2 + 60) * rs, zr * rs), new THREE.Vector3(x1 * rs, (y1 + 128) * rs, zr * rs));
      root.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 8, 8 * rs, 4), ropeM));
    }
    void postM;
  }
  // trestle supports with X bracing under the deck
  const beamM = mat(0x9a5418), beamD = mat(0x6a3610);
  const trestleBottom = -900;
  for (let x = -2100; x <= 2100; x += 420) {
    const yTop = main.reduce((y, p, i) => (i < main.length - 1 && x >= p[0] && x <= main[i + 1][0]) ? p[1] + (main[i + 1][1] - p[1]) * (x - p[0]) / (main[i + 1][0] - p[0]) : y, 0) - 120;
    for (const z of [DEPTH / 2 - 60, -DEPTH / 2 + 60]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(60 * rs, (yTop - trestleBottom) * rs, 60 * rs), beamM);
      post.position.set(x * rs, (yTop + trestleBottom) / 2 * rs, z * rs); root.add(post);
      if (x < 2100) {
        const len = Math.hypot(420, yTop - trestleBottom) * 0.9;
        for (const sgn of [1, -1]) { const br = new THREE.Mesh(new THREE.BoxGeometry(len * rs, 36 * rs, 30 * rs), beamD); br.position.set((x + 210) * rs, (yTop + trestleBottom) / 2 * rs, (z + (z > 0 ? 20 : -20)) * rs); br.rotation.z = sgn * Math.atan2(yTop - trestleBottom, 420); root.add(br); }
      }
    }
  }
  root.add(kit.box(4300 * rs, 50 * rs, (DEPTH - 80) * rs, 0x7a4012, O(0, trestleBottom + 300)));
  // ---------- trees with treetop platforms (pass-through, +-1270..2449) ----------
  for (const sx of [-1, 1]) {
    const tr = new THREE.Group(); tr.position.set(sx * 1720 * rs, 0, -380 * rs); root.add(tr);
    tr.add(new THREE.Mesh(new THREE.CylinderGeometry(300 * rs, 340 * rs, 1400 * rs, 10).translate(0, 700 * rs, 0), trunkM));
    tr.add(kit.cyl(320 * rs, 300 * rs, 60 * rs, 0x8a5a20, [0, 1340 * rs, 0], { seg: 10 }));
    // big drooping crown right under the treetop platform; flattened in depth so no frond reaches in
    // front of the fighting plane (fighters stand on the platform above and jump through the crown)
    const crown = makeCrown(rs, 1150, leafM, R, 16, { flatZ: 0.32 }); crown.position.y = 1360 * rs; tr.add(crown);
    // striped wooden treetop platform following the floor line
    const f = d.groups.find(g => g.id === 3).floors.find(f => f.pass && Math.sign(f.pts[0][0]) === sx).pts;
    const plat = new THREE.Group(); root.add(plat);
    const stripe = tex(256, 64, (c, w, h) => { c.fillStyle = '#c8803a'; c.fillRect(0, 0, w, h); for (let x = 0; x < w; x += 32) { c.fillStyle = '#e8b060'; c.beginPath(); c.moveTo(x, h); c.lineTo(x + 16, 0); c.lineTo(x + 32, h); c.fill(); c.fillStyle = '#8a3a10'; c.fillRect(x, h - 10, 32, 10); } c.fillStyle = '#5a2a08'; c.fillRect(0, 0, w, 8); }, [3, 1]);
    plat.add(prism([...f, [f[1][0], f[1][1] - 110], [f[0][0], f[0][1] - 110]], 520, [tmat(stripe), mat(0xd09048)], rs, -150));
  }
  // ---------- background hut frame (dark pillars) and deck plants / barrels ----------
  const hut = new THREE.Group(); hut.position.z = -1400 * rs; root.add(hut);
  for (let i = 0; i < 6; i++) hut.add(kit.box(120 * rs, 1500 * rs, 120 * rs, 0x2a1408, O(-850 + i * 340, 750)));
  hut.add(kit.box(1100 * rs, 90 * rs, 160 * rs, 0x6a3a14, O(-500, 1560)));
  hut.add(kit.box(1000 * rs, 90 * rs, 160 * rs, 0x6a3a14, O(500, 1640)));
  for (let i = 0; i < 3; i++) { const v = kit.cyl(10 * rs, 10 * rs, 700 * rs, 0x3a2a10, O(-700 + i * 600, 1500), { rot: [0, 0, 0.6] }); hut.add(v); }
  const plants = [[-700, -230, -400, 0x2a7a3a], [-150, -299, -500, 0x2a6aa0], [300, -299, -450, 0x2e8a40], [800, -150, -420, 0x2a7a3a], [-1180, 0, -330, 0x2e8a40], [1200, 0, -330, 0x2a6aa0]];
  for (const [x, y, z, col] of plants) {
    const p = makePalm(rs, 380, mat(0x5a3a18), new THREE.MeshLambertMaterial({ map: leafTex(), color: col, side: THREE.DoubleSide, alphaTest: 0.4 }), R, 7);
    p.position.set(x * rs, y * rs, z * rs); p.scale.setScalar(1.3); root.add(p);
  }
  for (const [x, z, col] of [[-1330, -190, 0xe03030], [1360, -200, 0xe03030], [1030, -230, 0x30a0e0]]) for (let k = 0; k < 4; k++) root.add(kit.sphere(45 * rs, col, O(x + (k - 1.5) * 50, 40, z + (k % 2) * 40), { seg: 5 }));
  const smallBarrel = (x, z) => { const b = kit.cyl(80 * rs, 80 * rs, 170 * rs, 0x9a5a20, O(x, 0, z), { seg: 10 }); root.add(b); root.add(kit.cyl(84 * rs, 84 * rs, 16 * rs, 0x3a3a3a, O(x, 40, z), { seg: 10 })); root.add(kit.cyl(84 * rs, 84 * rs, 16 * rs, 0x3a3a3a, O(x, 120, z), { seg: 10 })); };
  smallBarrel(-1330, -330);
  // ---------- jungle depth: rows of palms behind the stage ----------
  const farLeaf = new THREE.MeshLambertMaterial({ map: leafTex('#2a6a2a', '#5a9a40', '#3e8a38'), color: 0xb0d8a0, side: THREE.DoubleSide, alphaTest: 0.4 });
  const farLeaf2 = new THREE.MeshLambertMaterial({ map: leafTex('#1e4a20', '#3a6a2a', '#2c5e28'), color: 0x9ab890, side: THREE.DoubleSide, alphaTest: 0.4 });
  const farTrunk = mat(0x5a1e10);
  // near row: tops around deck height, red-brown trunks
  for (let i = 0; i < 16; i++) {
    const x = -9000 + i * 1200 + (R() - 0.5) * 300, z = -2600 - R() * 900;
    const p = makePalm(rs, 1900 + R() * 400, farTrunk, farLeaf, R, 12, { frond: 0.55 }); p.position.set(x * rs, (-1800 + R() * 200) * rs, z * rs); root.add(p);
  }
  // back row: a continuous dark canopy line around the treetop height
  for (let i = 0; i < 16; i++) {
    const x = -12000 + i * 1600 + (R() - 0.5) * 400, z = -5000 - R() * 1200;
    const p = makePalm(rs, 2800 + R() * 500, farTrunk, farLeaf2, R, 12, { frond: 0.55 });
    p.position.set(x * rs, (-1300 + R() * 300) * rs, z * rs); root.add(p);
  }
  // ---------- ferris-wheel platforms (yakumono 1/2) ----------
  const groups = new Map();
  const smallTop = woodTex('#d89040', '#7a4410', '#f0b060', [1, 1], true);
  for (const id of [1, 2]) {
    const gg = new THREE.Group(); root.add(gg); groups.set(id, gg);
    gg.add(prism([[-339, 44], [339, 44], [300, -50], [-300, -50]], 420, [tmat(plankSide), tmat(smallTop)], rs));
    gg.add(kit.box(30 * rs, 400 * rs, 30 * rs, 0x3a2a10, O(0, 250, -230)));
  }
  // ---------- barrel cannon ----------
  const barrel = new THREE.Group(); root.add(barrel);
  const stave = tex(256, 128, (c, w, h) => { c.fillStyle = '#b06a28'; c.fillRect(0, 0, w, h); for (let x = 0; x < w; x += 22) { c.fillStyle = '#6a3810'; c.fillRect(x, 0, 3, h); c.fillStyle = '#d89448'; c.fillRect(x + 6, 0, 6, h); } for (const y of [14, h - 26]) { c.fillStyle = '#3a3a40'; c.fillRect(0, y, w, 12); c.fillStyle = '#8a8a90'; c.fillRect(0, y + 2, w, 3); } });
  const lid = canvasTex(128, 128, (c, w, h) => { c.fillStyle = '#7a4416'; c.fillRect(0, 0, w, h); c.fillStyle = '#3a3a40'; c.beginPath(); c.arc(64, 64, 62, 0, 7); c.lineWidth = 8; c.strokeStyle = '#3a3a40'; c.stroke(); c.fillStyle = '#1a0a04'; c.beginPath(); c.arc(64, 64, 40, 0, 7); c.fill(); });
  // barrel: warm self-lit staves so it reads clearly against the dark jungle floor (it hangs below the deck)
  const staveM = tmat(stave, { emissive: 0x6a4a30, emissiveMap: stave }), lidM = tmat(lid, { emissive: 0x4a3020, emissiveMap: lid });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(300 * rs, 270 * rs, 620 * rs, 16), [staveM, lidM, lidM]);
  body.scale.set(1, 1, 1); barrel.add(body);
  body.add(new THREE.Mesh(new THREE.CylinderGeometry(318 * rs, 318 * rs, 240 * rs, 16), staveM));
  for (const y of [-235, 235]) { const band = new THREE.Mesh(new THREE.CylinderGeometry(306 * rs, 306 * rs, 34 * rs, 16), mat(0x9a9aa4, { emissive: 0x303038 })); band.position.y = y * rs; body.add(band); }
  const arrow = canvasTex(128, 128, (c, w, h) => { c.clearRect(0, 0, w, h); c.fillStyle = '#f0f0f0'; c.strokeStyle = '#606060'; c.lineWidth = 6; c.beginPath(); c.moveTo(64, 10); c.lineTo(118, 64); c.lineTo(86, 64); c.lineTo(86, 118); c.lineTo(42, 118); c.lineTo(42, 64); c.lineTo(10, 64); c.closePath(); c.fill(); c.stroke(); });
  const ar = new THREE.Mesh(new THREE.PlaneGeometry(400 * rs, 400 * rs), new THREE.MeshBasicMaterial({ map: arrow, transparent: true }));
  ar.position.z = 326 * rs; barrel.add(ar);
  const puff = kit.sphere(260 * rs, 0xffffff, [0, 420 * rs, 0], { seg: 8, opacity: 0.7 }); puff.visible = false; barrel.add(puff);
  return { root, background: bg, groups, barrel, puff };
}

export function syncCongo(obj, m, rs, st) {
  if (!obj) return;
  for (const g of m.col.groups) { const gg = obj.groups.get(g.id); if (gg && g.moving) gg.position.set(g.ox * rs, g.oy * rs, 0); }
  const b = st.barrel; if (!b) return;
  obj.barrel.position.set(b.x * rs, b.y * rs, 0);
  obj.barrel.rotation.z = b.rot;
  const shake = b.held ? Math.sin(m.frame * 1.3) * 0.04 * (b.shootT > 0 ? 3 : 1) : 0;
  obj.barrel.scale.set(1 + shake, 1 - shake, 1);
  obj.puff.visible = b.puff > 0; if (b.puff > 0) { const k = 1 - b.puff / 20; obj.puff.scale.setScalar(0.6 + k * 1.2); obj.puff.position.y = (420 + k * 400) * rs; obj.puff.material.opacity = 0.7 * (1 - k); }
}
