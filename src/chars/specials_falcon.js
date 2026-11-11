// Captain Falcon specials (numbers from reference/spec/chars/falcon.json behaviour notes and the decomp
// ftcaptainspecial*.c / FTCaptainAnim*.c root-motion tracks) + helpers shared by the Falcon / Jigglypuff /
// Mario modules (data adapter, root-motion curves).
import * as THREE from 'three';

const S = 80;
const sign = v => (v > 0 ? 1 : v < 0 ? -1 : 0);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const DEG = Math.PI / 180;

// Adapt generated decomp move data to our rig:
//  - `scale`: hitbox offsets are in the decomp model's units; our model is that skeleton uniformly scaled
//    to attr.height, so offsets are multiplied by attr.height / (decomp model height in model units).
//  - `swapSides`: the research labelled this character's joints with left/right swapped (joint tree:
//    +x side = character's left); swap L<->R on limb bones except where `keep(moveId, hitbox)` is true.
export function adaptData(data, { scale = 1, swapSides = false, keep = () => false } = {}) {
  const LR = /^(upperArm|foreArm|hand|thigh|shin|foot)(L|R)$/;
  const moves = {};
  for (const [id, m] of Object.entries(data.moves)) {
    moves[id] = { ...m, hitboxes: (m.hitboxes ?? []).map(h => {
      let bone = h.bone;
      if (swapSides && LR.test(bone) && !keep(id, h)) bone = bone.slice(0, -1) + (bone.endsWith('L') ? 'R' : 'L');
      return { ...h, bone, off: (h.off ?? [0, 0, 0]).map(v => v * scale) };
    }) };
  }
  return { ...data, moves };
}
// copy data hitboxes for a move override (adds the `size` field makeChar normally adds)
export const hbs = (list, patch = {}) => list.map(h => ({ ...h, size: h.r, ...(typeof patch === 'function' ? patch(h) : patch) }));

// ---- root motion: piecewise cubic Hermite tracks (HAL AObj SetValRate semantics) ----
// segs: [[startFrame, duration, v0, v1, rate0, rate1], ...] in decomp units (values /4, rates /32 already applied)
export function track(segs) {
  return t => {
    let v = segs[0][2];
    for (const [s, d, v0, v1, r0, r1] of segs) {
      if (t < s) break;
      const u = Math.min(1, (t - s) / d), u2 = u * u, u3 = u2 * u;
      v = (2 * u3 - 3 * u2 + 1) * v0 + (u3 - 2 * u2 + u) * d * r0 + (-2 * u3 + 3 * u2) * v1 + (u3 - u2) * d * r1;
    }
    return v;
  };
}
const lin = (s, d, v0, v1) => [s, d, v0, v1, (v1 - v0) / d, (v1 - v0) / d];

// ======================= Falcon Punch =======================
// 42-frame wind-up, punch frames 42-46 (24/25/26%). Ground: lunges forward with the anim root motion
// (FTCaptainAnimFalconPunchGround TRAZ: ~316 model units during frames 40-50). Air: normal gravity and air
// friction until frame 40, then 65 u/f along +-30 deg chosen by stick Y (|y| clamped 10..50), decaying x0.92
// per frame (frames 40-54), drift/fast-fall from 55.
const fpZ = track([[0, 40, 0, 0.25, 0, 1.16], [40, 10, 0.25, 316, 2.9, 4.2], [50, 40, 316, 352, 4.2, 0.2]]);
export function falconPunch(o = {}) {
  const size = o.size ?? 1.05;
  return {
    groundOK: true, keepOnFall: true, noAirFriction: true, sfx: 'charge', activeFrame: 42,
    onStart(f) { f.vars.fpAir = !f.grounded; },
    script(f, mf, c) {
      if (mf === 1) f.match.emit('sfx', { name: 'charge' });
      if (mf === 42) { f.match.emit('sfx', { name: 'fire' }); f.match.emit('sfx', { name: 'hitL' }); }
      if (f.grounded) {
        const dz = (fpZ(mf) - fpZ(mf - 1)) * size;
        f.vx = dz * f.facing;
        return;
      }
      if (mf < 40) { f.noGravity = false; f.airFriction(); return; }
      if (mf === 40) {
        let y = Math.round(c.y * S), a = Math.min(50, Math.abs(y)) - 10;
        if (a < 0) a = 0;
        const ang = sign(y) * a * 30 / 40 * DEG;
        f.vx = Math.cos(ang) * f.facing * 65; f.vy = Math.sin(ang) * 65; f.fastfall = false;
      }
      if (mf <= 54) { f.noGravity = true; f.vx *= 0.92; f.vy *= 0.92; return; }
      f.noGravity = false; f.airDrift(c);
    },
  };
}

