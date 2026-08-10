/**
 * Legacy Lab amphitheatre helpers — product UI removed.
 * Preview placement now lives in `stagePaint.placePreviewInWorld`.
 * Kept minimal API for tests / migration.
 */
import type { FighterSnapshot } from '../domain/combat/types';
import { combatTuning } from '../content/combat';
import type { Rect } from './ui';

export interface LabStageGeom {
  w: number;
  h: number;
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  fighterSlots: { x: number; y: number; facing: number; team: 0 | 1 }[];
}

/** World-space slots (same language as Fight), not design-space amphitheatre. */
export function labStageGeom(_w: number, _h: number, teamSize: number): LabStageGeom {
  const cx = combatTuning.arenaCX;
  const cy = combatTuning.arenaCY;
  const rx = combatTuning.arenaRX;
  const ry = combatTuning.arenaRY;
  const fighterSlots: LabStageGeom['fighterSlots'] = [];
  const spread = teamSize >= 3 ? Math.min(52, ry * 0.22) : Math.min(44, ry * 0.2);
  for (let team = 0 as 0 | 1; team < 2; team++) {
    const baseX = cx + (team === 0 ? -rx * 0.38 : rx * 0.38);
    for (let i = 0; i < teamSize; i++) {
      const y = cy + (i - (teamSize - 1) / 2) * spread;
      fighterSlots.push({
        x: baseX,
        y,
        facing: team === 0 ? 0 : Math.PI,
        team: team as 0 | 1,
      });
    }
  }
  return { w: 960, h: 540, cx, cy, rx, ry, fighterSlots };
}

export function placeLabFighters(
  snaps: FighterSnapshot[],
  geom: LabStageGeom,
): FighterSnapshot[] {
  return snaps.map((f, i) => {
    const slot = geom.fighterSlots[i];
    if (!slot) return f;
    return { ...f, x: slot.x, y: slot.y, facing: slot.facing };
  });
}

export function pickLabFighter(
  snaps: readonly FighterSnapshot[],
  x: number,
  y: number,
  radius = 36,
): FighterSnapshot | null {
  let best: FighterSnapshot | null = null;
  let bestD = radius * radius;
  for (const f of snaps) {
    const d = (f.x - x) ** 2 + (f.y - y) ** 2;
    if (d <= bestD) {
      bestD = d;
      best = f;
    }
  }
  return best;
}

/** @deprecated DOM chrome owns beams/shelves now. */
export function labChromeRects(
  w: number,
  h: number,
  _pad?: number,
): { beam: Rect; shelf: Rect } {
  const beamH = Math.min(96, h * 0.12);
  const shelfH = Math.min(168, h * 0.22);
  return {
    beam: { x: 0, y: 0, w, h: beamH },
    shelf: { x: 0, y: h - shelfH, w, h: shelfH },
  };
}
