// Battle screen: runs a Match, draws it, handles pause, announcer, and the end-of-game transition.
import { Match } from '../../game/match.js';
import { GameView, RS } from '../../render/view.js';
import { Hud } from '../hud.js';
import { text } from '../draw.js';
import { CHARS } from '../../chars/index.js';
import { STAGES } from '../../stages/index.js';
import { CpuDriver } from '../../game/ai.js';
import { PORT_COLORS } from '../../game/constants.js';

// params: { players: [{char, color, port, cpu: {level}|null, team, handicap}], stage, rules, next(match) }
export class BattleScreen {
  constructor(app, params) {
    this.app = app; this.p = params; this.isGameplay = true;
  }
  enter() {
    const app = this.app, p = this.p;
    const players = p.players.map(pl => ({
      ...pl, def: CHARS[pl.char], controller: p.controllers?.[pl.port] ?? app.input.controllers[pl.port],
    }));
    const mcfg = { stage: STAGES[p.stage], players, rules: p.rules, noCountdown: p.noCountdown, suddenDeath: p.suddenDeath };
    this.match = p.makeMatch ? p.makeMatch(mcfg) : new Match(mcfg);
    this.match.mode = p.mode ?? 'vs';
    if (p.setup) p.setup(this.match);
    this.view = new GameView(app, this.match);
    this.hud = new Hud(this.match, this.view);
    // CPU drivers
    for (const f of this.match.fighters) {
      if (p.netplay) { app.input.cpuDrivers[f.port] = null; continue; }   // netplay: inputs come from the room
      if (f.cpu) app.input.cpuDrivers[f.port] = new CpuDriver(this.match, f).drive;
      else app.input.cpuDrivers[f.port] = null;
    }
    this.pausedBy = null;
    app.audio.music(STAGES[p.stage].music ?? 'battle');
    this.endTimer = 0;
    this.banner = null;
  }
  exit() { for (let i = 0; i < 4; i++) this.app.input.cpuDrivers[i] = null; this.view.dispose(); }
  update() {
    const app = this.app, m = this.match;
    // pause with START
    for (const f of m.fighters) {
      if (f.cpu) continue;
      if (f.ctrl.pressed('START') && m.phase === 'play') {
        if (this.pausedBy === null) { this.pausedBy = f.port; m.paused = true; app.audio.sfx('menuOk'); }
        else if (this.pausedBy === f.port) { this.pausedBy = null; m.paused = false; this.pauseCam = null; }
      }
    }
    if (m.paused) {
      const c = app.input.controllers[this.pausedBy];
      // A+B+Z+R held while paused resets the match (No Contest), like SSB64
      if (c && c.held('A') && c.held('B') && c.held('R') && c.held('Z')) { m.paused = false; this.finish(true); }
      // C buttons orbit / zoom the paused camera
      const pc = this.pauseCam ??= { t: 0, yaw: 0, pitch: 0.12, zoom: 1 };
      pc.t++;
      if (c) {
        if (c.held('CL')) pc.yaw = Math.max(-0.9, pc.yaw - 0.025); if (c.held('CR')) pc.yaw = Math.min(0.9, pc.yaw + 0.025);
        if (c.held('CU')) pc.pitch = Math.min(0.8, pc.pitch + 0.02); if (c.held('CD')) pc.pitch = Math.max(-0.3, pc.pitch - 0.02);
        if (c.held('L')) pc.zoom = Math.min(2.5, pc.zoom * 1.02);
      }
      return;
    }
    const steps = m.trainingSpeed ?? 1;
    m.events = [];
    if (steps >= 1) { for (let i = 0; i < steps; i++) m.update(); }
    else { this.slowAcc = (this.slowAcc ?? 0) + steps; if (this.slowAcc >= 1) { this.slowAcc -= 1; m.update(); } }
    this.handleEvents(m.events);
    if (this.p.onFrame) this.p.onFrame(m, this);
    if (m.phase === 'over' && !this.done) this.finish(false);
  }
  handleEvents(evs) {
    const a = this.app.audio, m = this.match;
    for (const e of evs) {
      switch (e.type) {
        case 'count': a.sfx('count'); a.say(String(e.n)); this.banner = { t: String(e.n), until: m.frame + 50 }; break;
        case 'go': a.sfx('go'); a.say('Go!', 1.0); this.banner = { t: 'GO!', until: m.frame + 45 }; break;
        case 'hit': a.sfx(e.element === 'fire' ? 'fire' : e.element === 'electric' ? 'elec' : e.element === 'slash' ? 'slash' : e.kb > 120 ? 'hitL' : e.dmg > 8 ? 'hitM' : 'hitS'); break;
        case 'shieldHit': a.sfx('shieldHit'); break;
        case 'shieldBreak': a.sfx('shieldBreak'); break;
        case 'ko': a.sfx('ko'); if (e.star) a.sfx('star'); break;
        case 'jump': a.sfx('jump'); break;
        case 'jump2': a.sfx('jump2'); break;
        case 'land': a.sfx('land'); break;
        case 'dash': a.sfx('dash'); break;
        case 'grab': a.sfx('grab'); break;
        case 'ledge': a.sfx('ledge'); break;
        case 'tech': a.sfx('tech'); break;
        case 'roll': a.sfx('roll'); break;
        case 'respawn': a.sfx('respawn'); break;
        case 'move': if (e.move?.sfx) a.sfx(e.move.sfx); else if (e.move?.hitboxes?.length && !e.move.hitboxes[0].grab) a.sfx(e.move.id?.includes('smash') ? 'whiffL' : 'whiff'); break;
        case 'sfx': a.sfx(e.name, e); break;
        case 'itemMusic': if (e.track) a.music(e.track); else a.music(STAGES[this.p.stage].music ?? 'battle'); break;
        case 'explosion': a.sfx('explode'); break;
        case 'game': a.say(e.reason === 'time' ? 'Time!' : 'Game set!', 0.9); a.sfx('go'); this.banner = { t: e.reason === 'time' ? 'TIME UP!' : 'GAME SET', until: m.frame + 9999 }; a.stopMusic(); break;
      }
    }
  }
  // pause camera: zoom in on the fighter who paused, orbit with the C buttons
  applyPauseCam() {
    const pc = this.pauseCam, cam = this.view.camera, f = this.match.fighters.find(x => x.port === this.pausedBy);
    if (!f || f.dead) return;
    const tx = f.x * RS, ty = (f.y + f.H * 0.55) * RS;
    const k = Math.min(1, pc.t / 18), e = k * k * (3 - 2 * k);
    pc.from ??= { x: cam.position.x, y: cam.position.y, z: cam.position.z, lx: this.view.cam.x * RS, ly: this.view.cam.y * RS };
    const d = f.H * RS * 3.2 / pc.zoom;
    const px = tx + Math.sin(pc.yaw) * Math.cos(pc.pitch) * d, py = ty + Math.sin(pc.pitch) * d, pz = Math.cos(pc.yaw) * Math.cos(pc.pitch) * d;
    const L = (a, b) => a + (b - a) * e;
    cam.position.set(L(pc.from.x, px), L(pc.from.y, py), L(pc.from.z, pz));
    cam.lookAt(L(pc.from.lx, tx), L(pc.from.ly, ty), 0);
  }
  finish(quit) {
    if (this.done) return; this.done = true;
    const m = this.match;
    if (this.p.next) this.p.next(m, { quit }); else this.app.go('results', { match: m, params: this.p, quit });
  }
  render(renderer, ctx) {
    this.view.sync();
    if (this.match.paused && this.pauseCam) this.applyPauseCam();
    this.view.render(renderer);
    if (!this.p.hideHud && !this.match.paused) this.hud.draw(ctx);
    const m = this.match;
    if (this.banner && m.frame < this.banner.until) {
      const t = this.banner.t, big = t.length <= 2;
      text(ctx, t, 320, big ? 280 : 270, { size: big ? 110 : 84, align: 'center', gradient: ['#fff8a0', '#ffb000', '#e04000'], stroke: '#200', strokeW: 8 });
    }
    if (m.paused) drawPause(ctx, this.pausedBy, m.fighters.find(f => f.port === this.pausedBy));
    if (this.p.overlay) this.p.overlay(ctx, m, this);
    if (this.app.params.has('hitboxes')) drawDebug(ctx, m, this.view);
  }
}

