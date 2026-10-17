// VS Results: the frozen last frame falls away in vertical strips, the winner's series emblem shows as a
// flat red silhouette on black, then crossfades into the results scene (maroon backdrop, checkerboard
// floor, winner in a victory pose, the others behind, confetti), "<NAME> WINS!" and the stats table
// (Place / KOs / Falls / SDs, or KOs / TKO / SD / Pts / Place for time). A or START returns to the CSS.
// Also records VS stats per character in the save and applies AUTO handicap.
// params: { match, params (battle params), quit, prevMatch }
import * as THREE from 'three';
import { MenuScreen, RFONT, BFONT, PORT_TOKEN, CPU_TOKEN } from '../menu.js';
import { text } from '../draw.js';
import { drawEmblem } from '../hud.js';
import { MenuFighter, disposeTree, headIcon } from '../render3d.js';
import { charFullName, charSayName } from './css.js';
import { canvasTex } from '../../stages/common.js';

const TEAM_NAMES = ['RED', 'BLUE', 'GREEN'];
const HFONT = '"Arial Rounded MT Bold", "Liberation Sans", "DejaVu Sans", sans-serif';
const T_STRIPS = 45, T_EMBLEM = 105, T_SCENE = 125, T_TABLE = 245;

export function recordVSMatch(save, match, quit) {
  const d = save.data;
  const vs = d.records.vs ??= { chars: {}, matrix: {} };
  vs.chars ??= {}; vs.matrix ??= {};
  const st = match.standings(), win = quit ? null : st[0];
  for (const f of match.fighters) {
    const id = f.def.id, c = vs.chars[id] ??= { plays: 0, wins: 0, kos: 0, falls: 0, sds: 0, dmgGiven: 0, dmgTaken: 0, frames: 0 };
    c.plays++; c.kos += f.stats.kos; c.falls += f.stats.falls; c.sds += f.stats.sds;
    c.dmgGiven += Math.round(f.stats.dmgGiven); c.dmgTaken += Math.round(f.stats.dmgTaken); c.frames += match.frame;
    if (win && (f === win || (match.rules.teams && f.team === win.team))) c.wins++;
    for (const port of f.stats.koBy ?? []) {
      const killer = match.fighters.find(k => k.port === port); if (!killer) continue;
      const row = vs.matrix[killer.def.id] ??= {}; row[id] = (row[id] ?? 0) + 1;
    }
  }
  d.vsPlays = (d.vsPlays ?? 0) + 1;
  save.write();
}

