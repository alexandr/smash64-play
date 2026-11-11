// Dream Land — geometry, blast zones and Whispy Woods wind from the decomp (reference/spec/stages.md).
import * as THREE from 'three';
import { mat, kit } from '../render/rig.js';
import { backdrop, gradient, canvasTex, makeStage, floorMesh } from './common.js';
import data from './data/dream_land.js';

const WHISPY_X = -525;

export const dreamland = makeStage(data, {
  id: 'dreamland', series: 'kirby', music: 'dreamland',
  init(m, st) { st.wind = { state: 'wait', t: 960 + Math.floor(Math.random() * 1140), dir: 1, blow: 0 }; },
  update(m, st) {
    const w = st.wind;
    if (m.phase !== 'play') return;
    w.t--;
    if (w.state === 'wait' && w.t <= 0) {
      // face the side with more fighters (ties keep the current side)
      const live = m.fighters.filter(f => !f.dead);
      const left = live.filter(f => f.x < WHISPY_X).length, right = live.length - left;
      if (left !== right) w.dir = left > right ? -1 : 1;
      w.state = 'blow'; w.t = 240 + Math.floor(Math.random() * 80) + 44; w.blow = 0;
      m.emit('sfx', { name: 'wind' });
    } else if (w.state === 'blow') {
      w.blow++;
      if (w.blow > 22 && w.t > 0) {
        for (const f of m.fighters) {
          if (f.dead || f.state === 'ledge' || f.state === 'respawn') continue;
          const inX = w.dir < 0 ? (f.x >= -2325 && f.x <= WHISPY_X) : (f.x >= WHISPY_X && f.x <= 2275);
          if (!inX || f.y < -10 || f.y > 1000) continue;
          const push = Math.max(0, 6.0 - Math.abs(f.x - WHISPY_X) * 0.0006);
          f.x += w.dir * push;
          if (f.grounded && f.ground) { const y = f.ground.pts && f.x >= f.ground.pts[0][0] && f.x <= f.ground.pts[f.ground.pts.length - 1][0]; if (!y) f.becomeAirborne(); }
        }
      }
      if (w.t <= 0) { w.state = 'wait'; w.t = 960 + Math.floor(Math.random() * 1140); }
    }
  },
  build(scene, rs, d) { return buildDreamLand(scene, rs, d); },
  sync(obj, m, rs, st) {
    // Whispy's face and wind particles
    const w = st.wind; if (!obj) return;
    const blowing = w.state === 'blow' && w.blow > 22;
    obj.mouth.scale.set(0.8, blowing ? 1.1 : 0.45, 0.3);
    if (obj.noseG) obj.noseG.scale.x = w.dir;
    obj.face.rotation.y += ((w.dir < 0 ? -0.35 : 0.35) - obj.face.rotation.y) * 0.1;
    for (const p of obj.puffs) {
      p.visible = blowing;
      if (blowing) { p.position.x += w.dir * 0.25; if (Math.abs(p.position.x - WHISPY_X * rs) > 18) p.position.x = WHISPY_X * rs + w.dir * Math.random() * 2; }
    }
  },
});

