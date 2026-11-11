// Item manager: spawning (Item Switch rules + stage weights), item physics, pickup, throwing, swinging,
// shooting, the Hammer state, containers, explosions, Pokémon, and the hitboxes items present to the match.
// Numbers: reference/spec/items.md / items.json (decomp). Item definitions live in src/items/.
//
// Integration with the engine:
//  - fighter.js calls findPickup/pickup (A near an item), drop (knocked loose on hit), remove (on death);
//    its item moves (build.js COMMON pickup/itemThrow/itemShoot/itemSwing*) call onItemMove(f, move) on
//    start, which swaps in the per-item variant (swing hitboxes from the item data, shooter loops, Hammer).
//  - match.js calls update() once per frame after fighters/projectiles, then activeHitboxes() inside
//    resolveHits: every item hitbox is resolved like a stage hazard (shields, invincibility, KO credit to
//    ownerFighter). Items never stale.
import { findLanding, resolveBody, floorY } from './collision.js';
import { ITEM_DATA, ITEM_KINDS, THROW_TABLE, STAGE_ITEM_WEIGHTS } from '../items/data.js';
import { ITEM_FREQUENCIES, itemEnabled } from '../items/index.js';
import { ITEM_DEFS, EXPLOSION_DEF } from '../items/defs.js';
import { POKEMON_DEFS, POKEMON_COMMON } from '../items/pokemon.js';
import { swingMove, hammerPaths, hammerPose } from '../items/swing.js';

const S = 80;
const sign = v => (v > 0 ? 1 : v < 0 ? -1 : 0);
export const ITEM_MAX = 16;              // ITEM_ALLOC_MAX
export const GROUND_LIFETIME = 1400;     // ITEM_PICKUP_WAIT_DEFAULT
export const BLINK_FRAMES = 180;
export const REHIT = 16;
const THROW_DIR = { f: 'F', b: 'B', u: 'Hi', d: 'Lw' };
const RESUME_HAMMER = new Set(['idle', 'walk', 'turn', 'fall', 'landing', 'squat', 'squatwait', 'squatrv', 'dash', 'run', 'runbrake',
  'runturn', 'jump', 'jumpaerial', 'jumpsquat', 'shield', 'shieldoff', 'tech', 'getup']);

