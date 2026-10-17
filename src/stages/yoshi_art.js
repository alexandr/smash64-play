// Yoshi's Island art (shared by the VS stage and the small 1P Yoshi Team stage): a pop-up storybook.
// Knitted/felt orange backdrop that does not parallax, the Super Happy Tree as a cardboard cut-out,
// an open book as the main platform (V-shaped top following the floor polyline), cardboard soft
// platforms and lavender puff clouds that ride their moving collision groups.
import * as THREE from 'three';
import { mat, kit } from '../render/rig.js';
import { backdrop, canvasTex, prism } from './common.js';

// Lambert material that also glows with its own texture (three's physically based Lambert is dim;
// this keeps the bright, flat felt/cardboard look while preserving some shading).
function lam(map, color = 0xffffff, glow = 0.45) {
  const e = new THREE.Color(glow, glow, glow);
  return new THREE.MeshLambertMaterial({ map, color, emissive: e, emissiveMap: map ?? null });
}

// ---------- canvas helpers ----------
function knit(c, w, h, base, dark, light, step = 6) {
  c.fillStyle = base; c.fillRect(0, 0, w, h);
  // tiny V stitches like knitted wool
  for (let y = 0; y < h; y += step) for (let x = 0; x < w; x += step) {
    c.strokeStyle = (x / step + y / step) % 2 ? dark : light; c.globalAlpha = 0.18; c.lineWidth = 1;
    c.beginPath(); c.moveTo(x, y); c.lineTo(x + step / 2, y + step * 0.8); c.lineTo(x + step, y); c.stroke();
  }
  c.globalAlpha = 1;
}
function puff(c, cx, cy, r, n, fill, stroke, lw) {
  // cloud outline from n bumps around an ellipse
  c.beginPath();
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2, x = cx + Math.cos(a) * r * 1.35, y = cy + Math.sin(a) * r * 0.8;
    c.arc(x, y, r * 0.55, a - 1.5, a + 1.5);
  }
  c.closePath();
  if (stroke) { c.lineWidth = lw; c.strokeStyle = stroke; c.lineJoin = 'round'; c.stroke(); }
  c.fillStyle = fill; c.fill();
}
function stitches(c, x, y, w, h, col, n = 3, ang = -0.5) {
  c.save(); c.translate(x, y); c.rotate(ang); c.fillStyle = col;
  for (let i = 0; i < n; i++) { c.globalAlpha = 0.85; roundRect(c, i * w * 1.3, 0, w, h, w * 0.4); c.fill(); }
  c.restore(); c.globalAlpha = 1;
}
function roundRect(c, x, y, w, h, r) {
  c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
}

