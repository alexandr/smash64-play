// 1P-mode tables, transcribed from the decomp (VetriTheRetri/ssb-decomp-re, US region):
//   src/sc/sc1pmode/sc1pgame.c      dSC1PGameComputerDesc / dSC1PGameStageDesc (levels, handicaps, items, teams)
//   src/ft/ftcommondata.c           dFTCommonDataHandicapTable (rows 1-40, rows 10+ are 1P-only enemies)
//   src/sc/sc1pmode/sc1pstageclear.c dSC1PStageClearBonusData (special bonus names + points), multipliers
//   src/sc/sc1pmode/sc1pmanager.c   ladder flow, continues / level drop, challenger + unlock conditions
//   src/relocData/215_GDonkeyMain.c, 206_MMarioMain.c (Giant DK / Metal Mario attributes)

export const DIFFICULTIES = ['Very Easy', 'Easy', 'Normal', 'Hard', 'Very Hard'];
export const DIFF_KEYS = ['veryeasy', 'easy', 'normal', 'hard', 'veryhard'];
export function diffIndex(d) {
  if (typeof d === 'number') return Math.max(0, Math.min(4, d));
  const k = String(d ?? 'normal').toLowerCase().replace(/[^a-z]/g, '');
  const i = DIFF_KEYS.indexOf(k); return i < 0 ? 2 : i;
}

// [attack multiplier, defend multiplier]; index = handicap - 1 (US table)
export const HANDICAP_TABLE = [
  [0.55, 1.8181818], [0.6, 15 / 9], [0.7, 10 / 7], [0.75, 12 / 9], [0.8, 11.25 / 9], [0.9, 10 / 9], [0.95, 10 / 9.5], [1.0, 1.0], [1.09, 0.9174312],
  [0.5, 45 / 9], [0.55, 36 / 9], [0.6, 30 / 9], [0.65, 20 / 7], [0.7, 22.5 / 9],                  // 10-14 Yoshi Team
  [0.75, 1.8181818], [0.8, 1.6949153], [0.85, 1.5873016], [0.9, 1.4925373], [0.95, 1.4084507],    // 15-19 Kirby Team
  [0.65, 30 / 9], [0.7, 20 / 7], [0.74, 22.5 / 9], [0.77, 20 / 9], [0.8, 18 / 9],                 // 20-24 Polygon Team
  [1.0, 4 / 7], [1.05, 0.53763443], [1.1, 0.5128205], [1.15, 0.4761905], [1.23, 0.45045045],      // 25-29 Giant DK
  [1.05, 0.43478262], [1.1, 3 / 7.5], [1.15, (10 / 3) / 9], [1.2, 0.35714287], [1.25, 3 / 9],     // 30-34 Metal Mario
  [0.9, 1], [1.0, 1], [1.1, 1], [1.22, 1], [1.5, 1],                                              // 35-39 Master Hand
  [1.08, (200 / 24) / 9],                                                                         // 40 Samus (Very Hard)
];
export function handicapMuls(h) { return HANDICAP_TABLE[Math.max(1, Math.min(40, h)) - 1]; }

// Item switch per stage (decomp nSCBattleItemSwitch*) mapped to the VS item-frequency names
const IT = { none: 'off', verylow: 'verylow', low: 'low', middle: 'middle', high: 'high' };

