// Common item definitions (behaviour). Numbers come from ./data.js (decomp, reference/spec/items.json).
// Hooks a definition may provide (all optional; `mgr` is the ItemManager, see src/game/items.js):
//   init(it, mgr), update(it, mgr) -> true to skip generic physics, heldUpdate(it, mgr)
//   onSurface(it, mgr, floor?) -> true   thrown item touched floor/wall/ceiling (floor given on landing)
//   onLand(it, mgr, floor, vy) -> true   any landing;  onWall(it, mgr, dir) -> true;  onCeil(it, mgr) -> true
//   onThrown(it, mgr, f, throwKey);  onHitFighter(it, mgr, victim, shield) -> true (victim may be an item)
//   onDamaged(it, mgr, dmg, attack);  hitboxes(it, mgr) -> [hazard entries];  onPickup(it, mgr, f)
//   fire(it, mgr, f, swingType)  (shooters / Star Rod);  shootMove(f, it, mgr, baseMove) -> move
// Flags: pickup, eat (heal %), heavy, swing (battering), shoot, noDrop, noBounce, noLifetime, gripAxis, r.
import { ITEM_DATA } from './data.js';
import { Projectile } from '../game/projectile.js';
import { makeView, syncView, projView } from './views.js';
import { HAMMER_AXIS } from './swing.js';

const D = ITEM_DATA;
const sign = v => (v > 0 ? 1 : v < 0 ? -1 : 0);
const deg = Math.PI / 180;

function def(id, o = {}) {
  const data = D[id];
  return { id, name: data.name.replace(/ \(.*\)$/, ''), data, pickup: true, heavy: !!data.heavy, r: 100, makeView, syncView, ...o };
}
const hbOf = (h, o = {}) => ({ damage: h.damage, angle: h.angle, kbg: h.kbg, bkb: h.bkb, fkb: h.fkb, element: h.element, shieldDmg: h.shieldDmg, ...o });
function explode(it, mgr) {
  if (it.dead) return;
  mgr.remove(it);
  mgr.spawnExplosion(it.x, it.cy, it.def.data.explosion, it.def.data.thrown, it.owner);
}
// item-fired projectile (never stales, KO credit to the shooter)
export function itemProjectile(mgr, owner, o) {
  const p = new Projectile(mgr.match, owner, { staleMul: 1, ...o });
  p.moveId = null;
  if (o.view) { p.makeView = scene => projView(scene, o.view, p); p.updateView = (v, fr) => v.userData.anim?.(v, p, fr); }
  mgr.match.spawnProjectile(p);
  return p;
}

// ---------- containers ----------
const crate = def('crate', {
  r: 150, noBounce: true,
  onSurface(it, mgr) { mgr.openContainer(it, true); return true; },
  onHitFighter(it, mgr) { mgr.openContainer(it, true); return true; },
  onDamaged(it, mgr, dmg) { if (it.thrown) return; it.hp += dmg; if (it.hp >= 15) mgr.openContainer(it, true); },   // ITBOX_HEALTH_MAX
});
const barrel = def('barrel', {
  r: 140, noBounce: true,
  onSurface(it, mgr, floor) {
    if (floor && Math.abs(it.vy) < 30 && !it.rolling) {            // lands softly: rolls (ITTARU roll)
      mgr.settle(it, floor); it.rolling = true; it.rollT = it.def.data.physics.roll_lifetime; it.vx *= 1.4;
      it.noFriction = true; it.noPickup = true; it.thrown = true; it.despawnChecked = true;
      return true;
    }
    if (floor && it.rolling) { mgr.settle(it, floor); it.thrown = true; return true; }
    mgr.openContainer(it, false); return true;
  },
  onWall(it, mgr) { if (it.thrown || it.rolling) { mgr.openContainer(it, false); return true; } },
  update(it, mgr) {
    if (!it.rolling) return;
    it.spin -= it.vx / 140;
    it.blink = it.rollT <= 60;
    if (--it.rollT <= 0) mgr.openContainer(it, false);
  },
  onHitFighter(it, mgr) { mgr.openContainer(it, false); return true; },
  onDamaged(it, mgr, dmg) { it.hp += dmg; if (it.hp >= 10) mgr.openContainer(it, false); },            // ITTARU_HEALTH_MAX
});
const lightContainer = id => def(id, {
  r: id === 'egg' ? 75 : 60, noBounce: true,
  onSurface(it, mgr) { mgr.openContainer(it, false); return true; },
  onHitFighter(it, mgr) { mgr.openContainer(it, false); return true; },
  onDamaged(it, mgr) { mgr.openContainer(it, false); },
});

