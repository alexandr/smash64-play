// Generic animation library for the humanoid rig.
// Conventions (model faces +z, +x is the character's left):
//   arm/leg forward  = negative X rotation on upperArm/thigh (-PI/2 = horizontal, -PI = straight up);
//   elbow bend       = negative X on foreArm;  knee bend = positive X on shin;
//   lean forward     = positive X on spine/chest;  twist toward the left = +Y (right shoulder comes forward);
//   left arm outward = +Z on upperArmL, right arm outward = -Z on upperArmR (same for thighs).
// Body rotations pivot at the feet; use rotAbout() for flips/spins around the body centre.
// Move animations are "phased": the engine supplies the move's startup, active and total frames and
// the keys below are placed relative to those, so visuals always line up with the real frame data.
// Every archetype in ATK also exists mirrored as `<name>M` (left/right swapped); autoSide() picks the
// variant whose striking limbs match the side the move's hitboxes are attached to.
import { sampleKeys } from './rig.js';

const PI = Math.PI;

// ---------------- pose helpers ----------------
const SIDE = /(L|R)$/;
// Mirror a pose left<->right (swap L/R bones, negate the Y/Z rotations, negate root x).
export function mirrorPose(p) {
  if (!p) return p;
  const out = {};
  for (const [k, v] of Object.entries(p)) {
    if (k === 'fx' || k === 'scale') { out[k] = v; continue; }
    const m = SIDE.exec(k);
    const nk = m && k !== 'root' ? k.slice(0, -1) + (m[1] === 'L' ? 'R' : 'L') : k;
    out[nk] = k === 'root' ? [-v[0], v[1], v[2]] : [v[0], -v[1], -v[2]];
  }
  return out;
}
// Merge poses left to right (later keys win).
export const mix = (...ps) => Object.assign({}, ...ps);
// Rotate the whole body by Euler XYZ (rx, ry, rz) around the point (0, c, 0) (model units, c = pivot
// height as a fraction of standing height) instead of the feet. Adds to any existing root offset.
export function rotAbout(pose, rx, ry, rz, c = 0.45) {
  // R = Rx * Ry * Rz applied to C = (0, c, 0)
  const cz = Math.cos(rz), sz = Math.sin(rz), cy = Math.cos(ry), sy = Math.sin(ry), cx = Math.cos(rx), sx = Math.sin(rx);
  let x = -sz * c, y = cz * c, z = 0;                 // Rz
  [x, z] = [x * cy + z * sy, -x * sy + z * cy];     // Ry
  [y, z] = [y * cx - z * sx, y * sx + z * cx];      // Rx
  const r = pose.root ?? [0, 0, 0];
  return { ...pose, body: [rx, ry, rz], root: [r[0] - x, r[1] + c - y, r[2] - z] };
}
// Keyframed animation: keys = [[frame, pose], ...] -> anim function (f, mf) => pose (smoothstep between keys)
export function keyed(keys) {
  const k = keys.map(([f, pose, linear]) => ({ f, pose, linear }));
  return (f, mf) => sampleKeys(k, mf);
}

// Pose keys plus a separately keyed body rotation (flips/spins) applied around the body centre each frame,
// so big rotations stay centred: spinAnim([[f, pose], ...], [[f, angle], ...], 'x' | 'y' | 'z', c).
export function spinAnim(poseKeys, angleKeys, axis = 'x', c = 0.45) {
  const pk = keyed(poseKeys);
  return (f, mf) => {
    let a = angleKeys[0][1];
    for (let i = 1; i < angleKeys.length; i++) {
      const [f0, a0] = angleKeys[i - 1], [f1, a1] = angleKeys[i];
      if (mf <= f1) { a = a0 + (a1 - a0) * Math.max(0, Math.min(1, (mf - f0) / Math.max(1e-6, f1 - f0))); break; }
      a = a1;
    }
    const p = pk(f, mf);
    return rotAbout(p, axis === 'x' ? a : 0, axis === 'y' ? a : 0, axis === 'z' ? a : 0, c);
  };
}

