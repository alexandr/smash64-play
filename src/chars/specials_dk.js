// Donkey Kong specials and the cargo carry, numbers from reference/spec/chars/dk.json (ftdonkeyspecial*.c,
// ftcommonthrow / ftcommoncapture notes in mechanics.md §7).
const S = 80;
const sign = v => (v > 0 ? 1 : v < 0 ? -1 : 0);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// ---------------- Giant Punch ----------------
// B: wind-up (8f) -> charge loop (12f per level, max 10) -> A/B punch, Z store. Full charge auto-stores;
// the next B goes straight to the full punch. Partial punch: 14 dmg + 2 per level, ground slide vx = level*8.
export const GP = { maxLevel: 10, loopFrames: 12, dmgBase: 14, dmgPerLevel: 2, slidePerLevel: 8 };
const charge = f => f.special.dkCharge ?? 0;

export function giantPunchStart(anim) {
  return {
    total: 7, hitboxes: [], anim, groundOK: true, keepOnFall: true, drift: true, after: 'nspecialLoop', noStale: true,
    onStart(f) { f.vars.full = charge(f) >= GP.maxLevel; },
    script(f, mf) {
      if (mf === 1 && f.vars.full) { f.startMove(f.def.moves.nspecialFull); return; }
    },
  };
}
export function giantPunchLoop(anim) {
  return {
    total: 9999, hitboxes: [], anim, groundOK: true, keepOnFall: true, drift: true, noStale: true,
    onStart(f) { f.vars.charging = true; f.vars.lf = 0; },
    script(f, mf, c) {
      f.vars.lf++;
      if (c.pressed('A') || c.pressed('B')) { f.vars.charging = false; f.startMove(f.def.moves.nspecialPunch); return; }
      if (c.pressed('Z')) {                     // store the charge
        f.vars.charging = false;
        if (f.grounded) f.startShield(); else f.setState('fall');
        return;
      }
      if (f.vars.lf >= GP.loopFrames) {
        f.vars.lf = 0;
        const lvl = Math.min(GP.maxLevel, charge(f) + 1);
        f.special.dkCharge = lvl;
        f.match.emit('sfx', { name: 'charge', k: lvl / GP.maxLevel });
        if (lvl >= GP.maxLevel) {                // full: flash and auto-cancel, storing the charge
          f.flash = 12; f.vars.charging = false;
          f.setState(f.grounded ? 'idle' : 'fall');
        }
      }
    },
  };
}
export function giantPunch(anim, full) {
  return {
    anim, groundOK: true, keepOnFall: true, drift: true, sfx: 'whiffL',
    onStart(f) {
      const lvl = full ? GP.maxLevel : Math.min(GP.maxLevel - 1, charge(f));
      f.vars.level = lvl; f.special.dkCharge = 0;
      if (!full) {
        const dmg = GP.dmgBase + GP.dmgPerLevel * lvl;
        f.dynamicHitboxes = f.move.hitboxes.map(h => ({ ...h, damage: dmg }));
        if (f.grounded) f.vx = lvl * GP.slidePerLevel * f.facing;
      }
    },
    traction: 0.5,
  };
}
// being hit while winding up / charging loses the charge
export function giantPunchHitReset(f) {
  if (f.state === 'attack' && f.vars?.charging) f.special.dkCharge = 0;
}

// ---------------- Spinning Kong ----------------
// Ground: horizontal stick movement (0.025/stick unit, max 26), ends standing. Air: vy 20.3, gravity x0.07
// until frame 57, drift 0.05/stick unit max 38, then helpless (landing 27). Intangible 1-5 (data).
export function spinningKong(anim, air) {
  return {
    anim, groundOK: !air, keepOnFall: true, keepVel: true, noAirFriction: true, sfx: 'whiffL',
    helpless: air, helplessLand: 27, helplessDrift: 1.0, ledgeGrab: air, ledgeGrabFrom: 30,
    onStart(f) {
      if (air) { f.vy = 20.3; f.gravMul = 0.07; f.fastfall = false; f.jumpsUsed = f.a.jumps; }
    },
    script(f, mf, c) {
      const X = c.x * S;
      if (f.grounded && !air) {
        if (Math.abs(X) >= 8) f.vx = clamp(f.vx + X * 0.025, -26, 26);
        else f.friction();
      } else {
        f.gravMul = air && mf < 57 ? 0.07 : 1;
        const acc = air ? 0.05 : 0.025, max = air ? 38 : 26;
        if (Math.abs(X) >= 8) f.vx = clamp(f.vx + X * acc, -max, max);
        else f.airFriction();
      }
    },
  };
}

// ---------------- Hand Slap ----------------
// Start 3f (intangible) -> loop 34f (two ground slaps, grounded targets only) -> B during the loop repeats it
// -> end 5f. Ground only.
export function handSlap(anim) {
  const LOOP0 = 4, LOOP1 = 37;
  return {
    anim, intangibleW: [[1, 3]], keepOnFall: false,
    script(f, mf, c) {
      if (mf >= LOOP0 && mf <= LOOP1 && c.pressed('B')) f.vars.again = true;
      if (mf === LOOP1 && f.vars.again) { f.vars.again = false; f.mf = LOOP0 - 1; f.hitVictims = new Map(); f.vars.loops = (f.vars.loops ?? 0) + 1; }
    },
  };
}

