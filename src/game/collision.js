// Stage collision built from the decomp's collision groups ("yakumono"): each group has floor polylines
// (with per-run pass-through flags and ledge flags at the ends), walls (rwall faces +x, lwall faces -x)
// and ceilings. Moving groups have local coordinates; world = local + group offset, where the offset
// follows a sampled animation path or is driven by stage code (group.offset set each frame).

export function buildCollision(def) {
  const col = { floors: [], walls: [], ceils: [], groups: [] };
  for (const gd of def.groups) {
    const g = { id: gd.id, moving: gd.moving, base: gd.base ?? [0, 0], path: gd.path, driven: gd.driven, active: true, ox: 0, oy: 0, dx: 0, dy: 0 };
    if (g.moving) { g.ox = g.base[0]; g.oy = g.base[1]; }
    col.groups.push(g);
    for (const f of gd.floors) col.floors.push({ local: f.pts.map(p => [...p]), pts: f.pts.map(p => [p[0] + g.ox, p[1] + g.oy]), pass: !!f.pass,
      material: f.material, ledges: f.ledges ?? [false, false], group: g, get active() { return g.active; }, dx: 0, dy: 0, friction: f.friction ?? 1 });
    for (const w of gd.walls) col.walls.push({ la: w.a, lb: w.b, a: [w.a[0] + g.ox, w.a[1] + g.oy], b: [w.b[0] + g.ox, w.b[1] + g.oy], nx: w.nx, group: g });
    for (const c of gd.ceils) col.ceils.push({ la: c[0], lb: c[1], a: [c[0][0] + g.ox, c[0][1] + g.oy], b: [c[1][0] + g.ox, c[1][1] + g.oy], group: g });
  }
  return col;
}

// Sample a moving group's path at frame t
export function samplePath(path, t) {
  const out = {};
  const tt = ((t % path.period) + path.period) % path.period;
  for (const [k, s] of Object.entries(path.tracks)) {
    const i = tt / path.step, i0 = Math.floor(i), k1 = i - i0;
    const a = s[Math.min(s.length - 1, i0)], b = s[Math.min(s.length - 1, i0 + 1)];
    out[k] = a + (b - a) * k1;
  }
  return out;
}

// Advance moving groups: frame-based paths, or offsets set by stage code in g.target
export function updateGroups(col, frame) {
  for (const g of col.groups) {
    if (!g.moving) continue;
    let nx = g.ox, ny = g.oy;
    if (g.path) { const s = samplePath(g.path, frame); if (s.traX !== undefined) nx = s.traX; if (s.traY !== undefined) ny = s.traY; }
    if (g.target) { nx = g.target[0]; ny = g.target[1]; }
    g.dx = nx - g.ox; g.dy = ny - g.oy; g.ox = nx; g.oy = ny;
  }
  for (const f of col.floors) {
    const g = f.group; f.dx = g.dx; f.dy = g.dy;
    if (g.moving && (g.dx || g.dy)) for (let i = 0; i < f.pts.length; i++) { f.pts[i][0] = f.local[i][0] + g.ox; f.pts[i][1] = f.local[i][1] + g.oy; }
  }
  for (const w of col.walls) if (w.group.moving) { w.a = [w.la[0] + w.group.ox, w.la[1] + w.group.oy]; w.b = [w.lb[0] + w.group.ox, w.lb[1] + w.group.oy]; }
  for (const c of col.ceils) if (c.group.moving) { c.a = [c.la[0] + c.group.ox, c.la[1] + c.group.oy]; c.b = [c.lb[0] + c.group.ox, c.lb[1] + c.group.oy]; }
}

