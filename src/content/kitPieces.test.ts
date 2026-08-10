import { describe, expect, it } from 'vitest';
import { ARMATURA_LIST, ARMATURAE } from './armatura';
import { ARMATURA_LOADOUTS, assembleLoadout, KIT_PARTS } from './kitPieces';

describe('kit piece assembly', () => {
  it('builds every preset armatura from loadout parts', () => {
    for (const id of ARMATURA_LIST) {
      const assembled = assembleLoadout(ARMATURA_LOADOUTS[id]!);
      expect(assembled).toEqual(ARMATURAE[id]);
    }
  });

  it('references only known part ids', () => {
    for (const id of ARMATURA_LIST) {
      const L = ARMATURA_LOADOUTS[id]!;
      for (const pid of [L.helm, L.shield, L.weapon, L.greaves, L.manica]) {
        if (pid == null) continue;
        expect(KIT_PARTS[pid], pid).toBeTruthy();
      }
    }
  });

  it('preserves classic murmillo bulk', () => {
    expect(ARMATURAE.MURMILLO.maxHealth).toBe(125);
    expect(ARMATURAE.MURMILLO.guardArc).toBe(1.05);
    expect(ARMATURAE.RETIARIUS.tipCatchRatio).toBe(0.55);
    expect(ARMATURAE.SECUTOR.tipCatchResist).toBe(0.75);
  });
});
