// Visuals for the Break the Targets / Board the Platforms stages: per-character material families
// (SmashWiki: Mario/DK girders, Luigi Mario Bros. arcade, Yoshi/Pikachu/Jigglypuff light blocks with
// grass, Samus/Falcon/Fox grey-brown metal, Link/Kirby/Ness orange bricks), dark blue mosaic backdrop,
// red/white targets, yellow boardable platforms with red -> blue lamps. Solids are traced from collision.
import * as THREE from 'three';
import { canvasTex } from './common.js';
import { groupSolids, DAMAGING_FLOORS } from './bonus_common.js';

export const FAMILY = {
  mario: 'girder', donkey_kong: 'girder', luigi: 'arcade', yoshi: 'grass', pikachu: 'grass', jigglypuff: 'grass',
  samus: 'metal', captain_falcon: 'metal', fox: 'metal', link: 'brick', kirby: 'brick', ness: 'brick',
};

const DEPTH = 600;          // z depth of solid blocks (game units)
const PLAT_DEPTH = 360;     // pass-through platforms

// ---------- textures (world-space tiling) ----------
const texCache = new Map();
function tiled(key, px, draw, tileUnits, rs, o = {}) {
  const k = key + ':' + tileUnits + ':' + rs;
  if (texCache.has(k)) return texCache.get(k);
  const t = canvasTex(px, px, draw);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(1 / (tileUnits * rs), 1 / (tileUnits * rs));
  if (o.nearest) { t.magFilter = THREE.NearestFilter; }
  texCache.set(k, t);
  return t;
}
function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

