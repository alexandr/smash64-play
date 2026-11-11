// Match simulation: fighters, stage, projectiles, items, hit resolution, KOs, rules.
import { C, HANDICAP } from './constants.js';
import { Fighter, hitlagFrames } from './fighter.js';
import { buildCollision, updateGroups, ledges as findLedges, floorY } from './collision.js';
import { ItemManager } from './items.js';

const sign = v => (v > 0 ? 1 : v < 0 ? -1 : 0);

// squared distance between segments p1-q1 and p2-q2
export function segSegDist2(p1x, p1y, q1x, q1y, p2x, p2y, q2x, q2y) {
  const d1x = q1x - p1x, d1y = q1y - p1y, d2x = q2x - p2x, d2y = q2y - p2y;
  const rx = p1x - p2x, ry = p1y - p2y;
  const a = d1x * d1x + d1y * d1y, e = d2x * d2x + d2y * d2y, f = d2x * rx + d2y * ry;
  let s, t;
  if (a <= 1e-9 && e <= 1e-9) return rx * rx + ry * ry;
  if (a <= 1e-9) { s = 0; t = Math.max(0, Math.min(1, f / e)); }
  else {
    const c = d1x * rx + d1y * ry;
    if (e <= 1e-9) { t = 0; s = Math.max(0, Math.min(1, -c / a)); }
    else {
      const b = d1x * d2x + d1y * d2y, den = a * e - b * b;
      s = den !== 0 ? Math.max(0, Math.min(1, (b * f - c * e) / den)) : 0;
      t = (b * s + f) / e;
      if (t < 0) { t = 0; s = Math.max(0, Math.min(1, -c / a)); }
      else if (t > 1) { t = 1; s = Math.max(0, Math.min(1, (b - c) / a)); }
    }
  }
  const cx = p1x + d1x * s - (p2x + d2x * t), cy = p1y + d1y * s - (p2y + d2y * t);
  return cx * cx + cy * cy;
}

export class Match {
  // cfg: { stage: StageDef, players: [{ def, port, controller, cpu, color, team, handicap }], rules }
  constructor(cfg) {
    this.cfg = cfg;
    this.rules = { mode: 'stock', stocks: 3, time: 0, items: 'off', teamAttack: false, teams: false, damageRatio: 100, handicap: 'off', ...cfg.rules };
    this.frame = 0;
    this.events = [];
    this.stageDef = cfg.stage;
    this.stage = cfg.stage.create(this, cfg);
    this.col = buildCollision(this.stage.collision);
    this.stage.col = this.col;
    this.stage.init?.(this);
    this.ledges = findLedges(this.col);
    this.projectiles = [];
    this.items = new ItemManager(this);
    this.suddenDeath = !!cfg.suddenDeath;
    this.fighters = cfg.players.map((p, i) => {
      const sp = p.spawnPos ?? this.stage.spawns[p.spawn ?? p.port ?? i] ?? this.stage.spawns[i % this.stage.spawns.length];
      const f = new Fighter(this, p.def, { ...p, x: sp[0], y: sp[1], facing: p.facing ?? (sp[0] > 0 ? -1 : 1),
        stocks: this.rules.mode === 'stock' || this.suddenDeath ? (this.suddenDeath ? 1 : (p.stocks ?? this.rules.stocks)) : Infinity,
        percent: this.suddenDeath ? C.SUDDEN_DEATH_PCT : (p.percent ?? 0) });
      this.snapToFloor(f);
      f.setState(cfg.noEntry ? 'idle' : 'entry');
      p.def.init?.(f);
      return f;
    });
    this.timeLeft = this.rules.mode === 'time' && !this.suddenDeath ? this.rules.time * 60 * 60 : (cfg.timeLimit ?? Infinity);
    this.phase = 'countdown';
    this.phaseFrame = 0;
    this.countdown = cfg.noCountdown ? 1 : 3 * 60 + 40;
    this.winner = null;
    this.paused = false;
    this.koOrder = [];
    this.trainingSpeed = 1;
  }
  emit(type, data) { this.events.push({ type, ...data, frame: this.frame }); }
  snapToFloor(f) {
    let best = null;
    for (const fl of this.col.floors) {
      if (!fl.active) continue;
      const y = floorY(fl, f.x);
      if (y !== null && y <= f.y + 60 && (!best || y > best.y)) best = { fl, y };
    }
    if (best) { f.y = best.y; f.ground = best.fl; f.grounded = true; }
    else { f.grounded = false; f.ground = null; }
  }
  kbRatio(atk, vic, hit) {
    let r = (hit?.hazard ? 100 : this.rules.damageRatio) / 100;
    const ha = HANDICAP[(atk?.handicap ?? 9) - 1]?.[0] ?? 1, hd = HANDICAP[(vic.handicap ?? 9) - 1]?.[1] ?? 1;
    r *= (atk?.atkMul ?? ha) * (vic.defMul ?? hd);
    return r;
  }

