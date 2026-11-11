// Shared 2D drawing helpers for the 1P screens (cards, tallies, HUD icons).
import * as THREE from 'three';
import { text, FONT } from '../ui/draw.js';
import { CHARS } from '../chars/index.js';

export const TIMER_FONT = '"Arial Rounded MT Bold", "Trebuchet MS", "DejaVu Sans", sans-serif';
export const SERIF = 'Georgia, "Times New Roman", "DejaVu Serif", serif';
export const ROUND = '"Arial Rounded MT Bold", "Trebuchet MS", "Verdana", "DejaVu Sans", sans-serif';

export const hex = c => typeof c === 'number' ? '#' + c.toString(16).padStart(6, '0') : (c ?? '#ccc');

// Copy the current WebGL frame (preserveDrawingBuffer) into a 2D canvas for frozen-frame backgrounds
export function snapshotCanvas(app) {
  try {
    const c = document.createElement('canvas'); c.width = 640; c.height = 480;
    c.getContext('2d').drawImage(app.canvas, 0, 0, 640, 480);
    return c;
  } catch { return null; }
}

// small round stock head in the character's palette (team stock rows, chain icons)
export function drawStockHead(ctx, def, color, x, y, r, alpha = 1, polygon = false) {
  const pal = def?.palettes?.[(color ?? 0) % (def?.palettes?.length || 1)] ?? {};
  ctx.save(); ctx.globalAlpha = alpha;
  ctx.fillStyle = polygon ? '#a040b8' : hex(pal.icon ?? pal.cap ?? pal.body);
  ctx.strokeStyle = '#000'; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  const s = polygon ? '#e080f0' : (pal.icon2 ?? pal.skin);
  if (s !== undefined) { ctx.fillStyle = hex(s); ctx.beginPath(); ctx.arc(x, y + r * 0.3, r * 0.55, 0, Math.PI * 2); ctx.fill(); }
  ctx.restore();
}
export function drawTargetIcon(ctx, x, y, r) {
  ['#e01818', '#fff', '#e01818', '#fff'].forEach((c, i) => { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x, y, r * (1 - i * 0.24), 0, Math.PI * 2); ctx.fill(); });
  ctx.strokeStyle = '#300'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
}
export function drawPlatformIcon(ctx, x, y, r) {
  ctx.save(); ctx.fillStyle = '#e03030'; ctx.strokeStyle = '#300'; ctx.lineWidth = 1;
  ctx.fillRect(x - r, y - r * 0.35, r * 2, r * 0.7); ctx.strokeRect(x - r, y - r * 0.35, r * 2, r * 0.7);
  ctx.fillStyle = '#ffd040'; ctx.fillRect(x - r * 0.6, y - r * 0.12, r * 1.2, r * 0.24);
  ctx.restore();
}
// white glove icon (Master Hand's HUD slot)
export function drawHandIcon(ctx, x, y, s) {
  ctx.save(); ctx.translate(x, y); ctx.fillStyle = '#fff'; ctx.strokeStyle = '#333'; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.ellipse(0, s * 0.5, s * 0.75, s * 0.6, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.ellipse(-s * 0.55 + i * s * 0.37, -s * 0.25, s * 0.16, s * 0.55, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
  ctx.beginPath(); ctx.ellipse(s * 0.85, s * 0.35, s * 0.4, s * 0.16, -0.6, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.restore();
}

// "SCORE: 00117112" (SCORE: orange-red gradient, digits yellow) as on every 1P result screen
export function drawScore(ctx, score, x = 600, y = 446, size = 34) {
  const digits = String(Math.max(0, Math.floor(score))).padStart(8, '0').slice(-8);
  text(ctx, digits, x, y, { size, align: 'right', color: '#fff200', stroke: '#3a2a00', strokeW: 3, italic: false, font: ROUND, weight: 700 });
  ctx.save(); ctx.font = `700 ${size}px ${ROUND}`; const w = ctx.measureText(digits).width; ctx.restore();
  text(ctx, 'SCORE:', x - w - 10, y, { size: size * 0.9, align: 'right', gradient: ['#ffd040', '#ff7020', '#e02010'], italic: true, font: ROUND, weight: 700 });
}
// big title (STAGE CLEAR / RESULT / GAME CLEAR) in orange-gold gradient
export function drawBigTitle(ctx, s, y = 84, size = 62) {
  text(ctx, s, 320, y, { size, align: 'center', gradient: ['#ffe060', '#ff9a10', '#e04000'], stroke: '#3a1000', strokeW: 6, italic: false, font: FONT, scaleX: 1 });
}

// Low-poly white-glove model in its own scene (cards, ending)
export function makeHandScene(MasterHandView) {
  const scene = new THREE.Scene();
  scene.add(new THREE.AmbientLight(0xffffff, 0.75));
  const d = new THREE.DirectionalLight(0xffffff, 1.4); d.position.set(-0.5, 0.8, 1); scene.add(d);
  const fake = { x: 0, y: 0, z: 0, facing: -1, pose: { kind: 'open', curl: 0.25, tilt: 0.2, roll: 0.5, spin: 0, yaw: 0.3 }, flash: 0, hurtFlash: 0, hitlag: 0, defeated: false, deadT: 0 };
  const view = new MasterHandView(scene, fake);
  view.update({});
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  camera.position.set(0, 0.5, 26); camera.lookAt(0, 0, 0);
  return { scene, camera, view, fake };
}

export function charName(id) {
  if (id === 'masterhand') return 'Master Hand';
  if (id === 'giantdk') return 'Giant DK';
  if (id === 'metalmario') return 'Metal Mario';
  return CHARS[id]?.name ?? id;
}
