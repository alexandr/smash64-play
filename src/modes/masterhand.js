// Master Hand — the 1P final boss (decomp src/ft/ftchar/ftboss/*, motion scripts relocData/249_BossMainMotion.c).
// A Fighter subclass so the Match resolves its hitboxes and the player's hits on it normally; its update()
// replaces the fighter state machine with the boss AI. 300 HP: defeated when its damage reaches 300
// (ftBossCommonUpdateDamageStats); at 200+ it attacks 1.5x as often (wait_div). Attack choice follows
// dFTBossWaitRandom*: slap / shoo / finger walk, grab-squeeze / poke / drill / jet, rocket / punch / slam,
// finger gun. Hitbox numbers (damage, angle, kbg, fixed kb, bkb, radius = size/2) come from the motion
// scripts; positions and timings are approximations of the animations.
import * as THREE from 'three';
import { Fighter } from '../game/fighter.js';
import { Projectile } from '../game/projectile.js';
import { floorLeft, floorRight } from '../game/collision.js';

const RS = 0.01;
const sign = v => (v > 0 ? 1 : v < 0 ? -1 : 0);
const lerp = (a, b, t) => a + (b - a) * t;
const ease = t => t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;

export const MASTER_HAND_HP = 300;

export const MASTER_HAND_DEF = {
  id: 'masterhand', name: 'Master Hand', short: 'MH', series: 'smash', isBoss: true,
  attr: { height: 400, width: 350, hurtR: 300, weight: 1, gravity: 0, tvel: 0, ffall: 0, jumps: 0, shieldSize: 0, traction: 1, airMax: 0, airAccel: 0, airFric: 0 },
  moves: {}, common: {}, palettes: [{ icon: 0xffffff, icon2: 0xe0e0e0 }],
  model: () => ({ bones: { root: new THREE.Group() } }),
};

// hitbox helper: decomp args (dmg, size, angle, kbg, fkb, bkb, element)
function H(damage, size, angle, kbg, fkb, bkb, element = 'normal') {
  return { damage, r: size / 2, angle: angle < 0 ? 360 + angle : angle, kbg, fkb, bkb, element, shieldDmg: 0, clank: false };
}
const HB = {
  slap: H(16, 750, 361, 90, 0, 70),
  shoo: H(12, 500, 361, 100, 0, 16),
  walk: H(8, 350, -60, 100, 80, 0),
  walk2: H(6, 500, -40, 100, 80, 0),
  flick: H(18, 500, 361, 80, 0, 60, 'fire'),
  poke1: H(8, 600, 100, 100, 60, 0),
  poke2: H(18, 600, 361, 90, 0, 60),
  drill1: H(4, 500, -95, 100, 200, 0),
  drillN: H(1, 320, 180, 100, 5, 0, 'slash'),
  drillEnd: H(5, 300, 361, 100, 0, 80),
  rocketUp: H(16, 600, -80, 100, 0, 30),
  rocketLand: H(12, 750, 361, 100, 0, 16),
  jet: H(16, 800, 90, 100, 0, 30),
  punch1: H(8, 400, -90, 100, 200, 0),
  punch2: H(20, 600, 361, 100, 0, 0),
  punch3: H(16, 800, 100, 100, 0, 40),
  slam: H(16, 700, 10, 100, 100, 0, 'electric'),
  squeeze: H(1, 800, -90, 100, 220, 0),
  squeezeEnd: H(16, 800, 90, 70, 0, 120),
  bullet: { damage: 5, angle: 361, kbg: 100, fkb: 10, bkb: 0, element: 'normal', shieldDmg: 1 },
};

// attack groups (dFTBossWaitRandomGround): 0 = slap/shoo/walk, 1 = grab/poke/drill/jet, 2 = rocket/punch/slam, 3 = gun
const GROUPS = [['slap', 'shoo', 'walk'], ['grab', 'poke', 'drill', 'jet'], ['rocket', 'punch', 'slam'], ['gun']];
const GROUP_NEXT = [[1, 2, 3], [2, 3, 0], [3, 0, 1], [0, 1, 2]];   // dFTBossWaitRandomArrayLookup

