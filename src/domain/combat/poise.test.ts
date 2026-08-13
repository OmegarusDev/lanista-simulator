import { describe, expect, it } from 'vitest';
import { ARMATURAE } from '../../content/armatura';
import { combatTuning } from '../../content/combat';
import { SeededRNG } from '../rng';
import { computeDesiredDist, decideCommit, decideFootwork } from './ai';
import { Fighter, poiseTierOf, resetFighterIds } from './fighter';
import { createQuickMatch } from './match';

describe('Poise', () => {
  it('maps soft tiers before full break', () => {
    expect(poiseTierOf(100, 100, false)).toBe('SOLID');
    expect(poiseTierOf(50, 100, false)).toBe('SOFT');
    expect(poiseTierOf(20, 100, false)).toBe('CRITICAL');
    expect(poiseTierOf(0, 100, true)).toBe('BROKEN');
  });

  it('soft tiers shrink turn rate and guard arc', () => {
    resetFighterIds();
    const f = new Fighter(0, 'MURMILLO', 'Test', 0, 0, 0);
    const solidTurn = f.effectiveTurnRate();
    const solidGuard = f.effectiveGuardArc();

    f.poise = f.maxPoise * 0.5;
    expect(f.poiseTier).toBe('SOFT');
    expect(f.effectiveTurnRate()).toBeLessThan(solidTurn);
    expect(f.effectiveGuardArc()).toBeLessThan(solidGuard);

    f.poise = f.maxPoise * 0.2;
    expect(f.poiseTier).toBe('CRITICAL');
    expect(f.effectiveTurnRate()).toBeLessThan(solidTurn * combatTuning.softTurnMul + 0.01);
  });

  it('breaks in a few solid chips under current lethality tuning', () => {
    resetFighterIds();
    const f = new Fighter(0, 'THRAEX', 'Test', 0, 0, 0);
    // Typical murmillo-ish hit into thraex poise mul
    const weaponDmg = 13 * ARMATURAE.MURMILLO.damageMul * combatTuning.damageScale;
    const chip = weaponDmg * ARMATURAE.THRAEX.poiseMul * combatTuning.poiseDamageScale;
    let hits = 0;
    while (!f.poiseBroken && hits < 12) {
      f.applyPoiseDamage(chip);
      hits++;
    }
    expect(f.poiseBroken).toBe(true);
    expect(hits).toBeLessThanOrEqual(4);
  });

  it('takes unblockable chips and restores defense at threshold, not full bar', () => {
    resetFighterIds();
    const f = new Fighter(0, 'THRAEX', 'Test', 0, 0, 0);
    const weaponDmg = 10;
    const chip = weaponDmg * ARMATURAE.THRAEX.poiseMul * combatTuning.poiseDamageScale;

    expect(f.canGuard).toBe(true);
    expect(f.canDodge).toBe(true);
    f.applyPoiseDamage(chip);
    expect(f.poise).toBeLessThan(f.maxPoise);
    expect(f.poiseRegenDelay).toBe(combatTuning.poiseRegenDelay);

    while (f.poise > 0) f.applyPoiseDamage(chip);
    expect(f.poiseBroken).toBe(true);
    expect(f.canGuard).toBe(false);
    expect(f.poiseRegenDelay).toBe(combatTuning.poiseBrokenRegenDelay);
    // Brief break stumble blocks actions; once it clears, desperate dodge is allowed
    while (f.stumbleT > 0) f.tickTimers();
    expect(f.canDodge).toBe(true);

    const during = f.poise;
    const delayLeft = f.poiseRegenDelay;
    for (let i = 0; i < delayLeft; i++) f.tickTimers();
    expect(f.poise).toBe(during);

    let steps = 0;
    while (f.poiseBroken && steps < 600) {
      f.tickTimers();
      steps++;
    }
    expect(f.poiseBroken).toBe(false);
    expect(f.poise).toBeGreaterThanOrEqual(f.maxPoise * combatTuning.poiseRestoreRatio);
    expect(f.poise).toBeLessThan(f.maxPoise);
    expect(f.canGuard).toBe(true);
  });

  it('hits while already broken do not refresh regen delay or restumble', () => {
    resetFighterIds();
    const f = new Fighter(0, 'THRAEX', 'Test', 0, 0, 0);
    const chip = 40 * ARMATURAE.THRAEX.poiseMul * combatTuning.poiseDamageScale;
    while (!f.poiseBroken) f.applyPoiseDamage(chip);

    expect(f.poiseBroken).toBe(true);
    expect(f.poiseRegenDelay).toBe(combatTuning.poiseBrokenRegenDelay);
    expect(f.stumbleT).toBe(combatTuning.poiseBreakStumbleTicks);

    // Elapse part of the broken delay, then farm more hits
    for (let i = 0; i < 10; i++) f.tickTimers();
    const delayAfterPartial = f.poiseRegenDelay;
    expect(delayAfterPartial).toBe(combatTuning.poiseBrokenRegenDelay - 10);

    const brokeAgain = f.applyPoiseDamage(chip);
    expect(brokeAgain).toBe(false);
    expect(f.poiseRegenDelay).toBe(delayAfterPartial);
    // Stumble may still be ticking from the original break, but must not refresh upward
    expect(f.stumbleT).toBeLessThanOrEqual(combatTuning.poiseBreakStumbleTicks);
  });

  it('broken fighters open measure hard and prefer YIELD footwork', () => {
    resetFighterIds();
    const self = new Fighter(0, 'MURMILLO', 'Mur', 0, 0, 0);
    const enemy = new Fighter(1, 'THRAEX', 'Thr', 40, 0, Math.PI);
    const mid = (self.def().measureMin + self.def().measureMax) * 0.5;

    self.setIntention('YIELD', 200);
    const solidDist = computeDesiredDist(self, mid, 50);

    self.poise = 0;
    self.poiseBroken = true;
    const brokenDist = computeDesiredDist(self, mid, 50);
    expect(brokenDist).toBeGreaterThan(solidDist);
    expect(brokenDist).toBeGreaterThanOrEqual(self.def().measureMax);

    const rng = new SeededRNG(11);
    self.setIntention('PRESS', 200);
    const fw = decideFootwork(self, enemy, [], rng, 1);
    expect(fw.intentionPick).toBe('YIELD');
    expect(fw.lateralBias).not.toBe(0);
  });

  it('broken fighters can still desperate-sidestep but cannot guard', () => {
    resetFighterIds();
    const self = new Fighter(0, 'THRAEX', 'Thr', 0, 0, 0);
    const enemy = new Fighter(1, 'MURMILLO', 'Mur', 36, 0, Math.PI);
    self.poise = 0;
    self.poiseBroken = true;
    self.stamina = self.maxStamina;
    enemy.action = 'ATTACK';
    enemy.phase = 'ACTIVE';
    enemy.phaseT = 2;
    enemy.phaseMax = 8;
    enemy.facing = Math.PI;

    const rng = new SeededRNG(3);
    const commit = decideCommit(self, enemy, rng, 20);
    expect(commit.guard).toBe(false);
    expect(self.canDodge).toBe(true);
  });

  it('POISE_BREAK assigns YIELD to victim and short PRESS to attacker', () => {
    const m = createQuickMatch(1, 77, ['MURMILLO'], ['THRAEX']);
    const atk = m.fighters[0]!;
    const tgt = m.fighters[1]!;
    atk.x = combatTuning.arenaCX - 30;
    atk.y = combatTuning.arenaCY;
    tgt.x = combatTuning.arenaCX + 10;
    tgt.y = combatTuning.arenaCY;
    atk.facing = 0;
    tgt.facing = Math.PI;
    tgt.poise = 1;
    tgt.poiseBroken = false;

    const d = atk.def();
    expect(atk.startAction('ATTACK', 0, Math.max(4, Math.round(d.active * combatTuning.phaseScale)), 8)).toBe(
      true,
    );
    atk.phase = 'ACTIVE';
    atk.phaseT = 0;
    atk.hitConnected = false;

    // The swept blade needs a couple of ACTIVE ticks to develop its lunge
    // before the first contact (phaseT ≈ 2 reaches full extension).
    for (let i = 0; i < 3 && !atk.hitConnected; i++) {
      m.step();
    }
    expect(m.events.some((e) => e.kind === 'POISE_BREAK')).toBe(true);
    expect(tgt.poiseBroken).toBe(true);
    expect(tgt.intention).toBe('YIELD');
    expect(atk.intention).toBe('PRESS');
    expect(atk.intentionUntil - m.tick).toBeLessThanOrEqual(combatTuning.brokenPunishPressTicks);
  });
});
