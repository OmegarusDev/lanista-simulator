import { describe, expect, it } from 'vitest';
import { Atlas } from './atlas';
import { bakeFbmTile, fbm2, valueNoise2 } from './noise';

describe('gfx noise', () => {
  it('valueNoise2 is deterministic', () => {
    const a = valueNoise2(1.25, 3.5, 42);
    const b = valueNoise2(1.25, 3.5, 42);
    expect(a).toBe(b);
    expect(a).toBeGreaterThanOrEqual(0);
    expect(a).toBeLessThanOrEqual(1);
  });

  it('fbm2 is deterministic and in range', () => {
    const a = fbm2(2.5, 4.1, 99, { octaves: 3 });
    const b = fbm2(2.5, 4.1, 99, { octaves: 3 });
    expect(a).toBe(b);
    expect(a).toBeGreaterThanOrEqual(0);
    expect(a).toBeLessThanOrEqual(1);
  });

  it('bakeFbmTile is deterministic byte-for-byte', () => {
    const a = bakeFbmTile(32, 12345, { octaves: 3, frequency: 4 });
    const b = bakeFbmTile(32, 12345, { octaves: 3, frequency: 4 });
    expect(a.length).toBe(32 * 32);
    expect(Array.from(a)).toEqual(Array.from(b));
  });

  it('different seeds differ', () => {
    const a = bakeFbmTile(16, 1, { octaves: 2, frequency: 2 });
    const b = bakeFbmTile(16, 2, { octaves: 2, frequency: 2 });
    let diff = 0;
    for (let i = 0; i < a.length; i++) diff += Math.abs(a[i]! - b[i]!);
    expect(diff).toBeGreaterThan(0.5);
  });
});

describe('gfx atlas', () => {
  it('getOrBake caches and refreshes LRU', () => {
    const atlas = new Atlas({ maxEntries: 2 });
    let paints = 0;
    const paint = () => {
      paints++;
    };
    atlas.getOrBake('a', 4, 4, paint);
    atlas.getOrBake('a', 4, 4, paint);
    expect(paints).toBe(1);
    atlas.getOrBake('b', 4, 4, paint);
    atlas.getOrBake('c', 4, 4, paint);
    expect(atlas.size).toBe(2);
    expect(atlas.has('a')).toBe(false);
  });

  it('flushBakeBudget amortises pending work', () => {
    const atlas = new Atlas({ maxEntries: 8 });
    atlas.beginFrame();
    expect(atlas.getOrEnqueue('x', 2, 2, () => undefined)).toBeNull();
    expect(atlas.getOrEnqueue('y', 2, 2, () => undefined)).toBeNull();
    expect(atlas.pendingCount).toBe(2);
    const n = atlas.flushBakeBudget(1);
    expect(n).toBe(1);
    expect(atlas.size).toBe(1);
    expect(atlas.pendingCount).toBe(1);
  });
});
