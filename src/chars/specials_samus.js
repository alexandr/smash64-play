// Samus specials (Charge Shot, Screw Attack, Bomb) + small helpers shared by the Samus/Yoshi/Kirby modules.
// Numbers follow the `behavior` / `projectile` notes in reference/spec/chars/samus.json.
import * as THREE from 'three';
import { Projectile } from '../game/projectile.js';
import { sampleKeys } from '../render/rig.js';

export const S = 80;
export const sign = v => (v > 0 ? 1 : v < 0 ? -1 : 0);
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const PI = Math.PI;

// ---------- animation helpers ----------
// keyframed move animation: keys = [[frame, pose], ...] -> (f, mf) => pose
export function kf(keys) {
  const ks = keys.map(([f, pose, linear]) => ({ f, pose, linear }));
  return (f, mf) => sampleKeys(ks, mf);
}
// root offset that makes a body rotation `rx` (about x) / `ry` pivot around the point (0, cy, 0) instead of the feet
export function spinAbout(rx, cy) { return { body: [rx, 0, 0], root: [0, cy - cy * Math.cos(rx), -cy * Math.sin(rx)] }; }
export function rollAbout(rz, cy) { return { body: [0, 0, rz], root: [cy * Math.sin(rz), cy - cy * Math.cos(rz), 0] }; }

// ---------- generic projectile helpers ----------
const basic = (color, opacity = 1, add = false) => new THREE.MeshBasicMaterial({ color, transparent: opacity < 1 || add, opacity, depthWrite: !add && opacity >= 1, blending: add ? THREE.AdditiveBlending : THREE.NormalBlending });

// Explosion: a stationary multi-target hitbox for `life` frames with an expanding fireball.
export function explosion(match, owner, x, y, o = {}) {
  const E = { r: 180, life: 6, damage: 9, angle: 361, kbg: 65, bkb: 10, fkb: 0, element: 'fire', shieldDmg: 1, color: 0xff8020, ...o };
  const p = new Projectile(match, owner, {
    kind: 'explosion', x, y, vx: 0, vy: 0, gravity: 0, life: E.life, r: E.r, pierce: true, collide: false,
    reflectable: false, absorbable: false, hitsOwner: !!E.hitsOwner, moveId: E.moveId, staleMul: E.staleMul ?? 1,
    hb: { damage: E.damage, angle: E.angle, kbg: E.kbg, bkb: E.bkb, fkb: E.fkb, element: E.element, shieldDmg: E.shieldDmg },
    makeView: (scene) => {
      const g = new THREE.Group();
      const outer = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8), basic(E.color, 0.75, true));
      const inner = new THREE.Mesh(new THREE.SphereGeometry(0.6, 8, 6), basic(0xfff0a0, 0.9, true));
      g.add(outer, inner); g.userData = { t: 0 }; scene.add(g); return g;
    },
    updateView: (v) => {
      v.userData.t++;
      const k = Math.min(1, v.userData.t / Math.max(4, E.life + 6));
      v.scale.setScalar(E.r * 0.01 * (0.5 + 0.7 * Math.sqrt(k)));
      v.children[0].material.opacity = 0.75 * (1 - k * 0.6); v.children[1].material.opacity = 0.9 * (1 - k);
    },
  });
  if (o.skip) for (const v of o.skip) p.hit.add(v);
  // keep the fireball visible a little after the hitbox ends
  p.onUpdate = (pp) => { if (pp.t > E.life) pp.hitbox = false; if (pp.t > E.life + 8) pp.die(); return false; };
  p.life = Infinity;
  match.spawnProjectile(p);
  match.emit('sfx', { name: 'explode' });
  return p;
}

// does a circle (x, y, r) touch a fighter's hurt capsule?
export function touches(match, x, y, r, v) { return match.hitOverlap({ x, y, px: x, py: y, r }, v); }
export function enemiesOf(match, owner) {
  return match.hurtables().filter(v => v !== owner && !(owner && match.sameTeam(owner, v) && !match.rules.teamAttack));
}

