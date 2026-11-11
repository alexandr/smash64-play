// Ness specials (decomp: src/ft/ftchar/ftness/*.c, src/it/itfighter/itnesspkfire.c, reference/spec/chars/ness.json).
import * as THREE from 'three';
import { Projectile } from '../game/projectile.js';
import { P as POSES } from '../render/anims.js';
import { lerpPose, sampleKeys } from '../render/rig.js';

const S = 80;
const PI = Math.PI;
const D2R = PI / 180;
const sign = v => (v > 0 ? 1 : v < 0 ? -1 : 0);
const keyAnim = (keys) => (f, mf) => sampleKeys(keys, mf);
const basic = (c, o = 1, add = true) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: o, depthWrite: false, blending: add ? THREE.AdditiveBlending : THREE.NormalBlending });

// ---------------- PK Fire ----------------
// Frame 20: spark from TopN + (100 fwd, 180 up). Ground 73 u/f at -3.6 deg, air 95 u/f at -38 deg; life 20,
// no gravity; 4% fire (angle 80, bkb 40, kbg 50, r 100). Only when it hits (fighter or shield) is it replaced
// by a pillar 160 further along its path: falls (gravity 0.45, max 55), lives 100 frames, 3% fire hitboxes
// at y+100 / y+350 (angle 70, bkb 4, kbg 10, r 100) re-hitting every 16 frames, shrinking with age
// (scale = life/200 + 0.5); attacks on it cut its life by 3x their damage.
export const PKFIRE = { SPAWN: 20, GV: 73, GA: -3.6, AV: 95, AA: -38, LIFE: 20, AHEAD: 160, PLIFE: 100, PGRAV: 0.45, PTVEL: 55, REHIT: 16, HURT: 3 };
const PKF_POSE = { ...POSES.idle, spine: [0.1, -0.5, 0], upperArmR: [-1.45, 0, -0.05], foreArmR: [-0.1, 0, 0], handR: [0.5, 0, 0], upperArmL: [-0.3, 0, 0.6], foreArmL: [-0.8, 0, 0],
  thighL: [-0.5, 0, 0.1], shinL: [0.6, 0, 0], thighR: [0.2, 0, -0.1], shinR: [0.3, 0, 0] };
