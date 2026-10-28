// Off-screen three.js rendering for menus: one shared alpha WebGL renderer draws small scenes
// (character models in CSS panels, portrait busts, stage previews) which are then copied onto the 2D
// UI canvas with drawImage at the right layer. Rendered at 2x and downsampled for smooth edges.
import * as THREE from 'three';
import { CHARS } from '../chars/index.js';
import { applyPose } from '../render/rig.js';
import { idlePose, P, sampleMove } from '../render/anims.js';
import { moveTiming } from '../render/view.js';

const SS = 2;                 // supersampling factor
const CW = 640 * SS, CH = 480 * SS;
let R = null;
export function menuRenderer() {
  if (!R) {
    const c = document.createElement('canvas'); c.width = CW; c.height = CH;
    R = new THREE.WebGLRenderer({ canvas: c, alpha: true, antialias: true, preserveDrawingBuffer: true, premultipliedAlpha: false });
    R.setPixelRatio(1); R.setSize(CW, CH, false);
    R.outputColorSpace = THREE.SRGBColorSpace;
    R.autoClear = true;
  }
  return R;
}

// Render `scene` with `camera` into the rect (x,y,w,h) of the 2D context `ctx`.
export function drawScene(ctx, scene, camera, x, y, w, h, clear = null) {
  const r = menuRenderer();
  const pw = Math.min(CW, Math.round(w * SS)), ph = Math.min(CH, Math.round(h * SS));
  r.setViewport(0, 0, pw, ph); r.setScissor(0, 0, pw, ph); r.setScissorTest(true);
  r.setClearColor(clear ?? 0x000000, clear == null ? 0 : 1);
  if (camera.isPerspectiveCamera) { camera.aspect = w / h; camera.updateProjectionMatrix(); }
  r.render(scene, camera);
  ctx.drawImage(r.domElement, 0, CH - ph, pw, ph, x, y, w, h);
}

export function disposeTree(o) { o.traverse(m => { if (m.geometry) m.geometry.dispose(); }); }

// Bounding box of the *visible* meshes under `obj` (hidden effect meshes such as charge shots, auras or
// Kirby's copy hats are skipped). Optional `skip(mesh)` excludes more (e.g. held weapons).
const _bb = new THREE.Box3();
export function visibleBox(obj, skip = null) {
  const box = new THREE.Box3();
  obj.updateMatrixWorld(true);
  const walk = (o) => {
    if (!o.visible || (skip && skip(o))) return;
    if ((o.isMesh || o.isLine || o.isPoints) && o.geometry) {
      const g = o.geometry; if (!g.boundingBox) g.computeBoundingBox();
      if (g.boundingBox && isFinite(g.boundingBox.min.x)) box.union(_bb.copy(g.boundingBox).applyMatrix4(o.matrixWorld));
    }
    for (const c of o.children) walk(c);
  };
  walk(obj);
  return box;
}

export function addLights(scene, o = {}) {
  scene.add(new THREE.AmbientLight(0xffffff, o.amb ?? 0.75));
  const d = new THREE.DirectionalLight(0xffffff, o.sun ?? 1.5); d.position.set(...(o.dir ?? [-0.5, 0.8, 1])); scene.add(d);
  return scene;
}