// ---------- Charge Shot ----------
export const CHARGE_LEVELS = [
  { gfx: 150, v: 60, d: 3, r: 50 }, { gfx: 230, v: 62, d: 6, r: 60 }, { gfx: 280, v: 64, d: 9, r: 70 }, { gfx: 340, v: 66, d: 12, r: 80 },
  { gfx: 410, v: 68, d: 15, r: 90 }, { gfx: 490, v: 70, d: 18, r: 100 }, { gfx: 600, v: 72, d: 21, r: 120 }, { gfx: 700, v: 74, d: 26, r: 130 },
];
export function chargeShotProjectile(f, lvl, x, y) {
  const L = CHARGE_LEVELS[clamp(lvl, 0, 7)];
  return f.match.spawnProjectile(new Projectile(f.match, f, {
    kind: 'chargeshot', x, y, vx: L.v * f.facing, vy: 0, gravity: 0, life: 100000, r: L.r, moveId: 'nspecial',
    hb: { damage: L.d, angle: 361, kbg: 100, bkb: 0, element: 'electric', shieldDmg: 1 },
    makeView: (scene) => {
      const g = new THREE.Group();
      const s = L.gfx / 30 * 0.075;
      g.add(new THREE.Mesh(new THREE.SphereGeometry(s, 10, 8), basic(0xffd840, 0.9, true)));
      g.add(new THREE.Mesh(new THREE.SphereGeometry(s * 0.6, 8, 6), basic(0xffffff, 1)));
      const tail = new THREE.Mesh(new THREE.ConeGeometry(s * 0.8, s * 3, 8), basic(0xff9020, 0.55, true));
      tail.rotation.z = f.facing > 0 ? PI / 2 : -PI / 2; tail.position.x = -f.facing * s * 1.6; g.add(tail);
      scene.add(g); return g;
    },
    updateView: (v, t) => { v.children[0].scale.setScalar(1 + 0.15 * Math.sin(t * 0.9)); },
  }));
}
// o: { air, muzzle(f) -> [fwd, up] in game units, levelKey } ; Kirby reuses this with his own muzzle.
export function chargeShot(o = {}) {
  const air = !!o.air;
  const START = 16, SHOOT = air ? 29 : 30, PER = 20, MAX = 7;
  const muzzle = o.muzzle ?? (f => [f.H * 0.62, f.H * 0.64]);
  function fire(f, mf) {
    const v = f.vars, lvl = v.lvl;
    v.phase = 'shoot'; v.ps = mf;
    const [fw, up] = muzzle(f);
    chargeShotProjectile(f, lvl, f.x + f.facing * fw, f.y + up);
    f.special.charge = 0;
    const back = 2 * (lvl + 1) + 10;
    f.vx = -back * f.facing;
    if (!f.grounded) { f.vy = Math.max(f.vy, (lvl + 1) + 20 - 10 * (f.special.airShots ?? 0)); f.special.airShots = (f.special.airShots ?? 0) + 1; }
    f.match.emit('sfx', { name: lvl >= 4 ? 'explode' : 'shoot' });
  }
  return {
    total: 9999, groundOK: true, keepOnFall: true, drift: air, noAirFriction: false, chargeShot: true, noStale: false,
    anim: chargeAnim,
    onStart(f) {
      f.vars.phase = 'start'; f.vars.lvl = f.special.charge ?? 0;
      if (f.grounded) f.special.airShots = 0;
    },
    script(f, mf, c) {
      const v = f.vars;
      if (v.phase === 'start') {
        if (mf >= START) { if (!air && f.grounded && v.lvl < MAX) { v.phase = 'charge'; v.ps = mf; } else fire(f, mf); }
        return;
      }
      if (v.phase === 'charge') {
        if (!f.grounded) { f.special.charge = v.lvl; f.setState('fall'); return; }
        const k = mf - v.ps;
        if (k > 0 && k % PER === 0) {
          v.lvl++; f.special.charge = v.lvl;
          if (v.lvl >= MAX) { f.flash = 16; f.match.emit('sfx', { name: 'charge' }); f.setState('idle'); return; }
        }
        if (c.pressed('B') || c.pressed('A')) { fire(f, mf); return; }
        if (c.held('Z')) {
          f.special.charge = v.lvl;
          if (Math.abs(c.x) * S >= 56) { f.rollDir = sign(c.x); f.setState('roll'); }
          else f.setState('idle');
          return;
        }
        return;
      }
      if (v.phase === 'shoot' && mf - v.ps >= SHOOT) f.endMove();
    },
  };
}
const CS_IDLE = { spine: [0.05, -0.35, 0], chest: [0, -0.15, 0], upperArmR: [-1.45, 0, -0.05], foreArmR: [-0.05, 0, 0], upperArmL: [-1.0, 0, 0.5], foreArmL: [-1.0, 0, 0],
  thighL: [-0.45, 0, 0.12], shinL: [0.5, 0, 0], footL: [-0.1, 0, 0], thighR: [0.25, 0, -0.12], shinR: [0.35, 0, 0], root: [0, -0.03, 0] };