// ---------- felt / embroidery helpers for the backdrop ----------
function srng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
// scalloped cloud outline: rounded bumps with inward cusps (r = R(0.78 + 0.22|sin(n a / 2)|))
function cloudPath(cx, cy, rx, ry, n, rot = 0) {
  const pts = [];
  for (let i = 0; i < 160; i++) { const a = i / 160 * Math.PI * 2, k = 0.76 + 0.24 * Math.sqrt(Math.abs(Math.sin(n * (a + rot) / 2))); pts.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]); }
  return pts;
}
function polyPath(c, pts) { c.beginPath(); pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath(); }
// satin-stitch border: a thick band of short threads across the outline, alternating two shades
function satin(c, pts, width, colA, colB, cx, cy) {
  c.lineCap = 'round';
  const n = pts.length;
  for (let i = 0; i < n * 3; i++) {
    const t = i / 3, i0 = Math.floor(t) % n, i1 = (i0 + 1) % n, f = t - Math.floor(t);
    const x = pts[i0][0] + (pts[i1][0] - pts[i0][0]) * f, y = pts[i0][1] + (pts[i1][1] - pts[i0][1]) * f;
    const dx = x - cx, dy = y - cy, l = Math.hypot(dx, dy) || 1;
    c.strokeStyle = i % 2 ? colA : colB; c.lineWidth = 2.2;
    c.beginPath(); c.moveTo(x - dx / l * width * 0.5, y - dy / l * width * 0.5); c.lineTo(x + dx / l * width * 0.5, y + dy / l * width * 0.5); c.stroke();
  }
}
// knitted fill: small V stitches over a flat colour
function knitFill(c, col, x0, y0, x1, y1, step = 5, alpha = 0.16) {
  c.save(); c.lineWidth = 1;
  for (let y = y0; y < y1; y += step) for (let x = x0 + ((y / step) % 2) * step / 2; x < x1; x += step) {
    c.strokeStyle = (x + y) % 3 ? `rgba(255,255,255,${alpha})` : `rgba(120,60,30,${alpha * 0.7})`;
    c.beginPath(); c.moveTo(x, y); c.lineTo(x + step / 2, y + step * 0.7); c.lineTo(x + step, y); c.stroke();
  }
  c.restore(); void col;
}
// embossed felt shape: soft drop shadow, fill, knit texture inside, satin border
function feltShape(c, pts, cx, cy, fill, borderA, borderB, bw) {
  c.save(); c.translate(5, 7); polyPath(c, pts); c.fillStyle = 'rgba(150,80,50,0.22)'; c.fill(); c.restore();
  polyPath(c, pts); c.fillStyle = fill; c.fill();
  c.save(); polyPath(c, pts); c.clip();
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (const [x, y] of pts) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  knitFill(c, fill, x0, y0, x1, y1, 5, 0.2);
  const g = c.createLinearGradient(0, y0, 0, y1); g.addColorStop(0, 'rgba(255,255,255,0.25)'); g.addColorStop(1, 'rgba(160,110,90,0.12)'); c.fillStyle = g; c.fillRect(x0, y0, x1 - x0, y1 - y0);
  c.restore();
  satin(c, pts, bw, borderA, borderB, cx, cy);
}
// three stitched felt bars (the "shine" marks on clouds and hills)
function bars(c, x, y, len, wid, col, shade, ang, n = 3) {
  c.save(); c.translate(x, y); c.rotate(ang);
  for (let i = 0; i < n; i++) {
    const bx = i * wid * 1.5, by = (i - 1) * len * 0.12;
    c.fillStyle = 'rgba(140,90,70,0.25)'; roundRect(c, bx + 3, by + 4, wid, len, wid * 0.45); c.fill();
    c.fillStyle = col; roundRect(c, bx, by, wid, len, wid * 0.45); c.fill();
    c.strokeStyle = shade; c.lineWidth = 1.5; for (let k = 3; k < len - 2; k += 4) { c.beginPath(); c.moveTo(bx + 3, by + k); c.lineTo(bx + wid - 3, by + k + 2); c.stroke(); }
  }
  c.restore();
}
function cloud(c, x, y, rx, ry, n, fill, bA, bB, barCol, rot = 0) {
  const pts = cloudPath(x, y, rx, ry, n, rot);
  feltShape(c, pts, x, y, fill, bA, bB, Math.max(10, rx * 0.13));
  if (barCol) bars(c, x + rx * 0.05, y - ry * 0.05, ry * 0.55, rx * 0.16, barCol, 'rgba(120,160,190,0.35)', -0.75);
}
function hill(c, x, base, rx, ry, fill, bA, bB, barCol) {
  const pts = []; for (let i = 0; i <= 80; i++) { const a = Math.PI + i / 80 * Math.PI; pts.push([x + Math.cos(a) * rx, base + Math.sin(a) * ry]); }
  pts.push([x + rx, base + 400], [x - rx, base + 400]);
  feltShape(c, pts, x, base, fill, bA, bB, 12);
  if (barCol) bars(c, x - rx * 0.3, base - ry * 0.7, ry * 0.3, rx * 0.11, barCol, 'rgba(200,170,80,0.35)', -0.5);
}
function sun(c, sx, sy, sr) {
  // ten stitched felt rays (trapezoid tabs), alternating pale yellow / peach with a lavender shadow edge
  for (let i = 0; i < 10; i++) {
    const a = i / 10 * Math.PI * 2 - Math.PI / 2 + 0.12, r0 = sr * 1.22, r1 = sr * 1.22 + sr * (i % 2 ? 0.52 : 0.62), w0 = sr * 0.2, w1 = sr * 0.3;
    c.save(); c.translate(sx, sy); c.rotate(a);
    const quad = () => { c.beginPath(); c.moveTo(r0, -w0); c.lineTo(r1, -w1); c.lineTo(r1, w1); c.lineTo(r0, w0); c.closePath(); };
    c.save(); c.translate(3, 4); quad(); c.fillStyle = 'rgba(190,140,200,0.45)'; c.fill(); c.restore();
    quad(); c.fillStyle = i % 2 ? '#f8e6a8' : '#fbd0ac'; c.fill();
    c.save(); quad(); c.clip(); c.strokeStyle = i % 2 ? 'rgba(220,180,60,0.5)' : 'rgba(230,140,90,0.45)'; c.lineWidth = 1.6;
    for (let k = -w1; k < w1; k += 3.5) { c.beginPath(); c.moveTo(r0, k); c.lineTo(r1, k + 1.5); c.stroke(); }
    c.restore(); c.restore();
  }
  // disc with a satin rim
  const disc = []; for (let i = 0; i < 120; i++) { const a = i / 120 * Math.PI * 2; disc.push([sx + Math.cos(a) * sr, sy + Math.sin(a) * sr]); }
  c.save(); c.translate(4, 6); polyPath(c, disc); c.fillStyle = 'rgba(170,100,80,0.25)'; c.fill(); c.restore();
  polyPath(c, disc); c.fillStyle = '#fbc696'; c.fill();
  satin(c, disc.map(([x, y]) => [sx + (x - sx) * 0.9, sy + (y - sy) * 0.9]), sr * 0.2, '#fcd6a8', '#f4b682', sx, sy);
  c.fillStyle = '#f49e7c'; c.beginPath(); c.arc(sx, sy, sr * 0.78, 0, Math.PI * 2); c.fill();
  // stitched spiral in the middle
  const sp = []; for (let a = 0; a < Math.PI * 4.4; a += 0.06) { const r = sr * (0.08 + a * 0.048); sp.push([sx + Math.cos(a + 2.4) * r, sy + Math.sin(a + 2.4) * r, a]); }
  c.lineCap = 'round'; c.lineJoin = 'round';
  c.strokeStyle = '#fbd2a4'; c.lineWidth = sr * 0.2; c.beginPath(); sp.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.stroke();
  c.strokeStyle = 'rgba(236,150,100,0.55)'; c.lineWidth = 1.6;
  for (let i = 1; i < sp.length; i++) { const [x, y] = sp[i], [px, py] = sp[i - 1], dx = x - px, dy = y - py, l = Math.hypot(dx, dy) || 1, nx = -dy / l * sr * 0.09, ny = dx / l * sr * 0.09; c.beginPath(); c.moveTo(x - nx, y - ny); c.lineTo(x + nx, y + ny); c.stroke(); }
}

