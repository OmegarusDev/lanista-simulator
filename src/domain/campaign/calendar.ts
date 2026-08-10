import type { ArmaturaId } from '../../content/armatura';
import { BEAST_LIST, type BeastId } from '../../content/beasts';
import { economy } from '../../content/economy';
import { GRADE_ORDER } from '../../content/rpg';
import { rollMissio } from '../combat/entertainment';
import type { TeamSize } from '../combat/types';
import { SeededRNG } from '../rng';
import { addXp } from './gladiator';
import { rollFighter } from './rollFighter';
import type { Gladiator, InjuryTier, MuneraOffer, SeasonState, SlateBout } from './types';

function fightable(state: SeasonState): Gladiator[] {
  return state.roster.filter((g) => !g.retired && g.injury !== 'SEVERE' && g.hpRatio > 0.15);
}

function bumpInjury(cur: InjuryTier): InjuryTier {
  if (cur === 'NONE') return 'LIGHT';
  if (cur === 'LIGHT') return 'SEVERE';
  return 'SEVERE';
}

function gradeWeight(g: Gladiator): number {
  return GRADE_ORDER.indexOf(g.grade) + 1 + g.fame * 0.05 - (g.age > 32 ? 0.4 : 0);
}

/** Build today's living slate — school fighters fight their own bouts. */
export function rollDailySlate(state: SeasonState, rng: SeededRNG): SlateBout[] {
  const fit = fightable(state);
  const slate: SlateBout[] = [];
  if (fit.length === 0) return slate;

  const used = new Set<number>();
  const boutCount = Math.min(3, Math.max(1, Math.ceil(fit.length / 2)));

  for (let b = 0; b < boutCount; b++) {
    const available = fit.filter((g) => !used.has(g.id));
    if (available.length === 0) break;

    const teamSize = (rng.chance(0.55) ? 1 : rng.chance(0.55) ? 2 : 3) as TeamSize;
    const schoolIds: number[] = [];
    for (let i = 0; i < teamSize; i++) {
      const pool = available.filter((g) => !used.has(g.id));
      if (pool.length === 0) break;
      const pick = rng.pick(pool);
      used.add(pick.id);
      schoolIds.push(pick.id);
    }
    if (schoolIds.length === 0) break;

    const venatio = rng.chance(0.22);
    const opponentArmaturae: ArmaturaId[] = [];
    const beastOpponents: BeastId[] = [];
    for (let i = 0; i < schoolIds.length; i++) {
      if (venatio) {
        beastOpponents.push(rng.pick([...BEAST_LIST]));
        opponentArmaturae.push('MURMILLO');
      } else {
        const rival = rollFighter(rng, { policy: 'rival', id: -100 - b * 10 - i });
        opponentArmaturae.push(rival.armatura);
      }
    }

    const lead = state.roster.find((g) => g.id === schoolIds[0]!)!;
    const purse = 28 + schoolIds.length * 12 + rng.int(0, 20);
    slate.push({
      id: `slate-${state.day}-${b}`,
      kind: venatio ? 'venatio' : 'gladiator',
      name: venatio ? `Venatio — ${lead.name}` : `Munera — ${lead.name}`,
      blurb: venatio
        ? 'School steel against the arena beasts.'
        : 'A card of the day for the familia.',
      teamSize: schoolIds.length as TeamSize,
      schoolIds,
      opponentArmaturae,
      beastOpponents: venatio ? beastOpponents : undefined,
      purse,
      entryFee: 4 + schoolIds.length * 2,
      virtusWin: 1 + (venatio ? 1 : 0),
      virtusLose: -1,
      rivalName: null,
      status: 'pending',
    });
  }

  return slate;
}

