import { describe, expect, it } from 'vitest';
import { economy } from '../../content/economy';
import { applyCareerFight } from './aftermath';
import { createSeason, endDay, healGladiator, takeRestDay, upkeepCost } from './season';

describe('campaign season', () => {
  it('creates a seeded roster and daily offers', () => {
    const a = createSeason(42);
    const b = createSeason(42);
    expect(a.roster.length).toBe(economy.startingRosterSize);
    expect(a.offers.length).toBeGreaterThan(0);
    expect(a.slate.length).toBeGreaterThan(0);
    expect(a.roster.every((g) => g.age >= 18)).toBe(true);
    expect(a.roster.map((g) => g.armatura)).toEqual(b.roster.map((g) => g.armatura));
  });

  it('applies win purse and marks day resolved', () => {
    const s = createSeason(7);
    // Isolate purse math from off-screen slate sims
    s.slate = [];
    const offer = s.offers[0]!;
    const before = s.denarii;
    const lineup = [s.roster[0]!.id];
    applyCareerFight(s, {
      offer,
      lineupIds: lineup,
      result: 'TEAM0',
      forfeited: false,
    });
    expect(s.dayResolved).toBe(true);
    expect(s.record.wins).toBe(1);
    expect(s.denarii).toBe(before - offer.entryFee + offer.purse - upkeepCost(s));
  });

  it('advances day and ends season at cap', () => {
    const s = createSeason(99);
    s.day = economy.seasonDays;
    s.dayResolved = true;
    endDay(s);
    expect(s.status).toBe('SEASON_END');
  });

  it('heals and rests within economy rules', () => {
    const s = createSeason(3);
    const g = s.roster[0]!;
    g.injury = 'LIGHT';
    g.hpRatio = 0.5;
    expect(healGladiator(s, g.id)).toBe(true);
    expect(g.injury).toBe('NONE');
    expect(takeRestDay(s)).toBe(true);
    expect(s.dayResolved).toBe(true);
    expect(s.restDaysLeft).toBe(economy.restDaysPerSeason - 1);
  });
});