// The ladder (spgame_stage 0..13). lv/hc = enemy CPU level / handicap per difficulty (Very Easy..Very Hard);
// allyLv/allyHc for allies. count = team size, sim = members on stage at once.
export const LADDER = [
  { id: 'link', kind: 'vs', label: 'Stage1', stage: 'hyrule', enemies: ['link'], name: 'Link', lv: [1, 2, 3, 6, 8], hc: [9, 9, 9, 9, 9], items: IT.low, teamAttack: true },
  { id: 'yoshi', kind: 'team', label: 'Stage2', stage: 'yoshismall', enemies: ['yoshi'], name: 'Yoshi Team', count: 18, sim: 3, variations: 6, lv: [1, 2, 4, 6, 8], hc: [10, 11, 12, 13, 14], items: IT.middle, teamAttack: true },
  { id: 'fox', kind: 'vs', label: 'Stage3', stage: 'sectorz', enemies: ['fox'], name: 'Fox', lv: [2, 3, 5, 7, 9], hc: [9, 9, 9, 9, 9], items: IT.middle, teamAttack: true },
  { id: 'bonus1', kind: 'btt', label: 'Bonus Stage1', caption: 'Break the Targets!', say: 'Break the targets!', items: IT.none },
  { id: 'mariobros', kind: 'vs', label: 'Stage4', stage: 'peach', enemies: ['mario', 'luigi'], name: 'Mario Bros.', allies: 1, lv: [2, 3, 5, 7, 9], hc: [9, 9, 9, 9, 9], allyLv: [5, 5, 5, 4, 2], allyHc: [9, 9, 9, 9, 9], items: IT.middle, teamAttack: false },
  { id: 'pikachu', kind: 'vs', label: 'Stage5', stage: 'saffron', enemies: ['pikachu'], name: 'Pikachu', lv: [3, 4, 5, 7, 9], hc: [9, 9, 9, 9, 9], items: IT.middle, teamAttack: true },
  { id: 'giantdk', kind: 'vs', label: 'Stage6', stage: 'congo', enemies: ['giantdk'], name: 'Giant DK', allies: 2, lv: [2, 4, 6, 7, 8], hc: [25, 26, 27, 28, 29], allyLv: [4, 4, 4, 3, 2], allyHc: [7, 7, 7, 7, 7], items: IT.high, teamAttack: false },
  { id: 'bonus2', kind: 'btp', label: 'Bonus Stage2', caption: 'Board the Platforms!', say: 'Board the platforms!', items: IT.none },
  { id: 'kirby', kind: 'team', label: 'Stage7', stage: 'dreamland', enemies: ['kirby'], name: 'Kirby Team', count: 8, sim: 2, lv: [3, 4, 5, 6, 7], hc: [15, 16, 17, 18, 19], items: IT.middle, teamAttack: true },
  { id: 'samus', kind: 'vs', label: 'Stage8', stage: 'zebes', enemies: ['samus'], name: 'Samus', lv: [5, 6, 8, 9, 9], hc: [9, 9, 9, 9, 40], items: IT.middle, teamAttack: true },
  { id: 'metalmario', kind: 'vs', label: 'Stage9', stage: 'metacrystal', enemies: ['metalmario'], name: 'Metal Mario', lv: [1, 3, 4, 6, 8], hc: [30, 31, 32, 33, 34], items: IT.verylow, teamAttack: true },
  { id: 'bonus3', kind: 'race', label: 'Bonus Stage3', stage: 'race', caption: 'Race to the Finish!', say: 'Race to the finish!', lv: [6, 8, 9, 9, 9], hc: [1, 3, 5, 7, 9], items: IT.none },
  { id: 'polygon', kind: 'team', label: 'Stage10', stage: 'duelzone', enemies: ['polygon'], name: 'Fighting Polygon Team', count: 30, sim: 3, variations: 12, lv: [2, 3, 4, 5, 7], hc: [20, 21, 22, 23, 24], items: IT.high, teamAttack: true },
  { id: 'final', kind: 'boss', label: 'Final Stage', stage: 'final', enemies: ['masterhand'], name: 'Master Hand', lv: [1, 2, 3, 4, 5], hc: [35, 36, 37, 38, 39], items: IT.none, teamAttack: true },
];

// "Challenger Approaching" fights (dSC1PGameStageDesc 14-17): fought on that character's stage, no time limit
export const CHALLENGERS = {
  luigi: { id: 'luigi', kind: 'challenger', label: 'Challenger', stage: 'peach', enemies: ['luigi'], name: 'Luigi', lv: [6, 7, 7, 8, 9], hc: [6, 6, 6, 6, 6], items: IT.none, teamAttack: true },
  ness: { id: 'ness', kind: 'challenger', label: 'Challenger', stage: 'dreamland', enemies: ['ness'], name: 'Ness', lv: [6, 7, 7, 8, 9], hc: [6, 6, 6, 6, 6], items: IT.none, teamAttack: true },
  jigglypuff: { id: 'jigglypuff', kind: 'challenger', label: 'Challenger', stage: 'saffron', enemies: ['jigglypuff'], name: 'Jigglypuff', lv: [6, 7, 7, 8, 9], hc: [6, 6, 6, 6, 6], items: IT.none, teamAttack: true },
  falcon: { id: 'falcon', kind: 'challenger', label: 'Challenger', stage: 'zebes', enemies: ['falcon'], name: 'Captain Falcon', lv: [6, 7, 7, 8, 9], hc: [6, 6, 6, 6, 6], items: IT.none, teamAttack: true },
};
export const UNLOCK_TEXT = {
  luigi: 'You can now use Luigi, the eternal understudy.',
  ness: 'You can now use Ness, the boy from Onett.',
  jigglypuff: 'You can now use Jigglypuff, the singing Pokémon.',
  falcon: 'You can now use Captain Falcon, the F-Zero racer.',
  mushroomkingdom: 'You can now play on the Mushroom Kingdom stage!',
  soundtest: 'The Sound Test is now available.',
};

// Kirby Team copy abilities in order (dSC1PGameKirbyTeamCopyKinds); the 8th Kirby copies a random unlocked fighter
export const KIRBY_COPIES = ['mario', 'dk', 'link', 'samus', 'yoshi', 'fox', 'pikachu'];

