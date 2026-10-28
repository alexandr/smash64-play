// Race to the Finish visuals: metal maze slabs from the collision, paneled back walls with green circuit
// strips (black/green bumper hall, black/red last hall), elevator floor indicators, start/finish
// spotlights, barrel bombs, bumpers and explosions.
import * as THREE from 'three';
import { tex, rng } from './final_kit.js';
import { BARREL } from './race.js';

// Solid regions traced from the collision walls/floors/ceilings (game units).
const RECTS = [
  [-8400, -7200, -8400, 8400], [6900, 8100, -8400, 8400], [-8400, 8100, 7200, 8400], [-8400, 8100, -8400, -7200],   // outer box
  [-7200, 4800, 4350, 4650], [-3750, -2550, 3900, 4350], [4500, 4800, 4650, 5550],                                   // corridor 1 slab, hatch, pillar
  [-7200, 4800, -1500, -1200], [-3600, 3000, -1800, -1500], [-1350, 1500, -2100, -1800], [4500, 4800, -1200, -300], // corridor 3 slab (stepped), pillar
  [-5100, 6900, -4200, -3900], [-5100, -4800, -3900, -3000],                                                        // corridor 4 slab, pillar
];
const SLOPE = [[-4800, 2400], [6900, 1814], [6900, 1507], [-4800, 2100]];
const FRONT = 450, BACK = 900;   // slabs span z -BACK..FRONT

function slabTex(R) {
  return tex(256, 64, (c, w, h) => {
    c.fillStyle = '#5a5a72'; c.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 64) {
      const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#7a7a94'); g.addColorStop(0.15, '#5e5e78'); g.addColorStop(1, '#3c3c52');
      c.fillStyle = g; c.fillRect(x + 2, 2, 60, h - 4);
      c.fillStyle = '#1a1a26'; c.fillRect(x + 18, h * 0.5 - 4, 28, 8);
      c.fillStyle = '#30e0b0'; c.fillRect(x + 20, h * 0.5 - 2, 24, 4);
    }
    c.fillStyle = '#22222e'; for (let x = 0; x < w; x += 64) c.fillRect(x, 0, 2, h);
  });
}
function wallTex(R, kind) {
  return tex(512, 512, (c, w, h) => {
    const dark = kind === 'plain';
    c.fillStyle = dark ? '#34344a' : '#06080a'; c.fillRect(0, 0, w, h);
    if (dark) {
      for (let y = 0; y < h; y += 64) for (let x = (y / 64 % 2) * 32; x < w; x += 128) {
        c.fillStyle = ['#3c3c54', '#303044', '#38384e'][((x + y) / 32 | 0) % 3]; c.fillRect(x + 2, y + 2, 124, 60);
        c.fillStyle = '#26263a'; c.fillRect(x + 6, y + 50, 116, 4);
        if (R() < 0.15) { c.fillStyle = '#28c8a0'; c.fillRect(x + 10 + R() * 90, y + 12 + R() * 30, 4, 10); }
      }
    } else {
      // circuit board: right-angle traces + pads
      const col = kind === 'red' ? '#d01818' : '#18b878';
      c.strokeStyle = col; c.lineWidth = 3;
      for (let i = 0; i < 60; i++) { let x = R() * w, y = R() * h; c.beginPath(); c.moveTo(x, y);
        for (let k = 0; k < 5; k++) { if (k % 2) x += (R() - 0.5) * 160; else y += (R() - 0.5) * 160; c.lineTo(x, y); } c.stroke();
        c.fillStyle = col; c.fillRect(x - 4, y - 4, 8, 8); }
    }
  }, { repeat: [1, 1] });
}
function stripTex(R) {
  return tex(512, 32, (c, w, h) => {
    c.fillStyle = '#0a0c10'; c.fillRect(0, 0, w, h);
    c.fillStyle = '#20d0a0';
    for (let x = 0; x < w;) { const len = 4 + R() * 30; if (R() < 0.7) c.fillRect(x, 8 + (R() < 0.5 ? 0 : 10), len, 4); x += len + 3; }
    for (let x = 0; x < w; x += 6) if (R() < 0.3) c.fillRect(x, 14 + (R() - 0.5) * 12, 3, 3);
    c.fillStyle = '#e0e0f0'; for (let x = 0; x < w; x += 64) if (R() < 0.3) c.fillRect(x, 13, 6, 6);
  });
}
function digitTex(n) {
  return tex(64, 96, (c, w, h) => {
    c.fillStyle = '#0c0408'; c.fillRect(0, 0, w, h); c.strokeStyle = '#402030'; c.lineWidth = 4; c.strokeRect(2, 2, w - 4, h - 4);
    c.fillStyle = '#ff2020'; c.font = 'bold 64px monospace'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(String(n), w / 2, h / 2 + 2);
  });
}

