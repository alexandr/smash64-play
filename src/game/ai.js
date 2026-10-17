// CPU opponents (levels 1-9), after decomp ftcomputer.c behaviour (reference/spec/mechanics.md §11.3):
//  - reaction waits: ground 2·rand·(9−L) + 2·(9−L) + 1, air rand·(9−L) + (9−L)/2 + 1 frames
//  - aim error: target hurtbox scaled by 1 + (rand−0.5)·(9−L)·0.1
//  - L < 3 attacks only if percent+5 ≥ rand·(200 − 50L); up-B recovery chance (L+2)/9; fast fall only L > 5
//  - shielding/evading from L ≥ 3 with chance 1/(11−L); pursuit radius 400·(L+3)
// The driver writes stick/buttons into the fighter's Controller, so CPUs obey the same rules as humans.
// It picks attacks by testing each move's real hitbox frames/positions against the target's predicted position.
import { floorLeft, floorRight, floorY } from './collision.js';

const sign = v => (v > 0 ? 1 : v < 0 ? -1 : 0);
const RECOVERY = {
  mario: { up: 1500, side: 600 }, luigi: { up: 1150, side: 300 }, dk: { up: 800, side: 1100 }, link: { up: 950, side: 450 },
  samus: { up: 900, side: 500 }, falcon: { up: 1500, side: 500 }, ness: { up: 1800, side: 1200 }, yoshi: { up: 0, side: 0 },
  kirby: { up: 600, side: 200 }, fox: { up: 3000, side: 3000, aimed: true }, pikachu: { up: 2400, side: 2400, aimed: true }, jigglypuff: { up: 0, side: 0 },
};
const GROUND_MOVES = ['jab1', 'ftilt', 'utilt', 'dtilt', 'fsmash', 'usmash', 'dsmash', 'grab'];
const AIR_MOVES = ['nair', 'fair', 'bair', 'uair', 'dair'];
const reachCache = new WeakMap();

// Per move: [{ f, x, y, r }] hitbox samples (relative to the fighter, facing right) + total frames
function reachOf(def) {
  let c = reachCache.get(def);
  if (c) return c;
  c = {};
  for (const [id, m] of Object.entries(def.moves)) {
    const hbs = (m.hitboxes ?? []).filter(h => h.damage > 0 || h.grab);
    if (!hbs.length) continue;
    const samples = [];
    for (const h of hbs) for (let f = h.frames[0]; f <= Math.min(h.frames[1], h.frames[0] + 6); f++) {
      const p = h.path?.[f] ?? h.pos ?? [0, 0];
      samples.push({ f, x: p[0], y: p[1], r: h.r ?? h.size ?? 80, dmg: h.damage, kbg: h.kbg, bkb: h.bkb, grab: !!h.grab });
    }
    const start = Math.min(...samples.map(s => s.f));
    c[id] = { samples, start, total: m.total ?? 30, dmg: Math.max(...samples.map(s => s.dmg || 0)), power: Math.max(...samples.map(s => (s.kbg || 0) + (s.bkb || 0))) };
  }
  reachCache.set(def, c);
  return c;
}

export class CpuDriver {
  constructor(match, fighter) {
    this.m = match; this.f = fighter;
    this.lv = Math.max(1, Math.min(9, fighter.cpu?.level ?? 3));
    this.mode = fighter.cpu?.mode ?? 'normal';   // training: stop | walk | evade | jump | normal
    this.rng = mulberry(fighter.port * 7919 + 13 + (match.frame | 0));
    this.wait = 0; this.plan = null; this.hold = null; this.holdT = 0;
    this.drive = (c) => this.step(c);
    this.lastJumpFrame = -99;
  }
  r() { return this.rng(); }
  groundWait() { const k = 9 - this.lv; return Math.floor(2 * this.r() * k + 2 * k + 1); }
  airWait() { const k = 9 - this.lv; return Math.floor(this.r() * k + k / 2 + 1); }

