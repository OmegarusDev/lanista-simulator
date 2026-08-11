import { effectiveAttackArc } from '../../content/armatura';
import { combatTuning } from '../../content/combat';
import {
  abortBias,
  alliesOf,
  commitThreatEdge,
  decideCommit,
  decideFootwork,
  pickThreat,
} from './ai';
import { angleDelta, angleTo, dist, turnToward } from './geometry';
import type { Fighter } from './fighter';
import type { SeededRNG } from '../rng';
import type { FaceMode } from './matchMotion';
import { assignIntention } from './matchRhythm';
import type { PushCombatEvent } from './matchCuts';

export interface BrainMaps {
  footworkClock: Map<number, number>;
  commitClock: Map<number, number>;
  sideSign: Map<number, number>;
  faceMode: Map<number, FaceMode>;
  lateralBias: Map<number, -1 | 0 | 1>;
}

export function runBrain(
  f: Fighter,
  fighters: Fighter[],
  tick: number,
  rng: SeededRNG,
  maps: BrainMaps,
  pushEvent: PushCombatEvent,
): void {
  const enemy = pickThreat(f, fighters);

  // Posture cracked while still PRESSing → scramble (override stuck aggression)
  if (f.poiseBroken && f.activeIntention(tick) === 'PRESS') {
    assignIntention(f, 'YIELD', tick);
  }

  // Fast footwork / measure clock
  let fw = maps.footworkClock.get(f.id) ?? 0;
  fw--;
  if (fw <= 0) {
    maps.footworkClock.set(f.id, combatTuning.aiFootworkIntervalTicks);
    const decision = decideFootwork(f, enemy, alliesOf(f, fighters), rng, tick);
    maps.sideSign.set(f.id, decision.sideSign);
    maps.faceMode.set(f.id, decision.faceMode);
    maps.lateralBias.set(f.id, decision.lateralBias);
    f.desiredDist = decision.desiredDist;
    f.lateralBias = decision.lateralBias;
    f.footwork = decision.footwork;
    if (decision.intentionPick) {
      const cur = f.activeIntention(tick);
      // Broken/critical picks may override PRESS; idle picks need a free slot
      if (
        cur === 'NONE' ||
        (f.poiseBroken && decision.intentionPick === 'YIELD') ||
        (f.poiseTier === 'CRITICAL' && cur === 'PRESS' && decision.intentionPick === 'YIELD')
      ) {
        assignIntention(f, decision.intentionPick, tick);
      }
    }
  } else {
    maps.footworkClock.set(f.id, fw);
  }

  // Slow commit clock (threat edges force early re-eval)
  let cm = maps.commitClock.get(f.id) ?? 0;
  cm--;
  const threat = commitThreatEdge(f, enemy);
  if (threat) cm = Math.min(cm, 0);
  if (cm <= 0) {
    maps.commitClock.set(f.id, combatTuning.aiCommitIntervalTicks);
    runCommit(f, enemy, tick, rng, pushEvent);
  } else {
    maps.commitClock.set(f.id, cm);
  }
}

export function runCommit(
  f: Fighter,
  enemy: Fighter | null,
  tick: number,
  rng: SeededRNG,
  pushEvent: PushCombatEvent,
): void {
  const decision = decideCommit(f, enemy, rng, tick);

  if (f.guarding && !decision.guard) {
    f.endAction();
  }

  if (f.busy && f.action !== 'GUARD') return;

  const d = f.def();
  if (decision.sidestep && !f.busy) {
    if (f.startAction('SIDESTEP', 2, d.dodgeDuration, 6)) {
      f.stamina -= d.dodgeStamina;
      pushEvent('SIDESTEP', f);
    }
    return;
  }

  if (decision.guard && !f.guarding && !f.busy) {
    f.startAction('GUARD', 3, 999, 4);
    return;
  }

  if ((decision.feintCut || decision.cut) && !f.busy && enemy) {
    f.facing = turnToward(f.facing, angleTo(f.x, f.y, enemy.x, enemy.y), f.effectiveTurnRate());
    const ps = combatTuning.phaseScale;
    const windup = Math.max(8, Math.round(d.windup * ps));
    const active = Math.max(4, Math.round(d.active * ps));
    const recover = Math.max(8, Math.round(d.recover * ps));
    if (f.startAction('ATTACK', windup, active, recover)) {
      f.stamina -= d.attackStamina;
      if (decision.feintCut) {
        f.feintStage = 'WINDUP';
      }
    }
  }
}

