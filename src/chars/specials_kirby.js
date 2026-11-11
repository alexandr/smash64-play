// Kirby specials: Inhale (catch, swallow, spit star / copy ability), Final Cutter, Stone, and the copied
// neutral specials of every character (from the copy table in reference/spec/chars/kirby.json).
import * as THREE from 'three';
import { Projectile } from '../game/projectile.js';
import { fireball, handPos } from './specials.js';
import { S, sign, clamp, chargeShot, enemiesOf, touches } from './specials_samus.js';
import { capture, hideCaptured, releaseCapture, mashed, eggLay, eggCatch, starMesh } from './specials_yoshi.js';

const PI = Math.PI;
const basic = (color, opacity = 1, add = false) => new THREE.MeshBasicMaterial({ color, transparent: opacity < 1 || add, opacity, depthWrite: !add, blending: add ? THREE.AdditiveBlending : THREE.NormalBlending });

// characters whose neutral special Kirby can copy (hat id = character id)
export const COPYABLE = ['mario', 'luigi', 'fox', 'samus', 'dk', 'link', 'yoshi', 'falcon', 'pikachu', 'jigglypuff', 'ness'];
const STAR_DAMAGE = { yoshi: 25, dk: 30 };

// ---------------- Inhale ----------------
// Start 20 frames, inhale loop from 21 while B is held (catch boxes on TopN: r145 at (z200,y240), r180 at (z410,y240)),
// end 20 frames. Caught: pulled in (19 frames) and swallowed -> stuffed (InhaleWait).
export function inhale(o = {}) {
  const air = !!o.air;
  const box = (r, z) => ({ frames: [21, 99999], damage: 1, angle: 361, bkb: 0, kbg: 100, fkb: 0, r, size: r, grab: true, grabAir: true, pos: [z, 240] });
  return {
    total: 99999, groundOK: true, keepOnFall: true, drift: air, inhale: true, hitboxes: [box(145, 200), box(180, 410)], anim: o.anim, sfx: 'whiffL',
    onStart(f) {
      const cp = f.special.copy;
      if (cp && f.def.moves['copy_' + cp]) { f.startMove(f.def.moves['copy_' + cp + (f.grounded ? '' : 'Air')] ?? f.def.moves['copy_' + cp]); return; }
      f.vars.endAt = null;
      f.onGrab = (v) => {
        f.onGrab = null;
        f.startMove(f.def.moves.inhaleCatch, { vars: { victim: v, x0: v.x, y0: v.y } });
        capture(f, v, ff => ff.move?.inhaleHold);
      };
    },
    script(f, mf, c) {
      const v = f.vars;
      if (mf >= 21 && v.endAt == null && !c.held('B')) { v.endAt = mf + 20; f.dynamicHitboxes = []; f.onGrab = null; }
      if (mf >= 21 && v.endAt == null && mf % 12 === 0) f.match.emit('sfx', { name: 'whiff' });
      if (v.endAt != null && mf >= v.endAt) { f.onGrab = null; f.endMove(); }
    },
  };
}
// pulled into the mouth, swallowed on frame 19
export function inhaleCatch(o = {}) {
  return {
    total: 19, groundOK: true, keepOnFall: true, drift: true, inhaleHold: true, noStale: true, hitboxes: [], anim: o.anim, after: 'inhaleWait',
    script(f, mf) {
      const v = f.vars.victim; if (!v?.capt) return;
      const k = Math.min(1, mf / 16), e = k * k;
      const tx = f.x + f.facing * 90, ty = f.y + f.H * 0.5 - v.H * 0.5;
      v.x = f.vars.x0 + (tx - f.vars.x0) * e; v.y = f.vars.y0 + (ty - f.vars.y0) * e; v.facing = -f.facing;
      if (mf === 17) { hideCaptured(v); f.match.emit('sfx', { name: 'eat' }); }
    },
  };
}
// stuffed: walk slowly, turn, one jump; double gravity & max fall in the air. A = spit, B / down = copy.
// The victim mashes out (escape timer 90 + 0.5*percent frames, -6 per mash input).
export function inhaleWait(o = {}) {
  return {
    total: 99999, groundOK: true, keepOnFall: true, walkOff: true, drift: true, driftMul: 0.6, keepVel: true, inhaleHold: true, stuffed: true,
    noStale: true, hitboxes: [], anim: o.anim,
    onStart(f) { const v = f.vars.victim; f.vars.esc = 90 + (v?.percent ?? 0) * 0.5; f.vars.jumped = false; },
    script(f, mf, c) {
      const vv = f.vars, v = vv.victim;
      if (!v?.capt) { f.endMove(); return; }
      hideCaptured(v);
      v.x = f.x; v.y = f.y + f.H * 0.3; v.vx = v.vy = 0;
      if (!f.grounded) { f.gravMul = 2; f.a.tvel = f.def.attr.tvel * 2; }
      // escape
      vv.esc -= 1 + (mashed(v.ctrl) ? 6 : 0);
      if (vv.esc <= 0) {
        releaseCapture(v, { vx: 30 * f.facing, vy: 40, intangible: 12 });
        v.x = f.x + f.facing * 120;
        f.startMove(f.def.moves.inhaleRelease);
        return;
      }
      if (mf > 3) {
        if (c.pressed('A')) { f.startMove(f.def.moves.inhaleSpit, { keepVars: true }); return; }
        if (c.pressed('B') || (c.y * S < -40 && f.grounded)) { f.startMove(f.def.moves.inhaleCopy, { keepVars: true }); return; }
      }
      const X = c.x * S;
      if (f.grounded) {
        if (Math.abs(X) >= 20) { f.facing = sign(X); f.vx = X * f.a.walkMul * 0.45; } else f.friction();
        f.walkPhase = (f.walkPhase ?? 0) + Math.abs(f.vx) / (f.H * 1.1);
      }
      if (!vv.jumped && (c.jumpPressed() || (c.y * S >= 53 && c.frame - c.lastNeutralYFrame <= 3))) {
        vv.jumped = true; f.grounded = false; f.ground = null; f.y += 1; f.vy = 58; f.vx = X * f.a.jvx;
        f.match.emit('jump', { f });
      }
    },
  };
}
// spit the victim out as a star (InhaleSpit, 28 frames; star from frame 7, 120 u/f, victim takes 10%)
export function inhaleSpit(o = {}) {
  return {
    total: 28, groundOK: true, keepOnFall: true, inhaleHold: true, noStale: false, hitboxes: [], anim: o.anim,
    script(f, mf) {
      const v = f.vars.victim;
      if (v?.capt) { v.x = f.x; v.y = f.y + f.H * 0.3; }
      if (mf === 7 && v?.capt) spitStar(f, v);
    },
  };
}
function spitStar(f, v) {
  const m = f.match;
  releaseCapture(v);
  v.percent = Math.min(999, v.percent + 10); v.stats.dmgTaken += 10; f.stats.dmgGiven += 10; v.lastAttacker = f;
  // the victim rides inside the star: hidden, no physics, untouchable
  const sc = v.scale;
  v.setState('kirbystar'); v.noPhysics = true; v.untouchable = true; v.scale = sc * 0.02; v.grounded = false; v.ground = null;
  const dir = f.facing;
  const p = new Projectile(m, f, {
    kind: 'kirbystar', x: f.x + dir * 150, y: f.y + f.H * 0.45, vx: 120 * dir, vy: 0, life: 34, r: 110, collide: false, moveId: 'nspecial',
    hb: { damage: STAR_DAMAGE[v.def.id] ?? 17, angle: 361, kbg: 100, bkb: 0, element: 'normal' },
    makeView: (scene) => { const g = starMesh(0xfff040, 1.0); scene.add(g); return g; },
    updateView: (g) => { g.rotation.z -= 0.35 * dir; },
  });
  p.hit.add(v);
  let done = false;
  const finish = () => {
    if (done) return; done = true;
    v.noPhysics = false; v.untouchable = false; v.scale = sc;
    if (!v.dead && v.state === 'kirbystar') {
      v.setState('fall'); v.x = p.x; v.y = p.y - v.H * 0.4; v.vx = p.vx * 0.15; v.vy = 25; v.intangible = 10;
    }
  };
  p.onUpdate = (pp, mm) => {
    if (v.dead || v.state !== 'kirbystar') { finish(); pp.dead = true; return false; }
    pp.vx *= 0.93;
    pp.x += pp.vx;
    v.x = pp.x; v.y = pp.y - v.H * 0.3;
    const bz = mm.stage.blast;
    if (pp.t >= pp.life || pp.x < bz.left || pp.x > bz.right) { finish(); pp.dead = true; }
    return false;
  };
  p.onHitHook = (pp) => { finish(); pp.die(); };
  m.spawnProjectile(p);
  m.emit('sfx', { name: 'star' });
}
// copy: victim takes 6% and pops out at 75° / speed 100; Kirby gains its neutral special (hat)
export function inhaleCopy(o = {}) {
  return {
    total: 30, groundOK: true, keepOnFall: true, inhaleHold: true, noStale: true, hitboxes: [], anim: o.anim,
    script(f, mf) {
      const v = f.vars.victim;
      if (v?.capt) { v.x = f.x; v.y = f.y + f.H * 0.3; }
      if (mf === 8 && v?.capt) {
        const id = v.def.id === 'kirby' ? v.special.copy : v.def.id;
        releaseCapture(v);
        v.percent = Math.min(999, v.percent + 6); v.stats.dmgTaken += 6; f.stats.dmgGiven += 6; v.lastAttacker = f;
        v.setState('tumble'); v.hitstun = 18; v.grounded = false; v.ground = null; v.y = f.y + f.H * 0.5; v.x = f.x - f.facing * 40;
        const a = 75 * PI / 180; v.kbx = Math.cos(a) * 100 * -f.facing * 0.4; v.kby = Math.sin(a) * 100 * 0.6; v.vx = v.vy = 0;
        if (id && COPYABLE.includes(id)) { f.special.copy = id; f.special.charge = 0; f.special.dkCharge = 0; f.flash = 12; }
        f.match.emit('sfx', { name: 'heal' });
      }
    },
  };
}
export function inhaleRelease(o = {}) { return { total: 40, groundOK: true, keepOnFall: true, hitboxes: [], noStale: true, anim: o.anim }; }

