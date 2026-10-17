// Saffron City — rooftops of Saffron City around Silph Co. Geometry/blast zones from the decomp
// (reference/spec/stages.md); Pokémon door hazard (gryamabuki.c) and the elevator platforms (yak 5/7, path driven).
// Logic (init/update/hazardHitboxes) is headless; build/sync only touch three.js.
import * as THREE from 'three';
import { mat, kit } from '../render/rig.js';
import { backdrop, gradient, canvasTex, makeStage, prism } from './common.js';
import { floorY } from '../game/collision.js';
import data from './data/saffron_city.js';
import { buildMons, syncMons } from './saffron_mons.js';

const DOOR_CLOSED = 960, DOOR_OPEN = 1600, DOOR_Y = 360, DOOR_FRAMES = 20;
const MON_X = 1320, MON_Y = 0;            // map object "monster" (1320,270) = body centre; feet on the y 0 floor
const KINDS = ['electrode', 'charmander', 'venusaur', 'porygon', 'chansey'];
const rnd = n => Math.floor(Math.random() * n);

// ---- hitbox data (reference/spec/items.json stage_items) ----
const HB = {
  charBody: { damage: 5, angle: 361, kbg: 100, bkb: 20, fkb: 0, element: 'normal', r: 170 },
  flame: { damage: 2, angle: 0, kbg: 100, bkb: 0, fkb: 3, element: 'fire', r: 160 },
  venus0: { damage: 20, angle: 40, kbg: 100, bkb: 0, fkb: 90, element: 'normal', r: 150 },
  venus1: { damage: 8, angle: 361, kbg: 70, bkb: 30, fkb: 0, element: 'normal', r: 150 },
  leaf: { damage: 3, angle: 90, kbg: 60, bkb: 30, fkb: 0, element: 'normal', r: 100 },
  pory0: { damage: 18, angle: 40, kbg: 40, bkb: 70, fkb: 0, element: 'normal', r: 150 },
  pory1: { damage: 8, angle: 40, kbg: 70, bkb: 40, fkb: 0, element: 'normal', r: 150 },
  boom: [[0, 30, 350], [2, 30, 175], [4, 20, 150], [6, 10, 100]],   // [frame, damage, radius]
};
// per-Pokémon timeline lengths (frames after it starts coming out)
const DUR = { charmander: 200, venusaur: 210, porygon: 130, electrode: 170, chansey: 170 };

function onFloor(m, f) {
  return f.grounded && f.ground && !f.ground.pass && f.ground.material === 'detect' && f.x >= 797 && f.x <= 1890;
}

export const saffron = makeStage(data, {
  id: 'saffron', series: 'pokemon', music: 'saffron',
  ambient: 0.7,
  init(m, st) {
    st.door = { phase: 'closed', x: DOOR_CLOSED, t: 0, gateWait: 1, monTimer: 1000 + rnd(1000), prev: null };
    st.mon = null; st.shots = []; st.eggs = []; st.boom = null; st.monCount = 0; st.monLog = [];
    st.doorGroup = m.col.groups.find(g => g.id === 3);
    if (st.doorGroup) st.doorGroup.target = [DOOR_CLOSED, DOOR_Y];
  },
  update(m, st) {
    const d = st.door;
    if (m.phase === 'play') {
      if (d.gateWait > 0) d.gateWait--;
      if (d.monTimer > 0) d.monTimer--;
      if (d.phase === 'closed' && d.gateWait <= 0) {
        const someone = m.fighters.some(f => !f.dead && onFloor(m, f));
        if (someone || d.monTimer <= 0) {
          // uniform among 5, never the previous one (shift to the next)
          let k = rnd(5);
          if (KINDS[k] === d.prev) k = (k + 1) % 5;
          d.prev = KINDS[k]; d.phase = 'opening'; d.t = 0;
          st.pending = KINDS[k];
        }
      } else if (d.phase === 'opening') {
        d.t++; d.x = DOOR_CLOSED + (DOOR_OPEN - DOOR_CLOSED) * Math.min(1, d.t / DOOR_FRAMES);
        if (d.t >= DOOR_FRAMES) { d.phase = 'open'; spawnMon(m, st, st.pending); }
      } else if (d.phase === 'open') {
        if (!st.mon) { d.phase = 'closing'; d.t = 0; }
      } else if (d.phase === 'closing') {
        d.t++; d.x = DOOR_OPEN - (DOOR_OPEN - DOOR_CLOSED) * Math.min(1, d.t / DOOR_FRAMES);
        // nobody gets shut inside the recess
        for (const f of m.fighters) {
          if (f.dead || f.y > 720 || f.x < d.x - f.a.width || f.x > 1890) continue;
          f.x = d.x - f.a.width - 1;
          if (f.grounded && f.ground && f.x < f.ground.pts[0][0]) f.becomeAirborne();
        }
        if (d.t >= DOOR_FRAMES) { d.phase = 'closed'; d.x = DOOR_CLOSED; d.gateWait = 1000; d.monTimer = 1000 + rnd(1000); }
      }
      if (st.mon) updateMon(m, st);
      updateShots(m, st);
      updateEggs(m, st);
    }
    if (st.doorGroup) st.doorGroup.target = [d.x, DOOR_Y];
  },
  hazardHitboxes(m, st) {
    const out = [];
    const mon = st.mon;
    if (mon && mon.body) out.push(mon.body);
    if (st.boom) out.push(st.boom);
    for (const s of st.shots) out.push(s);
    return out;
  },
  build(scene, rs, d, st) { return build(scene, rs, d, st); },
  sync(obj, m, rs, st) { sync(obj, m, rs, st); },
});

