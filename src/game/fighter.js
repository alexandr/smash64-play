// Fighter: physics, action-state machine, moves and hit reactions, following SSB64 rules
// (reference/spec/mechanics.md). Position = feet point in SSB64 units; y up; facing = +1 right / -1 left.
// Stick values from the Controller are in [-1,1]; S = 80 converts them to SSB64 stick units.
import { C } from './constants.js';
import { floorY, floorLeft, floorRight, findLanding, resolveBody } from './collision.js';

const S = 80;
const sign = v => (v > 0 ? 1 : v < 0 ? -1 : 0);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export class Fighter {
  constructor(match, def, opts) {
    this.match = match; this.def = def; this.a = def.attr;
    this.port = opts.port; this.team = opts.team ?? opts.port;
    this.color = opts.color ?? 0;
    this.cpu = opts.cpu ?? null;
    this.handicap = opts.handicap ?? 9;
    this.ctrl = opts.controller;
    this.stocks = opts.stocks ?? 3;
    this.x = opts.x ?? 0; this.y = opts.y ?? 0; this.facing = opts.facing ?? 1;
    this.vx = 0; this.vy = 0;          // self velocity (vel_air / vel_ground)
    this.kbx = 0; this.kby = 0;        // knockback velocity (vel_damage), decays
    this.kbGround = 0;                 // grounded knockback slide
    this.ground = null; this.grounded = false;
    this.percent = opts.percent ?? 0;
    this.jumpsUsed = 0;
    this.state = 'idle'; this.sf = 0;
    this.move = null; this.mf = 0; this.moveUse = 0; this.staleMul = 1;
    this.hitlag = 0; this.hitstun = 0;
    this.intangible = 0; this.invincible = 0;
    this.shieldHP = C.SHIELD_MAX; this.shieldStun = 0; this.shieldTimer = 0;
    this.fastfall = false;
    this.dropThrough = 0; this.dropFloor = null;
    this.ledge = null; this.ledgeLock = 0;
    this.grabbing = null; this.grabbedBy = null;
    this.stale = [];                   // [{id, use}] newest last, max 5
    this.lastAttacker = null;
    this.hitVictims = new Map();
    this.activeHitboxes = [];
    this.prevHitPos = new Map();
    this.zFrame = -999;                // last Z tap (z-cancel / tech)
    this.stats = { kos: 0, falls: 0, sds: 0, dmgGiven: 0, dmgTaken: 0, koBy: [], hits: 0 };
    this.item = null;
    this.vars = {};
    this.special = {};
    this.dead = false; this.respawnTimer = 0; this.platform = null;
    this.flash = 0; this.metal = !!opts.metal; this.scale = opts.scale ?? 1; this.weightMul = opts.weightMul ?? 1;
    this.hurtFlash = 0;
    this.sdiFrame = -999;
  }

  get H() { return this.a.height * this.scale; }
  get Wd() { return this.a.width * this.scale; }
  get HV() { return (this.a.visualHeight ?? this.a.height) * this.scale; }   // real model height (hurtbox top)
  get cx() { return this.x; }
  get cy() { return this.y + this.H * 0.5; }
  emit(type, data = {}) { this.match.emit(type, { f: this, ...data }); }
  get jumpsLeft() { return this.a.jumps - this.jumpsUsed; }

  setState(s) {
    this.state = s; this.sf = 0;
    this.move = null; this.mf = 0; this.activeHitboxes = []; this.dynamicHitboxes = null;
    this.armor = 0; this.noGravity = false; this.gravMul = 1;
    this.reflecting = false; this.absorbing = false; this.counter = null;
  }

  // ---------- per-frame ----------
  update() {
    if (this.dead) { this.updateDead(); return; }
    const c = this.ctrl;
    if (c.pressed('Z')) this.zFrame = this.match.frame;
    if (this.hitlag > 0) {
      this.hitlag--;
      // SDI: fresh flick during hitlag in a damage state
      if ((this.state === 'hurt' || this.state === 'tumble') && this.hitlag >= 0) {
        const mag = Math.hypot(c.x, c.y) * S;
        const tap = Math.min(c.frame - c.lastNeutralXFrame, c.frame - c.lastNeutralYFrame);
        if (mag >= 53 && tap < 4 && this.sdiFrame < c.lastNeutralXFrame && this.sdiFrame < c.lastNeutralYFrame) {
          this.x += c.x * S * C.SDI_MUL; this.y += c.y * S * C.SDI_MUL; this.sdiFrame = c.frame;
          if (this.grounded && this.y > (floorY(this.ground, this.x) ?? this.y) + 1) { this.grounded = false; this.ground = null; }
          if (this.grounded) this.y = floorY(this.ground, this.x) ?? this.y;
        }
      }
      return;
    }
    if (this.intangible > 0) this.intangible--;
    if (this.invincible > 0) this.invincible--;
    if (this.ledgeLock > 0) this.ledgeLock--;
    if (this.dropThrough > 0) this.dropThrough--; else this.dropFloor = null;
    if (this.flash > 0) this.flash--;
    if (this.hurtFlash > 0) this.hurtFlash--;
    if (this.state !== 'shield' && this.state !== 'shieldstun' && this.shieldHP < C.SHIELD_MAX) {
      if (++this.shieldTimer >= C.SHIELD_REGEN_INT) { this.shieldTimer = 0; this.shieldHP++; }
    }
    this.sf++;
    const fn = STATES[this.state];
    if (fn) fn.call(this, c);
    if (this.move && this.state === 'attack') this.runMove();
    if (!this.dead) this.physics();
    this.updateHitboxes();
  }

  // ---------- physics ----------
  physics() {
    const a = this.a;
    if (this.state === 'ledge' || this.state === 'grabbed' || this.state === 'thrown' || this.state === 'respawn' ||
        this.state === 'ledgeclimb' || this.state === 'ledgeroll' || this.noPhysics) return;
    if (this.grounded) {
      const f = this.ground;
      // grounded knockback slide decays by traction (floor friction 4 × traction × 0.25)
      if (this.kbGround) { const d = C.FLOOR_FRICTION * a.traction * 0.25; this.kbGround = Math.abs(this.kbGround) <= d ? 0 : this.kbGround - sign(this.kbGround) * d; }
      const dx = this.vx + this.kbGround;
      const nx = this.x + dx + (f.dx || 0);
      const lx = floorLeft(f), rx = floorRight(f);
      if (nx < lx || nx > rx) {
        if (this.canWalkOff()) {
          this.x = nx; this.y += (f.dy || 0);
          this.becomeAirborne();
          return;
        }
        this.x = clamp(nx, lx, rx); this.vx = 0; this.kbGround = 0;
        this.y = floorY(f, this.x);
      } else { this.x = nx; this.y = floorY(f, this.x); }
      const res = resolveBody(this.match.col, this.x - dx, this.y, this.x, this.y, this.a.width, this.H);
      if (res.hitWall) { this.x = res.x; this.vx = 0; this.kbGround = 0; }
      return;
    }
    // airborne: knockback vector decays 1.7/frame, zeroed when a component flips sign
    if (this.kbx || this.kby) {
      const m = Math.hypot(this.kbx, this.kby);
      const nkx = this.kbx - C.KB_DECAY_AIR * this.kbx / m, nky = this.kby - C.KB_DECAY_AIR * this.kby / m;
      if (sign(nkx) !== sign(this.kbx) || sign(nky) !== sign(this.kby)) { this.kbx = 0; this.kby = 0; }
      else { this.kbx = nkx; this.kby = nky; }
    }
    if (!this.noGravity) {
      this.vy -= a.gravity * this.gravMul;
      if (this.fastfall) this.vy = -a.ffall;
      else if (this.vy < -a.tvel) this.vy = -a.tvel;
    }
    const x0 = this.x, y0 = this.y;
    let nx = x0 + this.vx + this.kbx, ny = y0 + this.vy + this.kby;
    const res = resolveBody(this.match.col, x0, y0, nx, ny, this.a.width, this.H);
    nx = res.x; ny = res.y;
    const tumbling = this.state === 'tumble' && this.hitstun > 0;
    if (res.hitWall) {
      if (tumbling && Math.hypot(this.kbx + this.vx, this.kby + this.vy) > 30) {
        this.kbx = -(this.kbx + this.vx) * 0.8; this.vx = 0; this.kby *= 0.8;
        this.hitstun = Math.floor(Math.hypot(this.kbx, this.kby) / C.HITSTUN_DIV); this.intangible = Math.max(this.intangible, 15);
        this.emit('bounce');
      } else { this.vx = 0; this.kbx = 0; }
    }
    if (res.hitCeil) {
      if (tumbling && Math.hypot(this.kbx, this.kby + this.vy) > 30) {
        this.kby = -(this.kby + Math.max(0, this.vy)) * 0.8; this.vy = Math.min(0, this.vy);
        this.hitstun = Math.floor(Math.hypot(this.kbx, this.kby) / C.HITSTUN_DIV); this.intangible = Math.max(this.intangible, 15);
      } else { this.vy = Math.min(0, this.vy); this.kby = Math.min(0, this.kby); }
    }
    const vyTot = this.vy + this.kby;
    if (vyTot <= 0) {
      const land = findLanding(this.match.col, x0, y0, nx, ny, this.passThrough(), this.dropFloor);
      if (land) { this.x = land.x; this.y = land.y; this.land(land.floor, vyTot); return; }
    }
    this.prevX = x0; this.prevY = y0;
    this.x = nx; this.y = ny;
    this.tryLedgeGrab(x0, y0);
  }

  passThrough() {
    if (this.dropThrough > 0) return true;
    // helpless fighters drop through with stick <= -44
    if (this.state === 'helpless' && this.ctrl.y * S <= -44) return true;
    return false;
  }

  canWalkOff() {
    const s = this.state;
    if (s === 'dash') return this.sf < (this.a.dashToRun ?? 14);
    if (['walk', 'run', 'runbrake', 'runturn', 'hurt', 'tumble', 'jumpsquat', 'downbounce', 'downwait', 'landing'].includes(s)) return s !== 'landing' || true;
    if (s === 'attack' && this.move?.walkOff) return true;
    if (this.kbGround) return true;
    return false;
  }

  becomeAirborne() {
    this.grounded = false; this.ground = null; this.fastfall = false;
    if (this.kbGround) { this.kbx = this.kbGround; this.kbGround = 0; }
    if (['walk', 'dash', 'run', 'runbrake', 'runturn', 'idle', 'turn', 'squat', 'squatwait', 'squatrv', 'landing', 'jumpsquat'].includes(this.state)) {
      if (this.state === 'jumpsquat') { this.doJump(); return; }
      this.setState('fall');
    } else if (this.state === 'attack' && this.move && !this.move.air && !this.move.keepOnFall) this.setState('fall');
    else if (this.state === 'downbounce' || this.state === 'downwait') this.setState('tumble');
  }

  land(floor, vyTot) {
    const st = this.state;
    const wasFF = this.fastfall;
    this.grounded = true; this.ground = floor; this.fastfall = false;
    this.jumpsUsed = 0;
    this.vy = 0; this.kby = 0;
    if (this.kbx) { this.kbGround = clamp(this.kbx, -250, 250); this.kbx = 0; }
    this.special.upBUsed = false; this.special.tornadoUsed = false;
    if (!['tumble', 'hurt'].includes(st)) this.lastAttacker = null; // KO credit cleared on landing
    this.emit('land');
    if (this.onLand && this.onLand(st) === true) return;
    const normalLand = () => {
      if (vyTot > C.NO_LANDING_VY && !wasFF) { this.setState('idle'); return; }
      this.setState('landing'); this.landLag = wasFF ? C.LAND_HEAVY : C.LAND_LIGHT;
    };
    switch (st) {
      case 'attack': {
        const m = this.move;
        if (m?.landMove) { this.startMove(this.def.moves[m.landMove] ?? m.landMove, { keepVars: true }); return; }
        if (m?.groundOK) return;                       // move continues on the ground
        if (m?.air) {
          const inAuto = m.autocancel?.some(([s, e]) => this.mf >= s && this.mf <= e) || this.mf > (m.total ?? 0);
          const zOK = this.zFrame >= this.moveStartFrame && this.match.frame - this.zFrame <= C.ZCANCEL_WINDOW;
          if (inAuto || m.landingLag == null) { this.landKind = 'auto'; normalLand(); if (this.state === 'landing') this.landKind = 'auto'; return; }
          if (zOK) { this.setState('landing'); this.landLag = wasFF ? C.LAND_HEAVY : C.LAND_LIGHT; this.landKind = 'z'; this.emit('zcancel'); return; }
          this.setState('landing'); this.landLag = m.landingLag; this.landKind = 'lag';
          return;
        }
        if (m?.helpless || m?.special) { this.setState('landing'); this.landLag = m.helplessLand ?? this.a.helplessLand ?? 25; this.landKind = 'special'; return; }
        normalLand(); return;
      }
      case 'helpless': this.setState('landing'); this.landLag = this.helplessLag ?? this.a.helplessLand ?? 25; this.landKind = 'special'; return;
      case 'tumble': {
        const teched = this.match.frame - this.zFrame < C.TECH_WINDOW;
        this.kbGround = 0; this.vx = 0;
        if (teched) {
          if (Math.abs(this.ctrl.x * S) >= 20) { this.setState('techroll'); this.rollDir = sign(this.ctrl.x); this.intangible = 19; }
          else { this.setState('tech'); this.intangible = 23; }
          this.emit('tech');
        } else { this.setState('downbounce'); this.emit('downbounce'); }
        return;
      }
      case 'hurt': return; // flinch animation continues on the ground
      case 'shieldbreakfly': this.setState('downbounce'); this.vx = 0; this.dizzyAfter = true; return;
      case 'sleep': case 'grabbed': case 'thrown': return;
      default: normalLand();
    }
  }

  // ---------- ledge ----------
  canGrabLedge() {
    const s = this.state;
    if (this.ledgeLock > 0) return false;
    if (['fall', 'jump', 'jumpaerial', 'helpless'].includes(s)) return true;
    if (s === 'tumble' && this.hitstun <= 0) return true;
    if (s === 'attack' && this.move?.ledgeGrab && (this.move.ledgeGrabFrom ?? 0) <= this.mf) return true;
    return false;
  }
  tryLedgeGrab(x0, y0) {
    if (!this.canGrabLedge()) return;
    if (this.vy + this.kby > 0 && !(this.state === 'attack' && this.move?.ledgeGrabRising)) return;
    const cc = this.a.ccatch ?? [400, 360];
    for (const L of this.match.ledges) {
      if (!L.floor.active) continue;
      if (this.facing !== -L.dir) continue;                         // must face the edge
      if (this.match.fighters.some(o => o !== this && o.ledge === L)) continue; // edge-hog
      // grab point sweeps across the ledge height
      const gy0 = y0 + cc[1] * this.scale, gy1 = this.y + cc[1] * this.scale;
      const handX = this.x + this.facing * this.a.width;
      const out = (this.x - L.x) * L.dir;                            // >0 when outside the stage
      const near = Math.abs(handX - L.x) <= cc[0] * 0.5 * this.scale + 20 && out > -this.a.width;
      const crossed = (gy0 >= L.y && gy1 <= L.y) || (gy1 >= L.y && this.y <= L.y && this.y >= L.y - cc[1] * this.scale * 0.6);
      if (near && crossed) { this.grabLedge(L); return; }
    }
  }
  grabLedge(L) {
    this.setState('ledge');
    this.ledge = L; this.ledgeNeutral = false;
    this.vx = this.vy = this.kbx = this.kby = 0; this.kbGround = 0;
    this.facing = -L.dir;
    this.x = L.x + L.dir * this.a.width * 0.5; this.y = L.y - this.HV * 0.88;
    this.jumpsUsed = 1; this.fastfall = false;
    this.intangible = (this.a.ledgeCatchFrames ?? 3) + C.LEDGE_INTANGIBLE;
    this.special.upBUsed = false;
    this.lastAttacker = null;
    this.emit('ledge');
  }
  leaveLedge() { this.ledge = null; this.ledgeLock = C.LEDGE_REGRAB; }

  // ---------- jumping ----------
  jumpSquat(byStick) {
    this.setState('jumpsquat');
    this.vars.byStick = !!byStick; this.vars.maxY = this.ctrl.y * S; this.vars.short = false;
  }
  doJump() {
    const a = this.a, c = this.ctrl;
    const X = c.x * S;
    let v;
    if (this.vars.byStick) v = Math.max(this.vars.maxY, C.JUMP_STICK_MIN);
    else {
      const k = Math.sqrt(Math.max(0, 1 - (Math.abs(X) / 80) ** 2));
      v = this.vars.short ? Math.max(36, 9 * k + 36) : Math.max(63, 17 * k + 63);
      v = Math.min(v, Math.sqrt(Math.max(0, 80 * 80 - X * X)), 77);
      if (X === 0) v = this.vars.short ? C.CJUMP_SHORT : C.CJUMP_FULL;
    }
    this.grounded = false; this.ground = null;
    this.vy = v * a.jmul + a.jbase;
    this.vx = X * a.jvx;
    this.jumpsUsed = 1;
    this.setState('jump'); this.fastfall = false;
    this.vars.jumpBack = X * this.facing < -10;
    this.emit('jump');
  }
  doDoubleJump() {
    const a = this.a, c = this.ctrl;
    const idx = this.jumpsUsed;   // 1 for the first midair jump
    this.jumpsUsed++;
    const tbl = a.multiJump;      // Kirby/Puff per-jump height table
    const h = tbl ? tbl[Math.min(tbl.length - 1, idx - 1)] : a.djh;
    this.vy = (80 * a.jmul + a.jbase) * h;
    this.vx = c.x * S * (a.djvx ?? a.jvx);
    this.fastfall = false; this.kbx = 0; this.kby = 0;
    if (Math.abs(c.x) > 0.3 && a.djTurn) this.facing = sign(c.x);
    this.setState('jumpaerial');
    this.armor = a.djArmor ?? 0;
    this.emit('jump2');
  }
  canDoubleJump() { return this.jumpsUsed < this.a.jumps && this.jumpsUsed > 0 || (this.jumpsUsed === 0 && this.a.jumps > 1 && !this.grounded); }

  // stick-up jump input (y >= 53 tapped within 3 frames)
  stickJump(c) { return c.y * S >= 53 && c.frame - c.lastNeutralYFrame <= 3 && c.py * S < 53; }

  // ---------- ground actions ----------
  groundActions(c, opts = {}) {
    if (c.pressed('A') && !this.item && !c.held('Z')) {
      const it = this.match.items.findPickup(this);
      if (it && !(c.xSmash() && Math.abs(c.x) > 0.7)) { this.match.items.pickup(this, it); this.startMove(this.def.common.pickup); return true; }
    }
    if (c.pressed('L')) { this.startMove(this.def.moves.taunt); return true; }
    if (c.pressed('R') || (c.pressed('A') && c.held('Z'))) {
      if (this.item) { this.throwItem(c); return true; }
      this.startMove(this.def.moves.grab); return true;
    }
    if (c.jumpPressed()) { this.jumpSquat(false); return true; }
    if (!opts.noTapJump && this.stickJump(c)) { this.jumpSquat(true); return true; }
    if (c.pressed('B')) { this.groundSpecial(c); return true; }
    if (c.pressed('A')) { this.groundAttack(c, opts); return true; }
    if (c.held('Z') && !opts.noShield) { this.startShield(); return true; }
    return false;
  }
  groundSpecial(c) {
    const m = this.def.moves;
    if (c.y * S >= 53) this.startMove(m.uspecial);
    else if (c.y * S <= -53) this.startMove(m.dspecial);
    else { if (Math.abs(c.x) * S >= 20 && this.def.nspecialTurn !== false) this.facing = sign(c.x); this.startMove(m.nspecial); }
  }
  airSpecial(c) {
    const m = this.def.moves;
    if (c.y * S >= 53) { if (Math.abs(c.x) * S >= 20 && this.def.upBTurn !== false) this.facing = sign(c.x); this.startMove(m.uspecialAir || m.uspecial); }
    else if (c.y * S <= -53) this.startMove(m.dspecialAir || m.dspecial);
    else this.startMove(m.nspecialAir || m.nspecial);
  }
  groundAttack(c, opts = {}) {
    const m = this.def.moves;
    if (this.item) {
      const d = this.item.def;
      const smash = (c.xSmash() && Math.abs(c.x) > 0.7) || c.ySmash();
      if (d.swing) { this.swingItem(c, false, opts.dash); return; }
      if (smash) { this.throwItem(c); return; }
      if (d.shoot) { this.useItem(c); return; }
      this.throwItem(c); return;
    }
    if (opts.dash) { this.startMove(m.dashattack); return; }
    const X = c.x * S, Y = c.y * S;
    if (c.xSmash() && Math.abs(X) >= 56 && Math.abs(X) >= Math.abs(Y)) { this.facing = sign(X); this.startMove(m.fsmash); return; }
    if (Y >= 53 && c.frame - c.lastNeutralYFrame < 4) { this.startMove(m.usmash); return; }
    if (Y <= -53 && c.frame - c.lastNeutralYFrame < 4) { this.startMove(m.dsmash); return; }
    if (Math.abs(Y) >= 20 && Math.abs(Y) > Math.abs(X)) { this.startMove(Y > 0 ? m.utilt : m.dtilt); return; }
    if (Math.abs(X) >= 20) { this.facing = sign(X); this.startMove(m.ftilt); return; }
    this.startMove(m.jab1);
  }
  airAttack(c) {
    const m = this.def.moves;
    if (this.item) {
      if (this.item.def.swing) { this.swingItem(c, true); return; }
      if (this.item.def.shoot && !(c.xSmash() || c.ySmash())) { this.useItem(c); return; }
      this.throwItem(c); return;
    }
    const X = c.x * S, Y = c.y * S;
    if (Math.hypot(X, Y) < 20) { this.startMove(m.nair); return; }
    if (Math.abs(Y) >= Math.abs(X)) this.startMove(Y > 0 ? m.uair : m.dair);
    else this.startMove(sign(X) === this.facing ? m.fair : m.bair);
  }
  airActions(c) {
    if (c.pressed('R') && this.item) { this.throwItem(c); return true; }
    if (c.pressed('A') || c.pressed('R')) { this.airAttack(c); return true; }
    if (c.pressed('B')) { this.airSpecial(c); return true; }
    if ((c.jumpPressed() || this.stickJump(c)) && this.jumpsUsed < this.a.jumps) { if (this.jumpsUsed === 0) this.jumpsUsed = 1; this.doDoubleJump(); return true; }
    return false;
  }
  airDrift(c, maxMul = 1) {
    const a = this.a, X = c.x * S, max = a.airMax * maxMul;
    if (Math.abs(this.vx) > max) { this.vx -= sign(this.vx) * 1.0; }
    else {
      if (Math.abs(X) >= 8) this.vx = clamp(this.vx + X * a.airAccel, -max, max);
      if (Math.abs(this.vx) <= a.airFric) this.vx = 0; else this.vx -= sign(this.vx) * a.airFric;
    }
    this.checkFastFall(c);
  }
  checkFastFall(c) {
    if (!this.fastfall && this.vy < 0 && c.y * S <= -53 && c.frame - c.lastNeutralYFrame < 4) { this.fastfall = true; this.emit('fastfall'); }
  }
  airFriction() {
    const f = this.a.airFric;
    if (Math.abs(this.vx) <= f) this.vx = 0; else this.vx -= sign(this.vx) * f;
  }
  friction(mul = 1) {
    const t = C.FLOOR_FRICTION * this.a.traction * 0.25 * mul * (this.ground?.friction ?? 1);
    if (Math.abs(this.vx) <= t) this.vx = 0; else this.vx -= sign(this.vx) * t;
  }

  startShield() { this.setState('shield'); this.shieldTimer = 0; this.emit('shieldOn'); }

  // ---------- moves ----------
  staleFor(id) {
    const q = this.stale;
    for (let i = 0; i < 4 && i < q.length; i++) {
      const e = q[q.length - 1 - i];
      if (e.id === id) return C.STALE[i];
    }
    return 1;
  }
  startMove(m, opts = {}) {
    if (!m) { this.setState(this.grounded ? 'idle' : 'fall'); return; }
    const vars = opts.keepVars ? this.vars : (opts.vars || {});
    const ff = this.fastfall;
    this.setState('attack');
    this.move = m; this.mf = 0; this.hitVictims = new Map(); this.prevHitPos = new Map();
    this.vars = vars;
    this.moveUse++; this.staleMul = m.noStale ? 1 : this.staleFor(m.id);
    this.moveStartFrame = this.match.frame;
    if (!this.grounded) this.fastfall = m.air ? ff : false;
    if (m.onStart) m.onStart(this);
    this.emit('move', { move: m });
  }
  runMove() {
    const m = this.move, c = this.ctrl;
    this.mf++;
    if (m.script) m.script(this, this.mf, c);
    if (this.state !== 'attack' || this.move !== m) return;
    if (m.next && c.pressed('A') && this.mf >= (m.nextFrom ?? 1)) this.vars.queued = true;
    if (m.next && this.vars.queued && this.mf >= (m.nextAt ?? m.total)) { const nm = this.def.moves[m.next]; if (nm) { this.startMove(nm); return; } }
    if (m.loop && (c.held('A') || this.vars.loopHold) && this.mf >= m.loop[1]) { this.mf = m.loop[0] - 1; this.hitVictims = new Map(); }
    if (!this.grounded) {
      if (m.air || m.drift) this.airDrift(c, m.driftMul ?? 1);
      else if (!m.noAirFriction) { this.airFriction(); }
    } else if (!m.keepVel) this.friction(m.traction ?? 1);
    if (m.iasa && this.mf >= m.iasa) {
      if (this.grounded && this.idleActions(c)) return;
      if (!this.grounded && this.airActions(c)) return;
    }
    if (this.mf >= m.total) this.endMove();
  }
  endMove() {
    const m = this.move;
    if (m && m.after) { const n = typeof m.after === 'function' ? m.after(this) : this.def.moves[m.after]; if (n) { this.startMove(n, { keepVars: true }); return; } }
    if (m && m.helpless && !this.grounded) { this.helplessLag = m.helplessLand ?? this.a.helplessLand; this.helplessDrift = m.helplessDrift ?? this.a.helplessDrift ?? 0.6; this.setState('helpless'); this.jumpsUsed = this.a.jumps; return; }
    this.setState(this.grounded ? (m && m.endSquat ? 'squatwait' : 'idle') : 'fall');
  }
  idleActions(c) {
    if (this.groundActions(c)) return true;
    if (Math.abs(c.x) * S >= 20) { this.setState(sign(c.x) === this.facing ? 'walk' : 'turn'); return true; }
    if (c.y * S <= -53) { this.setState('squat'); return true; }
    return false;
  }

  updateHitboxes() {
    this.activeHitboxes = [];
    if (this.state !== 'attack' || !this.move) return;
    const m = this.move;
    const list = this.dynamicHitboxes ?? m.hitboxes ?? [];
    for (let i = 0; i < list.length; i++) {
      const hb = list[i];
      if (this.mf < hb.frames[0] || this.mf > hb.frames[1]) continue;
      const pp = hb.path?.[this.mf] ?? hb.pos ?? [0, 0];
      const fx = pp[0] * this.scale, fy = pp[1] * this.scale;
      const wx = this.x + fx * this.facing, wy = this.y + fy;
      const prev = this.prevHitPos.get(i);
      this.prevHitPos.set(i, [wx, wy, this.mf]);
      const cont = prev && prev[2] === this.mf - 1;
      this.activeHitboxes.push({ hb, idx: i, x: wx, y: wy, px: cont ? prev[0] : wx, py: cont ? prev[1] : wy,
        r: hb.size * this.scale, owner: this, group: hb.group ?? 0, move: m });
    }
  }

  hurtCapsule() {
    let H = this.HV; const w = this.a.hurtR ? this.a.hurtR * this.scale : this.a.width * 0.75 * this.scale;
    const s = this.state;
    if (s === 'squat' || s === 'squatwait' || (s === 'attack' && this.move?.crouch)) H *= 0.6;
    if (s === 'downwait' || s === 'downbounce') {
      return { x1: this.x - H * 0.4, y1: this.y + w * 0.7, x2: this.x + H * 0.4, y2: this.y + w * 0.7, r: w * 0.7 };
    }
    const r = Math.min(w, H / 2);
    return { x1: this.x, y1: this.y + r, x2: this.x, y2: this.y + H - r, r };
  }

  // ---------- getting hit ----------
  // hit: { damage (already staled), angle, bkb, kbg, fkb, element, attacker, lr (+1: launch toward +x) }
  takeHit(hit) {
    const atk = hit.attacker;
    let dmg = hit.damage;
    if (this.state === 'grabbed' || this.state === 'thrown') dmg = Math.ceil(dmg * C.GRABBED_DMG_MUL);
    if (this.state === 'downwait' || this.state === 'downbounce') dmg = Math.ceil(dmg * C.DOWN_DMG_MUL);
    // a grabbed fighter is only released by a single hit of 6% or more
    if (this.state === 'grabbed' && dmg < C.GRAB_BREAK_DMG && !hit.throwHit) {
      this.percent = Math.min(999, this.percent + dmg); this.hurtFlash = 6;
      this.hitlag = hitlagFrames(dmg, hit, this);
      return { kb: 0, held: true };
    }
    this.percent = Math.min(999, this.percent + dmg);
    this.stats.dmgTaken += dmg;
    if (atk && atk !== this && atk.stats) atk.stats.dmgGiven += dmg;
    if (atk && atk !== this) { this.lastAttacker = atk; this.lastHitFrame = this.match.frame; }
    let kb = knockback(this.percent, dmg, hit, this.a.weight * this.weightMul, this.match.kbRatio(atk, this, hit));
    const crouch = (this.state === 'squat' || this.state === 'squatwait') && this.grounded;
    if (crouch) kb *= C.CROUCH_MUL;
    if (this.armor) kb = Math.max(0, kb - this.armor);
    const lag = hitlagFrames(dmg, hit, this);
    if (this.armor && kb <= 0) { this.hitlag = lag; this.hurtFlash = 6; return { kb: 0, armored: true }; }
    // knockback stacking: still in hitlag from a stronger hit -> just flash
    if (this.hitlag > 0 && this.kbStrength && kb < this.kbStrength + C.KB_STACK_MARGIN && (this.state === 'hurt' || this.state === 'tumble')) {
      this.hurtFlash = 6; return { kb, stacked: true };
    }
    // angle (measured away from the attacker)
    let ang = hit.angle;
    if (ang === 361) ang = !this.grounded ? C.SAKURAI_AIR : (kb < C.SAKURAI_GROUND_KB ? 0 : C.SAKURAI_GROUND);
    const rad = ang * Math.PI / 180;
    const lr = hit.lr ?? 1;
    const vx = Math.cos(rad) * kb * lr, vy = Math.sin(rad) * kb;
    this.hitstun = Math.max(1, Math.floor(kb / C.HITSTUN_DIV));
    this.hitlag = lag;
    if (this.grabbing) this.releaseGrab(true);
    if (this.grabbedBy) { const g = this.grabbedBy; g.grabbing = null; this.grabbedBy = null; if (g.state === 'grabbing') g.setState('idle'); }
    if (this.ledge) this.leaveLedge();
    if (this.item && kb > 0 && !(this.item.def.heavy && this.def.id === 'dk')) {
      // drop chance: damage > rand(0..59), or 50% if a shooter is empty (decomp ftparam.c)
      const empty = this.item.def.shoot && this.item.ammo <= 0;
      if (dmg > Math.random() * 60 || (empty && Math.random() < 0.5)) this.match.items.drop(this);
    }
    this.shieldStun = 0;
    this.vx = 0; this.vy = 0; this.kbx = 0; this.kby = 0; this.kbGround = 0; this.fastfall = false;
    const tumble = this.hitstun >= C.TUMBLE_HITSTUN;
    if (this.grounded) {
      if (vy > 0.001) { this.grounded = false; this.ground = null; this.kbx = vx; this.kby = vy; this.y += 1; }
      else if (tumble) {
        this.grounded = false; this.ground = null; this.kbx = vx;
        this.kby = ang < -10 || ang > 190 ? -vy * 0.8 : vy;   // spiked into the floor: bounce
        if (this.kby < 0) this.kby = 0; this.y += 1;
        if (ang < -10 || ang > 190) this.emit('groundBounce');
      } else this.kbGround = vx;
    } else { this.kbx = vx; this.kby = vy; }
    this.setState(tumble ? 'tumble' : 'hurt');
    this.hurtLevel = this.hitstun < 12 ? 1 : this.hitstun < 24 ? 2 : this.hitstun < 32 ? 3 : 4;
    this.facing = -lr || this.facing;
    this.kbStrength = kb;
    this.hurtFlash = 8;
    this.tumbleRoll = tumble && this.percent >= 100 && Math.random() < 0.5;
    this.zFrame = -999;   // a hit resets the tech timer
    return { kb };
  }

  releaseGrab(hitBreak) {
    const v = this.grabbing;
    this.grabbing = null;
    if (v && v.grabbedBy === this) {
      v.grabbedBy = null;
      if (v.state === 'grabbed') { v.setState('fall'); v.grounded = false; v.ground = null; }
    }
  }

  // ---------- items ----------
  throwItem(c) {
    const X = c.x * S, Y = c.y * S;
    let dir = 'f';
    if (Math.abs(Y) >= 53 && Math.abs(Y) > Math.abs(X)) dir = Y > 0 ? 'u' : 'd';
    else if (Math.abs(X) >= 20) dir = sign(X) === this.facing ? 'f' : 'b';
    const smash = (Math.abs(X) >= 56 && c.frame - c.lastNeutralXFrame < 3) || (Math.abs(Y) >= 53 && c.frame - c.lastNeutralYFrame < 4);
    this.startMove(this.def.common.itemThrow, { vars: { dir, smash } });
  }
  swingItem(c, air, dash) {
    let mv;
    if (air) mv = this.def.common.itemSwingAir;
    else if (dash) mv = this.def.common.itemSwingDash;
    else if (c.xSmash() && Math.abs(c.x) * S >= 56) { this.facing = sign(c.x) || this.facing; mv = this.def.common.itemSwingSmash; }
    else mv = this.def.common.itemSwingTilt;
    this.startMove(mv, { vars: { item: this.item } });
  }
  useItem() { this.startMove(this.def.common.itemShoot); }

  // ---------- death / respawn ----------
  die(side, star) {
    this.dead = true; this.respawnTimer = 0;
    this.respawnDelay = C.RESPAWN_DELAY + (side === 'top' ? C.STAR_KO_DELAY : 0);
    this.vx = this.vy = this.kbx = this.kby = 0; this.kbGround = 0;
    if (this.grabbing) this.releaseGrab();
    if (this.grabbedBy) { this.grabbedBy.grabbing = null; if (this.grabbedBy.state === 'grabbing') this.grabbedBy.setState('idle'); this.grabbedBy = null; }
    if (this.item) { this.match.items.remove(this.item); this.item = null; }
    this.ledge = null; this.setState('dead');
    this.onDie?.();
  }
  updateDead() {
    this.respawnTimer++;
    if (this.eliminated || this.noRespawn) return;
    if (this.respawnTimer >= this.respawnDelay) this.respawn();
  }
  respawn() {
    const sp = this.match.stage.respawnPoint(this.port, this.match);
    this.dead = false; this.x = sp[0]; this.platformY = sp[1];
    this.y0 = this.match.stage.blast.top; this.y = this.y0;
    this.percent = this.match.suddenDeath ? C.SUDDEN_DEATH_PCT : 0; this.facing = sp[0] > 0 ? -1 : 1;
    this.setState('respawn'); this.platform = { t: 0 };
    this.grounded = false; this.ground = null;
    this.jumpsUsed = 0; this.special = {}; this.lastAttacker = null;
    this.shieldHP = C.SHIELD_MAX; this.stale = [];
    this.emit('respawn');
  }
}

