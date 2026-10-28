// Sector Z — the Great Fox hull from the decomp collision (reference/spec/stages.md) and the Arwing patrol
// (grsector.c timing): first fly-by 600 f after GO, then a 960..2099 f wait after each exit; three 2D
// patterns (standable Arwing = yakumono 1, horizontal laser volleys to the left: 16%, 361, KBG 75, BKB 70,
// size 300 -> r 150, reflectable/absorbable/shieldable) then one 3D background pattern (lasers aimed at a
// fighter's ground point, 230 u/f, exploding for 16 f: 18%, 361, KBG 100, BKB 10, fire, unblockable).
// The flight paths themselves are not in the extracted data: these are designed fly-bys with the decomp timing.
import { makeStage } from './common.js';
import { buildSectorZ, syncSectorZ } from './sectorz_art.js';
import data from './data/sector_z.js';

const LASER2D_HB = { damage: 16, angle: 361, kbg: 75, bkb: 70, fkb: 0, element: 'normal', shieldDmg: 5, ground: true, air: true };
const LASER3D_HB = { damage: 18, angle: 361, kbg: 100, bkb: 10, fkb: 0, element: 'fire', ground: true, air: true };
const LASER_SPEED = 230;

// Keyframes [frame, x, y, z]. 2D patterns travel right -> left in the fighting plane (z = 0) for most of
// their length; 3D patterns stay in the background and shoot at the stage.
export const PATTERNS = [
  // A: in over the engine deck, climbs over the dorsal wing, skims down the hull and leaves past the nose
  { kind: '2d', keys: [[0, 15000, 5200, -7000], [130, 7200, 1450, 0], [260, 5300, 1500, 0], [380, 4300, 3900, 0], [560, 1900, 3050, 0], [780, -500, 2100, 0], [980, -3600, 2250, 0], [1100, -6400, 2600, 0], [1230, -14000, 5500, -6000]] },
  // B: dives in from above, hovers over the slope, then cruises along the hull
  { kind: '2d', keys: [[0, 9000, 10000, -3000], [150, 4500, 4200, 0], [400, 2400, 3350, 0], [620, 900, 2850, 0], [820, -1600, 2150, 0], [1020, -4600, 2550, 0], [1170, -12000, 8000, -5000]] },
  // C: low pass along the engine deck, then pulls up and away into the background
  { kind: '2d', keys: [[0, 16000, 1300, -5000], [150, 8000, 1250, 0], [470, 5300, 1200, 0], [640, 4700, 1250, 0], [800, 5600, 3600, -2500], [1000, 9500, 7500, -9000]] },
  // 3D background passes (fire at a fighter's ground point)
  { kind: '3d', fire: [140, 200, 260, 320], keys: [[0, -15000, 6500, -14000], [300, 0, 4800, -4200], [620, 13000, 7500, -10000]] },
  { kind: '3d', fire: [130, 190, 250], keys: [[0, 13000, 9500, -15000], [280, 2000, 5200, -5000], [600, -13000, 3200, -11000]] },
  { kind: '3d', fire: [120, 170, 220, 270], keys: [[0, -11000, -5000, 3500], [220, -8200, 3800, -3500], [520, 6000, 9500, -13000]] },
];

function cr(p0, p1, p2, p3, u) {
  const u2 = u * u, u3 = u2 * u;
  return 0.5 * ((2 * p1) + (-p0 + p2) * u + (2 * p0 - 5 * p1 + 4 * p2 - p3) * u2 + (-p0 + 3 * p1 - 3 * p2 + p3) * u3);
}
export function samplePattern(pat, t, ox = 0) {
  const k = pat.keys;
  let i = 0; while (i < k.length - 2 && t >= k[i + 1][0]) i++;
  const a = k[Math.max(0, i - 1)], b = k[i], c = k[i + 1], d = k[Math.min(k.length - 1, i + 2)];
  const u = Math.max(0, Math.min(1, (t - b[0]) / (c[0] - b[0])));
  const X = v => Math.abs(v[3]) < 1 ? v[1] + ox : v[1];     // the horizontal offset applies to in-plane keys
  const z = Math.abs(b[3]) < 1 && Math.abs(c[3]) < 1 ? 0 : cr(a[3], b[3], c[3], d[3], u);   // stay in the plane between in-plane keys
  return [cr(X(a), X(b), X(c), X(d), u), cr(a[2], b[2], c[2], d[2], u), z];
}
// Great Fox silhouette (yakumono 2 outline) to keep in-plane Arwing passes clear of the hull
const HULL = (() => { const g = data.groups.find(g => g.id === 2), top = g.floors[0].pts, deck = g.floors[1].pts;
  return [...top, [3806, 2685], [3526, 1755], ...deck, [8528, -192], [7152, -662], [5770, -200], [3363, -2538], [-3525, -908], [-2630, 204], [-3398, 1004], [-5057, 774], [-6872, 1132]]; })();
