// Peach's Castle — decomp geometry (reference/spec/stages.md): octagonal castle top, tower with rope bridges
// (pass-through), the sliding stone block (yakumono 2), the two drifting blue wedges (yakumono 3/4) and the
// floating bumper (nITKindGBumper, 1%, angle 361, KBG 50, fixed KB 300 on Castle, size 250 -> r 125).
import * as THREE from 'three';
import { mat, kit } from '../render/rig.js';
import { backdrop, canvasTex, makeStage, prism } from './common.js';
import { paintCastleSky } from './peach_art.js';
import data from './data/peachs_castle.js';

const BUMPER = { x: 0, y: 3525 };
const BUMPER_HB = { damage: 1, angle: 361, kbg: 50, bkb: 0, fkb: 300, element: 'normal', ground: true, air: true };
const BUMPER_R = 125, BUMPER_COOLDOWN = 16;

// Stage root anim (StageCastleFile3): 0 -> -1050 (599 f) -> +1050 (1200 f) -> 0 (600 f), hold 2400 f; period 4799
export function bumperOffset(t) {
  t = ((t % 4799) + 4799) % 4799;
  if (t < 599) return -1050 * t / 599;
  if (t < 1799) return -1050 + 2100 * (t - 599) / 1200;
  if (t < 2399) return 1050 - 1050 * (t - 1799) / 600;
  return 0;
}

export const peach = makeStage(data, {
  id: 'peach', series: 'mario', music: 'peach',
  options: { ambient: 0.75, sun: 1.25, sunDir: [-0.3, 1, 0.9] },
  init(m, st) { st.bumper = { x: BUMPER.x, y: BUMPER.y, cool: new Map(), squash: 0 }; },
  update(m, st) {
    const b = st.bumper;
    b.x = BUMPER.x + bumperOffset(m.frame); b.y = BUMPER.y;
    for (const [f, t] of b.cool) { if (t <= 1) b.cool.delete(f); else b.cool.set(f, t - 1); }
    if (b.squash > 0) b.squash--;
  },
  hazardHitboxes(m, st) {
    const b = st.bumper; if (!b) return [];
    return [{
      hb: BUMPER_HB, x: b.x, y: b.y, r: BUMPER_R, hit: new Set(b.cool.keys()), kind: 'bumper',
      onHit(v) { b.cool.set(v, BUMPER_COOLDOWN); b.squash = 12; m.emit('sfx', { name: 'bump' }); },
    }];
  },
  build(scene, rs, d, st) { return build(scene, rs, d, st); },
  sync(obj, m, rs, st) {
    if (!obj) return;
    for (const g of m.col.groups) { const gg = obj.groups.get(g.id); if (gg && g.moving) gg.position.set(g.ox * rs, g.oy * rs, 0); }
    const b = st.bumper;
    if (b) {
      obj.bumper.position.set(b.x * rs, b.y * rs, 0);
      const k = b.squash > 0 ? 1 + 0.25 * Math.sin(b.squash * 0.9) * (b.squash / 12) : 1;
      obj.bumper.scale.set(k, k, 1);
      obj.bumper.rotation.y = Math.sin(m.frame * 0.02) * 0.25;
    }
    // Lakitu drifts across the sky far behind
    const t = m.frame % 3600;
    obj.lakitu.position.set((-5200 + t * 3) * rs, (4300 + Math.sin(m.frame * 0.03) * 120) * rs, -3500 * rs);
  },
});

const tex = (w, h, draw, rep) => { const t = canvasTex(w, h, draw); t.wrapS = t.wrapT = THREE.RepeatWrapping; if (rep) t.repeat.set(...rep); return t; };
const tmat = (t, o = {}) => new THREE.MeshLambertMaterial({ map: t, ...o });

function bricks(c, w, h, base, mortar, rows, cols, jitter = 18) {
  c.fillStyle = mortar; c.fillRect(0, 0, w, h);
  const bh = h / rows, bw = w / cols;
  for (let r = 0; r < rows; r++) for (let i = -1; i < cols + 1; i++) {
    const x = i * bw + (r % 2 ? bw / 2 : 0), y = r * bh;
    const v = (Math.random() - 0.5) * jitter;
    c.fillStyle = shade(base, v); c.fillRect(x + 2, y + 2, bw - 4, bh - 4);
  }
}
function shade(hex, v) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.min(255, (n >> 16) + v)), g = Math.max(0, Math.min(255, ((n >> 8) & 255) + v)), b = Math.max(0, Math.min(255, (n & 255) + v));
  return `rgb(${r | 0},${g | 0},${b | 0})`;
}

