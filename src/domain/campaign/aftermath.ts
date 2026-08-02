import type { MatchResult } from '../combat/types';
import { SeededRNG } from '../rng';
import { markBrokeIfNeeded, upkeepCost } from './season';
import type { AftermathSummary, Gladiator, InjuryTier, MuneraOffer, SeasonState } from './types';

export interface CareerFightInput {
  offer: MuneraOffer;
  /** Player lineup gladiator ids (team 0). */
  lineupIds: number[];
  result: MatchResult;
  forfeited: boolean;
}

function bumpInjury(cur: InjuryTier): InjuryTier {
  if (cur === 'NONE') return 'LIGHT';
  if (cur === 'LIGHT') return 'SEVERE';
  return 'SEVERE';
}

function applyFighterAftermath(
  g: Gladiator,
  lost: boolean,
  rng: SeededRNG,
): InjuryTier | null {
  g.fatigue += 1;
  g.hpRatio = Math.max(0.2, g.hpRatio - (lost ? 0.35 : 0.12) - g.fatigue * 0.03);
  let became: InjuryTier | null = null;
  if (lost && rng.chance(0.55)) {
    const next = bumpInjury(g.injury);
    if (next !== g.injury) became = next;
    g.injury = next;
  } else if (!lost && rng.chance(0.12)) {
    const next = bumpInjury(g.injury);
    if (next !== g.injury) became = next;
    g.injury = next;
  }
  if (lost) g.losses += 1;
  else g.wins += 1;
  return became;
}

/** Apply purse, virtus, injuries; marks dayResolved. Player is always team 0. */
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

  if (forfeited) {
    virtusDelta = Math.min(-1, offer.virtusLose);
    notes.push('Forfeit — entry lost.');
  } else if (playerWin) {
    purseDelta += offer.purse;
    virtusDelta = offer.virtusWin;
    notes.push(`Purse collected: ${offer.purse} denarii.`);
  } else if (draw) {
    purseDelta += Math.floor(offer.purse * 0.35);
    virtusDelta = Math.max(0, Math.floor(offer.virtusWin / 2));
    notes.push('Draw — partial purse.');
  } else {
    virtusDelta = offer.virtusLose;
    notes.push('Defeat — no purse.');
  }

  state.denarii += purseDelta;
  state.virtus = Math.max(0, state.virtus + virtusDelta);

  const rng = new SeededRNG(state.seed + state.day * 131 + offer.templateId.length * 17);
  const injuries: AftermathSummary['injuries'] = [];
  for (const id of lineupIds) {
    const g = state.roster.find((x) => x.id === id);
    if (!g) continue;
    const lost = forfeited || (!playerWin && !draw);
    const became = applyFighterAftermath(g, lost, rng);
    if (became) injuries.push({ name: g.name, injury: became });
  }

  // Day upkeep after bout
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
  };
  state.lastAftermath = summary;
  return summary;
}
