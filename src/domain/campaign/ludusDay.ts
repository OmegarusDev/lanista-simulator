import { economy } from '../../content/economy';
import type { DayAssignment } from '../../content/rpg';
import type { SeededRNG } from '../rng';
import { addXp } from './gladiator';
import { hasFacility } from './facilities';
import { addInjury, HEAL_DAYS, syncInjuryTier } from './injury';
import type { SeasonState } from './types';

export function setGladiatorAssignment(
  state: SeasonState,
  id: number,
  assignment: DayAssignment,
): boolean {
  if (state.status !== 'ACTIVE' || state.dayResolved) return false;
  const g = state.roster.find((x) => x.id === id && !x.retired);
  if (!g) return false;
  if (g.injury === 'SEVERE' && assignment === 'TRAIN') return false;
  if (g.injury === 'SEVERE' && assignment === 'SPAR') return false;
  g.assignment = assignment;
  return true;
}

/** Resolve Train/Recover/Spar/Rest when the day advances (after bout or rest day). */
export function resolveAssignments(state: SeasonState, rng: SeededRNG): string[] {
  const notes: string[] = [];
  const palaestra = hasFacility(state, 'PALAESTRA');
  const xpMul = palaestra ? economy.palaestraXpMul : 1;
  const injMul = palaestra ? economy.palaestraInjuryMul : 1;

  for (const g of state.roster) {
    if (g.retired) continue;
    const a = g.assignment;
    g.assignment = 'NONE';
    if (a === 'NONE') continue;

    if (a === 'RECOVER' || a === 'REST') {
      g.fatigue = Math.max(0, g.fatigue - (a === 'REST' ? 2 : 1));
      g.hpRatio = Math.min(1, g.hpRatio + (a === 'REST' ? 0.18 : 0.12));
      g.vitality = Math.max(0.15, g.hpRatio); // keep readiness alias in sync
      if (a === 'REST' && g.injury === 'LIGHT' && rng.chance(0.35)) {
        // Cure clears the light injuries — the tier cache must not drift.
        g.injuries = g.injuries.filter((i) => i.permanent || i.severity === 'critical');
        syncInjuryTier(g);
      }
      notes.push(`${g.name} ${a === 'REST' ? 'rests' : 'recovers'}.`);
      continue;
    }

    if (a === 'TRAIN') {
      const { leveled, grade } = addXp(g, Math.round(economy.trainXp * xpMul));
      g.mastery += 1;
      g.fatigue += 1;
      const chance = economy.trainInjuryChance * injMul * (g.fatigue >= 3 ? 1.4 : 1);
      if (rng.chance(chance)) {
        const severity = g.injury === 'NONE' ? 'minor' : 'serious';
        addInjury(g, {
          id: `train-${g.id}-${state.day}`,
          part: 'arm',
          severity,
          daysLeft: HEAL_DAYS[severity],
        });
        notes.push(`${g.name} overtrains — ${g.injury === 'SEVERE' ? 'badly hurt' : 'hurt'}.`);
      } else {
        notes.push(
          leveled
            ? `${g.name} trains hard — rises to ${grade}.`
            : `${g.name} drills in the yard.`,
        );
      }
      continue;
    }

    if (a === 'SPAR') {
      const { leveled, grade } = addXp(g, Math.round(economy.sparXp * xpMul));
      g.mastery += 2;
      g.fatigue += 2;
      g.hpRatio = Math.max(0.25, g.hpRatio - 0.08);
      g.vitality = Math.max(0.15, g.hpRatio); // keep readiness alias in sync
      const chance = economy.sparInjuryChance * injMul * (g.fatigue >= 3 ? 1.5 : 1);
      if (rng.chance(chance)) {
        const severity = g.injury === 'NONE' ? 'minor' : 'serious';
        addInjury(g, {
          id: `spar-${g.id}-${state.day}`,
          part: 'ribs',
          severity,
          daysLeft: HEAL_DAYS[severity],
        });
        notes.push(`${g.name} sparring accident.`);
      } else {
        notes.push(
          leveled ? `${g.name} spars well — ${grade}.` : `${g.name} spars with the familia.`,
        );
      }
    }
  }
  return notes;
}