const PKF_WIND = { ...POSES.idle, spine: [0.05, 0.6, 0], upperArmR: [0.4, 0, -0.5], foreArmR: [-1.4, 0, 0], upperArmL: [-0.4, 0, 0.5], foreArmL: [-1.2, 0, 0] };
export function pkFire(air) {
  const total = air ? 60 : 71;
  return {
    total, groundOK: true, keepOnFall: true, drift: !!air, hitboxes: [], sfx: null,
    anim: keyAnim([{ f: 0, pose: air ? POSES.fall : POSES.idle }, { f: 12, pose: PKF_WIND }, { f: 20, pose: PKF_POSE }, { f: 34, pose: PKF_POSE }, { f: total, pose: air ? POSES.fall : POSES.idle }]),
    script(f, mf) { if (mf === PKFIRE.SPAWN) spawnSpark(f); },
  };
}
function spawnSpark(f) {
  const K = PKFIRE, m = f.match, air = !f.grounded;
  const a = (air ? K.AA : K.GA) * D2R, v = air ? K.AV : K.GV;
  const p = new Projectile(m, f, {
    kind: 'pkfire', x: f.x + f.facing * 100, y: f.y + 180, vx: Math.cos(a) * v * f.facing, vy: Math.sin(a) * v,
    life: K.LIFE, r: 100, floorDie: true, wallStop: true,
    hb: { damage: 4, angle: 80, bkb: 40, kbg: 50, fkb: 0, element: 'fire', shieldDmg: 1 },
    makeView: (scene) => sparkView(scene),
  });
  p.onHitHook = (pp, v, shield) => {
    const sp = Math.hypot(pp.vx, pp.vy) || 1;
    spawnPillar(pp.owner, pp.x + pp.vx / sp * K.AHEAD, pp.y + pp.vy / sp * K.AHEAD, pp.moveId);
    pp.die();
  };
  p.updateView = (vv, t) => { vv.rotation.z = Math.atan2(p.vy, p.vx); vv.scale.setScalar(0.8 + 0.2 * Math.sin(t * 1.3)); };
  m.spawnProjectile(p);
  m.emit('sfx', { name: 'fire' });
}
function spawnPillar(owner, x, y, moveId) {
  const K = PKFIRE, m = owner.match;
  // one projectile whose hitbox is the capsule between the two decomp hitboxes (y+100 .. y+350, r 100),
  // so a victim inside both is hit once per re-hit period
  const p = new Projectile(m, owner, {
    kind: 'pkfirepillar', x, y: y + 100, vx: 0, vy: 0, life: 1e9, r: 100, pierce: true, reflectable: false, absorbable: false, collide: false, moveId,
    hb: { damage: 3, angle: 70, bkb: 4, kbg: 10, fkb: 0, element: 'fire', shieldDmg: 0 },
    makeView: (scene) => pillarView(scene),
  });
  p.plife = K.PLIFE; p.fy = y; p.fvy = 0; p.landed = false; p.seen = new Set(); p.at = new Map(); p.k = 1;
  p.worldHitbox = function () { return { hb: this.hb, x: this.x, y: this.fy + 350 * this.k, px: this.x, py: this.fy + 100 * this.k, r: this.r }; };
  p.onHitHook = (pp, v) => { pp.at.set(v, pp.t); };
  p.onUpdate = (pp, mm) => {
    // fall onto the floor below
    if (!pp.landed) {
      pp.fvy = Math.max(-K.PTVEL, pp.fvy - K.PGRAV);
      const ny = pp.fy + pp.fvy;
      let best = null;
      for (const fl of mm.col.floors) {
        if (!fl.active) continue;
        const pts = fl.pts; if (pp.x < pts[0][0] || pp.x > pts[pts.length - 1][0]) continue;
        for (let i = 0; i < pts.length - 1; i++) if (pp.x >= pts[i][0] && pp.x <= pts[i + 1][0]) {
          const t = (pp.x - pts[i][0]) / Math.max(1e-6, pts[i + 1][0] - pts[i][0]);
          const fy = pts[i][1] + (pts[i + 1][1] - pts[i][1]) * t;
          if (fy <= pp.fy + 1 && fy >= ny && (best === null || fy > best)) best = fy;
        }
      }
      if (best !== null) { pp.fy = best; pp.landed = true; pp.fvy = 0; } else pp.fy = ny;
    } else if (pp.landFloor === undefined) pp.landFloor = null;
    // attacks on the pillar shorten its life
    for (const f of mm.fighters) {
      if (f === pp.owner || f.dead) continue;
      for (const h of f.activeHitboxes) {
        if (h.hb.grab) continue;
        const key = f.moveUse + ':' + h.idx;
        if (pp.seen.has(key)) continue;
        if (Math.hypot(h.x - pp.x, h.y - (pp.fy + 220 * pp.k)) <= h.r + 180 * pp.k) { pp.seen.add(key); pp.plife -= h.hb.damage * K.HURT; }
      }
    }
    pp.plife--;
    if (pp.plife < 0 || pp.fy < mm.stage.blast.bottom) { pp.die(); return false; }
    // shrink with age (scale = life/200 + 0.5); per-victim re-hit timer
    pp.k = (pp.plife * 0.5) / 100 + 0.5;
    pp.r = 100 * pp.k;
    pp.y = pp.fy + 100 * pp.k;
    for (const [v, t0] of pp.at) if (pp.t - t0 >= K.REHIT) { pp.at.delete(v); pp.hit.delete(v); }
    return false;
  };
  p.updateView = (v, t) => {
    v.position.y = p.fy * 0.01;
    v.scale.setScalar(p.k);
    v.children.forEach((c, i) => { c.scale.y = 0.8 + 0.35 * Math.abs(Math.sin(t * 0.5 + i * 1.3)); });
  };
  m.spawnProjectile(p);
}
function sparkView(scene) {
  const g = new THREE.Group();
  const c = new THREE.Mesh(new THREE.ConeGeometry(0.35, 1.1, 5), basic(0xff8020, 0.9)); c.rotation.z = -PI / 2; g.add(c);
  g.add(new THREE.Mesh(new THREE.SphereGeometry(0.35, 7, 5), basic(0xfff080, 0.9)));
  scene.add(g); return g;
}
function pillarView(scene) {
  const g = new THREE.Group();
  for (let i = 0; i < 7; i++) {
    const a = i / 7 * PI * 2, h = 2.4 + (i % 3) * 0.8;
    const c = new THREE.Mesh(new THREE.ConeGeometry(0.55, h, 5), basic(i % 2 ? 0xffb020 : 0xff4010, 0.75, false));
    c.geometry.translate(0, h / 2, 0);
    c.position.set(Math.cos(a) * 0.45, 0, Math.sin(a) * 0.45); g.add(c);
  }
  const core = new THREE.Mesh(new THREE.ConeGeometry(0.6, 4.2, 6), basic(0xffe060, 0.5)); core.geometry.translate(0, 2.1, 0); g.add(core);
  scene.add(g); return g;
}