// ---------------- Final Cutter ----------------
// Leap up with the blade (root motion), rising hit frame 23, then plunge: falling hits 46-49 / 54-56. Air drift at
// half accel. Uses up remaining jumps at 23. Landing (35 frames) launches a cutter wave from x+200: 6% slash,
// 100 u/f, lifetime 20. Ends in the air -> special fall.
export function finalCutter(o = {}) {
  const curve = t => 1 - (1 - t) * (1 - t);
  const RISE = 640, R0 = 22, R1 = 37;   // crouch/wind-up 1-21, leap 22-37 (rising slash on 23), hang, plunge from 43
  return {
    total: 57, anim: o.anim, helpless: true, helplessLand: 20, keepOnFall: true, noAirFriction: true, landMove: 'uspecialLand', finalCutter: true, sfx: 'slash',
    ledgeGrab: true, ledgeGrabFrom: 44,
    onStart(f) { if (!f.grounded) { f.vy = 0; f.vx *= 0.5; } },
    script(f, mf, c) {
      if (mf === R0 && f.grounded) { f.grounded = false; f.ground = null; f.y += 1; }
      if (mf >= R0 && mf <= R1) {
        const k0 = curve((mf - R0) / (R1 - R0 + 1)), k1 = curve((mf - R0 + 1) / (R1 - R0 + 1));
        f.noGravity = true; f.vy = (k1 - k0) * RISE;
      } else if (mf > R1 && mf <= 42) { f.noGravity = true; f.vy = 0; }
      else if (mf > 42) { f.noGravity = true; f.vy = Math.max(-140, f.vy - 9); }
      if (mf === 23) f.jumpsUsed = f.a.jumps;
      if (!f.grounded) {
        const X = c.x * S;
        if (Math.abs(X) >= 8) f.vx = clamp(f.vx + X * f.a.airAccel * 0.5, -f.a.airMax, f.a.airMax);
        else f.vx *= 0.95;
      }
    },
  };
}
export function finalCutterLand(o = {}) {
  return {
    total: 35, groundOK: true, hitboxes: [], noStale: true, anim: o.anim,
    onStart(f) { f.vx = 0; f.noGravity = false; },
    script(f, mf) { if (mf === 4) cutterWave(f); },
  };
}
function cutterWave(f) {
  const m = f.match, dir = f.facing;
  m.spawnProjectile(new Projectile(m, f, {
    kind: 'cutterwave', x: f.x + dir * 200, y: f.y + 110, vx: 100 * dir, vy: 0, life: 20, r: 125, moveId: 'uspecial',
    hb: { damage: 6, angle: 361, kbg: 50, bkb: 70, element: 'slash' },
    makeView: (scene) => {
      const g = new THREE.Group();
      const arc = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.16, 5, 14, PI), basic(0x9fd8ff, 0.85, true));
      arc.rotation.z = dir > 0 ? -PI / 2 : PI / 2; arc.scale.set(1, 1.3, 1);
      const core = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.06, 4, 14, PI), basic(0xffffff, 1));
      core.rotation.copy(arc.rotation); core.scale.copy(arc.scale);
      g.add(arc, core); scene.add(g); return g;
    },
  }));
  m.emit('sfx', { name: 'slash' });
}

