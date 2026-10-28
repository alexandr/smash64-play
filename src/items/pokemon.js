// Poké Ball Pokémon (items.md "Poké Ball Pokémon"). Each is an item in state 'monster' owned by the thrower:
// its contact hitbox and projectiles never hurt the thrower (or teammates with team attack off).
// After release a Pokémon rises at vy 16 for 22 frames, then runs its behaviour.
import { POKEMON_DATA } from './data.js';
import { makeView, syncView } from './views.js';
import { itemProjectile } from './defs.js';
import { findLanding, floorY } from '../game/collision.js';

const PD = POKEMON_DATA;
const sign = v => (v > 0 ? 1 : v < 0 ? -1 : 0);
const deg = Math.PI / 180;
export const POKEMON_COMMON = ['onix', 'snorlax', 'goldeen', 'meowth', 'charizard', 'beedrill', 'blastoise', 'chansey', 'starmie', 'hitmonlee', 'koffing', 'clefairy'];
const APPEAR = 22, APPEAR_VY = 16;

const hbOf = (h, o = {}) => ({ damage: h.damage, angle: h.angle, kbg: h.kbg, bkb: h.bkb, fkb: h.fkb, element: h.element === 'coin' ? 'normal' : h.element, shieldDmg: h.shieldDmg, ...o });
function nearestFoe(it, mgr) {
  let best = null, bd = Infinity;
  for (const f of mgr.match.fighters) {
    if (f.dead || f === it.owner || (it.owner && mgr.match.sameTeam(f, it.owner))) continue;
    const d = (f.x - it.x) ** 2 + (f.y - it.y) ** 2;
    if (d < bd) { bd = d; best = f; }
  }
  return best;
}
// simple monster gravity + landing (Pokémon that stand on the stage)
function walkPhysics(it, mgr, g = 2) {
  if (it.mg) {
    if (!it.mg.active) { it.mg = null; return; }
    it.x += (it.mg.dx || 0) + it.vx;
    const y = floorY(it.mg, it.x);
    if (y === null) { it.mg = null; it.vy = 0; return; }
    it.y = y; return;
  }
  it.vy = Math.max(-100, it.vy - g);
  const nx = it.x + it.vx, ny = it.y + it.vy;
  const land = it.vy <= 0 ? findLanding(mgr.match.col, it.x, it.y, nx, ny, false, null) : null;
  if (land) { it.x = land.x; it.y = land.y; it.mg = land.floor; it.vy = 0; return land; }
  it.x = nx; it.y = ny;
}
function contact(it, mgr, r) {
  const c = it.def.pdata.contact;
  if (!c || it.noContact) return null;
  const sc = it.v?.phase === 'fall' ? (it.scale ?? 1) / 4 : 1;   // Snorlax grows to 4x while falling (size 800 at full size)
  return [mgr.entry(it, hbOf(c), it.x, it.cy, r ?? c.r * sc, { px: it.px, py: it.pcy, rehit: 16 })];
}
function shot(mgr, it, o) { return itemProjectile(mgr, it.owner, { collide: false, reflectable: false, absorbable: false, ...o }); }