  update() {
    if (this.paused) return;
    this.frame++; this.phaseFrame++;
    updateGroups(this.col, this.frame);
    if (this.phase === 'countdown') {
      this.countdown--;
      for (const f of this.fighters) if (f.state === 'entry') f.sf++;
      if (this.countdown <= 0) { this.phase = 'play'; this.phaseFrame = 0; this.emit('go'); for (const f of this.fighters) if (f.state === 'entry') f.setState('idle'); }
      else if (this.countdown % 60 === 0 && this.countdown <= 180) this.emit('count', { n: this.countdown / 60 });
      this.stage.update?.(this);
      return;
    }
    if (this.phase === 'game') { if (this.phaseFrame > 150) this.phase = 'over'; return; }
    if (this.phase === 'over') return;
    this.stage.update?.(this);
    for (const f of this.fighters) f.update();
    for (const p of this.projectiles) p.update(this);
    this.projectiles = this.projectiles.filter(p => !p.dead);
    this.items.update();
    this.resolveHits();
    this.checkKOs();
    this.checkPushes();
    if (this.timeLeft !== Infinity && this.phase === 'play') {
      this.timeLeft--;
      if (this.timeLeft <= 0) this.endGame('time');
    }
  }

  hurtables() { return this.fighters.filter(f => !f.dead && f.state !== 'respawn' && !f.untouchable); }
  sameTeam(a, b) { return !!a && !!b && a !== b && this.rules.teams && a.team === b.team; }

  hitOverlap(h, v) {
    const c = v.hurtCapsule();
    const d2 = segSegDist2(h.px ?? h.x, h.py ?? h.y, h.x, h.y, c.x1, c.y1, c.x2, c.y2);
    const R = h.r + c.r;
    return d2 <= R * R;
  }
  shieldOverlap(h, v) {
    const s = this.shieldSphere(v);
    return segSegDist2(h.px ?? h.x, h.py ?? h.y, h.x, h.y, s.x, s.y, s.x, s.y) <= (h.r + s.r) ** 2;
  }
  shieldSphere(v) {
    const k = v.a.shieldFull ? 1 : (0.65 * Math.max(0, v.shieldHP) / C.SHIELD_MAX + 0.35);
    return { x: v.x, y: v.y + v.H * 0.5, r: (v.a.shieldSize ?? 260) * C.SHIELD_RADIUS_K * k * v.scale };
  }
  isShielding(v) { return v.state === 'shield' || v.state === 'shieldstun'; }
  canHit(hb, v) {
    if (hb.ground === false && v.grounded) return false;
    if (hb.air === false && !v.grounded) return false;
    return true;
  }

