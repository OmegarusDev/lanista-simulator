import { effectiveAttackArc } from '../../content/armatura';
import { fightStyleOf } from '../../content/appearance';
import { combatTuning } from '../../content/combat';
import type { SeededRNG } from '../rng';
import { angleDelta, angleTo, dist, inCone } from './geometry';
import type { Fighter } from './fighter';
import {
  assistBias,
  crowdVolatility,
  feintAllowed,
  finishBoost,
  fragilisShaken,
  personalityChance,
  prideMomentum,
  punishWindowMul,
  yieldAllowed,
} from './personality';
import type { Footwork, Intention } from './types';

export type FootworkDecision = {
  desiredDist: number;
  lateralBias: -1 | 0 | 1;
  footwork: Footwork;
  faceMode: 'ENEMY' | 'TANGENT' | 'HOLD';
  sideSign: number;
  /** Optional intention pick when idle / expired */
  intentionPick?: Intention;
};

export type CommitDecision = {
  guard: boolean;
  cut: boolean;
  sidestep: boolean;
  /** Start FEINT windup commit */
  feintCut: boolean;
};

export type BoutNerve = {
  /** Own HP comfort 0..1 — healthy → press-willing */
  confidence: number;
  /** Hurt / risk aversion 0..1 */
  caution: number;
  /** Finish greed when foe is low 0..1 */
  finish: number;
};

/**
 * Bout nerve — HP-aware risk reading shaped by spawn-baked personality biases.
 * Poise-break scramble stays absolute elsewhere; nerve does not override BROKEN.
 */
export function boutNerve(self: Fighter, enemy: Fighter): BoutNerve {
  const d = self.def();
  const t = combatTuning;
  const p = self.personality;
  const ownHp = self.maxHp > 0 ? self.hp / self.maxHp : 0;
  const foeHp = enemy.maxHp > 0 ? enemy.hp / enemy.maxHp : 0;

  let confidence = Math.max(0, Math.min(1, ownHp * t.nerveOwnHpConfidence + (1 - t.nerveOwnHpConfidence) * 0.35));
  let caution = Math.max(0, Math.min(1, (1 - ownHp) * t.nerveOwnHpCaution));
  let finish = Math.max(0, Math.min(1, (1 - foeHp) * t.nerveFoeHpFinish));

  // Momentum: riding the crowd's roar loosens a fighter up.
  confidence += (self.crowdFavor01 - 0.5) * 2 * t.nerveCrowdConfidence;

  // Exchange momentum: pride fights harder after a loss; fragile shakes.
  const pride = prideMomentum(p, self.lostExchange);
  const shaken = fragilisShaken(p, self.lostExchange);
  confidence += pride - shaken;
  caution += shaken;
  finish += pride;

  // Trait finish greed — AMBITIOUS/CRUEL push to kill, MERCIFUL pulls back.
  finish += finishBoost(p, ownHp);

  // High pursueBias (Ferox / Press / Aggressive): resist caution when hurt; finish harder
  caution *= 1 - d.pursueBias * t.nervePursueCautionResist;
  finish = Math.min(1, finish * (0.55 + d.pursueBias * t.nervePursueFinishBoost));

  // High clinchPanic (Cautus / Cautious): earlier caution; weaker finish greed
  caution = Math.min(1, caution * (0.65 + d.clinchPanic * t.nerveClinchCautionBoost));
  finish *= 1 - d.clinchPanic * t.nerveClinchFinishDamp;

  // circleArc (Histrio / Angle): spikier finish when foe low
  finish = Math.min(1, finish * (1 + d.circleArcBonus * t.nerveArcFinishSpike));

  // Fragilis-like: high clinch + low pursue → early caution when own HP dips
  if (d.clinchPanic > 0.55 && d.pursueBias < 0.4 && ownHp < t.nerveFragileHpThresh) {
    caution = Math.min(1, caution + t.nerveFragileYieldBoost * (t.nerveFragileHpThresh - ownHp));
    confidence *= 0.75;
  }

  confidence = Math.max(0, Math.min(1, confidence));
  caution = Math.max(0, Math.min(1, caution));
  finish = Math.max(0, Math.min(1, finish));
  return { confidence, caution, finish };
}

/**
 * Class personality as intention weights — geometry hooks, not scripts.
 * Secutor → PRESS, Ret → INVITE/FEINT, Thraex → ANGLE/FEINT.
 * Nerve (HP × temperament) scales PRESS/YIELD/FEINT/RESET without replacing poise tiers.
 */