// ---------- recovery / touch ----------
const maxim_tomato = def('maxim_tomato', { r: 70, eat: D.maxim_tomato.heal });
const heart_container = def('heart_container', { r: 80, eat: D.heart_container.heal });
const star = def('star', {
  r: 80, pickup: false, noLifetime: true,
  init(it) { it.vx = it.vx || D.star.physics.vel_x * (it.x > 0 ? -1 : 1); },
  onLand(it, mgr, floor) { it.vy = D.star.physics.bounce_vy; it.y = floorYAt(floor, it.x) + 1; return true; },
  onWall(it) { it.vx = -it.vx; return true; },                       // rebound 1.0
  update(it, mgr) {
    if (it.t > 3600) { mgr.vanish(it); return true; }
    if (it.t < 16) return;                                            // tangible after 16 frames
    for (const f of mgr.match.fighters) {
      if (f.dead || f.state === 'respawn') continue;
      const c = f.hurtCapsule();
      const dx = it.x - f.x, dy = it.cy - Math.max(c.y1, Math.min(c.y2, it.cy));
      if (dx * dx + dy * dy <= (it.r + c.r) ** 2) {
        f.invincible = Math.max(f.invincible, D.star.invincible_frames);
        f.starman = D.star.invincible_frames;
        mgr.emit('itemMusic', { f, track: 'star' }); mgr.sfx('star');
        mgr.remove(it);
        return true;
      }
    }
  },
});
function floorYAt(fl, x) { const p = fl.pts; for (let i = 0; i < p.length - 1; i++) if (x >= p[i][0] && x <= p[i + 1][0]) return p[i][1] + (p[i + 1][1] - p[i][1]) * (x - p[i][0]) / Math.max(1e-6, p[i + 1][0] - p[i][0]); return p[0][1]; }

// ---------- battering ----------
const beam_sword = def('beam_sword', { r: 50, swing: true });
const home_run_bat = def('home_run_bat', { r: 50, swing: true });
const fan = def('fan', { r: 50, swing: true });
const star_rod = def('star_rod', {
  r: 50, swing: true,
  fire(it, mgr, f, type) {
    if (type !== 'tilt' && type !== 'smash') return;
    if (it.ammo <= 0) { mgr.sfx('shoot', { empty: true }); return; }
    it.ammo--;
    const S = D.star_rod.stars, big = type === 'smash';
    const h = big ? S.smash : S.tilt;
    itemProjectile(mgr, f, { x: f.x + f.facing * (f.Wd + 120), y: f.y + f.H * 0.55, vx: (big ? S.smashVel : S.tiltVel) * f.facing, vy: 0,
      r: h.r, life: S.life, collide: false, kind: 'starRodStar', hb: hbOf(h), facing: f.facing, view: big ? 'starBig' : 'star' });
    mgr.sfx('shoot');
  },
});

