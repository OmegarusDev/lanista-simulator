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
  damageScale: 1.28,
  /** Attack phase / cooldown length (lower = snappier) */
  phaseScale: 0.88,

  knockbackOnHit: 14,
  knockbackOnGuard: 6,
  arenaPadding: 48,
  bodyRadius: 16,
  commitMoveMul: 0.16,
  guardMoveMul: 0.4,
  guardTurnMul: 0.55,
  dodgeSpeedMul: 1.7,
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
  arenaCX: 480,
  arenaCY: 300,
  arenaRX: 380,
  arenaRY: 160,

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
};