export function intentionWeights(self: Fighter, enemy?: Fighter | null): Record<Intention, number> {
  const d = self.def();
  const broken = self.poiseBroken || self.poiseTier === 'BROKEN';
  const critical = self.poiseTier === 'CRITICAL';
  const nerve = enemy && enemy.alive ? boutNerve(self, enemy) : null;
  const ns = combatTuning.nerveWeightScale;

  let press = broken ? 0.02 : critical ? 0.08 + d.pursueBias * 0.35 : 0.18 + d.pursueBias * 1.1;
  let yieldW =
    0.12 + d.clinchPanic * 0.55 + (broken ? 1.8 : critical ? 0.85 : 0);
  let angle = 0.14 + d.circleArcBonus * 2.2 + (broken ? 0.35 : 0);
  let invite = broken ? 0.02 : 0.1 + d.clinchPanic * 0.45 + (1 - d.pursueBias) * 0.25;
  let feint = broken ? 0.02 : 0.08 + d.circleArcBonus * 1.4 + d.clinchPanic * 0.2;
  let reset = 0.06 + (broken ? 0.25 : critical ? 0.12 : 0);

  if (nerve && !broken) {
    press *= 1 + (nerve.confidence * 0.45 + nerve.finish * 0.7 - nerve.caution * 0.55) * ns;
    yieldW *= 1 + (nerve.caution * 0.9 - nerve.confidence * 0.25) * ns;
    feint *= 1 + (nerve.finish * 0.55 + d.circleArcBonus * nerve.finish) * ns;
    angle *= 1 + nerve.finish * 0.35 * ns * (0.5 + d.circleArcBonus);
    reset *= 1 + nerve.caution * 0.4 * ns;
    invite *= 1 + (nerve.caution * 0.25 - nerve.finish * 0.15) * ns;
  }

  return {
    NONE: 0,
    PRESS: Math.max(0.01, press),
    YIELD: Math.max(0.02, yieldW),
    ANGLE: Math.max(0.02, angle),
    INVITE: Math.max(0.01, invite),
    FEINT: Math.max(0.01, feint),
    RESET: Math.max(0.02, reset),
  };
}

/** Abort willingness from kit geometry (Ret high, Sec low) × nerve caution. */
export function abortBias(self: Fighter, enemy?: Fighter | null): number {
  const d = self.def();
  let b = Math.min(1, d.clinchPanic * 0.65 + (1 - d.pursueBias) * 0.3 + d.circleArcBonus * 0.4);
  if (enemy && enemy.alive) {
    const n = boutNerve(self, enemy);
    b = Math.min(1, b + n.caution * combatTuning.nerveAbortScale * 0.5 - n.finish * 0.12);
  }
  return b;
}

/**
 * Desired measure d* from class mid-range, shifted by intention + kit bias + nerve.
 */
export function computeDesiredDist(
  self: Fighter,
  distance: number,
  tick: number,
  enemy?: Fighter | null,
): number {
  const d = self.def();
  const mid = (d.measureMin + d.measureMax) * 0.5;
  const intent = self.activeIntention(tick);
  let target = mid;

  // Kit base: pursuers sit a touch inside mid; panic kits a touch outside
  target += (d.pursueBias - d.clinchPanic * 0.5) * (d.measureMax - d.measureMin) * 0.35;

  switch (intent) {
    case 'PRESS':
      // Long kits press to tip; short kits crowd mid-inside
      target =
        d.clinchPanic > 0.55
          ? mid + (d.measureMax - mid) * 0.35
          : d.measureMin + (mid - d.measureMin) * 0.35;
      break;
    case 'YIELD':
      // Ease out inside / to measureMax — don't abandon weapon threat
      target = mid + (d.measureMax - mid) * (0.65 + d.clinchPanic * 0.25);
      break;
    case 'ANGLE':
      target = mid;
      break;
    case 'INVITE':
      target = mid + (d.measureMax - mid) * 0.55;
      break;
    case 'FEINT':
      target =
        self.feintStage === 'IN'
          ? mid - (mid - d.measureMin) * 0.45
          : mid;
      break;
    case 'RESET':
      target = mid;
      break;
    default:
      break;
  }

  // Soft/critical → prefer space; broken → hard open (scramble out of the blade)
  const tier = self.poiseTier;
  if (tier === 'SOFT') target += (d.measureMax - mid) * 0.2;
  if (tier === 'CRITICAL') target += (d.measureMax - mid) * 0.45;
  if (tier === 'BROKEN' || self.poiseBroken) {
    target = Math.max(target, d.measureMax * 1.12);
  } else if (enemy && enemy.alive) {
    const n = boutNerve(self, enemy);
    const span = d.measureMax - mid;
    target += (n.caution - n.finish * 0.55 - n.confidence * 0.25) * span * combatTuning.nerveMeasureScale;
  }

  // Clinch panic when jammed — ease out, don't teleport d* to max reach
  const clinchDist = combatTuning.bodyRadius * combatTuning.clinchOrbitMul;
  if (distance < clinchDist) {
    // Everyone scrambles out of a jam — not only high clinchPanic kits
    const midNow = (d.measureMin + d.measureMax) * 0.5;
    const panic = Math.max(0.45, d.clinchPanic);
    target = Math.max(target, midNow + (d.measureMax - midNow) * panic * 0.7);
  }

  const cap = self.poiseBroken || tier === 'BROKEN' ? d.measureMax * 1.45 : d.measureMax * 1.25;
  return Math.max(d.measureMin * 0.75, Math.min(cap, target));
}

