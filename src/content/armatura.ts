import { ARMATURA_LOADOUTS, assembleLoadout } from './kitPieces';

export type ArmaturaId =
  | 'MURMILLO'
  | 'THRAEX'
  | 'RETIARIUS'
  | 'SECUTOR'
  | 'HOPLOMACHUS'
  | 'PROVOCATOR'
  | 'DIMACHAERUS'
  | 'SCISSOR';

/**
 * Class identity is geometry + economy + tiny contact hooks.
 * Same AI brain for everyone — personality emerges from these numbers.
 * Presets are assembled from composable kit pieces (see kitPieces.ts).
 */
export interface ArmaturaDef {
  id: ArmaturaId;
  name: string;
  short: string;
  color: string;

  maxHealth: number;
  maxStamina: number;
  maxPoise: number;
  strength: number;

  measureMin: number;
  measureMax: number;
  attackRange: number;
  attackArc: number;
  guardArc: number;
  turnRate: number;
  moveSpeed: number;
  strafeMul: number;
  mass: number;

  windup: number;
  active: number;
  recover: number;
  attackCooldown: number;
  attackStamina: number;
  blockStaminaPerTick: number;
  dodgeStamina: number;
  dodgeDuration: number;
  dodgeCooldown: number;
  damageMul: number;
  /** Fraction of weapon HP-damage applied as unblockable poise damage */
  poiseMul: number;
  guardAbsorb: number;

  /** Outer-reach tangle (net). 0 = none */
  tipCatchRatio: number;
  tipCatchTicks: number;
  /** 0–1 reduction of incoming tip-catch duration (Secutor helm, etc.) */
  tipCatchResist: number;
  /** Poise dealt to attacker when their cut lands on our guard */
  shieldShock: number;
  /** Extra attack-arc radians while circling (sica angle work) */
  circleArcBonus: number;
  /** Prefer hard disengage when jammed inside measureMin */
  clinchPanic: number;
  /** Bias to press CLOSE when otherwise holding (pursuer) */
  pursueBias: number;
}

function buildArmaturae(): Record<ArmaturaId, ArmaturaDef> {
  const out = {} as Record<ArmaturaId, ArmaturaDef>;
  for (const id of Object.keys(ARMATURA_LOADOUTS) as ArmaturaId[]) {
    out[id] = assembleLoadout(ARMATURA_LOADOUTS[id]!);
  }
  return out;
}

export const ARMATURAE: Record<ArmaturaId, ArmaturaDef> = buildArmaturae();

export const ARMATURA_LIST: ArmaturaId[] = [
  'MURMILLO',
  'THRAEX',
  'RETIARIUS',
  'SECUTOR',
  'HOPLOMACHUS',
  'PROVOCATOR',
  'DIMACHAERUS',
  'SCISSOR',
];

/** Effective attack arc including circle bonus while orbiting. */
export function effectiveAttackArc(
  def: ArmaturaDef,
  footwork: 'HOLD' | 'CLOSE' | 'DISENGAGE' | 'CIRCLE_L' | 'CIRCLE_R',
): number {
  const circling = footwork === 'CIRCLE_L' || footwork === 'CIRCLE_R';
  return def.attackArc + (circling ? def.circleArcBonus : 0);
}

/** Re-export assemble helpers for armory / spawn overrides later. */
export {
  assembleKitFromParts,
  assembleLoadout,
  ARMATURA_LOADOUTS,
  KIT_PARTS,
  type KitLoadout,
  type KitPart,
  type KitPartId,
  type KitSlot,
} from './kitPieces';
