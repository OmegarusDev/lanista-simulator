import { economy, GLADIATOR_NAMES } from '../../content/economy';
import type { ArmaturaId } from '../../content/armatura';
import { SeededRNG } from '../rng';
import { rollDailyOffers } from './offers';
import type { Gladiator, SeasonState } from './types';

export function createSeason(seed: number): SeasonState {
  const rng = new SeededRNG(seed);
  const roster: Gladiator[] = [];
  let nextId = 1;
  for (let i = 0; i < economy.startingRosterSize; i++) {
    const kit = economy.starterKits[i % economy.starterKits.length] as ArmaturaId;
    roster.push({
      id: nextId++,
      name: GLADIATOR_NAMES[i % GLADIATOR_NAMES.length]!,
      armatura: kit,
      hpRatio: 1,
      injury: 'NONE',
      fatigue: 0,
      wins: 0,
      losses: 0,
    });
  }
  // Shuffle names slightly via rng draws
  for (const g of roster) {
    if (rng.chance(0.35)) {
      g.name = rng.pick([...GLADIATOR_NAMES]);
    }
  }

  const state: SeasonState = {
    seed,
    day: 1,
    denarii: economy.startingDenarii,
    virtus: economy.startingVirtus,
    restDaysLeft: economy.restDaysPerSeason,
    nextGladiatorId: nextId,
    roster,
    offers: [],
    dayResolved: false,
    record: { wins: 0, losses: 0, draws: 0, forfeits: 0 },
    status: 'ACTIVE',
    lastAftermath: null,
  };
  state.offers = rollDailyOffers(state, new SeededRNG(seed ^ 0x0ff3));
  return state;
}

export function upkeepCost(state: SeasonState): number {
  return state.roster.length * economy.upkeepPerGladiator;
}

export function isInsolvent(state: SeasonState): boolean {
  return state.denarii < 0 || (state.denarii < upkeepCost(state) && !canFieldAnyBout(state));
}

export function canFieldAnyBout(state: SeasonState): boolean {
  const fit = state.roster.filter((g) => g.injury !== 'SEVERE' && g.hpRatio > 0.15);
  return fit.length >= 1;
}

export function fightableRoster(state: SeasonState): Gladiator[] {
  return state.roster.filter((g) => g.injury !== 'SEVERE' && g.hpRatio > 0.15);
}

export function healGladiator(state: SeasonState, id: number): boolean {
  if (state.status !== 'ACTIVE') return false;
  const g = state.roster.find((x) => x.id === id);
  if (!g) return false;
  if (g.injury === 'NONE' && g.hpRatio >= 0.99) return false;
  if (state.denarii < economy.healCost) return false;
  state.denarii -= economy.healCost;
  g.hpRatio = Math.min(1, g.hpRatio + 0.45);
  if (g.injury === 'SEVERE') g.injury = 'LIGHT';
  else if (g.injury === 'LIGHT') g.injury = 'NONE';
  g.fatigue = Math.max(0, g.fatigue - 1);
  return true;
}

/** Rest day: skip munera, pay upkeep, refresh offers next day. */
export function takeRestDay(state: SeasonState): boolean {
  if (state.status !== 'ACTIVE') return false;
  if (state.dayResolved) return false;
  if (state.restDaysLeft <= 0) return false;
  const cost = upkeepCost(state);
  if (state.denarii < cost) {
    state.status = 'BROKE';
    return false;
  }
  state.denarii -= cost;
  state.restDaysLeft -= 1;
  state.dayResolved = true;
  state.lastAftermath = {
    offerName: 'Rest day',
    result: 'DRAW',
    purseDelta: -cost,
    virtusDelta: 0,
    injuries: [],
    notes: ['School rests. Upkeep paid.'],
  };
  return true;
}

export function endDay(state: SeasonState): boolean {
  if (state.status !== 'ACTIVE') return false;
  if (!state.dayResolved) return false;

  // Natural recovery tick
  for (const g of state.roster) {
    g.fatigue = Math.max(0, g.fatigue - 1);
    if (g.injury === 'NONE') g.hpRatio = Math.min(1, g.hpRatio + 0.08);
  }

  if (state.day >= economy.seasonDays) {
    state.status = 'SEASON_END';
    return true;
  }

  state.day += 1;
  state.dayResolved = false;
  state.lastAftermath = null;
  state.offers = rollDailyOffers(state, new SeededRNG(state.seed + state.day * 9973));

  if (state.denarii < upkeepCost(state) && !canFieldAnyBout(state)) {
    state.status = 'BROKE';
  }
  return true;
}

export function markBrokeIfNeeded(state: SeasonState): void {
  if (state.status !== 'ACTIVE') return;
  if (state.denarii < 0) state.status = 'BROKE';
}
