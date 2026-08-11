import { economy } from '../../content/economy';
import { TRAITS } from '../../content/identity';
import {
  DOCTRINA,
  GEAR_COMBAT,
  GRADE_COMBAT,
  masteryBonus,
  TEMPERAMENTS,
  type DoctrinaId,
} from '../../content/rpg';
import type { FighterSpawnSpec } from '../combat/types';
import type { FightOrders, Gladiator } from './types';
import { injuryCombatMods } from './injury';
import { moraleCombatMods } from './morale';

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

export function ageCombatMul(age: number): { pools: number; damage: number; caution: number } {
  const { agePeakMin, agePeakMax } = economy;
  if (age < agePeakMin) {
    const t = (agePeakMin - age) / 8;
    return { pools: 1 - 0.06 * t, damage: 1 - 0.04 * t, caution: 0.04 * t };
  }
  if (age > agePeakMax) {
    const t = Math.min(1, (age - agePeakMax) / 10);
    return { pools: 1 - 0.12 * t, damage: 1 - 0.1 * t, caution: 0.1 * t };
  }
  return { pools: 1, damage: 1, caution: 0 };
}

function stanceMods(orders?: FightOrders): { pursue: number; clinch: number } {
  if (!orders) return { pursue: 0, clinch: 0 };
  if (orders.stance === 'AGGRESSIVE') return { pursue: 0.12, clinch: -0.08 };
  if (orders.stance === 'CAUTIOUS') return { pursue: -0.12, clinch: 0.12 };
  return { pursue: 0, clinch: 0 };
}

/**
 * Build bout spawn modifiers from a career gladiator + optional school doctrina / orders.
 */
export function spawnSpecFromGladiator(
  g: Gladiator,
  doctrina: DoctrinaId = 'ANGLE',
  orders?: FightOrders,
): FighterSpawnSpec {
  const grade = GRADE_COMBAT[g.grade];
  const gear = GEAR_COMBAT[g.gearGrade];
  const mast = masteryBonus(g.mastery);
  const temp = TEMPERAMENTS[g.temperament];
  const doc = DOCTRINA[doctrina];
  const ageMul = ageCombatMul(g.age ?? 22);
  const inj = injuryCombatMods(g.injuries ?? []);
  const mood = moraleCombatMods(g);
  const stance = stanceMods(orders);

  const fatiguePen = Math.min(0.18, g.fatigue * 0.04);
  const condMul = Math.max(0.55, inj.pools * mood.pools * (1 - fatiguePen));

  const gritMul = 0.92 + (g.grit ?? 1) * 0.08;
  const hpMul = grade.hp * mast.hp * condMul * ageMul.pools;
  const staminaMul =
    grade.stamina * mast.stamina * Math.max(0.6, 1 - fatiguePen * 1.2) * ageMul.pools;
  const poiseMul =
    grade.poise * mast.poise * gear.poise * gritMul * ageMul.pools * inj.pools;
  const damageMul = grade.damage * mast.damage * gear.damage * ageMul.damage * inj.damage;

  let pursue = temp.pursueBiasAdd + doc.pursueBiasAdd + mood.pursueBiasAdd + stance.pursue;
  let clinch =
    temp.clinchPanicAdd + doc.clinchPanicAdd + ageMul.caution + inj.caution + mood.clinchPanicAdd + stance.clinch;

  for (const t of g.traits ?? []) {
    const tr = TRAITS[t];
    pursue += tr.pursueBiasAdd;
    clinch += tr.clinchPanicAdd;
  }

  if (g.fatigue >= 2) clinch += 0.08;
  const vit = Math.min(g.hpRatio, g.vitality ?? g.hpRatio);
  if (vit < 0.55) {
    pursue -= 0.06;
    clinch += 0.06;
  }
  pursue += inj.measureErr * -0.15;

  return {
    armatura: g.armatura,
    name: g.name,
    appearanceSeed: g.appearanceSeed,
    partsOverride: g.partsOverride?.length ? [...g.partsOverride] : undefined,
    hpMul,
    staminaMul,
    poiseMul,
    damageMul,
    attackStaminaMul: gear.staminaCost,
    pursueBiasAdd: pursue,
    clinchPanicAdd: clinch,
    circleArcAdd: temp.circleArcAdd + (doc.id === 'ANGLE' ? 0.06 : 0) + inj.measureErr * 0.05,
    startHpRatio: clamp01(vit * (g.injury === 'LIGHT' ? 0.92 : g.injury === 'SEVERE' ? 0.8 : 1)),
  };
}

export function spawnSpecsFromLineup(
  roster: Gladiator[],
  lineupIds: number[],
  doctrina: DoctrinaId = 'ANGLE',
  orders?: FightOrders,
): FighterSpawnSpec[] {
  return lineupIds.map((id) => {
    const g = roster.find((x) => x.id === id);
    if (!g) return { armatura: 'MURMILLO' as const, name: '?' };
    return spawnSpecFromGladiator(g, doctrina, orders);
  });
}
