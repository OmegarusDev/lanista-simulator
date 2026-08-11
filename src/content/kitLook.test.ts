import { describe, expect, it } from 'vitest';
import { ARMATURA_LOOK } from './appearance';
import { ARMATURA_LOADOUTS, loadoutPartIds } from './kitPieces';
import { lookFlags, lookFromParts } from './kitLook';

describe('lookFromParts', () => {
  it('matches stock Murmillo ARMATURA_LOOK silhouette flags', () => {
    const base = ARMATURA_LOOK.MURMILLO;
    const parts = loadoutPartIds(ARMATURA_LOADOUTS.MURMILLO);
    const derived = lookFromParts(parts, base);
    expect(lookFlags(derived)).toEqual(lookFlags(base));
    expect(derived.bodyRx).toBe(base.bodyRx);
    expect(derived.metal).toBe(base.metal);
  });

  it('matches stock Retiarius (asymmetric: bare head + trident/net, no shield)', () => {
    const base = ARMATURA_LOOK.RETIARIUS;
    const parts = loadoutPartIds(ARMATURA_LOADOUTS.RETIARIUS);
    const derived = lookFromParts(parts, base);
    expect(lookFlags(derived)).toEqual(lookFlags(base));
    expect(derived.bareHead).toBe(true);
    expect(derived.trident).toBe(true);
    expect(derived.net).toBe(true);
    expect(derived.shield).toBe(false);
  });

  it('overrides stock flags when parts change (parmula on murmillo base)', () => {
    const base = ARMATURA_LOOK.MURMILLO;
    const mur = ARMATURA_LOADOUTS.MURMILLO;
    const parts = loadoutPartIds({
      ...mur,
      shield: 'shield_parmula',
    });
    const derived = lookFromParts(parts, base);
    expect(derived.shield).toBe(true);
    expect(derived.roundShield).toBe(true);
    expect(derived.crest).toBe(true);
  });
});
