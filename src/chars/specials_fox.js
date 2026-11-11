// Fox specials (decomp: src/ft/ftchar/ftfox/*.c, numbers from reference/spec/chars/fox.json `behavior`).
import * as THREE from 'three';
import { Projectile } from '../game/projectile.js';
import { P as POSES } from '../render/anims.js';
import { lerpPose, sampleKeys } from '../render/rig.js';

const S = 80;
const PI = Math.PI;
const sign = v => (v > 0 ? 1 : v < 0 ? -1 : 0);
export const keyAnim = (keys) => (f, mf) => sampleKeys(keys, mf);

// ---------------- Blaster ----------------
// Ground: 55-frame anim, shot on frame 25, B again from frame 29 restarts. Air: 45 frames, shot on 15,
// refire from 15. Laser: 160 u/f horizontal, no gravity/lifetime (dies on walls / blast zone),
// 6% angle 10 kbg 100 fkb 1 (hitstun only), radius 20, 1 shield damage; reflectable/absorbable.
const AIM = { ...POSES.idle, spine: [0.05, -0.35, 0], chest: [0, -0.15, 0], upperArmR: [-1.5, 0, 0.1], foreArmR: [-0.05, 0, 0], handR: [0, 0, 0],
  upperArmL: [0.2, 0, 0.5], foreArmL: [-0.6, 0, 0], thighL: [-0.35, 0, 0.12], shinL: [0.45, 0, 0], thighR: [0.25, 0, -0.1], shinR: [0.3, 0, 0], root: [0, -0.03, 0], extra1: [0.25, 0, 0] };
const DRAW = { ...POSES.idle, upperArmR: [0.3, 0, -0.35], foreArmR: [-0.8, 0, 0], spine: [0.1, 0.2, 0] };
export function blaster(air) {
  const SHOT = air ? 15 : 25, AGAIN = air ? 15 : 29, TOTAL = air ? 45 : 55;
  const keys = air
    ? [{ f: 0, pose: { ...POSES.fall, extra1: [0.25, 0, 0] } }, { f: 8, pose: { ...AIM, root: [0, 0, 0] } }, { f: 36, pose: { ...AIM, root: [0, 0, 0] } }, { f: 45, pose: POSES.fall }]
    : [{ f: 0, pose: POSES.idle }, { f: 10, pose: DRAW }, { f: 20, pose: AIM }, { f: 26, pose: { ...AIM, upperArmR: [-1.75, 0, 0.1] } }, { f: 30, pose: AIM }, { f: 46, pose: AIM }, { f: 55, pose: POSES.idle }];
  return {
    total: TOTAL, groundOK: true, keepOnFall: true, drift: !!air, sfx: null,
    anim: keyAnim(keys),
    onStart(f) { f.vars.shots = (f.vars.shots ?? 0); },
    script(f, mf, c) {
      if (mf === SHOT) fireLaser(f);
      if (mf >= AGAIN && c.pressed('B')) {
        const m = f.grounded ? f.def.moves.nspecial : f.def.moves.nspecialAir;
        f.startMove(m);
        if (!f.grounded) f.mf = 0;
      }
    },
  };
}
export function fireLaser(f) {
  // spawn at the blaster (right hand, joint 17) + 60 forward
  const x = f.x + f.facing * (f.H * 0.3 + 60), y = f.y + f.H * 0.5;
  const p = new Projectile(f.match, f, {
    kind: 'laser', x, y, vx: 160 * f.facing, vy: 0, life: 1e9, r: 20, wallStop: true, floorDie: false,
    hb: { damage: 6, angle: 10, kbg: 100, bkb: 0, fkb: 1, element: 'normal', shieldDmg: 1 },
    makeView: (scene) => laserView(scene),
  });
  p.updateView = (v) => {
    const len = Math.min(450, 60 + p.t * 50);
    v.children[0].scale.x = len; v.children[1].scale.x = len;
    const d = p.vx >= 0 ? -1 : 1;                // beam trails behind the tip
    v.children[0].position.x = d * len * 0.5 * 0.01; v.children[1].position.x = d * len * 0.5 * 0.01;
  };
  f.match.spawnProjectile(p);
  f.match.emit('sfx', { name: 'laser' });
}
function laserView(scene) {
  const g = new THREE.Group();
  const outer = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.16, 0.06), new THREE.MeshBasicMaterial({ color: 0xff3048, transparent: true, opacity: 0.85 }));
  const inner = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.07, 0.07), new THREE.MeshBasicMaterial({ color: 0xffe0e8 }));
  g.add(outer, inner);
  scene.add(g); return g;
}

