// Data > Characters (bio pages with the model performing moves), Data > VS Record (BATTLE SCORE grid of
// KOs between characters + a per-character record page) and Data > Sound Test.
import { MenuScreen, RFONT, BFONT, drawHeaderTab, drawSmashEmblem, arrow } from '../menu.js';
import { text, roundRect } from '../draw.js';
import { drawEmblem } from '../hud.js';
import { ROSTER, CHARS, STARTERS } from '../../chars/index.js';
import { MenuFighter, portrait } from '../render3d.js';
import { TRACKS } from '../../core/music.js';

// Original short bios written for this recreation, plus each character's notable games.
export const BIOS = {
  mario: { name: 'Mario', bio: "The plumber from Brooklyn who became the face of a whole kingdom. Mario is the all-rounder: quick on his feet, solid in the air and never short of tricks. His fireballs bounce along the floor and his cape-less tornado pulls foes in.", works: [['Donkey Kong', 'Arcade'], ['Super Mario Bros.', 'NES'], ['Super Mario 64', 'N64']], sp: ['Fireball', 'Super Jump Punch', 'Mario Tornado'] },
  dk: { name: 'Donkey Kong', bio: "The muscle of the jungle. Donkey Kong trades speed for raw power: his wound-up punch can end a stock outright, and he can carry a foe anywhere he likes. Heavy and hard to launch, but a big target.", works: [['Donkey Kong Country', 'SNES'], ['Donkey Kong 64', 'N64']], sp: ['Giant Punch', 'Spinning Kong', 'Hand Slap'] },
  link: { name: 'Link', bio: "A young hero of few words who carries a sword, a shield and a bag of tools. Link fights at range with arrows, boomerang and bombs, then finishes with long sword swings. His recovery is short, so mind the edges.", works: [['The Legend of Zelda', 'NES'], ['A Link to the Past', 'SNES'], ['Ocarina of Time', 'N64']], sp: ['Boomerang', 'Spin Attack', 'Bomb'] },
  samus: { name: 'Samus', bio: "A bounty hunter sealed inside a powered suit. Samus charges her arm cannon between exchanges and releases a blast that can cross the whole stage. Floaty and hard to read, she rewards patience.", works: [['Metroid', 'NES'], ['Super Metroid', 'SNES']], sp: ['Charge Shot', 'Screw Attack', 'Bomb'] },
  yoshi: { name: 'Yoshi', bio: "A cheerful dinosaur who gulps opponents down and drops them out as eggs. Yoshi has a heavy-armored double jump instead of a third, and a falling body slam that shakes the ground. Comes in a rainbow of colors.", works: [["Super Mario World", 'SNES'], ["Yoshi's Island", 'SNES'], ["Yoshi's Story", 'N64']], sp: ['Egg Lay', 'Egg Throw', 'Yoshi Bomb'] },
  kirby: { name: 'Kirby', bio: "A small pink traveler with a huge appetite. Kirby can inhale a rival and copy their special move, float with five extra jumps and turn into a heavy stone. Light enough to fly far, tough enough to keep coming back.", works: [["Kirby's Dream Land", 'GB'], ["Kirby's Adventure", 'NES'], ['Kirby 64', 'N64']], sp: ['Swallow', 'Final Cutter', 'Stone'] },
  fox: { name: 'Fox', bio: "Leader of a mercenary flight team. Out of his ship Fox is the fastest fighter here, with a blaster that fires without pause and a reflector that turns shots back. Falls fast and combos hard.", works: [['Star Fox', 'SNES'], ['Star Fox 64', 'N64']], sp: ['Blaster', 'Fire Fox', 'Reflector'] },
  pikachu: { name: 'Pikachu', bio: "An electric mouse with a spark in each cheek. Pikachu zips across the stage with Quick Attack, calls down thunder from above and keeps foes at bay with crawling bolts. Small, nimble and surprisingly strong.", works: [['Pokémon Red & Blue', 'GB'], ['Pokémon Stadium', 'N64']], sp: ['Thunder Jolt', 'Quick Attack', 'Thunder'] },
  luigi: { name: 'Luigi', bio: "Mario's taller younger brother, always one step behind and one jump higher. Luigi slides on the ground, floats on his jumps and hides a fiery uppercut that only lands at point-blank range.", works: [['Mario Bros.', 'Arcade'], ['Super Mario Bros. 2', 'NES']], sp: ['Fireball', 'Super Jump Punch', 'Luigi Cyclone'] },
  ness: { name: 'Ness', bio: "A boy from a quiet town with a baseball bat and strong psychic powers. Ness steers his PK Thunder through the air and can even hit himself with it to fly back to the stage. A tricky recovery to master.", works: [['EarthBound', 'SNES']], sp: ['PK Fire', 'PK Thunder', 'PSI Magnet'] },
  falcon: { name: 'Captain Falcon', bio: "A racing pilot and bounty hunter who fights the way he drives: fast and loud. Captain Falcon runs at top speed and lands a burning punch that is slow to start but devastating when it connects.", works: [['F-Zero', 'SNES']], sp: ['Falcon Punch', 'Falcon Dive', 'Falcon Kick'] },
  jigglypuff: { name: 'Jigglypuff', bio: "A round balloon-like Pokémon whose song puts anyone to sleep. Jigglypuff floats with many mid-air jumps and rolls into foes, but it is the lightest fighter, so one clean hit can send it flying.", works: [['Pokémon Red & Blue', 'GB']], sp: ['Rollout', 'Sing', 'Rest'] },
};
const DEMO = [['jab1', 'A  Punch'], ['ftilt', '→+A  Tilt'], ['fsmash', '→+A  Smash'], ['usmash', '↑+A  Smash'], ['nspecial', 'B  {0}'], ['uspecial', '↑+B  {1}'], ['dspecial', '↓+B  {2}'], ['fair', 'Air →+A']];