// A character model posed for menus. Model units are normalised: feet at y=0, height h.
export class MenuFighter {
  constructor(charId, color = 0, o = {}) {
    const def = this.def = CHARS[charId];
    this.charId = charId; this.color = color;
    const pal = def.palettes[color % def.palettes.length];
    this.fake = { def, color, port: o.port ?? 0, state: 'idle', sf: 0, mf: 0, facing: 1, vx: 0, vy: 0, a: def.attr, attr: def.attr,
      H: def.attr?.height ?? 320, Wd: def.attr?.width ?? 100, x: 0, y: 0, vars: {}, special: {}, grounded: true, percent: 0, cpu: null, stats: {} };
    let built;
    try { built = def.model(pal, this.fake); } catch (e) { console.warn('menu model', charId, e); built = { bones: { root: new THREE.Group() } }; }
    this.bones = built.bones ?? built; this.rest = built.rest || null; this.extra = built.extra || {};
    this.root = this.bones.root;
    this.holder = new THREE.Group(); this.holder.add(this.root);
    this.scene = addLights(new THREE.Scene(), o.lights);
    this.scene.add(this.holder);
    this.pose(0);
    this.root.updateMatrixWorld(true);
    const box = visibleBox(this.root);
    if (box.isEmpty()) box.set(new THREE.Vector3(-0.3, 0, -0.3), new THREE.Vector3(0.3, 1, 0.3));
    this.h = Math.max(0.2, box.max.y - Math.min(0, box.min.y));
    this.top = box.max.y; this.minY = Math.min(0, box.min.y);
    this.camera = new THREE.PerspectiveCamera(28, 1, 0.01, 100);
    this.t = 0; this.yaw = o.yaw ?? 0.45;
    this.root.rotation.y = this.yaw;
  }
  setPose(p) { try { applyPose(this.bones, p, this.rest); } catch {} }
  pose(t) {
    const custom = this.def.anims?.idle;
    let p = null;
    if (custom) { try { p = custom(this.fake, t); } catch { p = null; } }
    this.setPose(p ?? idlePose((t % 90) / 90));
  }
  // play an engine move by id at move frame mf (returns false if the move does not exist)
  move(id, mf) {
    const m = this.def.moves?.[id]; if (!m) return false;
    this.fake.mf = mf; this.fake.move = m; this.fake.state = 'attack';
    let p;
    try {
      if (typeof m.anim === 'function') p = m.anim(this.fake, mf, P, null);
      else p = sampleMove(m.anim || 'jab', mf, m.timing || moveTiming(m), m.air ? P.fall : P.idle);
    } catch { p = P.idle; }
    this.setPose(p); return true;
  }
  victory(t) { this.setPose({ ...P.victory, root: [0, Math.abs(Math.sin(t * 0.08)) * 0.03, 0] }); }
  // World-space box of the head (head bone subtree, visible meshes only). Characters whose head bone
  // carries no meshes (Kirby, Jigglypuff: the body is the head) use the whole visible body instead.
  headBox() {
    this.root.updateMatrixWorld(true);
    const hb = this.bones.head;
    let box = hb ? visibleBox(hb) : new THREE.Box3();
    const size = box.getSize(new THREE.Vector3());
    if (box.isEmpty() || size.y < this.h * 0.08) { box = visibleBox(this.root); box.whole = true; }
    return box;
  }
  // frame the camera: mode 'full' (whole body), 'bust' (head & shoulders) or 'head' (head only).
  // bust/head are framed on the head bone's world box, not the whole bounding box (which would include
  // swords, tails and raised arms).
  frame(mode = 'full', o = {}) {
    const c = this.camera, h = this.h;
    c.fov = o.fov ?? 28;
    let cx = 0, cy, span;
    if (mode === 'bust' || mode === 'head') {
      const b = this.headBox(), hh = Math.max(0.05, b.max.y - b.min.y), hw = Math.max(0.05, b.max.x - b.min.x);
      const ext = Math.max(hh, hw * 0.85);
      cx = (b.min.x + b.max.x) / 2;
      if (mode === 'head') { cy = (b.min.y + b.max.y) / 2; span = ext * (o.zoom ?? 1.08); }
      else if (b.whole) { cy = b.min.y + hh * 0.54; span = ext * (o.zoom ?? 1.06); }
      else { cy = b.min.y + hh * 0.44; span = ext * (o.zoom ?? 1.42); }
    } else { cy = this.minY + h * 0.5; span = h * (o.margin ?? 1.15); }
    const dist = span / 2 / Math.tan(c.fov * Math.PI / 360);
    const tx = cx + (o.dx ?? 0), ty = cy + (o.dy ?? 0);
    c.position.set(tx, ty + (o.pitch ?? 0.05) * dist, dist);
    c.lookAt(tx, ty, 0);
  }
  draw(ctx, x, y, w, h, mode = 'full', o = {}) { this.frame(mode, o); drawScene(ctx, this.scene, this.camera, x, y, w, h, o.clear ?? null); }
  dispose() { disposeTree(this.root); }
}

// ---------------------------------------------------------------- CSS portraits
const portraitCache = new Map();
function fireBackground(g, w, h, seedv) {
  let s = seedv; const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const bg = g.createLinearGradient(0, 0, 0, h); bg.addColorStop(0, '#2a0f0e'); bg.addColorStop(1, '#4a1d17');
  g.fillStyle = bg; g.fillRect(0, 0, w, h);
  for (let layer = 0; layer < 3; layer++) {
    const col = ['rgba(150,40,10,0.8)', 'rgba(198,115,0,0.75)', 'rgba(255,190,60,0.55)'][layer];
    g.fillStyle = col;
    for (let i = 0; i < 4 + layer; i++) {
      const bx = rnd() * w, bw = w * (0.18 + rnd() * 0.2), top = h * (0.25 + layer * 0.18 + rnd() * 0.25);
      g.beginPath(); g.moveTo(bx - bw, h);
      g.quadraticCurveTo(bx - bw * 0.2, h * 0.75, bx + (rnd() - 0.5) * bw, top);
      g.quadraticCurveTo(bx + bw * 0.3, h * 0.75, bx + bw, h); g.closePath(); g.fill();
    }
  }
}
// Head-and-shoulders render of a character over a fire background (cached canvas, 2x resolution)
export function portrait(charId, w = 88, h = 82) {
  const key = charId + w + 'x' + h;
  if (portraitCache.has(key)) return portraitCache.get(key);
  const c = document.createElement('canvas'); c.width = w * 2; c.height = h * 2;
  const g = c.getContext('2d');
  fireBackground(g, c.width, c.height, 1 + charId.length * 977 + charId.charCodeAt(0));
  try {
    const mf = new MenuFighter(charId, 0, { yaw: 0.35 });
    mf.draw(g, 0, 0, c.width, c.height, 'bust', { fov: 15 });
    mf.dispose();
  } catch (e) { console.warn('portrait', charId, e); }
  portraitCache.set(key, c);
  return c;
}
export function clearPortraits() { portraitCache.clear(); }

// Small head icon of a character in a given costume (stock icons, HUD bubbles), transparent background.
const headCache = new Map();
export function headIcon(charId, color = 0, size = 24) {
  const key = charId + ':' + color + ':' + size;
  if (headCache.has(key)) return headCache.get(key);
  const c = document.createElement('canvas'); c.width = size * 2; c.height = size * 2;
  const g = c.getContext('2d');
  try {
    const mf = new MenuFighter(charId, color, { yaw: 0.25, lights: { amb: 1.0, sun: 1.2 } });
    mf.draw(g, 0, 0, c.width, c.height, 'head', { fov: 14, pitch: 0.12 });
    mf.dispose();
  } catch (e) { console.warn('headIcon', charId, e); }
  headCache.set(key, c);
  return c;
}