function lam(map, color = 0xffffff, glow = 0.4) {
  return new THREE.MeshLambertMaterial({ map, color, emissive: new THREE.Color(glow, glow, glow), emissiveMap: map ?? null });
}
function speckle(c, w, h, n, cols, rMin, rMax) {
  for (let i = 0; i < n; i++) { c.fillStyle = cols[i % cols.length]; c.beginPath(); c.arc(Math.random() * w, Math.random() * h, rMin + Math.random() * (rMax - rMin), 0, Math.PI * 2); c.fill(); }
}
function paintSky(c, w, h) {
  gradient(c, w, h, [[0, '#2f7fe0'], [0.45, '#78c4ff'], [1, '#c8ecff']]);
  // soft swirling cloud bands
  for (let i = 0; i < 9; i++) {
    c.save(); c.translate(Math.random() * w, h * (0.25 + Math.random() * 0.6)); c.rotate(-0.35 + Math.random() * 0.2);
    const g = c.createRadialGradient(0, 0, 10, 0, 0, 260); g.addColorStop(0, 'rgba(255,255,255,0.85)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g; c.scale(2.6, 0.45); c.beginPath(); c.arc(0, 0, 260, 0, Math.PI * 2); c.fill(); c.restore();
  }
  // rainbow (top right)
  const cols = ['#ff6868', '#ffa850', '#fff068', '#78e078', '#68b0ff', '#a878f0'];
  c.lineWidth = 17; c.globalAlpha = 0.7;
  cols.forEach((col, i) => { c.strokeStyle = col; c.beginPath(); c.arc(w * 0.56, h * 0.6, 280 - i * 16, Math.PI * 1.05, Math.PI * 1.95); c.stroke(); });
  c.globalAlpha = 1;
  // floating star-shaped island with a little castle (behind, upper left)
  c.save(); c.translate(w * 0.44, h * 0.47); c.rotate(-0.2); c.scale(0.5, 0.5);
  c.fillStyle = '#e8a8a8'; c.beginPath(); for (let i = 0; i < 10; i++) { const r = i % 2 ? 55 : 120, a = -Math.PI / 2 + i * Math.PI / 5; c.lineTo(Math.cos(a) * r, Math.sin(a) * r * 0.75 + 12); } c.closePath(); c.fill();
  c.fillStyle = '#58c8b8'; c.beginPath(); for (let i = 0; i < 10; i++) { const r = i % 2 ? 50 : 110, a = -Math.PI / 2 + i * Math.PI / 5; c.lineTo(Math.cos(a) * r, Math.sin(a) * r * 0.75); } c.closePath(); c.fill();
  c.fillStyle = '#e8c8f0'; for (const [x, y, ww, hh] of [[-30, -60, 22, 50], [0, -75, 26, 65], [30, -55, 20, 45]]) { c.fillRect(x - ww / 2, y, ww, hh); c.fillStyle = '#c070c0'; c.beginPath(); c.moveTo(x - ww / 2 - 4, y); c.lineTo(x, y - 24); c.lineTo(x + ww / 2 + 4, y); c.fill(); c.fillStyle = '#e8c8f0'; }
  c.restore();
  // distant puffy islands: teal / lavender / pink bubbles, white cloud bases
  const blob = (x, y, r, col) => { const g = c.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r); g.addColorStop(0, '#ffffff'); g.addColorStop(0.35, col); g.addColorStop(1, col); c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill(); };
  for (const [x, y, s] of [[0.08, 0.86, 1], [0.3, 0.92, 0.8], [0.78, 0.88, 1.1], [0.95, 0.8, 0.8], [0.55, 0.95, 0.6]]) {
    blob(x * w, y * h, 70 * s, '#5cc8c0'); blob(x * w + 70 * s, y * h + 20 * s, 55 * s, '#a890e0'); blob(x * w - 70 * s, y * h + 25 * s, 50 * s, '#f0a8c8');
    c.fillStyle = 'rgba(255,255,255,0.9)'; for (let k = -3; k <= 3; k++) { c.beginPath(); c.arc(x * w + k * 40 * s, y * h + 60 * s, 40 * s, 0, Math.PI * 2); c.fill(); }
  }
}