export function cutUrge(self: Fighter, tick: number, enemy: Fighter): number {
  const intent = self.activeIntention(tick);
  let urge = 0.42;
  switch (intent) {
    case 'PRESS':
      urge = 0.84;
      break;
    case 'YIELD':
      urge = 0.18;
      break;
    case 'ANGLE':
      urge = 0.48;
      break;
    case 'INVITE':
      urge = 0.14;
      break;
    case 'FEINT':
      urge = 0.6;
      break;
    case 'RESET':
      urge = 0.2;
      break;
    default:
      urge = 0.44 + self.def().pursueBias * 0.28;
      break;
  }
  // Enemy INVITE raises our urge
  if (enemy.activeIntention(tick) === 'INVITE') urge = Math.min(0.92, urge + 0.35);
  // Soft/critical foe invites cuts; broken only while the punish window is open
  const et = enemy.poiseTier;
  if (et === 'SOFT') urge = Math.min(0.9, urge + 0.12);
  if (et === 'CRITICAL') urge = Math.min(0.95, urge + 0.22);
  if (et === 'BROKEN' || enemy.poiseBroken) {
    const window = Math.round(combatTuning.brokenPunishMaxHits * punishWindowMul(self.personality));
    if (self.brokenPunishContacts < window) {
      urge = Math.min(0.95, urge + 0.28);
    } else {
      urge *= 0.35;
    }
  }
  // Own crack → stop throwing, scramble (absolute — nerve does not override)
  if (self.poiseBroken || self.poiseTier === 'BROKEN') urge *= 0.12;
  else if (self.poiseTier === 'CRITICAL') urge *= 0.45;
  else {
    const n = boutNerve(self, enemy);
    urge = Math.min(
      0.96,
      Math.max(
        0.05,
        urge * (1 + (n.finish * 0.55 + n.confidence * 0.25 - n.caution * 0.45) * combatTuning.nerveUrgeScale),
      ),
    );
  }
  return urge;
}

/**
 * Radial / lateral intent — runs on the fast footwork clock.
 */
