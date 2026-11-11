// Stage Select: 5x2 thumbnail grid (miniature renders of each real stage scene, cached; a painted
// placeholder shows until a stage's render is ready — at most one stage is built per frame) with a red glowing selector, a live 3D preview
// of the highlighted stage in a wooden frame, "Stage Select" script, a wooden series-emblem disc and the
// stage name pill. A confirms (fade to black), B goes back to the CSS.
// params: { mode, onPick(stageId), onBack() }
import * as THREE from 'three';
import { MenuScreen, drawStone, pill, RFONT, BFONT, SERIES_OF_STAGE } from '../menu.js';
import { text } from '../draw.js';
import { drawEmblem } from '../hud.js';
import { STAGES } from '../../stages/index.js';
import { buildCollision } from '../../game/collision.js';
import { RS } from '../../render/view.js';
import { addLights, drawScene, disposeTree } from '../render3d.js';
import { VS_STAGE_GRID } from './css.js';

const NAMES = { peach: "Peach's Castle", congo: 'Congo Jungle', hyrule: 'Hyrule Castle', zebes: 'Planet Zebes', mushroom: 'Mushroom Kingdom',
  yoshi: "Yoshi's Island", dreamland: 'Dream Land', sectorz: 'Sector Z', saffron: 'Saffron City', random: 'Random' };
const TX = 62, TY = 54, TW = 96, TH = 70, GAP = 4;
// per-stage thumbnail camera tweaks (zoom = fraction of the stage width, el = elevation angle, dy = game units)
const THUMB_VIEW = { peach: { el: 0.85, zoom: 0.34 }, congo: { el: 0.3, zoom: 0.42 }, hyrule: { el: 0.8, zoom: 0.36 }, zebes: { el: 0.45, zoom: 0.38 },
  mushroom: { el: 0.3, zoom: 0.4 }, yoshi: { el: 0.7, zoom: 0.36 }, dreamland: { el: 0.45, zoom: 0.42 }, sectorz: { el: 0.8, zoom: 0.4 }, saffron: { el: 0.9, zoom: 0.36 } };

