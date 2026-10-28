// Visual effects: hit sparks, dust, knockback smoke trail, KO blast, shield break shards, stars.
import * as THREE from 'three';
import { PORT_COLORS } from '../game/constants.js';

const PI = Math.PI;
function starGeo(points = 8, inner = 0.4) {
  const s = new THREE.Shape();
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 ? inner : 1, a = (i / (points * 2)) * PI * 2;
    if (i === 0) s.moveTo(Math.cos(a) * r, Math.sin(a) * r); else s.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  return new THREE.ShapeGeometry(s);
}
const STAR = starGeo(8, 0.35), STAR5 = starGeo(5, 0.45), DISC = new THREE.CircleGeometry(1, 10), RING = new THREE.RingGeometry(0.8, 1, 20);

export class Effects {
  constructor(scene) { this.scene = scene; this.parts = []; this.shake = 0; }
  add(mesh, life, upd) { this.scene.add(mesh); this.parts.push({ mesh, life, t: 0, upd }); return mesh; }
  basic(color, opacity = 1, blend = false) {
    return new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide, blending: blend ? THREE.AdditiveBlending : THREE.NormalBlending });
  }
  spark(x, y, size, color, rs) {
    const m = new THREE.Mesh(STAR, this.basic(color, 1, true));
    m.position.set(x * rs, y * rs, 0.5); m.rotation.z = Math.random() * PI;
    const s0 = size * rs;
    this.add(m, 10, (p) => { const k = p.t / p.life; m.scale.setScalar(s0 * (0.6 + k * 1.2)); m.material.opacity = 1 - k; });
    const w = new THREE.Mesh(DISC, this.basic(0xffffff, 0.9, true));
    w.position.set(x * rs, y * rs, 0.55);
    this.add(w, 5, (p) => { const k = p.t / p.life; w.scale.setScalar(s0 * 0.6 * (1 + k)); w.material.opacity = 0.9 * (1 - k); });
  }
  dust(x, y, rs, n = 3, dir = 0) {
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(DISC, this.basic(0xd8d0c0, 0.7));
      m.position.set(x * rs, y * rs + 0.05, 0.3);
      const vx = (dir || (Math.random() - 0.5)) * 0.03 * (0.5 + Math.random()), vy = 0.01 + Math.random() * 0.01;
      this.add(m, 18, (p) => { const k = p.t / p.life; m.position.x += vx; m.position.y += vy; m.scale.setScalar(0.12 + k * 0.25); m.material.opacity = 0.7 * (1 - k); });
    }
  }
  smoke(x, y, rs) {
    const m = new THREE.Mesh(DISC, this.basic(0xbdbdbd, 0.6));
    m.position.set(x * rs, y * rs, 0.2);
    this.add(m, 24, (p) => { const k = p.t / p.life; m.scale.setScalar(0.15 + k * 0.3); m.material.opacity = 0.6 * (1 - k); });
  }
  koBlast(x, y, side, port, rs) {
    const col = new THREE.Color(PORT_COLORS[port] ?? '#ffffff');
    const ang = side === 'left' ? 0 : side === 'right' ? PI : side === 'top' ? -PI / 2 : PI / 2;
    // big beam toward the stage
    const geo = new THREE.PlaneGeometry(1, 1); geo.translate(0.5, 0, 0);
    const beam = new THREE.Mesh(geo, this.basic(col, 0.9, true));
    beam.position.set(x * rs, y * rs, 1); beam.rotation.z = ang;
    this.add(beam, 50, (p) => { const k = p.t / p.life; beam.scale.set(40 * Math.min(1, k * 4), 6 * (1 - k) + 0.5, 1); beam.material.opacity = 0.9 * (1 - k); });
    const core = new THREE.Mesh(geo, this.basic(0xffffff, 1, true));
    core.position.set(x * rs, y * rs, 1.05); core.rotation.z = ang;
    this.add(core, 35, (p) => { const k = p.t / p.life; core.scale.set(40 * Math.min(1, k * 4), 2.2 * (1 - k) + 0.2, 1); core.material.opacity = 1 - k; });
    for (let i = 0; i < 14; i++) {
      const s = new THREE.Mesh(STAR5, this.basic(i % 2 ? 0xffffff : col, 1, true));
      s.position.set(x * rs, y * rs, 1.1);
      const a = ang + (Math.random() - 0.5) * 1.6, sp = 0.15 + Math.random() * 0.35;
      this.add(s, 40, (p) => { const k = p.t / p.life; s.position.x += Math.cos(a) * sp; s.position.y += Math.sin(a) * sp; s.scale.setScalar(0.5 * (1 - k)); s.rotation.z += 0.2; });
    }
    this.shake = 12;
  }
  starKO(x, rs, camY) {
    const s = new THREE.Mesh(STAR5, this.basic(0xffffff, 1, true));
    s.position.set(x * rs * 0.7, camY, -60);
    this.add(s, 70, (p) => { const k = p.t / p.life; s.scale.setScalar(1.5 * (1 - k) + 0.2); s.material.opacity = k < 0.8 ? 1 : (1 - k) * 5; s.rotation.z += 0.3; });
  }
  shieldShards(x, y, port, rs) {
    const col = new THREE.Color(PORT_COLORS[port] ?? '#ffffff');
    for (let i = 0; i < 12; i++) {
      const m = new THREE.Mesh(new THREE.TetrahedronGeometry(0.25), this.basic(col, 0.8));
      m.position.set(x * rs, y * rs, 0.5);
      const a = Math.random() * PI * 2, sp = 0.06 + Math.random() * 0.08;
      this.add(m, 40, (p) => { m.position.x += Math.cos(a) * sp; m.position.y += Math.sin(a) * sp - p.t * 0.002; m.rotation.x += 0.2; m.material.opacity = 0.8 * (1 - p.t / p.life); });
    }
  }
  ring(x, y, color, rs, size = 1) {
    const m = new THREE.Mesh(RING, this.basic(color, 0.9, true));
    m.position.set(x * rs, y * rs, 0.4);
    this.add(m, 14, (p) => { const k = p.t / p.life; m.scale.setScalar(size * (0.3 + k)); m.material.opacity = 0.9 * (1 - k); });
  }
  onEvent(e, match, rs) {
    const f = e.f;
    switch (e.type) {
      case 'hit': {
        const big = e.kb > 100;
        const col = e.element === 'fire' ? 0xff7a20 : e.element === 'electric' ? 0x9fe8ff : e.element === 'slash' ? 0xb0e0ff : big ? 0xffe060 : 0xffffff;
        this.spark(e.x, e.y, 120 + Math.min(300, e.dmg * 18), col, rs);
        if (big) this.shake = Math.min(10, e.kb / 25);
        break;
      }
      case 'shieldHit': this.ring(e.x, e.y, 0xffffff, rs, 0.6); break;
      case 'land': if (f) this.dust(f.x, f.y, rs, 2); break;
      case 'dash': if (f) this.dust(f.x, f.y, rs, 3, -f.facing); break;
      case 'jump': if (f) this.dust(f.x, f.y, rs, 2); break;
      case 'tech': if (f) this.ring(f.x, f.y + f.H * 0.3, 0xffffff, rs, 1); break;
      case 'ko': {
        if (e.star) break;   // star / screen KOs have no blast
        const cb = match.stage.cameraBounds;
        this.koBlast(Math.max(cb.left, Math.min(cb.right, e.x)), Math.max(cb.bottom, Math.min(cb.top, e.y)), e.side, f.port, rs);
        break;
      }
      case 'itemSpawn': this.ring(e.x, e.y, 0xffffff, rs, 1.4); this.spark(e.x, e.y, 160, 0xfff6a0, rs); break;
      case 'explosion': this.explosion(e.x, e.y, rs); break;
      case 'containerOpen': case 'itemVanish': case 'itemSmoke': this.dust(e.x ?? 0, e.y ?? 0, rs, 5); break;
      case 'shake': this.shake = Math.max(this.shake, e.power ?? 8); break;
      case 'clank': this.spark(e.x, e.y, 140, 0xc0e0ff, rs); break;
      case 'reflect': this.ring(e.x, e.y, 0x60ffff, rs, 1.2); break;
      case 'starTwinkle': this.starKO(e.x, rs, (match.stage.cameraBounds.top * 0.8) * rs); break;
      case 'shieldBreak': if (f) this.shieldShards(f.x, f.y + f.H * 0.5, f.port, rs); break;
    }
    // knockback smoke trail
  }
  explosion(x, y, rs) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8), this.basic(0xffa020, 0.9, true));
    m.position.set(x * rs, y * rs, 0.6);
    this.add(m, 26, (p) => { const k = p.t / p.life; m.scale.setScalar(1 + k * 3.5); m.material.opacity = 0.9 * (1 - k); m.material.color.setHSL(0.1 - k * 0.1, 1, 0.6 - k * 0.3); });
    for (let i = 0; i < 8; i++) this.smoke(x + (Math.random() - 0.5) * 300, y + (Math.random() - 0.5) * 300, rs);
    this.shake = Math.max(this.shake, 9);
  }
  update() {
    for (const p of this.parts) { p.t++; p.upd && p.upd(p); }
    for (const p of this.parts) if (p.t >= p.life) { this.scene.remove(p.mesh); p.mesh.material.dispose?.(); }
    this.parts = this.parts.filter(p => p.t < p.life);
  }
}
