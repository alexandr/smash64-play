// Yoshi's Island (small) — 1P Yoshi Team stage: same storybook art, lower soft platforms, no clouds.
import { makeStage } from './common.js';
import { buildYoshiIsland } from './yoshi_art.js';
import data from './data/yoshis_island_small.js';

export const yoshismall = makeStage(data, {
  id: 'yoshismall', series: 'yoshi', music: 'yoshi',
  options: { bgParallax: 1, ambient: 0.85, sun: 1.0 },
  build: (scene, rs, d) => buildYoshiIsland(scene, rs, d, { clouds: false, treeY: 1000 }),
});
