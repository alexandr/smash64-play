// Yoshi specials: Egg Lay (tongue catch -> victim trapped in an egg), Egg Throw (aimed, charged by holding B),
// Yoshi Bomb (hop, plummet, landing stars). Also the generic "capture" helpers reused by Kirby's Inhale.
// Numbers follow reference/spec/chars/yoshi.json (behavior / projectile notes).
import * as THREE from 'three';
import { Projectile } from '../game/projectile.js';
import { eggMesh } from './models_yoshi.js';
import { S, sign, clamp, explosion, enemiesOf, touches } from './specials_samus.js';

const PI = Math.PI;
// egg spot colour: a Yoshi's own colour, green otherwise
export const spotOf = f => (f.def.id === 'yoshi' ? f.def.palettes[f.color % f.def.palettes.length].body : 0x30c818);

// ---------------- capture (victim held / hidden by another fighter) ----------------
// The victim stays in the engine's 'grabbed' state (no physics, grabbedBy = owner); a watchdog projectile
// releases it safely if the owner is hit, dies or leaves the capturing move.
export function capture(owner, v, isValid) {
  v.capt = { by: owner, scale: v.scale };
  const m = owner.match;
  const dog = new Projectile(m, owner, { kind: 'capture', hitbox: false, collide: false, life: Infinity, r: 1, x: v.x, y: v.y, reflectable: false, absorbable: false });
  dog.makeView = (scene) => { const g = new THREE.Group(); scene.add(g); return g; };
  dog.onUpdate = (p) => {
    const c = v.capt;
    if (!c || c.by !== owner) { p.dead = true; return false; }
    const ok = !owner.dead && !v.dead && v.grabbedBy === owner && owner.state === 'attack' && isValid(owner);
    if (!ok) { releaseCapture(v); p.dead = true; }
    return false;
  };
  m.spawnProjectile(dog);
}
export function hideCaptured(v) { if (v.capt) { v.scale = v.capt.scale * 0.02; v.untouchable = true; } }
export function releaseCapture(v, o = {}) {
  const c = v.capt; if (!c) return;
  v.capt = null;
  v.scale = c.scale; v.untouchable = false;
  if (v.grabbedBy === c.by) v.grabbedBy = null;
  if (c.by.grabbing === v) c.by.grabbing = null;
  if (!v.dead && (v.state === 'grabbed' || o.force)) {
    v.setState('fall'); v.grounded = false; v.ground = null; v.vx = o.vx ?? 0; v.vy = o.vy ?? 20;
    v.intangible = Math.max(v.intangible, o.intangible ?? 12);
  }
}
// mash input from the victim's controller this frame
export function mashed(c) {
  return c.pressed('A') || c.pressed('B') || c.pressed('Z') || c.pressed('R') || c.jumpPressed() ||
    (Math.hypot(c.x, c.y) * S > 40 && (sign(c.x) !== sign(c.px) || sign(c.y) !== sign(c.py)) && Math.hypot(c.px, c.py) * S < 30);
}

