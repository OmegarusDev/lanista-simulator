import type { ArmaturaId } from '../../content/armatura';
import { economy, GLADIATOR_NAMES } from '../../content/economy';
import {
  ORIGIN_LIST,
  TRAIT_LIST,
  type OriginId,
  type TraitId,
} from '../../content/identity';
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
    age?: number;
    rng?: SeededRNG;
    origin?: OriginId;
    traits?: TraitId[];
    appearanceSeed?: number;
    morale?: number;
    confidence?: number;
    constitution?: number;
    showmanship?: number;
    grit?: number;
  },
): Gladiator {
  const xp = opts.xp ?? (opts.grade === 'PRIMUS' ? 100 : opts.grade === 'ORDINARIUS' ? 40 : 0);
  const grade = opts.grade ?? gradeFromXp(xp);
  const rng = opts.rng;
  const temperament =
    opts.temperament ??
    (rng ? rng.pick([...TEMPERAMENT_LIST]) : TEMPERAMENT_LIST[id % TEMPERAMENT_LIST.length]!);
  const name =
    opts.name ??
    (rng ? rng.pick([...GLADIATOR_NAMES]) : GLADIATOR_NAMES[id % GLADIATOR_NAMES.length]!);
  const origin =
    opts.origin ?? (rng ? rng.pick([...ORIGIN_LIST]) : ORIGIN_LIST[id % ORIGIN_LIST.length]!);
  const traits =
    opts.traits ??
    (rng
      ? pickTraits(rng)
      : [TRAIT_LIST[id % TRAIT_LIST.length]!, TRAIT_LIST[(id + 3) % TRAIT_LIST.length]!]);
  const vitality = opts.hpRatio ?? 1;
  const appearanceSeed = opts.appearanceSeed ?? (rng ? rng.int(1, 1e9) : id * 9973);
  return {
    id,
    name,
    armatura: opts.armatura,
    hpRatio: vitality,
    vitality,
    injury: opts.injury ?? 'NONE',
    injuries: [],
    fatigue: opts.fatigue ?? 0,
    wins: 0,
    losses: 0,
    xp,
    grade,
    temperament,
    traits,
    origin,
    appearanceSeed,
    history: [{ day: 0, text: `Joined the ludus from ${origin}.` }],
    morale: opts.morale ?? 55,
    confidence: opts.confidence ?? 50,
    constitution: opts.constitution ?? (rng ? 0.85 + rng.next() * 0.3 : 1),
    showmanship: opts.showmanship ?? (rng ? 0.85 + rng.next() * 0.3 : 1),
    grit: opts.grit ?? (rng ? 0.85 + rng.next() * 0.3 : 1),
    fame: opts.fame ?? 0,
    mastery: opts.mastery ?? (grade === 'TIRO' ? 0 : grade === 'ORDINARIUS' ? 20 : 40),
    gearGrade: opts.gearGrade ?? 0,
    assignment: 'NONE',
    age: opts.age ?? 22,
  };
}

function pickTraits(rng: SeededRNG): TraitId[] {
  const a = rng.pick([...TRAIT_LIST]);
  let b = rng.pick([...TRAIT_LIST]);
  let guard = 0;
  while (b === a && guard++ < 8) b = rng.pick([...TRAIT_LIST]);
  return [a, b];
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

export function pushHistory(g: Gladiator, day: number, text: string): void {
  g.history.push({ day, text });
  if (g.history.length > 24) g.history.splice(0, g.history.length - 24);
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
