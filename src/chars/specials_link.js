// Link specials, numbers from reference/spec/chars/link.json (ftlinkspecial*.c, wplinkboomerang.c,
// itlinkbomb.c): Boomerang, Spin Attack, Bomb (held item-like projectile), Hookshot grab path,
// rapid jab chain, down-air bounce/rehit.
import * as THREE from 'three';
import { Projectile } from '../game/projectile.js';
import { findLanding, resolveBody, floorY } from '../game/collision.js';

const S = 80;
const sign = v => (v > 0 ? 1 : v < 0 ? -1 : 0);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const D2R = Math.PI / 180;

// ---------------- Boomerang ----------------
// Thrown on frame 26 from (150 fwd, 290 up). Smash (|x|>=56 within 8 frames): 114 u/f, life 190; else 85, 160.
// Stick Y angles it (max +-30 deg). Outbound decel 1.4/f to 10, then returns accelerating +1/f to 90, homing
// (turn <= 1.5 deg/f, 0.75 when far). 9 dmg out / 8 back, angle 70 kbg 30 bkb 55; can hit once each way.
export function boomerang(o = {}) {
  return {
    activeFrame: 26, groundOK: true, keepOnFall: true, drift: !!o.air, sfx: 'whiff',
    onStart(f) {
      const c = f.ctrl;
      f.vars.smash = !!c && Math.abs(c.x) * S >= 56 && c.frame - c.lastNeutralXFrame <= 8;
      f.vars.empty = !!(f.special.boomerang && !f.special.boomerang.dead);
    },
    script(f, mf, c) {
      if (mf !== 26 || f.vars.empty) return;
      const Y = c.y * S, X = Math.abs(c.x * S);
      const ang = Math.abs(Y) >= 10 ? clamp(Math.atan2(Y, Math.max(X, 40)) / D2R, -30, 30) : 0;
      const speed = f.vars.smash ? 114 : 85, life = f.vars.smash ? 190 : 160;
      const p = new Projectile(f.match, f, {
        kind: 'boomerang', x: f.x + f.facing * 150 * f.scale, y: f.y + 290 * f.scale, r: 100, life, collide: false, pierce: true, absorbable: false,
        vx: Math.cos(ang * D2R) * speed * f.facing, vy: Math.sin(ang * D2R) * speed,
        hb: { damage: 9, angle: 70, kbg: 30, bkb: 55, fkb: 0, element: 'normal' },
        makeView: boomerangView, updateView: (v, t) => { v.rotation.z = -t * 0.6; },
      });
      p.link = f; p.speed = speed; p.returning = false;
      p.onUpdate = boomerangUpdate;
      const baseReflect = p.reflect;
      p.reflect = function (v) { baseReflect.call(this, v); this.life = 100; this.returning = false; this.speed = Math.max(this.speed, 40); };
      f.special.boomerang = p;
      f.match.spawnProjectile(p);
      f.match.emit('sfx', { name: 'whiff' });
    },
  };
}
function boomerangUpdate(p, m) {
  const L = p.owner;
  const dir = Math.atan2(p.vy, p.vx);
  if (!p.returning) {
    p.speed = Math.max(10, p.speed - 1.4);
    if (p.speed <= 10) {                          // turn around toward the thrower
      p.returning = true; p.hit = new Set(); p.hb = { ...p.hb, damage: 8 };
      if (L && !L.dead) { const a = Math.atan2(L.y + L.H * 0.5 - p.y, L.x - p.x); p.vx = Math.cos(a) * p.speed; p.vy = Math.sin(a) * p.speed; }
    }
    if (!p.returning) { p.vx = Math.cos(dir) * p.speed; p.vy = Math.sin(dir) * p.speed; }
  } else {
    p.speed = Math.min(90, p.speed + 1);
    let a = dir;
    if (L && !L.dead) {
      const tx = L.x, ty = L.y + L.H * 0.5;
      const want = Math.atan2(ty - p.y, tx - p.x);
      let d = want - a; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
      const dist = Math.hypot(tx - p.x, ty - p.y);
      const maxT = (dist > 2000 ? 0.75 : 1.5) * D2R;
      a += clamp(d, -maxT, maxT);
      // caught
      if (dist <= 160 && L === p.link) {
        p.dead = true;
        if (L.special.boomerang === p) L.special.boomerang = null;
        if ((L.state === 'idle' || L.state === 'fall') && L.def.moves.nspecialCatch) L.startMove(L.def.moves.nspecialCatch);
        return false;
      }
    }
    p.vx = Math.cos(a) * p.speed; p.vy = Math.sin(a) * p.speed;
  }
  // walls bounce it back
  const res = resolveBody(m.col, p.x, p.y - 40, p.x + p.vx, p.y - 40 + p.vy, 40, 80);
  if (res.hitWall) p.vx = -p.vx;
  p.x += p.vx; p.y += p.vy;
  if (p.t >= p.life) { p.die(); if (p.link?.special.boomerang === p) p.link.special.boomerang = null; return false; }
  const bz = m.stage.blast;
  if (p.x < bz.left || p.x > bz.right || p.y < bz.bottom || p.y > bz.top) { p.dead = true; if (p.link?.special.boomerang === p) p.link.special.boomerang = null; }
  return false;
}
function boomerangView(scene) {
  const g = new THREE.Group();
  const m = new THREE.MeshLambertMaterial({ color: 0xa06a30 });
  const a = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.22, 0.08), m); a.position.set(0.32, 0.12, 0); a.rotation.z = 0.5;
  const b = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.22, 0.08), m); b.position.set(-0.32, 0.12, 0); b.rotation.z = -0.5;
  const gem = new THREE.Mesh(new THREE.SphereGeometry(0.12, 6, 4), new THREE.MeshLambertMaterial({ color: 0xe03030 }));
  gem.position.set(0, 0.3, 0.05);
  g.add(a, b, gem);
  scene.add(g); return g;
}

