/**
 * Personality-shaped randomness — the fighter's temperament and traits define
 * the NOISE ENVELOPE around every decision, not just a static bias.
 *
 * The engine stays fully seeded: the same seed, temperaments, and traits
 * reproduce the same fight. What changes is WHO the randomness belongs to —
 * a FEROX's rolls swing wide, a CAUTUS's hug the base, and the traits veto
 * or amplify specific decisions outright.
 */
import type { TraitId } from '../../content/identity';
import type { TemperamentId } from '../../content/rpg';
import type { SeededRNG } from '../rng';

export interface Personality {
  temperament: TemperamentId;
  traits: ReadonlySet<TraitId>;
  /** 0 = robot (CAUTUS + STOIC), 1 = wild (FEROX + HOTBLOODED). */
  volatility: number;
}

const TEMPERAMENT_VOLATILITY: Record<TemperamentId, number> = {
  FEROX: 0.8,
  CAUTUS: 0.15,
  HISTRIO: 0.7,
  FRAGILIS: 0.5,
};

const TRAIT_VOLATILITY: Partial<Record<TraitId, number>> = {
  HOTBLOODED: 0.25,
  STOIC: -0.3,
  AMBITIOUS: 0.1,
  SUPERSTITIOUS: 0.1,
};

export function personalityOf(
  temperament: TemperamentId,
  traits: readonly TraitId[] | undefined,
): Personality {
  const set = new Set(traits ?? []);
  let volatility = TEMPERAMENT_VOLATILITY[temperament] ?? 0.4;
  for (const t of set) {
    volatility += TRAIT_VOLATILITY[t] ?? 0;
  }
  return {
    temperament,
    traits: set,
    volatility: Math.max(0.05, Math.min(1, volatility)),
  };
}

const clamp = (n: number, a: number, b: number): number => Math.max(a, Math.min(b, n));

/**
 * The personality chance: the roll draws the noise that spreads the decision
 * threshold. Aggregate probability stays near `base`; the spread is
 * `volatility · scale`. Fully seeded and order-stable.
 */
export function personalityChance(
  rng: SeededRNG,
  base: number,
  personality: Personality,
  scale = 1,
): boolean {
  const noise = (rng.next() - 0.5) * 2;
  const spread = personality.volatility * 0.3 * scale;
  const threshold = clamp(base + noise * spread, 0.02, 0.98);
  return rng.chance(threshold);
}

/** SUPERSTITIOUS fighters ride the crowd: favor swings widen the envelope. */
export function crowdVolatility(personality: Personality, crowdFavor01: number): number {
  if (!personality.traits.has('SUPERSTITIOUS')) return personality.volatility;
  const swing = Math.abs(crowdFavor01 - 0.5) * 2; // 0..1 — favor or fury
  return clamp(personality.volatility + swing * 0.35, 0.05, 1);
}

// ————— Trait decision hooks (vetoes / amplifications) —————

/** PROUD never backs off while healthy; broke or hurt, pride cracks anyway. */
export function yieldAllowed(personality: Personality, hpRatio: number, broken: boolean): boolean {
  if (!personality.traits.has('PROUD')) return true;
  return broken || hpRatio < 0.5;
}

/** STOIC never feints — no theatrics, only honest work. */
export function feintAllowed(personality: Personality): boolean {
  return !personality.traits.has('STOIC');
}

/** Finish greed: who pushes to kill. */
export function finishBoost(personality: Personality, hpRatio: number): number {
  let b = 0;
  if (personality.traits.has('AMBITIOUS')) b += 0.15;
  if (personality.traits.has('CRUEL')) b += 0.12;
  if (personality.traits.has('PROUD') && hpRatio >= 0.5) b += 0.08;
  if (personality.traits.has('MERCIFUL')) b -= 0.12;
  return b;
}

/** How long a broken foe stays worth punishing (CRUEL drags it out). */
export function punishWindowMul(personality: Personality): number {
  let m = 1;
  if (personality.traits.has('CRUEL')) m += 0.35;
  if (personality.traits.has('MERCIFUL')) m -= 0.3;
  return Math.max(0.5, m);
}

/** Pride momentum: after losing an exchange, a PROUD fighter fights harder. */
export function prideMomentum(personality: Personality, lostExchange: boolean): number {
  if (!personality.traits.has('PROUD') || !lostExchange) return 0;
  return 0.12;
}

/** LOYAL fighters pile onto the threat their ally is already fighting. */
export function assistBias(personality: Personality): number {
  return personality.traits.has('LOYAL') ? 40 : 0;
}

/** FRAGILIS lets a lost exchange shake their confidence hard. */
export function fragilisShaken(personality: Personality, lostExchange: boolean): number {
  if (personality.temperament !== 'FRAGILIS' || !lostExchange) return 0;
  return 0.18;
}
