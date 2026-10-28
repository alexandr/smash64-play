// Online play: a touch-friendly lobby (DOM overlay) and a lockstep netplay battle.
//
// Netcode: host-relay lockstep. The host collects every human's controller state each frame and
// broadcasts one input bundle per frame; every phone (host included) simulates exactly those inputs, in
// order, with Math.random seeded from the room (SeededRandom), so all simulations agree. CPU players run
// on every phone from the shared state (their AI is deterministic). Every 20 frames the host sends fighter
// state corrections to absorb floating-point drift between devices.
import { Room, MAX_PLAYERS } from './room.js';
import { SeededRandom } from './rng.js';
import { Controller, BUTTONS } from '../core/input.js';
import { BattleScreen } from '../ui/screens/battle.js';
import { Match } from '../game/match.js';
import { CpuDriver } from '../game/ai.js';
import { CHARS, ROSTER } from '../chars/index.js';
import { STAGES, VS_STAGES } from '../stages/index.js';
import { headIcon } from '../ui/render3d.js';
import { PORT_COLORS } from '../game/constants.js';

const STAGE_NAMES = { peach: "Peach's Castle", sectorz: 'Sector Z', congo: 'Congo Jungle', zebes: 'Planet Zebes', hyrule: 'Hyrule Castle',
  yoshi: "Yoshi's Island", dreamland: 'Dream Land', saffron: 'Saffron City', mushroom: 'Mushroom Kingdom', final: 'Final Destination', duelzone: 'Duel Zone', metacrystal: 'Meta Crystal' };
const CHAR_NAMES = { luigi: 'Luigi', mario: 'Mario', dk: 'Donkey Kong', link: 'Link', samus: 'Samus', falcon: 'C. Falcon', ness: 'Ness', yoshi: 'Yoshi', kirby: 'Kirby', fox: 'Fox', pikachu: 'Pikachu', jigglypuff: 'Jigglypuff' };

// one shared room per page
export const net = { room: null, state: null, mySlot: 0, lastResult: null };

// ---------- input encoding ----------
export function encode(c) {
  let b = 0; BUTTONS.forEach((k, i) => { if (c.down[k]) b |= 1 << i; });
  return [Math.round(c.x * 80), Math.round(c.y * 80), b];
}
function decodeInto(c, e) {
  c.x = (e?.[0] ?? 0) / 80; c.y = (e?.[1] ?? 0) / 80;
  const b = e?.[2] ?? 0; BUTTONS.forEach((k, i) => { c.down[k] = !!(b & (1 << i)); });
}

