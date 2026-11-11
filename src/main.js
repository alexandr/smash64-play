// Entry point: build the app, register screens, start at the title (or a quick test match via URL params:
// ?quick, or any of chars= / stage= / nocount / hitboxes start a battle directly, e.g. ?manual&nocount&chars=mario,fox&stage=peach).
import { App } from './app.js';
import { BattleScreen } from './ui/screens/battle.js';
import { TitleScreen } from './ui/screens/title.js';
import { ModeSelectScreen } from './ui/screens/modeselect.js';
import { OnePMenuScreen, VSMenuScreen, OptionScreen, DataMenuScreen, BackupClearScreen, ScreenAdjustScreen, applyScreenAdjust } from './ui/screens/submenus.js';
import { VSOptionsScreen, ItemSwitchScreen } from './ui/screens/vsoptions.js';
import { CSSScreen } from './ui/screens/css.js';
import { StageSelectScreen } from './ui/screens/stageselect.js';
import { ResultsScreen } from './ui/screens/results.js';
import { DataCharsScreen, VSRecordScreen, SoundTestScreen } from './ui/screens/data.js';
import { registerModes } from './modes/index.js';
import { OnlineScreen, NetBattleScreen, installOnline } from './net/online.js';
import { installControlsHelp } from './ui/controls_help.js';

const app = new App();
window.__app = app;
app.register('battle', BattleScreen);
app.register('title', TitleScreen);
app.register('modeselect', ModeSelectScreen);
app.register('menu1p', OnePMenuScreen);
app.register('vsmenu', VSMenuScreen);
app.register('vsoptions', VSOptionsScreen);
app.register('itemswitch', ItemSwitchScreen);
app.register('option', OptionScreen);
app.register('backupclear', BackupClearScreen);
app.register('screenadjust', ScreenAdjustScreen);
app.register('datamenu', DataMenuScreen);
app.register('datachars', DataCharsScreen);
app.register('vsrecord', VSRecordScreen);
app.register('soundtest', SoundTestScreen);
app.register('css', CSSScreen);
app.register('stageselect', StageSelectScreen);
app.register('results', ResultsScreen);
registerModes(app);   // 'oneplayer', 'training', 'bonus' (src/modes/)
app.register('online', OnlineScreen);
app.register('netbattle', NetBattleScreen);
installOnline(app);
installControlsHelp();   // desktop-only controls overlay toggle (top-left)   // ONLINE button on title/mode select; #online opens the lobby
applyScreenAdjust(app);

const q = app.params;
if (['quick', 'chars', 'stage', 'nocount', 'hitboxes'].some(k => q.has(k))) {
  const chars = (q.get('chars') || 'mario,mario').split(',');
  app.go('battle', {
    stage: q.get('stage') || 'dreamland',
    rules: { mode: 'stock', stocks: 4, items: q.get('items') || 'off' },   // items=verylow..veryhigh turns item spawning on
    players: chars.map((c, i) => ({ char: c, port: i, color: 0, cpu: i > 0 || q.has('cpu1') ? { level: Number(q.get('lv') || 5) } : null })),
    noCountdown: q.has('nocount'),
  });
} else if (q.has('screen')) {
  app.go(q.get('screen'), Object.fromEntries([...q].filter(([k]) => !['screen', 'manual'].includes(k))));
} else app.go('title');
app.start();
