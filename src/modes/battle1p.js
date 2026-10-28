// 1P battle screen: a BattleScreen subclass that runs a StageLogic (ladder stage, bonus stage, challenger or
// bonus practice), draws the 1P HUD extras (timer, team stock row, target/platform icons, Master Hand H.P,
// Race countdown) and hands the result to the 1P flow.
import * as THREE from 'three';
import { BattleScreen } from '../ui/screens/battle.js';
import { Match } from '../game/match.js';
import { GameView, FighterView, RS } from '../render/view.js';
import { Hud, percentColor } from '../ui/hud.js';
import { text } from '../ui/draw.js';
import { STAGES } from '../stages/index.js';
import { CpuDriver } from '../game/ai.js';
import { CHARS } from '../chars/index.js';
import { PORT_COLORS } from '../game/constants.js';
import { StageLogic } from './logic.js';
import { MasterHandView } from './masterhand.js';
import { stylePolygonView } from './derived.js';
import { afterBattle } from './flow.js';
import { snapshotCanvas, drawStockHead, drawTargetIcon, drawPlatformIcon, drawHandIcon, TIMER_FONT } from './ui.js';

export class OnePBattleScreen extends BattleScreen {
  enter() {
    const app = this.app, p = this.p, plan = p.plan;
    this.kind = plan.kind;
    this.logic = new StageLogic({ run: p.run, plan, ctrl: port => app.input.controllers[port], stageDefs: STAGES, practice: p.practice });
    const players = this.logic.players();
    this.noCount = this.kind === 'race' || this.kind === 'boss';
    this.match = new Match({ stage: STAGES[plan.stage], players, rules: this.logic.rules(), noCountdown: this.kind === 'boss' });
    const m = this.match;
    if (this.kind === 'race') m.countdown = 60;
    m.mode = '1p';
    this.view = new GameView(app, m);
    this.logic.attach(m);
    if (this.kind === 'race' || this.kind === 'boss') this.logic.player.setState('idle');
    this.hud = new Hud(m, this.view);
    this.drivers = new Map();
    for (let i = 0; i < 4; i++) app.input.cpuDrivers[i] = null;
    m.fighters.forEach((f, i) => this.setupFighter(f, i));
    this.logic.onSpawn = (slot, f, old) => {
      const v = this.view;
      v.fviews[slot]?.dispose(v.scene);
      v.fviews[slot] = new FighterView(v.scene, f);
      this.setupFighter(f, slot);
    };
    if (this.logic.boss) {
      this.mhView = new MasterHandView(this.view.scene, this.logic.boss);
      this.lockPlayer = true;
    }
    this.makeObjectiveViews();
    if (this.kind === 'race') this.followCamera();
    this.pausedBy = null; this.endTimer = 0; this.banner = null;
    const music = this.kind === 'btt' || this.kind === 'btp' || this.kind === 'race' ? 'bonus' : (STAGES[plan.stage].music ?? 'battle');
    if (this.kind !== 'boss') app.audio.music(music);
    this.musicName = music;
    if (this.kind === 'btt' || this.kind === 'btp') app.audio.say(this.kind === 'btt' ? 'Break the targets!' : 'Board the platforms!', 0.9);
    this.t = 0;
  }
  // Race to the Finish: gmCameraSetStatusPlayerFollow(player, 0, -15 deg, 7000, 0.3, fov 31.5)
  followCamera() {
    const v = this.view, p = this.logic.player;
    v.updateCamera = () => {
      const tx = p.x, ty = p.y + p.H * 0.5;
      if (!v.initCam) { v.cam = { x: tx, y: ty, d: 7000 }; v.initCam = true; }
      v.cam.x += (tx - v.cam.x) * 0.3; v.cam.y += (ty - v.cam.y) * 0.3;
      const pitch = 15 * Math.PI / 180, d = 7000 * RS;
      v.camera.fov = 31.5; v.camera.near = 2.56; v.camera.far = 400; v.camera.updateProjectionMatrix();
      v.camera.position.set(v.cam.x * RS, v.cam.y * RS + Math.sin(pitch) * d, Math.cos(pitch) * d);
      v.camera.lookAt(v.cam.x * RS, v.cam.y * RS, 0);
      if (v.stageObj?.background) { v.stageObj.background.position.x = v.cam.x * RS * 0.85; v.stageObj.background.position.y = v.cam.y * RS * 0.7; }
      v.shake();
    };
  }
  setupFighter(f, i) {
    const v = this.view.fviews[i];
    if (f.polygon && v) stylePolygonView(v, i * 13 + (f.member?.order ?? 0) + 1);
    if (f.isBoss || f === this.logic.player) return;
    if (f.cpu) { const d = new CpuDriver(this.match, f); this.drivers.set(f, d); this.app.input.cpuDrivers[f.port] = d.drive; }
  }
  exit() {
    super.exit();
    this.mhView?.dispose();
    for (const o of this.objViews ?? []) this.view?.scene.remove(o.mesh);
  }