const TEX = {
  lattice: (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.strokeStyle = '#9a1414'; g.lineWidth = w * 0.09; g.lineCap = 'butt';
    g.beginPath(); g.moveTo(0, 0); g.lineTo(w, h); g.moveTo(w, 0); g.lineTo(0, h); g.stroke();
    g.strokeStyle = '#c42020'; g.lineWidth = w * 0.04;
    g.beginPath(); g.moveTo(0, 0); g.lineTo(w, h); g.moveTo(w, 0); g.lineTo(0, h); g.stroke();
    g.fillStyle = '#b81818'; g.fillRect(0, 0, w * 0.07, h); g.fillRect(w * 0.93, 0, w * 0.07, h);
    g.fillStyle = '#ff9070'; for (const [x, y] of [[0.5, 0.5], [0.12, 0.12], [0.88, 0.88], [0.12, 0.88], [0.88, 0.12]]) { g.beginPath(); g.arc(x * w, y * h, w * 0.025, 0, 7); g.fill(); }
  },
  girderSide: (g, w, h) => {
    g.fillStyle = '#d82424'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#ee4a3a'; g.fillRect(0, 0, w, h * 0.12);
    g.fillStyle = '#a81818'; g.fillRect(0, h * 0.88, w, h * 0.12);
  },
  arcade: (g, w, h) => {
    g.fillStyle = '#1434c0'; g.fillRect(0, 0, w, h);
    const n = 2, s = w / n;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const x = i * s, y = j * s, c = s / 2, m = s * 0.08;
      g.fillStyle = '#6ea8ff'; g.beginPath(); g.moveTo(x + m, y + m); g.lineTo(x + s - m, y + m); g.lineTo(x + m, y + s - m); g.fill();
      g.fillStyle = '#0a1a78'; g.beginPath(); g.moveTo(x + s - m, y + m); g.lineTo(x + s - m, y + s - m); g.lineTo(x + m, y + s - m); g.fill();
      g.fillStyle = '#2f62f0'; g.beginPath(); g.moveTo(x + c, y + s * 0.22); g.lineTo(x + s * 0.78, y + c); g.lineTo(x + c, y + s * 0.78); g.lineTo(x + s * 0.22, y + c); g.fill();
    }
  },
  hazard: (g, w, h) => {
    g.fillStyle = '#f0a018'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#141008';
    for (let i = -2; i < 4; i++) { g.beginPath(); g.moveTo(i * w / 2, 0); g.lineTo(i * w / 2 + w / 4, 0); g.lineTo(i * w / 2 + w / 4 + h, h); g.lineTo(i * w / 2 + h, h); g.fill(); }
  },
  grass: (g, w, h) => {
    g.fillStyle = '#f2dca4'; g.fillRect(0, 0, w, h);
    const r = rng(7);
    for (let i = 0; i < 3; i++) { g.fillStyle = '#d8b070'; g.fillRect(0, h * (i / 3 + 0.2), w, h * 0.09); g.fillStyle = '#e8c88a'; g.fillRect(0, h * (i / 3 + 0.29), w, h * 0.04); }
    for (let i = 0; i < 60; i++) { g.fillStyle = `rgba(160,110,50,${0.15 + r() * 0.2})`; g.fillRect(r() * w, r() * h, 2, 2); }
  },
  grassTop: (g, w, h) => {
    g.fillStyle = '#4cc83c'; g.fillRect(0, 0, w, h);
    const r = rng(3);
    for (let i = 0; i < 90; i++) { g.fillStyle = r() < 0.5 ? '#6ee04e' : '#38a830'; g.fillRect(r() * w, r() * h, 3, 5); }
  },
  metal: (g, w, h) => {
    g.fillStyle = '#857a72'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#a49a90'; g.fillRect(0, 0, w, h * 0.06); g.fillRect(0, 0, w * 0.06, h);
    g.fillStyle = '#5a504a'; g.fillRect(0, h * 0.94, w, h * 0.06); g.fillRect(w * 0.94, 0, w * 0.06, h);
    g.fillStyle = '#3a302c'; g.beginPath(); g.arc(w / 2, h / 2, w * 0.2, 0, 7); g.fill();
    g.fillStyle = '#bdb2a8'; g.beginPath(); g.arc(w / 2, h / 2, w * 0.2, Math.PI * 0.8, Math.PI * 1.8); g.lineWidth = w * 0.03; g.strokeStyle = '#c8bcb2'; g.stroke();
    g.fillStyle = '#ff8a20'; g.beginPath(); g.arc(w / 2, h / 2, w * 0.08, 0, 7); g.fill();
  },
  metalTop: (g, w, h) => {
    g.fillStyle = '#9a9088'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#7a7068'; g.fillRect(0, h * 0.94, w, h * 0.06); g.fillRect(w * 0.94, 0, w * 0.06, h);
    g.fillStyle = '#ff9a28'; g.fillRect(w * 0.38, h * 0.4, w * 0.24, h * 0.2);
  },
  plate: (g, w, h) => {
    g.fillStyle = '#d8d8d4'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#a8a8a4'; g.fillRect(0, h * 0.85, w, h * 0.15);
    g.fillStyle = '#ff9020'; g.fillRect(w * 0.35, h * 0.35, w * 0.3, h * 0.25);
  },
  brick: (g, w, h) => {
    g.fillStyle = '#e4a448'; g.fillRect(0, 0, w, h);
    const r = rng(11);
    for (let i = 0; i < 260; i++) { g.fillStyle = r() < 0.5 ? 'rgba(176,96,30,0.55)' : 'rgba(255,214,140,0.55)'; g.fillRect(r() * w, r() * h, 2 + r() * 3, 2 + r() * 3); }
    g.fillStyle = 'rgba(150,80,24,0.55)';
    g.fillRect(0, h / 2 - 1, w, 3); g.fillRect(0, h - 3, w, 3);
    g.fillRect(w / 2 - 1, 0, 3, h / 2); g.fillRect(0, h / 2, 3, h / 2);
  },
};

// family styles: cap = front texture key, top/wall/bottom vertex colors (multiplied with sideTex)
const STYLE = {
  girder: { cap: 'lattice', capAlpha: true, side: 'girderSide', top: 0xffffff, wall: 0xf0f0f0, bottom: 0xb0b0b0, tile: 300, sideTile: 300, rails: 0xde2a26,
    plat: { tex: 'girderSide', color: 0xffffff } },
  arcade: { cap: 'arcade', side: 'arcade', top: 0xffffff, wall: 0xc8d0ff, bottom: 0x8090c0, tile: 300, sideTile: 300, plat: { tex: 'hazard', color: 0xffffff } },
  grass: { cap: 'grass', side: 'grass', top: 0xffffff, wall: 0xf0f0f0, bottom: 0xb8b0a0, tile: 300, sideTile: 300, topTex: 'grassTop', trim: true, plat: { tex: 'grass', color: 0xffffff, trim: true } },
  metal: { cap: 'metal', side: 'metalTop', top: 0xffffff, wall: 0xd8d8d8, bottom: 0x989898, tile: 150, sideTile: 150, plat: { tex: 'plate', color: 0xffffff } },
  brick: { cap: 'brick', side: 'brick', top: 0xfff4e0, wall: 0xe8e0d0, bottom: 0xb0a090, tile: 150, sideTile: 150, plat: { tex: 'brick', color: 0xffffff } },
};

