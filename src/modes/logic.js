// 1P stage logic, independent of rendering (runs headless in tests): builds the player list for a ladder
// stage, applies decomp levels/handicaps, runs team-battle reinforcements (Yoshi / Kirby / Polygon Teams),
// Break the Targets / Board the Platforms / Race to the Finish objectives, Master Hand, win/lose detection
// and the statistics used by the stage-clear tally (special bonuses, sc1PGameAppendBonusStats).
import { Fighter } from '../game/fighter.js';
import { CHARS, STARTERS, ROSTER } from '../chars/index.js';
import { LADDER, CHALLENGERS, KIRBY_COPIES, handicapMuls, BONUS, NOMISS_MUL, TIMER_MUL } from './data.js';
import { enemyDef, kirbyCopy, polygon } from './derived.js';
import { MasterHand } from './masterhand.js';

export const sign = v => (v > 0 ? 1 : v < 0 ? -1 : 0);
export function shuffled(arr, rng = Math.random) { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

// ------------------------------------------------------------------------------------------- run
// One 1P Game in progress (gSCManagerSceneData / sc1pmanager.c state)
export function newRun(o, save) {
  const unlocked = ROSTER.filter(c => STARTERS.includes(c) || save?.isUnlocked?.(c));
  return {
    char: o.char ?? 'mario', color: o.color ?? 0, port: o.port ?? 0,
    diff: o.difficulty ?? 2, stocksSetting: o.stocks ?? 3, stocks: o.stocks ?? 3,
    timeMin: o.time === undefined ? 5 : o.time,       // 1P time limit (minutes); 0 = infinite
    stage: o.startStage ?? 0, score: 0, continues: 0, bonusCount: 0,
    levelDrop: 0, levelGuard: 2,
    totalFrames: 0, totalFalls: 0, totalDamage: 0,
    unlocked, rng: o.rng ?? Math.random,
    log: [],
  };
}

// Pick the per-visit random parts of a stage (allies, team order, copy abilities): sc1PManagerUpdateScene
export function makePlan(run, idx, challenger = null) {
  const spec = challenger ? CHALLENGERS[challenger] : LADDER[idx];
  const rng = run.rng, d = run.diff;
  const lvDrop = challenger ? (run.challengerDrop ?? 0) : run.levelDrop;
  const plan = { idx, spec, kind: spec.kind, stage: spec.stage, allies: [], enemies: [], queue: [], challenger };
  const lvl = l => Math.max(1, l - lvDrop);
  if (spec.kind === 'btt') { plan.stage = 'btt_' + run.char; return plan; }
  if (spec.kind === 'btp') { plan.stage = 'btp_' + run.char; return plan; }
  // allies: random unlocked fighters other than the player's (and not Mario for the Mario Bros. stage)
  if (spec.allies) {
    let pool = run.unlocked.filter(c => c !== run.char);
    if (spec.id === 'mariobros') pool = pool.filter(c => c !== 'mario');
    pool = shuffled(pool, rng);
    for (let i = 0; i < spec.allies; i++) {
      const c = pool[i % pool.length];
      plan.allies.push({ char: c, def: CHARS[c], color: c === 'luigi' ? 1 : 0, level: spec.allyLv[d], handicap: spec.allyHc[d] });
    }
  }
  const enemyBase = { level: lvl(spec.lv[d]), handicap: spec.hc[d] };
  const colorFor = (charId, used) => {
    let c = 0;
    while (used.some(u => u.char === charId && u.color === c)) c++;
    return c;
  };
  const used = [{ char: run.char, color: run.color }, ...plan.allies];
  if (spec.kind === 'team') {
    if (spec.id === 'yoshi') {
      const nPal = Math.min(spec.variations, CHARS.yoshi.palettes.length);
      let order = shuffled([...Array(nPal).keys()], rng);
      if (run.char === 'yoshi') order = order.filter(c => c !== run.color).concat(order.filter(c => c === run.color));
      plan.variations = order;
      for (let i = 0; i < spec.count; i++) plan.queue.push({ char: 'yoshi', def: CHARS.yoshi, color: order[i % order.length], order: i, ...enemyBase });
    } else if (spec.id === 'kirby') {
      const pool = [...new Set([...run.unlocked, 'kirby'])];
      const finalCopy = pool[Math.floor(rng() * pool.length)];
      const kc = run.char === 'kirby' && run.color === 0 ? 1 : 0;
      for (let i = 0; i < spec.count; i++) {
        const copy = i < KIRBY_COPIES.length ? KIRBY_COPIES[i] : finalCopy;
        plan.queue.push({ char: 'kirby', def: kirbyCopy(copy), copy, color: kc, order: i, ...enemyBase });
      }
    } else if (spec.id === 'polygon') {
      const order = shuffled(ROSTER, rng);
      plan.variations = order;
      for (let i = 0; i < spec.count; i++) { const c = order[i % order.length]; plan.queue.push({ char: c, def: polygon(c), polygon: true, color: 0, order: i, ...enemyBase }); }
    }
    plan.sim = spec.sim;
    return plan;
  }
  if (spec.kind === 'race') {
    const order = shuffled(ROSTER, rng).slice(0, 3);
    for (let i = 0; i < 3; i++) plan.enemies.push({ char: order[i], def: polygon(order[i]), polygon: true, color: 0, ...enemyBase });
    return plan;
  }
  if (spec.kind === 'boss') { plan.enemies.push({ char: 'masterhand', boss: true, ...enemyBase }); return plan; }
  for (const e of spec.enemies) {
    const def = enemyDef(e), base = def.baseId ?? e;
    const color = colorFor(base, used); used.push({ char: base, color });
    plan.enemies.push({ char: e, base, def, color, metal: !!def.metal, scale: def.spawnScale ?? 1, ...enemyBase });
  }
  return plan;
}

// ------------------------------------------------------------------------------------------- stage logic
const AERIALS = ['nair', 'fair', 'bair', 'uair', 'dair'];
const SMASHES = ['fsmash', 'usmash', 'dsmash'];
const SPECIAL_RE = /^(nspecial|uspecial|dspecial)/;
function baseMove(id) {
  if (!id) return id;
  if (/^fsmash/.test(id)) return 'fsmash';
  if (/^ftilt/.test(id)) return 'ftilt';
  if (SPECIAL_RE.test(id)) return id.match(SPECIAL_RE)[1];
  return id;
}

export class StageLogic {
  // o: { run, plan, ctrl(port) -> Controller, practice: 'btt'|'btp' (bonus practice), stageDefs: STAGES }
  constructor(o) {
    Object.assign(this, o);
    this.kind = o.plan.kind;
    this.rng = o.run.rng ?? Math.random;
    this.result = null;
    this.targetsBroken = 0; this.platformsBoarded = 0;
    this.pendingSpawns = [];
    this.koLog = [];               // enemy KOs: { f, by, star, side, order, color, copy, lastHit }
    this.hits = new Map();         // moveKey -> count (player's hits on enemies)
    this.hitKinds = { air: 0, ground: 0, smash: 0, nonSmash: 0, proj: 0, nonProj: 0, throw: 0, special: new Set(), nonSpecial: 0, total: 0 };
    this.lastHit = new Map();      // enemy -> last hit info
    this.shieldBroken = false; this.usedItem = false;
    this.frames = 0;
    this.endState = null;
  }

  // Player list for the Match constructor
  players() {
    const { run, plan } = this;
    const S = this.stageData();
    const mo = S.mapObjects ?? {};
    const p0 = run.port;
    const port = k => (p0 + k) % 4;
    const ch = !!plan.challenger;
    const pos = (key, i = 0) => mo[key]?.[i] ?? null;
    const list = [];
    const me = { def: CHARS[run.char], char: run.char, port: p0, team: 0, color: run.color, cpu: null, stocks: this.isBonus() ? 1 : run.stocks, handicap: 9, controller: this.ctrl(p0), who: 'player',
      spawnPos: pos(ch ? '1p_challenger_player' : '1p_player') };
    list.push(me);
    let k = 1;
    for (const [i, a] of plan.allies.entries()) {
      list.push({ def: a.def, char: a.char, port: port(k), team: 0, color: a.color, cpu: { level: a.level }, stocks: 1, handicapRow: a.handicap, controller: this.ctrl(port(k)), who: 'ally', spawnPos: pos('1p_ally' + (i + 1)) });
      k++;
    }
    if (this.kind === 'team') {
      this.queue = [...plan.queue];
      for (let i = 0; i < plan.sim && this.queue.length; i++) {
        const e = this.queue.shift();
        list.push(this.enemyCfg(e, port(k), pos('1p_enemy' + (i + 1)) ?? pos('1p_enemy_team', i)));
        k++;
      }
    } else if (this.kind !== 'boss') {
      for (const [i, e] of plan.enemies.entries()) {
        list.push(this.enemyCfg(e, port(k), pos(ch ? '1p_challenger_enemy1' : '1p_enemy' + (i + 1))));
        k++;
      }
    }
    return list;
  }
  enemyCfg(e, port, spawnPos) {
    return { def: e.def, char: e.char, port, team: 1, color: e.color, cpu: { level: e.level }, stocks: this.kind === 'team' || this.kind === 'race' ? Infinity : 1, handicapRow: e.handicap,
      controller: this.ctrl(port), who: 'enemy', metal: !!e.metal, scale: e.scale ?? 1, spawnPos, member: e, facing: spawnPos ? (spawnPos[0] > 0 ? -1 : 1) : undefined };
  }
  stageData() { return this.stageDefs[this.plan.stage].data; }
  isBonus() { return this.kind === 'btt' || this.kind === 'btp' || this.kind === 'race'; }
  rules() {
    const s = this.plan.spec;
    return { mode: 'stock', stocks: 1, teams: true, teamAttack: !!s.teamAttack, items: s.items ?? 'off', damageRatio: 100 };
  }
  timeLimitFrames() {
    if (this.practice) return Infinity;
    const k = this.kind;
    if (k === 'race') return 60 * 60;
    if (k === 'challenger') return Infinity;
    if (!this.run.timeMin) return Infinity;
    if (k === 'btt' || k === 'btp') return 2 * 60 * 60;
    return this.run.timeMin * 60 * 60;
  }

  // Called once the Match exists (before the first update)
  attach(m) {
    this.m = m;
    const S = this.stageData();
    m.timeLeft = this.timeLimitFrames();
    m.mode = '1p';
    m.oneP = this;
    this.player = m.fighters[0];
    this.player.isPlayer = true;
    const cfgs = m.cfg.players;
    m.fighters.forEach((f, i) => this.prepFighter(f, cfgs[i]));
    if (this.kind === 'team') {
      m.hideHudStocks = true;
      this.teamLeft = this.plan.queue.length;      // members not yet defeated
    }
    if (this.kind === 'boss') {
      const mh = new MasterHand(m, { port: (this.run.port + 1) % 4, level: this.plan.enemies[0].level, controller: this.ctrl((this.run.port + 1) % 4), rng: this.rng });
      const [atk, def] = handicapMuls(this.plan.enemies[0].handicap);
      mh.atkMul = atk; mh.defMul = def;
      m.fighters.push(mh);
      this.boss = mh;
      m.hideHud = [...(m.hideHud ?? []), mh.port];
    }
    // bonus objectives
    if (this.kind === 'btt') this.setupTargets(m, S);
    if (this.kind === 'btp' || this.kind === 'race') this.setupPlatforms(m);
    const prev = m.onKO;
    m.onKO = (f, side, credit) => { prev?.(f, side, credit); this.onKO(f, side, credit); };
  }
  prepFighter(f, cfg) {
    if (!cfg) return;
    f.who = cfg.who; f.member = cfg.member;
    if (cfg.handicapRow) { const [a, d] = handicapMuls(cfg.handicapRow); f.atkMul = a; f.defMul = d; }
    if (cfg.who === 'enemy' && (this.kind === 'team' || this.kind === 'vs' || this.kind === 'race')) {
      const bt = this.stageData().blastTeam;
      if (bt && this.kind === 'team') f.teamBlast = bt;
    }
    if (cfg.def?.polygon) f.polygon = true;
  }

  // ----------------------------------------------------------- targets / platforms
  setupTargets(m, S) {
    const st = m.stage;
    if (Array.isArray(st.targets) && st.targets.length) { this.targets = st.targets; this.stageTargets = true; }
    else this.targets = (S.targets ?? []).map((t, i) => ({ id: i, x: t.pos[0], y: t.pos[1], r: 130, broken: false }));
    this.targetTotal = this.targets.length;
  }
  setupPlatforms(m) {
    this.platforms = m.col.floors.filter(f => f.material === 'detect').map((fl, i) => ({ id: i, floor: fl, boarded: false }));
    this.platformTotal = this.platforms.length;
  }
  checkTargets() {
    const p = this.player, m = this.m;
    if (!this.targets || p.dead) return;
    const boxes = [];
    for (const h of p.activeHitboxes) if (!h.hb.grab) boxes.push(h);
    for (const pr of m.projectiles) if (pr.owner === p && !pr.dead && pr.hitbox) boxes.push(pr.worldHitbox());
    for (const it of m.items?.list ?? []) if ((it.owner === p || it.thrower === p) && it.thrown && !it.dead) boxes.push({ x: it.x, y: it.cy ?? it.y, r: it.r ?? 80 });
    for (const t of this.targets) {
      if (t.broken) continue;
      const tx = t.x + (t.ox ?? 0), ty = t.y + (t.oy ?? 0);
      for (const h of boxes) {
        if ((h.x - tx) ** 2 + (h.y - ty) ** 2 <= (h.r + t.r) ** 2) { this.breakTarget(t, tx, ty); break; }
      }
    }
  }
  breakTarget(t, x, y) {
    t.broken = true; this.targetsBroken++;
    this.m.emit('targetBreak', { x, y, id: t.id, left: this.targetTotal - this.targetsBroken });
    this.m.emit('sfx', { name: 'target' });
    this.m.stage.onTargetBreak?.(t);
    if (this.targetsBroken >= this.targetTotal) this.complete();
  }
  checkPlatforms() {
    const p = this.player;
    if (!this.platforms || p.dead || !p.grounded || !p.ground) return;
    const pl = this.platforms.find(q => q.floor === p.ground);
    if (!pl) return;
    if (this.kind === 'race') { this.complete(); return; }
    if (pl.boarded) return;
    pl.boarded = true; this.platformsBoarded++;
    this.m.emit('platformBoard', { id: pl.id, floor: pl.floor, left: this.platformTotal - this.platformsBoarded });
    this.m.emit('sfx', { name: 'target' });
    this.m.stage.onPlatformBoard?.(pl);
    if (this.platformsBoarded >= this.platformTotal) this.complete();
  }
  complete() {
    if (this.endState) return;
    this.endState = 'complete';
    this.m.endGame('complete');
  }
  fail(reason) {
    if (this.endState) return;
    this.endState = 'failure';
    this.m.endGame(reason ?? 'failure');
  }

  // ----------------------------------------------------------- KOs / team reinforcements
  onKO(f, side, credit) {
    const m = this.m;
    if (f === this.player) {
      if (this.isBonus() && this.kind !== 'race') { this.fail('failure'); return; }
      if (f.eliminated) { this.endState = 'lose'; m.endGame('lose'); }
      return;
    }
    if (f.team === this.player.team) return;   // ally down
    this.koLog.push({ f, by: credit, star: f.koKind, side, order: f.member?.order ?? this.koLog.length, color: f.color, copy: f.member?.copy, lastHit: this.lastHit.get(f), char: f.def.baseId ?? f.def.id });
    if (this.kind === 'team') {
      this.teamLeft--;
      if (this.queue.length) {
        f.noRespawn = true;
        this.pendingSpawns.push({ slot: m.fighters.indexOf(f), at: m.frame + (f.respawnDelay ?? 45), member: this.queue.shift() });
      } else {
        f.noRespawn = true; f.eliminated = true; f.stocks = 0;
      }
      if (this.teamLeft <= 0) { this.endState = 'win'; m.endGame('stock'); }
      return;
    }
    // single-stock enemies: the Match already marks them eliminated
    const left = m.fighters.filter(x => x.team !== this.player.team && !x.eliminated && !x.isBoss);
    if (!left.length && !this.boss && this.kind !== 'race') { this.endState = 'win'; m.endGame('stock'); }
  }
  // Spawn the next team member into a fighter slot: drops in from above at a random 1p_enemy_team point
  spawnMember(slot, e) {
    const m = this.m, old = m.fighters[slot];
    const S = this.stageData();
    const pts = S.mapObjects?.['1p_enemy_team'] ?? S.spawns;
    const p = pts[Math.floor(this.rng() * pts.length)];
    const cb = m.stage.cameraBounds, bz = m.stage.blast;
    const y = (cb.top + bz.top) * 0.5;
    const cfg = this.enemyCfg(e, old.port, [p[0], y]);
    const f = new Fighter(m, cfg.def, { ...cfg, x: p[0], y, facing: p[0] >= 0 ? -1 : 1 });
    f.grounded = false; f.ground = null; f.setState('fall');
    cfg.def.init?.(f);
    this.prepFighter(f, cfg);
    m.fighters[slot] = f;
    this.onSpawn?.(slot, f, old);
    return f;
  }

  // ----------------------------------------------------------- per frame
  update(events) {
    const m = this.m;
    if (m.phase === 'play') this.frames++;
    for (const e of events) this.onEvent(e);
    if (m.phase === 'play') {
      for (let i = this.pendingSpawns.length - 1; i >= 0; i--) {
        const s = this.pendingSpawns[i];
        if (m.frame >= s.at) { this.pendingSpawns.splice(i, 1); this.spawnMember(s.slot, s.member); }
      }
      if (this.kind === 'btt') this.checkTargets();
      if (this.kind === 'btp' || this.kind === 'race') this.checkPlatforms();
      if (this.player.item) this.usedItem = true;
      if (this.boss?.defeated) {
        if (m.timeLeft !== Infinity) m.timeLeft++;          // the clock stops once Master Hand is beaten
        if (this.boss.deadT >= 170 && !this.endState) { this.endState = 'win'; m.endGame('boss'); }
      }
    }
    if ((m.phase === 'game' || m.phase === 'over') && !this.endSnapshot) {
      this.endSnapshot = { playerState: this.player.state, moveId: this.player.move?.id, dead: this.player.dead, koKind: this.player.koKind, timeLeft: m.timeLeft, reason: m.endReason };
      if (!this.endState) this.endState = m.endReason === 'time' ? (this.kind === 'race' || this.isBonus() ? 'failure' : 'time') : (m.endReason === 'complete' ? 'complete' : 'lose');
    }
  }
  onEvent(e) {
    const p = this.player;
    if (e.type === 'hit' && e.f && e.f !== p && e.f.team !== p.team) {
      const fromPlayer = e.a === p;
      this.lastHit.set(e.f, { byPlayer: fromPlayer, hazard: !e.a, throw: !!e.throw, move: fromPlayer ? this.classify(e) : null });
      if (fromPlayer && !e.blocked) { this.countHit(e); (this.dmgFromPlayer ??= new Map()).set(e.f, (this.dmgFromPlayer.get(e.f) ?? 0) + (e.dmg ?? 0)); }
    }
    if (e.type === 'shieldHit' && e.f && e.f.team !== p.team) this.lastShieldHitByPlayer = true;
    if (e.type === 'shieldBreak' && e.f && e.f.team !== p.team && this.lastShieldHitByPlayer) this.shieldBroken = true;
  }
  classify(e) {
    if (e.throw) return { id: e.f?.grabbedBy?.move?.id ?? 'throw', throw: true };
    const a = e.a;
    if (!this.hbMap) {
      this.hbMap = new Map();
      for (const [id, mv] of Object.entries(a.def.moves ?? {})) for (const hb of mv?.hitboxes ?? []) this.hbMap.set(hb, id);
    }
    const id = this.hbMap.get(e.hb) ?? (a.move && a.dynamicHitboxes?.some?.(h => h === e.hb) ? a.move.id : null);
    if (id) return { id: baseMove(id), raw: id, air: !a.grounded || AERIALS.includes(id) };
    return { id: 'proj', proj: true };
  }
  countHit(e) {
    const c = this.classify(e), k = this.hitKinds;
    k.total++;
    this.hits.set(c.id, (this.hits.get(c.id) ?? 0) + 1);
    if (c.throw) k.throw++;
    if (c.proj) k.proj++; else k.nonProj++;
    if (!c.proj && !c.throw) { if (c.air) k.air++; else k.ground++; }
    else k.ground++;
    if (SMASHES.includes(c.id)) k.smash++; else k.nonSmash++;
    if (SPECIAL_RE.test(c.id ?? '')) k.special.add(c.id); else k.nonSpecial++;
  }

  // ----------------------------------------------------------- results
  // Add this stage's time / falls / damage to the run totals (sc1PGameInitBonusStats) — call once before tally()
  commitRun() {
    if (this.committed) return; this.committed = true;
    const run = this.run, p = this.player;
    run.totalFrames += this.frames;
    if (this.kind !== 'btt' && this.kind !== 'btp') run.totalFalls += p.stats.falls;
    run.totalDamage += Math.floor(p.stats.dmgTaken);
  }
  // won: stage cleared; lost: continue screen; for bonus stages always proceeds
  outcome() {
    const s = this.endState;
    if (this.isBonus()) return s === 'complete' ? 'complete' : 'failure';
    return s === 'win' ? 'win' : 'lose';
  }
  timeLeftSec() { const t = this.endSnapshot?.timeLeft ?? this.m.timeLeft; return t === Infinity ? 0 : Math.max(0, Math.floor((t + 59) / 60)); }

  // Score lines + special bonuses for the tally (sc1PGameInitBonusStats / AppendBonusStats / stage clear)
  tally() {
    const run = this.run, p = this.player, m = this.m, k = this.kind;
    const out = { kind: k, lines: [], bonuses: [], koScore: 0, total: 0 };
    const secs = this.timeLeftSec();
    const won = this.outcome() === 'win' || this.outcome() === 'complete';
    if (k === 'btt' || k === 'btp') {
      const n = k === 'btt' ? this.targetsBroken : this.platformsBoarded;
      const all = n >= (k === 'btt' ? this.targetTotal : this.platformTotal);
      out.objectives = n; out.objectiveTotal = k === 'btt' ? this.targetTotal : this.platformTotal;
      out.lines.push({ label: k === 'btt' ? 'Target' : 'Platform', icons: n, value: n * 1000 });
      if (all && m.timeLeft !== Infinity) out.lines.push({ label: 'Timer', a: secs, mul: TIMER_MUL[k], value: secs * TIMER_MUL[k] });
      if (all) out.bonuses.push(this.bonus('perfect'));
    } else if (k === 'race') {
      const done = this.endState === 'complete';
      out.lines.push({ label: 'Timer', a: done ? secs : 0, mul: 500, value: (done ? secs : 0) * 500 });
      if (done && p.stats.falls === 0 && p.stats.dmgTaken === 0) out.bonuses.push(this.bonus('noDamage'));
    } else {
      out.koScore = p.stats.kos * 1000;
      if (m.timeLeft !== Infinity || this.timeLimitFrames() !== Infinity) out.lines.push({ label: 'Timer', a: secs, mul: 50, value: secs * 50 });
      const dmg = Math.floor(p.stats.dmgGiven);
      out.lines.push({ label: 'Damage', a: dmg, mul: 10, value: dmg * 10 });
      out.bonuses = this.specialBonuses(secs);
    }
    out.total = out.koScore + out.lines.reduce((a, l) => a + l.value, 0) + out.bonuses.reduce((a, b) => a + b.pts, 0);
    return out;
  }
  bonus(key, mul = 1) { const [name, pts] = BONUS[key]; return { key, name, pts: pts * mul, mul }; }

  specialBonuses(secs) {
    const run = this.run, p = this.player, m = this.m, k = this.kind, B = [];
    const add = (key, mul) => B.push(this.bonus(key, mul));
    const H = this.hitKinds, kos = this.koLog;
    const snap = this.endSnapshot ?? {};
    const stageFrames = this.frames;
    const allByPlayerTop = kos.length > 0 && kos.every(x => x.by === p && x.side === 'top');
    if (allByPlayerTop) add(k === 'team' ? 'trickster' : 'starFinish');
    if (this.shieldBroken) add('shieldBreaker');
    if (H.total > 0 && H.throw === H.total) add('judoWarrior');
    if (H.air > 0 && H.ground === 0) add('hawk');
    if (H.proj > 0 && H.nonProj === 0) add('shooter');
    // All Variations: every normal attack connected at least once (jab chain per character)
    const need = ['jab1', 'dashattack', 'ftilt', 'utilt', 'dtilt', 'fsmash', 'usmash', 'dsmash', ...AERIALS];
    const mv = p.def.moves ?? {};
    if (mv.jab2) need.push('jab2');
    if (mv.jab3) need.push('jab3'); else if (mv.jabRapid) need.push('jabRapid');
    if (need.every(id => this.hits.has(id))) add('allVariations');
    if (H.smash > 0 && H.nonSmash === 0) add('smashMania');
    if (H.smash === 0 && H.nonSmash > 0) add('smashless');
    if (H.special.size > 0 && H.nonSpecial === 0) add(H.special.size === 1 ? 'singleMove' : 'specialMove');
    if (p.percent >= 200) add('heavyDamage');
    if (stageFrames <= 30 * 60) add('speedster');
    if (p.stats.dmgGiven === 0) add('pacifist');
    if (run.totalFalls === 0) add('noMiss', NOMISS_MUL[this.plan.idx] || 1);
    if (p.stats.falls === 0 && p.stats.dmgTaken === 0) add('noDamage');
    if (Math.floor(p.percent) === 0) add('fullPower');
    if (m.items?.enabled && !this.usedItem) add('noItem');
    const last = kos[kos.length - 1];
    if (last && last.by === p && last.lastHit?.throw) add('throwDown');
    if (last && last.lastHit?.hazard && last.by) {
      const st = this.plan.stage;
      if (st === 'zebes') add('acidClear'); else if (st === 'hyrule') add('tornadoClear'); else if (st === 'sectorz') add('arwingClear');
    }
    if (snap.moveId === 'taunt') add('fighterStance');
    if (snap.dead) add(snap.koKind === 'star' ? 'cometMystic' : 'mystic');
    if (m.timeLeft !== Infinity && secs === 1) add('lastSecond');
    if (m.timeLeft !== Infinity && secs === 213) add('lucky3');
    const pct = Math.floor(p.percent), h = Math.floor(pct / 100), t = Math.floor(pct / 10) % 10, o = pct % 10;
    if ((h ? h === t && t === o : t !== 0 && t === o)) add('jackpot');
    // stage-specific
    if (this.plan.spec.id === 'yoshi' && this.teamLeft <= 0) {
      const order = kos.slice(0, 6).map(x => x.color);
      let ok = true;
      for (let i = 6, v = 0; i < kos.length; i++, v = (v + 1) % 6) if (kos[i].color !== order[v]) ok = false;
      if (ok) add('yoshiRainbow');
    }
    if (this.plan.spec.id === 'kirby' && this.teamLeft <= 0 && kos.slice(0, 7).every((x, i) => x.order === i)) add('kirbyRanks');
    if (this.plan.spec.id === 'mariobros') {
      const ally = m.fighters.find(f => f.who === 'ally');
      if (ally && ally.stats.falls === 0) add(ally.stats.dmgTaken === 0 ? 'trueFriend' : 'goodFriend');
      const lui = kos.find(x => x.char === 'luigi');
      if (lui && kos.indexOf(lui) === 0 && lui.by === p) {
        const mario = m.fighters.find(f => f.who === 'enemy' && (f.def.baseId ?? f.def.id) === 'mario');
        if (mario && (this.dmgFromPlayer?.get(mario) ?? 0) === 0) add('brosCalamity');
      }
    }
    if (this.plan.spec.id === 'giantdk') {
      const allies = m.fighters.filter(f => f.who === 'ally');
      if (allies.length && allies.every(a => a.stats.falls === 0)) add(allies.every(a => a.stats.dmgTaken === 0) ? 'dkPerfect' : 'dkDefender');
    }
    if (k === 'boss') {
      add('stageClear', run.diff + 1);
      if (run.totalFalls === 0) add('noMissClear');
      if (run.totalDamage === 0) add('noDamageClear');
      const tot = run.totalFrames / 60;
      if (tot <= 8 * 60) add('speedDemon'); else if (tot <= 12 * 60) add('speedKing');
    }
    // Cheap Shot: one move >= 35% of the hits, only when no "style" bonus was earned
    const style = ['singleMove', 'specialMove', 'hawk', 'judoWarrior', 'shooter', 'allVariations', 'trickster', 'pacifist', 'smashMania'];
    if (!B.some(b => style.includes(b.key)) && H.total > 0) {
      for (const n of this.hits.values()) if (n / H.total >= 0.35) { add('cheapShot'); break; }
    }
    // tally order = decomp enum order
    const order = Object.keys(BONUS);
    B.sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key));
    if (k === 'boss') { const gc = B.find(b => b.key === 'stageClear'); if (gc) gc.name = ['Very Easy', 'Easy', 'Normal', 'Hard', 'Very Hard'][run.diff] + ' Clear'; }
    return B;
  }
}