export function decideFootwork(
  self: Fighter,
  enemy: Fighter | null,
  allies: Fighter[],
  rng: SeededRNG,
  tick: number,
): FootworkDecision {
  const idle: FootworkDecision = {
    desiredDist: self.desiredDist || (self.def().measureMin + self.def().measureMax) * 0.5,
    lateralBias: 0,
    footwork: 'HOLD',
    faceMode: 'ENEMY',
    sideSign: self.orbitSide,
  };
  if (!self.alive || !enemy || !enemy.alive || self.stunned || self.tangled) {
    return idle;
  }

  const d = self.def();
  const p = self.personality;
  const distance = dist(self.x, self.y, enemy.x, enemy.y);
  const toEnemy = angleTo(self.x, self.y, enemy.x, enemy.y);
  const bearingErr = Math.abs(angleDelta(self.facing, toEnemy));
  const atkArc = effectiveAttackArc(d, self.footwork);
  const stamRatio = self.stamina / self.maxStamina;
  const lowStam = stamRatio < combatTuning.lowStamina;
  const intent = self.activeIntention(tick);

  if (distance > d.measureMax * 1.2 && personalityChance(rng, 0.08, p, 0.7)) {
    self.orbitSide = rng.chance(0.5) ? 1 : -1;
  }
  const side = self.orbitSide;

  const selfBroken = self.poiseBroken || self.poiseTier === 'BROKEN';
  const selfCritical = self.poiseTier === 'CRITICAL';

  let desiredDist = computeDesiredDist(self, distance, tick, enemy);
  // Once outside foe's reach, stop yielding farther — re-enter the bout
  // (broken fighters keep scrambling; do not clamp them back into range)
  const foeRange = enemy.def().attackRange;
  if (
    !selfBroken &&
    (intent === 'YIELD' || intent === 'INVITE') &&
    distance > foeRange * 1.08 &&
    desiredDist > distance
  ) {
    desiredDist = Math.min(desiredDist, (d.measureMin + d.measureMax) * 0.5);
  }

  let lateralBias: -1 | 0 | 1 = 0;
  let faceMode: FootworkDecision['faceMode'] = 'ENEMY';

  if (intent === 'ANGLE') {
    lateralBias = side;
    faceMode = 'ENEMY';
  } else if (intent === 'INVITE' || intent === 'RESET') {
    lateralBias = 0;
  } else if (intent === 'PRESS') {
    lateralBias = bearingErr > atkArc * 1.1 ? side : 0;
  } else if (intent === 'YIELD') {
    lateralBias = personalityChance(rng, selfBroken || selfCritical ? 0.72 : 0.35, p, 0.8) ? side : 0;
  } else if (intent === 'FEINT' && self.feintStage === 'IN') {
    lateralBias = 0;
  } else {
    // Neutral: circle when offline or the class's style loves angles —
    // SECUTOR drives straight, THRAEX dances wide.
    const orbit = fightStyleOf(self.armatura).orbit;
    if (bearingErr > atkArc * 1.35 || personalityChance(rng, 0.12 + orbit * 0.28, p, 0.7)) {
      lateralBias = side;
    }
  }

  // Broken / critical: force lateral escape — scramble off the line
  if (selfBroken || selfCritical) {
    lateralBias = side;
    if (selfBroken) faceMode = 'TANGENT';
  }

  const clinchDist = combatTuning.bodyRadius * combatTuning.clinchOrbitMul;
  if (distance < clinchDist) {
    lateralBias = side;
    faceMode = d.clinchPanic < 0.5 || selfBroken ? 'TANGENT' : 'ENEMY';
  }

  for (const a of allies) {
    if (a.id === self.id || !a.alive) continue;
    if (dist(self.x, self.y, a.x, a.y) < combatTuning.bodyRadius * 2.4) {
      lateralBias = side;
      faceMode = 'ENEMY';
      break;
    }
  }

  if (lowStam && desiredDist < (d.measureMin + d.measureMax) * 0.5) {
    desiredDist = Math.max(desiredDist, (d.measureMin + d.measureMax) * 0.55);
  }

  // Derive label from spring error for UI / attack-arc bonus
  const err = distance - desiredDist;
  const thresh = (d.measureMax - d.measureMin) * 0.12;
  let footwork: Footwork = 'HOLD';
  if (lateralBias !== 0 && Math.abs(err) < thresh * 1.5) {
    footwork = lateralBias < 0 ? 'CIRCLE_L' : 'CIRCLE_R';
  } else if (err > thresh) {
    footwork = 'CLOSE';
  } else if (err < -thresh) {
    footwork = 'DISENGAGE';
  }

  let intentionPick: Intention | undefined;
  // Broken stuck on PRESS → scramble; critical strongly prefers YIELD
  if (selfBroken && (intent === 'PRESS' || intent === 'NONE')) {
    intentionPick = 'YIELD';
  } else if (selfCritical && intent === 'PRESS' && personalityChance(rng, 0.55, p, 0.8)) {
    intentionPick = 'YIELD';
  } else if (intent === 'NONE') {
    intentionPick = pickIdleIntention(self, enemy, distance, rng, tick);
  }

  return {
    desiredDist,
    lateralBias,
    footwork,
    faceMode,
    sideSign: side,
    intentionPick,
  };
}

