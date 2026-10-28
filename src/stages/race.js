// Race to the Finish (1P bonus 3) — dark metal maze. Start top-left, zig-zag down to the finish at the
// bottom right. Hazards: barrel bombs from the hatch at (-3150, 3900) every 180 f that roll down the
// slope and explode on contact (16/11/8 % over 6 f, fire); four bobbing bumpers (GBumper: 1 %, away
// from the bumper, fixed knockback 200). Finish: a fighter grounded on the "detect" floor
// (x 5437..6900, y -7200) emits m.emit('raceFinish', { f }) once and sets st.finished = true.
import { makeStage } from './common.js';
import { findLanding, resolveBody } from '../game/collision.js';
import { buildRace, syncRace } from './race_art.js';
import data from './data/race_to_the_finish.js';

export const BARREL = { r: 145, spawn: [-3150, 3900], every: 180, grav: 1.6, maxFall: 60, accel: 0.35, maxRoll: 24, life: 1200 };
const EXPLODE = [[0, 16, 175], [2, 11, 125], [4, 8, 75]];   // [frame, damage, radius] (size halved)
export const BUMPERS = [[900, -2850, -2550, 1], [0, -3706, -3406, 0], [-1050, -2850, -2550, 1], [-2550, -3600, -2550, 0]]; // x, lo, hi, starts at hi?
const FINISH = { x1: 5437, x2: 6900, y: -7200 };

export const race = makeStage(data, {
  id: 'race', series: 'smash', music: 'bonus',
  clearColor: 0x000000,
  options: { ambient: 0.8, sun: 1.1, sunDir: [-0.2, 0.9, 1] },
  init(m, st) {
    st.barrels = []; st.barrelTimer = 0; st.finished = false; st.bumpers = BUMPERS.map(([x, lo, hi, top]) => ({ x, y: top ? hi : lo, lo, hi, top, cool: new Map(), squash: 0 }));
    st.finishLine = { ...FINISH };
    bumperSetup(st); st.bumperAt(0);
  },
  update(m, st) {
    if (m.phase !== 'play' && m.phase !== 'countdown') return;
    st.bumperAt(m.frame);
    for (const b of st.bumpers) { for (const [f, c] of b.cool) { if (c <= 1) b.cool.delete(f); else b.cool.set(f, c - 1); } if (b.squash > 0) b.squash--; }
    if (m.phase !== 'play') return;
    if (++st.barrelTimer >= BARREL.every) { st.barrelTimer = 0; st.barrels.push(newBarrel()); }
    for (const b of st.barrels) updateBarrel(m, st, b);
    st.barrels = st.barrels.filter(b => !b.dead);
    // finish line
    if (!st.finished) {
      const humans = m.fighters.filter(f => !f.cpu);
      const pool = humans.length ? humans : m.fighters;
      for (const f of pool) {
        if (f.dead || !f.grounded || !f.ground) continue;
        if (f.ground.material === 'detect' && f.x >= FINISH.x1 - 1 && f.x <= FINISH.x2 + 1) {
          st.finished = true; st.finishedBy = f; m.emit('raceFinish', { f }); m.emit('sfx', { name: 'target' }); break;
        }
      }
    }
  },
  hazardHitboxes(m, st) {
    const out = [];
    for (const b of st.barrels) {
      if (b.state !== 'boom') continue;
      const ev = [...EXPLODE].reverse().find(e => b.boomT >= e[0]);
      if (!ev || b.boomT >= 6) continue;
      out.push({ hb: { damage: ev[1], angle: 361, bkb: 90, kbg: 20, fkb: 0, element: 'fire' }, x: b.x, y: b.y + BARREL.r, r: ev[2], hit: b.hitSet, onHit: () => {} });
    }
    for (const bp of st.bumpers) {
      for (const f of m.fighters) {
        if (f.dead || bp.cool.has(f)) continue;
        const dx = f.cx - bp.x, dy = f.cy - bp.y;
        if (dx * dx + dy * dy > (125 + f.H) ** 2) continue;
        const ang = Math.round(Math.atan2(dy, Math.abs(dx) || 1) * 180 / Math.PI + 360) % 360;
        const others = new Set(m.fighters.filter(o => o !== f));
        out.push({ hb: { damage: 1, angle: ang, bkb: 0, kbg: 50, fkb: 200, element: 'normal' }, x: bp.x, y: bp.y, r: 125, hit: others,
          onHit(v) { bp.cool.set(v, 20); bp.squash = 10; m.emit('sfx', { name: 'bump' }); } });
      }
    }
    return out;
  },
  build(scene, rs, d, st) { return buildRace(scene, rs, d, st); },
  sync(obj, m, rs, st) { syncRace(obj, m, rs, st); },
});

