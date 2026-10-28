// Hyrule Castle art: lavender sky with misty mountains, grey castle blocks with green tiled roofs and spires,
// the tall tower with its plank platforms, the green roof "tent", and the tornado.
import * as THREE from 'three';
import { mat, kit } from '../render/rig.js';
import { backdrop, canvasTex, prism } from './common.js';

function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
const tex = (w, h, draw, rep) => { const t = canvasTex(w, h, draw); t.wrapS = t.wrapT = THREE.RepeatWrapping; if (rep) t.repeat.set(...rep); return t; };
const tmat = (t, o = {}) => new THREE.MeshLambertMaterial({ map: t, ...o });

function paintSky(c, w, h) {
  const R = rng(41);
  const g = c.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#a89ac8'); g.addColorStop(0.25, '#c4b4dc'); g.addColorStop(0.42, '#e6c8e0'); g.addColorStop(0.55, '#c8bcd8'); g.addColorStop(1, '#8a9a90');
  c.fillStyle = g; c.fillRect(0, 0, w, h);
  // soft clouds
  for (let i = 0; i < 160; i++) {
    const x = R() * w, y = R() * h * 0.42, r = 30 + R() * 90;
    const gr = c.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, `rgba(255,245,255,${0.25 + R() * 0.3})`); gr.addColorStop(1, 'rgba(255,245,255,0)');
    c.fillStyle = gr; c.beginPath(); c.ellipse(x, y, r * 2.2, r * 0.7, 0, 0, 7); c.fill();
  }
  for (let i = 0; i < 12; i++) { const x = R() * w, y = h * (0.1 + R() * 0.25); c.fillStyle = 'rgba(150,120,180,0.25)'; c.beginPath(); c.ellipse(x, y, 160 + R() * 120, 22 + R() * 16, 0, 0, 7); c.fill(); }
  // mountain ranges (back to front), hazy lavender to green
  const range = (base, amp, col, seed, step) => {
    const r = rng(seed); c.fillStyle = col; c.beginPath(); c.moveTo(0, h);
    let y = base; for (let x = 0; x <= w + step; x += step) { y = base - amp * (0.4 + r() * 0.6) * (0.6 + 0.4 * Math.sin(x / w * 7 + seed)); c.lineTo(x, y); }
    c.lineTo(w, h); c.fill();
  };
  range(h * 0.5, h * 0.18, 'rgba(150,140,175,0.85)', 3, 60);
  // Death Mountain: broad peak right of centre
  c.fillStyle = 'rgba(130,120,160,0.9)'; c.beginPath(); c.moveTo(w * 0.42, h * 0.62); c.lineTo(w * 0.58, h * 0.28); c.lineTo(w * 0.61, h * 0.27); c.lineTo(w * 0.8, h * 0.62); c.fill();
  c.fillStyle = 'rgba(200,190,215,0.6)'; c.beginPath(); c.ellipse(w * 0.6, h * 0.25, 60, 16, 0, 0, 7); c.fill();
  range(h * 0.6, h * 0.12, 'rgba(128,140,150,0.9)', 7, 50);
  range(h * 0.7, h * 0.1, 'rgba(100,130,110,0.95)', 11, 40);
  range(h * 0.8, h * 0.08, 'rgba(80,115,85,1)', 13, 34);
  // haze
  const hz = c.createLinearGradient(0, h * 0.45, 0, h); hz.addColorStop(0, 'rgba(230,210,240,0)'); hz.addColorStop(0.4, 'rgba(230,210,240,0.35)'); hz.addColorStop(1, 'rgba(200,210,210,0.3)');
  c.fillStyle = hz; c.fillRect(0, h * 0.45, w, h * 0.55);
}

