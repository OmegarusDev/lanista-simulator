import { LOCATION_FLAVOR, RIVAL_NAMES } from '../../content/rpg';
import type { SeededRNG } from '../rng';
import type { AftermathSummary, SeasonState } from './types';

export function maybeSpawnContract(state: SeasonState, rng: SeededRNG): void {
  if (state.contracts.some((c) => !c.completed && !c.failed)) return;
  if (state.day < 3 || state.virtus < 4) return;
  if (!rng.chance(0.4)) return;
  const rival = rng.pick([...RIVAL_NAMES]);
  const loc = rng.pick([...LOCATION_FLAVOR]);
  state.contracts.push({
    id: `c-${state.day}-${rng.int(0, 999)}`,
    name: `Answer ${rival}`,
    blurb: `Appear at the ${loc} within three days.`,
    daysLeft: 3,
    virtusBonus: 3,
    denariiBonus: 25,
    completed: false,
    failed: false,
  });
}

export function tickContracts(state: SeasonState): string[] {
  const notes: string[] = [];
  for (const c of state.contracts) {
    if (c.completed || c.failed) continue;
    c.daysLeft -= 1;
    if (c.daysLeft < 0) {
      c.failed = true;
      state.virtus = Math.max(0, state.virtus - 2);
      notes.push(`Contract failed: ${c.name}.`);
    }
  }
  return notes;
}

/** Call after a successful career bout — completes matching rival contracts. */
export function onBoutForContracts(
  state: SeasonState,
  summary: AftermathSummary,
  rivalName: string | null,
): void {
  if (summary.result !== 'WIN' || !rivalName) return;
  for (const c of state.contracts) {
    if (c.completed || c.failed) continue;
    if (c.name.includes(rivalName) || c.blurb.includes(rivalName)) {
      c.completed = true;
      state.denarii += c.denariiBonus;
      state.virtus += c.virtusBonus;
      if (!state.rivalsBeaten.includes(rivalName)) state.rivalsBeaten.push(rivalName);
      summary.notes.push(`Contract fulfilled: +${c.denariiBonus}d, +${c.virtusBonus} virtus.`);
    }
  }
}
