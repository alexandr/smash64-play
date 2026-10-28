// Mario's Super Jump Punch with the real root-motion curve (decomp FTMarioAnimSuperJumpPunchAir TransN:
// TRAY 0 -> 842.75 over 40 frames from frame 6 with start rate ~200 u/f and end rate -27.6; TRAZ 0 -> 592.25
// (frames 6-20) -> 905 (20-46); x1.12 model scale => ~1191 up / ~975 forward at the anim end (frame 40)).
// Stick |x| > 50 on frames 1-6 tilts the path by up to 18 deg; |x| > 20 on frame 7 can turn around. Air
// version: vertical speed zeroed, x speed /1.5, root motion x0.95. Helpless after (drift x0.6, landing 25).
import { track } from './specials_falcon.js';

const S = 80;
const sign = v => (v > 0 ? 1 : v < 0 ? -1 : 0);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const sjpY = track([[0, 6, 0, 0, 0, 0], [6, 40, 0, 842.75, 200.5, -27.6]]);
const sjpZ = track([[0, 6, 0, 0, 0, 0], [6, 14, 0, 592.25, 64.2, 27.4], [20, 26, 592.25, 905, 27.4, 6.8]]);

export function marioSJP(o = {}) {
  const size = 1.12 * (o.air ? 0.95 : 1);
  return {
    helpless: true, helplessLand: 25, helplessDrift: 0.6, groundOK: false, keepOnFall: true,
    ledgeGrab: true, ledgeGrabFrom: 20, noAirFriction: true, sfx: 'jump2',
    onStart(f) {
      f.vars.tilt = 0;
      if (!f.grounded) { f.vy = 0; f.vx /= 1.5; }
    },
    script(f, mf, c) {
      const X = c.x * S;
      if (mf <= 6 && Math.abs(X) > 50) f.vars.tilt = clamp((Math.abs(X) - 50) * 0.6, 0, 18) * sign(X) * f.facing;
      if (mf === 7 && Math.abs(X) > 20 && sign(X) !== f.facing) { f.facing = -f.facing; f.vars.tilt = -f.vars.tilt; }
      if (mf <= 6) {
        // wind-up: no root motion yet (air: half gravity)
        if (!f.grounded) { f.gravMul = 0.5; f.airFriction(); }
        return;
      }
      if (mf > 40) { f.noGravity = false; f.gravMul = 1; return; }
      if (f.grounded) { f.grounded = false; f.ground = null; f.y += 1; }
      const dz = (sjpZ(mf) - sjpZ(mf - 1)) * size, dy = (sjpY(mf) - sjpY(mf - 1)) * size;
      const a = f.vars.tilt * Math.PI / 180;      // + = path leans toward the facing direction
      f.noGravity = true; f.gravMul = 1;
      f.vx = (dz * Math.cos(a) + dy * Math.sin(a)) * f.facing;
      f.vy = -dz * Math.sin(a) + dy * Math.cos(a);
    },
  };
}
