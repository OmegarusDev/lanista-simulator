import type { ArmaturaId } from './armatura';

/**
 * Purely visual kit — mirrors combat geometry for readability.
 * Body-local after facing rotate: +X forward, +Y right hand, −Y left hand.
 * Combat has no separate L/R equipment stats; hands are presentation only.
 */
export interface ArmaturaLook {
  bodyFill: string;
  metal: string;
  leather: string;
  cloth: string;
  bodyRx: number;
  bodyRy: number;
  weaponIdleFrac: number;
  weaponActiveFrac: number;
  shield: boolean;
  /** Small round parmula / aspis */
  roundShield: boolean;
  /**
   * Main-hand grip (usually right / +Y): angle from body center.
   * Weapon tip still aims roughly forward from this grip.
   */
  mainHandAngle: number;
  mainHandDist: number;
  /** Off-hand grip (shield, net, scissor, second blade) */
  offHandAngle: number;
  offHandDist: number;
  crest: boolean;
  /** Secutor-style smooth bowl */
  smoothHelm: boolean;
  bareHead: boolean;
  curvedBlade: boolean;
  trident: boolean;
  net: boolean;
  spear: boolean;
  dualBlade: boolean;
  scissorArm: boolean;
  breastplate: boolean;
}

export const ARMATURA_LOOK: Record<ArmaturaId, ArmaturaLook> = {
  MURMILLO: {
    bodyFill: '#6b7c8a',
    metal: '#9aa8b4',
    leather: '#5a4030',
    cloth: '#3d4a55',
    bodyRx: 13,
    bodyRy: 11,
    weaponIdleFrac: 0.42,
    weaponActiveFrac: 0.88,
    shield: true,
    roundShield: false,
    mainHandAngle: 0.72,
    mainHandDist: 9,
    offHandAngle: -0.95,
    offHandDist: 9,
    crest: true,
    smoothHelm: false,
    bareHead: false,
    curvedBlade: false,
    trident: false,
    net: false,
    spear: false,
    dualBlade: false,
    scissorArm: false,
    breastplate: false,
  },
  THRAEX: {
    bodyFill: '#a65d3a',
    metal: '#c4a060',
    leather: '#6b3e28',
    cloth: '#8a4a32',
    bodyRx: 10,
    bodyRy: 12,
    weaponIdleFrac: 0.4,
    weaponActiveFrac: 0.9,
    shield: true,
    roundShield: true,
    mainHandAngle: 0.78,
    mainHandDist: 8.5,
    offHandAngle: -0.85,
    offHandDist: 9,
    crest: false,
    smoothHelm: false,
    bareHead: false,
    curvedBlade: true,
    trident: false,
    net: false,
    spear: false,
    dualBlade: false,
    scissorArm: false,
    breastplate: false,
  },
  RETIARIUS: {
    bodyFill: '#4a7a6a',
    metal: '#8a9a90',
    leather: '#4a3830',
    cloth: '#d8cfc0',
    bodyRx: 9,
    bodyRy: 11,
    weaponIdleFrac: 0.5,
    weaponActiveFrac: 0.95,
    shield: false,
    roundShield: false,
    // Trident left, net right (classic retiarius)
    mainHandAngle: -0.7,
    mainHandDist: 9,
    offHandAngle: 0.9,
    offHandDist: 10,
    crest: false,
    smoothHelm: false,
    bareHead: true,
    curvedBlade: false,
    trident: true,
    net: true,
    spear: false,
    dualBlade: false,
    scissorArm: false,
    breastplate: false,
  },
  SECUTOR: {
    bodyFill: '#5a6a78',
    metal: '#8a969e',
    leather: '#4a3828',
    cloth: '#3a4550',
    bodyRx: 12.5,
    bodyRy: 11,
    weaponIdleFrac: 0.42,
    weaponActiveFrac: 0.88,
    shield: true,
    roundShield: false,
    mainHandAngle: 0.72,
    mainHandDist: 9,
    offHandAngle: -0.95,
    offHandDist: 9,
    crest: false,
    smoothHelm: true,
    bareHead: false,
    curvedBlade: false,
    trident: false,
    net: false,
    spear: false,
    dualBlade: false,
    scissorArm: false,
    breastplate: false,
  },
  HOPLOMACHUS: {
    bodyFill: '#7a6a4a',
    metal: '#b0a070',
    leather: '#5a4030',
    cloth: '#6a5a40',
    bodyRx: 10,
    bodyRy: 11.5,
    weaponIdleFrac: 0.55,
    weaponActiveFrac: 0.96,
    shield: true,
    roundShield: true,
    mainHandAngle: 0.55,
    mainHandDist: 8,
    offHandAngle: -0.9,
    offHandDist: 9,
    crest: false,
    smoothHelm: false,
    bareHead: false,
    curvedBlade: false,
    trident: false,
    net: false,
    spear: true,
    dualBlade: false,
    scissorArm: false,
    breastplate: false,
  },
  PROVOCATOR: {
    bodyFill: '#8a7070',
    metal: '#a09088',
    leather: '#503828',
    cloth: '#5a4048',
    bodyRx: 13,
    bodyRy: 12,
    weaponIdleFrac: 0.38,
    weaponActiveFrac: 0.82,
    shield: true,
    roundShield: false,
    mainHandAngle: 0.7,
    mainHandDist: 9.5,
    offHandAngle: -0.9,
    offHandDist: 9.5,
    crest: false,
    smoothHelm: false,
    bareHead: false,
    curvedBlade: false,
    trident: false,
    net: false,
    spear: false,
    dualBlade: false,
    scissorArm: false,
    breastplate: true,
  },
  DIMACHAERUS: {
    bodyFill: '#8a5a6a',
    metal: '#c0a0a8',
    leather: '#4a3038',
    cloth: '#6a4050',
    bodyRx: 9.5,
    bodyRy: 11,
    weaponIdleFrac: 0.4,
    weaponActiveFrac: 0.88,
    shield: false,
    roundShield: false,
    mainHandAngle: 0.85,
    mainHandDist: 8.5,
    offHandAngle: -0.85,
    offHandDist: 8.5,
    crest: false,
    smoothHelm: false,
    bareHead: false,
    curvedBlade: false,
    trident: false,
    net: false,
    spear: false,
    dualBlade: true,
    scissorArm: false,
    breastplate: false,
  },
  SCISSOR: {
    bodyFill: '#6a5a4a',
    metal: '#908070',
    leather: '#403028',
    cloth: '#5a4a40',
    bodyRx: 11,
    bodyRy: 11,
    weaponIdleFrac: 0.38,
    weaponActiveFrac: 0.85,
    shield: false,
    roundShield: false,
    mainHandAngle: 0.75,
    mainHandDist: 9,
    offHandAngle: -1.0,
    offHandDist: 9,
    crest: false,
    smoothHelm: true,
    bareHead: false,
    curvedBlade: false,
    trident: false,
    net: false,
    spear: false,
    dualBlade: false,
    scissorArm: true,
    breastplate: false,
  },
};

export function massScale(mass: number): number {
  return 0.82 + mass * 0.22;
}
