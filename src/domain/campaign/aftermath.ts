import { economy } from '../../content/economy';
import { rollMissio } from '../combat/entertainment';
import type { MatchResult } from '../combat/types';
import { SeededRNG } from '../rng';
import { onBoutForContracts } from './contracts';
import { addXp } from './gladiator';
import { resolveAssignments } from './ludusDay';
import { markBrokeIfNeeded, upkeepCost } from './season';
import type {
  AftermathSummary,
  Gladiator,
  InjuryTier,
  MissioVerdict,
  MuneraOffer,
  SeasonState,
} from './types';

export interface BoutFighterStat {
  gladiatorId: number;
  entertainment: number;
  downed: boolean;
}

export interface CareerFightInput {
  offer: MuneraOffer;
  /** Player lineup gladiator ids (team 0). */
  lineupIds: number[];
  result: MatchResult;
  forfeited: boolean;
  boutStats?: BoutFighterStat[];
}

function bumpInjury(cur: InjuryTier): InjuryTier {
  if (cur === 'NONE') return 'LIGHT';
  if (cur === 'LIGHT') return 'SEVERE';
  return 'SEVERE';
}

function applyFighterAftermath(
  g: Gladiator,
  lost: boolean,
  draw: boolean,
  forfeited: boolean,
  rng: SeededRNG,
): { injury: InjuryTier | null; xp: number; leveled: boolean } {
  g.fatigue += 1;
  g.hpRatio = Math.max(0.2, g.hpRatio - (lost ? 0.35 : draw ? 0.18 : 0.12) - g.fatigue * 0.03);
  let became: InjuryTier | null = null;
  if (lost && rng.chance(0.55)) {
    const next = bumpInjury(g.injury);
    if (next !== g.injury) became = next;
    g.injury = next;
  } else if (!lost && !draw && rng.chance(0.12)) {
    const next = bumpInjury(g.injury);
    if (next !== g.injury) became = next;
    g.injury = next;
  }

  const xp = forfeited
    ? economy.xpForfeit
    : draw
      ? economy.xpDraw
      : lost
        ? economy.xpLoss
        : economy.xpWin;

  // Fame purse weight
  if (!lost && !forfeited) g.fame += draw ? economy.fameDraw : economy.fameWin;
  g.mastery += lost ? 1 : 2;

  const { leveled } = addXp(g, xp);

  if (lost || forfeited) g.losses += 1;
  else if (!draw) g.wins += 1;

  return { injury: became, xp, leveled };
}

/** Apply purse, virtus, injuries, XP; marks dayResolved. Player is always team 0. */
export function applyCareerFight(state: SeasonState, input: CareerFightInput): AftermathSummary {
  const { offer, lineupIds, forfeited } = input;
  let resultLabel: AftermathSummary['result'];
  let playerWin = false;
  let draw = false;

  if (forfeited) {
    resultLabel = 'FORFEIT';
    state.record.forfeits += 1;
    state.record.losses += 1;
  } else if (input.result === 'DRAW') {
    resultLabel = 'DRAW';
    draw = true;
    state.record.draws += 1;
  } else if (input.result === 'TEAM0') {
    resultLabel = 'WIN';
    playerWin = true;
    state.record.wins += 1;
  } else {
    resultLabel = 'LOSS';
    state.record.losses += 1;
  }

  let purseDelta = -offer.entryFee;
  let virtusDelta = 0;
  const notes: string[] = [];

  // Fame-weighted purse
  const fameBonus = lineupIds.reduce((s, id) => {
    const g = state.roster.find((x) => x.id === id);
    return s + (g ? Math.min(12, g.fame) : 0);
  }, 0);

  if (forfeited) {
    virtusDelta = Math.min(-1, offer.virtusLose);
    notes.push('Forfeit — entry lost.');
  } else if (playerWin) {
    const purse = offer.purse + fameBonus;
    purseDelta += purse;
    virtusDelta = offer.virtusWin + (offer.rivalName ? 1 : 0);
    notes.push(`Purse collected: ${purse} denarii.`);
    if (offer.location) notes.push(`At the ${offer.location}.`);
  } else if (draw) {
    purseDelta += Math.floor(offer.purse * 0.35);
    virtusDelta = Math.max(0, Math.floor(offer.virtusWin / 2));
    notes.push('Draw — partial purse.');
  } else {
    virtusDelta = offer.virtusLose;
    notes.push('Defeat — no purse.');
    if (offer.rivalName) {
      virtusDelta -= 1;
      notes.push(`${offer.rivalName} claims the crowd.`);
    }
  }

  state.denarii += purseDelta;
  state.virtus = Math.max(0, state.virtus + virtusDelta);

  const rng = new SeededRNG(state.seed + state.day * 131 + offer.templateId.length * 17);
  const injuries: AftermathSummary['injuries'] = [];
  const xpGains: NonNullable<AftermathSummary['xpGains']> = [];

  for (const id of lineupIds) {
    const g = state.roster.find((x) => x.id === id);
    if (!g) continue;
    const lost = forfeited || (!playerWin && !draw);
    const { injury, xp, leveled } = applyFighterAftermath(g, lost, draw, forfeited, rng);
    if (injury) injuries.push({ name: g.name, injury });
    xpGains.push({ name: g.name, xp, grade: leveled ? g.grade : undefined });
  }

  // Crowd missio for downed (incapacitated) fighters — entertainment + RNG
  const missio: MissioVerdict[] = [];
  if (!forfeited && input.boutStats) {
    for (const st of input.boutStats) {
      if (!st.downed) continue;
      const g = state.roster.find((x) => x.id === st.gladiatorId && !x.retired);
      if (!g) continue;
      const histrio = g.temperament === 'HISTRIO' ? 8 : 0;
      const { outcome, chance } = rollMissio(st.entertainment + histrio, g.fame, rng);
      const lean =
        chance >= 0.55
          ? 'The crowd roared for him…'
          : chance >= 0.35
            ? 'The benches murmur…'
            : 'They want blood…';
      if (outcome === 'SPARE') {
        g.injury = 'SEVERE';
        g.hpRatio = Math.min(g.hpRatio, 0.28);
        g.fame += 1;
        notes.push(`${g.name} is spared — missio.`);
      } else {
        g.retired = true;
        state.retiredNames.push(g.name);
        state.virtus = Math.max(0, state.virtus - 1);
        notes.push(`${g.name} dies in the sand.`);
      }
      missio.push({
        gladiatorId: g.id,
        name: g.name,
        entertainment: st.entertainment,
        outcome,
        lean,
      });
    }
  }

  const assignNotes = resolveAssignments(state, rng);
  notes.push(...assignNotes);

  const upkeep = upkeepCost(state);
  if (state.denarii >= upkeep) {
    state.denarii -= upkeep;
    purseDelta -= upkeep;
    notes.push(`Upkeep ${upkeep} denarii.`);
  } else {
    notes.push('Cannot pay upkeep.');
    state.denarii -= upkeep;
  }

  state.dayResolved = true;
  markBrokeIfNeeded(state);

  const summary: AftermathSummary = {
    offerName: offer.name,
    result: resultLabel,
    purseDelta,
    virtusDelta,
    injuries,
    notes,
    xpGains,
    missio: missio.length ? missio : undefined,
  };
  onBoutForContracts(state, summary, offer.rivalName);
  state.lastAftermath = summary;
  return summary;
}
