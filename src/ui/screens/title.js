// Title screen: warm haze background with the cropped red emblem, the SUPER SMASH BROS. logo assembling
// (SUPER/BROS. fly in with the black burst, SMASH slams in with a bounce), blinking PRESS START and a
// dark bottom band. Idle for ~20 s starts an attract-mode CPU demo match; any button returns here.
import { MenuScreen, BFONT, drawSmashEmblem } from '../menu.js';
import { text } from '../draw.js';
import { STARTERS } from '../../chars/index.js';

const T_FLY = 14, T_SLAM = 40, T_DONE = 58, T_PROMPT = 110, T_ATTRACT = 60 * 20;

let hazeCache = null;
function haze() {
  if (hazeCache) return hazeCache;
  const c = document.createElement('canvas'); c.width = 640; c.height = 480;
  const g = c.getContext('2d');
  const bg = g.createLinearGradient(0, 0, 400, 400); bg.addColorStop(0, '#c99c84'); bg.addColorStop(0.55, '#f2e2a8'); bg.addColorStop(1, '#f7efc0');
  g.fillStyle = bg; g.fillRect(0, 0, 640, 480);
  let s = 5; const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  g.filter = 'blur(18px)';
  for (let i = 0; i < 40; i++) {
    const x = rnd() * 640, y = rnd() * 380, r = 30 + rnd() * 90;
    const cols = ['rgba(214,176,151,0.55)', 'rgba(248,244,182,0.6)', 'rgba(245,228,165,0.6)', 'rgba(230,170,120,0.35)', 'rgba(255,255,230,0.5)'];
    g.fillStyle = cols[Math.floor(rnd() * cols.length)]; g.beginPath(); g.ellipse(x, y, r, r * 0.6, rnd() * 3, 0, Math.PI * 2); g.fill();
  }
  g.filter = 'blur(3px)';
  g.globalAlpha = 0.8;
  drawSmashEmblem(g, 610, 120, 125, '#b5392f');
  g.globalAlpha = 1; g.filter = 'none';
  hazeCache = c; return c;
}

// irregular black starburst
function burst(ctx, cx, cy, rx, ry, k) {
  ctx.save(); ctx.translate(cx, cy); ctx.scale(k, k);
  const spikes = [1.0, 0.8, 1.15, 0.9, 1.05, 0.85, 1.2, 0.95, 1.1, 0.8, 1.15, 0.9, 1.05, 0.85];
  ctx.beginPath();
  const n = spikes.length;
  for (let i = 0; i < n * 2; i++) {
    const a = -Math.PI / 2 + i * Math.PI / n + 0.1;
    const out = i % 2 === 0;
    const rr = out ? spikes[i / 2] : 0.62;
    ctx.lineTo(Math.cos(a) * rx * rr, Math.sin(a) * ry * rr);
  }
  ctx.closePath(); ctx.fillStyle = '#000'; ctx.fill();
  ctx.restore();
}

function smashLetters(ctx, cx, cy, k) {
  const L = 'SMASH', dy = [6, -8, 2, -6, 4], sz = [92, 100, 92, 98, 94];
  ctx.save(); ctx.translate(cx, cy); ctx.scale(k, k);
  ctx.font = `900 96px ${BFONT}`;
  let widths = [...L].map((ch, i) => { ctx.font = `900 ${sz[i]}px ${BFONT}`; return ctx.measureText(ch).width * 0.86; });
  const total = widths.reduce((a, b) => a + b, 0);
  let x = -total / 2;
  for (const pass of [0, 1, 2]) {
    x = -total / 2;
    [...L].forEach((ch, i) => {
      ctx.save(); ctx.translate(x + widths[i] / 2, dy[i] + 34); ctx.rotate((i - 2) * 0.03);
      ctx.font = `italic 900 ${sz[i]}px ${BFONT}`; ctx.textAlign = 'center'; ctx.lineJoin = 'round';
      if (pass === 0) { ctx.lineWidth = 20; ctx.strokeStyle = '#370004'; ctx.strokeText(ch, 0, 0); }
      if (pass === 1) { ctx.lineWidth = 11; ctx.strokeStyle = '#f80011'; ctx.strokeText(ch, 0, 0); }
      if (pass === 2) {
        const g = ctx.createLinearGradient(0, -sz[i] * 0.75, 0, 0);
        g.addColorStop(0, '#fff46a'); g.addColorStop(0.35, '#f8e729'); g.addColorStop(0.7, '#f7c327'); g.addColorStop(1, '#f09018');
        ctx.fillStyle = g; ctx.fillText(ch, 0, 0);
      }
      ctx.restore();
      x += widths[i];
    });
  }
  ctx.restore();
}

// SUPER / BROS.: letters fan outward, growing toward the centre of the logo
function fanWord(ctx, word, cx, cy, dir, k, alpha) {
  ctx.save(); ctx.globalAlpha = alpha; ctx.translate(cx, cy); ctx.scale(k, k);
  const n = word.length;
  const outer = i => (dir < 0 ? n - 1 - i : i);
  [...word].forEach((ch, i) => {
    const u = i - (n - 1) / 2, o = outer(i);
    ctx.save();
    ctx.translate(u * 21, o * 3);
    ctx.rotate(dir * o * 0.09);
    ctx.font = `900 ${42 - o * 3}px ${BFONT}`; ctx.textAlign = 'center'; ctx.lineJoin = 'round';
    ctx.lineWidth = 8; ctx.strokeStyle = '#000'; ctx.strokeText(ch, 0, 0);
    ctx.fillStyle = '#eae826'; ctx.fillText(ch, 0, 0);
    ctx.restore();
  });
  ctx.restore();
}