function rectMesh(x1, x2, y1, y2, rs, mats, z1 = -BACK, z2 = FRONT, slabMap) {
  const geo = new THREE.BoxGeometry((x2 - x1) * rs, (y2 - y1) * rs, (z2 - z1) * rs);
  if (slabMap) { // front face UVs repeat every 600 x 300 units
    const uv = geo.attributes.uv; for (let i = 16; i < 20; i++) uv.setXY(i, uv.getX(i) * (x2 - x1) / 600, uv.getY(i) * Math.max(1, (y2 - y1) / 300));
  }
  const m = new THREE.Mesh(geo, mats);
  m.position.set((x1 + x2) / 2 * rs, (y1 + y2) / 2 * rs, (z1 + z2) / 2 * rs);
  return m;
}

export function buildRace(scene, rs, d, st) {
  const R = rng(31);
  const root = new THREE.Group(); scene.add(root);
  const sT = slabTex(R); sT.wrapS = sT.wrapT = THREE.RepeatWrapping;
  const front = new THREE.MeshLambertMaterial({ map: sT });
  const top = new THREE.MeshLambertMaterial({ color: 0x8a8aa4 }), side = new THREE.MeshLambertMaterial({ color: 0x4a4a62 }), under = new THREE.MeshLambertMaterial({ color: 0x2a2a3a });
  const boxMats = [side, side, top, under, front, side];   // +x -x +y -y +z -z
  for (const [x1, x2, y1, y2] of RECTS) root.add(rectMesh(x1, x2, y1, y2, rs, boxMats, -BACK, FRONT, true));
  // sloped slab
  const shape = new THREE.Shape(SLOPE.map(([x, y]) => new THREE.Vector2(x * rs, y * rs)));
  const sg = new THREE.ExtrudeGeometry(shape, { depth: (BACK + FRONT) * rs, bevelEnabled: false }); sg.translate(0, 0, -BACK * rs);
  { const uv = sg.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / (600 * rs), uv.getY(i) / (300 * rs)); }
  root.add(new THREE.Mesh(sg, [front, top]));
  // back walls per hall
  const plain = wallTex(R, 'plain'); plain.wrapS = plain.wrapT = THREE.RepeatWrapping; plain.repeat.set(16, 18);
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(14100 * rs, 14400 * rs), new THREE.MeshLambertMaterial({ map: plain }));
  wall.position.set(-150 * rs, 0, -BACK * rs); root.add(wall);
  const green = wallTex(R, 'green'), red = wallTex(R, 'red');
  green.wrapS = red.wrapS = THREE.RepeatWrapping; green.repeat.set(3, 1); red.repeat.set(3, 1);
  const g1 = new THREE.Mesh(new THREE.PlaneGeometry(7500 * rs, 2100 * rs), new THREE.MeshBasicMaterial({ map: green })); g1.position.set(-1050 * rs, -2850 * rs, (-BACK + 5) * rs); root.add(g1);
  const r1 = new THREE.Mesh(new THREE.PlaneGeometry(7500 * rs, 3000 * rs), new THREE.MeshBasicMaterial({ map: red })); r1.position.set(-1050 * rs, -5700 * rs, (-BACK + 5) * rs); root.add(r1);
  // circuit strips with glowing nodes along each hall
  const strip = stripTex(R); strip.wrapS = THREE.RepeatWrapping;
  for (const [x1, x2, y] of [[-7200, 4500, 5500], [-4800, 6900, 3200], [-7200, 4500, 400], [-5100, 6900, -2900], [-7200, 6900, -6500]]) {
    const t2 = strip.clone(); t2.needsUpdate = true; t2.wrapS = THREE.RepeatWrapping; t2.repeat.set((x2 - x1) / 2400, 1);
    const s = new THREE.Mesh(new THREE.PlaneGeometry((x2 - x1) * rs, 160 * rs), new THREE.MeshBasicMaterial({ map: t2 }));
    s.position.set((x1 + x2) / 2 * rs, y * rs, (-BACK + 10) * rs); root.add(s);
    for (const nx of [x1 + 300, x2 - 300]) { const n = new THREE.Mesh(new THREE.SphereGeometry(70 * rs, 8, 6), new THREE.MeshBasicMaterial({ color: 0x60ffd0 })); n.position.set(nx * rs, y * rs, (-BACK + 40) * rs); n.scale.z = 0.4; root.add(n); }
  }
  // elevator floor indicators in the side shafts
  for (const [x, y, n] of [[5850, 6200, 5], [5850, 3600, 4], [5850, 900, 3], [5850, -1800, 2], [-6000, 3400, 4], [-6000, 900, 3], [-6000, -2200, 2], [-6000, -4900, 1]]) {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(300 * rs, 450 * rs), new THREE.MeshBasicMaterial({ map: digitTex(n) })); p.position.set(x * rs, y * rs, (-BACK + 20) * rs); root.add(p);
  }
  // hatch light where barrels drop
  const hatch = new THREE.Mesh(new THREE.BoxGeometry(900 * rs, 30 * rs, 500 * rs), new THREE.MeshBasicMaterial({ color: 0xff3030 })); hatch.position.set(-3150 * rs, 3880 * rs, 0); root.add(hatch);
  // start + finish spotlights
  const cone = (x, yTop, yBot, col, op) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(120 * rs, 700 * rs, (yTop - yBot) * rs, 16, 1, true), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: op, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
    m.position.set(x * rs, (yTop + yBot) / 2 * rs, -200 * rs); root.add(m); return m;
  };
  cone(-6000, 7200, 4650, 0xfff8e0, 0.07);
  const finCone = cone(6170, -4200, -7200, 0xffffff, 0.08);
  const finPad = new THREE.Mesh(new THREE.BoxGeometry(1463 * rs, 12 * rs, (BACK + FRONT) * rs), new THREE.MeshBasicMaterial({ color: 0xf0fff8 }));
  finPad.position.set(6168 * rs, -7194 * rs, (FRONT - BACK) / 2 * rs); root.add(finPad);
  // checkered finish strip on the front edge
  const chk = tex(128, 16, (c, w, h) => { for (let x = 0; x < w; x += 8) for (let y = 0; y < h; y += 8) { c.fillStyle = ((x + y) / 8) % 2 ? '#101010' : '#f8f8f8'; c.fillRect(x, y, 8, 8); } });
  const fl = new THREE.Mesh(new THREE.PlaneGeometry(1463 * rs, 140 * rs), new THREE.MeshBasicMaterial({ map: chk })); fl.position.set(6168 * rs, -7270 * rs, (FRONT + 2) * rs); root.add(fl);
  // bumpers: gold discs with dark rings, facing the camera
  const bumpers = st.bumpers.map(() => {
    const g = new THREE.Group();
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(125 * rs, 125 * rs, 90 * rs, 16), [new THREE.MeshLambertMaterial({ color: 0xc89020 }), new THREE.MeshLambertMaterial({ color: 0xf0c040, emissive: 0x403000 }), new THREE.MeshLambertMaterial({ color: 0xf0c040 })]);
    disc.rotation.x = Math.PI / 2; g.add(disc);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(80 * rs, 14 * rs, 6, 16), new THREE.MeshLambertMaterial({ color: 0x603010 })); ring.position.z = 46 * rs; g.add(ring);
    const glow = new THREE.Mesh(new THREE.CircleGeometry(260 * rs, 16), new THREE.MeshBasicMaterial({ color: 0xffc040, transparent: true, opacity: 0.18, depthWrite: false, blending: THREE.AdditiveBlending })); glow.position.z = -60 * rs; g.add(glow);
    root.add(g); return g;
  });
  return { root, bumpers, barrels: new Map(), finCone, scene };
}