  resolveHits() {
    const pending = [];
    const vics = this.hurtables();
    // clanks between grounded attacks
    this.resolveClanks();
    for (const a of this.fighters) {
      if (a.dead || !a.activeHitboxes.length) continue;
      for (const v of vics) {
        if (v === a) continue;
        if (this.sameTeam(a, v) && !this.rules.teamAttack) continue;
        if (a.vars?.victim === v && a.move?.throwData) continue;   // throw collateral hitboxes never hit the thrown fighter
        let best = null;
        for (const h of a.activeHitboxes) {
          const hb = h.hb;
          if (h.clanked) continue;
          const set = a.hitVictims.get(h.group);
          if (set && set.has(v)) continue;
          if (hb.grab) {
            if (v.grabbedBy || v.intangible > 0 || a.grabbing || v.state === 'grabbing' && v.grabbing === a) continue;
            if (!v.grounded && !hb.grabAir) continue;
            if (['ledge', 'downwait', 'downbounce', 'thrown', 'grabbed'].includes(v.state)) continue;
            if (this.hitOverlap(h, v) && (!best || h.idx < best.idx)) best = h;
            continue;
          }
          if (!this.canHit(hb, v)) continue;
          if (v.intangible > 0) continue;
          if (this.isShielding(v) && this.shieldOverlap(h, v)) { if (!best || (best.shield && h.idx < best.idx)) best = { ...h, shield: true }; continue; }
          if (this.hitOverlap(h, v) && (!best || best.shield || h.idx < best.idx)) best = h;
        }
        if (best) pending.push({ a, v, h: best });
      }
    }
    for (const p of this.projectiles) {
      if (p.dead || !p.hitbox) continue;
      const h = p.worldHitbox();
      for (const v of vics) {
        if (v === p.owner && !p.hitsOwner) continue;
        if (p.owner && this.sameTeam(p.owner, v) && !this.rules.teamAttack) continue;
        if (p.hit.has(v) || v.intangible > 0) continue;
        if (!this.canHit(h.hb, v)) continue;
        if (v.reflectBox && p.reflectable && this.circleHit(h, v.reflectBox(p))) { p.reflect(v); continue; }
        if (v.absorbBox && p.absorbable && this.circleHit(h, v.absorbBox(p))) { p.absorb(v); continue; }
        if (this.isShielding(v) && this.shieldOverlap(h, v)) { pending.push({ a: p.owner, v, h: { ...h, shield: true }, proj: p }); continue; }
        if (this.hitOverlap(h, v)) pending.push({ a: p.owner, v, h, proj: p });
      }
    }
    for (const hz of [...this.items.activeHitboxes().map(e => (e.fromItem = true, e)), ...(this.stage.hazardHitboxes?.(this) ?? [])]) {
      for (const v of vics) {
        if (hz.owner === v && !hz.hitsOwner) continue;
        if (hz.ownerFighter && this.sameTeam(hz.ownerFighter, v) && !this.rules.teamAttack) continue;
        if (hz.hit?.has(v) || v.intangible > 0) continue;
        if (!this.canHit(hz.hb, v)) continue;
        if (this.isShielding(v) && !hz.unblockable && this.shieldOverlap(hz, v)) { pending.push({ a: hz.ownerFighter ?? null, v, h: { ...hz, shield: true }, hazard: hz }); continue; }
        if (this.hitOverlap(hz, v)) pending.push({ a: hz.ownerFighter ?? null, v, h: hz, hazard: hz });
      }
    }
    // simultaneous grabs: lower port wins
    pending.sort((p, q) => (p.a?.port ?? 9) - (q.a?.port ?? 9));
    for (const { a, v, h, proj, hazard } of pending) {
      const hb = h.hb;
      if (a && !proj && !hazard) {
        if (!a.hitVictims.has(h.group)) a.hitVictims.set(h.group, new Set());
        a.hitVictims.get(h.group).add(v);
      }
      if (proj) proj.onHit(v, !!h.shield);
      if (hazard) hazard.onHit?.(v, !!h.shield);
      if (hb.grab) { if (!v.grabbedBy && !a.grabbing && a.state === 'attack') this.doGrab(a, v); continue; }
      const dmg = this.staledDamage(a, h, hb, proj, hazard);
      const lr = this.launchDir(a, v, h, proj, hazard);
      if (h.shield) {
        v.shieldHP -= dmg + (hb.shieldDmg ?? 0);
        const stun = Math.floor(dmg * C.SHIELD_STUN_MUL + C.SHIELD_STUN_ADD);
        v.shieldStun = stun; v.setState('shieldstun');
        v.vx = lr * stun * C.SHIELD_PUSH_MUL;
        const lag = hitlagFrames(dmg, hb);
        v.hitlag = lag; if (a && !proj && !hazard) a.hitlag = Math.max(a.hitlag, lag);
        this.emit('shieldHit', { f: v, x: h.x, y: h.y, dmg });
        if (v.shieldHP <= 0) v.breakShield();
        continue;
      }
      if (v.invincible > 0) {
        // invincible: the hit registers (hitlag, spark) but no damage or knockback
        const lag = hitlagFrames(dmg, hb);
        if (a && !proj && !hazard) a.hitlag = Math.max(a.hitlag, lag);
        this.emit('hit', { f: v, a, x: (h.x + v.cx) / 2, y: (h.y + v.cy) / 2, dmg: 0, kb: 0, element: 'normal', blocked: true });
        continue;
      }
      if (v.counter && v.counter(a, h)) continue;
      const res = v.takeHit({ ...hb, damage: dmg, attacker: a, lr, hazard: !!hazard && !hazard.fromItem });
      if (a && !proj && !hazard) {
        a.hitlag = Math.max(a.hitlag, hitlagFrames(dmg, hb, a));
        a.onHitConfirm?.(v, hb); a.move?.onHit?.(a, v, hb);
      }
      if (a && v !== a) this.recordStale(a, proj ? { id: proj.moveId } : h.move, proj);
      if (proj) proj.onConnect?.(v);
      this.emit('hit', { f: v, a, x: (h.x + v.cx) / 2, y: (h.y + v.cy) / 2, dmg, kb: res.kb, element: hb.element, hb });
    }
  }
  resolveClanks() {
    const fs = this.fighters.filter(f => !f.dead && f.activeHitboxes.length);
    for (let i = 0; i < fs.length; i++) for (let j = i + 1; j < fs.length; j++) {
      const A = fs[i], B = fs[j];
      if (this.sameTeam(A, B) && !this.rules.teamAttack) continue;
      for (const ha of A.activeHitboxes) for (const hb of B.activeHitboxes) {
        if (ha.hb.grab || hb.hb.grab || ha.clanked || hb.clanked) continue;
        const d2 = segSegDist2(ha.px, ha.py, ha.x, ha.y, hb.px, hb.py, hb.x, hb.y);
        if (d2 > (ha.r + hb.r) ** 2) continue;
        const aLoses = ha.hb.damage - 10 < hb.hb.damage, bLoses = hb.hb.damage - 10 < ha.hb.damage;
        this.emit('clank', { x: (ha.x + hb.x) / 2, y: (ha.y + hb.y) / 2 });
        if (aLoses) this.rebound(A, ha.hb);
        if (bLoses) this.rebound(B, hb.hb);
        return;
      }
    }
  }
  rebound(f, hb) {
    for (const h of f.activeHitboxes) h.clanked = true;
    f.dynamicHitboxes = [];          // hitbox removed for the rest of the move
    if (f.grounded && hb.clank !== false) {
      f.setState('rebound'); f.reboundLag = Math.floor(hb.damage * C.SHIELD_STUN_MUL + C.SHIELD_STUN_ADD);
    }
  }
  circleHit(h, b) { return (h.x - b.x) ** 2 + (h.y - b.y) ** 2 <= (h.r + b.r) ** 2; }

