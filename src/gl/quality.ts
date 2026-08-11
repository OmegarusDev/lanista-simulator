import { getDesign } from '../shell/canvas';
import type { Quality } from './types';

export type { Quality };

/** Mobile-first: short phones → coarser noise / fewer cavea steps. */
export function gfxQuality(): Quality {
  const { w, h } = getDesign();
  const short = Math.min(w, h);
  if (short < 420) return 'low';
  if (short < 700) return 'med';
  return 'high';
}

export function noiseTileSize(q: Quality = gfxQuality()): number {
  return q === 'low' ? 64 : q === 'med' ? 96 : 128;
}

export function fbmOctaves(q: Quality = gfxQuality()): number {
  return q === 'low' ? 2 : q === 'med' ? 3 : 4;
}

export function caveaSteps(q: Quality = gfxQuality()): number {
  return q === 'low' ? 3 : q === 'med' ? 5 : 7;
}

export function shadowsEnabled(q: Quality = gfxQuality()): boolean {
  return q !== 'low';
}

export function particleCap(q: Quality = gfxQuality()): number {
  return q === 'low' ? 48 : q === 'med' ? 96 : 160;
}

/** Max new texture uploads per RAF warm-up slice. */
export function bakeBudgetPerFrame(q: Quality = gfxQuality()): number {
  return q === 'low' ? 1 : 2;
}