/**
 * Early windup abort: bearing/measure fail → short recover, partial stam, YIELD + foe tempo.
 * FEINT intentionally aborts in its fake window.
 */
export function maybeAbortWindup(
  f: Fighter,
  fighters: Fighter[],
  tick: number,
  rng: SeededRNG,
  pushEvent: PushCombatEvent,
): void {
  if (f.action !== 'ATTACK' || f.phase !== 'WINDUP' || f.phaseMax <= 0) return;
  const progress = f.phaseT / f.phaseMax;
  const enemy = pickThreat(f, fighters);
  if (!enemy) return;

  const d = f.def();
  const distance = dist(f.x, f.y, enemy.x, enemy.y);
  const toEnemy = angleTo(f.x, f.y, enemy.x, enemy.y);
  const facing = f.commitFacing ?? f.facing;
  const bearingErr = Math.abs(angleDelta(facing, toEnemy));
  const atkArc = effectiveAttackArc(d, f.footwork);
  const outOfMeasure = distance < d.measureMin * 0.7 || distance > d.attackRange * 1.12;

  // Intentional FEINT abort in mid-window
  if (f.feintStage === 'WINDUP' && f.activeIntention(tick) === 'FEINT') {
    const lo = combatTuning.feintAbortMin;
    const hi = combatTuning.feintAbortMax;
    if (progress >= lo && progress <= hi) {
      performAbort(f, enemy, true, tick, pushEvent);
      return;
    }
    if (progress > hi) {
      // Locked through — treat as real cut; clear feint stage
      f.feintStage = 'NONE';
    }
    return;
  }

  // Real abort only in early window
  if (progress > combatTuning.abortWindowFrac) return;

  const lineFail = bearingErr > atkArc * 1.2;
  const badMeasure =
    distance < d.measureMin * 0.55 || distance > d.attackRange * 1.2 || outOfMeasure;
  // Need a clear fail — don't abort on tiny drift
  if (!lineFail && !badMeasure) return;

  const cooled = tick - f.lastAbortTick >= combatTuning.abortCooldownTicks;
  const stamOk = f.stamina / f.maxStamina > 0.25;
  const notOnTempo = tick >= f.tempoUntil;
  if (!cooled || f.abortUsedExchange || !stamOk || !notOnTempo) return;

  const bias = abortBias(f);
  if (!rng.chance(0.18 + bias * 0.4)) return;

  performAbort(f, enemy, false, tick, pushEvent);
}

export function performAbort(
  f: Fighter,
  foe: Fighter,
  wasFeint: boolean,
  tick: number,
  pushEvent: PushCombatEvent,
): void {
  const d = f.def();
  f.abortWindup(combatTuning.abortRecoverTicks);
  f.stamina = Math.min(
    f.maxStamina,
    f.stamina + d.attackStamina * combatTuning.abortStaminaRefund,
  );
  f.lastAbortTick = tick;
  if (!wasFeint) f.abortUsedExchange = true;
  f.feintStage = 'NONE';
  f.attackFinish = null;
  f.attackCd = Math.max(4, Math.floor(d.attackCooldown * 0.45));

  assignIntention(f, wasFeint ? 'ANGLE' : 'YIELD', tick);
  foe.tempoUntil = Math.max(foe.tempoUntil, tick + 10);
  if (!wasFeint) {
    assignIntention(foe, 'PRESS', tick);
  }
  pushEvent('ABORT', f, foe);
}