// ---------- Pokémon logic ----------
function hz(hb, x, y, extra = {}) {
  const h = { hb: { ...hb }, x, y, px: x, py: y, r: hb.r, hit: new Set(), ...extra };
  h.onHit = (v) => { h.hit.add(v); extra.onHitExtra?.(h, v); };
  return h;
}

function spawnMon(m, st, kind) {
  st.mon = { kind, t: 0, x: DOOR_OPEN, y: MON_Y, facing: -1, body: null, egg: false, cool: new Map() };
  st.monCount++; st.monLog.push(kind);
  m.emit('sfx', { name: 'item' });
  m.emit('stageEvent', { stage: 'saffron', what: 'pokemon', kind });
}

// body hitbox that can re-hit the same fighter after `cool` frames
function bodyBox(mon, m, hb, x, y, cool = 40) {
  if (!mon.body || mon.body.hb.damage !== hb.damage || mon.body.hb.angle !== hb.angle) {
    mon.body = hz(hb, x, y);
    mon.body.onHit = (v) => { mon.body.hit.add(v); mon.cool.set(v, m.frame + cool); };
  }
  mon.body.px = mon.body.x; mon.body.py = mon.body.y;
  mon.body.x = x; mon.body.y = y;
  for (const [v, until] of mon.cool) if (m.frame >= until) { mon.body.hit.delete(v); mon.cool.delete(v); }
}

const lerp = (a, b, k) => a + (b - a) * Math.max(0, Math.min(1, k));

function updateMon(m, st) {
  const mon = st.mon; mon.t++;
  const t = mon.t;
  switch (mon.kind) {
    case 'charmander': {
      mon.x = t < 150 ? lerp(DOOR_OPEN, MON_X, t / 30) : lerp(MON_X, DOOR_OPEN + 100, (t - 150) / 40);
      bodyBox(mon, m, HB.charBody, mon.x, 250);
      if (t >= 40 && t <= 120 && (t - 40) % 8 === 0) {
        const a = -12 * Math.PI / 180, sp = 45;
        const s = hz(HB.flame, mon.x - 250, 300, { kind: 'flame', vx: -Math.cos(-a) * sp, vy: Math.sin(a) * sp, life: 20 });
        s.onHit = (v) => { s.hit.add(v); s.dead = true; };
        st.shots.push(s);
        if ((t - 40) % 16 === 0) m.emit('sfx', { name: 'fire' });
      }
      break;
    }
    case 'venusaur': {
      mon.x = t < 160 ? lerp(DOOR_OPEN, MON_X, t / 40) : lerp(MON_X, DOOR_OPEN + 150, (t - 160) / 45);
      bodyBox(mon, m, t < 8 ? HB.venus0 : HB.venus1, mon.x - 150, 300);
      if (t === 1) m.emit('sfx', { name: 'hitL' });
      if (t >= 40 && t <= 120 && (t - 40) % 16 === 0) {
        const s = hz(HB.leaf, mon.x - 540, 330, { kind: 'leaf', vx: -100, vy: 0, ax: 5, life: 24, spin: 0 });
        s.onHit = (v) => { s.hit.add(v); s.dead = true; };
        st.shots.push(s);
        m.emit('sfx', { name: 'slash' });
      }
      break;
    }
    case 'porygon': {
      // tackles out of the door, shakes, then backs in
      mon.x = t < 10 ? lerp(DOOR_OPEN, 900, t / 10) : t < 90 ? 900 : lerp(900, DOOR_OPEN + 100, (t - 90) / 35);
      mon.shake = t < 42 && t >= 10 ? Math.sin(t * 2.2) * 25 : 0;
      if (t < 90) bodyBox(mon, m, t < 12 ? HB.pory0 : HB.pory1, mon.x - 80, 280, 1e9);
      else mon.body = null;
      if (t === 1) m.emit('sfx', { name: 'dash' });
      break;
    }
    case 'electrode': {
      mon.x = lerp(DOOR_OPEN, MON_X - 150, t / 40);
      mon.roll = t < 40 ? (1 - t / 40) * Math.PI * 4 : 0;
      if (t === 130) {
        st.boom = hz({ damage: 30, angle: 361, kbg: 100, bkb: 40, fkb: 0, element: 'fire', r: 350 }, mon.x, 225, { t: 0 });
        st.boom.unblockable = false;
        m.emit('sfx', { name: 'explode' }); m.emit('stageEvent', { stage: 'saffron', what: 'explode', x: mon.x, y: 225 });
        mon.gone = true;
      }
      if (st.boom) {
        const b = st.boom; const ev = [...HB.boom].reverse().find(e => b.t >= e[0]);
        b.hb.damage = ev[1]; b.r = ev[2]; b.t++;
        if (b.t > 7) st.boom = null;
      }
      break;
    }
    case 'chansey': {
      mon.x = t < 120 ? lerp(DOOR_OPEN, MON_X, t / 40) : lerp(MON_X, DOOR_OPEN + 100, (t - 120) / 40);
      if (t >= 80 && t <= 85 && !mon.egg) {
        mon.egg = true;
        st.eggs.push({ x: mon.x - 200, y: 200, vy: 0, vx: -8, t: 0, grounded: false });
        m.emit('sfx', { name: 'item' });
      }
      break;
    }
  }
  if (t >= DUR[mon.kind]) { st.mon = null; st.boom = null; }
}