function pickIdleIntention(
  self: Fighter,
  enemy: Fighter,
  distance: number,
  rng: SeededRNG,
  tick: number,
): Intention | undefined {
  const d = self.def();
  const p = self.personality;
  const mid = (d.measureMin + d.measureMax) * 0.5;
  const inMeasure = distance >= d.measureMin * 0.9 && distance <= d.measureMax * 1.1;
  const stamOk = self.stamina / self.maxStamina > 0.45;
  const onTempo = tick < self.tempoUntil;
  const w = intentionWeights(self, enemy);
  const selfBroken = self.poiseBroken || self.poiseTier === 'BROKEN';
  const selfCritical = self.poiseTier === 'CRITICAL';
  const foeBroken = enemy.poiseBroken || enemy.poiseTier === 'BROKEN';
  const clinchDist = combatTuning.bodyRadius * combatTuning.clinchOrbitMul;
  const nerve = boutNerve(self, enemy);
  const ownHp = self.maxHp > 0 ? self.hp / self.maxHp : 0;

  // Own posture cracked → scramble / breathe, never re-PRESS into the blade
  if (selfBroken) return 'YIELD';
  if (selfCritical && personalityChance(rng, 0.62 + w.YIELD * 0.15, p, 0.8)) return 'YIELD';

  // Nerve: early YIELD / RESET when caution high and not finishing.
  // PROUD refuses to back off while healthy — only RESET is on the table.
  if (
    !selfBroken &&
    nerve.caution > 0.55 &&
    nerve.finish < 0.35 &&
    personalityChance(rng, 0.12 + nerve.caution * 0.28, p, 0.9)
  ) {
    const canYield = yieldAllowed(p, ownHp, false);
    return canYield && rng.chance(0.4) ? 'YIELD' : 'RESET';
  }

  // Long quiet exchange → RESET (cooldown prevents the deterministic
  // re-pick that otherwise keeps NONE invisible to the commit clock)
  if (
    self.ticksSinceContact > combatTuning.exchangeResetTicks &&
    inMeasure &&
    tick - self.lastResetTick > combatTuning.resetCooldownTicks
  ) {
    return 'RESET';
  }

  // Broken foe: short punish then ANGLE/RESET — do not farm the stun.
  // CRUEL drags the punishment out; MERCIFUL lets it go.
  if (foeBroken) {
    const window = Math.round(combatTuning.brokenPunishMaxHits * punishWindowMul(p));
    if (self.brokenPunishContacts >= window || distance < clinchDist) {
      return rng.chance(0.55) ? 'ANGLE' : 'RESET';
    }
    if (personalityChance(rng, 0.55 + w.PRESS * 0.2 + nerve.finish * 0.15, p, 0.8)) return 'PRESS';
  }

  // Soft / critical foe → lean PRESS (recovering, still dangerous)
  if (enemy.poiseTier === 'SOFT' || enemy.poiseTier === 'CRITICAL') {
    if (personalityChance(rng, 0.35 + w.PRESS * 0.25 + nerve.finish * 0.12, p, 0.8)) return 'PRESS';
  }

  // Low foe HP finish lean
  if (nerve.finish > 0.45 && stamOk && personalityChance(rng, 0.18 + nerve.finish * 0.35 + w.PRESS * 0.15, p, 0.9)) {
    return 'PRESS';
  }
  if (nerve.finish > 0.5 && d.circleArcBonus > 0.12 && personalityChance(rng, 0.1 + nerve.finish * 0.2, p, 0.9)) {
    return rng.chance(0.5) ? 'FEINT' : 'ANGLE';
  }

  // Collapse on a recovering foe, or windup we can already perceive
  if (
    distance > d.attackRange &&
    enemy.action === 'ATTACK' &&
    (enemy.phase === 'RECOVER' || (enemy.phase === 'WINDUP' && perceivesEnemyCut(self, enemy))) &&
    personalityChance(rng, 0.3 + w.PRESS * 0.35, p, 0.8)
  ) {
    return 'PRESS';
  }

  // After taking a hard stare without contact — ANGLE to break rhythm
  if (self.ticksSinceContact > 70 && inMeasure && personalityChance(rng, 0.08 + w.ANGLE * 0.15, p, 0.8)) {
    return 'ANGLE';
  }

  // Mutual HOLD-ish: INVITE for kits that like it
  if (
    inMeasure &&
    Math.abs(distance - mid) < (d.measureMax - d.measureMin) * 0.35 &&
    self.footwork === 'HOLD' &&
    enemy.footwork === 'HOLD' &&
    personalityChance(rng, 0.12 + w.INVITE * 0.2, p, 0.8)
  ) {
    return 'INVITE';
  }

  // FEINT when tempo clear + stam OK (uncommon — avoid fake-loop stalemates).
  // STOIC never feints — no theatrics, only honest work.
  if (
    feintAllowed(p) &&
    !onTempo &&
    stamOk &&
    inMeasure &&
    self.ticksSinceContact > 40 &&
    personalityChance(rng, 0.025 + w.FEINT * 0.08, p, 0.8)
  ) {
    return 'FEINT';
  }

  // Occasional ANGLE for sica kits
  if (inMeasure && personalityChance(rng, 0.04 + w.ANGLE * 0.12, p, 0.8)) {
    return 'ANGLE';
  }

  return undefined;
}

