import { describe, expect, it } from 'vitest';
import { resolveParts, toFighterDraw } from './drawModel';
import { appearanceHash, kitPartsForFighter } from './kitMesh';
import type { FighterSnapshot } from '../domain/combat/types';

function stub(over: Partial<FighterSnapshot> = {}): FighterSnapshot {
  return {
    id: 1,
    team: 0,
    kind: 'gladiator',
    armatura: 'MURMILLO',
    beastId: null,
    name: 'A',
    x: 100,
    y: 100,
    facing: 0,
    hp: 100,
    maxHp: 100,
    stamina: 50,
    maxStamina: 50,
    poise: 80,
    maxPoise: 80,
    action: 'NONE',
    phase: 'IDLE',
    phaseT: 0,
    phaseMax: 0,
    footwork: 'HOLD',
    intention: 'NONE',
    desiredDist: 40,
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

describe('kitMesh', () => {
  it('Murmillo has shield; Retiarius has net/trident features', () => {
    const m = kitPartsForFighter(toFighterDraw(stub({ armatura: 'MURMILLO' })));
    const r = kitPartsForFighter(
      toFighterDraw(stub({ armatura: 'RETIARIUS', id: 2 })),
    );
    expect(m.some((p) => p.kind === 'shield' || p.kind === 'roundShield')).toBe(true);
    expect(r.some((p) => p.kind === 'net' || p.kind === 'trident')).toBe(true);
    expect(m.map((p) => p.kind).join()).not.toBe(r.map((p) => p.kind).join());
  });

  it('appearanceSeed changes draw hash', () => {
    const a = toFighterDraw(stub(), { appearanceSeed: 11 });
    const b = toFighterDraw(stub(), { appearanceSeed: 99991 });
    expect(appearanceHash(a)).not.toBe(appearanceHash(b));
  });

  it('beast uses beastBody mesh', () => {
    const d = toFighterDraw(
      stub({ kind: 'beast', beastId: 'LION', armatura: 'MURMILLO' }),
    );
    expect(resolveParts(d.armatura, 'beast')).toEqual([]);
    expect(kitPartsForFighter(d).some((p) => p.kind === 'beastBody')).toBe(true);
  });
});
