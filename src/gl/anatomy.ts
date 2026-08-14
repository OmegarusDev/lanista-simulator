/**
 * Procedural anatomy — kkrieger-style articulated bodies, generated in code.
 *
 * Humans and beasts are chains of segments (upper/lower limbs, torso, neck)
 * posed by forward kinematics: two-bone IK places the hands on the weapon
 * grips and the feet on the ground, and the renderer aims every segment with
 * the same yaw/roll the kit parts use. The shapes drive everything — the
 * bodies are the shapes' skeletons.
 */

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

const v3 = (x: number, y: number, z: number): Vec3 => ({ x, y, z });
const len = (a: Vec3, b: Vec3): number => Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
const clamp = (n: number, a: number, b: number): number => Math.max(a, Math.min(b, n));

/** Aim angles (ry, rz) that rotate local +Y onto the direction d. */
export function aimAngles(d: Vec3): { ry: number; rz: number } {
  const dd = Math.hypot(d.x, d.y, d.z) || 1;
  const dx = d.x / dd;
  const dy = clamp(d.y / dd, -1, 1);
  const dz = d.z / dd;
  const rz = Math.acos(dy);
  const ry = Math.atan2(dz, -dx);
  return { ry: (ry * 180) / Math.PI, rz: (rz * 180) / Math.PI };
}

export interface Bone {
  from: Vec3;
  to: Vec3;
  /** Segment thickness (frustum wide end). */
  thick: number;
}

export interface LimbPose {
  side: -1 | 1;
  upper: Bone;
  lower: Bone;
  end: Vec3;
}

/**
 * Two-bone IK: chain a → b → c with segment lengths l1, l2 and the end pinned
 * to the target. The elbow/knee bends along `bend` (normalised; the component
 * perpendicular to the chain direction is used).
 */
export function twoBoneIK(
  a: Vec3,
  c: Vec3,
  l1: number,
  l2: number,
  bend: Vec3,
): Vec3 {
  const d = len(a, c);
  const maxD = l1 + l2;
  const dd = Math.min(d, maxD * 0.999);
  const dir: Vec3 = {
    x: (c.x - a.x) / (d || 1),
    y: (c.y - a.y) / (d || 1),
    z: (c.z - a.z) / (d || 1),
  };
  const x = (dd * dd + l1 * l1 - l2 * l2) / (2 * dd);
  const h = Math.sqrt(Math.max(0, l1 * l1 - x * x));
  // Remove the bend's component along the chain direction, normalise.
  const along = dir.x * bend.x + dir.y * bend.y + dir.z * bend.z;
  let bx = bend.x - dir.x * along;
  let by = bend.y - dir.y * along;
  let bz = bend.z - dir.z * along;
  const bl = Math.hypot(bx, by, bz) || 1;
  bx /= bl;
  by /= bl;
  bz /= bl;
  return v3(a.x + dir.x * x + bx * h, a.y + dir.y * x + by * h, a.z + dir.z * x + bz * h);
}

export interface HumanPose {
  bulk: number;
  height: number;
  hips: Vec3;
  torso: Bone;
  neck: Bone;
  head: Vec3;
  arms: LimbPose[];
  legs: LimbPose[];
}

export interface HumanPoseOpts {
  bulk: number;
  stepPhase: number;
  speed: number;
  guard: number;
  mainGrip: Vec3;
  offGrip: Vec3;
}

/**
 * Human skeleton in body-local space (forward +X, up +Y). Arms reach their
 * grips via IK; legs scissor on the walk cycle around a fighting stance;
 * `speed` 0..1 scales the stride.
 */
