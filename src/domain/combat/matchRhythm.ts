import { combatTuning } from '../../content/combat';
import { nearestEnemy } from './ai';
import { dist } from './geometry';
import type { Fighter } from './fighter';
import type { SeededRNG } from '../rng';
import type { Intention } from './types';

export function assignIntention(
  f: Fighter,
  kind: Intention,
  tick: number,
  durationOverride?: number,
): void {
  const dur =
    durationOverride ??
    (kind === 'PRESS'
      ? combatTuning.pressTicks
      : kind === 'YIELD'
        ? combatTuning.yieldTicks
        : kind === 'ANGLE'
          ? combatTuning.angleTicks
          : kind === 'INVITE'
            ? combatTuning.inviteTicks
            : kind === 'FEINT'
              ? combatTuning.feintTicks
              : kind === 'RESET'
                ? combatTuning.resetTicks
                : 20);
  f.setIntention(kind, tick + dur);
}

/** Fresh posture break: victim scrambles, attacker gets a short punish PRESS. */
export function applyPoiseBreakRhythm(atk: Fighter, tgt: Fighter, tick: number): void {
  atk.brokenPunishContacts = 0;
  assignIntention(tgt, 'YIELD', tick);
  assignIntention(atk, 'PRESS', tick, combatTuning.brokenPunishPressTicks);
  atk.tempoUntil = Math.max(atk.tempoUntil, tick + 8);
  tgt.tempoUntil = Math.max(tgt.tempoUntil, tick + combatTuning.tempoAfterHitTaken);
}

/**
 * Wound shock — short self tempo / stamina / move tax after heavy contact.
 * clinchPanic amplifies; pursueBias resists. Feeds nerve via HP + temporary gates.
 */
export function applyWoundShock(tgt: Fighter, tick: number, fromBreak: boolean): void {
  const d = tgt.def();
  const t = combatTuning;
  const base = fromBreak ? t.woundShockBreakTicks : t.woundShockHitTicks;
  const amp = 1 + d.clinchPanic * t.woundShockPanicAmp - d.pursueBias * t.woundShockPursueResist;
  const dur = Math.max(6, Math.round(base * Math.max(0.55, amp)));
  tgt.woundShockUntil = Math.max(tgt.woundShockUntil, tick + dur);
  const stamTax = fromBreak ? t.woundShockStaminaBreak : t.woundShockStaminaHit;
  tgt.stamina = Math.max(0, tgt.stamina - stamTax * amp);
  tgt.tempoUntil = Math.max(tgt.tempoUntil, tick + Math.floor(dur * 0.65));
}

export function woundShockMoveMul(f: Fighter, tick: number): number {
  if (tick >= f.woundShockUntil) return 1;
  return combatTuning.woundShockMoveMul;
}

/**
 * Attacker intention after contact on a still-broken foe.
 * Caps PRESS farming — after a few hits / clinch, ease to ANGLE/RESET.
 */
export function assignBrokenPunishFollowup(
  atk: Fighter,
  tgt: Fighter,
  tick: number,
  rng: SeededRNG,
): void {
  atk.brokenPunishContacts++;
  const clinchDist = combatTuning.bodyRadius * combatTuning.clinchOrbitMul;
  const distance = dist(atk.x, atk.y, tgt.x, tgt.y);
  const spent =
    atk.brokenPunishContacts >= combatTuning.brokenPunishMaxHits || distance < clinchDist;
  if (spent) {
    assignIntention(atk, rng.chance(0.55) ? 'ANGLE' : 'RESET', tick);
  } else {
    assignIntention(atk, 'PRESS', tick, combatTuning.brokenPunishPressTicks);
  }
  assignIntention(tgt, 'YIELD', tick);
}

/** Landed cut → presser PRESSes, victim YIELDs (broken: short punish then ease off). */
export function applyHitRhythm(
  atk: Fighter,
  tgt: Fighter,
  tick: number,
  rng: SeededRNG,
  setStareTicks: (n: number) => void,
): void {
  atk.markExchangeContact();
  tgt.markExchangeContact();

  if (tgt.poiseBroken) {
    // Fresh break already set PRESS via applyPoiseBreakRhythm — subsequent hits
    // count toward the punish cap and then ANGLE/RESET.
    assignBrokenPunishFollowup(atk, tgt, tick, rng);
    atk.tempoUntil = tick + combatTuning.tempoAfterCommit;
    tgt.tempoUntil = tick + combatTuning.tempoAfterHitTaken;
    setStareTicks(0);
    return;
  }

  atk.brokenPunishContacts = 0;
  assignIntention(atk, 'PRESS', tick);
  atk.tempoUntil = tick + combatTuning.tempoAfterCommit;

  assignIntention(tgt, 'YIELD', tick);
  tgt.tempoUntil = tick + combatTuning.tempoAfterHitTaken;
  // Soft victim invites extra PRESS weight next beat
  if (tgt.poiseTier === 'SOFT' || tgt.poiseTier === 'CRITICAL') {
    atk.intentionUntil = Math.max(atk.intentionUntil, tick + combatTuning.pressTicks + 8);
  }
  setStareTicks(0);
}

