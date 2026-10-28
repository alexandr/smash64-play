// GameView: renders a Match with three.js — stage, fighters (rig + pose per state), projectiles,
// items, effects and the follow camera.
import * as THREE from 'three';
import { applyPose, lerpPose } from './rig.js';
import { P, ATK, walkPose, runPose, idlePose, sampleMove, rotAbout } from './anims.js';
import { Effects } from './fx.js';
import { PORT_COLORS } from '../game/constants.js';

export const RS = 0.01;       // render units per game unit
const PI = Math.PI;

export class FighterView {
  constructor(scene, fighter) {
    this.f = fighter;
    const built = fighter.def.model(fighter.def.palettes[fighter.color % fighter.def.palettes.length], fighter);
    this.bones = built.bones ?? built;
    this.rest = built.rest || null;
    this.root = this.bones.root;
    this.extra = built.extra || {};
    this.root.traverse(o => { if (o.isMesh) { o.castShadow = false; } });
    scene.add(this.root);
    // shield bubble
    const col = new THREE.Color(PORT_COLORS[fighter.port] ?? '#888');
    this.shield = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.45, depthWrite: false }));
    scene.add(this.shield);
    this.shadow = new THREE.Mesh(new THREE.CircleGeometry(1, 12), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35, depthWrite: false }));
    this.shadow.rotation.x = -PI / 2;
    scene.add(this.shadow);
    this.meshes = []; this.root.traverse(o => { if (o.isMesh) this.meshes.push(o); });
    this.origMats = this.meshes.map(m => m.material);
    this.flashMats = new Map();
    this.metal = null;
    this.prevPose = null;
    this.spin = 0;
  }
  dispose(scene) { scene.remove(this.root); scene.remove(this.shield); scene.remove(this.shadow); }

  update(match) {
    const f = this.f;
    const visible = !f.dead;
    this.root.visible = visible;
    if (!visible) {
      this.shield.visible = false; this.shadow.visible = false;
      if (f.koKind && f.respawnTimer < 180) this.koAnim(f, match);
      return;
    }
    const s = f.H * RS * (f.def.modelScale ?? 1);
    this.root.scale.setScalar(s);
    let vib = 0;
    if (f.hitlag > 0 && f.hurtFlash > 0) vib = ((f.hitlag % 2) ? 1 : -1) * f.H * 0.025;
    this.root.position.set((f.x + vib) * RS, f.y * RS, 0);
    // face left/right, turned slightly toward the camera like SSB64
    const yaw = f.facing > 0 ? PI / 2 - 0.35 : -PI / 2 + 0.35;
    this.root.rotation.set(0, yaw, 0);
    const pose = this.poseFor(f, match);
    applyPose(this.bones, pose, this.rest);
    if (f.def.animExtra) f.def.animExtra(this, f, pose);
    // flashes: invincibility (white blink), hurt (red/white), charge glow
    const blink = (f.invincible > 0 && Math.floor(match.frame / 3) % 2 === 0) || (f.intangible > 0 && f.state === 'ledge' && false);
    const hurt = f.hurtFlash > 0 && f.hitlag > 0;
    this.setTint(f.metal ? 'metal' : hurt ? 'hurt' : blink ? 'blink' : f.flash > 0 ? 'flash' : null);
    // shield
    const sh = match.isShielding(f);
    this.shield.visible = sh;
    if (sh) {
      const sp = match.shieldSphere(f);
      this.shield.position.set(sp.x * RS, sp.y * RS, 0.0);
      this.shield.scale.setScalar(sp.r * RS);
      this.shield.material.opacity = 0.3 + 0.25 * (f.shieldHP / 55);
    }
    // drop shadow on the floor below
    const fy = f.grounded ? f.y : this.floorBelow(match, f);
    this.shadow.visible = fy !== null && f.state !== 'ledge';
    if (this.shadow.visible) {
      const dist = Math.max(0, f.y - fy);
      const sc = f.Wd * RS * 1.3 * Math.max(0.3, 1 - dist / 3000);
      this.shadow.position.set(f.x * RS, fy * RS + 0.02, 0);
      this.shadow.scale.set(sc, sc * 0.6, 1);
    }
  }
  // Star KO: shrinking fighter flies into the background (vz -83 u/f) and twinkles.
  // Screen KO: the fighter slams into the camera, then slides down out of view.
  koAnim(f, match) {
    const t = f.respawnTimer, cam = match.view?.camera;
    this.root.visible = true;
    const s = f.H * RS * (f.def.modelScale ?? 1);
    const x = Math.max(match.stage.cameraBounds.left, Math.min(match.stage.cameraBounds.right, f.koX ?? 0));
    if (f.koKind === 'star') {
      const k = Math.min(1, t / 70);
      this.root.position.set(x * RS * (1 - k * 0.3), (match.stage.cameraBounds.top * 0.8) * RS * (0.7 + k * 0.3), -83 * t * RS);
      this.root.rotation.set(t * 0.3, t * 0.2, 0);
      this.root.scale.setScalar(s * Math.max(0.05, 1 - k));
      if (t > 70) this.root.visible = false;
      if (t === 72) match.emit('starTwinkle', { x, f });
    } else {
      const cam = this.cameraRef;
      if (!cam) { this.root.visible = false; return; }
      // place in front of the camera, big, then slide down
      const fwd = new cam.position.constructor(); cam.getWorldDirection(fwd);
      const d = 6 + Math.max(0, 30 - t) * 0.5;
      const p = cam.position.clone().add(fwd.multiplyScalar(d));
      p.y -= t > 60 ? (t - 60) * 0.06 : 0;
      this.root.position.copy(p);
      this.root.rotation.set(0, Math.PI, t > 30 ? 0.3 : 0);
      this.root.scale.setScalar(s * 0.9);
      if (t > 150) this.root.visible = false;
    }
  }
  floorBelow(match, f) {
    let best = null;
    for (const fl of match.col.floors) {
      if (!fl.active) continue;
      const p = fl.pts; if (f.x < p[0][0] || f.x > p[p.length - 1][0]) continue;
      for (let i = 0; i < p.length - 1; i++) if (f.x >= p[i][0] && f.x <= p[i + 1][0]) {
        const y = p[i][1] + (p[i + 1][1] - p[i][1]) * (f.x - p[i][0]) / Math.max(1e-6, p[i + 1][0] - p[i][0]);
        if (y <= f.y + 1 && (best === null || y > best)) best = y;
      }
    }
    return best;
  }
  setTint(kind) {
    if (this.tint === kind) return;
    this.tint = kind;
    this.meshes.forEach((m, i) => {
      const base = this.origMats[i];
      if (!kind) { m.material = base; return; }
      const key = kind + base.uuid;
      let mm = this.flashMats.get(key);
      if (!mm) {
        mm = base.clone();
        if (!mm.emissive && kind !== 'metal') { this.flashMats.set(key, base); m.material = base; return; }   // unlit materials can't be tinted
        if (kind === 'metal') { mm.color = new THREE.Color(0x9aa4b0); mm.emissive = new THREE.Color(0x202830); mm = new THREE.MeshPhongMaterial({ color: 0xa0a8b8, specular: 0xffffff, shininess: 80, flatShading: true }); }
        else if (kind === 'hurt') { mm.emissive = new THREE.Color(0xff3020); }
        else if (kind === 'blink') { mm.emissive = new THREE.Color(0x707070); }
        else if (kind === 'flash') { mm.emissive = new THREE.Color(0xffffff); }
        this.flashMats.set(key, mm);
      }
      m.material = mm;
    });
  }

  poseFor(f, match) {
    const t = match.frame;
    const d = f.def;
    const custom = d.anims || {};
    const st = f.state;
    if (custom[st]) return custom[st](f, t);
    switch (st) {
      case 'idle': case 'entry': case 'respawn': return (custom.idle || idlePose)((t % 90) / 90);
      case 'turn': return lerpPose(P.idle, { ...P.idle, body: [0, PI * (f.sf / 4), 0] }, 1);
      case 'walk': return walkPose(((f.walkPhase ?? 0) % 1), Math.min(1, Math.abs(f.vx) / (f.a.walkSpeed || 1) + 0.3));
      case 'dash': case 'run': return runPose(((f.walkPhase ?? (t / 20)) % 1));
      case 'runbrake': return { ...P.land, spine: [-0.3, 0, 0], thighL: [-1.0, 0, 0], shinL: [0.6, 0, 0] };
      case 'runturn': return { ...P.land, body: [0, PI * Math.min(1, f.sf / (f.a.runTurnFrames ?? 14)), 0] };
      case 'squat': return lerpPose(P.idle, P.crouch, Math.min(1, f.sf / 3));
      case 'squatwait': return P.crouch;
      case 'squatrv': return lerpPose(P.crouch, P.idle, Math.min(1, f.sf / 3));
      case 'jumpsquat': return P.jumpsquat;
      case 'jump': return lerpPose(P.jump, P.fall, Math.min(1, Math.max(0, (f.sf - 10) / 25)));
      case 'jumpaerial': {
        const k = Math.min(1, f.sf / 28);
        const flip = d.doubleJumpFlip === false ? 0 : -2 * PI * k;
        return rotAbout(lerpPose(P.jump, P.fall, k), flip, 0, 0, 0.45);
      }
      case 'fall': return P.fall;
      case 'helpless': return P.helpless;
      case 'landing': return P.land;
      case 'shield': case 'shieldstun': return P.shield;
      case 'shieldoff': return lerpPose(P.shield, P.idle, f.sf / 7);
      case 'roll': case 'getuproll': case 'techroll': {
        const tot = st === 'roll' ? (f.a.roll?.total ?? 30) : 35;
        const k = Math.min(1, f.sf / tot);
        const dirSign = (f.rollDir ?? 1) === f.facing ? -1 : 1;
        return rotAbout({ ...P.crouch, root: [0, -0.17, 0] }, dirSign * 2 * PI * k, 0, 0, 0.2);
      }
      case 'tech': return lerpPose(P.lying, P.idle, Math.min(1, f.sf / 20));
      case 'hurt': return f.grounded ? P.hurt : lerpPose(P.hurt, P.fall, 0.3);
      case 'tumble': {
        if (f.hitstun > 0) { const sp = f.sf * 0.35; return rotAbout(P.tumble, sp, 0, 0, 0.45); }
        return { ...P.tumble, body: [0, 0, 0] };
      }
      case 'shieldbreakfly': return rotAbout(P.tumble, f.sf * 0.15, 0, 0, 0.45);
      case 'downbounce': case 'downwait': return P.lying;
      case 'getup': return lerpPose(P.lying, P.idle, Math.min(1, f.sf / 25));
      case 'dizzy': return { ...P.dizzy, body: [0, Math.sin(t * 0.08) * 0.3, Math.sin(t * 0.1) * 0.1] };
      case 'ledge': return P.ledgehang;
      case 'ledgeclimb': case 'ledgeroll': return lerpPose(P.ledgehang, P.crouch, Math.min(1, f.sf / (f.ledgeT?.riseFrames ?? 20)));
      case 'ledgejump': return lerpPose(P.ledgehang, P.jump, Math.min(1, f.sf / 8));
      case 'grabbing': return P.grabhold;
      case 'grabbed': case 'thrown': return P.grabbed;
      case 'sleep': return P.sleep;
      case 'attack': return this.movePose(f, match);
      default: return P.idle;
    }
  }
  movePose(f, match) {
    const m = f.move;
    if (!m) return P.idle;
    if (typeof m.anim === 'function') return m.anim(f, f.mf, P, ATK);
    const timing = m.timing || (m._timing ??= moveTiming(m));
    const rest = m.air ? P.fall : (m.crouch ? P.crouch : P.idle);
    return sampleMove(m.anim || 'jab', f.mf, timing, rest);
  }
}

