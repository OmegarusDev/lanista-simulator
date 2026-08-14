import { describe, expect, it } from 'vitest';
import {
  aimAngles,
  fallPose,
  poseHuman,
  poseQuadruped,
  twoBoneIK,
  type Vec3,
} from './anatomy';

describe('aimAngles', () => {
  it('rotates local +Y onto the target direction', () => {
    const dirs: Vec3[] = [
      { x: 1, y: 0, z: 0 },
      { x: 0, y: 1, z: 0 },
      { x: 0, y: 0, z: 1 },
      { x: 0.5, y: 0.5, z: 0.5 },
      { x: -1, y: 0.2, z: -0.3 },
    ];
    for (const d of dirs) {
      const { ry, rz } = aimAngles(d);
      const cy = Math.cos((ry * Math.PI) / 180);
      const sy = Math.sin((ry * Math.PI) / 180);
      const cr = Math.cos((rz * Math.PI) / 180);
      const sr = Math.sin((rz * Math.PI) / 180);
      // M = Ry(yaw)·Rz(roll) applied to (0,1,0)
      const x = -sr * cy;
      const y = cr;
      const z = sr * sy;
      const mag = Math.hypot(x, y, z);
      const dMag = Math.hypot(d.x, d.y, d.z);
      expect(x / mag).toBeCloseTo(d.x / dMag, 5);
      expect(y / mag).toBeCloseTo(d.y / dMag, 5);
      expect(z / mag).toBeCloseTo(d.z / dMag, 5);
    }
  });
});

describe('twoBoneIK', () => {
  it('places the elbow so the chain reaches the target', () => {
    const a: Vec3 = { x: 0, y: 10, z: 0 };
    const c: Vec3 = { x: 8, y: 8, z: 4 };
    const l1 = 6;
    const l2 = 6;
    const b = twoBoneIK(a, c, l1, l2, { x: -0.4, y: 0.3, z: 1 });
    const d1 = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
    const d2 = Math.hypot(c.x - b.x, c.y - b.y, c.z - b.z);
    expect(d1).toBeCloseTo(l1, 5);
    expect(d2).toBeCloseTo(l2, 5);
  });

  it('clamps unreachable targets to full extension', () => {
    const a: Vec3 = { x: 0, y: 0, z: 0 };
    const c: Vec3 = { x: 30, y: 0, z: 0 };
    const b = twoBoneIK(a, c, 5, 5, { x: 0, y: 1, z: 0 });
    const d = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
    expect(d).toBeLessThanOrEqual(5.001);
  });
});

describe('poseHuman', () => {
  const grip = { x: 6.8, y: 13, z: 5.9 };
  const offGrip = { x: -5.2, y: 12, z: -5.9 };
  const pose = poseHuman({
    bulk: 1,
    stepPhase: 1.0,
    speed: 0.5,
    guard: 0,
    mainGrip: grip,
    offGrip: offGrip,
  });

  it('builds torso, head, and four limbs', () => {
    expect(pose.torso.to.y).toBeGreaterThan(pose.hips.y);
    expect(pose.head.y).toBeGreaterThan(pose.torso.to.y);
    expect(pose.arms.length).toBe(2);
    expect(pose.legs.length).toBe(2);
  });

  it('places both hands on the weapon grips', () => {
    for (const arm of pose.arms) {
      const g = arm.side === 1 ? grip : offGrip;
      expect(arm.end.x).toBeCloseTo(g.x, 2);
      expect(arm.end.y).toBeCloseTo(g.y, 2);
      expect(arm.end.z).toBeCloseTo(g.z, 2);
    }
  });

  it('keeps the feet on the ground while scissoring', () => {
    const feetY = pose.legs.map((l) => l.end.y);
    expect(Math.min(...feetY)).toBeLessThan(2);
    const x0 = pose.legs[0]!.end.x;
    const x1 = pose.legs[1]!.end.x;
    expect(x0).not.toBeCloseTo(x1, 6); // legs scissor in opposition
  });

  it('the stance stays narrow so the high camera reads a standing figure', () => {
    const rest = poseHuman({ bulk: 1, stepPhase: 0, speed: 0, guard: 0, mainGrip: grip, offGrip: offGrip });
    expect(Math.abs(rest.legs[0]!.end.x)).toBeLessThan(2);
    expect(Math.abs(rest.legs[0]!.upper.from.z)).toBeLessThan(3);
  });

  it('fallPose lays the body flat on the sand at ankle height', () => {
    const rest = poseHuman({ bulk: 1, stepPhase: 0, speed: 0, guard: 0, mainGrip: grip, offGrip: offGrip });
    const fallen = fallPose(rest);
    // Head and shoulders lie at ankle height now, forward of the hips.
    expect(fallen.head.y).toBeLessThan(3);
    expect(fallen.head.x).toBeGreaterThan(8);
    expect(fallen.torso.to.y).toBeLessThan(3);
    // Feet stay near the ground line (the trailing leg rides a touch high).
    expect(Math.max(...fallen.legs.map((l) => l.end.y))).toBeLessThan(2.6);
  });
});

describe('poseQuadruped', () => {
  const pose = poseQuadruped(
    'lion',
    { bodyL: 22, bodyH: 11, bodyW: 8, neckL: 6, headSize: 3, legUpper: 6, legLower: 5 },
    0.3,
    0.6,
  );

  it('builds a body, head, tail, and four legs', () => {
    expect(pose.torso.to.x).toBeGreaterThan(pose.torso.from.x);
    expect(pose.head.x).toBeGreaterThan(pose.torso.to.x);
    expect(pose.tail.to.x).toBeLessThan(pose.torso.from.x);
    expect(pose.legs.length).toBe(4);
  });

  it('trots in diagonal pairs', () => {
    const fronts = pose.legs.filter((l) => l.upper.from.x > pose.torso.from.x + 2);
    const rears = pose.legs.filter((l) => l.upper.from.x < pose.torso.from.x + 2);
    // Front-right advances with rear-left (same phase side).
    const fr = fronts.find((l) => l.side === 1)!;
    const rl = rears.find((l) => l.side === -1)!;
    const fl = fronts.find((l) => l.side === -1)!;
    expect(fr.end.x - fr.upper.from.x).toBeCloseTo(rl.end.x - rl.upper.from.x, 5);
    expect(fr.end.x - fr.upper.from.x).not.toBeCloseTo(fl.end.x - fl.upper.from.x, 5);
  });
});
