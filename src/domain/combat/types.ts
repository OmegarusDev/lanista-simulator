import type { ArmaturaId } from '../../content/armatura';

export type TeamId = 0 | 1;
export type ActionKind = 'NONE' | 'ATTACK' | 'GUARD' | 'SIDESTEP';
export type Phase = 'IDLE' | 'WINDUP' | 'ACTIVE' | 'RECOVER';
export type Footwork = 'HOLD' | 'CLOSE' | 'DISENGAGE' | 'CIRCLE_L' | 'CIRCLE_R';

/** First-class bout intention — shifts d*, cut urge, facing, duration. */
export type Intention = 'NONE' | 'PRESS' | 'YIELD' | 'ANGLE' | 'INVITE' | 'FEINT' | 'RESET';

/** Soft poise bands before full break. */
export type PoiseTier = 'SOLID' | 'SOFT' | 'CRITICAL' | 'BROKEN';

export type CombatEventKind =
  | 'HIT'
  | 'GUARD'
  | 'SIDESTEP'
  | 'STUMBLE'
  | 'POISE_BREAK'
  | 'TIP_CATCH'
  | 'KO'
  | 'ABORT';

export interface CombatEvent {
  kind: CombatEventKind;
  tick: number;
  actorId: number;
  targetId?: number;
  x: number;
  y: number;
  amount?: number;
}

export interface FighterSnapshot {
  id: number;
  team: TeamId;
  armatura: ArmaturaId;
  name: string;
  x: number;
  y: number;
  /** Radians; 0 = east, π/2 = south */
  facing: number;
  hp: number;
  maxHp: number;
  stamina: number;
  maxStamina: number;
  poise: number;
  maxPoise: number;
  action: ActionKind;
  phase: Phase;
  phaseT: number;
  phaseMax: number;
  footwork: Footwork;
  intention: Intention;
  desiredDist: number;
  poiseTier: PoiseTier;
  stunned: boolean;
  tangled: boolean;
  poiseBroken: boolean;
  guarding: boolean;
  alive: boolean;
  flash: number;
}

/** Campaign supports up to 3v3; Instant Match sandbox stays 1v1/2v2. */
export type TeamSize = 1 | 2 | 3;

export interface MatchConfig {
  teamSize: TeamSize;
  seed: number;
  team0?: ArmaturaId[];
  team1?: ArmaturaId[];
  arenaWidth: number;
  arenaHeight: number;
}

export type MatchResult = 'ONGOING' | 'TEAM0' | 'TEAM1' | 'DRAW';