export function poseHuman(opts: HumanPoseOpts): HumanPose {
  const b = opts.bulk;
  const hipY = 8.5 * b;
  const shoulderY = 18.5 * b;
  const hips = v3(0, hipY, 0);

  const torso: Bone = {
    from: hips,
    to: v3(0, shoulderY, 0),
    thick: 12.5 * b,
  };
  const neck: Bone = {
    from: v3(0, shoulderY, 0),
    to: v3(0, shoulderY + 2 * b, 0),
    thick: 2.8 * b,
  };
  const head = v3(0, shoulderY + 3.2 * b, 0);

  // Walk cycle: feet scissor around a fighting stance (front/back), lifting
  // mid-stride. At rest (speed 0) the stance stays put and the knees flex.
  // The stance is narrow — a wide leg splay flattens the silhouette under
  // the high arena camera.
  const stride = opts.speed * 4.2 * b;
  const lift = opts.speed * 1.6 * b;
  const phase = opts.stepPhase;
  const hipZ = 2.6 * b;
  const legUpper = 5.4 * b;
  const legLower = 5.2 * b;

  const legs: LimbPose[] = [];
  for (const side of [-1, 1] as const) {
    const hip = v3(0, hipY - 0.5 * b, side * hipZ);
    const phaseOff = side === 1 ? 0 : Math.PI;
    const stanceX = side * 1.5 * b;
    const fx = stanceX + Math.sin(phase + phaseOff) * stride;
    const fy = 0.9 * b + Math.max(0, Math.sin(phase + phaseOff)) * lift;
    const foot = v3(fx, fy, side * hipZ);
    const knee = twoBoneIK(hip, foot, legUpper, legLower, v3(0.6, 0, 0));
    legs.push({
      side,
      upper: { from: hip, to: knee, thick: 3.6 * b },
      lower: { from: knee, to: foot, thick: 2.8 * b },
      end: foot,
    });
  }

  // Arms: IK to the grips (weapons) — the hands hold what the kit holds.
  const shoulder = v3(0, shoulderY - 0.4 * b, 0);
  const armUpper = 5.6 * b;
  const armLower = 5.4 * b;
  const arms: LimbPose[] = [];
  const grips: { side: -1 | 1; grip: Vec3 }[] = [
    { side: 1, grip: opts.mainGrip },
    { side: -1, grip: opts.offGrip },
  ];
  for (const g of grips) {
    const hand = opts.guard > 0.2 && g.side === -1 ? v3(g.grip.x + 1, g.grip.y + 2, g.grip.z) : g.grip;
    const elbow = twoBoneIK(shoulder, hand, armUpper, armLower, v3(-0.4, 0.3, g.side));
    arms.push({
      side: g.side,
      upper: { from: shoulder, to: elbow, thick: 3.2 * b },
      lower: { from: elbow, to: hand, thick: 2.6 * b },
      end: hand,
    });
  }

  return { bulk: b, height: 1, hips, torso, neck, head, arms, legs };
}

/**
 * Fall: the fighter collapses in combat — the torso listing, the head turned
 * and thrown back, one leg bent under, arms flung. A violent death, not a
 * body lying down to sleep.
 */
export function fallPose(pose: HumanPose): HumanPose {
  const b = pose.bulk;
  const ankles = 1.5 * b;
  const hips = v3(0, ankles, 0);
  const torso: Bone = {
    from: hips,
    to: v3(7.6 * b, ankles + 0.7 * b, -1.6 * b),
    thick: 12.5 * b,
  };
  const neck: Bone = {
    from: torso.to,
    to: v3(9.4 * b, ankles + 0.5 * b, -2.6 * b),
    thick: 2.8 * b,
  };
  const head = v3(10.6 * b, ankles + 0.2 * b, -3.4 * b);
  const arms: LimbPose[] = [
    // The weapon arm flung forward across the sand.
    {
      side: 1,
      upper: { from: v3(6.8 * b, ankles + 1.3 * b, 1.2 * b), to: v3(13 * b, ankles + 1 * b, 2.2 * b), thick: 3.2 * b },
      lower: { from: v3(13 * b, ankles + 1 * b, 2.2 * b), to: v3(18.2 * b, ankles + 0.8 * b, 2.8 * b), thick: 2.6 * b },
      end: v3(18.2 * b, ankles + 0.8 * b, 2.8 * b),
    },
    // The shield arm crumpled out to the side.
    {
      side: -1,
      upper: { from: v3(6.6 * b, ankles + 1.2 * b, -3.6 * b), to: v3(3 * b, ankles + 1.4 * b, -6.4 * b), thick: 3.2 * b },
      lower: { from: v3(3 * b, ankles + 1.4 * b, -6.4 * b), to: v3(4.6 * b, ankles + 1 * b, -9.4 * b), thick: 2.6 * b },
      end: v3(4.6 * b, ankles + 1 * b, -9.4 * b),
    },
  ];
  const legs: LimbPose[] = [
    // The trailing leg straight out behind.
    {
      side: 1,
      upper: { from: v3(0.2 * b, ankles + 1.4 * b, -1.2 * b), to: v3(-3.4 * b, ankles + 1.1 * b, -2.6 * b), thick: 3.6 * b },
      lower: { from: v3(-3.4 * b, ankles + 1.1 * b, -2.6 * b), to: v3(-7.4 * b, ankles + 0.9 * b, -3.4 * b), thick: 2.8 * b },
      end: v3(-7.4 * b, ankles + 0.9 * b, -3.4 * b),
    },
    // The near leg folded under the body.
    {
      side: -1,
      upper: { from: v3(0.4 * b, ankles + 1.6 * b, 1.6 * b), to: v3(2.2 * b, ankles + 2.4 * b, 0.6 * b), thick: 3.6 * b },
      lower: { from: v3(2.2 * b, ankles + 2.4 * b, 0.6 * b), to: v3(2.6 * b, ankles + 0.9 * b, 2.4 * b), thick: 2.8 * b },
      end: v3(2.6 * b, ankles + 0.9 * b, 2.4 * b),
    },
  ];
  return { bulk: b, height: 1, hips, torso, neck, head, arms, legs };
}