export function floorY(floor, x) {
  const p = floor.pts;
  if (x < p[0][0] - 1e-6 || x > p[p.length - 1][0] + 1e-6) return null;
  for (let i = 0; i < p.length - 1; i++) {
    const a = p[i], b = p[i + 1];
    if (x >= a[0] - 1e-6 && x <= b[0] + 1e-6) {
      const t = (b[0] - a[0]) < 1e-6 ? 0 : (x - a[0]) / (b[0] - a[0]);
      return a[1] + (b[1] - a[1]) * t;
    }
  }
  return null;
}
export const floorLeft = f => f.pts[0][0];
export const floorRight = f => f.pts[f.pts.length - 1][0];

// Find a floor crossed by the feet going from (x0,y0) to (x1,y1). Moving floors are compared in their
// previous position for the start point, so fighters land on rising platforms.
export function findLanding(col, x0, y0, x1, y1, ignorePass, ignoreFloor) {
  let best = null, bestY = -Infinity;
  for (const f of col.floors) {
    if (!f.active || (f.pass && ignorePass) || f === ignoreFloor) continue;
    const fy1 = floorY(f, x1);
    if (fy1 === null) continue;
    const fy0 = (floorY(f, x0 - (f.dx || 0)) ?? fy1) - (f.dy || 0);
    if (y0 >= fy0 - 0.5 && y1 <= fy1 + 0.5 && fy1 > bestY) { bestY = fy1; best = { floor: f, x: x1, y: fy1 }; }
  }
  return best;
}

function wallXAt(w, y) {
  const dy = w.b[1] - w.a[1]; if (Math.abs(dy) < 1e-6) return w.a[0];
  return w.a[0] + (w.b[0] - w.a[0]) * (y - w.a[1]) / dy;
}

// Keep a body (half-width w, height h, feet at x,y) out of walls and ceilings after a move from (x0,y0).
export function resolveBody(col, x0, y0, x, y, w, h) {
  let hitWall = 0, hitCeil = false;
  const yLo = y + h * 0.15, yHi = y + h * 0.85;
  for (const wl of col.walls) {
    if (!wl.group.active) continue;
    const wlo = Math.min(wl.a[1], wl.b[1]), whi = Math.max(wl.a[1], wl.b[1]);
    if (yHi < wlo || yLo > whi) continue;
    const ys = Math.max(wlo, Math.min(whi, (yLo + yHi) / 2));
    const wx = wallXAt(wl, ys);
    if (wl.nx > 0) {            // right face of a solid: block moving left through it
      if (x - w < wx && x0 - w >= wx - 1 - Math.abs(wl.group.dx)) { x = wx + w + 0.01; hitWall = -1; }
    } else {
      if (x + w > wx && x0 + w <= wx + 1 + Math.abs(wl.group.dx)) { x = wx - w - 0.01; hitWall = 1; }
    }
  }
  const top0 = y0 + h, top = y + h;
  if (top > top0) for (const c of col.ceils) {
    if (!c.group.active) continue;
    const lx = Math.min(c.a[0], c.b[0]), rx = Math.max(c.a[0], c.b[0]);
    if (x < lx || x > rx) continue;
    const t = (rx - lx) < 1e-6 ? 0 : (x - c.a[0]) / (c.b[0] - c.a[0]);
    const cy = c.a[1] + (c.b[1] - c.a[1]) * t;
    if (top0 <= cy + 1 && top > cy) { y = cy - h - 0.01; hitCeil = true; }
  }
  return { x, y, hitWall, hitCeil };
}

// Grabbable ledges: ends of floors flagged as cliffs. dir = -1 for a left end, +1 for a right end.
export function ledges(col) {
  const out = [];
  for (const f of col.floors) {
    if (!f.ledges) continue;
    if (f.ledges[0]) out.push({ get x() { return f.pts[0][0]; }, get y() { return f.pts[0][1]; }, dir: -1, floor: f });
    if (f.ledges[1]) out.push({ get x() { return f.pts[f.pts.length - 1][0]; }, get y() { return f.pts[f.pts.length - 1][1]; }, dir: 1, floor: f });
  }
  return out;
}
