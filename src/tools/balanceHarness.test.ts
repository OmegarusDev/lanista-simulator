import { describe, expect, it } from 'vitest';
import { runBalanceHarness } from './balanceHarness';

describe('balanceHarness', () => {
  it('runs a tiny seeded batch', () => {
    const report = runBalanceHarness({ seedsPerPair: 2, baseSeed: 1 });
    expect(report.fights).toBeGreaterThan(10);
    expect(report.winRates.length).toBe(8);
    const sum = report.winRates.reduce((s, r) => s + r.winRate * r.fights, 0);
    expect(sum).toBeGreaterThan(0);
  });
});
