// The pill-list submenus that share the SSB64 template (black, collage, parent icon, gold corner):
// 1P Mode menu, VS Mode menu, Option menu, Data menu; plus Option > Backup Clear and Screen Adjust.
import { MenuScreen, drawSubmenuBG, drawPills, pill, arrow, RFONT, BFONT, drawHeaderTab } from '../menu.js';
import { text, roundRect } from '../draw.js';

class PillMenu extends MenuScreen {
  constructor(app, p, key) { super(app, p); this.key = key; this.sel = app.menuMemory?.[key] ?? 0; }
  enter() { this.app.audio.music('menu'); this.items = this.makeItems(); this.sel = Math.min(this.sel, this.items.length - 1); }
  tick(i) {
    const it = this.items[this.sel];
    if (i.up) { this.sel = (this.sel + this.items.length - 1) % this.items.length; this.audio.sfx('menuMove'); }
    if (i.down) { this.sel = (this.sel + 1) % this.items.length; this.audio.sfx('menuMove'); }
    if ((i.left || i.right) && it.change) { it.change(i.left ? -1 : 1); this.audio.sfx('menuMove'); this.save.write(); }
    if ((i.a || i.start) && it.act) { (this.app.menuMemory ??= {})[this.key] = this.sel; this.confirm(() => it.act()); }
    else if ((i.a || i.start) && it.change && i.a) { it.change(1); this.audio.sfx('menuMove'); this.save.write(); }
    if (i.b) { (this.app.menuMemory ??= {})[this.key] = this.sel; this.audio.sfx('menuBack'); this.back(); }
  }
  draw(ctx) {
    drawSubmenuBG(ctx, this.icon, this.caption);
    drawPills(ctx, this.items, this.sel, this.flash);
  }
}

// label + inline value drawn inside the pill
function valuePill(label, valueFn, o = {}) {
  return (ctx, it, on) => {
    const size = it.size ?? it.h * 0.62, cy = it.y + it.h * 0.5 + size * 0.36;
    const lx = it.x + (o.labelX ?? 30);
    text(ctx, label, lx, cy, { size, color: '#050200', font: RFONT, italic: false, weight: 700 });
    const v = valueFn();
    const vx = it.x + it.w * (o.valueX ?? 0.66);
    if (typeof v === 'string') {
      text(ctx, v, vx, cy - 2, { size: size * 0.8, align: 'center', color: on ? '#fbf4e9' : '#2a2a40', font: RFONT, italic: false, weight: 700, stroke: on ? '#600' : null, strokeW: 3 });
      if (on && o.arrows !== false) { arrow(ctx, vx - size * 2.2, it.y + it.h / 2, -1, 9, '#ff2020'); arrow(ctx, vx + size * 2.2, it.y + it.h / 2, 1, 9, '#ff2020'); }
    } else v(ctx, vx, cy, size, on);
  };
}

export class OnePMenuScreen extends PillMenu {
  constructor(app, p) { super(app, p, '1p'); this.icon = '1p'; this.caption = '1P Game Mode'; }
  back() { this.go('modeselect'); }
  makeItems() {
    return [
      { label: '1P Game', x: 256, y: 72, w: 340, h: 56, size: 36, act: () => this.go('css', { mode: '1p' }) },
      { label: 'Training Mode', x: 206, y: 164, w: 336, h: 52, size: 33, act: () => this.go('css', { mode: 'training' }) },
      { label: 'Bonus 1 Practice', x: 152, y: 254, w: 340, h: 36, size: 24, act: () => this.go('css', { mode: 'bonus1' }) },
      { label: 'Bonus 2 Practice', x: 130, y: 302, w: 340, h: 36, size: 24, act: () => this.go('css', { mode: 'bonus2' }) },
    ];
  }
}

export const RULE_NAMES = ['Time', 'Stock', 'Time Team', 'Stock Team'];
export function ruleIndex(r) { return (r.mode === 'stock' ? 1 : 0) + (r.teams ? 2 : 0); }
export function timeLabel(t) { return t === 0 ? '∞' : String(t); }

