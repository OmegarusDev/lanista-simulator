/** Global combat tuning (60Hz ticks unless noted). */
export const combatTuning = {
  tickRate: 60,
  staminaRegenPerTick: 0.1,
  staminaRegenHolding: 0.018,

  /**
   * Poise — cracks in a short exchange, but broken fighters must be able to
   * scramble out: hits while already broken do NOT refresh the regen delay,
   * and recovery once started is brisk up to restoreRatio.
   */
  /** Ticks after a chip before refill (solid/soft) — one phrase, not forever */
  poiseRegenDelay: 90,
  /** Normal refill between exchanges */
  poiseRegenPerTick: 1.05,
  /** After break: shorter delay then snap toward restore threshold */
  poiseBrokenRegenDelay: 36,
  poiseBrokenRegenPerTick: 1.85,
  /** Global scale on (weaponDamage * class poiseMul) → poise damage */
  poiseDamageScale: 1.85,
  /** Scale class maxPoise pools */
  poisePoolScale: 0.72,
  /** Defense returns when broken poise refills to this ratio */
  poiseRestoreRatio: 0.45,
  /** Brief stumble on the break beat only (not a permanent stun) */
  poiseBreakStumbleTicks: 12,
  /**
   * After cracking posture: attacker PRESSes this many ticks, then natural
   * decay — not a permanent farm-stun loop.
   */
  brokenPunishPressTicks: 22,
  /** Landed contacts on a still-broken foe before attacker eases to ANGLE/RESET */
  brokenPunishMaxHits: 2,

  /** HP / damage — slightly deadlier, still multi-exchange */
  healthScale: 0.86,
  damageScale: 1.55,
  /** Attack phase / cooldown length (lower = snappier) */
  phaseScale: 0.88,

  knockbackOnHit: 14,
  knockbackOnGuard: 6,
  /** Stamina cost to the blocker per blocked cut (× attacker mass) */
  guardStaminaCost: 8,
  /** Blocking pauses the blocker's stamina regen this many ticks — repeated shields gas out */
  guardStaminaRegenDelay: 220,
  /** Scale on kit shieldShock poise back-pressure when a cut lands on guard */
  guardShockScale: 1.6,
  /** Dodge stamina drain scale — spam-dodging drains the bar, blocking counter-offense */
  dodgeStaminaScale: 1.7,
  /** Dodging pauses stamina regen this many ticks — evasion is winded work, like blocking */
  dodgeStaminaRegenDelay: 150,
  arenaPadding: 48,
  bodyRadius: 16,
  commitMoveMul: 0.16,
  guardMoveMul: 0.4,
  guardTurnMul: 0.55,
  dodgeSpeedMul: 1.7,
  /** Fraction of the dodge active phase that grants i-frames — the rest is catchable recover. */
  dodgeIFrameFrac: 1.0,
  /** Below this stamina ratio, pressing in is discouraged */
  lowStamina: 0.38,
  /** Move speed scale at empty stamina */
  minStaminaMoveMul: 0.45,
  /** Force orbit instead of head-on close inside this multiple of body diameter */
  clinchOrbitMul: 2.2,

  /** Faster radial/lateral intent re-eval (measure spring) */
  aiFootworkIntervalTicks: 3,
  /** Slower commit clock for cut / guard / dodge */
  aiCommitIntervalTicks: 9,

  /**
   * Measure spring: accel toward desired distance d*.
   * Positive error (too far) pulls inward. Units: accel ≈ px/tick² scaled by spring.
   */
  measureSpring: 0.68,
  measureDamp: 0.18,
  /** Cap on |radial accel| per tick (before dt) */
  measureAccelCap: 46,
  /** Lateral accel scale while angling / circling */
  lateralAccel: 32,
  /** Speed (px/s) above which footwork labels leave HOLD */
  footworkVelThresh: 18,

  /** Soft poise bands (ratio of maxPoise) — soft arrives earlier */
  poiseSoftRatio: 0.65,
  poiseCriticalRatio: 0.38,
  softTurnMul: 0.7,
  softGuardMul: 0.74,
  criticalTurnMul: 0.52,
  criticalGuardMul: 0.58,
  /** Chance per landed hit while CRITICAL to stumble */
  criticalStumbleChance: 0.32,
  criticalStumbleTicks: 20,

  /** Intention durations (ticks @ 60Hz) — slightly shorter phrases */
  pressTicks: 36,
  yieldTicks: 42,
  angleTicks: 24,
  inviteTicks: 24,
  feintTicks: 26,
  resetTicks: 18,
  tempoAfterCommit: 14,
  tempoAfterHitTaken: 20,
  /** Mutual stare in measure before INVITE / ANGLE */
  staleStareTicks: 72,
  /** Long exchange → RESET breath */
  exchangeResetTicks: 130,
  /** RESET cannot be re-picked this soon after ending — breaks the 18/3 tick deterministic re-pick lock */
  resetCooldownTicks: 40,

  /** Early windup abort window (fraction of windup) */
  abortWindowFrac: 0.45,
  /** Short recover after abort */
  abortRecoverTicks: 8,
  /** Fraction of attack stamina refunded on abort */
  abortStaminaRefund: 0.4,
  /** Min ticks between aborts for the same fighter */
  abortCooldownTicks: 48,
  /** FEINT fake-windup abort band (fraction of windup) */
  feintAbortMin: 0.32,
  feintAbortMax: 0.48,

  /** Soft time cap — ~55s; most bouts should end earlier via KO */
  maxFightTicks: 60 * 55,
  /** The crowd grows impatient — damage ramps the longer a bout drags. */
  crowdRestlessTick: 60 * 25, // 25s — the first calls for blood
  crowdRestlessMul: 1.4,
  crowdFuryTick: 60 * 35, // 35s — the stands are howling
  crowdFuryMul: 1.9,
  arenaCX: 480,
  arenaCY: 275,
  /** Sand oval — wider than tall, but tall enough for portrait stage use. */
  arenaRX: 365,
  arenaRY: 200,

  /**
   * Naturalism: reaction lag before treating foe windup as a real threat.
   * Scaled per kit via turnRate in ai (faster turn → shorter lag).
   */
  reactionDelayBase: 9,
  reactionDelayMin: 3,
  reactionDelayMax: 12,
  /** Chance to hesitate one commit-tick even when a cut is legal */
  cutHesitation: 0.08,
  /** Prefer helping an ally under attack (score bias) */
  allyAssistBias: 18,
  /** Prefer finishing low-HP foes */
  finishHimBias: 26,

  /**
   * Bout nerve — HP-aware risk reading shaped by pursueBias / clinchPanic / circleArc.
   * confidence↑ when healthy; caution↑ when hurt; finish↑ when foe is low.
   */
  nerveOwnHpConfidence: 0.85,
  nerveOwnHpCaution: 1.05,
  nerveFoeHpFinish: 1.3,
  /** High pursueBias resists caution when hurt; amplifies finish greed */
  nervePursueCautionResist: 0.48,
  nervePursueFinishBoost: 0.55,
  /** High clinchPanic → earlier caution, weaker finish greed */
  nerveClinchCautionBoost: 0.55,
  nerveClinchFinishDamp: 0.4,
  /** circleArc → spikier finish + FEINT/ANGLE lean when foe low */
  nerveArcFinishSpike: 0.65,
  /** Fragilis-like (high clinch, low pursue): early YIELD/RESET when own HP dips */
  nerveFragileHpThresh: 0.55,
  nerveFragileYieldBoost: 0.7,

  /** How strongly nerve scales intention / urge / measure / abort / threat */
  nerveWeightScale: 0.55,
  nerveUrgeScale: 0.4,
  nerveMeasureScale: 0.28,
  nerveAbortScale: 0.35,
  /** Crowd momentum: riding a roar (favor 1.0) adds this to confidence. */
  nerveCrowdConfidence: 0.22,
  /** Closing rush: outranged fighters press in at this speed multiplier. */
  closeRushMul: 2.0,
  /** Outranged press — the closing spring strength and accel cap multiplier. */
  closeSpringMul: 3.0,
  closeAccelMul: 2.5,
  /** Backpedalling is slower than advancing — a kiter cannot sprint away forever. */
  retreatMoveMul: 0.78,
  retreatSpeedFloor: 0.15,
  /** Hard per-tick closing step for the outranged rush (units/tick). */
  closeStepPerTick: 0.55,

  nerveThreatFinishScale: 0.45,

  /**
   * Wound shock — short self tax after heavy HIT / POISE_BREAK so hurt fighters
   * do not instantly re-PRESS at full health tempo.
   */
  woundShockHitTicks: 9,
  woundShockBreakTicks: 14,
  woundShockStaminaHit: 2.6,
  woundShockStaminaBreak: 4.2,
  woundShockMoveMul: 0.8,
  /** clinchPanic amplifies shock duration; pursueBias resists */
  woundShockPanicAmp: 0.45,
  woundShockPursueResist: 0.4,

  /**
   * Measure-band cut quality — tip lighter/cleaner, mid full, clinch messy.
   * tipRatio of attackRange = tip band start; clinch uses bodyRadius * clinchOrbitMul.
   */
  measureBandTipRatio: 0.82,
  /** Range taps carry less force than full-extension strikes — the kiting
      polearm bleeds the foe slowly instead of killing from safety. */
  measureBandTipHpMul: 0.78,
  measureBandTipPoiseMul: 0.85,
  measureBandTipBloodMul: 0.55,
  measureBandMidHpMul: 1,
  measureBandMidPoiseMul: 1,
  measureBandMidBloodMul: 1,
  measureBandClinchHpMul: 1,
  measureBandClinchPoiseMul: 0.8,
  measureBandClinchBloodMul: 1.55,
};
