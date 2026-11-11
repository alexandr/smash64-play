// Congo Jungle — decomp geometry (reference/spec/stages.md): dipped wooden deck (ledges at +-2130), the two
// treetop platforms, the two "ferris wheel" platforms (yakumono 1/2, baked 499 f paths) and the Barrel Cannon
// (grjungle.c / ftcommontarucann.c): sweeps x +3540 -> -3540 -> +3540 at y -1597.5 (cubic ease, 249/250 f),
// spins for 90 f at +-0.07 rad/f after 180..359 f of travel, catches a fighter within |dx|,|dy| < 280,
// fires after 180 f (or A/B + 10 f) with damage 0, KBG 0, BKB 180 at angle 90 + rotation; 16 f re-catch delay.
// Klaptrap is not in the decomp, so there is none.
import { makeStage } from './common.js';
import { buildCongo, syncCongo } from './congo_art.js';
import data from './data/congo_jungle.js';

const BARREL_Y = -1597.5, BARREL_X = 3540, CATCH = 280;
const rand = n => Math.floor(Math.random() * n);

export function barrelX(t) {
  t = ((t % 499) + 499) % 499;
  const ease = u => u * u * (3 - 2 * u);
  return t < 249 ? BARREL_X - 2 * BARREL_X * ease(t / 249) : -BARREL_X + 2 * BARREL_X * ease((t - 249) / 250);
}

export const congo = makeStage(data, {
  id: 'congo', series: 'dk', music: 'congo',
  clearColor: 0x070200,
  options: { ambient: 0.7, sun: 1.3, sunDir: [0.1, 1, 0.8] },
  init(m, st) {
    st.barrel = { x: BARREL_X, y: BARREL_Y, rot: 0, state: 'move', t: 180 + rand(180), dir: 1, held: null, heldT: 0, shootT: 0, cool: new Map(), puff: 0, t0: m.frame };
  },
  update(m, st) {
    const b = st.barrel;
    b.x = barrelX(m.frame - b.t0);
    if (b.puff > 0) b.puff--;
    if (b.state === 'move') { if (--b.t <= 0) { b.state = 'rotate'; b.t = 90; b.dir = Math.random() < 0.5 ? -1 : 1; } }
    else { b.rot += 0.07 * b.dir; if (--b.t <= 0) { b.state = 'move'; b.t = 180 + rand(180); b.rot = 0; } }
    for (const [f, t] of b.cool) { if (t <= 1) b.cool.delete(f); else b.cool.set(f, t - 1); }
    const f = b.held;
    if (f) {
      if (f.dead || f.state !== 'thrown') { b.held = null; }
      else {
        place(f, b); f.intangible = Math.max(f.intangible, 2);
        b.heldT++;
        if (b.shootT > 0) { if (--b.shootT === 0) fire(m, b); }
        else if (b.heldT >= 180) fire(m, b);
        else if (f.ctrl?.pressed?.('A') || f.ctrl?.pressed?.('B')) b.shootT = 10;
      }
      return;
    }
    if (m.phase !== 'play') return;
    for (const v of m.fighters) {
      if (v.dead || b.cool.has(v) || v.state === 'respawn' || v.state === 'thrown' || v.grabbedBy || v.grabbing || v.state === 'ledge') continue;
      if (Math.abs(v.x - b.x) < CATCH && Math.abs(v.y + v.H * 0.4 - b.y) < CATCH) {
        b.held = v; b.heldT = 0; b.shootT = 0;
        v.setState('thrown'); v.grounded = false; v.ground = null;
        v.vx = v.vy = v.kbx = v.kby = 0; v.kbGround = 0; v.fastfall = false;
        place(v, b);
        m.emit('sfx', { name: 'grab' });
        break;
      }
    }
  },
  build(scene, rs, d, st) { return buildCongo(scene, rs, d, st); },
  sync(obj, m, rs, st) { syncCongo(obj, m, rs, st); },
});

function place(f, b) { f.x = b.x; f.y = b.y - f.H * 0.45; }

function fire(m, b) {
  const f = b.held; b.held = null;
  // barrel's up axis rotated by rot (CCW); launch angle 90 + rotation, mirrored for the facing side
  const dx = -Math.sin(b.rot), dy = Math.cos(b.rot);
  const lr = dx < -1e-3 ? -1 : 1;
  const ang = Math.atan2(dy, Math.abs(dx)) * 180 / Math.PI;
  f.x = b.x + dx * 300; f.y = b.y + dy * 300 - f.H * 0.45;
  f.setState('fall'); f.grounded = false; f.ground = null;
  f.takeHit({ damage: 0, angle: ang, kbg: 0, bkb: 180, fkb: 0, element: 'normal', attacker: null, lr, hazard: true });
  b.cool.set(f, 16); b.puff = 20;
  m.emit('sfx', { name: 'explode' });
  m.emit('hit', { f, a: null, x: f.x, y: f.y + f.H * 0.5, dmg: 0, kb: 180, element: 'normal' });
}
