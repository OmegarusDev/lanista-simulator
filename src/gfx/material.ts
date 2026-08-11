import { PALETTE_REV } from '../content/palette';
import { SeededRNG } from '../domain/rng';
import { sharedAtlas } from './atlas';
import {
  bakeFbmTile,
  hexToRgb,
  shadeHex,
  tileToImageData,
  tileToSandImageData,
} from './noise';
import { fillNoiseRect, paintScaledNoisePlate } from './pattern';
import { fbmOctaves, gfxQuality, noiseTileSize, tesseraSize, type Quality } from './quality';

export type { Quality };
export { gfxQuality, tesseraSize };

/** Include in plate cache keys so palette/material edits bust stale canvases. */
export function materialCacheTag(): string {
  return `m${PALETTE_REV}:g1`;
}

export const mosaicPalettes = {
  sand: ['#e0c490', '#c9a978', '#b89560', '#d4b888', '#a88858', '#8a7048'],
  cavea: ['#5a4a3a', '#4a3c30', '#6a5848', '#3a3028', '#7a6450', '#2e261e'],
  azure: ['#3a6a7a', '#2a5060', '#4a8090', '#1a3848', '#5a98a8', '#6ab0b8'],
  blood: ['#8a3a2a', '#6a2a1e', '#a04830', '#4a1e14', '#c06040'],
  ivory: ['#e8dcc0', '#d4c4a0', '#c0b088', '#f0e6d0', '#a89870'],
  bronze: ['#b8894a', '#8a6838', '#d4a85c', '#6a4e2a', '#c49a55'],
  team0: ['#3a6a88', '#2a5070', '#4a88a8', '#1a3850', '#5a98b0'],
  team1: ['#8a3a30', '#6a2820', '#a85040', '#4a1c14', '#c06850'],
  flesh: ['#c4a078', '#b89068', '#a87858', '#d4b090', '#8a6848'],
  leather: ['#6a4430', '#5a3828', '#7a5440', '#4a2e20', '#8a6450'],
} as const;

/** Mosaic tessera field — for large architectural surfaces only. */
export function mosaicFill(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  opts: {
    seed: number;
    palette: readonly string[];
    cell?: number;
    grout?: string;
    jitter?: number;
  },
): void {
  const q = gfxQuality();
  const cell = opts.cell ?? tesseraSize(q);
  const pw = Math.max(1, Math.ceil(w));
  const ph = Math.max(1, Math.ceil(h));
  const key = `${materialCacheTag()}:mos:${opts.seed}:${pw}x${ph}:${cell}:${opts.palette.join(',')}`;
  const plate = sharedAtlas.getOrBake(key, pw, ph, (c) => {
    paintMosaic(c, pw, ph, opts.seed, opts.palette, cell, opts.grout, opts.jitter);
  });
  ctx.drawImage(plate as CanvasImageSource, x, y, w, h);
}

function paintMosaic(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  seed: number,
  palette: readonly string[],
  cell: number,
  grout = '#2a2218',
  jitter = 0.35,
): void {
  const rng = new SeededRNG(seed >>> 0);
  ctx.fillStyle = grout;
  ctx.fillRect(0, 0, w, h);
  const cols = Math.ceil(w / cell) + 1;
  const rows = Math.ceil(h / cell) + 1;
  for (let row = 0; row < rows; row++) {
    const yOff = (row % 2) * (cell * 0.35);
    for (let col = 0; col < cols; col++) {
      const jx = (rng.next() - 0.5) * cell * jitter;
      const jy = (rng.next() - 0.5) * cell * jitter;
      const tw = cell * (0.72 + rng.next() * 0.28);
      const th = cell * (0.72 + rng.next() * 0.28);
      const px = col * cell + yOff + jx;
      const py = row * cell + jy;
      const base = palette[rng.int(0, palette.length - 1)]!;
      const lit = rng.chance(0.45);
      ctx.fillStyle = lit ? shadeHex(base, 0.08 + rng.next() * 0.1) : shadeHex(base, -0.06 - rng.next() * 0.1);
      ctx.fillRect(px, py, tw, th);
      if (rng.chance(0.2)) {
        ctx.fillStyle = 'rgba(255,240,200,0.12)';
        ctx.fillRect(px + 1, py + 1, Math.max(1, tw * 0.35), Math.max(1, th * 0.25));
      }
    }
  }
}

