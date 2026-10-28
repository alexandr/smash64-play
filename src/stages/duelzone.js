// Duel Zone (1P: Fighting Polygon Team) — Battlefield-style stone island floating in a psychedelic void:
// a grey-green stone top slab with three stepped purple maze-carved tiers underneath that follow the
// collision walls/ceilings, and three reddish carved stone soft platforms. Backdrop: green/yellow cloud
// haze at the top, deep indigo in the middle, magenta flames at the bottom (fog #410069).
import * as THREE from 'three';
import { makeStage } from './common.js';
import { rng, tex, bgPlane } from './final_kit.js';
import data from './data/duel_zone.js';

export const duelzone = makeStage(data, {
  id: 'duelzone', series: 'smash', music: 'duelzone',
  clearColor: 0x410069,
  options: { ambient: 0.7, sun: 1.3, sunDir: [-0.3, 1, 0.7], bgParallax: 0.92 },
  build(scene, rs, d) { return build(scene, rs, d); },
  sync(obj, m) {
    if (!obj) return;
    obj.flame.offset.x = (m.frame * 0.0006) % 1; obj.flame.offset.y = (m.frame * 0.0012) % 1;
    obj.cloud.offset.x = (m.frame * 0.0003) % 1;
  },
});

// maze/labyrinth carving texture
function mazeTex(R, base, dark, light, o = {}) {
  return tex(128, 128, (c, w, h) => {
    c.fillStyle = base; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 600; i++) { c.fillStyle = R() < 0.5 ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.08)'; c.fillRect(R() * w, R() * h, 2 + R() * 4, 2 + R() * 4); }
    const cell = 16; c.lineWidth = 5; c.lineCap = 'square';
    // nested-square labyrinth like the carved Battlefield blocks
    for (let k = 1; k < 4; k++) {
      const m = k * cell, gap = (k * 37) % 4;
      const seg = [[m, m, w - m, m], [w - m, m, w - m, h - m], [w - m, h - m, m, h - m], [m, h - m, m, m]];
      seg.forEach((s, i) => { if (i === gap) return; c.strokeStyle = dark; c.beginPath(); c.moveTo(s[0], s[1]); c.lineTo(s[2], s[3]); c.stroke();
        c.strokeStyle = light; c.lineWidth = 1.5; c.beginPath(); c.moveTo(s[0] + 3, s[1] + 3); c.lineTo(s[2] + 3, s[3] + 3); c.stroke(); c.lineWidth = 5; });
    }
    c.strokeStyle = dark; c.beginPath(); c.moveTo(w / 2, h / 2 - cell); c.lineTo(w / 2, h / 2 + cell / 2); c.lineTo(w / 2 + cell, h / 2 + cell / 2); c.stroke();
    if (o.border) { c.strokeStyle = dark; c.lineWidth = 6; c.strokeRect(2, 2, w - 4, h - 4); }
  });
}

function trapezoid(xTopHalf, xBotHalf, yTop, yBot, depthFront, depthBack, rs, mats) {
  // prism with top width 2*xTopHalf, bottom 2*xBotHalf, spanning z from -depthBack..depthFront
  const shape = new THREE.Shape([new THREE.Vector2(-xTopHalf * rs, yTop * rs), new THREE.Vector2(xTopHalf * rs, yTop * rs), new THREE.Vector2(xBotHalf * rs, yBot * rs), new THREE.Vector2(-xBotHalf * rs, yBot * rs)]);
  const geo = new THREE.ExtrudeGeometry(shape, { depth: (depthFront + depthBack) * rs, bevelEnabled: false });
  geo.translate(0, 0, -depthBack * rs);
  // ExtrudeGeometry UVs are in shape units; rescale so textures tile about every 600 game units
  const uv = geo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / (600 * rs), uv.getY(i) / (600 * rs));
  return new THREE.Mesh(geo, mats);
}