// any gamepad button (CPU drivers own the virtual controllers during the demo)
function padPressed() {
  const pads = navigator.getGamepads ? [...navigator.getGamepads()].filter(Boolean) : [];
  return pads.some(p => p.buttons.some(b => b.pressed));
}

export class TitleScreen extends MenuScreen {
  constructor(app, p) { super(app, p); this.t = p.skipIntro ? T_DONE : 0; this.idle = 0; }
  enter() { this.app.audio.music('menu'); }
  tick(i) {
    if (this.t === T_SLAM + 4) this.audio.say('Super Smash Bros.', 0.8);
    const any = i.a || i.start || i.b;
    if (any && this.t < T_DONE) { this.t = T_DONE; return; }
    if ((i.start || i.a) && this.t >= T_DONE) { this.audio.sfx('menuOk'); this.go('modeselect'); return; }
    if (++this.idle > T_ATTRACT) this.attract();
  }
  attract() {
    const app = this.app;
    const pick = () => STARTERS[Math.floor(Math.random() * STARTERS.length)];
    const stages = ['peach', 'congo', 'hyrule', 'zebes', 'yoshi', 'dreamland', 'sectorz', 'saffron'];
    const n = 2 + Math.floor(Math.random() * 3);
    app.go('battle', {
      stage: stages[Math.floor(Math.random() * stages.length)], mode: 'demo',
      rules: { mode: 'time', time: 1, items: 'middle' },
      players: Array.from({ length: n }, (_, k) => ({ char: pick(), port: k, color: 0, cpu: { level: 9 } })),
      onFrame: (m, scr) => {
        const inp = app.input;
        if (inp.anyKeyThisFrame || padPressed() || m.frame > 60 * 30) { scr.done = true; app.go('title', { skipIntro: true }); }
      },
      overlay: (ctx, m) => { if (Math.floor(m.frame / 30) % 2 === 0) text(ctx, 'PRESS START', 320, 300, { size: 22, align: 'center', color: '#fff', stroke: '#000', strokeW: 4, italic: false, weight: 700 }); },
      next: () => app.go('title', { skipIntro: true }),
    });
  }
  draw(ctx) {
    const t = this.t;
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, 640, 480);
    ctx.save(); ctx.globalAlpha = Math.min(1, t / 20); ctx.drawImage(haze(), 0, 0); ctx.restore();
    // bottom band with a shallow upward arc
    ctx.save(); ctx.beginPath(); ctx.moveTo(0, 400); ctx.quadraticCurveTo(320, 350, 640, 400); ctx.lineTo(640, 480); ctx.lineTo(0, 480); ctx.closePath();
    const bg = ctx.createLinearGradient(0, 370, 0, 480); bg.addColorStop(0, '#383825'); bg.addColorStop(1, '#231f12');
    ctx.fillStyle = bg; ctx.fill(); ctx.restore();
    const ln = { size: 13, align: 'center', color: '#a09870', italic: false, weight: 400, font: '"DejaVu Sans Mono", monospace' };
    text(ctx, 'SUPER SMASH BROS. 64 - Fan Recreation', 340, 408, ln);
    text(ctx, 'Unofficial. Not affiliated with any rights holder.', 340, 428, ln);
    text(ctx, 'All models, art and sound made from scratch.', 340, 448, ln);
    // logo
    const fly = Math.min(1, Math.max(0, (t - T_FLY) / 18)), e = 1 - Math.pow(1 - fly, 3);
    const LX = 340, LY = 180;
    if (t >= T_FLY) {
      burst(ctx, LX, LY, 240, 105, 0.3 + 0.7 * e);
      fanWord(ctx, 'SUPER', 112 - (1 - e) * 300, LY + 18, -1, 1, e);
      fanWord(ctx, 'BROS.', 568 + (1 - e) * 300, LY + 20, 1, 1, e);
    }
    if (t >= T_SLAM) {
      const u = (t - T_SLAM);
      const k = u < 6 ? 2.6 - 1.7 * (u / 6) : 1 + 0.12 * Math.exp(-(u - 6) / 4) * Math.cos((u - 6) * 0.9);
      smashLetters(ctx, LX, LY - 12, k);
    }
    if (t >= T_PROMPT && Math.floor((t - T_PROMPT) / 20) % 2 === 0)
      text(ctx, 'PRESS START', 330, 372, { size: 24, align: 'center', color: '#2721aa', italic: false, weight: 400, font: '"Liberation Sans", "DejaVu Sans", sans-serif', scaleX: 0.95 });
    // the white flash that ends the opening
    if (t < 20) { ctx.fillStyle = `rgba(255,255,255,${1 - t / 20})`; ctx.fillRect(0, 0, 640, 480); }
  }
}