// ---------- shooters ----------
const ray_gun = def('ray_gun', {
  r: 50, shoot: true,
  shootMove(f, it, mgr, base) {
    return { ...base, total: 20, script: (ff, mf) => { if (mf === 4 && ff.item === it) it.def.fire(it, mgr, ff); } };
  },
  fire(it, mgr, f) {
    if (it.ammo <= 0) { mgr.emit('itemSmoke', { x: f.x + f.facing * (f.Wd + 80), y: f.y + f.H * 0.5 }); mgr.sfx('shoot', { empty: true }); return; }
    it.ammo--;
    const P = D.ray_gun.projectile;
    itemProjectile(mgr, f, { x: f.x + f.facing * (f.Wd + 60), y: f.y + f.H * 0.5, vx: P.vel_x * f.facing, vy: 0, r: P.r, life: 30,
      kind: 'laser', hb: hbOf(P), facing: f.facing, view: 'laser' });
    mgr.sfx('laser');
  },
});
const fire_flower = def('fire_flower', {
  r: 60, shoot: true,
  // hold A: a flame every 8 frames (first costs 2 ammo); 20-frame lag after release
  shootMove(f, it, mgr, base) {
    return { ...base, total: 1e9, script: (ff, mf, c) => {
      const v = ff.vars;
      if (v.endAt) { if (mf >= v.endAt) ff.endMove(); return; }
      if (ff.item !== it) { v.endAt = mf + 20; return; }
      if (mf >= 4 && (mf - 4) % 8 === 0) {
        if ((mf > 4 && !c.held('A')) || it.ammo <= 0) { v.endAt = mf + 20; if (it.ammo <= 0) mgr.sfx('shoot', { empty: true }); return; }
        it.def.fire(it, mgr, ff, mf === 4 ? 2 : 1);
      }
    } };
  },
  fire(it, mgr, f, cost = 1) {
    if (it.ammo <= 0) return;
    it.ammo = Math.max(0, it.ammo - cost);
    const P = D.fire_flower.projectile;
    const a = P.spread_angles_deg[(it.vars.flame = ((it.vars.flame ?? -1) + 1) % 5)] * deg;
    itemProjectile(mgr, f, { x: f.x + f.facing * (f.Wd + 70), y: f.y + f.H * 0.5, vx: Math.cos(a) * P.vel * f.facing, vy: Math.sin(a) * P.vel,
      r: P.r, life: P.lifetime_frames, collide: false, pierce: true, kind: 'flame', hb: hbOf(P), facing: f.facing, view: 'flame' });
    mgr.sfx('fire');
  },
});

// ---------- Hammer (state handled by the manager) ----------
const hammer = def('hammer', {
  r: 60, noDrop: true, gripAxis: HAMMER_AXIS,
  onRemove(it, mgr, holder) { if (it.timer != null) mgr.emit('itemMusic', { f: holder ?? it.owner, track: null }); },
});

