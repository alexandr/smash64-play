// Mushroom Kingdom — geometry from the decomp (reference/spec/stages.md), SMB1-style art, scale (pulley)
// platforms that snap, POW block quake, Piranha Plants and the two warp pipes.
// Game logic (init/update/hazardHitboxes) is DOM-free so it runs headless; build/sync do the three.js side.
import data0 from './data/mushroom_kingdom.js';
import { makeStage } from './common.js';
import { buildMushroomArt, syncMushroomArt } from './mushroom_art.js';

// The converter puts the cliff flag of floor 870..2652 on its right end; per the spec only x 870 borders
// the pit (the right end meets the right pipe), so mirror it.
const data = {
  ...data0,
  groups: data0.groups.map(g => ({ ...g, floors: g.floors.map(f => (f.pts[0][0] === 870 && f.pts[f.pts.length - 1][0] === 2652 ? { ...f, ledges: [true, false] } : f)) })),
};

const OBJ = data.mapObjects;
export const MK = {
  scaleBase: { 1: OBJ.scale_l[0], 2: OBJ.scale_r[0] },     // yak 1 = left, yak 2 = right
  pulleyY: 2100,
  pipes: {
    pipe_left: { x: OBJ.dokan_l[0][0], top: 2205, half: 252, to: 'pipe_right' },
    pipe_right: { x: OBJ.dokan_r[0][0], top: 240, half: 258, to: 'pipe_left' },
  },
  plants: [OBJ.pakkun_l[0], OBJ.pakkun_r[0]],
  pow: OBJ.pow_block,
  powHalf: 150,
};

const SNAP = 1100, PIPE_DETECT = 200;
const PLANT_RISE = 360, PLANT_SPEED = 8, PLANT_HEAD = 200, PLANT_R = 120;
const QUAKE_HB = { damage: 20, angle: 90, kbg: 130, bkb: 30, fkb: 0, element: 'normal', air: false, ground: true };
const PLANT_HB = { damage: 5, angle: 80, kbg: 80, bkb: 80, fkb: 0, element: 'normal' };
const rnd = n => Math.floor(Math.random() * n);

// distance from point to axis-aligned box (center cx,cy, half hw,hh)
function boxDist(px, py, cx, cy, hw, hh) {
  const dx = Math.max(0, Math.abs(px - cx) - hw), dy = Math.max(0, Math.abs(py - cy) - hh);
  return Math.hypot(dx, dy);
}
// Find an attack (fighter hitbox or projectile) touching a circle/box; returns { by, dmg } or null.
function findStrike(m, test, exclude) {
  for (const f of m.fighters) {
    if (f.dead || !f.activeHitboxes?.length) continue;
    for (const h of f.activeHitboxes) {
      if (h.hb.grab || exclude?.has(h)) continue;
      if (test(h.x, h.y, h.r) || test(h.px ?? h.x, h.py ?? h.y, h.r)) return { by: f, dmg: h.hb.damage ?? 0, h };
    }
  }
  for (const p of m.projectiles) {
    if (p.dead || !p.hitbox) continue;
    const h = p.worldHitbox();
    if (test(h.x, h.y, h.r)) return { by: p.owner, dmg: h.hb.damage ?? 0, proj: p };
  }
  return null;
}

export const mushroom = makeStage(data, {
  id: 'mushroom', series: 'mario', music: 'mushroom',
  init(m, st) {
    const gs = {}; for (const g of m.col.groups) gs[g.id] = g;
    st.mk = MK;
    st.scale = { gL: gs[1], gR: gs[2], alt: 0, accel: 0, state: 'normal', drop: 0, vel: 0, timer: 0, on: new Set(), rise: 0 };
    setScaleTargets(st);
    st.pow = { state: 'wait', t: 1800, x: 0, y: 0, quake: 0, hitter: null, done: new Set() };
    st.plants = MK.plants.map(([x, y], i) => ({ i, x, y, top: i === 0 ? MK.pipes.pipe_left.top : MK.pipes.pipe_right.top,
      state: 'wait', t: 180, rise: 0, hit: new Set(), bite: 0, kx: 0, ky: 0, vx: 0, vy: 0, cool: 0, used: new Set() }));
    st.warp = new Map(); st.pipeCool = new Map();
    st.pipeFloors = {};
    for (const f of m.col.floors) if (MK.pipes[f.material]) st.pipeFloors[f.material] = f;
    st.shake = 0;
  },
  update(m, st) {
    if (st.shake > 0) st.shake--;
    if (m.phase !== 'play') return;
    updateScale(m, st);
    updatePow(m, st);
    for (const p of st.plants) updatePlant(m, st, p);
    updatePipes(m, st);
  },
  hazardHitboxes(m, st) {
    const out = [];
    const pw = st.pow;
    if (pw.quake > 0) {
      for (const v of m.fighters) {
        if (v.dead || v === pw.hitter || !v.grounded || pw.done.has(v)) continue;
        const others = new Set(m.fighters.filter(o => o !== v));
        out.push({ hb: QUAKE_HB, x: v.x, y: v.y + v.H * 0.5, r: 60, hit: others, unblockable: true, ownerFighter: pw.hitter ?? undefined,
          onHit: vv => pw.done.add(vv) });
      }
    }
    for (const p of st.plants) {
      if (!['rise', 'up', 'sink'].includes(p.state) || p.rise < 150) continue;
      out.push({ hb: PLANT_HB, x: p.x, y: p.y + p.rise + PLANT_HEAD, r: PLANT_R, hit: p.hit, onHit: v => p.hit.add(v) });
    }
    return out;
  },
  build(scene, rs, d, st) { return buildMushroomArt(scene, rs, d, st); },
  sync(obj, m, rs, st) { syncMushroomArt(obj, m, rs, st); },
});