// Rendered thumbnails (canvas per stage id), kept for the session.
const renderedThumbs = new Map();
const thumbCache = new Map();
function thumb(id) {
  if (renderedThumbs.has(id)) return renderedThumbs.get(id);
  if (thumbCache.has(id)) return thumbCache.get(id);
  const c = document.createElement('canvas'); c.width = TW * 2; c.height = TH * 2;
  const g = c.getContext('2d'); g.scale(2, 2);
  const W = TW, H = TH;
  let s = id.length * 31 + 7; const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const grad = (stops) => { const gr = g.createLinearGradient(0, 0, 0, H); stops.forEach(([o, c2]) => gr.addColorStop(o, c2)); g.fillStyle = gr; g.fillRect(0, 0, W, H); };
  const blob = (x, y, r, col) => { g.fillStyle = col; g.beginPath(); g.ellipse(x, y, r, r * 0.6, 0, 0, Math.PI * 2); g.fill(); };
  switch (id) {
    case 'peach': grad([[0, '#9cc8e8'], [1, '#e8f0f8']]); for (let i = 0; i < 14; i++) blob(rnd() * W, 30 + rnd() * 40, 8 + rnd() * 12, 'rgba(255,255,255,0.85)');
      g.fillStyle = '#c84040'; g.beginPath(); g.moveTo(44, 14); g.lineTo(52, 30); g.lineTo(36, 30); g.fill(); g.fillStyle = '#a89a8a'; g.fillRect(38, 30, 12, 18); g.fillStyle = '#6a6a7a'; g.fillRect(20, 46, 56, 6); break;
    case 'congo': grad([[0, '#300800'], [0.45, '#e04010'], [0.6, '#f0a030'], [1, '#100800']]);
      g.fillStyle = '#000'; for (let i = 0; i < 6; i++) { const x = rnd() * W; g.fillRect(x, 30, 3, 40); g.beginPath(); g.arc(x, 30, 10, 0, Math.PI * 2); g.fill(); } g.fillRect(0, 54, W, 16); break;
    case 'hyrule': grad([[0, '#9aa0b0'], [1, '#d0d4c8']]); g.fillStyle = '#6a7868';
      g.beginPath(); g.moveTo(0, 50); for (let x = 0; x <= W; x += 12) g.lineTo(x, 26 + rnd() * 20); g.lineTo(W, H); g.lineTo(0, H); g.fill();
      g.fillStyle = '#808080'; g.fillRect(10, 48, 76, 10); g.fillStyle = '#2a7a3a'; g.beginPath(); g.moveTo(20, 34); g.lineTo(26, 48); g.lineTo(14, 48); g.fill(); break;
    case 'zebes': grad([[0, '#100818'], [0.6, '#302040'], [1, '#e8d020']]); g.fillStyle = '#284018';
      for (let i = 0; i < 4; i++) g.fillRect(rnd() * 70, 30 + rnd() * 20, 20 + rnd() * 10, 6); break;
    case 'mushroom': grad([[0, '#5880f8'], [0.75, '#90b0ff'], [0.76, '#40a030'], [1, '#2a7a20']]); g.fillStyle = '#c86a30'; g.fillRect(0, 60, W, 10);
      g.fillStyle = '#30b030'; g.fillRect(12, 42, 12, 18); g.fillRect(10, 40, 16, 5); break;
    case 'yoshi': grad([[0, '#f8c890'], [1, '#f8e0b0']]); for (let i = 0; i < 6; i++) blob(rnd() * W, 15 + rnd() * 30, 10 + rnd() * 8, 'rgba(255,255,255,0.8)');
      g.fillStyle = '#70c050'; g.beginPath(); g.ellipse(48, 72, 50, 22, 0, 0, Math.PI * 2); g.fill(); break;
    case 'dreamland': grad([[0, '#70a8f0'], [1, '#d0e8ff']]);
      ['#f04040', '#f0a040', '#f0f040', '#40c040', '#4080f0'].forEach((cc, i) => { g.strokeStyle = cc; g.lineWidth = 3; g.beginPath(); g.arc(48, 70, 52 - i * 4, Math.PI, 0); g.stroke(); });
      for (let i = 0; i < 8; i++) blob(rnd() * W, 55 + rnd() * 15, 10 + rnd() * 8, '#fff'); break;
    case 'sectorz': grad([[0, '#000010'], [1, '#101030']]); g.fillStyle = '#fff'; for (let i = 0; i < 30; i++) g.fillRect(rnd() * W, rnd() * H, 1, 1);
      g.fillStyle = '#f08020'; for (let i = 0; i < 5; i++) blob(30 + rnd() * 40, 30 + rnd() * 20, 6 + rnd() * 6, `rgba(240,${100 + rnd() * 100},20,0.8)`); break;
    case 'saffron': grad([[0, '#b8c8d8'], [1, '#e8eef4']]); g.fillStyle = '#8a9098';
      for (let i = 0; i < 9; i++) { const x = i * 11, h = 24 + rnd() * 40; g.fillRect(x, H - h, 9, h); } break;
    case 'random': g.fillStyle = '#213165'; g.fillRect(0, 0, W, H);
      g.font = `900 64px ${BFONT}`; g.textAlign = 'center'; g.fillStyle = 'rgba(120,150,220,0.35)'; g.fillText('?', W / 2, 62);
      g.font = `900 18px ${BFONT}`; g.lineWidth = 3; g.strokeStyle = '#0a1030'; g.strokeText('RANDOM', W / 2, 42); g.fillStyle = '#c8d8ff'; g.fillText('RANDOM', W / 2, 42); break;
  }
  thumbCache.set(id, c); return c;
}