  step(c) {
    const f = this.f, m = this.m;
    c.x = 0; c.y = 0; for (const k in c.down) c.down[k] = false;
    if (f.dead || m.phase !== 'play' || f.state === 'entry') return;
    // continuing a held input (charge, shield, multi-frame plan)
    if (this.holdT > 0) { this.holdT--; this.apply(c, this.hold); return; }
    if (this.mode === 'stop') return;
    if (f.state === 'respawn') { if (f.platform?.t > 80 + this.r() * 100) c.y = -1; return; }
    if (this.mode === 'walk') return this.walkMode(c);
    if (this.mode === 'jump') { if (f.grounded && this.r() < 0.03) this.press(c, 'CU'); return; }
    if (this.mode === 'evade') return this.evadeMode(c);

    const stg = this.stageBounds();
    if (f.state === 'ledge') return this.ledgeOption(c);
    if (f.state === 'grabbing') { c.x = (this.edgeBehind() ? 1 : (this.r() < 0.5 ? 1 : -1)) * f.facing; return; }
    if (f.state === 'downwait' || f.state === 'downbounce') return this.getup(c);
    if (f.state === 'dizzy' || f.state === 'grabbed' || f.state === 'sleep') { if (this.r() < 0.3) c.down.A = true; c.x = this.r() < 0.5 ? 1 : -1; return; }
    if (f.state === 'tumble' && f.hitstun > 0) {
      // tech when about to land
      if (!f.grounded && f.vy + f.kby < 0 && this.nearFloorBelow(f, 400) && this.r() < (this.lv + 2) / 9 * 0.5) { c.down.Z = true; c.x = this.r() < 0.4 ? (this.r() < 0.5 ? 1 : -1) : 0; }
      return;
    }
    // recovery
    const off = !f.grounded && (f.x < stg.l - 30 || f.x > stg.r + 30 || f.y < stg.y - 80);
    if (off || f.state === 'helpless') return this.recover(c, stg);

    // pick target
    const foes = m.fighters.filter(o => o !== f && !o.dead && o.state !== 'respawn' && !(m.rules.teams && o.team === f.team) && !(f.team === o.team && f.cpu?.ally));
    if (!foes.length) return;
    let t = null, bd = Infinity;
    for (const o of foes) { const d = Math.hypot(o.x - f.x, o.y - f.y) + (o.cpu ? 300 : 0) * 0; if (d < bd) { bd = d; t = o; } }
    this.target = t;

    // defense: an opponent attack about to connect
    if (f.grounded && this.lv >= 3 && this.threatened(t) && ['idle', 'walk', 'squatwait', 'dash', 'run', 'landing'].includes(f.state)) {
      if (this.r() < 1 / (11 - this.lv) * 2) {
        if (this.lv >= 7 && this.r() < 0.35) { c.down.Z = true; c.x = sign(f.x - t.x) || 1; c.xSmashFrame = c.frame + 1; c.lastNeutralXFrame = c.frame; return; }
        this.holdFor({ down: ['Z'] }, 6 + Math.floor(this.r() * 12)); this.apply(c, this.hold); return;
      }
    }
    if (f.state === 'shield' || f.state === 'shieldstun') {
      if (f.state === 'shield' && Math.abs(t.x - f.x) < f.H * 0.9 && this.r() < 0.3 + this.lv * 0.05) { c.down.Z = true; c.down.A = true; return; }   // shield grab
      if (this.r() < 0.15) return; // drop shield
      c.down.Z = true; return;
    }
    if (this.wait > 0) { this.wait--; this.idleMotion(c, t); return; }

    // attack if a move would connect
    const atk = this.chooseAttack(t);
    if (atk) {
      if (this.lv < 3 && !(t.percent + 5 >= this.r() * (200 - 50 * this.lv))) { this.wait = this.groundWait(); return; }
      this.doMove(c, atk, t);
      this.wait = f.grounded ? this.groundWait() : this.airWait();
      return;
    }
    // otherwise move toward the target
    this.approach(c, t, stg);
  }

  apply(c, h) {
    if (!h) return;
    if (h.x !== undefined) c.x = h.x; if (h.y !== undefined) c.y = h.y;
    for (const b of h.down ?? []) c.down[b] = true;
  }
  holdFor(h, n) { this.hold = h; this.holdT = n; }
  press(c, b) { c.down[b] = true; }