// ======================= Falcon Dive =======================
// Leaping grab. Root motion (FTCaptainAnimFalconDive TransN, x1.05): rises ~1490 by frame 34 then sinks to
// ~404 by the end (64 frames); forward ~386. No gravity; stick drift with air accel x1.1, max speed x0.8.
// Grab boxes 13-44 (id1 frame 13, grounded only). Helpless after (drift x0.72, landing lag 17).
// Catch: hold 20 frames (CatchingEnemyWhileDiving), then the explosion throw (20% fire, 361, kbg 82, bkb 30)
// and Falcon jumps off backward (FalconDiveEnd1 root motion) and can act again.
const diveY = track([[0, 13, 0, 1.5, 0.16, 0], [13, 21, 1.5, 1489.75, 124, 22.25], [34, 31, 1489.75, 404.25, 22.25, -64]]);
const diveZ = track([lin(0, 13, 0, -1.25), lin(13, 52, -1.25, 386.25)]);
const endY = track([[0, 3, 3.5, 161, 1, 0], [3, 12, 161, 1104, 154.8, 19.2], [15, 45, 1104, 900, 19.2, -17.7]]);
const endZ = track([[0, 3, 0, -2.5, -6.8, -22], [3, 12, -2.5, -302.75, -22, -18.1], [15, 25, -302.75, -561.5, -18.1, -7.1], [40, 20, -561.5, -600, -7.1, 1.6]]);
export function falconDive(o = {}) {
  const size = o.size ?? 1.05;
  return {
    helpless: true, helplessLand: 17, helplessDrift: 0.72, groundOK: false, keepOnFall: true,
    ledgeGrab: true, ledgeGrabFrom: 49, noAirFriction: true, sfx: 'jump2',
    onStart(f) {
      f.vars.dvx = 0;
      f.jumpsUsed = f.a.jumps;
      if (f.grounded) { f.grounded = false; f.ground = null; f.y += 1; }
      f.vx = 0; f.vy = 0; f.fastfall = false;
    },
    script(f, mf, c) {
      if (mf === 13 && Math.abs(c.x) * S > 18 && sign(c.x) !== f.facing) f.facing = sign(c.x);
      if (mf >= 13 && mf <= 44) f.diveFrame = f.match.frame + 0;   // grab boxes live: onGrab -> catch
      if (mf === 13) f.match.emit('sfx', { name: 'grab' });
      // stick drift on the stored velocity (accel x1.1, max x0.8), then add the anim root motion
      const a = f.a, X = c.x * S, max = a.airMax * 0.8;
      let v = f.vars.dvx;
      if (Math.abs(v) > max) v -= sign(v) * a.airFric;
      else {
        if (Math.abs(X) >= 8) v = clamp(v + X * a.airAccel * 1.1, -max, max);
        if (Math.abs(v) <= a.airFric) v = 0; else v -= sign(v) * a.airFric;
      }
      f.vars.dvx = v;
      f.noGravity = true;
      if (f.grounded && mf > 1) return;
      f.vx = v + (diveZ(mf) - diveZ(mf - 1)) * size * f.facing;
      f.vy = (diveY(mf) - diveY(mf - 1)) * size;
    },
  };
}
// hold the caught opponent for 20 frames
export const diveCatch = (o = {}) => ({
  total: 20, noStale: true, noAirFriction: true, groundOK: true, keepOnFall: true, after: 'diveThrow',
  onStart(f) { f.vx = 0; f.vy = 0; },
  script(f, mf) {
    f.noGravity = true; f.vx = 0; f.vy = 0;
    const v = f.vars.victim;
    if (v && v.grabbedBy === f) {
      // pull the victim to the hands (max 180 u/f)
      const tx = f.x + f.facing * f.a.width * 1.1, ty = f.y + f.H * 0.45;
      const dx = tx - v.x, dy = ty - v.y, d = Math.hypot(dx, dy), k = d > 180 ? 180 / d : 1;
      v.x += dx * k; v.y += dy * k; v.facing = -f.facing;
      v.grounded = false; v.ground = null;
    }
  },
});
// explosion throw + jump off
export const diveThrow = (o = {}) => {
  const size = o.size ?? 1.05;
  return {
    total: 60, iasa: 40, noStale: false, noAirFriction: true, noTurn: true, groundOK: true, keepOnFall: true,
    throwData: { damage: 20, angle: 361, kbg: 82, bkb: 30, fkb: 0, element: 'fire', releaseFrame: 1 },
    script(f, mf, c) {
      if (mf === 1) {
        f.match.emit('sfx', { name: 'explode' });
        const v = f.vars.victim;
        if (v) f.match.emit('hit', { f: v, a: f, x: v.x, y: v.y + v.H * 0.5, dmg: 20, kb: 100, element: 'fire' });
      }
      if (f.grounded && mf <= 3) { f.grounded = false; f.ground = null; f.y += 1; }
      if (f.grounded) return;
      f.noGravity = mf < 45;
      if (mf < 45) {
        f.vx = (endZ(mf) - endZ(mf - 1)) * size * f.facing;
        f.vy = (endY(mf) - endY(mf - 1)) * size;
      } else f.airDrift(c);
    },
  };
};