// ---------------- Spin Attack ----------------
// Ground: spins in place (16 dmg first sweep f8-11, then 8 dmg), not helpless. Air: vy = 69, gravity x0.23
// until frame 12, drift accel x0.5, then helpless (drift x0.6, landing 13).
export function spinAttack(anim, air) {
  return {
    anim, groundOK: !air, keepOnFall: air, noAirFriction: true, sfx: 'slash',
    helpless: air, helplessLand: 13, helplessDrift: 0.6, ledgeGrab: air, ledgeGrabFrom: 30,
    onStart(f) {
      if (air) { f.vy = 69; f.gravMul = 0.23; f.fastfall = false; if (f.grounded) { f.grounded = false; f.ground = null; f.y += 1; } }
    },
    script(f, mf, c) {
      if (air) {
        f.gravMul = mf < 12 ? 0.23 : 1;
        const X = c.x * S, max = f.a.airMax;
        if (Math.abs(X) >= 8) f.vx = clamp(f.vx + X * f.a.airAccel * 0.5, -max, max);
        else f.airFriction();
      }
    },
  };
}
// the sword-trail weapon (5 dmg, angle 30, kbg 50, bkb 30) following the blade tip; it shrinks over the spin
export function spinTrailHitboxes() {
  const hb = (frames, r) => ({ frames, damage: 5, angle: 30, bkb: 30, kbg: 50, fkb: 0, r, size: r, bone: 'sword', off: [0, 0, 300], element: 'slash', ground: true, air: true, group: 7 });
  return [hb([12, 19], 60), hb([20, 25], 50), hb([26, 29], 40)];
}