export class StageSelectScreen extends MenuScreen {
  constructor(app, p) {
    super(app, p);
    this.sel = app.menuMemory?.stage ?? 0;
    this.previews = new Map();
    this.pick = null;
  }
  available(id) { return id !== 'mushroom' || this.save.isUnlocked('mushroomkingdom'); }
  exit() { for (const pv of this.previews.values()) if (pv?.scene) disposeTree(pv.scene); }
  tick(i) {
    let c = this.sel % 5, r = Math.floor(this.sel / 5), moved = false;
    const step = (dc, dr) => {
      for (let k = 0; k < 5; k++) {
        c = (c + dc + 5) % 5; r = (r + dr + 2) % 2;
        if (this.available(VS_STAGE_GRID[r * 5 + c])) break;
      }
      moved = true;
    };
    if (i.left) step(-1, 0); else if (i.right) step(1, 0); else if (i.up) step(0, -1); else if (i.down) step(0, 1);
    if (moved) { this.sel = r * 5 + c; this.audio.sfx('menuMove'); }
    if (i.a || i.start) {
      (this.app.menuMemory ??= {}).stage = this.sel;
      let id = VS_STAGE_GRID[this.sel];
      if (id === 'random') { const ok = VS_STAGE_GRID.filter(s => s !== 'random' && this.available(s)); id = ok[Math.floor(Math.random() * ok.length)]; }
      this.pick = id;
      this.audio.sfx('select');
      this.fadeOut(() => this.p.onPick ? this.p.onPick(id) : this.go('battle', { stage: id, players: [], rules: {} }), 30);
    }
    if (i.b) { this.audio.sfx('menuBack'); this.p.onBack ? this.p.onBack() : this.go('css', { mode: 'vs' }); }
  }
  preview(id) {
    if (this.previews.has(id)) return this.previews.get(id);
    let pv = null;
    try {
      const def = STAGES[id];
      const st = def.create(null, {});
      st.col = buildCollision(st.collision);
      const scene = addLights(new THREE.Scene(), { amb: st.ambient ?? 0.7, sun: st.sun ?? 1.3 });
      const obj = st.build(scene, RS);
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      for (const g of st.collision.groups ?? []) for (const f of g.floors) for (const [x, y] of f.pts) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
      if (!isFinite(minX)) { minX = -2000; maxX = 2000; minY = 0; maxY = 1000; }
      const cam = new THREE.PerspectiveCamera(38, 4 / 3, 0.5, 600);
      const fake = { frame: 0, col: st.col, fighters: [], stage: st, phase: 'play', items: { list: [] }, projectiles: [], events: [], rules: {} };
      pv = { scene, cam, st, obj, fake, cx: (minX + maxX) / 2 * RS, cy: ((minY + maxY) / 2 + 500) * RS, span: Math.max(2500, maxX - minX) * RS, syncOK: true };
    } catch (e) { console.warn('stage preview', id, e); }
    this.previews.set(id, pv);
    return pv;
  }
  // Render a stage's scene once into a small cached canvas: a raised, slightly angled overview of the
  // whole stage like the SSB64 stage-select pictures.
  renderThumb(id) {
    const c = document.createElement('canvas'); c.width = TW * 2; c.height = TH * 2;
    const g = c.getContext('2d');
    const pv = this.preview(id);
    if (!pv) return null;
    try {
      if (pv.syncOK) { try { pv.fake.frame = 0; pv.st.sync(pv.obj, pv.fake, RS); } catch { pv.syncOK = false; } }
      const v = THUMB_VIEW[id] ?? {}, yaw = v.yaw ?? 0.12, d = pv.span * (v.zoom ?? 0.5) / Math.tan(19 * Math.PI / 180);
      const el = v.el ?? 0.55;
      pv.cam.position.set(pv.cx + Math.sin(yaw) * d * Math.cos(el), pv.cy + Math.sin(el) * d + (v.dy ?? 0) * RS, Math.cos(yaw) * d * Math.cos(el));
      pv.cam.lookAt(pv.cx, pv.cy + (v.dy ?? 0) * RS - pv.span * 0.08, 0);
      if (pv.obj?.background) pv.obj.background.position.x = pv.cx;
      drawScene(g, pv.scene, pv.cam, 0, 0, c.width, c.height, pv.st.clearColor ?? 0x000000);
    } catch (e) { console.warn('stage thumb', id, e); return null; }
    return c;
  }
  draw(ctx) {
    drawStone(ctx);
    // build missing stage thumbnails (first visit only, one-time cost while the screen fades in)
    const t0 = performance.now();
    for (const id of VS_STAGE_GRID) {
      if (id === 'random' || renderedThumbs.has(id) || !this.available(id)) continue;
      renderedThumbs.set(id, this.renderThumb(id) ?? thumb(id));
      if (performance.now() - t0 > 1500) break;
    }
    VS_STAGE_GRID.forEach((id, k) => {
      const x = TX + (k % 5) * (TW + GAP), y = TY + Math.floor(k / 5) * (TH + GAP);
      ctx.fillStyle = '#000'; ctx.fillRect(x - 1, y - 1, TW + 2, TH + 2);
      if (this.available(id)) ctx.drawImage(thumb(id), x, y, TW, TH);
      else { ctx.fillStyle = '#1a1a1a'; ctx.fillRect(x, y, TW, TH); }
    });
    const sx = TX + (this.sel % 5) * (TW + GAP), sy = TY + Math.floor(this.sel / 5) * (TH + GAP);
    ctx.save(); ctx.shadowColor = '#ff2020'; ctx.shadowBlur = 14; ctx.strokeStyle = '#e10303'; ctx.lineWidth = 5; ctx.strokeRect(sx - 2, sy - 2, TW + 4, TH + 4); ctx.restore();
    const id = VS_STAGE_GRID[this.sel];
    // preview frame
    const PX = 80, PY = 252, PW = 232, PH = 170;
    for (const [dir, x0] of [[-1, 40], [1, 352]]) { ctx.fillStyle = '#2a5ab0'; ctx.beginPath(); ctx.moveTo(x0, 300); ctx.lineTo(x0 + dir * -28, 286); ctx.lineTo(x0 + dir * -28, 330); ctx.closePath(); ctx.fill(); }
    ctx.fillStyle = '#2a1408'; ctx.fillRect(PX + 6, PY + 6, PW, PH);
    ctx.fillStyle = '#784830'; ctx.fillRect(PX - 6, PY - 6, PW + 12, PH + 12);
    if (id === 'random') {
      ctx.fillStyle = '#213165'; ctx.fillRect(PX, PY, PW, PH);
      text(ctx, '?', PX + PW / 2, PY + PH / 2 + 40, { size: 120, align: 'center', color: '#c8d8ff', stroke: '#0a1030', strokeW: 6, font: BFONT, italic: false, scaleX: 0.6 + 0.4 * Math.abs(Math.cos(this.t * 0.05)) });
    } else {
      const pv = this.preview(id);
      if (pv) {
        if (pv.syncOK) { try { pv.fake.frame = this.t; pv.st.sync(pv.obj, pv.fake, RS); } catch { pv.syncOK = false; } }
        const yaw = Math.sin(this.t * 0.012) * 0.35, d = pv.span * 0.62 / Math.tan(19 * Math.PI / 180);
        pv.cam.position.set(pv.cx + Math.sin(yaw) * d, pv.cy + d * 0.28, Math.cos(yaw) * d);
        pv.cam.lookAt(pv.cx, pv.cy - pv.span * 0.05, 0);
        if (pv.obj?.background) pv.obj.background.position.x = pv.cx;
        drawScene(ctx, pv.scene, pv.cam, PX, PY, PW, PH, pv.st.clearColor ?? 0x000000);
      } else ctx.drawImage(thumb(id), PX, PY, PW, PH);
    }
    // right side
    ctx.fillStyle = '#5a638c'; ctx.fillRect(560, 254, 80, 8);
    text(ctx, 'Stage Select', 452, 268, { size: 30, align: 'center', color: '#aaacc7', stroke: '#656984', strokeW: 3, shadow: '#2a2c40', font: '"DejaVu Serif", serif', weight: 700 });
    const ex = 450, ey = 334;
    ctx.save();
    const wg = ctx.createRadialGradient(ex - 20, ey - 20, 10, ex, ey, 64); wg.addColorStop(0, '#9a7448'); wg.addColorStop(1, '#704420');
    ctx.beginPath(); ctx.arc(ex, ey, 62, 0, Math.PI * 2); ctx.fillStyle = wg; ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = '#5a3418'; ctx.stroke();
    ctx.strokeStyle = 'rgba(90,52,24,0.35)'; ctx.lineWidth = 1; for (let r = 12; r < 60; r += 9) { ctx.beginPath(); ctx.arc(ex, ey, r, 0, Math.PI * 2); ctx.stroke(); }
    ctx.restore();
    if (id === 'random') text(ctx, '?', ex, ey + 26, { size: 76, align: 'center', color: '#5a3418', font: BFONT, italic: false });
    else drawEmblem(ctx, SERIES_OF_STAGE[id] ?? STAGES[id]?.series ?? 'mario', ex, ey, 40, '#5a3418');
    pill(ctx, 350, 392, 200, 34, '#e8a518', { stroke: '#7a5810', lw: 2, r: 17 });
    text(ctx, NAMES[id], 450, 416, { size: 19, align: 'center', color: '#000', font: RFONT, italic: false, weight: 700 });
  }
}
