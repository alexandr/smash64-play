// Shared helpers for building stages: canvas textures, sky backdrops, platform meshes, solids.
import * as THREE from 'three';
import { mat } from '../render/rig.js';

export function canvasTex(w, h, draw, opts = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d'); draw(g, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  if (opts.repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...opts.repeat); }
  if (opts.nearest) { t.magFilter = THREE.NearestFilter; }
  return t;
}

export function gradient(g, w, h, stops, horizontal = false) {
  const gr = horizontal ? g.createLinearGradient(0, 0, w, 0) : g.createLinearGradient(0, 0, 0, h);
  stops.forEach(([o, c]) => gr.addColorStop(o, c));
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
}

// Big backdrop plane far behind the stage. `draw(g,w,h)` paints it. Returns mesh.
export function backdrop(scene, rs, draw, o = {}) {
  const tex = canvasTex(o.tw ?? 1024, o.th ?? 512, draw);
  const w = (o.w ?? 30000) * rs, h = (o.h ?? 15000) * rs;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, depthWrite: false, fog: false }));
  m.position.set(0, (o.y ?? 1500) * rs, (o.z ?? -8000) * rs);
  m.renderOrder = -10;
  scene.add(m);
  return m;
}

// Extruded slab for a floor polyline: top surface at the polyline, thickness `t`, depth `d` (z).
export function slab(pts, t, d, topColor, sideColor, rs, o = {}) {
  const shape = new THREE.Shape();
  shape.moveTo(pts[0][0] * rs, pts[0][1] * rs);
  for (let i = 1; i < pts.length; i++) shape.lineTo(pts[i][0] * rs, pts[i][1] * rs);
  for (let i = pts.length - 1; i >= 0; i--) shape.lineTo(pts[i][0] * rs + (o.taper ?? 0) * rs * (i === 0 ? 1 : i === pts.length - 1 ? -1 : 0), pts[i][1] * rs - t * rs);
  const geo = new THREE.ExtrudeGeometry(shape, { depth: d * rs, bevelEnabled: false });
  geo.translate(0, 0, -d * rs / 2 + (o.z ?? 0) * rs);
  const g = new THREE.Group();
  const side = new THREE.Mesh(geo, [mat(topColor), mat(sideColor)]);
  // ExtrudeGeometry groups: 0 = caps (front/back), 1 = sides. Put the top color on sides (includes top face).
  side.material = [mat(sideColor), mat(topColor)];
  g.add(side);
  return g;
}

// Solid polygon (CCW) extruded along z
export function prism(poly, d, color, rs, z = 0, extra = {}) {
  const shape = new THREE.Shape();
  shape.moveTo(poly[0][0] * rs, poly[0][1] * rs);
  for (let i = 1; i < poly.length; i++) shape.lineTo(poly[i][0] * rs, poly[i][1] * rs);
  const geo = new THREE.ExtrudeGeometry(shape, { depth: d * rs, bevelEnabled: false });
  geo.translate(0, 0, -d * rs / 2 + z * rs);
  const m = new THREE.Mesh(geo, Array.isArray(color) ? color.map(c => (c.isMaterial ? c : mat(c, extra))) : (color.isMaterial ? color : mat(color, extra)));
  return m;
}

// Thin pass-through platform mesh
export function thinPlatform(x1, x2, y, color, edgeColor, rs, depth = 300, thick = 40) {
  const g = new THREE.Group();
  const w = (x2 - x1) * rs;
  const top = new THREE.Mesh(new THREE.BoxGeometry(w, thick * rs, depth * rs), [mat(edgeColor), mat(edgeColor), mat(color), mat(edgeColor), mat(edgeColor), mat(edgeColor)]);
  top.position.set((x1 + x2) / 2 * rs, (y - thick / 2) * rs, 0);
  g.add(top);
  return g;
}