function build(scene, rs, d) {
  const root = new THREE.Group(); scene.add(root);
  const groups = new Map();
  const bg = backdrop(scene, rs, paintCastleSky, { tw: 2048, th: 1024, w: 36000, h: 18000, y: 1500, z: -9000 });
  const O = (x, y, z = 0) => [x * rs, y * rs, z * rs];

  // ---------- castle octagon (x +-1170, y -120..375, top flat 510 within +-620) ----------
  const oct = new THREE.Group(); root.add(oct);
  const C8 = Math.cos(Math.PI / 8), ZS = 0.78;
  const wallTex = tex(512, 128, (c, w, h) => {
    c.fillStyle = '#5b4a2c'; c.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 16) { c.fillStyle = y % 32 ? '#6a5733' : '#57462a'; c.fillRect(0, y, w, 14); }
    // balustrade band on top
    c.fillStyle = '#3a2c18'; c.fillRect(0, 0, w, 46);
    c.fillStyle = '#c9b98e'; c.fillRect(0, 0, w, 8); c.fillRect(0, 40, w, 6);
    for (let x = 6; x < w; x += 32) { c.fillStyle = '#b7a378'; c.fillRect(x, 8, 12, 32); c.fillStyle = '#8f7d55'; c.fillRect(x + 9, 8, 3, 32); }
    c.fillStyle = '#2e2412'; c.fillRect(0, h - 10, w, 10);
  }, [4, 1]);
  // Octagon footprint (flat faces at x = +-1170 and z = +-D); the top follows the collision profile along x
  // (flat 510 within +-620, sloping to 375 at +-1170) so it lines up at every depth.
  const W = 1170, D = 1170 * ZS, T8 = Math.tan(Math.PI / 8);
  const prof = x => Math.abs(x) <= 620 ? 510 : 510 - 135 * (Math.abs(x) - 620) / 550;
  const ring = [[W, -D * T8], [W, D * T8], [W * T8, D], [-W * T8, D], [-W, D * T8], [-W, -D * T8], [-W * T8, -D], [W * T8, -D]];
  // insert the x = +-620 crossings so wall tops and roof pieces bend exactly at the ridge
  const outline = [];
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length]; outline.push(a);
    for (const xc of [620, -620]) if ((a[0] - xc) * (b[0] - xc) < 0) { const t = (xc - a[0]) / (b[0] - a[0]); outline.push([xc, a[1] + (b[1] - a[1]) * t]); }
  }
  // wooden walls from y -120 up to the roof profile
  const wpos = [], wuv = []; let ulen = 0;
  for (let i = 0; i < outline.length; i++) {
    const a = outline[i], b = outline[(i + 1) % outline.length], L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const ya = prof(a[0]), yb = prof(b[0]), u0 = ulen / 600, u1 = (ulen + L) / 600; ulen += L;
    const q = [[a[0], -120, a[1], u0, 0], [b[0], -120, b[1], u1, 0], [b[0], yb, b[1], u1, 1], [a[0], ya, a[1], u0, 1]];
    for (const k of [0, 2, 1, 0, 3, 2]) { wpos.push(q[k][0] * rs, q[k][1] * rs, q[k][2] * rs); wuv.push(q[k][3], q[k][4]); }
  }
  const wg = new THREE.BufferGeometry(); wg.setAttribute('position', new THREE.Float32BufferAttribute(wpos, 3)); wg.setAttribute('uv', new THREE.Float32BufferAttribute(wuv, 2)); wg.computeVertexNormals();
  wallTex.repeat.set(1, 1);
  oct.add(new THREE.Mesh(wg, tmat(wallTex, { side: THREE.DoubleSide })));
  const bottom = new THREE.Mesh(new THREE.ShapeGeometry(new THREE.Shape(ring.map(([x, z]) => new THREE.Vector2(x * rs, z * rs)))), mat(0x2a2014, { side: THREE.DoubleSide }));
  bottom.geometry.rotateX(Math.PI / 2); bottom.position.y = -120 * rs; oct.add(bottom);
  // roof pieces: checkered centre, red tiles on the two sloped sides
  const tileTex = tex(256, 64, (c, w, h) => {
    c.fillStyle = '#b8352a'; c.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 16) { c.fillStyle = '#8a2018'; c.fillRect(x, 0, 3, h); c.fillStyle = '#d65040'; c.fillRect(x + 4, 0, 4, h); }
  }, [1, 1]);
  const checkTex = tex(256, 256, (c, w, h) => {
    const n = 8; for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { c.fillStyle = (i + j) % 2 ? '#202020' : '#f0f0f0'; c.fillRect(i * w / n, j * h / n, w / n, h / n); }
  }, [1, 1]);
  const piece = (pts, m, uvScale) => {
    const sh = new THREE.Shape(pts.map(([x, z]) => new THREE.Vector2(x, z)));
    const g = new THREE.ShapeGeometry(sh); const pos = g.attributes.position, uv = g.attributes.uv;
    const P = [];
    for (let i = 0; i < pos.count; i++) { const x = pos.getX(i), z = pos.getY(i); P.push(x * rs, prof(x) * rs, z * rs); uv.setXY(i, x / uvScale, z / uvScale); }
    g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.computeVertexNormals();
    const mm = new THREE.Mesh(g, m); mm.material.side = THREE.DoubleSide; return mm;
  };
  const inner = outline.filter(p => Math.abs(p[0]) <= 620.5);
  const centre = piece(inner, tmat(checkTex), 1240); centre.position.y = 0.002; oct.add(centre);
  for (const sx of [1, -1]) { const side = outline.filter(p => p[0] * sx >= 619.5); oct.add(piece(side, tmat(tileTex), 260)); }
  // green border strip along the inner edges of the checkered floor
  for (const sx of [1, -1]) oct.add(kit.box(40 * rs, 8 * rs, 1500 * rs, 0x6f8f3a, [sx * 600 * rs, 512 * rs, 0]));
  // railings along the back edges and trees in planters
  const railH = 260;
  for (let k = 0; k < outline.length; k++) {
    const p0 = outline[k], p1 = outline[(k + 1) % outline.length];
    const mz = (p0[1] + p1[1]) / 2; if (mz > 200) continue;     // keep the front open
    const n = Math.max(2, Math.round(Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) / 120));
    for (let i = 0; i <= n; i++) { const x = p0[0] + (p1[0] - p0[0]) * i / n, z = p0[1] + (p1[1] - p0[1]) * i / n; oct.add(kit.cyl(22 * rs, 26 * rs, railH * rs, 0xd8c8a0, O(x * 0.97, prof(x), z * 0.97), { seg: 6 })); }
    const len = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]);
    const rail = kit.box(len * rs, 26 * rs, 40 * rs, 0xe8d6ae, O((p0[0] + p1[0]) / 2 * 0.97, (prof(p0[0]) + prof(p1[0])) / 2 + railH, (p0[1] + p1[1]) / 2 * 0.97));
    rail.rotation.y = -Math.atan2(p1[1] - p0[1], p1[0] - p0[0]); rail.rotation.z = Math.atan2(prof(p1[0]) - prof(p0[0]), len) * Math.cos(rail.rotation.y); oct.add(rail);
  }
  for (const sx of [-1, 1]) {
    const t = new THREE.Group(); t.position.set(sx * 430 * rs, 510 * rs, -470 * rs); oct.add(t);
    t.add(kit.box(150 * rs, 90 * rs, 150 * rs, 0x8a5a2a, [0, 45 * rs, 0]));
    t.add(kit.cyl(20 * rs, 20 * rs, 120 * rs, 0x6a4020, [0, 90 * rs, 0]));
    for (const [x, y, z, r] of [[0, 260, 0, 95], [-60, 200, 20, 70], [60, 200, 20, 70], [0, 340, 0, 70], [-45, 300, -30, 60], [45, 300, 30, 60]])
      t.add(kit.sphere(r * rs, 0x3aa848, [x * rs, y * rs, z * rs], { seg: 6, scale: [1, 1.2, 1] }));
  }
  // sign post
  oct.add(kit.cyl(14 * rs, 14 * rs, 180 * rs, 0x6a4020, O(250, 510, -460)));
  oct.add(kit.box(150 * rs, 90 * rs, 16 * rs, 0x9a6a3a, O(250, 660, -455)));

  // ---------- stone foundation: walls (703,-120) -> (855,-915) ----------
  const stoneTex = tex(256, 256, (c, w, h) => bricks(c, w, h, '#4a4a50', '#26262a', 8, 4, 22), [3, 2]);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(703 / C8 * rs, 855 / C8 * rs, 795 * rs, 8, 1), tmat(stoneTex));
  base.geometry.rotateY(Math.PI / 8); base.scale.z = ZS; base.position.y = (-120 - 795 / 2) * rs; oct.add(base);

  // ---------- tower with roof deck (pass-through, y ~1400) and red spire ----------
  const tw = new THREE.Group(); tw.position.set(0, 0, -330 * rs); root.add(tw);
  const towerTex = tex(256, 256, (c, w, h) => bricks(c, w, h, '#d9d4c6', '#8d877a', 10, 5, 26), [3, 3]);
  tw.add(new THREE.Mesh(new THREE.CylinderGeometry(270 * rs, 290 * rs, 900 * rs, 12).translate(0, 960 * rs, 0), tmat(towerTex)));
  // door + window on the tower front
  tw.add(kit.box(120 * rs, 200 * rs, 20 * rs, 0x3a3a44, O(0, 610, 280)));
  tw.add(kit.box(130 * rs, 150 * rs, 20 * rs, 0x6a4830, O(0, 1120, 272)));
  tw.add(kit.box(100 * rs, 120 * rs, 24 * rs, 0xe8e0c8, O(0, 1120, 276)));
  tw.add(kit.box(8 * rs, 120 * rs, 28 * rs, 0x6a4830, O(0, 1120, 278)));
  // roof deck: green planks with red eaves, x -540..540 (collision is the long pass line at y~1400)
  const deckTex = tex(256, 64, (c, w, h) => {
    c.fillStyle = '#7b8f45'; c.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 20) { c.fillStyle = '#5d6f30'; c.fillRect(x, 0, 3, h); c.fillStyle = '#93a85a'; c.fillRect(x + 6, 0, 5, h); }
  }, [0.3, 0.3]);
  const deckPoly = [[-540, 1400], [540, 1400], [600, 1330], [-600, 1330]];
  const deck = prism(deckPoly, 820, [mat(0xb83a2c), tmat(deckTex)], rs, 80);
  tw.add(deck); deck.position.z = 0;
  // spire
  tw.add(kit.cyl(230 * rs, 240 * rs, 220 * rs, 0xd9d4c6, O(0, 1400)));
  const spireTex = tex(128, 256, (c, w, h) => {
    c.fillStyle = '#c84a40'; c.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 12) for (let x = (y / 12) % 2 ? 0 : 8; x < w; x += 16) { c.fillStyle = '#a8342c'; c.fillRect(x, y + 9, 14, 3); c.fillStyle = '#dc6050'; c.fillRect(x + 2, y + 2, 10, 4); }
  }, [3, 2]);
  const spire = new THREE.Mesh(new THREE.ConeGeometry(330 * rs, 950 * rs, 12).translate(0, (1620 + 475) * rs, 0), tmat(spireTex));
  tw.add(spire);
  tw.add(kit.sphere(30 * rs, 0xf0d040, O(0, 2580)));

  // ---------- rope bridges along the pass-through line outside the deck ----------
  const line = d.groups[0].floors[0].pts;
  const bridge = new THREE.Group(); root.add(bridge);
  const plankCols = [0x5a3a22, 0x4a2e1a, 0x6a4628];
  const sampleY = (x) => { for (let i = 0; i < line.length - 1; i++) { const a = line[i], b = line[i + 1]; if (x >= a[0] && x <= b[0]) return a[1] + (b[1] - a[1]) * (x - a[0]) / (b[0] - a[0]); } return null; };
  const ropes = { L: [], R: [] };
  for (let x = line[0][0]; x <= line[line.length - 1][0]; x += 70) {
    if (x > -560 && x < 560) continue;
    const y = sampleY(x), y2 = sampleY(Math.min(line[line.length - 1][0], x + 70)) ?? y;
    const p = kit.box(64 * rs, 30 * rs, 260 * rs, plankCols[Math.abs(Math.round(x / 70)) % 3], O(x + 32, (y + y2) / 2 - 15));
    p.rotation.z = Math.atan2(y2 - y, 70); bridge.add(p);
    // truss rails under the deck (side lattice)
    if (((x / 70) | 0) % 3 === 0) {
      for (const z of [-125, 125]) {
        bridge.add(kit.cyl(10 * rs, 10 * rs, 120 * rs, 0x3a2412, O(x, y - 10, z), { seg: 4 }));
        const dg = kit.box(150 * rs, 12 * rs, 12 * rs, 0x3a2412, O(x + 70, y + 40, z)); dg.rotation.z = 0.7; bridge.add(dg);
      }
      (x < 0 ? ropes.L : ropes.R).push([x, y + 110]);
    }
  }
  for (const z of [-125, 125]) for (const pts of [ropes.L, ropes.R]) for (let i = 0; i < pts.length - 1; i++) {
    const [x0, y0] = pts[i], [x1, y1] = pts[i + 1];
    const r = kit.box(Math.hypot(x1 - x0, y1 - y0) * rs, 14 * rs, 14 * rs, 0x6b4a2a, O((x0 + x1) / 2, (y0 + y1) / 2, z));
    r.rotation.z = Math.atan2(y1 - y0, x1 - x0); bridge.add(r);
  }
  // anchor ropes stretching past the bridge ends
  for (const [x0, y0, x1, y1] of [[-1980, 1680, -2700, 1980], [-1980, 1600, -2700, 1800], [2220, 1340, 2900, 1150], [2220, 1260, 2900, 1050]]) {
    const r = kit.box(Math.hypot(x1 - x0, y1 - y0) * rs, 10 * rs, 10 * rs, 0x2a2a2a, O((x0 + x1) / 2, (y0 + y1) / 2, 0));
    r.rotation.z = Math.atan2(y1 - y0, x1 - x0); bridge.add(r);
  }

  // ---------- moving stone block (yakumono 2): local x -2339..2339, top at local y 124 ----------
  const blockTex = tex(256, 128, (c, w, h) => {
    c.fillStyle = '#1e1e22'; c.fillRect(0, 0, w, h);
    for (let y = 0; y < 4; y++) for (let x = 0; x < 8; x++) { c.fillStyle = shade('#55555c', (Math.random() - 0.5) * 30); c.fillRect(x * 32 + (y % 2) * 16 + 2, y * 32 + 2, 28, 28); }
  }, [1, 1]);
  const blk = new THREE.Group(); root.add(blk); groups.set(2, blk);
  const blkTop = tex(256, 128, (c, w, h) => { c.fillStyle = '#2a2a2e'; c.fillRect(0, 0, w, h); for (let y = 0; y < 4; y++) for (let x = 0; x < 8; x++) { c.fillStyle = shade('#6a6a70', (Math.random() - 0.5) * 34); c.fillRect(x * 32 + 2, y * 32 + 2, 28, 28); } }, [0.125, 0.125]);
  blockTex.repeat.set(0.125, 0.125);
  const bm = prism([[-2339, 124], [2339, 124], [2339, -96], [-2339, -96]], 600, [tmat(blockTex), tmat(blkTop)], rs);
  blk.add(bm);

  // ---------- drifting blue wedges (yakumono 3 / 4) ----------
  const wedgeTex = tex(128, 128, (c, w, h) => { c.fillStyle = '#3a5a8a'; c.fillRect(0, 0, w, h); for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) { c.fillStyle = shade('#7c9ad8', (Math.random() - 0.5) * 40); c.fillRect(x * 16 + 1, y * 16 + 1, 14, 14); } }, [0.2, 0.2]);
  for (const gd of d.groups.filter(g => g.id === 3 || g.id === 4)) {
    const poly = gd.id === 3 ? [[-420, -390], [210, -360], [300, 450]] : [[-210, -360], [420, -390], [-300, 450]];
    const gg = new THREE.Group(); root.add(gg); groups.set(gd.id, gg);
    gg.add(prism(poly, 500, [mat(0x4a6ab0), tmat(wedgeTex)], rs));
  }

  // ---------- bumper ----------
  const bumpTex = canvasTex(128, 128, (c, w, h) => {
    c.fillStyle = '#e8b818'; c.beginPath(); c.arc(64, 64, 64, 0, 7); c.fill();
    c.fillStyle = '#1a2a78'; c.beginPath(); c.arc(64, 64, 50, 0, 7); c.fill();
    c.fillStyle = '#f8d830'; c.beginPath(); c.arc(64, 64, 24, 0, 7); c.fill();
    c.fillStyle = '#1a2a78'; c.fillRect(58, 48, 12, 22); c.fillRect(58, 74, 12, 8);
  });
  const bumper = new THREE.Group(); root.add(bumper);
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(160 * rs, 160 * rs, 90 * rs, 16), [mat(0xc02020), tmat(bumpTex), tmat(bumpTex)]);
  disc.rotation.x = Math.PI / 2; bumper.add(disc);

  // ---------- Lakitu (background flyer) ----------
  const lakitu = new THREE.Group(); root.add(lakitu);
  lakitu.add(kit.sphere(140 * rs, 0xffffff, [0, 0, 0], { seg: 8, scale: [1.3, 0.6, 1] }));
  lakitu.add(kit.sphere(70 * rs, 0xf0c020, [0, 90 * rs, 0], { seg: 6 }));
  lakitu.add(kit.sphere(55 * rs, 0x40a040, [0, 150 * rs, 0], { seg: 6 }));
  return { root, groups, background: bg, bumper, lakitu };
}