export function moveTiming(m) {
  const hbs = (m.hitboxes || []).filter(h => !h.grab || true);
  let s = Infinity, e = -Infinity;
  for (const h of hbs) { s = Math.min(s, h.frames[0]); e = Math.max(e, h.frames[1]); }
  if (s === Infinity) { s = m.activeFrame ?? Math.round((m.total || 20) * 0.35); e = s + 3; }
  return { start: s, end: e, total: m.iasa ? Math.min(m.total, m.iasa + 4) : m.total };
}

export class GameView {
  constructor(app, match) {
    this.app = app; this.match = match;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(38, 4 / 3, 2.56, 400);
    const amb = new THREE.AmbientLight(0xffffff, match.stage.ambient ?? 0.65);
    const dir = new THREE.DirectionalLight(0xffffff, match.stage.sun ?? 1.4);
    dir.position.set(...(match.stage.sunDir ?? [-0.4, 1, 0.8]));
    this.scene.add(amb, dir);
    this.stageObj = match.stage.build ? match.stage.build(this.scene, RS) : null;
    this.fviews = match.fighters.map(f => new FighterView(this.scene, f));
    for (const v of this.fviews) v.cameraRef = this.camera;
    this.fx = new Effects(this.scene);
    this.projViews = new Map();
    this.itemViews = new Map();
    this.cam = { x: 0, y: 0, d: 30 };
    this.platformMeshes = new Map();
    this.initCam = false;
  }
  dispose() { this.scene.traverse(o => { if (o.geometry) o.geometry.dispose(); }); }