// ---------- scale (pulley) platforms ----------
function setScaleTargets(st) {
  const s = st.scale, bl = MK.scaleBase[1], br = MK.scaleBase[2];
  s.gL.target = [bl[0], bl[1] + s.alt - s.drop];
  s.gR.target = [br[0], br[1] - s.alt - s.drop];
}
function updateScale(m, st) {
  const s = st.scale;
  if (s.state === 'normal') {
    let L = 0, R = 0;
    const now = new Set();
    for (const f of m.fighters) {
      if (f.dead || !f.grounded || !f.ground) continue;
      const g = f.ground.group;
      if (g !== s.gL && g !== s.gR) continue;
      now.add(f);
      let p = 1 - (f.a.weight ?? 1) + 1.4;
      if (!s.on.has(f)) p *= 8;          // landing frame
      if (g === s.gL) L += p; else R += p;
    }
    s.on = now;
    if (L || R) {
      s.accel += R - L;
      if (L && R) s.accel *= 0.93;
      else s.accel = Math.abs(s.accel) <= 0.9 ? 0 : s.accel - Math.sign(s.accel) * 0.9;
      s.alt += s.accel;
    } else {
      s.accel = 0;
      s.alt = Math.abs(s.alt) <= 8 ? 0 : s.alt - Math.sign(s.alt) * 8;
    }
    if (Math.abs(s.alt) > SNAP) {
      s.state = 'fall'; s.vel = 0; s.drop = 0;
      m.emit('sfx', { name: 'shieldBreak' }); m.emit('scaleSnap', {});
    }
  } else if (s.state === 'fall') {
    s.vel = Math.min(70, s.vel + 3); s.drop += s.vel;
    const lowest = Math.min(MK.scaleBase[1][1] + s.alt, MK.scaleBase[2][1] - s.alt) - s.drop;
    if (lowest < m.stage.blast.bottom - 1000) { s.state = 'gone'; s.timer = 180; s.gL.active = s.gR.active = false; }
  } else if (s.state === 'gone') {
    if (--s.timer <= 0) {
      s.state = 'return'; s.alt = 0; s.accel = 0;
      s.drop = MK.scaleBase[1][1] - (m.stage.blast.bottom - 1000);
    }
  } else if (s.state === 'return') {
    s.drop = Math.max(0, s.drop - 10);
    if (s.drop <= 0) { s.state = 'normal'; s.gL.active = s.gR.active = true; s.on = new Set(); }
  }
  setScaleTargets(st);
}

// ---------- POW block ----------
function updatePow(m, st) {
  const pw = st.pow;
  if (pw.state === 'wait') {
    if (--pw.t <= 0) {
      const p = MK.pow[rnd(MK.pow.length)];
      pw.x = p[0]; pw.y = p[1]; pw.state = 'live'; pw.t = 0;
      m.emit('sfx', { name: 'item' });
    }
  } else if (pw.state === 'live') {
    pw.t++;
    const hit = findStrike(m, (x, y, r) => boxDist(x, y, pw.x, pw.y, MK.powHalf, MK.powHalf) <= r);
    if (hit) {
      if (hit.proj) hit.proj.die();
      pw.state = 'quake'; pw.quake = 2; pw.hitter = hit.by ?? null; pw.done = new Set(); pw.t = 0;
      st.shake = 40;
      m.emit('sfx', { name: 'explode' }); m.emit('pow', { x: pw.x, y: pw.y, by: hit.by });
    }
  } else if (pw.state === 'quake') {
    pw.t++;
    if (pw.quake > 0) pw.quake--;
    if (pw.t >= 30) { pw.state = 'wait'; pw.t = 1800; pw.hitter = null; }
  }
}