/**
 * Commit decisions — slower clock, or threat-edge forced re-eval.
 */
export function decideCommit(
  self: Fighter,
  enemy: Fighter | null,
  rng: SeededRNG,
  tick: number,
): CommitDecision {
  const idle: CommitDecision = { guard: false, cut: false, sidestep: false, feintCut: false };
  if (!self.alive || !enemy || !enemy.alive || self.stunned || self.tangled) {
    return idle;
  }

  const d = self.def();
  const p = self.personality;
  // SUPERSTITIOUS fighters ride the crowd: favor swings widen the envelope.
  const pCrowd = { ...p, volatility: crowdVolatility(p, self.crowdFavor01) };
  const distance = dist(self.x, self.y, enemy.x, enemy.y);
  const toEnemy = angleTo(self.x, self.y, enemy.x, enemy.y);
  const bearingErr = Math.abs(angleDelta(self.facing, toEnemy));
  const atkArc = effectiveAttackArc(d, self.footwork);
  const lineOn = inCone(self.facing, toEnemy, atkArc * 0.9);
  const stamRatio = self.stamina / self.maxStamina;
  const lowStam = stamRatio < combatTuning.lowStamina;
  const intent = self.activeIntention(tick);
  const onTempo = tick < self.tempoUntil;
  const guardArc = self.effectiveGuardArc();
  // Cut range uses weapon reach. Allow clinch-range cuts so pairs don't freeze
  // inside measureMin with no legal attack and no stare-break.
  const inCutRange =
    distance <= d.attackRange * 1.02 && distance >= combatTuning.bodyRadius * 1.2;

  const enemyToMe = angleTo(enemy.x, enemy.y, self.x, self.y);
  const enemyArc = effectiveAttackArc(enemy.def(), enemy.footwork);
  const seesCut = perceivesEnemyCut(self, enemy);
  const enemyCuttingMe =
    seesCut && inCone(enemy.facing, enemyToMe, enemyArc * 1.15);
  const enemyRecovering =
    enemy.action === 'ATTACK' && enemy.phase === 'RECOVER';

  const clinchDist = combatTuning.bodyRadius * combatTuning.clinchOrbitMul;
  const selfBroken = self.poiseBroken || self.poiseTier === 'BROKEN';
  const selfCritical = self.poiseTier === 'CRITICAL';
  const foeBroken = enemy.poiseBroken || enemy.poiseTier === 'BROKEN';
  const punishWindow = Math.round(combatTuning.brokenPunishMaxHits * punishWindowMul(p));
  const punishOpen = foeBroken && self.brokenPunishContacts < punishWindow;

  const canGuardThreat = inCone(self.facing, toEnemy, guardArc);
  const guardReady = fightStyleOf(self.armatura).guardReady;
  const seesWindup = enemy.action === 'ATTACK' && enemy.phase === 'WINDUP' && canGuardThreat;
  const guard =
    self.canGuard &&
    !selfBroken &&
    ((enemyCuttingMe && canGuardThreat) ||
      (self.poiseTier !== 'SOLID' && enemyCuttingMe && guardArc > 0.35) ||
      (seesWindup && guardReady > 0.7 && personalityChance(rng, (guardReady - 0.7) * 3, p, 0.8))) &&
    guardArc > 0.25 &&
    self.stamina > 6 &&
    !lowStam;

  // Sidestep uses canDodge — broken fighters may still desperate-dive off the line.
  // Gassed fighters cannot dodge: the stamina scale makes spam-dodging a losing
  // economy, so the read is a budget decision, not a permanent answer.
  const sidestep =
    self.canDodge &&
    !guard &&
    !lowStam &&
    self.dodgeCd <= 0 &&
    self.canAfford(d.dodgeStamina * combatTuning.dodgeStaminaScale) &&
    (enemyCuttingMe || (selfBroken && distance < clinchDist * 1.35)) &&
    (selfBroken ||
      selfCritical ||
      guardArc < 0.5 ||
      bearingErr > guardArc ||
      distance < clinchDist);

  const enemyGuardingLine =
    enemy.canGuard &&
    enemy.guarding &&
    inCone(enemy.facing, angleTo(enemy.x, enemy.y, self.x, self.y), enemy.effectiveGuardArc());

  const whiffPunish =
    !selfBroken &&
    enemyRecovering &&
    distance <= d.attackRange * 1.05 &&
    bearingErr < atkArc * 1.2 &&
    self.attackCd <= 0 &&
    self.canAfford(d.attackStamina);

  const canCut =
    !selfBroken &&
    inCutRange &&
    lineOn &&
    self.attackCd <= 0 &&
    self.canAfford(d.attackStamina) &&
    !enemyCuttingMe &&
    !(enemyGuardingLine && personalityChance(rng, 0.55, pCrowd, 0.7)) &&
    !lowStam &&
    bearingErr < atkArc * 0.9 &&
    intent !== 'RESET' &&
    intent !== 'YIELD';

  // Broken-foe punish is an opportunity — beats own YIELD caution
  // (still refuses RESET so the breath state is respected).
  const punishLegal =
    punishOpen &&
    !selfBroken &&
    inCutRange &&
    lineOn &&
    self.attackCd <= 0 &&
    self.canAfford(d.attackStamina) &&
    !enemyCuttingMe &&
    !(enemyGuardingLine && personalityChance(rng, 0.55, pCrowd, 0.7)) &&
    !lowStam &&
    bearingErr < atkArc * 0.9 &&
    intent !== 'RESET';

  // FEINT: after micro-in, commit a fake windup
  let feintCut = false;
  if (
    !selfBroken &&
    intent === 'FEINT' &&
    self.feintStage === 'IN' &&
    !self.busy &&
    self.attackCd <= 0 &&
    self.canAfford(d.attackStamina * 0.5) &&
    distance <= d.attackRange * 1.1
  ) {
    feintCut = true;
  }

  let cut = false;
  if (feintCut) {
    cut = false;
  } else if (
    whiffPunish ||
    punishLegal ||
    (enemy.poiseTier === 'CRITICAL' && canCut && personalityChance(rng, 0.75, pCrowd, 0.7))
  ) {
    cut = true;
  } else if (canCut && !onTempo) {
    let urge = cutUrge(self, tick, enemy);
    // INVITE suppresses own cuts but still allows tip-range opportunism for long kits
    if (intent === 'INVITE') urge *= distance <= d.attackRange * 0.92 ? 0.45 : 0.15;
    // Micro-hesitation — reads as thought, not aimbot; caution raises hesitation,
    // and the personality envelope decides who hesitates and who commits.
    const nerve = boutNerve(self, enemy);
    const committal = fightStyleOf(self.armatura).committal;
    const hesitate = personalityChance(
      rng,
      combatTuning.cutHesitation * (1.15 - d.pursueBias * 0.5) * (1 + nerve.caution * 0.6) * (1.3 - committal * 0.35),
      pCrowd,
      0.8,
    );
    cut = !hesitate && personalityChance(rng, urge, pCrowd, 0.9);
  }

  return { guard, cut, sidestep, feintCut };
}