// ---------------- base poses ----------------
export const P = {
  // relaxed fighting stance: knees soft, fists loosely in front
  idle: { root: [0, -0.02, 0], spine: [0.1, 0, 0], chest: [0.04, 0.05, 0], neck: [-0.08, 0, 0], head: [-0.04, 0, 0],
    upperArmL: [-0.22, 0, 0.32], foreArmL: [-0.95, 0, 0], handL: [0, 0, 0],
    upperArmR: [-0.08, 0, -0.34], foreArmR: [-0.85, 0, 0],
    thighL: [-0.3, 0, 0.12], shinL: [0.42, 0, 0], footL: [-0.12, 0, 0],
    thighR: [0.12, 0, -0.12], shinR: [0.3, 0, 0], footR: [-0.28, 0, 0] },
  crouch: { root: [0, -0.17, 0], spine: [0.55, 0, 0], chest: [0.1, 0, 0], neck: [-0.5, 0, 0], head: [-0.15, 0, 0],
    thighL: [-1.35, 0, 0.18], thighR: [-1.25, 0, -0.18], shinL: [2.05, 0, 0], shinR: [2.0, 0, 0], footL: [-0.7, 0, 0], footR: [-0.75, 0, 0],
    upperArmL: [-0.55, 0, 0.35], upperArmR: [-0.45, 0, -0.35], foreArmL: [-0.9, 0, 0], foreArmR: [-0.9, 0, 0] },
  jumpsquat: { root: [0, -0.11, 0], spine: [0.45, 0, 0], neck: [-0.3, 0, 0], thighL: [-1.0, 0, 0.12], thighR: [-0.95, 0, -0.12], shinL: [1.55, 0, 0], shinR: [1.5, 0, 0],
    footL: [-0.55, 0, 0], footR: [-0.55, 0, 0], upperArmL: [0.5, 0, 0.35], upperArmR: [0.5, 0, -0.35], foreArmL: [-0.4, 0, 0], foreArmR: [-0.4, 0, 0] },
  // rising: one knee tucked, lead arm thrown up
  jump: { spine: [-0.08, 0, 0], neck: [-0.15, 0, 0], thighL: [-1.25, 0, 0.08], shinL: [1.7, 0, 0], footL: [0.3, 0, 0], thighR: [0.25, 0, -0.08], shinR: [0.55, 0, 0], footR: [0.4, 0, 0],
    upperArmL: [-2.7, 0, 0.25], foreArmL: [-0.3, 0, 0], upperArmR: [0.55, 0, -0.55], foreArmR: [-0.5, 0, 0] },
  // falling: arms out for balance, legs dangling slightly apart
  fall: { spine: [0.05, 0, 0], neck: [-0.1, 0, 0], thighL: [-0.55, 0, 0.12], shinL: [0.85, 0, 0], footL: [0.25, 0, 0], thighR: [-0.15, 0, -0.12], shinR: [0.6, 0, 0], footR: [0.3, 0, 0],
    upperArmL: [-0.5, 0, 1.15], upperArmR: [-0.5, 0, -1.15], foreArmL: [-0.5, 0, 0], foreArmR: [-0.5, 0, 0] },
  // special fall: limp, arms flailing up
  helpless: { spine: [0.25, 0, 0], neck: [0.2, 0, 0], head: [0.25, 0, 0], thighL: [-0.35, 0, 0.22], thighR: [-0.25, 0, -0.22], shinL: [0.7, 0, 0], shinR: [0.6, 0, 0],
    upperArmL: [-0.3, 0, 2.3], upperArmR: [-0.3, 0, -2.3], foreArmL: [-0.3, 0, 0], foreArmR: [-0.3, 0, 0] },
  land: { root: [0, -0.1, 0], spine: [0.45, 0, 0], neck: [-0.3, 0, 0], thighL: [-0.9, 0, 0.18], thighR: [-0.85, 0, -0.18], shinL: [1.45, 0, 0], shinR: [1.4, 0, 0],
    footL: [-0.55, 0, 0], footR: [-0.55, 0, 0], upperArmL: [0.1, 0, 0.85], upperArmR: [0.1, 0, -0.85], foreArmL: [-0.4, 0, 0], foreArmR: [-0.4, 0, 0] },
  // shield: hunched, forearms crossed in front of the face
  shield: { root: [0, -0.07, 0], spine: [0.3, 0, 0], neck: [-0.15, 0, 0], thighL: [-0.65, 0, 0.22], thighR: [-0.4, 0, -0.22], shinL: [1.0, 0, 0], shinR: [0.85, 0, 0],
    footL: [-0.35, 0, 0], footR: [-0.45, 0, 0], upperArmL: [-1.15, 0, 0.15], upperArmR: [-1.15, 0, -0.15], foreArmL: [-1.6, 0, 0], foreArmR: [-1.6, 0, 0] },
  hurt: { spine: [-0.45, 0, 0], neck: [-0.3, 0, 0], head: [-0.35, 0, 0], upperArmL: [-0.4, 0, 1.25], upperArmR: [-0.2, 0, -1.25], foreArmL: [-0.5, 0, 0], foreArmR: [-0.5, 0, 0],
    thighL: [-0.4, 0, 0.1], shinL: [0.5, 0, 0], thighR: [0.25, 0, -0.1], shinR: [0.3, 0, 0] },
  // tumble: sprawled star shape (the view spins the body around the centre while in hitstun)
  tumble: { body: [0, 0, 0], spine: [-0.45, 0, 0.15], neck: [-0.3, 0, 0], head: [-0.4, 0, 0], upperArmL: [-0.6, 0, 2.1], upperArmR: [-1.1, 0, -1.6], foreArmL: [-0.4, 0, 0], foreArmR: [-0.7, 0, 0],
    thighL: [-0.9, 0, 0.45], shinL: [1.1, 0, 0], thighR: [0.45, 0, -0.35], shinR: [0.7, 0, 0] },
  // lying face up on the floor (body centred over the feet point)
  lying: { root: [0, 0.07, 0.42], body: [-PI / 2, 0, 0], neck: [0.1, 0, 0], upperArmL: [0.1, 0, 0.9], upperArmR: [0.1, 0, -0.9], foreArmL: [-0.3, 0, 0], foreArmR: [-0.3, 0, 0],
    thighL: [-0.1, 0, 0.18], thighR: [0.05, 0, -0.18], shinL: [0.35, 0, 0], shinR: [0.15, 0, 0] },
  // hanging from a ledge (the feet point is 0.88 H below the edge): both hands up on the edge. The root shift
  // puts typical humanoid hands (arms raised ~1.0 H above the feet) at the edge; characters override per build.
  ledgehang: { root: [0, -0.12, -0.06], body: [0, 0, 0], spine: [-0.08, 0, 0], neck: [-0.25, 0, 0],
    upperArmL: [-2.85, 0, 0.18], upperArmR: [-2.85, 0, -0.18], foreArmL: [-0.15, 0, 0], foreArmR: [-0.15, 0, 0],
    thighL: [-0.25, 0, 0.06], thighR: [0.12, 0, -0.06], shinL: [0.45, 0, 0], shinR: [0.35, 0, 0], footL: [0.3, 0, 0], footR: [0.3, 0, 0] },
  dizzy: { root: [0, -0.05, 0], spine: [0.4, 0, 0], neck: [0.3, 0, 0], head: [0.4, 0, 0.25], upperArmL: [0.25, 0, 0.3], upperArmR: [0.25, 0, -0.3], foreArmL: [-0.2, 0, 0], foreArmR: [-0.2, 0, 0],
    thighL: [-0.35, 0, 0.12], shinL: [0.65, 0, 0], thighR: [-0.3, 0, -0.12], shinR: [0.6, 0, 0] },
  // put to sleep (Sing): standing doze, head and arms drooping
  sleep: { root: [0, -0.06, 0], spine: [0.45, 0, 0], neck: [0.45, 0, 0], head: [0.35, 0, 0.1], upperArmL: [0.15, 0, 0.12], upperArmR: [0.15, 0, -0.12], foreArmL: [-0.1, 0, 0], foreArmR: [-0.1, 0, 0],
    thighL: [-0.4, 0, 0.1], shinL: [0.75, 0, 0], thighR: [-0.35, 0, -0.1], shinR: [0.7, 0, 0], footL: [-0.3, 0, 0], footR: [-0.3, 0, 0] },
  grabbed: { root: [0, 0.05, 0], spine: [-0.25, 0, 0], neck: [-0.2, 0, 0], upperArmL: [-0.6, 0, 1.0], upperArmR: [-0.4, 0, -1.1], foreArmL: [-0.6, 0, 0], foreArmR: [-0.6, 0, 0],
    thighL: [-0.3, 0, 0.1], shinL: [0.6, 0, 0], thighR: [0.1, 0, -0.1], shinR: [0.4, 0, 0] },
  grabhold: { spine: [0.18, 0, 0], upperArmL: [-1.5, 0, 0.12], upperArmR: [-1.5, 0, -0.12], foreArmL: [-0.25, 0, 0], foreArmR: [-0.25, 0, 0],
    thighL: [-0.55, 0, 0.1], shinL: [0.7, 0, 0], thighR: [0.25, 0, -0.1], shinR: [0.3, 0, 0], footL: [-0.15, 0, 0], footR: [-0.4, 0, 0], root: [0, -0.02, 0] },
  victory: { upperArmR: [-2.9, 0, -0.3], foreArmR: [-0.3, 0, 0], upperArmL: [0, 0, 0.5], foreArmL: [-1.4, 0, 0], thighL: [-0.1, 0, 0.1], thighR: [0.1, 0, -0.1] },
};