function wrap(ctx, str, maxW, font) {
  ctx.font = font; const out = []; let line = '';
  for (const w of str.split(' ')) { const t = line ? line + ' ' + w : w; if (ctx.measureText(t).width > maxW && line) { out.push(line); line = w; } else line = t; }
  if (line) out.push(line); return out;
}

export class DataCharsScreen extends MenuScreen {
  constructor(app, p) { super(app, p); this.list = ROSTER.filter(id => STARTERS.includes(id) || this.save.isUnlocked(id)); this.k = 0; this.model = null; this.demo = 0; this.mf = 0; }
  enter() { this.setChar(); }
  exit() { this.model?.dispose(); }
  setChar() {
    this.model?.dispose(); this.demo = 0; this.mf = -30;
    try { this.model = new MenuFighter(this.list[this.k], 0, { yaw: 0.9 }); } catch { this.model = null; }
  }
  tick(i) {
    if (i.left || i.right || i.l || i.r) { this.k = (this.k + (i.left || i.l ? -1 : 1) + this.list.length) % this.list.length; this.audio.sfx('menuMove'); this.setChar(); }
    if (i.b) { this.audio.sfx('menuBack'); this.go('datamenu'); }
    this.mf++;
    const id = DEMO[this.demo][0], mv = CHARS[this.list[this.k]].moves?.[id];
    if (!mv || this.mf > (mv.total ?? 30) + 25) { this.demo = (this.demo + 1) % DEMO.length; this.mf = -15; }
  }
  draw(ctx) {
    const id = this.list[this.k], b = BIOS[id];
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, 640, 480);
    drawSmashEmblem(ctx, 140, 160, 175, '#3a3a3a');
    drawEmblem(ctx, CHARS[id].series, 140, 160, 70, 'rgba(90,90,90,0.8)');
    ctx.fillStyle = '#5a5550'; ctx.fillRect(30, 46, 280, 8);
    text(ctx, 'DATA', 110, 60, { size: 15, color: '#6b6560', font: BFONT, italic: false, align: 'center', stroke: '#000', strokeW: 3 });
    ctx.save(); ctx.strokeStyle = '#a04a10'; ctx.lineWidth = 3; roundRect(ctx, 20, 76, 220, 90, 40); ctx.stroke(); ctx.restore();
    text(ctx, b.name, 34, 150, { size: b.name.length > 8 ? 40 : 66, color: 'rgba(240,120,30,0.75)', font: '"DejaVu Serif", serif', weight: 400, scaleX: b.name.length > 10 ? 0.75 : 1 });
    // header tab
    ctx.save(); ctx.fillStyle = '#3e3a34'; ctx.beginPath(); ctx.moveTo(310, 22); ctx.lineTo(620, 22); ctx.quadraticCurveTo(634, 22, 634, 36); ctx.lineTo(634, 70); ctx.lineTo(310, 70); ctx.closePath(); ctx.fill(); ctx.restore();
    text(ctx, 'Characters', 600, 64, { size: 38, align: 'right', gradient: ['#fff27a', '#f0c010', '#b07800'], stroke: '#3a2400', strokeW: 5, font: RFONT, italic: false });
    arrow(ctx, 538, 84, -1, 7, '#f08020'); arrow(ctx, 592, 84, 1, 7, '#f08020');
    // bio
    const lines = wrap(ctx, b.bio, 360, `400 17px ${RFONT}`);
    lines.forEach((l, k) => text(ctx, l, 252, 122 + k * 24, { size: 17, color: '#fff', font: RFONT, italic: false, weight: 400 }));
    // works box
    ctx.save(); roundRect(ctx, 236, 360, 390, 108, 10); ctx.fillStyle = '#101010'; ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = '#6a6a6a'; ctx.stroke(); ctx.restore();
    ctx.save(); ctx.translate(258, 418); ctx.rotate(-Math.PI / 2); text(ctx, 'Works', 0, 0, { size: 20, align: 'center', color: '#8a8a8a', font: RFONT, weight: 700 }); ctx.restore();
    b.works.forEach(([g, sys], k) => {
      text(ctx, '·' + g, 280, 392 + k * 28, { size: 19, color: '#fff', font: RFONT, italic: false, weight: 700 });
      text(ctx, `(${sys})`, 612, 392 + k * 28, { size: 17, align: 'right', color: '#fff', font: RFONT, italic: false, weight: 700 });
    });
    // model performing moves
    if (this.model) {
      const [mvId, cap] = DEMO[this.demo];
      if (this.mf < 0 || !this.model.move(mvId, this.mf)) this.model.pose(this.t);
      this.model.draw(ctx, 10, 190, 230, 250, 'full', { margin: 1.25 });
      text(ctx, cap.replace(/\{(\d)\}/, (_, n) => b.sp[n]), 24, 462, { size: 20, color: '#fff', stroke: '#000', strokeW: 3, font: RFONT, italic: false });
    }
  }
}