function texFor(key, tile, rs) { return tiled(key, 128, TEX[key], tile, rs, { nearest: key === 'hazard' }); }

// paint per-vertex colors by face orientation (caps white so their texture shows unmodified)
function colorByNormal(geo, top, wall, bottom) {
  const n = geo.attributes.normal, cnt = n.count, col = new Float32Array(cnt * 3);
  const T = new THREE.Color(top), W = new THREE.Color(wall), B = new THREE.Color(bottom), Wh = new THREE.Color(0xffffff);
  for (let i = 0; i < cnt; i++) {
    const ny = n.getY(i), nz = n.getZ(i);
    const c = Math.abs(nz) > 0.9 ? Wh : ny > 0.45 ? T : ny < -0.45 ? B : W;
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
}

function extrudeLoop(loop, depth, rs) {
  const shape = new THREE.Shape();
  shape.moveTo(loop[0][0] * rs, loop[0][1] * rs);
  for (let i = 1; i < loop.length; i++) shape.lineTo(loop[i][0] * rs, loop[i][1] * rs);
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, { depth: depth * rs, bevelEnabled: false });
  geo.translate(0, 0, -depth * rs / 2);
  geo.computeVertexNormals();
  return geo;
}

function bbox(loop) {
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const [x, y] of loop) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  return { x0, x1, y0, y1, w: x1 - x0, h: y1 - y0 };
}

function makeMaterials(fam, rs, override) {
  const s = STYLE[fam];
  const capKey = override ?? s.cap, sideKey = override ?? s.side;
  const capTex = texFor(capKey, s.tile, rs), sideTex = texFor(sideKey, s.sideTile, rs);
  const cap = new THREE.MeshLambertMaterial({ map: capTex, vertexColors: true, side: s.capAlpha && !override ? THREE.DoubleSide : THREE.FrontSide,
    alphaTest: s.capAlpha && !override ? 0.5 : 0, transparent: false });
  const side = new THREE.MeshLambertMaterial({ map: sideTex, vertexColors: true });
  return [cap, side];
}

// Solid blocks of one collision group (coordinates local to the group)
function buildGroupSolids(parent, g, fam, rs, charKey) {
  const s = STYLE[fam];
  const { loops, beams } = groupSolids(g);
  // boardable platform blocks: the yellow disc (built separately) takes the top 100 u of the block
  const isDetect = g.floors.some(f => f.material === 'detect');
  for (let loop of [...loops, ...beams]) {
    if (isDetect) loop = loop.map(([x, y]) => [x, Math.min(y, -100)]);
    const bb = bbox(loop);
    // Luigi's stages: moving blocks are orange/black hazard-striped
    const hazardPillar = fam === 'arcade' && g.moving && !g.floors.some(f => f.material === 'detect');
    const geo = extrudeLoop(loop, DEPTH, rs);
    colorByNormal(geo, s.top, s.wall, s.bottom);
    const mesh = new THREE.Mesh(geo, makeMaterials(fam, rs, hazardPillar ? 'hazard' : null));
    parent.add(mesh);
    if (s.rails) addRails(parent, loop, rs, s.rails);
  }
  // grass caps on top of every walkable solid floor
  if (s.trim) for (const f of g.floors) if (!f.pass && f.material !== 'detect') addTrim(parent, f.pts, rs, 70, DEPTH + 40);
  // pass-through platforms
  for (const f of g.floors) if (f.pass) addPassPlatform(parent, f.pts, fam, rs);
  // damaging floors
  for (const f of g.floors) if (DAMAGING_FLOORS[f.material]) addDamageStrip(parent, f.pts, f.material, rs);
}

function addRails(parent, loop, rs, color) {
  const m = new THREE.MeshLambertMaterial({ color });
  const th = 55;
  for (let i = 0; i < loop.length; i++) {
    const a = loop[i], b = loop[(i + 1) % loop.length];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]); if (len < 1) continue;
    for (const z of [DEPTH / 2, -DEPTH / 2]) {
      const box = new THREE.Mesh(new THREE.BoxGeometry((len + th) * rs, th * rs, th * rs), m);
      box.position.set((a[0] + b[0]) / 2 * rs, (a[1] + b[1]) / 2 * rs, z * rs);
      box.rotation.z = Math.atan2(b[1] - a[1], b[0] - a[0]);
      parent.add(box);
    }
  }
}