// ---------------- Stone ----------------
// Turns to stone on frame 6 (ground) / 18 (air). Immune to damage (except grabs) until 38% has been absorbed.
// Falls at a constant -140 in the air; the stone hitbox (r200, 20%, angle 50, kbg 70, bkb 70) only hits while
// falling. Lasts up to 160 frames; B reverts after 18 frames; revert anim 30 frames.
export function stone(o = {}) {
  const hb = { frames: [1, 99999], damage: 20, angle: 50, bkb: 70, kbg: 70, fkb: 0, r: 200, size: 200, element: 'normal', pos: [0, 110], ground: true, air: true };
  return {
    total: 99999, groundOK: true, keepOnFall: true, walkOff: true, noAirFriction: true, keepVel: true, stone: true, hitboxes: [hb], anim: o.anim,
    onStart(f) { const v = f.vars; v.on = f.grounded ? 6 : 18; v.hp = 38; v.endAt = null; f.dynamicHitboxes = []; },
    script(f, mf, c) {
      const v = f.vars;
      const isStone = mf >= v.on && v.endAt == null;
      if (isStone) {
        v.isStone = true;
        f.counter = (a, h) => {
          if (h.hb.grab) return false;
          v.hp -= h.hb.damage ?? 0;
          if (v.hp > 0) {
            if (a && a !== f && a.hitlag !== undefined) a.hitlag = Math.max(a.hitlag, 6);
            f.match.emit('hit', { f, a, x: h.x ?? f.x, y: h.y ?? f.cy, dmg: 0, kb: 0, element: 'normal', blocked: true });
            return true;
          }
          v.endAt = f.mf; v.isStone = false; f.counter = null; return false;
        };
        if (!f.grounded) { f.noGravity = true; f.vy = -140; f.vx *= 0.9; f.dynamicHitboxes = [hb]; }
        else { f.noGravity = false; f.friction(1.15); f.dynamicHitboxes = []; }
        if (v.hp < 22 && mf % (v.hp < 10 ? 4 : 8) === 0) f.flash = 2;
        const t = mf - v.on;
        if ((t >= 18 && c.pressed('B')) || t >= 160) { v.endAt = mf + 30; v.isStone = false; f.counter = null; f.noGravity = false; f.match.emit('sfx', { name: 'roll' }); }
      } else {
        f.dynamicHitboxes = [];
        if (!f.grounded) { f.noGravity = false; f.airFriction(); } else f.friction();
        if (v.endAt == null && !f.grounded && mf < v.on) { f.vy = 0; f.vx *= 0.9; f.noGravity = true; }   // brief hang before dropping
        if (v.endAt != null && mf >= v.endAt) f.endMove();
      }
      if (mf === v.on) f.match.emit('sfx', { name: 'bump' });
    },
  };
}

