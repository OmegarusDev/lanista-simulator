/**
 * Offscreen 2D bake helpers for CSS texture tokens (not the stage).
 * Stage rendering is 100% WebGL2 under `src/gl/`.
 */
import { bakeFbmTile, hexToRgb, tileToImageData, type FbmOpts } from './noise';
import { fbmOctaves, gfxQuality, noiseTileSize } from '../gl/quality';

export interface NoisePatternOpts extends FbmOpts {
  seed: number;
  low: string;
  high: string;
  contrast?: number;
  size?: number;
  stretchY?: number;
  /** Cache key suffix. */
  tag?: string;
}

const urlCache = new Map<string, string>();

/** Bake a noise tile to a PNG data-URL for CSS backgrounds (boot once). */
export function noiseDataUrl(opts: NoisePatternOpts): string {
  const q = gfxQuality();
  const size = opts.size ?? noiseTileSize(q);
  const octaves = opts.octaves ?? fbmOctaves(q);
  const key = `np:${opts.tag ?? ''}:${opts.seed}:${size}:${octaves}:${opts.low}:${opts.high}:${opts.contrast ?? 1}:${opts.stretchY ?? 1}:${opts.frequency ?? 1}`;
  const hit = urlCache.get(key);
  if (hit) return hit;

  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d');
  if (!ctx) return '';
  const tile = bakeFbmTile(size, opts.seed, {
    octaves,
    frequency: opts.frequency ?? 3,
    lacunarity: opts.lacunarity,
    gain: opts.gain,
    stretchY: opts.stretchY,
  });
  const img = tileToImageData(
    tile,
    size,
    hexToRgb(opts.low),
    hexToRgb(opts.high),
    opts.contrast ?? 1.15,
  );
  ctx.putImageData(img, 0, 0);
  const url = c.toDataURL('image/png');
  if (urlCache.size > 24) {
    const first = urlCache.keys().next().value;
    if (first) urlCache.delete(first);
  }
  urlCache.set(key, url);
  return url;
}
