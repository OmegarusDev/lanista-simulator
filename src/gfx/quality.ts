import { getDesign } from '../shell/canvas';

export type Quality = 'low' | 'med' | 'high';

/** Mobile-first: short phones → coarser noise / fewer octaves. */
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

export function tesseraSize(q: Quality = gfxQuality()): number {
  return q === 'low' ? 10 : q === 'med' ? 7 : 5;
}

/** Max new atlas plates baked per RAF warm-up slice. */
export function bakeBudgetPerFrame(q: Quality = gfxQuality()): number {
  return q === 'low' ? 1 : 2;
}