  // will any of the target's active/upcoming hitboxes reach us soon?
  threatened(t) {
    const f = this.f;
    if (t.state !== 'attack' || !t.move) return false;
    const R = reachOf(t.def)[t.move.id];
    if (!R) return Math.abs(t.x - f.x) < t.H;
    for (const s of R.samples) {
      if (s.f < t.mf || s.f > t.mf + 8 || s.grab) continue;
      const hx = t.x + s.x * t.facing, hy = t.y + s.y;
      if (Math.abs(hx - f.x) < s.r + f.a.width * 1.2 && hy > f.y - s.r && hy < f.y + f.H + s.r) return true;
    }
    return false;
  }

  // choose a move whose hitboxes overlap the target's predicted body
  chooseAttack(t) {
    const f = this.f, lv = this.lv;
    const R = reachOf(f.def);
    const err = 1 + (this.r() - 0.5) * (9 - lv) * 0.1;
    const list = f.grounded ? GROUND_MOVES : AIR_MOVES;
    if (f.grounded && !['idle', 'walk', 'dash', 'run', 'squatwait', 'turn'].includes(f.state)) return null;
    if (!f.grounded && !['jump', 'jumpaerial', 'fall'].includes(f.state) && !(f.state === 'tumble' && f.hitstun <= 0)) return null;
    if (!f.grounded) {
      const s = this.stageBounds(), landX = f.x + f.vx * 20;
      if (landX < s.l + 100 || landX > s.r - 100 || f.y < s.y - 50) return null;   // stay safe near/over the edge
    }
    let best = null, bestScore = 0;
    const killPct = 90 + (9 - lv) * 8;
    for (const id of list) {
      const r = R[id]; if (!r) continue;
      if (id === 'grab' && (!t.grounded || t.state === 'downwait')) continue;
      for (const facing of (f.grounded && id !== 'grab' && !id.includes('smash') ? [f.facing] : [f.facing, -f.facing])) {
        let hit = false;
        for (const s of r.samples) {
          const dt = s.f;
          const tx = t.x + (t.vx + t.kbx + (t.kbGround || 0)) * dt * 0.6, ty = t.y + (t.vy + t.kby) * Math.min(dt, 10) * 0.5;
          const fx = f.x + (f.grounded ? 0 : f.vx * dt), fy = f.y + (f.grounded ? 0 : f.vy * Math.min(dt, 10));
          const hx = fx + s.x * facing, hy = fy + s.y;
          const rr = (s.r + t.a.width * 0.8) * err;
          if (Math.abs(hx - tx) < rr && hy > ty - s.r * err && hy < ty + t.H + s.r * err) { hit = true; break; }
        }
        if (!hit) continue;
        let score = 1 + r.dmg * 0.1 - r.start * 0.04;
        if (id.includes('smash') || id === 'fair' || id === 'bair') score += t.percent > killPct ? 2.5 : -0.3;
        if (id === 'grab') score += t.state === 'shield' ? 3 : 0.4;
        if (t.state === 'shield' && id !== 'grab') score -= 1;
        score += this.r() * 1.2;
        if (score > bestScore) { bestScore = score; best = { id, facing }; }
      }
    }
    return best;
  }

  doMove(c, a, t) {
    const f = this.f;
    const dir = a.facing;
    switch (a.id) {
      case 'jab1': c.down.A = true; break;
      case 'ftilt': c.x = dir * 0.5; c.down.A = true; break;
      case 'utilt': c.y = 0.5; c.down.A = true; break;
      case 'dtilt': c.y = -0.5; c.down.A = true; break;
      case 'fsmash': c.x = dir; c.lastNeutralXFrame = c.frame; c.xSmashFrame = c.frame + 1; c.down.A = true; break;
      case 'usmash': c.y = 1; c.lastNeutralYFrame = c.frame; c.down.A = true; break;
      case 'dsmash': c.y = -1; c.lastNeutralYFrame = c.frame; c.down.A = true; break;
      case 'grab': if (dir !== f.facing) { c.x = dir * 0.4; } c.down.R = true; break;
      case 'nair': c.down.A = true; break;
      case 'fair': c.x = f.facing; c.down.A = true; break;
      case 'bair': c.x = -f.facing; c.down.A = true; break;
      case 'uair': c.y = 1; c.down.A = true; break;
      case 'dair': c.y = -1; c.down.A = true; break;
    }
    // z-cancel aerials at higher levels
    if (!f.grounded && this.lv >= 5) this.zcancelArm = true;
  }

