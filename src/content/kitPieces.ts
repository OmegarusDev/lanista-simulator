/**
 * Composable armour / weapon pieces for classic armaturae.
 * Combat still consumes one assembled ArmaturaDef; parts are the armory-ready building blocks.
 *
 * Slot ownership (exclusive merge — later slots do not overlap fields):
 *   helm    — tipCatchResist, turnRate, maxPoise (bowl / crest)
 *   shield  — guardArc, guardAbsorb, shieldShock, blockStaminaPerTick (or none)
 *   weapon  — measure, attack timing/arcs, damage, tip-catch offense, circleArcBonus
 *   greaves — maxHealth, mass, moveSpeed, strafeMul, dodge pools
 *   manica  — strength, maxStamina, clinchPanic, pursueBias, poiseMul extras
 */

import type { ArmaturaDef, ArmaturaId } from './armatura';
import { deriveCombat, shapeForPart } from './shapes';

export type KitSlot = 'helm' | 'shield' | 'weapon' | 'greaves' | 'manica';

export type KitPartId = string;

/** Numeric combat fields (everything on ArmaturaDef except identity). */
export type CombatSlice = {
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
  poiseMul: number;
  guardAbsorb: number;
  tipCatchRatio: number;
  tipCatchTicks: number;
  tipCatchResist: number;
  shieldShock: number;
  circleArcBonus: number;
  clinchPanic: number;
  pursueBias: number;
};

export interface KitPart {
  id: KitPartId;
  slot: KitSlot;
  name: string;
  /** Fields this piece contributes when assembled. */
  combat: Partial<CombatSlice>;
  /** Draw / presentation tags — look contract for `lookFromParts` (content/kitLook). */
  tags: readonly string[];
}

export interface KitLoadout {
  id: ArmaturaId;
  name: string;
  short: string;
  color: string;
  helm: KitPartId;
  shield: KitPartId | null;
  weapon: KitPartId;
  greaves: KitPartId;
  manica: KitPartId;
}

/** Neutral human baseline before parts (overwritten by exclusive slots). */
export const KIT_BASE: CombatSlice = {
  maxHealth: 100,
  maxStamina: 55,
  maxPoise: 60,
  strength: 10,
  measureMin: 36,
  measureMax: 50,
  attackRange: 48,
  attackArc: 0.55,
  guardArc: 0.5,
  turnRate: 2.5,
  moveSpeed: 65,
  strafeMul: 0.8,
  mass: 1,
  windup: 14,
  active: 7,
  recover: 12,
  attackCooldown: 12,
  attackStamina: 12,
  blockStaminaPerTick: 0.15,
  dodgeStamina: 10,
  dodgeDuration: 12,
  dodgeCooldown: 16,
  damageMul: 1,
  poiseMul: 1,
  guardAbsorb: 0.5,
  tipCatchRatio: 0,
  tipCatchTicks: 0,
  tipCatchResist: 0,
  shieldShock: 0,
  circleArcBonus: 0,
  clinchPanic: 0.2,
  pursueBias: 0.2,
};

