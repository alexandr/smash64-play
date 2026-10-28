// Mode Select: "Mode Select" plate top-left, four round icons on a diagonal (1P MODE, VS MODE, OPTION,
// DATA) with red labels; the highlighted icon turns light gray. Remembers the last item.
import { MenuScreen, drawCollage, drawModeIcon, drawSmashEmblem, RFONT, BFONT } from '../menu.js';
import { text } from '../draw.js';

const ITEMS = [
  { kind: '1p', label: '1P MODE', x: 380, y: 100, to: 'menu1p' },
  { kind: 'vs', label: 'VS MODE', x: 302, y: 176, to: 'vsmenu' },
  { kind: 'option', label: 'OPTION', x: 226, y: 250, to: 'option' },
  { kind: 'data', label: 'DATA', x: 150, y: 326, to: 'datamenu' },
];

export class ModeSelectScreen extends MenuScreen {
  constructor(app, p) { super(app, p); this.sel = app.menuMemory?.mode ?? 0; }
  enter() { this.app.audio.music('menu'); }
  tick(i) {
    if (i.up || i.right) { this.sel = (this.sel + 3) % 4; this.audio.sfx('menuMove'); }
    if (i.down || i.left) { this.sel = (this.sel + 1) % 4; this.audio.sfx('menuMove'); }
    if (i.a || i.start) {
      (this.app.menuMemory ??= {}).mode = this.sel;
      this.confirm(() => this.go(ITEMS[this.sel].to));
    }
    if (i.b) { this.audio.sfx('menuBack'); this.go('title'); }
  }
  draw(ctx) {
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, 640, 480);
    drawCollage(ctx);
    drawSmashEmblem(ctx, 510, 335, 62, '#082e58');
    // title plate
    ctx.save(); ctx.fillStyle = '#08294a';
    ctx.beginPath(); ctx.moveTo(0, 58); ctx.lineTo(262, 58); ctx.lineTo(236, 124); ctx.lineTo(0, 124); ctx.closePath(); ctx.fill(); ctx.restore();
    const tt = { size: 44, color: '#3973b3', stroke: '#9cc0e8', strokeW: 2, font: RFONT, italic: false, weight: 900, shadow: '#0a1830', sx: 3, sy: 3 };
    text(ctx, 'Mode', 44, 78, tt);
    text(ctx, 'Select', 44, 120, tt);
    ITEMS.forEach((it, i) => {
      const on = i === this.sel, white = on && this.flash > 0 && this.flash % 2 === 1;
      drawModeIcon(ctx, it.kind, it.x, it.y, 46, on ? { fill: white ? '#ffffff' : '#d7d7d6', line: '#3a3a3a', lw: 3 } : { fill: '#1a1a1a', line: '#9c9c9c', lw: 3 });
      text(ctx, it.label, it.x + 58, it.y + 18, { size: 26, color: '#ff0000', font: BFONT, italic: false, weight: 900, stroke: '#300', strokeW: 2 });
    });
  }
}