// ================= copied abilities =================
// Fox Blaster: ground 55 frames (shot 25, refire from 29), air 45 (shot 15, refire 15). Laser 160 u/f, 6%, angle 10, fkb 1.
export function blaster(o = {}) {
  const air = !!o.air, SHOT = air ? 15 : 25, RE = air ? 15 : 29;
  return {
    total: air ? 45 : 55, groundOK: true, keepOnFall: true, drift: air, anim: o.anim, sfx: null, copyMove: true,
    script(f, mf, c) {
      if (mf === SHOT) {
        const [x, y] = handPos(f, 0.55, 0.45);
        f.match.spawnProjectile(new Projectile(f.match, f, {
          kind: 'laser', x: x + f.facing * 60, y, vx: 160 * f.facing, vy: 0, life: 200, r: 20, moveId: 'nspecial',
          hb: { damage: 6, angle: 10, kbg: 100, bkb: 0, fkb: 1, element: 'normal', shieldDmg: 1 },
          makeView: (scene) => { const m = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.08, 0.08), basic(0xff3030)); m.add(new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.04, 0.04), basic(0xffd0d0))); scene.add(m); return m; },
        }));
        f.match.emit('sfx', { name: 'laser' });
      }
      if (mf > RE && c.pressed('B')) f.mf = SHOT - 5;
    },
  };
}
// DK Giant Punch: start 8, charge up to 10 levels (stored like Samus' charge), punch hits frames 9-11 of the release
// (14 + 2*charge %), full charge 36% (frames 9-16, shield damage 12).
export function giantPunch(o = {}) {
  const air = !!o.air, START = 8, PER = 11, MAX = 10;
  const punch = (f, mf) => {
    const v = f.vars, full = v.lvl >= MAX;
    v.phase = 'punch'; v.ps = mf; f.special.dkCharge = 0;
    const d = full ? 36 : 14 + 2 * v.lvl, end = mf + (full ? 16 : 11);
    const base = { damage: d, angle: 361, kbg: 100, bkb: 0, fkb: 0, element: 'normal', shieldDmg: full ? 12 : 2 };
    f.dynamicHitboxes = [{ ...base, frames: [mf + 9, end], r: 70, size: 70, pos: [60, 110] }, { ...base, frames: [mf + 9, end], r: 85, size: 85, pos: [230, 110] }];
    if (f.grounded) f.vx = f.facing * (full ? 30 : 18);
    v.punchEnd = mf + (full ? 50 : 36);
    f.match.emit('sfx', { name: 'whiffL' });
  };
  return {
    total: 99999, groundOK: true, keepOnFall: true, drift: air, anim: o.anim, copyMove: true, giantPunch: true, hitboxes: [],
    onStart(f) { f.vars.phase = 'start'; f.vars.lvl = f.special.dkCharge ?? 0; },
    script(f, mf, c) {
      const v = f.vars;
      if (v.phase === 'start') { if (mf >= START) { if (!air && f.grounded && v.lvl < MAX) { v.phase = 'charge'; v.ps = mf; } else punch(f, mf); } return; }
      if (v.phase === 'charge') {
        if (!f.grounded) { f.special.dkCharge = v.lvl; f.setState('fall'); return; }
        const k = mf - v.ps;
        if (k > 0 && k % PER === 0) { v.lvl++; f.special.dkCharge = v.lvl; if (v.lvl >= MAX) { f.flash = 16; f.setState('idle'); return; } }
        if (c.pressed('B') || c.pressed('A')) { punch(f, mf); return; }
        if (c.held('Z')) { f.special.dkCharge = v.lvl; if (Math.abs(c.x) * S >= 56) { f.rollDir = sign(c.x); f.setState('roll'); } else f.setState('idle'); }
        return;
      }
      if (v.phase === 'punch' && mf >= v.punchEnd) f.endMove();
    },
  };
}
// Link Boomerang: thrown frame 26 (46 frames). Tilt 85 u/f / 160 frames, smash 114 / 190; 9% out, 8% back, angle 70.
export function boomerang(o = {}) {
  return {
    total: 46, groundOK: true, keepOnFall: true, drift: !!o.air, anim: o.anim, copyMove: true, hitboxes: [],
    onStart(f) { f.vars.smash = f.ctrl.xSmash(6) || Math.abs(f.ctrl.x) > 0.9; },
    script(f, mf) {
      if (mf !== 26) return;
      const smash = f.vars.smash, v0 = smash ? 114 : 85, life = smash ? 190 : 160;
      const [x, y] = handPos(f, 0.5, 0.5);
      const p = new Projectile(f.match, f, {
        kind: 'boomerang', x, y, vx: v0 * f.facing, vy: 0, life, r: 100, collide: false, pierce: true, moveId: 'nspecial',
        hb: { damage: 9, angle: 70, kbg: 30, bkb: 55, element: 'normal' },
        makeView: (scene) => {
          const g = new THREE.Group(), m = new THREE.MeshLambertMaterial({ color: 0xc08a40 });
          for (const s of [1, -1]) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.22, 0.1), m); b.rotation.z = s * 0.6; b.position.set(0.3, s * 0.2, 0); g.add(b); }
          scene.add(g); return g;
        },
        updateView: (g) => { g.rotation.z += 0.5; },
      });
      p.out = 30;
      p.onUpdate = (pp, mm) => {
        const own = pp.owner;
        if (pp.t <= pp.out) { pp.vx *= 0.95; }
        else {
          if (!pp.back) { pp.back = true; pp.hit = new Set(); pp.hb = { ...pp.hb, damage: 8 }; }
          if (!own || own.dead) { pp.die(); return false; }
          const dx = own.x - pp.x, dy = own.cy - pp.y, d = Math.hypot(dx, dy) || 1;
          const sp = Math.min(v0 * 0.8, 20 + (pp.t - pp.out) * 3);
          pp.vx += (dx / d * sp - pp.vx) * 0.25; pp.vy += (dy / d * sp - pp.vy) * 0.25;
          if (d < 120) { pp.die(); return false; }
        }
        pp.x += pp.vx; pp.y += pp.vy;
        if (pp.t >= pp.life) pp.die();
        const bz = mm.stage.blast; if (pp.x < bz.left || pp.x > bz.right || pp.y < bz.bottom || pp.y > bz.top) pp.dead = true;
        return false;
      };
      p.onHitHook = (pp) => { if (!pp.back) pp.t = Math.max(pp.t, pp.out); };
      f.match.spawnProjectile(p);
      f.match.emit('sfx', { name: 'whiff' });
    },
  };
}
// C. Falcon Falcon Punch: 89 frames, punch frames 42-46 (24% fist / 26% arm), kbg 120, bkb 30 ground / 40 air, fire.
// Air: at frame 40 propelled at 65 u/f (angle by stick Y, 0..30°), x0.92 per frame until 54.
export function falconPunch(o = {}) {
  const air = !!o.air, bkb = air ? 40 : 30;
  const hb = (d, r, pos) => ({ frames: [42, 46], damage: d, angle: 361, kbg: 120, bkb, fkb: 0, r, size: r, pos, element: 'fire', shieldDmg: air ? 4 : 0 });
  return {
    total: 89, groundOK: true, keepOnFall: true, drift: air, anim: o.anim, copyMove: true, sfx: 'fire', noAirFriction: air,
    hitboxes: [hb(24, 62.5, [200, 110]), hb(26, 50, [90, 110])],
    script(f, mf, c) {
      if (air && mf === 40 && !f.grounded) {
        const sy = clamp(Math.abs(c.y * S), 10, 50); const a = (sy - 10) / 40 * 30 * sign(c.y) * PI / 180;
        f.vx = Math.cos(a) * 65 * f.facing; f.vy = Math.sin(a) * 65; f.vars.prop = true;
      }
      if (f.vars.prop && mf > 40 && mf <= 54) { f.noGravity = true; f.vx *= 0.92; f.vy *= 0.92; }
      if (mf === 55) f.noGravity = false;
      if (mf === 42) f.match.emit('sfx', { name: 'hitL' });
    },
  };
}
// Pikachu Thunder Jolt: spawn frame 21; ball at -45° 40 u/f (10%, kbg 30, bkb 50); on touching the floor it
// becomes a crawling wave at 55 u/f (7%, kbg 20, bkb 10). Lifetime 100.
export function thunderJolt(o = {}) {
  return {
    total: 63, groundOK: true, keepOnFall: true, drift: !!o.air, anim: o.anim, copyMove: true, hitboxes: [],
    script(f, mf) {
      if (mf !== 21) return;
      const dir = f.facing, [x, y] = handPos(f, 0.4, 0.75);
      const a = -45 * PI / 180;
      const p = new Projectile(f.match, f, {
        kind: 'thunderjolt', x, y, vx: Math.cos(a) * 40 * dir, vy: Math.sin(a) * 40, gravity: 0, life: 100, r: 100, bounce: 0.0001, bounceKeepX: 1, moveId: 'nspecial',
        hb: { damage: 10, angle: 361, kbg: 30, bkb: 50, element: 'electric' },
        onWall: (pp) => pp.die(),
        makeView: (scene) => { const g = new THREE.Group(); g.add(new THREE.Mesh(new THREE.IcosahedronGeometry(0.75, 0), basic(0xfff060, 0.9, true))); g.add(new THREE.Mesh(new THREE.IcosahedronGeometry(0.4, 0), basic(0xffffff))); scene.add(g); return g; },
        updateView: (g) => { g.rotation.z += 0.7; g.rotation.x += 0.4; g.children[0].scale.setScalar(0.8 + Math.random() * 0.4); },
      });
      p.onUpdate = (pp) => {
        if (!pp.crawl && pp.t > 1 && Math.abs(pp.vy) < 0.01) { pp.crawl = true; pp.vx = 55 * dir; pp.gravity = 6; pp.hb = { ...pp.hb, damage: 7, kbg: 20, bkb: 10 }; }
      };
      f.match.spawnProjectile(p);
      f.match.emit('sfx', { name: 'elec' });
    },
  };
}
// Jigglypuff Pound: slap frames 12-27 (13%, angle 120, kbg 75, bkb 20, +20 shield damage); in the air lunges at
// 65 u/f (stick-Y angle 0..20°) x0.92 per frame until 30. 54 frames.
export function pound(o = {}) {
  const air = !!o.air;
  const hb = (pos) => ({ frames: [12, 27], damage: 13, angle: 120, kbg: 75, bkb: 20, fkb: 0, r: 77.5, size: 77.5, pos, element: 'normal', shieldDmg: 20 });
  return {
    total: 54, groundOK: true, keepOnFall: true, drift: air, anim: o.anim, copyMove: true, noAirFriction: air,
    hitboxes: [hb([90, 110]), hb([200, 110])],
    script(f, mf, c) {
      if (air && mf === 12 && !f.grounded) {
        const sy = clamp(Math.abs(c.y * S), 10, 50); const a = (sy - 10) / 40 * 20 * sign(c.y) * PI / 180;
        f.vx = Math.cos(a) * 65 * f.facing; f.vy = Math.sin(a) * 65; f.vars.prop = true;
      }
      if (f.vars.prop && mf > 12 && mf <= 30) { f.noGravity = true; f.vx *= 0.92; f.vy *= 0.92; }
      if (mf === 31) f.noGravity = false;
    },
  };
}
// Ness PK Fire: spark on frame 20 (ground 73 u/f at -3.6°, air 95 at -38°, lifetime 20, 4% fire angle 80);
// only when it hits does it become a pillar (falls, lasts 100 frames, repeatedly hits).
export function pkFire(o = {}) {
  const air = !!o.air;
  return {
    total: air ? 60 : 71, groundOK: true, keepOnFall: true, drift: air, anim: o.anim, copyMove: true, hitboxes: [],
    script(f, mf) {
      if (mf !== 20) return;
      const dir = f.facing, sp = air ? 95 : 73, a = (air ? -38 : -3.6) * PI / 180;
      const p = new Projectile(f.match, f, {
        kind: 'pkfire', x: f.x + dir * 100, y: f.y + f.H * 0.45, vx: Math.cos(a) * sp * dir, vy: Math.sin(a) * sp, life: 20, r: 100, collide: false, moveId: 'nspecial',
        hb: { damage: 4, angle: 80, kbg: 50, bkb: 40, element: 'fire' },
        makeView: (scene) => { const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.5, 0), basic(0xffa020, 0.95, true)); m.scale.set(1.6, 0.6, 0.6); scene.add(m); return m; },
        updateView: (m) => { m.rotation.x += 0.5; },
      });
      p.onHitHook = (pp, v, shield) => {
        const d = Math.hypot(pp.vx, pp.vy) || 1;
        pkPillar(f, pp.x + pp.vx / d * 160, pp.y + pp.vy / d * 160, v);
        pp.die();
      };
      f.match.spawnProjectile(p);
      f.match.emit('sfx', { name: 'fire' });
    },
  };
}
function pkPillar(f, x, y, firstVictim) {
  const m = f.match;
  const p = new Projectile(m, f, {
    kind: 'pkpillar', x, y: Math.max(y, -9e9), vx: 0, vy: 0, gravity: 0.45, tvel: 55, life: 100, r: 120, pierce: true, reflectable: false, absorbable: false,
    floorDie: false, moveId: 'nspecial', bounce: 0.0001, bounceKeepX: 0,
    hb: { damage: 1, angle: 80, kbg: 30, bkb: 10, fkb: 0, element: 'fire' },
    makeView: (scene) => {
      const g = new THREE.Group();
      for (let i = 0; i < 4; i++) { const c = new THREE.Mesh(new THREE.ConeGeometry(0.55 - i * 0.08, 2.6 - i * 0.3, 6), basic([0xff4010, 0xff8020, 0xffb030, 0xfff080][i], 0.7, true)); c.position.y = 1.3 - i * 0.1; g.add(c); }
      scene.add(g); return g;
    },
    updateView: (g) => { g.rotation.y += 0.3; g.scale.multiplyScalar(0.996); g.children.forEach(c => c.scale.set(1, 0.9 + Math.random() * 0.2, 1)); },
  });
  p.onUpdate = (pp) => { if (pp.t % 7 === 0) pp.hit = new Set(); };
  p.onHitHook = () => {};
  m.spawnProjectile(p);
}