// ---------------- Bomb ----------------
// Pulled on frame 29 into the hand. Fuse 300 frames (bloats from 96 left). Thrown like an item: explodes on
// contact if |vx|>36 or |vy|>25, or after taking >= 7 damage; otherwise bounces (0.4 walls / 0.3 ground).
// Contact 2 dmg (angle 80, kbg 20, bkb 60); explosion 5 dmg fire, radius 150 -> 115 -> 75 every 2 frames.
const BOMB = { life: 300, bloat: 96, gravity: 1.2, tvel: 100, fastX: 36, fastY: 25, health: 7, R: 45 };
// throw velocities from the common light-item throw table (vel, angle)
const THROWS = {
  f: [60, 15], b: [60, 15], hi: [65, 90], lw: [65, -70], f4: [110, 8], b4: [110, 8], hi4: [110, 90], lw4: [110, -70], dash: [120, 10],
  airF: [75, 8], airB: [75, 8], airHi: [80, 90], airLw: [75, -90], airF4: [120, 7], airB4: [120, 7], airHi4: [120, 90], airLw4: [140, -90],
};
// which input throws the held bomb in which direction (ground / air)
export const BOMB_DIR = {
  jab1: 'f', ftilt: 'f', ftiltHi: 'f', ftiltLo: 'f', grab: 'f', dashattack: 'dash', fsmash: 'f4', utilt: 'hi', usmash: 'hi4', dtilt: 'lw', dsmash: 'lw4',
  nair: 'airF', fair: 'airF', bair: 'airB', uair: 'airHi', dair: 'airLw', dspecial: 'f4', dspecialAir: 'airF4',
};