// ======================= Falcon Kick =======================
// Ground: flaming slide kick, root motion (FTCaptainAnimDownSpecial TRAZ x1.05: bursts at ~145 u/f from
// frame 11, ~2590 by frame 51, 2702 by the end), total 84; can slide off edges.
// Air: dives diagonally down (FTCaptainAnimDownSpecialAir: up ~83 by frame 16, then ~-118 u/f down and
// ~40 u/f forward; first 6 frames at half speed), 49 frames; landing -> 12% landing hit + 45 frames lag.
const fkZ = track([[0, 11, 0, -2, -0.4, -1.9], [11, 40, -2, 2591.5, 145, 18.4], [51, 19, 2591.5, 2701.75, 16, 1.1], [70, 15, 2701.75, 2701.75, 1.5, 0]]);
const fkAirY = track([[0, 16, 0, 83.25, 24, -16.3], lin(16, 17, 83.25, -1923.75), lin(33, 17, -1923.75, -2853)]);
const fkAirZ = track([lin(0, 17, 0, 71.25), lin(17, 16, 71.25, 715.5), [33, 17, 715.5, 960, 17, 9.9]]);
export function falconKick(o = {}) {
  const size = o.size ?? 1.05;
  if (o.air) return {
    groundOK: false, keepOnFall: true, noAirFriction: true, landMove: 'dspecialLand', sfx: 'fire', total: 49,
    onStart(f) { f.jumpsUsed = Math.max(f.jumpsUsed, 1); f.vx = 0; f.vy = 0; f.fastfall = false; },
    script(f, mf, c) {
      f.noGravity = true;
      const k = mf <= 6 ? 0.5 : 1;
      f.vx = (fkAirZ(mf) - fkAirZ(mf - 1)) * size * k * f.facing;
      f.vy = (fkAirY(mf) - fkAirY(mf - 1)) * size * k;
      if (mf === 12) f.match.emit('sfx', { name: 'fire' });
    },
  };
  return {
    groundOK: true, keepOnFall: true, walkOff: true, keepVel: true, noAirFriction: true, sfx: 'fire',
    script(f, mf) {
      if (mf === 12) f.match.emit('sfx', { name: 'fire' });
      const dz = (fkZ(mf) - fkZ(mf - 1)) * size;
      if (f.grounded) f.vx = dz * f.facing;
      else { f.noGravity = false; f.vx = dz * f.facing * 0.6; }
    },
  };
}

