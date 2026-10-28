// Shared menu toolkit: input with auto-repeat, base screen class (confirm flash, fades), SSB64-style
// backgrounds (collage, stone, submenu frame), pills, mode icons, the Smash emblem, hand cursors.
// Everything is drawn procedurally on the 640x480 UI canvas (2x the N64 320x240 layout).
import { text, roundRect } from './draw.js';

export const RFONT = '"Arial Rounded MT Bold", "Trebuchet MS", "Verdana", "DejaVu Sans", sans-serif';
export const BFONT = '"Arial Black", "Liberation Sans", "DejaVu Sans", sans-serif';
export const PORT_TOKEN = ['#e02828', '#2a4fe0', '#d8b818', '#20a040'];
export const CPU_TOKEN = '#8a8a96';

// ---------------------------------------------------------------- input
const DIRS = ['up', 'down', 'left', 'right'];
// Menu input with N64-like auto-repeat. read(port) for one controller, read() merges every port.
export class MenuInput {
  constructor(app) { this.app = app; this.st = [0, 1, 2, 3].map(() => ({ dir: null, t: 0 })); }
  readPort(p) {
    const c = this.app.input.controllers[p], s = this.st[p];
    const o = { up: false, down: false, left: false, right: false };
    if (!c || c.source === 'cpu') return { ...o, a: false, b: false, start: false };
    let dir = null;
    if (Math.abs(c.y) >= 0.5 && Math.abs(c.y) >= Math.abs(c.x)) dir = c.y > 0 ? 'up' : 'down';
    else if (Math.abs(c.x) >= 0.5) dir = c.x > 0 ? 'right' : 'left';
    if (dir !== s.dir) { s.dir = dir; s.t = 0; if (dir) o[dir] = true; }
    else if (dir) { s.t++; if (s.t >= 20 && (s.t - 20) % 5 === 0) o[dir] = true; }
    const P = b => c.pressed(b);
    return { ...o, a: P('A'), b: P('B'), start: P('START'), z: P('Z'), r: P('R'), l: P('L'),
      cu: P('CU'), cd: P('CD'), cl: P('CL'), cr: P('CR'), x: c.x, y: c.y, heldDir: dir };
  }
  read(port = null) {
    if (port !== null) return this.readPort(port);
    const all = [0, 1, 2, 3].map(p => this.readPort(p));
    const o = {};
    for (const k of [...DIRS, 'a', 'b', 'start', 'z', 'r', 'l', 'cu', 'cd', 'cl', 'cr']) o[k] = all.some(r => r[k]);
    o.port = all.findIndex(r => r.a || r.start || r.b);
    return o;
  }
}

// ---------------------------------------------------------------- base screen
// Subclasses implement tick(i) and draw(ctx). Handles fade-in, confirm flash and fade-out transitions.
export class MenuScreen {
  constructor(app, params = {}) {
    this.app = app; this.p = params; this.t = 0; this.inp = new MenuInput(app);
    this.flash = 0; this.flashCb = null; this.fade = null; this.fadeIn = params.fadeIn ?? 0; this.fadeInMax = this.fadeIn;
  }
  get audio() { return this.app.audio; }
  get save() { return this.app.save; }
  update() {
    this.t++;
    if (this.fadeIn > 0) this.fadeIn--;
    if (this.fade) { this.fade.t++; if (this.fade.t >= this.fade.dur) { const cb = this.fade.cb; this.fade = null; cb(); } return; }
    if (this.flash > 0) { this.flash--; if (this.flash === 0 && this.flashCb) { const cb = this.flashCb; this.flashCb = null; cb(); } return; }
    this.tick(this.inp.read());
  }
  tick() {}
  // confirm: sfx + 4-frame white flash on the chosen item, then run cb
  confirm(cb, sfx = 'menuOk', frames = 5) { this.audio.sfx(sfx); this.flash = frames; this.flashCb = cb; }
  fadeOut(cb, dur = 30) { this.fade = { t: 0, dur, cb }; }
  go(name, params = {}) { this.app.go(name, params); }
  render(renderer, ctx) {
    this.draw(ctx, renderer);
    if (this.fadeIn > 0) { ctx.fillStyle = `rgba(0,0,0,${this.fadeIn / this.fadeInMax})`; ctx.fillRect(0, 0, 640, 480); }
    if (this.fade) { ctx.fillStyle = `rgba(0,0,0,${Math.min(1, this.fade.t / this.fade.dur)})`; ctx.fillRect(0, 0, 640, 480); }
  }
  draw() {}
}

