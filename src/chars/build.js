// makeChar(): combine generated move data (src/chars/data/<id>.js, from the decomp research) with a
// character module (model, animation choices, special-move scripts) into an engine definition.
//
// Hitbox positions: the research gives each hitbox as (bone, bone-local offset). We place it by running
// forward kinematics on this character's own rig with the same animation the renderer plays, so hitboxes
// follow the visuals frame by frame. Root-space hitboxes (TopN: y up, z forward) are used directly.
import * as THREE from 'three';
import { makeSkeleton, applyPose } from '../render/rig.js';
import { sampleMove, P as POSES, autoSide, moveTiming as animTiming } from '../render/anims.js';
import { MODEL_HEIGHT } from './heights.js';

const PHYS_DEFAULT = { landingLag: 4, helplessLand: 25 };

// default animation archetype per engine move id
const ARCH = {
  jab1: 'jab', jab2: 'jab2', jab3: 'jab3kick', jabRapid: 'jab', jabRapidStart: 'jab', jabRapidEnd: 'jab2',
  ftilt: 'ftilt', ftiltHi: 'ftilt', ftiltMidHi: 'ftilt', ftiltLo: 'ftilt', ftiltMidLo: 'ftilt',
  utilt: 'utilt', dtilt: 'dtilt', dashattack: 'dashattack',
  fsmash: 'fsmash', fsmashHi: 'fsmash', fsmashMidHi: 'fsmash', fsmashLo: 'fsmash', fsmashMidLo: 'fsmash',
  usmash: 'usmash', dsmash: 'dsmash', nair: 'nair', fair: 'fair', bair: 'bair', uair: 'uair', dair: 'dair',
  grab: 'grab', fthrow: 'throwf', bthrow: 'throwb', ledgeAttack: 'ledgeattack', ledgeAttackSlow: 'ledgeattack',
  getupAttack: 'getup', getupAttackDown: 'getup', getupAttackSlow: 'getup', taunt: 'taunt',
  nspecial: 'special', nspecialAir: 'special', uspecial: 'upspecial', uspecialAir: 'upspecial', dspecial: 'downspecial', dspecialAir: 'downspecial',
};
const AIR_IDS = new Set(['nair', 'fair', 'bair', 'uair', 'dair']);
const CROUCH_IDS = new Set(['dtilt']);

// Fallback hitbox spots (fractions of height: [forward, up]) for joints we can't place
const FALLBACK = {
  jab1: [0.45, 0.55], jab2: [0.45, 0.55], jab3: [0.5, 0.45], jabRapid: [0.5, 0.5], ftilt: [0.55, 0.45], utilt: [0.1, 1.0], dtilt: [0.55, 0.1],
  dashattack: [0.45, 0.4], fsmash: [0.6, 0.5], usmash: [0.05, 1.05], dsmash: [0.5, 0.1], nair: [0.25, 0.45], fair: [0.5, 0.4], bair: [-0.5, 0.45],
  uair: [0.05, 0.95], dair: [0.05, -0.05], grab: [0.5, 0.5], ledgeAttack: [0.5, 0.3], getupAttack: [0.5, 0.15], uspecial: [0.3, 0.8], dspecial: [0.4, 0.4], nspecial: [0.5, 0.5],
};