// ---------- Piranha Plants ----------
function updatePlant(m, st, p) {
  if (p.cool > 0) p.cool--;
  p.bite++;
  switch (p.state) {
    case 'wait':
      if (--p.t <= 0) {
        const near = m.fighters.some(f => !f.dead && Math.abs(f.x - p.x) <= 300 && f.y >= p.top - 300 && f.y <= p.top + 700);
        if (near) p.t = 20; else { p.state = 'rise'; p.hit.clear(); }
      }
      break;
    case 'rise': p.rise = Math.min(PLANT_RISE, p.rise + PLANT_SPEED); if (p.rise >= PLANT_RISE) { p.state = 'up'; p.t = 150; } break;
    case 'up': if (--p.t <= 0) p.state = 'sink'; if (p.t % 50 === 0) p.hit.clear(); break;
    case 'sink': case 'hurt':
      p.rise = Math.max(0, p.rise - (p.state === 'hurt' ? 20 : PLANT_SPEED));
      if (p.rise <= 0) { p.state = 'wait'; p.t = 180; }
      break;
    case 'ko':
      p.vy -= 2.5; p.kx += p.vx; p.ky += p.vy;
      if (p.y + p.ky < m.stage.blast.bottom || Math.abs(p.x + p.kx) > m.stage.blast.right || p.y + p.ky > m.stage.blast.top) { p.state = 'dead'; p.t = 1200; }
      break;
    case 'dead': if (--p.t <= 0) { p.state = 'wait'; p.t = 180; p.rise = 0; p.kx = p.ky = 0; } break;
  }
  // the plant can be attacked while out of its pipe
  if (['rise', 'up', 'sink'].includes(p.state) && p.rise > 150 && p.cool <= 0) {
    const hy = p.y + p.rise + PLANT_HEAD;
    const s = findStrike(m, (x, y, r) => Math.hypot(x - p.x, y - hy) <= r + PLANT_R);
    if (s && s.by) {
      if (s.proj) s.proj.die();
      p.cool = 20;
      m.emit('sfx', { name: 'hitM' });
      if (s.dmg >= 12) { p.state = 'ko'; p.vx = Math.sign(p.x - s.by.x || 1) * 35; p.vy = 55; p.kx = 0; p.ky = 0; }
      else p.state = 'hurt';
    }
  }
}

// ---------- warp pipes ----------
const ENTER_STATES = new Set(['idle', 'squat', 'squatwait', 'squatrv', 'walk', 'turn', 'landing']);
function updatePipes(m, st) {
  for (const f of m.fighters) {
    const w = st.warp.get(f);
    if (w) { stepWarp(m, st, f, w); continue; }
    const c = st.pipeCool.get(f) ?? 0;
    if (c > 0) { st.pipeCool.set(f, c - 1); continue; }
    if (f.dead || !f.grounded || !f.ground || f.hitlag > 0) continue;
    const pipe = MK.pipes[f.ground.material];
    if (!pipe || !ENTER_STATES.has(f.state)) continue;
    if ((f.ctrl?.y ?? 0) * 80 > -53 || Math.abs(f.x - pipe.x) > PIPE_DETECT) continue;
    // enter
    const ww = { phase: 'in', t: 0, from: pipe, to: MK.pipes[pipe.to], toKey: pipe.to, x0: f.x };
    st.warp.set(f, ww);
    f.setState('idle'); f.state = 'dokan';
    f.noPhysics = true; f.untouchable = true;
    f.vx = f.vy = f.kbx = f.kby = 0; f.kbGround = 0;
    f.grounded = false; f.ground = null;
    m.emit('sfx', { name: 'fall' }); m.emit('pipe', { f, from: ww.to === MK.pipes.pipe_left ? 'pipe_right' : 'pipe_left' });
  }
}
function endWarp(st, f, ok) {
  st.warp.delete(f);
  f.noPhysics = false; f.untouchable = false;
  st.pipeCool.set(f, 20);
  if (!ok) return;
}
function stepWarp(m, st, f, w) {
  if (f.dead || f.state !== 'dokan') { endWarp(st, f, false); return; }
  w.t++;
  const H = f.H;
  if (w.phase === 'in') {
    const k = Math.min(1, w.t / 30);
    f.x = w.x0 + (w.from.x - w.x0) * Math.min(1, w.t / 8);
    f.y = w.from.top - (H + 60) * k;
    if (w.t >= 30) { w.phase = 'travel'; w.t = 0; }
  } else if (w.phase === 'travel') {
    f.x = w.to.x; f.y = w.to.top - H - 220;
    if (w.t >= 40) { w.phase = 'out'; w.t = 0; m.emit('sfx', { name: 'jump2' }); }
  } else if (w.phase === 'out') {
    const k = Math.min(1, w.t / 30);
    f.x = w.to.x; f.y = w.to.top - (H + 60) * (1 - k);
    if (w.t >= 30) {
      endWarp(st, f, true);
      f.setState('idle');
      f.x = w.to.x; f.y = w.to.top;
      const fl = st.pipeFloors[w.toKey];
      if (fl) { f.grounded = true; f.ground = fl; } else f.setState('fall');
      st.pipeCool.set(f, 60);
    }
  }
}