export const KIT_PARTS: Record<KitPartId, KitPart> = {
  // —— Helms ——
  helm_murmillo_crest: {
    id: 'helm_murmillo_crest',
    slot: 'helm',
    name: 'Murmillo crest helm',
    tags: ['crest', 'helm'],
    combat: { tipCatchResist: 0.15, turnRate: 2.1, maxPoise: 100 },
  },
  helm_thraex: {
    id: 'helm_thraex',
    slot: 'helm',
    name: 'Thraex helm',
    tags: ['crest', 'helm'],
    combat: { tipCatchResist: 0, turnRate: 3.6, maxPoise: 58 },
  },
  helm_none_ret: {
    id: 'helm_none_ret',
    slot: 'helm',
    name: 'Bare head (retiarius)',
    tags: ['bareHead'],
    combat: { tipCatchResist: 0, turnRate: 3.2, maxPoise: 40 },
  },
  helm_secutor: {
    id: 'helm_secutor',
    slot: 'helm',
    name: 'Secutor smooth helm',
    tags: ['smoothHelm', 'helm'],
    combat: { tipCatchResist: 0.75, turnRate: 2.0, maxPoise: 95 },
  },
  helm_hoplomachus: {
    id: 'helm_hoplomachus',
    slot: 'helm',
    name: 'Hoplomachus helm',
    tags: ['crest', 'helm'],
    combat: { tipCatchResist: 0.1, turnRate: 2.8, maxPoise: 55 },
  },
  helm_provocator: {
    id: 'helm_provocator',
    slot: 'helm',
    name: 'Provocator helm',
    tags: ['helm', 'breastplate'],
    combat: { tipCatchResist: 0.25, turnRate: 1.9, maxPoise: 110 },
  },
  helm_dimachaerus: {
    id: 'helm_dimachaerus',
    slot: 'helm',
    name: 'Light open helm',
    tags: ['helm'],
    combat: { tipCatchResist: 0, turnRate: 3.8, maxPoise: 50 },
  },
  helm_scissor: {
    id: 'helm_scissor',
    slot: 'helm',
    name: 'Scissor helm',
    tags: ['smoothHelm', 'helm'],
    combat: { tipCatchResist: 0.55, turnRate: 3.0, maxPoise: 70 },
  },

  // —— Shields ——
  shield_scutum: {
    id: 'shield_scutum',
    slot: 'shield',
    name: 'Scutum',
    tags: ['shield'],
    combat: {
      guardArc: 1.05,
      guardAbsorb: 0.28,
      shieldShock: 8,
      blockStaminaPerTick: 0.12,
    },
  },
  shield_parmula: {
    id: 'shield_parmula',
    slot: 'shield',
    name: 'Parmula',
    tags: ['shield', 'roundShield'],
    combat: {
      guardArc: 0.55,
      guardAbsorb: 0.55,
      shieldShock: 3,
      blockStaminaPerTick: 0.18,
    },
  },
  shield_none: {
    id: 'shield_none',
    slot: 'shield',
    name: 'No shield',
    tags: [],
    combat: {
      guardArc: 0.22,
      guardAbsorb: 0.85,
      shieldShock: 0,
      blockStaminaPerTick: 0.22,
    },
  },
  shield_secutor: {
    id: 'shield_secutor',
    slot: 'shield',
    name: 'Secutor scutum',
    tags: ['shield'],
    combat: {
      guardArc: 1.0,
      guardAbsorb: 0.3,
      shieldShock: 7,
      blockStaminaPerTick: 0.13,
    },
  },
  shield_aspis: {
    id: 'shield_aspis',
    slot: 'shield',
    name: 'Small aspis',
    tags: ['shield', 'roundShield'],
    combat: {
      guardArc: 0.48,
      guardAbsorb: 0.5,
      shieldShock: 4,
      blockStaminaPerTick: 0.16,
    },
  },
  shield_provocator: {
    id: 'shield_provocator',
    slot: 'shield',
    name: 'Provocator scutum',
    tags: ['shield'],
    combat: {
      guardArc: 0.95,
      guardAbsorb: 0.22,
      shieldShock: 9,
      blockStaminaPerTick: 0.09,
    },
  },
  shield_dimachaerus: {
    id: 'shield_dimachaerus',
    slot: 'shield',
    name: 'No shield (dual blades)',
    tags: [],
    combat: {
      guardArc: 0.08,
      guardAbsorb: 0.9,
      shieldShock: 0,
      blockStaminaPerTick: 0.28,
    },
  },
  shield_scissor: {
    id: 'shield_scissor',
    slot: 'shield',
    name: 'Scissor tube arm (off-hand)',
    tags: ['scissorArm'],
    combat: {
      guardArc: 0.35,
      guardAbsorb: 0.6,
      shieldShock: 2,
      blockStaminaPerTick: 0.17,
    },
  },

  // —— Weapons ——
  weapon_gladius_mur: {
    id: 'weapon_gladius_mur',
    slot: 'weapon',
    name: 'Gladius (murmillo)',
    tags: ['gladius'],
    combat: {
      measureMin: 38,
      measureMax: 52,
      attackRange: 50,
      attackArc: 0.55,
      windup: 20,
      active: 8,
      recover: 18,
      attackCooldown: 16,
      attackStamina: 15,
      damageMul: 1.12,
      poiseMul: 1.05,
      tipCatchRatio: 0,
      tipCatchTicks: 0,
      circleArcBonus: 0,
    },
  },
  weapon_sica: {
    id: 'weapon_sica',
    slot: 'weapon',
    name: 'Sica',
    tags: ['curvedBlade', 'sica'],
    combat: {
      measureMin: 34,
      measureMax: 48,
      attackRange: 44,
      attackArc: 0.7,
      windup: 11,
      active: 6,
      recover: 10,
      attackCooldown: 8,
      attackStamina: 10,
      damageMul: 0.95,
      poiseMul: 0.9,
      tipCatchRatio: 0,
      tipCatchTicks: 0,
      circleArcBonus: 0.28,
    },
  },
  weapon_trident_net: {
    id: 'weapon_trident_net',
    slot: 'weapon',
    name: 'Trident & net',
    tags: ['trident', 'net'],
    combat: {
      measureMin: 58,
      measureMax: 78,
      attackRange: 78,
      attackArc: 0.38,
      windup: 15,
      active: 7,
      recover: 14,
      attackCooldown: 12,
      attackStamina: 12,
      damageMul: 1.0,
      poiseMul: 0.75,
      tipCatchRatio: 0.55,
      tipCatchTicks: 48,
      circleArcBonus: 0.05,
    },
  },
  weapon_gladius_sec: {
    id: 'weapon_gladius_sec',
    slot: 'weapon',
    name: 'Gladius (secutor)',
    tags: ['gladius'],
    combat: {
      measureMin: 36,
      measureMax: 50,
      attackRange: 48,
      attackArc: 0.52,
      windup: 18,
      active: 8,
      recover: 16,
      attackCooldown: 14,
      attackStamina: 14,
      damageMul: 1.08,
      poiseMul: 1.0,
      tipCatchRatio: 0,
      tipCatchTicks: 0,
      circleArcBonus: 0,
    },
  },
  weapon_hasta: {
    id: 'weapon_hasta',
    slot: 'weapon',
    name: 'Hasta',
    tags: ['spear'],
    combat: {
      measureMin: 62,
      measureMax: 82,
      attackRange: 84,
      attackArc: 0.32,
      windup: 16,
      active: 7,
      recover: 15,
      attackCooldown: 13,
      attackStamina: 13,
      damageMul: 1.05,
      poiseMul: 0.85,
      tipCatchRatio: 0,
      tipCatchTicks: 0,
      circleArcBonus: 0.08,
    },
  },
  weapon_gladius_pro: {
    id: 'weapon_gladius_pro',
    slot: 'weapon',
    name: 'Gladius (provocator)',
    tags: ['gladius'],
    combat: {
      measureMin: 36,
      measureMax: 48,
      attackRange: 46,
      attackArc: 0.5,
      windup: 22,
      active: 8,
      recover: 20,
      attackCooldown: 18,
      attackStamina: 16,
      damageMul: 1.05,
      poiseMul: 1.1,
      tipCatchRatio: 0,
      tipCatchTicks: 0,
      circleArcBonus: 0,
    },
  },
  weapon_dual_blades: {
    id: 'weapon_dual_blades',
    slot: 'weapon',
    name: 'Twin blades',
    tags: ['dualBlade'],
    combat: {
      measureMin: 32,
      measureMax: 46,
      attackRange: 42,
      attackArc: 0.85,
      windup: 9,
      active: 5,
      recover: 8,
      attackCooldown: 6,
      attackStamina: 9,
      damageMul: 0.88,
      poiseMul: 0.8,
      tipCatchRatio: 0,
      tipCatchTicks: 0,
      circleArcBonus: 0.2,
    },
  },
  weapon_scissor_blade: {
    id: 'weapon_scissor_blade',
    slot: 'weapon',
    name: 'Scissor blade',
    tags: ['scissorArm'],
    combat: {
      measureMin: 30,
      measureMax: 44,
      attackRange: 40,
      attackArc: 0.65,
      windup: 12,
      active: 6,
      recover: 11,
      attackCooldown: 9,
      attackStamina: 11,
      damageMul: 1.0,
      poiseMul: 1.2,
      tipCatchRatio: 0,
      tipCatchTicks: 0,
      circleArcBonus: 0.12,
    },
  },

  // —— Greaves (legs / mobility / bulk) ——
  greaves_heavy: {
    id: 'greaves_heavy',
    slot: 'greaves',
    name: 'Heavy greaves',
    tags: ['greaves'],
    combat: {
      maxHealth: 125,
      mass: 1.35,
      moveSpeed: 52,
      strafeMul: 0.55,
      dodgeStamina: 14,
      dodgeDuration: 10,
      dodgeCooldown: 28,
    },
  },
  greaves_thraex: {
    id: 'greaves_thraex',
    slot: 'greaves',
    name: 'Thraex greaves',
    tags: ['greaves'],
    combat: {
      maxHealth: 100,
      mass: 0.9,
      moveSpeed: 78,
      strafeMul: 1.15,
      dodgeStamina: 8,
      dodgeDuration: 14,
      dodgeCooldown: 14,
    },
  },
  greaves_light_ret: {
    id: 'greaves_light_ret',
    slot: 'greaves',
    name: 'Light greaves',
    tags: ['greaves'],
    combat: {
      maxHealth: 85,
      mass: 0.75,
      moveSpeed: 82,
      strafeMul: 1.05,
      dodgeStamina: 9,
      dodgeDuration: 15,
      dodgeCooldown: 12,
    },
  },
  greaves_secutor: {
    id: 'greaves_secutor',
    slot: 'greaves',
    name: 'Secutor greaves',
    tags: ['greaves'],
    combat: {
      maxHealth: 120,
      mass: 1.3,
      moveSpeed: 58,
      strafeMul: 0.5,
      dodgeStamina: 13,
      dodgeDuration: 10,
      dodgeCooldown: 26,
    },
  },
  greaves_hop: {
    id: 'greaves_hop',
    slot: 'greaves',
    name: 'Hoplomachus greaves',
    tags: ['greaves'],
    combat: {
      maxHealth: 95,
      mass: 0.95,
      moveSpeed: 70,
      strafeMul: 0.85,
      dodgeStamina: 10,
      dodgeDuration: 12,
      dodgeCooldown: 16,
    },
  },
  greaves_provocator: {
    id: 'greaves_provocator',
    slot: 'greaves',
    name: 'Provocator greaves',
    tags: ['greaves'],
    combat: {
      maxHealth: 130,
      mass: 1.4,
      moveSpeed: 48,
      strafeMul: 0.45,
      dodgeStamina: 15,
      dodgeDuration: 9,
      dodgeCooldown: 32,
    },
  },
  greaves_dim: {
    id: 'greaves_dim',
    slot: 'greaves',
    name: 'Light dimachaerus greaves',
    tags: ['greaves'],
    combat: {
      maxHealth: 90,
      mass: 0.85,
      moveSpeed: 80,
      strafeMul: 1.2,
      dodgeStamina: 7,
      dodgeDuration: 15,
      dodgeCooldown: 10,
    },
  },
  greaves_scissor: {
    id: 'greaves_scissor',
    slot: 'greaves',
    name: 'Scissor greaves',
    tags: ['greaves'],
    combat: {
      maxHealth: 105,
      mass: 1.05,
      moveSpeed: 72,
      strafeMul: 0.95,
      dodgeStamina: 9,
      dodgeDuration: 12,
      dodgeCooldown: 14,
    },
  },

  // —— Manica / arm & temperament of the kit ——
  manica_mur: {
    id: 'manica_mur',
    slot: 'manica',
    name: 'Murmillo manica',
    tags: ['manica'],
    combat: {
      strength: 13,
      maxStamina: 48,
      clinchPanic: 0.1,
      pursueBias: 0.15,
    },
  },
  manica_thraex: {
    id: 'manica_thraex',
    slot: 'manica',
    name: 'Thraex manica',
    tags: ['manica'],
    combat: {
      strength: 10,
      maxStamina: 68,
      clinchPanic: 0.25,
      pursueBias: 0.2,
    },
  },
  manica_ret: {
    id: 'manica_ret',
    slot: 'manica',
    name: 'Retiarius galerus / manica',
    tags: ['manica'],
    combat: {
      strength: 9,
      maxStamina: 78,
      clinchPanic: 0.95,
      pursueBias: 0.05,
    },
  },
  manica_sec: {
    id: 'manica_sec',
    slot: 'manica',
    name: 'Secutor manica',
    tags: ['manica'],
    combat: {
      strength: 12,
      maxStamina: 52,
      clinchPanic: 0.05,
      pursueBias: 0.55,
    },
  },
  manica_hop: {
    id: 'manica_hop',
    slot: 'manica',
    name: 'Hoplomachus manica',
    tags: ['manica'],
    combat: {
      strength: 10,
      maxStamina: 62,
      clinchPanic: 0.7,
      pursueBias: 0.1,
    },
  },
  manica_pro: {
    id: 'manica_pro',
    slot: 'manica',
    name: 'Provocator manica',
    tags: ['manica'],
    combat: {
      strength: 12,
      maxStamina: 44,
      clinchPanic: 0.05,
      pursueBias: 0.2,
    },
  },
  manica_dim: {
    id: 'manica_dim',
    slot: 'manica',
    name: 'Dimachaerus wraps',
    tags: ['manica'],
    combat: {
      strength: 10,
      maxStamina: 72,
      clinchPanic: 0.35,
      pursueBias: 0.35,
    },
  },
  manica_scissor: {
    id: 'manica_scissor',
    slot: 'manica',
    name: 'Scissor manica',
    tags: ['manica'],
    combat: {
      strength: 11,
      maxStamina: 60,
      clinchPanic: 0.15,
      pursueBias: 0.45,
    },
  },
};