  // targets (Bonus 1) and boarded-platform markers (Bonus 2) unless the stage module draws its own
  makeObjectiveViews() {
    this.objViews = [];
    const L = this.logic, scene = this.view.scene, st = this.match.stage;
    if (L.targets && !L.stageTargets && !st.drawsTargets) {
      const tex = targetTexture();
      for (const t of L.targets) {
        const g = new THREE.Group();
        const disc = new THREE.Mesh(new THREE.CircleGeometry(t.r * RS, 20), new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.DoubleSide }));
        disc.position.z = 0.6; g.add(disc);
        const back = new THREE.Mesh(new THREE.CylinderGeometry(t.r * RS, t.r * RS, 0.25, 20), new THREE.MeshLambertMaterial({ color: 0xc02020 }));
        back.rotation.x = Math.PI / 2; back.position.z = 0.45; g.add(back);
        const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.2, 6), new THREE.MeshLambertMaterial({ color: 0x909090 }));
        stem.rotation.x = Math.PI / 2; stem.position.z = -0.2; g.add(stem);
        g.position.set(t.x * RS, t.y * RS, 0);
        scene.add(g);
        this.objViews.push({ kind: 'target', t, mesh: g });
      }
    }
    if (L.platforms && this.kind === 'btp' && !st.drawsPlatforms) {
      for (const pl of L.platforms) {
        const fl = pl.floor, w = (fl.local[fl.local.length - 1][0] - fl.local[0][0]);
        const mk = new THREE.Mesh(new THREE.BoxGeometry(w * RS, 0.18, 2.4), new THREE.MeshLambertMaterial({ color: 0xffd040, emissive: 0x704000, transparent: true, opacity: 0.9 }));
        mk.visible = false; scene.add(mk);
        const ring = new THREE.Mesh(new THREE.BoxGeometry(w * RS + 0.1, 0.06, 2.5), new THREE.MeshBasicMaterial({ color: 0xff3030 }));
        scene.add(ring);
        this.objViews.push({ kind: 'platform', pl, mesh: mk, ring, mid: (fl.local[0][0] + fl.local[fl.local.length - 1][0]) / 2 });
      }
    }
  }
  syncObjectiveViews() {
    const m = this.match;
    for (const o of this.objViews) {
      if (o.kind === 'target') {
        if (o.t.broken && o.mesh.visible) { o.mesh.visible = false; this.view.fx.spark?.(o.t.x, o.t.y, 400, 0xff4040, RS); this.view.fx.ring?.(o.t.x, o.t.y, 0xffffff, RS, 1.4); }
        o.mesh.position.set((o.t.x + (o.t.ox ?? 0)) * RS, (o.t.y + (o.t.oy ?? 0)) * RS, 0);
        o.mesh.rotation.y = Math.sin(m.frame / 25 + o.t.id) * 0.15;
      } else {
        const fl = o.pl.floor;
        const x = (fl.pts[0][0] + fl.pts[fl.pts.length - 1][0]) / 2, y = fl.pts[0][1];
        o.mesh.position.set(x * RS, (y + 8) * RS, 0); o.ring.position.set(x * RS, (y + 2) * RS, 0);
        o.mesh.visible = o.pl.boarded; o.ring.visible = !o.pl.boarded && Math.floor(m.frame / 20) % 2 === 0;
        if (o.pl.boarded && !o.flashed) { o.flashed = true; this.view.fx.ring?.(x, y + 40, 0xffe060, RS, 1.2); }
      }
    }
  }

  update() {
    const app = this.app, m = this.match;
    this.t++;
    // Master Hand's entrance: the player can't act until the hand is in place (sc1PGameWaitStageBossUpdate)
    if (this.lockPlayer) {
      const port = this.logic.player.port;
      if (this.logic.boss.act.name === 'appear') app.input.cpuDrivers[port] = c => { c.x = 0; c.y = 0; for (const k in c.down) c.down[k] = false; };
      else { app.input.cpuDrivers[port] = null; this.lockPlayer = false; app.audio.music('final'); this.banner = { t: 'GO!', until: m.frame + 45 }; app.audio.say('Go!', 1.0); }
    }
    // L during pause in a bonus practice: retry (decomp: L in a bonus stage retries)
    if (m.paused && this.p.practice && this.pausedBy !== null && app.input.controllers[this.pausedBy]?.pressed('L')) { m.paused = false; this.retry = true; this.finish('retry'); return; }
    super.update();
  }
  handleEvents(evs) {
    const m = this.match, a = this.app.audio;
    this.logic.update(evs);
    const rest = [];
    for (const e of evs) {
      if (this.noCount && e.type === 'count') continue;
      if (e.type === 'game') {
        const s = this.logic.endState;
        a.stopMusic(); a.sfx('go');
        const txt = s === 'complete' ? 'COMPLETE!' : s === 'failure' ? 'FAILURE' : e.reason === 'time' ? 'TIME UP!' : 'GAME SET';
        const say = s === 'complete' ? 'Complete!' : s === 'failure' ? 'Failure' : e.reason === 'time' ? 'Time!' : 'Game set!';
        a.say(say, 0.9);
        this.banner = { t: txt, until: m.frame + 9999, color: s === 'failure' ? 'blue' : null };
        continue;
      }
      if (e.type === 'bossDefeat') { this.whiteFlash = 40; continue; }
      rest.push(e);
    }
    super.handleEvents(rest);
  }
  finish(quit) {
    if (this.done) return; this.done = true;
    const snapshot = snapshotCanvas(this.app);
    for (let i = 0; i < 4; i++) this.app.input.cpuDrivers[i] = null;
    afterBattle(this.app, { run: this.p.run, plan: this.p.plan, logic: this.logic, quit, snapshot, practice: this.p.practice });
  }

  render(renderer, ctx) {
    this.mhView?.update(this.match);
    this.syncObjectiveViews();
    const banner = this.banner;
    if (banner?.color) this.banner = null;   // drawn below in its own style
    super.render(renderer, ctx);
    this.banner = banner;
    this.drawExtras(ctx);
    if (banner?.color && this.match.frame < banner.until) text(ctx, banner.t, 320, 270, { size: 84, align: 'center', gradient: ['#e0f0ff', '#6090e0', '#203080'], stroke: '#001', strokeW: 8 });
    if (this.whiteFlash > 0) { ctx.fillStyle = `rgba(255,255,255,${Math.min(1, this.whiteFlash / 20)})`; ctx.fillRect(0, 0, 640, 480); this.whiteFlash--; }
  }
  drawExtras(ctx) {
    const m = this.match, L = this.logic;
    // timer (top right, lavender), counts down; practice counts up
    if (this.p.practice) drawTimer(ctx, L.frames);
    else if (m.timeLeft !== Infinity) {
      drawTimer(ctx, m.timeLeft);
    }
    // team stock row (Yoshi / Kirby / Polygon Team): one head per remaining member, top left
    if (this.kind === 'team') {
      const total = L.plan.queue.length;
      const left = L.teamLeft;
      const n = Math.min(total, 30);
      const per = total > 18 ? 15 : total;
      for (let i = 0; i < n; i++) {
        const mem = L.plan.queue[i];
        const x = 22 + (i % per) * 19, y = 26 + Math.floor(i / per) * 20;
        drawStockHead(ctx, mem.def, mem.color, x, y, 8, i >= total - left ? 1 : 0.18, mem.polygon);
      }
    }
    // Break the Targets / Board the Platforms: icons for the ones still standing
    if (this.kind === 'btt' || this.kind === 'btp') {
      const tot = this.kind === 'btt' ? L.targetTotal : L.platformTotal, done = this.kind === 'btt' ? L.targetsBroken : L.platformsBoarded;
      for (let i = 0; i < tot - done; i++) (this.kind === 'btt' ? drawTargetIcon : drawPlatformIcon)(ctx, 24 + i * 22, 30, 9);
    }
    // allies wear a heart tag in the player's colour (nIFPlayerTagKindHeart)
    for (const f of m.fighters) {
      if (f.who !== 'ally' || f.dead) continue;
      const [sx, sy] = this.view.toScreen(f.x, f.y + f.H * 1.08);
      const cx = Math.max(16, Math.min(624, sx)), cy = Math.max(30, Math.min(470, sy));
      drawHeart(ctx, cx, cy - 20, 10, PORT_COLORS[L.player.port] ?? '#e8283c');
    }
    // Master Hand H.P next to the player's slot
    if (L.boss) {
      const x = 392;
      drawHandIcon(ctx, x - 14, 400, 13);
      text(ctx, String(L.boss.hp), x + 30, 452, { size: 36, align: 'right', color: percentColor(Math.max(0, 300 - L.boss.hp) * 0.6), stroke: '#000', strokeW: 6 });
      text(ctx, 'H.P', x + 34, 452, { size: 18, color: '#fff', stroke: '#000', strokeW: 4 });
    }
  }
}

function drawTimer(ctx, frames) {
  const s = Math.max(0, Math.ceil(frames / 60));
  const mm = Math.floor(s / 60), ss = s % 60;
  text(ctx, `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`, 612, 50, { size: 32, align: 'right', color: '#ece6f8', stroke: '#2a2440', strokeW: 5, italic: false, font: TIMER_FONT, weight: 700 });
}
function drawHeart(ctx, x, y, r, col) {
  ctx.save(); ctx.translate(x, y); ctx.fillStyle = col; ctx.strokeStyle = '#000'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(0, r * 0.9);
  ctx.bezierCurveTo(-r * 1.4, -r * 0.1, -r * 0.8, -r * 1.2, 0, -r * 0.45);
  ctx.bezierCurveTo(r * 0.8, -r * 1.2, r * 1.4, -r * 0.1, 0, r * 0.9);
  ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
}
function targetTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  const cols = ['#e01818', '#ffffff', '#e01818', '#ffffff', '#e01818'];
  cols.forEach((col, i) => { g.fillStyle = col; g.beginPath(); g.arc(64, 64, 64 - i * 12.5, 0, Math.PI * 2); g.fill(); });
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