function build(scene, rs, d) {
  const R = rng(4);
  const root = new THREE.Group(); scene.add(root);
  // --- void backdrop
  const cloud = tex(512, 256, (c, w, h) => {
    const g = c.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#1a6a50'); g.addColorStop(0.2, '#3a7a28'); g.addColorStop(0.32, '#5a7a18'); g.addColorStop(0.42, '#204a50'); g.addColorStop(0.5, '#1c1888'); g.addColorStop(0.6, '#2c10a8'); g.addColorStop(0.75, '#7a20c0'); g.addColorStop(1, '#c040d0');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 1400; i++) {
      const x = R() * w, y = R() * h * 0.48, r = 3 + R() * 9;
      c.fillStyle = ['rgba(150,170,40,0.14)', 'rgba(20,50,30,0.18)', 'rgba(60,160,120,0.12)', 'rgba(20,20,80,0.14)'][i % 4];
      for (const dx of [-w, 0, w]) { c.beginPath(); c.arc(x + dx, y, r, 0, 7); c.fill(); }
    }
  }, { repeat: [1, 1] });
  cloud.wrapS = THREE.RepeatWrapping;
  const flame = tex(256, 256, (c, w, h) => {
    c.clearRect(0, 0, w, h);
    for (let i = 0; i < 90; i++) {
      const x = R() * w, b = h, top = h * (0.15 + R() * 0.5), r = 6 + R() * 14;
      const g = c.createLinearGradient(0, top, 0, b); g.addColorStop(0, 'rgba(200,40,220,0)'); g.addColorStop(0.5, 'rgba(210,60,230,0.35)'); g.addColorStop(1, 'rgba(240,110,240,0.7)');
      c.fillStyle = g;
      for (const dx of [-w, 0, w]) { c.beginPath(); c.moveTo(x + dx - r, b); c.quadraticCurveTo(x + dx - r * 0.4, (top + b) / 2, x + dx, top); c.quadraticCurveTo(x + dx + r * 0.4, (top + b) / 2, x + dx + r, b); c.fill(); }
    }
  }, { repeat: [3, 1] });
  flame.wrapT = THREE.ClampToEdgeWrapping;
  const bg = new THREE.Group(); scene.add(bg);
  bg.add(bgPlane(36000, 18000, cloud, -9000, rs));
  const fl = bgPlane(36000, 7000, flame, -8900, rs, { transparent: true }); fl.position.y = -4500 * rs; bg.add(fl);
  const fl2 = bgPlane(36000, 4000, flame, -8800, rs, { transparent: true, opacity: 0.8 }); fl2.position.y = -6200 * rs; bg.add(fl2);

  // --- main island
  const topTex = tex(128, 128, (c, w, h) => { c.fillStyle = '#9aa898'; c.fillRect(0, 0, w, h); for (let i = 0; i < 900; i++) { c.fillStyle = R() < 0.5 ? 'rgba(40,50,40,0.12)' : 'rgba(255,255,240,0.1)'; c.fillRect(R() * w, R() * h, 2 + R() * 3, 2 + R() * 3); } }, { repeat: [1, 1] });
  topTex.wrapS = topTex.wrapT = THREE.RepeatWrapping;
  const sideGrey = mazeTex(R, '#6a6c74', '#2a2a34', '#9a9aa8', { border: true }); sideGrey.wrapS = sideGrey.wrapT = THREE.RepeatWrapping;
  const purple = mazeTex(R, '#58507a', '#221838', '#8a80b0', { border: true }); purple.wrapS = purple.wrapT = THREE.RepeatWrapping;
  const mTop = new THREE.MeshLambertMaterial({ map: topTex }), mGrey = new THREE.MeshLambertMaterial({ map: sideGrey }), mPurple = new THREE.MeshLambertMaterial({ map: purple });
  // ExtrudeGeometry material groups: 0 = front/back caps, 1 = sides (incl. top face)
  // top slab: y 0..-270, sloped ends 1950 -> 1803
  const slab = trapezoid(1950, 1803, 0, -270, 600, 600, rs, [mGrey, mTop]); root.add(slab);
  // second tier: y -270..-607, x 1387 -> 1246 (comes a bit forward)
  root.add(trapezoid(1387, 1246, -270, -607, 720, 520, rs, [mPurple, mPurple]));
  // bottom tier: y -607..-1080, x 623 -> 525 (comes furthest forward)
  root.add(trapezoid(623, 525, -607, -1080, 860, 460, rs, [mPurple, mPurple]));
  // lighter lip line on the top edge
  const lip = new THREE.Mesh(new THREE.BoxGeometry(3900 * rs, 24 * rs, 1210 * rs), new THREE.MeshLambertMaterial({ color: 0xc0c8b8 })); lip.position.y = -12 * rs; root.add(lip);

  // --- soft platforms: reddish carved stone, thin with a short stepped underside
  const red = tex(128, 32, (c, w, h) => { c.fillStyle = '#8a3040'; c.fillRect(0, 0, w, h); c.strokeStyle = '#4a1020'; c.lineWidth = 3;
    for (let x = 0; x < w; x += 16) { c.beginPath(); c.moveTo(x, 4); c.lineTo(x + 8, h - 4); c.lineTo(x + 16, 4); c.stroke(); }
    for (let i = 0; i < 200; i++) { c.fillStyle = 'rgba(255,180,190,0.12)'; c.fillRect(R() * w, R() * h, 2, 2); } }, { repeat: [1, 1] });
  red.wrapS = red.wrapT = THREE.RepeatWrapping;
  const mRed = new THREE.MeshLambertMaterial({ map: red }), mRedTop = new THREE.MeshLambertMaterial({ color: 0xa89078 });
  for (const f of d.groups[0].floors.filter(f => f.pass)) {
    const x1 = f.pts[0][0], x2 = f.pts[f.pts.length - 1][0], y = f.pts[0][1], cx = (x1 + x2) / 2, hw = (x2 - x1) / 2;
    const top = trapezoid(hw, hw - 20, y, y - 70, 160, 160, rs, [mRed, mRedTop]); top.position.x = cx * rs; root.add(top);
    const under = trapezoid(hw * 0.45, hw * 0.4, y - 70, y - 130, 140, 140, rs, [mRed, mRed]); under.position.x = cx * rs; root.add(under);
  }
  return { root, background: bg, flame, cloud };
}