  idleMotion(c, t) {
    const f = this.f;
    if (this.zcancelArm && !f.grounded && f.state === 'attack' && f.vy < 0 && this.nearFloorBelow(f, 120) && this.r() < this.lv / 9) { c.down.Z = true; this.zcancelArm = false; }
    if (!f.grounded) { c.x = sign(t.x - f.x); if (this.lv > 5 && f.vy < 0 && !f.fastfall && t.y < f.y - 300 && f.x > this.stageBounds().l + 200 && f.x < this.stageBounds().r - 200 && this.r() < 70 / (550 - 50 * this.lv)) { c.y = -1; c.lastNeutralYFrame = c.frame; } }
  }

  approach(c, t, stg) {
    const f = this.f, lv = this.lv;
    const dx = t.x - f.x, dy = t.y - f.y;
    const pursuit = 400 * (lv + 3);
    if (Math.abs(dx) > pursuit && this.r() < 0.5) return;           // too far: wander slowly
    if (f.grounded) {
      // don't run off the stage
      const nextX = f.x + sign(dx) * 300;
      const onMain = f.ground === this.m.stage.mainFloor;
      if (onMain && (nextX < stg.l + 150 || nextX > stg.r - 150) && (t.x < stg.l || t.x > stg.r)) { c.x = 0; return; }
      if (dy > f.H * 1.3 && Math.abs(dx) < f.H * 3) { if (this.m.frame - this.lastJumpFrame > 20) { c.down.CU = true; this.lastJumpFrame = this.m.frame; } c.x = sign(dx) * 0.5; return; }
      if (dy < -f.H && f.ground?.pass && Math.abs(dx) < f.H * 4 && this.r() < 0.2) { c.y = -1; c.lastNeutralYFrame = c.frame; return; }
      const far = Math.abs(dx) > f.H * 2.5;
      if (far && (f.state === 'idle' || f.state === 'walk') && lv >= 3) { c.x = sign(dx); c.lastNeutralXFrame = c.frame; c.xSmashFrame = c.frame + 1; return; }
      c.x = sign(dx) * (far || f.state === 'run' || f.state === 'dash' ? 1 : 0.6);
      // projectile zoning at range
      if (far && f.def.moves.nspecial && this.r() < 0.01 * lv && f.state !== 'run') { c.x = 0; c.down.B = true; }
      // short-hop toward airborne targets
      if (!t.grounded && dy > f.H * 0.3 && Math.abs(dx) < f.H * 2 && this.r() < 0.1) c.down.CU = true;
    } else {
      c.x = sign(dx);
      if (f.vy < 0 && dy > f.H && f.jumpsUsed < f.a.jumps && this.r() < 0.06) c.down.CU = true;
    }
  }

  stageBounds() {
    const main = this.m.stage.mainFloor ?? this.m.col.floors[0];
    return { l: floorLeft(main), r: floorRight(main), y: Math.min(main.pts[0][1], main.pts[main.pts.length - 1][1]), floor: main };
  }
  edgeBehind() { const s = this.stageBounds(), f = this.f; return f.facing > 0 ? f.x - s.l < 600 : s.r - f.x < 600; }
  nearFloorBelow(f, d) {
    for (const fl of this.m.col.floors) { if (!fl.active) continue; const y = floorY(fl, f.x); if (y !== null && y <= f.y && f.y - y < d) return true; }
    return false;
  }

