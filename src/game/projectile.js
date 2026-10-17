// Generic projectile (fireballs, blaster shots, PK fire, eggs, ...). Characters configure behaviour
// through options and optional hooks (update, onHit, onLand, makeView, updateView).
import { findLanding, resolveBody } from './collision.js';

export class Projectile {
  constructor(match, owner, o) {
    Object.assign(this, {
      x: 0, y: 0, vx: 0, vy: 0, gravity: 0, tvel: Infinity, life: 120, r: 100, t: 0,
      bounce: 0, minBounceSpeed: 0, pierce: false, reflectable: true, absorbable: true, hitsOwner: false,
      wallStop: true, floorDie: false, kind: 'proj', color: 0xffaa00,
    }, o);
    this.match = match; this.owner = owner;
    this.hit = new Set(); this.dead = false;
    this.moveId = o.moveId ?? owner?.move?.id; this.use = owner?.moveUse; this.staleMul = o.staleMul ?? owner?.staleMul ?? 1;
    this.hitbox = o.hitbox !== false;
    this.hb = { angle: 361, bkb: 0, kbg: 100, fkb: 0, element: 'normal', shieldDmg: 0, ground: true, air: true, ...(o.hb ?? {}) };
    this.facing = o.facing ?? owner?.facing ?? 1;
    this.px = this.x; this.py = this.y;
  }
  update(m) {
    this.t++;
    this.px = this.x; this.py = this.y;
    if (this.onUpdate && this.onUpdate(this, m) === false) return;
    if (this.dead) return;
    this.vy -= this.gravity;
    if (this.vy < -this.tvel) this.vy = -this.tvel;
    let nx = this.x + this.vx, ny = this.y + this.vy;
    if (this.collide !== false) {
      const res = resolveBody(m.col, this.x, this.y - this.r * 0.5, nx, ny - this.r * 0.5, this.r * 0.5, this.r);
      if (res.hitWall) {
        if (this.onWall) this.onWall(this, res.hitWall);
        else if (this.bounce) { this.vx = -this.vx * this.bounce; nx = res.x; this.checkBounceSpeed(); }
        else if (this.wallStop) { this.die(); return; }
      }
      if (this.vy <= 0) {
        const land = findLanding(m.col, this.x, this.y - this.r * 0.3, nx, ny - this.r * 0.3, false, null);
        if (land) {
          if (this.onLand) { this.onLand(this, land); if (this.dead) return; }
          else if (this.bounce) { ny = land.y + this.r * 0.3; this.vy = Math.abs(this.vy) * this.bounce + (this.bounceAdd ?? 0); this.vx *= this.bounceKeepX ?? this.bounce; this.checkBounceSpeed(); }
          else if (this.floorDie) { this.die(); return; }
        }
      }
    }
    this.x = nx; this.y = ny;
    if (this.t >= this.life) this.die();
    const bz = m.stage.blast;
    if (this.x < bz.left || this.x > bz.right || this.y < bz.bottom || this.y > bz.top) this.dead = true;
  }
  checkBounceSpeed() { if (this.minBounceSpeed && Math.hypot(this.vx, this.vy) < this.minBounceSpeed) this.die(); }
  die() { if (this.dead) return; this.dead = true; this.onDie?.(this); this.match.emit('projDie', { x: this.x, y: this.y, kind: this.kind }); }
  worldHitbox() { return { hb: { ...this.hb, damage: this.damage ?? this.hb.damage }, x: this.x, y: this.y, px: this.px, py: this.py, r: this.r }; }
  onHit(v, shield) {
    this.hit.add(v);
    if (this.onHitHook) { this.onHitHook(this, v, shield); return; }
    if (!this.pierce) this.die();
  }
  reflect(v) {
    this.owner = v; this.hit = new Set(); this.vx = -this.vx; this.facing = -this.facing;
    const mul = v.reflectMul ?? 1.5;
    this.hb = { ...this.hb, damage: Math.min(999, Math.floor((this.hb.damage) * mul)) };
    this.t = 0; this.staleMul = 1;
    this.match.emit('reflect', { f: v, x: this.x, y: this.y });
  }
  absorb(v) { v.onAbsorb?.(this); this.dead = true; this.match.emit('absorb', { f: v, x: this.x, y: this.y }); }
}
