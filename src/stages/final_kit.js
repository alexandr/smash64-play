// Shared low-poly helpers for the 1P stages (Meta Crystal, Duel Zone, Final Destination, Race to the Finish).
import * as THREE from 'three';

// Deterministic PRNG so stage art looks the same every load.
export function rng(seed = 1) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

const _c = new THREE.Color();
// Paint every triangle of a non-indexed geometry with a colour picked by `pick(i, normal)`.
export function paintFaces(geo, pick) {
  geo = geo.index ? geo.toNonIndexed() : geo;
  const pos = geo.attributes.position, n = pos.count;
  geo.computeVertexNormals();
  const nor = geo.attributes.normal;
  const col = new Float32Array(n * 3);
  for (let t = 0; t < n; t += 3) {
    _c.set(pick(t / 3, [nor.getX(t), nor.getY(t), nor.getZ(t)]));
    for (let k = 0; k < 3; k++) { col[(t + k) * 3] = _c.r; col[(t + k) * 3 + 1] = _c.g; col[(t + k) * 3 + 2] = _c.b; }
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return geo;
}
export function vcMat(o = {}) { return new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, ...o }); }

// Extruded polygon (game units) along z, centred on `z`, with per-face colours.
export function facetPrism(poly, depth, rs, pick, o = {}) {
  const shape = new THREE.Shape(poly.map(([x, y]) => new THREE.Vector2(x * rs, y * rs)));
  let geo = new THREE.ExtrudeGeometry(shape, { depth: depth * rs, bevelEnabled: !!o.bevel, bevelThickness: (o.bevel ?? 0) * rs, bevelSize: (o.bevel ?? 0) * rs, bevelSegments: 1, steps: o.steps ?? 1 });
  geo.translate(0, 0, -depth * rs / 2 + (o.z ?? 0) * rs);
  geo = paintFaces(geo, pick);
  return new THREE.Mesh(geo, o.material ?? vcMat());
}

// Pointed crystal (hexagonal prism + pyramid tip), base at origin, along +y. Sizes in render units.
export function crystal(r, h, palette, rand, o = {}) {
  const seg = o.seg ?? 5;
  const prof = [new THREE.Vector2(0, -h * 0.1), new THREE.Vector2(r, 0), new THREE.Vector2(r * 0.92, h * 0.72), new THREE.Vector2(0, h)];
  let geo = new THREE.LatheGeometry(prof, seg);
  geo = paintFaces(geo, () => palette[Math.floor(rand() * palette.length)]);
  return new THREE.Mesh(geo, vcMat(o.mat ?? {}));
}

// Canvas texture helper (game-free so this module never touches the DOM at import time)
export function tex(w, h, draw, o = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  if (o.repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...o.repeat); }
  if (o.nearest) t.magFilter = THREE.NearestFilter;
  return t;
}

// Flat textured plane far behind the stage (no depth write); returns mesh.
export function bgPlane(w, h, texture, z, rs, o = {}) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w * rs, h * rs), new THREE.MeshBasicMaterial({ map: texture, depthWrite: false, fog: false, transparent: !!o.transparent, opacity: o.opacity ?? 1 }));
  m.position.set(0, 0, z * rs); m.renderOrder = -10;
  return m;
}

// Lattice girder (red truss): rectangle frame + X diagonals, centred at (x,y,z) game units.
export function truss(x, y, w, h, z, color, rs, o = {}) {
  const g = new THREE.Group();
  const t = (o.t ?? 40) * rs, d = (o.d ?? 40) * rs;
  const m = new THREE.MeshLambertMaterial({ color });
  const bar = (x1, y1, x2, y2) => {
    const len = Math.hypot(x2 - x1, y2 - y1) * rs;
    const b = new THREE.Mesh(new THREE.BoxGeometry(len, t, d), m);
    b.position.set((x1 + x2) / 2 * rs, (y1 + y2) / 2 * rs, 0); b.rotation.z = Math.atan2(y2 - y1, x2 - x1); g.add(b);
  };
  const l = -w / 2, r = w / 2, b = -h / 2, tp = h / 2;
  bar(l, tp, r, tp); bar(l, b, r, b); bar(l, b, l, tp); bar(r, b, r, tp);
  const n = Math.max(1, Math.round(w / (o.cell ?? h)));
  for (let i = 0; i < n; i++) {
    const x1 = l + (w * i) / n, x2 = l + (w * (i + 1)) / n;
    if (o.zig) bar(x1, i % 2 ? tp : b, x2, i % 2 ? b : tp);
    else { bar(x1, b, x2, tp); bar(x1, tp, x2, b); if (i) bar(x1, b, x1, tp); }
  }
  g.position.set(x * rs, y * rs, z * rs);
  return g;
}