export class ResultsScreen extends MenuScreen {
  constructor(app, p) {
    super(app, p);
    this.m = p.match; this.quit = !!p.quit;
    const m = this.m;
    this.st = m.standings();
    this.time = m.rules.mode === 'time' && !m.suddenDeath;
    this.winner = this.quit ? null : this.st[0];
    // places (ties share a place in time mode)
    this.place = new Map();
    this.st.forEach((f, k) => {
      let pl = k + 1;
      if (this.time && k > 0) { const prev = this.st[k - 1]; if (score(prev) === score(f)) pl = this.place.get(prev); }
      if (m.rules.teams && k > 0 && this.st[k - 1].team === f.team) pl = this.place.get(this.st[k - 1]);
      this.place.set(f, pl);
    });
    this.confetti = Array.from({ length: 70 }, () => newConfetto(true));
  }
  enter() {
    const app = this.app;
    // snapshot the frozen last battle frame (WebGL + HUD)
    const snap = document.createElement('canvas'); snap.width = 640; snap.height = 480;
    const g = snap.getContext('2d');
    try { g.drawImage(app.canvas, 0, 0, 640, 480); g.drawImage(app.uiCanvas, 0, 0); } catch {}
    this.snap = snap;
    app.audio.stopMusic();
    recordVSMatch(this.save, this.m, this.quit);
    this.autoHandicap();
    this.buildScene();
  }
  exit() { if (this.scene) { for (const mf of this.fighters) mf.dispose(); disposeTree(this.scene); } }
  autoHandicap() {
    const css = this.app.cssState?.vs; if (!css || this.save.data.vsRules.handicap !== 'auto' || this.quit) return;
    const first = this.st[0], last = this.st[this.st.length - 1];
    const pp = f => css.panels[f.port];
    if (pp(first)) pp(first).handicap = Math.max(1, (pp(first).handicap ?? 9) - 1);
    if (last !== first && pp(last)) pp(last).handicap = Math.min(9, (pp(last).handicap ?? 9) + 1);
  }
  buildScene() {
    const s = this.scene = new THREE.Scene(), q = this.quit;
    // stock/time results: maroon; no contest: grey-green
    const C = q ? { fog: 0x394239, light: '#394239', dark: '#101512', bg0: '#4a5650', bg1: '#2e3631', cloudA: '120,132,122', cloudB: '40,50,44' }
      : { fog: 0x4c3835, light: '#4c3836', dark: '#271010', bg0: '#5a403c', bg1: '#3e2c2a', cloudA: '96,66,60', cloudB: '50,35,33' };
    this.clear = C.fog;
    s.add(new THREE.AmbientLight(0xffffff, 0.75));
    const dl = new THREE.DirectionalLight(0xffffff, 1.4); dl.position.set(-0.6, 1, 1); s.add(dl);
    s.fog = new THREE.Fog(C.fog, 7, 22);
    const floorTex = canvasTex(64, 64, (g2) => { g2.fillStyle = C.light; g2.fillRect(0, 0, 64, 64); g2.fillStyle = C.dark; g2.fillRect(0, 0, 32, 32); g2.fillRect(32, 32, 32, 32); }, { repeat: [24, 24], nearest: true });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(48, 48), new THREE.MeshLambertMaterial({ map: floorTex }));
    floor.rotation.x = -Math.PI / 2; s.add(floor);
    const series = this.winner?.def.series ?? 'mario';
    const bgTex = canvasTex(512, 256, (g2, w, h) => {
      const gr = g2.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, C.bg0); gr.addColorStop(1, C.bg1); g2.fillStyle = gr; g2.fillRect(0, 0, w, h);
      let sd = 9; const rnd = () => ((sd = (sd * 16807) % 2147483647) / 2147483647);
      for (let i = 0; i < 70; i++) { g2.fillStyle = `rgba(${rnd() < 0.5 ? C.cloudA : C.cloudB},${q ? 0.45 : 0.35})`; g2.beginPath(); g2.ellipse(rnd() * w, rnd() * h, 20 + rnd() * 40, 10 + rnd() * 20, 0, 0, 7); g2.fill(); }
      if (!q) drawEmblem(g2, series, w * 0.5, h * 0.5, 110, 'rgba(130,40,38,0.55)');
    });
    const bg = new THREE.Mesh(new THREE.PlaneGeometry(36, 18), new THREE.MeshBasicMaterial({ map: bgTex, fog: false }));
    bg.position.set(0, 5.2, -14); s.add(bg);
    this.camera = new THREE.PerspectiveCamera(38, 4 / 3, 0.1, 80);
    this.camera.position.set(0, 1.35, 6.4); this.camera.lookAt(0, 1.05, 0);
    // fighters: the winner big at front-left in the victory pose, the others smaller behind (2nd left,
    // 3rd right, 4th far centre); no contest: everyone in a row
    this.fighters = []; this.slots = [];
    const order = q ? [...this.m.fighters].sort((x, y) => x.port - y.port) : this.st;
    const back = [[-2.2, -1.2], [2.85, -2.6], [1.3, -5.0]];
    order.forEach((f, k) => {
      const mf = new MenuFighter(f.def.id, f.color, { yaw: k === 0 && !q ? 0.35 : 0.15 });
      const vis = f.def.attr?.visualHeight ?? (f.def.attr?.height ?? 320) * (f.def.modelScale ?? 1);
      const rel = vis / 480;
      let pos, H;
      if (q) { pos = [(k - (order.length - 1) / 2) * 1.5, 0, 0.4]; H = 1.3 * Math.pow(rel, 0.6); }
      else if (k === 0) { pos = [-0.6, 0, 1.2]; H = 1.75 * Math.pow(rel, 0.3); }
      else { pos = [back[k - 1][0], 0, back[k - 1][1]]; H = 1.25 * rel; }
      const sc = H / Math.max(0.3, mf.h);
      mf.holder.position.set(pos[0], 0, pos[2]); mf.holder.scale.setScalar(sc);
      mf.scene.remove(mf.holder); s.add(mf.holder);
      this.fighters.push(mf); this.slots.push({ f, mf, top: mf.top * sc, pos });
    });
  }
  tick(i) {
    const t = this.t;
    if (t === T_STRIPS + 5) { if (this.quit) this.audio.sfx('menuBack'); else this.audio.say("This game's winner is", 0.85); }
    if (t === T_SCENE) { if (!this.quit) this.audio.say(this.winnerName(true), 0.9); this.app.audio.music('victory'); }
    if (t === T_SCENE + 400) this.app.audio.music('results');
    if ((i.a || i.start) && t > T_SCENE + 20) { this.audio.sfx('menuOk'); this.done(); }
    else if ((i.a || i.start) && t < T_SCENE) this.t = T_SCENE - 1;
    for (const c of this.confetti) { c.y += c.vy; c.x += Math.sin((t + c.ph) * 0.05) * 0.6; c.a += c.va; if (c.y > 490) Object.assign(c, newConfetto(false)); }
  }
  done() {
    const p = this.p.params;
    if (p?.returnTo) this.go(p.returnTo.screen, p.returnTo.params);
    else this.go('css', { mode: 'vs' });
  }
  winnerName(speak) {
    const w = this.winner; if (!w) return '';
    if (this.m.rules.teams) return speak ? TEAM_NAMES[w.team ?? 0] + ' team' : TEAM_NAMES[w.team ?? 0] + ' TEAM';
    return speak ? charSayName(w.def.id) : charFullName(w.def.id);
  }
  draw(ctx, renderer) {
    const t = this.t;
    if (t < T_STRIPS) {
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, 640, 480);
      const n = 16, w = 640 / n;
      for (let k = 0; k < n; k++) {
        const delay = ((k * 7) % n) * 1.6, u = Math.max(0, t - delay);
        const y = u * u * 0.35;
        ctx.drawImage(this.snap, k * w * 1, 0, w, 480, k * w, y, w, 480);
      }
      return;
    }
    if (t < T_EMBLEM) {
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, 640, 480);
      if (!this.quit) drawEmblem(ctx, this.winner.def.series, 320, 240, 170, '#e14b3c');
      return;
    }
    // 3D scene
    for (const s of this.slots) {
      if (!this.quit && s === this.slots[0]) s.mf.victory(t); else s.mf.pose(t + s.f.port * 20);
    }
    renderer.setClearColor(this.clear); renderer.render(this.scene, this.camera);
    if (t < T_SCENE) {
      const k = (t - T_EMBLEM) / (T_SCENE - T_EMBLEM);
      ctx.save(); ctx.globalAlpha = 1 - k; ctx.fillStyle = '#000'; ctx.fillRect(0, 0, 640, 480);
      if (!this.quit) drawEmblem(ctx, this.winner.def.series, 320, 240, 170, '#e14b3c');
      ctx.restore(); return;
    }
    // confetti
    if (!this.quit) for (const c of this.confetti) { ctx.save(); ctx.translate(c.x, c.y); ctx.rotate(c.a); ctx.scale(1, Math.cos(c.a * 1.7)); ctx.fillStyle = c.col; ctx.fillRect(-4, -3, 8, 6); ctx.restore(); }
    if (t >= T_TABLE || (this.quit && t >= T_SCENE + 20)) this.drawTable(ctx, Math.min(1, (t - (this.quit ? T_SCENE + 20 : T_TABLE)) / 20));
    // pointer tags over every fighter (port colour, grey CP)
    for (const s of this.slots) {
      const v = new THREE.Vector3(s.pos[0], s.top + 0.22, s.pos[2]).project(this.camera);
      const x = (v.x + 1) * 320, y = Math.max(118, (1 - v.y) * 240);
      const col = s.f.cpu ? CPU_TOKEN : PORT_TOKEN[s.f.port];
      tag(ctx, x, y, s.f.cpu ? 'CP' : (s.f.port + 1) + 'P', col, s === this.slots[0] && !this.quit ? 1.2 : 1);
    }
    // name banner (over the table, like the original)
    if (this.quit) hollowText(ctx, [['NO CONTEST', CHROME]], 320, 432, 100);
    else this.drawWins(ctx);
  }
  drawWins(ctx) {
    const team = this.m.rules.teams;
    const nameCol = team ? TEAM_STYLE[this.winner.team ?? 0] : RED;
    hollowText(ctx, [[this.winnerName(false), nameCol], ['WINS!', PURPLE]], 320, 432, 100);
  }
  // Results table: "Free-for-all" + white rule, per-port column headers (head icon + port tag), rows with
  // grey labels on black arrow bands. Stock: Place (big, laurel for 1st) / rule / KOs. Time: KOs / TKO /
  // rule / Pts / Place. No contest: KOs / TKO.
  drawTable(ctx, a) {
    const m = this.m;
    ctx.save(); ctx.globalAlpha = a;
    text(ctx, m.rules.teams ? 'Team Battle' : 'Free-for-all', 64, 68, { size: 21, color: '#fff', font: RFONT, italic: false, weight: 700, stroke: 'rgba(0,0,0,0.6)', strokeW: 3 });
    ctx.fillStyle = '#f8f8f8'; ctx.fillRect(62, 80, 504, 3);
    const fs = [...m.fighters].sort((x, y) => x.port - y.port);
    const n = fs.length, sp = 316 / n;
    const colX = k => 400 + (k - (n - 1) / 2) * sp;
    fs.forEach((f, k) => {
      const x = colX(k);
      let img = null; try { img = headIcon(f.def.id, f.color, 16); } catch {}
      if (img) ctx.drawImage(img, x - 30, 92, 22, 22);
      const col = f.cpu ? '#b8b8c0' : PORT_TOKEN[f.port];
      ctx.save(); ctx.fillStyle = 'rgba(0,0,0,0.85)'; ctx.beginPath();
      ctx.moveTo(x - 6, 94); ctx.lineTo(x + 30, 94); ctx.lineTo(x + 30, 108); ctx.lineTo(x + 18, 114); ctx.lineTo(x + 6, 108); ctx.lineTo(x - 6, 108); ctx.closePath(); ctx.fill(); ctx.restore();
      text(ctx, (f.port + 1) + 'P', x + 12, 107, { size: 13, align: 'center', color: col, font: BFONT, italic: false });
    });
    const place = f => this.place.get(f);
    const rows = this.quit ? [['KOs', f => f.stats.kos, 0, 142], ['TKO', f => f.stats.falls, 0, 172]]
      : this.time ? [['KOs', f => f.stats.kos, 0, 142], ['TKO', f => f.stats.falls, 0, 172], ['rule', null, 0, 192], ['Pts', f => score(f), 0, 214], ['Place', place, 1, 262]]
        : [['Place', place, 1, 150], ['rule', null, 0, 214], ['KOs', f => f.stats.kos, 0, 258]];
    for (const [label, val, big, y] of rows) {
      if (label === 'rule') { ctx.fillStyle = '#f8f8f8'; ctx.fillRect(172, y, 386, 3); continue; }
      band(ctx, y, big ? 40 : 26);
      text(ctx, label, 92, y + (big ? 12 : 8), { size: big ? 32 : 22, align: 'center', color: '#a8a8a8', stroke: '#101010', strokeW: 4, font: RFONT, italic: false, weight: 700 });
      fs.forEach((f, k) => {
        const v = val(f), x = colX(k);
        if (big && v === 1) { laurel(ctx, x, y - 2); text(ctx, '1', x, y + 16, { size: 44, align: 'center', color: '#ffe418', stroke: '#1a1400', strokeW: 5, font: BFONT, italic: false }); }
        else if (big) text(ctx, String(v), x, y + 16, { size: 44, align: 'center', color: '#fff', stroke: '#000', strokeW: 5, font: BFONT, italic: false });
        else text(ctx, String(v), x, y + 8, { size: 21, align: 'center', color: '#fff', stroke: '#000', strokeW: 3, font: BFONT, italic: false });
      });
    }
    ctx.restore();
  }
}

