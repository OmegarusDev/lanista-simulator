import type { Fighter } from './fighter';
import type { MatchResult } from './types';

/** Returns a terminal result if a team is wiped; otherwise null (bout continues). */
export function checkEnd(fighters: Fighter[]): MatchResult | null {
  const alive0 = fighters.some((f) => f.team === 0 && f.alive);
  const alive1 = fighters.some((f) => f.team === 1 && f.alive);
  if (!alive0 && !alive1) return 'DRAW';
  if (!alive0) return 'TEAM1';
  if (!alive1) return 'TEAM0';
  return null;
}

export function decideByHp(fighters: Fighter[]): MatchResult {
  let h0 = 0;
  let h1 = 0;
  for (const f of fighters) {
    if (f.team === 0) h0 += f.hp;
    else h1 += f.hp;
  }
  if (h0 === h1) return 'DRAW';
  return h0 > h1 ? 'TEAM0' : 'TEAM1';
}