// ---------- lobby ----------
function css() {
  if (document.getElementById('net-css')) return;
  const s = document.createElement('style'); s.id = 'net-css';
  s.textContent = `
  #lobby { position: fixed; inset: 0; z-index: 30; background: radial-gradient(circle at 50% 30%, #3a1010, #120404 70%); color: #fff;
    font: 600 15px/1.3 system-ui, sans-serif; overflow-y: auto; -webkit-overflow-scrolling: touch; touch-action: pan-y; padding: 12px 16px 24px; box-sizing: border-box; }
  #lobby h1 { font: italic 900 22px "Arial Black", sans-serif; margin: 4px 0 10px; color: #ffd84a; text-shadow: 2px 2px 0 #900; }
  #lobby .row { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; margin: 8px 0; }
  #lobby button, #lobby select, #lobby input { font: 700 16px system-ui, sans-serif; border-radius: 10px; border: 2px solid #fff6; padding: 10px 14px; color: #fff; background: #2c2c48; }
  #lobby button.big { background: #c81e1e; font-size: 20px; padding: 14px 22px; }
  #lobby button:disabled { opacity: .4; }
  #lobby input { width: 7em; text-transform: uppercase; background: #111; }
  #lobby .code { font: 900 34px "Arial Black", monospace; letter-spacing: 6px; color: #ffd84a; }
  #lobby .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(54px, 64px)); gap: 5px; }
  #lobby .tile { position: relative; border-radius: 8px; border: 3px solid transparent; background: #4a1d17; aspect-ratio: 1; padding: 0; overflow: hidden; }
  #lobby .tile canvas { width: 100%; height: 100%; display: block; }
  #lobby .tile.sel { border-color: #ffd84a; }
  #lobby .tile span { position: absolute; left: 2px; bottom: 1px; font: 700 10px sans-serif; text-shadow: 0 0 3px #000; }
  #lobby .players { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; }
  #lobby .pl { border-radius: 10px; padding: 4px 8px; min-height: 44px; background: #222; border: 2px solid #555; display: flex; gap: 8px; align-items: center; }
  #lobby .pl canvas { width: 36px; height: 36px; }
  #lobby .muted { color: #bbb; font-weight: 400; }
  #lobby .err { color: #ff8080; }
  #onlineBtn { position: fixed; z-index: 25; left: 12px; bottom: 12px; font: italic 900 18px "Arial Black", sans-serif; color: #fff; background: #c81e1e;
    border: 2px solid #fff8; border-radius: 12px; padding: 10px 16px; box-shadow: 0 3px 0 #600; }
  #netmsg { position: fixed; z-index: 26; left: 50%; top: 8px; transform: translateX(-50%); background: #000a; color: #fff; padding: 6px 12px; border-radius: 8px; font: 600 13px sans-serif; display: none; }
  `;
  document.head.appendChild(s);
}
function el(tag, attrs = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) { if (k === 'onclick') e.addEventListener('click', v); else if (k === 'style') Object.assign(e.style, v); else e.setAttribute(k, v); }
  for (const k of kids.flat()) e.append(k?.nodeType ? k : document.createTextNode(String(k ?? '')));
  return e;
}
function icon(char, color, size = 44) {
  const c = document.createElement('canvas'); c.width = size * 2; c.height = size * 2;
  try { c.getContext('2d').drawImage(headIcon(char, color, size), 0, 0, size * 2, size * 2); } catch {}
  return c;
}
function toast(msg, ms = 3000) {
  let t = document.getElementById('netmsg');
  if (!t) { t = el('div', { id: 'netmsg' }); document.body.appendChild(t); }
  t.textContent = msg; t.style.display = 'block'; clearTimeout(t._h); t._h = setTimeout(() => { t.style.display = 'none'; }, ms);
}