// black label band with an arrow-shaped right end, fading out to the left
function band(ctx, y, h) {
  ctx.save();
  const g = ctx.createLinearGradient(0, 0, 186, 0); g.addColorStop(0, 'rgba(0,0,0,0.35)'); g.addColorStop(0.35, 'rgba(0,0,0,0.85)'); g.addColorStop(1, 'rgba(0,0,0,0.9)');
  ctx.fillStyle = g; ctx.beginPath();
  ctx.moveTo(14, y - h / 2); ctx.lineTo(160, y - h / 2); ctx.lineTo(160 + h * 0.55, y); ctx.lineTo(160, y + h / 2); ctx.lineTo(14, y + h / 2); ctx.closePath(); ctx.fill();
  ctx.restore();
}
// green laurel wreath with a ribbon bow, around the 1st place number
function laurel(ctx, x, y) {
  ctx.save(); ctx.translate(x, y);
  for (const sg of [-1, 1]) {
    ctx.strokeStyle = '#105a14'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(0, 0, 27, Math.PI / 2 + sg * 0.35, Math.PI / 2 + sg * 2.3, sg < 0); ctx.stroke();
    for (let i = 0; i < 8; i++) {
      const ang = Math.PI / 2 + sg * (0.5 + i * 0.24), px = Math.cos(ang) * 27, py = Math.sin(ang) * 27;
      for (const side of [-1, 1]) {
        const la = ang + sg * Math.PI / 2 + side * 0.7 - sg * 0.2;
        ctx.save(); ctx.translate(px, py); ctx.rotate(la);
        ctx.fillStyle = side > 0 ? '#3fae2a' : '#258a1c'; ctx.strokeStyle = '#0a3a0c'; ctx.lineWidth = 0.8;
        ctx.beginPath(); ctx.ellipse(6, 0, 6.5, 2.6, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.restore();
      }
    }
  }
  // ribbon bow
  ctx.fillStyle = '#d8f0d0'; ctx.strokeStyle = '#2a6a20'; ctx.lineWidth = 1.2;
  for (const sg of [-1, 1]) {
    ctx.beginPath(); ctx.moveTo(0, 28); ctx.lineTo(sg * 13, 21); ctx.lineTo(sg * 13, 35); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(sg * 2, 30); ctx.lineTo(sg * 9, 44); ctx.lineTo(sg * 5, 42); ctx.lineTo(sg * 3, 46); ctx.lineTo(sg * -1, 31); ctx.closePath(); ctx.fill(); ctx.stroke();
  }
  ctx.beginPath(); ctx.arc(0, 28, 3.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.restore();
}
// Hollow outlined banner text: dark rim, coloured outline, thin white inner line and a see-through
// banded fill. parts = [[string, style], ...] laid out centred on cx.
const RED = { rim: '#3a0006', line: '#c8102a', fill: ['rgba(255,225,230,0.7)', 'rgba(220,110,125,0.4)', 'rgba(190,40,60,0.3)', 'rgba(250,170,185,0.55)'] };
const PURPLE = { rim: '#1a0838', line: '#5a28c0', fill: ['rgba(240,230,255,0.7)', 'rgba(160,130,225,0.4)', 'rgba(100,60,190,0.3)', 'rgba(205,185,250,0.55)'] };
const CHROME = { rim: '#101418', line: '#9aa4a8', fill: ['rgba(255,255,255,0.9)', 'rgba(170,180,185,0.65)', 'rgba(70,80,85,0.55)', 'rgba(210,215,220,0.8)'] };
const TEAM_STYLE = [RED, { rim: '#000a3a', line: '#2848e0', fill: ['rgba(235,240,255,0.85)', 'rgba(130,150,240,0.55)', 'rgba(40,70,210,0.45)', 'rgba(190,200,255,0.7)'] },
  { rim: '#002a08', line: '#20a040', fill: ['rgba(235,255,238,0.85)', 'rgba(120,220,140,0.55)', 'rgba(30,150,60,0.45)', 'rgba(190,255,200,0.7)'] }];
function hollowText(ctx, parts, cx, base, size) {
  ctx.save();
  const font = s2 => `700 ${s2}px ${HFONT}`;
  ctx.font = font(size);
  const gap = size * 0.28;
  const widths = parts.map(([str]) => ctx.measureText(str).width);
  const total = widths.reduce((u, v) => u + v, 0) + gap * (parts.length - 1);
  const sx = Math.min(0.84, 540 / total);   // condensed letterforms like the original
  let x = cx - total * sx / 2;
  ctx.lineJoin = 'round'; ctx.textBaseline = 'alphabetic';
  parts.forEach(([str, st], k) => {
    ctx.save(); ctx.translate(x, base); ctx.scale(sx, 1); ctx.font = font(size);
    ctx.strokeStyle = st.rim; ctx.lineWidth = 10; ctx.strokeText(str, 0, 0);
    ctx.strokeStyle = st.line; ctx.lineWidth = 6.5; ctx.strokeText(str, 0, 0);
    ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 2; ctx.strokeText(str, 0, 0);
    const cap = size * 0.72, g = ctx.createLinearGradient(0, -cap, 0, 0);
    st.fill.forEach((c, i) => g.addColorStop(i / (st.fill.length - 1), c));
    ctx.fillStyle = g; ctx.fillText(str, 0, 0);
    ctx.restore();
    x += widths[k] * sx + gap * sx;
  });
  ctx.restore();
}

function score(f) { return f.stats.kos - f.stats.falls; }
function tag(ctx, x, y, label, col, s = 1) {
  text(ctx, label, x, y - 12 * s, { size: 15 * s, align: 'center', color: col, stroke: '#000', strokeW: 3, font: BFONT });
  ctx.save(); ctx.fillStyle = col; ctx.strokeStyle = '#000'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(x - 7 * s, y - 8 * s); ctx.lineTo(x + 7 * s, y - 8 * s); ctx.lineTo(x, y + 1); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
}
const CONF_COLS = ['#e83030', '#30a0e8', '#f0d030', '#40c040', '#e070e0', '#f09030', '#ffffff'];
function newConfetto(initial) {
  return { x: Math.random() * 640, y: initial ? Math.random() * 480 : -10, vy: 0.6 + Math.random() * 1.2, a: Math.random() * 6, va: (Math.random() - 0.5) * 0.2, ph: Math.random() * 100, col: CONF_COLS[Math.floor(Math.random() * CONF_COLS.length)] };
}