// ---------- throwing ----------
const motion_sensor_bomb = def('motion_sensor_bomb', {
  r: 30, noBounce: true,
  stick(it, mgr, floor) {
    it.thrown = false; it.stuck = true; it.noPickup = true; it.noLifetime = true; it.armT = D.motion_sensor_bomb.physics.detect_delay;
    if (floor) mgr.settle(it, floor); else { it.state = 'stuck'; it.vx = it.vy = 0; }
    mgr.sfx('ledge');
  },
  onSurface(it, mgr, floor) { it.def.stick(it, mgr, floor); return true; },
  onWall(it, mgr) { if (it.thrown) { it.def.stick(it, mgr, null); return true; } },
  onCeil(it, mgr) { if (it.thrown) { it.def.stick(it, mgr, null); return true; } },
  update(it, mgr) {
    if (!it.stuck) return;
    if (it.armT > 0) { it.armT--; return it.state === 'stuck'; }
    const R2 = D.motion_sensor_bomb.physics.detect_radius ** 2;
    for (const f of mgr.match.fighters) {
      if (f.dead || f.state === 'respawn') continue;
      if ((f.x - it.x) ** 2 + (f.cy - it.cy) ** 2 < R2) { explode(it, mgr); return true; }
    }
    return it.state === 'stuck';
  },
  onHitFighter(it, mgr) { explode(it, mgr); return true; },
  onDamaged(it, mgr) { if (it.stuck) explode(it, mgr); },
});
const BOB_WALK = 10;   // spec raw value 24 (ITBOMBHEI_WALK_VEL_X, flagged "verify visually"); SSB64 footage walks ~ this slow
const bob_omb = def('bob_omb', {
  r: 75, noBounce: true, noLifetime: true,
  onSurface(it, mgr) { explode(it, mgr); return true; },
  onHitFighter(it, mgr) { explode(it, mgr); return true; },
  onDamaged(it, mgr) { explode(it, mgr); },
  onPickup(it) { it.walking = false; it.vx = 0; },
  update(it, mgr) {
    if (it.state !== 'ground' && !it.walking) return;
    it.lieT = (it.lieT ?? 0) + 1;
    const P = D.bob_omb.physics;
    if (it.lieT >= P.walk_wait && !it.walking && it.state === 'ground') {
      it.walking = true; it.noFriction = true; it.facing = mgr.randInt(2) ? 1 : -1; it.vx = BOB_WALK * it.facing;
    }
    if (it.walking && it.state === 'ground') {
      const nx = it.x + it.vx * 4;
      const p = it.ground.pts;
      if (nx < p[0][0] || nx > p[p.length - 1][0]) { it.vx = -it.vx; it.facing = sign(it.vx); }
    }
    it.blink = it.lieT >= P.flash_wait && (it.t >> 2) % 2 === 0;
    if (it.lieT >= P.flash_wait + P.explode_after_flash) explode(it, mgr);
  },
  onWall(it) { if (it.walking) { it.vx = -it.vx; it.facing = sign(it.vx); return true; } },
  hitboxes(it, mgr) {
    if (!it.walking || it.state === 'held') return null;
    return [mgr.entry(it, hbOf(D.bob_omb.thrown), it.x, it.cy, it.r, { owner: null, onHit: () => explode(it, mgr) })];
  },
});
const bumper = def('bumper', {
  r: 100, noBounce: true,
  onThrown(it) { it.gravity = D.bumper.physics.gravity; it.placed = false; },
  onSurface(it, mgr, floor) {
    if (!floor) { it.vx = -it.vx * D.bumper.physics.rebound; return true; }
    mgr.settle(it, floor); it.vx = 0; it.thrown = false; it.placed = true; it.placedT = 0; it.noPickup = true; it.noLifetime = true;
    it.despawnChecked = true;
    return true;
  },
  onHitFighter(it, mgr, v) {
    if (it.placed) return true;
    it.vx = -sign(it.vx || it.facing) * 20; it.vy = 20; it.gravity = D.bumper.physics.gravity_after_hit;  // rebounds off the target
    return true;
  },
  update(it, mgr) {
    if (!it.placed) return;
    it.placedT++;
    if (it.pulse > 0) it.pulse--;
    const P = D.bumper.physics;
    it.blink = it.placedT > P.lifetime && (it.t >> 1) % 2 === 0;
    if (it.placedT > P.lifetime + P.despawn_timer) mgr.vanish(it);
  },
  hitboxes(it, mgr) {
    if (!it.placed || it.placedT > D.bumper.physics.lifetime) return null;
    const hb = hbOf(D.bumper.thrown);
    return mgr.awayEntries(it, hb, it.x, it.cy, it.r, {
      owner: it.placedT < 16 ? it.owner : null, ownerFighter: null, rehit: 16,
      onHit: (v) => { it.pulse = 8; it.recoil = sign(it.x - v.x) * 100; mgr.sfx('bump'); },
    });
  },
});

