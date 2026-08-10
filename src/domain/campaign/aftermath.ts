import { economy } from '../../content/economy';
import { TRAITS } from '../../content/identity';
import { rollMissio } from '../combat/entertainment';
import type { MatchResult } from '../combat/types';
import { SeededRNG } from '../rng';
import { markSlateWatched, resolvePendingSlate } from './calendar';
import { onBoutForContracts } from './contracts';
import { addXp, pushHistory } from './gladiator';
import { addInjury, injuryLabel, rollFightInjury } from './injury';
import { resolveAssignments } from './ludusDay';
import { applyFightMorale } from './morale';
import { lineupFriction, onSharedLineup } from './relationships';
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
  lineupIds: number[];
  result: MatchResult;
  forfeited: boolean;
  boutStats?: BoutFighterStat[];
}

function applyFighterAftermath(
  g: Gladiator,
  lost: boolean,
  draw: boolean,
  forfeited: boolean,
  rng: SeededRNG,
  day: number,
): { injury: InjuryTier | null; detail?: string; xp: number; leveled: boolean } {
  g.fatigue += 1;
  const drop = (lost ? 0.28 : draw ? 0.15 : 0.1) + g.fatigue * 0.025;
  g.vitality = Math.max(0.2, (g.vitality ?? g.hpRatio) - drop);
  g.hpRatio = g.vitality;

  let became: InjuryTier | null = null;
  let detail: string | undefined;
  const traitMul =
    (g.traits ?? []).reduce((s, t) => s + TRAITS[t].injuryChanceMul, 0) /
      Math.max(1, g.traits?.length ?? 1) /
      (g.constitution || 1);

  const rolled = rollFightInjury(rng, {
    lost,
    draw,
    chanceMul: traitMul,
    sourceDay: day,
  });
  if (rolled) {
    addInjury(g, rolled);
    became = g.injury;
    detail = injuryLabel(rolled);
    pushHistory(g, day, `Suffered ${detail} in the arena.`);
  }

  const xp = forfeited
    ? economy.xpForfeit
    : draw
      ? economy.xpDraw
      : lost
        ? economy.xpLoss
        : economy.xpWin;

  if (!lost && !forfeited) g.fame += draw ? economy.fameDraw : economy.fameWin;
  g.mastery += lost ? 1 : 2;

  const { leveled } = addXp(g, xp);
  if (lost || forfeited) g.losses += 1;
  else if (!draw) g.wins += 1;

  return { injury: became, detail, xp, leveled };
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
  const storyBeats: string[] = [];
  const moraleNotes: string[] = [];

  const fameBonus = lineupIds.reduce((s, id) => {
    const g = state.roster.find((x) => x.id === id);
    return s + (g ? Math.min(12, g.fame) : 0);
  }, 0);

  if (forfeited) {
    virtusDelta = Math.min(-1, offer.virtusLose);
    notes.push('Forfeit — entry lost.');
    storyBeats.push('The lanista withdraws the familia under a cloud.');
  } else if (playerWin) {
    const purse = offer.purse + fameBonus;
    purseDelta += purse;
    virtusDelta = offer.virtusWin + (offer.rivalName ? 1 : 0);
    notes.push(`Purse collected: ${purse} denarii.`);
    storyBeats.push(
      offer.eventRole === 'revenge'
        ? 'Revenge is settled in blood and applause.'
        : offer.eventRole === 'championship'
          ? 'A crown bout — the benches remember the names.'
          : `Victory at the ${offer.location || 'arena'}.`,
    );
    if (offer.rivalName) storyBeats.push(`${offer.rivalName} tastes sand.`);
  } else if (draw) {
    purseDelta += Math.floor(offer.purse * 0.35);
    virtusDelta = Math.max(0, Math.floor(offer.virtusWin / 2));
    notes.push('Draw — partial purse.');
    storyBeats.push('Neither side yields; the editor cuts the card short.');
  } else {
    virtusDelta = offer.virtusLose;
    notes.push('Defeat — no purse.');
    storyBeats.push('The familia leaves with lowered heads.');
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
    const { injury, detail, xp, leveled } = applyFighterAftermath(
      g,
      lost,
      draw,
      forfeited,
      rng,
      state.day,
    );
    if (injury) injuries.push({ name: g.name, injury, detail });
    xpGains.push({ name: g.name, xp, grade: leveled ? g.grade : undefined });
    applyFightMorale(g, {
      won: playerWin,
      draw,
      forfeited,
      deathOnRoster: false,
    });
    moraleNotes.push(
      `${g.name}: morale ${Math.round(g.morale)}, confidence ${Math.round(g.confidence)}.`,
    );
  }

  const relationNotes = lineupFriction(state, lineupIds);
  onSharedLineup(state, lineupIds, playerWin);

  const missio: MissioVerdict[] = [];
  const judgeDowned =
    !forfeited || (forfeited && Boolean(input.boutStats?.some((s) => s.downed)));

  if (judgeDowned && input.boutStats) {
    for (const st of input.boutStats) {
      if (!st.downed) continue;
      const g = state.roster.find((x) => x.id === st.gladiatorId && !x.retired);
      if (!g) continue;
      if (playerWin) {
        addInjury(g, {
          id: `missio-${g.id}-${state.day}`,
          part: 'ribs',
          severity: 'serious',
          daysLeft: 4,
          sourceDay: state.day,
        });
        g.vitality = Math.min(g.vitality, 0.28);
        g.hpRatio = g.vitality;
        notes.push(`${g.name} fell but the victors are spared.`);
        storyBeats.push(`${g.name} tastes the sand — and rises to missio.`);
        missio.push({
          gladiatorId: g.id,
          name: g.name,
          entertainment: st.entertainment,
          outcome: 'SPARE',
          lean: 'Victory softens the thumb…',
        });
        continue;
      }
      const histrio = g.temperament === 'HISTRIO' ? 8 : 0;
      const show = Math.round((g.showmanship ?? 1) * 6);
      const { outcome, chance } = rollMissio(st.entertainment + histrio + show, g.fame, rng);
      const lean =
        chance >= 0.55
          ? 'The crowd roared for him…'
          : chance >= 0.35
            ? 'The benches murmur…'
            : 'They want blood…';
      if (outcome === 'SPARE') {
        addInjury(g, {
          id: `missio-${g.id}-${state.day}`,
          part: 'head',
          severity: 'critical',
          daysLeft: 7,
          sourceDay: state.day,
        });
        g.vitality = Math.min(g.vitality, 0.28);
        g.hpRatio = g.vitality;
        g.fame += 1;
        notes.push(`${g.name} is spared — missio.`);
        storyBeats.push(`${g.name} lives by the crowd's mercy.`);
      } else {
        g.retired = true;
        state.retiredNames.push(g.name);
        state.virtus = Math.max(0, state.virtus - 1);
        notes.push(`${g.name} dies in the sand.`);
        storyBeats.push(`${g.name} does not leave the arena walking.`);
        for (const ally of state.roster) {
          if (!ally.retired && ally.id !== g.id) {
            applyFightMorale(ally, {
              won: false,
              draw: false,
              forfeited: false,
              deathOnRoster: true,
            });
          }
        }
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

  markSlateWatched(state, offer.instanceId);
  const slateNotes = resolvePendingSlate(state, rng);
  notes.push(...slateNotes);

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
    storyBeats,
    xpGains,
    missio: missio.length ? missio : undefined,
    moraleNotes,
    relationNotes: relationNotes.length ? relationNotes : undefined,
  };
  onBoutForContracts(state, summary, offer.rivalName);
  state.lastAftermath = summary;
  return summary;
}