function inHull(x, y) { let c = false; for (let i = 0, j = HULL.length - 1; i < HULL.length; j = i++) { const [xi, yi] = HULL[i], [xj, yj] = HULL[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c; } return c; }
function clearOfHull(x, y) { for (let k = 0; k < 120; k++) { let hit = false; for (const dx of [-700, -350, 0, 350, 650]) if (inHull(x + dx, y - 160) || inHull(x + dx, y + 60)) { hit = true; break; } if (!hit) return y; y += 25; } return y; }
const patLen = p => p.keys[p.keys.length - 1][0];
const rand = (m, n) => Math.floor(m.rng ? m.rng() * n : Math.random() * n);

function groundBelow(m, f) {
  if (f.grounded) return f.y;
  let best = null;
  for (const fl of m.col.floors) { if (!fl.active) continue; const pts = fl.pts; if (f.x < pts[0][0] || f.x > pts[pts.length - 1][0]) continue;
    for (let i = 0; i < pts.length - 1; i++) { const a = pts[i], b = pts[i + 1]; if (f.x >= a[0] && f.x <= b[0]) { const y = a[1] + (b[1] - a[1]) * (f.x - a[0]) / Math.max(1e-6, b[0] - a[0]); if (y <= f.y && (best === null || y > best)) best = y; } } }
  return best ?? f.y - 600;
}

export const sectorz = makeStage(data, {
  id: 'sectorz', series: 'starfox', music: 'sectorz',
  options: { bgParallax: 0.92, ambient: 0.85, sun: 1.2, sunDir: [-0.3, 1, 0.6] },
  init(m, st) {
    st.arw = { state: 'wait', t: 600, n2d: 0, pat: null, pt: 0, ox: 0, x: 0, y: -30000, z: -30000, px: 0, py: -30000, pz: -30000,
      volley: 0, shotT: 0, cool: 0, active: false };
    st.lasers = []; st.blasts = [];
    const g = m.col.groups.find(g => g.id === 1);
    st.arwGroup = g; g.active = false; g.target = [0, -30000];
  },
  update(m, st) {
    const A = st.arw, g = st.arwGroup;
    if (m.phase === 'play') {
      if (A.state === 'wait') {
        if (--A.t <= 0) {
          if (A.n2d >= 3) { A.pat = PATTERNS[3 + rand(m, 3)]; A.n2d = 0; A.ox = 0; }
          else { const i = rand(m, 4); A.pat = PATTERNS[i % 3]; A.ox = i === 3 && rand(m, 5) === 0 ? [-3000, 0, 9000][rand(m, 3)] : 0; A.n2d++; }
          A.state = 'fly'; A.pt = 0; A.volley = 0; A.cool = 0; A.shotT = 0;
        }
      } else {
        A.pt++;
        A.px = A.x; A.py = A.y; A.pz = A.z;
        [A.x, A.y, A.z] = samplePattern(A.pat, A.pt, A.ox);
        if (Math.abs(A.z) < 1300) A.y = clearOfHull(A.x, A.y);
        if (A.pt >= patLen(A.pat)) { A.state = 'wait'; A.t = 960 + rand(m, 1140); A.x = 0; A.y = -30000; A.z = -30000; }
        else if (A.pat.kind === '2d') fire2D(m, st, A);
        else if (A.pat.fire.includes(A.pt)) fire3D(m, st, A);
      }
    }
    // standable while in the fighting plane
    const on = A.state === 'fly' && Math.abs(A.z) < 200;
    if (!on && g.active) for (const f of m.fighters) if (f.grounded && f.ground?.group === g) f.becomeAirborne?.();
    g.active = on; g.target = [A.x, A.y];
    // lasers
    const bz = m.stage.blast;
    for (const L of st.lasers) {
      L.px = L.x; L.py = L.y;
      if (L.kind === '2d') {
        L.x += L.vx;
        for (const f of m.fighters) {
          if (f.dead || f === L.owner) continue;
          if (f.reflectBox) { const b = f.reflectBox(); if (b && (b.x - L.x) ** 2 + (b.y - L.y) ** 2 <= (b.r + 150) ** 2) { L.vx = -L.vx; L.owner = f; L.hit = new Set(); L.dmg = Math.min(999, Math.floor(L.dmg * (f.reflectMul ?? 1.5))); m.emit('reflect', { f, x: L.x, y: L.y }); break; } }
          if (f.absorbBox) { const b = f.absorbBox(); if (b && (b.x - L.x) ** 2 + (b.y - L.y) ** 2 <= (b.r + 150) ** 2) { f.onAbsorb?.({ hb: { ...LASER2D_HB, damage: L.dmg }, damage: L.dmg }); L.dead = true; m.emit('absorb', { f, x: L.x, y: L.y }); break; } }
        }
        if (L.x < bz.left || L.x > bz.right) L.dead = true;
      } else {
        L.x += L.vx; L.y += L.vy; L.z += L.vz;
        if (--L.steps <= 0) { L.dead = true; st.blasts.push({ x: L.tx, y: L.ty, t: 16, hit: new Set() }); m.emit('sfx', { name: 'explode' }); }
      }
    }
    st.lasers = st.lasers.filter(L => !L.dead);
    for (const b of st.blasts) b.t--;
    st.blasts = st.blasts.filter(b => b.t > 0);
  },
  hazardHitboxes(m, st) {
    const out = [];
    for (const L of st.lasers) if (L.kind === '2d') out.push({ hb: { ...LASER2D_HB, damage: L.dmg }, x: L.x, y: L.y, px: L.px, py: L.py, r: 150, hit: L.hit,
      owner: L.owner, ownerFighter: L.owner ?? undefined, onHit(v) { L.hit.add(v); L.dead = true; } });
    for (const b of st.blasts) out.push({ hb: LASER3D_HB, x: b.x, y: b.y, r: 100, hit: b.hit, unblockable: true, onHit(v) { b.hit.add(v); } });
    return out;
  },
  build(scene, rs, d, st) { return buildSectorZ(scene, rs, d, st); },
  sync(obj, m, rs, st) { syncSectorZ(obj, m, rs, st); },
});

function fire2D(m, st, A) {
  if (Math.abs(A.z) >= 200) return;
  if (A.cool > 0) { A.cool--; return; }
  if (A.volley > 0) {
    if (--A.shotT <= 0) {
      st.lasers.push({ kind: '2d', x: A.x - 566, y: A.y - 60, px: A.x - 566, py: A.y - 60, vx: -LASER_SPEED, dmg: 16, hit: new Set(), owner: null });
      m.emit('sfx', { name: 'laser' });
      A.volley--; A.shotT = 30;
      if (A.volley === 0) A.cool = 240;
    }
    return;
  }
  if (A.pt % 60 !== 0) return;
  const tgt = m.fighters.some(f => !f.dead && f.state !== 'respawn' && f.x < A.x && f.y - A.y >= -500 && f.y - A.y <= 300);
  if (tgt) { A.volley = 4; A.shotT = 1; }
}

function fire3D(m, st, A) {
  const live = m.fighters.filter(f => !f.dead && f.state !== 'respawn');
  if (!live.length) return;
  const f = live[rand(m, live.length)];
  const tx = f.x, ty = groundBelow(m, f) + 60;
  const dx = tx - A.x, dy = ty - A.y, dz = 0 - A.z, dist = Math.hypot(dx, dy, dz);
  const steps = Math.max(1, Math.ceil(dist / LASER_SPEED));
  st.lasers.push({ kind: '3d', x: A.x, y: A.y, z: A.z, vx: dx / steps, vy: dy / steps, vz: dz / steps, steps, tx, ty });
  m.emit('sfx', { name: 'laser' });
}
