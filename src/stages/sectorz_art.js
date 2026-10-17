// Sector Z art: deep-space backdrop with the orange nebula, the Great Fox hull (silhouette traced from the
// collision outline), engines, drifting space junk, the Arwing, and laser/explosion visuals.
import * as THREE from 'three';
import { mat, kit } from '../render/rig.js';
import { backdrop, canvasTex, prism } from './common.js';

function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
const tex = (w, h, draw, rep) => { const t = canvasTex(w, h, draw); t.wrapS = t.wrapT = THREE.RepeatWrapping; if (rep) t.repeat.set(...rep); return t; };
const tmat = (t, o = {}) => new THREE.MeshLambertMaterial({ map: t, ...o });

function paintSpace(c, w, h) {
  const R = rng(11);
  const g = c.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#02031a'); g.addColorStop(0.5, '#05082e'); g.addColorStop(1, '#020214');
  c.fillStyle = g; c.fillRect(0, 0, w, h);
  // faint blue haze bands
  for (let i = 0; i < 30; i++) {
    const x = R() * w, y = R() * h, r = 80 + R() * 220;
    const gr = c.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(30,50,140,0.25)'); gr.addColorStop(1, 'rgba(30,50,140,0)');
    c.fillStyle = gr; c.fillRect(x - r, y - r, r * 2, r * 2);
  }
  // stars
  for (let i = 0; i < 2600; i++) {
    const b = R(); c.fillStyle = b > 0.97 ? '#ffffff' : b > 0.8 ? 'rgba(220,230,255,0.9)' : 'rgba(160,170,230,0.7)';
    const s = b > 0.985 ? 2.5 : b > 0.9 ? 1.6 : 1; c.fillRect(R() * w, R() * h, s, s);
  }
  // the burning "Z" nebula (explosion cloud) just left of centre
  const cx = w * 0.52, cy = h * 0.40;
  const blob = (x, y, r, inner, outer) => {
    const gr = c.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, inner); gr.addColorStop(0.55, outer); gr.addColorStop(1, 'rgba(120,20,0,0)');
    c.fillStyle = gr; c.beginPath(); c.arc(x, y, r, 0, 7); c.fill();
  };
  const path = [[-170, -120], [-60, -150], [60, -160], [130, -110], [60, -40], [-10, 10], [-80, 60], [-130, 120], [-20, 140], [100, 130], [170, 100]];
  for (let k = 0; k < 3; k++) for (let i = 0; i < path.length - 1; i++) for (let s = 0; s < 6; s++) {
    const t = s / 6, x = cx + (path[i][0] + (path[i + 1][0] - path[i][0]) * t) * 1.6 + (R() - 0.5) * 50, y = cy + (path[i][1] + (path[i + 1][1] - path[i][1]) * t) * 1.5 + (R() - 0.5) * 50;
    if (R() < 0.35) continue;
    const r = [130, 85, 45][k] + R() * 40;
    blob(x + (R() - 0.5) * 60, y + (R() - 0.5) * 60, r, ['rgba(200,50,15,0.22)', 'rgba(250,130,40,0.28)', 'rgba(255,225,150,0.32)'][k], ['rgba(150,25,8,0.10)', 'rgba(230,90,20,0.14)', 'rgba(255,180,80,0.14)'][k]);
  }
  // distant debris silhouettes
  c.fillStyle = 'rgba(40,40,50,0.9)';
  for (let i = 0; i < 9; i++) {
    const x = R() * w, y = R() * h * 0.8, s = 8 + R() * 16;
    c.save(); c.translate(x, y); c.rotate(R() * 3); c.fillRect(-s * 2, -s * 0.25, s * 4, s * 0.5); c.fillRect(-s * 0.3, -s * 1.4, s * 0.6, s * 2.8); c.restore();
  }
}