export function bombPull(anim, air) {
  return {
    anim, activeFrame: 29, groundOK: true, keepOnFall: true, drift: air,
    script(f, mf) {
      if (mf !== 29) return;
      const b = f.special.bomb;
      if (b && !b.dead && b.held) return;
      spawnBomb(f);
    },
  };
}
export function bombHandPos(f) { return [f.x + f.facing * f.H * 0.13, f.y + f.H * 0.45]; }
function spawnBomb(f) {
  const [x, y] = bombHandPos(f);
  const p = new Projectile(f.match, f, {
    kind: 'linkbomb', x, y, r: 110, life: Infinity, collide: false, reflectable: false, absorbable: false, hitbox: false,
    hb: { damage: 2, angle: 80, kbg: 20, bkb: 60, fkb: 0, element: 'normal' },
    makeView: bombView, updateView: bombSync,
  });
  p.held = true; p.holder = f; p.fuse = 0; p.ex = -1; p.dmgTaken = 0; p.ground = null;
  p.onUpdate = bombUpdate;
  p.onHitHook = (pp, v, shield) => { if (pp.ex < 0) explode(pp); };
  f.special.bomb = p;
  f.match.spawnProjectile(p);
  f.match.emit('sfx', { name: 'item' });
}
function explode(p) {
  if (p.ex >= 0) return;
  if (p.holder?.special.bomb === p) p.holder.special.bomb = null;
  p.held = false; p.ex = 0; p.vx = p.vy = 0;
  p.hitbox = true; p.hitsOwner = true; p.hit = new Set(); p.r = 150; p.damage = undefined;
  p.hb = { damage: 5, angle: 361, kbg: 20, bkb: 60, fkb: 0, element: 'fire' };
  p.match.emit('sfx', { name: 'explode' });
  p.match.emit('explosion', { x: p.x, y: p.y, r: 300 });
}
function bombUpdate(p, m) {
  p.fuse++;
  if (p.ex >= 0) {                                         // exploding
    p.ex++;
    p.r = p.ex < 2 ? 150 : p.ex < 4 ? 115 : 75;
    if (p.ex >= 6) p.dead = true;
    return false;
  }
  if (p.fuse >= BOMB.life) { explode(p); return false; }
  const f = p.holder;
  if (p.held) {
    if (!f || f.dead || ['grabbed', 'thrown', 'ledge', 'respawn'].includes(f.state)) { dropBomb(p); }
    else { [p.x, p.y] = bombHandPos(f); p.hitbox = false; return false; }
  }
  // struck by an attack of 7%+ -> explode
  for (const a of m.fighters) for (const h of a.activeHitboxes ?? []) {
    if (h.hb.grab || (h.hb.damage ?? 0) < BOMB.health) continue;
    if ((h.x - p.x) ** 2 + (h.y - p.y) ** 2 <= (h.r + BOMB.R) ** 2) { explode(p); return false; }
  }
  const fast = Math.abs(p.vx) > BOMB.fastX || Math.abs(p.vy) > BOMB.fastY;
  p.hitbox = fast && p.t > 2;
  p.damage = Math.trunc(2 + Math.hypot(p.vx, p.vy) * 0.1 + 0.999);   // thrown-item damage grows with speed (items.md)
  if (p.ground) {                                          // resting on a floor
    const y = p.ground.active ? floorY(p.ground, p.x) : null;
    if (y === null) p.ground = null; else { p.y = y + BOMB.R; p.vx *= 0.9; if (Math.abs(p.vx) < 0.5) p.vx = 0; p.x += p.vx; return false; }
  }
  p.vy = Math.max(-BOMB.tvel, p.vy - BOMB.gravity);
  const x0 = p.x, y0 = p.y - BOMB.R;
  let nx = p.x + p.vx, ny = y0 + p.vy;
  const res = resolveBody(m.col, x0, y0, nx, ny, BOMB.R, BOMB.R * 2);
  if (res.hitWall) { if (fast) { explode(p); return false; } p.vx = -p.vx * 0.4; nx = res.x; }
  if (res.hitCeil) { p.vy = -Math.abs(p.vy) * 0.4; ny = res.y; }
  if (p.vy <= 0) {
    const land = findLanding(m.col, x0, y0, nx, ny, false, null);
    if (land) {
      if (fast) { p.x = land.x; p.y = land.y + BOMB.R; explode(p); return false; }
      p.x = land.x; p.y = land.y + BOMB.R; p.vy = Math.abs(p.vy) * 0.3; p.vx *= 0.4;
      if (p.vy < 4) { p.vy = 0; p.ground = land.floor; }
      return false;
    }
  }
  p.x = nx; p.y = ny + BOMB.R;
  const bz = m.stage.blast;
  if (p.x < bz.left || p.x > bz.right || p.y < bz.bottom || p.y > bz.top) p.dead = true;
  return false;
}
export function dropBomb(p) {
  if (!p || p.dead || !p.held) return;
  p.held = false; p.vx = 0; p.vy = 10; p.t = 0;
  if (p.holder?.special.bomb === p) p.holder.special.bomb = null;
}
// throw move: releases on frame 6 with the item throw table velocity
export function bombThrow(anim) {
  return {
    id: 'bombThrow', total: 24, hitboxes: [], anim, groundOK: true, keepOnFall: true, noStale: true, drift: true,
    onStart(f) { if (/^(b|airB)/.test(f.vars.dir ?? '')) f.facing = -f.facing; },
    script(f, mf) {
      if (mf !== 6) return;
      const p = f.special.bomb;
      if (!p || p.dead || !p.held) return;
      const [vel, ang] = THROWS[f.vars.dir] ?? THROWS.f;
      p.held = false; p.t = 0; p.owner = f; p.hit = new Set();
      p.vx = Math.cos(ang * D2R) * vel * f.facing; p.vy = Math.sin(ang * D2R) * vel;
      f.special.bomb = null;
      f.match.emit('sfx', { name: 'throw' });
    },
  };
}
function bombView(scene) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.42, 10, 8), new THREE.MeshLambertMaterial({ color: 0x1a2a6a }));
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.16, 0.12, 8), new THREE.MeshLambertMaterial({ color: 0x6a6a7a }));
  cap.position.y = 0.42;
  const fuse = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.18, 4), new THREE.MeshLambertMaterial({ color: 0xe0d0a0 }));
  fuse.position.y = 0.56;
  const spark = new THREE.Mesh(new THREE.SphereGeometry(0.08, 5, 4), new THREE.MeshBasicMaterial({ color: 0xffd040 }));
  spark.position.y = 0.67;
  const blast = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), new THREE.MeshBasicMaterial({ color: 0xff8020, transparent: true, opacity: 0.75 }));
  blast.visible = false;
  const bomb = new THREE.Group(); bomb.add(body, cap, fuse, spark);
  g.add(bomb, blast); g.userData = { bomb, body, spark, blast };
  scene.add(g); return g;
}
// GameView calls p.makeView(scene) / p.updateView(v, frame) as methods, so `this` is the bomb projectile
function bombSync(v, t) {
  const p = this, u = v.userData;
  u.spark.visible = (t % 4) < 2;
  if (p.ex >= 0) { u.bomb.visible = false; u.blast.visible = true; u.blast.scale.setScalar(p.r * 0.01); return; }
  const left = BOMB.life - p.fuse;
  const s = left < BOMB.bloat ? 1 + 0.12 * (1 + Math.sin(t * (0.4 + (BOMB.bloat - left) * 0.01))) : 1;
  u.bomb.scale.setScalar(s);
  u.body.material.emissive.setHex(left < BOMB.bloat && (t % 8) < 4 ? 0x801010 : 0x000000);
}