function barrelMesh(rs) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(BARREL.r * 0.92 * rs, BARREL.r * 0.92 * rs, 260 * rs, 10), [new THREE.MeshLambertMaterial({ color: 0x8a4a1c }), new THREE.MeshLambertMaterial({ color: 0xb06a30 }), new THREE.MeshLambertMaterial({ color: 0xb06a30 })]);
  body.rotation.x = Math.PI / 2; g.add(body);
  const belly = new THREE.Mesh(new THREE.CylinderGeometry(BARREL.r * rs, BARREL.r * rs, 120 * rs, 10), new THREE.MeshLambertMaterial({ color: 0x9a5422 })); belly.rotation.x = Math.PI / 2; g.add(belly);
  for (const z of [-100, 100]) { const band = new THREE.Mesh(new THREE.TorusGeometry(BARREL.r * 0.94 * rs, 12 * rs, 4, 10), new THREE.MeshLambertMaterial({ color: 0x303038 })); band.position.z = z * rs; g.add(band); }
  const mark = new THREE.Mesh(new THREE.BoxGeometry(30 * rs, 150 * rs, 4 * rs), new THREE.MeshBasicMaterial({ color: 0xff3020 })); mark.position.z = 132 * rs; g.add(mark);
  const boom = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffa020, transparent: true, opacity: 0.85, depthWrite: false }));
  boom.visible = false; g.add(boom); g.userData.boom = boom; g.userData.parts = [body, belly, mark, ...g.children.filter(c => c.geometry?.type === 'TorusGeometry')];
  return g;
}