// ---------------- PK Thunder ----------------
// Ball from the head (joint 12) on frame 23 moving up at 60 u/f, steered by the stick (|stick| >= 45: turn
// 6 deg/frame toward it, or diff/7.5 when within 45 deg); life 160, dies on terrain. Head 6% (angle 100,
// bkb 50, kbg 30, r 75, electric, reflectable/absorbable), tail 3% r 50 (not). Ness is frozen while it lives
// (air: vy=0, vx/2, gravity 0.5 after 25 frames). After 30 frames, the ball within 250 x / 370 y of
// Ness+150 launches him away from it (PK Thunder 2). Otherwise: 30 more frames, end anim, special fall
// (drift x0.6, landing lag ~42).
export const PKT = { SPAWN: 23, V: 60, LIFE: 160, TURN: 6, NEAR: 45, DIV: 7.5, MIN: 45, DELAY: 30, CX: 250, CY: 370, OY: 150, END_DELAY: 30, END: 14, GRAV_DELAY: 25, GRAV: 0.5, DRIFT: 0.6, LAND: 42 };
const PKT_POSE = { ...POSES.idle, spine: [-0.05, 0, 0], head: [-0.25, 0, 0], upperArmL: [-0.4, 0, 2.5], upperArmR: [-0.4, 0, -2.5], foreArmL: [-0.5, 0, 0], foreArmR: [-0.5, 0, 0],
  thighL: [-0.2, 0, 0.15], thighR: [-0.2, 0, -0.15], shinL: [0.3, 0, 0], shinR: [0.3, 0, 0] };