// ---------------- the egg (victim status YoshiEgg) ----------------
// Victim takes 5%, launched with (20*facing, 60); lasts up to 250 frames; each mash input -12 frames; hits deal
// half damage and take 2*damage/0.5 frames off; on escape: vel_y 70, intangible 12.
export function trapInEgg(owner, v, x, y, spot = 0x30c818) {
  const m = owner.match;
  releaseCapture(v);
  if (v.dead) return;
  const H0 = v.H;
  v.setState('yoshiegg');
  v.x = x; v.y = y; v.grounded = false; v.ground = null; v.vx = 20 * owner.facing; v.vy = 60; v.kbx = v.kby = 0; v.kbGround = 0; v.fastfall = false;
  v.percent = Math.min(999, v.percent + 5); v.stats.dmgTaken += 5; owner.stats.dmgGiven += 5; v.lastAttacker = owner;
  const egg = { t: 250, by: owner, base: v.scale, hadOnLand: Object.prototype.hasOwnProperty.call(v, 'onLand'), onLand: v.onLand, wob: 0 };
  v.egg = egg;
  v.onLand = () => true;
  v.scale = v.scale * 0.72; v.gravMul = 2.5;
  const R = H0 * 0.52;
  v.hurtCapsule = function () { return { x1: this.x, y1: this.y + R, x2: this.x, y2: this.y + R * 1.2, r: R }; };
  const armCounter = () => {
    v.counter = (a, h) => {
      const d = Math.ceil((h.hb.damage ?? 0) * 0.5);
      v.percent = Math.min(999, v.percent + d); v.stats.dmgTaken += d; if (a?.stats) a.stats.dmgGiven += d;
      egg.t -= 2 * (h.hb.damage ?? 0) / 0.5; egg.wob = 10;
      const lr = (h.x ?? v.x) < v.x ? 1 : -1;
      v.vx = lr * 12; if (!v.grounded) v.vy = Math.max(v.vy, 15);
      if (a && a.hitlag !== undefined && a !== v) a.hitlag = Math.max(a.hitlag, 4);
      m.emit('hit', { f: v, a, x: h.x ?? v.x, y: h.y ?? v.y + R, dmg: d, kb: 0, element: h.hb.element });
      return true;
    };
  };
  armCounter();
  const restore = () => {
    if (v.egg !== egg) return;
    v.egg = null;
    if (egg.hadOnLand) v.onLand = egg.onLand; else delete v.onLand;
    delete v.hurtCapsule;
    if (v.capt) v.capt.scale = egg.base; else v.scale = egg.base;
    if (v.counter && v.state === 'yoshiegg') v.counter = null;
  };
  const p = new Projectile(m, owner, { kind: 'egg', hitbox: false, collide: false, life: Infinity, r: R, x: v.x, y: v.y + R, reflectable: false, absorbable: false });
  p.makeView = (scene) => { const g = eggMesh(spot, R * 0.01 * 0.98); g.userData = { s: 1 }; scene.add(g); return g; };
  p.updateView = (g) => { g.rotation.z = egg.wob > 0 ? Math.sin(egg.wob * 1.3) * 0.25 : g.rotation.z * 0.8; };
  p.onUpdate = (pp) => {
    if (v.egg !== egg) { pp.dead = true; return false; }
    if (v.dead || v.state !== 'yoshiegg') { restore(); pp.dead = true; return false; }
    if (!v.counter) armCounter();
    egg.t--; if (egg.wob > 0) egg.wob--;
    if (mashed(v.ctrl)) { egg.t -= 12; egg.wob = Math.max(egg.wob, 6); }
    if (v.grounded) v.friction();
    else v.airFriction();
    pp.x = v.x; pp.y = v.y + R * 1.22;
    if (egg.t <= 0) {
      restore();
      v.setState('fall'); v.grounded = false; v.ground = null; v.y += 1; v.vy = 70; v.vx = 0; v.intangible = 12;
      m.emit('sfx', { name: 'roll' }); m.emit('hit', { f: v, a: null, x: v.x, y: v.y + R, dmg: 0, kb: 0, element: 'normal' });
      pp.dead = true;
    }
    return false;
  };
  m.spawnProjectile(p);
  m.emit('sfx', { name: 'eat' });
}