export class MasterHand extends Fighter {
  constructor(match, o) {
    super(match, MASTER_HAND_DEF, { port: o.port, team: o.team ?? 1, cpu: { level: o.level ?? 3 }, handicap: o.handicap ?? 9, controller: o.controller, stocks: Infinity, x: o.x ?? 1600, y: o.y ?? 1300, facing: -1 });
    this.isBoss = true;
    this.level = Math.max(1, o.level ?? 3);
    this.z = -9000; this.homeSide = 1;
    this.act = { name: 'appear', t: 0 };
    this.pose = { kind: 'open', curl: 0.2, tilt: 0, roll: 0, spin: 0, yaw: 0, walk: 0 };
    this.waitDiv = 1; this.waitTimer = 60; this.group = 0;
    this.grounded = false; this.ground = null;
    this.hbList = []; this.hitGroup = 0;
    this.rng = o.rng ?? Math.random;
    this.untouchable = true;
    this.state = 'boss';
    this.defeated = false; this.deadT = 0;
    this.squeezed = null;
  }
  get hp() { return Math.max(0, MASTER_HAND_HP - Math.floor(this.percent)); }
  get H() { return 400; }
  target() { return this.match.fighters.find(f => f !== this && !f.isBoss && f.team !== this.team && !f.eliminated) ?? null; }
  floor() {
    const fl = this.match.stage.mainFloor ?? this.match.col.floors[0];
    return { l: floorLeft(fl), r: floorRight(fl), y: Math.min(fl.pts[0][1], fl.pts[fl.pts.length - 1][1]) };
  }
  setState() { }   // the Fighter state machine is not used (match code may call setState on hits/clank)
  hurtCapsule() {
    const w = this.pose.kind === 'point' || this.pose.kind === 'fist' ? 220 : 340;
    return { x1: this.x - w, y1: this.y, x2: this.x + w, y2: this.y, r: 260 };
  }
  takeHit(hit) {
    if (this.defeated) return { kb: 0 };
    const dmg = hit.damage;
    this.percent = Math.min(999, this.percent + dmg);
    this.stats.dmgTaken += dmg;
    const atk = hit.attacker;
    if (atk && atk !== this && atk.stats) atk.stats.dmgGiven += dmg;
    if (atk && atk !== this) { this.lastAttacker = atk; this.lastHitFrame = this.match.frame; }
    this.hurtFlash = 10;
    this.hitlag = Math.floor(dmg / 3 + 5);
    if (this.percent >= 200) this.waitDiv = 1.5;
    if (this.percent >= MASTER_HAND_HP) this.defeat();
    return { kb: 0 };
  }
  defeat() {
    if (this.defeated) return;
    this.defeated = true; this.untouchable = true; this.hbList = []; this.activeHitboxes = [];
    this.releaseSqueeze(false);
    this.act = { name: 'dying', t: 0, x0: this.x, y0: this.y };
    this.match.emit('bossDefeat', { f: this, x: this.x, y: this.y });
    this.match.emit('sfx', { name: 'explode' });
  }

  update() {
    if (this.hitlag > 0) { this.hitlag--; this.buildHitboxes(); return; }
    if (this.hurtFlash > 0) this.hurtFlash--;
    if (this.flash > 0) this.flash--;
    this.sf++;
    const a = this.act; a.t++;
    const fn = this['a_' + a.name];
    if (fn) fn.call(this, a); else this.toWait();
    this.untouchable = this.defeated || this.z < -1200;
    this.buildHitboxes();
  }
  // ---- hitbox bookkeeping
  newHitGroup() { this.hitGroup++; this.hitVictims.clear(); }
  hit(name, dx = 0, dy = 0, mul = 1) { this.hbList.push({ hb: HB[name], dx, dy, r: HB[name].r * mul, id: name }); }
  buildHitboxes() {
    this.activeHitboxes = [];
    if (this.z < -1200 || this.defeated) { this.hbList = []; return; }
    let i = 0;
    for (const h of this.hbList) {
      const x = this.x + h.dx * this.facing, y = this.y + h.dy;
      const prev = this.prevHitPos.get(i);
      this.prevHitPos.set(i, [x, y, this.match.frame]);
      const cont = prev && prev[2] === this.match.frame - 1;
      this.activeHitboxes.push({ hb: h.hb, idx: i, x, y, px: cont ? prev[0] : x, py: cont ? prev[1] : y, r: h.r, owner: this, group: this.hitGroup, move: { id: 'mh_' + h.id, noStale: true } });
      i++;
    }
    this.hbList = [];
  }
  // ---- movement helpers
  moveTo(a, tx, ty, tz, dur) {
    if (a.mt === undefined) { a.mt = 0; a.sx = this.x; a.sy = this.y; a.sz = this.z; }
    a.mt++;
    const k = ease(Math.min(1, a.mt / dur));
    this.x = lerp(a.sx, tx, k); this.y = lerp(a.sy, ty, k); this.z = lerp(a.sz, tz, k);
    if (a.mt >= dur) { a.mt = undefined; return true; }
    return false;
  }
  start(name, extra = {}) { this.act = { name, t: 0, ...extra }; this.newHitGroup(); }
  toWait() {
    const lv = Math.max(1, this.level);
    this.waitTimer = Math.max(8, Math.floor((Math.floor(this.rng() * 120) + 100 / lv) / this.waitDiv));
    this.start('wait');
  }
  pickAttack() {
    const nexts = GROUP_NEXT[this.group];
    this.group = nexts[Math.floor(this.rng() * 3)];
    const g = GROUPS[this.group];
    return g[Math.floor(this.rng() * g.length)];
  }

