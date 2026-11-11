// Pikachu specials (decomp: src/ft/ftchar/ftpikachu/*.c, reference/spec/chars/pikachu.json `behavior`).
import * as THREE from 'three';
import { Projectile } from '../game/projectile.js';
import { P as POSES } from '../render/anims.js';
import { lerpPose, sampleKeys } from '../render/rig.js';

const S = 80;
const PI = Math.PI;
const sign = v => (v > 0 ? 1 : v < 0 ? -1 : 0);
const keyAnim = (keys) => (f, mf) => sampleKeys(keys, mf);

// ---------------- surface walking (Thunder Jolt ground wave) ----------------
// Collision segments with outward normals: floors (up), walls (toward nx), ceilings (down).
function segments(col) {
  const out = [];
  const norm = (a, b, want) => {
    const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1;
    let nx = -dy / L, ny = dx / L;
    if (nx * want[0] + ny * want[1] < 0) { nx = -nx; ny = -ny; }
    return [nx, ny];
  };
  for (const f of col.floors) {
    if (!f.active) continue;
    for (let i = 0; i < f.pts.length - 1; i++) out.push({ a: f.pts[i], b: f.pts[i + 1], n: norm(f.pts[i], f.pts[i + 1], [0, 1]), floor: f, kind: 'floor' });
  }
  for (const w of col.walls) if (w.group.active) out.push({ a: w.a, b: w.b, n: norm(w.a, w.b, [w.nx, 0]), kind: 'wall' });
  for (const c of col.ceils) if (c.group.active) out.push({ a: c.a, b: c.b, n: norm(c.a, c.b, [0, -1]), kind: 'ceil' });
  return out.filter(s => Math.hypot(s.b[0] - s.a[0], s.b[1] - s.a[1]) > 1);
}
const near = (p, q, d = 14) => Math.abs(p[0] - q[0]) <= d && Math.abs(p[1] - q[1]) <= d;
// crawl state: { seg, from (start point), to (end point), s }
function crawlState(seg, fromA, s) { return { seg, from: fromA ? seg.a : seg.b, to: fromA ? seg.b : seg.a, s }; }
function crawlDir(c) { const dx = c.to[0] - c.from[0], dy = c.to[1] - c.from[1], L = Math.hypot(dx, dy) || 1; return [dx / L, dy / L, L]; }

