import { describe, expect, it } from 'vitest';
import type { CombatEventKind } from '../domain/combat/types';
import { FX_RECIPES, recipeForEvent } from './fx';
import { noiseCacheMax } from './noiseTex';

const KINDS: CombatEventKind[] = [
  'HIT',
  'GUARD',
  'SIDESTEP',
  'STUMBLE',
  'POISE_BREAK',
  'TIP_CATCH',
  'KO',
  'ABORT',
];

describe('FX recipes', () => {
  it('every CombatEventKind has a non-empty recipe', () => {
    for (const k of KINDS) {
      expect(recipeForEvent(k).length).toBeGreaterThan(0);
      expect(FX_RECIPES[k].length).toBeGreaterThan(0);
    }
  });
});

describe('noise cache', () => {
  it('exposes bounded max keys', () => {
    expect(noiseCacheMax()).toBeLessThanOrEqual(16);
    expect(noiseCacheMax()).toBeGreaterThan(0);
  });
});