// table of copied moves (built for Kirby): id -> [groundMove, airMove]
export function copyMoves(anims) {
  const A = anims;
  return {
    copy_mario: { ...fireball({ color: 0xff6010 }), anim: A.shoot, copyMove: true }, copy_marioAir: { ...fireball({ color: 0xff6010, air: true }), anim: A.shoot, copyMove: true },
    copy_luigi: { ...fireball({ color: 0x30e040, speed: 36, gravity: 0, angle: 0, life: 80, damage: 6, luigi: true }), anim: A.shoot, copyMove: true },
    copy_luigiAir: { ...fireball({ color: 0x30e040, speed: 36, gravity: 0, angle: 0, life: 80, damage: 6, luigi: true, air: true }), anim: A.shoot, copyMove: true },
    copy_fox: blaster({ anim: A.blaster }), copy_foxAir: blaster({ air: true, anim: A.blaster }),
    copy_samus: { ...chargeShot({ muzzle: f => [f.H * 0.6, f.H * 0.42] }), anim: A.charge },
    copy_samusAir: { ...chargeShot({ air: true, muzzle: f => [f.H * 0.6, f.H * 0.42] }), anim: A.charge },
    copy_dk: giantPunch({ anim: A.punch }), copy_dkAir: giantPunch({ air: true, anim: A.punch }),
    copy_link: boomerang({ anim: A.toss }), copy_linkAir: boomerang({ air: true, anim: A.toss }),
    copy_yoshi: eggLay({ tip: [330, 120], mid: [190, 120], catchId: 'copy_yoshiCatch', anim: A.lunge }),
    copy_yoshiAir: eggLay({ tip: [330, 120], mid: [190, 120], catchId: 'copy_yoshiCatch', air: true, anim: A.lunge }),
    copy_yoshiCatch: eggCatch({ mouth: [90, 120], anim: A.gulp }),
    copy_falcon: falconPunch({ anim: A.falcon }), copy_falconAir: falconPunch({ air: true, anim: A.falcon }),
    copy_pikachu: thunderJolt({ anim: A.jolt }), copy_pikachuAir: thunderJolt({ air: true, anim: A.jolt }),
    copy_jigglypuff: pound({ anim: A.pound }), copy_jigglypuffAir: pound({ air: true, anim: A.pound }),
    copy_ness: pkFire({ anim: A.shoot }), copy_nessAir: pkFire({ air: true, anim: A.shoot }),
  };
}