// shells: thrown or hit, they slide; green goes straight, red homes on the nearest fighter
function shellDef(id, red) {
  const P = D[id].physics;
  const clamp = P.clamp_vel_x, immune = red ? 16 : 32;
  const startSlide = (it, vx) => {
    it.sliding = true; it.noFriction = true; it.noPickup = true; it.noLifetime = true; it.thrown = false; it.despawnChecked = true;
    it.vx = Math.max(-clamp, Math.min(clamp, vx)); it.slideT = P.lifetime; it.slideStart = it.t;
  };
  const stop = it => { it.sliding = false; it.noFriction = false; it.noPickup = false; it.noLifetime = false; it.groundT = 0; };
  return def(id, {
    r: 80, noBounce: true,
    init(it) { it.hp = P.health; it.interact = P.interact_max ?? 99; },
    onSurface(it, mgr, floor) {
      if (!floor) return false;
      mgr.settle(it, floor);
      if (Math.abs(it.vx) >= 12) startSlide(it, it.vx); else { it.thrown = false; it.vx = 0; }
      return true;
    },
    onLand(it, mgr, floor) { if (it.sliding) { mgr.settle(it, floor); return true; } },
    onWall(it) { if (it.sliding) { it.vx = -it.vx; return true; } },
    onPickup(it) { stop(it); },
    onDamaged(it, mgr, dmg, a) {
      const dir = sign(it.x - (a.ox ?? it.x)) || 1;
      if (it.sliding) it.vx = Math.max(-clamp, Math.min(clamp, it.vx + 3 * dmg * dir));
      else { if (it.state === 'air') return; startSlide(it, 8 * dmg * dir); }
      it.owner = a.src?.port !== undefined ? a.src : it.owner; it.slideStart = it.t;
      mgr.sfx('hitS');
    },
    update(it, mgr) {
      if (!it.sliding) return;
      it.spin += it.vx / 60;
      if (--it.slideT <= 0) { mgr.vanish(it); return true; }
      if (red && it.state === 'ground') {
        let tgt = null, bd = Infinity;
        for (const f of mgr.match.fighters) {
          if (f.dead || f === it.owner || mgr.match.sameTeam(f, it.owner)) continue;
          const d = (f.x - it.x) ** 2 + (f.y - it.y) ** 2;
          if (d < bd) { bd = d; tgt = f; }
        }
        if (tgt) {
          const d = sign(tgt.x - it.x);
          if (d === sign(it.vx)) it.vx = d * Math.min(clamp, Math.max(12, Math.abs(it.vx) * 1.2));
          else if (d) it.vx -= sign(it.vx) * 6;
        }
      }
      if (it.state === 'ground' && Math.abs(it.vx) < 12 && !red) { stop(it); it.vx = 0; }
    },
    hitboxes(it, mgr) {
      if (!it.sliding || Math.abs(it.vx) < 1) return null;
      const th = D[id].thrown;
      return [mgr.entry(it, hbOf(th, { damage: th.damage }), it.x, it.cy, th.r, {
        px: it.px, py: it.pcy, owner: it.t - it.slideStart < immune ? it.owner : null, rehit: 16,
        onHit: () => {
          it.hp--; it.interact--;
          it.vx = it.vx * -0.125; it.vy = 38; it.state = 'air'; it.ground = null; it.y += 1;
          if (it.hp <= 0 || it.interact <= 0) mgr.vanish(it);
        },
      })];
    },
  });
}
const green_shell = shellDef('green_shell', false);
const red_shell = shellDef('red_shell', true);

const poke_ball = def('poke_ball', {
  r: 55, noBounce: true,
  open(it, mgr, floor) {
    if (it.opened) return;
    it.opened = true; it.thrown = false; it.noPickup = true; it.noLifetime = true; it.openT = 30; it.despawnChecked = true;
    if (floor) { mgr.settle(it, floor); it.vx = 0; } else { it.vx *= 0.2; }
    mgr.sfx('item');
  },
  onSurface(it, mgr, floor) { it.def.open(it, mgr, floor); return true; },
  onHitFighter(it, mgr) { it.vx = -sign(it.vx) * 4; it.vy = 10; it.def.open(it, mgr, null); return true; },
  onLand(it, mgr, floor) { if (it.opened) { mgr.settle(it, floor); it.vx = 0; return true; } },
  update(it, mgr) {
    if (!it.opened) return;
    if (--it.openT <= 0) { mgr.releasePokemon(it); mgr.remove(it); return true; }
  },
});

// ---------- explosion (spawned by containers / bombs) ----------
export const EXPLOSION_DEF = {
  id: 'explosion', name: 'Explosion', data: null, pickup: false, noLifetime: true, makeView, syncView,
  update(it, mgr) {
    const f = it.t - 1, ev = it.sched;
    let cur = null;
    for (const e of ev) if (e.frame <= f) cur = e;
    const last = ev[ev.length - 1];
    if (f >= last.frame) { it.curR = 0; it.curDmg = 0; } else { it.curR = cur.r; it.curDmg = cur.damage; }
    it.maxR ??= ev[0].r;
    if (f >= last.frame + 12) mgr.remove(it);
    return true;
  },
  hitboxes(it, mgr) {
    if (!(it.curR > 0)) return null;
    return [mgr.entry(it, { damage: it.curDmg, angle: 361, kbg: it.kbg, bkb: it.bkb, fkb: 0, element: 'fire' }, it.x, it.y, it.curR,
      { owner: null, hitsOwner: true, hit: it.hit, onHit: v => it.hit.add(v) })];
  },
};

export const ITEM_DEFS = {
  crate, barrel, capsule: lightContainer('capsule'), egg: lightContainer('egg'),
  maxim_tomato, heart_container, star, beam_sword, home_run_bat, fan, star_rod, ray_gun, fire_flower, hammer,
  motion_sensor_bomb, bob_omb, bumper, green_shell, red_shell, poke_ball,
};
