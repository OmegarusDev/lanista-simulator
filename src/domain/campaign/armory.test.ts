import { describe, expect, it } from 'vitest';
import { equipPart } from './facilities';
import { createSeason } from './season';
import { spawnSpecFromGladiator } from './combatMods';
import { ARMATURA_LOADOUTS, loadoutPartIds } from '../../content/kitPieces';

describe('armory equipPart', () => {
  it('writes partsOverride and threads into spawn spec', () => {
    const season = createSeason(42);
    season.facilities.push('ARMAMENTARIUM');
    season.denarii = 200;
    const g = season.roster[0]!;
    const ok = equipPart(season, g.id, 'shield', 'shield_parmula');
    expect(ok).toBe(true);
    expect(g.partsOverride?.some((p) => p.includes('parmula') || p.includes('shield'))).toBe(true);
    const spec = spawnSpecFromGladiator(g);
    expect(spec.partsOverride).toEqual(g.partsOverride);
    expect(spec.appearanceSeed).toBe(g.appearanceSeed);
  });

  it('stock murmillo differs from equipped round shield silhouette parts', () => {
    const season = createSeason(7);
    season.facilities.push('ARMAMENTARIUM');
    season.denarii = 200;
    const g = season.roster.find((x) => x.armatura === 'MURMILLO') ?? season.roster[0]!;
    g.armatura = 'MURMILLO';
    const stock = loadoutPartIds(ARMATURA_LOADOUTS.MURMILLO);
    equipPart(season, g.id, 'shield', 'shield_parmula');
    expect(g.partsOverride).not.toEqual(stock);
  });
});