export function pkThunder() {
  return {
    total: 9999, groundOK: true, keepOnFall: true, noAirFriction: true, hitboxes: [], sfx: null,
    helpless: true, helplessDrift: PKT.DRIFT, helplessLand: PKT.LAND,
    anim: (f, mf) => {
      const v = f.vars ?? {};
      if (v.endAt && mf >= v.endAt - PKT.END) return lerpPose(PKT_POSE, f.grounded === false ? POSES.fall : POSES.idle, Math.min(1, (mf - (v.endAt - PKT.END)) / PKT.END));
      const p = lerpPose(POSES.idle, PKT_POSE, Math.min(1, mf / 12));
      if (mf > 23) p.root = [0, Math.sin(mf * 0.3) * 0.01, 0];
      return p;
    },
    onStart(f) { if (!f.grounded) { f.vy = 0; f.vx /= 2; f.fastfall = false; } },
    script(f, mf, c) {
      const v = f.vars;
      if (!f.grounded) {
        if (mf <= PKT.GRAV_DELAY) { f.noGravity = true; } else { f.noGravity = false; f.gravMul = PKT.GRAV / f.a.gravity; }
        f.airFriction();
      } else f.friction();
      if (mf === PKT.SPAWN) v.ball = spawnPKT(f);
      if (mf > PKT.SPAWN && !v.goneAt && (!v.ball || v.ball.dead || v.ball.owner !== f)) { v.goneAt = mf; v.endAt = mf + PKT.END_DELAY + PKT.END; }
      if (v.endAt && mf >= v.endAt) f.endMove();
    },
  };
}
function spawnPKT(f) {
  const K = PKT, m = f.match;
  const head = new Projectile(m, f, {
    kind: 'pkthunder', x: f.x, y: f.y + f.H * 0.85, vx: 0, vy: K.V, life: K.LIFE, r: 75, floorDie: true, wallStop: true,
    hb: { damage: 6, angle: 100, bkb: 50, kbg: 30, fkb: 0, element: 'electric', shieldDmg: 1 },
    makeView: (scene) => pktView(scene),
  });
  head.ang = PI / 2; head.trail = [];
  const tail = new Projectile(m, f, {
    kind: 'pkthundertail', x: f.x, y: head.y - 100, vx: 0, vy: 0, life: 1e9, r: 50, reflectable: false, absorbable: false, collide: false,
    hb: { damage: 3, angle: 100, bkb: 50, kbg: 30, fkb: 0, element: 'electric', shieldDmg: 1 },
    makeView: (scene) => { const g = new THREE.Group(); scene.add(g); return g; },
  });
  head.onUpdate = (p) => {
    const ness = f;
    const steering = p.owner === ness && !ness.dead && ness.state === 'attack' && (ness.move?.id === 'uspecial' || ness.move?.id === 'uspecialAir');
    if (p.owner === ness && !steering) { p.die(); return false; }
    if (steering) {
      const c = ness.ctrl;
      let sx = c.x * S, sy = c.y * S;
      // CPU recovery: curve the ball back so it hits Ness from the far side, launching him toward the stage
      if ((ness.cpu || c.source === 'cpu') && !ness.grounded && p.t >= 8) {
        // two phases: swing out to a waypoint outside & below Ness, then fly into him so he launches up-inward
        const dir = ness.x > 0 ? -1 : 1;
        p.cpuPhase ??= 0;
        const W = [[-dir * 750, 250], [-dir * 520, -450]];
        if (p.cpuPhase < W.length) {
          const wx = ness.x + W[p.cpuPhase][0], wy = ness.y + K.OY + W[p.cpuPhase][1];
          if (Math.hypot(wx - p.x, wy - p.y) < 230) p.cpuPhase++;
          sx = wx - p.x; sy = wy - p.y;
        } else { sx = ness.x - p.x; sy = ness.y + K.OY - p.y; }
        const L = Math.hypot(sx, sy) || 1; sx = sx / L * 80; sy = sy / L * 80;
      }
      if (Math.hypot(sx, sy) >= K.MIN) {
        const target = Math.atan2(sy, sx);
        let d = target - p.ang; while (d > PI) d -= 2 * PI; while (d < -PI) d += 2 * PI;
        if (Math.abs(d) < K.NEAR * D2R) p.ang += d / K.DIV; else p.ang += sign(d) * K.TURN * D2R;
      }
      p.vx = Math.cos(p.ang) * K.V; p.vy = Math.sin(p.ang) * K.V;
      // PK Thunder 2: the ball reaches Ness
      if (p.t >= K.DELAY && !((ness.cpu || c.source === 'cpu') && (p.cpuPhase ?? 9) < 2) && Math.abs(ness.x - p.x) < K.CX && Math.abs(ness.y + K.OY - p.y) < K.CY) {
        const dx = ness.x - p.x, dy = ness.y + K.OY - p.y;
        p.die();
        ness.startMove(ness.def.moves.pkThunder2, { vars: { dx, dy } });
        return false;
      }
    }
    p.trail.unshift([p.x, p.y]); if (p.trail.length > 10) p.trail.pop();
    return true;
  };
  head.onDie = () => { tail.die(); };
  tail.onUpdate = (p) => {
    if (head.dead) { p.die(); return false; }
    const sp = Math.hypot(head.vx, head.vy) || 1;
    p.x = head.x - head.vx / sp * 100; p.y = head.y - head.vy / sp * 100;
    p.owner = head.owner;
    return false;
  };
  head.updateView = (v, t) => {
    v.userData.core.scale.setScalar(1 + 0.15 * Math.sin(t * 1.7));
    v.userData.segs.forEach((s, i) => {
      const tp = head.trail[Math.min(head.trail.length - 1, (i + 1))];
      if (!tp) { s.visible = false; return; }
      s.visible = true; s.position.set((tp[0] - head.x) * 0.01, (tp[1] - head.y) * 0.01, 0);
      s.scale.setScalar(1 - i * 0.08);
    });
  };
  m.spawnProjectile(head); m.spawnProjectile(tail);
  m.emit('sfx', { name: 'elec' });
  return head;
}
function pktView(scene) {
  const g = new THREE.Group();
  const core = new THREE.Group(); g.add(core);
  core.add(new THREE.Mesh(new THREE.SphereGeometry(0.75, 9, 7), basic(0x60c0ff, 0.6)));
  core.add(new THREE.Mesh(new THREE.SphereGeometry(0.45, 8, 6), basic(0xffffff, 0.95)));
  const segs = [];
  for (let i = 0; i < 8; i++) { const s = new THREE.Mesh(new THREE.SphereGeometry(0.4, 6, 5), basic(i % 2 ? 0x80e0ff : 0xe0f8ff, 0.7)); g.add(s); segs.push(s); }
  g.userData = { core, segs };
  scene.add(g); return g;
}
// PK Thunder 2: 200 u/f away from the ball, -43/7 per frame for 28 frames; intangible 1-9; 30% electric
// body hitbox (361, bkb 40, kbg 84, r 150) frames 1-18; bounces off walls / ceilings (x0.5), slides along
// floors, steep floor hits bounce. Then special fall.
export const PKT2 = { V: 200, DEC: 43 / 7, T: 28, INT: 9, REB: 0.5 };
export const pkThunder2 = {
  total: PKT2.T, groundOK: true, keepOnFall: true, keepVel: true, noAirFriction: true, sfx: 'elec',
  helpless: true, helplessDrift: PKT.DRIFT, helplessLand: PKT.LAND, ledgeGrab: true, ledgeGrabFrom: 19, walkOff: true,
  hitboxes: [{ frames: [1, 18], damage: 30, angle: 361, bkb: 40, kbg: 84, fkb: 0, r: 150, size: 150, element: 'electric', ground: true, air: true, shieldDmg: 0, clank: false, pos: [0, 120] }],
  anim: (f, mf) => {
    const v = f.vars ?? {};
    const ang = Math.atan2(v.uy ?? 1, Math.abs(v.ux ?? 0));
    const th = PI / 2 - ang;
    const ball = { spine: [0.6, 0, 0], neck: [0.3, 0, 0], upperArmL: [-1.2, 0, 0.4], upperArmR: [-1.2, 0, -0.4], foreArmL: [-1.2, 0, 0], foreArmR: [-1.2, 0, 0],
      thighL: [-1.6, 0, 0.15], thighR: [-1.6, 0, -0.15], shinL: [1.7, 0, 0], shinR: [1.7, 0, 0] };
    return { ...ball, body: [th, 0, 0], root: [0, 0.4 - 0.4 * Math.cos(th), -0.4 * Math.sin(th)] };
  },
  onStart(f) {
    const v = f.vars, L = Math.hypot(v.dx, v.dy) || 1;
    v.ux = v.dx / L; v.uy = v.dy / L; v.spd = PKT2.V;
    if (Math.abs(v.ux) > 1e-3) f.facing = sign(v.ux);
    if (f.grounded && v.uy > 0.05) { f.grounded = false; f.ground = null; f.y += 1; }
    if (f.grounded) { v.uy = 0; v.ux = sign(v.ux) || f.facing; }
    f.vx = v.ux * v.spd; f.vy = v.uy * v.spd; f.noGravity = true;
    f.jumpsUsed = f.a.jumps;
  },
  script(f, mf) {
    const v = f.vars;
    if (mf <= PKT2.INT) f.intangible = Math.max(f.intangible, 1);
    f.noGravity = true;
    // walls / ceilings bounce
    if (Math.abs(v.ux) > 0.05 && Math.abs(f.vx) < 1e-6) { v.ux = -v.ux; v.spd *= PKT2.REB; f.facing = sign(v.ux) || f.facing; }
    if (v.uy > 0.05 && !f.grounded && f.vy <= 0 && v.lastVy > 0) { v.uy = -v.uy; v.spd *= PKT2.REB; }
    v.spd = Math.max(0, v.spd - PKT2.DEC);
    if (f.grounded) { f.vx = (sign(v.ux) || f.facing) * v.spd; f.vy = 0; }
    else { f.vx = v.ux * v.spd; f.vy = v.uy * v.spd; }
    v.lastVy = f.vy;
  },
  landHook(f) {
    const v = f.vars, L = Math.hypot(v.ux, v.uy) || 1;
    if (-v.uy / L > Math.cos((180 - 155) * D2R)) {       // nearly straight into the floor: bounce
      v.uy = -v.uy; v.spd *= PKT2.REB;
      f.grounded = false; f.ground = null; f.y += 1;
      f.vx = v.ux * v.spd; f.vy = v.uy * v.spd;
      return true;
    }
    v.uy = 0; v.ux = sign(v.ux) || f.facing;           // slide along the floor
    return false;
  },
};

