/** Procedural identity — origins + personality traits (lean, purposeful). */

export type OriginId =
  | 'ITALIA'
  | 'GALLIA'
  | 'THRACIA'
  | 'AFRICA'
  | 'HISPANIA'
  | 'SYRIA'
  | 'GERMANIA'
  | 'GRAECIA';

export const ORIGINS: Record<
  OriginId,
  { id: OriginId; name: string; blurb: string }
> = {
  ITALIA: { id: 'ITALIA', name: 'Italia', blurb: 'Raised near the Tiber.' },
  GALLIA: { id: 'GALLIA', name: 'Gallia', blurb: 'Northern stock, hard winters.' },
  THRACIA: { id: 'THRACIA', name: 'Thracia', blurb: 'Hill-fighter blood.' },
  AFRICA: { id: 'AFRICA', name: 'Africa', blurb: 'Desert heat in the veins.' },
  HISPANIA: { id: 'HISPANIA', name: 'Hispania', blurb: 'Iberian stubbornness.' },
  SYRIA: { id: 'SYRIA', name: 'Syria', blurb: 'Eastern markets and dust.' },
  GERMANIA: { id: 'GERMANIA', name: 'Germania', blurb: 'Forest-bred strength.' },
  GRAECIA: { id: 'GRAECIA', name: 'Graecia', blurb: 'Palaestra manners.' },
};

export const ORIGIN_LIST = Object.keys(ORIGINS) as OriginId[];

export type TraitId =
  | 'PROUD'
  | 'LOYAL'
  | 'CRUEL'
  | 'STOIC'
  | 'AMBITIOUS'
  | 'SUPERSTITIOUS'
  | 'MERCIFUL'
  | 'HOTBLOODED';

export const TRAITS: Record<
  TraitId,
  {
    id: TraitId;
    name: string;
    /** Combat AI nudges */
    pursueBiasAdd: number;
    clinchPanicAdd: number;
    /** Soft social / morale hooks */
    moraleWin: number;
    moraleLoss: number;
    /** Injury constitution-ish (negative = tougher). */
    injuryChanceMul: number;
  }
> = {
  PROUD: {
    id: 'PROUD',
    name: 'Proud',
    pursueBiasAdd: 0.06,
    clinchPanicAdd: -0.04,
    moraleWin: 4,
    moraleLoss: -6,
    injuryChanceMul: 1,
  },
  LOYAL: {
    id: 'LOYAL',
    name: 'Loyal',
    pursueBiasAdd: 0,
    clinchPanicAdd: 0.02,
    moraleWin: 2,
    moraleLoss: -3,
    injuryChanceMul: 0.95,
  },
  CRUEL: {
    id: 'CRUEL',
    name: 'Cruel',
    pursueBiasAdd: 0.1,
    clinchPanicAdd: -0.06,
    moraleWin: 3,
    moraleLoss: -2,
    injuryChanceMul: 1.05,
  },
  STOIC: {
    id: 'STOIC',
    name: 'Stoic',
    pursueBiasAdd: -0.02,
    clinchPanicAdd: -0.08,
    moraleWin: 1,
    moraleLoss: -2,
    injuryChanceMul: 0.85,
  },
  AMBITIOUS: {
    id: 'AMBITIOUS',
    name: 'Ambitious',
    pursueBiasAdd: 0.08,
    clinchPanicAdd: 0.04,
    moraleWin: 5,
    moraleLoss: -5,
    injuryChanceMul: 1,
  },
  SUPERSTITIOUS: {
    id: 'SUPERSTITIOUS',
    name: 'Superstitious',
    pursueBiasAdd: -0.04,
    clinchPanicAdd: 0.08,
    moraleWin: 2,
    moraleLoss: -4,
    injuryChanceMul: 1.1,
  },
  MERCIFUL: {
    id: 'MERCIFUL',
    name: 'Merciful',
    pursueBiasAdd: -0.06,
    clinchPanicAdd: 0.06,
    moraleWin: 2,
    moraleLoss: -3,
    injuryChanceMul: 0.95,
  },
  HOTBLOODED: {
    id: 'HOTBLOODED',
    name: 'Hot-blooded',
    pursueBiasAdd: 0.14,
    clinchPanicAdd: -0.1,
    moraleWin: 3,
    moraleLoss: -7,
    injuryChanceMul: 1.15,
  },
};

export const TRAIT_LIST = Object.keys(TRAITS) as TraitId[];

export type BodyPart = 'head' | 'eye' | 'arm' | 'ribs' | 'knee' | 'hand';

export type InjurySeverity = 'minor' | 'serious' | 'critical';

export type RelationKind =
  | 'friend'
  | 'rival'
  | 'respect'
  | 'fear'
  | 'resent'
  | 'mentor';

export type FightStance = 'AGGRESSIVE' | 'BALANCED' | 'CAUTIOUS';

export type EventRole =
  | 'duel'
  | 'exhibition'
  | 'team'
  | 'championship'
  | 'revenge'
  | 'spectacle'
  | 'high_purse';
