import type { ArmaturaId } from '../../content/armatura';
import type { BeastId } from '../../content/beasts';
import type {
  BodyPart,
  EventRole,
  FightStance,
  InjurySeverity,
  OriginId,
  RelationKind,
  TraitId,
} from '../../content/identity';
import type { MuneraKind, MuneraSlotReq, MuneraTier } from '../../content/munera';
import type { TeamSize } from '../combat/types';
import type {
  DayAssignment,
  DoctrinaId,
  FacilityId,
  GearGrade,
  GladiatorGrade,
  TemperamentId,
} from '../../content/rpg';

export type InjuryTier = 'NONE' | 'LIGHT' | 'SEVERE';

export interface BodyInjury {
  id: string;
  part: BodyPart;
  severity: InjurySeverity;
  daysLeft: number;
  permanent?: boolean;
  sourceDay?: number;
}

export interface HistoryBeat {
  day: number;
  text: string;
}

export interface RelationshipEdge {
  a: number;
  b: number;
  kind: RelationKind;
  /** -1..1 */
  intensity: number;
}

export interface FightOrders {
  stance: FightStance;
  /** Prefer weakest foe when multi. */
  targetPriority: 'nearest' | 'weakest';
  /** Request withdrawal / missio lean when badly losing. */
  withdrawRequested: boolean;
}

export const DEFAULT_FIGHT_ORDERS: FightOrders = {
  stance: 'BALANCED',
  targetPriority: 'nearest',
  withdrawRequested: false,
};

export interface Gladiator {
  id: number;
  name: string;
  armatura: ArmaturaId;
  /** 0–1 readiness — kept in sync with vitality. */
  hpRatio: number;
  /** Summary tier derived from injuries[]. */
  injury: InjuryTier;
  injuries: BodyInjury[];
  fatigue: number;
  wins: number;
  losses: number;
  xp: number;
  grade: GladiatorGrade;
  temperament: TemperamentId;
  traits: TraitId[];
  origin: OriginId;
  appearanceSeed: number;
  history: HistoryBeat[];
  morale: number;
  confidence: number;
  /** Constitution-ish 0.7–1.3 — injury resist / recovery. */
  constitution: number;
  /** Showmanship — entertainment bias. */
  showmanship: number;
  /** Grit — poise under pressure. */
  grit: number;
  /** Soft readiness alias of hpRatio. */
  vitality: number;
  fame: number;
  mastery: number;
  gearGrade: GearGrade;
  assignment: DayAssignment;
  retired?: boolean;
  age: number;
}

export interface MuneraOffer {
  instanceId: string;
  templateId: string;
  name: string;
  blurb: string;
  kind: MuneraKind;
  tier: MuneraTier;
  teamSize: TeamSize;
  purse: number;
  entryFee: number;
  virtusWin: number;
  virtusLose: number;
  playerSlots: MuneraSlotReq[];
  opponents: ArmaturaId[];
  eligible: boolean;
  location: string;
  editor: string;
  rivalName: string | null;
  contractId: string | null;
  minGrade?: GladiatorGrade;
  eventRole?: EventRole;
}

export interface RecruitOffer {
  id: string;
  name: string;
  armatura: ArmaturaId;
  grade: GladiatorGrade;
  temperament: TemperamentId;
  price: number;
  fame: number;
  age?: number;
  origin?: OriginId;
  traits?: TraitId[];
}

export interface SeasonContract {
  id: string;
  name: string;
  blurb: string;
  daysLeft: number;
  virtusBonus: number;
  denariiBonus: number;
  completed: boolean;
  failed: boolean;
  /** Optional concrete obligation. */
  requireWin?: boolean;
  rivalName?: string | null;
}

export interface SeasonRecord {
  wins: number;
  losses: number;
  draws: number;
  forfeits: number;
}

export interface SlateBout {
  id: string;
  kind: 'gladiator' | 'venatio';
  name: string;
  blurb: string;
  teamSize: TeamSize;
  schoolIds: number[];
  opponentArmaturae: ArmaturaId[];
  beastOpponents?: BeastId[];
  purse: number;
  entryFee: number;
  virtusWin: number;
  virtusLose: number;
  rivalName: string | null;
  status: 'pending' | 'watched' | 'simulated';
  simResult?: 'WIN' | 'LOSS' | 'DRAW';
}

export interface SeasonState {
  seed: number;
  day: number;
  denarii: number;
  virtus: number;
  restDaysLeft: number;
  nextGladiatorId: number;
  roster: Gladiator[];
  offers: MuneraOffer[];
  slate: SlateBout[];
  pendingNotes: string[];
  dayResolved: boolean;
  record: SeasonRecord;
  status: 'ACTIVE' | 'BROKE' | 'SEASON_END';
  lastAftermath: AftermathSummary | null;
  facilities: FacilityId[];
  market: RecruitOffer[];
  contracts: SeasonContract[];
  doctrina: DoctrinaId;
  rivalsBeaten: string[];
  retiredNames: string[];
  lastSeenAt: number;
  seasonIndex: number;
  relationships: RelationshipEdge[];
  pendingOrders: FightOrders;
}

export interface MissioVerdict {
  gladiatorId: number;
  name: string;
  entertainment: number;
  outcome: 'SPARE' | 'DEATH';
  lean: string;
}

export interface AftermathSummary {
  offerName: string;
  result: 'WIN' | 'LOSS' | 'DRAW' | 'FORFEIT';
  purseDelta: number;
  virtusDelta: number;
  injuries: { name: string; injury: InjuryTier; detail?: string }[];
  notes: string[];
  storyBeats?: string[];
  xpGains?: { name: string; xp: number; grade?: GladiatorGrade }[];
  missio?: MissioVerdict[];
  moraleNotes?: string[];
  relationNotes?: string[];
}

export interface LegacyState {
  patronage: number;
  seasonsCompleted: number;
  unlockedFacilities: FacilityId[];
  alumni: { name: string; armatura: ArmaturaId; fame: number; grade: GladiatorGrade }[];
  starterGradeBump: boolean;
}
