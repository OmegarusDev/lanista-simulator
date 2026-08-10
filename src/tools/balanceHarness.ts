/**
 * Headless balance harness — batch seeded fights across armatura matchups.
 * Run: npm run sim:balance
 */
import { ARMATURA_LIST, type ArmaturaId } from '../content/armatura';
import { createQuickMatch } from '../domain/combat/match';
import type { MatchResult } from '../domain/combat/types';

export interface MatchupStat {
  a: ArmaturaId;
  b: ArmaturaId;
  fights: number;
  aWins: number;
  bWins: number;
  draws: number;
  avgTicks: number;
}

export interface BalanceReport {
  fights: number;
  matchups: MatchupStat[];
  winRates: { armatura: ArmaturaId; winRate: number; fights: number }[];
}

export function runBalanceHarness(opts?: {
  seedsPerPair?: number;
  baseSeed?: number;
}): BalanceReport {
  const seedsPerPair = opts?.seedsPerPair ?? 40;
  const baseSeed = opts?.baseSeed ?? 20260810;
  const stats = new Map<string, MatchupStat>();

  const keyOf = (a: ArmaturaId, b: ArmaturaId) => `${a}|${b}`;

  for (let i = 0; i < ARMATURA_LIST.length; i++) {
    for (let j = i + 1; j < ARMATURA_LIST.length; j++) {
      const a = ARMATURA_LIST[i]!;
      const b = ARMATURA_LIST[j]!;
      const st: MatchupStat = {
        a,
        b,
        fights: 0,
        aWins: 0,
        bWins: 0,
        draws: 0,
        avgTicks: 0,
      };
      let tickSum = 0;
      for (let s = 0; s < seedsPerPair; s++) {
        const seed = (baseSeed + i * 9973 + j * 131 + s * 17) >>> 0;
        const m = createQuickMatch(1, seed, [a], [b]);
        const result: MatchResult = m.runToEnd();
        st.fights++;
        tickSum += m.tick;
        if (result === 'TEAM0') st.aWins++;
        else if (result === 'TEAM1') st.bWins++;
        else st.draws++;
      }
      st.avgTicks = tickSum / st.fights;
      stats.set(keyOf(a, b), st);
    }
  }

  const byArm = new Map<ArmaturaId, { wins: number; fights: number }>();
  for (const id of ARMATURA_LIST) byArm.set(id, { wins: 0, fights: 0 });

  for (const st of stats.values()) {
    const aa = byArm.get(st.a)!;
    const bb = byArm.get(st.b)!;
    aa.fights += st.fights;
    bb.fights += st.fights;
    aa.wins += st.aWins;
    bb.wins += st.bWins;
  }

  const matchups = [...stats.values()].sort(
    (x, y) => Math.abs(y.aWins / y.fights - 0.5) - Math.abs(x.aWins / x.fights - 0.5),
  );

  return {
    fights: matchups.reduce((s, m) => s + m.fights, 0),
    matchups,
    winRates: ARMATURA_LIST.map((armatura) => {
      const r = byArm.get(armatura)!;
      return {
        armatura,
        winRate: r.fights ? r.wins / r.fights : 0,
        fights: r.fights,
      };
    }).sort((a, b) => b.winRate - a.winRate),
  };
}

function formatReport(report: BalanceReport): string {
  const lines: string[] = [];
  lines.push(`Lanista balance harness — ${report.fights} fights`);
  lines.push('');
  lines.push('Win rates (higher = stronger):');
  for (const r of report.winRates) {
    lines.push(
      `  ${r.armatura.padEnd(14)} ${(r.winRate * 100).toFixed(1)}%  (n=${r.fights})`,
    );
  }
  lines.push('');
  lines.push('Most skewed matchups:');
  for (const m of report.matchups.slice(0, 12)) {
    const aw = ((m.aWins / m.fights) * 100).toFixed(0);
    const bw = ((m.bWins / m.fights) * 100).toFixed(0);
    lines.push(
      `  ${m.a} vs ${m.b}: ${aw}/${bw} (draws ${m.draws}, avgTicks ${m.avgTicks | 0})`,
    );
  }
  return lines.join('\n');
}

/** CLI entry — call from `npm run sim:balance`. */
export function main(): void {
  const report = runBalanceHarness({ seedsPerPair: 36 });
  console.log(formatReport(report));
}