// ======================= effects (render side) =======================
// Flaming falcon around the fist for the Falcon Punch, flames on the leg for Falcon Kick / fsmash, a spark
// trail during Falcon Dive. Called from def.animExtra(view, f, pose) every rendered frame.
function flameMat(color, opacity) { return new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide }); }
function makeFalconBird() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.26, 5), flameMat(0xff6a10, 0.9));
  body.rotation.z = -Math.PI / 2; g.add(body);                              // beak/body pointing forward (+x in group)
  for (const s of [1, -1]) {
    const w = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.3, 4), flameMat(0xff9a18, 0.85));
    w.position.set(-0.06, s * 0.12, 0); w.rotation.z = s * 2.2; g.add(w);
    const w2 = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.22, 4), flameMat(0xe83a08, 0.85));
    w2.position.set(-0.13, s * 0.16, 0); w2.rotation.z = s * 2.6; g.add(w2);
  }
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), flameMat(0xffe070, 0.95));
  g.add(core);
  return g;
}
function makeLegFire() {
  const g = new THREE.Group();
  for (let i = 0; i < 5; i++) {
    const c = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.14, 5), flameMat(i % 2 ? 0xff6010 : 0xffc040, 0.75));
    c.position.set((i % 2 ? 0.02 : -0.02), -0.04 * i, 0); g.add(c);
  }
  return g;
}
export function falconFx(view, f) {
  const fx = view.falconFx ??= (() => {
    const bird = makeFalconBird(); view.root.add(bird);
    const legL = makeLegFire(); view.bones.shinL.add(legL);
    const legR = makeLegFire(); view.bones.shinR.add(legR);
    const glow = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), flameMat(0xff8020, 0.55)); view.bones.handR.add(glow);
    return { bird, legL, legR, glow };
  })();
  const id = f.state === 'attack' ? f.move?.id : null, mf = f.mf;
  // Falcon Punch: hand glows during the wind-up, the flaming falcon bursts out on the punch
  const fp = id === 'nspecial' || id === 'nspecialAir';
  fx.glow.visible = fp && mf >= 8 && mf < 42;
  if (fx.glow.visible) fx.glow.scale.setScalar(0.6 + 0.6 * Math.abs(Math.sin(mf * 0.5)));
  fx.bird.visible = fp && mf >= 40 && mf <= 54;
  if (fx.bird.visible) {
    const k = (mf - 40) / 14;
    view.bones.handR.updateWorldMatrix(true, false);
    const p = new THREE.Vector3(0, -0.04, 0); view.bones.handR.localToWorld(p); view.root.worldToLocal(p);
    fx.bird.position.copy(p).add(new THREE.Vector3(0, 0, 0.06 + k * 0.12));
    fx.bird.rotation.set(0, -Math.PI / 2, 0);
    fx.bird.scale.setScalar(0.9 + Math.sin(k * Math.PI) * 0.7);
    fx.bird.children.forEach(m => { m.material.opacity = 0.9 * (1 - k * 0.7); });
  }
  // flames on the kicking leg: Falcon Kick (left leg) frames 10-32, fire fsmash (right leg)
  const fk = (id === 'dspecial' || id === 'dspecialAir') && mf >= 10 && mf <= 33;
  const fs = /^fsmash/.test(id ?? '') && mf >= 15 && mf <= 24;
  fx.legL.visible = fk; fx.legR.visible = fs;
  for (const g of [fx.legL, fx.legR]) if (g.visible) g.children.forEach((c, i) => { c.scale.setScalar(0.8 + 0.5 * Math.abs(Math.sin(mf * 0.9 + i))); c.position.z = 0.02 * Math.sin(mf + i); });
}