function paintBackdrop(c, w, h) {
  const R = srng(7);
  // warm peach felt with a fine woven grid
  const gr = c.createLinearGradient(0, 0, 0, h);
  gr.addColorStop(0, '#efb88e'); gr.addColorStop(0.5, '#f2c49a'); gr.addColorStop(1, '#f6d2aa');
  c.fillStyle = gr; c.fillRect(0, 0, w, h);
  c.fillStyle = 'rgba(255,236,214,0.22)'; for (let y = 0; y < h; y += 4) c.fillRect(0, y, w, 1);
  c.fillStyle = 'rgba(196,120,80,0.12)'; for (let x = 0; x < w; x += 4) c.fillRect(x, 0, 1, h);
  for (let i = 0; i < 12000; i++) { c.fillStyle = R() < 0.5 ? 'rgba(255,240,220,0.22)' : 'rgba(190,110,70,0.1)'; c.fillRect(R() * w, R() * h, 2, 2); }
  // swirled felt sun, upper left of the play area
  sun(c, w * 0.322, h * 0.37, 72);
  // stitched felt clouds (white fill, coloured satin borders, pale-blue shine bars)
  cloud(c, w * 0.478, h * 0.25, 120, 70, 5, '#fdf2f4', '#f6d4e4', '#e8bcd4', '#d6ecf8', 0.3);
  cloud(c, w * 0.645, h * 0.37, 160, 110, 6, '#fbf8f2', '#f8eab8', '#eed894', '#d4e8f4', 0.1);
  cloud(c, w * 0.79, h * 0.44, 110, 85, 6, '#fffcea', '#f4ec70', '#e2d450', null, 0.5);
  cloud(c, w * 0.17, h * 0.3, 130, 80, 6, '#fdf4f0', '#cfe6f4', '#b4d4ec', '#d8eef8', 0.2);
  cloud(c, w * 0.9, h * 0.22, 140, 90, 6, '#fdf6f6', '#f6d4e4', '#e8bcd4', '#d6ecf8', 0.4);
  cloud(c, w * 0.04, h * 0.5, 120, 80, 5, '#fffcea', '#f4ec70', '#e2d450', null, 0.1);
  // rolling felt hills (pale green, one pink) with yellow stitched tufts; a blue-bordered cloud low left
  cloud(c, w * 0.27, h * 0.66, 95, 62, 5, '#f4f6fa', '#cfe0f8', '#b6cbee', null, 0.6);
  hill(c, w * 0.08, h * 0.79, 150, 170, '#d4ecbc', '#eef8d0', '#d6eab0', '#f6eaa8');
  hill(c, w * 0.39, h * 0.79, 115, 120, '#f6d8d8', '#fbe8ec', '#ecc8d0', '#f6eaa8');
  hill(c, w * 0.62, h * 0.79, 190, 190, '#cfe9b4', '#eef8d0', '#d2e6a8', '#f6eaa8');
  hill(c, w * 0.82, h * 0.79, 140, 150, '#d6eec0', '#eef8d0', '#d6eab0', '#f6eaa8');
  hill(c, w * 0.97, h * 0.79, 150, 160, '#cfe9b4', '#eef8d0', '#d2e6a8', '#f6eaa8');
  // little lavender cloud tufts
  for (const [x, y] of [[0.24, 0.6], [0.55, 0.52], [0.86, 0.63], [0.12, 0.58]]) for (let i = 0; i < 3; i++) {
    c.fillStyle = 'rgba(110,90,170,0.25)'; c.beginPath(); c.arc(x * w + i * 26 + 3, y * h + (i % 2) * 6 + 4, 18, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#b4b0f2'; c.beginPath(); c.arc(x * w + i * 26, y * h + (i % 2) * 6, 18, 0, Math.PI * 2); c.fill();
  }
  // scalloped white / yellow felt bands at the bottom, with satin edges
  const band = (y0, col, edgeA, edgeB, amp, per) => {
    const pts = [];
    for (let x = -per; x <= w + per; x += 4) { const ph = ((x % per) + per) % per / per; pts.push([x, y0 - amp * Math.sin(ph * Math.PI)]); }
    c.fillStyle = col; c.beginPath(); c.moveTo(-per, h); pts.forEach(([x, y]) => c.lineTo(x, y)); c.lineTo(w + per, h); c.closePath(); c.fill();
    knitFill(c, col, 0, y0 - amp, w, Math.min(h, y0 + 60), 5, 0.14);
    if (edgeA) { c.lineCap = 'round'; for (let i = 0; i < pts.length - 1; i++) { const [x, y] = pts[i], [x2, y2] = pts[i + 1], dx = x2 - x, dy = y2 - y, l = Math.hypot(dx, dy) || 1, nx = -dy / l * 5, ny = dx / l * 5; c.strokeStyle = i % 2 ? edgeA : edgeB; c.lineWidth = 2; c.beginPath(); c.moveTo(x - nx, y - ny); c.lineTo(x + nx, y + ny); c.stroke(); } }
  };
  band(h * 0.775, '#fffaf0', '#fffdf8', '#f2e6d6', 26, 70);
  band(h * 0.81, '#f8dc7c', '#fbe4a0', '#f0d070', 22, 70);
  band(h * 0.875, '#fff8ec', '#fffdf8', '#f2e6d6', 24, 90);
  band(h * 0.915, '#f8cf70', '#fbdc98', '#eec468', 20, 90);
}

function paintTree(c, w, h) {
  c.clearRect(0, 0, w, h);
  const cx = w * 0.52, cy = h * 0.42;
  // orange flower halo
  c.fillStyle = '#ff9a3c'; c.strokeStyle = '#ffc070'; c.lineWidth = 16;
  c.beginPath();
  for (let i = 0; i <= 14; i++) { const a = (i / 14) * Math.PI * 2; c.arc(cx + Math.cos(a) * 250, cy + Math.sin(a) * 230, 110, a - 1.4, a + 1.4); }
  c.closePath(); c.stroke(); c.fill();
  c.fillStyle = '#ffb860'; c.beginPath(); c.ellipse(cx, cy, 260, 240, 0, 0, Math.PI * 2); c.fill();
  // pale blue cloud on the left behind the trunk
  puff(c, w * 0.2, h * 0.6, 110, 8, '#f0f4ff', '#a8c0f8', 14);
  // stem and curly vines
  c.strokeStyle = '#4ca860'; c.lineWidth = 34; c.lineCap = 'round';
  c.beginPath(); c.moveTo(cx - 20, h); c.bezierCurveTo(cx - 60, h * 0.8, cx + 40, h * 0.7, cx, cy); c.stroke();
  c.lineWidth = 18;
  for (const [dx, dy, ex, ey] of [[-1, -1, -300, -260], [1, -1, 300, -240], [-1, 1, -320, 120], [1, 1, 320, 110]]) {
    c.beginPath(); c.moveTo(cx, cy); c.bezierCurveTo(cx + dx * 120, cy + dy * 40, cx + ex * 0.7, cy + ey * 1.1, cx + ex, cy + ey); c.stroke();
  }
  // leaves
  const leaf = (x, y, r, a, col) => { c.save(); c.translate(x, y); c.rotate(a); c.fillStyle = col; c.beginPath(); c.ellipse(0, 0, r, r * 0.45, 0, 0, Math.PI * 2); c.fill(); c.strokeStyle = '#2e8a48'; c.lineWidth = 4; c.beginPath(); c.moveTo(-r, 0); c.lineTo(r, 0); c.stroke(); c.restore(); };
  leaf(cx - 260, cy - 200, 80, -0.6, '#6cc070'); leaf(cx + 250, cy - 210, 70, 0.6, '#58b060'); leaf(cx - 330, cy + 60, 70, 0.3, '#6cc070');
  leaf(cx + 120, cy - 300, 60, -0.3, '#7ccc80'); leaf(cx - 120, cy + 260, 60, 0.4, '#58b060');
  // yellow banana-ish petals left
  c.fillStyle = '#f8e070'; c.beginPath(); c.ellipse(cx - 230, cy + 100, 120, 45, -0.35, 0, Math.PI * 2); c.fill();
  c.strokeStyle = '#e0b840'; c.lineWidth = 5; c.stroke();
  // fruits: watermelons, grapes, apple, pear
  const melon = (x, y, r) => { c.fillStyle = '#3a8a50'; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill(); c.strokeStyle = '#7ad090'; c.lineWidth = 7;
    for (let i = -2; i <= 2; i++) { c.beginPath(); c.ellipse(x + i * r * 0.32, y, Math.max(4, r * (0.9 - Math.abs(i) * 0.3) * 0.35), r * 0.95, 0, 0, Math.PI * 2); c.stroke(); } };
  melon(cx - 110, cy + 200, 95); melon(cx + 240, cy - 70, 80);
  for (let i = 0; i < 12; i++) { const gx = cx + 210 + (i % 3) * 36 - (Math.floor(i / 3) % 2) * 18, gy = cy + 110 + Math.floor(i / 3) * 34; c.fillStyle = '#6a58c8'; c.beginPath(); c.arc(gx, gy, 22, 0, Math.PI * 2); c.fill(); c.fillStyle = 'rgba(255,255,255,0.4)'; c.beginPath(); c.arc(gx - 7, gy - 7, 6, 0, Math.PI * 2); c.fill(); }
  c.fillStyle = '#ee6a6a'; c.beginPath(); c.arc(cx + 80, cy + 230, 50, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#e8d040'; c.beginPath(); c.arc(cx + 150, cy + 290, 40, 0, Math.PI * 2); c.fill();
  // the pink smiling heart face
  c.save(); c.translate(cx - 10, cy - 10);
  c.fillStyle = '#ff7896'; c.strokeStyle = '#ffb0c0'; c.lineWidth = 10;
  c.beginPath(); c.moveTo(0, 130);
  c.bezierCurveTo(-170, 30, -170, -120, -70, -125); c.bezierCurveTo(-20, -128, 0, -90, 0, -70);
  c.bezierCurveTo(0, -90, 20, -128, 70, -125); c.bezierCurveTo(170, -120, 170, 30, 0, 130);
  c.closePath(); c.fill(); c.stroke();
  c.fillStyle = '#3a1020'; c.beginPath(); c.ellipse(-48, -40, 10, 18, 0, 0, Math.PI * 2); c.ellipse(48, -40, 10, 18, 0, 0, Math.PI * 2); c.fill();
  c.strokeStyle = '#3a1020'; c.lineWidth = 9; c.beginPath(); c.arc(0, -5, 60, 0.35, Math.PI - 0.35); c.stroke();
  c.fillStyle = '#ff9eb0'; c.beginPath(); c.arc(-85, 10, 18, 0, Math.PI * 2); c.arc(85, 10, 18, 0, Math.PI * 2); c.fill();
  c.restore();
  // white twinkle dashes
  c.strokeStyle = '#ffffff'; c.lineWidth = 10; c.lineCap = 'round';
  for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4 + 0.3; c.beginPath(); c.moveTo(cx + Math.cos(a) * 190, cy + Math.sin(a) * 175); c.lineTo(cx + Math.cos(a) * 225, cy + Math.sin(a) * 205); c.stroke(); }
}

function woodTex(rep) {
  return canvasTex(128, 64, (c, w, h) => {
    c.fillStyle = '#e2b676'; c.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 4) { c.fillStyle = `rgba(110,70,30,${0.12 + Math.random() * 0.25})`; c.fillRect(0, y + Math.random() * 2, w, 1.5); }
    for (let i = 0; i < 5; i++) { c.strokeStyle = 'rgba(120,75,35,0.5)'; c.lineWidth = 1.5; c.beginPath(); const y = Math.random() * h; c.moveTo(0, y); c.bezierCurveTo(w * 0.3, y + 6, w * 0.6, y - 6, w, y + 2); c.stroke(); }
  }, { repeat: rep });
}