function updateShots(m, st) {
  for (const s of st.shots) {
    s.px = s.x; s.py = s.y;
    if (s.ax) s.vx += s.ax;
    s.x += s.vx; s.y += s.vy; s.life--;
    if (s.kind === 'leaf') s.spin += 0.6;
    if (s.life <= 0) s.dead = true;
  }
  st.shots = st.shots.filter(s => !s.dead);
}

// Chansey's egg: falls to the floor, breaks when attacked (no item system yet: contents are not spawned)
function updateEggs(m, st) {
  for (const e of st.eggs) {
    e.t++;
    if (!e.grounded) {
      e.vy = Math.max(-60, e.vy - 2.5); const ny = e.y + e.vy, nx = e.x + e.vx;
      let land = null;
      for (const fl of m.col.floors) {
        if (!fl.active) continue;
        const y = floorY(fl, nx); if (y === null) continue;
        if (e.y >= y - 1 && ny <= y && (land === null || y > land)) land = y;
      }
      if (land !== null) { e.y = land; e.grounded = true; e.vx = 0; } else { e.y = ny; e.x = nx; }
      if (e.y < m.stage.blast.bottom) e.dead = true;
    }
    for (const f of m.fighters) {
      if (f.dead) continue;
      for (const h of f.activeHitboxes) {
        if ((h.x - e.x) ** 2 + (h.y - (e.y + 90)) ** 2 <= (h.r + 100) ** 2) {
          e.dead = true; m.emit('sfx', { name: 'hitS' }); m.emit('stageEvent', { stage: 'saffron', what: 'eggBreak', x: e.x, y: e.y + 90 });
          break;
        }
      }
      if (e.dead) break;
    }
    if (e.t > 1200) e.dead = true;
  }
  st.eggs = st.eggs.filter(e => !e.dead);
}

// ---------- art ----------
const G = (v, rs) => v * rs;

function windowsTex(base, frame, win, cols, rows, o = {}) {
  return canvasTex(256, 256, (c, w, h) => {
    c.fillStyle = base; c.fillRect(0, 0, w, h);
    const cw = w / cols, ch = h / rows;
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
      c.fillStyle = frame; c.fillRect(x * cw + cw * 0.12, y * ch + ch * 0.14, cw * 0.76, ch * 0.62);
      c.fillStyle = win; c.fillRect(x * cw + cw * 0.18, y * ch + ch * 0.2, cw * 0.64, ch * 0.5);
      if (o.shine) { c.fillStyle = 'rgba(255,255,255,0.25)'; c.fillRect(x * cw + cw * 0.18, y * ch + ch * 0.2, cw * 0.2, ch * 0.5); }
    }
    if (o.band) { c.fillStyle = o.band; for (let y = 0; y < rows; y += 2) c.fillRect(0, y * ch, w, ch * 0.12); }
  }, { repeat: [1, 1] });
}

// flat face from a polygon (game units) with uv mapped by tile size (game units per texture repeat)
function face(poly, z, tex, tile, rs, color = 0xffffff, o = {}) {
  const shape = new THREE.Shape(poly.map(([x, y]) => new THREE.Vector2(x * rs, y * rs)));
  const geo = new THREE.ShapeGeometry(shape);
  const uv = geo.attributes.uv, pos = geo.attributes.position;
  const ox = o.ox ?? 0, oy = o.oy ?? 0;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (pos.getX(i) / rs - ox) / tile[0], (pos.getY(i) / rs - oy) / tile[1]);
  const m = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ map: tex, color, transparent: !!o.transparent }));
  m.position.z = z * rs;
  return m;
}

// solid block: extruded polygon + textured front
function block(g, poly, z0, z1, side, rs, front) {
  const p = prism(poly, z1 - z0, side, rs, (z0 + z1) / 2);
  g.add(p);
  if (front) g.add(face(poly, z1 + 1, front.tex, front.tile, rs, front.color ?? 0xffffff, front));
  return p;
}

