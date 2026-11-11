// 1P mode screens: VS preview card, STAGE CLEAR / RESULT / GAME CLEAR tally, CONTINUE?, GAME OVER,
// WARNING / CHALLENGER APPROACHING, unlock message, ending + Congratulations, bonus practice result.
// Layouts follow reference/screens/1p_*.png, challenger_*.png and reference/frames/1p (REFERENCES.md §2.8).
import * as THREE from 'three';
import { MenuScreen, drawSmashEmblem } from '../ui/menu.js';
import { MenuFighter, drawScene } from '../ui/render3d.js';
import { text, FONT } from '../ui/draw.js';
import { P } from '../render/anims.js';
import { CHARS } from '../chars/index.js';
import { LADDER, CHAIN, UNLOCK_TEXT, DIFFICULTIES } from './data.js';
import { MasterHandView } from './masterhand.js';
import { stylePolygonObject, styleMetalObject } from './derived.js';
import { drawScore, drawBigTitle, drawStockHead, drawTargetIcon, drawPlatformIcon, makeHandScene, charName, SERIF, ROUND, hex } from './ui.js';
import { continueGame, gameOver, exitTo } from './flow.js';

const W = 640, H = 480;

// cached procedural backgrounds
const bgCache = new Map();
function cached(key, draw) {
  if (!bgCache.has(key)) { const c = document.createElement('canvas'); c.width = W; c.height = H; draw(c.getContext('2d')); bgCache.set(key, c); }
  return bgCache.get(key);
}
let sd = 1; const rnd = () => ((sd = (sd * 16807) % 2147483647) / 2147483647);
function woodBand(g, y, h) {
  g.fillStyle = '#2f1b14'; g.fillRect(0, y, W, h);
  sd = 5 + y;
  for (let i = 0; i < 70; i++) {
    const yy = y + rnd() * h, len = 60 + rnd() * 260, x = rnd() * W;
    g.strokeStyle = rnd() < 0.5 ? 'rgba(70,40,28,0.55)' : 'rgba(20,10,6,0.5)'; g.lineWidth = 1 + rnd() * 2;
    g.beginPath(); g.moveTo(x, yy); g.bezierCurveTo(x + len * 0.3, yy + (rnd() - 0.5) * 6, x + len * 0.6, yy + (rnd() - 0.5) * 6, x + len, yy + (rnd() - 0.5) * 4); g.stroke();
  }
  // faint carved sun/emblem shapes like the 1P card art
  g.strokeStyle = 'rgba(80,50,36,0.5)'; g.lineWidth = 3;
  for (let i = 0; i < 3; i++) { const cx = 60 + i * 260 + rnd() * 60, cy = y + h * 0.6; g.beginPath(); g.arc(cx, cy, 26, 0, Math.PI * 2); g.stroke(); for (let k = 0; k < 10; k++) { const a = k / 10 * Math.PI * 2; g.beginPath(); g.moveTo(cx + Math.cos(a) * 30, cy + Math.sin(a) * 30); g.lineTo(cx + Math.cos(a) * 42, cy + Math.sin(a) * 42); g.stroke(); } }
}
function cardBackground() {
  return cached('card', g => {
    woodBand(g, 0, 118); woodBand(g, 362, 118);
    const sky = g.createLinearGradient(0, 118, 0, 362); sky.addColorStop(0, '#8ec6dc'); sky.addColorStop(1, '#dcebf0');
    g.fillStyle = sky; g.fillRect(0, 118, W, 244);
    sd = 77;
    for (let i = 0; i < 26; i++) {
      const x = rnd() * W, y = 130 + rnd() * 220, r = 18 + rnd() * 46;
      g.fillStyle = `rgba(255,255,255,${0.35 + rnd() * 0.4})`;
      for (let k = 0; k < 4; k++) { g.beginPath(); g.ellipse(x + (rnd() - 0.5) * r * 1.6, y + (rnd() - 0.5) * r * 0.4, r, r * 0.45, 0, 0, Math.PI * 2); g.fill(); }
    }
    g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillRect(0, 116, W, 3); g.fillRect(0, 361, W, 3);
  });
}

