// Training Mode (decomp sc1ptrainingmode.c; reference screens/training_menu.png, training_gameplay.png):
// one human + one CPU dummy, endless stocks, top overlay "DAMAGE / COMBO / ENEMY / SPEED / [item]",
// START opens the menu: CP (Stand / Walk / Evade / Jump / Attack), Item (spawns with A, max 4 on stage),
// Speed (1/1, 2/3, 1/2, 1/4 — dSC1PTrainingModeLagIntervals), View (Normal / Close-up), Reset, EXIT.
import { BattleScreen } from '../ui/screens/battle.js';
import { Match } from '../game/match.js';
import { GameView } from '../render/view.js';
import { Hud } from '../ui/hud.js';
import { MenuInput } from '../ui/menu.js';
import { text } from '../ui/draw.js';
import { CHARS } from '../chars/index.js';
import { STAGES } from '../stages/index.js';
import { CpuDriver } from '../game/ai.js';
import { exitTo } from './flow.js';
import { ROUND } from './ui.js';

const CP_MODES = [['Stand', 'stop', 'STAND'], ['Walk', 'walk', 'WALK'], ['Evade', 'evade', 'EVADE'], ['Jump', 'jump', 'JUMP'], ['Attack', 'normal', 'ATTACK']];
export const TRAINING_ITEMS = [['None', null], ['Maxim Tomato', 'maxim_tomato'], ['Heart', 'heart_container'], ['Star', 'star'], ['Beam Sword', 'beam_sword'],
  ['Home-Run Bat', 'home_run_bat'], ['Fan', 'fan'], ['Star Rod', 'star_rod'], ['Ray Gun', 'ray_gun'], ['Fire Flower', 'fire_flower'], ['Hammer', 'hammer'],
  ['Motion-Sensor Bomb', 'motion_sensor_bomb'], ['Bob-omb', 'bob_omb'], ['Bumper', 'bumper'], ['Green Shell', 'green_shell'], ['Red Shell', 'red_shell'], ['Poké Ball', 'poke_ball']];
const SPEEDS = [['1/1', 1], ['2/3', 2 / 3], ['1/2', 1 / 2], ['1/4', 1 / 4]];
const VIEWS = ['Normal', 'Close-up'];
const ROWS = ['cp', 'item', 'speed', 'view', 'reset', 'exit'];

export class TrainingScreen extends BattleScreen {
  enter() {
    const app = this.app, p = this.p;
    const list = (p.players?.length ? p.players : [{ char: 'mario', color: 0, port: 0 }, { char: 'mario', color: 1, port: 1, cpu: true }]).slice(0, 2);
    if (list.length < 2) list.push({ char: 'mario', color: 1, port: (list[0].port + 1) % 4, cpu: true });
    if (!list.some(x => x.cpu)) list[1] = { ...list[1], cpu: true };
    const players = list.map(pl => ({
      def: CHARS[pl.char] ?? CHARS.mario, char: pl.char, color: pl.color ?? 0, port: pl.port, team: pl.port, stocks: Infinity,
      cpu: pl.cpu ? { level: typeof pl.cpu === 'object' ? (pl.cpu.level ?? 3) : (pl.level ?? 3), mode: 'stop' } : null,
      controller: app.input.controllers[pl.port],
    }));
    const stage = STAGES[p.stage] ? p.stage : 'dreamland';
    this.match = new Match({ stage: STAGES[stage], players, rules: { mode: 'stock', stocks: Infinity, items: 'off' }, noCountdown: true });
    const m = this.match;
    m.mode = 'training';
    this.view = new GameView(app, m);
    this.hud = new Hud(m, this.view);
    this.human = m.fighters.find(f => !f.cpu);
    this.dummy = m.fighters.find(f => f.cpu);
    for (let i = 0; i < 4; i++) app.input.cpuDrivers[i] = null;
    this.driver = new CpuDriver(m, this.dummy);
    app.input.cpuDrivers[this.dummy.port] = this.driver.drive;
    this.spawns = m.fighters.map(f => ({ x: f.x, y: f.y, facing: f.facing }));
    this.opt = { cp: 0, item: 0, speed: 0, view: 0 };
    this.applyCP();
    this.menu = null; this.sel = 0;
    this.minp = new MenuInput(app);
    this.combo = { count: 0, dmg: 0, shown: 0, shownDmg: 0, wait: 0, stunned: false };
    this.itemWait = 0;
    this.pausedBy = null; this.banner = null;
    app.audio.music('training');
    // close-up view: wrap the camera update
    const v = this.view, orig = v.updateCamera.bind(v);
    v.updateCamera = () => {
      orig();
      if (this.opt.view !== 1) return;
      const f = this.human; if (f.dead) return;
      const RSc = 0.01, d = (f.a.closeup ?? 1600) * RSc + f.H * 3 * RSc;
      v.camera.position.set(f.x * RSc, (f.y + f.H * 0.6) * RSc + 0.4, d);
      v.camera.lookAt(f.x * RSc, (f.y + f.H * 0.5) * RSc, 0);
    };
  }
  applyCP() { this.driver.mode = CP_MODES[this.opt.cp][1]; if (this.opt.cp === 4) this.driver.lv = Math.max(3, this.driver.lv); }

