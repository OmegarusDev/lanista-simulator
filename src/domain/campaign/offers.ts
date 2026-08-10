import { economy } from '../../content/economy';
import { MUNERA_TEMPLATES, type MuneraKind, type MuneraTier } from '../../content/munera';
import { GRADE_ORDER, LOCATION_FLAVOR, RIVAL_NAMES, type GladiatorGrade } from '../../content/rpg';
import type { SeededRNG } from '../rng';
import { canFieldTemplate } from './eligibility';
import type { MuneraOffer, SeasonState } from './types';

export function maxOfferTier(virtus: number): MuneraTier {
  if (virtus >= economy.virtusTier3) return 3;
  if (virtus >= economy.virtusTier2) return 2;
  return 1;
}

const KIND_PRIORITY: MuneraKind[] = ['classic', 'spectacle', 'pair', 'melee', 'trial'];

function minGradeForTier(tier: MuneraTier): GladiatorGrade | undefined {
  if (tier >= 3) return 'ORDINARIUS';
  return undefined;
}

/**
 * Daily board: prefer eligible events, mix kinds, 4–5 cards.
 * Ineligible classics still appear greyed so players see what kits unlock.
 */
export function rollDailyOffers(state: SeasonState, rng: SeededRNG): MuneraOffer[] {
  const tier = maxOfferTier(state.virtus);
  const pool = MUNERA_TEMPLATES.filter((t) => t.tier <= tier);
  const eligible = pool.filter((t) => canFieldTemplate(state, t));
  const ineligible = pool.filter((t) => !canFieldTemplate(state, t));

  const picked: typeof pool = [];
  const takeFrom = (src: typeof pool, n: number) => {
    const shuffled = [...src];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = rng.int(0, i);
      [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
    }
    for (const t of shuffled) {
      if (picked.length >= n) break;
      if (!picked.some((p) => p.id === t.id)) picked.push(t);
    }
  };

  for (const kind of KIND_PRIORITY) {
    const ofKind = eligible.filter((t) => t.kind === kind);
    if (ofKind.length) takeFrom(ofKind, picked.length + 1);
    if (picked.length >= 4) break;
  }
  takeFrom(eligible, 4);
  takeFrom(ineligible, 5);
  if (picked.length < 3) takeFrom(pool, 3);

  if (state.day <= 3) {
    picked.sort((a, b) => a.teamSize - b.teamSize || a.tier - b.tier);
  } else {
    picked.sort((a, b) => {
      const ae = canFieldTemplate(state, a) ? 0 : 1;
      const be = canFieldTemplate(state, b) ? 0 : 1;
      return ae - be;
    });
  }

  const activeContract = state.contracts.find((c) => !c.completed && !c.failed);

  return picked.slice(0, 5).map((t, i) => {
    const rival =
      t.tier >= 2 && rng.chance(0.45) ? rng.pick([...RIVAL_NAMES]) : null;
    const location = rng.pick([...LOCATION_FLAVOR]);
    const editor =
      t.kind === 'classic' ? 'Editor of the games' : rng.chance(0.5) ? 'Local magistrate' : 'Patron';
    const minGrade = minGradeForTier(t.tier);
    let eligibleNow = canFieldTemplate(state, t);
    if (eligibleNow && minGrade) {
      const need = GRADE_ORDER.indexOf(minGrade);
      const hasGrade = state.roster.some(
        (g) =>
          !g.retired &&
          g.injury !== 'SEVERE' &&
          GRADE_ORDER.indexOf(g.grade) >= need,
      );
      if (!hasGrade) eligibleNow = false;
    }
    return {
      instanceId: `d${state.day}-${t.id}-${i}`,
      templateId: t.id,
      name: rival ? `${t.name} — vs ${rival}` : t.name,
      blurb: `${t.blurb} · ${location}.`,
      kind: t.kind,
      tier: t.tier,
      teamSize: t.teamSize,
      purse: t.purse + (rival ? 10 : 0),
      entryFee: t.entryFee,
      virtusWin: t.virtusWin,
      virtusLose: t.virtusLose,
      playerSlots: t.playerSlots.map((s) => ({ anyOf: [...s.anyOf], label: s.label })),
      opponents: [...t.opponents],
      eligible: eligibleNow,
      location,
      editor,
      rivalName: rival,
      contractId: rival && activeContract?.name.includes(rival) ? activeContract.id : null,
      minGrade,
    };
  });
}
