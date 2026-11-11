// Character Select Screen (VS, 1P Game, Training, Bonus 1/2 practice).
// Layout after css_vs_full_roster.png (2x): stone background, mode name / rule pill / BACK on top, 2x6
// portrait grid (rendered busts over fire), four player panels with the 3D model idling, HMN/CP/NA tags,
// CPU level and handicap arrows, team tags, a white-glove hand per active controller carrying its token.
//
// params: { mode: 'vs' | '1p' | 'training' | 'bonus1' | 'bonus2' }
// Output: vs -> stage select -> battle; 1p -> app.go('oneplayer', {char,color,difficulty,stocks});
// bonus -> app.go('bonus', {kind:'btt'|'btp', char, color}); training -> stage select -> app.go('training', {...}).
import { MenuScreen, drawStone, drawHand, drawToken, drawSmashEmblem, arrow, pill, shade, RFONT, BFONT, PORT_TOKEN, CPU_TOKEN } from '../menu.js';
import { text, roundRect } from '../draw.js';
import { ROSTER, CHARS, STARTERS } from '../../chars/index.js';
import { portrait, MenuFighter } from '../render3d.js';
import { timeLabel } from './submenus.js';
import { itemSwitchOf } from './vsoptions.js';

const GX = 50, GY = 70, CW = 90, CH = 84;
const PANEL_X = [44, 186, 328, 470], PANEL_Y = 252, PW = 126, PH = 176;
const PANEL_COL = ['#842121', '#22337f', '#856e02', '#1c531f'];
const TEAM_NAMES = ['RED', 'BLUE', 'GREEN'], TEAM_COL = ['#8b281e', '#25358a', '#1c531f'], TEAM_TOKEN = ['#e02828', '#2a4fe0', '#20a040'];
export const DIFFICULTY = [['veryeasy', 'Very Easy'], ['easy', 'Easy'], ['normal', 'Normal'], ['hard', 'Hard'], ['veryhard', 'Very Hard']];
const NAMES = { luigi: 'LUIGI', mario: 'MARIO', dk: 'D K', link: 'LINK', samus: 'SAMUS', falcon: 'C.FALCON', ness: 'NESS', yoshi: 'YOSHI', kirby: 'KIRBY', fox: 'FOX', pikachu: 'PIKACHU', jigglypuff: 'JIGGLYPUFF' };
const FULL = { luigi: 'LUIGI', mario: 'MARIO', dk: 'DONKEY KONG', link: 'LINK', samus: 'SAMUS', falcon: 'CAPTAIN FALCON', ness: 'NESS', yoshi: 'YOSHI', kirby: 'KIRBY', fox: 'FOX', pikachu: 'PIKACHU', jigglypuff: 'JIGGLYPUFF' };
const SAY = { dk: 'Donkey Kong', falcon: 'Captain Falcon' };
export const charSayName = id => SAY[id] ?? CHARS[id]?.name ?? id;
export const charFullName = id => FULL[id] ?? id.toUpperCase();

const inRect = (x, y, r) => x >= r[0] && x <= r[0] + r[2] && y >= r[1] && y <= r[1] + r[3];

