// 1P Game flow (sc1pmanager.c): stage loop with VS cards, tallies, continues (level drop), game over,
// game clear, "Challenger Approaching" unlock fights, unlock messages and save records.
import { LADDER, CHALLENGERS, diffIndex } from './data.js';
import { makePlan, newRun } from './logic.js';
import { STARTERS, ROSTER } from '../chars/index.js';

// ------------------------------------------------------------------ save helpers
export function saveData(app) { return app.save?.data ?? {}; }
export function records(app) {
  const d = saveData(app);
  d.records ??= {}; d.records.btt ??= {}; d.records.btp ??= {}; d.records.onePChar ??= {};
  if (!Array.isArray(d.records.oneP)) d.records.oneP = [];
  return d.records;
}
function write(app) { try { app.save?.write?.(); } catch {} }
export function isUnlocked(save, id) { return save?.isUnlocked ? save.isUnlocked(id) : save?.data?.unlocked?.[id] !== false; }
export function unlock(app, id) {
  const d = saveData(app); d.unlocked ??= {};
  if (d.unlocked[id] === true) return false;
  d.unlocked[id] = true; write(app); return true;
}

// Bonus practice records: records.btt[char] = { count, time } (time in frames, only once all 10 are done)
export function saveBonusRecord(app, kind, char, count, frames) {
  const r = records(app)[kind];
  const cur = r[char] ?? { count: 0, time: null };
  let newRecord = false;
  if (count >= 10) {
    if (cur.time == null || frames < cur.time) { cur.time = frames; newRecord = true; }
    cur.count = 10;
  } else if (count > (cur.count ?? 0)) { cur.count = count; newRecord = true; }
  r[char] = cur; write(app);
  return newRecord;
}

// 1P high score per character (sc1PManagerTrySaveBackup)
export function save1PRecord(app, run, complete) {
  const R = records(app);
  const cur = R.onePChar[run.char] ?? { hiscore: 0, continues: 0, bonuses: 0, bestDifficulty: 0, complete: false };
  if (run.score > cur.hiscore) {
    cur.hiscore = run.score; cur.continues = run.continues; cur.bonuses = run.bonusCount;
    cur.bestDifficulty = complete ? run.diff + 1 : 0;
  }
  if (complete) cur.complete = true;
  R.onePChar[run.char] = cur;
  R.oneP_hi ??= {}; R.oneP_hi[run.char] = Math.max(R.oneP_hi[run.char] ?? 0, run.score);   // read by the 1P CSS
  R.oneP.push({ char: run.char, score: run.score, difficulty: run.diff, complete, continues: run.continues });
  R.oneP.sort((a, b) => b.score - a.score); R.oneP.length = Math.min(R.oneP.length, 10);
  write(app);
}

// ------------------------------------------------------------------ unlock conditions (decomp, US)
// After clearing the 1P Game (sc1PManagerTrySetChallengers): Ness = Normal or harder, no continues, 3 or fewer
// stocks; else Captain Falcon = total time under 12 minutes (US; JP 20); else Jigglypuff = any clear.
export function checkChallenger(run, save) {
  if (!isUnlocked(save, 'ness') && run.diff >= 2 && run.continues === 0 && run.stocksSetting <= 3) return 'ness';
  if (!isUnlocked(save, 'falcon') && run.totalFrames < 12 * 60 * 60) return 'falcon';
  if (!isUnlocked(save, 'jigglypuff')) return 'jigglypuff';
  return null;
}
// Luigi: Break the Targets (Bonus 1 Practice) completed with all 8 starters (sc1pbonusstage.c)
export function checkLuigiUnlock(save) {
  if (isUnlocked(save, 'luigi')) return false;
  const r = save?.data?.records?.btt ?? {};
  return STARTERS.every(c => (r[c]?.count ?? 0) >= 10);
}
// Sound Test: targets and platforms completed with all 12 characters
export function checkSoundTest(save) {
  if (save?.data?.unlocked?.soundtest === true) return false;
  const r = save?.data?.records ?? {};
  return ROSTER.every(c => (r.btt?.[c]?.count ?? 0) >= 10 && (r.btp?.[c]?.count ?? 0) >= 10);
}
// Mushroom Kingdom (sc1pmanager.c / mnvsresults.c): every VS stage played and the 1P Game cleared with all
// 8 starters. The VS-stage list is read from records.vsStages / stagesPlayed when the VS screens record it.
export function checkMushroom(save) {
  const d = save?.data ?? {};
  if (d.unlocked?.mushroomkingdom === true) return false;
  const R = d.records ?? {};
  if (!STARTERS.every(c => R.onePChar?.[c]?.complete)) return false;
  const played = R.vsStages ?? d.stagesPlayed;
  if (played) {
    const vs = ['peach', 'sectorz', 'congo', 'zebes', 'hyrule', 'yoshi', 'dreamland', 'saffron'];
    const has = s => Array.isArray(played) ? played.includes(s) : !!played[s];
    if (!vs.every(has)) return false;
  }
  return true;
}

// ------------------------------------------------------------------ navigation
export function exitTo(app, kind = '1p', extra = {}) {
  app.input.cpuDrivers?.fill?.(null);
  if (kind === 'bonus1' || kind === 'bonus2') {
    if (app.screens.css) return app.go('css', { mode: kind, ...extra });
  }
  if (kind === 'training' && app.screens.css) return app.go('css', { mode: 'training', ...extra });
  if (app.screens.menu1p) return app.go('menu1p', extra);
  if (app.screens.title) return app.go('title', extra);
  app.go('oneplayer', {});
}