// ---------------- Egg Lay ----------------
// Tongue lunge: catch box (radius 150 on the tongue tip) frames 18-23, whiff 37 frames. On catch the victim is
// pulled in (SpecialNCatch, 25 frames) and swallowed; the egg is laid on frame 6 of SpecialNRelease (Yoshi
// invincible from frame 6); release anim 29 frames.
export function eggLay(o = {}) {
  const tip = o.tip ?? [430, 250], mid = o.mid ?? [240, 250];
  const path = (pt, s) => { const p = {}; for (let f = 18; f <= 23; f++) { const k = Math.min(1, (f - 16) / 2); p[f] = [Math.round(s + (pt[0] - s) * k), pt[1]]; } return p; };
  return {
    total: 37, groundOK: true, keepOnFall: true, drift: !!o.air, eggLay: true, sfx: 'whiff',
    hitboxes: [
      { frames: [18, 23], damage: 1, angle: 361, bkb: 0, kbg: 100, fkb: 0, r: 150, size: 150, grab: true, grabAir: true, path: path(tip, 150) },
      { frames: [18, 23], damage: 1, angle: 361, bkb: 0, kbg: 100, fkb: 0, r: 110, size: 110, grab: true, grabAir: true, path: path(mid, 100) },
    ],
    anim: o.anim,
    onStart(f) {
      const catchId = o.catchId ?? 'nspecialCatch';
      f.onGrab = (v) => {
        f.onGrab = null;
        f.startMove(f.def.moves[catchId], { vars: { victim: v, x0: v.x, y0: v.y } });
        capture(f, v, (ff) => ff.move?.eggCatch);
      };
    },
    script(f, mf) { if (mf >= 36) f.onGrab = null; },
  };
}
// catch + swallow + lay (one move): pull in over 1-24, hidden at 25, egg on 31, total 55
export function eggCatch(o = {}) {
  const mouth = o.mouth ?? [150, 260];
  return {
    total: 55, groundOK: true, keepOnFall: true, drift: true, driftMul: 0.5, eggCatch: true, noStale: true, hitboxes: [],
    anim: o.anim,
    script(f, mf) {
      const v = f.vars.victim; if (!v) return;
      if (mf <= 24 && v.capt) {
        const k = Math.min(1, mf / 22), e = k * k;
        const tx = f.x + f.facing * mouth[0], ty = f.y + mouth[1] - v.H * 0.5;
        v.x = f.vars.x0 + (tx - f.vars.x0) * e; v.y = f.vars.y0 + (ty - f.vars.y0) * e; v.facing = -f.facing;
      }
      if (mf === 25) { hideCaptured(v); f.match.emit('sfx', { name: 'eat' }); }
      if (mf > 25 && v.capt) { v.x = f.x; v.y = f.y + f.H * 0.3; }
      if (mf >= 31) f.invincible = Math.max(f.invincible, mf <= 40 ? 1 : 0);
      if (mf === 31 && v.capt) trapInEgg(f, v, f.x + f.facing * 200, f.y + 90, o.spot ?? spotOf(f));
    },
  };
}

// ---------------- Egg Throw ----------------
// Egg in hand from frame 4, thrown on frame 23. Force = frames B held (from frame 1). angle = 73° minus a stick tilt
// of up to 20° (min(|x|/65,1)*20, signed by direction), speed = force*2.3 + 50. Gravity 2.7, tvel 120, lifetime 50,
// explodes on fighters / ground; explosion 10 frames radius 340 (14%, angle 361, kbg 50, bkb 50).
export function eggThrow(o = {}) {
  return {
    total: 71, groundOK: true, keepOnFall: true, hitboxes: [], eggThrow: true, anim: o.anim,
    onStart(f) { f.vars.held = 0; f.vars.aimX = 0; },
    script(f, mf, c) {
      if (mf <= 22) { if (c.held('B')) f.vars.held++; f.vars.aimX = c.x; }
      if (mf === 23) {
        const force = f.vars.held;
        const X = f.vars.aimX * S;
        let tilt = Math.min(Math.abs(X) / 65, 1) * 20; if (tilt < 6) tilt = 0;
        const dirFwd = sign(X) * f.facing;                       // +1 aiming forward
        const ang = (73 - tilt * dirFwd) * PI / 180;
        const spd = force * 2.3 + 50;
        const x = f.x + f.facing * f.H * 0.15, y = f.y + f.H * 0.95;
        spawnEgg(f, x, y, Math.cos(ang) * spd * f.facing, Math.sin(ang) * spd, -(force * 2.1 + 1.5), o.spot ?? spotOf(f));
        f.match.emit('sfx', { name: 'throw' });
      }
    },
  };
}
export function spawnEgg(f, x, y, vx, vy, spin, spot) {
  const m = f.match;
  const HB = { damage: 14, angle: 361, kbg: 50, bkb: 50, element: 'normal', shieldDmg: 0 };
  const p = new Projectile(m, f, {
    kind: 'yoshiegg', x, y, vx, vy, gravity: 2.7, tvel: 120, life: 50, r: 100, floorDie: true, wallStop: true, moveId: 'uspecial',
    hb: HB,
    makeView: (scene) => { const g = eggMesh(spot, 0.75); scene.add(g); return g; },
    updateView: (v) => { v.rotation.z += spin * PI / 180; },
  });
  p.onDie = (pp) => explosion(m, pp.owner, pp.x, pp.y, { r: 340, life: 10, ...HB, element: 'normal', color: 0xffe0a0, moveId: 'uspecial', skip: pp.hit, staleMul: pp.staleMul });
  m.spawnProjectile(p);
}