// ---------- knockback ----------
export function knockback(percentAfter, damage, hb, w, ratio = 1) {
  const base = hb.fkb ? 1 + hb.fkb / 2 : percentAfter / 10 + percentAfter * damage / 20;
  const kb = ((base * w * 1.4 + 18) * (hb.kbg / 100) + hb.bkb) * ratio;
  return Math.min(C.KB_CAP, kb);
}
export function hitlagFrames(damage, hit, self) {
  let f = Math.floor(Math.floor(damage / 3 + C.HITLAG_ADD) * (hit?.element === 'electric' ? C.HITLAG_ELEC : 1) * (hit?.hitlagMul ?? 1));
  if (self && (self.state === 'squat' || self.state === 'squatwait')) f = Math.floor(f * C.CROUCH_MUL);
  return f;
}

// ---------- action states ----------
const STATES = {
  entry(c) { if (this.sf >= (this.entryFrames ?? 60)) this.setState('idle'); },
  idle(c) {
    this.friction();
    if (this.groundActions(c)) return;
    if (c.y * S <= -53 && c.frame - c.lastNeutralYFrame < 4 && this.ground?.pass) { this.dropPlatform(); return; }
    if (c.y * S <= -53) { this.setState('squat'); return; }
    if (c.xSmash() && Math.abs(c.x) * S >= 56) { this.startDash(sign(c.x)); return; }
    if (Math.abs(c.x) * S >= 20) { this.setState(sign(c.x) === this.facing ? 'walk' : 'turn'); return; }
  },
  turn(c) {
    this.friction();
    if (c.xSmash() && Math.abs(c.x) * S >= 56) { this.startDash(sign(c.x)); return; }
    if (this.groundActions(c)) return;
    if (this.sf >= (this.a.turnFrames ?? 6)) { this.facing = -this.facing; this.setState(Math.abs(c.x) * S >= 20 && sign(c.x) === this.facing ? 'walk' : 'idle'); }
  },
  walk(c) {
    if (this.groundActions(c)) return;
    if (c.y * S <= -53 && c.frame - c.lastNeutralYFrame < 4 && this.ground?.pass) { this.dropPlatform(); return; }
    if (c.y * S <= -53) { this.setState('squat'); return; }
    if (c.xSmash() && Math.abs(c.x) * S >= 56) { this.startDash(sign(c.x)); return; }
    if (Math.abs(c.x) * S < 20) { this.setState('idle'); return; }
    if (sign(c.x) !== this.facing) { this.setState('turn'); return; }
    const target = Math.abs(c.x) * S * this.a.walkMul * this.facing;
    if (Math.abs(target) >= Math.abs(this.vx)) this.vx = target;
    else this.vx -= sign(this.vx) * Math.min(Math.abs(this.vx) - Math.abs(target), this.a.traction);
    this.walkPhase = (this.walkPhase ?? 0) + Math.abs(this.vx) / (this.H * 1.1);
  },
  dash(c) {
    const a = this.a;
    if (this.sf === 1) { this.vx = this.facing * a.dash; this.emit('dash'); }
    else if (this.sf >= 7) { const d = a.dashDecel; this.vx = Math.abs(this.vx) <= d ? 0 : this.vx - sign(this.vx) * d; }
    this.walkPhase = (this.walkPhase ?? 0) + Math.abs(this.vx) / (this.H * 1.6);
    if (c.pressed('A')) {
      if (this.sf <= 5 && c.xSmash(6) && Math.abs(c.x) * S >= 56) { this.facing = sign(c.x); this.startMove(this.def.moves.fsmash); return; }
      if (this.item) { this.groundAttack(c, { dash: true }); return; }
      this.startMove(this.def.moves.dashattack); return;
    }
    if (c.pressed('B')) { this.groundSpecial(c); return; }
    if (c.pressed('R') || (c.pressed('A') && c.held('Z'))) { this.startMove(this.def.moves.grab); return; }
    if (c.jumpPressed()) { this.jumpSquat(false); return; }
    if (this.stickJump(c)) { this.jumpSquat(true); return; }
    if (c.held('Z') && this.sf <= 20) { this.shieldSlide = 20 - this.sf; this.startShield(); return; }
    if (c.pressed('L')) { this.startMove(this.def.moves.taunt); return; }
    if (c.xSmash() && sign(c.x) === -this.facing && Math.abs(c.x) * S >= 56) { this.startDash(-this.facing); return; }
    if (this.sf >= (a.dashToRun ?? 14)) {
      if (c.x * this.facing * S >= 50) { this.setState('run'); return; }
      if (this.sf >= (a.dashFrames ?? a.dashToRun + 6)) { this.vx *= 0.75; this.setState('idle'); }
    }
  },
  run(c) {
    this.vx = this.a.run * this.facing;
    this.walkPhase = (this.walkPhase ?? 0) + Math.abs(this.vx) / (this.H * 1.6);
    if (c.pressed('A')) { if (this.item) { this.groundAttack(c, { dash: true }); return; } this.startMove(this.def.moves.dashattack); return; }
    if (c.pressed('B')) { this.groundSpecial(c); return; }
    if (c.pressed('R') || (c.pressed('A') && c.held('Z'))) { this.startMove(this.def.moves.grab); return; }
    if (c.jumpPressed()) { this.jumpSquat(false); return; }
    if (c.y * S > 44 && c.frame - c.lastNeutralYFrame <= 3) { this.jumpSquat(true); return; }
    if (c.held('Z')) { this.startShield(); return; }
    if (c.y * S <= -53) { this.setState('squat'); return; }
    if (c.x * this.facing * S <= -30) { this.setState('runturn'); return; }
    if (c.x * this.facing * S < 50) { this.setState('runbrake'); return; }
  },
  runbrake(c) {
    this.friction(1.25);
    if (c.jumpPressed()) { this.jumpSquat(false); return; }
    if (c.x * this.facing * S <= -30) { this.setState('runturn'); return; }
    if (this.sf >= (this.a.brakeFrames ?? 20) && this.vx === 0) this.setState('idle');
    else if (this.vx === 0 && this.sf >= 8) this.setState('idle');
  },
  runturn(c) {
    // decelerate then accelerate the other way
    const total = this.a.runTurnFrames ?? 20;
    if (this.sf === 1) this.turnV = this.vx;
    this.vx = this.turnV * (1 - 2 * this.sf / total);
    if (c.jumpPressed()) { this.facing = -this.facing; this.jumpSquat(false); return; }
    if (this.sf >= total) { this.facing = -this.facing; this.setState(c.x * this.facing * S >= 50 ? 'run' : 'idle'); }
  },
  squat(c) {
    this.friction();
    if (this.sf === 1 && this.ground?.pass && c.frame - c.lastNeutralYFrame < 4) { this.dropPlatform(); return; }
    if (c.pressed('A') && !this.item) { this.startMove(this.def.moves.dtilt); return; }
    if (this.groundActions(c, { noTapJump: true })) return;
    if (this.sf >= 3) this.setState('squatwait');
  },
  squatwait(c) {
    this.friction();
    if (c.y * S <= -53 && c.frame - c.lastNeutralYFrame < 4 && this.ground?.pass) { this.dropPlatform(); return; }
    if (c.pressed('A') && !this.item) { this.startMove(this.def.moves.dtilt); return; }
    if (this.groundActions(c, { noTapJump: true })) return;
    if (c.y * S > -53) this.setState('squatrv');
  },
  squatrv(c) {
    this.friction();
    if (this.groundActions(c)) return;
    if (this.sf >= 3) this.setState('idle');
  },
  jumpsquat(c) {
    this.friction(0.5);
    this.vars.maxY = Math.max(this.vars.maxY, c.y * S);
    if (!this.vars.byStick && this.sf <= C.SHORTHOP_WINDOW && !c.jumpHeld()) this.vars.short = true;
    // up-B / up-smash out of jumpsquat
    if (c.pressed('B') && c.y * S >= 53) { this.startMove(this.def.moves.uspecial); return; }
    if (c.pressed('A') && c.y * S >= 53) { this.startMove(this.def.moves.usmash); return; }
    if (this.sf >= this.a.jsq) this.doJump();
  },
  landing(c) {
    this.friction();
    if (this.sf >= this.landLag) { this.setState('idle'); STATES.idle.call(this, c); }
  },
  jump(c) { this.airDrift(c); this.airActions(c); },
  jumpaerial(c) { this.airDrift(c); if (this.sf > 8) this.armor = 0; this.airActions(c); },
  fall(c) {
    this.airDrift(c);
    if (this.airActions(c)) return;
  },
  helpless(c) {
    this.airDrift(c, this.helplessDrift ?? 0.6);
  },
  tumble(c) {
    if (this.hitstun > 0) { this.hitstun--; this.airFriction(); return; }
    this.airDrift(c);
    if (this.airActions(c)) return;
  },
  hurt(c) {
    if (this.hitstun > 0) { this.hitstun--; if (!this.grounded) this.airFriction(); return; }
    this.setState(this.grounded ? 'idle' : 'fall');
  },
  downbounce(c) {
    this.friction();
    if (c.pressed('A') || c.pressed('B')) this.vars.getupAtk = true;
    if (this.sf >= 26) {
      if (this.dizzyAfter) { this.dizzyAfter = false; this.setState('getup'); this.vars.toDizzy = true; return; }
      this.setState('downwait');
      if (this.vars?.getupAtk) STATES.downwait.call(this, c, true);
    }
  },
  downwait(c, buffered) {
    this.friction();
    const slow = this.percent >= 100;
    if (buffered || c.pressed('A') || c.pressed('B')) { this.startMove(slow ? this.def.moves.getupAttackSlow ?? this.def.moves.getupAttack : this.def.moves.getupAttack); this.intangible = 19; return; }
    if (Math.abs(c.x) * S >= 20) { this.rollDir = sign(c.x); this.setState('getuproll'); this.intangible = 19; return; }
    if (c.y * S >= 20 || this.sf >= C.DOWN_AUTO_GETUP) { this.setState('getup'); this.intangible = 21; return; }
  },
  getup(c) {
    if (this.sf >= (this.a.getupFrames ?? 30)) {
      if (this.vars?.toDizzy) { this.setState('dizzy'); this.dizzyTime = Math.max(0, C.DIZZY_BASE - this.percent) + C.DIZZY_ADD; return; }
      this.setState('idle');
    }
  },
  getuproll(c) {
    const total = this.a.getupRollFrames ?? 34;
    const dist = this.a.rollDist ?? this.H * 1.0;
    if (this.sf >= 3 && this.sf <= total - 6) this.slideOnFloor(this.rollDir * dist / (total - 8));
    if (this.sf >= total) { this.facing = -this.rollDir || this.facing; this.setState('idle'); }
  },
  tech(c) { this.friction(); if (this.sf >= (this.a.techFrames ?? 26)) this.setState('idle'); },
  techroll(c) {
    const total = this.a.techRollFrames ?? 34;
    const dist = this.a.rollDist ?? this.H * 1.0;
    if (this.sf >= 3 && this.sf <= total - 6) this.slideOnFloor(this.rollDir * dist / (total - 8));
    if (this.sf >= total) { this.facing = -this.rollDir || this.facing; this.setState('idle'); }
  },
  shield(c) {
    if (this.shieldSlide > 0) { this.shieldSlide--; this.friction(0.5); } else this.friction();
    if (++this.shieldTimer >= C.SHIELD_DECAY_INT) { this.shieldTimer = 0; this.shieldHP--; }
    if (this.shieldHP <= 0) { this.breakShield(); return; }
    if (c.pressed('A') || c.pressed('R')) { if (this.item) { this.throwItem(c); return; } this.startMove(this.def.moves.grab, { vars: { fromShield: this.shieldStunRecent } }); return; }
    if (c.jumpPressed() || this.stickJump(c)) { this.jumpSquat(!c.jumpPressed()); this.intangible = 2; return; }
    if (Math.abs(c.x) * S >= 56 && c.frame - c.lastNeutralXFrame < 4) { this.rollDir = sign(c.x); this.setState('roll'); return; }
    if (c.y * S <= -53 && c.frame - c.lastNeutralYFrame < 4 && this.ground?.pass) { this.dropPlatform(); return; }
    if (!c.held('Z') && this.sf >= C.SHIELD_MIN_HOLD) { this.setState('shieldoff'); return; }
  },
  shieldstun(c) {
    this.friction();
    if (c.pressed('A') || c.pressed('R')) this.vars.grabBuffered = true;
    if (--this.shieldStun <= 0) {
      this.shieldStunRecent = true;
      this.setState(c.held('Z') ? 'shield' : 'shieldoff');
      setTimeout0(this);
    }
  },
  shieldoff(c) { this.friction(); if (this.sf >= (this.a.shieldDrop ?? C.SHIELD_DROP)) this.setState('idle'); },
  roll(c) {
    const R = this.a.roll ?? { total: 31, iStart: 4, iEnd: 19 };
    const dist = this.a.rollDist ?? this.H * 1.1;
    if (this.sf === 1) this.emit('roll');
    if (this.sf >= R.iStart && this.sf <= R.iEnd) this.intangible = Math.max(this.intangible, 1);
    const mv = R.total - 8;
    if (this.sf >= 2 && this.sf <= mv + 1) this.slideOnFloor(this.rollDir * dist / mv);
    if (this.sf >= R.total) { if (this.rollDir === this.facing) this.facing = -this.facing; this.setState('idle'); }
  },
  shieldbreakfly(c) { },
  dizzy(c) {
    this.friction();
    const mash = c.pressed('A') || c.pressed('B') || c.pressed('Z') || (Math.hypot(c.x, c.y) * S > 40 && (sign(c.x) !== sign(c.px) || sign(c.y) !== sign(c.py)));
    this.sf += mash ? 3 : 0;
    if (this.sf >= (this.dizzyTime ?? 300)) { this.setState('idle'); this.shieldHP = C.SHIELD_RESET; }
  },
  ledge(c) {
    const L = this.ledge;
    if (!L || !L.floor.active) { this.ledge = null; this.setState('fall'); return; }
    this.x = L.x + L.dir * this.a.width * 0.5; this.y = L.y - this.HV * 0.88;
    const catchF = this.a.ledgeCatchFrames ?? 3;
    if (this.sf <= catchF) return;
    if (Math.abs(c.x) * S < 20 && Math.abs(c.y) * S < 20) this.ledgeNeutral = true;
    const slow = this.percent >= 100;
    if (this.sf >= (slow ? C.LEDGE_HANG_SLOW : C.LEDGE_HANG)) { this.leaveLedge(); this.setState('tumble'); this.hitstun = 0; return; }
    const toward = -L.dir;
    if (c.pressed('A') || c.pressed('B')) { this.ledgeAction('ledgeattack', slow); return; }
    if (c.pressed('Z') || c.pressed('R')) { this.ledgeAction('ledgeroll', slow); return; }
    if (c.jumpPressed()) { this.ledgeAction('ledgeclimb', slow); return; }
    if (!this.ledgeNeutral) return;
    const X = c.x * S, Y = c.y * S;
    const mag = Math.hypot(X, Y);
    if (mag >= 20) {
      const ang = Math.atan2(Y, X * toward) * 180 / Math.PI;    // 0 = toward stage, 90 = up
      if ((Y > 0 && ang > 50) || (Math.abs(ang) <= 50 && X * toward > 0)) { this.ledgeAction('ledgeclimb', slow); return; }
      if (Y < -20 || X * toward < -20) { this.leaveLedge(); this.setState('fall'); this.x += L.dir * this.a.width * 0.6; this.jumpsUsed = 1; return; }
    }
  },
  ledgeclimb(c) {
    const T = this.ledgeT;
    this.climbAnim(T, 0);
    if (this.sf >= T.total) this.finishClimb();
  },
  ledgeroll(c) {
    const T = this.ledgeT;
    this.climbAnim(T, T.rollDist ?? this.H * 1.3);
    if (this.sf >= T.total) this.finishClimb();
  },
  respawn(c) {
    const p = this.platform; p.t++;
    const T = C.RESPAWN_DESCENT;
    if (p.t <= T) {
      const t = T - p.t;
      this.y = (this.y0 - this.platformY) / (T * T) * t * t + this.platformY;
      if (p.t < C.RESPAWN_ACT) return;
    }
    this.y = Math.max(this.platformY, this.y);
    const act = Math.abs(c.x) * S >= 20 || Math.abs(c.y) * S >= 20 || c.pressed('A') || c.pressed('B') || c.jumpPressed() || c.held('Z') || c.pressed('R') || c.pressed('L');
    if (act || p.t >= C.RESPAWN_PLATFORM_MAX) {
      this.platform = null; this.invincible = C.RESPAWN_INVINCIBLE;
      // the fighter acts as if standing on the platform
      this.setState('fall'); this.grounded = false; this.ground = null; this.vy = 0;
      if (c.jumpPressed() || this.stickJump(c)) { this.jumpsUsed = 1; this.doDoubleJump(); }
      else if (c.pressed('A')) this.airAttack(c);
      else if (c.pressed('B')) this.airSpecial(c);
    }
  },
  grabbing(c) {
    const v = this.grabbing;
    this.friction();
    if (!v || v.grabbedBy !== this) { this.grabbing = null; this.setState('idle'); return; }
    v.x = this.x + this.facing * (this.a.grabHoldX ?? this.a.width * 1.8); v.y = this.y + (this.a.grabHoldY ?? 0); v.facing = -this.facing;
    if (c.pressed('A') || c.pressed('B')) { this.startThrow('fthrow'); return; }
    const X = c.x * S;
    if (Math.abs(X) >= 20 && Math.abs(c.px * S) < 20) { this.startThrow(sign(X) === this.facing ? 'fthrow' : 'bthrow'); return; }
    if (this.sf >= C.GRAB_HOLD) { this.startThrow('fthrow'); return; }
  },
  grabbed(c) {
    const g = this.grabbedBy;
    if (!g) { this.setState('fall'); return; }
  },
  thrown(c) { },
  // put to sleep (Jigglypuff's Sing, ftcommonfurasleep.c): standing doze for sleepTimer frames; every mash
  // (button press or stick flick) takes 4 frames off; wakes into Wait
  sleep(c) {
    this.friction();
    let t = (this.sleepTimer ?? 0) - 1;
    const mash = ['A', 'B', 'Z', 'R', 'L', 'CU', 'CD', 'CL', 'CR'].some(k => c.pressed(k)) || c.xSmash(1) || c.ySmash(1);
    if (mash) t -= 4;
    this.sleepTimer = t;
    if (t <= 0) this.setState('idle');
  },
  rebound(c) { this.friction(); if (this.sf >= (this.reboundLag ?? 10)) this.setState('idle'); },
  dead() { },
};
function setTimeout0(f) { /* placeholder hook: grabs from shield right after stun get the penalty */ f.shieldStunRecent = true; }