function chargeAnim(f, mf, P) {
  const v = f.vars ?? {};
  const rest = f.grounded === false ? P.fall : P.idle;
  if (v.phase === 'charge') { const j = Math.sin(mf * 1.7) * 0.02; return { ...CS_IDLE, foreArmR: [-0.05 + j, 0, 0], root: [0, -0.03 + j * 0.3, 0] }; }
  if (v.phase === 'shoot') {
    const k = mf - v.ps;
    const kick = k < 4 ? k / 4 : Math.max(0, 1 - (k - 4) / 10);
    const base = { ...CS_IDLE, upperArmR: [-1.45 - 0.35 * kick, 0, -0.05], spine: [0.05 - 0.15 * kick, -0.35, 0] };
    const back = Math.max(0, (k - 16) / 14);
    return back > 0 ? lerp(base, rest, back) : base;
  }
  return lerp(rest, CS_IDLE, Math.min(1, mf / 10));
}
function lerp(a, b, t) {
  const out = {};
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
    const z = k === 'scale' ? [1, 1, 1] : [0, 0, 0];
    const x = a[k] ?? z, y = b[k] ?? z;
    out[k] = [x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t];
  }
  return out;
}
export { lerp as lerpP };

// ---------- Screw Attack ----------
// Ground: invincible 1-5, rises (root motion) with vel_x 10*facing on frame 4. Air: vel_y 62, normal gravity,
// uses up the double jump. Drift stickX, |vx| <= 20. FallSpecial after (drift 0.66, landing ~20).
export function screwAttack(o = {}) {
  const air = !!o.air;
  const curve = t => 1 - Math.pow(1 - t, 2);
  const RISE = o.rise ?? 900, R0 = 4, R1 = 30;
  return {
    total: air ? 47 : 49, anim: screwAnim, helpless: true, helplessLand: 20, helplessDrift: 0.66, ledgeGrab: true, ledgeGrabFrom: 8,
    keepOnFall: true, noAirFriction: true, screw: true, sfx: 'elec',
    invincibleW: air ? [[1, 3]] : [[1, 5]],
    hitboxes: o.hitboxes,
    onStart(f) {
      if (air || !f.grounded) { f.vy = 62; f.vx *= 0.5; f.vars.air = true; }
      f.jumpsUsed = f.a.jumps;
    },
    script(f, mf, c) {
      if (!f.vars.air) {
        if (mf === R0) { f.grounded = false; f.ground = null; f.y += 1; f.vx = 10 * f.facing; }
        if (mf >= R0 && mf <= R1) {
          const k0 = curve((mf - R0) / (R1 - R0 + 1)), k1 = curve((mf - R0 + 1) / (R1 - R0 + 1));
          f.noGravity = true; f.vy = (k1 - k0) * RISE;
        } else if (mf > R1) f.noGravity = false;
      }
      if (!f.grounded && mf >= 4) {
        const X = c.x * S;
        if (Math.abs(X) >= 8) f.vx = clamp(f.vx + X * 0.03, -20, 20); else f.vx *= 0.97;
      }
    },
  };
}
function screwAnim(f, mf) {
  const tuck = { spine: [0.6, 0, 0], neck: [0.2, 0, 0], head: [0.3, 0, 0], thighL: [-2.0, 0, 0.25], thighR: [-2.0, 0, -0.25], shinL: [2.3, 0, 0], shinR: [2.3, 0, 0],
    upperArmL: [-1.0, 0, 0.5], upperArmR: [-1.0, 0, -0.5], foreArmL: [-1.4, 0, 0], foreArmR: [-1.2, 0, 0] };
  if (mf < 3) return lerp({}, tuck, mf / 3);
  if (mf > 40) return lerp({ ...tuck, ...spinAbout(0, 0.42) }, { spine: [0.2, 0, 0], upperArmL: [0, 0, 1.0], upperArmR: [0, 0, -1.0] }, Math.min(1, (mf - 40) / 7));
  return { ...tuck, ...spinAbout(-(mf - 3) * 0.95, 0.42) };
}

