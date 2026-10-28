// Derived fighter definitions used only by the 1P ladder: Giant DK, Metal Mario, Fighting Polygons and
// Kirby Team members with a copied neutral special. Each returns a def object compatible with Fighter
// (shallow copy of the base character def with overridden attributes / moves / model).
import * as THREE from 'three';
import { CHARS } from '../chars/index.js';
import { GIANT_DK_ATTR, GIANT_DK_SCALE, METAL_MARIO_ATTR, METAL_MARIO_SCALE } from './data.js';

const cache = new Map();
function memo(key, fn) { if (!cache.has(key)) cache.set(key, fn()); return cache.get(key); }

// Giant Donkey Kong: GDonkeyMain attributes, 1.6x scale (size 2.0 vs 1.25)
export function giantDK() {
  return memo('giantdk', () => {
    const b = CHARS.dk;
    return { ...b, id: 'giantdk', baseId: 'dk', name: 'Giant DK', short: 'DK', attr: { ...b.attr, ...GIANT_DK_ATTR }, spawnScale: GIANT_DK_SCALE };
  });
}

// Metal Mario: MMarioMain attributes, chrome look (FighterView renders f.metal with a shiny material)
export function metalMario() {
  return memo('metalmario', () => {
    const b = CHARS.mario;
    return { ...b, id: 'metalmario', baseId: 'mario', name: 'Metal Mario', short: 'MM', attr: { ...b.attr, ...METAL_MARIO_ATTR }, spawnScale: METAL_MARIO_SCALE, metal: true };
  });
}

// Fighting Polygon ("N" fighters): same moveset, faceted purple look
export function polygon(charId) {
  return memo('poly_' + charId, () => {
    const b = CHARS[charId];
    return { ...b, id: 'poly_' + charId, baseId: charId, name: 'Polygon', short: 'Po', polygon: true,
      palettes: [{ ...b.palettes[0], icon: 0x9a40b0, icon2: 0xd070e0 }] };
  });
}

// Kirby with a copied neutral special and the copied fighter's hat
export function kirbyCopy(copyId) {
  if (!copyId || copyId === 'kirby' || !CHARS[copyId]) return CHARS.kirby;
  return memo('kirbycopy_' + copyId, () => {
    const k = CHARS.kirby, src = CHARS[copyId];
    const moves = { ...k.moves };
    for (const id of Object.keys(src.moves)) if (/^nspecial/.test(id)) moves[id] = src.moves[id];
    if (!src.moves.nspecialAir) delete moves.nspecialAir;
    const pal0 = src.palettes[0];
    const hatColor = pal0.cap ?? pal0.hat ?? pal0.icon ?? 0xcccccc;
    return {
      ...k, id: 'kirby_' + copyId, baseId: 'kirby', copyOf: copyId, moves,
      init(f) { k.init?.(f); try { src.init?.(f); } catch {} },
      model(pal, f) {
        const built = k.model(pal, f);
        try {
          const bones = built.bones ?? built;
          const head = bones.head ?? bones.root;
          head.add(copyHat(copyId, hatColor));
        } catch {}
        return built;
      },
    };
  });
}

// Small low-poly hat for the copy ability (Mario cap, DK tie-less tuft, Link cap, Samus helmet, ...)
function copyHat(id, color) {
  const g = new THREE.Group();
  const col = typeof color === 'number' ? color : new THREE.Color(color).getHex();
  const m = new THREE.MeshLambertMaterial({ color: col, flatShading: true });
  if (id === 'link') {
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.42, 6), new THREE.MeshLambertMaterial({ color: 0x2e8a30, flatShading: true }));
    cone.position.set(0, 0.28, -0.05); cone.rotation.x = -0.6; g.add(cone);
  } else if (id === 'samus') {
    const h = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshLambertMaterial({ color: 0xd06020, flatShading: true }));
    h.position.set(0, 0.12, 0); g.add(h);
  } else if (id === 'fox') {
    for (const s of [-1, 1]) { const e = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.18, 4), new THREE.MeshLambertMaterial({ color: 0xd88a38, flatShading: true })); e.position.set(s * 0.1, 0.25, 0); g.add(e); }
  } else if (id === 'pikachu') {
    for (const s of [-1, 1]) { const e = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.3, 4), new THREE.MeshLambertMaterial({ color: 0xf8d020, flatShading: true })); e.position.set(s * 0.12, 0.3, 0); e.rotation.z = -s * 0.35; g.add(e); }
  } else if (id === 'yoshi') {
    const h = new THREE.Mesh(new THREE.SphereGeometry(0.17, 8, 6), new THREE.MeshLambertMaterial({ color: 0x40c040, flatShading: true }));
    h.scale.set(1, 0.7, 1.3); h.position.set(0, 0.2, 0.05); g.add(h);
  } else if (id === 'dk') {
    const h = new THREE.Mesh(new THREE.SphereGeometry(0.12, 6, 4), new THREE.MeshLambertMaterial({ color: 0x7a4a24, flatShading: true }));
    h.position.set(0, 0.24, 0); g.add(h);
  } else {
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.19, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2), m);
    cap.position.set(0, 0.14, 0); g.add(cap);
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.02, 8), m); brim.position.set(0, 0.15, 0.15); g.add(brim);
  }
  return g;
}

// Restyle a FighterView (or any THREE object holding the model) for polygons: faceted, purple-magenta
export function stylePolygonView(fv, seed = 1) {
  let s = seed * 9301 + 49297;
  const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  const meshes = fv.meshes ?? [];
  const mats = meshes.map(() => {
    const h = 0.78 + rnd() * 0.12, l = 0.35 + rnd() * 0.25;
    return new THREE.MeshPhongMaterial({ color: new THREE.Color().setHSL(h, 0.55, l), flatShading: true, shininess: 40, specular: 0x402040, transparent: true, opacity: 0.94 });
  });
  meshes.forEach((m, i) => { m.material = mats[i]; if (m.geometry && !m.geometry.userData?.polyFlat) { m.geometry.userData = { ...(m.geometry.userData || {}), polyFlat: true }; } });
  fv.origMats = mats; fv.flashMats = new Map(); fv.tint = undefined;
}

// Same restyle for a raw THREE object (menu portraits)
export function stylePolygonObject(root, seed = 1) {
  const meshes = []; root.traverse(o => { if (o.isMesh) meshes.push(o); });
  stylePolygonView({ meshes }, seed);
}
export function styleMetalObject(root) {
  const mat = new THREE.MeshPhongMaterial({ color: 0xa0a8b8, specular: 0xffffff, shininess: 80, flatShading: true });
  root.traverse(o => { if (o.isMesh) o.material = mat; });
}

// Resolve an enemy id from the ladder tables to a def
export function enemyDef(id) {
  if (id === 'giantdk') return giantDK();
  if (id === 'metalmario') return metalMario();
  return CHARS[id];
}