function hullTexture() {
  return tex(512, 512, (c, w, h) => {
    const R = rng(5);
    c.fillStyle = '#e4dfcf'; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 40; i++) { c.fillStyle = `rgba(${170 + R() * 40 | 0},${165 + R() * 40 | 0},${140 + R() * 30 | 0},0.10)`; c.fillRect(R() * w, R() * h, 60 + R() * 200, 30 + R() * 120); }
    c.lineWidth = 2;
    for (const [x, y, ww, hh] of [[4, 4, 300, 250], [310, 4, 198, 120], [310, 130, 198, 124], [4, 262, 200, 246], [210, 262, 298, 246]]) {
      c.strokeStyle = '#c6c1b0'; c.strokeRect(x, y, ww, hh); c.strokeStyle = 'rgba(255,255,250,0.5)'; c.strokeRect(x + 2, y + 2, ww - 4, hh - 4);
    }
    c.fillStyle = '#8a8574';
    for (let i = 0; i < 14; i++) { c.beginPath(); c.arc(R() * w, R() * h, 2, 0, 7); c.fill(); }
  }, [0.05, 0.05]);
}

function logoTexture() {
  return canvasTex(512, 256, (c, w, h) => {
    c.clearRect(0, 0, w, h);
    c.fillStyle = '#c8241c';
    // stylised fox head with swept wings
    c.beginPath();
    c.moveTo(60, 170); c.lineTo(190, 120); c.lineTo(230, 60); c.lineTo(255, 110); c.lineTo(290, 50); c.lineTo(300, 120);
    c.lineTo(450, 70); c.lineTo(340, 150); c.lineTo(300, 210); c.lineTo(240, 190); c.lineTo(200, 160); c.closePath(); c.fill();
    c.fillStyle = '#d4cfbd'; c.beginPath(); c.arc(262, 145, 12, 0, 7); c.fill();
  });
}

function textTexture() {
  return canvasTex(512, 96, (c, w, h) => {
    c.clearRect(0, 0, w, h); c.font = 'bold italic 76px sans-serif'; c.textBaseline = 'middle';
    c.lineWidth = 8; c.strokeStyle = '#1a4010'; c.strokeText('STARFOX', 14, 50);
    c.fillStyle = '#38c838'; c.fillText('STARFOX', 14, 50);
  });
}

