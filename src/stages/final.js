// Final Destination (1P: Master Hand) — flat octagonal temple platform floating in space. Top: glowing
// radial rings; sides: purple cracked stone sloping to a lip, then an inverted pyramid to (0,-2520), as the
// collision walls/ceilings describe. Background phases (set by the boss mode):
//   st.setPhase(0) space (stars/nebula), 1 = fast-scrolling clouds, 2 = wormhole, 3 = wormhole accelerating.
// st.bgPhase holds the current phase. The visuals cross-fade when the phase changes.
import * as THREE from 'three';
import { makeStage } from './common.js';
import { rng, tex, bgPlane, paintFaces, vcMat } from './final_kit.js';
import data from './data/final_destination.js';

export const final = makeStage(data, {
  id: 'final', series: 'smash', music: 'final',
  clearColor: 0x000032,
  options: { ambient: 0.75, sun: 1.2, sunDir: [0, 1, 0.6], bgParallax: 0.95 },
  init(m, st) {
    st.bgPhase = 0; st.bgT = 0;
    st.prevPhase = 0;
    st.setPhase = n => { if (n !== st.bgPhase) { st.prevPhase = Math.min(2, st.bgPhase); st.bgPhase = n; st.bgT = 0; } };
  },
  update(m, st) { st.bgT++; },
  build(scene, rs, d) { return build(scene, rs, d); },
  sync(obj, m, rs, st) {
    if (!obj) return;
    const ph = Math.min(2, st.bgPhase ?? 0), t = m.frame;
    // cross-fade over 40 game frames: previous layer underneath, new layer fading in on top
    const k = Math.min(1, (st.bgT ?? 99) / 40), prev = st.prevPhase ?? 0;
    obj.layers.forEach((l, i) => {
      l.visible = i === ph || (i === prev && k < 1);
      l.material.opacity = i === ph ? (ph === prev ? 1 : k) : 1;
      l.renderOrder = i === ph ? -9 : -10;
    });
    obj.stars.offset.x = (t * 0.00004) % 1;
    obj.clouds.offset.x = (t * 0.004) % 1;
    const speed = st.bgPhase >= 3 ? 1 + Math.min(4, (st.bgT ?? 0) / 300) : 1;
    obj.wormPhase = (obj.wormPhase ?? 0) + 0.004 * speed;
    obj.worm.rotation = -obj.wormPhase * 2.5;
    obj.topGlow.rotation.y = t * 0.002;
  },
});