// a model for cards: base character restyled for derived fighters
function cardModel(id, color, o = {}) {
  const base = id === 'giantdk' ? 'dk' : id === 'metalmario' ? 'mario' : id;
  const mf = new MenuFighter(base, color ?? 0, { yaw: o.yaw ?? 0.5 });
  if (id === 'metalmario') styleMetalObject(mf.root);
  if (o.polygon) stylePolygonObject(mf.root, o.seed ?? 3);
  mf.id = id;
  return mf;
}
function poseAction(mf, t, kind) {
  const moves = kind === 'player' ? ['fsmash', 'fair', 'usmash'] : ['ftilt', 'fsmash', 'dashattack'];
  for (const id of moves) if (mf.def.moves?.[id]) { mf.move(id, Math.min(18, 8 + Math.floor(t / 6))); return; }
  mf.victory(t);
}

// ------------------------------------------------------------------------------------------- VS card
export class CardScreen extends MenuScreen {
  enter() {
    const { run, plan } = this.p;
    this.run = run; this.plan = plan;
    this.spec = plan.spec;
    const k = plan.kind;
    this.bonus = k === 'btt' || k === 'btp' || k === 'race';
    this.me = cardModel(run.char, run.color, { yaw: 0.55 });
    this.left = plan.allies.map(a => cardModel(a.char, a.color, { yaw: 0.6 }));
    this.right = [];
    if (k === 'team') {
      const seen = plan.queue.slice(0, 3);
      seen.forEach((e, i) => this.right.push(cardModel(e.char === 'kirby' ? 'kirby' : e.char, e.polygon ? 0 : e.color, { yaw: -0.6, polygon: e.polygon, seed: i + 2 })));
    } else if (k === 'boss') this.hand = makeHandScene(MasterHandView);
    else if (!this.bonus) for (const e of plan.enemies) this.right.push(cardModel(e.char, e.color, { yaw: -0.55 }));
    const meName = CHARS[run.char].name;
    const allyNames = plan.allies.map(a => CHARS[a.char].name);
    const opp = this.spec.name ?? '';
    const count = this.spec.count ? ` [vs.${this.spec.count}]` : '';
    this.caption = this.bonus ? this.spec.caption : `${[meName, ...allyNames].join(' · ')}  VS  ${opp}${count}`;
    this.app.audio.music('p1card');
    this.t = 0;
  }
  exit() { for (const m of [this.me, ...this.left, ...this.right]) m?.dispose?.(); this.hand?.view.dispose(); }
  tick(i) {
    if (this.t === 40) this.app.audio.say(this.bonus ? this.spec.say : `${CHARS[this.run.char].name} versus ${this.spec.name}`, 0.85);
    if (this.t > 60 && (i.a || i.start)) this.next();
    if (this.t > 260) this.next();
  }
  next() { if (this.went) return; this.went = true; this.app.go('p1battle', { run: this.run, plan: this.plan }); }
  draw(ctx) {
    const t = this.t;
    ctx.drawImage(cardBackground(), 0, 0);
    // models (middle band)
    ctx.save(); ctx.beginPath(); ctx.rect(0, 119, W, 242); ctx.clip();
    const slide = Math.max(0, 1 - t / 18);
    for (const [i, m] of this.left.entries()) { poseAction(m, t, 'ally'); m.draw(ctx, 30 + i * 90, 110, 230, 230, 'full', { margin: 1.0, fov: 30 }); }
    poseAction(this.me, t, 'player');
    this.me.draw(ctx, -30 - slide * 300, 104, 330, 300, 'full', { margin: 0.95, fov: 30, dy: 0 });
    if (this.hand) {
      const hs = this.hand; hs.fake.pose.curl = 0.25 + Math.sin(t / 15) * 0.1; hs.view.update({});
      drawScene(ctx, hs.scene, hs.camera, 330 + slide * 400, 110, 330, 260);
    }
    const n = this.right.length;
    for (const [i, m] of this.right.entries()) {
      poseAction(m, t + i * 5, 'enemy');
      const w = n > 1 ? 250 : 330, x = W - w + 10 - i * (n > 2 ? 85 : 120) + slide * 400;
      m.draw(ctx, x, 110 + (n > 1 ? i * 8 : 0), w, n > 1 ? 260 : 300, 'full', { margin: n > 1 ? 1.05 : 0.95, fov: 30 });
    }
    ctx.restore();
    if (this.left.length) text(ctx, '←Ally', 250, 150, { size: 20, color: '#f43033', stroke: '#fff', strokeW: 3, italic: false, font: ROUND, weight: 700 });
    if (!this.bonus) {
      const s = 1 + Math.max(0, 1 - t / 10) * 0.6;
      ctx.save(); ctx.translate(320, 285); ctx.scale(s, s);
      text(ctx, 'VS', 0, 0, { size: 96, align: 'center', gradient: ['#fffbd0', '#f7eea7', '#d8b840', '#a07a10'], stroke: '#2a1a00', strokeW: 8, italic: true });
      ctx.restore();
    }
    // top band: stage label + ladder chain
    const lbl = this.spec.label.replace(/Stage(\d)/, 'Stage $1').replace('Bonus Stage', 'Bonus Stage ');
    text(ctx, lbl, 30, 92, { size: lbl.length > 8 ? 26 : 40, color: '#fff', stroke: '#1a0c08', strokeW: 5, italic: true, font: FONT, scaleX: lbl.length > 8 ? 0.82 : 1 });
    this.drawChain(ctx);
    // bottom caption
    text(ctx, this.caption, 320, 432, { size: 26, align: 'center', color: '#fff', stroke: '#1a0c08', strokeW: 4, italic: false, font: ROUND, weight: 700 });
  }
  drawChain(ctx) {
    const idx = this.plan.idx ?? 0;
    const n = CHAIN.length, x0 = 210, x1 = 612;
    const ys = [74, 62, 54, 62, 50, 42, 50, 60, 48, 40, 50, 58, 46, 40];
    const pts = CHAIN.map((_, i) => [x0 + (x1 - x0) * i / (n - 1), ys[i] ?? 50]);
    ctx.save(); ctx.strokeStyle = '#6a4a3a'; ctx.lineWidth = 3; ctx.beginPath(); pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y + 26) : ctx.moveTo(x, y + 26)); ctx.stroke(); ctx.restore();
    CHAIN.forEach((c, i) => {
      const [x, y] = pts[i], lit = i === idx;
      ctx.save(); ctx.fillStyle = lit ? '#e8d8b0' : '#7a6658'; ctx.beginPath(); ctx.ellipse(x, y + 26, 11, 4, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      ctx.save(); ctx.globalAlpha = lit ? 1 : 0.55;
      if (c === 'bonus') { ctx.fillStyle = '#7a6658'; ctx.fillRect(x - 1, y + 6, 2, 18); drawTargetIcon(ctx, x, y + 4, 7); }
      else if (c === 'masterhand') { ctx.fillStyle = lit ? '#ffffff' : '#a89888'; ctx.beginPath(); ctx.arc(x, y + 8, 13, 0, Math.PI * 2); ctx.fill(); drawSmashEmblem(ctx, x, y + 8, 11, '#a03a20'); }
      else { const def = CHARS[c === 'polygon' ? 'mario' : c]; ctx.fillStyle = '#5a4a40'; ctx.fillRect(x - 3, y + 12, 6, 12); drawStockHead(ctx, def, 0, x, y + 6, 9, 1, c === 'polygon'); if (!lit) { ctx.fillStyle = 'rgba(120,110,100,0.6)'; ctx.beginPath(); ctx.arc(x, y + 6, 9, 0, Math.PI * 2); ctx.fill(); } }
      ctx.restore();
      if (lit) { ctx.save(); ctx.strokeStyle = '#ffe080'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y + 8, 15, 0, Math.PI * 2); ctx.stroke(); ctx.restore(); }
    });
  }
}