export function makeChar(o) {
  const data = o.data;
  const attr = { ...PHYS_DEFAULT, ...data.attr, ...o.attr };
  attr.width = attr.width ?? attr.ecbWidth * 0.6;
  // models are authored with 1.0 = collision-box height; draw them at the real decomp model height
  attr.visualHeight = attr.visualHeight ?? MODEL_HEIGHT[o.id] ?? attr.height;
  attr.hurtR = attr.hurtR ?? attr.ecbWidth * 0.62;
  attr.djvx ??= attr.jvx;
  if (attr.aerialJumpVels && !attr.multiJump) {
    const base = 80 * attr.jmul + attr.jbase;
    attr.multiJump = attr.aerialJumpVels.map(v => v / base);
  }
  const moves = {};
  const all = { ...data.moves, ...(o.extraMoves ?? {}) };
  for (const [id, src] of Object.entries(all)) {
    const ov = o.moves?.[id] ?? {};
    const mv = {
      id, total: src.total ?? ov.total ?? 30, iasa: src.iasa ?? null,
      landingLag: src.landingLag, zLandingLag: src.zLandingLag, autocancel: src.autocancel,
      air: AIR_IDS.has(id), crouch: CROUCH_IDS.has(id),
      anim: ARCH[id] ?? 'special',
      hitboxes: (src.hitboxes ?? []).map(h => ({ ...h, size: h.r })),
      throwData: src.throw, intangibleW: src.intangible, invincibleW: src.invincible,
      projectile: src.projectile, behavior: src.behavior, data: src,
      ...ov,
    };
    if (ov.hitboxes === undefined && src.hitboxes) mv.hitboxes = src.hitboxes.map(h => ({ ...h, size: h.r, ...(ov.hitboxPatch?.(h) ?? {}) }));
    if (mv.total == null) mv.total = 30;
    // default archetypes strike with the limb side the hitboxes are on (mirrored variant if needed)
    if (ov.anim === undefined && typeof mv.anim === 'string') mv.anim = autoSide(mv.anim, mv.hitboxes);
    if (id === 'dashattack') mv.walkOff = mv.walkOff ?? false;
    // multi-hit: 3+ distinct hitbox windows -> each window refreshes the hit list (own group)
    const wins = [...new Set(mv.hitboxes.filter(h => !h.grab).map(h => h.frames[0] + ':' + h.frames[1]))];
    if (mv.multihit ?? wins.length >= 3) for (const h of mv.hitboxes) h.group = wins.indexOf(h.frames[0] + ':' + h.frames[1]);
    moves[id] = mv;
  }
  // jab chain timing
  const jw = data.attr.jabComboWindow ?? 24;
  if (moves.jab1 && moves.jab2 && moves.jab1.next === undefined) { moves.jab1.next = 'jab2'; moves.jab1.nextAt = moves.jab1.nextAt ?? Math.min(moves.jab1.total, 10); }
  if (moves.jab2 && moves.jab3 && moves.jab2.next === undefined) { moves.jab2.next = 'jab3'; moves.jab2.nextAt = moves.jab2.nextAt ?? Math.min(moves.jab2.total, 10); }
  for (const id of ['getupAttack', 'ledgeAttack']) if (!moves[id + 'Slow'] && moves[id]) moves[id + 'Slow'] = moves[id];
  const def = {
    id: o.id, name: o.name ?? data.name, series: o.series, short: o.short ?? (o.name ?? data.name).slice(0, 2),
    palettes: o.palettes, model: o.model, props: o.props, attr, moves, anims: o.anims, animExtra: o.animExtra,
    modelScale: (o.modelScale ?? 1) * attr.visualHeight / attr.height, upBTurn: o.upBTurn, nspecialTurn: o.nspecialTurn, doubleJumpFlip: o.doubleJumpFlip,
    common: COMMON, look: data.look, colors: data.colors, unlockable: data.unlockable, init: o.init,
    boneMap: o.boneMap ?? {}, extraBones: o.extraBones,
  };
  for (const mv of Object.values(moves)) {
    wireBody(mv);
    if (mv.throwData) wireThrow(mv, mv.id === 'bthrow');
    placeHitboxes(def, mv);
  }
  if (o.finalize) o.finalize(def);
  return def;
}

// ---------- hitbox placement by forward kinematics ----------
const _v = new THREE.Vector3(), _q = new THREE.Quaternion();
let skelCache = new Map();
function skeletonFor(def) {
  let s = skelCache.get(def.id);
  if (!s) {
    s = makeSkeleton(def.props ?? {});
    // optional extra bones (sword, tail, item) defined by the character
    const extra = def.extraBones ?? [];
    for (const [name, parent, pos] of extra) { const g = new THREE.Group(); g.position.set(...pos); s[parent].add(g); s[name] = g; }
    skelCache.set(def.id, s);
  }
  return s;
}
const LIMB = /^(upperArm|foreArm|hand|thigh|shin|foot|sword|tail)/;

export function placeHitboxes(def, mv) {
  const hbs = mv.hitboxes; if (!hbs?.length) return;
  const H = def.attr.height * (def.modelScale ?? 1);   // rendered model height
  const timing = mv.timing ?? (mv.timing = animTiming(mv));   // same phase timing the renderer uses
  const sk = skeletonFor(def);
  const rest = mv.air ? POSES.fall : (mv.crouch ? POSES.crouch : POSES.idle);
  for (const h of hbs) {
    if (h.pos || h.path) continue;
    let bone = def.boneMap[h.bone] ?? h.bone;
    const fb = FALLBACK[mv.id.replace(/(Hi|Lo|MidHi|MidLo|Air|Slow|Down)$/, '')] ?? [0.4, 0.5];
    if (bone === 'root') { h.pos = [h.off[2], h.off[1]]; continue; }
    if (!sk[bone] || /^j\d/.test(bone) || bone === 'proj') { h.pos = [fb[0] * H, fb[1] * H]; h.estPos = true; continue; }
    h.path = {};
    for (let f = h.frames[0]; f <= h.frames[1]; f++) {
      const pose = typeof mv.anim === 'function' ? mv.anim({ mf: f, vars: {}, a: def.attr, sf: f }, f, POSES) : sampleMove(mv.anim, f, timing, rest);
      applyPose(sk, pose, null);
      sk.root.updateMatrixWorld(true);
      const b = sk[bone];
      // bone-local offset: limbs extend along -y in our rig (decomp limbs extend along +x)
      const o = h.off ?? [0, 0, 0];
      if (LIMB.test(bone)) _v.set(o[1] / H, -o[0] / H, o[2] / H);
      else _v.set(0, (o[0] + o[1]) / H, o[2] / H);
      b.localToWorld(_v);
      h.path[f] = [Math.round(_v.z * H), Math.round(_v.y * H)];
    }
    h.pos = h.path[h.frames[0]];
  }
}
export function moveTiming(m) {
  let s = Infinity, e = -Infinity;
  for (const h of m.hitboxes || []) { s = Math.min(s, h.frames[0]); e = Math.max(e, h.frames[1]); }
  if (m.throwData) { s = Math.min(s, m.throwData.releaseFrame); e = Math.max(e, m.throwData.releaseFrame); }
  if (s === Infinity) { s = m.activeFrame ?? Math.max(2, Math.round((m.total || 20) * 0.35)); e = s + 3; }
  return { start: s, end: Math.min(e, s + 12), total: m.total };
}

