import type { ArmaturaId } from '../../content/armatura';
import { economy, GLADIATOR_NAMES } from '../../content/economy';
import {
  gradeFromXp,
  TEMPERAMENT_LIST,
  type DayAssignment,
  type GearGrade,
  type GladiatorGrade,
  type TemperamentId,
} from '../../content/rpg';
import type { SeededRNG } from '../rng';
import type { Gladiator, InjuryTier } from './types';

export function createGladiator(
  id: number,
  opts: {
    name?: string;
    armatura: ArmaturaId;
    grade?: GladiatorGrade;
    temperament?: TemperamentId;
    xp?: number;
    fame?: number;
    mastery?: number;
    gearGrade?: GearGrade;
    hpRatio?: number;
    injury?: InjuryTier;
    fatigue?: number;
    rng?: SeededRNG;
  },
): Gladiator {
  const xp = opts.xp ?? (opts.grade === 'PRIMUS' ? 100 : opts.grade === 'ORDINARIUS' ? 40 : 0);
  const grade = opts.grade ?? gradeFromXp(xp);
  const temperament =
    opts.temperament ??
    (opts.rng ? opts.rng.pick([...TEMPERAMENT_LIST]) : TEMPERAMENT_LIST[id % TEMPERAMENT_LIST.length]!);
  const name =
    opts.name ??
    (opts.rng ? opts.rng.pick([...GLADIATOR_NAMES]) : GLADIATOR_NAMES[id % GLADIATOR_NAMES.length]!);
  return {
    id,
    name,
    armatura: opts.armatura,
    hpRatio: opts.hpRatio ?? 1,
    injury: opts.injury ?? 'NONE',
    fatigue: opts.fatigue ?? 0,
    wins: 0,
    losses: 0,
    xp,
    grade,
    temperament,
    fame: opts.fame ?? 0,
    mastery: opts.mastery ?? (grade === 'TIRO' ? 0 : grade === 'ORDINARIUS' ? 20 : 40),
    gearGrade: opts.gearGrade ?? 0,
    assignment: 'NONE',
  };
}

export function syncGrade(g: Gladiator): void {
  g.grade = gradeFromXp(g.xp);
}

export function addXp(g: Gladiator, amount: number): { leveled: boolean; grade: GladiatorGrade } {
  const before = g.grade;
  g.xp += amount;
  syncGrade(g);
  return { leveled: g.grade !== before, grade: g.grade };
}

export function rosterCap(facilities: string[]): number {
  const barracks = facilities.includes('BARRACKS');
  return Math.min(
    economy.maxRosterHard,
    economy.baseRosterCap + (barracks ? economy.barracksBonus : 0),
  );
}

export function activeRoster(roster: Gladiator[]): Gladiator[] {
  return roster.filter((g) => !g.retired);
}

export function setAssignment(g: Gladiator, a: DayAssignment): void {
  g.assignment = a;
}