export class VSMenuScreen extends PillMenu {
  constructor(app, p) { super(app, p, 'vs'); this.icon = 'vs'; this.caption = 'VS Game Mode'; }
  back() { this.go('modeselect'); }
  makeItems() {
    const r = this.save.data.vsRules;
    return [
      { label: 'VS START', x: 239, y: 45, w: 351, h: 56, size: 38, act: () => this.go('css', { mode: 'vs' }) },
      { x: 190, y: 130, w: 351, h: 58, size: 38, draw: valuePill('Rule.', () => RULE_NAMES[ruleIndex(r)], { valueX: 0.68 }),
        change: d => { const k = (ruleIndex(r) + d + 4) % 4; r.mode = k % 2 ? 'stock' : 'time'; r.teams = k >= 2; } },
      { x: 141, y: 215, w: 351, h: 58, size: 38,
        draw: (ctx, it, on) => valuePill(r.mode === 'stock' ? 'Stock.' : 'Time.', () => (c, x, cy, size) => {
          text(c, r.mode === 'stock' ? String(r.stocks) : timeLabel(r.time), x - 6, cy, { size: size * 0.85, align: 'right', color: '#fbf4e9', stroke: '#222', strokeW: 3, font: RFONT, italic: false });
          if (r.mode !== 'stock') text(c, 'MIN', x + 4, cy - 2, { size: size * 0.5, color: '#151515', font: RFONT, italic: false });
          if (on) { arrow(c, x - 64, it.y + it.h / 2, -1, 9, '#ff2020'); arrow(c, x + 70, it.y + it.h / 2, 1, 9, '#ff2020'); }
        }, { valueX: 0.66 })(ctx, it, on),
        change: d => {
          if (r.mode === 'stock') r.stocks = ((r.stocks - 1 + d + 99) % 99) + 1;
          else { const seq = r.time === 0 ? 100 : r.time; let n = seq + d; if (n > 100) n = 1; if (n < 1) n = 100; r.time = n === 100 ? 0 : n; }
        } },
      { label: 'VS Options', x: 93, y: 300, w: 351, h: 56, size: 38, act: () => this.go('vsoptions') },
    ];
  }
}

export class OptionScreen extends PillMenu {
  constructor(app, p) { super(app, p, 'option'); this.icon = 'option'; this.caption = 'Option'; }
  back() { this.go('modeselect'); }
  makeItems() {
    const o = this.save.data.options, d = this.save.data;
    const choice = (opts, get) => (c, x, cy, size, on) => {
      let xx = x;
      opts.forEach((s, k) => {
        if (k) { text(c, '/', xx, cy, { size: size * 0.8, color: '#1a1a1a', font: RFONT, italic: false }); xx += 12; }
        const act = get() === k;
        text(c, s, xx, cy, { size: size * 0.8, color: act ? '#fbf4e9' : '#3a1010', stroke: act ? '#500' : null, strokeW: 3, font: RFONT, italic: false });
        c.font = `700 ${size * 0.8}px ${RFONT}`; xx += c.measureText(s).width + 4;
      });
    };
    return [
      { x: 230, y: 84, w: 330, h: 42, size: 30, draw: valuePill('Sound', () => choice(['Stereo', 'Mono'], () => (o.sound === 'mono' ? 1 : 0)), { labelX: 14, valueX: 0.42, arrows: false }),
        change: () => { o.sound = o.sound === 'mono' ? 'stereo' : 'mono'; } },
      { label: 'Screen Adjust', x: 190, y: 180, w: 320, h: 42, size: 30, act: () => this.go('screenadjust') },
      { label: 'Backup Clear', x: 150, y: 276, w: 320, h: 42, size: 30, act: () => this.go('backupclear') },
      { x: 92, y: 372, w: 320, h: 42, size: 28, draw: valuePill('Unlock All', () => choice(['ON', 'OFF'], () => (d.unlockAll ? 0 : 1)), { labelX: 14, valueX: 0.6, arrows: false }),
        change: () => { d.unlockAll = !d.unlockAll; } },
    ];
  }
}

export class DataMenuScreen extends PillMenu {
  constructor(app, p) { super(app, p, 'data'); this.icon = 'data'; this.caption = 'Data'; }
  back() { this.go('modeselect'); }
  makeItems() {
    const it = [
      { label: 'Characters', x: 270, y: 85, w: 315, h: 55, size: 38, act: () => this.go('datachars') },
      { label: 'VS Record', x: 205, y: 180, w: 315, h: 55, size: 38, act: () => this.go('vsrecord') },
    ];
    if (this.save.isUnlocked('soundtest')) it.push({ label: 'Sound Test', x: 140, y: 275, w: 315, h: 55, size: 38, act: () => this.go('soundtest') });
    return it;
  }
}