export function slateToOffer(state: SeasonState, bout: SlateBout): MuneraOffer {
  const playerSlots = bout.schoolIds.map((id) => {
    const g = state.roster.find((x) => x.id === id);
    const kit = g?.armatura ?? 'MURMILLO';
    return { anyOf: [kit] as ArmaturaId[], label: g?.name };
  });
  return {
    instanceId: bout.id,
    templateId: bout.id,
    name: bout.name,
    blurb: bout.blurb,
    kind: bout.kind === 'venatio' ? 'spectacle' : 'pair',
    tier: 1,
    teamSize: bout.teamSize,
    purse: bout.purse,
    entryFee: bout.entryFee,
    virtusWin: bout.virtusWin,
    virtusLose: bout.virtusLose,
    playerSlots,
    opponents: bout.opponentArmaturae,
    eligible: true,
    location: 'Arena',
    editor: '',
    rivalName: bout.rivalName,
    contractId: null,
  };
}

/** Lightweight off-screen result — same injury/XP/missio spirit without FightScene. */
export function simulateSlateBout(
  state: SeasonState,
  bout: SlateBout,
  rng: SeededRNG,
): string[] {
  if (bout.status !== 'pending') return [];
  const notes: string[] = [];
  const school = bout.schoolIds
    .map((id) => state.roster.find((g) => g.id === id && !g.retired))
    .filter((g): g is Gladiator => !!g);

  if (school.length === 0) {
    bout.status = 'simulated';
    bout.simResult = 'DRAW';
    return notes;
  }

  const power = school.reduce((s, g) => s + gradeWeight(g), 0) / school.length;
  const oppPower =
    bout.kind === 'venatio'
      ? 2.2 + bout.teamSize * 0.15
      : 1.6 + bout.teamSize * 0.2 + rng.next();
  const winP = Math.max(0.22, Math.min(0.78, 0.5 + (power - oppPower) * 0.12));
  const roll = rng.next();
  const win = roll < winP;
  const draw = !win && roll < winP + 0.08;
  bout.simResult = draw ? 'DRAW' : win ? 'WIN' : 'LOSS';
  bout.status = 'simulated';

  state.denarii -= bout.entryFee;
  if (win) {
    state.denarii += bout.purse;
    state.virtus += bout.virtusWin;
    state.record.wins += 1;
  } else if (draw) {
    state.record.draws += 1;
  } else {
    state.virtus = Math.max(0, state.virtus + bout.virtusLose);
    state.record.losses += 1;
  }

  for (const g of school) {
    const lost = !win && !draw;
    g.fatigue += 1;
    g.hpRatio = Math.max(
      0.2,
      g.hpRatio - (lost ? 0.32 : draw ? 0.16 : 0.1) - g.fatigue * 0.02,
    );
    if (lost && rng.chance(0.5)) g.injury = bumpInjury(g.injury);
    const xp = draw ? economy.xpDraw : lost ? economy.xpLoss : economy.xpWin;
    addXp(g, xp);
    g.mastery += lost ? 1 : 2;
    if (!lost && !draw) g.fame += economy.fameWin;
    if (lost) g.losses += 1;
    else if (!draw) g.wins += 1;

    if (lost && rng.chance(0.35)) {
      const ent = 20 + rng.int(0, 40);
      const miss = rollMissio(ent, g.fame, rng);
      if (miss.outcome === 'DEATH') {
        g.retired = true;
        state.retiredNames.push(g.name);
        notes.push(`${g.name} falls in ${bout.name} — no missio.`);
      } else {
        g.injury = 'SEVERE';
        notes.push(`${g.name} spared after ${bout.name}.`);
      }
    }
  }

  notes.push(
    `${bout.name}: ${bout.simResult === 'WIN' ? 'victory' : bout.simResult === 'DRAW' ? 'draw' : 'defeat'} (unwatched).`,
  );
  return notes;
}

/** Simulate every pending slate bout (after the watched one, or on rest/end). */
export function resolvePendingSlate(state: SeasonState, rng: SeededRNG): string[] {
  const notes: string[] = [];
  for (const bout of state.slate) {
    if (bout.status === 'pending') {
      notes.push(...simulateSlateBout(state, bout, rng));
    }
  }
  return notes;
}

export function markSlateWatched(state: SeasonState, boutId: string): void {
  const bout = state.slate.find((b) => b.id === boutId);
  if (bout) bout.status = 'watched';
}

export function findSlateBout(state: SeasonState, boutId: string): SlateBout | undefined {
  return state.slate.find((b) => b.id === boutId);
}