function stoneTex(rows = 8, cols = 4) {
  return tex(256, 256, (c, w, h) => {
    const R = rng(17);
    c.fillStyle = '#5c5664'; c.fillRect(0, 0, w, h);
    const bh = h / rows, bw = w / cols;
    for (let r = 0; r < rows; r++) for (let i = -1; i <= cols; i++) {
      const x = i * bw + (r % 2 ? bw / 2 : 0), y = r * bh, v = (R() - 0.5) * 22;
      c.fillStyle = `rgb(${142 + v | 0},${134 + v | 0},${150 + v | 0})`; c.fillRect(x + 3, y + 3, bw - 6, bh - 6);
      c.fillStyle = 'rgba(255,255,255,0.12)'; c.fillRect(x + 3, y + 3, bw - 6, 3);
    }
  }, [0.25, 0.25]);
}
function herringbone() {
  return tex(128, 128, (c, w, h) => {
    c.fillStyle = '#9a9090'; c.fillRect(0, 0, w, h);
    for (let y = -16; y < h + 16; y += 16) for (let x = 0; x < w; x += 32) {
      c.fillStyle = (x / 32 + y / 16) % 2 ? '#d8cfcc' : '#cbc1bf';
      c.save(); c.translate(x, y); c.rotate(Math.PI / 4); c.fillRect(0, 0, 21, 9); c.restore();
      c.save(); c.translate(x + 16, y); c.rotate(-Math.PI / 4); c.fillRect(0, 0, 21, 9); c.restore();
    }
  }, [0.4, 0.4]);
}
function greenTiles() {
  return tex(128, 128, (c, w, h) => {
    c.fillStyle = '#1e3e2a'; c.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 16) for (let x = (y / 16) % 2 ? -8 : 0; x < w; x += 16) { c.fillStyle = '#2f5a3a'; c.fillRect(x + 1, y + 1, 14, 13); c.fillStyle = '#467a50'; c.fillRect(x + 1, y + 1, 14, 3); }
  }, [0.5, 0.5]);
}
function capTex() {
  return tex(256, 64, (c, w, h) => { c.fillStyle = '#c9bca4'; c.fillRect(0, 0, w, h); for (let x = 0; x < w; x += 64) { c.fillStyle = '#a89a84'; c.fillRect(x, 0, 3, h); } c.fillStyle = '#e4d8c2'; c.fillRect(0, 4, w, 6); c.fillStyle = '#8a7e6a'; c.fillRect(0, h - 8, w, 8); }, [0.25, 1]);
}

// block extruded vertically from an x/z outline (y from y0 to y1); materials [top/bottom caps, walls]
function yBlock(xz, y0, y1, mats, rs) {
  const shape = new THREE.Shape();
  xz.forEach(([x, z], i) => (i ? shape.lineTo(x * rs, -z * rs) : shape.moveTo(x * rs, -z * rs)));
  const geo = new THREE.ExtrudeGeometry(shape, { depth: (y1 - y0) * rs, bevelEnabled: false });
  geo.rotateX(-Math.PI / 2); geo.translate(0, y0 * rs, 0);
  return new THREE.Mesh(geo, mats);
}

function pyramid(rs, base, h, matl) {
  const g = new THREE.ConeGeometry(base / Math.SQRT2 * rs, h * rs, 4).translate(0, h * rs / 2, 0);
  g.rotateY(Math.PI / 4);
  return new THREE.Mesh(g, matl);
}

function windowMesh(rs, w, h) {
  const t = canvasTex(64, 64, (c, W, H) => { c.fillStyle = '#7a7286'; c.fillRect(0, 0, W, H); c.fillStyle = '#141018'; c.beginPath(); c.moveTo(6, H); c.lineTo(6, 26); c.arc(32, 26, 26, Math.PI, 0); c.lineTo(58, H); c.fill(); c.fillStyle = '#4a4450'; for (let x = 12; x < 58; x += 10) c.fillRect(x, 6, 3, H); c.fillRect(6, 40, 52, 3); });
  return new THREE.Mesh(new THREE.PlaneGeometry(w * rs, h * rs), new THREE.MeshLambertMaterial({ map: t }));
}

function swirlTex() {
  return tex(256, 128, (c, w, h) => {
    c.clearRect(0, 0, w, h);
    for (let i = 0; i < 14; i++) {
      const y = (i / 14) * h, col = i % 3 === 0 ? 'rgba(255,255,255,0.95)' : i % 3 === 1 ? 'rgba(90,190,255,0.95)' : 'rgba(20,90,220,0.9)';
      c.strokeStyle = col; c.lineWidth = 5 + (i % 4) * 2; c.beginPath(); c.moveTo(0, y); c.bezierCurveTo(w * 0.3, y + 18, w * 0.6, y - 18, w, y + 8); c.stroke();
    }
  }, [2, 1]);
}

