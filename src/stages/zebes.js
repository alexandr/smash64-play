// Planet Zebes — decomp geometry (reference/spec/stages.md): Norfair rock island, three Brinstar platforms,
// the elevator (yakumono 2, baked 480 f path) and the acid (grzebes.c): a 16-entry table of
// {base, min, max, level} waits, an 18 f quake, then a 240 f linear rise/fall to level + rand*250
// (surface = level - 282.7). Fighters below the surface take 16%, angle 80, KBG 130, BKB 30, fire,
// with a 30 f re-hit cooldown.
import { makeStage } from './common.js';
import { buildZebes, syncZebes } from './zebes_art.js';
import data from './data/planet_zebes.js';

export const ACID_TABLE = [[1200, 60, 70, -3600], [180, 60, 70, -1000], [60, 60, 70, -200], [60, 60, 70, 1800], [60, 60, 70, -3600], [120, 0, 0, 2600],
  [30, 0, 0, -1000], [1200, 60, 70, -500], [600, 60, 70, -400], [100, 60, 70, 800], [1200, 60, 70, 1200], [60, 0, 0, -1000], [60, 60, 70, 0],
  [60, 60, 70, -1000], [120, 60, 70, 500], [200, 60, 70, -3000]];
export const ACID_SURFACE = -282.7;
const ACID_HB = { damage: 16, angle: 80, kbg: 130, bkb: 30, fkb: 0, element: 'fire', ground: true, air: true };
const rand = n => Math.floor(Math.random() * n);

function waitFor(e) { return e[0] + e[1] + (e[2] > e[1] ? rand(e[2] - e[1]) : 0); }

export const zebes = makeStage(data, {
  id: 'zebes', series: 'metroid', music: 'zebes',
  clearColor: 0x000000,
  options: { ambient: 0.55, sun: 1.5, sunDir: [-0.2, 1, 0.9], bgParallax: 0.9 },
  init(m, st) {
    st.acid = { level: ACID_TABLE[15][3], i: 0, phase: 'wait', t: waitFor(ACID_TABLE[0]), from: 0, to: 0, cool: new Map(), quake: 0 };
  },
  update(m, st) {
    const a = st.acid;
    for (const [f, t] of a.cool) { if (t <= 1) a.cool.delete(f); else a.cool.set(f, t - 1); }
    if (a.quake > 0) a.quake--;
    if (m.phase === 'play' || m.phase === 'countdown') {
      if (a.phase === 'wait') { if (--a.t <= 0) { a.phase = 'shake'; a.t = 18; a.quake = 18; m.emit('sfx', { name: 'explode' }); } }
      else if (a.phase === 'shake') { if (--a.t <= 0) { const e = ACID_TABLE[a.i]; a.phase = 'move'; a.t = 240; a.from = a.level; a.to = e[3] + Math.random() * 250; } }
      else { a.t--; a.level = a.to + (a.from - a.to) * (a.t / 240); if (a.t <= 0) { a.level = a.to; a.i = (a.i + 1) % 16; a.phase = 'wait'; a.t = waitFor(ACID_TABLE[a.i]); } }
    }
    st.acidY = a.level + ACID_SURFACE;
  },
  hazardHitboxes(m, st) {
    const a = st.acid, y = st.acidY, out = [];
    if (a === undefined || y === undefined) return out;
    for (const f of m.fighters) {
      if (f.dead || f.state === 'respawn' || a.cool.has(f) || f.y >= y) continue;
      const others = new Set(m.fighters.filter(o => o !== f));
      // launched back toward the stage centre
      out.push({ hb: ACID_HB, x: f.x + (f.x >= 0 ? 10 : -10), y: f.y + f.H * 0.5, r: 60, hit: others, unblockable: true, kind: 'acid',
        onHit(v) { a.cool.set(v, 30); } });
    }
    return out;
  },
  build(scene, rs, d, st) { return buildZebes(scene, rs, d, st); },
  sync(obj, m, rs, st) { syncZebes(obj, m, rs, st); },
});
