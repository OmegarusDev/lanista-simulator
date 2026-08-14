import { ARMATURA_LIST, type ArmaturaId } from '../../content/armatura';
import { BEASTS } from '../../content/beasts';
import { combatTuning } from '../../content/combat';
import { SeededRNG } from '../rng';
import { Fighter, resetFighterIds } from './fighter';
import { EntertainmentTracker, type CrowdShout } from './entertainment';
import type {
  CombatEvent,
  FighterSpawnSpec,
  MatchConfig,
  MatchResult,
  TeamSize,
} from './types';
import { maybeAbortWindup, runBrain, type BrainMaps } from './matchBrain';
import { resolveCuts } from './matchCuts';
import { checkEnd, decideByHp } from './matchEnd';
import { applyMotion, type FaceMode, type MotionMaps } from './matchMotion';
import { applyWhiffRhythm, updateStareRhythm } from './matchRhythm';
import { separateBodies } from './matchSeparate';

const NAMES_A = ['Marcus', 'Lucius', 'Gaius', 'Titus', 'Quintus', 'Secundus'];
const NAMES_B = ['Vindex', 'Felix', 'Crispus', 'Rufus', 'Niger', 'Albus'];

export class Match {
  readonly seed: number;
  readonly teamSize: TeamSize;
  readonly arenaWidth: number;
  readonly arenaHeight: number;
  readonly fighters: Fighter[] = [];
  readonly events: CombatEvent[] = [];

  tick = 0;
  result: MatchResult = 'ONGOING';
  private rng: SeededRNG;
  private footworkClock = new Map<number, number>();
  private commitClock = new Map<number, number>();
  private recentEvents: CombatEvent[] = [];
  private sideSign = new Map<number, number>();
  private faceMode = new Map<number, FaceMode>();
  private lateralBias = new Map<number, -1 | 0 | 1>();
  private stareTicks = 0;
  readonly entertainment = new EntertainmentTracker();
  private latestShout: CrowdShout | null = null;

  constructor(config: MatchConfig) {
    resetFighterIds();
    this.seed = config.seed;
    this.teamSize = config.teamSize;
    this.arenaWidth = config.arenaWidth;
    this.arenaHeight = config.arenaHeight;
    this.rng = new SeededRNG(config.seed);

    const t0Size = config.team0Size ?? config.teamSize;
    const t1Size = config.team1Size ?? config.teamSize;
    const raw0 =
      config.team0Specs ??
      (config.team0 ?? this.rollTeam()).map((a) => ({ armatura: a }) satisfies FighterSpawnSpec);
    const raw1 =
      config.team1Specs ??
      (config.team1 ?? this.rollTeam()).map((a) => ({ armatura: a }) satisfies FighterSpawnSpec);
    const t0Specs = raw0.slice(0, t0Size);
    const t1Specs = raw1.slice(0, t1Size);
    while (t0Specs.length < t0Size) {
      t0Specs.push({ armatura: this.rng.pick(ARMATURA_LIST) });
    }
    while (t1Specs.length < t1Size) {
      t1Specs.push({ armatura: this.rng.pick(ARMATURA_LIST) });
    }
    this.spawnTeam(0, t0Specs);
    this.spawnTeam(1, t1Specs);
  }

  private rollTeam(): ArmaturaId[] {
    return Array.from({ length: this.teamSize }, () => this.rng.pick(ARMATURA_LIST));
  }

  private spawnTeam(team: 0 | 1, specs: FighterSpawnSpec[]): void {
    const names = team === 0 ? NAMES_A : NAMES_B;
    const baseX = combatTuning.arenaCX + (team === 0 ? -140 : 140);
    const baseY = combatTuning.arenaCY;
    const spreadStep = specs.length >= 3 ? 36 : 42;
    for (let i = 0; i < specs.length; i++) {
      const spec = specs[i]!;
      const spread = (i - (specs.length - 1) / 2) * spreadStep;
      const x = baseX + (specs.length >= 3 ? (i - 1) * 8 * (team === 0 ? 1 : -1) : 0);
      const y = baseY + spread;
      const facing = team === 0 ? 0 : Math.PI;
      const isBeast = spec.kind === 'beast' && !!spec.beast;
      const armatura = spec.armatura ?? (isBeast ? 'MURMILLO' : this.rng.pick(ARMATURA_LIST));
      const defaultName = isBeast ? BEASTS[spec.beast!].name : this.rng.pick(names);
      const f = new Fighter(team, armatura, spec.name ?? defaultName, x, y, facing);
      f.applySpawnSpec(spec);
      // Opposite preferred orbits so mirrors shear instead of ramming
      f.orbitSide = team === 0 ? 1 : -1;
      this.fighters.push(f);
      this.footworkClock.set(f.id, this.rng.int(0, combatTuning.aiFootworkIntervalTicks));
      this.commitClock.set(f.id, this.rng.int(0, combatTuning.aiCommitIntervalTicks));
      this.sideSign.set(f.id, f.orbitSide);
      this.faceMode.set(f.id, 'ENEMY');
      this.lateralBias.set(f.id, 0);
    }
    this.entertainment.watch(this.fighters.map((f) => f.id));
  }

