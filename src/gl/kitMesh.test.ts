import { describe, expect, it } from 'vitest';
import { resolveParts, toFighterDraw } from './drawModel';
import { appearanceHash, kitPartsForFighter } from './kitMesh';
import { parseGeometryParams } from './sceneFighters';
import { ARMATURA_LIST } from '../content/armatura';
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

  it('shape-driven: blades are tapered frustums, helms are lathe bowls', () => {
    const m = kitPartsForFighter(toFighterDraw(stub({ armatura: 'MURMILLO' })));
    const blade = m.find((p) => p.kind === 'gladius' && p.geo.kind === 'frustum');
    expect(blade).toBeTruthy();
    expect(blade!.geo.params).toMatch(/^f/);
    const helm = m.find((p) => p.kind === 'helm');
    expect(helm!.geo.kind).toBe('lathe');
    expect(helm!.geo.params).toMatch(/;/); // multi-point profile
  });

  it('retiarius trident carries three tines and a net loop', () => {
    const r = kitPartsForFighter(toFighterDraw(stub({ armatura: 'RETIARIUS', id: 2 })));
    const tines = r.filter((p) => p.kind === 'trident' && p.sz !== undefined);
    // 3 tines + shaft + crossbar all share the trident kind; verify distinct offsets.
    const zOffsets = new Set(tines.map((t) => t.oz.toFixed(2)));
    expect(zOffsets.size).toBeGreaterThanOrEqual(3);
    expect(r.some((p) => p.kind === 'net')).toBe(true);
  });

  it('weapon geometry differs across armaturae (math is the weapon)', () => {
    const gl = kitPartsForFighter(toFighterDraw(stub({ armatura: 'MURMILLO' })));
    const si = kitPartsForFighter(toFighterDraw(stub({ armatura: 'THRAEX', id: 3 })));
    const tr = kitPartsForFighter(toFighterDraw(stub({ armatura: 'RETIARIUS', id: 4 })));
    const keys = (parts: ReturnType<typeof kitPartsForFighter>) =>
      parts.map((p) => `${p.kind}:${p.geo.params}`).join('|');
    expect(keys(si)).not.toBe(keys(gl));
    expect(keys(tr)).not.toBe(keys(gl));
    expect(keys(si)).not.toBe(keys(tr));
  });

  it('shield faces are team-painted; rims roll into the shield plane', () => {
    const m = kitPartsForFighter(toFighterDraw(stub({ armatura: 'MURMILLO' })));
    const face = m.find((p) => p.kind === 'shield' || p.kind === 'roundShield');
    expect(face!.teamPaint).toBe(true);
    const rim = m.find((p) => p.kind === 'shieldRim');
    expect(rim).toBeTruthy();
    expect(rim!.rz).toBe(90); // torus rolled into the Y-Z plane
  });

  it('NO INVISIBLE GEOMETRY: every armatura kit resolves to finite, non-zero shapes', () => {
    for (const armatura of ARMATURA_LIST) {
      const parts = kitPartsForFighter(toFighterDraw(stub({ armatura })));
      expect(parts.length, armatura).toBeGreaterThan(0);
      for (const p of parts) {
        const params = parseGeometryParams(p.geo);
        if (params === null) continue; // shared primitives are always fine
        for (let i = 0; i < params.length; i++) {
          const v = params[i]!;
          const label = `${armatura} ${p.kind} ${p.geo.params}`;
          expect(Number.isFinite(v), label).toBe(true);
          // Lathe Y coordinates are positions (may be negative); radii and
          // all other dims must be non-negative or the builder degenerates.
          if (p.geo.kind === 'lathe' && i % 2 === 0) continue;
          expect(v, label).toBeGreaterThanOrEqual(0);
        }
      }
    }
  });

  it('gladius blade round-trips through the cache key to the shape dims', () => {
    const m = kitPartsForFighter(toFighterDraw(stub({ armatura: 'MURMILLO' })));
    const blades = m.filter((p) => p.kind === 'gladius' && p.geo.kind === 'frustum');
    const [w, len, t, wTip, tTip] = parseGeometryParams(
      blades.sort((a, b) => parseGeometryParams(b.geo)![1]! - parseGeometryParams(a.geo)![1]!)[0]!.geo,
    )!;
    expect(len).toBeGreaterThan(12); // full blade length in hundredths-encoded units
    expect(w).toBeGreaterThan(t); // blade is wide and thin
    expect(wTip).toBeLessThan(w); // tapers toward the tip
    expect(tTip).toBeLessThanOrEqual(t);
  });

  it('NO FLOATING WEAPONS: every weapon starts at its hand (no gap)', () => {
    const HAND_ANGLES = { MURMILLO: 0.72, THRAEX: 0.78, SECUTOR: 0.72, HOPLOMACHUS: 0.55, PROVOCATOR: 0.7, DIMACHAERUS: 0.85, RETIARIUS: 0.7, SCISSOR: 0.75 } as const;
    const WEAPON_KINDS = new Set(['gladius', 'sica', 'trident', 'spear', 'dual', 'scissor']);
    // Extent along +X after the rz=−90 roll: frustums carry length in their
    // sy param; bent blades in their length param.
    const extentX = (p: ReturnType<typeof kitPartsForFighter>[number]): number => {
      if (p.geo.kind === 'frustum') return parseGeometryParams(p.geo)![1]!;
      if (p.geo.kind === 'bent') return parseGeometryParams(p.geo)![0]!;
      return p.sy;
    };
    for (const armatura of ARMATURA_LIST) {
      const parts = kitPartsForFighter(toFighterDraw(stub({ armatura })));
      const angle = HAND_ANGLES[armatura as keyof typeof HAND_ANGLES] ?? 0.72;
      const handX = Math.cos(angle) * 9;
      for (const kind of WEAPON_KINDS) {
        const starts = parts
          .filter((p) => p.kind === kind)
          .map((p) => p.ox - extentX(p) / 2);
        if (starts.length === 0) continue;
        const minStart = Math.min(...starts);
        expect(minStart, `${armatura} ${kind} start=${minStart.toFixed(2)} hand=${handX.toFixed(2)}`)
          .toBeLessThan(handX + 0.75);
      }
    }
  });
});
