// Low-poly character rigs built from primitives, N64 style (flat/Gouraud shaded, few segments).
// A rig is a tree of THREE.Group "bones". Poses are maps bone -> [rx, ry, rz] (radians), plus
// optional `root` [x, y, z] offset and `scale` [sx, sy, sz] on the body. All character models are
// built in "model units" where 1.0 = the character's standing height; the fighter scales the rig.
import * as THREE from 'three';

const matCache = new Map();
export function mat(color, opts = {}) {
  const key = color + JSON.stringify(opts);
  if (matCache.has(key)) return matCache.get(key);
  const m = new THREE.MeshLambertMaterial({ color, flatShading: !!opts.flat, transparent: !!opts.opacity, opacity: opts.opacity ?? 1,
    emissive: opts.emissive ?? 0x000000, side: opts.side ?? THREE.FrontSide });
  matCache.set(key, m);
  return m;
}

// Primitive kit. Sizes are in model units. Every function returns a Mesh positioned at `at`.
export const kit = {
  box(w, h, d, color, at = [0, 0, 0], opts = {}) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color, opts));
    m.position.set(...at); return m;
  },
  sphere(r, color, at = [0, 0, 0], opts = {}) {
    const seg = opts.seg ?? 8;
    const m = new THREE.Mesh(new THREE.SphereGeometry(r, seg, Math.max(4, Math.round(seg * 0.75))), mat(color, opts));
    m.position.set(...at); if (opts.scale) m.scale.set(...opts.scale); return m;
  },
  // cylinder along +y from 0..h (pivot at top when `hang` true: extends to -y)
  cyl(rTop, rBot, h, color, at = [0, 0, 0], opts = {}) {
    const g = new THREE.CylinderGeometry(rTop, rBot, h, opts.seg ?? 7);
    g.translate(0, opts.hang ? -h / 2 : h / 2, 0);
    const m = new THREE.Mesh(g, mat(color, opts));
    m.position.set(...at); if (opts.rot) m.rotation.set(...opts.rot); return m;
  },
  cone(r, h, color, at = [0, 0, 0], opts = {}) {
    const g = new THREE.ConeGeometry(r, h, opts.seg ?? 6);
    g.translate(0, h / 2, 0);
    const m = new THREE.Mesh(g, mat(color, opts));
    m.position.set(...at); if (opts.rot) m.rotation.set(...opts.rot); return m;
  },
  // limb segment hanging down from the bone origin (capsule-ish: cylinder + end sphere)
  limb(r, len, color, opts = {}) {
    const grp = new THREE.Group();
    grp.add(kit.cyl(opts.r2 ?? r, r, len, color, [0, 0, 0], { hang: true, seg: opts.seg ?? 6 }));
    if (!opts.noJoint) grp.add(kit.sphere(r * 1.02, color, [0, 0, 0], { seg: 6 }));
    return grp;
  },
};

// Standard humanoid skeleton. `P` gives proportions in model units.
// Defaults roughly fit a Mario-like body; characters override.
export const DEFAULT_PROPS = {
  hipY: 0.42, spine: 0.16, chest: 0.14, neck: 0.04,
  shoulderX: 0.13, shoulderY: 0.12, upperArm: 0.14, foreArm: 0.13,
  hipX: 0.07, thigh: 0.2, shin: 0.18,
};

export function makeSkeleton(P = {}) {
  P = { ...DEFAULT_PROPS, ...P };
  const b = {};
  const G = (name, parent, pos) => { const g = new THREE.Group(); g.name = name; g.position.set(...pos); if (parent) parent.add(g); b[name] = g; return g; };
  b.root = G('root', null, [0, 0, 0]);
  b.body = G('body', b.root, [0, 0, 0]);       // whole-body transform (spins, squash)
  G('hips', b.body, [0, P.hipY, 0]);
  G('spine', b.hips, [0, 0, 0]);
  G('chest', b.spine, [0, P.spine, 0]);
  G('neck', b.chest, [0, P.chest, 0]);
  G('head', b.neck, [0, P.neck, 0]);
  for (const s of ['L', 'R']) {
    const sx = s === 'L' ? 1 : -1;      // model faces +z; +x is the character's left
    G('shoulder' + s, b.chest, [sx * P.shoulderX, P.shoulderY, 0]);
    G('upperArm' + s, b['shoulder' + s], [0, 0, 0]);
    G('foreArm' + s, b['upperArm' + s], [0, -P.upperArm, 0]);
    G('hand' + s, b['foreArm' + s], [0, -P.foreArm, 0]);
    G('thigh' + s, b.hips, [sx * P.hipX, 0, 0]);
    G('shin' + s, b['thigh' + s], [0, -P.thigh, 0]);
    G('foot' + s, b['shin' + s], [0, -P.shin, 0]);
  }
  b.props = P;
  return b;
}

// Bones whose rotation poses may drive
export const POSE_BONES = ['body', 'hips', 'spine', 'chest', 'neck', 'head',
  'shoulderL', 'upperArmL', 'foreArmL', 'handL', 'shoulderR', 'upperArmR', 'foreArmR', 'handR',
  'thighL', 'shinL', 'footL', 'thighR', 'shinR', 'footR', 'extra1', 'extra2', 'extra3'];

export function lerpPose(a, b, t) {
  const out = {};
  const keys = new Set([...Object.keys(a || {}), ...Object.keys(b || {})]);
  for (const k of keys) {
    const va = a?.[k], vb = b?.[k];
    if (k === 'fx') { out.fx = t < 0.5 ? va : vb; continue; }
    const da = va ?? (k === 'scale' ? [1, 1, 1] : [0, 0, 0]);
    const db = vb ?? (k === 'scale' ? [1, 1, 1] : [0, 0, 0]);
    out[k] = [da[0] + (db[0] - da[0]) * t, da[1] + (db[1] - da[1]) * t, da[2] + (db[2] - da[2]) * t];
  }
  return out;
}

const ease = t => t * t * (3 - 2 * t);

// Sample a keyframed animation: keys = [{f, pose}] sorted by f. Frames between keys are smoothstepped.
export function sampleKeys(keys, f) {
  if (!keys.length) return {};
  if (f <= keys[0].f) return keys[0].pose;
  for (let i = 1; i < keys.length; i++) {
    if (f <= keys[i].f) {
      const k0 = keys[i - 1], k1 = keys[i];
      const t = (f - k0.f) / Math.max(1e-6, k1.f - k0.f);
      return lerpPose(k0.pose, k1.pose, k1.linear ? t : ease(t));
    }
  }
  return keys[keys.length - 1].pose;
}

export function applyPose(bones, pose, rest) {
  for (const name of POSE_BONES) {
    const bone = bones[name]; if (!bone) continue;
    const r = pose[name] || [0, 0, 0];
    const base = rest?.[name] || [0, 0, 0];
    bone.rotation.set(base[0] + r[0], base[1] + r[1], base[2] + r[2]);
  }
  const ro = pose.root || [0, 0, 0];
  bones.body.position.set(ro[0], ro[1], ro[2]);
  const sc = pose.scale || [1, 1, 1];
  bones.body.scale.set(sc[0], sc[1], sc[2]);
}
