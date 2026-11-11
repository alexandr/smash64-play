// Hyrule Castle — decomp geometry (reference/spec/stages.md) and the tornado (grhyrule.c / ftcommontwister.c):
// first tornado 1600..2799 f after GO at one of the 4 Twister map objects (dropped onto the floor below),
// 80 f summon, then 520..1119 f of wandering along its floor line at 10 u/f; every 180..299 f a 1/5 chance
// (if fighters stand on its line) of dashing at 50 u/f toward the side with more fighters for 300..479 f;
// at a line end (inset 300 where a wall drops below) it waits 120 f and reverses. 32 f subside, then the
// next wait. Catch box |dx| < 300, -300 < dy < 600; held 60 f spiralling (radius (400t+100)/2, 1800 deg/s,
// rising 500 u/s), then thrown: 14%, angle 90, KBG 60, BKB 115; 60 f before the same fighter can be caught.
import { makeStage } from './common.js';
import { floorY } from '../game/collision.js';
import { buildHyrule, syncHyrule } from './hyrule_art.js';
import data from './data/hyrule_castle.js';

const THROW = { damage: 14, angle: 90, kbg: 60, bkb: 115, fkb: 0, element: 'normal' };
const rand = n => Math.floor(Math.random() * n);

// floor directly under a point (highest floor at or below y)
function floorUnder(col, x, y) {
  let best = null, by = -Infinity;
  for (const f of col.floors) { if (!f.active) continue; const fy = floorY(f, x); if (fy !== null && fy <= y + 10 && fy > by) { by = fy; best = f; } }
  return best;
}
// usable [left, right] range of a floor line: inset 300 where a wall drops below the end
function lineRange(col, f) {
  const l = f.pts[0], r = f.pts[f.pts.length - 1];
  const wallAt = (x, y) => col.walls.some(w => Math.abs(w.a[0] - x) < 30 && Math.abs(w.b[0] - x) < 200 && Math.min(w.a[1], w.b[1]) < y - 50 && Math.max(w.a[1], w.b[1]) >= y - 50);
  return [l[0] + (wallAt(l[0], l[1]) ? 300 : 0), r[0] - (wallAt(r[0], r[1]) ? 300 : 0)];
}

export const hyrule = makeStage(data, {
  id: 'hyrule', series: 'zelda', music: 'hyrule',
  options: { ambient: 0.95, sun: 1.1, sunDir: [-0.5, 1, 0.7], bgParallax: 0.9 },
  init(m, st) {
    st.tw = { state: 'wait', t: 1600 + rand(1200), x: 0, y: -99999, floor: null, dir: 1, speed: 10, life: 0, check: 0, dash: 0, pause: 0, age: 0 };
    st.held = new Map();      // fighter -> { t, x0, y0 }
    st.twCool = new Map();
  },
  update(m, st) {
    const T = st.tw;
    for (const [f, t] of st.twCool) { if (t <= 1) st.twCool.delete(f); else st.twCool.set(f, t - 1); }
    // fighters caught in the twister
    for (const [f, h] of st.held) {
      if (f.dead || f.state !== 'thrown') { st.held.delete(f); continue; }
      h.t++;
      const s = h.t / 60, r = (400 * s + 100) / 2, a = h.t * 30 * Math.PI / 180;
      f.x = h.x0 + Math.cos(a) * r; f.y = h.y0 + 500 * s; f.facing = Math.sin(a) > 0 ? 1 : -1;
      f.intangible = Math.max(f.intangible, 2);
      h.x0 += (T.x - h.x0) * 0.3;
      if (h.t >= 60) {
        st.held.delete(f); st.twCool.set(f, 60);
        f.setState('fall'); f.grounded = false; f.ground = null; f.intangible = 0;
        const res = f.takeHit({ ...THROW, attacker: null, lr: f.facing || 1, hazard: true });
        m.emit('hit', { f, a: null, x: f.x, y: f.y + f.H * 0.5, dmg: THROW.damage, kb: res.kb, element: 'normal' });
      }
    }
    if (m.phase !== 'play') return;
    T.age++;
    if (T.state === 'wait') {
      if (--T.t <= 0) {
        const pts = data.mapObjects.twister;
        const [px, py] = pts[rand(pts.length)];
        const fl = floorUnder(m.col, px, py);
        if (!fl) { T.t = 60; return; }
        T.floor = fl; T.x = px; T.y = floorY(fl, px); T.state = 'summon'; T.t = 80; T.dir = Math.random() < 0.5 ? -1 : 1;
        m.emit('sfx', { name: 'whiffL' });
      }
      return;
    }
    if (T.state === 'summon') { if (--T.t <= 0) { T.state = 'move'; T.life = 520 + rand(600); T.check = 180 + rand(120); T.speed = 10; T.dash = 0; T.pause = 0; } }
    else if (T.state === 'move') {
      const [lo, hi] = lineRange(m.col, T.floor);
      if (T.pause > 0) { if (--T.pause === 0) T.dir = -T.dir; }
      else {
        T.x += T.dir * T.speed;
        if (T.x <= lo || T.x >= hi) { T.x = Math.max(lo, Math.min(hi, T.x)); T.pause = 120; T.dash = 0; T.speed = 10; }
      }
      if (T.dash > 0 && --T.dash === 0) T.speed = 10;
      if (--T.check <= 0) {
        T.check = 180 + rand(120);
        const on = m.fighters.filter(f => !f.dead && f.grounded && f.ground === T.floor);
        if (on.length && rand(5) === 0) {
          const left = on.filter(f => f.x < T.x).length, right = on.length - left;
          T.dir = right >= left ? 1 : -1; T.speed = 50; T.dash = 300 + rand(180); T.pause = 0;
        }
      }
      T.y = floorY(T.floor, T.x) ?? T.y;
      if (--T.life <= 0) { T.state = 'subside'; T.t = 32; }
      // catch
      for (const f of m.fighters) {
        if (f.dead || f.state === 'respawn' || f.state === 'thrown' || st.held.has(f) || st.twCool.has(f) || f.intangible > 0 || f.grabbedBy || f.grabbing) continue;
        const dy = f.y - T.y;
        if (Math.abs(f.x - T.x) < 300 && dy > -300 && dy < 600) {
          if (f.ledge) f.leaveLedge?.();
          f.setState('thrown'); f.grounded = false; f.ground = null; f.vx = f.vy = f.kbx = f.kby = 0; f.kbGround = 0;
          st.held.set(f, { t: 0, x0: T.x, y0: f.y });
          m.emit('sfx', { name: 'whiff' });
        }
      }
    } else if (T.state === 'subside') { if (--T.t <= 0) { T.state = 'wait'; T.t = 1600 + rand(1200); T.y = -99999; } }
  },
  build(scene, rs, d, st) { return buildHyrule(scene, rs, d, st); },
  sync(obj, m, rs, st) { syncHyrule(obj, m, rs, st); },
});