// ---------------- Fire Fox ----------------
// Start 8 + hold 35 frames (launch on frame 43): air vy=0, vx/2, gravity 0.5 after 15 frames; ground vx/2.
// Launch: stick angle if |sx|+|sy| >= 45 (else up), 115 u/f, 30 frames, decelerating 3.0357/frame from
// the 2nd frame; 16% fire hitbox (angle 80, bkb 60, kbg 60) frames 43-72. Grounded with the stick along /
// into the floor -> dash along the ground. Floor hit at > 110 deg to the velocity -> bound, else ground end.
// End: air 20 frames then special fall (drift x1.0, landing 21), ground 29 frames (friction 1.5).
export const FIREFOX = { LAUNCH: 43, TRAVEL: 30, V: 115, DEC: 3.0357, GRAV: 0.5 };
const CHARGE = { ...POSES.crouch, root: [0, -0.12, 0], spine: [0.7, 0, 0], neck: [-0.5, 0, 0], upperArmL: [0.3, 0, 0.7], upperArmR: [0.3, 0, -0.7], foreArmL: [-1.2, 0, 0], foreArmR: [-1.2, 0, 0], extra1: [-0.3, 0, 0] };
const DIVE = { spine: [0, 0, 0], neck: [0, 0, 0], head: [0, 0, 0], upperArmL: [0.5, 0, 0.25], upperArmR: [0.5, 0, -0.25], foreArmL: [-0.3, 0, 0], foreArmR: [-0.3, 0, 0],
  thighL: [0.25, 0, 0.05], thighR: [0.25, 0, -0.05], shinL: [0.4, 0, 0], shinR: [0.4, 0, 0], footL: [0.6, 0, 0], footR: [0.6, 0, 0], extra1: [-0.2, 0, 0] };
