// Yoshi's Island — pop-up storybook stage with the three disappearing clouds (reference/spec/stages.md).
import { makeStage } from './common.js';
import { buildYoshiIsland, cloudInit, cloudUpdate, cloudSync } from './yoshi_art.js';
import data from './data/yoshis_island.js';

export const yoshi = makeStage(data, {
  id: 'yoshi', series: 'yoshi', music: 'yoshi',
  options: { bgParallax: 1, ambient: 0.85, sun: 1.0 },
  init(m, st) { cloudInit(m, st); },
  update(m, st) { cloudUpdate(m, st); },
  build: (scene, rs, d) => buildYoshiIsland(scene, rs, d, { clouds: true }),
  sync: (obj, m, rs, st) => cloudSync(obj, m, rs, st),
});