// Shared Dream Land island art (also used by the How to Play stage). o.whispy: draw the tree.
export function buildDreamLand(scene, rs, d, o = {}) {
  const g = new THREE.Group(); scene.add(g);
  const bg = backdrop(scene, rs, paintSky, { tw: 2048, th: 1024, y: 1500, w: 48000, h: 24000 });
  const main = d.groups[0].floors.find(f => !f.pass);
  const fy = main.pts[0][1], R = main.pts[main.pts.length - 1][0];
  // island underside: orange/brown diamond checker lathed from the right wall profile
  const dirt = canvasTex(64, 64, (c, w, h) => {
    c.fillStyle = '#e0a450'; c.fillRect(0, 0, w, h);
    for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) {
      const cx = x * 32 + 16, cy = y * 32 + 16;
      c.fillStyle = '#a8642a'; c.beginPath(); c.moveTo(cx, cy - 16); c.lineTo(cx + 16, cy); c.lineTo(cx, cy + 16); c.lineTo(cx - 16, cy); c.closePath(); c.fill();
      c.fillStyle = '#8a4c1c'; c.beginPath(); c.moveTo(cx, cy); c.lineTo(cx + 16, cy); c.lineTo(cx, cy + 16); c.closePath(); c.fill();
    }
  }, { repeat: [26, 6] });
  const rw = d.groups[0].walls.filter(w => w.nx > 0);
  const prof = [[0, rw[rw.length - 1].b[1]], ...[...rw].reverse().map(w => w.a), [R, fy]];
  prof.sort((a, b) => a[1] - b[1]);
  const lathe = new THREE.Mesh(new THREE.LatheGeometry(prof.map(([x, y]) => new THREE.Vector2(Math.abs(x) * rs, (y - 30) * rs)), 20), lam(dirt, 0xffffff, 0.35));
  lathe.scale.set(1, 1, 0.34); g.add(lathe);
  // grass cap and bright rim
  const grassTex = canvasTex(256, 128, (c, w, h) => { c.fillStyle = '#3cb83c'; c.fillRect(0, 0, w, h); speckle(c, w, h, 500, ['#58cc48', '#2ea436', '#4cc040'], 1, 3); }, { repeat: [6, 2] });
  const top = new THREE.Mesh(new THREE.CylinderGeometry((R + 15) * rs, R * rs, 130 * rs, 28), [lam(grassTex, 0xffffff, 0.35), lam(grassTex, 0xffffff, 0.45), lam(grassTex)]);
  top.scale.set(1, 1, 0.34); top.position.y = (fy - 65) * rs; g.add(top);
  // sandy path behind the pond and flower beds
  const path = new THREE.Mesh(new THREE.BoxGeometry(4000 * rs, 4 * rs, 90 * rs), lam(null, 0xe8b868, 0)); path.material.emissive.set(0x604820);
  path.position.set(0, (fy + 2) * rs, 120 * rs); g.add(path);
  const deco = !o.bare;
  // pond
  const pondTex = canvasTex(128, 64, (c, w, h) => { gradient(c, w, h, [[0, '#a8dcff'], [1, '#70b8f0']]); c.strokeStyle = 'rgba(255,255,255,0.7)'; c.lineWidth = 3; for (let i = 0; i < 8; i++) { c.beginPath(); const x = Math.random() * w, y = Math.random() * h; c.moveTo(x, y); c.lineTo(x + 18, y); c.stroke(); } });
  const pond = new THREE.Mesh(new THREE.CylinderGeometry(560 * rs, 560 * rs, 6 * rs, 10), [lam(null, 0xd8f0ff, 0.3), lam(pondTex, 0xffffff, 0.5), lam(pondTex)]);
  pond.scale.set(1.5, 1, 0.42); pond.position.set(150 * rs, (fy + 2) * rs, 400 * rs); if (deco) g.add(pond);
  // flower beds (front left, behind) and front flowers
  const fcol = [0xff88b0, 0xfff070, 0xffffff, 0xb090ff, 0xff9050];
  if (deco) for (let i = 0; i < 46; i++) {
    const x = -2150 + Math.random() * 4300, z = Math.random() < 0.5 ? 180 + Math.random() * 60 : 640 + Math.random() * 60;
    if (z > 500 && x > -800 && x < 1100) continue;
    g.add(kit.sphere(34 * rs, fcol[i % fcol.length], [x * rs, (fy + 28) * rs, z * rs], { seg: 5 }));
  }
  // yellow picket fences
  const fence = (x0, n, z) => { for (let i = 0; i < n; i++) g.add(kit.box(36 * rs, 160 * rs, 20 * rs, 0xf8d860, [(x0 + i * 75) * rs, (fy + 80) * rs, z * rs])); g.add(kit.box(n * 75 * rs, 24 * rs, 16 * rs, 0xe8c040, [(x0 + (n - 1) * 37) * rs, (fy + 110) * rs, (z + 8) * rs])); };
  if (deco) { fence(-2050, 5, 560); fence(450, 9, -150); }
  // bushes with pink flowers
  const bushTex = canvasTex(128, 128, (c, w, h) => { c.fillStyle = '#3aa848'; c.fillRect(0, 0, w, h); speckle(c, w, h, 260, ['#2a8a38', '#58c060'], 2, 5); speckle(c, w, h, 40, ['#ff9ab8', '#ffc0d4'], 3, 6); });
  if (deco) for (const [x, z, r] of [[-1500, -250, 330], [1650, -250, 300], [-2050, -120, 220], [2000, -150, 220]]) {
    const b = new THREE.Mesh(new THREE.IcosahedronGeometry(r * rs, 1), lam(bushTex, 0xffffff, 0.35)); b.scale.set(1, 1.15, 0.7); b.position.set(x * rs, (fy + r * 0.95) * rs, z * rs); g.add(b);
  }
  // pass-through platforms: golden logs with rounded ends
  const logTex = canvasTex(128, 32, (c, w, h) => { gradient(c, w, h, [[0, '#ffe080'], [0.5, '#f0b038'], [1, '#a86010']]); for (let x = 0; x < w; x += 9) { c.fillStyle = 'rgba(140,80,20,0.25)'; c.fillRect(x, 0, 2, h); } });
  for (const f of d.groups[0].floors.filter(f => f.pass)) {
    const x0 = f.pts[0][0], x1 = f.pts[f.pts.length - 1][0], y = f.pts[0][1];
    const log = new THREE.Mesh(new THREE.CylinderGeometry(52 * rs, 52 * rs, (x1 - x0) * rs, 10), [lam(logTex, 0xffffff, 0.45), lam(null, 0xf8d880, 0.3), lam(null, 0xf8d880, 0.3)]);
    log.rotation.z = Math.PI / 2; log.scale.set(1, 1, 3.2); log.position.set((x0 + x1) / 2 * rs, (y - 52) * rs, 0); g.add(log);
  }
  const obj = { group: g, background: bg };
  if (deco) Object.assign(obj, buildWhispy(g, rs, fy));
  return obj;
}