// ---------------- Thunder Jolt ----------------
// Frame 21: ball from the head joint at -45 deg, 40 u/f, no gravity (10% / 361 / bkb 50 / kbg 30, r 100).
// Touching a floor or wall turns it into the ground wave crawling the surface at 55 u/f around corners
// (turn < 100 deg), 7% / 361 / bkb 10 / kbg 20, r 100 centred 100 off the surface. Shared life 100.
export const JOLT = { SPAWN: 21, ANG: -45, V: 40, WAVE_V: 55, LIFE: 100, OFF: 100 };
const AIR_HB = { damage: 10, angle: 361, bkb: 50, kbg: 30, fkb: 0, element: 'electric', shieldDmg: 0 };
const WAVE_HB = { damage: 7, angle: 361, bkb: 10, kbg: 20, fkb: 0, element: 'electric', shieldDmg: 0 };
export function thunderJolt() {
  const J = JOLT;
  const pose = { ...POSES.idle, root: [0, -0.06, 0], spine: [0.45, 0, 0], neck: [-0.2, 0, 0], head: [0.1, 0, 0], upperArmL: [-0.8, 0, 0.5], upperArmR: [-0.8, 0, -0.5], thighL: [-0.7, 0, 0.1], thighR: [-0.7, 0, -0.1], shinL: [1.0, 0, 0], shinR: [1.0, 0, 0] };
  const pose2 = { ...pose, spine: [0.75, 0, 0], head: [0.3, 0, 0], root: [0, -0.09, 0] };
  return {
    total: 63, groundOK: true, keepOnFall: true, sfx: null, hitboxes: [],
    anim: keyAnim([{ f: 0, pose: POSES.idle }, { f: 14, pose }, { f: 21, pose: pose2 }, { f: 30, pose: pose2 }, { f: 63, pose: POSES.idle }]),
    script(f, mf) {
      if (mf === J.SPAWN) spawnJolt(f);
    },
  };
}
function spawnJolt(f) {
  const J = JOLT, m = f.match;
  const a = J.ANG * PI / 180;
  const p = new Projectile(m, f, {
    kind: 'thunderjolt', x: f.x + f.facing * f.H * 0.25, y: f.y + f.H * 0.6, vx: Math.cos(a) * J.V * f.facing, vy: Math.sin(a) * J.V,
    life: J.LIFE, r: 100, hb: AIR_HB, bounce: 0, wallStop: false,
    makeView: (scene) => joltView(scene),
  });
  p.wave = null;
  const toWave = (seg, x, y) => {
    // pick the travel direction closest to the current motion
    const [ax, ay] = seg.a, [bx, by] = seg.b;
    const dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy);
    const along = ((x - ax) * dx + (y - ay) * dy) / L;
    let fromA = (p.vx * dx + p.vy * dy) >= 0;
    if (Math.abs(p.vx * dx + p.vy * dy) < 1e-3) fromA = (p.facing > 0) === (dx >= 0);
    p.wave = crawlState(seg, fromA, fromA ? along : L - along);
    p.hb = { ...p.hb, ...WAVE_HB }; p.r = 100;
    placeWave(p);
  };
  p.onLand = (pp, land) => {
    const segs = segments(m.col);
    const seg = segs.find(s => s.floor === land.floor && land.x >= Math.min(s.a[0], s.b[0]) - 1 && land.x <= Math.max(s.a[0], s.b[0]) + 1);
    if (seg) toWave(seg, land.x, land.y); else pp.die();
  };
  p.onWall = (pp) => {
    const segs = segments(m.col).filter(s => s.kind === 'wall');
    let best = null, bd = 1e9;
    for (const s of segs) { const d = distToSeg(pp.x, pp.y, s.a, s.b); if (d < bd) { bd = d; best = s; } }
    if (best && bd < 250) { pp.vy = -1; pp.vx = 0; toWave(best, pp.x, pp.y); } else pp.die();
  };
  p.onUpdate = (pp, mm) => {
    if (!pp.wave) return true;
    const w = pp.wave;
    w.s += J.WAVE_V;
    let guard = 0;
    for (;;) {
      const [, , L] = crawlDir(w);
      if (w.s <= L || guard++ > 6) break;
      const over = w.s - L, end = w.to, [ux, uy] = crawlDir(w);
      // next connected surface with the smallest turn (< 100 deg)
      let best = null, bestTurn = 1e9;
      for (const s of segments(mm.col)) {
        if (s.a === w.seg.a && s.b === w.seg.b) continue;
        for (const fromA of [true, false]) {
          const st = fromA ? s.a : s.b, en = fromA ? s.b : s.a;
          if (!near(st, end)) continue;
          const dx = en[0] - st[0], dy = en[1] - st[1], L2 = Math.hypot(dx, dy);
          const dot = (ux * dx + uy * dy) / L2;
          const turn = Math.acos(Math.max(-1, Math.min(1, dot)));
          const nd = s.n[0] * w.seg.n[0] + s.n[1] * w.seg.n[1];
          if (turn < 100 * PI / 180 && nd > Math.cos(100 * PI / 180) && turn < bestTurn) { bestTurn = turn; best = crawlState(s, fromA, over); }
        }
      }
      if (!best) {
        // nothing to wrap onto: drop off as the air ball
        pp.wave = null; pp.hb = { ...pp.hb, ...AIR_HB };
        const sx = sign(ux) || pp.facing;
        pp.x = end[0] + w.seg.n[0] * 40; pp.y = end[1] + w.seg.n[1] * 40;
        pp.vx = Math.cos(J.ANG * PI / 180) * J.V * sx; pp.vy = Math.sin(J.ANG * PI / 180) * J.V;
        return checkLife(pp, mm);
      }
      pp.wave = best;
      Object.assign(w, best);
    }
    placeWave(pp);
    return checkLife(pp, mm);
  };
  p.reflect = function (v) {
    Projectile.prototype.reflect.call(this, v);
    if (this.wave) { const w = this.wave; const t = w.from; w.from = w.to; w.to = t; w.s = crawlDir(w)[2] - w.s; }
  };
  p.updateView = (v, t) => {
    v.rotation.z = t * 0.6;
    const k = p.wave ? 1 + 0.15 * Math.abs(Math.sin(t * 0.5)) : 1;
    v.scale.setScalar(k);
  };
  m.spawnProjectile(p);
  m.emit('sfx', { name: 'elec' });
}
function checkLife(pp, mm) {
  if (pp.t >= pp.life) { pp.die(); return false; }
  const bz = mm.stage.blast;
  if (pp.x < bz.left || pp.x > bz.right || pp.y < bz.bottom || pp.y > bz.top) pp.dead = true;
  return false;
}
function placeWave(p) {
  const w = p.wave, [ux, uy] = crawlDir(w);
  const hop = Math.abs(Math.sin(p.t * 0.45)) * 30;
  p.x = w.from[0] + ux * w.s + w.seg.n[0] * (JOLT.OFF + hop * 0);
  p.y = w.from[1] + uy * w.s + w.seg.n[1] * JOLT.OFF;
  p.vx = ux * JOLT.WAVE_V; p.vy = uy * JOLT.WAVE_V;
  p.facing = sign(p.vx) || p.facing;
}
function distToSeg(x, y, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1], L2 = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / L2));
  return Math.hypot(x - (a[0] + dx * t), y - (a[1] + dy * t));
}
function joltView(scene) {
  const g = new THREE.Group();
  const add = (c, o) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: o, depthWrite: false, blending: THREE.AdditiveBlending });
  g.add(new THREE.Mesh(new THREE.SphereGeometry(0.75, 9, 7), add(0xffe040, 0.6)));
  g.add(new THREE.Mesh(new THREE.SphereGeometry(0.45, 8, 6), add(0xffffff, 0.9)));
  for (let i = 0; i < 6; i++) { const c = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.9, 3), add(0xfff080, 0.9)); const a = i / 6 * PI * 2; c.position.set(Math.cos(a) * 0.7, Math.sin(a) * 0.7, 0); c.rotation.z = a - PI / 2; g.add(c); }
  scene.add(g); return g;
}

