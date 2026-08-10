import type { ArmaturaId } from '../../content/armatura';
import type { FacilityId, GladiatorGrade } from '../../content/rpg';
import type { LegacyState, SeasonState } from './types';

export function emptyLegacy(): LegacyState {
  return {
    patronage: 0,
    seasonsCompleted: 0,
    unlockedFacilities: [],
    alumni: [],
    starterGradeBump: false,
  };
}

export function settleSeasonLegacy(state: SeasonState, prev: LegacyState): LegacyState {
  const next: LegacyState = {
    patronage: prev.patronage,
    seasonsCompleted: prev.seasonsCompleted + (state.status === 'SEASON_END' ? 1 : 0),
    unlockedFacilities: [...new Set([...prev.unlockedFacilities, ...state.facilities])],
    alumni: [...prev.alumni],
    starterGradeBump: prev.starterGradeBump || state.virtus >= 20,
  };

  const earned =
    Math.floor(state.virtus / 4) +
    state.record.wins * 2 +
    state.rivalsBeaten.length * 3 +
    (state.status === 'SEASON_END' ? 5 : 0);
  next.patronage += Math.max(0, earned);

  const stars = [...state.roster]
    .filter((g) => !g.retired)
    .sort((a, b) => b.fame + b.wins * 2 - (a.fame + a.wins * 2))
    .slice(0, 2);
  for (const g of stars) {
    if (g.fame + g.wins < 4) continue;
    if (next.alumni.some((a) => a.name === g.name && a.armatura === g.armatura)) continue;
    next.alumni.push({
      name: g.name,
      armatura: g.armatura as ArmaturaId,
      fame: g.fame,
      grade: g.grade as GladiatorGrade,
    });
  }
  next.alumni = next.alumni.slice(-8);

  // Remember infirmary / barracks blueprints as unlocked for next season start
  for (const f of state.facilities as FacilityId[]) {
    if (!next.unlockedFacilities.includes(f)) next.unlockedFacilities.push(f);
  }
  return next;
}

export function patronageDenariiBonus(legacy: LegacyState): number {
  return Math.min(80, legacy.patronage * 2);
}
