// Meta Crystal (1P: Metal Mario) — crystal cave: faceted crystal rock island with a riveted green girder
// walkway following the sloped collision floor, red lattice trusses, a yellow girder soft platform and big
// pale crystals, in front of a dark blue cave wall of glimmering crystal facets. No hazards.
import * as THREE from 'three';
import { makeStage, floorMesh } from './common.js';
import { rng, facetPrism, crystal, tex, bgPlane, truss, paintFaces, vcMat } from './final_kit.js';
import data from './data/meta_crystal.js';

const ROCK = [0xa8a0b0, 0x8c8498, 0x787088, 0xc0b8c8, 0x686078, 0xc8a0b0, 0x9890a0, 0x58607a];
const CRYS = [0xc8c0e0, 0xa898c8, 0xe0d8f0, 0x8878b0, 0xf0d0b0, 0xd0a890, 0x7070a0];

export const metacrystal = makeStage(data, {
  id: 'metacrystal', series: 'mario', music: 'metacrystal',
  clearColor: 0x00000a,
  options: { ambient: 0.75, sun: 1.2, sunDir: [-0.5, 0.8, 0.9], bgParallax: 0.9 },
  build(scene, rs, d) { return build(scene, rs, d); },
  sync(obj, m, rs) {
    if (!obj) return;
    // crystal glints in the cave wall
    const t = m.frame;
    obj.glints.forEach((g, i) => { const k = Math.max(0, Math.sin(t * 0.03 + i * 1.7)); g.material.opacity = k * k * 0.9; g.scale.setScalar(0.5 + k); });
  },
});

