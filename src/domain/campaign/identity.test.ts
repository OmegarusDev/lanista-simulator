import { describe, expect, it } from 'vitest';
import { createSeason } from './season';
import { injuryCombatMods, worstTier } from './injury';
import { applyFightMorale } from './morale';
import { onSharedLineup, upsertEdge } from './relationships';

describe('injury system', () => {
  it('ranks body injuries into tiers', () => {
    expect(worstTier([])).toBe('NONE');
    expect(worstTier([{ id: '1', part: 'arm', severity: 'minor', daysLeft: 2 }])).toBe('LIGHT');
    expect(worstTier([{ id: '1', part: 'knee', severity: 'critical', daysLeft: 7 }])).toBe('SEVERE');
  });

  it('applies combat mods for knee damage', () => {
    const mods = injuryCombatMods([
      { id: '1', part: 'knee', severity: 'serious', daysLeft: 4 },
    ]);
    expect(mods.pools).toBeLessThan(1);
    expect(mods.caution).toBeGreaterThan(0);
  });
});

describe('morale + relationships', () => {
  it('shifts morale after fights', () => {
    const state = createSeason(42);
    const g = state.roster[0]!;
    const before = g.morale;
    applyFightMorale(g, { won: true, draw: false, forfeited: false, deathOnRoster: false });
    expect(g.morale).toBeGreaterThan(before);
  });

  it('creates friendship edges after shared wins', () => {
    const state = createSeason(99);
    const a = state.roster[0]!.id;
    const b = state.roster[1]!.id;
    onSharedLineup(state, [a, b], true);
    expect(state.relationships.length).toBeGreaterThan(0);
    upsertEdge(state, a, b, 'rival', 0.4);
    expect(state.relationships.some((e) => e.kind === 'rival')).toBe(true);
  });
});

describe('season identity', () => {
  it('rolls origins and traits on starters', () => {
    const state = createSeason(7);
    for (const g of state.roster) {
      expect(g.origin).toBeTruthy();
      expect(g.traits.length).toBeGreaterThanOrEqual(1);
      expect(g.injuries).toEqual([]);
      expect(typeof g.appearanceSeed).toBe('number');
    }
    expect(state.relationships).toEqual([]);
    expect(state.pendingOrders.stance).toBe('BALANCED');
  });
});
