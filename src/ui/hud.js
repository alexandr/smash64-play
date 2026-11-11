// In-match HUD, laid out like SSB64: one slot per port along the bottom with the series emblem
// (in the port color) behind the damage percent and stock icons above; port pointers over fighters;
// timer in the top right for timed matches.
import { text, FONT } from './draw.js';
import { PORT_COLORS, CPU_COLOR } from '../game/constants.js';
import { headIcon } from './render3d.js';

const SLOT_X = [104, 248, 392, 536];   // centers of the four HUD slots (640 wide)
const HUD_Y = 438;

// Series emblem silhouette (flat color) centred at (x, y) with radius r. Holes (mushroom spots, Poké Ball
// band, Metroid nuclei...) are cut with even-odd fills so whatever is underneath shows through.
export function drawEmblem(ctx, series, x, y, r, color) {
  ctx.save(); ctx.translate(x, y); ctx.scale(r, r); ctx.fillStyle = color; ctx.strokeStyle = color; ctx.globalAlpha *= 0.95;
  let P = new Path2D(); const parts = [];
  const next = () => { parts.push(P); P = new Path2D(); };   // start a separately filled sub-shape
  const circle = (cx, cy, rr, ccw = false) => { P.moveTo(cx + rr, cy); P.arc(cx, cy, rr, 0, Math.PI * 2, ccw); P.closePath(); };
  const ell = (cx, cy, rx, ry, rot = 0) => { P.moveTo(cx + rx * Math.cos(rot), cy + rx * Math.sin(rot)); P.ellipse(cx, cy, rx, ry, rot, 0, Math.PI * 2); P.closePath(); };
  const poly = (pts) => { P.moveTo(pts[0][0], pts[0][1]); for (const q of pts.slice(1)) P.lineTo(q[0], q[1]); P.closePath(); };
  switch (series) {
    case 'mario': { // Super Mushroom: spotted cap, stem with two eyes
      P.moveTo(-0.98, 0.12); P.bezierCurveTo(-1.02, -0.62, -0.55, -0.98, 0, -0.98); P.bezierCurveTo(0.55, -0.98, 1.02, -0.62, 0.98, 0.12);
      P.bezierCurveTo(0.7, 0.3, -0.7, 0.3, -0.98, 0.12); P.closePath();
      circle(0, -0.55, 0.26); ell(-0.72, -0.12, 0.16, 0.22, 0.3); ell(0.72, -0.12, 0.16, 0.22, -0.3);
      P.moveTo(-0.5, 0.26); P.bezierCurveTo(-0.62, 0.6, -0.55, 0.92, -0.3, 0.95); P.lineTo(0.3, 0.95); P.bezierCurveTo(0.55, 0.92, 0.62, 0.6, 0.5, 0.26);
      P.bezierCurveTo(0.2, 0.36, -0.2, 0.36, -0.5, 0.26); P.closePath();
      ell(-0.17, 0.56, 0.07, 0.15); ell(0.17, 0.56, 0.07, 0.15);
      break;
    }
    case 'dk': { // chunky "DK" monogram
      // D
      P.moveTo(-0.95, -0.7); P.lineTo(-0.3, -0.7); P.bezierCurveTo(0.12, -0.7, 0.18, -0.35, 0.18, 0); P.bezierCurveTo(0.18, 0.35, 0.12, 0.7, -0.3, 0.7); P.lineTo(-0.95, 0.7); P.closePath();
      P.moveTo(-0.6, -0.36); P.lineTo(-0.36, -0.36); P.bezierCurveTo(-0.2, -0.36, -0.17, -0.2, -0.17, 0); P.bezierCurveTo(-0.17, 0.2, -0.2, 0.36, -0.36, 0.36); P.lineTo(-0.6, 0.36); P.closePath();
      // K
      poly([[0.22, -0.7], [0.55, -0.7], [0.55, -0.18], [0.82, -0.7], [1.0, -0.7], [0.72, -0.02], [1.02, 0.7], [0.8, 0.7], [0.55, 0.16], [0.55, 0.7], [0.22, 0.7]]);
      break;
    }
    case 'zelda': { // Triforce
      const s2 = 0.98, h = s2 * 0.866, g = 0.04;
      poly([[0, -h], [s2 / 2 - g, -g], [-s2 / 2 + g, -g]]);
      poly([[-s2 / 2, g], [-g, h], [-s2 + g, h]]);
      poly([[s2 / 2, g], [s2 - g, h], [g, h]]);
      ctx.translate(0, -0.02);
      break;
    }
    case 'metroid': { // Metroid: membrane dome with three nuclei, fangs underneath
      P.moveTo(-0.98, 0.15); P.bezierCurveTo(-1.0, -0.6, -0.55, -0.95, 0, -0.95); P.bezierCurveTo(0.55, -0.95, 1.0, -0.6, 0.98, 0.15);
      P.bezierCurveTo(0.6, 0.32, -0.6, 0.32, -0.98, 0.15); P.closePath();
      circle(-0.42, -0.2, 0.2); circle(0.42, -0.2, 0.2); circle(0, -0.5, 0.2);
      for (const [fx, d] of [[-0.62, -1], [-0.22, -1], [0.22, 1], [0.62, 1]]) {
        P.moveTo(fx - 0.13, 0.22); P.quadraticCurveTo(fx - 0.1 + d * 0.02, 0.62, fx + d * 0.1, 0.92); P.quadraticCurveTo(fx + 0.12, 0.6, fx + 0.13, 0.24); P.closePath();
      }
      break;
    }
    case 'yoshi': { // spotted egg
      P.moveTo(0, -0.98); P.bezierCurveTo(0.5, -0.98, 0.8, -0.2, 0.8, 0.25); P.bezierCurveTo(0.8, 0.72, 0.42, 0.98, 0, 0.98); P.bezierCurveTo(-0.42, 0.98, -0.8, 0.72, -0.8, 0.25); P.bezierCurveTo(-0.8, -0.2, -0.5, -0.98, 0, -0.98); P.closePath();
      ell(-0.2, -0.45, 0.18, 0.22, 0.2); ell(0.36, 0.0, 0.2, 0.24, -0.2); ell(-0.38, 0.36, 0.17, 0.2, 0.3); ell(0.1, 0.6, 0.14, 0.16);
      break;
    }
    case 'kirby': { // Warp Star with a ring
      const pts = [];
      for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? 0.42 : 0.86; pts.push([Math.cos(a) * rr + 0.05, Math.sin(a) * rr - 0.05]); }
      poly(pts); next();
      P.moveTo(-0.98, 0.42); P.ellipse(0, 0.1, 1.0, 0.36, -0.28, Math.PI * 0.92, Math.PI * 2.08); P.ellipse(0, 0.1, 0.86, 0.24, -0.28, Math.PI * 2.08, Math.PI * 0.92, true); P.closePath();
      break;
    }
    case 'starfox': { // Star Fox wing emblem: centre fin with two swept wings
      poly([[0, -0.98], [0.2, -0.1], [0.12, 0.62], [0, 0.82], [-0.12, 0.62], [-0.2, -0.1]]);
      poly([[0.28, -0.05], [1.0, 0.55], [0.95, 0.72], [0.22, 0.42]]);
      poly([[-0.28, -0.05], [-1.0, 0.55], [-0.95, 0.72], [-0.22, 0.42]]);
      break;
    }
    case 'pokemon': { // Poké Ball: band and button cut out
      circle(0, 0, 0.98);
      P.rect(-1, -0.09, 2, 0.18);
      circle(0, 0, 0.34); circle(0, 0, 0.2);
      break;
    }
    case 'earthbound': { // EarthBound: the planet with an orbit
      circle(0, 0, 0.72); ell(-0.22, -0.3, 0.22, 0.12, -0.6); next();
      ell(0, 0.05, 1.0, 0.3, -0.35); ell(0, 0.05, 0.86, 0.18, -0.35);
      break;
    }
    case 'fzero': { // F-Zero: winged falcon badge
      poly([[0, -0.95], [0.18, -0.55], [0.95, -0.5], [0.42, -0.15], [0.62, 0.55], [0, 0.18], [-0.62, 0.55], [-0.42, -0.15], [-0.95, -0.5], [-0.18, -0.55]]);
      poly([[-0.3, 0.45], [0, 0.3], [0.3, 0.45], [0, 0.98]]);
      break;
    }
    case 'smash': default: { // Smash Bros. emblem: circle split by a cross (four clipped quadrants)
      const c = new Path2D(); c.arc(0, 0, 0.98, 0, Math.PI * 2);
      ctx.save(); ctx.clip(c);
      for (const [x0, y0, x1, y1] of [[-1, -1, -0.08, 0.08], [0.08, -1, 1, 0.08], [-1, 0.24, -0.08, 1], [0.08, 0.24, 1, 1]]) ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
      ctx.restore();
      break;
    }
  }
  next();
  for (const q of parts) ctx.fill(q, 'evenodd');
  ctx.restore();
}

