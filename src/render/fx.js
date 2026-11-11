// Visual effects in the SSB64 visual language: compact starburst hit sparks (normal / fire / electric /
// slash), the grey smoke trail behind launched fighters, dust puffs for landings, dashes and jumps,
// sword swing trails, the KO blast column, shield hits and breaks, explosions.
// Everything is a camera-facing sprite with a soft procedural texture (drawn once on a canvas).
// Effects are view-only: they use their own random stream so they never touch the simulation's.
import * as THREE from 'three';
import { PORT_COLORS } from '../game/constants.js';

const PI = Math.PI, TAU = PI * 2;
let seed = 0x2f6e2b1;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
const rr = (a, b) => a + (b - a) * rnd();

// ---------------- procedural sprite textures ----------------
function canvasTex(size, draw) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d'); g.translate(size / 2, size / 2); g.scale(size / 2, size / 2);   // unit square -1..1
  draw(g);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const radial = (g, stops, r = 1) => { const gr = g.createRadialGradient(0, 0, 0, 0, 0, r); for (const [o, c] of stops) gr.addColorStop(o, c); return gr; };
let TEX = null;
function textures() {
  if (TEX) return TEX;
  let s = 7; const lr = () => ((s = (s * 1103515245 + 12345) >>> 0) / 4294967296);   // fixed shapes every load
  TEX = {
    glow: canvasTex(64, g => { g.fillStyle = radial(g, [[0, 'rgba(255,255,255,1)'], [0.35, 'rgba(255,255,255,0.7)'], [1, 'rgba(255,255,255,0)']]); g.fillRect(-1, -1, 2, 2); }),
    // starburst: thin spikes of uneven length around a hot centre
    star: canvasTex(128, g => {
      const n = 14;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * TAU + (lr() - 0.5) * 0.25, len = i % 2 ? 0.45 + lr() * 0.2 : 0.8 + lr() * 0.2, w = 0.07 + lr() * 0.03;
        g.save(); g.rotate(a);
        const gr = g.createLinearGradient(0, 0, len, 0); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.6, 'rgba(255,255,255,0.85)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = gr; g.beginPath(); g.moveTo(0, -w); g.lineTo(len, 0); g.lineTo(0, w); g.closePath(); g.fill(); g.restore();
      }
      g.fillStyle = radial(g, [[0, 'rgba(255,255,255,1)'], [1, 'rgba(255,255,255,0)']], 0.42); g.beginPath(); g.arc(0, 0, 0.42, 0, TAU); g.fill();
    }),
    // four-point twinkle
    twinkle: canvasTex(64, g => {
      for (const [sx, sy] of [[1, 0.13], [0.13, 1]]) { g.fillStyle = radial(g, [[0, 'rgba(255,255,255,1)'], [1, 'rgba(255,255,255,0)']]); g.save(); g.scale(sx, sy); g.beginPath(); g.arc(0, 0, 1, 0, TAU); g.fill(); g.restore(); }
      g.fillStyle = radial(g, [[0, 'rgba(255,255,255,1)'], [1, 'rgba(255,255,255,0)']], 0.3); g.beginPath(); g.arc(0, 0, 0.3, 0, TAU); g.fill();
    }),
    ring: canvasTex(128, g => { g.strokeStyle = '#fff'; g.lineWidth = 0.09; g.shadowColor = '#fff'; g.shadowBlur = 6; g.beginPath(); g.arc(0, 0, 0.84, 0, TAU); g.stroke(); }),
    // lumpy smoke / dust cloud, lit from above
    puff: canvasTex(64, g => {
      const blobs = [[0, 0.05, 0.62], [-0.38, 0.12, 0.42], [0.4, 0.1, 0.44], [-0.12, -0.3, 0.46], [0.22, -0.26, 0.42], [0, 0.32, 0.4]];
      for (const [x, y, r] of blobs) { g.save(); g.translate(x, y); g.fillStyle = radial(g, [[0, 'rgba(255,255,255,0.95)'], [0.6, 'rgba(240,240,240,0.75)'], [1, 'rgba(225,225,225,0)']], r); g.beginPath(); g.arc(0, 0, r, 0, TAU); g.fill(); g.restore(); }
      const sh = g.createLinearGradient(0, -1, 0, 1); sh.addColorStop(0, 'rgba(0,0,0,0)'); sh.addColorStop(1, 'rgba(60,60,80,0.35)');
      g.globalCompositeOperation = 'source-atop'; g.fillStyle = sh; g.fillRect(-1, -1, 2, 2);
    }),
    flame: canvasTex(64, g => {
      g.fillStyle = radial(g, [[0, 'rgba(255,255,230,1)'], [0.3, 'rgba(255,220,90,0.95)'], [0.65, 'rgba(255,110,20,0.7)'], [1, 'rgba(200,30,0,0)']]);
      g.beginPath(); g.moveTo(0, -1); g.bezierCurveTo(0.75, -0.2, 0.7, 0.7, 0, 0.85); g.bezierCurveTo(-0.7, 0.7, -0.75, -0.2, 0, -1); g.fill();
    }),
    // jagged lightning bolt along x
    bolt: canvasTex(128, g => {
      g.lineJoin = 'miter'; g.shadowColor = '#fff'; g.shadowBlur = 8;
      for (const [w, col] of [[0.16, 'rgba(255,255,255,0.55)'], [0.06, '#fff']]) {
        g.strokeStyle = col; g.lineWidth = w; g.beginPath(); g.moveTo(-0.95, 0);
        const pts = [[-0.6, -0.32], [-0.3, 0.22], [0, -0.28], [0.3, 0.3], [0.62, -0.2], [0.95, 0.05]];
        for (const [x, y] of pts) g.lineTo(x, y); g.stroke();
      }
    }),
    // beam along +x: hot at the origin, soft edges
    beam: canvasTex(64, g => {
      const v = g.createLinearGradient(0, -1, 0, 1); v.addColorStop(0, 'rgba(255,255,255,0)'); v.addColorStop(0.35, 'rgba(255,255,255,0.9)'); v.addColorStop(0.5, 'rgba(255,255,255,1)'); v.addColorStop(0.65, 'rgba(255,255,255,0.9)'); v.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = v; g.fillRect(-1, -1, 2, 2);
      const h = g.createLinearGradient(-1, 0, 1, 0); h.addColorStop(0, 'rgba(0,0,0,1)'); h.addColorStop(0.7, 'rgba(0,0,0,0.75)'); h.addColorStop(1, 'rgba(0,0,0,0)');
      g.globalCompositeOperation = 'destination-in'; g.fillStyle = h; g.fillRect(-1, -1, 2, 2);
    }),
    star5: canvasTex(64, g => {
      g.fillStyle = '#fff'; g.shadowColor = '#fff'; g.shadowBlur = 4; g.beginPath();
      for (let i = 0; i < 10; i++) { const r = i % 2 ? 0.36 : 0.86, a = (i / 10) * TAU - PI / 2; g[i ? 'lineTo' : 'moveTo'](Math.cos(a) * r, Math.sin(a) * r); }
      g.closePath(); g.fill();
    }),
    shard: canvasTex(32, g => { g.fillStyle = '#fff'; g.beginPath(); g.moveTo(-0.7, 0.6); g.lineTo(0.1, -0.9); g.lineTo(0.8, 0.5); g.closePath(); g.fill(); }),
  };
  return TEX;
}