  getRecentEvents(): CombatEvent[] {
    return this.recentEvents;
  }

  clearRecentEvents(): void {
    this.recentEvents = [];
  }

  consumeCrowdShout(): CrowdShout | null {
    const s = this.latestShout;
    this.latestShout = null;
    return s;
  }

  crowdFavorFor(fighterId: number): number {
    return this.entertainment.favor01(fighterId);
  }

  teamCrowdFavor(team: 0 | 1): number {
    const scores = this.fighters
      .filter((f) => f.team === team)
      .map((f) => this.entertainment.score(f.id));
    return this.entertainment.teamFavor01(scores);
  }

  snapshots() {
    return this.fighters.map((f) => f.snapshot());
  }

  private brainMaps(): BrainMaps {
    return {
      footworkClock: this.footworkClock,
      commitClock: this.commitClock,
      sideSign: this.sideSign,
      faceMode: this.faceMode,
      lateralBias: this.lateralBias,
    };
  }

  private motionMaps(): MotionMaps {
    return {
      sideSign: this.sideSign,
      faceMode: this.faceMode,
      lateralBias: this.lateralBias,
    };
  }

  private pushEvent(
    kind: CombatEvent['kind'],
    actor: Fighter,
    target?: Fighter,
    amount?: number,
  ): void {
    const ev: CombatEvent = {
      kind,
      tick: this.tick,
      actorId: actor.id,
      targetId: target?.id,
      x: target?.x ?? actor.x,
      y: target?.y ?? actor.y,
      amount,
    };
    this.events.push(ev);
    this.recentEvents.push(ev);
  }

  step(): MatchResult {
    if (this.result !== 'ONGOING') return this.result;
    this.tick++;
    this.recentEvents = [];

    for (const f of this.fighters) {
      if (!f.alive) continue;
      f.tickTimers();
      f.clearIntentionIfExpired(this.tick);
      if (f.phase !== 'IDLE') f.advancePhase();
      if (f.attackFinish === 'WHIFF') {
        applyWhiffRhythm(f, this.fighters, this.tick, (n) => {
          this.stareTicks = n;
        });
        f.attackFinish = null;
      } else if (f.attackFinish === 'CONNECTED') {
        f.attackFinish = null;
      }
    }

    const maps = this.brainMaps();
    const push = this.pushEvent.bind(this);
    for (const f of this.fighters) {
      if (!f.alive || f.stunned) continue;
      maybeAbortWindup(f, this.fighters, this.tick, this.rng, push);
      runBrain(f, this.fighters, this.tick, this.rng, maps, push);
      applyMotion(f, this.fighters, this.motionMaps(), this.tick);
    }

    resolveCuts(this.fighters, this.tick, this.rng, push, (n) => {
      this.stareTicks = n;
    });
    this.stareTicks = updateStareRhythm(
      this.fighters,
      this.tick,
      this.stareTicks,
      this.rng,
    );
    separateBodies(this.fighters);
    const ended = checkEnd(this.fighters);
    if (ended) this.result = ended;

    const shout = this.entertainment.onEvents(this.recentEvents, this.tick, this.rng);
    if (shout) this.latestShout = shout;
    this.entertainment.tickPassive(this.fighters.filter((f) => f.alive).map((f) => f.id));
    // Momentum: each fighter feels the crowd behind their team.
    const favor0 = this.teamCrowdFavor(0);
    const favor1 = this.teamCrowdFavor(1);
    for (const f of this.fighters) {
      f.crowdFavor01 = f.team === 0 ? favor0 : favor1;
    }

    if (this.tick >= combatTuning.maxFightTicks && this.result === 'ONGOING') {
      this.result = decideByHp(this.fighters);
    }
    return this.result;
  }

  runToEnd(): MatchResult {
    while (this.result === 'ONGOING') this.step();
    return this.result;
  }
}

export function createQuickMatch(
  teamSize: TeamSize,
  seed: number,
  team0?: ArmaturaId[],
  team1?: ArmaturaId[],
  arenaWidth = 960,
  arenaHeight = 540,
  team0Specs?: FighterSpawnSpec[],
  team1Specs?: FighterSpawnSpec[],
  team0Size?: number,
  team1Size?: number,
): Match {
  return new Match({
    teamSize,
    seed,
    team0,
    team1,
    team0Specs,
    team1Specs,
    team0Size,
    team1Size,
    arenaWidth,
    arenaHeight,
  });
}