/** Threat edge — force commit re-eval before the slow clock. */
export function commitThreatEdge(self: Fighter, enemy: Fighter | null): boolean {
  if (!enemy || !enemy.alive) return false;
  if (!perceivesEnemyCut(self, enemy)) return false;
  const enemyToMe = angleTo(enemy.x, enemy.y, self.x, self.y);
  const enemyArc = effectiveAttackArc(enemy.def(), enemy.footwork);
  return inCone(enemy.facing, enemyToMe, enemyArc * 1.2);
}

/** Reaction lag ticks — heavy/slow helms see threats later. */
export function reactionDelay(self: Fighter): number {
  const tr = self.def().turnRate;
  // turnRate ~2.0–3.6 → delay ~12–4
  const raw = combatTuning.reactionDelayBase + (2.8 - tr) * 4;
  return Math.max(
    combatTuning.reactionDelayMin,
    Math.min(combatTuning.reactionDelayMax, Math.round(raw)),
  );
}

/** True if we "see" their cut commitment (windup past reaction lag, or active). */
export function perceivesEnemyCut(self: Fighter, enemy: Fighter): boolean {
  if (enemy.action !== 'ATTACK') return false;
  if (enemy.phase === 'ACTIVE') return true;
  if (enemy.phase !== 'WINDUP') return false;
  return enemy.phaseT >= reactionDelay(self);
}

