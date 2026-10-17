// Stage registry. VS stages in stage-select order; others are 1P-mode / tutorial stages.
import { peach } from './peach.js';
import { sectorz } from './sectorz.js';
import { congo } from './congo.js';
import { zebes } from './zebes.js';
import { hyrule } from './hyrule.js';
import { yoshi } from './yoshi.js';
import { dreamland } from './dreamland.js';
import { saffron } from './saffron.js';
import { mushroom } from './mushroom.js';
import { metacrystal } from './metacrystal.js';
import { duelzone } from './duelzone.js';
import { final } from './final.js';
import { yoshismall } from './yoshismall.js';
import { howtoplay } from './howtoplay.js';
import { race } from './race.js';
import { makeBonusStages } from './bonus.js';

export const VS_STAGES = ['peach', 'sectorz', 'congo', 'zebes', 'hyrule', 'yoshi', 'dreamland', 'saffron', 'mushroom'];
export const STAGES = { peach, sectorz, congo, zebes, hyrule, yoshi, dreamland, saffron, mushroom, metacrystal, duelzone, final, yoshismall, howtoplay, race, ...makeBonusStages() };
