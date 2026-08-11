import type { ArmaturaLook } from './appearance';
import { KIT_PARTS, type KitPartId } from './kitPieces';

/**
 * Look-contract tags on KitPart.tags (silhouette flags for draw):
 *   crest | smoothHelm | bareHead | breastplate |
 *   shield | roundShield |
 *   curvedBlade | trident | net | spear | dualBlade | scissorArm
 * Geometry / colors still come from `base` (stock ARMATURA_LOOK).
 */

const LOOK_FLAGS = [
  'shield',
  'roundShield',
  'crest',
  'smoothHelm',
  'bareHead',
  'curvedBlade',
  'trident',
  'net',
  'spear',
  'dualBlade',
  'scissorArm',
  'breastplate',
] as const;

type LookFlag = (typeof LOOK_FLAGS)[number];

function isLookFlag(tag: string): tag is LookFlag {
  return (LOOK_FLAGS as readonly string[]).includes(tag);
}

/**
 * Merge kit piece tags into a draw look. Resets silhouette flags, then ORs tags
 * from each part. Stock loadouts + ARMATURA_LOOK base → bit-identical flags.
 */
export function lookFromParts(
  partIds: readonly KitPartId[],
  base: ArmaturaLook,
): ArmaturaLook {
  const look: ArmaturaLook = { ...base };
  for (const flag of LOOK_FLAGS) {
    look[flag] = false;
  }
  for (const id of partIds) {
    const part = KIT_PARTS[id];
    if (!part) continue;
    for (const tag of part.tags) {
      if (isLookFlag(tag)) look[tag] = true;
    }
  }
  return look;
}

/** Silhouette flags only — for parity tests. */
export function lookFlags(look: ArmaturaLook): Record<LookFlag, boolean> {
  const out = {} as Record<LookFlag, boolean>;
  for (const flag of LOOK_FLAGS) out[flag] = look[flag];
  return out;
}