  // Recovery planner. Reach of each character's up-special (game units, from the move data / specials):
  // vertical rise and horizontal travel; aimed = recovery direction follows the stick.
  recover(c, stg) {
    const f = this.f, lv = this.lv;
    const R = RECOVERY[f.def.id] ?? { up: 900, side: 500 };
    const left = f.x < (stg.l + stg.r) / 2;
    const lx = left ? stg.l : stg.r, ly = stg.ledgeY ?? stg.y;
    const toward = left ? 1 : -1;
    const dx = Math.abs(lx - f.x), dy = ly - f.y;          // dy > 0: ledge above us
    if (f.state === 'helpless' || (f.state === 'attack' && f.move?.helpless)) { c.x = toward; return; }
    if (f.state === 'tumble' && f.hitstun > 0) return;
    if (f.state === 'attack') {
      // keep aiming during an aimed recovery move (Fire Fox, Quick Attack)
      if (R.aimed) { const L = Math.hypot(lx - f.x, ly + 150 - f.y) || 1; c.x = (lx - f.x) / L; c.y = (ly + 150 - f.y) / L; }
      else c.x = toward;
      return;
    }
    c.x = toward;
    // under the stage: drift out from under the lip before recovering upward
    if (f.y < ly - 150 && f.x > stg.l - 60 && f.x < stg.r + 60) { c.x = -toward; if (f.jumpsUsed < f.a.jumps && f.vy < -20 && this.m.frame - this.lastJumpFrame > 12) { c.down.CU = true; this.lastJumpFrame = this.m.frame; } return; }
    const jumpsLeft = f.jumpsUsed < f.a.jumps;
    // multi-jumpers (Kirby, Jigglypuff) and Yoshi climb with jumps
    if (jumpsLeft && f.vy < 2 && (dy > -250 || dx > 900)) {
      if (this.m.frame - this.lastJumpFrame > (f.a.jumps > 2 ? 22 : 12)) { c.down.CU = true; this.lastJumpFrame = this.m.frame; }
      return;
    }
    if (R.up <= 0) return;                                   // no recovery special (Yoshi, Jigglypuff)
    // fire the up-special once the ledge is within reach (or we're about to fall out of reach)
    const inReach = dy < R.up * 0.85 && dx < R.side + R.up * 0.4;
    const lastChance = dy > R.up * 0.55 || f.y < ly - 900;
    if (f.vy < 0 && (inReach && (lastChance || dx > R.side * 0.6)) && this.r() < 0.35 + (lv + 2) / 9 * 0.65) {
      if (R.aimed) { const L = Math.hypot(lx - f.x, ly + 150 - f.y) || 1; c.x = (lx - f.x) / L; c.y = Math.max(0.68, (ly + 150 - f.y) / L); }
      else { c.y = 1; c.x = toward * 0.6; }
      c.down.B = true; c.lastNeutralYFrame = c.frame;
    }
  }
  ledgeOption(c) {
    const f = this.f;
    if (f.sf < 10 + Math.floor((9 - this.lv) * 6 * this.r())) return;
    const r = this.r();
    if (r < 0.4) c.x = f.facing; else if (r < 0.6) c.down.CU = true; else if (r < 0.8) c.down.Z = true; else c.down.A = true;
  }
  getup(c) {
    if (this.r() > 0.15) return;
    const r = this.r();
    if (r < 0.35) c.y = 1; else if (r < 0.75) c.x = this.r() < 0.5 ? 1 : -1; else c.down.A = true;
  }
  walkMode(c) {
    const f = this.f, s = this.stageBounds();
    if (!this.dir) this.dir = 1;
    if (f.x > s.r - 400) this.dir = -1; if (f.x < s.l + 400) this.dir = 1;
    c.x = this.dir * 0.45;
  }
  evadeMode(c) {
    const f = this.f;
    const t = this.m.fighters.find(o => o !== f && !o.dead);
    if (!t) return;
    if (f.grounded && this.threatened(t)) {
      if (this.r() < 0.5) { this.holdFor({ down: ['Z'] }, 10); this.apply(c, this.hold); }
      else { c.down.Z = true; c.x = sign(f.x - t.x) || 1; c.lastNeutralXFrame = c.frame; }
    }
  }
}

function mulberry(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