// intangible / invincible windows from the data
function wireBody(mv) {
  if (!mv.intangibleW && !mv.invincibleW) return;
  const prev = mv.script;
  mv.script = (f, mf, c) => {
    for (const [s, e] of mv.intangibleW ?? []) if (mf >= s && mf <= e) f.intangible = Math.max(f.intangible, 1);
    for (const [s, e] of mv.invincibleW ?? []) if (mf >= s && mf <= e) f.invincible = Math.max(f.invincible, 1);
    prev?.(f, mf, c);
  };
}

// Throws: the victim is held in front (or swung behind for back throws) and launched on the release frame.
function wireThrow(mv, back) {
  const th = mv.throwData;
  const userScript = mv.script;
  mv.script = (f, mf, c) => {
    userScript?.(f, mf, c);
    const v = f.vars.victim;
    if (!v || v.dead || v.grabbedBy !== f && mf <= th.releaseFrame && v.state !== 'thrown') return;
    const rf = th.releaseFrame;
    if (mf < rf) {
      const k = Math.min(1, mf / rf);
      const ang = back ? Math.PI * k : Math.sin(Math.PI * k) * 0.6;
      const r = f.a.width * 2;
      v.x = f.x + f.facing * Math.cos(ang) * r; v.y = f.y + Math.sin(ang) * f.H * 0.5;
      v.facing = -f.facing;
    } else if (mf === rf) {
      if (back && !mv.noTurn) f.facing = -f.facing;
      v.grabbedBy = null; f.grabbing = null;
      v.x = f.x + f.facing * f.a.width * 1.6; v.y = Math.max(v.y, f.y + 2);
      v.grounded = false; v.ground = null;
      v.setState('fall');
      let dmg = Math.ceil(th.damage * f.staleMul - 0.001);
      if (f.vars.halve) dmg = Math.ceil(dmg * 0.5);
      const res = v.takeHit({ damage: dmg, angle: th.angle, bkb: th.bkb, kbg: th.kbg, fkb: th.fkb ?? 0, element: th.element ?? 'normal', attacker: f, lr: f.facing, throwHit: true });
      v.hitlag = 0;    // throw releases cause no hitlag
      v.thrownBy = f; v.thrownFrames = 60;
      f.match.recordStale(f, mv);
      f.match.emit('hit', { f: v, a: f, x: v.x, y: v.y + v.H * 0.5, dmg, kb: res.kb, element: th.element, throw: true });
      f.match.emit('sfx', { name: 'throw' });
    }
  };
}

// Shared moves every fighter has (item handling). Item swing hitboxes are filled at runtime from the item.
export const COMMON = {
  pickup: { id: 'pickup', total: 8, anim: 'grab', noStale: true },
  itemThrow: {
    id: 'itemThrow', total: 24, anim: 'throwf', groundOK: true, noStale: true,
    script: (f, mf) => { if (mf === 6 && f.item) f.match.items.throwItem(f, f.vars); },
  },
  itemShoot: { id: 'itemShoot', total: 20, anim: 'special', groundOK: true, noStale: true, script: (f, mf) => { if (mf === 4 && f.item) f.match.items.shoot(f); } },
  itemSwingTilt: { id: 'itemSwingTilt', total: 26, anim: 'fsmash', itemSwing: 'tilt', noStale: true },
  itemSwingSmash: { id: 'itemSwingSmash', total: 44, anim: 'fsmash', itemSwing: 'smash', noStale: true },
  itemSwingDash: { id: 'itemSwingDash', total: 36, anim: 'dashattack', itemSwing: 'dash', walkOff: true, noStale: true },
  itemSwingAir: { id: 'itemSwingAir', total: 30, anim: 'fair', air: true, itemSwing: 'air', landingLag: 10, zLandingLag: 4, noStale: true },
};
// item moves let the item manager swap in the per-item variant (swing hitboxes, shooters, Hammer) on start
for (const m of Object.values(COMMON)) m.onStart = f => f.match.items.onItemMove?.(f, m);