// ---------------- PSI Magnet ----------------
// Start 15, then absorbs while B is held (minimum 30 frames), end 20. Absorbing heals 2x the projectile's
// (staled) damage, plays a 14-frame reaction, turns Ness toward it. Air: vy=0, gravity 0.8 after 4 frames.
// Absorb sphere: TopN + (300, 195, 0) size 430 -> in the 2D plane a circle of r ~308 around Ness at y+195.
export const MAGNET = { START: 15, HOLD: 30, END: 20, HIT: 14, Y: 195, R: 308, GRAV_DELAY: 4, GRAV: 0.8, HEAL: 2 };
const MAG_POSE = { ...POSES.idle, root: [0, -0.03, 0], spine: [0.15, 0, 0], head: [0.1, 0, 0], upperArmL: [-1.2, 0.3, 0.35], upperArmR: [-1.2, -0.3, -0.35], foreArmL: [-0.9, 0, 0], foreArmR: [-0.9, 0, 0],
  thighL: [-0.4, 0, 0.18], thighR: [-0.4, 0, -0.18], shinL: [0.6, 0, 0], shinR: [0.6, 0, 0] };
export function psiMagnet() {
  const M = MAGNET;
  return {
    total: 9999, groundOK: true, keepOnFall: true, noAirFriction: true, hitboxes: [], sfx: 'charge',
    anim: (f, mf) => {
      const v = f.vars ?? {};
      if (mf <= M.START) return lerpPose(POSES.idle, MAG_POSE, mf / M.START);
      if (v.endAt) return lerpPose(MAG_POSE, POSES.idle, Math.min(1, (mf - (v.endAt - M.END)) / M.END));
      const p = { ...MAG_POSE };
      if (v.hitT > 0) { p.spine = [-0.25, 0, 0]; p.head = [-0.3, 0, 0]; }
      return p;
    },
    onStart(f) { if (!f.grounded) { f.vy = 0; f.fastfall = false; } f.vars.hitT = 0; },
    script(f, mf, c) {
      const v = f.vars;
      if (!f.grounded) {
        if (mf <= M.GRAV_DELAY) f.noGravity = true; else { f.noGravity = false; f.gravMul = M.GRAV / f.a.gravity; }
        f.airFriction();
      }
      if (v.hitT > 0) v.hitT--;
      f.absorbing = mf >= M.START && !v.endAt;
      if (!v.endAt && mf >= M.START + M.HOLD && !c.held('B') && v.hitT === 0) v.endAt = mf + M.END;
      if (v.endAt && mf >= v.endAt) { f.absorbing = false; f.endMove(); }
    },
  };
}

