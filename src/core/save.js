// Persistent data (unlocks, records, options) in localStorage, guarded for private windows.
const KEY = 'smash64-save-v1';
const DEFAULT = {
  unlocked: { luigi: false, ness: false, falcon: false, jigglypuff: false, mushroomkingdom: false, itemswitch: false, soundtest: false },
  records: { btt: {}, btp: {}, oneP: [] },
  vsPlays: 0,
  options: { sound: 'stereo', difficulty: 'normal', stocks1P: 3 },
  vsRules: { mode: 'time', time: 2, stocks: 3, handicap: 'off', teamAttack: false, stageSelect: true, items: 'middle', itemSwitch: null, teams: false },
  unlockAll: false,
};
export class Save {
  constructor() {
    this.data = structuredClone(DEFAULT);
    try { const s = localStorage.getItem(KEY); if (s) this.data = deepMerge(structuredClone(DEFAULT), JSON.parse(s)); } catch {}
  }
  write() { try { localStorage.setItem(KEY, JSON.stringify(this.data)); } catch {} }
  isUnlocked(id) { return this.data.unlockAll || this.data.unlocked[id] !== false; }
}
function deepMerge(a, b) {
  for (const k in b) {
    if (b[k] && typeof b[k] === 'object' && !Array.isArray(b[k]) && a[k] && typeof a[k] === 'object') deepMerge(a[k], b[k]);
    else a[k] = b[k];
  }
  return a;
}
