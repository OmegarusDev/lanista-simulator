import { ARMATURA_LIST, type ArmaturaId } from '../../content/armatura';
import { economy, GLADIATOR_NAMES } from '../../content/economy';
import {
  GRADE_XP,
  TEMPERAMENT_LIST,
  type GladiatorGrade,
  type TemperamentId,
} from '../../content/rpg';
import type { SeededRNG } from '../rng';
import { createGladiator } from './gladiator';
import type { Gladiator } from './types';

export type FighterRollPolicy = 'lab' | 'market' | 'starter' | 'rival' | 'replacement';

export interface RollFighterOpts {
  policy: FighterRollPolicy;
  id: number;
  /** Force kit (starters / locked slots). */
  armatura?: ArmaturaId;
  name?: string;
  grade?: GladiatorGrade;
  temperament?: TemperamentId;
  /** Starter index for kit cycling. */
  starterIndex?: number;
}

function rollGrade(rng: SeededRNG, policy: FighterRollPolicy): GladiatorGrade {
  const r = rng.next();
  if (policy === 'lab') {
    if (r > 0.88) return 'PRIMUS';
    if (r > 0.45) return 'ORDINARIUS';
    return 'TIRO';
  }
  if (policy === 'market' || policy === 'replacement') {
    if (r > 0.92) return 'PRIMUS';
    if (r > 0.55) return 'ORDINARIUS';
    return 'TIRO';
  }
  if (policy === 'rival') {
    if (r > 0.7) return 'PRIMUS';
    if (r > 0.25) return 'ORDINARIUS';
    return 'TIRO';
  }
  // starter
  return 'TIRO';
}

function rollAge(rng: SeededRNG, policy: FighterRollPolicy, grade: GladiatorGrade): number {
  const base =
    policy === 'starter' || policy === 'replacement'
      ? rng.int(18, 24)
      : policy === 'rival'
        ? rng.int(22, 32)
        : rng.int(19, 28);
  if (grade === 'PRIMUS') return Math.min(38, base + rng.int(2, 6));
  if (grade === 'ORDINARIUS') return Math.min(34, base + rng.int(0, 4));
  return base;
}

function xpForGrade(grade: GladiatorGrade): number {
  return GRADE_XP[grade];
}

/**
 * Shared fighter draft for Instant Match, market, starters, rivals, and auto-replace.
 * Returns a full Gladiator (persist or throw away).
 */
export function rollFighter(rng: SeededRNG, opts: RollFighterOpts): Gladiator {
  const policy = opts.policy;
  const armatura =
    opts.armatura ??
    (policy === 'starter' && opts.starterIndex != null
      ? (economy.starterKits[opts.starterIndex % economy.starterKits.length] as ArmaturaId)
      : (rng.pick([...ARMATURA_LIST]) as ArmaturaId));
  const grade = opts.grade ?? rollGrade(rng, policy);
  const temperament = opts.temperament ?? rng.pick([...TEMPERAMENT_LIST]);
  const name = opts.name ?? rng.pick([...GLADIATOR_NAMES]);
  const age = rollAge(rng, policy, grade);
  const fame =
    policy === 'rival'
      ? grade === 'PRIMUS'
        ? 5
        : grade === 'ORDINARIUS'
          ? 2
          : 0
      : grade === 'PRIMUS'
        ? 4
        : grade === 'ORDINARIUS'
          ? 1
          : 0;

  return createGladiator(opts.id, {
    name,
    armatura,
    grade,
    temperament,
    xp: xpForGrade(grade),
    fame: policy === 'starter' ? 0 : fame,
    age,
    rng,
  });
}

export function gradePriceMul(grade: GladiatorGrade): number {
  if (grade === 'PRIMUS') return 1.55;
  if (grade === 'ORDINARIUS') return 1.2;
  return 1;
}
