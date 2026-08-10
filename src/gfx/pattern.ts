import { bakeFbmTile, hexToRgb, tileToImageData, type FbmOpts } from './noise';
import { makePlate, sharedAtlas, type Plate } from './atlas';
import { fbmOctaves, gfxQuality, noiseTileSize } from './quality';

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

/** Bake a tinted FBM tile plate (cached). */
export function noiseTintPlate(opts: NoisePatternOpts): Plate {
  const q = gfxQuality();
  const size = opts.size ?? noiseTileSize(q);
  const octaves = opts.octaves ?? fbmOctaves(q);
  const key = `np:${opts.tag ?? ''}:${opts.seed}:${size}:${octaves}:${opts.low}:${opts.high}:${opts.contrast ?? 1}:${opts.stretchY ?? 1}:${opts.frequency ?? 1}`;
  return sharedAtlas.getOrBake(key, size, size, (ctx) => {
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
  });
}

/** createPattern from a noise tint plate (may be null if ctx rejects). */
export function noisePattern(
  ctx: CanvasRenderingContext2D,
  opts: NoisePatternOpts,
): CanvasPattern | null {
  const plate = noiseTintPlate(opts);
  return ctx.createPattern(plate as CanvasImageSource, 'repeat');
}

/**
 * Fill a rect with a noise pattern. Falls back to solid mid-tone if pattern fails.
 */
export function fillNoiseRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  opts: NoisePatternOpts,
): void {
  const pat = noisePattern(ctx, opts);
  if (pat) {
    ctx.fillStyle = pat;
    ctx.fillRect(x, y, w, h);
    return;
  }
  const [r, g, b] = hexToRgb(opts.low);
  const [r2, g2, b2] = hexToRgb(opts.high);
  ctx.fillStyle = `rgb(${((r + r2) / 2) | 0},${((g + g2) / 2) | 0},${((b + b2) / 2) | 0})`;
  ctx.fillRect(x, y, w, h);
}

/**
 * Paint a full material plate by drawing noise at native tile res then scaling.
 * Faster than putImageData at large sizes.
 */
export function paintScaledNoisePlate(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  opts: NoisePatternOpts,
): void {
  const plate = noiseTintPlate(opts);
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(plate as CanvasImageSource, 0, 0, w, h);
}

/** Bake a noise tile to a PNG data-URL for CSS backgrounds (boot once). */
export function noiseDataUrl(opts: NoisePatternOpts): string {
  const plate = noiseTintPlate(opts);
  if ('toDataURL' in plate && typeof (plate as HTMLCanvasElement).toDataURL === 'function') {
    return (plate as HTMLCanvasElement).toDataURL('image/png');
  }
  // OffscreenCanvas → bitmap → canvas
  const c = document.createElement('canvas');
  c.width = plate.width;
  c.height = plate.height;
  const ctx = c.getContext('2d');
  if (!ctx) return '';
  ctx.drawImage(plate as CanvasImageSource, 0, 0);
  return c.toDataURL('image/png');
}

/** Multipass: base noise + multiply shade overlay. */
export function paintLayeredNoise(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  base: NoisePatternOpts,
  overlay?: NoisePatternOpts & { alpha?: number },
): void {
  paintScaledNoisePlate(ctx, w, h, base);
  if (!overlay) return;
  ctx.save();
  ctx.globalAlpha = overlay.alpha ?? 0.35;
  ctx.globalCompositeOperation = 'multiply';
  paintScaledNoisePlate(ctx, w, h, overlay);
  ctx.restore();
}

/** Tiny helper for one-off plates outside shared atlas keys. */
export function bakeRawPlate(
  w: number,
  h: number,
  paint: (ctx: CanvasRenderingContext2D) => void,
): Plate {
  const c = makePlate(w, h);
  const ctx = c.getContext('2d') as CanvasRenderingContext2D | null;
  if (ctx) paint(ctx);
  return c;
}
