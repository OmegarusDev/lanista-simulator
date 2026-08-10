/** Career economy — season length, costs, gates, RPG knobs. */
export const economy = {
  seasonDays: 14,
  startingDenarii: 160,
  startingVirtus: 0,
  startingRosterSize: 4,
  /** Base roster cap before Barracks. */
  baseRosterCap: 4,
  barracksBonus: 2,
  maxRosterHard: 8,
  /** Base food/oil per gladiator per resolved day. */
  upkeepPerGladiator: 8,
  /** Extra upkeep per gear grade point on roster. */
  upkeepPerGearGrade: 2,
  /** Legacy healCost kept for tests / cheap bandage reference. */
  healCost: 12,
  restDaysPerSeason: 2,
  virtusTier2: 8,
  virtusTier3: 20,
  /**
   * Starting kits — cover the main classic gates (Mur/Thr, Ret/Sec)
   * so day-1 boards are playable without Locked spam.
   */
  starterKits: ['MURMILLO', 'THRAEX', 'RETIARIUS', 'SECUTOR'] as const,
  /** XP from bout outcomes (per fighter in lineup). */
  xpWin: 18,
  xpDraw: 10,
  xpLoss: 8,
  xpForfeit: 2,
  fameWin: 3,
  fameDraw: 1,
  fameLoss: 0,
  trainXp: 6,
  sparXp: 10,
  sparInjuryChance: 0.18,
  trainInjuryChance: 0.08,
  palaestraInjuryMul: 0.55,
  palaestraXpMul: 1.25,
  infirmaryCostMul: 0.7,
  recruitMinPrice: 35,
  recruitMaxPrice: 110,
  /** Offline idle (Phase Z) — capped hours of soft recovery only. */
  idleMaxHours: 12,
  idleFatiguePerHour: 0.15,
  idleHpPerHour: 0.02,
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
  'Spartacus',
  'Crixus',
  'Flamma',
  'Priscus',
  'Verus',
  'Spiculus',
  'Columbus',
  'Tetraites',
] as const;
