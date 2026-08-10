import { TRAITS, type TraitId } from '../../content/identity';
import type { Gladiator } from './types';

export function clampMorale(n: number): number {
  return Math.max(0, Math.min(100, n));
}

export function clampConfidence(n: number): number {
  return Math.max(0, Math.min(100, n));
}

export function traitMoraleDelta(traits: readonly TraitId[], won: boolean): number {
  let d = 0;
  for (const t of traits) {
    const def = TRAITS[t];
    d += won ? def.moraleWin : def.moraleLoss;
  }
  return d / Math.max(1, traits.length);
}

export function applyFightMorale(
  g: Gladiator,
  opts: { won: boolean; draw: boolean; forfeited: boolean; deathOnRoster: boolean },
): void {
  if (opts.forfeited) {
    g.morale = clampMorale(g.morale - 8);
    g.confidence = clampConfidence(g.confidence - 10);
    return;
  }
  if (opts.draw) {
    g.morale = clampMorale(g.morale - 2 + traitMoraleDelta(g.traits, false) * 0.25);
    g.confidence = clampConfidence(g.confidence - 1);
  } else if (opts.won) {
    g.morale = clampMorale(g.morale + 6 + traitMoraleDelta(g.traits, true) * 0.5);
    g.confidence = clampConfidence(g.confidence + 8);
  } else {
    g.morale = clampMorale(g.morale - 8 + traitMoraleDelta(g.traits, false) * 0.5);
    g.confidence = clampConfidence(g.confidence - 10);
  }
  if (opts.deathOnRoster) g.morale = clampMorale(g.morale - 12);
}

export function applyPayStress(g: Gladiator, brokeRisk: boolean): void {
  if (brokeRisk) g.morale = clampMorale(g.morale - 5);
}

/** AI / combat nudges from morale & confidence (0–100). */
export function moraleCombatMods(g: Gladiator): {
  pursueBiasAdd: number;
  clinchPanicAdd: number;
  pools: number;
} {
  const m = (g.morale - 50) / 50;
  const c = (g.confidence - 50) / 50;
  return {
    pursueBiasAdd: m * 0.06 + c * 0.05,
    clinchPanicAdd: -m * 0.05 - c * 0.04,
    pools: Math.max(0.85, 1 + m * 0.04 + c * 0.03),
  };
}