// a thin bar between two 3D points (game units)
const _up = new THREE.Vector3(0, 1, 0);
function bar(a, b, r, color, rs, seg = 4) {
  const A = new THREE.Vector3(...a).multiplyScalar(rs), B = new THREE.Vector3(...b).multiplyScalar(rs);
  const len = A.distanceTo(B);
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r * rs, r * rs, len, seg), mat(color));
  m.position.copy(A).add(B).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(_up, B.clone().sub(A).normalize());
  return m;
}

// white railing with zig-zag truss along a polyline at depth z
function railing(g, pts, z, h, rs, color = 0xf4f4f8) {
  const yAt = x => { for (let i = 0; i < pts.length - 1; i++) if (x >= pts[i][0] && x <= pts[i + 1][0]) { const k = (x - pts[i][0]) / Math.max(1e-6, pts[i + 1][0] - pts[i][0]); return pts[i][1] + (pts[i + 1][1] - pts[i][1]) * k; } return pts[pts.length - 1][1]; };
  const x0 = pts[0][0], x1 = pts[pts.length - 1][0];
  const n = Math.max(1, Math.round((x1 - x0) / 170));
  let prev = null;
  for (let i = 0; i <= n; i++) {
    const x = x0 + (x1 - x0) * i / n, y = yAt(x);
    g.add(bar([x, y, z], [x, y + h, z], 13, color, rs));
    if (prev) {
      g.add(bar([prev[0], prev[1] + h, z], [x, y + h, z], 18, color, rs));
      g.add(bar([prev[0], prev[1] + 8, z], [x, y + 8, z], 14, color, rs));
      if (i % 2) g.add(bar([prev[0], prev[1] + 8, z], [x, y + h, z], 11, color, rs));
      else g.add(bar([prev[0], prev[1] + h, z], [x, y + 8, z], 11, color, rs));
    }
    prev = [x, y];
  }
}

// deck top surface along a floor polyline from zBack to zFront (tiled texture)
function deck(g, pts, zb, zf, tex, tile, rs, color = 0xffffff) {
  const pos = [], uv = [], idx = [];
  let u = 0;
  for (let i = 0; i < pts.length; i++) {
    if (i > 0) u += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    const [x, y] = pts[i];
    pos.push(x * rs, y * rs, zb * rs, x * rs, y * rs, zf * rs);
    uv.push(u / tile, zb / tile, u / tile, zf / tile);
    if (i > 0) { const b = (i - 1) * 2; idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2); }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx); geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ map: tex, color, side: THREE.DoubleSide }));
  g.add(m); return m;
}