// ---------------- locomotion cycles: functions of a phase t in [0,1) ----------------
export function walkPose(t, amp = 1) {
  const s = Math.sin(t * 2 * PI), c = Math.cos(t * 2 * PI);
  return { spine: [0.1, 0, 0], chest: [0, -0.12 * s * amp, 0], neck: [-0.08, 0, 0], root: [0, -0.015 + Math.abs(c) * 0.022 * amp, 0],
    thighL: [-0.55 * s * amp - 0.05, 0, 0.04], thighR: [0.55 * s * amp - 0.05, 0, -0.04],
    shinL: [0.2 + 0.55 * Math.max(0, c) * amp, 0, 0], shinR: [0.2 + 0.55 * Math.max(0, -c) * amp, 0, 0],
    footL: [-0.15 * s * amp, 0, 0], footR: [0.15 * s * amp, 0, 0],
    upperArmL: [0.55 * s * amp, 0, 0.18], upperArmR: [-0.55 * s * amp, 0, -0.18], foreArmL: [-0.5, 0, 0], foreArmR: [-0.5, 0, 0] };
}
export function runPose(t) {
  const s = Math.sin(t * 2 * PI), c = Math.cos(t * 2 * PI);
  return { spine: [0.5, 0, 0], chest: [0.05, -0.2 * s, 0], neck: [-0.4, 0, 0], head: [-0.1, 0, 0], root: [0, -0.02 + Math.abs(c) * 0.05, 0],
    thighL: [-1.05 * s - 0.35, 0, 0.04], thighR: [1.05 * s - 0.35, 0, -0.04],
    shinL: [0.5 + 1.0 * Math.max(0, c), 0, 0], shinR: [0.5 + 1.0 * Math.max(0, -c), 0, 0],
    footL: [-0.2, 0, 0], footR: [-0.2, 0, 0],
    upperArmL: [1.0 * s - 0.1, 0, 0.22], upperArmR: [-1.0 * s - 0.1, 0, -0.22], foreArmL: [-1.4, 0, 0], foreArmR: [-1.4, 0, 0] };
}
export function idlePose(t) {
  const b = Math.sin(t * 2 * PI);
  const p = { ...P.idle };
  p.root = [0, -0.02 + b * 0.008, 0]; p.spine = [0.1 + b * 0.025, 0, 0];
  p.upperArmL = [-0.22 - b * 0.05, 0, 0.32]; p.upperArmR = [-0.08 - b * 0.05, 0, -0.34];
  p.shinL = [0.42 - b * 0.03, 0, 0]; p.shinR = [0.3 - b * 0.03, 0, 0];
  return p;
}

