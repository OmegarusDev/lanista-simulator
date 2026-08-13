import { describe, expect, it } from 'vitest';
import { economy } from '../../content/economy';
import { SeededRNG } from '../rng';
import { rollDailyOffers } from './offers';
import { createSeason } from './season';

describe('rollDailyOffers', () => {
  it('deals a Grand Munus capstone on the final day', () => {
    const state = createSeason(42);
    state.day = economy.seasonDays;
    const offers = rollDailyOffers(state, new SeededRNG(1));
    expect(offers[0]!.name).toMatch(/^Grand Munus/);
    expect(offers[0]!.eventRole).toBe('championship');
    expect(offers[0]!.rivalName).toBeTruthy();
    expect(offers[0]!.eligible).toBe(true);
  });

  it('does not deal the capstone on ordinary days', () => {
    const state = createSeason(42);
    state.day = 5;
    const offers = rollDailyOffers(state, new SeededRNG(1));
    expect(offers.some((o) => o.name.startsWith('Grand Munus'))).toBe(false);
  });

  it('capstone is fieldable by the roster that spawned it', () => {
    const state = createSeason(7);
    state.day = economy.seasonDays;
    const offers = rollDailyOffers(state, new SeededRNG(3));
    const cap = offers[0]!;
    const hasFit = state.roster.some(
      (g) =>
        !g.retired &&
        g.injury !== 'SEVERE' &&
        cap.playerSlots[0]!.anyOf.includes(g.armatura),
    );
    expect(hasFit).toBe(true);
  });
});