  sync() {
    const m = this.match;
    for (const v of this.fviews) v.update(m);
    // projectiles
    const seen = new Set();
    for (const p of m.projectiles) {
      seen.add(p);
      let v = this.projViews.get(p);
      if (!v) { v = p.makeView ? p.makeView(this.scene) : defaultProjView(this.scene, p); this.projViews.set(p, v); }
      v.position.set(p.x * RS, p.y * RS, 0.1);
      if (p.updateView) p.updateView(v, m.frame);
    }
    for (const [p, v] of this.projViews) if (!seen.has(p)) { this.scene.remove(v); this.projViews.delete(p); }
    // items
    const seenI = new Set();
    for (const it of m.items.list) {
      seenI.add(it);
      let v = this.itemViews.get(it);
      if (!v) { v = it.def.makeView(this.scene, it); this.itemViews.set(it, v); }
      it.def.syncView?.(v, it, m, RS, this);
    }
    for (const [it, v] of this.itemViews) if (!seenI.has(it)) { this.scene.remove(v); this.itemViews.delete(it); }
    // respawn platforms
    for (const f of m.fighters) {
      let pm = this.platformMeshes.get(f);
      if (f.state === 'respawn') {
        if (!pm) { pm = makeRespawnPlatform(f.port); this.scene.add(pm); this.platformMeshes.set(f, pm); }
        pm.visible = true; pm.position.set(f.x * RS, f.y * RS - 0.02, 0); pm.scale.setScalar(f.H * RS / 4);
        pm.rotation.y = m.frame * 0.05;
      } else if (pm) pm.visible = false;
    }
    if (m.stage.sync) m.stage.sync(this.stageObj, m, RS);
    for (const e of m.events) this.fx.onEvent(e, m, RS);
    this.fx.update();
    this.updateCamera();
  }