function build(scene, rs, d) {
  const R = rng(77);
  const root = new THREE.Group(); scene.add(root);
  // --- background layers
  const stars = tex(1024, 512, (c, w, h) => {
    c.fillStyle = '#02031a'; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 70; i++) { const x = R() * w, y = R() * h, r = 40 + R() * 120; const g = c.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `rgba(${20 + R() * 30 | 0},${30 + R() * 40 | 0},${110 + R() * 90 | 0},0.35)`); g.addColorStop(1, 'rgba(0,0,40,0)'); c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2); }
    for (let i = 0; i < 1400; i++) { const b = 120 + R() * 135 | 0; c.fillStyle = `rgb(${b},${b},${Math.min(255, b + 30)})`; const s = R() < 0.06 ? 2 : 1; c.fillRect(R() * w, R() * h, s, s); }
  }, { repeat: [1, 1] });
  stars.wrapS = THREE.RepeatWrapping;
  const clouds = tex(512, 512, (c, w, h) => {
    const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#1a2a78'); g.addColorStop(0.5, '#3a58b0'); g.addColorStop(1, '#8a70b8');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 160; i++) { const x = R() * w, y = R() * h, r = 8 + R() * 30; c.fillStyle = `rgba(${200 + R() * 55 | 0},${210 + R() * 45 | 0},255,${0.06 + R() * 0.16})`;
      for (const dx of [-w, 0, w]) for (const dy of [-h, 0, h]) { c.beginPath(); c.ellipse(x + dx, y + dy, r * 1.8, r, 0, 0, 7); c.fill(); } }
  }, { repeat: [2, 1] });
  const worm = tex(512, 512, (c, w, h) => {
    // spiral tunnel: arms from log-radius + angle, dark rim, bright core
    const img = c.createImageData(w, h), D = img.data;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const dx = x - w / 2, dy = y - h / 2, r = Math.hypot(dx, dy) / (w / 2) + 0.001, a = Math.atan2(dy, dx);
      const arm = 0.5 + 0.5 * Math.sin(Math.log(r) * 9 + a * 3);
      const core = Math.max(0, 1 - r * 6) ** 2, fade = Math.min(1, r * 3);
      const hue = (a / Math.PI * 180 + 360 + Math.log(r) * 120) % 360;
      const [cr, cg, cb] = hsl(hue / 360, 0.75, 0.05 + 0.3 * arm ** 3 * fade);
      const i = (y * w + x) * 4; D[i] = Math.min(255, cr + core * 255); D[i + 1] = Math.min(255, cg + core * 230); D[i + 2] = Math.min(255, cb + core * 255); D[i + 3] = 255;
    }
    c.putImageData(img, 0, 0);
  });
  worm.center.set(0.5, 0.5);
  const bg = new THREE.Group(); scene.add(bg);
  const layers = [bgPlane(36000, 18000, stars, -9000, rs, { transparent: true }), bgPlane(36000, 18000, clouds, -9000, rs, { transparent: true }), bgPlane(30000, 30000, worm, -9000, rs, { transparent: true })];
  layers.forEach(l => bg.add(l));

  // --- platform: lathe (octagonal) body following the side profile
  const prof = [[2508, 0], [2331, -761], [1855, -770], [0, -2520]];
  const purpleTex = tex(128, 128, (c, w, h) => { c.fillStyle = '#3a2c8a'; c.fillRect(0, 0, w, h);
    c.strokeStyle = '#1a1050'; c.lineWidth = 2; for (let i = 0; i < 26; i++) { c.beginPath(); let x = R() * w, y = R() * h; c.moveTo(x, y); for (let k = 0; k < 4; k++) { x += (R() - 0.5) * 40; y += (R() - 0.5) * 40; c.lineTo(x, y); } c.stroke(); }
    c.strokeStyle = 'rgba(140,120,230,0.5)'; c.lineWidth = 1; for (let i = 0; i < 20; i++) { c.beginPath(); let x = R() * w, y = R() * h; c.moveTo(x, y); for (let k = 0; k < 3; k++) { x += (R() - 0.5) * 30; y += (R() - 0.5) * 30; c.lineTo(x, y); } c.stroke(); } }, { repeat: [8, 2] });
  const side = new THREE.Mesh(new THREE.LatheGeometry(prof.slice(0, 2).map(([x, y]) => new THREE.Vector2(x * rs, y * rs)), 8, Math.PI / 8),
    new THREE.MeshLambertMaterial({ map: purpleTex, side: THREE.DoubleSide, flatShading: true }));
  const under = new THREE.Mesh(new THREE.LatheGeometry(prof.slice(1).map(([x, y]) => new THREE.Vector2(x * rs, y * rs)), 8, Math.PI / 8),
    new THREE.MeshLambertMaterial({ color: 0x5a1838, map: purpleTex, side: THREE.DoubleSide, flatShading: true }));
  const body = new THREE.Group(); body.add(side, under); body.scale.set(1, 1, 0.42); root.add(body);
  // red edge ribs down the octagon corners
  for (let i = 0; i < 8; i++) {
    const a = Math.PI / 8 + i * Math.PI / 4;
    for (let s = 0; s < prof.length - 1; s++) {
      const [x1, y1] = prof[s], [x2, y2] = prof[s + 1];
      const p1 = new THREE.Vector3(Math.sin(a) * x1 * rs, y1 * rs, Math.cos(a) * x1 * rs * 0.42), p2 = new THREE.Vector3(Math.sin(a) * x2 * rs, y2 * rs, Math.cos(a) * x2 * rs * 0.42);
      const len = p1.distanceTo(p2), rib = new THREE.Mesh(new THREE.BoxGeometry(0.25, len, 0.25), new THREE.MeshLambertMaterial({ color: 0xa02040, emissive: 0x300010 }));
      rib.position.copy(p1).lerp(p2, 0.5); rib.lookAt(p2); rib.rotateX(Math.PI / 2); root.add(rib);
    }
  }
  // top: octagon disk with glowing concentric rings, thin white rim
  const topTex = tex(512, 512, (c, w, h) => {
    c.fillStyle = '#20185a'; c.fillRect(0, 0, w, h);
    const cols = ['#ff9020', '#ffd040', '#f06030', '#60e0ff', '#ffe080', '#c03080', '#40a0ff', '#ffb040'];
    for (let r = 250; r > 0; r -= 9) { c.strokeStyle = cols[(r / 9 | 0) % cols.length]; c.globalAlpha = 0.25 + 0.75 * (1 - r / 250); c.lineWidth = 6; c.beginPath(); c.arc(w / 2, h / 2, r, 0, 7); c.stroke(); }
    c.globalAlpha = 1; const g = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, 60); g.addColorStop(0, '#ffffff'); g.addColorStop(0.4, '#a0f0ff'); g.addColorStop(1, 'rgba(80,200,255,0)');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
    c.strokeStyle = 'rgba(255,255,255,0.15)'; c.lineWidth = 1; for (let i = 0; i < 16; i++) { c.beginPath(); c.moveTo(w / 2, h / 2); c.lineTo(w / 2 + Math.cos(i * Math.PI / 8) * w, h / 2 + Math.sin(i * Math.PI / 8) * h); c.stroke(); }
  });
  const topGeo = new THREE.CylinderGeometry(2508 * rs, 2508 * rs, 4 * rs, 8, 1, false, Math.PI / 8);
  const topGlow = new THREE.Mesh(topGeo, [new THREE.MeshLambertMaterial({ color: 0xe8e8ff }), new THREE.MeshBasicMaterial({ map: topTex }), new THREE.MeshBasicMaterial({ color: 0x20185a })]);
  topGlow.scale.set(1, 1, 0.42); topGlow.position.y = -2 * rs; root.add(topGlow);
  const rim = new THREE.Mesh(new THREE.CylinderGeometry(2512 * rs, 2512 * rs, 14 * rs, 8, 1, true, Math.PI / 8), new THREE.MeshBasicMaterial({ color: 0xf0f0ff, side: THREE.DoubleSide }));
  rim.scale.set(1, 1, 0.42); rim.position.y = -8 * rs; root.add(rim);
  // central glowing "core" crystal under the tip
  const tip = new THREE.Mesh(paintFaces(new THREE.OctahedronGeometry(120 * rs, 0), () => [0xff4060, 0xc02050, 0xff8090][Math.floor(R() * 3)]), vcMat({ emissive: 0x400010 }));
  tip.position.y = -2520 * rs; root.add(tip);
  return { root, background: bg, layers, stars, clouds, worm, topGlow: new THREE.Object3D() };
}

function hsl(h, s, l) {
  const f = n => { const k = (n + h * 12) % 12, a = s * Math.min(l, 1 - l); return 255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))); };
  return [f(0), f(8), f(4)];
}
