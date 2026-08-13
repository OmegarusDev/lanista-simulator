/**
 * Representation contract — typed draw model for the WebGL stage.
 * GL never reaches into Match privately; App/scenes map snapshots → this.
 */
import type { ArmaturaId } from '../content/armatura';
import type { BeastId } from '../content/beasts';
import { ARMATURA_LOADOUTS, loadoutPartIds, type KitPartId } from '../content/kitPieces';
import type {
  ActionKind,
  CombatantKind,
  FighterSnapshot,
  Intention,
  Phase,
  PoiseTier,
  TeamId,
} from '../domain/combat/types';

export type ActionPhaseDraw = Phase;

export interface FighterDraw {
  id: number;
  team: TeamId;
  x: number;
  y: number;
  facing: number;
  alive: boolean;
  kind: CombatantKind;
  armatura: ArmaturaId;
  beastId: BeastId | null;
  /** Resolved kit part ids (override or stock loadout). */
  parts: KitPartId[];
  appearanceSeed: number;
  intention: Intention;
  poiseTier: PoiseTier;
  hpRatio: number;
  staminaRatio: number;
  poiseRatio: number;
  action: ActionKind;
  actionPhase: ActionPhaseDraw;
  phaseT: number;
  phaseMax: number;
  guarding: boolean;
  poiseBroken: boolean;
  stunned: boolean;
  selected: boolean;
  flash: number;
  name: string;
  /** Footwork state — the render swings the weapon the same arc collision does. */
  footwork: string;
}

export interface DustHint {
  x: number;
  y: number;
  kind: 'dust' | 'blood' | 'spark' | 'shatter';
  life: number;
}

export interface SandStainDraw {
  x: number;
  y: number;
  radius: number;
  /** 0..1 opacity / darkness. */
  strength: number;
  lifeRatio: number;
}

export interface StageDrawModel {
  seed: number;
  shake: number;
  fighters: FighterDraw[];
  dustHints?: DustHint[];
  /** Persistent blood stains on the sand (arena pass). */
  stains?: SandStainDraw[];
  /** Crowd favor 0..1 bias toward team0 when set. */
  favor?: number;
  /** Ambient mood for non-fight modes. */
  mood?: 'rest' | 'preview' | 'fight' | 'win' | 'loss' | 'quiet';
}

export type ToFighterDrawOpts = {
  selected?: boolean;
  /** When snapshot lacks appearanceSeed (lab stock), derive from id. */
  appearanceSeed?: number;
};

/** Stock part ids for an armatura (beasts get empty kit — mesh set is separate). */
export function resolveParts(
  armatura: ArmaturaId,
  kind: CombatantKind,
  partsOverride?: readonly string[] | null,
): KitPartId[] {
  if (kind === 'beast') return [];
  if (partsOverride?.length) return [...partsOverride];
  const loadout = ARMATURA_LOADOUTS[armatura];
  return loadout ? loadoutPartIds(loadout) : [];
}

export function toFighterDraw(
  f: FighterSnapshot,
  opts: ToFighterDrawOpts = {},
): FighterDraw {
  const appearanceSeed =
    opts.appearanceSeed ??
    (typeof (f as FighterSnapshot & { appearanceSeed?: number }).appearanceSeed === 'number'
      ? (f as FighterSnapshot & { appearanceSeed: number }).appearanceSeed
      : f.id * 9973);

  return {
    id: f.id,
    team: f.team,
    x: f.x,
    y: f.y,
    facing: f.facing,
    alive: f.alive,
    kind: f.kind,
    armatura: f.armatura,
    beastId: f.beastId,
    parts: resolveParts(f.armatura, f.kind, f.partsOverride),
    appearanceSeed,
    intention: f.intention,
    poiseTier: f.poiseTier,
    hpRatio: f.maxHp > 0 ? f.hp / f.maxHp : 0,
    staminaRatio: f.maxStamina > 0 ? f.stamina / f.maxStamina : 0,
    poiseRatio: f.maxPoise > 0 ? f.poise / f.maxPoise : 0,
    action: f.action,
    actionPhase: f.phase,
    phaseT: f.phaseT,
    phaseMax: f.phaseMax,
    guarding: f.guarding,
    poiseBroken: f.poiseBroken,
    stunned: f.stunned,
    selected: opts.selected === true,
    flash: f.flash,
    name: f.name,
    footwork: f.footwork,
  };
}

export function toStageDrawModel(
  fighters: readonly FighterSnapshot[],
  opts: {
    seed: number;
    shake?: number;
    selectedId?: number | null;
    appearanceSeeds?: ReadonlyMap<number, number>;
    dustHints?: DustHint[];
    stains?: SandStainDraw[];
    favor?: number;
    mood?: StageDrawModel['mood'];
  },
): StageDrawModel {
  return {
    seed: opts.seed,
    shake: opts.shake ?? 0,
    favor: opts.favor,
    mood: opts.mood,
    dustHints: opts.dustHints,
    stains: opts.stains,
    fighters: fighters.map((f) =>
      toFighterDraw(f, {
        selected: opts.selectedId === f.id,
        appearanceSeed: opts.appearanceSeeds?.get(f.id),
      }),
    ),
  };
}

export function emptyStageDrawModel(seed = 1, mood: StageDrawModel['mood'] = 'quiet'): StageDrawModel {
  return { seed, shake: 0, fighters: [], mood };
}
