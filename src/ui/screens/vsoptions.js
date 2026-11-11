// VS Options (Handicap / Team Attack / Stage Select / Damage / Item Switch) and the Item Switch page.
import { MenuScreen, drawCollage, drawModeIcon, pill, RFONT, BFONT } from '../menu.js';
import { text, roundRect } from '../draw.js';
import { ITEM_SWITCH, ITEM_FREQUENCIES } from '../../items/index.js';

export const ITEM_LIST = ITEM_SWITCH.map(s => [s.id, s.label]);
export const ITEM_FREQ = ITEM_FREQUENCIES.map(f => [f.id, f.label]);

export function itemSwitchOf(rules) {
  const s = {}; for (const [id] of ITEM_LIST) s[id] = rules.itemSwitch?.[id] ?? true; return s;
}

function optionsBG(ctx, sub) {
  ctx.fillStyle = '#080000'; ctx.fillRect(0, 0, 640, 480);
  drawCollage(ctx, 0.35);
  ctx.fillStyle = 'rgba(8,0,0,0.55)'; ctx.fillRect(0, 0, 640, 480);
  drawModeIcon(ctx, 'vs', 120, 130, 120, { line: '#523326', fill: 'rgba(0,0,0,0)', lw: 9, disc: true });
  ctx.fillStyle = '#808080'; ctx.fillRect(430, 64, 210, 10);
  text(ctx, 'VS Options', 300, 74, { size: 40, align: 'center', color: '#ebc10e', stroke: '#3a2a00', strokeW: 4, font: RFONT, weight: 900 });
  if (sub) text(ctx, sub, 600, 60, { size: 16, align: 'right', color: '#e8e8e8', font: BFONT, italic: false, weight: 700 });
}

// "ON/AUTO/OFF" style inline choices; returns nothing
function choices(ctx, x, y, size, opts, active, under) {
  let xx = x;
  ctx.font = `700 ${size}px ${RFONT}`;
  opts.forEach((s, k) => {
    if (k) { text(ctx, '/', xx, y, { size, color: '#303030', font: RFONT, italic: false, weight: 700 }); xx += ctx.measureText('/').width + 2; }
    const on = k === active;
    text(ctx, s, xx, y, { size, color: on ? '#f80028' : '#303030', font: RFONT, italic: false, weight: 700 });
    ctx.font = `700 ${size}px ${RFONT}`; const w = ctx.measureText(s).width;
    if (on && under) { ctx.fillStyle = '#f80028'; ctx.fillRect(xx, y + 3, w, 3); }
    xx += w + 2;
  });
}

export class VSOptionsScreen extends MenuScreen {
  constructor(app, p) { super(app, p); this.sel = 0; }
  get r() { return this.save.data.vsRules; }
  rows() {
    const r = this.r;
    const rows = [
      { label: 'Handicap', opts: ['ON', 'AUTO', 'OFF'], get: () => ['on', 'auto', 'off'].indexOf(r.handicap ?? 'off'), set: k => { r.handicap = ['on', 'auto', 'off'][k]; } },
      { label: 'Team Attack', opts: ['ON', 'OFF'], get: () => (r.teamAttack ? 0 : 1), set: k => { r.teamAttack = k === 0; } },
      { label: 'Stage Select', opts: ['ON', 'OFF'], get: () => (r.stageSelect === false ? 1 : 0), set: k => { r.stageSelect = k === 0; } },
      { label: 'Damage', damage: true },
    ];
    if (this.save.isUnlocked('itemswitch')) rows.push({ label: 'Item Switch', act: true });
    return rows;
  }
  tick(i) {
    const rows = this.rows(), row = rows[this.sel], r = this.r;
    if (i.up) { this.sel = (this.sel + rows.length - 1) % rows.length; this.audio.sfx('menuMove'); }
    if (i.down) { this.sel = (this.sel + 1) % rows.length; this.audio.sfx('menuMove'); }
    if (i.left || i.right) {
      const d = i.left ? -1 : 1;
      if (row.opts) { const k = row.get() + d; if (k >= 0 && k < row.opts.length) { row.set(k); this.audio.sfx('menuMove'); } }
      if (row.damage) { r.damage = Math.max(50, Math.min(200, (r.damage ?? 100) + d * 10)); this.audio.sfx('menuMove'); }
      this.save.write();
    }
    if ((i.a || i.start) && row.act) this.confirm(() => this.go('itemswitch'));
    if (i.b) { this.save.write(); this.audio.sfx('menuBack'); this.go('vsmenu'); }
  }
  draw(ctx) {
    optionsBG(ctx);
    const r = this.r;
    this.rows().forEach((row, k) => {
      const on = k === this.sel, x = 230 - k * 16, y = 120 + k * 58, w = 350, h = 36;
      pill(ctx, x, y, w, h, on ? (this.flash > 0 ? '#ffffff' : '#f0c008') : '#8080a6', { r: 12 });
      const cy = y + 28;
      if (row.opts) {
        text(ctx, row.label, x + w * 0.47, cy, { size: 24, align: 'right', color: '#000', font: RFONT, italic: false, weight: 700 });
        choices(ctx, x + w * 0.49, cy, row.opts.length > 2 ? 20 : 23, row.opts, row.get(), on);
      } else if (row.damage) {
        text(ctx, 'Damage', x + w * 0.45, cy, { size: 24, align: 'right', color: '#000', font: RFONT, italic: false, weight: 700 });
        text(ctx, String(r.damage ?? 100), x + w * 0.66, cy, { size: 26, align: 'right', color: '#eb1139', font: RFONT, italic: false, weight: 700 });
        text(ctx, '%', x + w * 0.7, cy, { size: 25, color: '#000', font: RFONT, italic: false, weight: 700 });
        if (on) { ctx.fillStyle = '#eb1139'; ctx.fillRect(x + w * 0.5, cy + 3, w * 0.16, 3); }
      } else text(ctx, row.label, x + w / 2, cy, { size: 25, align: 'center', color: '#000', font: RFONT, italic: false, weight: 700 });
    });
  }
}