// ---------------- Hookshot (grab) ----------------
// grab box rides the hookshot claw: shoots out from the right hand, peaks ~600 units ahead, reels back
export function hookDist(mf) {
  const k = [[10, 40], [17, 160], [22, 600], [24, 600], [28, 330], [36, 60], [40, 0]];
  if (mf <= k[0][0]) return mf <= 8 ? 0 : k[0][1];
  for (let i = 1; i < k.length; i++) if (mf <= k[i][0]) { const t = (mf - k[i - 1][0]) / (k[i][0] - k[i - 1][0]); return k[i - 1][1] + (k[i][1] - k[i - 1][1]) * t; }
  return 0;
}
export const HOOK_Y = 0.5;
export function hookPath(H) {
  const path = {};
  for (let f = 17; f <= 28; f++) path[f] = [Math.round(hookDist(f)), Math.round(H * HOOK_Y)];
  return path;
}
export function hookVisual(view, f) {
  let hk = view.extra.hook;
  if (!hk) {
    hk = new THREE.Group();
    const m = new THREE.MeshLambertMaterial({ color: 0x9098a8 });
    const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 1, 4), m); chain.rotation.x = Math.PI / 2;
    const claw = new THREE.Group();
    claw.add(new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.08, 4), m));
    claw.children[0].rotation.x = Math.PI / 2;
    hk.add(chain, claw); hk.userData = { chain, claw };
    view.root.add(hk); view.extra.hook = hk;
  }
  const on = f.state === 'attack' && f.move?.id === 'grab' && f.mf > 8 && f.mf < 40;
  hk.visible = on;
  if (!on) return;
  const H = f.H, d = hookDist(f.mf) / H, y = HOOK_Y, z0 = 0.12;
  const { chain, claw } = hk.userData;
  claw.position.set(-0.02, y, z0 + d);
  chain.scale.set(1, Math.max(0.001, d), 1); chain.position.set(-0.02, y, z0 + d / 2);
}

// ---------------- Rapid jab ----------------
// During jab 1/2, 5 A presses/releases enter the rapid jab instead of jab 3. The loop continues while A is
// being pressed during it; otherwise it ends.
export function countJab(f, c) { if (c.pressed('A') || c.released('A')) f.special.jabInputs = (f.special.jabInputs ?? 0) + 1; }
export function jabRapidLoop() {
  return {
    onStart(f) { f.vars.mashed = false; },
    script(f, mf, c) { if (c.pressed('A') || c.released('A')) f.vars.mashed = true; },
    after: f => (f.vars.mashed ? f.def.moves.jabRapid : f.def.moves.jabRapidEnd),
  };
}

// ---------------- Down air: bounce and rehit ----------------
// On hit Link bounces (vy = 40) and the animation rewinds to frame 35 if past it; the hitbox can hit again
// 30 frames later while before frame 65.
export function dairBounce() {
  return {
    onHit(f) {
      f.vy = 40; f.fastfall = false;
      if (f.mf > 35) f.mf = 35;
      f.vars.rehit = f.mf + 30;
    },
    script(f, mf) { if (f.vars.rehit && mf >= f.vars.rehit && mf < 65) { f.vars.rehit = 0; f.hitVictims = new Map(); } },
  };
}
