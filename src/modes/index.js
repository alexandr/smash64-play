// 1P modes (1P Game ladder, Bonus practice, Training). registerModes(app) adds the screens:
//   'oneplayer' { char, color, difficulty, stocks, time?, port? }  -> VS card -> stages -> tally / continue -> ending
//   'training'  { players: [{char,color,port},{char,color,port,cpu:true}], stage }
//   'bonus'     { kind: 'btt'|'btp', char, color }
// plus the internal screens p1card, p1battle, p1tally, p1continue, p1gameover, p1challenger, p1unlock,
// p1clear, p1bonusresult.
import { OnePBattleScreen } from './battle1p.js';
import { CardScreen, TallyScreen, ContinueScreen, GameOverScreen, ChallengerScreen, UnlockScreen, ClearScreen, BonusResultScreen } from './screens1p.js';
import { TrainingScreen } from './training.js';
import { startRun, startPractice } from './flow.js';

class OnePEntry {
  constructor(app, p) { this.app = app; this.p = p; }
  enter() { startRun(this.app, this.p); }
  update() {} render() {}
}
class BonusEntry {
  constructor(app, p) { this.app = app; this.p = p; }
  enter() { startPractice(this.app, this.p); }
  update() {} render() {}
}

export function registerModes(app) {
  app.register('oneplayer', OnePEntry);
  app.register('bonus', BonusEntry);
  app.register('training', TrainingScreen);
  app.register('p1card', CardScreen);
  app.register('p1battle', OnePBattleScreen);
  app.register('p1tally', TallyScreen);
  app.register('p1continue', ContinueScreen);
  app.register('p1gameover', GameOverScreen);
  app.register('p1challenger', ChallengerScreen);
  app.register('p1unlock', UnlockScreen);
  app.register('p1clear', ClearScreen);
  app.register('p1bonusresult', BonusResultScreen);
}
