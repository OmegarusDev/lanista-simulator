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

export const ARMATURAE: Record<ArmaturaId, ArmaturaDef> = {
  MURMILLO: {
    id: 'MURMILLO',
    name: 'Murmillo',
    short: 'Mur',
    color: '#6b7c8a',
    maxHealth: 125,
    maxStamina: 48,
    maxPoise: 100,
    strength: 13,
    measureMin: 38,
    measureMax: 52,
    attackRange: 50,
    attackArc: 0.55,
    guardArc: 1.05,
    turnRate: 2.1,
    moveSpeed: 52,
    strafeMul: 0.55,
    mass: 1.35,
    windup: 20,
    active: 8,
    recover: 18,
    attackCooldown: 16,
    attackStamina: 15,
    blockStaminaPerTick: 0.12,
    dodgeStamina: 14,
    dodgeDuration: 10,
    dodgeCooldown: 28,
    damageMul: 1.12,
    poiseMul: 1.05,
    guardAbsorb: 0.28,
    tipCatchRatio: 0,
    tipCatchTicks: 0,
    tipCatchResist: 0.15,
    shieldShock: 8,
    circleArcBonus: 0,
    clinchPanic: 0.1,
    pursueBias: 0.15,
  },
  THRAEX: {
    id: 'THRAEX',
    name: 'Thraex',
    short: 'Thr',
    color: '#a65d3a',
    maxHealth: 100,
    maxStamina: 68,
    maxPoise: 58,
    strength: 10,
    measureMin: 34,
    measureMax: 48,
    attackRange: 44,
    attackArc: 0.7,
    guardArc: 0.55,
    turnRate: 3.6,
    moveSpeed: 78,
    strafeMul: 1.15,
    mass: 0.9,
    windup: 11,
    active: 6,
    recover: 10,
    attackCooldown: 8,
    attackStamina: 10,
    blockStaminaPerTick: 0.18,
    dodgeStamina: 8,
    dodgeDuration: 14,
    dodgeCooldown: 14,
    damageMul: 0.95,
    poiseMul: 0.9,
    guardAbsorb: 0.55,
    tipCatchRatio: 0,
    tipCatchTicks: 0,
    tipCatchResist: 0,
    shieldShock: 3,
    circleArcBonus: 0.28,
    clinchPanic: 0.25,
    pursueBias: 0.2,
  },
  RETIARIUS: {
    id: 'RETIARIUS',
    name: 'Retiarius',
    short: 'Ret',
    color: '#4a7a6a',
    maxHealth: 85,
    maxStamina: 78,
    maxPoise: 40,
    strength: 9,
    measureMin: 58,
    measureMax: 78,
    attackRange: 78,
    attackArc: 0.38,
    guardArc: 0.22,
    turnRate: 3.2,
    moveSpeed: 82,
    strafeMul: 1.05,
    mass: 0.75,
    windup: 15,
    active: 7,
    recover: 14,
    attackCooldown: 12,
    attackStamina: 12,
    blockStaminaPerTick: 0.22,
    dodgeStamina: 9,
    dodgeDuration: 15,
    dodgeCooldown: 12,
    damageMul: 1.0,
    poiseMul: 0.75,
    guardAbsorb: 0.85,
    tipCatchRatio: 0.55,
    tipCatchTicks: 48,
    tipCatchResist: 0,
    shieldShock: 0,
    circleArcBonus: 0.05,
    clinchPanic: 0.95,
    pursueBias: 0.05,
  },
  SECUTOR: {
    id: 'SECUTOR',
    name: 'Secutor',
    short: 'Sec',
    color: '#5a6a78',
    maxHealth: 120,
    maxStamina: 52,
    maxPoise: 95,
    strength: 12,
    measureMin: 36,
    measureMax: 50,
    attackRange: 48,
    attackArc: 0.52,
    guardArc: 1.0,
    turnRate: 2.0,
    moveSpeed: 58,
    strafeMul: 0.5,
    mass: 1.3,
    windup: 18,
    active: 8,
    recover: 16,
    attackCooldown: 14,
    attackStamina: 14,
    blockStaminaPerTick: 0.13,
    dodgeStamina: 13,
    dodgeDuration: 10,
    dodgeCooldown: 26,
    damageMul: 1.08,
    poiseMul: 1.0,
    guardAbsorb: 0.3,
    tipCatchRatio: 0,
    tipCatchTicks: 0,
    tipCatchResist: 0.75,
    shieldShock: 7,
    circleArcBonus: 0,
    clinchPanic: 0.05,
    pursueBias: 0.55,
  },
  HOPLOMACHUS: {
    id: 'HOPLOMACHUS',
    name: 'Hoplomachus',
    short: 'Hop',
    color: '#7a6a4a',
    maxHealth: 95,
    maxStamina: 62,
    maxPoise: 55,
    strength: 10,
    measureMin: 62,
    measureMax: 82,
    attackRange: 84,
    attackArc: 0.32,
    guardArc: 0.48,
    turnRate: 2.8,
    moveSpeed: 70,
    strafeMul: 0.85,
    mass: 0.95,
    windup: 16,
    active: 7,
    recover: 15,
    attackCooldown: 13,
    attackStamina: 13,
    blockStaminaPerTick: 0.16,
    dodgeStamina: 10,
    dodgeDuration: 12,
    dodgeCooldown: 16,
    damageMul: 1.05,
    poiseMul: 0.85,
    guardAbsorb: 0.5,
    tipCatchRatio: 0,
    tipCatchTicks: 0,
    tipCatchResist: 0.1,
    shieldShock: 4,
    circleArcBonus: 0.08,
    clinchPanic: 0.7,
    pursueBias: 0.1,
  },
  PROVOCATOR: {
    id: 'PROVOCATOR',
    name: 'Provocator',
    short: 'Pro',
    color: '#8a7070',
    maxHealth: 130,
    maxStamina: 44,
    maxPoise: 110,
    strength: 12,
    measureMin: 36,
    measureMax: 48,
    attackRange: 46,
    attackArc: 0.5,
    guardArc: 0.95,
    turnRate: 1.9,
    moveSpeed: 48,
    strafeMul: 0.45,
    mass: 1.4,
    windup: 22,
    active: 8,
    recover: 20,
    attackCooldown: 18,
    attackStamina: 16,
    blockStaminaPerTick: 0.09,
    dodgeStamina: 15,
    dodgeDuration: 9,
    dodgeCooldown: 32,
    damageMul: 1.05,
    poiseMul: 1.1,
    guardAbsorb: 0.22,
    tipCatchRatio: 0,
    tipCatchTicks: 0,
    tipCatchResist: 0.25,
    shieldShock: 9,
    circleArcBonus: 0,
    clinchPanic: 0.05,
    pursueBias: 0.2,
  },
  DIMACHAERUS: {
    id: 'DIMACHAERUS',
    name: 'Dimachaerus',
    short: 'Dim',
    color: '#8a5a6a',
    maxHealth: 90,
    maxStamina: 72,
    maxPoise: 50,
    strength: 10,
    measureMin: 32,
    measureMax: 46,
    attackRange: 42,
    attackArc: 0.85,
    guardArc: 0.08,
    turnRate: 3.8,
    moveSpeed: 80,
    strafeMul: 1.2,
    mass: 0.85,
    windup: 9,
    active: 5,
    recover: 8,
    attackCooldown: 6,
    attackStamina: 9,
    blockStaminaPerTick: 0.28,
    dodgeStamina: 7,
    dodgeDuration: 15,
    dodgeCooldown: 10,
    damageMul: 0.88,
    poiseMul: 0.8,
    guardAbsorb: 0.9,
    tipCatchRatio: 0,
    tipCatchTicks: 0,
    tipCatchResist: 0,
    shieldShock: 0,
    circleArcBonus: 0.2,
    clinchPanic: 0.35,
    pursueBias: 0.35,
  },
  SCISSOR: {
    id: 'SCISSOR',
    name: 'Scissor',
    short: 'Sci',
    color: '#6a5a4a',
    maxHealth: 105,
    maxStamina: 60,
    maxPoise: 70,
    strength: 11,
    measureMin: 30,
    measureMax: 44,
    attackRange: 40,
    attackArc: 0.65,
    guardArc: 0.35,
    turnRate: 3.0,
    moveSpeed: 72,
    strafeMul: 0.95,
    mass: 1.05,
    windup: 12,
    active: 6,
    recover: 11,
    attackCooldown: 9,
    attackStamina: 11,
    blockStaminaPerTick: 0.17,
    dodgeStamina: 9,
    dodgeDuration: 12,
    dodgeCooldown: 14,
    damageMul: 1.0,
    poiseMul: 1.2,
    guardAbsorb: 0.6,
    tipCatchRatio: 0,
    tipCatchTicks: 0,
    tipCatchResist: 0.55,
    shieldShock: 2,
    circleArcBonus: 0.12,
    clinchPanic: 0.15,
    pursueBias: 0.45,
  },
};

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