// ---------------- Cargo carry (forward throw) ----------------
const CARGO_THROW = { damage: 8, angle: 45, kbg: 80, fkb: 0, bkb: 70, element: 'normal' };
const onTop = (f, v, k = 1) => {
  v.x = f.x + f.facing * f.a.width * 0.2 * (1 - k) ; v.y = f.y + f.H * 0.7 * k;
  v.facing = f.facing; v.vx = v.vy = v.kbx = v.kby = 0;
};
export function cargoLift() {
  return {
    throwData: null, groundOK: true, keepOnFall: true, after: 'cargoHold',
    script(f, mf) {
      const v = f.vars.victim;
      if (!v || v.dead || v.grabbedBy !== f) return;
      const k = Math.min(1, mf / 12);
      v.x = f.x + f.facing * f.a.width * 1.6 * (1 - k); v.y = f.y + f.H * 0.7 * k; v.facing = -f.facing;
    },
  };
}
// DK walks / turns / jumps while holding the victim on his shoulders; A or B throws. The victim mashes out in
// percent*0.08 + 14 units (each A/B/Z tap or stick direction change = 1, plus 1 per frame).
export function cargoHold(anim) {
  return {
    id: 'cargoHold', total: 99999, hitboxes: [], anim, groundOK: true, keepOnFall: true, walkOff: true, keepVel: true, drift: true, noStale: true,
    onStart(f) {
      const v = f.vars.victim;
      if (v && v.grabbedBy === f) { v.setState('grabbed'); v.grounded = false; v.ground = null; }
      f.vars.mash = 0; f.vars.ksq = 0;
    },
    script(f, mf, c) {
      const v = f.vars.victim;
      if (!v || v.dead || v.grabbedBy !== f || v.state !== 'grabbed') { f.grabbing = null; f.setState(f.grounded ? 'idle' : 'fall'); return; }
      onTop(f, v);
      // victim mash
      const vc = v.ctrl;
      let m = 1;
      if (vc) {
        for (const b of ['A', 'B', 'Z']) if (vc.pressed(b)) m++;
        if ((Math.abs(vc.x) > 0.3 && sign(vc.x) !== sign(vc.px)) || (Math.abs(vc.y) > 0.3 && sign(vc.y) !== sign(vc.py))) m++;
      }
      f.vars.mash += m;
      if (f.vars.mash >= v.percent * 0.08 + 14) { cargoEscape(f, v); return; }
      // throw
      if (c.pressed('A') || c.pressed('B')) {
        if (!f.grounded && c.x * S * f.facing <= -20) f.facing = -f.facing;   // air: stick back turns DK
        f.startMove(f.def.moves.cargoThrow, { vars: { victim: v } });
        return;
      }
      const X = c.x * S;
      if (f.grounded) {
        // jump (kneebend then the normal jump formula; button released early = short hop)
        if (f.vars.ksq > 0) {
          f.vars.ksq++; f.friction(0.5);
          if (!f.vars.byStick && f.vars.ksq <= 4 && !c.jumpHeld()) f.vars.short = true;
          if (f.vars.ksq > f.a.jsq) {
            const vv = f.vars.byStick ? Math.max(53, c.y * S) : (f.vars.short ? 45 : 77);
            f.grounded = false; f.ground = null; f.vy = vv * f.a.jmul + f.a.jbase; f.vx = X * f.a.jvx; f.vars.ksq = 0;
            f.emit('jump');
          }
          return;
        }
        if (c.jumpPressed() || f.stickJump(c)) { f.vars.ksq = 1; f.vars.byStick = !c.jumpPressed(); f.vars.short = false; return; }
        if (Math.abs(X) >= 20) {
          if (sign(X) !== f.facing) { f.facing = sign(X); f.vx *= -0.3; }
          else f.vx = X * f.a.walkMul * 0.85;
          f.walkPhase = (f.walkPhase ?? 0) + Math.abs(f.vx) / (f.H * 1.1);
        } else f.friction();
      }
    },
  };
}
export function cargoThrow(anim) {
  const RF = 18;
  return {
    anim, groundOK: true, keepOnFall: true, drift: true, throwData: null,
    script(f, mf) {
      const v = f.vars.victim;
      if (!v || v.dead || v.grabbedBy !== f) return;
      if (mf < RF) {
        const k = mf / RF;
        v.x = f.x + f.facing * f.a.width * 1.2 * k; v.y = f.y + f.H * (0.62 + 0.1 * Math.sin(k * Math.PI)); v.facing = -f.facing;
      } else if (mf === RF) {
        v.grabbedBy = null; f.grabbing = null;
        v.x = f.x + f.facing * f.a.width * 1.6; v.y = Math.max(v.y, f.y + 2);
        v.grounded = false; v.ground = null; v.setState('fall');
        const dmg = Math.ceil(CARGO_THROW.damage * f.staleMul - 0.001);
        const res = v.takeHit({ ...CARGO_THROW, damage: dmg, attacker: f, lr: f.facing, throwHit: true });
        v.hitlag = 0; v.thrownBy = f; v.thrownFrames = 60;
        f.match.recordStale(f, f.move);
        f.match.emit('hit', { f: v, a: f, x: v.x, y: v.y + v.H * 0.5, dmg, kb: res.kb, throw: true });
        f.match.emit('sfx', { name: 'throw' });
      }
    },
  };
}
function cargoEscape(f, v) {
  v.grabbedBy = null; f.grabbing = null;
  v.setState('fall'); v.grounded = false; v.ground = null;
  const dir = sign(v.x - f.x) || -f.facing;
  v.takeHit({ damage: 0, angle: 361, kbg: 80, bkb: 20, fkb: 0, attacker: f, lr: dir, throwHit: true });
  v.hitlag = 0;
  f.vars.victim = null;
  f.takeHit({ damage: 0, angle: 361, kbg: 100, bkb: 0, fkb: 30, attacker: null, lr: -dir });
  f.hitlag = 0;
}
