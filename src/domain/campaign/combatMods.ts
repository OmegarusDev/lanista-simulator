import {
  DOCTRINA,
  GEAR_COMBAT,
  GRADE_COMBAT,
  masteryBonus,
  TEMPERAMENTS,
  type DoctrinaId,
} from '../../content/rpg';
import type { FighterSpawnSpec } from '../combat/types';
import type { Gladiator } from './types';

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

/**
 * Build bout spawn modifiers from a career gladiator + optional school doctrina.
 * Condition (hp/injury/fatigue) scales starting pools and slight AI caution.
 */
export function spawnSpecFromGladiator(
  g: Gladiator,
  doctrina: DoctrinaId = 'ANGLE',
): FighterSpawnSpec {
  const grade = GRADE_COMBAT[g.grade];
  const gear = GEAR_COMBAT[g.gearGrade];
  const mast = masteryBonus(g.mastery);
  const temp = TEMPERAMENTS[g.temperament];
  const doc = DOCTRINA[doctrina];

  const fatiguePen = Math.min(0.18, g.fatigue * 0.04);
  const injuryPen = g.injury === 'SEVERE' ? 0.22 : g.injury === 'LIGHT' ? 0.1 : 0;
  const condMul = Math.max(0.55, 1 - fatiguePen - injuryPen);

  const hpMul = grade.hp * mast.hp * condMul;
  const staminaMul = grade.stamina * mast.stamina * Math.max(0.6, 1 - fatiguePen * 1.2);
  const poiseMul = grade.poise * mast.poise * gear.poise * Math.max(0.65, 1 - injuryPen);
  const damageMul = grade.damage * mast.damage * gear.damage;

  let pursue = temp.pursueBiasAdd + doc.pursueBiasAdd;
  let clinch = temp.clinchPanicAdd + doc.clinchPanicAdd;
  if (g.injury !== 'NONE' || g.fatigue >= 2) clinch += 0.08;
  if (g.hpRatio < 0.55) {
    pursue -= 0.06;
    clinch += 0.06;
  }

  return {
    armatura: g.armatura,
    name: g.name,
    hpMul,
    staminaMul,
    poiseMul,
    damageMul,
    attackStaminaMul: gear.staminaCost,
    pursueBiasAdd: pursue,
    clinchPanicAdd: clinch,
    circleArcAdd: temp.circleArcAdd + (doc.id === 'ANGLE' ? 0.06 : 0),
    startHpRatio: clamp01(g.hpRatio * (g.injury === 'LIGHT' ? 0.92 : 1)),
  };
}

export function spawnSpecsFromLineup(
  roster: Gladiator[],
  lineupIds: number[],
  doctrina: DoctrinaId,
): FighterSpawnSpec[] {
  return lineupIds.map((id) => {
    const g = roster.find((x) => x.id === id);
    if (!g) {
      return { armatura: 'MURMILLO', name: 'Unknown' };
    }
    return spawnSpecFromGladiator(g, doctrina);
  });
}
