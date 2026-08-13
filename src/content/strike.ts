/**
 * Strike parameters — the ONE place that turns a fighter's kit into the
 * numbers both the collision sweep and the renderer use. Lives outside
 * shapes.ts to avoid the armatura → kitPieces → shapes → armatura cycle.
 */
import { ARMATURAE, type ArmaturaId } from './armatura';
import { ARMATURA_LOOK } from './appearance';
import { KIT_PARTS, type KitPartId } from './kitPieces';
import { bodyCollisionCapsule, shapeForPart } from './shapes';

export interface StrikeParams {
  arc: number;
  lunge: number;
  grip: { x: number; z: number };
  bladeLength: number;
}

/**
 * Strike parameters for a fighter's weapon: the swing arc and the lunge that
 * make the collision reach match the tuned attackRange. Same inputs render
 * and combat use → one number, two consumers.
 */
export function strikeParams(
  armatura: ArmaturaId,
  parts: readonly KitPartId[],
  appearanceSeed: number,
): StrikeParams {
  const def = ARMATURAE[armatura] ?? ARMATURAE.MURMILLO;
  const look = ARMATURA_LOOK[armatura] ?? ARMATURA_LOOK.MURMILLO;
  const weaponId = parts.find((id) => KIT_PARTS[id]?.slot === 'weapon');
  const shape = shapeForPart(weaponId);
  const bladeLength = shape && shape.slot === 'weapon' ? shape.totalLength : 19;
  const gripDist = look.mainHandDist;
  const grip = {
    x: Math.cos(look.mainHandAngle) * gripDist,
    z: Math.sin(look.mainHandAngle) * gripDist,
  };
  const radius = bodyCollisionCapsule(look, appearanceSeed).radius;
  const arc = def.attackArc;
  // The lunge peaks with the blade level (swing starts at mid-phase), so the
  // peak forward reach is exactly grip.x + lunge + bladeLength. The blade is
  // held laterally (grip.z), which shortens the distance at which the tip can
  // graze a dead-ahead circle by sqrt(r² − grip.z²). Size the lunge so the
  // tip's maximum contact distance lands on the tuned attackRange:
  //   D_max = reach + sqrt(r² − grip.z²) = attackRange
  const gripLateral = Math.abs(grip.z);
  const lateralShort = gripLateral < radius ? Math.sqrt(radius * radius - gripLateral * gripLateral) : 0;
  const reach = grip.x + bladeLength;
  const lunge = Math.max(0, def.attackRange - lateralShort - reach);
  return {
    arc,
    lunge,
    grip,
    bladeLength,
  };
}
