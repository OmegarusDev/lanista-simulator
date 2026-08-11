import { describe, expect, it } from 'vitest';
import { ARMATURA_LOADOUTS, loadoutPartIds } from '../content/kitPieces';
import type { FighterSnapshot } from '../domain/combat/types';
import { resolveParts, toFighterDraw } from './drawModel';

function stubSnap(over: Partial<FighterSnapshot> = {}): FighterSnapshot {
  return {
    id: 7,
    team: 0,
    kind: 'gladiator',
    armatura: 'MURMILLO',
    beastId: null,
    name: 'Test',
    x: 100,
    y: 200,
    facing: 0,
    hp: 80,
    maxHp: 100,
    stamina: 40,
    maxStamina: 50,
    poise: 60,
    maxPoise: 80,
    action: 'NONE',
    phase: 'IDLE',
    phaseT: 0,
    phaseMax: 0,
    footwork: 'HOLD',
    intention: 'PRESS',
    desiredDist: 44,
    poiseTier: 'SOLID',
    stunned: false,
    tangled: false,
    poiseBroken: false,
    guarding: false,
    alive: true,
    flash: 0,
    ...over,
  };
}

describe('toFighterDraw', () => {
  it('maps intention, poiseTier, and stock parts', () => {
    const d = toFighterDraw(stubSnap({ intention: 'YIELD', poiseTier: 'CRITICAL' }));
    expect(d.intention).toBe('YIELD');
    expect(d.poiseTier).toBe('CRITICAL');
    expect(d.parts.length).toBeGreaterThan(0);
    expect(d.parts).toEqual(loadoutPartIds(ARMATURA_LOADOUTS.MURMILLO));
    expect(d.armatura).toBe('MURMILLO');
  });

  it('prefers partsOverride over stock', () => {
    const parts = ['helm_secutor', 'shield_scutum', 'weapon_gladius', 'greaves_heavy', 'manica_right'];
    const d = toFighterDraw(stubSnap({ partsOverride: parts }));
    expect(d.parts).toEqual(parts);
  });

  it('threads appearanceSeed from opts', () => {
    const a = toFighterDraw(stubSnap(), { appearanceSeed: 42 });
    const b = toFighterDraw(stubSnap(), { appearanceSeed: 99 });
    expect(a.appearanceSeed).toBe(42);
    expect(b.appearanceSeed).toBe(99);
    expect(a.appearanceSeed).not.toBe(b.appearanceSeed);
  });

  it('includes ratios and action phase', () => {
    const d = toFighterDraw(
      stubSnap({ hp: 50, maxHp: 100, stamina: 25, maxStamina: 50, phase: 'WINDUP' }),
    );
    expect(d.hpRatio).toBeCloseTo(0.5);
    expect(d.staminaRatio).toBeCloseTo(0.5);
    expect(d.actionPhase).toBe('WINDUP');
  });
});

describe('resolveParts', () => {
  it('returns empty for beasts', () => {
    expect(resolveParts('MURMILLO', 'beast')).toEqual([]);
  });

  it('Murmillo stock differs from Retiarius', () => {
    const m = resolveParts('MURMILLO', 'gladiator');
    const r = resolveParts('RETIARIUS', 'gladiator');
    expect(m).not.toEqual(r);
    expect(m.some((p) => p.includes('shield') || p.includes('scutum'))).toBe(true);
  });
});