// ---------------- Yoshi Bomb ----------------
// Ground: hop (30-frame start), body hitbox from frame 30 (air: 24) until landing; descent vel_y = -150,
// |vel_x| <= 30. Uses up the double jump. Landing: 44 frames, two stars on frame 3 at ±300 (y+20), 30 u/f outward.
export function yoshiBomb(o = {}) {
  const air = !!o.air;
  const HIT = air ? 24 : 30;
  const RISE = air ? 120 : 380, R1 = air ? 12 : 20;
  const hb = { frames: [HIT, 9999], damage: 18, angle: 60, bkb: 50, kbg: 100, fkb: 0, r: 230, size: 230, element: 'normal', pos: [0, 160], ground: true, air: true };
  const curve = t => 1 - (1 - t) * (1 - t);
  return {
    total: 9999, hitboxes: [hb], groundOK: false, keepOnFall: true, noAirFriction: true, landMove: o.landId ?? 'dspecialLand',
    ledgeGrab: true, ledgeGrabFrom: HIT, yoshiBomb: true, anim: o.anim, sfx: 'jump',
    onStart(f) { f.jumpsUsed = f.a.jumps; f.vars.air = !f.grounded; f.vars.fromAir = !f.grounded; },
    script(f, mf, c) {
      if (mf === 1) { f.grounded = false; f.ground = null; f.y += 1; }
      if (mf <= R1) {
        const n = R1, k0 = curve((mf - 1) / n), k1 = curve(mf / n);
        f.noGravity = true; f.vy = (k1 - k0) * RISE; f.vx *= 0.9;
      } else if (mf < HIT) { f.noGravity = true; f.vy = 0; f.vx *= 0.9; }
      else {
        f.noGravity = true; f.vy = -150;
        const X = c.x * S;
        if (Math.abs(X) >= 8) f.vx += X * 0.02;
        f.vx = clamp(f.vx, -30, 30);
      }
    },
  };
}
export function yoshiBombLand(o = {}) {
  return {
    total: 44, hitboxes: [], groundOK: true, noStale: true, anim: o.anim,
    onStart(f) { f.vx = 0; },
    script(f, mf) {
      if (mf === 3) {
        for (const d of [1, -1]) spawnStar(f, f.x + d * 300, f.y + 20, d);
        f.match.emit('sfx', { name: 'star' });
      }
    },
  };
}
function spawnStar(f, x, y, d) {
  const m = f.match;
  const a = 30 * PI / 180;
  m.spawnProjectile(new Projectile(m, f, {
    kind: 'yoshistar', x, y, vx: Math.cos(a) * 30 * d, vy: Math.sin(a) * 30, gravity: 1.2, life: 16, r: 80, collide: false, moveId: 'dspecial',
    reflectable: false, absorbable: false,
    hb: { damage: 4, angle: 361, kbg: 100, bkb: 0, fkb: 30, element: 'normal', shieldDmg: -3 },
    makeView: (scene) => { const g = starMesh(0xfff040); scene.add(g); return g; },
    updateView: (v) => { v.rotation.z += 0.3 * d; v.scale.multiplyScalar(1.04); },
  }));
}
export function starMesh(color = 0xfff040, r = 0.8) {
  const s = new THREE.Shape();
  for (let i = 0; i < 10; i++) { const rr = i % 2 ? r * 0.45 : r, an = PI / 2 + i * PI / 5; i ? s.lineTo(Math.cos(an) * rr, Math.sin(an) * rr) : s.moveTo(Math.cos(an) * rr, Math.sin(an) * rr); }
  const g = new THREE.ExtrudeGeometry(s, { depth: r * 0.3, bevelEnabled: false }); g.translate(0, 0, -r * 0.15);
  return new THREE.Mesh(g, new THREE.MeshLambertMaterial({ color, emissive: 0x403000 }));
}