/** Carved oak / cedar plank fill — anisotropic FBM grain. */
export function woodFill(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  opts?: { seed?: number; tone?: 'dark' | 'warm' | 'pale' },
): void {
  const tone = opts?.tone ?? 'warm';
  const seed = opts?.seed ?? 1;
  const pw = Math.max(1, Math.ceil(w));
  const ph = Math.max(1, Math.ceil(h));
  const key = `${materialCacheTag()}:wood:${seed}:${tone}:${pw}x${ph}`;
  const plate = sharedAtlas.getOrBake(key, pw, ph, (c) => {
    paintWood(c, pw, ph, seed, tone);
  });
  ctx.drawImage(plate as CanvasImageSource, x, y, w, h);
}

function paintWood(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  seed: number,
  tone: 'dark' | 'warm' | 'pale',
): void {
  const low = tone === 'dark' ? '#24180e' : tone === 'pale' ? '#6a4e34' : '#3a2618';
  const high = tone === 'dark' ? '#5a4028' : tone === 'pale' ? '#a88860' : '#7a5438';
  const q = gfxQuality();
  const size = noiseTileSize(q);
  const tile = bakeFbmTile(size, seed ^ 0x60cd, {
    octaves: fbmOctaves(q),
    frequency: 3,
    stretchY: 0.25,
    gain: 0.55,
  });
  const img = tileToImageData(tile, size, hexToRgb(low), hexToRgb(high), 1.35);
  const tmp = sharedAtlas.getOrBake(
    `${materialCacheTag()}:woodtile:${seed}:${tone}:${size}`,
    size,
    size,
    (c) => c.putImageData(img, 0, 0),
  );
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(tmp as CanvasImageSource, 0, 0, w, h);

  // Knots (cheap, few)
  const rng = new SeededRNG((seed ^ 0x60cd) >>> 0);
  const knots = 1 + rng.int(0, 2);
  for (let k = 0; k < knots; k++) {
    const kx = rng.next() * w;
    const ky = rng.next() * h;
    const kr = 4 + rng.next() * 10;
    const kg = ctx.createRadialGradient(kx, ky, 0, kx, ky, kr);
    kg.addColorStop(0, 'rgba(40,22,10,0.55)');
    kg.addColorStop(0.6, 'rgba(40,22,10,0.2)');
    kg.addColorStop(1, 'rgba(40,22,10,0)');
    ctx.fillStyle = kg;
    ctx.beginPath();
    ctx.ellipse(kx, ky, kr, kr * 0.7, rng.next(), 0, Math.PI * 2);
    ctx.fill();
  }
}

/** Rough travertine / tufa stone — FBM + crack mask. */
export function stoneFill(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  opts?: { seed?: number; cool?: boolean },
): void {
  const seed = opts?.seed ?? 2;
  const cool = opts?.cool ?? false;
  const pw = Math.max(1, Math.ceil(w));
  const ph = Math.max(1, Math.ceil(h));
  const key = `${materialCacheTag()}:stone:${seed}:${cool ? 1 : 0}:${pw}x${ph}`;
  const plate = sharedAtlas.getOrBake(key, pw, ph, (c) => {
    paintStone(c, pw, ph, seed, cool);
  });
  ctx.drawImage(plate as CanvasImageSource, x, y, w, h);
}

function paintStone(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  seed: number,
  cool: boolean,
): void {
  const low = cool ? '#3a3630' : '#4a3a2c';
  const high = cool ? '#7a7568' : '#8a7a62';
  paintScaledNoisePlate(ctx, w, h, {
    seed: seed ^ 0x57ce,
    low,
    high,
    contrast: 1.2,
    frequency: 2.5,
    tag: 'stone',
  });
  // Crack overlay via high-freq threshold
  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  ctx.globalAlpha = 0.25;
  fillNoiseRect(ctx, 0, 0, w, h, {
    seed: seed ^ 0xc2ac,
    low: '#ffffff',
    high: '#2a2018',
    contrast: 2.2,
    frequency: 8,
    tag: 'crack',
  });
  ctx.restore();
}

/** Arena sand — multi-octave FBM with dune ridges. */
export function sandFill(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  opts?: { seed?: number },
): void {
  const seed = opts?.seed ?? 3;
  const pw = Math.max(1, Math.ceil(w));
  const ph = Math.max(1, Math.ceil(h));
  const key = `${materialCacheTag()}:sand:${seed}:${pw}x${ph}`;
  const plate = sharedAtlas.getOrBake(key, pw, ph, (c) => {
    paintSand(c, pw, ph, seed);
  });
  ctx.drawImage(plate as CanvasImageSource, x, y, w, h);
}