export class CSSScreen extends MenuScreen {
  constructor(app, p) {
    super(app, p);
    this.mode = p.mode ?? 'vs';
    this.single = this.mode === '1p' || this.mode === 'bonus1' || this.mode === 'bonus2';
    app.cssState ??= {};
    const st = app.cssState[this.mode];
    this.teams = this.mode === 'vs' ? !!this.save.data.vsRules.teams : false;
    if (st) { this.panels = st.panels; this.active = st.active; }
    else {
      this.active = [true, false, false, false];
      this.panels = [0, 1, 2, 3].map(i => ({ type: i === 0 ? 'hmn' : 'na', char: null, color: 0, level: 3, handicap: 9, team: [0, 1, 2, 0][i], token: null }));
      if (this.mode === 'training') { const c = this.panels[1]; c.type = 'cpu'; c.char = 'mario'; c.color = 1; c.level = 1; }
      if (this.single) this.panels.forEach((pp, i) => { if (i) pp.type = 'hidden'; });
    }
    if (this.mode === 'training') this.panels.forEach((pp, i) => { if (i > 1) pp.type = 'hidden'; });
    this.hands = [0, 1, 2, 3].map(i => ({ x: PANEL_X[i] + 60, y: PANEL_Y + 90, holding: null }));
    // tokens: placed tokens keep their spot; others go back to their owner's hand
    this.panels.forEach((pp, i) => {
      if (pp.char && !pp.token) pp.token = this.cellCenter(ROSTER.indexOf(pp.char));
      if (!pp.char && this.active[i] && pp.type !== 'na' && pp.type !== 'hidden') this.hands[i].holding = i;
      if (!pp.char && pp.type === 'cpu') { pp.char = this.randomChar(); pp.token = this.cellCenter(ROSTER.indexOf(pp.char)); }
    });
    this.models = [null, null, null, null];
    this.banner = 0; this.readyWas = false; this.blink = 0;
  }
  enter() {
    this.app.audio.music('menu');
    const say = this.mode === 'vs' ? (this.teams ? 'Team battle!' : 'Free for all!') : 'Choose your character!';
    this.audio.say(say, 0.85);
    this.updateMenuMode();
  }
  exit() {
    this.app.cssState[this.mode] = { panels: this.panels.map(pp => ({ ...pp })), active: this.active.slice() };
    for (const m of this.models) m?.mf.dispose();
    this.app.input.menuMode = true;
  }
  // P2 keyboard shares the arrow keys with P1's menu aliases: once P2 has joined, P1 uses WASD/J/K only.
  updateMenuMode() { this.app.input.menuMode = !this.active.slice(1).some(Boolean); }
  cellCenter(k) { return { x: GX + (k % 6) * CW + CW / 2 + 12, y: GY + Math.floor(k / 6) * CH + CH / 2 + 10 }; }
  locked(id) { return !STARTERS.includes(id) && !this.save.isUnlocked(id); }
  randomChar() { const ok = ROSTER.filter(id => !this.locked(id)); return ok[Math.floor(Math.random() * ok.length)]; }
  cellAt(x, y) {
    const c = Math.floor((x - GX) / CW), r = Math.floor((y - GY) / CH);
    if (c < 0 || c > 5 || r < 0 || r > 1) return -1;
    return r * 6 + c;
  }
  rules() { return this.save.data.vsRules; }
  // ------------------------------------------------------------ buttons
  buttons() {
    const B = [];
    B.push({ r: [490, 34, 96, 30], act: () => this.goBack() });
    if (this.mode === 'vs') {
      B.push({ r: [36, 34, 200, 30], act: () => this.toggleTeams() });
      B.push({ r: [282, 34, 86, 30], act: () => this.changeRule(-1) });
      B.push({ r: [370, 34, 90, 30], act: () => this.changeRule(1) });
    }
    if (this.mode === '1p') {
      const o = this.save.data.options;
      B.push({ r: [384, 312, 30, 30], act: () => this.cycle1p('difficulty', -1) }, { r: [574, 312, 30, 30], act: () => this.cycle1p('difficulty', 1) });
      B.push({ r: [384, 358, 30, 30], act: () => this.cycle1p('stocks', -1) }, { r: [574, 358, 30, 30], act: () => this.cycle1p('stocks', 1) });
      void o;
    }
    this.panels.forEach((pp, i) => {
      if (pp.type === 'hidden') return;
      const x = PANEL_X[i];
      if (!this.single && this.mode !== 'training') B.push({ r: [x + PW - 50, PANEL_Y + 4, 46, 22], act: () => this.cycleType(i) });
      if (this.teams && pp.type !== 'na') B.push({ r: [x + 4, PANEL_Y + 4, 58, 22], act: () => { pp.team = (pp.team + 1) % 3; this.audio.sfx('menuMove'); } });
      if (pp.type === 'cpu') {
        B.push({ r: [x, PANEL_Y + PH - 34, 30, 32], act: () => { pp.level = Math.max(1, pp.level - 1); this.audio.sfx('menuMove'); } });
        B.push({ r: [x + PW - 30, PANEL_Y + PH - 34, 30, 32], act: () => { pp.level = Math.min(9, pp.level + 1); this.audio.sfx('menuMove'); } });
      }
      if (this.showHandicap(pp)) {
        const y = PANEL_Y + PH - (pp.type === 'cpu' ? 64 : 34);
        B.push({ r: [x, y, 30, 30], act: () => { pp.handicap = Math.max(1, pp.handicap - 1); this.audio.sfx('menuMove'); } });
        B.push({ r: [x + PW - 30, y, 30, 30], act: () => { pp.handicap = Math.min(9, pp.handicap + 1); this.audio.sfx('menuMove'); } });
      }
    });
    return B;
  }
  showHandicap(pp) { return this.mode === 'vs' && pp.type !== 'na' && this.rules().handicap === 'on'; }
  cycle1p(k, d) {
    const o = this.save.data.options;
    if (k === 'difficulty') { const i = DIFFICULTY.findIndex(x => x[0] === (o.difficulty ?? 'normal')); o.difficulty = DIFFICULTY[Math.max(0, Math.min(4, i + d))][0]; }
    else o.stocks1P = Math.max(1, Math.min(5, (o.stocks1P ?? 3) + d));
    this.audio.sfx('menuMove'); this.save.write();
  }
  toggleTeams() { this.teams = !this.teams; this.rules().teams = this.teams; this.save.write(); this.audio.sfx('menuOk'); this.audio.say(this.teams ? 'Team battle!' : 'Free for all!'); }
  changeRule(d) {
    const r = this.rules();
    if (r.mode === 'stock') r.stocks = Math.max(1, Math.min(99, r.stocks + d));
    else { let n = (r.time === 0 ? 100 : r.time) + d; n = Math.max(1, Math.min(100, n)); r.time = n === 100 ? 0 : n; }
    this.audio.sfx('menuMove'); this.save.write();
  }
  cycleType(i) {
    const pp = this.panels[i];
    const order = this.active[i] ? ['hmn', 'cpu'] : ['na', 'cpu', 'hmn'];
    const k = order.indexOf(pp.type);
    pp.type = order[(k + 1) % order.length];
    // a hand holding this panel's token drops it back
    for (const h of this.hands) if (h.holding === i && pp.type !== 'hmn') h.holding = null;
    if (pp.type === 'cpu') { if (!pp.char) { pp.char = this.randomChar(); pp.color = this.freeColor(pp.char, i); pp.token = this.cellCenter(ROSTER.indexOf(pp.char)); this.setModel(i); } }
    else if (pp.type === 'na') { pp.char = null; pp.token = null; this.models[i]?.mf.dispose(); this.models[i] = null; }
    else if (pp.type === 'hmn') { if (this.active[i] && !pp.char) this.hands[i].holding = i; }
    this.audio.sfx('menuMove');
  }
  goBack() {
    this.audio.sfx('menuBack');
    this.go(this.mode === 'vs' ? 'vsmenu' : 'menu1p');
  }
  freeColor(id, i) {
    const n = CHARS[id].palettes.length;
    const used = this.panels.filter((q, j) => j !== i && q.char === id && q.type !== 'na').map(q => q.color);
    let c = this.panels[i].color ?? 0;
    if (this.panels[i].char !== id) c = 0;
    for (let k = 0; k < n; k++) if (!used.includes((c + k) % n)) return (c + k) % n;
    return c;
  }
  setModel(i) {
    const pp = this.panels[i];
    this.models[i]?.mf.dispose(); this.models[i] = null;
    if (!pp.char) return;
    try { this.models[i] = { id: pp.char, color: pp.color, mf: new MenuFighter(pp.char, pp.color, { yaw: 0.5 }), t0: this.t }; } catch (e) { console.warn(e); }
  }
  ready() {
    const live = this.panels.filter(pp => pp.type === 'hmn' || pp.type === 'cpu');
    if (this.single) return !!this.panels[0].char;
    if (live.some(pp => !pp.char)) return false;
    if (live.length < 2) return false;
    if (this.teams && new Set(live.map(pp => pp.team)).size < 2) return false;
    return true;
  }
  // ------------------------------------------------------------ update
  tick() {
    const inp = this.app.input;
    // join: a controller pressing START/A on an inactive port activates its hand
    for (let p = 1; p < 4; p++) {
      if (this.active[p] || this.single || this.panels[p].type === 'hidden') continue;
      const c = inp.controllers[p];
      if (c.pressed('START') || c.pressed('A')) {
        this.active[p] = true; this.updateMenuMode();
        if (this.panels[p].type === 'na') this.panels[p].type = 'hmn';
        if (this.panels[p].type === 'hmn' && !this.panels[p].char) this.hands[p].holding = p;
        this.audio.sfx('menuOk');
        return;
      }
    }
    for (let p = 0; p < 4; p++) if (this.active[p]) this.tickHand(p);
    const rd = this.ready();
    if (rd && !this.readyWas) this.banner = 0;
    this.readyWas = rd; this.banner++;
  }
  tickHand(p) {
    const c = this.app.input.controllers[p], h = this.hands[p];
    h.x = Math.max(4, Math.min(632, h.x + c.x * 7)); h.y = Math.max(4, Math.min(470, h.y - c.y * 7));
    if (c.pressed('START') && this.ready()) { this.start(); return; }
    if (c.pressed('A')) { this.press(p); return; }
    if (c.pressed('B')) {
      const own = this.panels[p];
      if (h.holding === null && own.char && (own.type === 'hmn')) { own.char = null; own.token = null; h.holding = p; this.setModel(p); this.audio.sfx('menuBack'); }
      else if (h.holding !== null && h.holding !== p) { // put a CPU token back where it was
        const pp = this.panels[h.holding]; pp.char = pp.lastChar ?? this.randomChar(); pp.token = this.cellCenter(ROSTER.indexOf(pp.char)); this.setModel(h.holding); h.holding = null;
      } else if (h.holding === p && !own.char) this.goBack();
      return;
    }
    // costume change with C buttons on your own selection
    const own = this.panels[p];
    if (own.char && h.holding === null) {
      const d = (c.pressed('CR') || c.pressed('CU')) ? 1 : (c.pressed('CL') || c.pressed('CD')) ? -1 : 0;
      if (d) {
        const n = CHARS[own.char].palettes.length;
        let col = own.color;
        for (let k = 0; k < n; k++) { col = (col + d + n) % n; if (!this.panels.some((q, j) => j !== p && q.char === own.char && q.color === col && q.type !== 'na')) break; }
        own.color = col; this.setModel(p); this.audio.sfx('menuMove');
      }
    }
  }
  press(p) {
    const h = this.hands[p];
    // fingertip on a button?
    for (const b of this.buttons()) if (inRect(h.x, h.y, b.r)) { b.act(); return; }
    if (h.holding !== null) {
      const k = this.cellAt(h.x, h.y);
      if (k < 0) return;
      const id = ROSTER[k];
      if (this.locked(id)) { this.audio.sfx('menuBack'); return; }
      const i = h.holding, pp = this.panels[i];
      pp.color = this.freeColor(id, i); pp.char = id; pp.lastChar = id; pp.token = { x: h.x + 12, y: h.y + 16 };
      h.holding = null;
      this.setModel(i);
      this.audio.sfx('select'); this.audio.say(charSayName(id), 0.9);
      return;
    }
    // pick up a placed token (own or a CPU's)
    let best = -1, bd = 26;
    this.panels.forEach((pp, i) => {
      if (!pp.token || !pp.char) return;
      if (!(i === p || pp.type === 'cpu')) return;
      if (this.hands.some(hh => hh.holding === i)) return;
      const d = Math.hypot(pp.token.x - (h.x + 12), pp.token.y - (h.y + 16));
      if (d < bd) { bd = d; best = i; }
    });
    if (best >= 0) { const pp = this.panels[best]; pp.char = null; pp.token = null; h.holding = best; this.setModel(best); this.audio.sfx('menuMove'); }
  }
  start() {
    const app = this.app;
    this.audio.sfx('menuOk');
    const sel = this.panels.map((pp, i) => ({ ...pp, port: i })).filter(pp => pp.char && (pp.type === 'hmn' || pp.type === 'cpu'));
    if (this.mode === '1p') {
      const o = this.save.data.options, pl = sel[0];
      this.goMode('oneplayer', { char: pl.char, color: pl.color, difficulty: o.difficulty ?? 'normal', stocks: o.stocks1P ?? 3 });
      return;
    }
    if (this.mode === 'bonus1' || this.mode === 'bonus2') { const pl = sel[0]; this.goMode('bonus', { kind: this.mode === 'bonus1' ? 'btt' : 'btp', char: pl.char, color: pl.color }); return; }
    if (this.mode === 'training') {
      const players = sel.map(pp => ({ char: pp.char, color: pp.color, port: pp.port, ...(pp.type === 'cpu' ? { cpu: true } : {}) }));
      if (!app.screens.training) { this.goMode('training'); return; }
      app.go('stageselect', { mode: 'training', onPick: stage => app.go('training', { players, stage }), onBack: () => app.go('css', { mode: 'training' }) });
      return;
    }
    const r = this.rules();
    const battle = stage => startVSBattle(app, stage, sel, r);
    if (r.stageSelect === false) battle(randomStage(this.save));
    else app.go('stageselect', { mode: 'vs', onPick: battle, onBack: () => app.go('css', { mode: 'vs' }) });
  }
  // screens owned by src/modes/ (1P Game, Training, Bonus); show a notice if not registered yet
  goMode(name, params) {
    if (this.app.screens[name]) { this.app.go(name, params); return; }
    this.notice = { t: 90, s: `"${name}" mode is not available yet` }; this.audio.sfx('menuBack');
  }
  // ------------------------------------------------------------ draw
  draw(ctx) {
    if (this.notice?.t > 0) this.notice.t--;
    drawStone(ctx);
    this.drawTop(ctx);
    this.drawGrid(ctx);
    if (this.mode === '1p' || this.mode === 'bonus1' || this.mode === 'bonus2') this.drawSingleInfo(ctx);
    this.panels.forEach((pp, i) => this.drawPanel(ctx, i));
    if (this.ready()) {
      this.drawBanner(ctx);
      text(ctx, 'PRESS', 314, 466, { size: 17, align: 'right', color: '#e8e8e8', font: RFONT, italic: false, weight: 700, stroke: '#000', strokeW: 3 });
      text(ctx, 'START', 320, 466, { size: 17, color: '#ff3040', font: RFONT, italic: false, weight: 700, stroke: '#000', strokeW: 3 });
    }
    if (this.notice?.t > 0) text(ctx, this.notice.s, 320, 446, { size: 16, align: 'center', color: '#ffd040', stroke: '#000', strokeW: 3, font: RFONT, italic: false });
    // placed tokens, then hands
    this.panels.forEach((pp, i) => {
      if (pp.token && pp.char && !this.hands.some(h => h.holding === i)) drawToken(ctx, pp.token.x, pp.token.y, pp.type === 'cpu' ? 'CP' : (i + 1) + 'P', this.tokenColor(i));
    });
    for (let p = 3; p >= 0; p--) {
      if (!this.active[p]) continue;
      const h = this.hands[p], k = h.holding;
      drawHand(ctx, h.x, h.y, k !== null ? { label: this.panels[k].type === 'cpu' ? 'CP' : (k + 1) + 'P', color: this.tokenColor(k) } : null);
      if (k === null) text(ctx, (p + 1) + 'P', h.x + 22, h.y + 56, { size: 13, color: PORT_TOKEN[p], stroke: '#fff', strokeW: 2, font: BFONT });
    }
  }
  tokenColor(i) { const pp = this.panels[i]; return this.teams ? TEAM_TOKEN[pp.team] : pp.type === 'cpu' ? CPU_TOKEN : PORT_TOKEN[i]; }
  drawTop(ctx) {
    const title = { vs: this.teams ? 'Team Battle' : 'Free-for-all', '1p': '1PlayerGame', training: 'Training Mode', bonus1: 'Bonus 1 (Break The Targets)', bonus2: 'Bonus 2 (Board The Platforms)' }[this.mode];
    text(ctx, title, 52, 60, { size: this.mode.startsWith('bonus') ? 20 : 26, color: this.teams ? '#58c050' : '#c79706', gradient: this.teams ? ['#a0f090', '#3a9a30'] : ['#ffd84a', '#c79706'], stroke: '#000', strokeW: 3, font: RFONT, weight: 900 });
    if (this.mode === 'vs') {
      const r = this.rules();
      pill(ctx, 284, 36, 172, 28, '#dca829', { stroke: '#71581f', lw: 2, r: 14 });
      arrow(ctx, 300, 50, -1, 8, '#f8f0c0'); arrow(ctx, 440, 50, 1, 8, '#f8f0c0');
      text(ctx, r.mode === 'stock' ? 'STOCK' : 'TIME', 352, 57, { size: 17, align: 'center', color: '#3a2a08', font: BFONT, italic: false });
      text(ctx, r.mode === 'stock' ? String(r.stocks) : timeLabel(r.time), 412, 60, { size: 25, align: 'center', color: '#2a1a00', font: BFONT, italic: true });
    }
    ctx.save(); roundRect(ctx, 490, 36, 96, 26, 6); ctx.fillStyle = '#0a0a0a'; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = '#b58418'; ctx.stroke(); ctx.restore();
    arrow(ctx, 506, 49, -1, 6, '#e8b830'); arrow(ctx, 516, 49, -1, 6, '#e8b830');
    text(ctx, 'BACK', 556, 57, { size: 17, align: 'center', color: '#e8b830', font: BFONT, italic: false });
  }
  drawGrid(ctx) {
    ctx.fillStyle = '#2b1b14'; ctx.fillRect(GX - 3, GY - 3, CW * 6 + 6, CH * 2 + 6);
    ROSTER.forEach((id, k) => {
      const x = GX + (k % 6) * CW, y = GY + Math.floor(k / 6) * CH;
      const show1p = this.single && this.locked(id);
      if (this.locked(id) || show1p) {
        const g = ctx.createLinearGradient(x, y, x, y + CH); g.addColorStop(0, '#2c2c2c'); g.addColorStop(1, '#141414');
        ctx.fillStyle = g; ctx.fillRect(x + 1, y + 1, CW - 2, CH - 2);
        text(ctx, '?', x + CW / 2, y + CH / 2 + 20, { size: 54, align: 'center', color: '#8a8a8a', stroke: '#222', strokeW: 3, font: RFONT, italic: false });
        return;
      }
      ctx.drawImage(portrait(id, CW - 2, CH - 2), x + 1, y + 1, CW - 2, CH - 2);
      ctx.strokeStyle = '#5b4133'; ctx.lineWidth = 2; ctx.strokeRect(x + 1, y + 1, CW - 2, CH - 2);
      text(ctx, NAMES[id], x + 6, y + 19, { size: id === 'jigglypuff' ? 12 : 16, color: '#c5b59c', stroke: '#2a1a10', strokeW: 3, font: RFONT, italic: false, weight: 700, scaleX: id === 'jigglypuff' ? 0.9 : 1 });
    });
  }
  drawBanner(ctx) {
    const k = Math.min(1, this.banner / 12), x = (1 - k) * 640;
    ctx.save(); ctx.translate(x, 0);
    ctx.fillStyle = 'rgba(150,20,30,0.55)'; ctx.fillRect(GX - 20, 132, 600, 30);
    ctx.fillStyle = 'rgba(255,120,140,0.8)'; ctx.fillRect(GX - 20, 128, 600, 3); ctx.fillRect(GX - 20, 163, 600, 3);
    ctx.fillStyle = 'rgba(40,0,0,0.35)'; for (let y = 134; y < 162; y += 4) ctx.fillRect(GX - 20, y, 600, 2);
    text(ctx, 'R e a d y   t o   F i g h t', 320, 158, { size: 30, align: 'center', gradient: ['#fffbe0', '#e8c040', '#8a6010'], stroke: '#2a1000', strokeW: 4, font: BFONT, italic: false, scaleX: 1.2 });
    ctx.restore();
  }
  drawSingleInfo(ctx) {
    // Option box (1P) or best-time box (bonus) to the right of the single panel
    ctx.save();
    ctx.fillStyle = '#5a638c'; ctx.fillRect(330, 268, 310, 8);
    text(ctx, this.mode === '1p' ? 'Option' : 'Record', 450, 286, { size: 30, align: 'center', color: '#e8e8f0', stroke: '#45486a', strokeW: 4, font: RFONT, weight: 400 });
    ctx.lineWidth = 3; ctx.strokeStyle = '#8a90b8'; roundRect(ctx, 260, 296, 420, 108, 54); ctx.stroke();
    ctx.restore();
    if (this.mode === '1p') {
      const o = this.save.data.options;
      text(ctx, 'LEVEL :', 300, 336, { size: 20, color: '#e0e0e0', font: BFONT, italic: false });
      arrow(ctx, 398, 328, -1, 9, '#f0c010'); arrow(ctx, 590, 328, 1, 9, '#f0c010');
      text(ctx, DIFFICULTY.find(d => d[0] === (o.difficulty ?? 'normal'))[1].toUpperCase(), 494, 337, { size: 20, align: 'center', color: '#f0c010', font: BFONT, italic: false });
      text(ctx, 'STOCK :', 300, 382, { size: 20, color: '#e0e0e0', font: BFONT, italic: false });
      arrow(ctx, 398, 374, -1, 9, '#f0c010'); arrow(ctx, 590, 374, 1, 9, '#f0c010');
      const pp = this.panels[0], n = o.stocks1P ?? 3;
      for (let k = 0; k < n; k++) {
        const pal = pp.char ? CHARS[pp.char].palettes[pp.color % CHARS[pp.char].palettes.length] : null;
        const c = pal ? (pal.icon ?? pal.cap ?? pal.body ?? 0xcc4444) : 0xcc4444;
        ctx.beginPath(); ctx.arc(430 + k * 26, 374, 10, 0, Math.PI * 2); ctx.fillStyle = '#' + c.toString(16).padStart(6, '0'); ctx.fill(); ctx.strokeStyle = '#000'; ctx.stroke();
      }
      const hi = this.save.data.records.oneP_hi?.[pp.char] ?? 0;
      text(ctx, 'HIGH SCORE ' + String(hi).padStart(8, '0'), 600, 430, { size: 15, align: 'right', color: '#a0a0b0', font: '"DejaVu Sans Mono", monospace', italic: false });
    } else {
      const pp = this.panels[0], rec = this.save.data.records[this.mode === 'bonus1' ? 'btt' : 'btp'][pp.char ?? ''];
      text(ctx, 'BEST TIME', 300, 342, { size: 20, color: '#e0e0e0', font: BFONT, italic: false });
      const tm = rec?.time != null ? fmtTime(rec.time) : '--:--:--';
      text(ctx, tm, 600, 342, { size: 22, align: 'right', color: '#f0c010', font: BFONT, italic: false });
      text(ctx, String(rec?.count ?? 0).padStart(2, '0') + (this.mode === 'bonus1' ? ' TARGETS' : ' PLATFORMS'), 600, 384, { size: 18, align: 'right', color: '#e0e0e0', font: BFONT, italic: false });
    }
  }
  drawPanel(ctx, i) {
    const pp = this.panels[i];
    if (pp.type === 'hidden') return;
    const big = this.single;
    const x = big ? 70 : PANEL_X[i], y = PANEL_Y, w = big ? 176 : PW, h = big ? 196 : PH;
    let col = pp.type === 'na' ? '#333333' : pp.type === 'cpu' ? '#737386' : PANEL_COL[i];
    if (this.teams && pp.type !== 'na') col = pp.type === 'cpu' ? shade(TEAM_COL[pp.team], 0.35) : TEAM_COL[pp.team];
    ctx.save();
    roundRect(ctx, x, y, w, h, 6); ctx.fillStyle = col; ctx.fill(); ctx.clip();
    ctx.fillStyle = shade(col, 0.08); for (let yy = y; yy < y + h; yy += 6) ctx.fillRect(x, yy, w, 3);
    if (pp.type === 'na') drawSmashEmblem(ctx, x + w / 2, y + h / 2 + 6, 52, 'rgba(0,0,0,0.35)');
    else drawSmashEmblem(ctx, x + w / 2, y + h / 2 + 10, 44, 'rgba(0,0,0,0.12)');
    ctx.restore();
    ctx.save(); roundRect(ctx, x, y, w, h, 6); ctx.lineWidth = 2; ctx.strokeStyle = shade(col, -0.5); ctx.stroke(); ctx.restore();
    // big port label
    if (pp.type !== 'na') text(ctx, pp.type === 'cpu' ? 'CP' : (i + 1) + 'P', x + 6, y + 50, { size: 50, color: shade(col, -0.35), font: BFONT, italic: false });
    // tags
    const tag = pp.type === 'hmn' ? 'HMN' : pp.type === 'cpu' ? 'C P' : 'N/A';
    if (!big) {
      ctx.save(); roundRect(ctx, x + w - 48, y + 6, 42, 18, 9);
      ctx.fillStyle = pp.type === 'hmn' ? '#e6bf46' : pp.type === 'cpu' ? '#c8c8c8' : '#050505'; ctx.fill();
      ctx.lineWidth = 1.5; ctx.strokeStyle = '#000'; ctx.stroke(); ctx.restore();
      text(ctx, tag, x + w - 27, y + 20, { size: 12, align: 'center', color: pp.type === 'na' ? '#fff' : '#3a2a00', font: BFONT, italic: false });
    }
    if (this.teams && pp.type !== 'na') {
      ctx.save(); roundRect(ctx, x + 6, y + 6, 54, 18, 9); ctx.fillStyle = TEAM_TOKEN[pp.team]; ctx.fill(); ctx.strokeStyle = '#000'; ctx.lineWidth = 1.5; ctx.stroke(); ctx.restore();
      text(ctx, TEAM_NAMES[pp.team], x + 33, y + 20, { size: 12, align: 'center', color: '#fff', font: BFONT, italic: false });
    }
    // model
    const m = this.models[i] ?? (pp.char ? (this.setModel(i), this.models[i]) : null);
    if (m && pp.char) {
      if (m.id !== pp.char || m.color !== pp.color) this.setModel(i);
      const mm = this.models[i];
      if (mm) { mm.mf.pose(this.t - mm.t0); mm.mf.draw(ctx, x - 6, y + 6, w + 12, h - (pp.type === 'cpu' ? 40 : 26), 'full', { margin: Math.max(0.95, 530 / (mm.mf.def.attr.visualHeight ?? 530)) }); }
      text(ctx, charFullName(pp.char), x + 8, y + h - (pp.type === 'cpu' ? 44 : 12), { size: pp.char === 'falcon' || pp.char === 'dk' ? 13 : 18, color: '#fff', stroke: '#000', strokeW: 3, font: BFONT, italic: false });
    }
    if (pp.type === 'cpu') {
      arrow(ctx, x + 14, y + h - 18, -1, 9, '#f0c010'); arrow(ctx, x + w - 14, y + h - 18, 1, 9, '#f0c010');
      text(ctx, 'LEVEL', x + w / 2 - 4, y + h - 9, { size: 13, align: 'right', color: '#d8d8e0', font: BFONT, italic: false, stroke: '#333', strokeW: 2 });
      text(ctx, ':' + pp.level, x + w / 2 + 2, y + h - 7, { size: 26, color: '#fff', font: BFONT, italic: false, stroke: '#333', strokeW: 3 });
    }
    if (this.showHandicap(pp)) {
      const yy = y + h - (pp.type === 'cpu' ? 48 : 18);
      arrow(ctx, x + 14, yy, -1, 8, '#f0c010'); arrow(ctx, x + w - 14, yy, 1, 8, '#f0c010');
      text(ctx, 'HANDICAP ' + pp.handicap, x + w / 2, yy + 6, { size: 13, align: 'center', color: '#fff', font: BFONT, italic: false, stroke: '#000', strokeW: 2 });
    }
  }
}