// ---------------- Quick Attack ----------------
// Frames 1-20: intangible start, velocity zeroed; air: gravity 0.8, x friction. Frame 21: zip along the stick
// (|stick| < 60 -> straight up at full speed) at 3*|stick|+90 u/f for 5 frames (grounded along the floor when
// the stick points along/into it). End phase (45 frames): velocity x0.2; first 8 frames vy -= vy/9; end
// frame 9 reads the stick once: |stick| >= 60 and > 42 deg from the first zip -> second zip at x0.9.
// Air end -> special fall (drift x0.4, landing 20).
export const QA = { START: 20, ZIP: 5, END: 45, READ: 9, MIN: 60, DIFF: 42, BASE: 3, ADD: 90, MUL: 0.9, BAK: 0.2, YDIV: 9, LAND: 20, DRIFT: 0.4 };
const QA_START = { ...POSES.crouch, root: [0, -0.1, 0], spine: [0.6, 0, 0], neck: [-0.3, 0, 0], extra1: [0.3, 0, 0] };
const QA_ZIP = { spine: [0, 0, 0], neck: [0, 0, 0], upperArmL: [0.6, 0, 0.2], upperArmR: [0.6, 0, -0.2], thighL: [0.6, 0, 0], thighR: [0.6, 0, 0], shinL: [0.2, 0, 0], shinR: [0.2, 0, 0], extra1: [-0.5, 0, 0] };
function qaAnim(f, mf) {
  const v = f.vars ?? {};
  if (!v.phase || v.phase === 'start') return lerpPose(POSES.idle, QA_START, Math.min(1, mf / 4));
  if (v.phase === 'zip') {
    const ang = v.ang ?? PI / 2, th = PI / 2 - ang;
    return { ...QA_ZIP, body: [th, 0, 0], root: [0, 0.4 - 0.4 * Math.cos(th), -0.4 * Math.sin(th)], scale: [0.8, 0.8, 1.2] };
  }
  const k = Math.min(1, (v.et ?? 0) / 12);
  return lerpPose({ ...POSES.fall, spine: [-0.3, 0, 0] }, f.grounded ? POSES.idle : POSES.fall, k);
}
export function quickAttack() {
  return {
    total: 999, groundOK: true, keepOnFall: true, keepVel: true, noAirFriction: true, hitboxes: [], sfx: 'dash',
    ledgeGrab: true, ledgeGrabFrom: QA.START + 1, ledgeGrabRising: true,
    anim: qaAnim,
    onStart(f) { f.vx = 0; f.vy = 0; f.fastfall = false; f.vars.phase = 'start'; f.vars.sub = false; },
    script(f, mf, c) {
      const v = f.vars;
      if (v.phase === 'start') {
        if (mf <= QA.START) f.intangible = Math.max(f.intangible, 1);
        if (f.grounded) { f.vx = 0; }
        else { f.gravMul = 0.8 / f.a.gravity; f.airFriction(); }
        if (mf > QA.START) zip(f, c);
        return;
      }
      if (v.phase === 'zip') {
        f.noGravity = true;
        // stopped by a wall / ceiling
        const blocked = (Math.abs(v.zvx) > 1 && Math.abs(f.vx) < 1e-6) || (v.zvy > 1 && f.vy <= 0 && !f.grounded);
        if (!f.grounded && !blocked) { f.vx = v.zvx; f.vy = v.zvy; }
        if (f.grounded && !blocked) { f.vx = v.zvx; f.vy = 0; }
        if (--v.zt <= 0 || blocked) endPhase(f);
        return;
      }
      // end phase
      v.et++;
      if (v.et === QA.READ) {
        const sx = c.x * S, sy = c.y * S, mag = Math.hypot(sx, sy);
        if (!v.sub && mag >= QA.MIN) {
          const a0 = Math.atan2(v.stick[1], v.stick[0]), a1 = Math.atan2(sy, sx);
          let d = Math.abs(a1 - a0); if (d > PI) d = 2 * PI - d;
          if (d > QA.DIFF * PI / 180) { v.sub = true; zip(f, c); return; }
        }
        v.read = true;
      }
      if (f.grounded) { if (v.read) f.friction(); }
      else if (!v.read) { f.noGravity = true; f.vy -= f.vy / QA.YDIV; f.airFriction(); }
      else { f.noGravity = false; f.gravMul = 1; f.airDrift(c, 0.5); }
      if (v.et >= QA.END) {
        if (f.grounded) f.endMove();
        else { f.helplessLag = QA.LAND; f.helplessDrift = QA.DRIFT; f.setState('helpless'); f.jumpsUsed = f.a.jumps; }
      }
    },
    landHook(f) {
      const v = f.vars;
      if (v.phase === 'start') return false;
      if (v.phase === 'zip') {
        const m = Math.hypot(v.zvx, v.zvy) || 1;
        if (-v.zvy / m > Math.cos((180 - 135) * PI / 180)) { endPhase(f); return true; }   // steep into the floor: stop
        v.zvy = 0; return false;                                                              // continue along the floor
      }
      f.setState('landing'); f.landLag = QA.LAND; f.landKind = 'special';
      return true;
    },
  };
}
function zip(f, c) {
  const v = f.vars;
  let sx = c.x * S, sy = c.y * S, mag = Math.min(80, Math.hypot(sx, sy));
  const mul = v.sub ? QA.MUL : 1;
  f.jumpsUsed = f.a.jumps;
  v.phase = 'zip'; v.zt = QA.ZIP;
  f.gravMul = 1;
  if (f.grounded && mag >= QA.MIN && !f.ground?.pass && sy <= 0) {
    if (sx) f.facing = sign(sx);
    v.stick = [sx, sy]; v.ang = 0;
    v.zvx = (QA.BASE * mag + QA.ADD) * mul * f.facing; v.zvy = 0;
    f.vx = v.zvx;
  } else {
    if (f.grounded) { f.grounded = false; f.ground = null; f.y += 1; }
    if (sx) f.facing = sign(sx);
    let ang;
    if (mag > QA.MIN) { ang = Math.atan2(sy, sx * f.facing); v.stick = [sx, sy]; }
    else { ang = PI / 2; mag = 80; v.stick = [0, 80]; }
    const spd = (QA.BASE * mag + QA.ADD) * mul;
    v.ang = ang; v.zvx = Math.cos(ang) * spd * f.facing; v.zvy = Math.sin(ang) * spd;
    f.vx = v.zvx; f.vy = v.zvy;
  }
  f.noGravity = true;
  f.match.emit('sfx', { name: 'dash' });
}
function endPhase(f) {
  const v = f.vars;
  v.phase = 'end'; v.et = 0; v.read = false;
  f.vx = v.zvx * QA.BAK; f.vy = f.grounded ? 0 : v.zvy * QA.BAK;
  f.noGravity = !f.grounded;
}