function mulberry(a) {
  return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

export class Item {
  constructor(mgr, def, x, y, o = {}) {
    this.mgr = mgr; this.match = mgr.match; this.def = def; this.id = def.id; this.data = def.data;
    this.x = x; this.y = y; this.vx = 0; this.vy = 0; this.px = x; this.py = y;
    this.state = 'air'; this.ground = null; this.holder = null; this.owner = null;
    this.t = 0; this.groundT = 0; this.timesThrown = 0; this.thrown = false; this.despawnChecked = true;
    this.hit = new Set(); this.hitTimes = new Map(); this.dmgTimes = new Map();
    this.facing = 1; this.spin = 0; this.scale = 1; this.dmgMul = 1; this.throwMul = 1;
    this.ammo = def.data?.ammo ?? 0; this.hp = 0; this.vars = {};
    this.r = def.r ?? 100; this.gravity = def.gravity ?? def.data?.physics?.gravity ?? 1.2; this.tvel = def.tvel ?? def.data?.physics?.terminal_vel ?? 100;
    Object.assign(this, o);
  }
  get cy() { return this.y + this.r; }
  get pcy() { return this.py + this.r; }
}

export class ItemManager {
  constructor(match) {
    this.match = match; this.list = [];
    const rules = match.rules ?? {};
    this.rng = mulberry(rules.itemSeed ?? ((Math.random() * 2 ** 31) | 0));
    this.freq = ITEM_FREQUENCIES.find(x => x.id === rules.items) ?? ITEM_FREQUENCIES[0];
    this.weights = STAGE_ITEM_WEIGHTS[match.stageDef?.id] ?? null;
    this.points = match.stage?.itemSpawns ?? [];
    this.pokemonHistory = [];
    this.enabled = !!(this.freq.wait && this.weights && this.points.length && this.kindWeights(ITEM_KINDS).total > 0);
    this.timer = this.enabled ? this.rollWait() : Infinity;
  }
  rand() { return this.rng(); }
  randInt(n) { return Math.floor(this.rng() * n); }
  emit(type, data) { this.match.emit(type, data); }
  sfx(name, o = {}) { this.match.emit('sfx', { name, ...o }); }

  // ---------- spawning ----------
  rollWait() { const [a, b] = this.freq.wait; return a + this.randInt(b - a); }
  kindWeights(kinds) {
    const w = this.weights ?? ITEM_KINDS.map(() => 10);
    // the Item Switch masks kinds; with items 'off' (manual spawns, training) every kind counts as on
    const r = this.match.rules ?? {}, rr = !r.items || r.items === 'off' ? { ...r, items: 'middle' } : r;
    const list = kinds.map(k => ({ k, w: itemEnabled(rr, k) ? (w[ITEM_KINDS.indexOf(k)] ?? 0) : 0 }));
    return { list, total: list.reduce((s, e) => s + e.w, 0) };
  }
  pickWeighted({ list, total }) {
    let r = this.rand() * total;
    for (const e of list) { if ((r -= e.w) < 0) return e.k; }
    return list[list.length - 1]?.k;
  }
  trySpawn() {
    if (this.list.length >= ITEM_MAX) return null;
    const kind = this.pickWeighted(this.kindWeights(ITEM_KINDS));
    const p = this.points[this.randInt(this.points.length)];
    if (!kind || !p) return null;
    return this.spawn(kind, p[0], p[1], { appear: true });
  }
  // Public: spawn an item (or Pokémon / explosion) at (x, y). opts are copied onto the item.
  spawn(kind, x, y, opts = {}) {
    const def = ITEM_DEFS[kind] ?? POKEMON_DEFS[kind];
    if (!def) throw new Error('unknown item ' + kind);
    const it = new Item(this, def, x, y, opts);
    def.init?.(it, this);
    this.list.push(it);
    if (opts.appear) { it.appearT = 20; this.sfx('item'); this.emit('itemSpawn', { x, y: y + it.r, kind }); }
    return it;
  }
  spawnExplosion(x, y, sched, src, owner) {
    const it = new Item(this, EXPLOSION_DEF, x, y, { sched, kbg: src?.kbg ?? 100, bkb: src?.bkb ?? 40, owner, state: 'explode', r: 0 });
    this.list.push(it);
    this.sfx('explode'); this.emit('explosion', { x, y });
    return it;
  }

  // ---------- per frame ----------
  update() {
    const m = this.match;
    if (this.enabled && m.phase === 'play' && --this.timer <= 0) { this.trySpawn(); this.timer = this.rollWait(); }
    for (const it of this.list.slice()) {
      if (it.dead) continue;
      it.px = it.x; it.py = it.y; it.t++;
      if (it.appearT > 0) it.appearT--;
      if (it.state === 'held') { this.followHolder(it); it.def.heldUpdate?.(it, this); continue; }
      if (it.def.update?.(it, this) === true) { this.blastCheck(it); continue; }
      if (it.dead) continue;
      if (!it.noPhysics) this.physics(it);
      if (it.dead) continue;
      if (it.state === 'ground' && !it.def.noLifetime && !it.noLifetime) {
        it.groundT++;
        it.blink = it.groundT >= GROUND_LIFETIME - BLINK_FRAMES;
        if (it.groundT >= GROUND_LIFETIME) this.vanish(it);
      }
      if (it.thrown) it.spin += 0.35 * sign(it.vx || it.facing);
      this.blastCheck(it);
    }
    this.hitItems();
    for (const f of m.fighters) this.fighterRules(f);
    this.list = this.list.filter(i => !i.dead);
  }
  blastCheck(it) {
    const b = this.match.stage.blast;
    if (it.x < b.left - 200 || it.x > b.right + 200 || it.y < b.bottom - 200 || it.y > b.top + 2000) this.remove(it);
  }

  // Item physics (SSB64 units). y is the item's bottom; collision box ~ r wide, 2r tall.
  physics(it) {
    const col = this.match.col, def = it.def;
    if (it.state === 'ground') {
      const fl = it.ground;
      if (!fl || !fl.active) { it.state = 'air'; it.ground = null; return; }
      const x0 = it.x;
      it.x += (fl.dx || 0);
      if (it.vx) {
        it.x += it.vx;
        if (!it.noFriction) { const d = def.groundFric ?? 2; it.vx = Math.abs(it.vx) <= d ? 0 : it.vx - sign(it.vx) * d; }
      }
      const res = resolveBody(col, x0, it.y + 2, it.x, it.y + 2, it.r * 0.6, it.r * 1.6);
      if (res.hitWall) { it.x = res.x; if (def.onWall?.(it, this, res.hitWall) !== true) it.vx = -it.vx * (def.rebound ?? 0.3); if (it.dead) return; }
      const y = floorY(fl, it.x);
      if (y === null) { it.state = 'air'; it.ground = null; it.vy = 0; def.onLeaveGround?.(it, this); return; }
      it.y = y;
      return;
    }
    if (it.state !== 'air') return;
    it.vy -= it.gravity * (it.gravMul ?? 1);
    if (it.vy < -it.tvel) it.vy = -it.tvel;
    let nx = it.x + it.vx, ny = it.y + it.vy;
    const res = resolveBody(col, it.x, it.y, nx, ny, it.r * 0.6, it.r * 1.6);
    if (res.hitWall) {
      nx = res.x;
      if (def.onWall?.(it, this, res.hitWall) !== true) { it.vx = -it.vx * (def.rebound ?? 0.3); this.surfaceTouch(it); }
      if (it.dead || it.state !== 'air') return;
    }
    if (res.hitCeil) {
      ny = res.y;
      if (def.onCeil?.(it, this) !== true) { it.vy = -Math.abs(it.vy) * 0.3; this.surfaceTouch(it); }
      if (it.dead || it.state !== 'air') return;
    }
    if (it.vy <= 0) {
      const land = findLanding(col, it.x, it.y, nx, ny, false, null);
      if (land) { it.x = land.x; it.y = land.y; this.land(it, land.floor); return; }
    }
    it.x = nx; it.y = ny;
  }
  surfaceTouch(it) { if (it.thrown) it.def.onSurface?.(it, this); }
  land(it, floor) {
    const vy = it.vy, def = it.def;
    if (it.thrown && def.onSurface?.(it, this, floor) === true) return;
    if (def.onLand && def.onLand(it, this, floor, vy) === true) return;
    if (it.dead) return;
    if (vy < -25 && !it.bounced && !def.noBounce) {
      it.vy = -vy * 0.35; it.vx *= 0.6; it.bounced = true; it.y += 1;
      this.endThrow(it, true);
      return;
    }
    this.settle(it, floor);
    this.endThrow(it, true);
  }
  settle(it, floor) { it.state = 'ground'; it.ground = floor; it.vy = 0; it.groundT = 0; it.bounced = false; it.spin = 0; }
  endThrow(it, landed) {
    if (it.thrown) { it.thrown = false; it.hit = new Set(); }
    if (landed && !it.despawnChecked) {
      it.despawnChecked = true;
      if (it.timesThrown >= 4 || this.randInt(4) === 0) this.vanish(it);
    }
  }
  followHolder(it) {
    const f = it.holder;
    if (!f || f.dead || f.item !== it) { it.holder = null; it.state = 'air'; return; }
    it.facing = f.facing;
    if (it.def.heavy) { it.x = f.x; it.y = f.y + f.H * 0.92; }
    else { it.x = f.x + f.facing * f.Wd * 0.9; it.y = f.y + f.H * 0.45 - it.r; }
  }
  vanish(it) { this.remove(it); this.emit('itemVanish', { x: it.x, y: it.cy, kind: it.id }); }
  remove(it) {
    if (!it || it.dead) return;
    it.dead = true;
    const h = it.holder;
    if (h && h.item === it) h.item = null;
    it.holder = null;
    it.def.onRemove?.(it, this, h);
  }

  // ---------- fighters: pickup / throw / drop ----------
  findPickup(f) {
    let best = null, bd = Infinity;
    for (const it of this.list) {
      if (it.dead || it.state !== 'ground' || !it.def.pickup || it.noPickup) continue;
      const dx = it.x - f.x, dy = it.y - f.y;
      if (Math.abs(dx) > f.Wd + it.r + 80 || dy < -100 || dy > f.H * 0.6) continue;
      const d = Math.abs(dx) + Math.abs(dy) * 0.5 + (sign(dx) === f.facing ? 0 : 60);
      if (d < bd) { bd = d; best = it; }
    }
    return best;
  }
  pickup(f, it) {
    if (!it || it.dead || f.item) return;
    const d = it.def;
    if (d.eat) {
      f.percent = Math.max(0, f.percent - d.eat);
      this.sfx('eat'); this.sfx('heal');
      this.emit('heal', { f, amount: d.eat });
      this.remove(it);
      return;
    }
    f.item = it; it.holder = f; it.state = 'held'; it.ground = null; it.owner = f; it.thrown = false;
    it.vx = it.vy = 0; it.groundT = 0; it.blink = false; it.spin = 0;
    d.onPickup?.(it, this, f);
    this.sfx('item');
  }
  // knocked loose by a hit (fighter.takeHit): LightThrowDrop
  drop(f) {
    const it = f.item;
    if (!it || it.def.noDrop) return;
    this.release(f, it, THROW_TABLE.LightThrowDrop, 'LightThrowDrop');
  }
  // itemThrow move release frame (build.js COMMON.itemThrow): vars = { dir: f|b|u|d, smash, dash }
  throwItem(f, vars = {}) {
    const it = f.item; if (!it) return;
    const dir = vars.dir ?? 'f', sm = vars.smash ? '4' : '';
    let key;
    if (it.def.heavy) key = 'HeavyThrow' + (dir === 'b' ? 'B' : 'F') + sm;
    else if (f.grounded) key = vars.dash ? 'LightThrowDash' : 'LightThrow' + THROW_DIR[dir] + sm;
    else key = 'LightThrowAir' + THROW_DIR[dir] + sm;
    const T = THROW_TABLE[key] ?? THROW_TABLE.LightThrowF;
    if (dir === 'b') f.facing = -f.facing;
    this.release(f, it, T, key);
    this.sfx('throw');
  }
  release(f, it, T, key) {
    f.item = null; it.holder = null;
    const v = T.vel * (it.def.data?.velPct ?? 100) / 100;
    const a = T.angle * Math.PI / 180;
    it.facing = f.facing;
    it.vx = Math.cos(a) * v * f.facing; it.vy = Math.sin(a) * v;
    if (it.def.heavy) { it.x = f.x + f.facing * f.Wd * 0.5; it.y = f.y + f.H * 0.9; }
    else { it.x = f.x + f.facing * f.Wd * 0.8; it.y = f.y + f.H * 0.5 - it.r; }
    // keep the release point out of walls
    const res = resolveBody(this.match.col, f.x, it.y, it.x, it.y, it.r * 0.6, it.r * 1.6);
    it.x = res.x;
    it.state = 'air'; it.ground = null; it.thrown = true; it.throwMul = T.dmg; it.timesThrown++;
    it.despawnChecked = false; it.bounced = false; it.owner = f; it.hit = new Set(); it.thrownAt = it.t; it.throwKey = key;
    it.dmgMul = 1;
    it.def.onThrown?.(it, this, f, key);
  }
  // single shot (kept for COMMON.itemShoot's default script)
  shoot(f) { const it = f.item; if (it?.def.fire) it.def.fire(it, this, f, 0); }

  // Hook from build.js COMMON item moves (called from startMove -> onStart)
  onItemMove(f, m) {
    const it = f.item, c = f.ctrl;
    switch (m.id) {
      case 'pickup':
        if (it?.def.id === 'hammer') { this.startHammer(f, it, true); return; }
        if (it?.def.heavy) f.move = { ...m, total: 22 };
        return;
      case 'itemThrow': {
        if (f.grounded && Math.abs(f.vx) >= 30 && !it?.def.heavy && f.vars.dir === 'f') f.vars.dash = true;
        return;
      }
      case 'itemSwingAir': f.throwItem(c); return;            // SSB64 has no aerial swing: A in the air throws
      case 'itemShoot': {
        if (!it?.def.shoot) return;
        f.move = it.def.shootMove(f, it, this, m);
        return;
      }
      case 'itemSwingTilt': case 'itemSwingSmash': case 'itemSwingDash': {
        if (!it?.def.swing) return;
        let type = m.itemSwing;
        if (type === 'tilt') {
          if (c && c.ySmash() && Math.abs(c.y) * S >= 53) { f.throwItem(c); return; }   // up/down smash throws
          if (c && Math.abs(c.x) * S < 20 && Math.abs(c.y) * S < 20) type = 'neutral';
        }
        const mv = swingMove(f.def, it.def.id, type, it.def.data, m);
        mv.script ??= (ff, mf) => ff.match.items.swingScript(ff, mf);
        f.move = mv;
        this.sfx(mv.sfx);
        return;
      }
    }
  }
  swingScript(f, mf) {
    const it = f.item;
    if (!it) { f.dynamicHitboxes = []; return; }
    if (f.move.fireFrame && mf === f.move.fireFrame) it.def.fire?.(it, this, f, f.move.itemSwing);
  }

  // ---------- Hammer ----------
  hammerMove(def) {
    this._hm ??= new Map();
    let mv = this._hm.get(def.id);
    if (!mv) {
      mv = { id: 'hammer', total: 1e9, anim: (f, mf) => hammerPose(f, mf), groundOK: true, keepOnFall: true, walkOff: true,
        keepVel: true, drift: true, noStale: true, hitboxes: [], itemHammer: true,
        script: (f, mf, c) => f.match.items.hammerScript(f, mf, c) };
      this._hm.set(def.id, mv);
    }
    return mv;
  }
  startHammer(f, it, inOnStart) {
    if (it.timer == null) { it.timer = it.def.data.duration_frames; this.emit('itemMusic', { f, track: 'hammer' }); }
    const mv = this.hammerMove(f.def);
    if (inOnStart) { f.move = mv; f.vars = {}; } else f.startMove(mv);
  }
  hammerScript(f, mf, c) {
    const it = f.item;
    if (!it || it.def.id !== 'hammer') { f.dynamicHitboxes = []; f.endMove(); return; }
    const X = c.x * S;
    if (f.grounded) {
      if (Math.abs(X) >= 20 && sign(X) !== f.facing) {
        f.vars.turn = (f.vars.turn ?? 0) + 1; f.vx = 0;
        if (f.vars.turn >= 12) { f.facing = -f.facing; f.vars.turn = 0; }     // HammerTurn: 12 frames
      } else if (Math.abs(X) >= 20) {
        f.vars.turn = 0;
        f.vx = X * f.a.walkMul;
        f.walkPhase = (f.walkPhase ?? 0) + Math.abs(f.vx) / (f.H * 1.1);
      } else { f.vars.turn = 0; f.friction(); }
      if (c.jumpPressed() || f.stickJump(c)) {
        f.grounded = false; f.ground = null; f.y += 1;
        f.vy = 77 * f.a.jmul + f.a.jbase; f.vx = X * f.a.jvx; f.jumpsUsed = f.a.jumps;
        f.emit('jump');
      }
    }
    const hd = it.def.data.hammer;
    const paths = hammerPaths(f.def, hd);
    const fr = (mf - 1) % paths.length;
    if (fr === 0) f.hitVictims = new Map();
    f.dynamicHitboxes = hd.hitboxes.map((h, i) => ({ frames: [mf, mf], pos: paths[fr][i], damage: h.damage, angle: hd.angle, kbg: hd.kbg,
      bkb: hd.bkb, fkb: hd.fkb, size: h.r, element: 'normal', shieldDmg: hd.shieldDmg, group: 0 }));
  }

  // per-fighter item rules applied after the fighter's own update
  fighterRules(f) {
    // Super Star invincibility: tell the music when it runs out
    if (f.starman > 0 && --f.starman === 0) this.emit('itemMusic', { f, track: null });
    const it = f.item;
    if (!it || f.dead) return;
    if (it.def.id === 'hammer') {
      if (f.hitlag <= 0 && it.timer > 0) it.timer--;
      if (it.timer <= 0) {
        this.remove(it);
        if (f.state === 'attack' && f.move?.itemHammer) f.endMove();
        return;
      }
      const resumable = RESUME_HAMMER.has(f.state) || (f.state === 'tumble' && f.hitstun <= 0) || (f.state === 'attack' && !f.move?.itemHammer && f.move?.id === 'pickup');
      if (resumable && f.hitlag <= 0) this.startHammer(f, it, false);
      return;
    }
    // Z/R with an item throws it (no shielding or grabbing while holding an item; Z in the air too)
    if (f.state === 'shield' && f.sf <= 1) { f.throwItem(f.ctrl); return; }
    if (!f.grounded && f.ctrl?.pressed('Z') && f.hitlag <= 0 && ['fall', 'jump', 'jumpaerial'].includes(f.state)) { f.throwItem(f.ctrl); return; }
    if (f.state === 'attack' && f.move?.id === 'grab' && f.mf <= 1) { f.throwItem(f.ctrl); return; }
    // heavy items (crate, barrel): slow walk, no dash/run, no jump (Donkey Kong is exempt)
    if (it.def.heavy && f.def.id !== 'dk') {
      if (f.state === 'dash' || f.state === 'run') f.setState('walk');
      if (f.state === 'walk') { const mx = f.a.walkMul * S * 0.5; if (Math.abs(f.vx) > mx) f.vx = sign(f.vx) * mx; }
      if (f.state === 'jumpsquat') f.setState('idle');
    }
  }

  // ---------- containers ----------
  // Roll a container drop: an item kind, or 'explode'. withExplode=false for crate re-rolls.
  rollContents(withExplode = true) {
    const kw = this.kindWeights(ITEM_KINDS.slice(4));
    if (withExplode) { const xw = Math.max(1, Math.floor(0.1 * kw.total)); kw.list = [...kw.list, { k: 'explode', w: xw }]; kw.total += xw; }
    if (kw.total <= 0) return withExplode ? 'explode' : null;
    return this.pickWeighted(kw);
  }
  // Open a container at its position. Returns true if it exploded.
  openContainer(it, multi) {
    const first = it.forceContents ?? this.rollContents(true);
    const x = it.x, y = it.y + it.r * 0.5;
    this.remove(it);
    if (first === 'explode') {
      this.spawnExplosion(x, y + it.r * 0.5, it.def.data.explosion, it.def.data.thrown, it.owner);
      return true;
    }
    this.emit('containerOpen', { x, y: y + it.r, kind: it.id });
    this.sfx('throw');
    let kinds = [first], vels;
    if (multi) {
      const r = this.randInt(5), n = r <= 1 ? 1 : r === 2 ? 2 : 3;
      const same = this.randInt(32) === 0;
      for (let i = 1; i < n; i++) kinds.push(same ? first : (this.rollContents(false) ?? first));
      vels = n === 1 ? [[0, 48]] : n === 2 ? [[-2, 48], [2, 48]] : [[-5, 48.2], [0, 48.2], [5.2, 48.2]];
    } else vels = [[0, first === 'star' ? 40 : 26]];
    kinds.forEach((k, i) => {
      if (!k) return;
      const c = this.spawn(k, x, y);
      c.vx = vels[i][0]; c.vy = vels[i][1];
      if (k === 'star') c.vx = vels[i][0] || 8 * (sign(-x) || 1);
    });
    return false;
  }

  // ---------- Poké Ball / Pokémon ----------
  pickPokemon() {
    const h = this.pokemonHistory;
    const mewOK = this.match.rules.mew !== false && !h.slice(-2).includes('mew');
    if (mewOK && this.randInt(151) === 0) return 'mew';
    const pool = POKEMON_COMMON.filter(k => !h.slice(-2).includes(k));
    return pool[this.randInt(pool.length)];
  }
  releasePokemon(ball, kind) {
    kind ??= this.pickPokemon();
    this.pokemonHistory.push(kind);
    const p = this.spawn(kind, ball.x, ball.y, { owner: ball.owner, state: 'monster', facing: ball.facing || 1 });
    this.emit('pokemon', { kind, x: ball.x, y: ball.y });
    this.sfx('respawn');
    return p;
  }

  // ---------- hitboxes ----------
  rehitSet(it, n = REHIT) { const m = this.match; return { has: v => m.frame - (it.hitTimes.get(v) ?? -1e9) < n }; }
  // A hitbox entry in the format match.resolveHits expects for hazards
  entry(it, hb, x, y, r, o = {}) {
    const self = this;
    return {
      hb: { angle: 361, kbg: 100, bkb: 0, fkb: 0, element: 'normal', shieldDmg: 0, ...hb }, x, y, px: o.px ?? x, py: o.py ?? y, r,
      owner: o.owner !== undefined ? o.owner : it.owner, ownerFighter: o.ownerFighter !== undefined ? o.ownerFighter : it.owner,
      hitsOwner: !!o.hitsOwner, unblockable: !!o.unblockable, item: it,
      hit: o.hit ?? this.rehitSet(it, o.rehit ?? REHIT),
      onHit(v, shield) { it.hitTimes.set(v, self.match.frame); o.onHit?.(v, shield); },
    };
  }
  // "angle 362" (away from the item): one entry per fighter with the angle aimed away from the item
  awayEntries(it, hb, x, y, r, o = {}) {
    const out = [];
    for (const v of this.match.fighters) {
      if (v.dead) continue;
      const dx = Math.abs(v.x - x), dy = v.cy - y;
      const ang = Math.round(Math.max(-30, Math.min(80, Math.atan2(dy, Math.max(1, dx)) * 180 / Math.PI)));
      const e = this.entry(it, { ...hb, angle: ang }, x, y, r, o);
      const base = e.hit;
      e.hit = { has: w => w !== v || base.has(w) };
      out.push(e);
    }
    return out;
  }
  thrownDamage(it) {
    const th = it.def.data.thrown;
    const speed = Math.hypot(it.vx, it.vy);
    let d = Math.trunc((th.damage + speed * 0.1) * it.throwMul + 0.999);
    if (it.dmgMul !== 1) d = Math.min(100, Math.trunc(d * it.dmgMul + 0.99));
    return d;
  }
  thrownEntry(it) {
    const th = it.def.data.thrown;
    const hb = { damage: this.thrownDamage(it), angle: th.angle === 362 ? 45 : th.angle, kbg: th.kbg, bkb: th.bkb, fkb: th.fkb, element: th.element, shieldDmg: th.shieldDmg };
    return this.entry(it, hb, it.x, it.cy, th.r, { px: it.px, py: it.pcy, hit: it.hit, onHit: (v, sh) => this.thrownHit(it, v, sh) });
  }
  thrownHit(it, v, shield) {
    it.hit.add(v);
    if (it.def.onHitFighter?.(it, this, v, shield) === true) return;
    if (!it.thrown || it.dead) return;
    // rebound off the target and fall without a hitbox
    it.thrown = false;
    it.vx = -sign(it.vx || it.facing) * 8; it.vy = Math.max(20, it.vy * 0.2);
    if (it.state === 'ground') { it.state = 'air'; it.ground = null; it.y += 1; }
  }
  reflectCheck(it) {
    for (const v of this.match.fighters) {
      if (v.dead || v === it.owner || !v.reflectBox || it.def.data?.reflectable === false) continue;
      const b = v.reflectBox(); if (!b) continue;
      if ((it.x - b.x) ** 2 + (it.cy - b.y) ** 2 > (it.def.data.thrown.r + b.r) ** 2) continue;
      it.vx = -it.vx; it.facing = -it.facing; it.owner = v; it.hit = new Set(); it.dmgMul = 1.8;
      this.emit('reflect', { f: v, x: it.x, y: it.cy });
      return;
    }
  }
  activeHitboxes() {
    const out = [];
    for (const it of this.list) {
      if (it.dead || it.state === 'held') continue;
      if (it.thrown && it.def.data?.thrown && !it.def.noThrownHitbox) { this.reflectCheck(it); out.push(this.thrownEntry(it)); }
      const extra = it.def.hitboxes?.(it, this);
      if (extra) for (const e of extra) out.push(e);
    }
    return out;
  }

  // Attacks hitting items (containers, Bob-omb, shells, MS bomb ...): fighters' hitboxes, projectiles,
  // thrown items and explosions. Each attacker can hit an item once every 16 frames.
  hitItems() {
    const targets = this.list.filter(it => !it.dead && it.def.onDamaged && it.state !== 'held' && it.state !== 'explode');
    if (!targets.length) return;
    const atk = [];
    for (const f of this.match.fighters) {
      if (f.dead) continue;
      for (const h of f.activeHitboxes) if (!h.hb.grab) atk.push({ key: f, src: f, x: h.x, y: h.y, px: h.px, py: h.py, r: h.r, dmg: h.hb.damage, ox: f.x });
    }
    for (const p of this.match.projectiles) {
      if (p.dead || !p.hitbox) continue;
      const h = p.worldHitbox();
      atk.push({ key: p, src: p.owner, x: h.x, y: h.y, px: h.px, py: h.py, r: h.r, dmg: h.hb.damage, ox: p.x - p.vx, proj: p });
    }
    for (const it of this.list) {
      if (it.dead) continue;
      if (it.thrown && it.def.data?.thrown) atk.push({ key: it, src: it.owner, x: it.x, y: it.cy, px: it.px, py: it.pcy, r: it.def.data.thrown.r, dmg: this.thrownDamage(it), ox: it.px, item: it });
      if (it.state === 'explode' && it.curR > 0) atk.push({ key: it, src: it.owner, x: it.x, y: it.y, r: it.curR, dmg: it.curDmg, ox: it.x, item: it, explosion: true });
    }
    const fr = this.match.frame;
    for (const t of targets) {
      for (const a of atk) {
        if (a.key === t || a.item === t || t.dead) continue;
        if (fr - (t.dmgTimes.get(a.key) ?? -1e9) < REHIT) continue;
        const cx = t.x, cy = t.cy, R = a.r + t.r;
        const px = a.px ?? a.x, py = a.py ?? a.y;
        if (segPoint2(px, py, a.x, a.y, cx, cy) > R * R) continue;
        t.dmgTimes.set(a.key, fr);
        t.def.onDamaged(t, this, a.dmg, a);
        if (a.item && a.item.thrown && !a.explosion) this.thrownHit(a.item, t, false);
      }
    }
  }
}

function segPoint2(x1, y1, x2, y2, px, py) {
  const dx = x2 - x1, dy = y2 - y1, l = dx * dx + dy * dy;
  let t = l > 1e-9 ? ((px - x1) * dx + (py - y1) * dy) / l : 0;
  t = Math.max(0, Math.min(1, t));
  const ex = x1 + dx * t - px, ey = y1 + dy * t - py;
  return ex * ex + ey * ey;
}
