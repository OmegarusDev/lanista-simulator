import type { ArmaturaId } from '../../content/armatura';
import type { BeastId } from '../../content/beasts';

export type TeamId = 0 | 1;
export type CombatantKind = 'gladiator' | 'beast';
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
  kind: CombatantKind;
  armatura: ArmaturaId;
  beastId: BeastId | null;
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
  /** Kit piece ids when spawn used partsOverride — drives lookFromParts. */
  partsOverride?: string[];
  /** Career / lab appearance seed for hue/scar/bulk variation. */
  appearanceSeed?: number;
}

/** Campaign supports up to 3v3; Instant Match supports 1–3 as well. */
export type TeamSize = 1 | 2 | 3;

/** Lab / career bout flavor — drives team generation, not Match.step. */
export type MatchKind = 'matchup' | 'venatio';

/** Optional career / lab spawn overrides applied after class kit. */
export interface FighterSpawnSpec {
  kind?: CombatantKind;
  /** Required for gladiators; ignored for beasts (placeholder kit). */
  armatura?: ArmaturaId;
  beast?: BeastId;
  name?: string;
  /** Optional future armory hook — part ids assembled before mods. */
  partsOverride?: string[];
  /** Visual identity seed — threaded from career gladiator. */
  appearanceSeed?: number;
  hpMul?: number;
  staminaMul?: number;
  poiseMul?: number;
  damageMul?: number;
  attackStaminaMul?: number;
  pursueBiasAdd?: number;
  clinchPanicAdd?: number;
  circleArcAdd?: number;
  /** Fraction of max HP at bout start (after pool scale). */
  startHpRatio?: number;
  /** Lineup Weak — prefer low-HP threats. */
  preferWeakest?: boolean;
  /** Lineup Withdraw — caution + missio entertainment lean. */
  withdrawLean?: boolean;
}

export interface MatchConfig {
  teamSize: TeamSize;
  seed: number;
  team0?: ArmaturaId[];
  team1?: ArmaturaId[];
  /** When set, overrides team0 kits + names + career mods. */
  team0Specs?: FighterSpawnSpec[];
  team1Specs?: FighterSpawnSpec[];
  arenaWidth: number;
  arenaHeight: number;
}

/**
 * Launch DTO for Instant Match / career bouts — mapped to MatchConfig in FightScene.
 * Not absorbed into MatchConfig (arena size is scene-owned).
 */
export interface SandboxConfig {
  teamSize: TeamSize;
  seed: number;
  team0: ArmaturaId[];
  team1: ArmaturaId[];
  team0Specs?: FighterSpawnSpec[];
  team1Specs?: FighterSpawnSpec[];
}

export type MatchResult = 'ONGOING' | 'TEAM0' | 'TEAM1' | 'DRAW';
