// Desktop-only "Controls" button (top-left). Clicking toggles an on-screen overlay listing the keyboard and
// gamepad controls; the choice is remembered. Not shown on touch devices (they get on-screen buttons).
import { isTouchDevice } from '../core/touch.js';

const KEY = 'smash64-controls-overlay';

export function installControlsHelp() {
  if (isTouchDevice()) return;
  const css = document.createElement('style');
  css.textContent = `
    #ctlBtn { position: fixed; left: 10px; top: 10px; z-index: 40; font: 700 13px system-ui, sans-serif; color: #fff;
      background: rgba(30,30,40,0.75); border: 1px solid rgba(255,255,255,0.45); border-radius: 8px; padding: 6px 10px; cursor: pointer; }
    #ctlBtn:hover { background: rgba(60,60,80,0.9); }
    #ctlBtn.on { background: rgba(200,30,30,0.85); }
    #ctlPanel { position: fixed; left: 10px; top: 46px; z-index: 39; pointer-events: none; color: #fff; background: rgba(10,10,16,0.82);
      border: 1px solid rgba(255,255,255,0.3); border-radius: 10px; padding: 10px 14px; font: 12px/1.45 system-ui, sans-serif; max-width: 300px; display: none; }
    #ctlPanel h3 { margin: 4px 0 4px; font: 800 13px system-ui, sans-serif; color: #ffd84a; }
    #ctlPanel table { border-collapse: collapse; }
    #ctlPanel td { padding: 0 8px 0 0; vertical-align: top; }
    #ctlPanel td:first-child { color: #bbb; white-space: nowrap; }
    #ctlPanel kbd { font: 700 11px ui-monospace, monospace; background: #333; border: 1px solid #666; border-bottom-width: 2px; border-radius: 4px; padding: 0 4px; }
    #ctlPanel .tip { color: #ccc; margin-top: 6px; }
  `;
  document.head.appendChild(css);
  const k = s => s.split(' ').map(x => `<kbd>${x}</kbd>`).join(' ');
  const panel = document.createElement('div');
  panel.id = 'ctlPanel';
  panel.innerHTML = `
    <h3>Player 1 — keyboard</h3>
    <table>
      <tr><td>Move</td><td>${k('W A S D')}</td></tr>
      <tr><td>Attack (A)</td><td>${k('J')}</td></tr>
      <tr><td>Special (B)</td><td>${k('K')}</td></tr>
      <tr><td>Jump</td><td>${k('I')} or ${k('Space')}</td></tr>
      <tr><td>Shield (hold)</td><td>${k('L')}</td></tr>
      <tr><td>Grab</td><td>${k('U')}</td></tr>
      <tr><td>Taunt</td><td>${k('O')}</td></tr>
      <tr><td>Pause / Start</td><td>${k('Enter')}</td></tr>
      <tr><td>Walk / tilt</td><td>hold ${k('Shift')}</td></tr>
      <tr><td>Force smash</td><td>hold ${k('H')}</td></tr>
    </table>
    <h3>Player 2 — arrows + numpad</h3>
    <table>
      <tr><td>Move</td><td>${k('← ↑ → ↓')}</td></tr>
      <tr><td>Attack / Special</td><td>${k('Num1')} / ${k('Num2')}</td></tr>
      <tr><td>Jump</td><td>${k('Num5')}</td></tr>
      <tr><td>Shield / Grab</td><td>${k('Num3')} / ${k('Num0')}</td></tr>
      <tr><td>Start</td><td>${k('NumEnter')}</td></tr>
    </table>
    <h3>Gamepad</h3>
    <div>Stick move · A attack · B/X special · Y jump · triggers shield · RB grab · Start pause</div>
    <div class="tip">Smash attack: tap a direction and attack together. Short hop: tap jump. Roll: shield + left/right.
    Menus: arrows/WASD, ${k('Enter')} or ${k('Space')} confirm, ${k('Esc')} back.</div>`;
  document.body.appendChild(panel);
  const btn = document.createElement('button');
  btn.id = 'ctlBtn'; btn.textContent = '⌨ Controls';
  const set = on => {
    panel.style.display = on ? 'block' : 'none';
    btn.classList.toggle('on', on);
    try { localStorage.setItem(KEY, on ? '1' : '0'); } catch {}
  };
  btn.addEventListener('click', e => { set(panel.style.display === 'none'); btn.blur(); });
  // keep Space/Enter from re-triggering the button while playing
  btn.addEventListener('keydown', e => e.preventDefault());
  document.body.appendChild(btn);
  let saved = false; try { saved = localStorage.getItem(KEY) === '1'; } catch {}
  set(saved);
}