// Shareable room links: <page>#join=CODE auto-joins the room
export function roomLink(code) { return location.origin + location.pathname + '#join=' + code; }
function setRoomHash(code) { try { history.replaceState(null, '', location.pathname + location.search + (code ? '#join=' + code : '')); } catch {} }
export function joinCodeFromUrl() {
  const m = /[#&?]join=([A-Za-z]{4})\b/.exec(location.hash + '&' + location.search);
  return m ? m[1].toUpperCase() : null;
}
async function shareRoom(code) {
  const url = roomLink(code);
  if (navigator.share) { try { await navigator.share({ title: 'Smash 64 room ' + code, text: 'Join my Smash 64 room!', url }); return; } catch (e) { if (e?.name === 'AbortError') return; } }
  copyRoom(code);
}
async function copyRoom(code) {
  const url = roomLink(code);
  try { await navigator.clipboard.writeText(url); toast('Link copied — send it to a friend'); return; } catch {}
  // fallback for browsers without the async clipboard API
  const ta = document.createElement('textarea'); ta.value = url; ta.style.position = 'fixed'; ta.style.opacity = '0';
  document.body.appendChild(ta); ta.select();
  try { document.execCommand('copy'); toast('Link copied — send it to a friend'); } catch { prompt('Copy this link:', url); }
  ta.remove();
}

const DEFAULT_CFG = { stage: 'dreamland', stocks: 4, items: 'off', cpus: 0, cpuLevel: 5 };

export class OnlineScreen {
  constructor(app, params) { this.app = app; this.p = params; this.isGameplay = false; }
  enter() {
    css();
    this.app.touch?.setVisible(false);
    this.app.audio.music('menu');
    this.root = el('div', { id: 'lobby' });
    document.body.appendChild(this.root);
    this.name = (() => { try { return localStorage.getItem('smash64-name') || ''; } catch { return ''; } })();
    if (net.room && net.state) this.renderRoom();
    else {
      this.renderStart();
      const code = this.p?.autoJoin;
      if (code && !net.room) { this.codeIn.value = code; this.join(code, this.status); }
    }
  }
  exit() { this.root?.remove(); this.app.touch?.setVisible(true); }
  update() { }
  render(r, ctx) { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, 640, 480); }
  saveName(v) { this.name = v.slice(0, 12); try { localStorage.setItem('smash64-name', this.name); } catch {} }

  renderStart(err) {
    const r = this.root; r.innerHTML = '';
    const nameIn = el('input', { value: this.name, placeholder: 'Your name', maxlength: 12, style: { width: '10em', textTransform: 'none' } });
    nameIn.addEventListener('input', () => this.saveName(nameIn.value));
    const codeIn = this.codeIn = el('input', { placeholder: 'CODE', maxlength: 4, autocapitalize: 'characters', autocomplete: 'off' });
    if (err) setRoomHash(null);
    const status = this.status = el('div', { class: err ? 'err' : 'muted' }, err ?? 'Play with up to 4 friends: one phone creates a room, then share its link (or code) with the others.');
    r.append(
      el('h1', {}, 'ONLINE PLAY'),
      el('div', { class: 'row' }, el('span', {}, 'Name'), nameIn),
      el('div', { class: 'row' }, el('button', { class: 'big', onclick: () => this.create(status) }, 'Create room')),
      el('div', { class: 'row' }, codeIn, el('button', { class: 'big', onclick: () => this.join(codeIn.value, status) }, 'Join room')),
      status,
      el('div', { class: 'row', style: { marginTop: '18px' } }, el('button', { onclick: () => { this.leave(); } }, '◀ Back')),
    );
  }
  async create(status) {
    status.className = 'muted'; status.textContent = 'Creating room…';
    try {
      const room = net.room = new Room();
      const code = await room.create();
      net.mySlot = 0;
      net.state = { code, cfg: { ...DEFAULT_CFG }, players: [{ pid: 'host', name: this.name || 'Player 1', char: 'mario', color: 0, slot: 0 }] };
      this.wireHost(room);
      this.renderRoom();
    } catch (e) { net.room?.close(); net.room = null; this.renderStart('Could not create a room: ' + (e.message || e.type || e)); }
  }
  async join(code, status) {
    code = (code || '').toUpperCase().trim();
    if (code.length !== 4) { status.className = 'err'; status.textContent = 'Enter the 4-letter room code.'; return; }
    status.className = 'muted'; status.textContent = 'Joining ' + code + '…';
    try {
      const room = net.room = new Room();
      this.wireClient(room);
      await room.join(code);
      room.send('host', { t: 'hello', name: this.name || 'Player' });
      status.textContent = 'Connected — waiting for the lobby…';
    } catch (e) { net.room?.close(); net.room = null; this.renderStart(e.message || String(e)); }
  }
  leave() { net.room?.close(); net.room = null; net.state = null; setRoomHash(null); this.app.go('modeselect'); }

  // ---- host side ----
  wireHost(room) {
    room.on('join', pid => { /* waits for hello */ });
    room.on('leave', pid => {
      const s = net.state; if (!s) return;
      const pl = s.players.find(p => p.pid === pid); if (!pl) return;
      s.players = s.players.filter(p => p.pid !== pid);
      toast((pl.name || 'A player') + ' left');
      this.broadcastLobby();
      if (this.app.screen instanceof NetBattleScreen) this.app.screen.playerLeft(pl.slot);
    });
    room.on('message', (from, msg) => hostMessage(this.app, from, msg));
  }
  broadcastLobby() { net.room?.broadcast({ t: 'lobby', state: net.state }); if (this.app.screen === this) this.renderRoom(); }

  // ---- client side ----
  wireClient(room) {
    room.on('message', (from, msg) => clientMessage(this.app, msg));
    room.on('hostLeft', () => { toast('The host left the room', 4000); setRoomHash(null); net.room?.close(); net.room = null; net.state = null; this.app.go('online'); });
  }

  // ---- room view ----
  renderRoom() {
    const s = net.state, r = this.root; if (!s || !r) return;
    const me = s.players.find(p => p.slot === net.mySlot);
    const isHost = net.room?.isHost;
    setRoomHash(s.code);
    const scroll = r.scrollTop;
    r.innerHTML = '';
    const c0 = s.cfg;
    r.append(el('div', { class: 'row', style: { justifyContent: 'space-between', flexWrap: 'nowrap' } },
      el('div', { style: { display: 'flex', alignItems: 'center', gap: '12px' } }, el('h1', { style: { margin: 0 } }, 'ROOM'), el('div', { class: 'code' }, s.code)),
      el('div', { style: { display: 'flex', gap: '8px', alignItems: 'center' } },
        el('button', { onclick: () => shareRoom(s.code) }, '🔗 Share'),
        el('button', { onclick: () => copyRoom(s.code) }, '📋 Copy link')),
      isHost ? el('button', { class: 'big', onclick: () => hostStart(this.app), ...(s.players.length + (c0.cpus ?? 0) < 2 ? { disabled: '' } : {}) }, 'START ▶')
        : el('div', { class: 'muted' }, 'Waiting for host…')));
    if (net.lastResult) r.append(el('div', { class: 'row', style: { color: '#ffd84a' } }, 'Last match: ' + net.lastResult));
    // players
    const pl = el('div', { class: 'players' });
    for (let slot = 0; slot < MAX_PLAYERS; slot++) {
      const p = s.players.find(q => q.slot === slot);
      const box = el('div', { class: 'pl', style: { borderColor: PORT_COLORS[slot] } });
      if (p) box.append(icon(p.char, p.color), el('div', {}, el('div', {}, `${slot + 1}P ${p.name}`), el('div', { class: 'muted' }, CHAR_NAMES[p.char])));
      else if (slot - s.players.length < (s.cfg.cpus ?? 0) && slot >= s.players.length) box.append(el('div', { class: 'muted' }, `CPU lv ${s.cfg.cpuLevel}`));
      else box.append(el('div', { class: 'muted' }, 'open'));
      pl.append(box);
    }
    r.append(pl);
    // characters
    r.append(el('div', { class: 'row muted' }, 'Pick your fighter (tap again to change colour):'));
    const grid = el('div', { class: 'grid' });
    for (const id of ROSTER) {
      const t = el('button', { class: 'tile' + (me?.char === id ? ' sel' : ''), onclick: () => {
        const color = me?.char === id ? (me.color + 1) % CHARS[id].palettes.length : 0;
        net.room.toHost({ t: 'sel', char: id, color });
      } }, icon(id, me?.char === id ? me.color : 0, 36), el('span', {}, CHAR_NAMES[id]));
      grid.append(t);
    }
    r.append(grid);
    // settings (host edits, others see)
    const c = s.cfg;
    const sel = (key, opts, label) => {
      const e = el('select', isHost ? {} : { disabled: '' }, opts.map(([v, l]) => { const o = el('option', { value: v }, l); if (String(c[key]) === String(v)) o.selected = true; return o; }));
      e.addEventListener('change', () => { c[key] = isNaN(Number(e.value)) ? e.value : Number(e.value); this.broadcastLobby(); });
      return el('span', {}, label + ' ', e);
    };
    r.append(el('div', { class: 'row' },
      sel('stage', [...VS_STAGES, 'final', 'duelzone'].filter(id => STAGES[id]).map(id => [id, STAGE_NAMES[id] ?? id]).concat([['random', 'Random']]), 'Stage'),
      sel('stocks', [1, 2, 3, 4, 5].map(n => [n, n + ' stock']), ''),
      sel('items', [['off', 'Items off'], ['low', 'Items low'], ['middle', 'Items mid'], ['high', 'Items high']], ''),
      sel('cpus', [0, 1, 2, 3].map(n => [n, n + ' CPU']), ''),
      sel('cpuLevel', [1, 3, 5, 7, 9].map(n => [n, 'CPU lv ' + n]), '')));
    r.append(el('div', { class: 'row' },
      el('button', { onclick: () => this.leave() }, 'Leave room')));
    requestAnimationFrame(() => { r.scrollTop = scroll; });
    r.append(el('div', { class: 'muted', style: { marginTop: '8px', fontSize: '12px' } }, 'Invite link (opens straight into this room): ', el('span', { style: { color: '#fff', userSelect: 'all' } }, roomLink(s.code))));
    r.append(el('div', { class: 'muted', style: { marginTop: '10px' } }, 'Controls: left thumb = stick (flick for smash attacks), A attack, B special, JUMP, SHIELD (hold), GRAB. Play in landscape.'));
  }
}

