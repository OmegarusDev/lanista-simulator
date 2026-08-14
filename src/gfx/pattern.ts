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

export interface CrowdStripOpts {
  seed: number;
  /** Head dots palette (hex). */
  tones: string[];
  width?: number;
  height?: number;
  dotDensity?: number;
  /** Cache key suffix. */
  tag?: string;
}

function stripRng(seed: number): () => number {
  let s = (seed >>> 0) || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/**
 * A procedural crowd — seeded head-dots on a dark band, with a faint noise
 * base. Becomes the favor meter's background: the meter bars tint the crowd
 * blue/red, so the "crowd leans" reads as an actual crowd leaning.
 */
export function crowdStripDataUrl(opts: CrowdStripOpts): string {
  const w = opts.width ?? 256;
  const h = opts.height ?? 48;
  const density = opts.dotDensity ?? 0.42;
  const key = `cs:${opts.tag ?? ''}:${opts.seed}:${w}:${h}:${density}:${opts.tones.join(',')}`;
  const hit = urlCache.get(key);
  if (hit) return hit;

  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  if (!ctx) return '';
  ctx.fillStyle = '#0a0d11';
  ctx.fillRect(0, 0, w, h);
  const rnd = stripRng(opts.seed);
  const heads = Math.floor(w * h * density * 0.01);
  for (let i = 0; i < heads; i++) {
    const x = rnd() * w;
    const y = h * 0.35 + rnd() * h * 0.5;
    const r = 1 + rnd() * 2.2;
    const tone = opts.tones[Math.floor(rnd() * opts.tones.length)] ?? '#6a6258';
    ctx.globalAlpha = 0.5 + rnd() * 0.5;
    ctx.fillStyle = tone;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    if (rnd() < 0.12) {
      // An occasional raised arm — motion in the stands
      ctx.globalAlpha = 0.7;
      ctx.strokeStyle = tone;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, y - r);
      ctx.lineTo(x + (rnd() - 0.5) * 4, y - r - 3);
      ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;
  const url = c.toDataURL('image/png');
  if (urlCache.size > 24) {
    const first = urlCache.keys().next().value;
    if (first) urlCache.delete(first);
  }
  urlCache.set(key, url);
  return url;
}

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