// Ribbon along a floor polyline, spanning z0..z1, uv from world x / z.
function ribbon(pts, z0, z1, rs, material, xr) {
  const pos = [], uv = [], idx = [];
  pts.forEach(([x, y], i) => {
    pos.push(x * rs, y * rs, z1 * rs, x * rs, y * rs, z0 * rs);
    const u = (x - xr[0]) / (xr[1] - xr[0]);
    uv.push(u, 0, u, 1);
    if (i) { const a = (i - 1) * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals();
  return new THREE.Mesh(g, material);
}

// Triangular pop-up flap standing on the floor (thin prism)
function flap(x, y, z, w, h, col, rs, rotY = 0) {
  const m = prism([[-w / 2, 0], [w / 2, 0], [w * 0.15, h]], 24, col, rs);
  m.position.set(x * rs, y * rs, z * rs); m.rotation.y = rotY;
  return m;
}

function floorYAt(pts, x) {
  for (let i = 0; i < pts.length - 1; i++) { const a = pts[i], b = pts[i + 1]; const lo = Math.min(a[0], b[0]), hi = Math.max(a[0], b[0]); if (x >= lo && x <= hi) return a[1] + (b[1] - a[1]) * (x - a[0]) / ((b[0] - a[0]) || 1); }
  return pts[0][1];
}

// lavender puff cloud (pass-through platform). Local coords: floor top at y = top.
export function makeCloud(rs, halfW, top) {
  const g = new THREE.Group();
  const matC = new THREE.MeshLambertMaterial({ color: 0xc4c4ff, emissive: 0x6464a8, transparent: true, opacity: 1 });
  const matH = new THREE.MeshLambertMaterial({ color: 0xf0f0ff, emissive: 0xa0a0d0, transparent: true, opacity: 1 });
  const blobs = [[-0.62, -0.05, 0.34], [-0.22, 0.05, 0.42], [0.22, 0.02, 0.4], [0.62, -0.06, 0.33], [0, -0.18, 0.38]];
  for (const [bx, by, br] of blobs) {
    const r = br * halfW;
    const s = new THREE.Mesh(new THREE.IcosahedronGeometry(r * rs, 2), matC);
    s.position.set(bx * halfW * rs, (top - r * 0.62 + by * halfW * 0.3) * rs, 0); s.scale.set(1, 0.62, 0.8);
    g.add(s);
    const hl = new THREE.Mesh(new THREE.IcosahedronGeometry(r * 0.45 * rs, 2), matH); hl.scale.set(1, 0.7, 0.6);
    hl.position.set((bx * halfW - r * 0.25) * rs, (top - r * 0.3 + by * halfW * 0.3) * rs, r * 0.55 * rs);
    g.add(hl);
  }
  g.userData.mats = [matC, matH];
  return g;
}

// build(scene, rs, d, { clouds: bool, big: bool }) -> obj
export function buildYoshiIsland(scene, rs, d, o = {}) {
  const root = new THREE.Group(); scene.add(root);
  const bg = backdrop(scene, rs, paintBackdrop, { tw: 2048, th: 1024, w: 36000, h: 18000, y: 2500 });
  // main book
  const main = d.groups.flatMap(g => g.floors).find(f => !f.pass && f.pts.length > 2);
  const pts = main.pts;
  const sg = d.groups.find(g => g.floors.includes(main));
  const seen = new Set(), under = [];
  for (const q of sg.ceils.flat()) { const k = q.join(','); if (!seen.has(k)) { seen.add(k); under.push(q); } }
  under.sort((a, b) => b[0] - a[0]);
  const poly = [...pts, ...under];
  const XR = [pts[0][0], pts[pts.length - 1][0]];
  const DEPTH = 1500;
  const wood = canvasTex(256, 128, (c, w, h) => {
    c.fillStyle = '#dcae6c'; c.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 3) { c.fillStyle = `rgba(120,76,32,${0.06 + Math.random() * 0.2})`; c.fillRect(0, y, w, 1.5); }
    for (let i = 0; i < 9; i++) { c.strokeStyle = 'rgba(130,80,36,0.55)'; c.lineWidth = 2; c.beginPath(); const y = Math.random() * h; c.moveTo(0, y); c.bezierCurveTo(w * 0.3, y + 10, w * 0.6, y - 10, w, y + 3); c.stroke(); }
    for (let i = 0; i < 3; i++) { const x = Math.random() * w, y = Math.random() * h; c.strokeStyle = 'rgba(110,64,26,0.6)'; c.beginPath(); c.ellipse(x, y, 14, 5, 0, 0, Math.PI * 2); c.stroke(); }
  }, { repeat: [0.06, 0.25] });
  const coverMat = lam(wood, 0xfff0e0, 0.55);
  const coverDark = lam(wood, 0xe0b080, 0.4);
  const cover = prism(poly, DEPTH, [coverMat, coverDark], rs);
  root.add(cover);
  // spine notch: dark crease down the middle of the front face
  root.add(kit.box(40 * rs, 560 * rs, 10 * rs, 0x5a3a18, [0, (pts[1][1] - 300) * rs, (DEPTH / 2 + 4) * rs]));
  // page block: cream layer under the felt
  const pageMat = lam(null, 0xfff4dc, 0);
  pageMat.emissive.set(0x807a6e);
  const pagesPoly = [...pts.map(p => [p[0], p[1] - 10]).reverse(), ...pts.map(p => [p[0] + (p[0] < 0 ? 40 : -40), p[1] - 90])];
  const pg = prism(pagesPoly, DEPTH - 80, pageMat, rs, 25); root.add(pg);
  // felt top with lavender road and stitched border
  const feltTex = canvasTex(1024, 384, (c, w, h) => {
    knit(c, w, h, '#4cb44c', '#2c7c34', '#88dc78', 8);
    c.fillStyle = '#8c8ce4';
    const road = (x0, x1, x2, x3) => { c.beginPath(); c.moveTo(x0 * w, h); c.lineTo(x1 * w, h); c.lineTo(x2 * w, 0); c.lineTo(x3 * w, 0); c.closePath(); c.fill(); };
    road(0.0, 0.16, 0.3, 0.12); road(0.42, 0.62, 0.58, 0.4); road(0.78, 0.92, 1.05, 0.9);
    c.fillStyle = '#7878d0'; c.fillRect(0, h * 0.44, w, h * 0.14);
    for (let i = 0; i < 3000; i++) { c.fillStyle = Math.random() < 0.5 ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,60,0.08)'; c.fillRect(Math.random() * w, Math.random() * h, 3, 3); }
    c.strokeStyle = '#e8f8c0'; c.lineWidth = 6; c.setLineDash([14, 10]); c.strokeRect(6, 6, w - 12, h - 12); c.setLineDash([]);
  });
  const felt = ribbon(pts.map(p => [p[0], p[1] + 2]), -DEPTH / 2 + 30, DEPTH / 2 - 30, rs, lam(feltTex, 0xffffff, 0.5), XR);
  root.add(felt);
  // pop-up flaps (blue mountains, green trees) near the front and back edges
  const flaps = [[-1750, 520, 260, 300, 0x5868c8, 0.3], [-1500, 560, 200, 220, 0x3c9858, -0.2], [-900, -560, 280, 320, 0x5060c0, 0.1], [-450, -600, 220, 250, 0x3ea054, 0],
    [300, 560, 240, 260, 0x3c9858, 0.2], [700, -560, 300, 330, 0x5868c8, -0.2], [1250, -600, 230, 240, 0x3ea054, 0.3], [1650, 530, 280, 310, 0x5060c0, -0.3], [1880, -500, 200, 220, 0x3c9858, 0]];
  for (const [x, z, w, h, col, ry] of flaps) {
    const y = floorYAt(pts, x);
    root.add(flap(x, y, z, w, h, col, rs, ry));
    root.add(flap(x + w * 0.35, y, z + 30, w * 0.6, h * 0.65, col === 0x5060c0 || col === 0x5868c8 ? 0x8890e8 : 0x70c870, rs, ry + 0.2));
  }
  // soft platforms: cardboard planks
  const pf = d.groups.filter(g => !g.moving).flatMap(g => g.floors).filter(f => f.pass);
  pf.forEach((f, i) => {
    const p = f.pts, x0 = p[0][0], x1 = p[p.length - 1][0];
    const isTop = p.length > 2;
    const topTex = canvasTex(256, 64, (c, w, h) => {
      if (isTop) { c.fillStyle = '#8890dc'; c.fillRect(0, 0, w * 0.45, h); c.fillStyle = '#7cc078'; c.fillRect(w * 0.45, 0, w, h); }
      else { c.fillStyle = '#d8c898'; c.fillRect(0, 0, w, h); for (let x = 0; x < w; x += 10) { c.fillStyle = 'rgba(120,90,50,0.35)'; c.fillRect(x, 0, 3, h); } }
      c.strokeStyle = '#6a4a28'; c.lineWidth = 4; c.strokeRect(2, 2, w - 4, h - 4);
    });
    const shape = new THREE.Shape();
    shape.moveTo(p[0][0] * rs, p[0][1] * rs); for (let k = 1; k < p.length; k++) shape.lineTo(p[k][0] * rs, p[k][1] * rs);
    for (let k = p.length - 1; k >= 0; k--) shape.lineTo(p[k][0] * rs, (p[k][1] - 70) * rs);
    const geo = new THREE.ExtrudeGeometry(shape, { depth: 520 * rs, bevelEnabled: false }); geo.translate(0, 0, -260 * rs);
    const side = lam(woodTex([3, 1]), 0xfff0e0, 0.55);
    root.add(new THREE.Mesh(geo, [side, side]));
    root.add(ribbon(p.map(q => [q[0], q[1] + 1.5]), -260, 260, rs, lam(topTex, 0xffffff, 0.5), [x0, x1]));
  });
  // Super Happy Tree cut-out
  const treeTex = canvasTex(1024, 1024, paintTree);
  const tree = new THREE.Mesh(new THREE.PlaneGeometry(3000 * rs, 3000 * rs), new THREE.MeshBasicMaterial({ map: treeTex, transparent: true, opacity: 0.92, color: 0xf4ece4, alphaTest: 0.05, fog: false }));
  tree.position.set(300 * rs, (o.treeY ?? 1250) * rs, -1100 * rs); root.add(tree);
  // clouds
  const clouds = [];
  if (o.clouds) for (const g of d.groups.filter(g => g.moving)) {
    const f = g.floors[0], halfW = (f.pts[1][0] - f.pts[0][0]) / 2;
    const cm = makeCloud(rs, Math.abs(halfW), f.pts[0][1]);
    cm.position.set(g.base[0] * rs, g.base[1] * rs, 0); root.add(cm);
    // vapor puffs used when the cloud evaporates
    const vap = new THREE.Group();
    const vm = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8, depthWrite: false });
    for (let k = 0; k < 8; k++) { const s = new THREE.Mesh(new THREE.IcosahedronGeometry(140 * rs, 1), vm); s.userData.v = [(Math.random() - 0.5) * 2, Math.random() * 1.5 + 0.3]; s.position.set(((k / 7) - 0.5) * 1300 * rs, (f.pts[0][1] - 120) * rs, 100 * rs); s.userData.p0 = s.position.clone(); vap.add(s); }
    vap.visible = false; vap.userData.mat = vm;
    cm.add(vap);
    clouds.push({ id: g.id, mesh: cm, vap });
  }
  return { root, background: bg, clouds, tree };
}