function hostMessage(app, from, msg) {
  const s = net.state; if (!s) return;
  switch (msg.t) {
    case 'hello': {
      if (s.players.some(p => p.pid === from)) break;
      const used = new Set(s.players.map(p => p.slot));
      let slot = 0; while (used.has(slot)) slot++;
      if (slot >= MAX_PLAYERS) { net.room.send(from, { t: 'full' }); break; }
      s.players.push({ pid: from, name: (msg.name || 'Player').slice(0, 12), char: 'mario', color: 0, slot });
      s.cfg.cpus = Math.min(s.cfg.cpus, MAX_PLAYERS - s.players.length);
      net.room.send(from, { t: 'welcome', slot });
      toast((msg.name || 'A player') + ' joined');
      lobbyOf(app)?.broadcastLobby() ?? net.room.broadcast({ t: 'lobby', state: s });
      break;
    }
    case 'sel': {
      const p = s.players.find(q => q.pid === from); if (!p || !CHARS[msg.char]) break;
      p.char = msg.char; p.color = msg.color % CHARS[msg.char].palettes.length;
      lobbyOf(app)?.broadcastLobby() ?? net.room.broadcast({ t: 'lobby', state: s });
      break;
    }
    case 'in': { const scr = app.screen; if (scr instanceof NetBattleScreen) scr.remoteInput(from, msg); break; }
  }
}
function clientMessage(app, msg) {
  switch (msg.t) {
    case 'welcome': net.mySlot = msg.slot; break;
    case 'lobby': net.state = msg.state; { const l = lobbyOf(app); if (l) l.renderRoom(); } break;
    case 'start': app.go('netbattle', msg.game); break;
    case 'b': case 'sync': { const scr = app.screen; if (scr instanceof NetBattleScreen) scr.netMessage(msg); break; }
    case 'end': { const scr = app.screen; if (scr instanceof NetBattleScreen) scr.netMessage(msg); break; }
  }
}
function lobbyOf(app) { return app.screen instanceof OnlineScreen ? app.screen : null; }