export function fmtTime(frames) {
  const cs = Math.floor(frames * 100 / 60);
  return `${String(Math.floor(cs / 6000)).padStart(2, '0')}:${String(Math.floor(cs / 100) % 60).padStart(2, '0')}:${String(cs % 100).padStart(2, '0')}`;
}

export const VS_STAGE_GRID = ['peach', 'congo', 'hyrule', 'zebes', 'mushroom', 'yoshi', 'dreamland', 'sectorz', 'saffron', 'random'];
export function randomStage(save) {
  const ok = VS_STAGE_GRID.filter(s => s !== 'random' && (s !== 'mushroom' || save.isUnlocked('mushroomkingdom')));
  return ok[Math.floor(Math.random() * ok.length)];
}

// Build battle params from CSS selections + VS rules and start the match; results come back to the CSS.
export function startVSBattle(app, stage, sel, r) {
  const rules = {
    mode: r.mode === 'stock' ? 'stock' : 'time', stocks: r.stocks, time: r.time === 0 ? Infinity : r.time,
    items: r.items ?? 'middle', itemSwitch: itemSwitchOf(r), teamAttack: !!r.teamAttack, teams: !!r.teams,
    damageRatio: r.damage ?? 100, handicap: r.handicap ?? 'off',
  };
  const players = sel.map(pp => ({
    char: pp.char, color: pp.color, port: pp.port, cpu: pp.type === 'cpu' ? { level: pp.level } : null,
    team: rules.teams ? pp.team : undefined, handicap: rules.handicap === 'off' ? 9 : pp.handicap,
  }));
  const params = { stage, rules, players, mode: 'vs' };
  params.next = (match, { quit }) => {
    // timed tie for first place -> Sudden Death among the tied fighters
    if (!quit && rules.mode === 'time' && !match.suddenDeath) {
      const st = match.standings(), sc = f => f.stats.kos - f.stats.falls;
      const top = st.filter(f => sc(f) === sc(st[0]));
      const sides = new Set(top.map(f => rules.teams ? f.team : f.port));
      if (sides.size > 1) {
        const tied = players.filter(pl => top.some(f => f.port === pl.port));
        app.go('battle', { ...params, players: tied, suddenDeath: true, firstMatch: match,
          overlay: (ctx, m2) => { if (m2.frame < 140) { text(ctx, 'SUDDEN', 320, 200, { size: 64, align: 'center', gradient: ['#ffffff', '#b8bcc8', '#5a5e6a'], stroke: '#15151c', strokeW: 6, font: BFONT }); text(ctx, 'DEATH!', 320, 270, { size: 64, align: 'center', gradient: ['#ffffff', '#b8bcc8', '#5a5e6a'], stroke: '#15151c', strokeW: 6, font: BFONT }); } }, next: (m2, o2) => app.go('results', { match: m2, params, quit: o2.quit, prevMatch: match }) });
        app.audio.say('Sudden death!');
        return;
      }
    }
    app.go('results', { match, params, quit });
  };
  app.go('battle', params);
}