// Cloud hazard logic (VS Yoshi's Island). Runs headless.
export function cloudInit(m, st) {
  st.clouds = m.col.groups.filter(g => g.moving).map(g => ({ g, base: [...g.base], pressure: 0, timer: 120, state: 'on', wait: 0, t: 0 }));
}
export function cloudUpdate(m, st) {
  for (const c of st.clouds) {
    c.t++;
    if (c.state === 'on') {
      const riders = m.fighters.filter(f => !f.dead && f.grounded && f.ground?.group === c.g);
      if (riders.length) {
        c.pressure = Math.min(180, c.pressure + 5);
        if (--c.timer <= 0) {
          c.state = 'gone'; c.wait = 180; c.g.active = false; c.goneAt = m.frame;
          for (const f of riders) f.becomeAirborne();
          m.emit('sfx', { name: 'whiff' });
        }
      } else { c.timer = 120; c.pressure = Math.max(0, c.pressure - 5); }
    } else if (--c.wait <= 0) {
      c.state = 'on'; c.timer = 120; c.pressure = 0; c.g.active = true; c.backAt = m.frame;
    }
    c.g.target = [c.base[0], c.base[1] - c.pressure];
  }
}
export function cloudSync(obj, m, rs, st) {
  if (!obj || !st.clouds) return;
  for (const v of obj.clouds) {
    const c = st.clouds.find(c => c.g.id === v.id); if (!c) continue;
    v.mesh.position.set(c.g.ox * rs, c.g.oy * rs, 0);
    const gone = c.state === 'gone';
    const kGone = gone ? (m.frame - c.goneAt) : 999;
    const kBack = c.backAt != null ? m.frame - c.backAt : 999;
    // fade out over 20 f, fade back in over 30 f
    const op = gone ? Math.max(0, 1 - kGone / 20) : Math.min(1, kBack / 30);
    const bob = Math.sin(m.frame * 0.05 + v.id) * 0.04;
    v.mesh.children.forEach(ch => { if (ch !== v.vap) ch.visible = op > 0.01; });
    for (const mm of v.mesh.userData?.mats ?? []) mm.opacity = op;
    v.mesh.position.y += bob;
    v.vap.visible = gone && kGone < 45;
    if (v.vap.visible) {
      const k = kGone / 45; v.vap.userData.mat.opacity = 0.8 * (1 - k);
      for (const s of v.vap.children) { s.position.set(s.userData.p0.x + s.userData.v[0] * k * 2.5, s.userData.p0.y + s.userData.v[1] * k * 2.5, s.userData.p0.z); s.scale.setScalar(0.6 + k); }
    }
  }
}