// ---------- Bomb ----------
// Morph Ball, bomb dropped on frame 10 at 60 u above TopN. Ground roll 10-43 (vel = stickX*walk_mul*0.66).
// Air: vel_y 30 on start; drift clamp 28*0.66, accel*0.66. jumps_used = max.
export function bomb(o = {}) {
  const air = !!o.air;
  return {
    total: 56, anim: bombAnim, groundOK: true, keepOnFall: true, walkOff: true, noAirFriction: true, keepVel: true, morph: true, hitboxes: [],
    onStart(f) {
      if (!f.grounded) f.vy = 30;
      f.vars.wasG = f.grounded;
      f.jumpsUsed = f.a.jumps;
    },
    script(f, mf, c) {
      const X = c.x * S;
      if (f.vars.wasG && !f.grounded) f.vy = 40;
      f.vars.wasG = f.grounded;
      if (f.grounded) {
        if (mf >= 10 && mf <= 43) f.vx = X * f.a.walkMul * 0.66;
        else f.friction();
      } else {
        const max = f.a.airMax * 0.66;
        if (Math.abs(X) >= 8) f.vx = clamp(f.vx + X * f.a.airAccel * 0.66, -max, max);
        else f.airFriction();
      }
      if (mf === 10) spawnBomb(f, f.x, f.y + 60);
    },
  };
}
function bombAnim(f, mf) {
  const tuck = { root: [0, -0.18, 0], spine: [0.9, 0, 0], head: [0.6, 0, 0], thighL: [-2.2, 0, 0], thighR: [-2.2, 0, 0], shinL: [2.5, 0, 0], shinR: [2.5, 0, 0], upperArmL: [-1.2, 0, 0.3], upperArmR: [-1.2, 0, -0.3] };
  if (mf < 6) return lerp({}, tuck, mf / 6);
  if (mf > 48) return lerp(tuck, {}, (mf - 48) / 8);
  return tuck;
}
export function spawnBomb(f, x, y) {
  const m = f.match;
  const p = new Projectile(m, f, {
    kind: 'bomb', x, y, vx: 0, vy: 10, gravity: 1.0, tvel: 50, bounce: 0.9, bounceKeepX: 0.9, life: 100, r: 45, hitbox: false,
    reflectable: false, absorbable: false, moveId: 'dspecial',
    makeView: (scene) => {
      const g = new THREE.Group();
      g.add(new THREE.Mesh(new THREE.SphereGeometry(0.42, 9, 7), new THREE.MeshLambertMaterial({ color: 0x404858 })));
      const core = new THREE.Mesh(new THREE.SphereGeometry(0.24, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffe040 }));
      g.add(core); g.userData = { t: 0 }; scene.add(g); return g;
    },
    updateView: (v) => {
      const t = ++v.userData.t;
      const rate = t < 50 ? 12 : t < 80 ? 6 : 3;     // blinks faster as the fuse runs out
      v.children[1].material.color.setHex(Math.floor(t / rate) % 2 ? 0xff3020 : 0xffe040);
    },
  });
  const skip = new Set();
  p.onUpdate = (pp, mm) => {
    for (const v of enemiesOf(mm, pp.owner)) if (v.intangible <= 0 && touches(mm, pp.x, pp.y, pp.r, v)) { pp.die(); return false; }
  };
  p.onDie = (pp) => explosion(m, pp.owner, pp.x, pp.y, { r: 180, life: 6, damage: 9, angle: 361, kbg: 65, bkb: 10, element: 'fire', shieldDmg: 1, moveId: 'dspecial', skip });
  m.spawnProjectile(p);
  m.emit('sfx', { name: 'item' });
  return p;
}
