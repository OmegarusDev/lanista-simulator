import type { ArmaturaId } from '../../content/armatura';
import type { MuneraKind, MuneraSlotReq, MuneraTier, TeamSize } from '../../content/munera';

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
}

export interface AftermathSummary {
  offerName: string;
  result: 'WIN' | 'LOSS' | 'DRAW' | 'FORFEIT';
  purseDelta: number;
  virtusDelta: number;
  injuries: { name: string; injury: InjuryTier }[];
  notes: string[];
}
