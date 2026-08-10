import { economy } from '../../content/economy';
import { GRADE_ORDER } from '../../content/rpg';
import { SeededRNG } from '../rng';
import type { SeededRNG as Rng } from '../rng';
import { createGladiator, rosterCap } from './gladiator';
import { gradePriceMul, rollFighter } from './rollFighter';
import type { RecruitOffer, SeasonState } from './types';

export function rollMarket(state: SeasonState, rng: Rng): RecruitOffer[] {
  const n = 3 + rng.int(0, 1);
  const offers: RecruitOffer[] = [];
  for (let i = 0; i < n; i++) {
    const draft = rollFighter(rng, {
      policy: 'market',
      id: -1 - i,
    });
    const base =
      economy.recruitMinPrice +
      rng.int(0, economy.recruitMaxPrice - economy.recruitMinPrice);
    const price = Math.round(base * gradePriceMul(draft.grade));
    offers.push({
      id: `m${state.day}-${i}-${draft.armatura}`,
      name: draft.name,
      armatura: draft.armatura,
      grade: draft.grade,
      temperament: draft.temperament,
      price,
      fame: draft.fame,
      age: draft.age,
    });
  }
  return offers;
}

export function buyRecruit(state: SeasonState, offerId: string): boolean {
  if (state.status !== 'ACTIVE') return false;
  const offer = state.market.find((m) => m.id === offerId);
  if (!offer) return false;
  const cap = rosterCap(state.facilities);
  const active = state.roster.filter((g) => !g.retired).length;
  if (active >= cap) return false;
  if (state.denarii < offer.price) return false;
  state.denarii -= offer.price;
  const g = createGladiator(state.nextGladiatorId++, {
    name: offer.name,
    armatura: offer.armatura,
    grade: offer.grade,
    temperament: offer.temperament,
    fame: offer.fame,
    xp: offer.grade === 'PRIMUS' ? 100 : offer.grade === 'ORDINARIUS' ? 40 : 0,
    age: offer.age ?? 22,
  });
  state.roster.push(g);
  state.market = state.market.filter((m) => m.id !== offerId);
  return true;
}

export function releaseGladiator(state: SeasonState, id: number): boolean {
  if (state.status !== 'ACTIVE') return false;
  const idx = state.roster.findIndex((g) => g.id === id && !g.retired);
  if (idx < 0) return false;
  const g = state.roster[idx]!;
  if (state.roster.filter((x) => !x.retired).length <= 1) return false;
  const refund = Math.round(18 + g.fame * 4 + (GRADE_ORDER.indexOf(g.grade) + 1) * 10);
  state.denarii += refund;
  state.virtus = Math.max(0, state.virtus - (g.fame >= 6 ? 1 : 0));
  state.retiredNames.push(g.name);
  state.roster.splice(idx, 1);
  return true;
}

/** Fill roster holes after death/retirement up to target (or cap). */
export function autoReplaceRoster(state: SeasonState, rng: SeededRNG): string[] {
  const notes: string[] = [];
  const cap = rosterCap(state.facilities);
  const target = Math.min(cap, economy.rosterTargetFill);
  let active = state.roster.filter((g) => !g.retired).length;
  while (active < target) {
    const g = rollFighter(rng, {
      policy: 'replacement',
      id: state.nextGladiatorId++,
    });
    state.roster.push(g);
    notes.push(`${g.name} (${g.armatura}) joins the school.`);
    active++;
  }
  return notes;
}