// ---------------- hooks: bat reflector, magnet absorb, landing hooks, flutter double jump ----------------
const FAR = { x: 1e9, y: 1e9, r: 0 };
export const BAT_REFLECT = { FROM: 16, TO: 21, Y: 150, R: 300, MUL: 1.8, ADD: 0.99, CAP: 100 };
// Animation-driven aerial jump: rises slowly at first, then accelerates, without gravity for 9 frames;
// tuned so the total height matches the formula jump ((80*0.7+26)*1.2 = 98.4 u/f under gravity 2.7).
export const NESS_DJ = [20, 30, 40, 50, 58, 66, 72, 78, 82];
export function installNessHooks(f) {
  const B = BAT_REFLECT, M = MAGNET;
  f.reflectBox = (p) => {
    if (f.state !== 'attack' || f.move?.id !== 'fsmash' || f.mf < B.FROM || f.mf > B.TO) return FAR;
    const d = p?.hb?.damage ?? 0;
    const n = Math.min(B.CAP, Math.floor(d * B.MUL + B.ADD));
    f.reflectMul = d > 0 ? (n + 0.5) / d : B.MUL;
    return { x: f.x, y: f.y + B.Y * f.scale, r: B.R * f.scale };
  };
  f.absorbBox = () => (f.absorbing && f.state === 'attack' ? { x: f.x, y: f.y + M.Y * f.scale, r: M.R * f.scale } : FAR);
  f.onAbsorb = (p) => {
    const dmg = Math.floor((p.hb.damage ?? 0) * (p.staleMul ?? 1) + 0.999);
    f.percent = Math.max(0, f.percent - dmg * M.HEAL);
    f.vars.hitT = M.HIT;
    if (p.x !== f.x) f.facing = sign(p.x - f.x);
    f.match.emit('sfx', { name: 'heal' });
  };
  f.onLand = (st) => (st === 'attack' && f.move?.landHook ? f.move.landHook(f, st) === true : false);
  // flutter double jump
  const dj = f.doDoubleJump, drift = f.airDrift;
  f.doDoubleJump = function () { dj.call(this); this.nessDJ = 1; this.vy = NESS_DJ[0]; this.noGravity = true; };
  f.airDrift = function (c, mul) {
    if (this.state === 'jumpaerial' && this.nessDJ) {
      const k = this.nessDJ++;
      if (k < NESS_DJ.length) { this.vy = NESS_DJ[k]; this.noGravity = true; } else { this.nessDJ = 0; this.noGravity = false; }
    } else if (this.nessDJ) { this.nessDJ = 0; }
    return drift.call(this, c, mul);
  };
}