  // Battle camera after decomp gmcamera.c (reference/spec/mechanics.md §11.1)
  updateCamera() {
    const m = this.match, st = m.stage;
    const live = m.fighters.filter(f => !f.dead);
    const zoomByCount = [1.5, 1.5, 1.32, 1.16, 1.0][Math.min(4, m.fighters.length)];
    let L = Infinity, R = -Infinity, B = Infinity, T = -Infinity;
    for (const f of live) {
      const z = zoomByCount * (f.state === 'respawn' ? 0.6 : 1) * (f.state === 'idle' && f.sf >= 120 ? 0.75 : 1);
      const cy = f.y + f.H * 0.5;
      const ahead = 1000 * z, behind = 700 * z, v = 700 * z;
      const l = f.facing > 0 ? f.x - behind : f.x - ahead, r = f.facing > 0 ? f.x + ahead : f.x + behind;
      L = Math.min(L, l); R = Math.max(R, r); B = Math.min(B, cy - v); T = Math.max(T, cy + v);
    }
    for (const p of m.projectiles) { L = Math.min(L, p.x - 1000); R = Math.max(R, p.x + 1000); B = Math.min(B, p.y - 1000); T = Math.max(T, p.y + 1000); }
    const cb = st.cameraBounds;
    if (!live.length) { L = cb.left * 0.4; R = cb.right * 0.4; B = 0; T = 1500; }
    L = Math.max(L, cb.left); R = Math.min(R, cb.right); B = Math.max(B, cb.bottom); T = Math.min(T, cb.top);
    if (L > R) { const c = (L + R) / 2; L = R = c; }
    if (B > T) { const c = (B + T) / 2; B = T = c; }
    const hz = (R - L) / 2, vt = (T - B) / 2;
    const tanH = Math.tan((38 / 2) * Math.PI / 180);
    let dist = Math.max(vt / tanH, hz / (tanH * (15 / 11)));
    dist = Math.max(2500, Math.min(30000, dist * (st.cameraZoomMul ?? 1)));
    const size = Math.max(R - L, T - B);
    const k = size < 1000 ? 0 : size > 2000 ? 0.0682 : 0.0682 * (size - 1000) / 1000;
    const atX = (L + R) / 2, atY = (T + B) / 2 - k * (T - B);
    if (!this.initCam) { this.cam = { x: atX, y: atY, d: dist }; this.initCam = true; }
    // zoom out instantly, in by 7.5%/frame; pan 5%..10% by distance
    if (dist > this.cam.d) this.cam.d = dist; else this.cam.d += (dist - this.cam.d) * 0.075;
    const pd = Math.hypot(atX - this.cam.x, atY - this.cam.y);
    const pk = pd < 2000 ? 0.05 : pd > 15000 ? 0.1 : 0.05 + 0.05 * (pd - 2000) / 13000;
    this.cam.x += (atX - this.cam.x) * pk; this.cam.y += (atY - this.cam.y) * pk;
    // decomp gmcamera.c: pitch = clamp(-(at.y-900)/133°, -7°, 5°) + stage light_angle.z (≈ -10°); eye dir (sin yaw·cos p, -sin p, cos yaw·cos p)
    const pitchY = Math.max(-7, Math.min(5, -(this.cam.y - 900) / 133)) * Math.PI / 180;
    const pitch = -(pitchY + (st.cameraPitchBase ?? -0.17453294));   // positive = eye above the look-at point
    const yaw = Math.max(-17.5, Math.min(17.5, -this.cam.x / 133)) * Math.PI / 180;
    const d = this.cam.d * RS;
    const ex = this.cam.x * RS + Math.sin(-yaw) * Math.cos(pitch) * d * 0;
    // eye orbits the look-at point by (yaw, pitch)
    const eye = new THREE.Vector3(Math.sin(yaw) * Math.cos(pitch) * d, Math.sin(pitch) * d, Math.cos(yaw) * Math.cos(pitch) * d);
    this.camera.fov = 38; this.camera.near = 2.56; this.camera.far = 400; this.camera.updateProjectionMatrix();
    this.camera.position.set(this.cam.x * RS + eye.x, this.cam.y * RS + eye.y, eye.z);
    this.camera.lookAt(this.cam.x * RS, this.cam.y * RS, 0);
    if (this.stageObj?.background) { this.stageObj.background.position.x = this.cam.x * RS * (st.bgParallax ?? 0.85); this.stageObj.background.position.y = (st.bgY ?? 1500) * RS + this.cam.y * RS * 0.7; }
    this.shake();
  }
  shake() {
    if (this.fx.shake > 0) {
      const s = this.fx.shake * 0.02;
      this.camera.position.x += (Math.random() - 0.5) * s; this.camera.position.y += (Math.random() - 0.5) * s;
      this.fx.shake *= 0.85; if (this.fx.shake < 0.05) this.fx.shake = 0;
    }
  }
  render(renderer) {
    renderer.setClearColor(this.match.stage.clearColor ?? 0x000000);
    renderer.render(this.scene, this.camera);
  }
  // project world (game units) to screen pixels (640x480)
  toScreen(x, y) {
    const v = new THREE.Vector3(x * RS, y * RS, 0).project(this.camera);
    return [(v.x + 1) * 320, (1 - v.y) * 240];
  }
}

function defaultProjView(scene, p) {
  const m = new THREE.Mesh(new THREE.SphereGeometry((p.r || 50) * RS, 8, 6), new THREE.MeshBasicMaterial({ color: p.color ?? 0xffaa00 }));
  scene.add(m); return m;
}

function makeRespawnPlatform(port) {
  const g = new THREE.Group();
  const col = new THREE.Color(PORT_COLORS[port] ?? '#888');
  const top = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 0.9, 0.25, 12), new THREE.MeshLambertMaterial({ color: 0xd8d8e0, emissive: col.clone().multiplyScalar(0.3) }));
  const under = new THREE.Mesh(new THREE.ConeGeometry(0.9, 0.9, 12), new THREE.MeshLambertMaterial({ color: col }));
  under.rotation.x = PI; under.position.y = -0.55;
  g.add(top, under);
  return g;
}
