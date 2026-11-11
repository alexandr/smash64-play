// Headless logic shared by the Break the Targets / Board the Platforms stages (and any stage with
// damaging floor materials). No three.js here: everything runs in node tests too.
//
// API consumed by the 1P mode:
//   BtT: st.targets = [{ index, x, y, r, broken, path }], st.targetsLeft
//        events: 'target' { index, x, y, left, f }, 'targetsComplete' {}; hook st.onBreak(target, m)
//   BtP: st.platforms = [{ index, yak, x, y, w, size, boarded }], st.platformsLeft
//        events: 'platform' { index, x, y, left, f }, 'platformsComplete' {}; hook st.onBoard(p, m)

// stages.json rules.damaging_floors (src/ft/ftmain.c dFTMainGroundHitCollisionAttributes); fkb = WKB
export const DAMAGING_FLOORS = {
  fire_weak_side: { damage: 1, angle: 361, kbg: 100, fkb: 100, bkb: 0, element: 'fire' },
  fire_strong_side: { damage: 10, angle: 90, kbg: 100, fkb: 200, bkb: 0, element: 'fire' },
  fire_weak_up1: { damage: 10, angle: 90, kbg: 100, fkb: 100, bkb: 0, element: 'fire' },
  spikes: { damage: 10, angle: 361, kbg: 100, fkb: 80, bkb: 0, element: 'slash' },
  fire_weak_up2: { damage: 1, angle: 90, kbg: 100, fkb: 100, bkb: 0, element: 'fire' },
  fire_weak_up3: { damage: 1, angle: 90, kbg: 100, fkb: 100, bkb: 0, element: 'fire' },
};
const FLOOR_COOLDOWN = 16;

// Hazard hitboxes for grounded fighters standing on a damaging floor (16 f per-fighter cooldown).
// Call from a stage's hazardHitboxes(m, st); cooldowns live in st._floorCD.
export function damagingFloorHazards(m, st) {
  const cd = st._floorCD ??= new Map();
  const out = [];
  for (const f of m.fighters) {
    if (f.dead || !f.grounded || !f.ground) continue;
    const hb = DAMAGING_FLOORS[f.ground.material];
    if (!hb) continue;
    if ((cd.get(f) ?? -999) > m.frame) continue;
    const others = new Set(m.fighters.filter(o => o !== f));
    out.push({
      hb: { ...hb, noStale: true }, x: f.x, y: f.y + f.H * 0.3, r: 60, hit: others, unblockable: true, floorHazard: true,
      onHit: (v) => { cd.set(v, m.frame + FLOOR_COOLDOWN); },
    });
  }
  return out;
}

// ---------- Break the Targets ----------
function sampleTrack(tr, t) {
  if (!tr) return null;
  if (tr.constant !== undefined) return tr.constant;
  const s = tr.samples; if (!s?.length) return null;
  return s;
}
export function targetPos(tg, frame) {
  const mo = tg.motion;
  if (!mo) return [tg.pos[0], tg.pos[1]];
  const out = [tg.pos[0], tg.pos[1]];
  const per = mo.period_frames, step = mo.sample_step_frames || 1;
  const tt = ((frame % per) + per) % per;
  ['traX', 'traY'].forEach((k, ax) => {
    const s = sampleTrack(mo.tracks?.[k]);
    if (s === null) return;
    if (typeof s === 'number') { out[ax] = s; return; }
    const i = tt / step, i0 = Math.floor(i), k1 = i - i0;
    const a = s[Math.min(s.length - 1, i0)], b = s[Math.min(s.length - 1, i0 + 1)] ?? a;
    out[ax] = a + (b - a) * k1;
  });
  return out;
}

export const TARGET_R = 150; // hurt cube 300 (items.json stage_items.target)

export function initTargets(m, st, data) {
  st.targets = (data.targets ?? []).map((t, i) => {
    const [x, y] = targetPos(t, m.frame);
    return { index: i, x, y, r: TARGET_R, broken: false, brokenFrame: -1, path: t.motion ?? null, src: t };
  });
  st.targetsLeft = st.targets.length;
}

// squared distance from point (cx,cy) to segment (ax,ay)-(bx,by)
function pointSeg2(cx, cy, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
  let t = l2 > 1e-9 ? ((cx - ax) * dx + (cy - ay) * dy) / l2 : 0;
  t = Math.max(0, Math.min(1, t));
  const px = ax + dx * t - cx, py = ay + dy * t - cy;
  return px * px + py * py;
}