export function percentColor(p) {
  // white at 0% -> yellow/orange -> red -> dark red at 300%
  const t = Math.min(1, p / 300);
  const stops = [[255, 255, 255], [255, 220, 120], [255, 90, 60], [200, 20, 20], [130, 0, 0]];
  const s = t * (stops.length - 1), i = Math.min(stops.length - 2, Math.floor(s)), k = s - i;
  const c = stops[i].map((v, j) => Math.round(v + (stops[i + 1][j] - v) * k));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

export class Hud {
  constructor(match, view) {
    this.m = match; this.view = view;
    this.shake = new Map(); this.lastPct = new Map();
  }
  draw(ctx) {
    const m = this.m;
    for (const f of m.fighters) {
      if (m.hideHud?.includes(f.port)) continue;
      const x = SLOT_X[f.port] ?? 320;
      const prev = this.lastPct.get(f) ?? 0;
      if (Math.floor(f.percent) > prev) this.shake.set(f, 12);
      this.lastPct.set(f, Math.floor(f.percent));
      const sh = this.shake.get(f) ?? 0; if (sh > 0) this.shake.set(f, sh - 1);
      const jx = sh > 0 ? (Math.random() - 0.5) * sh * 0.6 : 0, jy = sh > 0 ? (Math.random() - 0.5) * sh * 0.6 : 0;
      const col = f.cpu ? CPU_COLOR : PORT_COLORS[f.port];
      drawEmblem(ctx, f.def.series, x + 4, HUD_Y + 2, 30, col);
      // stock icons
      if (m.rules.mode === 'stock' && f.stocks !== Infinity) {
        const n = Math.max(0, f.stocks);
        if (n <= 6) for (let i = 0; i < n; i++) this.stockIcon(ctx, f, x - 40 + i * 17, HUD_Y - 50);
        else { this.stockIcon(ctx, f, x - 34, HUD_Y - 46); text(ctx, '×' + n, x - 22, HUD_Y - 40, { size: 12, stroke: '#000', strokeW: 3 }); }
      }
      if (f.eliminated) continue;
      const pct = f.dead ? '' : Math.floor(f.percent) + '';
      if (!f.dead) {
        text(ctx, pct, x + 20 + jx, HUD_Y + 18 + jy, { size: 46, align: 'right', color: percentColor(f.percent), stroke: '#1a1a1a', strokeW: 7, scaleX: 0.92 });
        text(ctx, '%', x + 22 + jx, HUD_Y + 18 + jy, { size: 28, align: 'left', color: percentColor(f.percent), stroke: '#1a1a1a', strokeW: 6 });
      }
    }
    // port pointers above fighters
    for (const f of m.fighters) {
      if (f.dead || m.hideHud?.includes(f.port)) continue;
      const [sx, sy] = this.view.toScreen(f.x, f.y + (f.HV ?? f.H) * 1.05);
      const col = f.cpu ? CPU_COLOR : PORT_COLORS[f.port];
      const lbl = f.cpu ? 'CP' : (f.port + 1) + 'P';
      const cx = Math.max(16, Math.min(624, sx)), cy = Math.max(30, Math.min(470, sy));
      text(ctx, lbl, cx, cy - 16, { size: 20, align: 'center', color: col, stroke: '#000', strokeW: 4 });
      ctx.save(); ctx.fillStyle = col; ctx.strokeStyle = '#000'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(cx - 9, cy - 13); ctx.lineTo(cx + 9, cy - 13); ctx.lineTo(cx, cy - 2); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
      // off-screen magnifier bubble
      if (sx < 0 || sx > 640 || sy < 0 || sy > 480) this.offscreen(ctx, f, sx, sy, col);
    }
    if (m.timeLeft !== Infinity && m.rules.mode === 'time') {
      const s = Math.max(0, Math.ceil(m.timeLeft / 60));
      const mm = Math.floor(s / 60), ss = s % 60;
      text(ctx, `${mm}:${String(ss).padStart(2, '0')}`, 600, 52, { size: 30, align: 'right', color: s <= 10 ? '#ff5050' : '#fff', stroke: '#000', strokeW: 5 });
    }
  }
  stockIcon(ctx, f, x, y) {
    let img = null;
    try { img = headIcon(f.def.id, f.color, 16); } catch {}
    if (img) { ctx.drawImage(img, x - 2, y - 2, 18, 18); return; }
    const pal = f.def.palettes[f.color % f.def.palettes.length];
    const c = pal.icon ?? pal.cap ?? pal.body ?? 0xcccccc;
    ctx.save(); ctx.fillStyle = typeof c === 'number' ? '#' + c.toString(16).padStart(6, '0') : c;
    ctx.beginPath(); ctx.arc(x + 6, y + 6, 6, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  }
  offscreen(ctx, f, sx, sy, col) {
    const cx = Math.max(36, Math.min(604, sx)), cy = Math.max(36, Math.min(400, sy));
    ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, 24, 0, Math.PI * 2); ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = col; ctx.stroke(); ctx.restore();
    let img = null; try { img = headIcon(f.def.id, f.color, 20); } catch {}
    if (img) ctx.drawImage(img, cx - 20, cy - 20, 40, 40);
    else text(ctx, f.def.short ?? f.def.name[0], cx, cy + 6, { size: 16, align: 'center', color: '#fff', stroke: '#000', strokeW: 3 });
  }
}