export class ItemSwitchScreen extends MenuScreen {
  constructor(app, p) { super(app, p); this.sel = 0; }
  tick(i) {
    const r = this.save.data.vsRules, n = ITEM_LIST.length + 1;
    if (i.up) { this.sel = (this.sel + n - 1) % n; this.audio.sfx('menuMove'); }
    if (i.down) { this.sel = (this.sel + 1) % n; this.audio.sfx('menuMove'); }
    const d = i.left ? -1 : i.right ? 1 : (i.a ? 2 : 0);
    if (d) {
      if (this.sel === 0) {
        const k = ITEM_FREQ.findIndex(f => f[0] === (r.items ?? 'middle'));
        const nk = d === 2 ? (k + 1) % ITEM_FREQ.length : Math.max(0, Math.min(ITEM_FREQ.length - 1, k + d));
        r.items = ITEM_FREQ[nk][0];
      } else {
        const sw = r.itemSwitch = itemSwitchOf(r), id = ITEM_LIST[this.sel - 1][0];
        sw[id] = d === 2 ? !sw[id] : d < 0;
      }
      this.audio.sfx('menuMove'); this.save.write();
    }
    if (i.b || i.start) { this.audio.sfx('menuBack'); this.go('vsoptions'); }
  }
  draw(ctx) {
    optionsBG(ctx, 'ITEM SWITCH');
    ctx.fillStyle = 'rgba(0,0,0,0.8)'; ctx.fillRect(230, 82, 380, 390);
    const r = this.save.data.vsRules, sw = itemSwitchOf(r);
    const rowY = k => 104 + k * 22.5;
    const sel = this.sel, y = rowY(sel);
    ctx.save(); roundRect(ctx, 236, y - 17, 360, 22, 10); ctx.strokeStyle = '#f0c008'; ctx.lineWidth = 2; ctx.stroke();
    ctx.beginPath(); ctx.arc(240, y - 6, 6, 0, Math.PI * 2); ctx.fillStyle = '#f0c008'; ctx.fill(); ctx.restore();
    text(ctx, 'Appearance %', 252, rowY(0), { size: 18, color: '#fff', font: RFONT, italic: false, weight: 700 });
    text(ctx, ITEM_FREQ.find(f => f[0] === (r.items ?? 'middle'))?.[1] ?? 'Middle', 586, rowY(0), { size: 19, align: 'right', color: '#f80028', font: RFONT, italic: false, weight: 700 });
    ITEM_LIST.forEach(([id, name], k) => {
      const yy = rowY(k + 1);
      text(ctx, name, 252, yy, { size: 17, color: '#fff', font: RFONT, italic: false, weight: 700 });
      text(ctx, 'ON', 486, yy, { size: 17, color: sw[id] ? '#f80028' : '#5a5a5a', font: RFONT, italic: false, weight: 700 });
      text(ctx, '/', 514, yy, { size: 17, color: '#5a5a5a', font: RFONT, italic: false, weight: 700 });
      text(ctx, 'OFF', 524, yy, { size: 17, color: !sw[id] ? '#f80028' : '#5a5a5a', font: RFONT, italic: false, weight: 700 });
    });
  }
}