function hostStart(app) {
  const s = net.state, c = s.cfg;
  let stage = c.stage;
  if (stage === 'random') { const list = VS_STAGES.filter(id => STAGES[id]); stage = list[Math.floor(Math.random() * list.length)]; }
  const players = s.players.map(p => ({ char: p.char, color: p.color, port: p.slot, name: p.name, human: true }));
  const used = new Set(players.map(p => p.port));
  for (let i = 0, port = 0; i < (c.cpus ?? 0); i++) {
    while (used.has(port)) port++;
    if (port >= MAX_PLAYERS) break;
    used.add(port);
    const ch = ROSTER[Math.floor(Math.random() * ROSTER.length)];
    players.push({ char: ch, color: 0, port, human: false, cpu: { level: c.cpuLevel ?? 5 } });
  }
  // same character twice: give later ones the next costume
  for (const p of players) while (players.some(q => q !== p && q.port < p.port && q.char === p.char && q.color === p.color)) p.color = (p.color + 1) % CHARS[p.char].palettes.length;
  players.sort((a, b) => a.port - b.port);
  const game = { seed: (Math.random() * 2 ** 31) | 0, stage, rules: { mode: 'stock', stocks: c.stocks, items: c.items, itemSeed: 0 }, players };
  net.room.broadcast({ t: 'start', game });
  app.go('netbattle', game);
}

