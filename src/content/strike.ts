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
  /** The blade's effective cutting edge — the sweep is a capsule, not a line. */
  bladeRadius: number;
}

/**
 * Strike parameters for a fighter's weapon: the swing arc and the lunge that
 * make the collision reach match the tuned attackRange. Same inputs render
 * and combat use → one number, two consumers.
 *
 * Beasts have no blade: their strike IS their body — a snout/claw lunge from
 * the center with no swing. The visible surge and the collision are the same
 * object, and the tuned beast range is reached exactly.
 */
export function strikeParams(
  armatura: ArmaturaId,
  parts: readonly KitPartId[],
  appearanceSeed: number,
  kind: 'gladiator' | 'beast' = 'gladiator',
): StrikeParams {
  const def = ARMATURAE[armatura] ?? ARMATURAE.MURMILLO;
  const look = ARMATURA_LOOK[armatura] ?? ARMATURA_LOOK.MURMILLO;
  const radius = bodyCollisionCapsule(look, appearanceSeed).radius;
  const arc = kind === 'beast' ? 0 : def.attackArc;
  const bladeRadius = kind === 'beast' ? 6 : (() => {
    const weaponId = parts.find((id) => KIT_PARTS[id]?.slot === 'weapon');
    const shape = shapeForPart(weaponId);
    if (shape && shape.slot === 'weapon') {
      return Math.max(3, Math.min(5.5, shape.bladeWidth * 0.75));
    }
    return 3.5;
  })();
  const grip = kind === 'beast'
    ? { x: 0, z: 0 }
    : {
        x: Math.cos(look.mainHandAngle) * look.mainHandDist,
        z: Math.sin(look.mainHandAngle) * look.mainHandDist,
      };
  const bladeLength = kind === 'beast' ? 10 : (() => {
    const weaponId = parts.find((id) => KIT_PARTS[id]?.slot === 'weapon');
    const shape = shapeForPart(weaponId);
    return shape && shape.slot === 'weapon' ? shape.totalLength : 19;
  })();
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
    bladeRadius,
  };
}

/**
 * Physical armour model — the "armour rating" of a kit and the "pierce" of a
 * weapon, both derived from the SAME shapes that render and hit.
 *
 * Damage is mitigated by armour that the weapon fails to pierce:
 *   mitigation = armour · (1 − pierce)
 * Heavy kits shrug off slashing sica; thrusting blades (gladius, spear,
 * trident) punch through; light kits bleed. The matchups EMERGE from the
 * geometry — no per-pair tuning.
 */
export function armorRating(parts: readonly KitPartId[]): number {
  let a = 0;
  for (const id of parts) {
    const shape = shapeForPart(id);
    if (!shape) continue;
    if (shape.slot === 'greaves') {
      a += shape.coverage * 0.4;
    } else if (shape.slot === 'helm') {
      if (shape.form === 'smooth') a += 0.22;
      else if (shape.form === 'crested') a += 0.18;
      else if (shape.form === 'open') a += 0.1;
    } else if (shape.slot === 'shield') {
      if (shape.form === 'scutum') a += 0.22;
      else if (shape.form === 'parmula' || shape.form === 'aspis') a += 0.12;
    }
    if (KIT_PARTS[id]?.tags.includes('breastplate')) a += 0.18;
  }
  return Math.min(0.85, a);
}

export function pierceRating(parts: readonly KitPartId[]): number {
  const weaponId = parts.find((id) => KIT_PARTS[id]?.slot === 'weapon');
  const shape = shapeForPart(weaponId);
  if (shape && shape.slot === 'weapon') {
    // Thick, massy blades concentrate force; thin slashers find the gaps.
    // Material matters: soft bronze tines (the trident) bend against iron
    // armour — the reason the armoured secutor countered the net-fighter.
    const materialMul = shape.material === 'bronze' ? 0.72 : 1;
    return Math.min(1, (0.28 + shape.bladeThickness * 0.35 + shape.mass * 0.08) * materialMul);
  }
  return 0.6; // beasts — claws and teeth
}