export function updateTargets(m, st) {
  for (const tg of st.targets) {
    if (tg.broken) continue;
    if (tg.path) { const p = targetPos(tg.src, m.frame); tg.x = p[0]; tg.y = p[1]; }
  }
  if (m.phase !== 'play') return;
  const hits = (x, y, px, py, r, tg) => pointSeg2(tg.x, tg.y, px ?? x, py ?? y, x, y) <= (r + tg.r) ** 2;
  for (const tg of st.targets) {
    if (tg.broken) continue;
    let by = null, found = false;
    for (const f of m.fighters) {
      if (f.dead) continue;
      for (const h of f.activeHitboxes) {
        if (h.hb?.grab || h.clanked) continue;
        if (hits(h.x, h.y, h.px, h.py, h.r, tg)) { by = f; found = true; f.hitlag = Math.max(f.hitlag, 3); break; }
      }
      if (found) break;
    }
    if (!found) for (const p of m.projectiles) {
      if (p.dead || !p.hitbox) continue;
      const h = p.worldHitbox();
      if (hits(h.x, h.y, h.px, h.py, h.r, tg)) { by = p.owner ?? null; found = true; if (!p.pierce) p.die(); break; }
    }
    if (!found) for (const h of m.items?.activeHitboxes?.() ?? []) {
      if (hits(h.x, h.y, h.px, h.py, h.r ?? 50, tg)) { by = h.ownerFighter ?? null; found = true; break; }
    }
    if (found) breakTarget(m, st, tg, by);
  }
}

export function breakTarget(m, st, tg, by = null) {
  if (tg.broken) return;
  tg.broken = true; tg.brokenFrame = m.frame;
  st.targetsLeft--;
  m.emit('target', { index: tg.index, x: tg.x, y: tg.y, left: st.targetsLeft, f: by });
  m.emit('sfx', { name: 'target' });
  st.onBreak?.(tg, m);
  if (st.targetsLeft === 0) m.emit('targetsComplete', {});
}

// ---------- Board the Platforms ----------
function detectFloor(m, yak) {
  return m.col.floors.find(f => f.group.id === yak && f.material === 'detect') ?? m.col.floors.find(f => f.group.id === yak);
}
function platPos(fl) {
  const p = fl.pts; return [(p[0][0] + p[p.length - 1][0]) / 2, (p[0][1] + p[p.length - 1][1]) / 2];
}
export function initPlatforms(m, st, data) {
  st.platforms = (data.platforms ?? []).map((d, i) => {
    const fl = detectFloor(m, d.yakumono_id);
    const [x, y] = fl ? platPos(fl) : d.center;
    return { index: i, yak: d.yakumono_id, x, y, w: d.width, size: d.size_class, boarded: false, boardedFrame: -1, floor: fl };
  });
  st.platformsLeft = st.platforms.length;
}
export function updatePlatforms(m, st) {
  for (const p of st.platforms) if (p.floor) { const [x, y] = platPos(p.floor); p.x = x; p.y = y; }
  if (m.phase !== 'play') return;
  for (const f of m.fighters) {
    if (f.dead || !f.grounded || !f.ground) continue;
    const yak = f.ground.group?.id;
    const p = st.platforms.find(q => q.yak === yak && !q.boarded);
    if (!p) continue;
    p.boarded = true; p.boardedFrame = m.frame;
    st.platformsLeft--;
    m.emit('platform', { index: p.index, x: p.x, y: p.y, left: st.platformsLeft, f });
    m.emit('sfx', { name: 'target' });
    st.onBoard?.(p, m);
    if (st.platformsLeft === 0) m.emit('platformsComplete', {});
  }
}