const PLANE = new THREE.PlaneGeometry(2, 2);
const BEAMGEO = (() => { const g = new THREE.PlaneGeometry(1, 1); g.translate(0.5, 0, 0); return g; })();

export class Effects {
  constructor(scene) { this.scene = scene; this.parts = []; this.shake = 0; this.T = textures(); this.last = new Map(); this.swingPrev = new Map(); }

  // Generic sprite particle. o: { tex, x, y, z, size (render units, half-extent), size2 (end size), sx, sy, life, color, color2,
  //   add (additive), alpha, rot, spin, vx, vy, grav, drag, fadeIn, hold (fraction of life at full alpha), geo }
  p(o) {
    const mat = new THREE.MeshBasicMaterial({ map: this.T[o.tex], color: o.color ?? 0xffffff, transparent: true, opacity: o.alpha ?? 1, depthWrite: false,
      side: THREE.DoubleSide, blending: o.add ? THREE.AdditiveBlending : THREE.NormalBlending });
    const m = new THREE.Mesh(o.geo ?? PLANE, mat);
    m.position.set(o.x, o.y, o.z ?? 0.6); m.rotation.z = o.rot ?? 0; m.renderOrder = 20 + (o.add ? 1 : 0);
    const part = { mesh: m, t: 0, life: o.life, o, c1: o.color2 !== undefined ? new THREE.Color(o.color ?? 0xffffff) : null, c2: o.color2 !== undefined ? new THREE.Color(o.color2) : null,
      vx: o.vx ?? 0, vy: o.vy ?? 0 };
    this.apply(part); this.scene.add(m); this.parts.push(part);
    return part;
  }
  apply(part) {
    const { o, mesh } = part, k = Math.min(1, part.t / part.life);
    const ke = 1 - (1 - k) * (1 - k);                       // ease-out: fast at first
    const s = o.size + ((o.size2 ?? o.size) - o.size) * ke;
    mesh.scale.set(s * (o.sx ?? 1), s * (o.sy ?? 1), 1);
    const hold = o.hold ?? 0, a = k < hold ? 1 : 1 - (k - hold) / Math.max(1e-6, 1 - hold);
    mesh.material.opacity = (o.alpha ?? 1) * (o.fadeIn ? Math.min(1, part.t / o.fadeIn) : 1) * Math.max(0, a);
    if (part.c1) mesh.material.color.copy(part.c1).lerp(part.c2, k);
  }
  custom(mesh, life, upd) { this.scene.add(mesh); const part = { mesh, t: 0, life, upd }; this.parts.push(part); return part; }

