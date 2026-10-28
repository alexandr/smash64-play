// Special-move builders shared by characters. Each returns a move override (merged over the decomp data
// in makeChar) with a per-frame `script(f, mf, c)`; numbers come from the move's `behavior`/`projectile`
// notes in reference/spec/chars/*.json.
import * as THREE from 'three';
import { Projectile } from '../game/projectile.js';

const S = 80;
const sign = v => (v > 0 ? 1 : v < 0 ? -1 : 0);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// hand position in world space (approximate, from height fractions)
export function handPos(f, fwd = 0.45, up = 0.55) { return [f.x + f.facing * f.H * fwd, f.y + f.H * up]; }

// ---------------- Mario / Luigi ----------------
// Fireball: spawn frame 16, 50 u/f at -5°, gravity 1.2, tvel 55, bounce 0.85, dies below speed 30, life 140.
export function fireball(o = {}) {
  const P = { speed: 50, angle: -5, gravity: 1.2, tvel: 55, bounce: 0.85, minSpeed: 30, life: 140, spawn: 16, damage: 7, kbg: 25, bkb: 10, r: 100, ...o };
  return {
    air: false, groundOK: true, keepOnFall: true, anim: 'special', drift: !!o.air, sfx: 'fire',
    landMove: null,
    script(f, mf) {
      if (mf === P.spawn) {
        const [x, y] = handPos(f, 0.5, 0.5);
        const a = P.angle * Math.PI / 180;
        f.match.spawnProjectile(new Projectile(f.match, f, {
          kind: 'fireball', x, y, vx: Math.cos(a) * P.speed * f.facing, vy: Math.sin(a) * P.speed, gravity: P.gravity, tvel: P.tvel,
          bounce: P.bounce, minBounceSpeed: P.minSpeed, life: P.life, r: P.r, color: P.color, luigi: P.luigi,
          hb: { damage: P.damage, angle: 361, kbg: P.kbg, bkb: P.bkb, element: 'fire', shieldDmg: 1 },
          makeView: (scene) => fireballView(scene, P.color ?? 0xff6010),
          updateView: (v, t) => { v.rotation.z += 0.35; },
        }));
        f.match.emit('sfx', { name: 'fire' });
      }
    },
  };
}
function fireballView(scene, color) {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.SphereGeometry(0.9, 8, 6), new THREE.MeshBasicMaterial({ color })));
  g.add(new THREE.Mesh(new THREE.SphereGeometry(0.55, 8, 6), new THREE.MeshBasicMaterial({ color: 0xfff080 })));
  for (let i = 0; i < 4; i++) { const t = new THREE.Mesh(new THREE.ConeGeometry(0.4, 1.2, 5), new THREE.MeshBasicMaterial({ color })); t.rotation.z = i * Math.PI / 2; t.position.set(Math.cos(i * Math.PI / 2) * 0.8, Math.sin(i * Math.PI / 2) * 0.8, 0); g.add(t); }
  g.scale.setScalar(0.9);
  scene.add(g); return g;
}

// Super Jump Punch: animation-driven rise (~944 up, ~1014 forward × stick), helpless after (drift ×0.6, landing 25).
export function superJumpPunch(o = {}) {
  const P = { up: 944, fwd: 700, rise: 24, total: 40, helplessDrift: 0.6, land: 25, ...o };
  // per-frame displacement from an ease-out curve
  const curve = t => 1 - Math.pow(1 - t, 2.2);
  return {
    anim: 'upspecial', helpless: true, helplessLand: P.land, helplessDrift: P.helplessDrift, groundOK: false, keepOnFall: true,
    ledgeGrab: true, ledgeGrabFrom: 20, noAirFriction: true, sfx: 'jump2',
    onStart(f) {
      if (!f.grounded) { f.vy = 0; f.vx /= 1.5; }
      f.vars.tilt = 0;
    },
    script(f, mf, c) {
      if (mf <= 6 && Math.abs(c.x) * S > 50) f.vars.tilt = clamp((Math.abs(c.x) * S - 50) * 0.6, 0, 18) * sign(c.x) * f.facing;
      if (mf === 7 && Math.abs(c.x) * S > 20 && sign(c.x) !== f.facing) f.facing = -f.facing;
      if (mf >= 2 && mf <= P.rise) {
        if (f.grounded) { f.grounded = false; f.ground = null; f.y += 1; }
        const k0 = curve((mf - 2) / (P.rise - 1)), k1 = curve((mf - 1) / (P.rise - 1));
        const dy = (k1 - k0) * P.up;
        const fw = (k1 - k0) * P.fwd * (1 + f.vars.tilt / 30);
        f.noGravity = true; f.vy = dy; f.vx = fw * f.facing;
      } else if (mf > P.rise) { f.noGravity = false; f.vx *= 0.9; }
    },
  };
}

// Mario Tornado: vy=-7 start; B taps +22 vy (max 40) once per airtime; drift 0.025/0.03 per stick unit, max 17.
export function tornado(o = {}) {
  return {
    anim: (f, mf, P) => ({ ...P.idle, upperArmL: [0, 0, 1.5], upperArmR: [0, 0, -1.5], body: [0, mf * 0.9, 0] }),
    groundOK: true, keepOnFall: true, noAirFriction: true, sfx: 'whiffL', ...o.extra,
    onStart(f) { if (!f.grounded) f.vy = -7; f.vars.taps = 0; },
    script(f, mf, c) {
      const X = c.x * S;
      const acc = f.grounded ? 0.025 : 0.03;
      if (Math.abs(X) >= 8) f.vx = clamp(f.vx + X * acc, -17, 17); else f.vx *= 0.9;
      if (mf > 43) f.vx *= 0.85;
      if (c.pressed('B') && mf <= 43 && !f.special.tornadoUsed) {
        f.vy = Math.min(40, f.vy + 22);
        if (f.grounded) { f.grounded = false; f.ground = null; f.y += 1; }
        f.vars.taps++;
      }
      if (!f.grounded && f.vars.taps) f.special.tornadoUsed = true;
    },
  };
}