export function startRun(app, params) {
  const run = newRun({ char: params.char, color: params.color, port: params.port, difficulty: diffIndex(params.difficulty ?? diffFromSave(app)), stocks: params.stocks ?? saveData(app).options?.stocks1P ?? 3,
    time: params.time, startStage: params.startStage }, app.save);
  app.oneP = { run };
  startStage(app, run);
}
function diffFromSave(app) {
  const d = saveData(app).options?.difficulty;
  const keys = ['veryeasy', 'easy', 'normal', 'hard', 'veryhard'];
  if (typeof d === 'number') return d;
  const k = keys.indexOf(String(d ?? 'normal').toLowerCase().replace(/[^a-z]/g, ''));
  return k < 0 ? 2 : k;
}

export function startStage(app, run) {
  if (run.stage >= LADDER.length) return gameClear(app, run);
  const plan = makePlan(run, run.stage);
  app.go('p1card', { run, plan });
}

// called by the battle screen when its match is over
export function afterBattle(app, { run, plan, logic, quit, snapshot, practice }) {
  if (practice) return afterPractice(app, { run, plan, logic, quit, snapshot });
  if (quit) { save1PRecord(app, run, false); return exitTo(app); }
  logic.commitRun();
  if (plan.challenger) return afterChallenger(app, run, plan, logic);
  const out = logic.outcome();
  if (out === 'lose') return app.go('p1continue', { run, plan, snapshot });
  // stocks carry over to the next stage
  if (!logic.isBonus()) run.stocks = Math.max(1, logic.player.stocks);
  run.levelDrop = 0; run.levelGuard = 2;
  const tally = logic.tally();
  run.bonusCount += tally.bonuses.length;
  run.log.push({ stage: plan.spec.id, out, total: tally.total });
  app.go('p1tally', { run, plan, tally, snapshot, onDone: () => { run.stage++; startStage(app, run); } });
}

export function continueGame(app, run) {
  run.continues++;
  run.score = Math.floor(run.score * 0.5);
  run.stocks = run.stocksSetting;
  if (--run.levelGuard <= 0) { run.levelGuard = 2; run.levelDrop = Math.min(9, run.levelDrop + 1); }
  startStage(app, run);
}
export function gameOver(app, run) {
  save1PRecord(app, run, false);
  app.go('p1gameover', { run });
}

function gameClear(app, run) {
  save1PRecord(app, run, true);
  app.go('p1clear', { run, onDone: () => afterClear(app, run) });
}
function afterClear(app, run) {
  const who = checkChallenger(run, app.save);
  if (who) return challenge(app, run, who);
  finishAll(app, run);
}
export function challenge(app, run, who, back = '1p') {
  run.challenger = who; run.challengeBack = back; run.challengerDrop = app.oneP?.challengerDrop ?? 0;
  run.stocks = 1;
  app.go('p1challenger', { run, who, onDone: () => {
    const plan = makePlan(run, -1, who);
    app.go('p1battle', { run, plan });
  } });
}
function afterChallenger(app, run, plan, logic) {
  const who = plan.challenger;
  if (logic.outcome() === 'win') {
    unlock(app, who);
    app.oneP = { ...(app.oneP ?? {}), challengerDrop: 0 };
    return app.go('p1unlock', { id: who, onDone: () => finishAll(app, run) });
  }
  // a lost challenge comes back later with the CPU 2 levels weaker (challenger_level_drop)
  const st = app.oneP ?? (app.oneP = {});
  st.challengerDrop = Math.min(9, (st.challengerDrop ?? 0) + 2);
  finishAll(app, run);
}
function finishAll(app, run) {
  const back = run.challengeBack ?? '1p';
  if (checkMushroom(app.save)) { unlock(app, 'mushroomkingdom'); return app.go('p1unlock', { id: 'mushroomkingdom', onDone: () => exitTo(app, back) }); }
  exitTo(app, back);
}

// ------------------------------------------------------------------ bonus practice
export function startPractice(app, params) {
  const kind = params.kind === 'btp' || params.kind === 'bonus2' || params.kind === 2 ? 'btp' : 'btt';
  const run = newRun({ char: params.char, color: params.color, port: params.port, difficulty: diffFromSave(app), stocks: 1 }, app.save);
  const plan = { idx: kind === 'btt' ? 3 : 7, spec: LADDER[kind === 'btt' ? 3 : 7], kind, stage: kind + '_' + run.char, allies: [], enemies: [], queue: [] };
  app.go('p1battle', { run, plan, practice: kind });
}
function afterPractice(app, { run, plan, logic, quit }) {
  const kind = plan.kind, back = kind === 'btt' ? 'bonus1' : 'bonus2';
  if (quit === 'retry') return startPractice(app, { kind, char: run.char, color: run.color, port: run.port });
  if (quit) return exitTo(app, back, { char: run.char });
  const count = kind === 'btt' ? logic.targetsBroken : logic.platformsBoarded;
  const frames = logic.frames;
  const prev = records(app)[kind][run.char];
  const newRecord = saveBonusRecord(app, kind, run.char, count, frames);
  app.go('p1bonusresult', { run, kind, count, frames, newRecord, prev, onDone: () => {
    if (kind === 'btt' && count >= 10 && checkLuigiUnlock(app.save)) {
      const r2 = newRun({ char: run.char, color: run.color, port: run.port, difficulty: diffFromSave(app), stocks: 1 }, app.save);
      return challenge(app, r2, 'luigi', back);
    }
    if (count >= 10 && checkSoundTest(app.save)) { unlock(app, 'soundtest'); return app.go('p1unlock', { id: 'soundtest', onDone: () => exitTo(app, back) }); }
    exitTo(app, back, { char: run.char });
  } });
}