// ---------------- Thunder ----------------
// Frame 24: bolt spawns at the top of the camera bounds - 500 above Pikachu's head X, falls 450 u/f
// (12% electric, angle 70, bkb 80, kbg 50; not reflectable/absorbable; passes platforms, stops on solid
// ground). Reaching Pikachu (bolt y+225 within 200 x / 800 y) -> "thundered": 16% shockwave (361, bkb 100,
// kbg 60, r 350 at y+300) frames 1-9, 66 frames; air: vy +20, gravity 0.5.
export const THUNDER = { SPAWN: 24, VY: -450, OFF: 500, COLL_X: 200, COLL_Y: 800, COLL_OFF: 225 };
const TH_CALL = { ...POSES.idle, root: [0, -0.04, 0], spine: [-0.1, 0, 0], head: [-0.35, 0, 0], upperArmL: [-0.3, 0, 1.4], upperArmR: [-0.3, 0, -1.4], foreArmL: [-0.5, 0, 0], foreArmR: [-0.5, 0, 0],
  thighL: [-0.3, 0, 0.25], thighR: [-0.3, 0, -0.25], shinL: [0.5, 0, 0], shinR: [0.5, 0, 0], extra1: [0.3, 0, 0] };
export function thunder() {
  return {
    total: 78, groundOK: true, keepOnFall: true, drift: true, hitboxes: [], sfx: null,
    anim: keyAnim([{ f: 0, pose: POSES.idle }, { f: 10, pose: { ...TH_CALL, spine: [0.3, 0, 0], head: [0.2, 0, 0] } }, { f: 22, pose: TH_CALL }, { f: 60, pose: TH_CALL }, { f: 78, pose: POSES.idle }]),
    script(f, mf) {
      if (mf === THUNDER.SPAWN) spawnBolt(f);
    },
  };
}
export const thunderHit = {
  total: 66, groundOK: true, keepOnFall: true, sfx: null,
  hitboxes: [{ frames: [1, 9], damage: 16, angle: 361, bkb: 100, kbg: 60, fkb: 0, r: 350, size: 350, element: 'electric', ground: true, air: true, shieldDmg: 0, clank: false, pos: [0, 300] }],
  anim: keyAnim([{ f: 0, pose: { ...TH_CALL, upperArmL: [-0.2, 0, 2.2], upperArmR: [-0.2, 0, -2.2], head: [-0.5, 0, 0] } }, { f: 40, pose: TH_CALL }, { f: 66, pose: POSES.idle }]),
  onStart(f) { if (!f.grounded) { f.vy += 20; } f.match.emit('sfx', { name: 'elec' }); },
  script(f) { if (!f.grounded) f.gravMul = 0.5 / f.a.gravity; },
};
function spawnBolt(f) {
  const m = f.match, T = THUNDER;
  const top = (m.stage.cameraBounds?.top ?? m.stage.blast.top) - T.OFF;
  const x = f.x + f.facing * 10;
  const p = new Projectile(m, f, {
    kind: 'thunder', x, y: top, vx: 0, vy: 0, life: 200, r: 200, pierce: true, reflectable: false, absorbable: false, collide: false,
    hb: { damage: 12, angle: 70, bkb: 80, kbg: 50, fkb: 0, element: 'electric', shieldDmg: 0 },
    makeView: (scene) => boltView(scene),
  });
  p.y0 = top; p.fade = 0;
  p.onUpdate = (pp, mm) => {
    if (pp.fade > 0) { if (--pp.fade <= 0) pp.die(); return false; }
    const ny = pp.y + T.VY;
    // solid (non pass-through) ground stops the bolt
    let stop = null;
    for (const fl of mm.col.floors) {
      if (!fl.active || fl.pass) continue;
      const pts = fl.pts; if (pp.x < pts[0][0] || pp.x > pts[pts.length - 1][0]) continue;
      for (let i = 0; i < pts.length - 1; i++) if (pp.x >= pts[i][0] && pp.x <= pts[i + 1][0]) {
        const t = (pp.x - pts[i][0]) / Math.max(1e-6, pts[i + 1][0] - pts[i][0]);
        const fy = pts[i][1] + (pts[i + 1][1] - pts[i][1]) * t;
        if (fy <= pp.y && fy >= ny && (stop === null || fy > stop)) stop = fy;
      }
    }
    pp.y = stop !== null ? stop : ny;
    // reaching Pikachu?
    const o = pp.owner;
    if (o && !o.dead && o.state === 'attack' && (o.move?.id === 'dspecial' || o.move?.id === 'dspecialAir') && !o.vars.thundered) {
      const by = pp.y + T.COLL_OFF;
      if (Math.abs(pp.x - o.x) <= T.COLL_X && Math.abs(by - o.y) <= T.COLL_Y) {
        o.vars.thundered = true;
        o.startMove(o.def.moves.thunderHit);
        pp.hitbox = false; pp.fade = 6; pp.y = Math.max(pp.y, o.y + o.H * 0.6);
        return false;
      }
    }
    if (stop !== null) { pp.hitbox = false; pp.fade = 6; }
    if (pp.t >= pp.life || pp.y < mm.stage.blast.bottom) pp.die();
    return false;
  };
  p.updateView = (v, t) => {
    const len = Math.max(0.01, (p.y0 - p.y) * 0.01);
    v.userData.col.scale.set(1, len, 1);
    v.userData.col.position.y = len / 2;
    v.userData.col.material.opacity = p.fade > 0 ? 0.15 * p.fade : 0.55 + 0.3 * Math.sin(t * 2.3);
    v.userData.zig.forEach((z, i) => { z.position.y = (i / v.userData.zig.length) * len; z.visible = z.position.y < len; z.rotation.z = (i % 2 ? 0.6 : -0.6) + Math.sin(t + i) * 0.2; });
  };
  m.spawnProjectile(p);
  m.emit('sfx', { name: 'elec' });
}
function boltView(scene) {
  const g = new THREE.Group();
  const add = (c, o) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: o, depthWrite: false, blending: THREE.AdditiveBlending });
  const col = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1, 0.2), add(0xfff070, 0.6));
  g.add(col);
  const zig = [];
  for (let i = 0; i < 60; i++) { const z = new THREE.Mesh(new THREE.BoxGeometry(0.18, 1.6, 0.1), add(0xffffff, 0.9)); g.add(z); zig.push(z); }
  g.add(new THREE.Mesh(new THREE.SphereGeometry(1.1, 9, 7), add(0xffff90, 0.7)));
  g.userData = { col, zig };
  scene.add(g); return g;
}
