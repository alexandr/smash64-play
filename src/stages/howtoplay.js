// How to Play (Explain) stage — Dream Land variant used by the tutorial demo: same island art, a single
// soft platform on the left, no Whispy wind.
import { makeStage } from './common.js';
import { buildDreamLand } from './dreamland.js';
import data from './data/how_to_play.js';

export const howtoplay = makeStage(data, {
  id: 'howtoplay', series: 'kirby', music: 'howtoplay',
  build: (scene, rs, d) => buildDreamLand(scene, rs, d, { bare: true }),
});