// ---------------- attack archetypes: { wind, strike, hold?, follow? } ----------------
// The phased sampler moves rest -> wind (at 75% of startup) -> strike (first active frame), holds `hold`
// (default strike) until the last active frame, then -> follow -> rest over the recovery.
// Striking limbs are on the right side unless noted (mirrored `<name>M` variants are generated below).
const crouchBase = P.crouch;
export const ATK = {
  // right straight punch: shoulder comes forward (+Y twist)
  jab: { wind: { upperArmR: [0.25, 0, -0.25], foreArmR: [-2.0, 0, 0], chest: [0, -0.3, 0], spine: [0.12, -0.1, 0] },
    strike: { upperArmR: [-1.55, 0, 0.12], foreArmR: [-0.05, 0, 0], handR: [0.2, 0, 0], chest: [0, 0.45, 0], spine: [0.18, 0.15, 0], upperArmL: [0.1, 0, 0.4], foreArmL: [-1.4, 0, 0],
      thighL: [-0.4, 0, 0.12], shinL: [0.5, 0, 0], thighR: [0.25, 0, -0.12], shinR: [0.25, 0, 0], root: [0, -0.025, 0] } },
  // left straight punch
  jab2: { wind: { upperArmL: [0.25, 0, 0.25], foreArmL: [-2.0, 0, 0], chest: [0, 0.3, 0], spine: [0.12, 0.1, 0] },
    strike: { upperArmL: [-1.55, 0, -0.12], foreArmL: [-0.05, 0, 0], handL: [0.2, 0, 0], chest: [0, -0.45, 0], spine: [0.18, -0.15, 0], upperArmR: [0.1, 0, -0.4], foreArmR: [-1.4, 0, 0],
      thighL: [-0.4, 0, 0.12], shinL: [0.5, 0, 0], thighR: [0.25, 0, -0.12], shinR: [0.25, 0, 0], root: [0, -0.025, 0] } },
  // right front kick
  jab3kick: { wind: { thighR: [-0.9, 0, 0], shinR: [1.9, 0, 0], spine: [0.05, 0, 0], upperArmL: [0.2, 0, 0.5], upperArmR: [0.2, 0, -0.5] },
    strike: { thighR: [-1.6, 0, 0], shinR: [0.05, 0, 0], footR: [0.4, 0, 0], spine: [-0.3, 0, 0], thighL: [0.05, 0, 0.05], shinL: [0.25, 0, 0], upperArmL: [0.5, 0, 0.7], upperArmR: [0.5, 0, -0.7] } },
  // right side kick at hip height
  ftilt: { wind: { thighR: [-0.9, 0, 0], shinR: [1.9, 0, 0], spine: [-0.05, 0, 0], body: [0, -0.25, 0] },
    strike: { thighR: [-1.5, 0, -0.05], shinR: [0.03, 0, 0], footR: [0.3, 0, 0], spine: [-0.35, 0, 0], neck: [0.2, 0, 0], body: [0, -0.35, 0], thighL: [0.12, 0, 0.08], shinL: [0.2, 0, 0],
      upperArmL: [0.35, 0, 0.75], upperArmR: [-0.3, 0, -0.75], root: [0, -0.01, 0] } },
  // right arm swung overhead
  utilt: { wind: { upperArmR: [0.6, 0, -0.6], foreArmR: [-0.6, 0, 0], spine: [0.25, 0, 0], root: [0, -0.04, 0] },
    strike: { upperArmR: [-2.95, 0, 0.25], foreArmR: [-0.2, 0, 0], spine: [-0.3, 0, 0], chest: [-0.1, 0.25, 0], head: [-0.35, 0, 0], upperArmL: [0.3, 0, 0.5],
      thighL: [-0.2, 0, 0.12], thighR: [0.15, 0, -0.12], root: [0, 0.01, 0] },
    follow: { upperArmR: [-2.5, 0, -0.6], foreArmR: [-0.6, 0, 0], spine: [-0.2, 0, 0] } },
  // crouching right-leg sweep forward
  dtilt: { wind: { ...crouchBase, thighR: [-1.0, 0, -0.18], shinR: [2.2, 0, 0] },
    strike: { ...crouchBase, thighR: [-1.68, 0, -0.08], shinR: [0.06, 0, 0], footR: [0.4, 0, 0], spine: [0.25, 0, 0], thighL: [-1.5, 0, 0.25], shinL: [2.3, 0, 0], root: [0, -0.2, 0] } },
  // running jump kick
  dashattack: { wind: { spine: [0.5, 0, 0], thighL: [-0.7, 0, 0], shinL: [0.9, 0, 0], thighR: [0.3, 0, 0], shinR: [0.8, 0, 0], upperArmL: [0.6, 0, 0.4], upperArmR: [0.6, 0, -0.4] },
    strike: { spine: [-0.35, 0, 0], thighR: [-1.55, 0, 0], shinR: [0.05, 0, 0], footR: [0.4, 0, 0], thighL: [0.35, 0, 0.05], shinL: [0.8, 0, 0], upperArmL: [0.4, 0, 1.2], upperArmR: [0.4, 0, -1.2], root: [0, 0.06, 0] } },
  // big right punch with lunge
  fsmash: { wind: { spine: [-0.05, -0.3, 0], chest: [-0.2, -0.55, 0], upperArmR: [0.9, 0, -0.45], foreArmR: [-1.4, 0, 0], upperArmL: [-0.9, 0, 0.3], foreArmL: [-0.6, 0, 0],
      thighL: [-0.55, 0, 0.12], shinL: [0.7, 0, 0], thighR: [0.35, 0, -0.12], shinR: [0.4, 0, 0], root: [0, -0.02, -0.03] },
    strike: { spine: [0.35, 0.2, 0], chest: [0, 0.5, 0], upperArmR: [-1.58, 0, 0.1], foreArmR: [0, 0, 0], handR: [0.4, 0, 0], upperArmL: [0.5, 0, 0.5], foreArmL: [-1.2, 0, 0],
      thighL: [-1.0, 0, 0.12], shinL: [1.15, 0, 0], thighR: [0.55, 0, -0.12], shinR: [0.3, 0, 0], footR: [-0.4, 0, 0], root: [0, -0.06, 0.06] } },
  // jump-up with both arms raised (headbutt / upward strike)
  usmash: { wind: { root: [0, -0.09, 0], spine: [0.55, 0, 0], neck: [0.2, 0, 0], thighL: [-0.8, 0, 0.12], thighR: [-0.8, 0, -0.12], shinL: [1.3, 0, 0], shinR: [1.3, 0, 0], footL: [-0.4, 0, 0], footR: [-0.4, 0, 0],
      upperArmL: [0.6, 0, 0.4], upperArmR: [0.6, 0, -0.4] },
    strike: { root: [0, 0.03, 0], spine: [-0.4, 0, 0], neck: [-0.4, 0, 0], head: [-0.5, 0, 0], upperArmL: [-2.7, 0, 0.35], upperArmR: [-2.7, 0, -0.35], foreArmL: [-0.2, 0, 0], foreArmR: [-0.2, 0, 0],
      thighL: [0.05, 0, 0.08], thighR: [0.05, 0, -0.08] } },
  // low split sweep to both sides (body turned side-on)
  dsmash: { wind: { ...crouchBase, body: [0, 0.6, 0] },
    strike: { ...crouchBase, body: [0, -1.4, 0], spine: [0.35, 0, 0], thighR: [-1.55, 0, -0.65], shinR: [0.15, 0, 0], thighL: [-1.45, 0, 0.65], shinL: [0.25, 0, 0], root: [0, -0.22, 0] } },
  // sex kick: right leg straight forward, left tucked, leaning back
  nair: { wind: { thighL: [-0.8, 0, 0], shinL: [1.5, 0, 0], thighR: [-0.8, 0, 0], shinR: [1.7, 0, 0], spine: [0.2, 0, 0] },
    strike: { thighR: [-1.55, 0, 0], shinR: [0, 0, 0], footR: [0.4, 0, 0], thighL: [-0.6, 0, 0], shinL: [1.9, 0, 0], spine: [-0.35, 0, 0], neck: [0.25, 0, 0],
      upperArmL: [0.1, 0, 1.5], upperArmR: [0.1, 0, -1.5], body: [0.15, 0, 0] } },
  // two-handed overhead hammer swung forward-down
  fair: { wind: { spine: [-0.45, 0, 0], upperArmR: [-2.9, 0, 0.1], upperArmL: [-2.9, 0, -0.1], foreArmL: [-0.5, 0, 0], foreArmR: [-0.5, 0, 0], thighL: [-0.8, 0, 0], shinL: [1.2, 0, 0] },
    strike: { spine: [0.85, 0, 0], upperArmR: [-0.9, 0, 0.12], upperArmL: [-0.9, 0, -0.12], foreArmL: [0, 0, 0], foreArmR: [0, 0, 0], thighL: [-1.0, 0, 0], shinL: [1.4, 0, 0], thighR: [-0.4, 0, 0], shinR: [1.1, 0, 0] } },
  // right leg thrust straight back, looking over the shoulder
  bair: { wind: { spine: [0.35, 0, 0], thighR: [-1.0, 0, 0], shinR: [1.9, 0, 0], thighL: [-0.7, 0, 0], shinL: [1.3, 0, 0] },
    strike: { spine: [0.65, 0, 0], neck: [-0.6, 0, 0], head: [-0.3, -0.5, 0], thighR: [1.5, 0, 0], shinR: [0.05, 0, 0], footR: [0.5, 0, 0], thighL: [-0.9, 0, 0], shinL: [1.5, 0, 0],
      upperArmL: [0.3, 0, 1.0], upperArmR: [0.3, 0, -1.0] } },
  // overhead kick: body tilted back, right leg swung up over the head
  uair: { wind: { spine: [0.5, 0, 0], thighR: [-0.4, 0, 0], shinR: [1.2, 0, 0], thighL: [-0.8, 0, 0], shinL: [1.3, 0, 0] },
    strike: { ...rotAbout({ thighR: [-2.6, 0, 0], shinR: [0.05, 0, 0], footR: [0.4, 0, 0], thighL: [-0.3, 0, 0], shinL: [1.3, 0, 0], spine: [-0.3, 0, 0], upperArmL: [0.4, 0, 1.3], upperArmR: [0.4, 0, -1.3] }, -0.9, 0, 0) },
    follow: { ...rotAbout({ thighR: [-1.8, 0, 0], shinR: [0.4, 0, 0], thighL: [-0.4, 0, 0], shinL: [1.2, 0, 0], upperArmL: [0.2, 0, 1.2], upperArmR: [0.2, 0, -1.2] }, -1.6, 0, 0) } },
  // stomp: both legs driven straight down
  dair: { wind: { thighL: [-1.3, 0, 0.2], thighR: [-1.3, 0, -0.2], shinL: [2.0, 0, 0], shinR: [2.0, 0, 0], spine: [0.3, 0, 0], upperArmL: [-0.3, 0, 1.0], upperArmR: [-0.3, 0, -1.0] },
    strike: { thighL: [0.15, 0, 0.08], thighR: [0.15, 0, -0.08], shinL: [0.05, 0, 0], shinR: [0.05, 0, 0], footL: [0.6, 0, 0], footR: [0.6, 0, 0], spine: [-0.2, 0, 0],
      upperArmL: [-0.4, 0, 1.4], upperArmR: [-0.4, 0, -1.4], root: [0, -0.06, 0] } },
  spin: { wind: { upperArmL: [0, 0, 1.4], upperArmR: [0, 0, -1.4] },
    strike: { upperArmL: [0, 0, 1.5], upperArmR: [0, 0, -1.5], body: [0, PI * 2, 0], root: [0, 0.05, 0] } },
  // right-hand thrust (projectile throw / palm)
  special: { wind: { upperArmR: [0.4, 0, -0.45], foreArmR: [-1.6, 0, 0], chest: [0, -0.4, 0], spine: [0.05, -0.1, 0], upperArmL: [-0.6, 0, 0.3] },
    strike: { upperArmR: [-1.55, 0, 0.08], foreArmR: [-0.05, 0, 0], handR: [0.5, 0, 0], chest: [0, 0.45, 0], spine: [0.15, 0.1, 0], upperArmL: [0.3, 0, 0.5], foreArmL: [-1.2, 0, 0],
      thighL: [-0.5, 0, 0.12], shinL: [0.6, 0, 0], thighR: [0.3, 0, -0.12], root: [0, -0.03, 0] } },
  upspecial: { wind: { root: [0, -0.07, 0], spine: [0.45, 0, 0], upperArmR: [0.45, 0, -0.3], foreArmR: [-1.4, 0, 0], thighL: [-0.8, 0, 0.1], thighR: [-0.8, 0, -0.1], shinL: [1.3, 0, 0], shinR: [1.3, 0, 0] },
    strike: { upperArmR: [-2.95, 0, -0.05], foreArmR: [0, 0, 0], spine: [-0.2, 0, 0], chest: [0, 0.3, 0], head: [-0.2, 0, 0], thighL: [-1.1, 0, 0], shinL: [1.6, 0, 0], thighR: [0.1, 0, 0], shinR: [0.3, 0, 0],
      upperArmL: [0.3, 0, 0.6] } },
  downspecial: { wind: { root: [0, -0.04, 0], spine: [0.35, 0, 0] },
    strike: { spine: [0.2, 0, 0], upperArmL: [-1.0, 0, 0.9], upperArmR: [-1.0, 0, -0.9], foreArmL: [-1.0, 0, 0], foreArmR: [-1.0, 0, 0] } },
  grab: { wind: { upperArmL: [-0.7, 0, 0.35], upperArmR: [-0.7, 0, -0.35], foreArmL: [-0.8, 0, 0], foreArmR: [-0.8, 0, 0], spine: [0.1, 0, 0] },
    strike: { upperArmL: [-1.6, 0, 0.12], upperArmR: [-1.6, 0, -0.12], foreArmL: [0, 0, 0], foreArmR: [0, 0, 0], spine: [0.35, 0, 0], thighL: [-0.75, 0, 0.1], shinL: [0.8, 0, 0], thighR: [0.3, 0, -0.1], root: [0, -0.04, 0.03] } },
  throwf: { wind: { ...P.grabhold, spine: [-0.25, -0.45, 0] },
    strike: { upperArmL: [-1.75, 0, 0.3], upperArmR: [-1.75, 0, -0.3], spine: [0.55, 0.4, 0], thighL: [-0.8, 0, 0.1], shinL: [0.9, 0, 0], thighR: [0.35, 0, -0.1] } },
  throwb: { wind: { ...P.grabhold }, strike: { body: [0, PI, 0], upperArmL: [-1.75, 0, 0.3], upperArmR: [-1.75, 0, -0.3], spine: [0.45, 0, 0] } },
  taunt: { wind: { upperArmR: [-1.0, 0, -1.0] }, strike: { upperArmR: [-2.9, 0, -0.2], foreArmR: [-0.5, 0, 0], head: [-0.2, 0.4, 0], upperArmL: [0, 0, 0.6], foreArmL: [-1.5, 0, 0] } },
  // floor attack: sits up low and sweeps the legs out front and back
  getup: { wind: { ...P.lying }, strike: { root: [0, -0.28, 0], spine: [0.35, 0, 0], neck: [-0.3, 0, 0], thighR: [-1.55, 0, -0.15], shinR: [0.05, 0, 0], footR: [0.4, 0, 0],
    thighL: [1.25, 0, 0.15], shinL: [0.1, 0, 0], upperArmL: [0.4, 0, 0.9], upperArmR: [0.4, 0, -0.9], foreArmL: [-0.3, 0, 0], foreArmR: [-0.3, 0, 0] } },
  ledgeattack: { wind: { ...P.crouch }, strike: { thighR: [-1.55, 0, 0], shinR: [0.05, 0, 0], footR: [0.4, 0, 0], spine: [-0.15, 0, 0], thighL: [0.1, 0, 0.1], shinL: [0.3, 0, 0], upperArmL: [0.3, 0, 0.8], upperArmR: [0.3, 0, -0.8] } },
  roll: { wind: { ...P.crouch }, strike: { ...P.crouch, body: [PI * 2, 0, 0], root: [0, -0.05, 0] } },

  // ---- extra archetypes ----
  // knee strike (right knee driven up/forward)
  knee: { wind: { thighR: [-0.4, 0, 0], shinR: [1.4, 0, 0], spine: [0.2, 0, 0], upperArmL: [0.4, 0, 0.4], upperArmR: [0.4, 0, -0.4] },
    strike: { thighR: [-1.9, 0, -0.05], shinR: [2.3, 0, 0], footR: [0.5, 0, 0], spine: [-0.2, 0, 0], thighL: [0.15, 0, 0.05], shinL: [0.2, 0, 0], upperArmL: [0.6, 0, 0.6], upperArmR: [0.6, 0, -0.6],
      foreArmL: [-0.9, 0, 0], foreArmR: [-0.9, 0, 0], root: [0, 0.02, 0] } },
  // rising elbow / uppercut (right arm swung up in front of the face)
  elbowUp: { wind: { root: [0, -0.06, 0], spine: [0.4, 0, 0], chest: [0, -0.4, 0], upperArmR: [0.5, 0, -0.4], foreArmR: [-2.0, 0, 0], thighL: [-0.7, 0, 0.1], shinL: [1.1, 0, 0], thighR: [-0.5, 0, -0.1], shinR: [1.0, 0, 0] },
    strike: { spine: [-0.35, 0, 0], chest: [0, 0.45, 0], upperArmR: [-2.6, 0, 0.3], foreArmR: [-1.6, 0, 0], upperArmL: [0.4, 0, 0.6], foreArmL: [-1.2, 0, 0], head: [-0.3, 0, 0], root: [0, 0.03, 0] },
    follow: { spine: [-0.25, 0, 0], upperArmR: [-2.9, 0, -0.3], foreArmR: [-1.0, 0, 0] } },
  // backhand: right arm swung out behind
  backfist: { wind: { chest: [0, 0.6, 0], upperArmR: [-1.4, 0, 0.6], foreArmR: [-1.6, 0, 0], spine: [0.3, 0, 0] },
    strike: { chest: [0, -0.5, 0], spine: [0.35, -0.3, 0], upperArmR: [1.5, 0, -0.25], foreArmR: [-0.05, 0, 0], head: [0, -0.6, 0], thighL: [-0.7, 0, 0], shinL: [1.2, 0, 0], thighR: [-0.4, 0, 0], shinR: [1.0, 0, 0] } },
  // open-palm shove (right), low stance
  palm: { wind: { spine: [0.0, -0.35, 0], chest: [-0.2, -0.5, 0], upperArmR: [0.7, 0, -0.5], foreArmR: [-1.9, 0, 0], handR: [0.8, 0, 0], thighL: [-0.6, 0, 0.12], shinL: [0.9, 0, 0], root: [0, -0.04, -0.02] },
    strike: { spine: [0.3, 0.15, 0], chest: [0, 0.55, 0], upperArmR: [-1.5, 0, 0.12], foreArmR: [-0.1, 0, 0], handR: [1.2, 0, 0], upperArmL: [0.4, 0, 0.6], foreArmL: [-1.1, 0, 0],
      thighL: [-1.05, 0, 0.15], shinL: [1.3, 0, 0], thighR: [0.6, 0, -0.12], shinR: [0.35, 0, 0], footR: [-0.4, 0, 0], root: [0, -0.08, 0.07] } },
  // two-footed dropkick forward (body horizontal)
  dropkick: { wind: { thighL: [-1.4, 0, 0.1], thighR: [-1.4, 0, -0.1], shinL: [2.0, 0, 0], shinR: [2.0, 0, 0], spine: [0.3, 0, 0] },
    strike: { ...rotAbout({ thighL: [-1.45, 0, 0.08], thighR: [-1.45, 0, -0.08], shinL: [0.05, 0, 0], shinR: [0.05, 0, 0], footL: [0.4, 0, 0], footR: [0.4, 0, 0], upperArmL: [0.6, 0, 1.0], upperArmR: [0.6, 0, -1.0] }, -0.9, 0, 0) } },
  // headbutt forward
  headbutt: { wind: { spine: [-0.4, 0, 0], neck: [-0.4, 0, 0], upperArmL: [0.5, 0, 0.5], upperArmR: [0.5, 0, -0.5] },
    strike: { spine: [0.9, 0, 0], neck: [0.3, 0, 0], head: [0.3, 0, 0], upperArmL: [0.8, 0, 0.5], upperArmR: [0.8, 0, -0.5], thighL: [-0.7, 0, 0], shinL: [0.9, 0, 0], thighR: [0.5, 0, 0], root: [0, -0.04, 0.06] } },
};
// mirrored variants of every archetype
for (const [k, a] of Object.entries({ ...ATK })) {
  const m = {};
  for (const [ph, pose] of Object.entries(a)) m[ph] = mirrorPose(pose);
  ATK[k + 'M'] = m;
}

