// N64-style virtual controllers fed by keyboard and the Gamepad API.
// Each controller exposes stick (x,y in [-1,1]), buttons A B Z R L CU CD CL CR START,
// with per-frame "pressed"/"released" edges and the frame the stick reached each region
// (needed to tell smash inputs from tilts, dash from walk, tap-jump, etc).

export const BUTTONS = ['A', 'B', 'Z', 'R', 'L', 'CU', 'CD', 'CL', 'CR', 'START', 'DU', 'DD', 'DL', 'DR'];

// Default keyboard layouts. Keys are KeyboardEvent.code.
export const KEY_LAYOUTS = [
  { // P1
    up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD',
    A: 'KeyJ', B: 'KeyK', Z: 'KeyL', R: 'KeyU', L: 'KeyO', CU: 'KeyI', START: 'Enter',
    walk: 'ShiftLeft', smashMod: 'KeyH',
    CL: 'KeyF', CR: 'KeyG', CD: 'KeyV', CUalt: 'Space',
  },
  { // P2
    up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight',
    A: 'Numpad1', B: 'Numpad2', Z: 'Numpad3', R: 'Numpad0', L: 'NumpadDecimal', CU: 'Numpad5', START: 'NumpadEnter',
    walk: 'ShiftRight', smashMod: 'Numpad4',
    CL: 'Numpad7', CR: 'Numpad9', CD: 'Numpad8', CUalt: 'Numpad6',
  },
];

// Menu-friendly aliases: P1 can also use arrows/space/backspace when in menus
const MENU_ALIASES = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', Space: 'A', Backspace: 'B', Escape: 'B' };

export class Controller {
  constructor(port) {
    this.port = port;
    this.x = 0; this.y = 0;            // stick, +y = up
    this.px = 0; this.py = 0;          // previous frame
    this.down = {}; this.prev = {};
    this.source = 'none';              // 'keyboard' | 'gamepad' | 'cpu' | 'none'
    this.frame = 0;
    // frame when stick last left the neutral zone into each region
    this.xSmashFrame = -999; this.ySmashFrame = -999;
    this.lastNeutralXFrame = 0; this.lastNeutralYFrame = 0;
    this.walk = false; this.smashMod = false;
    for (const b of BUTTONS) { this.down[b] = false; this.prev[b] = false; }
  }
  pressed(b) { return this.down[b] && !this.prev[b]; }
  released(b) { return !this.down[b] && this.prev[b]; }
  held(b) { return this.down[b]; }
  // Any of the jump buttons (C buttons) freshly pressed
  jumpPressed() { return this.pressed('CU') || this.pressed('CD') || this.pressed('CL') || this.pressed('CR'); }
  jumpHeld() { return this.down.CU || this.down.CD || this.down.CL || this.down.CR; }
  shieldHeld() { return this.down.Z || this.down.R; }
  shieldPressed() { return this.pressed('Z') || this.pressed('R'); }
  // The stick crossed from near-neutral to beyond `thr` within `win` frames: a "smash" (flick) input.
  xSmash(win = 3) { return Math.abs(this.x) >= 0.7 && this.frame - this.xSmashFrame <= win; }
  ySmash(win = 3) { return Math.abs(this.y) >= 0.7 && this.frame - this.ySmashFrame <= win; }
  // Called by the input manager after writing raw values for this frame
  commit() {
    this.frame++;
    const ax = Math.abs(this.x), ay = Math.abs(this.y);
    const pax = Math.abs(this.px), pay = Math.abs(this.py);
    if (ax < 0.25) this.lastNeutralXFrame = this.frame;
    if (ay < 0.25) this.lastNeutralYFrame = this.frame;
    // smash = reached 0.7 having been neutral within the last 3 frames
    if (ax >= 0.7 && pax < 0.7 && this.frame - this.lastNeutralXFrame <= 3) this.xSmashFrame = this.frame;
    if (ay >= 0.7 && pay < 0.7 && this.frame - this.lastNeutralYFrame <= 3) this.ySmashFrame = this.frame;
    if (this.smashMod && (ax >= 0.7 && pax < 0.7)) this.xSmashFrame = this.frame;
    if (this.smashMod && (ay >= 0.7 && pay < 0.7)) this.ySmashFrame = this.frame;
  }
  endFrame() {
    this.px = this.x; this.py = this.y;
    for (const b of BUTTONS) this.prev[b] = this.down[b];
  }
}