// Debug overlay: hurt capsules (yellow), hitboxes (red), grab boxes (purple), shields, ledges, collision
export function drawDebug(ctx, m, view) {
  const P = (x, y) => view.toScreen(x, y);
  const scale = (() => { const a = P(0, 0), b = P(100, 0); return Math.abs(b[0] - a[0]) / 100; })();
  ctx.save(); ctx.lineWidth = 1.5;
  for (const f of m.col.floors) { ctx.strokeStyle = f.pass ? '#0ff' : '#0f0'; ctx.beginPath(); f.pts.forEach((p, i) => { const [x, y] = P(p[0], p[1]); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.stroke(); }
  for (const w of m.col.walls) { ctx.strokeStyle = '#f80'; ctx.beginPath(); ctx.moveTo(...P(...w.a)); ctx.lineTo(...P(...w.b)); ctx.stroke(); }
  for (const c of m.col.ceils) { ctx.strokeStyle = '#f0f'; ctx.beginPath(); ctx.moveTo(...P(...c.a)); ctx.lineTo(...P(...c.b)); ctx.stroke(); }
  for (const L of m.ledges) { const [x, y] = P(L.x, L.y); ctx.fillStyle = '#fff'; ctx.fillRect(x - 3, y - 3, 6, 6); }
  for (const f of m.fighters) {
    if (f.dead) continue;
    const c = f.hurtCapsule();
    const [x1, y1] = P(c.x1, c.y1), [x2, y2] = P(c.x2, c.y2);
    ctx.strokeStyle = f.intangible > 0 ? '#4af' : f.invincible > 0 ? '#4f4' : '#ff0'; ctx.lineWidth = c.r * 2 * scale; ctx.globalAlpha = 0.35; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); ctx.globalAlpha = 1; ctx.lineWidth = 1.5;
    for (const h of f.activeHitboxes) { const [x, y] = P(h.x, h.y); ctx.fillStyle = h.hb.grab ? 'rgba(160,60,255,0.5)' : 'rgba(255,0,0,0.5)'; ctx.beginPath(); ctx.arc(x, y, h.r * scale, 0, Math.PI * 2); ctx.fill(); }
    const [fx, fy] = P(f.x, f.y); ctx.fillStyle = '#fff'; ctx.fillRect(fx - 2, fy - 2, 4, 4);
    ctx.font = '10px monospace'; ctx.fillText(`${f.state}${f.move ? ':' + f.move.id + ' ' + f.mf : ''} ${f.sf}`, fx - 30, fy + 14);
  }
  for (const p of m.projectiles) { const h = p.worldHitbox(); const [x, y] = P(h.x, h.y); ctx.strokeStyle = '#f00'; ctx.beginPath(); ctx.arc(x, y, h.r * scale, 0, Math.PI * 2); ctx.stroke(); }
  ctx.restore();
}

// SSB64 pause overlay: thin white frame, C-button camera badge, "1P PAUSE", "A+B+Z+R : RESET"
function drawPause(ctx, port, f) {
  ctx.save();
  ctx.strokeStyle = '#f8f8f8'; ctx.lineWidth = 3; ctx.strokeRect(40, 36, 552, 364);
  // camera badge
  ctx.beginPath(); ctx.arc(80, 74, 22, 0, Math.PI * 2); ctx.fillStyle = '#9a9aa2'; ctx.fill(); ctx.strokeStyle = '#333'; ctx.lineWidth = 2; ctx.stroke();
  ctx.beginPath(); ctx.arc(80, 74, 11, 0, Math.PI * 2); ctx.fillStyle = '#2a2a30'; ctx.fill();
  ctx.beginPath(); ctx.arc(80, 74, 5, 0, Math.PI * 2); ctx.fillStyle = '#8a8a90'; ctx.fill();
  ctx.fillStyle = '#e02020';
  for (let k = 0; k < 4; k++) { ctx.save(); ctx.translate(80, 74); ctx.rotate(k * Math.PI / 2); ctx.beginPath(); ctx.moveTo(0, -36); ctx.lineTo(-7, -27); ctx.lineTo(7, -27); ctx.closePath(); ctx.fill(); ctx.restore(); }
  ctx.restore();
  const lbl = f?.cpu ? 'CP' : (port + 1) + 'P';
  ctx.save(); ctx.fillStyle = '#f8f8f8'; ctx.beginPath(); ctx.moveTo(468, 384); ctx.lineTo(480, 391); ctx.lineTo(468, 398); ctx.closePath(); ctx.fill(); ctx.restore();
  text(ctx, lbl + ' PAUSE', 488, 398, { size: 20, color: '#f8f8f8', stroke: '#000', strokeW: 3, italic: false, weight: 700 });
  const btn = (x, l, col) => { ctx.save(); ctx.beginPath(); ctx.arc(x, 422, 9, 0, Math.PI * 2); ctx.fillStyle = col; ctx.fill(); ctx.restore(); text(ctx, l, x, 427, { size: 12, align: 'center', color: '#fff', italic: false, weight: 900 }); };
  btn(208, 'A', '#2850e0'); text(ctx, '+', 228, 428, { size: 16, align: 'center', color: '#bbb', italic: false });
  btn(248, 'B', '#20a040'); text(ctx, '+', 268, 428, { size: 16, align: 'center', color: '#bbb', italic: false });
  btn(288, 'Z', '#808080'); text(ctx, '+', 308, 428, { size: 16, align: 'center', color: '#bbb', italic: false });
  btn(328, 'R', '#808080');
  text(ctx, ': RESET', 344, 428, { size: 16, color: '#c8c8c8', stroke: '#000', strokeW: 3, italic: false, weight: 700 });
}