// Which side's limbs an archetype strikes with: the striking limb is swung far from hanging (big upper-limb
// angle) and nearly straight (small elbow/knee bend). Returns 'L', 'R' or null (symmetric).
function strikeSide(a) {
  const s = { ...P.idle, ...(a.strike ?? {}) };
  const score = side => ['upperArm', 'thigh'].reduce((acc, b) => {
    const up = s[b + side] ?? [0, 0, 0], lo = s[(b === 'thigh' ? 'shin' : 'foreArm') + side] ?? [0, 0, 0];
    return acc + Math.abs(up[0]) - 0.5 * Math.abs(lo[0]);
  }, 0);
  const l = score('L'), r = score('R');
  return Math.abs(l - r) < 0.4 ? null : l > r ? 'L' : 'R';
}
// Pick the archetype variant (`name` or `name + 'M'`) whose striking side matches the side of the limbs
// the move's hitboxes are attached to.
export function autoSide(name, hitboxes) {
  const a = ATK[name]; if (!a || !hitboxes?.length) return name;
  let l = 0, r = 0;
  for (const h of hitboxes) { const m = /^(upperArm|foreArm|hand|thigh|shin|foot)(L|R)$/.exec(h.bone ?? ''); if (m) m[2] === 'L' ? l++ : r++; }
  if (l === r) return name;
  const want = l > r ? 'L' : 'R', have = strikeSide(a);
  return have && have !== want && ATK[name + 'M'] ? name + 'M' : name;
}

