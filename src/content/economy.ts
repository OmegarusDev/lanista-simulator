/** Thin career economy — season length, costs, gates. */
export const economy = {
  seasonDays: 12,
  startingDenarii: 140,
  startingVirtus: 0,
  startingRosterSize: 4,
  maxRoster: 6,
  /** Charged when ending a day (fought or rested). */
  upkeepPerGladiator: 8,
  healCost: 25,
  /** Rest days available per season (skip munera, still pay upkeep). */
  restDaysPerSeason: 2,
  /** Virtus thresholds for munera tier offers. */
  virtusTier2: 8,
  virtusTier3: 20,
  /**
   * Starting kits — cover the main classic gates (Mur/Thr, Ret/Sec)
   * so day-1 boards are playable without Locked spam.
   */
  starterKits: ['MURMILLO', 'THRAEX', 'RETIARIUS', 'SECUTOR'] as const,
} as const;

export const GLADIATOR_NAMES = [
  'Marcus',
  'Lucius',
  'Gaius',
  'Titus',
  'Quintus',
  'Felix',
  'Crispus',
  'Rufus',
  'Vindex',
  'Niger',
  'Albus',
  'Severus',
] as const;