function buildWhispy(g, rs, fy) {
  const barkTex = canvasTex(128, 256, (c, w, h) => { c.fillStyle = '#d8b878'; c.fillRect(0, 0, w, h); speckle(c, w, h, 90, ['#f0d8a0', '#c09858', '#e8cc90'], 3, 9); for (let i = 0; i < 10; i++) { c.strokeStyle = 'rgba(150,110,60,0.5)'; c.lineWidth = 2; c.beginPath(); const x = Math.random() * w; c.moveTo(x, 0); c.lineTo(x + (Math.random() - 0.5) * 20, h); c.stroke(); } }, { repeat: [2, 1] });
  const bark = lam(barkTex, 0xffffff, 0.4);
  const tree = new THREE.Group(); tree.position.set(WHISPY_X * rs, fy * rs, -420 * rs); g.add(tree);
  tree.add(new THREE.Mesh(new THREE.CylinderGeometry(380 * rs, 470 * rs, 2300 * rs, 12).translate(0, 1150 * rs, 0), bark));
  // side trunks
  for (const [x, z, r, tilt] of [[-850, -350, 230, 0.08], [1450, -260, 260, -0.06]]) {
    const t = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.8 * rs, r * rs, 2300 * rs, 10).translate(0, 1150 * rs, 0), bark);
    t.position.set(x * rs, 0, z * rs); t.rotation.z = tilt; tree.add(t);
  }
  // face (rotates toward the blow direction)
  const face = new THREE.Group(); face.position.set(0, 0, 0); tree.add(face);
  const dark = lam(null, 0x2a1808, 0);
  for (const ex of [-120, 90]) { const e = new THREE.Mesh(new THREE.SphereGeometry(60 * rs, 8, 6), dark); e.scale.set(0.75, 1.9, 0.4); e.position.set(ex * rs, 1050 * rs, 440 * rs); face.add(e); }
  // nose: a stubby branch pointing sideways toward the blow direction (mirrored in sync)
  const noseG = new THREE.Group(); noseG.position.set(0, 830 * rs, 430 * rs); face.add(noseG);
  const nose = new THREE.Mesh(new THREE.CylinderGeometry(38 * rs, 70 * rs, 300 * rs, 7).translate(0, 150 * rs, 0), lam(barkTex, 0xe8c890, 0.4));
  nose.rotation.set(0.5, 0, -1.25); noseG.add(nose);
  const mouth = new THREE.Mesh(new THREE.SphereGeometry(80 * rs, 8, 6), dark); mouth.scale.set(0.8, 0.6, 0.3); mouth.position.set(0, 560 * rs, 450 * rs); face.add(mouth);
  // canopy: leafy clusters with stars
  const leafTex = canvasTex(128, 128, (c, w, h) => { c.fillStyle = '#34a440'; c.fillRect(0, 0, w, h); speckle(c, w, h, 420, ['#1e7a2c', '#4cc050', '#2a9038', '#6ad868'], 2, 6); }, { repeat: [2, 2] });
  const leafMat = lam(leafTex, 0xffffff, 0.35);
  for (const [x, y, z, r] of [[0, 2600, -200, 1000], [-1000, 2300, -100, 800], [1100, 2350, -100, 820], [-1900, 2000, 0, 600], [2000, 2050, 0, 620], [-500, 3100, -300, 700], [700, 3100, -300, 700], [400, 2000, 200, 700], [-500, 1950, 250, 650], [1500, 1850, 300, 450], [-1500, 1800, 300, 450]]) {
    const m = new THREE.Mesh(new THREE.IcosahedronGeometry(r * rs, 1), leafMat); m.position.set(x * rs, y * rs, z * rs); m.scale.set(1, 0.8, 0.7); tree.add(m);
  }
  const star = new THREE.Shape(); for (let i = 0; i < 10; i++) { const r = i % 2 ? 0.45 : 1, a = Math.PI / 2 + i * Math.PI / 5; if (i) star.lineTo(Math.cos(a) * r, Math.sin(a) * r); else star.moveTo(Math.cos(a) * r, Math.sin(a) * r); }
  const sg = new THREE.ExtrudeGeometry(star, { depth: 0.3, bevelEnabled: false });
  for (const [x, y, col] of [[-1300, 2200, 0xff7090], [1600, 2300, 0xff7090], [-300, 2900, 0xfff080], [900, 2700, 0xb070ff], [-2100, 2050, 0xfff080], [200, 2100, 0xb070ff]]) {
    const s = new THREE.Mesh(sg, lam(null, col, 0.3)); s.scale.setScalar(110 * rs); s.position.set(x * rs, y * rs, 520 * rs); tree.add(s);
  }
  const puffs = [];
  for (let i = 0; i < 10; i++) { const p = kit.sphere(60 * rs, 0xffffff, [WHISPY_X * rs, (fy + 150 + Math.random() * 700) * rs, 200 * rs], { seg: 6, opacity: 0.6 }); p.visible = false; g.add(p); puffs.push(p); }
  return { mouth, face, puffs, noseG };
}
