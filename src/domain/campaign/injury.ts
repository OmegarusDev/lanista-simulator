import type { BodyPart, InjurySeverity } from '../../content/identity';
import type { SeededRNG } from '../rng';
import type { BodyInjury, Gladiator, InjuryTier } from './types';

export const HEAL_DAYS: Record<InjurySeverity, number> = {
  minor: 2,
  serious: 4,
  critical: 7,
};

const PART_LABEL: Record<BodyPart, string> = {
  head: 'head',
  eye: 'eye',
  arm: 'arm',
  ribs: 'ribs',
  knee: 'knee',
  hand: 'hand',
};

export function injuryLabel(inj: BodyInjury): string {
  const sev =
    inj.severity === 'minor' ? 'bruised' : inj.severity === 'serious' ? 'damaged' : 'broken';
  const part = PART_LABEL[inj.part];
  if (inj.permanent) return `scarred ${part}`;
  return `${sev} ${part}`;
}

export function worstTier(injuries: readonly BodyInjury[]): InjuryTier {
  if (injuries.some((i) => i.severity === 'critical' || i.permanent)) return 'SEVERE';
  if (injuries.some((i) => i.severity === 'serious')) return 'LIGHT';
  if (injuries.length) return 'LIGHT';
  return 'NONE';
}

export function syncInjuryTier(g: Gladiator): void {
  g.injury = worstTier(g.injuries);
}

/** Combat spawn modifiers from body injuries. */
export function injuryCombatMods(injuries: readonly BodyInjury[]): {
  pools: number;
  damage: number;
  caution: number;
  measureErr: number;
} {
  let pools = 1;
  let damage = 1;
  let caution = 0;
  let measureErr = 0;
  for (const inj of injuries) {
    const w = inj.severity === 'minor' ? 0.4 : inj.severity === 'serious' ? 0.75 : 1;
    switch (inj.part) {
      case 'knee':
        pools -= 0.06 * w;
        caution += 0.08 * w;
        break;
      case 'arm':
      case 'hand':
        damage -= 0.08 * w;
        pools -= 0.03 * w;
        break;
      case 'eye':
        measureErr += 0.1 * w;
        caution += 0.05 * w;
        break;
      case 'head':
        pools -= 0.05 * w;
        caution += 0.1 * w;
        break;
      case 'ribs':
        pools -= 0.07 * w;
        damage -= 0.03 * w;
        break;
    }
  }
  return {
    pools: Math.max(0.55, pools),
    damage: Math.max(0.6, damage),
    caution,
    measureErr,
  };
}

const PARTS: BodyPart[] = ['head', 'eye', 'arm', 'ribs', 'knee', 'hand'];

export function rollFightInjury(
  rng: SeededRNG,
  opts: {
    lost: boolean;
    draw: boolean;
    chanceMul?: number;
    sourceDay?: number;
  },
): BodyInjury | null {
  const base = opts.lost ? 0.48 : opts.draw ? 0.18 : 0.1;
  const chance = Math.min(0.85, base * (opts.chanceMul ?? 1));
  if (!rng.chance(chance)) return null;
  const part = rng.pick(PARTS);
  let severity: InjurySeverity = 'minor';
  if (opts.lost && rng.chance(0.45)) severity = 'serious';
  if (opts.lost && rng.chance(0.18)) severity = 'critical';
  if (!opts.lost && rng.chance(0.2)) severity = 'serious';
  const permanent = severity === 'critical' && rng.chance(0.22);
  return {
    id: `inj-${rng.int(1, 1e9)}`,
    part,
    severity,
    daysLeft: permanent ? 99 : HEAL_DAYS[severity],
    permanent: permanent || undefined,
    sourceDay: opts.sourceDay,
  };
}

export function addInjury(g: Gladiator, inj: BodyInjury): void {
  const existing = g.injuries.find((x) => x.part === inj.part && !x.permanent);
  if (existing) {
    if (
      severityRank(inj.severity) >= severityRank(existing.severity) ||
      inj.permanent
    ) {
      existing.severity = inj.severity;
      existing.daysLeft = Math.max(existing.daysLeft, inj.daysLeft);
      if (inj.permanent) existing.permanent = true;
    }
  } else {
    g.injuries.push(inj);
  }
  syncInjuryTier(g);
  g.vitality = Math.max(0.15, g.vitality - (inj.severity === 'critical' ? 0.25 : inj.severity === 'serious' ? 0.15 : 0.08));
  g.hpRatio = g.vitality;
}

function severityRank(s: InjurySeverity): number {
  return s === 'minor' ? 1 : s === 'serious' ? 2 : 3;
}

/** Advance healing one day (medicus / rest callers may pass bonus). */
export function tickInjuries(g: Gladiator, healBonus = 0): string[] {
  const notes: string[] = [];
  for (let i = g.injuries.length - 1; i >= 0; i--) {
    const inj = g.injuries[i]!;
    if (inj.permanent) continue;
    inj.daysLeft -= 1 + healBonus;
    if (inj.daysLeft <= 0) {
      notes.push(`${g.name}'s ${injuryLabel(inj)} heals.`);
      g.injuries.splice(i, 1);
    }
  }
  syncInjuryTier(g);
  return notes;
}

export function worsenRandomInjury(g: Gladiator, rng: SeededRNG): string | null {
  const candidates = g.injuries.filter((i) => !i.permanent && i.severity !== 'critical');
  if (!candidates.length) return null;
  const inj = rng.pick(candidates);
  if (inj.severity === 'minor') inj.severity = 'serious';
  else {
    inj.severity = 'critical';
    if (rng.chance(0.15)) inj.permanent = true;
  }
  inj.daysLeft = HEAL_DAYS[inj.severity];
  syncInjuryTier(g);
  return `${g.name}'s ${PART_LABEL[inj.part]} worsens (${inj.severity}).`;
}
