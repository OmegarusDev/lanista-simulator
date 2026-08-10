import { describe, expect, it } from 'vitest';
import { combatTuning } from '../../content/combat';
import { createQuickMatch } from './match';

describe('Match', () => {
  it('1v1 eventually terminates', () => {
    const m = createQuickMatch(1, 42, ['MURMILLO'], ['THRAEX']);
    const result = m.runToEnd();
    expect(['TEAM0', 'TEAM1', 'DRAW']).toContain(result);
    expect(m.tick).toBeGreaterThan(10);
    expect(m.tick).toBeLessThanOrEqual(combatTuning.maxFightTicks);
  });

  it('2v2 eventually terminates', () => {
    const m = createQuickMatch(
      2,
      99,
      ['MURMILLO', 'RETIARIUS'],
      ['THRAEX', 'THRAEX'],
    );
    const result = m.runToEnd();
    expect(['TEAM0', 'TEAM1', 'DRAW']).toContain(result);
  });

  it('same seed produces same winner', () => {
    const a = createQuickMatch(1, 12345, ['THRAEX'], ['RETIARIUS']).runToEnd();
    const b = createQuickMatch(1, 12345, ['THRAEX'], ['RETIARIUS']).runToEnd();
    expect(a).toBe(b);
  });

  it('seeded fights vary in length or outcome', () => {
    const winners = new Set<string>();
    const lengthBuckets = new Set<number>();
    for (let seed = 1; seed <= 80; seed++) {
      const m = createQuickMatch(1, seed, ['THRAEX'], ['RETIARIUS']);
      winners.add(m.runToEnd());
      lengthBuckets.add(Math.floor(m.tick / 45));
    }
    // Either multiple winners or clearly different bout lengths
    expect(winners.size > 1 || lengthBuckets.size > 2).toBe(true);
  }, 15_000);

  it('3v3 eventually terminates', () => {
    const m = createQuickMatch(
      3,
      77,
      ['MURMILLO', 'RETIARIUS', 'SECUTOR'],
      ['THRAEX', 'HOPLOMACHUS', 'DIMACHAERUS'],
    );
    const result = m.runToEnd();
    expect(['TEAM0', 'TEAM1', 'DRAW']).toContain(result);
  });
});