// ---------------------------------------------------------------- small helpers
export function hex(c) { return typeof c === 'number' ? '#' + c.toString(16).padStart(6, '0') : c; }
export function shade(col, k) {
  const c = hex(col).slice(1); const n = parseInt(c.length === 3 ? c.replace(/./g, x => x + x) : c, 16);
  const f = v => Math.max(0, Math.min(255, Math.round(k >= 0 ? v + (255 - v) * k : v * (1 + k))));
  return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
}
function offscreen(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); return c; }
let seed = 1; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

// Pill (rounded bar) with a darker under-edge, like the SSB64 submenu buttons
export function pill(ctx, x, y, w, h, fill, o = {}) {
  ctx.save();
  const r = o.r ?? h / 2.6;
  roundRect(ctx, x + 2, y + 3, w, h, r); ctx.fillStyle = o.shadow ?? 'rgba(0,0,0,0.6)'; ctx.fill();
  roundRect(ctx, x, y, w, h, r);
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, shade(fill, 0.18)); g.addColorStop(0.45, hex(fill)); g.addColorStop(1, shade(fill, -0.3));
  ctx.fillStyle = g; ctx.fill();
  if (o.stroke) { ctx.lineWidth = o.lw ?? 2; ctx.strokeStyle = o.stroke; ctx.stroke(); }
  ctx.restore();
}

// ---------------------------------------------------------------- Smash emblem
// Circle split by a vertical bar (left of centre) and a horizontal bar (below centre).
export function drawSmashEmblem(ctx, cx, cy, r, color, gap = null) {
  ctx.save(); ctx.translate(cx, cy);
  ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.clip();
  ctx.fillStyle = color;
  const vx = -0.3 * r, vw = 0.16 * r, hy = 0.16 * r, hh = 0.16 * r;
  if (gap) { ctx.fillRect(-r, -r, 2 * r, 2 * r); ctx.fillStyle = gap; ctx.fillRect(vx, -r, vw, 2 * r); ctx.fillRect(vx, hy, 2 * r, hh); }
  else { // draw the four quadrants only (transparent gaps)
    ctx.fillRect(-r, -r, vx + r, 2 * r);
    ctx.fillRect(vx + vw, -r, 2 * r, hy + r);
    ctx.fillRect(vx + vw, hy + hh, 2 * r, 2 * r);
  }
  ctx.restore();
}