export class InputManager {
  constructor() {
    this.keys = new Set();
    this.controllers = [0, 1, 2, 3].map(i => new Controller(i));
    this.padMap = [null, null, null, null]; // controller port -> gamepad index
    this.keyboardPorts = [0, 1];             // keyboard layout i drives controller keyboardPorts[i]
    this.anyKeyThisFrame = false;
    this.menuMode = true;
    this.cpuDrivers = [null, null, null, null];
    window.addEventListener('keydown', e => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Tab', 'Backspace'].includes(e.code)) e.preventDefault();
      this.keys.add(e.code); this.anyKeyThisFrame = true;
    });
    window.addEventListener('keyup', e => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());
    window.addEventListener('gamepadconnected', () => this.assignPads());
    window.addEventListener('gamepaddisconnected', () => this.assignPads());
  }
  assignPads() {
    const pads = navigator.getGamepads ? [...navigator.getGamepads()].filter(Boolean) : [];
    // Gamepads take ports after the keyboard ports first, then any free port.
    this.padMap = [null, null, null, null];
    let port = 0;
    for (const p of pads) {
      while (port < 4 && this.padMap[port] !== null) port++;
      // If only one keyboard player is likely, let the first pad take P2 when P1 is keyboard
      if (port < 4) this.padMap[port] = p.index;
      port++;
    }
  }
  poll() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const c of this.controllers) {
      if (this.cpuDrivers[c.port]) { this.cpuDrivers[c.port](c); c.source = 'cpu'; c.commit(); continue; }
      let x = 0, y = 0; const d = {}; for (const b of BUTTONS) d[b] = false;
      let walk = false, smashMod = false, src = 'none';
      // keyboard
      const ki = this.keyboardPorts.indexOf(c.port);
      if (ki >= 0) {
        const L = KEY_LAYOUTS[ki], k = this.keys;
        let kx = (k.has(L.right) ? 1 : 0) - (k.has(L.left) ? 1 : 0);
        let ky = (k.has(L.up) ? 1 : 0) - (k.has(L.down) ? 1 : 0);
        if (ki === 0 && this.menuMode) {
          for (const [code, act] of Object.entries(MENU_ALIASES)) if (k.has(code)) {
            if (act === 'up') ky = 1; else if (act === 'down') ky = -1; else if (act === 'left') kx = -1; else if (act === 'right') kx = 1; else d[act] = true;
          }
        }
        walk = k.has(L.walk); smashMod = k.has(L.smashMod);
        const mag = walk ? 0.5 : 1;
        if (kx || ky) { x = kx * mag; y = ky * mag; src = 'keyboard'; }
        for (const b of ['A', 'B', 'Z', 'R', 'L', 'CU', 'START', 'CL', 'CR', 'CD']) if (L[b] && k.has(L[b])) { d[b] = true; src = 'keyboard'; }
        if (k.has(L.CUalt)) d.CU = true;
      }
      // gamepad (standard mapping)
      const gi = this.padMap[c.port];
      const gp = gi !== null && gi !== undefined ? pads[gi] : null;
      if (gp && gp.connected) {
        const dz = v => Math.abs(v) < 0.15 ? 0 : v;
        let gx = dz(gp.axes[0] || 0), gy = -dz(gp.axes[1] || 0);
        const B = i => gp.buttons[i] && (gp.buttons[i].pressed || gp.buttons[i].value > 0.5);
        if (B(12)) gy = 1; if (B(13)) gy = -1; if (B(14)) gx = -1; if (B(15)) gx = 1;
        if (gx || gy) { x = gx; y = gy; src = 'gamepad'; }
        // right stick → C buttons (jump on up, smash attacks otherwise: treated as C stick smash)
        const rx = dz(gp.axes[2] || 0), ry = -dz(gp.axes[3] || 0);
        if (B(0)) d.A = true; if (B(2)) d.B = true; if (B(1)) d.B = true;
        if (B(3)) d.CU = true; if (B(6) || B(7)) d.Z = true; if (B(5)) d.R = true; if (B(4)) d.L = true;
        if (B(9)) d.START = true;
        if (ry > 0.6) d.CU = true; if (ry < -0.6) d.CD = true; if (rx < -0.6) d.CL = true; if (rx > 0.6) d.CR = true;
        for (const b of BUTTONS) if (d[b]) src = 'gamepad';
      }
      // on-screen touch controls drive one port (P1 by default)
      if (this.touch?.active && c.port === this.touch.port) {
        const t = this.touch.state;
        if (t.x || t.y) { x = t.x; y = t.y; src = 'touch'; }
        for (const b in t.down) if (t.down[b]) { d[b] = true; src = 'touch'; }
      }
      // clamp to the N64 octagonal-ish gate
      const m = Math.hypot(x, y); if (m > 1) { x /= m; y /= m; }
      c.x = x; c.y = y; c.down = d; c.walk = walk; c.smashMod = smashMod;
      if (src !== 'none') c.source = src;
      c.commit();
    }
  }
  endFrame() { for (const c of this.controllers) c.endFrame(); this.anyKeyThisFrame = false; }
  // Any port pressed this button (menus)
  anyPressed(b) { return this.controllers.some(c => c.pressed(b)); }
}
