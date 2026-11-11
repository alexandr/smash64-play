// Break the Targets / Board the Platforms stages (Bonus 1 / Bonus 2), one per character.
// Logic (targets, platforms, damaging floors) in bonus_common.js; visuals in bonus_art.js.
// API for the 1P mode — see the header of bonus_common.js:
//   st.targets / st.targetsLeft, events 'target' & 'targetsComplete', hook st.onBreak(target, m)
//   st.platforms / st.platformsLeft, events 'platform' & 'platformsComplete', hook st.onBoard(p, m)
import { makeStage } from './common.js';
import * as T from './data/bonus_index.js';
import { initTargets, updateTargets, initPlatforms, updatePlatforms, damagingFloorHazards } from './bonus_common.js';
import { buildBonus, syncBonus } from './bonus_art.js';

const CHARS = { mario: 'mario', fox: 'fox', dk: 'donkey_kong', samus: 'samus', luigi: 'luigi', link: 'link', yoshi: 'yoshi', falcon: 'captain_falcon', kirby: 'kirby', pikachu: 'pikachu', jigglypuff: 'jigglypuff', ness: 'ness' };

function bonusStage(kind, c, d) {
  const data = T[kind + '_' + d];
  const btt = kind === 'btt';
  return makeStage(data, {
    id: kind + '_' + c, music: 'bonus', series: 'smash',
    clearColor: 0x141a50,
    options: { ambient: 0.75, sun: 1.25, bgParallax: 0.9, bonusKind: kind, bonusChar: d },
    init(m, st) {
      // no rebirth point in the data: respawn above the player's start (practice mode)
      if (!data.respawn) st.respawn = [data.spawns[0][0], data.spawns[0][1] + 300];
      if (btt) initTargets(m, st, data); else initPlatforms(m, st, data);
    },
    update(m, st) { if (btt) updateTargets(m, st); else updatePlatforms(m, st); },
    hazardHitboxes: (m, st) => damagingFloorHazards(m, st),
    build: (scene, rs, dd, st) => buildBonus(scene, rs, dd, st, d),
    sync: (obj, m, rs, st) => syncBonus(obj, m, rs, st),
  });
}

export function makeBonusStages() {
  const out = {};
  for (const [c, d] of Object.entries(CHARS)) {
    out['btt_' + c] = bonusStage('btt', c, d);
    out['btp_' + c] = bonusStage('btp', c, d);
  }
  return out;
}