// ---------- behaviours: (it, mgr, k) where k = frames since the appear phase ended ----------
const B = {
  onix(it, mgr, k) {
    const top = mgr.match.stage.blast.top - 200;
    if (!it.v.up) { it.v.up = true; it.v.x0 = it.x; it.v.rocks = 8 + mgr.randInt(9); it.v.next = 0; }
    if (it.y < top) { it.y = Math.min(top, it.y + 80); it.hidden = false; return; }
    it.hidden = true; it.noContact = true;
    if (k % 18 === 0) mgr.emit('shake', { power: 0.6 });
    if (it.v.rocks > 0 && k >= it.v.next) {
      it.v.rocks--; it.v.next = k + 15 + mgr.randInt(30);
      const p = PD.onix.projectile;
      shot(mgr, it, { x: it.v.x0 + (mgr.rand() * 2000 - 1000), y: it.y, vx: 0, vy: [-100, -50, 0][mgr.randInt(3)], gravity: 2, tvel: 200,
        r: p.r, life: 240, hb: hbOf(p), kind: 'rock', view: 'rock' });
      mgr.sfx('land');
    }
    if (it.v.rocks <= 0 && k >= it.v.next + 60) mgr.remove(it);
  },
  snorlax(it, mgr, k) {
    const top = mgr.match.stage.blast.top - 200;
    if (!it.v.phase) { it.v.phase = 'up'; it.v.x0 = it.x; }
    if (it.v.phase === 'up') { it.y += 80; it.noContact = true; if (it.y >= top) { it.v.phase = 'wait'; it.v.t = 0; it.hidden = true; } return; }
    if (it.v.phase === 'wait') { if (++it.v.t >= 60) { it.v.phase = 'fall'; it.x = it.v.x0 + (mgr.rand() * 2000 - 1000); it.hidden = false; it.noContact = false; it.scale = 1; } return; }
    it.y -= 220; it.scale = Math.min(4, (it.scale ?? 1) + 0.12);
    if (it.y < mgr.match.stage.blast.bottom) mgr.remove(it);
  },
  goldeen(it, mgr, k) {
    it.noContact = true;
    if (k > 360) { mgr.remove(it); return; }
    it.vy -= 6; it.vy = Math.max(-100, it.vy);
    const nx = it.x + it.vx, ny = it.y + it.vy;
    const land = it.vy <= 0 ? findLanding(mgr.match.col, it.x, it.y, nx, ny, false, null) : null;
    if (land) { it.x = land.x; it.y = land.y; it.vy = 60; it.vx = (mgr.randInt(2) ? 10 : -10); it.facing = sign(it.vx); mgr.sfx('land'); }
    else { it.x = nx; it.y = ny; }
  },
  meowth(it, mgr, k) {
    walkPhysics(it, mgr); it.vx = 0;
    if (k > 240) { mgr.remove(it); return; }
    if (k % 8 === 0) {
      it.v.a = (it.v.a ?? 0) + 13;
      const p = PD.meowth.projectile;
      for (let i = 0; i < 4; i++) {
        const a = (it.v.a + i * 90) * deg;
        shot(mgr, it, { x: it.x, y: it.cy, vx: Math.cos(a) * 130, vy: Math.sin(a) * 130, r: p.r, life: 10, hb: hbOf(p), kind: 'coin', view: 'coin' });
      }
      mgr.sfx('item');
    }
  },
  charizard(it, mgr, k) {
    walkPhysics(it, mgr);
    if (k > 480) { mgr.remove(it); return; }
    if (k % 26 === 0) it.facing = k === 0 ? (it.facing || 1) : -it.facing;
    it.vx = it.mg ? it.facing * 4 : 0;
    if (it.mg) { const nx = it.x + it.vx * 6; const p = it.mg.pts; if (nx < p[0][0] || nx > p[p.length - 1][0]) { it.facing = -it.facing; it.vx = 0; } }
    if (k % 8 === 0) {
      const p = PD.charizard.projectile, a = -15 * deg;
      shot(mgr, it, { x: it.x + it.facing * 300, y: it.y + 380, vx: Math.cos(a) * 50 * it.facing, vy: Math.sin(a) * 50, r: p.r, life: 30, pierce: true,
        hb: hbOf(p), kind: 'flame', view: 'flame', facing: it.facing });
      if (k % 24 === 0) mgr.sfx('fire');
    }
  },
  beedrill(it, mgr, k) {
    const b = mgr.match.stage.blast;
    if (!it.v.dir) { it.v.dir = it.x >= 0 ? 1 : -1; it.facing = it.v.dir; it.v.y0 = it.y; }
    if (!it.v.called) {
      it.x += it.v.dir * 60; it.y += 20;
      const edge = it.v.dir > 0 ? b.right : b.left;
      if (Math.abs(edge - it.x) <= 500) { it.v.called = true; it.v.swarm = 16; it.v.next = k; it.hidden = true; it.noContact = true; }
      return;
    }
    if (it.v.swarm > 0 && k >= it.v.next) {
      it.v.swarm--; it.v.next = k + 12 + mgr.randInt(9);
      const p = PD.beedrill.projectile, dir = -it.v.dir;
      const sx = dir > 0 ? b.left + 200 : b.right - 200;
      shot(mgr, it, { x: sx, y: it.v.y0 + (mgr.rand() * 1800 - 800), vx: 130 * dir, vy: 0, r: p.r, life: Math.ceil((b.right - b.left) / 130) + 5,
        pierce: true, hb: hbOf(p), kind: 'bee', view: 'bee', facing: dir });
    }
    if (it.v.swarm <= 0 && k >= it.v.next + 40) mgr.remove(it);
  },
  blastoise(it, mgr, k) {
    walkPhysics(it, mgr, 3);
    if (k === 0) { const t = nearestFoe(it, mgr); if (t) it.facing = sign(t.x - it.x) || it.facing; }
    if (k > 360) { mgr.remove(it); return; }
    const ph = k % 30;
    it.vx = 0;
    if (ph < 20) {                                       // Hydro Pump stream, pushed back 2.3 u/f
      it.vx = -it.facing * 2.3;
      if (ph % 4 === 0) {
        const p = PD.blastoise.projectile;
        shot(mgr, it, { x: it.x + it.facing * 260, y: it.y + 260, vx: it.facing * 70, vy: 0, r: p.r, life: 20, pierce: true,
          hb: hbOf(p), kind: 'water', view: 'water', facing: it.facing });
      }
    }
  },
  chansey(it, mgr, k) {
    it.noContact = true;
    walkPhysics(it, mgr); it.vx = 0;
    it.v.eggs ??= 0; it.v.next ??= 30;
    if (it.v.eggs < 3 && k >= it.v.next) {
      it.v.eggs++; it.v.next = k + 30;
      const e = mgr.spawn('egg', it.x + it.facing * 120, it.y + 150);
      e.vx = it.facing * 6; e.vy = 20;
      mgr.sfx('item');
      if (it.v.eggs === 3) it.v.end = k + 90;
    }
    if (it.v.end && k >= it.v.end) mgr.remove(it);
  },
  starmie(it, mgr, k) {
    if (k > 240) { mgr.remove(it); return; }
    const t = nearestFoe(it, mgr);
    if (t) {
      const side = sign(it.x - t.x) || 1;
      const tx = t.x + side * 400, ty = t.y + 250;
      it.x += (tx - it.x) * 0.06; it.y += (ty - it.y) * 0.06;
      it.facing = -side;
    }
    if (k > 20 && k % 12 === 0) {
      const p = PD.starmie.projectile;
      shot(mgr, it, { x: it.x + it.facing * 150, y: it.cy, vx: it.facing * 150, vy: 0, r: p.r, life: 30, hb: hbOf(p), kind: 'swift', view: 'star', facing: it.facing });
      it.x -= it.facing * 70 * 0.3;
      mgr.sfx('shoot');
    }
  },
  hitmonlee(it, mgr, k) {
    if (k === 0) {
      const t = nearestFoe(it, mgr);
      if (t) { it.x = t.x - (sign(t.x) || 1) * 300; it.y = t.y + 500; it.facing = sign(t.x - it.x) || 1; }
      it.noContact = true;
    }
    if (k < 40) { it.y -= 4; return; }
    if (k === 40) {
      it.noContact = false; mgr.sfx('whiffL');
      const t = nearestFoe(it, mgr);
      const dx = t ? t.x - it.x : it.facing * 1000, dy = t ? t.cy - it.cy : -300, l = Math.hypot(dx, dy) || 1;
      it.v.kx = dx / l * HJK_SPEED; it.v.ky = dy / l * HJK_SPEED; it.facing = sign(dx) || it.facing;
    }
    it.x += it.v.kx; it.y += it.v.ky;                      // High Jump Kick through the target and across the stage
    const b = mgr.match.stage.blast;
    if (k > 600 || it.x < b.left || it.x > b.right || it.y < b.bottom) mgr.remove(it);
  },
  koffing(it, mgr, k) {
    it.y += Math.sin(k * 0.08) * 3;
    it.v.n ??= 32;
    if (it.v.n > 0 && k % 8 === 0) {
      it.v.n--;
      const p = PD.koffing.projectile, a = mgr.rand() * Math.PI * 2;
      shot(mgr, it, { x: it.x + (mgr.rand() * 400 - 200), y: it.cy + (mgr.rand() * 800 - 400), vx: Math.cos(a) * 18, vy: Math.sin(a) * 18,
        r: SMOG_R, life: 30, pierce: true, hb: hbOf(p), kind: 'smog', view: 'smog' });
      if (it.v.n === 0) it.v.end = k + 90;
    }
    if (it.v.end && k >= it.v.end) mgr.remove(it);
  },
  mew(it, mgr, k) {
    it.noContact = true;
    if (k === 0) { it.vx = 8 * (it.facing || 1); it.vy = -20; }
    it.vy += 0.8; it.x += it.vx; it.y += it.vy;
    if (k > 480) mgr.remove(it);
  },
};
// Koffing's Smog: WPAttributes size 50 (radius 25) is far smaller than the drawn cloud; we use the cloud size.
const SMOG_R = 100;
// Hitmonlee's kick: the decomp sets x-vel 400 on a scaled joint; at 400 u/f it would cross the stage in ~10 frames.
const HJK_SPEED = 110;
B.clefairy = (it, mgr, k) => {
  if (k === 0) {
    const pool = ['onix', 'snorlax', 'goldeen', 'meowth', 'charizard', 'beedrill', 'blastoise', 'chansey', 'starmie', 'hitmonlee', 'koffing', 'mew'];
    it.v.copy = pool[mgr.randInt(pool.length)];
    mgr.emit('metronome', { kind: it.v.copy, x: it.x, y: it.y });
  }
  if (['goldeen', 'chansey', 'mew'].includes(it.v.copy)) it.noContact = true;
  return B[it.v.copy](it, mgr, k);
};

const SIZE = { onix: 300, snorlax: 260, goldeen: 110, meowth: 130, charizard: 230, beedrill: 130, blastoise: 200, chansey: 150, starmie: 130,
  hitmonlee: 170, koffing: 140, clefairy: 120, mew: 80 };

function pokeDef(id) {
  return {
    id, name: PD[id].name, pdata: PD[id], data: null, pokemon: true, pickup: false, noLifetime: true, r: SIZE[id], makeView, syncView,
    init(it) { it.state = 'monster'; it.v = {}; it.appear = APPEAR; it.noPhysics = true; it.vy = 0; },
    update(it, mgr) {
      if (it.appear > 0) { it.appear--; it.y += APPEAR_VY; return true; }
      it.k = (it.k ?? -1) + 1;
      B[id](it, mgr, it.k);
      return true;
    },
    hitboxes(it, mgr) { if (it.appear > 0 || it.k == null || it.hidden) return null; return contact(it, mgr); },
  };
}
export const POKEMON_DEFS = Object.fromEntries([...POKEMON_COMMON, 'mew'].map(id => [id, pokeDef(id)]));