export function buildHyrule(scene, rs, d) {
  const root = new THREE.Group(); scene.add(root);
  const bg = backdrop(scene, rs, paintSky, { tw: 2048, th: 1024, w: 44000, h: 22000, y: 2500, z: -11000 });
  const O = (x, y, z = 0) => [x * rs, y * rs, z * rs];
  const greenCone = tmat(greenTiles()); greenCone.map.repeat.set(5, 7);
  const stone = tmat(stoneTex()), stoneD = tmat(stoneTex(), { color: 0xd8d4e0 }), herr = tmat(herringbone()), green = tmat(greenTiles()), cap = tmat(capTex());
  const BOT = -2600;
  // ---------- main roof block (x -2676..1785, top 1022) ----------
  // the front corners are chamfered (45 deg, 350 u) so the block's walls never sit in front of a fighter
  // standing on the side roofs right next to them (the battle camera looks in from the stage centre)
  root.add(yBlock([[-2676, -1450], [1785, -1450], [1785, 0], [1435, 350], [-2326, 350], [-2676, 0]], BOT, 1022, [herr, stoneD], rs));
  root.add(prism([[-2290, 1022], [1400, 1022], [1400, 900], [-2290, 900]], 100, [cap, cap], rs, 340));       // front cornice
  for (let x = -2000; x <= 1200; x += 800) root.add(kit.box(90 * rs, (900 - BOT) * rs, 60 * rs, 0x7e7888, O(x, (900 + BOT) / 2, 360)));
  for (const x of [-1800, -200, 1100]) { const wdw = windowMesh(rs, 260, 300); wdw.position.set(x * rs, 300 * rs, 352 * rs); root.add(wdw); }
  // ---------- left lean-to roof (slope -4462,191 -> -2676,623) on a stone block ----------
  root.add(prism([[-4462, 191], [-2676, 623], [-2676, 60], [-4462, 60]], 1700, [green, green], rs, -550));
  root.add(prism([[-4462, 60], [-2676, 60], [-2676, BOT], [-4462, BOT]], 1600, [stone, stone], rs, -550));
  { const wdw = windowMesh(rs, 240, 260); wdw.position.set(-3600 * rs, -350 * rs, 252 * rs); root.add(wdw); }
  // ---------- right low roof (x 1785..4601, top ~8) ----------
  root.add(prism([[1785, 9], [4601, 8], [4601, BOT], [1785, BOT]], 1800, [stoneD, herr], rs, -550));
  root.add(prism([[1785, 9], [4625, 8], [4625, -110], [1785, -110]], 100, [cap, cap], rs, 340));
  { const wdw = windowMesh(rs, 240, 260); wdw.position.set(3200 * rs, -600 * rs, 352 * rs); root.add(wdw); }
  // green "tent": solid trapezoid 848..1908 on four pillars, with an eave out to x 4005
  root.add(prism([[3195, 848], [3893, 848], [3747, 1908], [3338, 1908]], 700, [green, green], rs));
  root.add(prism([[3150, 848], [4005, 848], [3990, 900], [3170, 910]], 760, [mat(0x24442e), mat(0x24442e)], rs));
  // pillars stay behind the fighting plane (z <= 0): fighters walk under the tent along the low roof
  for (const x of [3260, 3830]) for (const z of [-300, -50]) root.add(kit.box(80 * rs, 840 * rs, 80 * rs, 0x8a8494, O(x, 428, z)));
  { const wdw = windowMesh(rs, 180, 220); wdw.position.set(3545 * rs, 1300 * rs, 360 * rs); root.add(wdw); }
  // ---------- tall tower with plank platforms ----------
  const TZ = -950, TD = 1200;
  root.add(prism([[-420, 1022], [1290, 1022], [1290, 4600], [-420, 4600]], TD, [stone, stone], rs, TZ));
  for (const y of [2550, 3420]) root.add(kit.box(1820 * rs, 70 * rs, (TD + 80) * rs, 0x8a8494, O(435, y, TZ)));
  for (let x = -380; x <= 1250; x += 180) root.add(kit.box(110 * rs, 160 * rs, 110 * rs, 0x8e8898, O(x, 4680, TZ + TD / 2 - 60)));
  { const pm = pyramid(rs, 1250, 2300, greenCone); pm.position.set(435 * rs, 4600 * rs, TZ * rs); root.add(pm); }
  for (const [x, y] of [[900, 3900], [150, 2250], [450, 3050]]) { const wdw = windowMesh(rs, 220, 260); wdw.position.set(x * rs, y * rs, (TZ + TD / 2 + 3) * rs); root.add(wdw); }
  const plankT0 = tex(128, 32, (c, w, h) => { c.fillStyle = '#b08850'; c.fillRect(0, 0, w, h); c.fillStyle = '#7a5a2a'; c.fillRect(0, 10, w, 2); c.fillRect(0, 21, w, 2); c.fillStyle = '#d4ac6a'; c.fillRect(0, 2, w, 3); }, [0.3, 1]);
  for (const f of d.groups[0].floors.filter(f => f.pass)) {
    const a = f.pts[0], b = f.pts[f.pts.length - 1];
    const z0 = TZ + TD / 2, depth = 380 - z0;
    root.add(prism([a, b, [b[0], b[1] - 110], [a[0], a[1] - 110]], depth, [tmat(plankT0), tmat(plankT0)], rs, z0 + depth / 2));
  }
  // ---------- spires ----------
  { const pm = pyramid(rs, 900, 2600, greenCone); pm.position.set(-1650 * rs, 1022 * rs, -900 * rs); root.add(pm); }
  root.add(kit.box(1000 * rs, 120 * rs, 1000 * rs, 0x8a8494, O(-1650, 1022, -900)));
  // small pyramid on the right roof, behind the fighting plane
  { const pm = pyramid(rs, 650, 1300, greenCone); pm.position.set(2500 * rs, 9 * rs, -1100 * rs); root.add(pm); }
  // ---------- tornado ----------
  const tw = new THREE.Group(); root.add(tw); tw.visible = false;
  const sw = swirlTex();
  const rings = [];
  for (let i = 0; i < 9; i++) {
    const r0 = 90 + i * 34, r1 = 90 + (i + 1) * 34, hh = 105;
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r1 * rs, r0 * rs, hh * rs, 14, 1, true), new THREE.MeshBasicMaterial({ map: sw, transparent: true, side: THREE.DoubleSide, depthWrite: false, opacity: 0.9 }));
    m.position.y = (i * 100 + hh / 2) * rs; tw.add(m); rings.push(m);
  }
  const dust = new THREE.Mesh(new THREE.RingGeometry(150 * rs, 380 * rs, 18), new THREE.MeshBasicMaterial({ color: 0xd8e8ff, transparent: true, opacity: 0.4, side: THREE.DoubleSide, depthWrite: false }));
  dust.rotation.x = -Math.PI / 2; dust.position.y = 10 * rs; tw.add(dust);
  return { root, background: bg, tw, rings, dust, sw };
}

export function syncHyrule(obj, m, rs, st) {
  if (!obj) return;
  const T = st.tw; if (!T) return;
  const vis = T.state !== 'wait';
  obj.tw.visible = vis;
  if (!vis) return;
  let k = 1;
  if (T.state === 'summon') k = 1 - T.t / 80; else if (T.state === 'subside') k = T.t / 32;
  obj.tw.position.set(T.x * rs, T.y * rs, 0);
  obj.tw.scale.set(0.3 + 0.7 * k, k, 0.3 + 0.7 * k);
  obj.rings.forEach((r, i) => { r.rotation.y = m.frame * (0.35 + i * 0.03); r.position.x = Math.sin(m.frame * 0.15 + i * 0.6) * 18 * i * rs; });
  obj.sw.offset.y = (m.frame * 0.03) % 1;
  obj.dust.rotation.z = m.frame * 0.2;
}