  // ---------------- hits ----------------
  // (x, y) render units; power ~ damage; dir = launch direction (radians) or null
  hitSpark(x, y, dmg, kb, element, dir, rs) {
    const big = kb > 100, R = Math.max(0.75, Math.min(3.0, 0.7 + dmg * 0.1)) * (big ? 1.15 : 1);
    const rot = rr(0, TAU);
    if (element === 'fire') {
      this.p({ tex: 'glow', x, y, size: R * 0.5, size2: R * 1.2, life: 7, color: 0xffb040, add: true });
      this.p({ tex: 'star', x, y, size: R * 0.5, size2: R * 1.1, life: 9, color: 0xff8a30, add: true, rot, spin: 0.05, hold: 0.3 });
      for (let i = 0; i < 6; i++) this.p({ tex: 'flame', x: x + rr(-0.5, 0.5) * R, y: y + rr(-0.4, 0.4) * R, size: R * rr(0.28, 0.5), size2: R * 0.1, life: 14 + (i % 3) * 4,
        vx: rr(-0.02, 0.02), vy: rr(0.03, 0.08), add: true, alpha: 0.95, hold: 0.4 });
      this.p({ tex: 'puff', x, y: y + R * 0.3, size: R * 0.4, size2: R * 0.9, life: 26, color: 0x55504c, alpha: 0.5, vy: 0.04, z: 0.55 });
    } else if (element === 'electric') {
      this.p({ tex: 'glow', x, y, size: R * 0.6, size2: R * 1.3, life: 8, color: 0xfff7a0, add: true });
      for (let i = 0; i < 5; i++) this.p({ tex: 'bolt', x: x + rr(-0.2, 0.2) * R, y: y + rr(-0.2, 0.2) * R, size: R * rr(0.7, 1.1), sy: 0.45, life: 4 + i * 3, rot: rr(0, TAU),
        color: i % 2 ? 0xffffff : 0xfff060, add: true, hold: 0.7 });
      for (let i = 0; i < 4; i++) this.p({ tex: 'twinkle', x, y, size: R * 0.22, life: 16, vx: rr(-0.12, 0.12), vy: rr(-0.05, 0.14), grav: 0.006, color: 0xfff7a0, add: true });
    } else {
      const slash = element === 'slash';
      const core = slash ? 0xe6f6ff : big ? 0xfff0b0 : 0xffffff, spike = slash ? 0xbfe6ff : big ? 0xffc23c : 0xfff4b8;
      this.p({ tex: 'glow', x, y, size: R * 0.45, size2: R * 1.0, life: 5, color: core, add: true });
      this.p({ tex: 'star', x, y, size: R * 0.45, size2: R * 1.15, life: big ? 11 : 8, color: spike, add: true, rot, spin: 0.04, hold: 0.35 });
      this.p({ tex: 'star', x, y, size: R * 0.3, size2: R * 0.7, life: 6, color: 0xffffff, add: true, rot: rot + 0.4, hold: 0.3 });
      this.p({ tex: 'ring', x, y, size: R * 0.3, size2: R * (big ? 1.25 : 1.0), life: big ? 11 : 9, color: spike, add: true, alpha: 0.6 });
      if (slash && dir !== null) this.p({ tex: 'beam', geo: PLANE, x, y, size: R * 1.5, sy: 0.07, life: 8, rot: dir + PI / 2 + rr(-0.3, 0.3), color: 0xffffff, add: true, hold: 0.3 });
      const n = big ? 9 : dmg > 6 ? 5 : 3;
      for (let i = 0; i < n; i++) {
        const a = dir === null ? rr(0, TAU) : dir + rr(-0.9, 0.9), sp = rr(0.08, 0.2) * (big ? 1.4 : 1);
        this.p({ tex: 'twinkle', x, y, size: R * rr(0.12, 0.22), size2: 0.02, life: 12 + Math.floor(rr(0, 9)), vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, grav: 0.007, drag: 0.94,
          color: i % 2 ? 0xffffff : spike, add: true, spin: 0.2, hold: 0.5 });
      }
    }
    if (big) this.shake = Math.max(this.shake, Math.min(10, kb / 25));
  }
  // blocked hit: flat ring + a few sparks glancing off the bubble
  shieldSpark(x, y) {
    this.p({ tex: 'ring', x, y, size: 0.25, size2: 0.95, life: 10, add: true, alpha: 0.9 });
    this.p({ tex: 'glow', x, y, size: 0.5, size2: 0.9, life: 5, add: true, alpha: 0.8 });
    for (let i = 0; i < 4; i++) { const a = rr(0, TAU); this.p({ tex: 'twinkle', x, y, size: 0.16, size2: 0.03, life: 12, vx: Math.cos(a) * 0.1, vy: Math.sin(a) * 0.1, add: true }); }
  }

