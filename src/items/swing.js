// Battering-item swings and the Hammer state as engine moves.
//
// The swing hitbox data (damage / radius / offset along the held item) is shared by every fighter
// (decomp 201_FTCommonMoveset.c). We place each hitbox per frame by forward kinematics: the item hangs from
// the fighter's right hand along GRIP_AXIS (hand-local), exactly like the renderer attaches the item mesh,
// so hitboxes follow what is drawn. Active frames are Mario's (items.md), scaled by the item's swing
// animation speed (Fan 200%, Bat smash 75%).
import * as THREE from 'three';
import { makeSkeleton, applyPose } from '../render/rig.js';
import { sampleMove, P, walkPose } from '../render/anims.js';

// Item axis in the hand's local frame (limbs extend along -y; +z is "out of the fist")
export const GRIP_AXIS = new THREE.Vector3(0, -0.7071, 0.7071);
export const HAMMER_AXIS = new THREE.Vector3(0, -0.35, 0.94).normalize();

// swing animation speed (%), order neutral, tilt, smash, dash (dFTCommonDataItemSwingAnimSpeeds)
const SPEED = { beam_sword: [1, 1, 1, 1], home_run_bat: [1, 1, 0.75, 1], fan: [2, 2, 2, 1], star_rod: [1, 1, 1, 1] };
const TYPES = ['neutral', 'tilt', 'smash', 'dash'];
// recovery after the last active frame (animation frames; estimated, SSB64 swing animations are ~30-45 f)
const RECOVERY = { neutral: 14, tilt: 16, smash: 20, dash: 12 };

// Swing poses (right arm holds the item)
export const SWING_ANIMS = {
  neutral: { wind: { upperArmR: [-2.9, 0, -0.15], foreArmR: [-0.5, 0, 0], spine: [-0.15, 0.2, 0] },
    strike: { upperArmR: [-1.1, 0, 0], foreArmR: [0, 0, 0], spine: [0.35, -0.2, 0], thighL: [-0.6, 0, 0], shinL: [0.7, 0, 0] } },
  tilt: { wind: { spine: [0, 0.8, 0], chest: [0, 0.3, 0], upperArmR: [-2.4, 0, -0.6], foreArmR: [-0.6, 0, 0] },
    strike: { spine: [0.2, -0.6, 0], chest: [0, -0.2, 0], upperArmR: [-1.45, 0, 0], foreArmR: [0, 0, 0], thighL: [-0.7, 0, 0], shinL: [0.8, 0, 0], thighR: [0.3, 0, 0] } },
  smash: { wind: { spine: [-0.3, 0.7, 0], chest: [-0.1, 0.3, 0], upperArmR: [-3.1, 0, -0.3], foreArmR: [-0.9, 0, 0], thighL: [-0.3, 0, 0], shinL: [0.4, 0, 0] },
    strike: { spine: [0.4, -0.4, 0], chest: [0.1, -0.2, 0], upperArmR: [-1.3, 0, 0], foreArmR: [0, 0, 0], thighL: [-1.0, 0, 0], shinL: [1.0, 0, 0], thighR: [0.5, 0, 0], root: [0, -0.06, 0.05] } },
  dash: { wind: { upperArmR: [0.2, 0, -0.3], foreArmR: [-1.8, 0, 0], spine: [0.3, 0.3, 0] },
    strike: { upperArmR: [-1.6, 0, 0], foreArmR: [0.1, 0, 0], spine: [0.35, -0.2, 0], thighL: [-1.1, 0, 0], shinL: [0.9, 0, 0], thighR: [0.6, 0, 0], shinR: [0.4, 0, 0], root: [0, -0.05, 0] } },
};

const skels = new Map();
function skel(def) {
  let s = skels.get(def.id);
  if (!s) { s = makeSkeleton(def.props ?? {}); skels.set(def.id, s); }
  return s;
}
const _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _a = new THREE.Vector3();
// hand position (game units, [forward, up]) and item axis for a pose
export function gripFrame(def, pose, axis = GRIP_AXIS) {
  const sk = skel(def), H = def.attr.height;
  applyPose(sk, pose, null);
  sk.root.updateMatrixWorld(true);
  sk.handR.getWorldPosition(_p); sk.handR.getWorldQuaternion(_q);
  _a.copy(axis).applyQuaternion(_q);
  const l = Math.hypot(_a.z, _a.y) || 1;
  return { hx: _p.z * H, hy: _p.y * H, ax: _a.z / l, ay: _a.y / l };
}