export interface QuadrupedPose {
  family: string;
  torso: Bone;
  neck: Bone;
  head: Vec3;
  tail: Bone;
  legs: LimbPose[];
}

export interface QuadrupedDims {
  /** Body length along +X (rear → shoulders). */
  bodyL: number;
  /** Shoulder height. */
  bodyH: number;
  /** Body width. */
  bodyW: number;
  neckL: number;
  headSize: number;
  legUpper: number;
  legLower: number;
}

/** Per-family anatomy — the BeastShape plan's skeleton. */
export function beastDims(beastId: string, bulk: number): QuadrupedDims {
  const b = bulk;
  switch (beastId) {
    case 'LEOPARD':
      return { bodyL: 26 * b, bodyH: 10 * b, bodyW: 7.5 * b, neckL: 8 * b, headSize: 2.8 * b, legUpper: 6.4 * b, legLower: 5.4 * b };
    case 'BEAR':
      return { bodyL: 22 * b, bodyH: 12.5 * b, bodyW: 11.5 * b, neckL: 5 * b, headSize: 4.6 * b, legUpper: 7 * b, legLower: 6 * b };
    case 'BOAR':
      return { bodyL: 24 * b, bodyH: 9.5 * b, bodyW: 9.5 * b, neckL: 5 * b, headSize: 4.2 * b, legUpper: 5.6 * b, legLower: 4.6 * b };
    case 'LION':
    default:
      return { bodyL: 24 * b, bodyH: 11 * b, bodyW: 8.5 * b, neckL: 7 * b, headSize: 3.2 * b, legUpper: 6 * b, legLower: 5 * b };
  }
}

/** Rest pose (phase 0, stopped) — used for anchored part placement. */
export function beastRest(family: string, bulk: number): QuadrupedPose {
  return poseQuadruped(family, beastDims(family, bulk), 0, 0);
}

/**
 * Quadruped skeleton — the beast's own anatomy. The four legs trot in
 * diagonal pairs (front-left + rear-right together), the body bobs, and the
 * head leads. `speed` 0..1 scales the gait.
 */
export function poseQuadruped(
  family: string,
  dims: QuadrupedDims,
  stepPhase: number,
  speed: number,
): QuadrupedPose {
  const b = dims.bodyH / 10;
  const bob = Math.sin(stepPhase * 2) * 0.045 * speed;
  const rear = v3(-dims.bodyL * 0.35, dims.bodyH * 0.82 + bob, 0);
  const shoulders = v3(dims.bodyL * 0.55, dims.bodyH + bob, 0);
  const torso: Bone = { from: rear, to: shoulders, thick: dims.bodyW * 0.95 };
  const neckEnd = v3(shoulders.x + dims.neckL * 0.7, dims.bodyH * 0.92 + bob, 0);
  const neck: Bone = { from: shoulders, to: neckEnd, thick: dims.headSize * 0.62 };
  const head = v3(neckEnd.x + dims.headSize * 0.55, neckEnd.y + dims.headSize * 0.12, 0);
  const tail: Bone = {
    from: rear,
    to: v3(rear.x - 4 * b, rear.y - 1.5 * b, 0),
    thick: 1.1 * b,
  };

  // Four legs: front pair at the shoulders, rear pair at the hips.
  const stride = speed * 3.2 * b;
  const lift = speed * 1.8 * b;
  const phase = stepPhase;
  const legs: LimbPose[] = [];
  const anchors: { x: number; side: -1 | 1; phaseOff: number }[] = [
    { x: shoulders.x - 1, side: 1, phaseOff: 0 }, // front-right
    { x: shoulders.x - 1, side: -1, phaseOff: Math.PI }, // front-left
    { x: rear.x + 1, side: 1, phaseOff: Math.PI }, // rear-right (diagonal to front-left)
    { x: rear.x + 1, side: -1, phaseOff: 0 }, // rear-left (diagonal to front-right)
  ];
  for (const a of anchors) {
    const hip = v3(a.x, dims.bodyH * 0.8, a.side * dims.bodyW * 0.42);
    const fx = Math.sin(phase + a.phaseOff) * stride;
    const fy = dims.bodyH * 0.08 + Math.max(0, Math.sin(phase + a.phaseOff)) * lift;
    const paw = v3(a.x + fx, fy, a.side * dims.bodyW * 0.4);
    const knee = twoBoneIK(hip, paw, dims.legUpper, dims.legLower, v3(0.5, 0, a.side));
    legs.push({
      side: a.side,
      upper: { from: hip, to: knee, thick: dims.bodyW * 0.3 },
      lower: { from: knee, to: paw, thick: dims.bodyW * 0.22 },
      end: paw,
    });
  }

  return { family, torso, neck, head, tail, legs };
}
