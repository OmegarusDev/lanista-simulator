import { describe, expect, it } from 'vitest';
import { createSeason } from './season';
import { tickContracts } from './contracts';
import { resolveAssignments } from './ludusDay';
import { syncInjuryTier } from './injury';
import { SeededRNG } from '../rng';

describe('contracts', () => {
  it('fail exactly when their days run out — not one day late', () => {
    const s = createSeason(7);
    s.contracts.push({
      id: 'c1',
      name: 'Three Days',
      blurb: '',
      daysLeft: 3,
      virtusBonus: 2,
      denariiBonus: 50,
      completed: false,
      failed: false,
      requireWin: false,
      rivalName: null,
    });
    tickContracts(s);
    tickContracts(s);
    expect(s.contracts[0]!.failed).toBe(false);
    tickContracts(s); // third day closes — deadline is done
    expect(s.contracts[0]!.failed).toBe(true);
    expect(s.virtus).toBe(0); // penalty 2 clamped
  });
});

describe('assignments keep the injury tier and array in sync', () => {
  it('TRAIN overtraining writes a real injury the medicus can treat', () => {
    const s = createSeason(11);
    const g = s.roster[0]!;
    let notes: string[] = [];
    for (let i = 0; i < 50; i++) {
      g.assignment = 'TRAIN';
      notes = resolveAssignments(s, new SeededRNG(1 + i));
      if (g.injuries.length > 0) break;
    }
    expect(g.injuries.length).toBeGreaterThan(0);
    expect(g.injury).not.toBe('NONE');
    expect(notes.join()).toMatch(/overtrains|hurt/);
  });

  it('REST cure clears the light injuries from the array, not just the tier', () => {
    // Force the 0.35 cure roll to succeed by scanning seeds.
    let cured = false;
    for (let seed = 1; seed < 400 && !cured; seed++) {
      const s2 = createSeason(seed);
      const g2 = s2.roster[0]!;
      g2.injuries = [
        { id: 'x1', part: 'ribs', severity: 'minor', daysLeft: 2 },
        { id: 'x2', part: 'knee', severity: 'serious', daysLeft: 4 },
      ];
      syncInjuryTier(g2);
      g2.assignment = 'REST';
      resolveAssignments(s2, new SeededRNG(seed));
      if (g2.injury === 'NONE' && g2.injuries.length === 0) {
        cured = true;
        break;
      }
    }
    expect(cured).toBe(true);
  });
});
