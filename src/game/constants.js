// Engine-wide constants. Values from reference/spec/mechanics.md (decomp-sourced; see citations there).
// Units: SSB64 internal units (Mario ≈ 320 u tall), velocities in u/frame, 60 fps. Stick range ±80.
export const C = {
  // knockback  KB = ((base*w*1.4 + 18) * kbg/100 + bkb) * ratio * Hatk * Hdef ; base = P/10 + P*d/20 or 1 + fkb/2
  KB_CAP: 2500,
  KB_DECAY_AIR: 1.7,         // u/f per frame along the launch vector
  HITSTUN_DIV: 1.875,
  TUMBLE_HITSTUN: 32,        // hitstun >= 32 (KB >= 60) -> tumble
  SAKURAI_AIR: 43, SAKURAI_GROUND: 42.5, SAKURAI_GROUND_KB: 32,
  CROUCH_MUL: 2 / 3,
  HITLAG_ADD: 5, HITLAG_ELEC: 1.5,
  SDI_MUL: 2.1,
  KB_STACK_MARGIN: 30,
  // shield
  SHIELD_MAX: 55, SHIELD_DECAY_INT: 16, SHIELD_REGEN_INT: 10, SHIELD_RESET: 30,
  SHIELD_STUN_MUL: 1.62, SHIELD_STUN_ADD: 4, SHIELD_PUSH_MUL: 2.0,
  SHIELD_MIN_HOLD: 8, SHIELD_DROP: 11, SHIELD_RADIUS_K: 0.72,   // radius = shieldSize * K * (0.65*hp/55 + 0.35)
  DIZZY_BASE: 400, DIZZY_ADD: 90,
  // grabs
  GRAB_HOLD: 60, GRABBED_DMG_MUL: 0.5, GRAB_BREAK_DMG: 6,
  // jumps (stick units, ±80)
  JUMP_STICK_MIN: 53, CJUMP_FULL: 77, CJUMP_SHORT: 45, SHORTHOP_WINDOW: 3,
  // landing
  LAND_LIGHT: 4, LAND_HEAVY: 8, NO_LANDING_VY: -20,
  ZCANCEL_WINDOW: 10, TECH_WINDOW: 20, DOWN_AUTO_GETUP: 180, DOWN_DMG_MUL: 0.5,
  // ledge
  LEDGE_INTANGIBLE: 60, LEDGE_HANG: 1080, LEDGE_HANG_SLOW: 480, LEDGE_REGRAB: 30, LEDGE_RANGE: 800,
  // respawn
  RESPAWN_DELAY: 45, STAR_KO_DELAY: 180, RESPAWN_DESCENT: 90, RESPAWN_ACT: 75, RESPAWN_PLATFORM_MAX: 390, RESPAWN_INVINCIBLE: 120,
  // damage / misc
  STALE: [0.75, 0.82, 0.89, 0.96],
  SUDDEN_DEATH_PCT: 300,
  FLOOR_FRICTION: 4.0,
  // camera
  CAM_FOV: 38, CAM_MIN: 2500, CAM_MAX: 30000,
};

// SSB64 handicap table [attack, defend] for handicap 1..9 (decomp src/ft/ftcommondata.c, US)
export const HANDICAP = [[0.55, 1.8181818], [0.60, 1.6666667], [0.70, 1.4285714], [0.75, 1.3333333], [0.80, 1.25],
  [0.90, 1.1111111], [0.95, 1.0526316], [1.00, 1.0], [1.09, 0.9174312]];

// Player colors used across HUD/menus (P1 red, P2 blue, P3 yellow, P4 green, CPU grey)
export const PORT_COLORS = ['#e8283c', '#2f6bff', '#f2c618', '#25b33e'];
// Shield colours are fixed by port in SSB64: red, green, blue, grey
export const SHIELD_COLORS = ['#ff3030', '#30d030', '#3060ff', '#a0a0a0'];
export const CPU_COLOR = '#9a9a9a';