Fighter.prototype.startDash = function (dir) { this.facing = dir; this.setState('dash'); };
Fighter.prototype.dropPlatform = function () {
  const f = this.ground;
  this.dropFloor = f; this.dropThrough = 10;
  this.grounded = false; this.ground = null; this.y -= 1;
  this.vy = 0; this.setState('fall');
  this.emit('drop');
};
Fighter.prototype.breakShield = function () {
  this.shieldHP = 0;
  this.setState('shieldbreakfly');
  this.grounded = false; this.ground = null;
  this.vy = this.a.breakVy ?? 70; this.vx = 0; this.y += 1;
  this.emit('shieldBreak');
};
// move along the current floor without leaving it (rolls, getups)
Fighter.prototype.slideOnFloor = function (dx) {
  if (!this.ground) { this.x += dx; return; }
  const lx = floorLeft(this.ground), rx = floorRight(this.ground);
  this.x = clamp(this.x + dx, lx + 1, rx - 1);
  this.y = floorY(this.ground, this.x) ?? this.y;
};
Fighter.prototype.ledgeAction = function (kind, slow) {
  const L = this.ledge;
  this.ledgeStart = L;
  const T = { ...DEFAULT_LEDGE[kind + (slow ? 'Slow' : '')], ...(this.a.ledgeTimes?.[kind + (slow ? 'Slow' : '')] ?? {}) };
  this.ledgeT = T;
  this.leaveLedge(); this.ledgeLock = 0;
  if (kind === 'ledgeattack') {
    const m = slow ? (this.def.moves.ledgeAttackSlow || this.def.moves.ledgeAttack) : this.def.moves.ledgeAttack;
    this.setState('ledgeclimb'); this.ledgeT = { ...T, total: T.climbFrames, then: m };
    this.intangible = Math.max(this.intangible, T.climbFrames + (m?.intangible ?? 0));
    return;
  }
  this.setState(kind);
  this.intangible = Math.max(this.intangible, T.intangible ?? T.total);
};
Fighter.prototype.climbAnim = function (T, dist) {
  const L = this.ledgeStart;
  const rf = T.riseFrames ?? Math.round(T.total * 0.6);
  const rise = Math.min(1, this.sf / rf);
  const tRoll = Math.max(0, Math.min(1, (this.sf - rf) / Math.max(1, T.total - rf)));
  const inward = -L.dir;
  this.x = L.x + L.dir * this.a.width * 0.5 * (1 - rise) + inward * (this.a.width * 1.0 * rise + dist * tRoll);
  this.y = L.y - this.HV * 0.88 * (1 - rise);
};
Fighter.prototype.finishClimb = function () {
  const L = this.ledgeStart;
  this.grounded = true; this.ground = L.floor;
  this.x = clamp(this.x, floorLeft(L.floor) + 1, floorRight(L.floor) - 1);
  this.y = floorY(L.floor, this.x) ?? L.y;
  const then = this.ledgeT?.then;
  if (then) { this.startMove(then); return; }
  this.setState('idle');
};
Fighter.prototype.startThrow = function (name) {
  const m = this.def.moves[name];
  const v = this.grabbing;
  const halve = this.vars?.fromShield;
  this.startMove(m, { vars: { victim: v, halve } });
  v.setState('thrown');
  this.intangible = Math.max(this.intangible, m.total);  // thrower is immune to grabs during the throw (approx.)
};

// Ledge option timings (EST per mechanics.md §5; per-character overrides in attr.ledgeTimes)
const DEFAULT_LEDGE = {
  ledgeclimb: { total: 30, riseFrames: 18 }, ledgeclimbSlow: { total: 60, riseFrames: 40 },
  ledgeroll: { total: 44, riseFrames: 16, rollDist: 450 }, ledgerollSlow: { total: 72, riseFrames: 40, rollDist: 450 },
  ledgeattack: { climbFrames: 14, riseFrames: 12 }, ledgeattackSlow: { climbFrames: 30, riseFrames: 26 },
};