export function syncRace(obj, m, rs, st) {
  if (!obj) return;
  st.bumpers.forEach((b, i) => { const g = obj.bumpers[i]; g.position.set(b.x * rs, b.y * rs, 0); const s = 1 + (b.squash > 0 ? Math.sin(b.squash) * 0.25 : 0); g.scale.set(s, s, 1); });
  const seen = new Set();
  for (const b of st.barrels) {
    seen.add(b);
    let g = obj.barrels.get(b);
    if (!g) { g = barrelMesh(rs); obj.root.add(g); obj.barrels.set(b, g); }
    g.position.set(b.x * rs, (b.y + BARREL.r) * rs, 0);
    if (b.state === 'boom') {
      g.userData.parts.forEach(p => { p.visible = false; });
      const bm = g.userData.boom; bm.visible = true; const k = Math.min(1, b.boomT / 14);
      bm.scale.setScalar((120 + 300 * k) * rs); bm.material.opacity = 0.9 * (1 - k); bm.material.color.setHex(k < 0.3 ? 0xfff0a0 : 0xff7020);
    } else g.rotation.z = b.rot;
  }
  for (const [b, g] of obj.barrels) if (!seen.has(b)) { obj.root.remove(g); obj.barrels.delete(b); }
  obj.finCone.material.opacity = st.finished ? 0.16 + 0.08 * Math.sin(m.frame * 0.3) : 0.07 + 0.02 * Math.sin(m.frame * 0.05);
}