function fireFoxAnim(f, mf) {
  const L = FIREFOX.LAUNCH;
  if (mf < L) {
    const k = Math.min(1, mf / 8);
    const p = lerpPose(POSES.idle, CHARGE, k);
    p.root = [0, -0.12 * k + (mf > 8 ? Math.sin(mf * 1.7) * 0.01 : 0), 0];
    return p;
  }
  // body pitched along the travel direction (pivot at the body centre)
  const ang = f.vars?.ang ?? PI / 2;
  const th = PI / 2 - ang;
  return { ...DIVE, body: [th, 0, 0], root: [0, 0.5 - 0.5 * Math.cos(th), -0.5 * Math.sin(th)] };
}
export function fireFox() {
  const { LAUNCH, TRAVEL, V, DEC } = FIREFOX;
  return {
    total: LAUNCH + TRAVEL - 1, groundOK: true, keepOnFall: true, keepVel: true, noAirFriction: true, sfx: 'charge',
    anim: fireFoxAnim, ledgeGrab: false,
    hitboxes: [{ frames: [LAUNCH, LAUNCH + TRAVEL - 1], damage: 16, angle: 80, bkb: 60, kbg: 60, fkb: 0, r: 90, size: 90, element: 'fire', ground: true, air: true, shieldDmg: 5, clank: true, pos: [0, 220] }],
    onStart(f) {
      f.vars.gd = 15; f.vars.travel = false; f.vars.ang = PI / 2;
      if (!f.grounded) f.vy = 0;
      f.vx /= 2; f.fastfall = false;
    },
    script(f, mf, c) {
      if (mf < LAUNCH) {
        if (f.grounded) f.friction();
        else {
          if (f.vars.gd > 0) { f.vars.gd--; f.noGravity = true; } else { f.noGravity = false; f.gravMul = FIREFOX.GRAV / f.a.gravity; }
          f.airFriction();
        }
        return;
      }
      if (mf === LAUNCH) {
        const sx = c.x * S, sy = c.y * S;
        let ang = PI / 2, ground = false;
        if (Math.abs(sx) + Math.abs(sy) >= 45) {
          if (Math.abs(sx) >= 11) f.facing = sign(sx);
          ang = Math.atan2(sy, sx * f.facing);
          if (f.grounded && sy <= 0 && !f.ground?.pass) ground = true;   // stick along/into the floor
        }
        f.vars.travel = true; f.vars.ang = ground ? 0 : ang; f.vars.ground = ground;
        f.noGravity = true; f.gravMul = 1;
        f.jumpsUsed = f.a.jumps;
        if (ground) { f.vx = V * f.facing; f.vy = 0; }
        else {
          if (f.grounded) { f.grounded = false; f.ground = null; f.y += 1; }
          f.vx = Math.cos(f.vars.ang) * V * f.facing; f.vy = Math.sin(f.vars.ang) * V;
        }
        f.match.emit('sfx', { name: 'fire' });
        f.vars.pvx = f.vx; f.vars.pvy = f.vy;
        return;
      }
      // travel
      f.noGravity = true;
      if (mf >= LAUNCH + 1) {
        if (f.grounded) { const s = Math.max(0, Math.abs(f.vx) - DEC); f.vx = s * f.facing; f.vy = 0; f.vars.ang = 0; }
        else {
          const cx = Math.cos(f.vars.ang) * f.facing, cy = Math.sin(f.vars.ang);
          const nvx = f.vx - DEC * cx, nvy = f.vy - DEC * cy;
          f.vx = sign(nvx) === sign(f.vx) || f.vx === 0 ? nvx : 0; if (Math.abs(cx) < 1e-6) f.vx = 0;
          f.vy = sign(nvy) === sign(f.vy) || f.vy === 0 ? nvy : 0;
          if (f.vx === 0 && f.vars.pvx !== 0 && Math.abs(cx) > 0.05) {
            // wall: slide along it (keep the vertical part)
            f.vars.ang = f.vy >= 0 ? PI / 2 : -PI / 2;
          }
        }
      }
      f.vars.pvx = f.vx; f.vars.pvy = f.vy;
      // hitbox at the leading end of the body
      const a = f.vars.ang, hb = this.hitboxes[0];
      f.dynamicHitboxes = [{ ...hb, pos: [Math.cos(a) * 110, f.H * 0.5 + Math.sin(a) * 110] }];
    },
    landHook(f) {
      if (!f.vars.travel) return false;            // charging: continue on the ground
      const vx = f.vars.pvx ?? 0, vy = f.vars.pvy ?? 0, m = Math.hypot(vx, vy) || 1;
      if (vy / m < Math.cos(110 * PI / 180)) {      // steep: bounce off the floor
        f.startMove(f.def.moves.fireFoxBound, { keepVars: true });
        f.grounded = false; f.ground = null; f.y += 1;
        f.vy = 38; f.vx = -vx * 0.15;
        return true;
      }
      f.startMove(f.def.moves.fireFoxEnd, { keepVars: true });
      return true;
    },
    after: f => (f.grounded ? f.def.moves.fireFoxEnd : f.def.moves.fireFoxEndAir),
  };
}
const ENDPOSE = { ...POSES.fall, spine: [-0.3, 0, 0], upperArmL: [-0.3, 0, 1.6], upperArmR: [-0.3, 0, -1.6] };
export const fireFoxExtra = {
  fireFoxEnd: {
    total: 29, keepVel: true, groundOK: true, keepOnFall: true,
    anim: keyAnim([{ f: 0, pose: { ...POSES.land, spine: [0.5, 0, 0] } }, { f: 29, pose: POSES.idle }]),
    script(f) { if (f.grounded) { const s = Math.max(0, Math.abs(f.vx) - 1.5); f.vx = s * sign(f.vx); } },
    hitboxes: [],
  },
  fireFoxEndAir: {
    total: 20, drift: true, helpless: true, helplessDrift: 1.0, helplessLand: 21, ledgeGrab: true,
    anim: keyAnim([{ f: 0, pose: { ...DIVE, body: [0, 0, 0] } }, { f: 20, pose: ENDPOSE }]),
    onStart(f) { f.vy = Math.min(f.vy, 20); },
    hitboxes: [],
  },
  fireFoxBound: {
    total: 30, drift: true, helpless: true, helplessDrift: 1.0, helplessLand: 21, ledgeGrab: true,
    anim: (f, mf) => ({ ...POSES.tumble, body: [-mf * 0.25, 0, 0] }),
    hitboxes: [],
  },
};