// ---------- lockstep battle ----------
export class NetBattleScreen extends BattleScreen {
  constructor(app, game) {
    const rng = new SeededRandom(game.seed);
    const controllers = [0, 1, 2, 3].map(i => new Controller(i));
    super(app, {
      stage: game.stage, players: game.players, rules: { ...game.rules, itemSeed: game.seed },
      controllers, netplay: true, mode: 'vs',
      makeMatch: cfg => rng.run(() => new Match(cfg)),
    });
    this.game = game; this.rng = rng; this.controllers = controllers;
    this.isHost = !!net.room?.isHost;
    this.frame = 0;               // last simulated frame
    this.queue = [];              // bundles waiting to be simulated
    this.latest = {};             // host: latest input per slot
    this.clientFrame = {}; this.lastHeard = {};   // host: how far each client has simulated
    this.pendingSync = new Map();
    this.desyncs = 0;
    this.humanSlots = game.players.filter(p => p.human).map(p => p.port);
  }
  enter() {
    super.enter();
    this.app.touch?.setVisible(true);
    this.cpus = this.match.fighters.filter(f => f.cpu).map(f => ({ f, d: new CpuDriver(this.match, f) }));
    this.match.fighters.forEach(f => { const pl = this.game.players.find(p => p.port === f.port); if (pl?.name) f.netName = pl.name; });
    this.waitFrames = 0;
  }
  exit() { super.exit(); }
  remoteInput(pid, msg) {
    const p = net.state?.players.find(q => q.pid === pid);
    if (p) { this.latest[p.slot] = msg.i; if (msg.f !== undefined) this.clientFrame[p.slot] = msg.f; this.lastHeard[p.slot] = performance.now(); }
  }
  playerLeft(slot) { this.latest[slot] = [0, 0, 0]; }
  netMessage(msg) {
    if (msg.t === 'b') this.queue.push(msg);
    else if (msg.t === 'sync') this.pendingSync.set(msg.f, msg.s);
    else if (msg.t === 'end') this.hostEnded = true;
  }
  update() {
    const app = this.app, m = this.match;
    const local = encode(app.input.controllers[0]);
    if (this.isHost) {
      // build this frame's bundle from the latest inputs
      // pace to the slowest phone: don't run more than ~20 frames ahead of any connected client
      const now = performance.now();
      const behind = this.humanSlots.some(slot => slot !== net.mySlot && this.clientFrame[slot] !== undefined && now - (this.lastHeard[slot] ?? 0) < 3000 &&
        this.frame - this.clientFrame[slot] > 20);
      if (behind) { this.waitFrames++; this.handleEvents([]); return; }
      const inputs = {};
      for (const slot of this.humanSlots) inputs[slot] = slot === net.mySlot ? local : (this.latest[slot] ?? [0, 0, 0]);
      const b = { t: 'b', f: this.frame + this.queue.length + 1, i: inputs };
      net.room?.broadcast(b);
      this.queue.push(b);
    } else {
      net.room?.send('host', { t: 'in', i: local, f: this.frame });
    }
    // simulate queued frames (catch up when behind)
    const n = this.queue.length > 12 ? 4 : this.queue.length > 4 ? 2 : 1;
    const evs = [];
    for (let k = 0; k < n && this.queue.length; k++) {
      const b = this.queue.shift();
      this.simulate(b);
      evs.push(...m.events);
    }
    this.waitFrames = this.queue.length ? 0 : this.waitFrames + 1;
    this.handleEvents(evs);
    if (m.phase === 'over' && !this.done) this.finish(false);
    if (this.hostEnded && !this.done && this.frame > 60) this.finish(true);
  }
  simulate(b) {
    const m = this.match;
    for (const c of this.controllers) {
      const f = m.fighters.find(x => x.port === c.port);
      if (!f) continue;
      if (f.cpu) { const cpu = this.cpus.find(x => x.f === f); this.rng.run(() => cpu.d.step(c)); }
      else decodeInto(c, b.i[c.port]);
      c.commit();
    }
    m.events = [];
    this.rng.run(() => m.update());
    for (const c of this.controllers) c.endFrame();
    this.frame = b.f;
    if (this.isHost && this.frame % 20 === 0) net.room?.broadcast({ t: 'sync', f: this.frame, s: snapshot(m) });
    if (!this.isHost && this.pendingSync.has(this.frame)) { this.applySync(this.pendingSync.get(this.frame)); this.pendingSync.delete(this.frame); }
    for (const k of this.pendingSync.keys()) if (k < this.frame) this.pendingSync.delete(k);
  }
  applySync(s) {
    const m = this.match;
    s.forEach((d, i) => {
      const f = m.fighters[i]; if (!f) return;
      const same = f.state === d.st && (f.move?.id ?? null) === d.mv && f.dead === d.dead;
      if (!same) this.desyncs++;
      f.percent = d.p; f.stocks = d.k === null ? Infinity : d.k; f.shieldHP = d.sh;
      if (same) Object.assign(f, { x: d.x, y: d.y, vx: d.vx, vy: d.vy, kbx: d.kx, kby: d.ky, kbGround: d.kg, facing: d.fc, hitstun: d.hs, jumpsUsed: d.j });
    });
  }
  finish(quit) {
    if (this.done) return; this.done = true;
    const m = this.match;
    if (this.isHost) net.room?.broadcast({ t: 'end' });
    const st = m.standings?.() ?? m.fighters;
    const w = st[0]?.f ?? st[0];
    net.lastResult = quit ? 'ended early' : `${w?.netName ?? CHAR_NAMES[w?.def?.id] ?? '?'} (${CHAR_NAMES[w?.def?.id] ?? ''}) wins!`;
    setTimeout(() => this.app.go('online'), quit ? 300 : 2500);
  }
  render(r, ctx) {
    super.render(r, ctx);
    if (this.waitFrames > 30 && !this.done) {
      ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(220, 200, 200, 40);
      ctx.fillStyle = '#fff'; ctx.font = '700 16px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(this.isHost ? 'Waiting for players…' : 'Waiting for host…', 320, 226); ctx.textAlign = 'left';
    }
  }
}