// thin slab following a polyline, top at the line
function stripGeo(pts, thick, depth, rs) {
  const shape = new THREE.Shape();
  shape.moveTo(pts[0][0] * rs, pts[0][1] * rs);
  for (let i = 1; i < pts.length; i++) shape.lineTo(pts[i][0] * rs, pts[i][1] * rs);
  for (let i = pts.length - 1; i >= 0; i--) shape.lineTo(pts[i][0] * rs, (pts[i][1] - thick) * rs);
  const geo = new THREE.ExtrudeGeometry(shape, { depth: depth * rs, bevelEnabled: false });
  geo.translate(0, 0, -depth * rs / 2);
  geo.computeVertexNormals();
  return geo;
}
function addTrim(parent, pts, rs, thick, depth) {
  const t = texFor('grassTop', 150, rs);
  const geo = stripGeo(pts.map(p => [p[0], p[1] + 4]), thick, depth, rs);
  colorByNormal(geo, 0xffffff, 0xe8ffe0, 0x80a070);
  parent.add(new THREE.Mesh(geo, [new THREE.MeshLambertMaterial({ map: t, vertexColors: true }), new THREE.MeshLambertMaterial({ map: t, vertexColors: true })]));
}
function addPassPlatform(parent, pts, fam, rs) {
  const s = STYLE[fam].plat;
  const tex = texFor(s.tex, s.tex === 'plate' ? 150 : 150, rs);
  const geo = stripGeo(pts, 60, PLAT_DEPTH, rs);
  colorByNormal(geo, 0xffffff, 0xe0e0e0, 0xa0a0a0);
  const m = new THREE.MeshLambertMaterial({ map: tex, vertexColors: true });
  parent.add(new THREE.Mesh(geo, [m, m]));
  if (s.trim) addTrim(parent, pts, rs, 30, PLAT_DEPTH + 30);
}

// flame / spike strips on damaging floors
function flameTexture() {
  const c = document.createElement('canvas'); c.width = 128; c.height = 64;
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.RepeatWrapping;
  t.userData = { c, draw(time) {
    const g = c.getContext('2d'); g.clearRect(0, 0, 128, 64);
    const gr = g.createLinearGradient(0, 64, 0, 0); gr.addColorStop(0, '#fff8c0'); gr.addColorStop(0.4, '#ffc030'); gr.addColorStop(1, 'rgba(255,80,0,0)');
    g.fillStyle = gr; g.fillRect(0, 34, 128, 30);
    for (let i = 0; i < 8; i++) {
      const x = i * 16 + 8, hgt = 30 + 26 * Math.abs(Math.sin(time * 0.21 + i * 1.7));
      g.beginPath(); g.moveTo(x - 10, 64); g.quadraticCurveTo(x - 6, 64 - hgt * 0.6, x + Math.sin(time * 0.3 + i) * 4, 64 - hgt); g.quadraticCurveTo(x + 6, 64 - hgt * 0.6, x + 10, 64); g.fill();
    }
    t.needsUpdate = true;
  } };
  t.userData.draw(0);
  return t;
}
function addDamageStrip(parent, pts, material, rs) {
  if (material === 'spikes') {
    const m = new THREE.MeshLambertMaterial({ color: 0xc8c8d0, flatShading: true });
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1], len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const n = Math.max(1, Math.round(len / 100));
      for (let k = 0; k < n; k++) for (const z of [-150, 0, 150]) {
        const t = (k + 0.5) / n;
        const cone = new THREE.Mesh(new THREE.ConeGeometry(45 * rs, 110 * rs, 4), m);
        cone.position.set((a[0] + (b[0] - a[0]) * t) * rs, ((a[1] + (b[1] - a[1]) * t) + 55) * rs, z * rs);
        parent.add(cone);
      }
    }
    return;
  }
  // hazard-striped beam face under the floor + animated flame sheet above it
  const haz = texFor('hazard', 150, rs);
  const beam = stripGeo(pts, 150, DEPTH + 20, rs);
  colorByNormal(beam, 0xffd040, 0xffffff, 0xffffff);
  parent.add(new THREE.Mesh(beam, [new THREE.MeshLambertMaterial({ map: haz, vertexColors: true }), new THREE.MeshLambertMaterial({ color: 0xffd040, emissive: 0x804000 })]));
  const ft = flameTexture();
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1], len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const tex = ft.clone(); tex.userData = ft.userData; tex.repeat.set(len / 300, 1); tex.needsUpdate = true;
    const mm = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
    for (const z of [DEPTH / 2 + 15, 0, -DEPTH / 4]) {
      const p = new THREE.Mesh(new THREE.PlaneGeometry(len * rs, 220 * rs), mm);
      p.position.set((a[0] + b[0]) / 2 * rs, ((a[1] + b[1]) / 2 + 105) * rs, z * rs);
      p.rotation.z = Math.atan2(b[1] - a[1], b[0] - a[0]);
      parent.add(p);
    }
    parent.userData.flames = (parent.userData.flames ?? []).concat([{ tex: ft, clone: tex }]);
  }
}

