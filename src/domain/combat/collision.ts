/**
 * Swept collision — the blade IS the hitbox. The swing's blade segment is
 * posed by the exact same functions the renderer uses (shapes.strikeParams,
 * swingAngleRad, lungeOffset), so the drawn sweep and the collision sweep
 * are the same object. The earliest physical contact ends the swing.
 */
import {
  lungeOffset,
  swingAngleRad,
} from '../../content/shapes';
import type { StrikeParams } from '../../content/strike';
import type { Fighter } from './fighter';

export interface Segment2 {
  x0: number;
  z0: number;
  x1: number;
  z1: number;
}

export interface Circle2 {
  x: number;
  z: number;
  r: number;
}

/** Blade segment at a phase fraction — grip→tip, lunged and swung, in WORLD space. */
export function bladeSegment(
  facing: number,
  grip: { x: number; z: number },
  bladeLength: number,
  arc: number,
  lungeUnits: number,
  frac: number,
  worldX = 0,
  worldZ = 0,
): Segment2 {
  const theta = facing + swingAngleRad(arc, frac);
  const off = lungeOffset(lungeUnits, frac);
  const dx = Math.cos(theta);
  const dz = Math.sin(theta);
  // The body lunges straight ahead (facing); only the blade rotates.
  const gx = worldX + grip.x + Math.cos(facing) * off;
  const gz = worldZ + grip.z + Math.sin(facing) * off;
  return { x0: gx, z0: gz, x1: gx + dx * bladeLength, z1: gz + dz * bladeLength };
}

/** Distance from a circle center to a segment. */
export function segCircleDist(seg: Segment2, c: Circle2): number {
  const abx = seg.x1 - seg.x0;
  const abz = seg.z1 - seg.z0;
  const len2 = abx * abx + abz * abz;
  let t = 0;
  if (len2 > 1e-9) {
    t = ((c.x - seg.x0) * abx + (c.z - seg.z0) * abz) / len2;
    t = Math.max(0, Math.min(1, t));
  }
  const dx = seg.x0 + abx * t - c.x;
  const dz = seg.z0 + abz * t - c.z;
  return Math.hypot(dx, dz);
}

/** Contact parameter u ∈ [0,1] along the blade (0 = grip, 1 = tip). */
export function contactParam(seg: Segment2, c: Circle2): number {
  const abx = seg.x1 - seg.x0;
  const abz = seg.z1 - seg.z0;
  const len2 = abx * abx + abz * abz;
  if (len2 < 1e-9) return 1;
  const t = ((c.x - seg.x0) * abx + (c.z - seg.z0) * abz) / len2;
  return Math.max(0, Math.min(1, t));
}

function lerpSeg(a: Segment2, b: Segment2, t: number): Segment2 {
  return {
    x0: a.x0 + (b.x0 - a.x0) * t,
    z0: a.z0 + (b.z0 - a.z0) * t,
    x1: a.x1 + (b.x1 - a.x1) * t,
    z1: a.z1 + (b.z1 - a.z1) * t,
  };
}

const SWEEP_SAMPLES = 8;
const SWEEP_BISECT = 4;

/**
 * Earliest contact time t* ∈ [0,1] between a segment sweeping seg0→seg1 and
 * a circle, or null on miss. Deterministic (fixed sampling + bisection).
 */
export function sweptSegmentCircleContact(
  seg0: Segment2,
  seg1: Segment2,
  c: Circle2,
): number | null {
  let prev = 0;
  for (let i = 0; i <= SWEEP_SAMPLES; i++) {
    const t = i / SWEEP_SAMPLES;
    if (segCircleDist(lerpSeg(seg0, seg1, t), c) <= c.r) {
      let lo = prev;
      let hi = t;
      for (let b = 0; b < SWEEP_BISECT; b++) {
        const mid = (lo + hi) / 2;
        if (segCircleDist(lerpSeg(seg0, seg1, mid), c) <= c.r) hi = mid;
        else lo = mid;
      }
      return (lo + hi) / 2;
    }
    prev = t;
  }
  return null;
}

/**
 * Resolve one attacker's ACTIVE swing against all opponents: the earliest
 * physical contact along the sweep wins and the swing ends there naturally.
 * Returns the target and the contact parameter, or null (whiff).
 */
export function sweepHit(
  atk: Fighter,
  foes: readonly Fighter[],
  frac0: number,
  frac1: number,
  strike: StrikeParams,
): { foe: Fighter; t: number; u: number; seg: Segment2 } | null {
  const blade0 = bladeSegment(
    atk.facing,
    strike.grip,
    strike.bladeLength,
    strike.arc,
    strike.lunge,
    frac0,
    atk.x,
    atk.y,
  );
  const blade1 = bladeSegment(
    atk.facing,
    strike.grip,
    strike.bladeLength,
    strike.arc,
    strike.lunge,
    frac1,
    atk.x,
    atk.y,
  );
  let best: { foe: Fighter; t: number; u: number; seg: Segment2 } | null = null;
  for (const foe of foes) {
    if (!foe.alive || foe.team === atk.team) continue;
    const circle: Circle2 = { x: foe.x, z: foe.y, r: foe.collisionRadius };
    const t = sweptSegmentCircleContact(blade0, blade1, circle);
    if (t === null) continue;
    const seg = lerpSeg(blade0, blade1, t);
    const u = contactParam(seg, circle);
    if (best === null || t < best.t - 1e-9 || (Math.abs(t - best.t) < 1e-9 && u > best.u)) {
      best = { foe, t, u, seg };
    }
  }
  return best;
}
