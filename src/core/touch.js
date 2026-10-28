// On-screen touch controls for phones/tablets: a nipplejs joystick on the left half of the screen and
// N64-style buttons on the right (A, B, Jump = C, Shield = Z, Grab = R, Taunt = L, Start).
// The state is merged into controller port `port` by InputManager.poll().
/* global nipplejs */

export function isTouchDevice() {
  const q = new URLSearchParams(location.search);
  if (q.has('touch')) return true;
  if (q.has('notouch')) return false;
  return ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
}

const BUTTONS = [
  // id, label, button, size (vmin), right %, bottom %, color
  ['A', 'A', 'A', 17, 13, 10, '#2f6bff'],
  ['B', 'B', 'B', 15, 30, 4, '#2fb84a'],
  ['J', 'JUMP', 'CU', 13, 4, 30, '#e6c21a'],
  ['Z', 'SHIELD', 'Z', 12, 22, 30, '#8a8a8a'],
  ['R', 'GRAB', 'R', 11, 38, 22, '#9a5ad8'],
];

export class TouchControls {
  constructor(input) {
    this.input = input;
    this.state = { x: 0, y: 0, down: {} };
    this.port = 0;
    this.active = false;
    this.root = null;
  }
  mount() {
    if (this.root) return;
    const css = document.createElement('style');
    css.textContent = `
      html, body { touch-action: none; -webkit-user-select: none; user-select: none; -webkit-touch-callout: none; overscroll-behavior: none; }
      #touch { position: fixed; inset: 0; z-index: 10; pointer-events: none; }
      #touch .zone { position: absolute; left: 0; top: 12%; width: 48%; height: 88%; pointer-events: auto; }
      #touch .btn { position: absolute; pointer-events: auto; border-radius: 50%; display: flex; align-items: center; justify-content: center;
        font: 900 italic 3.2vmin "Arial Black", sans-serif; color: #fff; text-shadow: 0 1px 2px #000; border: 2px solid rgba(255,255,255,0.55);
        opacity: 0.55; box-shadow: inset 0 -4px 8px rgba(0,0,0,0.35); }
      #touch .btn.on { opacity: 0.95; transform: scale(0.93); }
      #touch .small { position: absolute; pointer-events: auto; padding: 1.2vmin 2.4vmin; border-radius: 3vmin; background: rgba(40,40,40,0.6);
        color: #fff; font: 700 2.6vmin sans-serif; border: 1px solid rgba(255,255,255,0.4); opacity: 0.7; }
      #touch .small.on { opacity: 1; background: rgba(200,40,40,0.8); }
      #rotate { position: fixed; inset: 0; z-index: 20; background: #000; color: #fff; display: none; align-items: center; justify-content: center;
        flex-direction: column; font: 600 5vmin sans-serif; text-align: center; }
      @media (orientation: portrait) { #rotate.need { display: flex; } }
    `;
    document.head.appendChild(css);
    const root = this.root = document.createElement('div');
    root.id = 'touch';
    const zone = document.createElement('div'); zone.className = 'zone'; root.appendChild(zone);
    for (const [id, label, btn, size, right, bottom, color] of BUTTONS) {
      const b = document.createElement('div'); b.className = 'btn'; b.textContent = label;
      Object.assign(b.style, { width: size + 'vmin', height: size + 'vmin', right: right + 'vw', bottom: bottom + 'vh', background: color,
        fontSize: (label.length > 2 ? 2.4 : 5) + 'vmin' });
      this.bindButton(b, btn);
      root.appendChild(b);
    }
    const mk = (label, btn, css) => { const b = document.createElement('div'); b.className = 'small'; b.textContent = label; Object.assign(b.style, css); this.bindButton(b, btn); root.appendChild(b); return b; };
    mk('START', 'START', { left: '50%', top: '1.5vh', transform: 'translateX(-50%)' });
    mk('TAUNT', 'L', { right: '2vw', top: '1.5vh' });
    const fs = document.createElement('div'); fs.className = 'small'; fs.textContent = '⛶'; Object.assign(fs.style, { left: '2vw', top: '1.5vh' });
    fs.addEventListener('pointerdown', e => { e.preventDefault(); goFullscreen(); });
    root.appendChild(fs);
    document.body.appendChild(root);
    const rot = document.createElement('div'); rot.id = 'rotate'; rot.className = 'need';
    rot.innerHTML = '<div style="font-size:14vmin">⟳</div><div>Rotate your phone to landscape</div>';
    document.body.appendChild(rot);

    // joystick
    this.nipple = nipplejs.create({ zone, mode: 'dynamic', color: 'white', size: 130, threshold: 0.05, fadeTime: 120, restOpacity: 0.6 });
    const max = 130 * 0.42;
    this.nipple.on('move', (e, d) => {
      const k = Math.min(1, (d.distance ?? 0) / max);
      const a = d.angle?.radian ?? 0;
      this.state.x = Math.cos(a) * k; this.state.y = Math.sin(a) * k;
    });
    this.nipple.on('end', () => { this.state.x = 0; this.state.y = 0; });
    // any first touch: unlock audio + go fullscreen/landscape
    const first = () => { goFullscreen(); window.removeEventListener('pointerdown', first); };
    window.addEventListener('pointerdown', first);
    window.addEventListener('contextmenu', e => e.preventDefault());
    document.addEventListener('gesturestart', e => e.preventDefault());
    this.active = true;
  }
  bindButton(el, btn) {
    const on = e => { e.preventDefault(); el.setPointerCapture?.(e.pointerId); this.state.down[btn] = true; el.classList.add('on'); navigator.vibrate?.(8); };
    const off = e => { e.preventDefault(); this.state.down[btn] = false; el.classList.remove('on'); };
    el.addEventListener('pointerdown', on);
    el.addEventListener('pointerup', off); el.addEventListener('pointercancel', off); el.addEventListener('lostpointercapture', off);
  }
  setVisible(v) { if (this.root) this.root.style.display = v ? '' : 'none'; }
}

function goFullscreen() {
  const el = document.documentElement;
  try { if (!document.fullscreenElement && el.requestFullscreen) el.requestFullscreen({ navigationUI: 'hide' }).catch(() => {}); } catch {}
  try { screen.orientation?.lock?.('landscape').catch(() => {}); } catch {}
}
