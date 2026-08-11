/**
 * Intention / poise tells — data-driven pose modifiers for sceneFighters.
 */
import type { Intention, PoiseTier } from '../domain/combat/types';

export interface TellPose {
  lean: number;
  lateral: number;
  hitch: number;
  guardOpen: number;
  height: number;
  rim: number;
}

const INTENTION_TELLS: Record<Intention, Omit<TellPose, 'height' | 'rim'>> = {
  NONE: { lean: 0, lateral: 0, hitch: 0, guardOpen: 0 },
  PRESS: { lean: 0.55, lateral: 0, hitch: 0, guardOpen: -0.1 },
  YIELD: { lean: -0.35, lateral: 0, hitch: 0, guardOpen: 0.35 },
  ANGLE: { lean: 0.1, lateral: 0.55, hitch: 0, guardOpen: 0 },
  INVITE: { lean: -0.15, lateral: 0, hitch: 0, guardOpen: 0.55 },
  FEINT: { lean: 0.25, lateral: 0.1, hitch: 0.7, guardOpen: 0.1 },
  RESET: { lean: 0, lateral: 0, hitch: 0, guardOpen: 0.15 },
};

const POISE_TELLS: Record<PoiseTier, { height: number; rim: number }> = {
  SOLID: { height: 1, rim: 0.35 },
  SOFT: { height: 0.94, rim: 0.55 },
  CRITICAL: { height: 0.86, rim: 0.85 },
  BROKEN: { height: 0.72, rim: 1.2 },
};

export function tellPose(intention: Intention, poiseTier: PoiseTier): TellPose {
  const i = INTENTION_TELLS[intention] ?? INTENTION_TELLS.NONE;
  const p = POISE_TELLS[poiseTier] ?? POISE_TELLS.SOLID;
  return { ...i, ...p };
}