  staledDamage(a, h, hb, proj, hazard) {
    let d = hb.damage;
    if (hazard || hb.noStale) return d;
    const m = proj ? (proj.staleMul ?? 1) : (a?.staleMul ?? 1);
    if (m !== 1) d = Math.floor(d * m + 0.999);
    return d;
  }
  // stale queue: pushed once per use of a move when it connects with another player
  recordStale(a, move, proj) {
    const id = move?.id; if (!id || move.noStale) return;
    const use = proj ? proj.use : a.moveUse;
    const q = a.stale, last = q[q.length - 1];
    if (last && last.id === id && last.use === use) return;
    q.push({ id, use }); if (q.length > 5) q.shift();
  }

  launchDir(a, v, h, proj, hazard) {
    if (proj && Math.abs(proj.vx) >= 5) return sign(proj.vx);
    const src = proj ?? hazard ?? a;
    const sx = src ? (src.x ?? h.x) : h.x;
    if (h.hb.reverse) return -(a?.facing ?? 1);
    return sign(v.x - sx) || (a ? a.facing : 1);
  }

  doGrab(a, v) {
    a.grabbing = v; v.grabbedBy = a;
    if (v.grabbing) v.releaseGrab();
    if (v.ledge) v.leaveLedge();
    v.setState('grabbed'); v.grounded = a.grounded; v.ground = a.ground;
    v.vx = v.vy = v.kbx = v.kby = 0; v.kbGround = 0;
    const fromShield = a.vars?.fromShield;
    a.setState('grabbing'); a.vars = { fromShield }; a.vx = 0;
    a.onGrab?.(v);
    this.emit('grab', { f: a, v });
  }