// ------------------------------------------------------------------------------------------- tally
// Decomp timing (sc1pstageclear.c): lines appear at tic 10/20/60 (timer) and 30/40/100 (damage); special
// bonuses one row per 10 tics; score digits count up.
export class TallyScreen extends MenuScreen {
  enter() {
    const { run, tally, snapshot, plan } = this.p;
    this.run = run; this.tl = tally; this.snap = snapshot;
    this.title = plan.kind === 'boss' ? 'GAME CLEAR' : (plan.kind === 'btt' || plan.kind === 'btp' || plan.kind === 'race') ? 'RESULT' : 'STAGE CLEAR';
    this.before = run.score + tally.koScore;
    run.score = Math.max(0, run.score + tally.total);
    this.shown = this.before;
    this.events = [];
    let t = 10;
    this.lineT = tally.lines.map(l => {
      const o = { l, show: t, mul: t + 14, add: t + 40 + (l.icons ? l.icons * 6 : 0) };
      t = o.add + 12; return o;
    });
    this.bonusStart = t + 20;
    this.bonusT = tally.bonuses.map((b, i) => ({ b, show: this.bonusStart + 16 + i * 10 }));
    this.endT = (this.bonusT.length ? this.bonusT[this.bonusT.length - 1].show : t) + 30;
    this.app.audio.music(plan.kind === 'boss' ? 'victory' : 'stageclear');
  }
  tick(i) {
    const t = this.t;
    for (const o of this.lineT) if (t === o.add) { this.shown += o.l.value; this.app.audio.sfx('menuOk'); }
    for (const o of this.bonusT) if (t === o.show) { this.shown += o.b.pts; this.app.audio.sfx('select'); }
    for (const o of this.lineT) if (o.l.icons && t > o.mul && t < o.add && (t - o.mul) % 6 === 0) this.app.audio.sfx('target');
    if (i.a || i.start) {
      if (t < this.endT) { this.t = this.endT; this.shown = this.run.score; }
      else return this.done();
    }
    if (t > this.endT + 300) this.done();
  }
  done() { if (this.went) return; this.went = true; this.p.onDone?.(); }
  draw(ctx) {
    const t = this.t;
    if (this.snap) ctx.drawImage(this.snap, 0, 0); else { ctx.fillStyle = '#101018'; ctx.fillRect(0, 0, W, H); }
    ctx.fillStyle = `rgba(0,0,0,${Math.min(0.55, t / 30)})`; ctx.fillRect(0, 0, W, H);
    if (this.title === 'RESULT') { ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(50, 34, 540, 58); }
    drawBigTitle(ctx, this.title);
    const page2 = t >= this.bonusStart && this.bonusT.length;
    if (!page2 && this.lineT.length) {
      text(ctx, '-BONUS-', 320, 138, { size: 18, align: 'center', color: '#ff5a30', italic: false, font: ROUND, weight: 700, scaleX: 1.3 });
      this.lineT.forEach((o, i) => {
        if (t < o.show) return;
        const y = 200 + i * 62, l = o.l;
        text(ctx, l.label, 84, y, { size: 30, color: '#fff', stroke: '#222', strokeW: 3, italic: false, font: SERIF, weight: 700 });
        text(ctx, ':', 236, y, { size: 30, color: '#fff', italic: false, font: SERIF });
        if (l.icons !== undefined) {
          const n = Math.min(l.icons, Math.max(0, Math.floor((t - o.mul) / 6) + 1));
          for (let k = 0; k < n; k++) drawTargetIcon(ctx, 270 + k * 30, y - 10, 13);
          if (t >= o.add && l.value) text(ctx, String(l.value), 590, y + 40, { size: 22, align: 'right', color: '#fff', italic: false, font: SERIF });
        } else if (t < o.add) {
          text(ctx, String(l.a), 330, y, { size: 30, align: 'right', color: '#fff', italic: false, font: SERIF });
          if (t >= o.mul) text(ctx, `× ${l.mul}`, 350, y, { size: 30, color: '#fff', italic: false, font: SERIF });
        } else text(ctx, String(l.value), 400, y, { size: 30, align: 'right', color: '#fff', italic: false, font: SERIF });
      });
    }
    if (page2) {
      ctx.save(); ctx.fillStyle = 'rgba(10,10,14,0.7)'; ctx.fillRect(96, 116, 448, 270); ctx.strokeStyle = '#7d7c79'; ctx.lineWidth = 3; ctx.strokeRect(96, 116, 448, 270); ctx.restore();
      text(ctx, '-SPECIAL BONUS-', 320, 146, { size: 17, align: 'center', color: '#e8e070', italic: false, font: ROUND, weight: 700, scaleX: 1.3 });
      const rows = this.bonusT.filter(o => t >= o.show);
      const per = 10, page = Math.floor(Math.max(0, rows.length - 1) / per);
      rows.slice(page * per, page * per + per).forEach((o, i) => {
        const y = 178 + i * 21, b = o.b;
        const red = ['stageClear', 'noMissClear', 'noDamageClear', 'speedKing', 'speedDemon'].includes(b.key);
        text(ctx, b.name, 150, y, { size: 17, color: red ? '#ff3030' : '#f0e858', italic: false, font: ROUND, weight: 700 });
        if (b.key === 'noMiss' && b.mul > 1) text(ctx, `× ${b.mul}`, 260, y, { size: 16, color: '#f0e858', italic: false, font: ROUND });
        text(ctx, ':', 372, y, { size: 17, color: '#f0e858', italic: false, font: ROUND });
        text(ctx, String(b.pts), 500, y, { size: 18, align: 'right', color: '#fff', italic: false, font: ROUND, weight: 700 });
      });
    }
    drawScore(ctx, this.shown);
  }
}

