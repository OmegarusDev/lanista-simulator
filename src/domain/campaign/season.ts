import { economy, GLADIATOR_NAMES } from '../../content/economy';
import type { ArmaturaId } from '../../content/armatura';
import type { DoctrinaId } from '../../content/rpg';
import { SeededRNG } from '../rng';
import { maybeSpawnContract, tickContracts } from './contracts';
import { applyMedicus } from './facilities';
import { createGladiator, rosterCap } from './gladiator';
import { emptyLegacy, patronageDenariiBonus } from './legacy';
import { resolveAssignments } from './ludusDay';
import { rollMarket } from './market';
import { rollDailyOffers } from './offers';
import type { Gladiator, LegacyState, SeasonState } from './types';

export function createSeason(seed: number, legacy?: LegacyState): SeasonState {
  const leg = legacy ?? emptyLegacy();
  const rng = new SeededRNG(seed);
  const roster: Gladiator[] = [];
  let nextId = 1;
  for (let i = 0; i < economy.startingRosterSize; i++) {
    const kit = economy.starterKits[i % economy.starterKits.length] as ArmaturaId;
    roster.push(
      createGladiator(nextId++, {
        name: GLADIATOR_NAMES[i % GLADIATOR_NAMES.length]!,
        armatura: kit,
        grade: leg.starterGradeBump && i === 0 ? 'ORDINARIUS' : 'TIRO',
        xp: leg.starterGradeBump && i === 0 ? 40 : 0,
        rng,
      }),
    );
  }
  for (const g of roster) {
    if (rng.chance(0.35)) g.name = rng.pick([...GLADIATOR_NAMES]);
  }

  const alumniBonus = Math.min(40, leg.alumni.length * 8);

  const state: SeasonState = {
    seed,
    day: 1,
    denarii: economy.startingDenarii + patronageDenariiBonus(leg) + alumniBonus,
    virtus: economy.startingVirtus,
    restDaysLeft: economy.restDaysPerSeason,
    nextGladiatorId: nextId,
    roster,
    offers: [],
    dayResolved: false,
    record: { wins: 0, losses: 0, draws: 0, forfeits: 0 },
    status: 'ACTIVE',
    lastAftermath: null,
    facilities: [...leg.unlockedFacilities].slice(0, 2),
    market: [],
    contracts: [],
    doctrina: 'ANGLE',
    rivalsBeaten: [],
    retiredNames: [],
    lastSeenAt: Date.now(),
    seasonIndex: leg.seasonsCompleted + 1,
  };
  state.offers = rollDailyOffers(state, new SeededRNG(seed ^ 0x0ff3));
  state.market = rollMarket(state, new SeededRNG(seed ^ 0xabcd));
  maybeSpawnContract(state, rng);
  return state;
}

export function upkeepCost(state: SeasonState): number {
  const active = state.roster.filter((g) => !g.retired);
  const gear = active.reduce((s, g) => s + g.gearGrade, 0);
  return active.length * economy.upkeepPerGladiator + gear * economy.upkeepPerGearGrade;
}

export function isInsolvent(state: SeasonState): boolean {
  return state.denarii < 0 || (state.denarii < upkeepCost(state) && !canFieldAnyBout(state));
}

export function canFieldAnyBout(state: SeasonState): boolean {
  const fit = state.roster.filter(
    (g) => !g.retired && g.injury !== 'SEVERE' && g.hpRatio > 0.15,
  );
  return fit.length >= 1;
}

export function fightableRoster(state: SeasonState): Gladiator[] {
  return state.roster.filter((g) => !g.retired && g.injury !== 'SEVERE' && g.hpRatio > 0.15);
}

/** Bandage shortcut (cheap medicus). */
export function healGladiator(state: SeasonState, id: number): boolean {
  return applyMedicus(state, id, 'BANDAGE');
}

/** Rest day: skip munera, pay upkeep, resolve yard assignments. */
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
  const rng = new SeededRNG(state.seed + state.day * 41);
  const assignNotes = resolveAssignments(state, rng);
  state.lastAftermath = {
    offerName: 'Rest day',
    result: 'DRAW',
    purseDelta: -cost,
    virtusDelta: 0,
    injuries: [],
    notes: ['School rests. Upkeep paid.', ...assignNotes],
  };
  return true;
}

export function endDay(state: SeasonState): boolean {
  if (state.status !== 'ACTIVE') return false;
  if (!state.dayResolved) return false;

  const rng = new SeededRNG(state.seed + state.day * 9973);
  for (const g of state.roster) {
    if (g.retired) continue;
    g.fatigue = Math.max(0, g.fatigue - 1);
    if (g.injury === 'NONE') g.hpRatio = Math.min(1, g.hpRatio + 0.08);
  }

  tickContracts(state);

  if (state.day >= economy.seasonDays) {
    state.status = 'SEASON_END';
    return true;
  }

  state.day += 1;
  state.dayResolved = false;
  state.lastAftermath = null;
  state.offers = rollDailyOffers(state, new SeededRNG(state.seed + state.day * 9973));
  state.market = rollMarket(state, new SeededRNG(state.seed + state.day * 1337));
  maybeSpawnContract(state, rng);

  if (state.denarii < upkeepCost(state) && !canFieldAnyBout(state)) {
    state.status = 'BROKE';
  }
  return true;
}

export function markBrokeIfNeeded(state: SeasonState): void {
  if (state.status !== 'ACTIVE') return;
  if (state.denarii < 0) state.status = 'BROKE';
}

export function setDoctrina(state: SeasonState, d: DoctrinaId): void {
  state.doctrina = d;
}

export function currentRosterCap(state: SeasonState): number {
  return rosterCap(state.facilities);
}