  update() {
    const app = this.app, m = this.match;
    const c = this.human.ctrl;
    if (this.menu) { this.menuTick(); return; }
    if (c.pressed('START') && m.phase === 'play') { this.menu = true; m.paused = true; this.pausedBy = this.human.port; app.audio.sfx('menuOk'); return; }
    if (this.itemWait > 0) this.itemWait--;
    m.trainingSpeed = SPEEDS[this.opt.speed][1];
    const before = this.dummyStun();
    m.events = [];
    const steps = m.trainingSpeed;
    let ran = false;
    if (steps >= 1) { m.update(); ran = true; }
    else { this.slowAcc = (this.slowAcc ?? 0) + steps; if (this.slowAcc >= 1 - 1e-6) { this.slowAcc -= 1; m.update(); ran = true; } }
    if (ran) this.trackCombo(m.events, before);
    this.handleEvents(m.events);
    // KO'd fighters come back with 0% (endless stocks); keep the dummy's driver attached
    if (this.combo.wait > 0 && --this.combo.wait === 0) { this.combo.shown = 0; this.combo.shownDmg = 0; }
  }
  dummyStun() { const d = this.dummy; return !d.dead && (d.hitlag > 0 || d.hitstun > 0 && (d.state === 'hurt' || d.state === 'tumble') || d.state === 'grabbed' || d.state === 'thrown'); }
  // combo_count_foe: hits on the dummy while it is still in hitstun from the previous hit
  trackCombo(evs, wasStunned) {
    const C = this.combo;
    for (const e of evs) {
      if (e.type !== 'hit' || e.f !== this.dummy || e.blocked) continue;
      if (wasStunned && C.count > 0) { C.count++; C.dmg += e.dmg ?? 0; }
      else { C.count = 1; C.dmg = e.dmg ?? 0; }
      C.shown = Math.min(99, C.count); C.shownDmg = C.dmg; C.wait = 0;
      wasStunned = true;
    }
    if (!this.dummyStun() && C.count > 0 && !evs.some(e => e.type === 'hit' && e.f === this.dummy)) { C.count = 0; C.wait = 90; }
  }
  handleEvents(evs) { super.handleEvents(evs.filter(e => e.type !== 'game')); }

  menuTick() {
    const app = this.app, m = this.match;
    const i = this.minp.read(this.human.port);
    if (i.start) { this.menu = null; m.paused = false; this.pausedBy = null; app.audio.sfx('menuBack'); return; }
    if (i.up) { this.sel = (this.sel + ROWS.length - 1) % ROWS.length; app.audio.sfx('menuMove'); }
    if (i.down) { this.sel = (this.sel + 1) % ROWS.length; app.audio.sfx('menuMove'); }
    const row = ROWS[this.sel];
    const d = i.left ? -1 : i.right ? 1 : 0;
    if (d) {
      const n = { cp: CP_MODES.length, item: TRAINING_ITEMS.length, speed: SPEEDS.length, view: VIEWS.length }[row];
      if (n) { this.opt[row] = (this.opt[row] + d + n) % n; app.audio.sfx('menuMove'); if (row === 'cp') this.applyCP(); }
    }
    if (i.a) {
      if (row === 'item') this.spawnItem();
      else if (row === 'reset') { this.reset(); this.menu = null; m.paused = false; this.pausedBy = null; app.audio.sfx('menuOk'); }
      else if (row === 'exit') { app.audio.sfx('menuOk'); this.done = true; exitTo(app, 'training'); }
    }
  }
  spawnItem() {
    const m = this.match, kind = TRAINING_ITEMS[this.opt.item][1];
    if (!kind) return;
    const items = m.items;
    const count = (items.list ?? []).filter(it => !it.dead && !it.isExplosion).length;
    if (typeof items.spawn !== 'function' || count >= 4 || this.itemWait > 0) { this.app.audio.sfx('menuBack'); return; }
    const f = this.human;
    try { items.spawn(kind, f.x, f.y + 200, { vx: 0, vy: 30 }); this.app.audio.sfx('select'); this.itemWait = 8; }
    catch (e) { console.warn('training item', kind, e); this.app.audio.sfx('menuBack'); }
  }
  reset() {
    const m = this.match;
    m.fighters.forEach((f, i) => {
      const s = this.spawns[i];
      if (f.grabbing) f.releaseGrab?.();
      if (f.item) { m.items.remove?.(f.item); f.item = null; }
      f.dead = false; f.x = s.x; f.y = s.y; f.facing = s.facing; f.vx = f.vy = f.kbx = f.kby = 0; f.kbGround = 0;
      f.percent = 0; f.hitlag = 0; f.hitstun = 0; f.ledge = null; f.grabbedBy = null; f.grabbing = null;
      f.jumpsUsed = 0; f.special = {}; f.stale = [];
      m.snapToFloor(f); f.setState('idle');
    });
    for (const it of m.items.list ?? []) m.items.remove?.(it);
    m.projectiles = [];
    this.combo = { count: 0, dmg: 0, shown: 0, shownDmg: 0, wait: 0 };
  }

