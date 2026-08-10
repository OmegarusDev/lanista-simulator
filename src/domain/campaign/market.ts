import { ARMATURA_LIST, type ArmaturaId } from '../../content/armatura';
import { economy, GLADIATOR_NAMES } from '../../content/economy';
import { GRADE_ORDER, TEMPERAMENT_LIST, type GladiatorGrade } from '../../content/rpg';
import type { SeededRNG } from '../rng';
import { createGladiator, rosterCap } from './gladiator';
import type { RecruitOffer, SeasonState } from './types';

function gradePrice(grade: GladiatorGrade): number {
  if (grade === 'PRIMUS') return 1.55;
  if (grade === 'ORDINARIUS') return 1.2;
  return 1;
}

export function rollMarket(state: SeasonState, rng: SeededRNG): RecruitOffer[] {
  const n = 3 + rng.int(0, 1);
  const offers: RecruitOffer[] = [];
  for (let i = 0; i < n; i++) {
    const armatura = rng.pick([...ARMATURA_LIST]) as ArmaturaId;
    const gradeRoll = rng.next();
    const grade: GladiatorGrade =
      gradeRoll > 0.92 ? 'PRIMUS' : gradeRoll > 0.55 ? 'ORDINARIUS' : 'TIRO';
    const temperament = rng.pick([...TEMPERAMENT_LIST]);
    const base =
      economy.recruitMinPrice +
      rng.int(0, economy.recruitMaxPrice - economy.recruitMinPrice);
    const price = Math.round(base * gradePrice(grade));
    offers.push({
      id: `m${state.day}-${i}-${armatura}`,
      name: rng.pick([...GLADIATOR_NAMES]),
      armatura,
      grade,
      temperament,
      price,
      fame: grade === 'PRIMUS' ? 4 : grade === 'ORDINARIUS' ? 1 : 0,
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