// ---------- targets & platforms ----------
let targetTexture = null;
function targetTex() {
  return targetTexture ??= canvasTex(128, 128, (g, w, h) => {
    const cols = ['#e8202a', '#ffffff', '#e8202a', '#ffffff', '#e8202a'];
    cols.forEach((c, i) => { g.fillStyle = c; g.beginPath(); g.arc(w / 2, h / 2, w / 2 * (1 - i * 0.19), 0, 7); g.fill(); });
  });
}
function makeTarget(rs) {
  const g = new THREE.Group();
  const face = new THREE.MeshLambertMaterial({ map: targetTex(), emissive: 0x401010 });
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(105 * rs, 105 * rs, 36 * rs, 20), [new THREE.MeshLambertMaterial({ color: 0xc81820 }), face, face]);
  disc.rotation.x = Math.PI / 2;
  g.add(disc);
  // little stand/peg behind like the N64 target
  const peg = new THREE.Mesh(new THREE.CylinderGeometry(25 * rs, 25 * rs, 120 * rs, 6), new THREE.MeshLambertMaterial({ color: 0xc0c0c0 }));
  peg.rotation.x = Math.PI / 2; peg.position.z = -70 * rs; g.add(peg);
  const shards = [];
  const sm = new THREE.MeshBasicMaterial({ color: 0xff4040 }), sw = new THREE.MeshBasicMaterial({ color: 0xffffff });
  for (let i = 0; i < 10; i++) {
    const s = new THREE.Mesh(new THREE.TetrahedronGeometry(40 * rs), i % 2 ? sm : sw);
    s.visible = false; s.userData.dir = [Math.cos(i * 0.628 + 0.3), Math.sin(i * 0.628 + 0.3)]; g.add(s); shards.push(s);
  }
  const flash = new THREE.Mesh(new THREE.RingGeometry(60 * rs, 120 * rs, 20), new THREE.MeshBasicMaterial({ color: 0xffffa0, transparent: true, side: THREE.DoubleSide, depthWrite: false }));
  flash.visible = false; g.add(flash);
  return { g, disc, peg, shards, flash };
}

function makePlatform(p, rs, hasBlock) {
  const g = new THREE.Group();
  const rx = p.w / 2, rz = Math.min(rx, 450);
  const top = new THREE.Mesh(new THREE.CylinderGeometry(rx * rs, rx * 0.94 * rs, 70 * rs, 8),
    [new THREE.MeshLambertMaterial({ color: 0xffd428, emissive: 0x403000 }), new THREE.MeshLambertMaterial({ color: 0xffe040, emissive: 0x302400 }), new THREE.MeshLambertMaterial({ color: 0xb09020 })]);
  top.rotation.y = Math.PI / 8; top.scale.set(1, 1, rz / rx); top.position.y = -35 * rs;
  g.add(top);
  const under = new THREE.Mesh(new THREE.CylinderGeometry(rx * 0.94 * rs, rx * 0.55 * rs, 70 * rs, 8), new THREE.MeshLambertMaterial({ color: 0xe8e8f0, emissive: 0x303038 }));
  under.rotation.y = Math.PI / 8; under.scale.set(1, 1, rz / rx); under.position.y = -105 * rs;
  g.add(under);
  const lampZ = hasBlock ? (DEPTH / 2 + 60) : 0, lampY = hasBlock ? -110 : -170;
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(70 * rs, 10, 8), new THREE.MeshBasicMaterial({ color: 0xff3020 }));
  lamp.position.set(0, lampY * rs, lampZ * rs); g.add(lamp);
  const glow = new THREE.Mesh(new THREE.SphereGeometry(200 * rs, 12, 8), new THREE.MeshBasicMaterial({ color: 0xff4020, transparent: true, opacity: 0.45, depthWrite: false, blending: THREE.AdditiveBlending }));
  glow.position.copy(lamp.position); g.add(glow);
  return { g, lamp, glow };
}