// ---------------------------------------------------------------- backgrounds
let collageCache = null;
// Dim "SMASH" lettering on the left and a grid of printed tiles on the right (Mode Select & submenus)
export function drawCollage(ctx, alpha = 1) {
  if (!collageCache) collageCache = offscreen(640, 480, (g) => {
    seed = 7;
    g.fillStyle = '#000'; g.fillRect(0, 0, 640, 480);
    // right: tile grid
    const cols = [330, 400, 455, 520, 580, 640], rows = [0, 40, 95, 150, 200, 255, 300, 360, 420, 480];
    for (let i = 0; i < cols.length - 1; i++) for (let j = 0; j < rows.length - 1; j++) {
      const x = cols[i], y = rows[j], w = cols[i + 1] - x, h = rows[j + 1] - y;
      const k = rnd();
      g.fillStyle = k < 0.35 ? '#383f43' : k < 0.6 ? '#1a2106' : k < 0.8 ? '#262626' : '#0c0c0c';
      g.fillRect(x + 1, y + 1, w - 2, h - 2);
      g.fillStyle = k < 0.35 ? '#545b5f' : '#3a4a1a';
      g.font = `900 ${Math.min(h * 0.8, w * 0.9)}px ${BFONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
      const L = ['S', 'M', 'A', 'S', 'H', '64', 'N.', 'B', '!'][Math.floor(rnd() * 9)];
      if (rnd() < 0.7) g.fillText(L, x + w / 2, y + h / 2 + 2);
    }
    g.fillStyle = '#4a5050'; g.font = `700 13px ${BFONT}`; g.textAlign = 'left';
    for (const [x, y, s] of [[336, 16, 'SUPER SMASH BROS.!!'], [470, 230, 'SUPER SMASH BROS.'], [420, 330, 'Fan Recreation'], [340, 130, 'SMASH'], [480, 410, 'SUPER']]) g.fillText(s, x, y);
    // left: giant dark SMASH lettering
    g.save(); g.font = `900 132px ${BFONT}`; g.textBaseline = 'alphabetic';
    g.lineWidth = 3; g.strokeStyle = '#4e4e4e'; g.fillStyle = '#1e1e1e';
    g.translate(10, 380); g.scale(0.82, 1.15);
    g.fillText('SMASH', 0, 0); g.strokeText('SMASH', 0, 0);
    g.font = `900 70px ${BFONT}`; g.fillText('SUPER', 10, -150); g.strokeText('SUPER', 10, -150);
    g.fillText('BROS.', 30, 80); g.strokeText('BROS.', 30, 80);
    g.restore();
    g.fillStyle = 'rgba(0,0,0,0.5)'; g.fillRect(0, 0, 640, 480);
  });
  ctx.save(); ctx.globalAlpha = alpha; ctx.drawImage(collageCache, 0, 0); ctx.restore();
}

let stoneCache = null;
// Dark charcoal cobblestone texture (CSS and stage select)
export function drawStone(ctx) {
  if (!stoneCache) stoneCache = offscreen(640, 480, (g, w, h) => {
    seed = 3;
    g.fillStyle = '#121212'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 520; i++) {
      const x = rnd() * w, y = rnd() * h, r = 8 + rnd() * 22;
      const v = 18 + Math.floor(rnd() * 22);
      g.beginPath();
      for (let k = 0; k < 7; k++) { const a = k / 7 * Math.PI * 2, rr = r * (0.7 + rnd() * 0.4); g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr * 0.75); }
      g.closePath();
      const gr = g.createRadialGradient(x - r * 0.3, y - r * 0.3, 1, x, y, r);
      gr.addColorStop(0, `rgb(${v + 14},${v + 14},${v + 14})`); gr.addColorStop(1, `rgb(${v - 8},${v - 8},${v - 8})`);
      g.fillStyle = gr; g.fill();
      g.strokeStyle = 'rgba(0,0,0,0.8)'; g.lineWidth = 2; g.stroke();
    }
  });
  ctx.drawImage(stoneCache, 0, 0);
}

// ---------------------------------------------------------------- mode icons (line art)
// kind: '1p' (N64 controller) | 'vs' (multitap robot head) | 'option' (mixer) | 'data' (notebook + pencil)
export function drawModeIcon(ctx, kind, cx, cy, r, o = {}) {
  const line = o.line ?? '#9c9c9c', fill = o.fill ?? '#141414', lw = o.lw ?? Math.max(1.5, r * 0.06);
  ctx.save(); ctx.translate(cx, cy);
  if (o.disc !== false) {
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fillStyle = fill; ctx.fill();
    ctx.lineWidth = lw * 1.2; ctx.strokeStyle = line; ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 0, r * 0.9, 0, Math.PI * 2); ctx.lineWidth = lw * 0.6; ctx.stroke();
  }
  ctx.strokeStyle = line; ctx.fillStyle = line; ctx.lineWidth = lw; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  const s = r / 50; ctx.scale(s, s); ctx.lineWidth = lw / s;
  const C = (x, y, rr, f) => { ctx.beginPath(); ctx.arc(x, y, rr, 0, Math.PI * 2); f ? ctx.fill() : ctx.stroke(); };
  if (kind === '1p') {
    ctx.beginPath(); // controller body with three prongs
    ctx.moveTo(-38, -14); ctx.quadraticCurveTo(-40, -26, -24, -26); ctx.lineTo(24, -26); ctx.quadraticCurveTo(40, -26, 38, -14);
    ctx.quadraticCurveTo(40, 6, 32, 26); ctx.quadraticCurveTo(26, 34, 20, 24); ctx.lineTo(14, 4);
    ctx.lineTo(8, 4); ctx.quadraticCurveTo(6, 32, 0, 34); ctx.quadraticCurveTo(-6, 32, -8, 4); ctx.lineTo(-14, 4);
    ctx.lineTo(-20, 24); ctx.quadraticCurveTo(-26, 34, -32, 26); ctx.quadraticCurveTo(-40, 6, -38, -14); ctx.closePath(); ctx.stroke();
    ctx.lineWidth *= 1.6; ctx.beginPath(); ctx.moveTo(-28, -12); ctx.lineTo(-18, -12); ctx.moveTo(-23, -17); ctx.lineTo(-23, -7); ctx.stroke(); ctx.lineWidth /= 1.6;
    for (const [x, y] of [[20, -18], [27, -12], [20, -6], [13, -12]]) C(x, y, 3, true);
    C(0, 8, 5); C(0, 8, 2, true); C(-6, -14, 2, true); C(4, -14, 2, true);
  } else if (kind === 'vs') {
    ctx.beginPath(); ctx.rect(-14, -36, 28, 24); ctx.stroke(); ctx.beginPath(); ctx.rect(-8, -32, 16, 12); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-36, 8); ctx.quadraticCurveTo(-36, -14, -14, -12); ctx.lineTo(14, -12); ctx.quadraticCurveTo(36, -14, 36, 8);
    ctx.lineTo(30, 18); ctx.lineTo(-30, 18); ctx.closePath(); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(0, 4, 26, 8, 0, 0, Math.PI * 2); ctx.stroke();
    for (const x of [-18, -6, 6, 18]) { C(x, 2, 3, true); ctx.beginPath(); ctx.moveTo(x, 18); ctx.quadraticCurveTo(x + (x > 0 ? 6 : -6), 30, x * 0.6, 40); ctx.stroke(); }
  } else if (kind === 'option') {
    ctx.save(); ctx.rotate(-0.6);
    for (const [x, k] of [[-14, -10], [0, 8], [14, -4]]) { ctx.beginPath(); ctx.moveTo(x, -30); ctx.lineTo(x, 30); ctx.stroke(); ctx.beginPath(); ctx.rect(x - 6, k - 5, 12, 10); ctx.fill(); }
    ctx.restore();
    C(-22, 24, 9); C(-22, 24, 3, true); C(4, 34, 7); C(4, 34, 2.5, true);
  } else if (kind === 'data') {
    ctx.save(); ctx.rotate(-0.25);
    ctx.beginPath(); ctx.rect(-26, -30, 46, 60); ctx.stroke();
    for (let i = 0; i < 6; i++) C(-26, -24 + i * 9.5, 3.5);
    ctx.restore();
    ctx.save(); ctx.rotate(0.75); ctx.beginPath(); ctx.rect(-5, -40, 10, 54); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-5, 14); ctx.lineTo(0, 24); ctx.lineTo(5, 14); ctx.stroke(); ctx.restore();
  }
  ctx.restore();
}

// Submenu frame: black, collage, the parent icon huge at top left, the gold corner with its caption.
export function drawSubmenuBG(ctx, kind, caption, t = 99) {
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, 640, 480);
  drawCollage(ctx, 0.85);
  // big line-art icon cut by the screen edge
  drawModeIcon(ctx, kind, 120, 100, 175, { line: '#bdbdbd', fill: 'rgba(0,0,0,0.2)', lw: 9 });
  // gold corner triangle with a ragged diagonal edge
  ctx.save();
  seed = 11;
  ctx.beginPath(); ctx.moveTo(640, 180);
  const n = 26;
  for (let i = 1; i <= n; i++) { const k = i / n; ctx.lineTo(640 - 350 * k + (rnd() - 0.5) * 8, 180 + 300 * k + (rnd() - 0.5) * 8); }
  ctx.lineTo(640, 480); ctx.closePath();
  ctx.fillStyle = '#946a0d'; ctx.fill();
  ctx.clip();
  drawSmashEmblem(ctx, 548, 392, 62, '#000');
  ctx.translate(470, 345); ctx.rotate(Math.atan2(-300, 350));
  text(ctx, caption, 0, 0, { size: 34, align: 'center', color: '#000', font: RFONT, weight: 900, italic: false });
  ctx.restore();
}

// List of submenu pills. items: [{label, value?, x, y, w, h, size}]; sel index; flash (frames left) for confirm
export function drawPills(ctx, items, sel, flash = 0) {
  items.forEach((it, i) => {
    const on = i === sel, white = on && flash > 0;
    pill(ctx, it.x, it.y, it.w, it.h, white ? '#ffffff' : on ? '#fe1925' : '#8184ad');
    const size = it.size ?? it.h * 0.62;
    const cy = it.y + it.h * 0.5 + size * 0.36;
    if (it.draw) { it.draw(ctx, it, on); return; }
    text(ctx, it.label, it.x + it.w / 2, cy, { size, align: 'center', color: '#050200', font: RFONT, italic: false, weight: 700 });
  });
}

// ---------------------------------------------------------------- tokens and hand cursors
export function drawToken(ctx, x, y, label, color, r = 15) {
  ctx.save();
  ctx.beginPath(); ctx.arc(x + 2, y + 3, r, 0, Math.PI * 2); ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fill();
  const g = ctx.createRadialGradient(x - r * 0.4, y - r * 0.4, 1, x, y, r);
  g.addColorStop(0, '#f4f4f4'); g.addColorStop(1, '#9c9c9c');
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fillStyle = g; ctx.fill();
  ctx.lineWidth = 1.5; ctx.strokeStyle = '#444'; ctx.stroke();
  ctx.restore();
  text(ctx, label, x, y + r * 0.42, { size: r * 1.05, align: 'center', color, stroke: '#fff', strokeW: 2, font: BFONT });
}

// White glove pointing up-left; the fingertip is at (x, y). If token is set, the hand holds it.
export function drawHand(ctx, x, y, token = null, pointing = true) {
  if (token) drawToken(ctx, x + 18, y + 30, token.label, token.color, 14);
  ctx.save(); ctx.translate(x, y); ctx.rotate(-0.55);
  ctx.lineJoin = 'round'; ctx.lineWidth = 2; ctx.strokeStyle = '#333';
  const g = ctx.createLinearGradient(-10, 0, 14, 0); g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#bfbfc8');
  ctx.fillStyle = g;
  // index finger
  ctx.beginPath(); roundRect(ctx, -4, 0, 9, pointing ? 22 : 12, 4.5); ctx.fill(); ctx.stroke();
  // palm/fist
  ctx.beginPath(); roundRect(ctx, -9, 16, 24, 22, 8); ctx.fill(); ctx.stroke();
  // knuckles
  ctx.beginPath(); ctx.moveTo(5, 22); ctx.lineTo(13, 22); ctx.moveTo(5, 28); ctx.lineTo(13, 28); ctx.stroke();
  // thumb
  ctx.beginPath(); roundRect(ctx, -13, 22, 9, 13, 4); ctx.fill(); ctx.stroke();
  // cuff
  ctx.beginPath(); roundRect(ctx, -10, 37, 26, 9, 3); ctx.fill(); ctx.stroke();
  ctx.restore();
}

// "◄" / "►" triangles
export function arrow(ctx, x, y, dir, s, color) {
  ctx.save(); ctx.fillStyle = color; ctx.beginPath();
  ctx.moveTo(x + dir * s, y); ctx.lineTo(x - dir * s * 0.6, y - s); ctx.lineTo(x - dir * s * 0.6, y + s); ctx.closePath(); ctx.fill();
  ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.stroke(); ctx.restore();
}

// Header strip used by Data / Option sub pages: "DATA  ▬▬  Characters" in gold with a slanted tab.
export function drawHeaderTab(ctx, small, big, o = {}) {
  ctx.save();
  ctx.fillStyle = '#3e3a34';
  ctx.beginPath(); ctx.moveTo(380, 20); ctx.lineTo(620, 20); ctx.quadraticCurveTo(632, 20, 632, 34); ctx.lineTo(632, 74); ctx.lineTo(380, 74); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#595550'; ctx.fillRect(40, 54, 340, 10);
  ctx.restore();
  text(ctx, small, 120, 64, { size: 15, color: '#6b6560', font: BFONT, italic: false, align: 'center', stroke: '#000', strokeW: 3 });
  text(ctx, big, o.x ?? 610, 66, { size: 36, align: 'right', color: '#f0c010', gradient: ['#fff27a', '#f0c010', '#b07800'], stroke: '#3a2400', strokeW: 5, font: RFONT, italic: false });
}

export const SERIES_OF_STAGE = { peach: 'mario', mushroom: 'mario', congo: 'dk', hyrule: 'zelda', zebes: 'metroid', yoshi: 'yoshi', dreamland: 'kirby', sectorz: 'starfox', saffron: 'pokemon' };