  render(renderer, ctx) {
    const m = this.match, paused = m.paused;
    m.paused = false;                       // the training menu replaces the generic PAUSE overlay
    super.render(renderer, ctx);
    m.paused = paused;
    this.drawOverlay(ctx);
    if (this.menu) this.drawMenu(ctx);
  }
  // top strip: DAMAGE / COMBO (left), ENEMY / SPEED and the held item (right)
  drawOverlay(ctx) {
    ctx.save(); ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fillRect(0, 6, 640, 58); ctx.restore();
    const st = { size: 19, italic: false, font: ROUND, weight: 700, strokeW: 4 };
    const pair = (label, value, x, y) => {
      text(ctx, label, x, y, { ...st, color: '#c8c0dc', stroke: '#1a1830' });
      ctx.save(); ctx.font = `700 19px ${ROUND}`; const w = ctx.measureText(label).width; ctx.restore();
      text(ctx, value, x + w + 6, y, { ...st, color: '#7cf06a', stroke: '#0e2a10' });
    };
    const V = (s, x, y, al = 'left') => text(ctx, s, x, y, { ...st, align: al, color: '#7cf06a', stroke: '#0e2a10' });
    pair('DAMAGE:', String(Math.floor(this.combo.shownDmg)).padStart(3, '0') + '%', 20, 32);
    pair('COMBO:', String(this.combo.shown).padStart(2, '0'), 20, 56);
    pair('ENEMY:', CP_MODES[this.opt.cp][2], 300, 32);
    pair('SPEED:', SPEEDS[this.opt.speed][0], 492, 32);
    const held = this.human.item;
    const name = held ? (TRAINING_ITEMS.find(t => t[1] === (held.id ?? held.kind ?? held.def?.id))?.[0] ?? String(held.id ?? 'ITEM')) : 'NONE';
    V(`[${name.toUpperCase()}]`, 618, 56, 'right');
  }
  drawMenu(ctx) {
    const x = 130, y = 84, w = 380, h = 316;
    ctx.save();
    ctx.fillStyle = 'rgba(70,120,200,0.62)'; ctx.fillRect(x, y, w, h);
    ctx.lineWidth = 6; ctx.strokeStyle = '#dcdce5'; ctx.strokeRect(x, y, w, h);
    ctx.lineWidth = 2; ctx.strokeStyle = '#8890a8'; ctx.strokeRect(x + 5, y + 5, w - 10, h - 10);
    ctx.restore();
    const vals = {
      cp: CP_MODES[this.opt.cp][0], item: TRAINING_ITEMS[this.opt.item][0], speed: SPEEDS[this.opt.speed][0], view: VIEWS[this.opt.view],
    };
    const labels = { cp: 'C P :', item: 'Item :', speed: 'Speed :', view: 'View :', reset: 'Reset', exit: 'E X I T' };
    ROWS.forEach((r, i) => {
      const ry = y + 52 + i * 46, on = i === this.sel;
      if (on) {
        ctx.save(); ctx.fillStyle = '#cb1518'; ctx.beginPath(); ctx.arc(x + 30, ry - 8, 10, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#ff7070'; ctx.beginPath(); ctx.arc(x + 27, ry - 11, 3.5, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#ff0000'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x + 20, ry + 6); ctx.lineTo(x + w - 20, ry + 6); ctx.stroke(); ctx.restore();
      }
      text(ctx, labels[r], x + 50, ry, { size: 24, color: '#f9ab6d', stroke: '#3a1800', strokeW: 3, shadow: 'rgba(0,0,0,0.6)', italic: false, font: ROUND, weight: 700 });
      if (vals[r] !== undefined) {
        const vx = x + 270;
        text(ctx, vals[r], vx, ry, { size: vals[r].length > 12 ? 17 : 22, align: 'center', color: '#fff', stroke: '#203050', strokeW: 3, italic: false, font: ROUND, weight: 700 });
        if (on) {
          for (const s of [-1, 1]) { ctx.save(); ctx.fillStyle = '#f9100e'; ctx.beginPath(); const ax = vx + s * 98; ctx.moveTo(ax + s * 8, ry - 8); ctx.lineTo(ax - s * 4, ry - 15); ctx.lineTo(ax - s * 4, ry - 1); ctx.closePath(); ctx.fill(); ctx.restore(); }
        }
      }
    });
    if (ROWS[this.sel] === 'item' && this.opt.item) text(ctx, 'A: drop item', x + w / 2, y + h - 10, { size: 13, align: 'center', color: '#e0e8ff', italic: false, font: ROUND });
  }
}