function snapshot(m) {
  const r = v => Math.round(v * 100) / 100;
  return m.fighters.map(f => ({ st: f.state, mv: f.move?.id ?? null, dead: f.dead, x: r(f.x), y: r(f.y), vx: r(f.vx), vy: r(f.vy), kx: r(f.kbx), ky: r(f.kby), kg: r(f.kbGround || 0),
    fc: f.facing, hs: f.hitstun, j: f.jumpsUsed, p: f.percent, k: f.stocks === Infinity ? null : f.stocks, sh: f.shieldHP }));
}

// "ONLINE" button on the title / mode-select screens
export function installOnline(app) {
  css();
  const btn = el('button', { id: 'onlineBtn', onclick: () => app.go('online') }, '🌐 ONLINE');
  document.body.appendChild(btn);
  const go = app.go.bind(app);
  app.go = (name, params) => { go(name, params); btn.style.display = ['title', 'modeselect'].includes(name) ? '' : 'none'; };
  btn.style.display = ['title', 'modeselect'].includes(app.screenName) ? '' : 'none';
  const code = joinCodeFromUrl();
  if (code) setTimeout(() => app.go('online', { autoJoin: code }), 0);
  else if (location.hash === '#online') setTimeout(() => app.go('online'), 0);
  window.addEventListener('hashchange', () => { const c = joinCodeFromUrl(); if (c && !net.room) app.go('online', { autoJoin: c }); });
}
