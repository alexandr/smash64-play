// Jigglypuff model (low-poly, primitives only). Model units: 1.0 = standing height (ears included).
// A pink ball carried by the spine bone, huge teal eyes, curled forehead tuft, pointed ears with dark
// insides, stub arms and small oval feet. Alternate costumes add a bow (decomp accessory on the body joint).
import * as THREE from 'three';
import { makeSkeleton, kit, mat } from '../render/rig.js';

const PI = Math.PI;
export const JIGGLY_PROPS = { hipY: 0.4, spine: 0.02, chest: 0.02, neck: 0.0, shoulderX: 0.37, shoulderY: 0.04, upperArm: 0.08, foreArm: 0.07, hipX: 0.14, thigh: 0.18, shin: 0.16 };
export const BALL = { y: 0.13, r: 0.4 };   // ball centre above the spine bone, radius

// place `mesh` on the ball surface at (yaw, pitch) (radians; yaw 0 = straight ahead), facing outward
function onBall(parent, mesh, yaw, pitch, r = BALL.r, tilt = 0) {
  const g = new THREE.Group();
  g.rotation.order = 'YXZ';
  g.rotation.set(-pitch, yaw, tilt);
  g.position.set(0, BALL.y, 0);
  mesh.position.z += r;
  g.add(mesh); parent.add(g);
  return g;
}
const disc = (r, color, depth = 0.3, seg = 10) => { const m = new THREE.Mesh(new THREE.SphereGeometry(r, seg, Math.max(4, seg * 0.75)), mat(color)); m.scale.set(1, 1, depth); return m; };

export function jigglypuff(pal) {
  const P = JIGGLY_PROPS;
  const b = makeSkeleton(P);
  const body = pal.body;
  // the ball
  b.spine.add(kit.sphere(BALL.r, body, [0, BALL.y, 0], { seg: 12 }));
  // eyes: white ring, teal iris with dark centre, white highlight
  for (const sx of [1, -1]) {
    const yaw = sx * 0.4, pitch = 0.2;
    // eye parts are tagged so effects can close them (Rest / blinking): scale.y squashes each disc
    for (const [m, dy, r] of [[disc(0.115, 0xf4f8f8, 0.3), 0, BALL.r - 0.012], [disc(0.09, pal.eye ?? 0x1c9aa0, 0.3), 0, BALL.r + 0.004],
      [disc(0.05, pal.eyeDark ?? 0x0c4c54, 0.3, 8), -0.02, BALL.r + 0.014], [disc(0.03, 0xffffff, 0.4, 6), 0.08, BALL.r + 0.022]]) {
      m.userData.eye = true;
      onBall(b.spine, m, dy === 0.08 ? yaw - sx * 0.07 + 0.05 : yaw, pitch + dy, r);
    }
    const lid = disc(0.118, body, 0.32); lid.userData.lid = true; lid.visible = false;            // closed eyelid
    onBall(b.spine, lid, yaw, pitch, BALL.r + 0.026);
    // ears: pink cones pointing up/out with dark insides
    const ear = new THREE.Group();
    ear.add(kit.cone(0.12, 0.2, body, [0, 0, 0], { seg: 5 }));
    const inner = kit.cone(0.08, 0.15, pal.earIn ?? 0x24181c, [0, 0.015, 0.05], { seg: 4 });
    inner.scale.set(1, 1, 0.5); ear.add(inner);
    ear.rotation.set(PI / 2, 0, 0);
    onBall(b.spine, ear, sx * 0.72, 0.86, BALL.r - 0.08);
    // stub arms (hand bone carries a rounded paw)
    b['upperArm' + (sx > 0 ? 'L' : 'R')].add(kit.limb(0.05, P.upperArm, body));
    b['foreArm' + (sx > 0 ? 'L' : 'R')].add(kit.limb(0.055, P.foreArm, body));
    b['hand' + (sx > 0 ? 'L' : 'R')].add(kit.sphere(0.065, body, [0, -0.01, 0.0], { seg: 7, scale: [0.8, 1, 0.9] }));
    // legs (mostly hidden in the ball) and oval feet
    const s = sx > 0 ? 'L' : 'R';
    b['thigh' + s].add(kit.limb(0.05, P.thigh, body));
    b['shin' + s].add(kit.limb(0.05, P.shin, body));
    b['foot' + s].add(kit.sphere(0.07, pal.foot ?? body, [0, -0.02, 0.04], { seg: 8, scale: [1, 0.6, 1.5] }));
  }
  // curled tuft of hair on the forehead
  const tuft = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.032, 6, 10, PI * 1.6), mat(body));
  tuft.rotation.set(0, 0, 0.6);
  onBall(b.spine, tuft, 0.12, 0.62, BALL.r + 0.01);
  onBall(b.spine, kit.sphere(0.1, body, [0, 0, 0], { seg: 8, scale: [1.3, 0.7, 0.6] }), 0.0, 0.55, BALL.r - 0.03);
  // small mouth
  const mouth = disc(0.028, pal.mouth ?? 0xc04858, 0.3, 6); mouth.scale.y = 0.6;
  onBall(b.spine, mouth, 0.0, -0.1, BALL.r);
  // costume bow (red / blue / green) on the head, toward her left
  if (pal.bow) {
    const bow = new THREE.Group();
    for (const sx of [1, -1]) {
      const w = kit.cone(0.12, 0.26, pal.bow, [sx * 0.13, 0, 0], { seg: 4 });
      w.rotation.set(0, 0, sx * PI / 2); w.scale.set(1, 1, 0.45); bow.add(w);
    }
    bow.add(kit.sphere(0.05, pal.bowDark ?? pal.bow, [0, 0, 0], { seg: 6 }));
    bow.rotation.set(0.2, 0.3, 0.25);
    onBall(b.spine, bow, 0.55, 0.95, BALL.r + 0.03);
  }
  return { bones: b };
}

// palette sheet reference/chars/jigglypuff_palette_ssb.png: default (no accessory), red bow, blue bow (lilac body),
// green bow (peach body)
export const JIGGLY_PALETTES = [
  { body: 0xffbccf, icon: 0xffbccf },
  { body: 0xffbccf, bow: 0xd01410, bowDark: 0x900a08, icon: 0xd01410, team: 'red' },
  { body: 0xe6bce0, bow: 0x1418d0, bowDark: 0x0a0c90, icon: 0x1418d0, team: 'blue' },
  { body: 0xfacec6, bow: 0x14c014, bowDark: 0x0a800a, icon: 0x14c014, team: 'green' },
];
