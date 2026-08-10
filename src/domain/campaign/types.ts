import type { ArmaturaId } from '../../content/armatura';
import type { MuneraKind, MuneraSlotReq, MuneraTier, TeamSize } from '../../content/munera';
import type {
  DayAssignment,
  DoctrinaId,
  FacilityId,
  GearGrade,
  GladiatorGrade,
  TemperamentId,
} from '../../content/rpg';

export type InjuryTier = 'NONE' | 'LIGHT' | 'SEVERE';

export interface Gladiator {
  id: number;
  name: string;
  armatura: ArmaturaId;
  /** 0–1 readiness; heal restores toward 1. */
  hpRatio: number;
  injury: InjuryTier;
  fatigue: number;
  wins: number;
  losses: number;
  /** Career RPG */
  xp: number;
  grade: GladiatorGrade;
  temperament: TemperamentId;
  fame: number;
  /** Sessions in current armatura. */
  mastery: number;
  gearGrade: GearGrade;
  assignment: DayAssignment;
  /** Soft flag — retired from active roster (kept in records). */
  retired?: boolean;
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
  /** Roster can field the class gates today. */
  eligible: boolean;
  /** Flavor */
  location: string;
  editor: string;
  rivalName: string | null;
  /** Optional multi-day contract id. */
  contractId: string | null;
  minGrade?: GladiatorGrade;
}

export interface RecruitOffer {
  id: string;
  name: string;
  armatura: ArmaturaId;
  grade: GladiatorGrade;
  temperament: TemperamentId;
  price: number;
  fame: number;
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
}

export interface SeasonRecord {
  wins: number;
  losses: number;
  draws: number;
  forfeits: number;
}

export interface SeasonState {
  seed: number;
  day: number;
  denarii: number;
  virtus: number;
  restDaysLeft: number;
  nextGladiatorId: number;
  roster: Gladiator[];
  /** Offers for current day (rerolled on advance). */
  offers: MuneraOffer[];
  /** True after a munera or rest resolved today. */
  dayResolved: boolean;
  record: SeasonRecord;
  /** Set when insolvent or season finished. */
  status: 'ACTIVE' | 'BROKE' | 'SEASON_END';
  lastAftermath: AftermathSummary | null;
  /** RPG / ludus */
  facilities: FacilityId[];
  market: RecruitOffer[];
  contracts: SeasonContract[];
  doctrina: DoctrinaId;
  rivalsBeaten: string[];
  retiredNames: string[];
  /** Unix ms — for deferred idle recovery. */
  lastSeenAt: number;
  seasonIndex: number;
}

export interface AftermathSummary {
  offerName: string;
  result: 'WIN' | 'LOSS' | 'DRAW' | 'FORFEIT';
  purseDelta: number;
  virtusDelta: number;
  injuries: { name: string; injury: InjuryTier }[];
  notes: string[];
  xpGains?: { name: string; xp: number; grade?: GladiatorGrade }[];
}

/** Persistent between seasons (patronage). */
export interface LegacyState {
  patronage: number;
  seasonsCompleted: number;
  unlockedFacilities: FacilityId[];
  alumni: { name: string; armatura: ArmaturaId; fame: number; grade: GladiatorGrade }[];
  starterGradeBump: boolean;
}