  // ---- states
  a_appear(a) {
    const fl = this.floor();
    const hx = fl.r * 0.62, hy = fl.y + 1250;
    if (a.t === 1) { this.x = hx + 1500; this.y = hy + 2500; this.z = -9000; this.facing = -1; }
    const k = ease(Math.min(1, a.t / 150));
    this.x = lerp(hx + 1500, hx, k); this.y = lerp(hy + 2500, hy, k); this.z = lerp(-9000, 0, k);
    this.pose = { ...this.pose, kind: 'open', curl: 0.3, tilt: 0.3 * (1 - k) - 0.25, roll: 0.85, spin: 0, yaw: 0 };
    if (a.t >= 170) this.toWait();
  }
  a_wait(a) {
    const T = this.target(); const fl = this.floor();
    if (T) {
      // hover on the side away from the player, facing them (ftBossWait: drifts with the stick)
      const side = T.x > (fl.l + fl.r) / 2 ? -1 : 1;
      const hx = (fl.l + fl.r) / 2 + side * (fl.r - fl.l) * 0.3, hy = fl.y + 1150 + Math.sin(this.sf / 30) * 60;
      this.x += (hx - this.x) * 0.03; this.y += (hy - this.y) * 0.08; this.z += (0 - this.z) * 0.1;
      this.facing = T.x < this.x ? -1 : 1;
    }
    this.pose = { ...this.pose, kind: 'open', curl: 0.3 + Math.sin(this.sf / 20) * 0.06, tilt: -0.25, roll: 0.85, spin: 0, yaw: 0 };
    if (--this.waitTimer <= 0 && T && !T.dead && this.match.phase === 'play') this.start(this.pickAttack());
  }
  // Slap (Hippataku): from a floor edge, raise and slap down across the stage
  a_slap(a) {
    const fl = this.floor();
    if (a.t === 1) { a.side = this.rng() < 0.5 ? -1 : 1; this.facing = -a.side; }
    const ex = a.side > 0 ? fl.r : fl.l;
    if (a.phase === undefined) {
      this.pose = { ...this.pose, kind: 'open', curl: 0.1, tilt: -0.4, roll: 0 };
      if (this.moveTo(a, ex + a.side * 300, fl.y + 900, 0, 35)) { a.phase = 1; a.t0 = a.t; }
      return;
    }
    const t = a.t - a.t0;
    if (t < 30) { this.y = fl.y + 900 + t * 8; this.pose.tilt = -0.4 - t * 0.02; }
    else if (t < 41) {
      const k = (t - 30) / 10;
      this.y = lerp(fl.y + 1140, fl.y + 120, Math.min(1, k * 2));
      this.x += this.facing * 160;
      this.pose.tilt = 0.1;
      this.hit('slap', 0, -60);
      if (t === 30) this.match.emit('sfx', { name: 'whiffL' });
    } else if (t < 80) { this.x += this.facing * Math.max(0, 40 - (t - 41) * 1.5); this.pose.tilt = 0; }
    else this.toWait();
  }
  // Shoo (Harau): hand on its side sweeps along the floor across the stage at 50 u/f
  a_shoo(a) {
    const fl = this.floor();
    if (a.t === 1) { a.side = this.rng() < 0.5 ? -1 : 1; this.facing = -a.side; }
    const ex = a.side > 0 ? fl.r : fl.l;
    if (a.phase === undefined) {
      this.pose = { ...this.pose, kind: 'side', curl: 0.15, tilt: 0, roll: 1.4 };
      if (this.moveTo(a, ex + a.side * 200, fl.y + 260, 0, 35)) { a.phase = 1; a.t0 = a.t; }
      return;
    }
    const t = a.t - a.t0;
    if (t < 30) { this.x -= this.facing * 4; return; }
    this.x += this.facing * 50;
    if ((t - 30) % 41 === 0) { this.newHitGroup(); this.match.emit('sfx', { name: 'whiff' }); }
    this.hit('shoo', 100, 0); this.hit('shoo', -150, 0);
    const past = this.facing > 0 ? this.x > fl.r + 600 : this.x < fl.l - 600;
    if (past || t > 200) this.toWait();
  }
  // Finger walk: walks toward the player at 35 u/f, flicks when close (WalkShoot), stops at the far edge
  a_walk(a) {
    const fl = this.floor(), T = this.target();
    if (a.t === 1) { a.side = T && T.x < (fl.l + fl.r) / 2 ? 1 : -1; this.facing = -a.side; }
    const ex = a.side > 0 ? fl.r : fl.l;
    if (a.phase === undefined) {
      this.pose = { ...this.pose, kind: 'walk', curl: 0, tilt: 0, roll: 0, walk: 0 };
      if (this.moveTo(a, ex - a.side * 150, fl.y + 330, 0, 40)) { a.phase = 1; a.t0 = a.t; }
      return;
    }
    const t = a.t - a.t0;
    if (a.phase === 1) {
      this.x += this.facing * 35;
      this.pose.walk = t / 20;
      if (t % 20 === 0) { this.newHitGroup(); this.match.emit('sfx', { name: 'step' }); }
      if (t % 20 < 19) { this.hit('walk', 150, -230); this.hit('walk2', -100, -260); }
      if (T && !T.dead && T.y - this.y > -600 && T.y - this.y < 500 && (T.x - this.x) * this.facing < 900 && (T.x - this.x) * this.facing > 0) { a.phase = 2; a.t0 = a.t; this.newHitGroup(); }
      const far = this.facing > 0 ? this.x > fl.r - 150 : this.x < fl.l + 150;
      if (far || t > 160) { a.phase = 3; a.t0 = a.t; }
      return;
    }
    if (a.phase === 2) {   // flick
      this.pose = { ...this.pose, kind: 'flick', curl: t < 27 ? 1 : 0, walk: 0 };
      if (t === 27) { this.newHitGroup(); this.match.emit('sfx', { name: 'whiffL' }); }
      if (t >= 27 && t < 39) this.hit('flick', 200, -150);
      if (t > 60) this.toWait();
      return;
    }
    if (t > 30) this.toWait();
  }
  // Grab & squeeze (Gootsubusu): rise above the player, drop at -400 u/f, squeeze, throw upward
  a_grab(a) {
    const fl = this.floor(), T = this.target();
    if (a.phase === undefined) {
      this.pose = { ...this.pose, kind: 'open', curl: 0.0, tilt: 0.2, roll: 0 };
      const tx = T ? T.x : this.x;
      if (this.moveTo(a, tx, (T ? T.y : fl.y) + 1100, 0, 40)) { a.phase = 1; a.t0 = a.t; }
      return;
    }
    const t = a.t - a.t0;
    if (a.phase === 1) {             // hover tracking, then drop
      if (T && t < 25) this.x += Math.max(-40, Math.min(40, T.x - this.x));
      this.pose.curl = 0;
      if (t >= 30) { this.y -= 400 * 0.25; if (this.y <= fl.y + 250) { this.y = fl.y + 250; a.phase = 2; a.t0 = a.t; this.tryCatch(T); } }
      return;
    }
    if (a.phase === 2) {
      if (this.squeezed) {
        this.pose.curl = 0.85 + Math.sin(t / 3) * 0.1;
        this.holdVictim();
        if (t % 12 === 6 && t < 58) { this.newHitGroup(); this.squeezed.takeHit({ ...HB.squeeze, attacker: this, lr: this.facing }); this.match.emit('hit', { f: this.squeezed, a: this, x: this.squeezed.x, y: this.squeezed.y + 150, dmg: 1, kb: 0, element: 'normal' }); }
        if (t >= 60) { a.phase = 3; a.t0 = a.t; }
      } else {
        this.pose.curl = Math.min(1, t / 10);
        if (t > 40) this.toWait();
      }
      return;
    }
    if (a.phase === 3) {             // throw: rise and release upward
      this.y += 30; this.pose.curl = t < 8 ? 1 : 0;
      if (this.squeezed) this.holdVictim();
      if (t === 8) this.releaseSqueeze(true);
      if (t > 40) this.toWait();
    }
  }
  tryCatch(T) {
    if (!T || T.dead || T.intangible > 0 || T.invincible > 0 || T.state === 'respawn') return;
    if (Math.abs(T.x - this.x) < 420 && T.y - this.y < 200 && T.y > this.y - 500) {
      this.squeezed = T;
      if (T.ledge) T.leaveLedge?.();
      if (T.grabbing) T.releaseGrab?.();
      T.setState('grabbed'); T.grabbedBy = this; T.grounded = false; T.ground = null;
      T.vx = T.vy = T.kbx = T.kby = 0; T.kbGround = 0;
      this.grabbing = T;
      this.match.emit('grab', { f: this, v: T });
    }
  }
  holdVictim() { const v = this.squeezed; if (!v) return; v.x = this.x; v.y = this.y - 250; v.facing = -this.facing; }
  releaseSqueeze(throwIt) {
    const v = this.squeezed; if (!v) return;
    this.squeezed = null; this.grabbing = null;
    if (v.grabbedBy === this) v.grabbedBy = null;
    if (v.state === 'grabbed') { v.state = 'fall'; v.sf = 0; }
    if (throwIt && !v.dead) {
      this.newHitGroup();
      const res = v.takeHit({ ...HB.squeezeEnd, attacker: this, lr: this.facing });
      this.match.emit('hit', { f: v, a: this, x: v.x, y: v.y + 150, dmg: HB.squeezeEnd.damage, kb: res.kb, element: 'normal' });
    }
  }
  // Poke (Tsutsuku 1-3): point down above the player, poke twice (8%, then 18%)
  a_poke(a) {
    const fl = this.floor(), T = this.target();
    if (a.phase === undefined) {
      this.pose = { ...this.pose, kind: 'point', curl: 1, tilt: -1.45, roll: 0 };
      if (this.moveTo(a, T ? T.x : this.x, (T ? T.y : fl.y) + 900, 0, 35)) { a.phase = 1; a.t0 = a.t; a.baseY = this.y; }
      return;
    }
    const t = a.t - a.t0;
    if (T && t < 20) this.x += Math.max(-30, Math.min(30, T.x - this.x));
    const stab = (t0, name) => {
      const k = t - t0;
      if (k >= 0 && k < 6) { this.y = a.baseY - 520 * Math.min(1, (k + 1) / 3); this.hit(name, 0, -330); if (k === 0) { this.newHitGroup(); this.match.emit('sfx', { name: 'whiff' }); } }
      else if (k >= 6 && k < 14) this.y = lerp(this.y, a.baseY, 0.3);
    };
    stab(26, 'poke1'); stab(46, 'poke2');
    if (t > 46 && T && t < 46) this.x += 0;
    if (t > 75) this.toWait();
  }
  // Drill: point forward and drill toward the player (follows at up to 30 u/f for 61 frames), multi-hit
  a_drill(a) {
    const fl = this.floor(), T = this.target();
    if (a.phase === undefined) {
      const side = T && T.x > (fl.l + fl.r) / 2 ? -1 : 1;
      this.facing = -side;
      this.pose = { ...this.pose, kind: 'point', curl: 1, tilt: 0, roll: 0, spin: 0 };
      if (this.moveTo(a, (T ? T.x : 0) + side * 900, (T ? T.y : fl.y) + 180, 0, 35)) { a.phase = 1; a.t0 = a.t; }
      return;
    }
    const t = a.t - a.t0;
    this.pose.spin += t < 30 ? 0.15 : 0.6;
    if (t === 30) { this.newHitGroup(); this.match.emit('sfx', { name: 'charge' }); }
    if (t >= 30 && t < 34) this.hit('drill1', 300, 0);
    if (t >= 34 && t < 94) {
      if (T) { const d = T.x - this.x; this.x += Math.abs(d) > 30 ? sign(d) * 30 : d; this.facing = sign(T.x - this.x) || this.facing; }
      this.x = Math.max(fl.l - 200, Math.min(fl.r + 200, this.x));
      if ((t - 34) % 3 === 0) { this.newHitGroup(); this.hit('drillN', 330, 0); }
    }
    if (t === 94) this.newHitGroup();
    if (t >= 94 && t < 104) this.hit('drillEnd', 330, 0);
    if (t > 130) this.toWait();
  }
  // Jet (Okuhikouki): flies off into the background, then swoops back in from the top corner across the floor
  a_jet(a) {
    const fl = this.floor(), T = this.target();
    if (a.phase === undefined) { this.pose = { ...this.pose, kind: 'plane', curl: 0, tilt: 0.3, roll: 0 }; a.phase = 0; }
    const t = a.t;
    if (a.phase === 0) {
      this.x += this.facing * -20; this.y += 50; this.z -= 140; this.pose.tilt = 0.6;
      if (t > 60) { a.phase = 1; a.t0 = t; this.facing = -1; a.cx = T ? T.x : (fl.l + fl.r) / 2; this.x = a.cx + 9000; this.y = fl.y + 3000; this.z = 0; }
      return;
    }
    const k = t - a.t0;
    if (a.phase === 1) {
      // dive diagonally to the floor centre near the player, then skid
      this.pose.tilt = -0.35;
      const tx = a.cx, ty = fl.y + 250;
      const d = Math.hypot(tx - this.x, ty - this.y), sp = 170;
      if (d > sp) { this.x += (tx - this.x) / d * sp; this.y += (ty - this.y) / d * sp; }
      else { this.x = tx; this.y = ty; a.phase = 2; a.t0 = t; this.newHitGroup(); this.match.emit('sfx', { name: 'explode' }); }
      if (k === 1) this.match.emit('sfx', { name: 'laser' });
      this.hit('jet', 0, 0, 0.6);
      return;
    }
    if (a.phase === 2) {
      this.x -= Math.max(0, 40 - (t - a.t0) * 1.2); this.pose.tilt = 0;
      if (t - a.t0 < 20) { this.hit('rocketLand', 300, -100, 0.7); this.hit('rocketLand', -100, -100, 0.7); }
      if (t - a.t0 > 60) this.toWait();
    }
  }
  // Rocket (Okukouki / Launch): charge with sparkles, blast upward (meteor hitbox), crash back down
  a_rocket(a) {
    const fl = this.floor(), T = this.target();
    if (a.phase === undefined) {
      this.pose = { ...this.pose, kind: 'plane', curl: 0, tilt: 1.3, roll: 0 };
      if (this.moveTo(a, T ? T.x : this.x, (T ? T.y : fl.y) + 500, 0, 35)) { a.phase = 1; a.t0 = a.t; this.facing = T && T.x < this.x ? -1 : 1; }
      return;
    }
    const t = a.t - a.t0;
    if (t < 26) { this.y -= 4; this.flash = t % 4 < 2 ? 2 : 0; return; }
    if (t < 76) { this.y += 110; this.hit('rocketUp', 0, 250); if (t === 26) { this.newHitGroup(); this.match.emit('sfx', { name: 'laser' }); } return; }
    if (t === 76) { this.x = T ? T.x : this.x; this.y = fl.y + 4500; this.pose.tilt = -1.4; this.newHitGroup(); }
    if (t > 76 && a.phase === 1) {
      this.y -= 160;
      this.hit('rocketLand', 0, -150, 0.6);
      if (this.y <= fl.y + 300) { this.y = fl.y + 300; a.phase = 2; a.t0 = a.t; this.newHitGroup(); this.match.emit('sfx', { name: 'explode' }); }
      return;
    }
    if (a.phase === 2) {
      const k = a.t - a.t0;
      if (k < 12) { this.hit('rocketLand', 300, -105); this.hit('rocketLand', -100, -105); }
      if (k > 50) this.toWait();
    }
  }
  // Punch (Okupunch): retreat into the background, track the player, then punch out toward the screen
  a_punch(a) {
    const fl = this.floor(), T = this.target();
    if (a.phase === undefined) {
      this.pose = { ...this.pose, kind: 'fist', curl: 1, tilt: 0, roll: 0, yaw: 0 };
      if (this.moveTo(a, T ? T.x + 400 : this.x, (T ? T.y : fl.y) + 450, -9000, 45)) { a.phase = 1; a.t0 = a.t; }
      return;
    }
    const t = a.t - a.t0;
    this.pose.yaw = Math.PI / 2 * Math.min(1, t / 20);
    if (a.phase === 1) {
      if (T) { const d = T.x - this.x; this.x += Math.abs(d) > 40 ? sign(d) * 40 : d; }
      if (t > 62) { a.phase = 2; a.t0 = a.t; this.newHitGroup(); this.match.emit('sfx', { name: 'whiffL' }); }
      return;
    }
    if (a.phase === 2) {
      this.z = Math.min(0, this.z + 1500);
      if (this.z > -1200) this.hit('punch2', 0, 0);
      if (t > 17 + 6) { a.phase = 3; a.t0 = a.t; this.newHitGroup(); }
      return;
    }
    if (a.phase === 3) {
      if (t < 10) this.hit('punch3', 0, 0, 0.6);
      this.y += 8; this.pose.yaw = Math.PI / 2 * Math.max(0, 1 - t / 20);
      if (t > 40) this.toWait();
    }
  }
  // Slam (Okutsubushi): from far in the background, follow the player (61 f, 40 u/f) then crash flat onto the stage
  a_slam(a) {
    const fl = this.floor(), T = this.target();
    if (a.phase === undefined) {
      this.pose = { ...this.pose, kind: 'open', curl: 0, tilt: 0, roll: 0 };
      if (this.moveTo(a, T ? T.x : this.x, fl.y + 2600, -12000, 45)) { a.phase = 1; a.t0 = a.t; }
      return;
    }
    const t = a.t - a.t0;
    if (a.phase === 1) {
      if (T && t < 61) { const d = T.x - this.x; this.x += Math.abs(d) > 40 ? sign(d) * 40 : d; }
      this.z = lerp(-12000, -1500, Math.min(1, t / 61));
      if (t >= 61) { a.phase = 2; a.t0 = a.t; this.z = 0; this.newHitGroup(); }
      return;
    }
    if (a.phase === 2) {
      this.y = Math.max(fl.y + 160, this.y - 260);
      if (t < 12) this.hit('slam', 0, -60);
      if (this.y <= fl.y + 160 && !a.boom) { a.boom = true; this.match.emit('sfx', { name: 'explode' }); this.match.emit('shake', { mag: 8 }); }
      if (t > 60) this.toWait();
    }
  }
  // Finger gun (Yubideppou): line up 3000 u from the player at their height, aim 60-180 f, shoot
  a_gun(a) {
    const fl = this.floor(), T = this.target();
    if (a.phase === undefined) {
      const side = T && T.x > (fl.l + fl.r) / 2 ? -1 : 1;
      this.facing = -side;
      this.pose = { ...this.pose, kind: 'gun', curl: 1, tilt: 0, roll: 0 };
      a.aim = 60 + Math.floor(this.rng() * 120);
      if (this.moveTo(a, (T ? T.x : 0) + side * 3000, (T ? T.y : fl.y) + 150, 0, 40)) { a.phase = 1; a.t0 = a.t; }
      return;
    }
    const t = a.t - a.t0;
    if (a.phase === 1) {
      if (T) { this.y += ((T.y + 150) - this.y) * 0.1; this.facing = sign(T.x - this.x) || this.facing; }
      if (t >= a.aim) { a.phase = 2; a.t0 = a.t; }
      return;
    }
    const k = t;
    if (k % 16 === 0 && k < 48) {
      const m = this.match;
      m.spawnProjectile(new Projectile(m, this, {
        x: this.x + this.facing * 420, y: this.y + 60, vx: this.facing * 100, vy: 0, r: 60, life: 90, kind: 'mhBullet', color: 0xfff0a0,
        hb: { ...HB.bullet }, damage: HB.bullet.damage, collide: false, reflectable: true, absorbable: true, moveId: 'mh_gun',
      }));
      this.pose.recoil = 1;
      m.emit('sfx', { name: 'shoot' });
    }
    if (this.pose.recoil) this.pose.recoil *= 0.8;
    if (k > 80) this.toWait();
  }
  // Defeat: flash, tumble and sink, then the match ends (handled by the stage logic)
  a_dying(a) {
    const t = a.t;
    this.flash = t % 6 < 3 ? 3 : 0;
    this.pose = { ...this.pose, kind: 'open', curl: 0.5, tilt: Math.sin(t / 5) * 0.4, roll: 0.25 + t * 0.03 };
    if (t > 40) { this.y -= (t - 40) * 0.8; this.z -= 30; }
    if (t === 150) this.match.emit('sfx', { name: 'explode' });
    this.deadT = t;
  }
}