// ------------------------------------------------------------------------------------------- continue / game over
export class ContinueScreen extends MenuScreen {
  enter() {
    this.run = this.p.run; this.sel = 0;
    this.mf = new MenuFighter(this.run.char, this.run.color, { yaw: 0.2 });
    this.mf.setPose(P.lying);
    this.app.audio.music('continue');
  }
  exit() { this.mf?.dispose(); }
  tick(i) {
    if (i.left || i.right) { this.sel ^= 1; this.app.audio.sfx('menuMove'); }
    if ((i.a || i.start) && this.t > 30) {
      this.confirm(() => this.sel === 0 ? continueGame(this.app, this.run) : gameOver(this.app, this.run));
    }
  }
  draw(ctx) {
    const bg = ctx.createRadialGradient(320, 330, 20, 320, 330, 330); bg.addColorStop(0, '#2c4a9a'); bg.addColorStop(0.5, '#132652'); bg.addColorStop(1, '#03060f');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
    // floor boards
    ctx.save(); ctx.globalAlpha = 0.35; ctx.strokeStyle = '#6a8ad0';
    for (let i = 0; i < 12; i++) { ctx.beginPath(); ctx.moveTo(0, 300 + i * 16); ctx.lineTo(W, 290 + i * 18); ctx.stroke(); }
    ctx.restore();
    // spotlight cone
    const sp = ctx.createLinearGradient(320, 0, 320, 400); sp.addColorStop(0, 'rgba(255,255,255,0.0)'); sp.addColorStop(1, 'rgba(200,220,255,0.18)');
    ctx.fillStyle = sp; ctx.beginPath(); ctx.moveTo(260, 0); ctx.lineTo(380, 0); ctx.lineTo(520, 400); ctx.lineTo(120, 400); ctx.closePath(); ctx.fill();
    this.mf.camera.fov = 30;
    this.mf.draw(ctx, 140, 220, 360, 220, 'full', { margin: 1.0, fov: 32, pitch: 0.5 });
    text(ctx, 'CONTINUE?', 320, 150, { size: 64, align: 'center', color: '#fff', stroke: '#111', strokeW: 6, italic: false, font: ROUND, weight: 700 });
    const opt = (s, x, on) => {
      if (on) { ctx.save(); ctx.strokeStyle = '#e02020'; ctx.lineWidth = 4; ctx.strokeRect(x - 66, 214, 132, 64); ctx.restore(); }
      text(ctx, s, x, 266, { size: 50, align: 'center', color: on ? '#e82020' : '#9a9aa0', stroke: on ? '#400' : '#222', strokeW: 4, italic: false, font: ROUND, weight: 700 });
    };
    opt('YES', 220, this.sel === 0); opt('NO', 420, this.sel === 1);
    drawScore(ctx, this.run.score);
  }
}

