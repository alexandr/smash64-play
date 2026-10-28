// Luigi model: a taller, thinner Mario (ECB top 370). Green cap with a white "L" disc, green shirt,
// blue overalls with yellow buttons, white gloves, brown boots, long face with a big nose and mustache.
import { makeSkeleton, kit } from '../render/rig.js';

export const LUIGI_PROPS = { hipY: 0.4, spine: 0.1, chest: 0.115, neck: 0.03, shoulderX: 0.1, shoulderY: 0.075, upperArm: 0.13, foreArm: 0.12, hipX: 0.055, thigh: 0.195, shin: 0.18 };

export function luigi(pal) {
  const b = makeSkeleton(LUIGI_PROPS);
  const P = b.props;
  // torso: overalls belly + shirt chest (slimmer than Mario)
  b.spine.add(kit.sphere(0.12, pal.pants, [0, 0.05, 0.0], { seg: 9, scale: [1.0, 1.15, 0.9] }));
  b.chest.add(kit.sphere(0.11, pal.shirt, [0, 0.04, -0.01], { seg: 9, scale: [1.05, 1.0, 0.88] }));
  b.chest.add(kit.box(0.035, 0.13, 0.02, pal.pants, [0.05, 0.02, 0.085]));       // straps
  b.chest.add(kit.box(0.035, 0.13, 0.02, pal.pants, [-0.05, 0.02, 0.085]));
  b.spine.add(kit.sphere(0.016, 0xffe040, [0.05, 0.13, 0.11], { seg: 5 }));       // buttons
  b.spine.add(kit.sphere(0.016, 0xffe040, [-0.05, 0.13, 0.11], { seg: 5 }));
  // head: long face, big nose, mustache, cap with "L" emblem
  const h = b.head;
  h.add(kit.sphere(0.12, pal.skin, [0, 0.13, 0.01], { seg: 10, scale: [0.95, 1.18, 1] }));
  h.add(kit.sphere(0.042, pal.skin, [0, 0.11, 0.125], { seg: 7, scale: [1, 0.9, 1.1] }));      // nose
  h.add(kit.box(0.15, 0.03, 0.035, pal.hair, [0, 0.065, 0.11]));                               // mustache
  h.add(kit.sphere(0.122, pal.hair, [0, 0.11, -0.02], { seg: 8, scale: [1.0, 0.95, 0.95] }));   // hair back
  h.add(kit.sphere(0.022, 0x2050ff, [0.04, 0.17, 0.105], { seg: 5, scale: [1, 1.4, 1] }));      // eyes
  h.add(kit.sphere(0.022, 0x2050ff, [-0.04, 0.17, 0.105], { seg: 5, scale: [1, 1.4, 1] }));
  h.add(kit.sphere(0.13, pal.cap, [0, 0.235, 0.0], { seg: 10, scale: [1.0, 0.62, 1.02] }));    // cap dome
  h.add(kit.box(0.2, 0.022, 0.12, pal.cap, [0, 0.21, 0.115]));                                  // brim
  h.add(kit.sphere(0.036, 0xffffff, [0, 0.27, 0.105], { seg: 7, scale: [1, 1, 0.35] }));        // emblem disc
  h.add(kit.box(0.012, 0.042, 0.012, pal.emblem ?? pal.cap, [-0.006, 0.272, 0.117]));          // "L"
  h.add(kit.box(0.026, 0.011, 0.012, pal.emblem ?? pal.cap, [-0.0, 0.255, 0.117]));
  // limbs
  for (const s of ['L', 'R']) {
    b['upperArm' + s].add(kit.limb(0.034, P.upperArm, pal.shirt));
    b['foreArm' + s].add(kit.limb(0.032, P.foreArm, pal.shirt));
    b['hand' + s].add(kit.sphere(0.05, pal.glove, [0, -0.02, 0], { seg: 7 }));
    b['thigh' + s].add(kit.limb(0.044, P.thigh, pal.pants));
    b['shin' + s].add(kit.limb(0.04, P.shin, pal.pants));
    b['foot' + s].add(kit.sphere(0.052, pal.shoe, [0, -0.015, 0.035], { seg: 7, scale: [1, 0.7, 1.7] }));
  }
  return { bones: b };
}