// ------------------------------------------------------------------------------------------- view
// Low-poly white glove: palm, cuff, four two-segment fingers and a thumb; poses per attack.
export class MasterHandView {
  constructor(scene, mh) {
    this.mh = mh;
    const white = new THREE.MeshPhongMaterial({ color: 0xffffff, emissive: 0x3c3c40, specular: 0x505060, shininess: 22, flatShading: true });
    const shade = new THREE.MeshPhongMaterial({ color: 0xe8e8f0, emissive: 0x303038, specular: 0x202030, shininess: 10, flatShading: true });
    this.mats = [white, shade];
    this.flashMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    this.hurtMat = new THREE.MeshPhongMaterial({ color: 0xffb0a0, emissive: 0x803020, flatShading: true });
    const root = this.root = new THREE.Group();
    const hand = this.hand = new THREE.Group(); root.add(hand);
    const U = RS;           // model built in game units
    const palm = new THREE.Mesh(new THREE.BoxGeometry(520 * U, 150 * U, 470 * U), white);
    palm.position.set(0, 0, 0); hand.add(palm);
    const back = new THREE.Mesh(new THREE.BoxGeometry(440 * U, 60 * U, 400 * U), white); back.position.set(-20 * U, 90 * U, 0); hand.add(back);
    // cuff (wrist) at -x
    const cuff = new THREE.Mesh(new THREE.CylinderGeometry(230 * U, 260 * U, 160 * U, 8), shade);
    cuff.rotation.z = Math.PI / 2; cuff.position.set(-360 * U, 20 * U, 0); hand.add(cuff);
    const cuffRim = new THREE.Mesh(new THREE.TorusGeometry(250 * U, 40 * U, 5, 10), shade);
    cuffRim.rotation.y = Math.PI / 2; cuffRim.position.set(-440 * U, 20 * U, 0); hand.add(cuffRim);
    // fingers along +x; index nearest +z (toward camera when palm down, right hand)
    this.fingers = [];
    const fz = [170, 60, -55, -165], fl = [[200, 170], [230, 190], [215, 175], [170, 140]];
    for (let i = 0; i < 4; i++) {
      const base = new THREE.Group(); base.position.set(255 * U, 0, fz[i] * U); hand.add(base);
      const s1 = new THREE.Mesh(new THREE.BoxGeometry(fl[i][0] * U, 110 * U, 100 * U), white); s1.position.set(fl[i][0] / 2 * U, 0, 0); base.add(s1);
      const j2 = new THREE.Group(); j2.position.set(fl[i][0] * U, 0, 0); base.add(j2);
      const s2 = new THREE.Mesh(new THREE.BoxGeometry(fl[i][1] * U, 100 * U, 92 * U), white); s2.position.set(fl[i][1] / 2 * U, 0, 0); j2.add(s2);
      const tip = new THREE.Mesh(new THREE.SphereGeometry(50 * U, 6, 4), white); tip.position.set(fl[i][1] * U, 0, 0); j2.add(tip);
      this.fingers.push({ base, j2 });
    }
    // thumb on the index side (+z), pointing forward-out
    const tb = new THREE.Group(); tb.position.set(60 * U, -10 * U, 230 * U); hand.add(tb);
    const t1 = new THREE.Mesh(new THREE.BoxGeometry(110 * U, 110 * U, 200 * U), white); t1.position.set(40 * U, 0, 90 * U); tb.add(t1);
    const tj = new THREE.Group(); tj.position.set(60 * U, 0, 180 * U); tb.add(tj);
    const t2 = new THREE.Mesh(new THREE.BoxGeometry(170 * U, 100 * U, 100 * U), white); t2.position.set(85 * U, 0, 0); tj.add(t2);
    this.thumb = { base: tb, j2: tj };
    this.meshes = []; root.traverse(o => { if (o.isMesh) this.meshes.push(o); });
    this.orig = this.meshes.map(m => m.material);
    scene.add(root);
    this.scene = scene;
  }
  dispose() { this.scene.remove(this.root); this.root.traverse(o => o.geometry?.dispose()); }
  update(match) {
    const mh = this.mh, p = mh.pose;
    this.root.visible = !(mh.defeated && mh.deadT > 170);
    this.root.position.set(mh.x * RS, mh.y * RS, mh.z * RS);
    // orientation: fingers point along facing; palm down by default
    const f = mh.facing;
    this.root.scale.set(f * 1.25, 1.25, 1.25);
    const h = this.hand;
    h.rotation.set(0, 0, 0);
    h.rotation.order = 'YXZ';
    let tilt = p.tilt ?? 0, roll = p.roll ?? 0, yaw = p.yaw ?? 0;
    if (p.kind === 'walk') { tilt = -Math.PI / 2 + 0.25; roll = 0; }
    if (p.kind === 'point' && (p.tilt ?? 0) < -1) tilt = -Math.PI / 2;
    h.rotation.y = yaw; h.rotation.x = roll + (p.spin ?? 0); h.rotation.z = tilt;
    // finger curls
    const curls = [p.curl, p.curl, p.curl, p.curl];
    let thumbCurl = p.curl * 0.8;
    if (p.kind === 'point' || p.kind === 'gun') { curls[0] = 0; thumbCurl = p.kind === 'gun' ? -0.6 : 0.9; }
    if (p.kind === 'flick') { curls[0] = 0; curls[1] = p.curl; thumbCurl = 1; }
    if (p.kind === 'fist') thumbCurl = 1;
    if (p.kind === 'gun') { curls[1] = 0; }
    this.fingers.forEach((fg, i) => {
      let c = curls[i] ?? 0;
      if (p.kind === 'walk') { const ph = (p.walk ?? 0) * Math.PI * 2 + (i % 2) * Math.PI; c = i < 2 ? 0.25 + 0.35 * Math.max(0, Math.sin(ph)) : 1; }
      fg.base.rotation.z = -c * 1.3; fg.j2.rotation.z = -c * 1.5;
    });
    this.thumb.base.rotation.y = thumbCurl * 0.6; this.thumb.j2.rotation.y = thumbCurl * 0.9;
    // recoil for the finger gun
    if (p.recoil) h.rotation.z += p.recoil * 0.4;
    // depth fog: fade toward blue-gray in the background
    const flash = mh.flash > 0 || (mh.defeated && mh.deadT > 120 && mh.deadT % 4 < 2);
    const hurt = mh.hurtFlash > 0 && mh.hitlag > 0;
    this.meshes.forEach((m, i) => { m.material = flash ? this.flashMat : hurt ? this.hurtMat : this.orig[i]; });
  }
}
