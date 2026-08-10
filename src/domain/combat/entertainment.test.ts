import { describe, expect, it } from 'vitest';
import { EntertainmentTracker, missioSpareChance, rollMissio } from './entertainment';
import { SeededRNG } from '../rng';

describe('entertainment / missio', () => {
  it('scores spectacle events and decays passive time', () => {
    const t = new EntertainmentTracker();
    t.watch([1, 2]);
    t.onEvents(
      [
        {
          kind: 'HIT',
          tick: 10,
          actorId: 1,
          targetId: 2,
          x: 0,
          y: 0,
        },
        {
          kind: 'POISE_BREAK',
          tick: 11,
          actorId: 1,
          targetId: 2,
          x: 0,
          y: 0,
        },
      ],
      11,
      new SeededRNG(1),
    );
    expect(t.score(1)).toBeGreaterThan(20);
    for (let i = 0; i < 120; i++) t.tickPassive([2]);
    expect(t.score(2)).toBeLessThan(5);
  });

  it('spares more often when entertainment is high', () => {
    const low = missioSpareChance(5, 0);
    const high = missioSpareChance(80, 4);
    expect(high).toBeGreaterThan(low);
    const rng = new SeededRNG(42);
    let spares = 0;
    for (let i = 0; i < 40; i++) {
      if (rollMissio(90, 5, rng).outcome === 'SPARE') spares++;
    }
    expect(spares).toBeGreaterThan(20);
  });
});