  checkPushes() {
    const fs = this.fighters.filter(f => !f.dead && f.grounded && !['grabbed', 'grabbing', 'thrown', 'respawn'].includes(f.state));
    for (let i = 0; i < fs.length; i++) for (let j = i + 1; j < fs.length; j++) {
      const a = fs[i], b = fs[j];
      if (a.ground !== b.ground) continue;
      const d = b.x - a.x, minD = (a.a.width + b.a.width) * 0.9;
      if (Math.abs(d) < minD) {
        const push = Math.min(6, (minD - Math.abs(d)) * 0.1) * (sign(d) || 1);
        a.x -= push; b.x += push;
      }
    }
  }

  checkKOs() {
    const bz = this.stage.blast;
    for (const f of this.fighters) {
      if (f.dead || f.state === 'respawn') continue;
      const b = f.teamBlast ?? bz;
      const out = f.x < b.left ? 'left' : f.x > b.right ? 'right' : f.y > b.top ? 'top' : f.y < b.bottom ? 'bottom' : null;
      if (out) this.ko(f, out);
    }
  }
  ko(f, side) {
    const credit = f.lastAttacker && f.lastAttacker !== f ? f.lastAttacker : null;
    const star = side === 'top' ? (Math.random() < 5 / 6 ? 'star' : 'screen') : null;
    const kx = f.x, ky = f.y;
    f.die(side, star);
    f.koSide = side; f.koX = kx; f.koY = ky; f.koKind = star;
    this.emit('ko', { f, side, x: kx, y: ky, by: credit, star });
    if (credit) { credit.stats.kos++; f.stats.koBy.push(credit.port); }
    else f.stats.sds++;
    f.stats.falls++;
    if (this.rules.mode === 'stock' || this.suddenDeath || f.stocks !== Infinity) {
      f.stocks--;
      if (f.stocks <= 0) { f.eliminated = true; this.koOrder.push(f); }
      const alive = this.fighters.filter(x => !x.eliminated);
      const sides = new Set(alive.map(x => this.rules.teams ? x.team : x.port));
      if (this.fighters.length > 1 && sides.size <= 1) this.endGame('stock');
      if (this.fighters.length === 1 && f.eliminated) this.endGame('stock');
    }
    this.onKO?.(f, side, credit);
  }
  endGame(reason) {
    if (this.phase === 'game' || this.phase === 'over') return;
    this.phase = 'game'; this.phaseFrame = 0; this.endReason = reason;
    this.emit('game', { reason });
  }
  // time: score = KOs - falls (SD = -1 only); stock: survivors then elimination order
  standings() {
    const fs = this.fighters;
    if (this.rules.mode === 'time' && !this.suddenDeath) return [...fs].sort((a, b) => (b.stats.kos - b.stats.falls) - (a.stats.kos - a.stats.falls));
    return [...fs].sort((a, b) => (b.eliminated ? 0 : 1) - (a.eliminated ? 0 : 1) || (b.stocks - a.stocks) || (this.koOrder.indexOf(b) - this.koOrder.indexOf(a)));
  }
  spawnProjectile(p) { this.projectiles.push(p); return p; }
}