  // ---------------- dust and smoke ----------------
  puff(x, y, size, o = {}) {
    return this.p({ tex: 'puff', x, y, z: 0.35, size, size2: size * (o.grow ?? 2.1), life: o.life ?? 20, color: o.color ?? 0xe9e4d8, alpha: o.alpha ?? 0.75,
      vx: o.vx ?? 0, vy: o.vy ?? 0.008, drag: 0.9, rot: rr(0, TAU), spin: rr(-0.03, 0.03), hold: 0.25 });
  }
  dust(x, y, n = 2, dir = 0, scale = 1) {
    for (let i = 0; i < n; i++) {
      const d = dir || (i % 2 ? 1 : -1);
      this.puff(x + d * rr(0.05, 0.25) * scale, y + rr(0.08, 0.18) * scale, rr(0.13, 0.2) * scale, { vx: d * rr(0.025, 0.06) * scale, vy: rr(0.004, 0.02), life: 16 + Math.floor(rr(0, 8)) });
    }
  }
  // flattened ring on the floor / under the feet (air jump, tech)
  floorRing(x, y, size, color = 0xffffff) {
    this.p({ tex: 'ring', x, y, size: size * 0.3, size2: size, sy: 0.3, life: 12, color, add: true, alpha: 0.85 });
  }
  // per-frame emitters: launch smoke trail, run dust
  ambient(match, rs) {
    for (const f of match.fighters) {
      const prev = this.last.get(f); this.last.set(f, [f.x, f.y]);
      if (f.dead || !prev) continue;
      const sp = Math.hypot(f.x - prev[0], f.y - prev[1]);
      const launched = (f.state === 'tumble' || f.state === 'hurt') && f.hitstun > 0 && f.hitlag <= 0;
      if (launched && sp > 28 && sp < 1500) {
        // grey-white puffs strung along the flight path, denser and bigger for harder launches
        const n = sp > 90 ? 2 : 1, hs = f.H * rs;
        for (let i = 0; i < n; i++) {
          const k = (i + 1) / n, x = (prev[0] + (f.x - prev[0]) * k) * rs, y = (prev[1] + (f.y - prev[1]) * k + f.H * 0.5) * rs;
          this.puff(x + rr(-0.06, 0.06), y + rr(-0.06, 0.06), hs * rr(0.13, 0.2) * Math.min(1.4, 0.7 + sp / 160), { color: 0xf2f2f2, alpha: 0.62, life: 22 + Math.floor(rr(0, 8)), grow: 1.9, vy: 0.004 });
        }
      } else if (f.state === 'run' && f.grounded && match.frame % 9 === 0) this.dust(f.x * rs, f.y * rs, 1, -f.facing, 0.8);
      else if ((f.state === 'runbrake' || f.state === 'runturn') && f.grounded && match.frame % 3 === 0 && Math.abs(f.vx) > 8) this.dust(f.x * rs + f.facing * 0.3, f.y * rs, 1, Math.sign(f.vx) || 1, 0.9);
    }
    this.swingTrails(match, rs);
  }
  // sword trails: a fading ribbon swept by the outermost slashing hitbox
  swingTrails(match, rs) {
    for (const f of match.fighters) {
      let tip = null;
      if (!f.dead && f.hitlag <= 0) for (const h of f.activeHitboxes ?? []) {
        if (h.hb.element !== 'slash') continue;
        const d = Math.hypot(h.x - f.x, h.y - (f.y + f.H * 0.5));
        if (!tip || d > tip.d) tip = { d, h };
      }
      const prev = this.swingPrev.get(f);
      if (!tip) { if (prev && f.hitlag <= 0) this.swingPrev.delete(f); continue; }
      const cx = f.x, cy = f.y + f.H * 0.55, h = tip.h, d = Math.max(1, tip.d);
      const ux = (h.x - cx) / d, uy = (h.y - cy) / d;
      const cur = { ox: (h.x + ux * h.r * 0.9) * rs, oy: (h.y + uy * h.r * 0.9) * rs, ix: (h.x - ux * h.r * 0.5) * rs, iy: (h.y - uy * h.r * 0.5) * rs, mf: f.mf, move: f.move };
      if (prev && prev.move === cur.move && cur.mf - prev.mf <= 2 && Math.hypot(cur.ox - prev.ox, cur.oy - prev.oy) > 0.05) {
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute([prev.ix, prev.iy, 0.45, prev.ox, prev.oy, 0.45, cur.ox, cur.oy, 0.45, cur.ix, cur.iy, 0.45], 3));
        geo.setAttribute('color', new THREE.Float32BufferAttribute([0.35, 0.6, 1, 1, 1, 1, 1, 1, 1, 0.35, 0.6, 1], 3));
        geo.setIndex([0, 1, 2, 0, 2, 3]);
        const mat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.7, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });
        const mesh = new THREE.Mesh(geo, mat); mesh.renderOrder = 19;
        this.custom(mesh, 9, p => { mat.opacity = 0.5 * (1 - p.t / p.life) ** 1.5; }).ownGeo = true;
      }
      this.swingPrev.set(f, cur);
    }
  }

  // ---------------- KOs ----------------
  koBlast(x, y, side, port, rs) {
    const col = new THREE.Color(PORT_COLORS[port] ?? '#ffffff'), light = col.clone().lerp(new THREE.Color(0xffffff), 0.55);
    const ang = side === 'left' ? 0 : side === 'right' ? PI : side === 'top' ? -PI / 2 : PI / 2;
    const X = x * rs, Y = y * rs;
    const beam = (w, len, color, life, alpha, da = 0, delay = 0) => {
      const mat = new THREE.MeshBasicMaterial({ map: this.T.beam, color, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });
      const m = new THREE.Mesh(BEAMGEO, mat); m.position.set(X, Y, 1); m.rotation.z = ang + da; m.renderOrder = 22;
      this.custom(m, life + delay, p => {
        const t = p.t - delay; if (t < 0) { mat.opacity = 0; return; }
        const k = t / life, grow = Math.min(1, k * 5);
        m.scale.set(len * grow, w * (1 - k * 0.85) * (0.85 + 0.15 * Math.sin(t * 2.1)), 1); mat.opacity = alpha * (1 - k * k);
      });
    };
    beam(9, 46, col, 52, 0.85); beam(5, 46, light, 44, 0.9); beam(2.2, 48, 0xffffff, 36, 1);
    for (let i = 0; i < 7; i++) beam(rr(0.5, 1.4), rr(22, 44), i % 2 ? 0xffffff : light, 26 + Math.floor(rr(0, 16)), 0.8, rr(-0.32, 0.32), Math.floor(rr(0, 8)));
    this.p({ tex: 'glow', x: X, y: Y, z: 1.05, size: 3, size2: 11, life: 26, color: light, add: true });
    this.p({ tex: 'star', x: X, y: Y, z: 1.06, size: 3, size2: 9, life: 20, add: true, rot: rr(0, TAU), spin: 0.05 });
    this.p({ tex: 'ring', x: X, y: Y, z: 1.04, size: 1, size2: 13, life: 24, color: light, add: true, alpha: 0.8 });
    for (let i = 0; i < 16; i++) {
      const a = ang + rr(-0.75, 0.75), sp = rr(0.15, 0.55);
      this.p({ tex: i % 3 ? 'star5' : 'twinkle', x: X, y: Y, z: 1.1, size: rr(0.25, 0.55), size2: 0.05, life: 34 + Math.floor(rr(0, 16)), vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, drag: 0.97,
        color: i % 2 ? 0xffffff : light, add: true, spin: 0.2, hold: 0.5 });
    }
    this.shake = 14;
  }
  starKO(x, rs, camY) {
    this.p({ tex: 'twinkle', x: x * rs * 0.7, y: camY, z: -60, size: 0.6, size2: 3.2, life: 14, add: true, spin: 0.12, hold: 0.6 });
    this.p({ tex: 'star', x: x * rs * 0.7, y: camY, z: -60, size: 0.4, size2: 2.2, life: 22, add: true, spin: 0.2, hold: 0.4 });
  }
  shieldShards(x, y, port, rs) {
    const col = new THREE.Color(PORT_COLORS[port] ?? '#ffffff').lerp(new THREE.Color(0xffffff), 0.3);
    this.p({ tex: 'glow', x: x * rs, y: y * rs, size: 1, size2: 3.4, life: 12, color: col, add: true });
    this.p({ tex: 'ring', x: x * rs, y: y * rs, size: 0.6, size2: 3.2, life: 16, color: col, add: true });
    for (let i = 0; i < 16; i++) {
      const a = rr(0, TAU), sp = rr(0.06, 0.16);
      this.p({ tex: 'shard', x: x * rs, y: y * rs, size: rr(0.14, 0.3), life: 36 + Math.floor(rr(0, 12)), vx: Math.cos(a) * sp, vy: Math.sin(a) * sp + 0.04, grav: 0.006, color: col, alpha: 0.9,
        rot: rr(0, TAU), spin: rr(-0.3, 0.3), hold: 0.6 });
    }
  }
  explosion(x, y, rs) {
    const X = x * rs, Y = y * rs;
    this.p({ tex: 'glow', x: X, y: Y, size: 1.2, size2: 5, life: 14, color: 0xfff0c0, add: true });
    this.p({ tex: 'star', x: X, y: Y, size: 1.5, size2: 4.6, life: 12, color: 0xffd060, add: true, rot: rr(0, TAU) });
    this.p({ tex: 'ring', x: X, y: Y, size: 0.8, size2: 5.5, life: 16, color: 0xffb040, add: true, alpha: 0.8 });
    for (let i = 0; i < 9; i++) {
      const a = rr(0, TAU), d = rr(0.2, 1.6);
      this.p({ tex: 'flame', x: X + Math.cos(a) * d, y: Y + Math.sin(a) * d, size: rr(0.7, 1.3), size2: 0.3, life: 18 + Math.floor(rr(0, 10)), vx: Math.cos(a) * 0.05, vy: Math.sin(a) * 0.05 + 0.03,
        add: true, rot: rr(-0.5, 0.5), hold: 0.4 });
    }
    for (let i = 0; i < 7; i++) { const a = rr(0, TAU), d = rr(0.5, 2.2); this.puff(X + Math.cos(a) * d, Y + Math.sin(a) * d, rr(0.5, 0.9), { color: 0x6a625c, alpha: 0.6, life: 34, vx: Math.cos(a) * 0.03, vy: 0.03 }); }
    this.shake = Math.max(this.shake, 9);
  }

  // older call sites (1P bonus stages): spark(x, y, sizeUnits, color, rs), ring(x, y, color, rs, size)
  spark(x, y, size, color, rs) { this.hitSpark(x * rs, y * rs, Math.max(4, size / 30), 0, 'normal', null, rs); }
  ring(x, y, color, rs, size = 1) { this.p({ tex: 'ring', x: x * rs, y: y * rs, size: size * 0.3, size2: size * 1.2, life: 14, color, add: true, alpha: 0.9 }); }

  onEvent(e, match, rs) {
    const f = e.f;
    switch (e.type) {
      case 'hit': {
        if (e.blocked) { this.shieldSpark(e.x * rs, e.y * rs); break; }
        // launch direction from the victim's knockback (set before the event), else away from the attacker
        let dir = null;
        if (f && (f.kbx || f.kby)) dir = Math.atan2(f.kby, f.kbx);
        else if (f && e.a) dir = f.x >= e.a.x ? 0.5 : PI - 0.5;
        this.hitSpark(e.x * rs, e.y * rs, e.dmg ?? 0, e.kb ?? 0, e.element ?? 'normal', dir, rs);
        break;
      }
      case 'shieldHit': this.shieldSpark(e.x * rs, e.y * rs); break;
      case 'land': if (f) this.dust(f.x * rs, f.y * rs, 2, 0, Math.min(1.4, 0.7 + f.H / 800)); break;
      case 'dash': if (f) this.dust(f.x * rs - f.facing * 0.2, f.y * rs, 3, -f.facing); break;
      case 'jump': if (f) this.dust(f.x * rs, f.y * rs, 2, 0, 0.8); break;
      case 'jump2': if (f) this.floorRing(f.x * rs, f.y * rs, f.Wd * rs * 2.2 + 0.5); break;
      case 'tech': if (f) { this.floorRing(f.x * rs, f.y * rs + 0.05, 1.3); this.p({ tex: 'twinkle', x: f.x * rs, y: (f.y + f.H * 0.4) * rs, size: 0.4, size2: 1.1, life: 10, add: true }); } break;
      case 'downbounce': case 'groundBounce': if (f) { this.dust(f.x * rs, f.y * rs, 5, 0, 1.3); this.shake = Math.max(this.shake, 3); } break;
      case 'ledge': if (f) this.p({ tex: 'twinkle', x: (f.x + f.facing * f.Wd) * rs, y: (f.y + f.H * 0.9) * rs, size: 0.25, size2: 0.7, life: 9, add: true }); break;
      case 'fastfall': if (f) this.p({ tex: 'twinkle', x: f.x * rs, y: (f.y + f.H * 0.5) * rs, size: 0.2, size2: 0.6, life: 8, add: true, alpha: 0.8 }); break;
      case 'ko': {
        if (e.star) break;   // star / screen KOs have no blast
        const cb = match.stage.cameraBounds;
        let bx = Math.max(cb.left, Math.min(cb.right, e.x)), by = Math.max(cb.bottom, Math.min(cb.top, e.y));
        // the column starts at the blast line, or at the edge of the picture when that is off-screen
        if (this.camera) {
          const v = new THREE.Vector3(bx * rs, by * rs, 0).project(this.camera);
          if (Math.abs(v.x) > 1 || Math.abs(v.y) > 1) {
            v.set(Math.max(-1.02, Math.min(1.02, v.x)), Math.max(-1.02, Math.min(1.02, v.y)), 0.5).unproject(this.camera);
            const o = this.camera.position, t = -o.z / (v.z - o.z);
            bx = (o.x + (v.x - o.x) * t) / rs; by = (o.y + (v.y - o.y) * t) / rs;
          }
        }
        this.koBlast(bx, by, e.side, f.port, rs);
        break;
      }
      case 'itemSpawn': this.floorRing(e.x * rs, e.y * rs, 1.3, 0xfff6a0); for (let i = 0; i < 5; i++) this.p({ tex: 'twinkle', x: e.x * rs + rr(-0.6, 0.6), y: e.y * rs + rr(-0.2, 0.9), size: 0.2, size2: 0.5, life: 14 + i * 3, add: true, color: 0xfff6a0, vy: 0.02 }); break;
      case 'explosion': this.explosion(e.x, e.y, rs); break;
      case 'containerOpen': case 'itemVanish': case 'itemSmoke': this.dust((e.x ?? 0) * rs, (e.y ?? 0) * rs, 5, 0, 1.2); break;
      case 'projDie': this.p({ tex: 'glow', x: e.x * rs, y: e.y * rs, size: 0.3, size2: 0.8, life: 7, add: true, alpha: 0.8 }); break;
      case 'shake': this.shake = Math.max(this.shake, e.power ?? 8); break;
      case 'clank': this.hitSpark(e.x * rs, e.y * rs, 6, 0, 'slash', null, rs); break;
      case 'reflect': this.p({ tex: 'ring', x: e.x * rs, y: e.y * rs, size: 0.4, size2: 1.3, life: 12, color: 0x60ffff, add: true }); break;
      case 'starTwinkle': this.starKO(e.x, rs, (match.stage.cameraBounds.top * 0.8) * rs); break;
      case 'shieldBreak': if (f) this.shieldShards(f.x, f.y + f.H * 0.5, f.port, rs); break;
    }
  }
  update(match, rs) {
    if (match) this.ambient(match, rs);
    for (const p of this.parts) {
      p.t++;
      if (p.upd) { p.upd(p); continue; }
      const o = p.o, m = p.mesh;
      if (o.grav) p.vy -= o.grav;
      if (o.drag) { p.vx *= o.drag; p.vy *= o.drag; }
      m.position.x += p.vx; m.position.y += p.vy;
      if (o.spin) m.rotation.z += o.spin;
      this.apply(p);
    }
    for (const p of this.parts) if (p.t >= p.life) { this.scene.remove(p.mesh); p.mesh.material.dispose(); if (p.ownGeo) p.mesh.geometry.dispose(); }
    this.parts = this.parts.filter(p => p.t < p.life);
  }
}