// ---------------- Reflector ----------------
// Frame 1: 5% electric hitbox (angle 0, fkb 80, r 180 at y+240), intangible frame 1. Reflects from frame 4
// while B is held, locked in for 18 frames; sphere r 350 at joint 4 (+60). Reflected projectiles: damage
// x1.8 + 0.99 (capped 100), reversed; projectiles above 50 damage pass through. Reflect-hit anim 18 frames.
// Left/right turns Fox around. Air: vy=0, vx/2, gravity 0.8 after 4 frames. End anim 17 frames (min 39).
const REFL_POSE = { ...POSES.idle, root: [0, -0.06, 0], spine: [0.25, 0, 0], neck: [-0.2, 0, 0], thighL: [-0.6, 0, 0.25], thighR: [-0.4, 0, -0.25], shinL: [0.8, 0, 0], shinR: [0.7, 0, 0],
  footL: [-0.2, 0, 0], footR: [-0.3, 0, 0], upperArmR: [-0.2, 0, -0.1], foreArmR: [-1.4, 0, 0.4], handR: [0, 0, 0], upperArmL: [-0.2, 0, 0.45], foreArmL: [-0.9, 0, 0], extra1: [0.4, 0, 0] };
export const REFLECT = { START: 4, LOCK: 18, END: 17, R: 350, Y: 260, MUL: 1.8, ADD: 0.99, CAP: 100, RESIST: 50, HIT: 18 };
export function reflector() {
  const R = REFLECT;
  return {
    total: 9999, groundOK: true, keepOnFall: true, noAirFriction: true, sfx: 'elec',
    anim: (f, mf) => {
      const v = f.vars ?? {};
      if (mf <= 4) return lerpPose(POSES.idle, REFL_POSE, mf / 4);
      if (v.endAt) return lerpPose(REFL_POSE, POSES.idle, Math.min(1, (mf - (v.endAt - R.END)) / R.END));
      const p = { ...REFL_POSE };
      if (v.hitT > 0) { p.spine = [0.05, 0, 0]; p.root = [0, -0.02, 0]; p.head = [-0.3, 0, 0]; }
      if (v.turnT > 0) p.body = [0, PI * (1 - v.turnT / 4), 0];
      return p;
    },
    onStart(f) {
      f.vars.gd = R.START;
      if (!f.grounded) { f.vy = 0; f.vx /= 2; f.fastfall = false; }
      f.vars.hitT = 0; f.vars.turnT = 0; f.vars.cand = [];
    },
    script(f, mf, c) {
      const v = f.vars;
      if (!f.grounded) {
        if (v.gd > 0) { v.gd--; f.noGravity = true; } else { f.noGravity = false; f.gravMul = 0.8 / f.a.gravity; }
        f.airFriction();
      }
      // did one of last frame's candidates get reflected?
      for (const p of v.cand) if (p.owner === f && !v.done?.has(p)) { (v.done ??= new Set()).add(p); v.hitT = R.HIT; f.match.emit('sfx', { name: 'shieldHit' }); }
      v.cand = [];
      if (v.hitT > 0) v.hitT--;
      if (v.turnT > 0) v.turnT--;
      const active = mf >= R.START && !v.endAt;
      f.reflecting = active;
      if (active && v.turnT === 0 && Math.abs(c.x) * S >= 20 && sign(c.x) !== f.facing && c.frame - c.lastNeutralXFrame < 4) { f.facing = -f.facing; v.turnT = 4; }
      if (!v.endAt && mf >= R.START + R.LOCK && !c.held('B') && v.hitT === 0) v.endAt = mf + R.END;
      if (v.endAt && mf >= v.endAt) { f.reflecting = false; f.endMove(); }
    },
  };
}
// install the reflect / landing hooks on the fighter (called from the character's init)
export function installFoxHooks(f) {
  const R = REFLECT;
  f.reflectBox = (p) => {
    if (!f.reflecting || f.state !== 'attack' || f.move?.id !== 'dspecial' && f.move?.id !== 'dspecialAir') return { x: 1e9, y: 1e9, r: 0 };
    const d = p?.hb?.damage ?? 0;
    if (d > R.RESIST) return { x: 1e9, y: 1e9, r: 0 };
    const n = Math.min(R.CAP, Math.floor(d * R.MUL + R.ADD));
    f.reflectMul = d > 0 ? (n + 0.5) / d : R.MUL;
    if (p) f.vars.cand?.push(p);
    return { x: f.x, y: f.y + R.Y * f.scale, r: R.R * f.scale };
  };
  f.onLand = (st) => (st === 'attack' && f.move?.landHook ? f.move.landHook(f, st) === true : false);
}