// ---------- backdrop: dark blue pixel mosaic ----------
function mosaic(g, w, h) {
  g.fillStyle = '#18205c'; g.fillRect(0, 0, w, h);
  const r = rng(1999);
  const cols = ['#1e2a6e', '#1a2462', '#243478', '#1c3a66', '#22225e', '#141a50', '#2a3c7c', '#183458', '#201c56', '#26306e'];
  for (let i = 0; i < 900; i++) {
    const s = 8 + r() * 56, s2 = 8 + r() * 56;
    g.globalAlpha = 0.4 + r() * 0.5; g.fillStyle = cols[Math.floor(r() * cols.length)];
    g.fillRect(Math.floor(r() * w / 4) * 4, Math.floor(r() * h / 4) * 4, Math.round(s / 4) * 4, Math.round(s2 / 4) * 4);
  }
  g.globalAlpha = 1;
}

export function buildBonus(scene, rs, d, st, charKey) {
  const fam = FAMILY[charKey] ?? 'metal';
  const root = new THREE.Group(); scene.add(root);
  const tex = canvasTex(1024, 1024, mosaic); tex.magFilter = THREE.NearestFilter;
  const bg = new THREE.Mesh(new THREE.PlaneGeometry(36000 * rs, 36000 * rs), new THREE.MeshBasicMaterial({ map: tex, depthWrite: false, fog: false }));
  bg.position.set(0, 0, -9000 * rs); bg.renderOrder = -10; scene.add(bg);
  const groups = new Map();
  const detectWalls = new Set();
  for (const g of d.groups) {
    const gg = new THREE.Group(); root.add(gg); groups.set(g.id, gg);
    if (g.moving) gg.position.set((g.base?.[0] ?? 0) * rs, (g.base?.[1] ?? 0) * rs, 0);
    buildGroupSolids(gg, g, fam, rs, charKey);
    if (g.floors.some(f => f.material === 'detect') && g.walls.length) detectWalls.add(g.id);
  }
  const targets = (st.targets ?? []).map(t => { const v = makeTarget(rs); v.g.position.set(t.x * rs, t.y * rs, 0); root.add(v.g); return v; });
  const plats = (st.platforms ?? []).map(p => {
    const v = makePlatform(p, rs, detectWalls.has(p.yak));
    v.g.position.set(p.x * rs, p.y * rs, 0); root.add(v.g); return v;
  });
  const flames = [];
  root.traverse(o => { if (o.userData?.flames) flames.push(...o.userData.flames); });
  return { root, groups, background: bg, targets, plats, flames };
}

export function syncBonus(obj, m, rs, st) {
  if (!obj) return;
  for (const g of m.col.groups) {
    const gg = obj.groups.get(g.id);
    if (gg && g.moving) { gg.position.set(g.ox * rs, g.oy * rs, 0); gg.visible = g.active; }
  }
  // targets
  (st.targets ?? []).forEach((t, i) => {
    const v = obj.targets[i]; if (!v) return;
    v.g.position.set(t.x * rs, t.y * rs, 0);
    if (!t.broken) { v.disc.rotation.z = 0; return; }
    const k = m.frame - t.brokenFrame;
    v.disc.visible = false; v.peg.visible = false;
    const on = k < 30;
    v.flash.visible = k < 8; v.flash.scale.setScalar(1 + k * 0.35); v.flash.material.opacity = Math.max(0, 1 - k / 8);
    for (const s of v.shards) {
      s.visible = on;
      if (on) { const dd = (20 + k * 18) * rs; s.position.set(s.userData.dir[0] * dd, s.userData.dir[1] * dd - k * k * 0.4 * rs, 20 * rs); s.rotation.set(k * 0.3, k * 0.2, 0); }
    }
    if (!on && v.g.parent) v.g.visible = false;
  });
  // platforms
  (st.platforms ?? []).forEach((p, i) => {
    const v = obj.plats[i]; if (!v) return;
    v.g.position.set(p.x * rs, p.y * rs, 0);
    const col = p.boarded ? 0x40a8ff : 0xff3020;
    v.lamp.material.color.setHex(col); v.glow.material.color.setHex(col);
    v.glow.material.opacity = 0.4 + 0.12 * Math.sin(m.frame * 0.15);
  });
  // flames
  if (obj.flames.length && m.frame % 3 === 0) {
    const seen = new Set();
    for (const fl of obj.flames) { if (!seen.has(fl.tex)) { seen.add(fl.tex); fl.tex.userData.draw(m.frame); } fl.clone.needsUpdate = true; }
  }
}
