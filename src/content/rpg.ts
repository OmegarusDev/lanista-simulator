/** Management RPG content — grades, temperaments, gear, facilities, doctrina. */

export type GladiatorGrade = 'TIRO' | 'ORDINARIUS' | 'PRIMUS';

export type TemperamentId = 'FEROX' | 'CAUTUS' | 'HISTRIO' | 'FRAGILIS';

export type DayAssignment = 'NONE' | 'TRAIN' | 'RECOVER' | 'SPAR' | 'REST';

export type GearGrade = 0 | 1 | 2;

export type FacilityId = 'INFIRMARY' | 'PALAESTRA' | 'ARMAMENTARIUM' | 'BARRACKS';

export type DoctrinaId = 'PRESS' | 'YIELD' | 'ANGLE';

export type MedicusTier = 'BANDAGE' | 'PHYSICIAN';

export const GRADE_ORDER: GladiatorGrade[] = ['TIRO', 'ORDINARIUS', 'PRIMUS'];

export const GRADE_XP: Record<GladiatorGrade, number> = {
  TIRO: 0,
  ORDINARIUS: 40,
  PRIMUS: 100,
};

export const GRADE_LABEL: Record<GladiatorGrade, string> = {
  TIRO: 'Tiro',
  ORDINARIUS: 'Ordinarius',
  PRIMUS: 'Primus palus',
};

export const TEMPERAMENTS: Record<
  TemperamentId,
  {
    id: TemperamentId;
    name: string;
    pursueBiasAdd: number;
    clinchPanicAdd: number;
    circleArcAdd: number;
  }
> = {
  FEROX: {
    id: 'FEROX',
    name: 'Ferox',
    pursueBiasAdd: 0.18,
    clinchPanicAdd: -0.08,
    circleArcAdd: 0,
  },
  CAUTUS: {
    id: 'CAUTUS',
    name: 'Cautus',
    pursueBiasAdd: -0.12,
    clinchPanicAdd: 0.14,
    circleArcAdd: 0.04,
  },
  HISTRIO: {
    id: 'HISTRIO',
    name: 'Histrio',
    pursueBiasAdd: 0.04,
    clinchPanicAdd: 0.06,
    circleArcAdd: 0.1,
  },
  FRAGILIS: {
    id: 'FRAGILIS',
    name: 'Fragilis',
    pursueBiasAdd: -0.06,
    clinchPanicAdd: 0.1,
    circleArcAdd: -0.02,
  },
};

export const TEMPERAMENT_LIST = Object.keys(TEMPERAMENTS) as TemperamentId[];

/** Combat pool multipliers by grade (on top of class kit). */
export const GRADE_COMBAT: Record<
  GladiatorGrade,
  { hp: number; stamina: number; poise: number; damage: number }
> = {
  TIRO: { hp: 0.94, stamina: 0.95, poise: 0.92, damage: 0.96 },
  ORDINARIUS: { hp: 1.0, stamina: 1.0, poise: 1.0, damage: 1.0 },
  PRIMUS: { hp: 1.08, stamina: 1.06, poise: 1.1, damage: 1.08 },
};

export const GEAR_LABEL: Record<GearGrade, string> = {
  0: 'Common kit',
  1: 'School kit',
  2: 'Parade kit',
};

export const GEAR_COMBAT: Record<
  GearGrade,
  { damage: number; poise: number; staminaCost: number }
> = {
  0: { damage: 1, poise: 1, staminaCost: 1 },
  1: { damage: 1.06, poise: 1.05, staminaCost: 0.96 },
  2: { damage: 1.12, poise: 1.1, staminaCost: 0.92 },
};

export const GEAR_UPGRADE_COST: Record<1 | 2, number> = {
  1: 45,
  2: 90,
};

export const FACILITIES: Record<
  FacilityId,
  { id: FacilityId; name: string; cost: number; virtusReq: number; blurb: string }
> = {
  INFIRMARY: {
    id: 'INFIRMARY',
    name: 'Infirmary',
    cost: 80,
    virtusReq: 0,
    blurb: 'Cheaper medicus, kinder wounds.',
  },
  PALAESTRA: {
    id: 'PALAESTRA',
    name: 'Palaestra',
    cost: 70,
    virtusReq: 0,
    blurb: 'Safer, surer training.',
  },
  ARMAMENTARIUM: {
    id: 'ARMAMENTARIUM',
    name: 'Armamentarium',
    cost: 100,
    virtusReq: 8,
    blurb: 'Unlock school & parade kits.',
  },
  BARRACKS: {
    id: 'BARRACKS',
    name: 'Barracks',
    cost: 90,
    virtusReq: 0,
    blurb: 'Room for two more bodies.',
  },
};

export const DOCTRINA: Record<
  DoctrinaId,
  { id: DoctrinaId; name: string; blurb: string; pursueBiasAdd: number; clinchPanicAdd: number }
> = {
  PRESS: {
    id: 'PRESS',
    name: 'Press',
    blurb: 'Close and punish.',
    pursueBiasAdd: 0.12,
    clinchPanicAdd: -0.06,
  },
  YIELD: {
    id: 'YIELD',
    name: 'Yield',
    blurb: 'Give ground, catch them long.',
    pursueBiasAdd: -0.1,
    clinchPanicAdd: 0.1,
  },
  ANGLE: {
    id: 'ANGLE',
    name: 'Angle',
    blurb: 'Circle for the cut.',
    pursueBiasAdd: 0,
    clinchPanicAdd: 0.04,
  },
};

export const DOCTRINA_LIST = Object.keys(DOCTRINA) as DoctrinaId[];

export const MEDICUS: Record<
  MedicusTier,
  { id: MedicusTier; name: string; cost: number; hp: number; fatigue: number; injurySteps: number }
> = {
  BANDAGE: { id: 'BANDAGE', name: 'Bandage', cost: 12, hp: 0.25, fatigue: 0, injurySteps: 1 },
  PHYSICIAN: {
    id: 'PHYSICIAN',
    name: 'Physician',
    cost: 28,
    hp: 0.45,
    fatigue: 1,
    injurySteps: 1,
  },
};

export const RIVAL_NAMES = [
  'Ludus Aureus',
  'Familia Neronis',
  'Schola Capuana',
  'Lanista Varro',
  'House of the Trident',
] as const;

export const LOCATION_FLAVOR = [
  'Forum sands',
  'Noon games',
  'Suburban amphitheatre',
  'Private banquet bout',
  'Provincial tour',
  'Capua school yard',
] as const;

export function gradeFromXp(xp: number): GladiatorGrade {
  if (xp >= GRADE_XP.PRIMUS) return 'PRIMUS';
  if (xp >= GRADE_XP.ORDINARIUS) return 'ORDINARIUS';
  return 'TIRO';
}

export function masteryBonus(mastery: number): {
  hp: number;
  stamina: number;
  poise: number;
  damage: number;
} {
  const t = Math.min(1, mastery / 80);
  return {
    hp: 1 + t * 0.04,
    stamina: 1 + t * 0.05,
    poise: 1 + t * 0.04,
    damage: 1 + t * 0.03,
  };
}
