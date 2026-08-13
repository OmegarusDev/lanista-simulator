import { describe, expect, it } from 'vitest';
import { pinchDeltaFor } from './input';

describe('pinchDeltaFor', () => {
  it('clamps tiny bases — fingers landing close can never explode the zoom', () => {
    // Base 10px spreading to 200px: raw ratio 20 → delta 16.15 would slam the
    // dolly; the base floor + clamp keep it a gentle step.
    const d = pinchDeltaFor(200, 10);
    expect(d).toBe(0.4);
    expect(d).toBeGreaterThan(0);
  });

  it('zooms out symmetrically when fingers close', () => {
    const d = pinchDeltaFor(40, 80);
    expect(d).toBeLessThan(0);
    expect(d).toBeGreaterThanOrEqual(-0.4);
  });

  it('ignores degenerate distances (fingers on top of each other)', () => {
    expect(pinchDeltaFor(8, 10)).toBe(0);
    expect(pinchDeltaFor(5, 100)).toBe(0);
  });

  it('normal spreads stay proportional (and capped per frame)', () => {
    const spread = pinchDeltaFor(160, 80);
    expect(spread).toBe(0.4); // ratio 2 → 0.85, capped at the per-frame max
    const gentle = pinchDeltaFor(100, 80);
    expect(gentle).toBeCloseTo(0.2125, 3); // ratio 1.25 → 0.2125, uncapped
  });
});
