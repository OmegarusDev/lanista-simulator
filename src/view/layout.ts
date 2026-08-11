import { orientationOf } from '../shell/canvas';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface WorldViewTransform {
  /** Design-space rect where the arena world is painted. */
  view: Rect;
  /** Uniform world → design scale. */
  scale: number;
  /** Design origin of world (0,0). */
  ox: number;
  oy: number;
}

/** Map design coords → arena world (for hit-testing fighters). */
export function designToWorld(
  x: number,
  y: number,
  t: WorldViewTransform,
): { x: number; y: number } {
  const s = t.scale || 1;
  return { x: (x - t.ox) / s, y: (y - t.oy) / s };
}

/**
 * World→view zoom past contain-fit.
 * Narrow / portrait: crop a little L/R so the oval approaches the edges and
 * the painted world uses more of the tall arena band. Landscape: slight zoom
 * for a taller feel without burying HUD.
 */
export function fightArenaZoom(w: number, h: number): number {
  const portrait = orientationOf(w, h) === 'portrait';
  const shortSide = Math.min(w, h);
  if (portrait) {
    // Phone-width portrait gets the strongest nudge; wider tablets milder.
    if (w < 420) return 1.14;
    if (w < 600) return 1.1;
    return 1.06;
  }
  // Landscape phone / short stage: pull sides in a touch.
  if (shortSide < 480 || w < 900) return 1.06;
  return 1.03;
}