/** Shield clash → attacker eases off, defender angles or collapses. */
export function applyGuardRhythm(
  atk: Fighter,
  tgt: Fighter,
  tick: number,
  rng: SeededRNG,
  setStareTicks: (n: number) => void,
): void {
  atk.markExchangeContact();
  tgt.markExchangeContact();
  // Tip-range kits ANGLE away instead of full retreat (keeps cast threat alive)
  assignIntention(atk, atk.def().clinchPanic > 0.5 ? 'ANGLE' : 'YIELD', tick);
  atk.tempoUntil = tick + combatTuning.tempoAfterCommit;

  // Pursuers collapse after a clean guard; others take the offline step
  const collapse = rng.chance(0.35 + tgt.def().pursueBias * 0.5);
  assignIntention(tgt, collapse ? 'PRESS' : 'ANGLE', tick);
  tgt.tempoUntil = tick + Math.floor(combatTuning.tempoAfterCommit * 0.5);
  setStareTicks(0);
}

/** Whiff → attacker YIELDs, opponent PRESSes. */
export function applyWhiffRhythm(
  atk: Fighter,
  fighters: Fighter[],
  tick: number,
  setStareTicks: (n: number) => void,
): void {
  atk.markExchangeContact();
  assignIntention(atk, 'YIELD', tick);
  atk.tempoUntil = tick + combatTuning.tempoAfterCommit;
  const foe = nearestEnemy(atk, fighters);
  if (foe) {
    foe.markExchangeContact();
    assignIntention(foe, 'PRESS', tick);
    foe.tempoUntil = Math.max(foe.tempoUntil, tick + 8);
  }
  setStareTicks(0);
}

/** Break idle stares / clinch jams per fighter pair — not only when everyone is stuck. */
export function updateStareRhythm(
  fighters: Fighter[],
  tick: number,
  stareTicks: number,
  rng: SeededRNG,
): number {
  const alive = fighters.filter((f) => f.alive);
  if (alive.length < 2) {
    return 0;
  }

  const clinchDist = combatTuning.bodyRadius * combatTuning.clinchOrbitMul;
  let anyStuckPair = false;

  for (const f of alive) {
    const foe = nearestEnemy(f, fighters);
    if (!foe || f.phase !== 'IDLE' || f.action !== 'NONE') continue;
    const dd = dist(f.x, f.y, foe.x, foe.y);
    const inMeasure = dd >= f.def().measureMin * 0.9 && dd <= f.def().measureMax * 1.1;
    const inClinch = dd < clinchDist * 1.2;
    const intent = f.activeIntention(tick);
    const foeIdle = foe.phase === 'IDLE' && foe.action === 'NONE';
    if (!foeIdle) continue;
    if (inClinch && (intent === 'NONE' || intent === 'PRESS' || intent === 'INVITE')) {
      anyStuckPair = true;
      break;
    }
    if (intent === 'NONE' && inMeasure) {
      anyStuckPair = true;
      break;
    }
  }

  if (!anyStuckPair) {
    return 0;
  }

  const next = stareTicks + 1;
  const clinched = alive.some((f) => {
    const foe = nearestEnemy(f, fighters);
    return foe && dist(f.x, f.y, foe.x, foe.y) < clinchDist * 1.2;
  });
  const threshold = clinched
    ? Math.floor(combatTuning.staleStareTicks * 0.55)
    : combatTuning.staleStareTicks;
  if (next < threshold) return next;

  // Prefer breaking the closest jammed pair
  let pick = alive[0]!;
  let best = Infinity;
  for (const f of alive) {
    const foe = nearestEnemy(f, fighters);
    if (!foe) continue;
    const dd = dist(f.x, f.y, foe.x, foe.y);
    if (dd < best) {
      best = dd;
      pick = f;
    }
  }
  assignIntention(pick, 'ANGLE', tick);
  pick.desiredDist = Math.max(
    pick.desiredDist,
    (pick.def().measureMin + pick.def().measureMax) * 0.55,
  );
  pick.tempoUntil = Math.max(pick.tempoUntil, tick + 12);
  const other = nearestEnemy(pick, fighters);
  if (other) {
    assignIntention(other, rng.chance(0.5) ? 'YIELD' : 'ANGLE', tick);
    other.desiredDist = Math.max(
      other.desiredDist,
      (other.def().measureMin + other.def().measureMax) * 0.5,
    );
  }
  return 0;
}