function paintSand(ctx: CanvasRenderingContext2D, w: number, h: number, seed: number): void {
  const q = gfxQuality();
  const size = noiseTileSize(q);
  const tile = bakeFbmTile(size, seed ^ 0x5a12d, {
    octaves: fbmOctaves(q),
    frequency: 4,
    gain: 0.5,
  });
  const img = tileToSandImageData(
    tile,
    size,
    hexToRgb('#8a7048'),
    hexToRgb('#e0c490'),
    hexToRgb('#5a4028'),
  );
  const tmp = sharedAtlas.getOrBake(
    `${materialCacheTag()}:sandtile:${seed}:${size}`,
    size,
    size,
    (c) => c.putImageData(img, 0, 0),
  );
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(tmp as CanvasImageSource, 0, 0, w, h);
}

/** Soft flesh fill for fighter bodies (not mosaic). */
export function fleshFill(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  opts?: { seed?: number; team?: 0 | 1 },
): void {
  const seed = opts?.seed ?? 1;
  const team = opts?.team ?? 0;
  const pw = Math.max(1, Math.ceil(w));
  const ph = Math.max(1, Math.ceil(h));
  const key = `${materialCacheTag()}:flesh:${seed}:${team}:${pw}x${ph}`;
  const plate = sharedAtlas.getOrBake(key, pw, ph, (c) => {
    const tint = team === 0 ? '#3a6a88' : '#8a3a30';
    paintScaledNoisePlate(c, pw, ph, {
      seed: seed ^ 0xf1e5,
      low: '#8a6848',
      high: '#d4b090',
      contrast: 0.85,
      frequency: 2,
      tag: 'flesh',
    });
    c.save();
    c.globalAlpha = 0.22;
    c.fillStyle = tint;
    c.fillRect(0, 0, pw, ph);
    c.restore();
  });
  ctx.drawImage(plate as CanvasImageSource, x, y, w, h);
}

/** Leather accent fill. */
export function leatherFill(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  opts?: { seed?: number },
): void {
  const seed = opts?.seed ?? 1;
  const pw = Math.max(1, Math.ceil(w));
  const ph = Math.max(1, Math.ceil(h));
  const key = `${materialCacheTag()}:leather:${seed}:${pw}x${ph}`;
  const plate = sharedAtlas.getOrBake(key, pw, ph, (c) => {
    paintScaledNoisePlate(c, pw, ph, {
      seed: seed ^ 0x1ea7,
      low: '#3a2418',
      high: '#8a6450',
      contrast: 1.1,
      frequency: 3,
      tag: 'leather',
    });
  });
  ctx.drawImage(plate as CanvasImageSource, x, y, w, h);
}

/** Metal plate with noise specular. */
export function metalFill(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  opts?: { seed?: number; tone?: 'bronze' | 'steel' },
): void {
  const seed = opts?.seed ?? 1;
  const tone = opts?.tone ?? 'bronze';
  const pw = Math.max(1, Math.ceil(w));
  const ph = Math.max(1, Math.ceil(h));
  const key = `${materialCacheTag()}:metal:${seed}:${tone}:${pw}x${ph}`;
  const plate = sharedAtlas.getOrBake(key, pw, ph, (c) => {
    const low = tone === 'steel' ? '#3a4450' : '#5a3e22';
    const high = tone === 'steel' ? '#a8b8c8' : '#e0b86a';
    paintScaledNoisePlate(c, pw, ph, {
      seed: seed ^ 0x7e7a1,
      low,
      high,
      contrast: 1.4,
      frequency: 5,
      tag: 'metal',
    });
  });
  ctx.drawImage(plate as CanvasImageSource, x, y, w, h);
}

export function bronzeStroke(
  ctx: CanvasRenderingContext2D,
  path: () => void,
  width = 2,
): void {
  ctx.save();
  ctx.lineWidth = width + 1.5;
  ctx.strokeStyle = 'rgba(40,24,10,0.55)';
  path();
  ctx.stroke();
  ctx.lineWidth = width;
  ctx.strokeStyle = '#c49a55';
  path();
  ctx.stroke();
  ctx.lineWidth = Math.max(0.5, width * 0.35);
  ctx.strokeStyle = 'rgba(255,220,160,0.35)';
  path();
  ctx.stroke();
  ctx.restore();
}

export function roundPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  rad: number,
): void {
  const rr = Math.min(rad, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

export function paintCenterRing(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
): void {
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(138, 58, 42, 0.14)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(138, 58, 42, 0.38)';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.strokeStyle = 'rgba(192, 96, 64, 0.18)';
  ctx.lineWidth = 5;
  ctx.stroke();
  ctx.restore();
}