export const ARMATURA_LOADOUTS: Record<ArmaturaId, KitLoadout> = {
  MURMILLO: {
    id: 'MURMILLO',
    name: 'Murmillo',
    short: 'Mur',
    color: '#6b7c8a',
    helm: 'helm_murmillo_crest',
    shield: 'shield_scutum',
    weapon: 'weapon_gladius_mur',
    greaves: 'greaves_heavy',
    manica: 'manica_mur',
  },
  THRAEX: {
    id: 'THRAEX',
    name: 'Thraex',
    short: 'Thr',
    color: '#a65d3a',
    helm: 'helm_thraex',
    shield: 'shield_parmula',
    weapon: 'weapon_sica',
    greaves: 'greaves_thraex',
    manica: 'manica_thraex',
  },
  RETIARIUS: {
    id: 'RETIARIUS',
    name: 'Retiarius',
    short: 'Ret',
    color: '#4a7a6a',
    helm: 'helm_none_ret',
    shield: 'shield_none',
    weapon: 'weapon_trident_net',
    greaves: 'greaves_light_ret',
    manica: 'manica_ret',
  },
  SECUTOR: {
    id: 'SECUTOR',
    name: 'Secutor',
    short: 'Sec',
    color: '#5a6a78',
    helm: 'helm_secutor',
    shield: 'shield_secutor',
    weapon: 'weapon_gladius_sec',
    greaves: 'greaves_secutor',
    manica: 'manica_sec',
  },
  HOPLOMACHUS: {
    id: 'HOPLOMACHUS',
    name: 'Hoplomachus',
    short: 'Hop',
    color: '#7a6a4a',
    helm: 'helm_hoplomachus',
    shield: 'shield_aspis',
    weapon: 'weapon_hasta',
    greaves: 'greaves_hop',
    manica: 'manica_hop',
  },
  PROVOCATOR: {
    id: 'PROVOCATOR',
    name: 'Provocator',
    short: 'Pro',
    color: '#8a7070',
    helm: 'helm_provocator',
    shield: 'shield_provocator',
    weapon: 'weapon_gladius_pro',
    greaves: 'greaves_provocator',
    manica: 'manica_pro',
  },
  DIMACHAERUS: {
    id: 'DIMACHAERUS',
    name: 'Dimachaerus',
    short: 'Dim',
    color: '#8a5a6a',
    helm: 'helm_dimachaerus',
    shield: 'shield_dimachaerus',
    weapon: 'weapon_dual_blades',
    greaves: 'greaves_dim',
    manica: 'manica_dim',
  },
  SCISSOR: {
    id: 'SCISSOR',
    name: 'Scissor',
    short: 'Sci',
    color: '#6a5a4a',
    helm: 'helm_scissor',
    shield: 'shield_scissor',
    weapon: 'weapon_scissor_blade',
    greaves: 'greaves_scissor',
    manica: 'manica_scissor',
  },
};

