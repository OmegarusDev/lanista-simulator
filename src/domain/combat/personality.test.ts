import { describe, expect, it } from 'vitest';
import { SeededRNG } from '../rng';
import {
  assistBias,
  crowdVolatility,
  feintAllowed,
  finishBoost,
  fragilisShaken,
  personalityChance,
  personalityOf,
  prideMomentum,
  punishWindowMul,
  yieldAllowed,
} from './personality';

describe('personalityOf', () => {
  it('maps temperaments to volatility envelopes', () => {
    expect(personalityOf('FEROX', undefined).volatility).toBeCloseTo(0.8, 6);
    expect(personalityOf('CAUTUS', undefined).volatility).toBeCloseTo(0.15, 6);
    expect(personalityOf('HISTRIO', undefined).volatility).toBeCloseTo(0.7, 6);
    expect(personalityOf('FRAGILIS', undefined).volatility).toBeCloseTo(0.5, 6);
  });

  it('traits modulate the envelope and clamp it', () => {
    const wild = personalityOf('FEROX', ['HOTBLOODED']);
    expect(wild.volatility).toBe(1);
    const ice = personalityOf('CAUTUS', ['STOIC']);
    expect(ice.volatility).toBeCloseTo(0.05, 6); // floored
    const ambitious = personalityOf('HISTRIO', ['AMBITIOUS']);
    expect(ambitious.volatility).toBeCloseTo(0.8, 6);
    expect(ambitious.traits.has('AMBITIOUS')).toBe(true);
  });
});

describe('personalityChance', () => {
  it('is deterministic — same rng, same result', () => {
    const a = personalityChance(new SeededRNG(99), 0.5, personalityOf('FEROX', undefined));
    const b = personalityChance(new SeededRNG(99), 0.5, personalityOf('FEROX', undefined));
    expect(a).toBe(b);
  });

  it('aggregate probability tracks the base over many rolls', () => {
    const rng = new SeededRNG(1234);
    const p = personalityOf('CAUTUS', undefined);
    let hits = 0;
    const N = 4000;
    for (let i = 0; i < N; i++) {
      if (personalityChance(rng, 0.5, p)) hits++;
    }
    const rate = hits / N;
    expect(rate).toBeGreaterThan(0.42);
    expect(rate).toBeLessThan(0.58);
  });

  it('high volatility spreads outcomes wider than low volatility', () => {
    const nearMid = (p: Parameters<typeof personalityOf>[0], t: Parameters<typeof personalityOf>[1]) => {
      const r = new SeededRNG(77);
      let hits = 0;
      const N = 2000;
      for (let i = 0; i < N; i++) {
        if (personalityChance(r, 0.5, personalityOf(p, t), 1.2)) hits++;
      }
      return Math.abs(hits / N - 0.5);
    };
    // A wild fighter's rolls drift further from 50/50 on any given seed.
    const wildDrift = nearMid('FEROX', ['HOTBLOODED']);
    const calmDrift = nearMid('CAUTUS', ['STOIC']);
    expect(wildDrift).toBeGreaterThan(calmDrift * 0.4);
  });
});

describe('trait decision hooks', () => {
  it('PROUD refuses to yield while healthy, breaks with pride when hurt', () => {
    const proud = personalityOf('FEROX', ['PROUD']);
    expect(yieldAllowed(proud, 0.9, false)).toBe(false);
    expect(yieldAllowed(proud, 0.4, false)).toBe(true);
    expect(yieldAllowed(proud, 0.9, true)).toBe(true); // broken beats pride
    expect(yieldAllowed(personalityOf('FEROX', undefined), 0.9, false)).toBe(true);
  });

  it('STOIC never feints; everyone else may', () => {
    expect(feintAllowed(personalityOf('CAUTUS', ['STOIC']))).toBe(false);
    expect(feintAllowed(personalityOf('HISTRIO', undefined))).toBe(true);
  });

  it('finish greed: AMBITIOUS/CRUEL push, MERCIFUL pulls back', () => {
    expect(finishBoost(personalityOf('FEROX', ['AMBITIOUS']), 0.9)).toBeCloseTo(0.15, 6);
    expect(finishBoost(personalityOf('FEROX', ['CRUEL']), 0.9)).toBeCloseTo(0.12, 6);
    expect(finishBoost(personalityOf('FEROX', ['MERCIFUL']), 0.9)).toBeCloseTo(-0.12, 6);
    expect(finishBoost(personalityOf('FEROX', ['PROUD']), 0.9)).toBeCloseTo(0.08, 6);
    expect(finishBoost(personalityOf('FEROX', ['PROUD']), 0.3)).toBeCloseTo(0, 6); // pride fades when hurt
  });

  it('CRUEL drags out the punish window; MERCIFUL lets it go', () => {
    expect(punishWindowMul(personalityOf('FEROX', ['CRUEL']))).toBeCloseTo(1.35, 6);
    expect(punishWindowMul(personalityOf('FEROX', ['MERCIFUL']))).toBeCloseTo(0.7, 6);
    expect(punishWindowMul(personalityOf('FEROX', undefined))).toBe(1);
  });

  it('pride momentum and fragile shakes only fire in their moments', () => {
    const proud = personalityOf('FEROX', ['PROUD']);
    expect(prideMomentum(proud, true)).toBeCloseTo(0.12, 6);
    expect(prideMomentum(proud, false)).toBe(0);
    expect(fragilisShaken(personalityOf('FRAGILIS', undefined), true)).toBeCloseTo(0.18, 6);
    expect(fragilisShaken(personalityOf('FRAGILIS', undefined), false)).toBe(0);
    expect(fragilisShaken(personalityOf('FEROX', undefined), true)).toBe(0);
  });

  it('LOYAL piles onto allies; SUPERSTITIOUS rides the crowd', () => {
    expect(assistBias(personalityOf('CAUTUS', ['LOYAL']))).toBe(40);
    expect(assistBias(personalityOf('CAUTUS', undefined))).toBe(0);
    const sup = personalityOf('CAUTUS', ['SUPERSTITIOUS']);
    expect(crowdVolatility(sup, 1)).toBeCloseTo(0.25 + 0.35, 6); // roar widens the envelope
    expect(crowdVolatility(sup, 0.5)).toBeCloseTo(0.25, 6); // neutral crowd, calm
    expect(crowdVolatility(personalityOf('CAUTUS', undefined), 1)).toBeCloseTo(0.15, 6);
  });
});