// ---------- geometry: solids from a group's collision lines ----------
// Each collision line is one-sided (floors face up, ceilings down, rwalls +x, lwalls -x). Lines are chained
// into loops by shared endpoints; a loop is kept as a filled solid only if every line's normal points out
// of it. Lines not in a valid loop are returned as thick "beams" extruded behind their face.
// Returns { loops: [[x,y]...], beams: [[x,y]x4 quads] } in the group's (local) coordinates.
function inPoly(x, y, poly) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c;
  }
  return c;
}
export function groupSolids(g, beamT = 300, tol = 4, maxArea = 2.5e7) {
  const segs = [];
  const norm = (a, b, up) => { const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1; let n = [-dy / l, dx / l]; if ((n[1] > 0) !== up) n = [-n[0], -n[1]]; return n; };
  for (const f of g.floors) { if (f.pass) continue; for (let i = 0; i < f.pts.length - 1; i++) segs.push({ a: f.pts[i], b: f.pts[i + 1], n: norm(f.pts[i], f.pts[i + 1], true) }); }
  for (const w of g.walls) { const dx = w.b[0] - w.a[0], dy = w.b[1] - w.a[1], l = Math.hypot(dx, dy) || 1; let n = [-dy / l, dx / l]; if (Math.sign(n[0]) !== Math.sign(w.nx)) n = [-n[0], -n[1]]; segs.push({ a: w.a, b: w.b, n }); }
  for (const c of g.ceils) segs.push({ a: c[0], b: c[1], n: norm(c[0], c[1], false) });
  const pts = [];
  const key = p => { for (let i = 0; i < pts.length; i++) if (Math.abs(pts[i][0] - p[0]) <= tol && Math.abs(pts[i][1] - p[1]) <= tol) return i; pts.push([p[0], p[1]]); return pts.length - 1; };
  const edges = segs.map(s => [key(s.a), key(s.b)]);
  const adj = new Map();
  edges.forEach(([a, b], i) => { if (a === b) return; for (const k of [a, b]) { if (!adj.has(k)) adj.set(k, []); adj.get(k).push(i); } });
  const used = new Set();
  const loops = [], loose = new Set(segs.map((_, i) => i));
  const walk = (from, start) => {           // follow unused edges from `from`; stops at `start` or a dead end
    const E = [], P = []; let cur = from;
    while (cur !== start) {
      const nx = (adj.get(cur) ?? []).find(j => !used.has(j));
      if (nx === undefined) break;
      used.add(nx); E.push(nx);
      const [a, b] = edges[nx]; cur = a === cur ? b : a; P.push(cur);
    }
    return { E, P };
  };
  const accept = (chainE, poly) => {
    let good = 0;
    for (const e of chainE) {
      const s = segs[e], mx = (s.a[0] + s.b[0]) / 2, my = (s.a[1] + s.b[1]) / 2;
      if (!inPoly(mx + s.n[0] * 15, my + s.n[1] * 15, poly) && inPoly(mx - s.n[0] * 15, my - s.n[1] * 15, poly)) good++;
    }
    // huge enclosed regions (unreachable frame interiors) read better as beams than as one filled slab
    let area = 0; for (let k = 0, j = poly.length - 1; k < poly.length; j = k++) area += (poly[j][0] - poly[k][0]) * (poly[j][1] + poly[k][1]);
    return good === chainE.length && Math.abs(area / 2) < maxArea;
  };
  // pass 1: naturally closed loops; pass 2: open chains closed with a straight edge
  for (const pass of [1, 2]) {
    for (let i = 0; i < edges.length; i++) {
      if (used.has(i) || edges[i][0] === edges[i][1]) continue;
      used.add(i);
      const [a, b] = edges[i];
      const f = walk(b, a);
      let chainE = [i, ...f.E], chainP = [a, b, ...f.P];
      const closed = chainP[chainP.length - 1] === a;
      if (closed) chainP.pop();
      else if (pass === 2) { const bk = walk(a, b); chainE = [...bk.E.reverse(), ...chainE]; chainP = [...bk.P.reverse(), ...chainP]; }
      const poly = chainP.map(k => pts[k]);
      if ((closed || pass === 2) && poly.length >= 3 && accept(chainE, poly)) { loops.push(poly); chainE.forEach(e => loose.delete(e)); }
      else if (pass === 1) chainE.forEach(e => used.delete(e));   // release for pass 2
    }
    if (pass === 1) { used.clear(); for (let e = 0; e < edges.length; e++) if (!loose.has(e)) used.add(e); }
  }
  const beams = [];
  for (const i of loose) {
    const s = segs[i];
    const len = Math.hypot(s.b[0] - s.a[0], s.b[1] - s.a[1]); if (len < 1) continue;
    const t = Math.min(beamT, Math.max(150, len * 0.5));
    const bx = -s.n[0] * t, by = -s.n[1] * t;
    beams.push([s.a, s.b, [s.b[0] + bx, s.b[1] + by], [s.a[0] + bx, s.a[1] + by]]);
  }
  return { loops, beams };
}