// ---------------------------------------------------------------- VS Record
export class VSRecordScreen extends MenuScreen {
  constructor(app, p) { super(app, p); this.page = 0; }
  tick(i) {
    if (i.left || i.right || i.r || i.z || i.a) { this.page = 1 - this.page; this.audio.sfx('menuMove'); }
    if (i.b) { this.audio.sfx('menuBack'); this.go('datamenu'); }
  }
  draw(ctx) {
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, 640, 480);
    const vs = this.save.data.records.vs ?? { chars: {}, matrix: {} };
    const mx = vs.matrix ?? {}, chs = vs.chars ?? {};
    ctx.fillStyle = '#5a5550'; ctx.fillRect(30, 50, 170, 8);
    text(ctx, 'DATA', 110, 58, { size: 15, color: '#6b6560', font: BFONT, italic: false, align: 'center', stroke: '#000', strokeW: 3 });
    text(ctx, 'VS Record', 440, 60, { size: 38, align: 'right', gradient: ['#fff27a', '#f0c010', '#b07800'], stroke: '#3a2400', strokeW: 5, font: RFONT, italic: false });
    ctx.save(); ctx.fillStyle = '#3e3a34'; ctx.beginPath(); ctx.moveTo(448, 28); ctx.lineTo(616, 28); ctx.quadraticCurveTo(628, 28, 628, 40); ctx.lineTo(628, 62); ctx.lineTo(448, 62); ctx.closePath(); ctx.fill(); ctx.restore();
    text(ctx, this.page === 0 ? 'BATTLE SCORE' : 'CHARACTERS', 538, 54, { size: 16, align: 'center', color: '#e8e8e8', font: BFONT, italic: false });
    arrow(ctx, 592, 70, 1, 6, '#f08020');
    const head = (id, x, y, s = 28) => { ctx.drawImage(portrait(id, 88, 82), x, y, s, s * 0.93); };
    if (this.page === 0) {
      const tot = id => Object.values(mx[id] ?? {}).reduce((a, b) => a + b, 0);
      const rows = [...ROSTER].sort((a, b) => tot(b) - tot(a));
      const x0 = 30, y0 = 76, cw = 38, rh = 29;
      ctx.strokeStyle = '#8a8a8a'; ctx.lineWidth = 1;
      ctx.strokeRect(x0, y0, 600, rh * 13 + 4);
      rows.forEach((id, k) => head(id, x0 + 50 + k * cw + 4, y0 + 2, 30));
      text(ctx, 'Total', x0 + 50 + 12 * cw + 30, y0 + 24, { size: 16, align: 'center', color: '#e8e8e8', font: RFONT, italic: false, weight: 700 });
      rows.forEach((a, r) => {
        const y = y0 + rh * (r + 1) + 2;
        ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x0 + 600, y); ctx.stroke();
        head(a, x0 + 6, y + 1, 30);
        rows.forEach((b, c) => text(ctx, String(mx[a]?.[b] ?? 0), x0 + 50 + c * cw + 22, y + 22, { size: 15, align: 'center', color: '#fff', font: '"DejaVu Sans Mono", monospace', italic: false }));
        text(ctx, String(tot(a)), x0 + 50 + 12 * cw + 30, y + 22, { size: 15, align: 'center', color: '#fff', font: '"DejaVu Sans Mono", monospace', italic: false });
      });
    } else {
      const cols = ['Plays', 'Wins', 'Win%', 'KOs', 'Falls', 'SDs', 'Dmg/Gm'];
      const x0 = 30, y0 = 84, rh = 30;
      cols.forEach((c, k) => text(ctx, c, 190 + k * 64, y0 + 18, { size: 15, align: 'center', color: '#f0c010', font: RFONT, italic: false, weight: 700 }));
      ROSTER.forEach((id, r) => {
        const y = y0 + 28 + r * rh, c = chs[id] ?? {};
        ctx.fillStyle = r % 2 ? '#141414' : '#202020'; ctx.fillRect(x0, y, 600, rh - 2);
        head(id, x0 + 4, y, 28);
        text(ctx, CHARS[id].name, x0 + 40, y + 20, { size: 14, color: '#fff', font: RFONT, italic: false, weight: 700 });
        const plays = c.plays ?? 0;
        const vals = [plays, c.wins ?? 0, plays ? Math.round(100 * (c.wins ?? 0) / plays) + '%' : '-', c.kos ?? 0, c.falls ?? 0, c.sds ?? 0, plays ? Math.round((c.dmgGiven ?? 0) / plays) : '-'];
        vals.forEach((v, k) => text(ctx, String(v), 190 + k * 64, y + 20, { size: 15, align: 'center', color: '#fff', font: '"DejaVu Sans Mono", monospace', italic: false }));
      });
      text(ctx, `Total VS matches: ${this.save.data.vsPlays ?? 0}`, 320, 470, { size: 14, align: 'center', color: '#aaa', font: RFONT, italic: false });
    }
  }
}

