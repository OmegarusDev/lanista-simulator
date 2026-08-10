import type { CombatEvent, CombatEventKind } from './types';
import type { SeededRNG } from '../rng';

/** Points added to a fighter's entertainment tally by event role. */
const ACTOR_SCORE: Partial<Record<CombatEventKind, number>> = {
  HIT: 12,
  POISE_BREAK: 22,
  TIP_CATCH: 18,
  SIDESTEP: 10,
  GUARD: 4,
  STUMBLE: 6,
  ABORT: 3,
  KO: 28,
};

const TARGET_SCORE: Partial<Record<CombatEventKind, number>> = {
  HIT: 2,
  GUARD: 3,
  SIDESTEP: 2,
  STUMBLE: -2,
  KO: -8,
};

export interface CrowdShout {
  text: string;
  /** Absolute match tick when spawned */
  tick: number;
  /** Design-space life in frames (fight scene countdown). */
  life: number;
}

export interface EntertainmentReport {
  byFighterId: Map<number, number>;
  shouts: CrowdShout[];
}

const SHOUT_LINES: Partial<Record<CombatEventKind, string[]>> = {
  HIT: ['They cheer the cut!', 'A clean blow!', 'The sand drinks!', 'The beast strikes!', 'Claws and steel!'],
  POISE_BREAK: ['His guard shatters!', 'The crowd gasps!', 'Posture broken!', 'The animal drives him back!'],
  TIP_CATCH: ['Entangled!', 'The net sings!', 'Caught!'],
  SIDESTEP: ['Nimble!', 'He slips away!', 'Light feet!', 'It lunges past!'],
  KO: ['Down!', 'He falls!', 'The arena holds its breath!', 'The beast has him!'],
  GUARD: ['Steel rings!', 'Held!'],
};

/** Extra venatio color when a KO involves a beast actor (caller may pass). */
export const BEAST_SHOUTS = [
  'The benches roar for blood!',
  'Venatio!',
  'The animal thrashes!',
  'No shield saves him!',
];

export class EntertainmentTracker {
  private scores = new Map<number, number>();
  private shouts: CrowdShout[] = [];
  private lastShoutTick = -999;
  private passiveTicks = new Map<number, number>();

  /** Ensure fighters exist in the map. */
  watch(ids: number[]): void {
    for (const id of ids) {
      if (!this.scores.has(id)) this.scores.set(id, 0);
      if (!this.passiveTicks.has(id)) this.passiveTicks.set(id, 0);
    }
  }

  onEvents(events: CombatEvent[], tick: number, rng: SeededRNG): CrowdShout | null {
    let shout: CrowdShout | null = null;
    for (const ev of events) {
      const actorGain = ACTOR_SCORE[ev.kind] ?? 0;
      if (actorGain !== 0) {
        this.add(ev.actorId, actorGain);
        this.passiveTicks.set(ev.actorId, 0);
      }
      if (ev.targetId != null) {
        const tGain = TARGET_SCORE[ev.kind] ?? 0;
        if (tGain !== 0) this.add(ev.targetId, tGain);
        this.passiveTicks.set(ev.targetId, 0);
      }

      const lines = SHOUT_LINES[ev.kind];
      if (
        lines &&
        lines.length &&
        actorGain >= 10 &&
        tick - this.lastShoutTick >= 45 &&
        rng.chance(0.55)
      ) {
        shout = { text: rng.pick(lines), tick, life: 90 };
        this.shouts.push(shout);
        this.lastShoutTick = tick;
      }
    }
    return shout;
  }

  /** Soft decay for inactivity — crowd gets bored. */
  tickPassive(aliveIds: number[]): void {
    for (const id of aliveIds) {
      const p = (this.passiveTicks.get(id) ?? 0) + 1;
      this.passiveTicks.set(id, p);
      if (p > 90 && p % 30 === 0) this.add(id, -3);
    }
  }

  add(id: number, delta: number): void {
    this.scores.set(id, (this.scores.get(id) ?? 0) + delta);
  }

  score(id: number): number {
    return this.scores.get(id) ?? 0;
  }

  /** 0–1 crowd favor for UI lean. */
  favor01(id: number): number {
    const s = this.score(id);
    // Map roughly -20..80 → 0..1
    return Math.max(0, Math.min(1, (s + 20) / 100));
  }

  /** Team average entertainment mapped to 0–1 (same scale as favor01). */
  teamFavor01(teamScores: number[]): number {
    if (!teamScores.length) return 0.5;
    const avg = teamScores.reduce((a, b) => a + b, 0) / teamScores.length;
    return Math.max(0, Math.min(1, (avg + 20) / 100));
  }

  report(): EntertainmentReport {
    return { byFighterId: new Map(this.scores), shouts: [...this.shouts] };
  }
}

/**
 * Chance the crowd grants missio (spare). Entertainment is primary; fame helps; RNG jitters.
 */
export function missioSpareChance(entertainment: number, fame: number): number {
  const base = 0.22 + entertainment / 140 + Math.min(0.18, fame * 0.02);
  return Math.max(0.08, Math.min(0.92, base));
}

export function rollMissio(
  entertainment: number,
  fame: number,
  rng: SeededRNG,
): { outcome: 'SPARE' | 'DEATH'; chance: number; roll: number } {
  const chance = missioSpareChance(entertainment, fame);
  const roll = rng.next();
  // Small extra jitter already inside chance band via roll
  return {
    outcome: roll < chance ? 'SPARE' : 'DEATH',
    chance,
    roll,
  };
}
