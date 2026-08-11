import { effectiveAttackArc } from '../../content/armatura';
import { combatTuning } from '../../content/combat';
import { angleTo, dist, inCone } from './geometry';
import type { Fighter } from './fighter';
import type { SeededRNG } from '../rng';
import type { CombatEvent } from './types';
import {
  applyGuardRhythm,
  applyHitRhythm,
  applyPoiseBreakRhythm,
  assignIntention,
} from './matchRhythm';

export type PushCombatEvent = (
  kind: CombatEvent['kind'],
  actor: Fighter,
  target?: Fighter,
  amount?: number,
) => void;

export function resolveCuts(
  fighters: Fighter[],
  tick: number,
  rng: SeededRNG,
  pushEvent: PushCombatEvent,
  setStareTicks: (n: number) => void,
): void {
  for (const atk of fighters) {
    if (!atk.alive || atk.phase !== 'ACTIVE' || atk.action !== 'ATTACK') continue;
    if (atk.hitConnected) continue;

    const d = atk.def();
    for (const tgt of fighters) {
      if (!tgt.alive || tgt.team === atk.team) continue;

      const distance = dist(atk.x, atk.y, tgt.x, tgt.y);
      if (distance > d.attackRange) continue;

      const toTgt = angleTo(atk.x, atk.y, tgt.x, tgt.y);
      const atkArc = effectiveAttackArc(d, atk.footwork);
      if (!inCone(atk.facing, toTgt, atkArc)) continue;

      // Sidestep i-frames — fully avoids the cut (no HP or poise)
      if (tgt.sidestepping) {
        pushEvent('SIDESTEP', tgt, atk);
        atk.hitConnected = true;
        continue;
      }

      const weaponDmg = atk.def().strength * d.damageMul * combatTuning.damageScale;
      const poiseDmg = weaponDmg * d.poiseMul * combatTuning.poiseDamageScale;

      const toAtk = angleTo(tgt.x, tgt.y, atk.x, atk.y);
      const inGuard =
        tgt.canGuard &&
        tgt.guarding &&
        tgt.stamina > 0 &&
        inCone(tgt.facing, toAtk, tgt.effectiveGuardArc());

      const nx = Math.cos(atk.facing);
      const ny = Math.sin(atk.facing);

      // Poise always chips on contact — cannot be blocked
      const broke = tgt.applyPoiseDamage(poiseDmg);
      if (broke) {
        pushEvent('POISE_BREAK', atk, tgt);
        applyPoiseBreakRhythm(atk, tgt, tick);
      }

      // Soft-tier stumble threat invites PRESS, not stalemate
      if (
        !broke &&
        tgt.poiseTier === 'CRITICAL' &&
        rng.chance(combatTuning.criticalStumbleChance)
      ) {
        tgt.applyStumble(combatTuning.criticalStumbleTicks);
        pushEvent('STUMBLE', atk, tgt);
        assignIntention(atk, 'PRESS', tick);
      }

      // Guard only holds if posture survived this contact — a break drops the shield
      if (inGuard && !broke) {
        const absorbed = weaponDmg * tgt.def().guardAbsorb * 0.35;
        tgt.hp = Math.max(0, tgt.hp - absorbed);
        tgt.stamina = Math.max(0, tgt.stamina - 4 * atk.def().mass);
        atk.stamina = Math.max(0, atk.stamina - 2);
        // Shield shock: planted guard cracks the attacker's posture
        if (tgt.def().shieldShock > 0) {
          const shocked = atk.applyPoiseDamage(tgt.def().shieldShock);
          if (shocked) {
            pushEvent('POISE_BREAK', tgt, atk);
            applyPoiseBreakRhythm(tgt, atk, tick);
          }
        }
        tgt.x += nx * combatTuning.knockbackOnGuard * 0.4;
        tgt.y += ny * combatTuning.knockbackOnGuard * 0.4;
        atk.x -= nx * combatTuning.knockbackOnGuard * 0.6;
        atk.y -= ny * combatTuning.knockbackOnGuard * 0.6;
        pushEvent('GUARD', tgt, atk, absorbed);
        atk.hitConnected = true;
        applyGuardRhythm(atk, tgt, tick, rng, setStareTicks);
        if (tgt.hp <= 0) pushEvent('KO', atk, tgt);
        continue;
      }

      tgt.hp = Math.max(0, tgt.hp - weaponDmg);
      const kb = combatTuning.knockbackOnHit / Math.max(0.6, tgt.def().mass);
      tgt.x += nx * kb;
      tgt.y += ny * kb;
      tgt.flash = 8;
      pushEvent('HIT', atk, tgt, weaponDmg);
      atk.hitConnected = true;
      applyHitRhythm(atk, tgt, tick, rng, setStareTicks);

      // Tip catch (pause) — resist shortens/negates (Secutor helm, Scissor, etc.)
      if (
        d.tipCatchRatio > 0 &&
        distance >= d.attackRange * d.tipCatchRatio &&
        distance <= d.attackRange
      ) {
        const ticks = Math.floor(d.tipCatchTicks * (1 - tgt.def().tipCatchResist));
        if (ticks > 0) {
          tgt.tangleT = Math.max(tgt.tangleT, ticks);
          pushEvent('TIP_CATCH', atk, tgt);
        }
      }

      if (tgt.hp <= 0) pushEvent('KO', atk, tgt);
    }
  }
}