// ---------------------------------------------------------------- Option > Backup Clear
const CLEAR_ITEMS = [
  ['Newcomers', d => { for (const k in d.unlocked) d.unlocked[k] = false; }],
  ['1P High Score', d => { d.records.oneP = []; d.records.oneP_hi = {}; }],
  ['Bonus Stage Time', d => { d.records.btt = {}; d.records.btp = {}; }],
  ['VS Record', d => { d.records.vs = { chars: {}, matrix: {} }; d.vsPlays = 0; }],
  ['Prize', d => { d.prize = {}; }],
  ['ALL Data Clear', null],
];
export class BackupClearScreen extends MenuScreen {
  constructor(app, p) { super(app, p); this.sel = 0; this.ask = null; this.msg = 0; }
  tick(i) {
    if (this.ask !== null) {
      if (i.left || i.right || i.up || i.down) { this.ask = 1 - this.ask; this.audio.sfx('menuMove'); }
      if (i.b) { this.ask = null; this.audio.sfx('menuBack'); }
      else if (i.a || i.start) {
        if (this.ask === 0) {
          const [, fn] = CLEAR_ITEMS[this.sel];
          if (fn) fn(this.save.data); else { try { localStorage.removeItem('smash64-save-v1'); } catch {} this.app.save.data = new this.app.save.constructor().data; }
          this.save.write(); this.audio.sfx('select'); this.msg = 90;
        } else this.audio.sfx('menuBack');
        this.ask = null;
      }
      return;
    }
    if (this.msg > 0) this.msg--;
    if (i.up) { this.sel = (this.sel + 5) % 6; this.audio.sfx('menuMove'); }
    if (i.down) { this.sel = (this.sel + 1) % 6; this.audio.sfx('menuMove'); }
    if (i.a || i.start) { this.ask = 1; this.audio.sfx('menuOk'); }
    if (i.b) { this.audio.sfx('menuBack'); this.go('option'); }
  }
  draw(ctx) {
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, 640, 480);
    drawHeaderTab(ctx, 'OPTION', 'Backup Clear');
    CLEAR_ITEMS.forEach(([s], k) => {
      const on = k === this.sel, y = 108 + k * 54;
      ctx.save(); roundRect(ctx, 192, y, 256, 36, 18); ctx.fillStyle = on ? '#1a1400' : '#000'; ctx.fill();
      ctx.lineWidth = 2.5; ctx.strokeStyle = on ? '#f0c010' : '#8a5a10'; ctx.stroke(); ctx.restore();
      text(ctx, s, 320, y + 27, { size: 24, align: 'center', color: on ? '#f8d040' : '#9a6a20', font: RFONT, italic: false, weight: 700 });
    });
    if (this.ask !== null) {
      ctx.fillStyle = 'rgba(0,0,0,0.75)'; ctx.fillRect(0, 0, 640, 480);
      ctx.save(); roundRect(ctx, 150, 170, 340, 140, 14); ctx.fillStyle = '#20180a'; ctx.fill(); ctx.strokeStyle = '#f0c010'; ctx.lineWidth = 3; ctx.stroke(); ctx.restore();
      text(ctx, `Clear "${CLEAR_ITEMS[this.sel][0]}"?`, 320, 214, { size: 22, align: 'center', color: '#fff', font: RFONT, italic: false });
      ['YES', 'NO'].forEach((s, k) => {
        const on = this.ask === k;
        text(ctx, s, 260 + k * 120, 274, { size: 30, align: 'center', color: on ? '#ff2020' : '#777', font: BFONT, italic: false });
        if (on) { ctx.strokeStyle = '#ff2020'; ctx.lineWidth = 3; ctx.strokeRect(220 + k * 120, 242, 80, 42); }
      });
    }
    if (this.msg > 0) text(ctx, 'Data cleared.', 320, 455, { size: 20, align: 'center', color: '#f0c010', font: RFONT, italic: false });
  }
}
// ---------------------------------------------------------------- Option > Screen Adjust
export function applyScreenAdjust(app) {
  const o = app.save.data.options;
  app.wrap.style.transform = `translate(calc(-50% + ${o.screenX ?? 0}px), calc(-50% + ${o.screenY ?? 0}px))`;
}
export class ScreenAdjustScreen extends MenuScreen {
  tick(i) {
    const o = this.save.data.options;
    const d = (i.left ? -2 : i.right ? 2 : 0), e = (i.up ? -2 : i.down ? 2 : 0);
    if (d || e) { o.screenX = Math.max(-40, Math.min(40, (o.screenX ?? 0) + d)); o.screenY = Math.max(-40, Math.min(40, (o.screenY ?? 0) + e)); applyScreenAdjust(this.app); this.audio.sfx('menuMove'); }
    if (i.z || i.r) { o.screenX = 0; o.screenY = 0; applyScreenAdjust(this.app); }
    if (i.a || i.b || i.start) { this.save.write(); this.audio.sfx(i.b ? 'menuBack' : 'menuOk'); this.go('option'); }
  }
  draw(ctx) {
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, 640, 480);
    ctx.strokeStyle = '#f8f8f8'; ctx.lineWidth = 3; ctx.strokeRect(24, 24, 592, 432);
    for (const [x, y, dx, dy] of [[24, 24, 1, 1], [616, 24, -1, 1], [24, 456, 1, -1], [616, 456, -1, -1]]) {
      ctx.fillStyle = '#ff2020'; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + dx * 40, y); ctx.lineTo(x, y + dy * 40); ctx.closePath(); ctx.fill();
    }
    drawHeaderTab(ctx, 'OPTION', 'Screen Adjust');
    const o = this.save.data.options;
    text(ctx, 'Move the picture so the red corners are visible.', 320, 220, { size: 20, align: 'center', color: '#ddd', font: RFONT, italic: false });
    text(ctx, `X ${o.screenX ?? 0}   Y ${o.screenY ?? 0}`, 320, 262, { size: 26, align: 'center', color: '#f0c010', font: RFONT, italic: false });
    text(ctx, 'Stick: move    Z/R: reset    A: OK', 320, 410, { size: 16, align: 'center', color: '#999', font: RFONT, italic: false });
  }
}