function applyCombat(target: CombatSlice, patch: Partial<CombatSlice>): void {
  for (const key of Object.keys(patch) as (keyof CombatSlice)[]) {
    const v = patch[key];
    if (v !== undefined) (target as Record<string, number>)[key] = v as number;
  }
}

/**
 * Assemble a runtime kit from part ids (armory will pass arbitrary combinations later).
 * Precedence: KIT_BASE → shape-derived defaults → explicit part overrides.
 * Parts with any explicit combat fields skip derivation entirely, so the tuned
 * stock set is bit-identical; brand-new parts get shape-driven numbers for free.
 */
export function assembleKitFromParts(
  identity: Pick<ArmaturaDef, 'id' | 'name' | 'short' | 'color'>,
  partIds: readonly (KitPartId | null)[],
): ArmaturaDef {
  const combat: CombatSlice = { ...KIT_BASE };
  for (const id of partIds) {
    if (!id) continue;
    const part = KIT_PARTS[id];
    if (!part) throw new Error(`Unknown kit part: ${id}`);
    const explicit = part.combat && Object.keys(part.combat).length > 0;
    if (!explicit) {
      const shape = shapeForPart(id);
      if (shape) applyCombat(combat, deriveCombat(shape));
    }
    applyCombat(combat, part.combat);
  }
  return { ...identity, ...combat };
}

export function assembleLoadout(loadout: KitLoadout): ArmaturaDef {
  return assembleKitFromParts(loadout, [
    loadout.helm,
    loadout.shield,
    loadout.weapon,
    loadout.greaves,
    loadout.manica,
  ]);
}

export function loadoutPartIds(loadout: KitLoadout): KitPartId[] {
  const ids: KitPartId[] = [loadout.helm, loadout.weapon, loadout.greaves, loadout.manica];
  if (loadout.shield) ids.splice(1, 0, loadout.shield);
  return ids;
}