const cache = new Map();
// Build (cached) the swing move for fighter def + item id + swing type
export function swingMove(def, itemId, type, data, base) {
  const key = def.id + '|' + itemId + '|' + type;
  let mv = cache.get(key);
  if (mv) return mv;
  const ti = TYPES.indexOf(type);
  const spd = SPEED[itemId]?.[ti] ?? 1;
  const tm = data.timing?.[type] ?? [6, 12];
  const S = n => Math.max(1, Math.round(n / spd));
  const s = S(tm[0]), e = Math.max(s, S(tm[1]));
  const total = S(tm[1] + RECOVERY[type]);
  const sw = data.swing[type];
  const anim = SWING_ANIMS[type];
  const timing = { start: s, end: Math.min(e, s + 6), total };
  const hitboxes = [];
  const mk = (h, frames, dmg) => ({ frames, damage: dmg, angle: h.angle, kbg: h.kbg, bkb: h.bkb, fkb: h.fkb, size: h.r, r: h.r,
    element: h.element, shieldDmg: h.shieldDmg, group: 0, off: h.off, itemHb: true });
  sw.hitboxes.forEach((h, i) => {
    if (sw.after4 && e > s + 3) {
      hitboxes.push(mk(h, [s, s + 3], h.damage));
      hitboxes.push(mk(h, [s + 4, e], sw.after4[i]));
    } else hitboxes.push(mk(h, [s, e], h.damage));
  });
  for (const hb of hitboxes) {
    hb.path = {};
    for (let f = hb.frames[0]; f <= hb.frames[1]; f++) {
      const g = gripFrame(def, sampleMove(anim, f, timing, P.idle));
      hb.path[f] = [Math.round(g.hx + g.ax * hb.off), Math.round(g.hy + g.ay * hb.off)];
    }
    hb.pos = hb.path[hb.frames[0]];
  }
  mv = { ...base, id: base.id, total, anim, timing, hitboxes, itemSwing: type, itemId, noStale: true, walkOff: type === 'dash',
    fireFrame: tm[2] != null && itemId === 'star_rod' ? S(tm[2]) : null, sfx: type === 'smash' ? 'whiffL' : 'whiff' };
  cache.set(key, mv);
  return mv;
}

// ---------- Hammer ----------
const HAMMER_PERIOD = 16;
export function hammerPose(f, mf) {
  const k = ((mf - 1) % HAMMER_PERIOD) / HAMMER_PERIOD;
  // fast downswing over the first 35% of the cycle, slower raise
  const t = k < 0.35 ? k / 0.35 : 1 - (k - 0.35) / 0.65;
  const arm = -3.1 + t * 2.2;
  const moving = f && Math.abs(f.vx) > 0.5 && f.grounded;
  const legs = moving ? walkPose(((f.walkPhase ?? 0) % 1), 1) : (f && !f.grounded ? P.fall : P.idle);
  return { ...legs, upperArmR: [arm, 0, -0.1], upperArmL: [arm, 0, 0.1], foreArmR: [-0.2, 0, 0], foreArmL: [-0.2, 0, 0],
    spine: [0.1 + t * 0.25, 0, 0], neck: [-0.1, 0, 0] };
}
const hcache = new Map();
// per-frame [forward, up] of each hammer hitbox for one 16-frame cycle
export function hammerPaths(def, hdata) {
  let p = hcache.get(def.id);
  if (p) return p;
  p = [];
  for (let i = 0; i < HAMMER_PERIOD; i++) {
    const g = gripFrame(def, hammerPose(null, i + 1), HAMMER_AXIS);
    p.push(hdata.hitboxes.map(h => [Math.round(g.hx + g.ax * h.off - g.ay * h.side), Math.round(g.hy + g.ay * h.off + g.ax * h.side)]));
  }
  hcache.set(def.id, p);
  return p;
}
export { HAMMER_PERIOD };