// ---------------------------------------------------------------- Sound Test
const SFX = ['menuMove', 'menuOk', 'menuBack', 'select', 'hitS', 'hitM', 'hitL', 'fire', 'elec', 'slash', 'whiff', 'jump', 'jump2', 'land', 'dash', 'shieldHit', 'shieldBreak', 'grab', 'ko', 'star', 'respawn', 'count', 'go', 'item', 'heal', 'explode', 'shoot', 'laser', 'bump', 'target', 'clap', 'warn'];
const VOICE = ['Super Smash Bros.', 'Free for all!', 'Team battle!', 'Choose your character!', 'Three', 'Two', 'One', 'Go!', 'Game set!', 'Time up!', 'Sudden death!', 'This game\'s winner is', 'No contest', 'Complete!', 'Failure', 'Continue?', 'Game over', 'Mario', 'Donkey Kong', 'Link', 'Samus', 'Yoshi', 'Kirby', 'Fox', 'Pikachu', 'Luigi', 'Ness', 'Captain Falcon', 'Jigglypuff'];
export class SoundTestScreen extends MenuScreen {
  constructor(app, p) { super(app, p); this.row = 0; this.v = [0, 0, 0]; this.tracks = Object.keys(TRACKS); }
  tick(i) {
    const n = [this.tracks.length, SFX.length, VOICE.length][this.row];
    if (i.up) { this.row = (this.row + 2) % 3; this.audio.sfx('menuMove'); }
    if (i.down) { this.row = (this.row + 1) % 3; this.audio.sfx('menuMove'); }
    if (i.left) this.v[this.row] = (this.v[this.row] + n - 1) % n;
    if (i.right) this.v[this.row] = (this.v[this.row] + 1) % n;
    if (i.a || i.start) {
      if (this.row === 0) { this.app.audio.stopMusic(); this.app.audio.music(this.tracks[this.v[0]]); }
      else if (this.row === 1) this.audio.sfx(SFX[this.v[1]]);
      else this.audio.say(VOICE[this.v[2]]);
    }
    if (i.z) this.app.audio.stopMusic();
    if (i.b) { this.audio.sfx('menuBack'); this.app.audio.music('menu'); this.go('datamenu'); }
  }
  draw(ctx) {
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, 640, 480);
    drawHeaderTab(ctx, 'DATA', 'Sound Test');
    ['MUSIC', 'SOUND', 'VOICE'].forEach((s, k) => {
      const y = 130 + k * 92, on = k === this.row;
      ctx.save(); roundRect(ctx, 90, y, 460, 66, 18); ctx.fillStyle = on ? '#2a2418' : '#141414'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = on ? '#f0c010' : '#4a4030'; ctx.stroke(); ctx.restore();
      text(ctx, s, 120, y + 46, { size: 36, gradient: ['#fff27a', '#f0c010', '#b07800'], stroke: '#3a2400', strokeW: 5, font: BFONT, italic: false });
      arrow(ctx, 340, y + 33, -1, 10, on ? '#ff3020' : '#602010'); arrow(ctx, 520, y + 33, 1, 10, on ? '#ff3020' : '#602010');
      text(ctx, String(this.v[k]).padStart(2, '0'), 430, y + 47, { size: 38, align: 'center', color: '#ff2020', stroke: '#300', strokeW: 3, font: BFONT, italic: false });
      const lbl = [this.tracks, SFX, VOICE][k][this.v[k]];
      if (on) text(ctx, lbl, 430, y + 82, { size: 13, align: 'center', color: '#aaa', font: RFONT, italic: false });
    });
    text(ctx, 'Ⓐ: PLAY    Ⓩ: FADE OUT    Ⓑ: EXIT', 320, 448, { size: 18, align: 'center', color: '#ddd', font: RFONT, italic: false });
  }
}
