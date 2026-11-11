// Jigglypuff specials (reference/spec/chars/jigglypuff.json behaviour notes, decomp ftpurinspecial*.c,
// ftcommonfurasleep.c) + render-side effects (Sing notes / rings, Rest bubble).
import * as THREE from 'three';

const S = 80;
const sign = v => (v > 0 ? 1 : v < 0 ? -1 : 0);
const DEG = Math.PI / 180;

// Pound: slap frames 12-27 (13%, angle 120, +20 shield damage). Air: at frame 12 lunge 65 u/f along +-20 deg
// chosen by stick Y (|y| clamped 10..50), x0.92 per frame until frame 30, then drift/fast-fall. Before frame
// 12: gravity + air friction (no drift). Ground: a short step forward with the slap.
export function pound() {
  return {
    groundOK: true, keepOnFall: true, noAirFriction: true,
    script(f, mf, c) {
      if (mf === 12) f.match.emit('sfx', { name: 'whiffL' });
      if (f.grounded) { if (mf >= 10 && mf <= 18) f.vx = f.facing * 9; return; }
      if (mf < 12) { f.noGravity = false; f.airFriction(); return; }
      if (mf === 12) {
        const y = Math.round(c.y * S); let a = Math.min(50, Math.abs(y)) - 10; if (a < 0) a = 0;
        const ang = sign(y) * a * 20 / 40 * DEG;
        f.vx = Math.cos(ang) * f.facing * 65; f.vy = Math.sin(ang) * 65; f.fastfall = false;
      }
      if (mf < 30) { f.noGravity = true; f.vx *= 0.92; f.vy *= 0.92; return; }
      f.noGravity = false; f.airDrift(c);
    },
  };
}

// Sing: three sleep pulses (28-35 r300, 69-76 r300, 113-125 r380; a tiny r30 box stays between them),
// grounded targets only. A victim falls asleep (standing doze) for max(300 - %, 0) + 75 frames; mashing
// shortens it (fighter.js 'sleep' state). 179 frames, works in the air (slow fall with drift).
export function sing() {
  return {
    groundOK: true, keepOnFall: true, drift: true, driftMul: 0.6, sfx: 'sleep',
    script(f, mf) {
      if (mf === 28 || mf === 69 || mf === 113) f.match.emit('sfx', { name: 'sleep' });
      if (!f.grounded) f.gravMul = 0.6;
    },
    onHit(a, v, hb) {
      if (hb.element !== 'sleep' || v.dead) return;
      // undo the token knockback of the 0% hit and put the victim to sleep
      v.kbx = v.kby = 0; v.kbGround = 0; v.vx = 0; v.vy = 0; v.hitstun = 0;
      a.match.snapToFloor(v);            // the token knockback may have lifted it off the floor
      if (!v.grounded) return;
      v.setState('sleep');
      v.sleepTimer = Math.max(300 - v.percent, 0) + 75;
      a.match.emit('sfx', { name: 'sleep' });
    },
  };
}

// Rest: 1-frame 20% hit (frame 1, r130 at y150), intangible 1-29, then fast asleep until frame 249.
export function rest() {
  return {
    groundOK: true, keepOnFall: true, sfx: 'sleep',
    onStart(f) { f.vx *= 0.3; },
    script(f, mf) {
      if (mf <= 29) f.intangible = Math.max(f.intangible, 1);
      if (mf === 1) f.match.emit('sfx', { name: 'sleep' });
      if (mf % 60 === 30) f.match.emit('sfx', { name: 'sleep' });
    },
  };
}

// ---- effects ----
function noteMesh(color) {
  const g = new THREE.Group();
  const m = new THREE.MeshBasicMaterial({ color, transparent: true, depthWrite: false });
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), m); head.scale.set(1.3, 1, 0.5); g.add(head);
  const stem = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.16, 0.015), m); stem.position.set(0.055, 0.08, 0); g.add(stem);
  const flag = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.02, 0.015), m); flag.position.set(0.08, 0.15, 0); flag.rotation.z = -0.5; g.add(flag);
  return g;
}
export function puffFx(view, f) {
  const fx = view.puffFx ??= (() => {
    const notes = [0xff60a0, 0x60c0ff, 0xffe040, 0x80ff80].map(c => { const n = noteMesh(c); view.root.add(n); return n; });
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.85, 1, 28), new THREE.MeshBasicMaterial({ color: 0xffc0ff, transparent: true, opacity: 0.5, depthWrite: false, side: THREE.DoubleSide }));
    view.root.parent.add(ring);
    const bubble = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), new THREE.MeshBasicMaterial({ color: 0xc8f0ff, transparent: true, opacity: 0.55, depthWrite: false }));
    view.root.add(bubble);
    const eyes = [], lids = [];
    view.root.traverse(o => { if (o.userData?.eye) eyes.push(o); if (o.userData?.lid) lids.push(o); });
    return { notes, ring, bubble, eyes, lids };
  })();
  const id = f.state === 'attack' ? f.move?.id : null, mf = f.mf;
  const singing = id === 'uspecial' || id === 'uspecialAir';
  fx.notes.forEach((n, i) => {
    n.visible = singing && mf > 8 && mf < 170;
    if (!n.visible) return;
    const t = (mf + i * 20) % 80 / 80;
    n.position.set(Math.sin((t + i) * 6) * 0.45, 0.8 + t * 0.6, 0.2 + (i % 2) * 0.2);
    n.scale.setScalar(1.2 * (1 - t * 0.3));
    n.children.forEach(c => { c.material.opacity = 1 - t; });
  });
  const pulse = [[28, 35, 300], [69, 76, 300], [113, 125, 380]].find(([s, e]) => mf >= s - 2 && mf <= e + 6);
  fx.ring.visible = singing && !!pulse;
  if (fx.ring.visible) {
    const k = (mf - pulse[0] + 2) / (pulse[1] - pulse[0] + 8);
    const r = pulse[2] * 0.01 * (0.4 + 0.6 * k);
    fx.ring.position.set(f.x * 0.01, (f.y + f.H * 0.55) * 0.01, 0.3);
    fx.ring.scale.setScalar(r); fx.ring.material.opacity = 0.6 * (1 - k * 0.6);
  }
  // eyes: closed while asleep (Rest), during the Sing pulses' ends and for an occasional blink
  const sleeping = f.state === 'sleep' || ((id === 'dspecial' || id === 'dspecialAir') && mf > 4 && mf < 236);
  const blink = f.state === 'idle' && (f.match?.frame ?? 0) % 150 < 6;
  const closed = sleeping || blink;
  fx.eyes.forEach(e => { e.visible = !closed; });
  fx.lids.forEach(l => { l.visible = closed; });
  // Rest: snot bubble growing and shrinking while asleep
  const resting = (id === 'dspecial' || id === 'dspecialAir') && mf > 30;
  fx.bubble.visible = resting;
  if (resting) {
    const s = 0.6 + 0.6 * Math.abs(Math.sin(mf * 0.04));
    fx.bubble.position.set(0.0, 0.42, 0.42); fx.bubble.scale.setScalar(s);
  }
}