export function makeArwing(rs) {
  // built with the nose toward +z; the outer group is oriented with lookAt (nose = flight direction)
  const outer = new THREE.Group(), m = new THREE.Group(); outer.add(m);
  const S = v => v * rs;
  const white = 0xf0f2f8, blue = 0x5a96f0, grey = 0x9aa0b0;
  const nose = new THREE.Mesh(new THREE.CylinderGeometry(S(10), S(150), S(900), 6), mat(white, { flat: true }));
  nose.rotation.x = Math.PI / 2; nose.scale.set(1, 1, 0.6); nose.position.set(0, S(-20), S(250)); m.add(nose);
  const body = new THREE.Mesh(new THREE.CylinderGeometry(S(150), S(190), S(560), 6), mat(white, { flat: true }));
  body.rotation.x = Math.PI / 2; body.scale.set(1.2, 1, 0.6); body.position.set(0, S(-20), S(-470)); m.add(body);
  m.add(kit.sphere(S(120), 0x50b8ff, [0, S(70), S(-160)], { seg: 8, scale: [0.85, 0.65, 2.0], opacity: 0.9 }));
  // swept, slightly drooping wings (light blue) with white leading-edge strakes and canted tip fins
  for (const sx of [-1, 1]) {
    const shape = new THREE.Shape();
    shape.moveTo(0, S(80)); shape.lineTo(sx * S(1000), S(-480)); shape.lineTo(sx * S(1020), S(-700)); shape.lineTo(0, S(-640));
    const wg = new THREE.Mesh(new THREE.ShapeGeometry(shape), mat(blue, { side: THREE.DoubleSide, flat: true }));
    const piv = new THREE.Group(); piv.rotation.z = sx * -0.28; piv.position.y = S(-50); m.add(piv);
    wg.rotation.x = Math.PI / 2; piv.add(wg);
    const fin = kit.box(S(30), S(380), S(300), 0xc8dcff, [sx * S(990), S(130), S(-560)], { flat: true });
    fin.rotation.set(0, 0, sx * 0.5); piv.add(fin);
    const pod = kit.box(S(110), S(110), S(520), grey, [sx * S(320), S(-40), S(-300)]); m.add(pod);
  }
  m.add(kit.box(S(30), S(260), S(260), white, [0, S(120), S(-620)], { flat: true }));
  const glow = new THREE.Mesh(new THREE.SphereGeometry(S(170), 10, 8), new THREE.MeshBasicMaterial({ color: 0xff7aa8, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
  glow.position.set(0, S(-20), S(-800)); glow.scale.set(1, 0.75, 1.4); m.add(glow);
  outer.userData.glow = glow; outer.userData.model = m;
  return outer;
}

export function buildSectorZ(scene, rs, d) {
  const root = new THREE.Group(); scene.add(root);
  const bg = backdrop(scene, rs, paintSpace, { tw: 2048, th: 1024, w: 56000, h: 28000, y: 1500, z: -15000 });
  const hullT = hullTexture();
  const hullM = tmat(hullT, { emissive: 0x6a665a }), hullDark = tmat(hullT, { color: 0xe0dccc, emissive: 0x55524a });
  const top = d.groups.find(g => g.id === 2).floors[0].pts, deck = d.groups.find(g => g.id === 2).floors[1].pts;
  // nose (narrower) and main hull: silhouette = floor lines + walls + ceilings of yakumono 2
  const nose = [...top.filter(p => p[0] <= -3400), [-3398, 1004], [-5057, 774], [-6872, 1132]];
  const main = [...top.filter(p => p[0] >= -3400), [3806, 2685], [3526, 1755], ...deck, [8528, -192], [7152, -662], [5770, -200], [3363, -2538], [-3525, -908], [-2630, 204], [-3398, 1004]];
  // each body has a flat deck strip around z = 0 (matching the collision) and a bevelled shoulder down to
  // its front face, so the deck reads as a surface even when the camera is level with it
  const shoulder = (poly, isTop, drop, zBack, zMid, zFront) => {
    root.add(prism(poly, zMid - zBack, [hullDark, hullM], rs, (zBack + zMid) / 2));
    const low = poly.map((p, i) => isTop(p, i) ? [p[0], p[1] - drop] : p);
    root.add(prism(low, zFront - zMid, [hullDark, hullM], rs, (zMid + zFront) / 2));
    const pos = [], uv = [];
    for (let i = 0; i < poly.length - 1; i++) {
      if (!isTop(poly[i], i) || !isTop(poly[i + 1], i + 1)) continue;
      const [a, b] = [poly[i], poly[i + 1]];
      const q = [[a[0], a[1], zMid], [b[0], b[1], zMid], [b[0], b[1] - drop, zFront], [a[0], a[1] - drop, zFront]];
      for (const k of [0, 3, 2, 0, 2, 1]) { pos.push(q[k][0] * rs, q[k][1] * rs, q[k][2] * rs); uv.push(q[k][0] / 2000, q[k][2] / 2000); }
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.computeVertexNormals();
    root.add(new THREE.Mesh(g, tmat(hullT, { emissive: 0x4a463c, side: THREE.DoubleSide })));
  };
  const nTop = nose.length - 3;
  shoulder(nose, (p, i) => i < nTop, 140, -450, 150, 450);
  const deckSet = new Set(deck);
  shoulder(main, (p, i) => (p[0] >= -3400 && p[0] <= 976 && i < 10) || deckSet.has(p), 300, -750, 250, 750);
  // cheek panels and a darker keel stripe for volume
  root.add(prism([[-3000, -500], [3300, -2300], [3500, -2000], [-2800, -250]], 1650, [mat(0x8a877c), mat(0x9a978c)], rs));
  // swept dorsal wing along the slope with the red emblem, extending back into the screen
  const slope = top.filter(p => p[0] >= 976);
  const wingPoly = [...slope, [4100, 3200], [1951, 2440], [1557, 2215], [976, 1780]];
  const wing = prism(wingPoly, 3200, [hullDark, hullM], rs, -900); root.add(wing);
  const [a, b] = [slope[0], slope[slope.length - 1]];
  const ang = Math.atan2(b[1] - a[1], b[0] - a[0]), len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const logo = new THREE.Mesh(new THREE.PlaneGeometry(len * 0.8 * rs, 1800 * rs), new THREE.MeshLambertMaterial({ map: logoTexture(), transparent: true, depthWrite: false }));
  logo.rotation.order = 'ZXY'; logo.rotation.set(-Math.PI / 2, 0, 0); logo.rotation.z = ang;
  logo.position.set((a[0] + b[0]) / 2 * rs, ((a[1] + b[1]) / 2 + 12) * rs, -1100 * rs);
  root.add(logo);
  const txt = new THREE.Mesh(new THREE.PlaneGeometry(1500 * rs, 280 * rs), new THREE.MeshBasicMaterial({ map: textTexture(), transparent: true, depthWrite: false }));
  txt.position.set(2500 * rs, 700 * rs, 752 * rs); root.add(txt);
  // lower swept wings reaching toward the camera and away from it
  for (const sz of [1, -1]) {
    const geo = new THREE.BufferGeometry();
    const v = [-1200, -300, 750 * sz, 3000, -700, 750 * sz, 3400, -3000, 3600 * sz];
    geo.setAttribute('position', new THREE.Float32BufferAttribute(v.map(x => x * rs), 3)); geo.computeVertexNormals();
    root.add(new THREE.Mesh(geo, mat(0xc8c4b4, { side: THREE.DoubleSide, flat: true })));
  }
  // engines: outboard nacelles + glow at the rear of the deck pod
  const engM = mat(0x77777c, { flat: true });
  const glows = [];
  const engine = (x0, x1, y, z, r) => {
    const cyl = new THREE.Mesh(new THREE.CylinderGeometry(r * rs, r * 0.9 * rs, (x1 - x0) * rs, 8), engM);
    cyl.rotation.z = Math.PI / 2; cyl.position.set((x0 + x1) / 2 * rs, y * rs, z * rs); root.add(cyl);
    const cone = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.75 * rs, r * 0.95 * rs, 500 * rs, 8), mat(0x55555a, { flat: true }));
    cone.rotation.z = Math.PI / 2; cone.position.set((x1 + 250) * rs, y * rs, z * rs); root.add(cone);
    const gl = new THREE.Mesh(new THREE.CircleGeometry(r * 0.7 * rs, 12), new THREE.MeshBasicMaterial({ color: 0xfff0a0, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false }));
    gl.rotation.y = Math.PI / 2; gl.position.set((x1 + 505) * rs, y * rs, z * rs); root.add(gl); glows.push(gl);
    const halo = new THREE.Mesh(new THREE.SphereGeometry(r * rs, 10, 8), new THREE.MeshBasicMaterial({ color: 0xc8d040, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false }));
    halo.scale.set(0.6, 1, 1); halo.position.copy(gl.position); root.add(halo); glows.push(halo);
  };
  engine(4300, 8100, -1100, 1500, 650);
  engine(4300, 8100, -1100, -1600, 650);
  // rear deck pod end cap glow
  const capGlow = new THREE.Mesh(new THREE.CircleGeometry(420 * rs, 12), new THREE.MeshBasicMaterial({ color: 0xfff4b0, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false }));
  capGlow.rotation.y = Math.PI / 2; capGlow.position.set(8540 * rs, 150 * rs, 0); root.add(capGlow); glows.push(capGlow);
  // drifting space junk (girders and wreck panels)
  const junk = [];
  const R = rng(3);
  for (let i = 0; i < 6; i++) {
    const j = new THREE.Group();
    const s = 300 + R() * 350;
    if (i % 2) { j.add(kit.box(s * 3 * rs, s * 0.25 * rs, s * 0.25 * rs, 0x4a3a34)); j.add(kit.box(s * 0.25 * rs, s * 2 * rs, s * 0.25 * rs, 0x3c302c)); }
    else { j.add(kit.box(s * 2 * rs, s * 0.25 * rs, s * 1.4 * rs, 0x6a6a70)); j.add(kit.box(s * 0.3 * rs, s * 1.6 * rs, s * 0.3 * rs, 0x5a3020, [s * 0.5 * rs, s * 0.6 * rs, 0])); }
    j.position.set((-14000 + R() * 28000) * rs, (-2000 + R() * 12000) * rs, (-7000 - R() * 7000) * rs);
    j.userData = { spin: [(R() - 0.5) * 0.01, (R() - 0.5) * 0.01, (R() - 0.5) * 0.01], drift: (R() - 0.5) * 3 };
    root.add(j); junk.push(j);
  }
  const arwing = makeArwing(rs); root.add(arwing); arwing.visible = false;
  return { root, background: bg, arwing, glows, junk, lasers: new Map(), blasts: new Map(), scene: root };
}

const LASER_GEO = new THREE.BoxGeometry(1, 1, 1);
export function syncSectorZ(obj, m, rs, st) {
  if (!obj) return;
  const t = m.frame;
  for (const g of obj.glows) g.material.opacity = (g.geometry.type === 'SphereGeometry' ? 0.3 : 0.85) + Math.sin(t * 0.6 + g.id) * 0.08;
  for (const j of obj.junk) { j.rotation.x += j.userData.spin[0]; j.rotation.y += j.userData.spin[1]; j.rotation.z += j.userData.spin[2]; j.position.x += j.userData.drift * rs; if (Math.abs(j.position.x) > 160) j.position.x *= -0.98; }
  const A = st.arw, aw = obj.arwing;
  aw.visible = !!A && A.state === 'fly';
  if (aw.visible) {
    aw.position.set(A.x * rs, A.y * rs, A.z * rs);
    let dx = A.x - A.px, dy = A.y - A.py, dz = A.z - A.pz;
    if (Math.abs(A.z) < 1) { dx = -Math.max(20, Math.abs(dx)); dz = 0; dy = Math.max(-0.6, Math.min(0.6, dy / Math.abs(dx))) * Math.abs(dx); }
    if (Math.hypot(dx, dy, dz) > 0.01) aw.lookAt(aw.position.x + dx, aw.position.y + dy, aw.position.z + dz);
    aw.userData.model.rotation.z = (Math.abs(A.z) < 1 ? 0.3 : 0) + Math.sin(t * 0.05) * 0.08;
    aw.userData.glow.scale.setScalar(0.9 + Math.sin(t * 0.9) * 0.15);
  }
  // lasers
  const seen = new Set();
  for (const L of st.lasers) {
    seen.add(L);
    let v = obj.lasers.get(L);
    if (!v) {
      v = new THREE.Group();
      for (const z of L.kind === '2d' ? [-260, 260] : [0]) {
        const core = new THREE.Mesh(LASER_GEO, new THREE.MeshBasicMaterial({ color: L.kind === '2d' ? 0xff4060 : 0xff6a30, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false }));
        core.scale.set(700 * rs, 50 * rs, 50 * rs); core.position.z = z * rs; v.add(core);
        const glow = new THREE.Mesh(LASER_GEO, new THREE.MeshBasicMaterial({ color: 0xff90b0, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false }));
        glow.scale.set(800 * rs, 130 * rs, 130 * rs); glow.position.z = z * rs; v.add(glow);
      }
      obj.root.add(v); obj.lasers.set(L, v);
    }
    v.position.set(L.x * rs, L.y * rs, (L.z ?? 0) * rs);
    if (L.kind === '3d') v.lookAt(v.position.x + L.vx, v.position.y + L.vy, v.position.z + L.vz), v.rotateY(Math.PI / 2);
  }
  for (const [L, v] of obj.lasers) if (!seen.has(L)) { obj.root.remove(v); obj.lasers.delete(L); }
  const seenB = new Set();
  for (const b of st.blasts) {
    seenB.add(b);
    let v = obj.blasts.get(b);
    if (!v) { v = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffa040, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false })); obj.root.add(v); obj.blasts.set(b, v); }
    const k = 1 - b.t / 16;
    v.position.set(b.x * rs, b.y * rs, 0); v.scale.setScalar((120 + k * 220) * rs); v.material.opacity = 0.95 * (1 - k * 0.7);
  }
  for (const [b, v] of obj.blasts) if (!seenB.has(b)) { obj.root.remove(v); obj.blasts.delete(b); }
}
