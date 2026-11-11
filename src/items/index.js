// Public item API for menus and the battle setup.
//
// Match rules consumed by the item manager (src/game/items.js):
//   rules.items       'off' | 'verylow' | 'low' | 'middle' | 'high' | 'veryhigh'   (Item Switch "Appearance %")
//   rules.itemSwitch  { [switchId]: boolean }  — one entry per ITEM_SWITCH row; missing ids count as ON.
// Containers (crate, barrel, capsule, egg) have no switch in SSB64: they appear whenever items are on;
// their contents follow the switch (all utility items off -> containers always explode).
import { ITEM_KINDS, ITEM_DATA, APPEARANCE_RATES } from './data.js';

// All 20 item kinds in decomp order (index = MPItemWeights / toggle-bit index)
export const ITEM_IDS = ITEM_KINDS.slice();
export const ITEM_NAMES = Object.fromEntries(ITEM_KINDS.map(k => [k, ITEM_DATA[k].name.replace(/ \(.*\)$/, '')]));

// Appearance values in menu order, with labels and the spawn wait range in frames [min, max)
export const ITEM_FREQUENCIES = [
  { id: 'off', label: 'None', wait: null },
  { id: 'verylow', label: 'Very Low', wait: APPEARANCE_RATES['Very Low'] },
  { id: 'low', label: 'Low', wait: APPEARANCE_RATES.Low },
  { id: 'middle', label: 'Middle', wait: APPEARANCE_RATES.Middle },
  { id: 'high', label: 'High', wait: APPEARANCE_RATES.High },
  { id: 'veryhigh', label: 'Very High', wait: APPEARANCE_RATES['Very High'] },
];

// The 15 rows of the SSB64 Item Switch screen, in screen order. `kinds` are the item ids each row controls.
export const ITEM_SWITCH = [
  { id: 'beam_sword', label: 'Beam Sword', kinds: ['beam_sword'] },
  { id: 'home_run_bat', label: 'HomeRunBat', kinds: ['home_run_bat'] },
  { id: 'hammer', label: 'Hammer', kinds: ['hammer'] },
  { id: 'fan', label: 'Fan', kinds: ['fan'] },
  { id: 'motion_sensor_bomb', label: 'Motion Sensor Bomb', kinds: ['motion_sensor_bomb'] },
  { id: 'bob_omb', label: 'Bob-omb', kinds: ['bob_omb'] },
  { id: 'bumper', label: 'Bumper', kinds: ['bumper'] },
  { id: 'shell', label: 'Shell', kinds: ['green_shell', 'red_shell'] },
  { id: 'poke_ball', label: 'Poké Ball', kinds: ['poke_ball'] },
  { id: 'ray_gun', label: 'RayGun', kinds: ['ray_gun'] },
  { id: 'fire_flower', label: 'Fire Flower', kinds: ['fire_flower'] },
  { id: 'star_rod', label: 'Star Rod', kinds: ['star_rod'] },
  { id: 'maxim_tomato', label: 'Maxim Tomato', kinds: ['maxim_tomato'] },
  { id: 'heart_container', label: 'Heart', kinds: ['heart_container'] },
  { id: 'star', label: 'Star', kinds: ['star'] },
];
export const CONTAINER_IDS = ['crate', 'barrel', 'capsule', 'egg'];

// SSB64 defaults: Appearance Middle, every switch ON
export const DEFAULT_ITEM_RULES = Object.freeze({
  items: 'middle',
  itemSwitch: Object.freeze(Object.fromEntries(ITEM_SWITCH.map(s => [s.id, true]))),
});
export function defaultItemSwitch() { return Object.fromEntries(ITEM_SWITCH.map(s => [s.id, true])); }

// Is item kind `id` enabled under these rules? (containers: always, when items are on)
export function itemEnabled(rules, id) {
  if (!rules || !rules.items || rules.items === 'off') return false;
  if (CONTAINER_IDS.includes(id)) return true;
  const row = ITEM_SWITCH.find(s => s.kinds.includes(id));
  return !row || rules.itemSwitch?.[row.id] !== false;
}