// No Miss multiplier by ladder index (sc1PStageClearGetNoMissMultiplier)
export const NOMISS_MUL = [1, 2, 3, 0, 4, 5, 6, 0, 7, 8, 9, 0, 10, 11];

// Special bonuses (US points). `stageClear` points are multiplied by (difficulty + 1);
// `noMiss` by NOMISS_MUL. Names as printed on the tally.
export const BONUS = {
  cheapShot: ['Cheap Shot', -99], starFinish: ['Star Finish', 10000], noItem: ['No Item', 1000], shieldBreaker: ['Shield Breaker', 8000],
  judoWarrior: ['Judo Warrior', 5000], hawk: ['Hawk', 18000], shooter: ['Shooter', 12000], heavyDamage: ['Heavy Damage', 28000],
  allVariations: ['All Variations', 30000], itemStrike: ['Item Strike', 20000], trickster: ['Trickster', 11000], speedster: ['Speedster', 10000],
  itemThrow: ['Item Throw', 16000], pacifist: ['Pacifist', 60000], perfect: ['Perfect', 30000], noMiss: ['No Miss', 5000],
  noDamage: ['No Damage', 15000], fullPower: ['Full Power', 5000], stageClear: ['Clear', 70000], noMissClear: ['No Miss Clear', 70000],
  noDamageClear: ['No Damage Clear', 400000], speedKing: ['Speed King', 40000], speedDemon: ['Speed Demon', 80000], mewCatcher: ['Mew Catcher', 15000],
  starClear: ['Star Clear', 12000], vegetarian: ['Vegetarian', 9000], heartThrob: ['Heart Throb', 17000], throwDown: ['Throw Down', 2000],
  smashMania: ['Smash Mania', 3500], smashless: ['Smash-less', 5000], specialMove: ['Special Move', 5000], singleMove: ['Single Move', 8000],
  pokemonFinish: ['Pokémon Finish', 11000], boobyTrap: ['Booby Trap', 12000], fighterStance: ['Fighter Stance', 100], mystic: ['Mystic', 7000],
  cometMystic: ['Comet Mystic', 10000], acidClear: ['Acid Clear', 1500], bumperClear: ['Bumper Clear', 10000], tornadoClear: ['Tornado Clear', 3000],
  arwingClear: ['ARWING Clear', 4000], lastSecond: ['Last Second', 8000], lucky3: ['Lucky 3', 9990], jackpot: ['Jackpot', 3330],
  yoshiRainbow: ['Yoshi Rainbow', 50000], kirbyRanks: ['Kirby Ranks', 25000], brosCalamity: ['Bros. Calamity', 25000],
  dkDefender: ['DK Defender', 10000], dkPerfect: ['DK Perfect', 50000], goodFriend: ['Good Friend', 8000], trueFriend: ['True Friend', 25000],
};
// tally order = decomp enum order
export const BONUS_ORDER = Object.keys(BONUS);

// Tally multipliers: timer seconds x50 (VS stages), x200 (targets/platforms, only when all 10 done), x500 (race);
// damage dealt x10; each target / platform 1000.
export const TIMER_MUL = { vs: 50, team: 50, boss: 50, challenger: 50, btt: 200, btp: 200, race: 500 };

// Giant DK (GDonkeyMain: size 2.0 vs DK 1.25) and Metal Mario (MMarioMain) attribute overrides
export const GIANT_DK_ATTR = { weight: 0.93, gravity: 4.0, tvel: 72, ffall: 100, jsq: 8, jmul: 0.85, jbase: 65, djh: 1.0, jvx: 0.5, walkMul: 0.5,
  dash: 90, dashDecel: 5.5, run: 70, dashToRun: 19, traction: 1.6, airAccel: 0.025, airMax: 30, airFric: 0.3, shieldSize: 350, breakVy: 120 };
export const GIANT_DK_SCALE = 2.0 / 1.25;
export const METAL_MARIO_ATTR = { weight: 1.0, gravity: 4.8, tvel: 100, ffall: 100, jsq: 8, jmul: 0.7, jbase: 38, djh: 1.1, jvx: 0.5, walkMul: 0.3,
  dash: 50, dashDecel: 2.8, run: 40, dashToRun: 18, traction: 4.0, airAccel: 0.035, airMax: 30, airFric: 0.2 };
export const METAL_MARIO_SCALE = 1.0 / 1.12;

// Ladder progress-chain figurines on the VS card (stage icons, last = Smash emblem for Master Hand)
export const CHAIN = ['link', 'yoshi', 'fox', 'bonus', 'mario', 'pikachu', 'dk', 'bonus', 'kirby', 'samus', 'mario', 'bonus', 'polygon', 'masterhand'];