// bumpers bob on a 240 f smooth loop between lo and hi
function bumperSetup(st) {
  st.bumperAt = t => { const k = 0.5 - 0.5 * Math.cos((t % 240) / 240 * Math.PI * 2); for (const b of st.bumpers) b.y = b.top ? b.hi - (b.hi - b.lo) * k : b.lo + (b.hi - b.lo) * k; };
}

function newBarrel() { return { x: BARREL.spawn[0], y: BARREL.spawn[1] - BARREL.r * 2, vx: 0, vy: 0, rot: 0, t: 0, state: 'roll', grounded: false, floor: null, boomT: 0, hitSet: new Set(), dead: false }; }

function explode(m, b) {
  if (b.state === 'boom') return;
  b.state = 'boom'; b.boomT = 0; b.vx = b.vy = 0;
  m.emit('sfx', { name: 'explode' }); m.emit('explosion', { x: b.x, y: b.y + BARREL.r, r: 350 });
}

function updateBarrel(m, st, b) {
  b.t++;
  if (b.state === 'boom') { if (++b.boomT > 20) b.dead = true; return; }
  if (b.t > BARREL.life) { explode(m, b); return; }
  // roll physics: feet point at (x,y), body circle centred at y + r
  if (b.grounded && b.floor) {
    const p = b.floor.pts, a = p[0], z = p[p.length - 1];
    const slope = (z[1] - a[1]) / Math.max(1, z[0] - a[0]);
    if (Math.abs(slope) > 0.01) b.vx += -Math.sign(slope) * BARREL.accel;
    b.vx = Math.max(-BARREL.maxRoll, Math.min(BARREL.maxRoll, b.vx));
    let nx = b.x + b.vx;
    if (nx < a[0] || nx > z[0]) { b.grounded = false; b.floor = null; b.x = nx; }
    else {
      const t = (nx - a[0]) / Math.max(1, z[0] - a[0]);
      const ny = a[1] + (z[1] - a[1]) * t;
      const res = resolveBody(m.col, b.x, b.y, nx, ny, BARREL.r * 0.8, BARREL.r * 2);
      if (res.hitWall) { explode(m, b); return; }
      b.x = nx; b.y = ny;
    }
  } else {
    b.vy = Math.max(-BARREL.maxFall, b.vy - BARREL.grav);
    const nx = b.x + b.vx, ny = b.y + b.vy;
    const res = resolveBody(m.col, b.x, b.y, nx, ny, BARREL.r * 0.8, BARREL.r * 2);
    if (res.hitWall) { explode(m, b); return; }
    const land = b.vy <= 0 ? findLanding(m.col, b.x, b.y, res.x, res.y, false, null) : null;
    if (land) { b.x = land.x; b.y = land.y; b.vy = 0; b.grounded = true; b.floor = land.floor; if (b.t > 2) m.emit('sfx', { name: 'land' }); }
    else { b.x = res.x; b.y = res.y; }
  }
  b.rot -= b.vx / BARREL.r;
  const bz = m.stage.blast;
  if (b.y < bz.bottom || b.x < bz.left || b.x > bz.right) { b.dead = true; return; }
  // contact with fighters, fighter attacks, projectiles -> explode
  const cx = b.x, cy = b.y + BARREL.r;
  for (const f of m.fighters) {
    if (f.dead || f.state === 'respawn' || f.untouchable) continue;
    for (const h of f.activeHitboxes) if (!h.hb.grab && (h.x - cx) ** 2 + (h.y - cy) ** 2 <= (h.r + BARREL.r) ** 2) { explode(m, b); return; }
    const c = f.hurtCapsule ? f.hurtCapsule() : { x1: f.x, y1: f.y, x2: f.x, y2: f.y + f.H, r: f.Wd };
    if (segDist2(cx, cy, c.x1, c.y1, c.x2, c.y2) <= (c.r + BARREL.r) ** 2) { explode(m, b); return; }
  }
  for (const p of m.projectiles) if (!p.dead && p.hitbox && (p.x - cx) ** 2 + (p.y - cy) ** 2 <= ((p.r || 50) + BARREL.r) ** 2) { p.die?.(); explode(m, b); return; }
}

function segDist2(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1, dy = y2 - y1, L = dx * dx + dy * dy;
  const t = L ? Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / L)) : 0;
  const qx = x1 + dx * t - px, qy = y1 + dy * t - py; return qx * qx + qy * qy;
}