function build(scene, rs, d) {
  const R = rng(9);
  const root = new THREE.Group(); scene.add(root);
  // --- cave wall backdrop: random blue/teal/violet facets
  const bgTex = tex(1024, 512, (c, w, h) => {
    c.fillStyle = '#0a1830'; c.fillRect(0, 0, w, h);
    const pal = ['#10284a', '#1a3a68', '#24508a', '#2e66a8', '#1c4058', '#2a5a70', '#3a4c90', '#4a3a80', '#0c1c38', '#3878c0', '#5a8cc8', '#203050'];
    for (let i = 0; i < 900; i++) {
      const x = R() * w, y = R() * h, s = 20 + R() * 70;
      c.fillStyle = pal[Math.floor(R() * pal.length)];
      c.globalAlpha = 0.7 + R() * 0.3;
      c.beginPath(); c.moveTo(x, y); c.lineTo(x + (R() - 0.5) * s * 2, y + s * (0.6 + R())); c.lineTo(x + (R() - 0.5) * s * 2, y - s * (0.3 + R() * 0.6)); c.fill();
    }
    // brighter crystal spikes
    for (let i = 0; i < 70; i++) {
      const x = R() * w, y = R() * h, s = 20 + R() * 40;
      c.fillStyle = ['#6aa0e0', '#88b8f0', '#5070c0', '#a0a8e0'][i % 4]; c.globalAlpha = 0.55;
      c.beginPath(); c.moveTo(x, y - s * 1.6); c.lineTo(x + s * 0.4, y); c.lineTo(x - s * 0.4, y); c.fill();
    }
    c.globalAlpha = 1;
    const v = c.createLinearGradient(0, 0, 0, h); v.addColorStop(0, 'rgba(0,0,20,0.6)'); v.addColorStop(0.5, 'rgba(0,0,10,0.3)'); v.addColorStop(1, 'rgba(0,0,20,0.5)');
    c.fillStyle = v; c.fillRect(0, 0, w, h);
  });
  const bg = new THREE.Group(); scene.add(bg);
  bg.add(bgPlane(34000, 17000, bgTex, -9000, rs));
  // big dim crystal shards in the mid-distance (part of the background so they parallax with it)
  for (let i = 0; i < 14; i++) {
    const cr = crystal((300 + R() * 500) * rs, (2000 + R() * 3500) * rs, [0x203c70, 0x284c88, 0x3060a0, 0x1c3058, 0x4060a8], R, { seg: 5 });
    cr.position.set((-14000 + i * 2100 + R() * 800) * rs, (-4000 + R() * 5000) * rs, (-6000 - R() * 1500) * rs);
    cr.rotation.set((R() - 0.5) * 0.6, R() * 3, (R() - 0.5) * 1.2);
    bg.add(cr);
  }
  const glints = [];
  for (let i = 0; i < 24; i++) {
    const s = new THREE.Mesh(new THREE.PlaneGeometry(180 * rs, 180 * rs), new THREE.MeshBasicMaterial({ map: glintTex(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    s.position.set((R() - 0.5) * 26000 * rs, (R() - 0.5) * 12000 * rs, -8800 * rs); bg.add(s); glints.push(s);
  }

  // --- main island: faceted crystal rock traced from the collision walls/ceilings
  const main = d.groups[0].floors.find(f => !f.pass);
  const outline = [...main.pts.map(p => [p[0], p[1] - 110]), [1865, -444], [1418, -493], [1392, -961], [-1500, -870]];
  const body = facetPrism(outline, 900, rs, () => ROCK[Math.floor(R() * ROCK.length)], { bevel: 60 });
  root.add(body);
  // extra jutting rock facets on the front and underside
  for (const [x, y, z, s, rz] of [[-1150, -500, 380, 420, 0.4], [-300, -820, 300, 380, -0.3], [600, -880, 350, 420, 0.2], [1650, -380, 320, 300, -0.5], [1100, -650, 420, 360, 0.1], [-700, -300, 470, 300, 0.7]]) {
    const ge = paintFaces(new THREE.OctahedronGeometry(s * rs, 0), () => ROCK[Math.floor(R() * ROCK.length)]);
    const m = new THREE.Mesh(ge, vcMat()); m.position.set(x * rs, y * rs, z * rs); m.scale.set(1.4, 0.8, 0.6); m.rotation.z = rz; root.add(m);
  }
  // hanging lattice under the island
  root.add(truss(-200, -1060, 900, 200, 0, 0x7a2018, rs, { cell: 200 }));
  // walkway: riveted green girder strip on the floor polyline
  const walk = floorMesh(main, 90, 760, 0x5c7a58, 0x3a5040, rs); root.add(walk);
  const railTex = tex(128, 32, (c, w, h) => { c.fillStyle = '#4a6450'; c.fillRect(0, 0, w, h); c.fillStyle = '#2a3a30'; c.fillRect(0, h - 6, w, 6); c.fillRect(0, 0, w, 3);
    c.fillStyle = '#9ab89a'; for (let x = 8; x < w; x += 32) { c.beginPath(); c.arc(x, h / 2, 3, 0, 7); c.fill(); } c.fillStyle = '#c0d8b0'; c.fillRect(0, 4, w, 2); }, { repeat: [1, 1] });
  for (let i = 0; i < main.pts.length - 1; i++) {
    const [a, b] = [main.pts[i], main.pts[i + 1]];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const t2 = railTex.clone(); t2.needsUpdate = true; t2.wrapS = THREE.RepeatWrapping; t2.repeat.set(len / 300, 1);
    const p = new THREE.Mesh(new THREE.PlaneGeometry(len * rs, 90 * rs), new THREE.MeshLambertMaterial({ map: t2 }));
    p.position.set((a[0] + b[0]) / 2 * rs, ((a[1] + b[1]) / 2 - 45) * rs, 381 * rs); p.rotation.z = Math.atan2(b[1] - a[1], b[0] - a[0]);
    root.add(p);
    // plank seams on top
    for (let s = 150; s < len; s += 300) {
      const k = s / len, x = a[0] + (b[0] - a[0]) * k, y = a[1] + (b[1] - a[1]) * k;
      const seam = new THREE.Mesh(new THREE.BoxGeometry(12 * rs, 4 * rs, 760 * rs), new THREE.MeshLambertMaterial({ color: 0x2c4030 }));
      seam.position.set(x * rs, (y + 1) * rs, 0); seam.rotation.z = p.rotation.z; root.add(seam);
    }
  }
  // soft platform: yellow girder with red zig-zag truss underneath
  const soft = d.groups[0].floors.find(f => f.pass);
  root.add(floorMesh(soft, 50, 300, 0xf0e070, 0xc8b840, rs));
  root.add(truss(0, 948 - 50 - 110, 1224, 220, 0, 0x8a2a1a, rs, { zig: true, cell: 200, t: 36 }));
  // red lattice frames on the walkway (behind the fighters)
  root.add(truss(-1050, 120, 520, 260, -320, 0x5a2018, rs, { cell: 260 }));
  root.add(truss(1520, 380, 560, 340, -320, 0x5a2018, rs, { cell: 280 }));
  root.add(truss(-450, 920, 1500, 120, -200, 0x6a2018, rs, { cell: 300, t: 24 }));
  // big pale crystals rising behind the platform
  for (const [x, y, z, r, h, rz] of [[-950, -200, -380, 200, 1800, 0.6], [700, -150, -380, 170, 1500, -0.5], [-80, -100, -420, 150, 1100, -0.1], [1750, 0, -300, 120, 800, -0.6], [-1350, -300, -250, 110, 900, 0.9]]) {
    const cr = crystal(r * rs, h * rs, CRYS, R, { seg: 5 }); cr.position.set(x * rs, y * rs, z * rs); cr.rotation.order = 'ZYX'; cr.rotation.z = rz; cr.rotation.y = R() * 2; root.add(cr);   // spin about its own axis, then lean sideways only (never toward the camera)
  }
  // small crystal spikes poking out of the walkway edge (decor, outside the fighter plane)
  for (const [x, z] of [[-300, 420], [1200, 430], [-1300, 420]]) { const cr = crystal(60 * rs, 260 * rs, CRYS, R, { seg: 4 }); const y = floorAt(main, x); cr.position.set(x * rs, (y - 60) * rs, z * rs); root.add(cr); }
  return { root, background: bg, glints };
}

function floorAt(f, x) { const p = f.pts; for (let i = 0; i < p.length - 1; i++) if (x >= p[i][0] && x <= p[i + 1][0]) return p[i][1] + (p[i + 1][1] - p[i][1]) * (x - p[i][0]) / (p[i + 1][0] - p[i][0]); return 0; }

let _glint = null;
function glintTex() {
  return _glint ??= tex(64, 64, (c, w, h) => {
    const g = c.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.25, 'rgba(160,220,255,0.6)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g; c.fillRect(0, 0, w, h); c.fillStyle = 'rgba(255,255,255,0.9)'; c.fillRect(30, 0, 4, 64); c.fillRect(0, 30, 64, 4);
  });
}