export class GameOverScreen extends MenuScreen {
  enter() { this.app.audio.music('gameover'); this.app.audio.say('Game over', 0.8); }
  tick(i) { if ((i.a || i.start) && this.t > 60 || this.t > 420) { if (!this.went) { this.went = true; exitTo(this.app); } } }
  draw(ctx) {
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
    const k = Math.min(1, this.t / 40);
    ctx.save(); ctx.globalAlpha = k;
    text(ctx, 'GAME OVER', 320, 170, { size: 86, align: 'center', gradient: ['#ffffff', '#a8b4ff', '#3a44c0', '#e8ecff'], stroke: '#10104a', strokeW: 6, italic: false, font: ROUND, weight: 700 });
    ctx.restore();
    drawScore(ctx, this.p.run.score);
  }
}

// ------------------------------------------------------------------------------------------- challenger
export class ChallengerScreen extends MenuScreen {
  enter() {
    const who = this.p.who;
    this.mf = new MenuFighter(who, 0, { yaw: 0.3 });
    const sil = new THREE.MeshBasicMaterial({ color: 0x0a1030 });
    this.mf.root.traverse(o => { if (o.isMesh) o.material = sil; });
    this.mf.victory(0);
    this.app.audio.stopMusic();
    this.app.audio.music('challenger');
  }
  exit() { this.mf?.dispose(); }
  tick(i) {
    if (this.t % 40 === 1 && this.t < 200) this.app.audio.sfx('warn');
    if (this.t === 30) this.app.audio.say('Warning! Challenger approaching!', 0.9);
    if ((this.t > 90 && (i.a || i.start)) || this.t > 300) { if (!this.went) { this.went = true; this.p.onDone(); } }
  }
  draw(ctx) {
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
    const blink = Math.floor(this.t / 20) % 2 === 0 || this.t > 160;
    // "!" disc
    ctx.save(); ctx.fillStyle = '#ffd21a'; ctx.strokeStyle = '#e8401a'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(320, 80, 34, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.restore();
    text(ctx, '!', 320, 104, { size: 60, align: 'center', color: '#e8401a', italic: false, font: FONT });
    if (blink) text(ctx, 'WARNING', 320, 168, { size: 50, align: 'center', color: '#e8132a', italic: false, font: ROUND, weight: 700, scaleX: 1.15 });
    text(ctx, 'CHALLENGER', 112, 270, { size: 28, color: '#f0a020', italic: false, font: ROUND, weight: 700, scaleX: 1.15 });
    text(ctx, 'APPROACHING', 112, 314, { size: 28, color: '#f0a020', italic: false, font: ROUND, weight: 700, scaleX: 1.15 });
    ctx.fillStyle = '#16207a'; ctx.fillRect(414, 182, 162, 252);
    this.mf.draw(ctx, 414, 190, 162, 240, 'full', { margin: 1.1, clear: null });
  }
}

// ------------------------------------------------------------------------------------------- unlock message
export class UnlockScreen extends MenuScreen {
  enter() { this.app.audio.music('victory'); this.app.audio.sfx('select'); }
  tick(i) { if (this.t > 40 && (i.a || i.start)) { if (!this.went) { this.went = true; this.p.onDone?.(); } } }
  draw(ctx) {
    ctx.fillStyle = '#0c0f54'; ctx.fillRect(0, 0, W, H);
    // collage of SMASH lettering and tiles, blue tinted
    ctx.save(); ctx.globalAlpha = 0.5; ctx.fillStyle = '#2a3290';
    ctx.font = `900 120px ${FONT}`; ctx.fillText('SMASH', 10, 330);
    const tiles = [['S', 340, 20], ['M', 440, 20], ['A', 530, 20], ['R', 380, 110], ['O', 470, 110], ['T', 560, 110], ['S', 420, 200], ['!', 600, 260], ['N.', 560, 420]];
    ctx.font = `900 64px ${FONT}`; for (const [c, x, y] of tiles) { ctx.fillStyle = '#1a2070'; ctx.fillRect(x - 6, y, 84, 84); ctx.fillStyle = '#3a42a8'; ctx.fillText(c, x + 6, y + 66); }
    ctx.restore();
    ctx.save(); ctx.fillStyle = '#ffd21a'; ctx.strokeStyle = '#e8401a'; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(328, 150, 36, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.restore();
    text(ctx, '!', 328, 174, { size: 60, align: 'center', color: '#202020', italic: false, font: FONT });
    const msg = UNLOCK_TEXT[this.p.id] ?? 'New feature unlocked!';
    const parts = msg.split(', ');
    const lines = parts.length > 1 ? [parts[0] + ',', parts.slice(1).join(', ')] : [msg];
    lines.forEach((l, i) => text(ctx, l, 330, 248 + i * 34, { size: 25, align: 'center', color: '#fff', italic: false, font: ROUND, weight: 500 }));
  }
}

// ------------------------------------------------------------------------------------------- ending
// Toy-room desk: the character as a doll; the glove comes down and picks it up. Then Congratulations.
export class ClearScreen extends MenuScreen {
  enter() {
    const run = this.p.run;
    this.mf = new MenuFighter(run.char, run.color, { yaw: 0.4 });
    this.mf.setPose(P.idle);
    this.hand = makeHandScene(MasterHandView);
    this.app.audio.music('ending');
  }
  exit() { this.mf?.dispose(); this.hand?.view.dispose(); }
  tick(i) {
    if (this.t === 30) this.app.audio.say('Congratulations!', 0.85);
    if ((this.t > 120 && (i.a || i.start)) || this.t > 900) {
      if (this.t < 420) { this.t = 420; return; }
      if (!this.went) { this.went = true; this.p.onDone?.(); }
    }
  }
  draw(ctx) {
    const t = this.t;
    if (t < 420) {
      // warm toy room
      const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#5a3a20'); g.addColorStop(0.62, '#8a6038'); g.addColorStop(0.63, '#a8784a'); g.addColorStop(1, '#6a4424');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = 'rgba(255,240,200,0.25)'; ctx.beginPath(); ctx.ellipse(400, 120, 160, 90, 0, 0, Math.PI * 2); ctx.fill();   // window light
      ctx.fillStyle = '#4a2c14'; for (let x = 0; x < W; x += 64) ctx.fillRect(x, 298, 3, 182);
      const lift = Math.max(0, (t - 220) / 120);
      this.mf.draw(ctx, 230, 210 - lift * 300, 180, 150, 'full', { margin: 1.05, fov: 30 });
      const hs = this.hand, k = Math.min(1, t / 200);
      hs.fake.pose = { kind: 'open', curl: t > 200 ? Math.min(0.8, (t - 200) / 20) : 0.1, tilt: 0.3, roll: 0.9, yaw: 0.2 };
      hs.view.update({});
      drawScene(ctx, hs.scene, hs.camera, 250, -240 + k * 290 - lift * 300, 240, 240);
      text(ctx, 'GAME CLEAR', 320, 440, { size: 30, align: 'center', color: '#fff2c0', stroke: '#3a2000', strokeW: 4, italic: false, font: ROUND, weight: 700 });
      if (t > 380) { ctx.fillStyle = `rgba(255,255,255,${(t - 380) / 40})`; ctx.fillRect(0, 0, W, H); }
      return;
    }
    // Congratulations card
    const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#2a7ad0'); g.addColorStop(1, '#bfe4ff');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    this.mf.victory(t);
    this.mf.draw(ctx, 140, 110, 360, 340, 'full', { margin: 1.0, fov: 30 });
    ctx.save(); ctx.fillStyle = '#fff'; ctx.strokeStyle = '#c02020'; ctx.lineWidth = 4; ctx.fillRect(460, 60, 120, 80); ctx.strokeRect(460, 60, 120, 80); ctx.restore();
    text(ctx, 'No1!', 520, 116, { size: 40, align: 'center', color: '#d02020', italic: true, font: FONT });
    text(ctx, 'Congratulations!', 320, 70, { size: 40, align: 'center', color: '#fff', stroke: '#103060', strokeW: 6, italic: true, font: FONT });
    text(ctx, 'You are great!', 320, 455, { size: 34, align: 'center', color: '#ffe040', stroke: '#503000', strokeW: 5, italic: true, font: FONT });
    drawScore(ctx, this.p.run.score, 600, 420, 24);
  }
}

// ------------------------------------------------------------------------------------------- bonus practice result
export class BonusResultScreen extends MenuScreen {
  enter() { this.app.audio.music(this.p.count >= 10 ? 'victory' : 'results'); }
  tick(i) { if (this.t > 40 && (i.a || i.start)) { if (!this.went) { this.went = true; this.p.onDone?.(); } } }
  draw(ctx) {
    const { kind, count, frames, newRecord, run } = this.p;
    ctx.fillStyle = '#0a0e2c'; ctx.fillRect(0, 0, W, H);
    ctx.save(); ctx.strokeStyle = 'rgba(80,100,200,0.25)'; for (let x = 0; x < W; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); } for (let y = 0; y < H; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); } ctx.restore();
    drawBigTitle(ctx, count >= 10 ? 'COMPLETE!' : 'FAILURE', 90, 58);
    text(ctx, kind === 'btt' ? 'Break the Targets' : 'Board the Platforms', 320, 140, { size: 22, align: 'center', color: '#e8e070', italic: false, font: ROUND, weight: 700 });
    text(ctx, CHARS[run.char].name, 320, 172, { size: 20, align: 'center', color: '#fff', italic: false, font: ROUND });
    for (let k = 0; k < 10; k++) {
      const x = 140 + k * 40, y = 230;
      ctx.save(); ctx.globalAlpha = k < count ? 1 : 0.2;
      (kind === 'btt' ? drawTargetIcon : drawPlatformIcon)(ctx, x, y, 14);
      ctx.restore();
    }
    text(ctx, `${String(count).padStart(2, '0')} ${kind === 'btt' ? 'TARGETS' : 'PLATFORMS'}`, 320, 290, { size: 30, align: 'center', color: '#fff', italic: false, font: ROUND, weight: 700 });
    text(ctx, 'TIME  ' + fmtTime(frames), 320, 340, { size: 30, align: 'center', color: '#fff', italic: false, font: ROUND, weight: 700 });
    const rec = this.app.save?.data?.records?.[kind]?.[run.char];
    if (rec) text(ctx, 'BEST  ' + (rec.time != null ? fmtTime(rec.time) : `${String(rec.count ?? 0).padStart(2, '0')} ${kind === 'btt' ? 'TARGETS' : 'PLATFORMS'}`), 320, 384, { size: 22, align: 'center', color: '#a8c8ff', italic: false, font: ROUND, weight: 700 });
    if (newRecord && Math.floor(this.t / 15) % 2 === 0) text(ctx, 'NEW RECORD!', 320, 430, { size: 32, align: 'center', gradient: ['#fffbd0', '#ffd040', '#ff7a10'], stroke: '#401000', strokeW: 4 });
  }
}
export function fmtTime(frames) {
  const cs = Math.floor(frames / 60 * 100);
  const m = Math.floor(cs / 6000), s = Math.floor(cs / 100) % 60, c = cs % 100;
  return `${m}:${String(s).padStart(2, '0')}"${String(c).padStart(2, '0')}`;
}
