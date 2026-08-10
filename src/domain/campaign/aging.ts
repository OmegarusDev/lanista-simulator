import { economy } from '../../content/economy';
import type { SeededRNG } from '../rng';
import { autoReplaceRoster } from './market';
import type { SeasonState } from './types';

/**
 * Advance ages (compressed years), force-retire the elderly, auto-fill holes.
 * Call once per resolved day after bout/rest resolution.
 */
export function tickAgingAndReplace(state: SeasonState, rng: SeededRNG): string[] {
  const notes: string[] = [];
  // Fractional years: every ageDaysPerYear days, +1 year
  if (state.day % economy.ageDaysPerYear === 0) {
    for (const g of state.roster) {
      if (g.retired) continue;
      g.age += 1;
    }
  }

  for (const g of state.roster) {
    if (g.retired) continue;
    if (g.age >= economy.ageRetireAt) {
      g.retired = true;
      state.retiredNames.push(g.name);
      notes.push(`${g.name} retires from the sand (age ${g.age}).`);
    }
  }

  notes.push(...autoReplaceRoster(state, rng));
  return notes;
}