// Build a stage definition from generated decomp data plus a visual/hazard module.
// mod: { id, name, series, music, build(scene, rs, data) -> obj, sync(obj, match, rs), init(match, st), update(match, st), hazardHitboxes(match, st), clearColor, camera options }
export function makeStage(data, mod = {}) {
  return {
    id: mod.id ?? data.id, name: mod.name ?? data.name, series: mod.series, music: mod.music ?? 'battle', data,
    preview: mod.preview,
    create(match, cfg = {}) {
      const st = {
        data, collision: data, spawns: data.spawns, blast: { ...data.blast }, cameraBounds: { ...data.cameraBounds },
        respawn: data.respawn ?? [0, 2000], itemSpawns: data.itemSpawns ?? [],
        clearColor: mod.clearColor ?? data.fog ?? 0x000000, fog: data.fog, altWarning: data.altWarning,
        cameraPitchBase: data.lightAngle?.[2] ?? -0.17453294,   // decomp: ground data light_angle.z adds to the camera pitch
        respawnPoint(port, m) {
          // simultaneous respawns are offset 0, -1000, +1000, -2000
          const busy = m ? m.fighters.filter(f => f.state === 'respawn').length : 0;
          return [st.respawn[0] + [0, -1000, 1000, -2000][busy % 4], st.respawn[1]];
        },
        ...(mod.options ?? {}),
      };
      st.build = (scene, rs) => mod.build ? mod.build(scene, rs, data, st) : null;
      st.sync = (obj, m, rs) => mod.sync?.(obj, m, rs, st);
      st.init = (m) => { st.mainFloor = mainFloorOf(m.col); mod.init?.(m, st); };
      st.update = (m) => mod.update?.(m, st);
      st.hazardHitboxes = (m) => mod.hazardHitboxes?.(m, st) ?? [];
      return st;
    },
  };
}
// widest non-pass floor = the main stage
export function mainFloorOf(col) {
  let best = null, bw = -1;
  for (const f of col.floors) { if (f.pass) continue; const w = f.pts[f.pts.length - 1][0] - f.pts[0][0]; if (w > bw) { bw = w; best = f; } }
  return best ?? col.floors[0];
}

// Mesh for a floor polyline extruded downward (thin platforms or solid tops)
export function floorMesh(f, thick, depth, topColor, sideColor, rs) {
  const pts = f.pts;
  const shape = new THREE.Shape();
  shape.moveTo(pts[0][0] * rs, pts[0][1] * rs);
  for (let i = 1; i < pts.length; i++) shape.lineTo(pts[i][0] * rs, pts[i][1] * rs);
  for (let i = pts.length - 1; i >= 0; i--) shape.lineTo(pts[i][0] * rs, (pts[i][1] - thick) * rs);
  const geo = new THREE.ExtrudeGeometry(shape, { depth: depth * rs, bevelEnabled: false });
  geo.translate(0, 0, -depth * rs / 2);
  return new THREE.Mesh(geo, [mat(sideColor), mat(topColor)]);
}

// Solid body polygon traced from a group's walls/floors/ceilings (approximate outline for visuals)
export function outlineFromGroup(g) {
  const pts = [];
  for (const f of g.floors.filter(f => !f.pass)) pts.push(...f.pts);
  for (const w of g.walls) pts.push(w.a, w.b);
  for (const c of g.ceils) pts.push(...c);
  return pts;
}

// Generic visuals straight from collision data (used until a stage module draws its real art):
// solid blocks under non-pass floors, thin planks for pass-through floors; moving groups follow their offset.
export function genericBuild(scene, rs, d, o = {}) {
  const root = new THREE.Group(); scene.add(root);
  const groups = new Map();
  for (const g of d.groups) {
    const gg = new THREE.Group(); root.add(gg); groups.set(g.id, gg);
    for (const f of g.floors) {
      const thick = f.pass ? 40 : (o.thick ?? 500);
      const local = g.moving ? f.pts : f.pts;
      gg.add(floorMesh({ pts: local }, thick, f.pass ? 260 : (o.depth ?? 900), f.pass ? (o.platTop ?? 0xd0b070) : (o.top ?? 0x50a040), f.pass ? (o.platSide ?? 0x806030) : (o.side ?? 0x806040), rs));
    }
  }
  const bg = o.sky !== false ? backdrop(scene, rs, (c, w, h) => gradient(c, w, h, o.sky ?? [[0, '#203070'], [1, '#6080c0']])) : null;
  return { root, groups, background: bg };
}
export function genericSync(obj, m, rs) {
  if (!obj) return;
  for (const g of m.col.groups) { const gg = obj.groups.get(g.id); if (gg && g.moving) { gg.position.set(g.ox * rs, g.oy * rs, 0); gg.visible = g.active; } }
}