/**
 * Threat pick — not pure nearest. Prefers recover/windup, low HP, threats on allies.
 * Prefer-weakest orders and bout nerve finish scale amplify low-HP targeting.
 */
export function pickThreat(self: Fighter, fighters: Fighter[]): Fighter | null {
  let best: Fighter | null = null;
  let bestScore = -Infinity;
  const allies = alliesOf(self, fighters);

  for (const f of fighters) {
    if (!f.alive || f.team === self.team) continue;
    const dd = dist(self.x, self.y, f.x, f.y);
    let score = 400 - dd;

    if (f.phase === 'RECOVER') score += 28;
    if (f.phase === 'WINDUP' && perceivesEnemyCut(self, f)) score += 16;
    if (f.poiseBroken || f.poiseTier === 'CRITICAL') score += 20;
    if (f.poiseTier === 'SOFT') score += 8;

    const hpRatio = f.hp / f.maxHp;
    const nerve = boutNerve(self, f);
    const finishScale = 1 + nerve.finish * combatTuning.nerveThreatFinishScale;
    score += (1 - hpRatio) * combatTuning.finishHimBias * 1.35 * finishScale;
    // Melee readability: pile onto the weak link
    if (hpRatio < 0.4) score += 35 * finishScale;
    if (hpRatio < 0.25) score += 25 * finishScale;
    if (self.preferWeakest) score += (1 - hpRatio) * 48;

    // Focus fire — if an ally is already close to this foe, join them.
    // LOYAL fighters always pile on; others only when it's convenient.
    for (const a of allies) {
      if (a.id === self.id || !a.alive) continue;
      const allyToFoe = dist(a.x, a.y, f.x, f.y);
      if (allyToFoe < 70) score += 22 + assistBias(self.personality);
      const toAlly = angleTo(f.x, f.y, a.x, a.y);
      const arc = effectiveAttackArc(f.def(), f.footwork);
      if (
        f.action === 'ATTACK' &&
        (f.phase === 'WINDUP' || f.phase === 'ACTIVE') &&
        inCone(f.facing, toAlly, arc * 1.2) &&
        dist(f.x, f.y, a.x, a.y) < f.def().attackRange * 1.15
      ) {
        score += combatTuning.allyAssistBias;
      }
    }

    // Slight pursueBias → stickier on current nearest
    score += self.def().pursueBias * 6;

    if (score > bestScore) {
      bestScore = score;
      best = f;
    }
  }
  return best;
}

/** @deprecated prefer pickThreat — kept as nearest-distance helper */
export function nearestEnemy(self: Fighter, fighters: Fighter[]): Fighter | null {
  return pickThreat(self, fighters);
}

export function alliesOf(self: Fighter, fighters: Fighter[]): Fighter[] {
  return fighters.filter((f) => f.team === self.team);
}

/** Relabel footwork from instantaneous spring velocity (UI / arcs). */
export function footworkFromVelocity(
  self: Fighter,
  enemy: Fighter,
  lateralBias: -1 | 0 | 1,
): Footwork {
  const dx = enemy.x - self.x;
  const dy = enemy.y - self.y;
  const len = Math.hypot(dx, dy) || 1;
  const fx = dx / len;
  const fy = dy / len;
  const lx = -fy;
  const ly = fx;
  const vRad = self.vx * fx + self.vy * fy;
  const vLat = self.vx * lx + self.vy * ly;
  const thresh = combatTuning.footworkVelThresh;
  if (Math.abs(vLat) > thresh * 0.85 && Math.abs(vLat) >= Math.abs(vRad) * 0.7) {
    // vLat > 0 ⟺ moving along +lateral ⟺ bias +1 ⟺ CIRCLE_R (see below).
    return vLat > 0 || lateralBias > 0 ? 'CIRCLE_R' : 'CIRCLE_L';
  }
  if (vRad > thresh) return 'CLOSE';
  if (vRad < -thresh) return 'DISENGAGE';
  if (lateralBias < 0) return 'CIRCLE_L';
  if (lateralBias > 0) return 'CIRCLE_R';
  return 'HOLD';
}
