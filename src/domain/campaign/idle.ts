import { economy } from '../../content/economy';
import type { SeasonState } from './types';

/**
 * Phase Z — minimal capped offline recovery when reopening a save.
 * Not an earn engine; soft fatigue/HP only.
 */
export function applyOfflineIdle(state: SeasonState, now = Date.now()): string[] {
  const notes: string[] = [];
  if (!state.lastSeenAt || state.status !== 'ACTIVE') {
    state.lastSeenAt = now;
    return notes;
  }
  const hours = Math.min(
    economy.idleMaxHours,
    Math.max(0, (now - state.lastSeenAt) / (1000 * 60 * 60)),
  );
  state.lastSeenAt = now;
  if (hours < 0.5) return notes;

  let touched = 0;
  for (const g of state.roster) {
    if (g.retired) continue;
    const beforeF = g.fatigue;
    const beforeH = g.hpRatio;
    g.fatigue = Math.max(0, g.fatigue - hours * economy.idleFatiguePerHour);
    if (g.injury === 'NONE') {
      g.hpRatio = Math.min(1, g.hpRatio + hours * economy.idleHpPerHour);
    }
    if (g.fatigue < beforeF - 0.01 || g.hpRatio > beforeH + 0.01) touched += 1;
  }
  if (touched > 0) {
    notes.push(
      `While you were away (${hours.toFixed(1)}h), ${touched} gladiators eased their wounds.`,
    );
  }
  return notes;
}

export function touchLastSeen(state: SeasonState, now = Date.now()): void {
  state.lastSeenAt = now;
}