function build(scene, rs, d, st) {
  const root = new THREE.Group(); scene.add(root);
  // haze: fog follows the camera distance so the play area stays crisp and the city fades into #CDE6FF
  scene.fog = new THREE.Fog(0xcde6ff, 40, 200);
  const fogProbe = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial());
  fogProbe.frustumCulled = false;
  fogProbe.onBeforeRender = (r, sc, cam) => { const dz = Math.abs(cam.position.z); scene.fog.near = dz + 8; scene.fog.far = dz + 75; };
  root.add(fogProbe);

  const bg = backdrop(scene, rs, (c, w, h) => {
    gradient(c, w, h, [[0, '#4f7fd0'], [0.35, '#86aee6'], [0.62, '#c6dcf4'], [0.8, '#e2eefa'], [1, '#eef4fb']]);
    // soft clouds
    for (let i = 0; i < 45; i++) {
      const x = Math.random() * w, y = h * (0.05 + Math.random() * 0.4), r = 30 + Math.random() * 70;
      const gr = c.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(255,255,255,0.75)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = gr; c.fillRect(x - r, y - r, r * 2, r * 2);
    }
    // distant grey-blue mountains
    c.fillStyle = '#9aa6c0';
    c.beginPath(); c.moveTo(0, h * 0.7);
    for (let x = 0; x <= w; x += 32) c.lineTo(x, h * (0.55 + 0.08 * Math.sin(x * 0.013) + 0.05 * Math.sin(x * 0.041 + 1)));
    c.lineTo(w, h); c.lineTo(0, h); c.fill();
    // green hills on both sides
    c.fillStyle = '#4f9a4c';
    c.beginPath(); c.moveTo(0, h * 0.3); c.quadraticCurveTo(w * 0.18, h * 0.45, w * 0.26, h * 0.8); c.lineTo(0, h); c.fill();
    c.beginPath(); c.moveTo(w, h * 0.28); c.quadraticCurveTo(w * 0.8, h * 0.45, w * 0.72, h * 0.8); c.lineTo(w, h); c.fill();
    const mist = c.createLinearGradient(0, h * 0.6, 0, h); mist.addColorStop(0, 'rgba(225,236,250,0)'); mist.addColorStop(1, 'rgba(225,236,250,1)');
    c.fillStyle = mist; c.fillRect(0, h * 0.6, w, h * 0.4);
  }, { y: 2500, w: 36000, h: 18000 });

  // ---- distant skyscrapers ----
  const towerCols = [['#b8bcc4', '#8a8e98', '#5a6070'], ['#c8ccd2', '#9ea2aa', '#6a7080'], ['#a8acb4', '#7c808c', '#3e4454'], ['#d8d8dc', '#b0b0b8', '#7a8090']];
  const towerTex = towerCols.map(([b, f, wn]) => windowsTex(b, f, wn, 4, 8, { shine: true }));
  const bgTowers = [
    [-6200, 2800, 900, -4200], [-4700, 3600, 800, -5200], [-3200, 2600, 700, -3600], [-5400, 1500, 1000, -2600],
    [-2300, 3000, 650, -5600], [200, 2200, 800, -5400], [1500, 3200, 750, -4800], [3000, 5200, 800, -4600],
    [4300, 2800, 1000, -3800], [5600, 3800, 900, -5000], [6800, 2000, 1100, -3400], [-900, 4400, 600, -6200],
    [2300, 1300, 1200, -2800], [-7600, 2200, 1100, -4600], [7800, 3300, 900, -4400],
  ];
  bgTowers.forEach(([x, top, wd, z], i) => {
    const t = towerTex[i % towerTex.length];
    const col = towerCols[i % 4][0];
    const tw = t.clone(); tw.needsUpdate = true; tw.wrapS = tw.wrapT = THREE.RepeatWrapping; tw.repeat.set(Math.max(1, wd / 300), (top + 6000) / 500);
    const mats = [mat(col), mat(col), mat(col), mat(col), new THREE.MeshLambertMaterial({ map: tw }), mat(col)];
    const m = new THREE.Mesh(new THREE.BoxGeometry(wd * rs, (top + 6000) * rs, wd * 0.8 * rs), mats);
    m.position.set(x * rs, (top - 6000) / 2 * rs, z * rs); root.add(m);
    if (i % 3 === 0) root.add(bar([x, top, z], [x, top + 900, z], 18, 0xd0d0d8, rs));
    if (i % 4 === 1) root.add(kit.box(wd * 0.6 * rs, 200 * rs, wd * 0.5 * rs, col, [x * rs, (top + 100) * rs, z * rs]));
  });
  // low mist layers between the city and the stage
  const mistTex = canvasTex(256, 64, (c, w, h) => { const gr = c.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, 'rgba(240,246,255,0)'); gr.addColorStop(0.5, 'rgba(240,246,255,0.85)'); gr.addColorStop(1, 'rgba(240,246,255,1)'); c.fillStyle = gr; c.fillRect(0, 0, w, h); });
  for (const [y, z] of [[-1700, -2200], [-2600, -900], [-3400, 600]]) {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(26000 * rs, 2200 * rs), new THREE.MeshBasicMaterial({ map: mistTex, transparent: true, depthWrite: false, fog: false }));
    p.position.set(0, y * rs, z * rs); root.add(p);
  }

  // ---- Silph Co. building ----
  const roofPts = [[-1653, -368], [-632, -368], [-327, -312], [366, -44], [607, 0], [797, 0], [1890, 0]];
  const ZF = 420, ZB = -560;      // roof deck depth
  const silphTex = canvasTex(512, 512, (c, w, h) => {
    c.fillStyle = '#cdc6e6'; c.fillRect(0, 0, w, h);
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
      c.fillStyle = '#eeeaf8'; c.fillRect(x * 64 + 10, y * 64 + 12, 44, 36);
      c.fillStyle = '#5c5a86'; c.fillRect(x * 64 + 15, y * 64 + 17, 34, 26);
      c.fillStyle = '#8c8ab8'; c.fillRect(x * 64 + 15, y * 64 + 17, 10, 26);
    }
  }, { repeat: [1, 1] });
  silphTex.wrapS = silphTex.wrapT = THREE.RepeatWrapping;
  const latticeTex = canvasTex(128, 128, (c, w, h) => {
    c.fillStyle = '#b4acd6'; c.fillRect(0, 0, w, h);
    c.strokeStyle = '#f2f0fa'; c.lineWidth = 12;
    c.beginPath(); c.moveTo(0, 0); c.lineTo(w, h); c.moveTo(w, 0); c.lineTo(0, h); c.stroke();
    c.strokeRect(0, 0, w, h);
  }, { repeat: [1, 1] });
  latticeTex.wrapS = latticeTex.wrapT = THREE.RepeatWrapping;
  const bodyPoly = [[-1653, -6200], [1980, -6200], [1980, -4], ...[...roofPts].reverse().map(([x, y]) => [x, y - 4])];
  block(root, bodyPoly, ZB - 200, ZF, 0xb8b0d8, rs);
  // facade: windows on the left/middle, lattice on the right
  root.add(face([[-1653, -6200], [700, -6200], [700, -470], [366, -470], [-327, -738], [-632, -794], [-1653, -794]], ZF + 2, silphTex, [2000, 2000], rs, 0xffffff, { oy: -60 }));
  root.add(face([[700, -6200], [1980, -6200], [1980, -470], [700, -470]], ZF + 2, latticeTex, [320, 320], rs));
  // roof edge band under the railing (follows the slope)
  const band = [...roofPts.map(([x, y]) => [x, y - 10]), ...[...roofPts].reverse().map(([x, y]) => [x, y - (x < 600 ? 426 : 470)])];
  root.add(face(band, ZF + 3, canvasTex(8, 8, (c) => { c.fillStyle = '#e8e6f4'; c.fillRect(0, 0, 8, 8); }), [100, 100], rs));
  // "Silph" sign on the facade
  const signTex = canvasTex(512, 160, (c, w, h) => {
    c.font = 'italic bold 120px Arial Black, Arial, sans-serif'; c.textBaseline = 'middle';
    c.lineWidth = 14; c.strokeStyle = '#6a6890'; c.strokeText('Silph', 20, 85);
    c.fillStyle = '#eef0fa'; c.fillText('Silph', 20, 85);
    c.beginPath(); c.arc(430, 80, 62, 0, Math.PI * 2); c.fillStyle = '#eef0fa'; c.fill(); c.lineWidth = 10; c.stroke();
    c.fillStyle = '#6a6890'; c.font = 'bold 72px Arial'; c.fillText('S', 405, 84);
  });
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(1300 * rs, 400 * rs), new THREE.MeshLambertMaterial({ map: signTex, transparent: true }));
  sign.position.set(900 * rs, -760 * rs, (ZF + 30) * rs); root.add(sign);
  // roof deck: mauve tiles
  const tileTex = canvasTex(64, 64, (c, w, h) => {
    c.fillStyle = '#9a7c8c'; c.fillRect(0, 0, w, h);
    c.fillStyle = '#b4949f'; for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) c.fillRect(x * 16 + 1, y * 16 + 1, 14, 14);
    c.fillStyle = '#7a5e70'; for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) if ((x + y) % 2) c.fillRect(x * 16 + 5, y * 16 + 5, 6, 6);
  }, { repeat: [1, 1] });
  tileTex.wrapS = tileTex.wrapT = THREE.RepeatWrapping;
  deck(root, roofPts.filter(p => p[0] <= 960).concat([[960, 0]]), ZB, ZF, tileTex, 220, rs);
  deck(root, [[960, 0], [1890, 0]], ZB, ZF - 120, tileTex, 220, rs, 0xa0a0b0);   // shaded recess floor
  // railings (front and back), following the slope
  railing(root, roofPts.filter(p => p[0] <= 960).concat([[960, 0]]), ZF - 20, 220, rs);
  railing(root, roofPts.filter(p => p[0] <= 700), ZB + 20, 220, rs);
  // back wall of the stairs housing at the left end
  root.add(kit.box(500 * rs, 450 * rs, 400 * rs, 0xc2c6c8, [-1350 * rs, -150 * rs, (ZB - 120) * rs]));

  // upper Silph block (960..1980, top 810, underside 720; door recess below)
  const upTex = windowsTex('#e4e4ea', '#c8c8d2', '#3a3058', 3, 2, { shine: true });
  upTex.wrapS = upTex.wrapT = THREE.RepeatWrapping;
  block(root, [[960, 720], [1980, 720], [1980, 810], [960, 810]], ZB, ZF, 0xe8e8ee, rs, { tex: upTex, tile: [1020, 90], color: 0xd0d0dc });
  block(root, [[1890, 0], [1980, 0], [1980, 720], [1890, 720]], ZB, ZF, 0xe0e0e8, rs);
  root.add(kit.box(1020 * rs, 30 * rs, (ZF - ZB + 40) * rs, 0xf4f4f8, [1470 * rs, 825 * rs, ((ZF + ZB) / 2) * rs]));
  // interior back wall of the recess: dark purple screen with plants (seen through the open door)
  const backTex = canvasTex(256, 128, (c, w, h) => {
    gradient(c, w, h, [[0, '#4a2a6a'], [1, '#2a1640']]);
    c.fillStyle = '#7a4aa0'; for (let i = 0; i < 6; i++) c.fillRect(20 + i * 38, 14, 22, 70);
    c.fillStyle = '#2f8a3a'; for (let i = 0; i < 9; i++) { c.beginPath(); c.arc(14 + i * 30, 112, 20, 0, Math.PI * 2); c.fill(); }
  });
  const back = new THREE.Mesh(new THREE.PlaneGeometry(930 * rs, 720 * rs), new THREE.MeshLambertMaterial({ map: backTex }));
  back.position.set(1425 * rs, 360 * rs, (ZB + 10) * rs); root.add(back);
  // sliding door: a white block filling the doorway from the door wall x back to x 1890; it retracts
  // into the building (to x 1600) when it opens, so the Pokémon stand in the open doorway
  const doorTex = canvasTex(256, 192, (c, w, h) => {
    c.fillStyle = '#f2f0f8'; c.fillRect(0, 0, w, h);
    c.strokeStyle = '#cfcbe0'; c.lineWidth = 3; c.strokeRect(10, 10, w - 20, h - 20);
    c.fillStyle = '#dcd8ea'; for (let i = 0; i < 6; i++) c.fillRect(24 + i * 36, 30, 20, h - 60);
  });
  const dm = new THREE.MeshLambertMaterial({ map: doorTex });
  const door = new THREE.Group();
  const doorBox = new THREE.Mesh(new THREE.BoxGeometry(1, 720 * rs, (ZF - 40 - ZB) * rs), [mat(0xd8d4e6), mat(0xe6e2f0), mat(0xe8e4f2), mat(0xe8e4f2), dm, mat(0xd8d4e6)]);
  doorBox.position.set(0, 0, ((ZF - 40 + ZB) / 2) * rs);
  door.add(doorBox);
  door.userData.box = doorBox;
  root.add(door);
  // rooftop gear on the upper block: antennas with yellow lamps, and a grey structure behind
  block(root, [[700, 810], [2200, 810], [2200, 1700], [700, 1700]], -2200, -1400, 0xa8acb0, rs, { tex: windowsTex('#b4b8bc', '#9a9ea4', '#4a5260', 5, 3), tile: [500, 300], color: 0xffffff });
  for (const x of [1250, 1700]) {
    root.add(bar([x, 810, -300], [x, 1500, -300], 12, 0xd8d8d8, rs));
    root.add(kit.cyl(28 * rs, 28 * rs, 120 * rs, 0xf0d040, [x * rs, 1300 * rs, -300 * rs], { seg: 6 }));
    root.add(kit.cyl(28 * rs, 28 * rs, 120 * rs, 0xf0d040, [x * rs, 1100 * rs, -300 * rs], { seg: 6 }));
  }

  // ---- right tower (brown/white, helipad on top) ----
  const brownTex = canvasTex(256, 256, (c, w, h) => {
    for (let y = 0; y < 4; y++) {
      c.fillStyle = '#e6e2dc'; c.fillRect(0, y * 64, w, 34);
      c.fillStyle = '#8a5a3c'; c.fillRect(0, y * 64 + 34, w, 30);
      c.fillStyle = '#6a3e28'; for (let x = 0; x < 16; x++) c.fillRect(x * 16 + 2, y * 64 + 38, 6, 6);
      c.fillStyle = '#5a6a90'; for (let x = 0; x < 4; x++) c.fillRect(x * 64 + 8, y * 64 + 6, 48, 22);
      c.fillStyle = '#a8b8d8'; for (let x = 0; x < 4; x++) c.fillRect(x * 64 + 10, y * 64 + 8, 14, 18);
    }
  }, { repeat: [1, 1] });
  brownTex.wrapS = brownTex.wrapT = THREE.RepeatWrapping;
  block(root, [[2670, -6200], [3641, -6200], [3641, 458], [2670, 459]], -500, 450, 0xb88a68, rs, { tex: brownTex, tile: [970, 1000], oy: 458 });
  const pad = canvasTex(128, 128, (c, w, h) => {
    c.fillStyle = '#d8d2c8'; c.fillRect(0, 0, w, h);
    c.fillStyle = '#d04040'; for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) if ((i + j) % 2 && (i < 2 || i > 5 || j < 2 || j > 5)) c.fillRect(i * 16, j * 16, 16, 16);
    c.fillStyle = '#ffffff'; c.font = 'bold 54px Arial'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('H', 64, 66);
  });
  const padM = new THREE.Mesh(new THREE.PlaneGeometry(971 * rs, 950 * rs), new THREE.MeshLambertMaterial({ map: pad }));
  padM.rotation.x = -Math.PI / 2; padM.position.set(3155 * rs, 461 * rs, -25 * rs); root.add(padM);

  // ---- lower-left building (cream, x -3600..-2460, top -1620) ----
  const creamTex = windowsTex('#e8dfa8', '#cfc690', '#6c7898', 3, 4, { shine: true });
  creamTex.wrapS = creamTex.wrapT = THREE.RepeatWrapping;
  block(root, [[-3600, -6200], [-2460, -6200], [-2460, -1620], [-3600, -1620]], -600, 500, 0xd8cf98, rs, { tex: creamTex, tile: [1140, 600], oy: -1620 });
  root.add(kit.box(1180 * rs, 40 * rs, 1140 * rs, 0xf0ecd0, [-3030 * rs, -1600 * rs, -50 * rs]));

  // ---- tall green-grey tower behind the left elevator, with the Pokéball banner ----
  const greenTex = windowsTex('#b6c2b8', '#9aa89e', '#4e5a62', 3, 6, { shine: true });
  greenTex.wrapS = greenTex.wrapT = THREE.RepeatWrapping;
  block(root, [[-1800, -6200], [-1100, -6200], [-1100, 1450], [-1800, 1450]], -1250, -650, 0xa8b4aa, rs, { tex: greenTex, tile: [700, 600], color: 0xffffff });
  root.add(kit.box(420 * rs, 260 * rs, 420 * rs, 0xb8c0b4, [-1450 * rs, 1580 * rs, -950 * rs]));
  root.add(bar([-1450, 1700, -950], [-1450, 4300, -950], 20, 0xc0c0c0, rs));
  const bannerTex = canvasTex(32, 256, (c, w, h) => {
    c.fillStyle = '#38b878'; c.fillRect(0, 0, w, h); c.fillStyle = '#f0e8a0'; c.fillRect(6, 0, w - 12, h);
    c.fillStyle = '#d04040'; for (let i = 0; i < 12; i++) c.fillRect(10, 8 + i * 20, 12, 10);
  });
  const banner = new THREE.Mesh(new THREE.PlaneGeometry(130 * rs, 2200 * rs), new THREE.MeshLambertMaterial({ map: bannerTex, side: THREE.DoubleSide }));
  banner.position.set(-1450 * rs, 2950 * rs, -880 * rs); root.add(banner);
  const ball = new THREE.Group(); ball.position.set(-1450 * rs, 4450 * rs, -950 * rs); root.add(ball);
  const top = new THREE.Mesh(new THREE.SphereGeometry(260 * rs, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), mat(0xe03030));
  const bot = new THREE.Mesh(new THREE.SphereGeometry(260 * rs, 12, 6, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), mat(0xf4f4f4));
  ball.add(top, bot, kit.cyl(262 * rs, 262 * rs, 30 * rs, 0x202020, [0, -15 * rs, 0], { seg: 12 }), kit.cyl(70 * rs, 70 * rs, 30 * rs, 0xffffff, [0, 0, 250 * rs], { seg: 10, rot: [Math.PI / 2, 0, 0] }));

  // ---- elevator platforms (moving groups 5 and 7) ----
  const groups = new Map();
  const e5 = new THREE.Group(); root.add(e5); groups.set(5, e5);
  const grate = canvasTex(64, 64, (c, w, h) => { c.fillStyle = '#c4c8d2'; c.fillRect(0, 0, w, h); c.strokeStyle = '#8a8e9c'; c.lineWidth = 3; for (let i = 0; i <= 4; i++) { c.beginPath(); c.moveTo(i * 16, 0); c.lineTo(i * 16, h); c.stroke(); } c.strokeRect(0, 0, w, h); }, { repeat: [6, 3] });
  e5.add(kit.box(1080 * rs, 110 * rs, 520 * rs, 0x9a9eaa, [-12 * rs, 110 * rs, 0]));
  const top5 = new THREE.Mesh(new THREE.BoxGeometry(1100 * rs, 16 * rs, 540 * rs), [mat(0xd0d4dc), mat(0xd0d4dc), new THREE.MeshLambertMaterial({ map: grate }), mat(0xd0d4dc), mat(0xe0e2ea), mat(0xd0d4dc)]);
  top5.position.set(-12 * rs, 157 * rs, 0); e5.add(top5);
  for (const x of [-540, -270, 0, 270, 515]) e5.add(kit.box(26 * rs, 112 * rs, 530 * rs, 0x70747e, [x * rs, 110 * rs, 0]));
  e5.add(kit.cone(260 * rs, 200 * rs, 0x8a8e98, [-12 * rs, -75 * rs, 0], { seg: 4, rot: [Math.PI, 0, 0] }));
  e5.add(kit.sphere(50 * rs, 0xf0d840, [-12 * rs, -100 * rs, 0], { seg: 6, emissive: 0x605010 }));
  e5.add(bar([480, 165, -240], [480, 900, -240], 14, 0x9a9eaa, rs));   // guide rail into the building
  const e7 = new THREE.Group(); root.add(e7); groups.set(7, e7);
  const slopeAng = Math.atan2(336 - 43, 474 + 586);
  const plate = kit.box(1100 * rs, 50 * rs, 520 * rs, 0xb8bcc8, [-56 * rs, 165 * rs, 0]);
  plate.rotation.z = slopeAng; plate.position.y = (189.5 - 25) * rs; e7.add(plate);
  const props = [];
  for (const x of [-420, 320]) {
    const y = 43 + (x + 586) * Math.tan(slopeAng) - 80;
    e7.add(bar([x, y, 0], [x, y + 60, 0], 14, 0x707480, rs));
    const p = new THREE.Group(); p.position.set(x * rs, y * rs, 0);
    p.add(kit.box(420 * rs, 8 * rs, 40 * rs, 0x606470, [0, 0, 0]));
    p.add(kit.box(40 * rs, 8 * rs, 420 * rs, 0x606470, [0, 0, 0]));
    e7.add(p); props.push(p);
  }
  e7.add(kit.sphere(45 * rs, 0xf0d840, [0, 60 * rs, 0], { seg: 6, emissive: 0x605010 }));

  // ---- Pokémon models, shots, eggs ----
  const mons = buildMons(root, rs);
  return { root, background: bg, groups, door, props, mons, shotMeshes: [], eggMeshes: [] };
}

function sync(obj, m, rs, st) {
  if (!obj) return;
  for (const g of m.col.groups) {
    const gg = obj.groups.get(g.id);
    if (gg) gg.position.set(g.ox * rs, g.oy * rs, 0);
  }
  const dw = Math.max(1, 1890 - st.door.x);
  obj.door.position.set((st.door.x + dw / 2) * rs, DOOR_Y * rs, 0);
  obj.door.userData.box.scale.x = dw * rs;
  for (const p of obj.props) p.rotation.y += 0.6;
  syncMons(obj, m, rs, st);
}