// Phase timing of a move for the phased sampler: first/last active frame and animation length.
// Shared by the renderer and by hitbox placement (build.js) so both see the same pose on every frame.
export function moveTiming(m) {
  let s = Infinity, e = -Infinity;
  for (const h of m.hitboxes || []) { s = Math.min(s, h.frames[0]); e = Math.max(e, h.frames[1]); }
  if (m.throwData?.releaseFrame) { s = Math.min(s, m.throwData.releaseFrame); e = Math.max(e, m.throwData.releaseFrame); }
  if (s === Infinity) { s = m.activeFrame ?? Math.max(2, Math.round((m.total || 20) * 0.35)); e = s + 3; }
  return { start: s, end: e, total: m.iasa ? Math.min(m.total, m.iasa + 4) : m.total };
}

// Phased move sampler. timing = { start, end, total } (first active frame, last active frame, total frames).
export function sampleMove(arch, f, timing, rest = P.idle) {
  const a = typeof arch === 'string' ? ATK[arch] : arch;
  if (!a) return rest;
  const s = Math.max(1, timing.start ?? Math.round(timing.total * 0.3));
  const e = Math.max(s, timing.end ?? s + 2);
  const T = Math.max(e + 1, timing.total ?? e + 10);
  // phases are layered over the rest pose so unlisted bones keep the stance
  const strike = { ...rest, ...a.strike };
  const keys = [
    { f: 0, pose: rest },
    { f: Math.max(0.5, s * 0.75), pose: { ...rest, ...a.wind } },
    { f: s, pose: strike },
    { f: e, pose: a.hold ? { ...rest, ...a.hold } : strike },
    { f: e + (T - e) * 0.5, pose: a.follow ? { ...rest, ...a.follow } : strike },
    { f: T, pose: rest },
  ];
  return sampleKeys(keys, f);
}
