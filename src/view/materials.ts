/**
 * Mosaic + sword-and-sandal material system (zero assets).
 * Heavy fills are cached OffscreenCanvases — safe for 60Hz mobile.
 */
import { colors, PALETTE_REV } from '../content/palette';
import { SeededRNG } from '../domain/rng';
import { getDesign } from '../shell/canvas';

/** Include in plate cache keys so palette/material edits bust stale canvases. */
export function materialCacheTag(): string {
  return `m${PALETTE_REV}`;
}

export type Quality = 'low' | 'med' | 'high';

/** Mobile-first: short phones → fewer tesserae. */
export function gfxQuality(): Quality {
  const { w, h } = getDesign();
  const short = Math.min(w, h);
  if (short < 420) return 'low';
  if (short < 700) return 'med';
  return 'high';
}

export function tesseraSize(q: Quality = gfxQuality()): number {
  return q === 'low' ? 10 : q === 'med' ? 7 : 5;
}

type Plate = HTMLCanvasElement | OffscreenCanvas;

const tileCache = new Map<string, Plate>();

function makePlate(w: number, h: number): Plate {
  const c =
    typeof OffscreenCanvas !== 'undefined'
      ? new OffscreenCanvas(w, h)
      : document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function cacheGet(key: string, w: number, h: number, paint: (ctx: CanvasRenderingContext2D) => void): Plate {
  const hit = tileCache.get(key);
  if (hit) return hit;
  const c = makePlate(w, h);
  const ctx = c.getContext('2d') as CanvasRenderingContext2D | null;
  if (ctx) paint(ctx);
  tileCache.set(key, c);
  if (tileCache.size > 24) {
    const first = tileCache.keys().next().value;
    if (first != null) tileCache.delete(first);
  }
  return c;
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.length === 4
    ? `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`
    : hex;
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function shade(hex: string, amt: number): string {
  const [r, g, b] = hexToRgb(hex);
  const f = (c: number) => Math.max(0, Math.min(255, Math.round(c + 255 * amt)));
  return `rgb(${f(r)},${f(g)},${f(b)})`;
}

/** Mosaic tessera field — irregular grid with grout. */
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
  const key = `mos:${opts.seed}:${pw}x${ph}:${cell}:${opts.palette.join(',')}`;
  const plate = cacheGet(key, pw, ph, (c) => {
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
      ctx.fillStyle = lit ? shade(base, 0.08 + rng.next() * 0.1) : shade(base, -0.06 - rng.next() * 0.1);
      // Slightly rounded tessera via small rect (cheap)
      ctx.fillRect(px, py, tw, th);
      // Speck of highlight
      if (rng.chance(0.2)) {
        ctx.fillStyle = 'rgba(255,240,200,0.12)';
        ctx.fillRect(px + 1, py + 1, Math.max(1, tw * 0.35), Math.max(1, th * 0.25));
      }
    }
  }
}

/** Carved oak / cedar plank fill. */
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
  const key = `wood:${seed}:${tone}:${pw}x${ph}`;
  const plate = cacheGet(key, pw, ph, (c) => {
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
  const rng = new SeededRNG((seed ^ 0x60cd) >>> 0);
  const base =
    tone === 'dark' ? '#3a2818' : tone === 'pale' ? '#8a6a48' : '#5c3e28';
  const deep =
    tone === 'dark' ? '#24180e' : tone === 'pale' ? '#6a4e34' : '#3a2618';
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, shade(base, 0.06));
  g.addColorStop(0.5, base);
  g.addColorStop(1, deep);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  // Grain lines
  const lines = Math.max(8, Math.floor(h / 6));
  for (let i = 0; i < lines; i++) {
    const yy = (i / lines) * h + (rng.next() - 0.5) * 4;
    ctx.strokeStyle = `rgba(20,10,4,${0.08 + rng.next() * 0.14})`;
    ctx.lineWidth = 0.8 + rng.next() * 1.4;
    ctx.beginPath();
    ctx.moveTo(0, yy);
    let x = 0;
    while (x < w) {
      const nx = x + 12 + rng.next() * 28;
      const ny = yy + (rng.next() - 0.5) * 3;
      ctx.lineTo(nx, ny);
      x = nx;
    }
    ctx.stroke();
  }

  // Knots
  const knots = 1 + (rng.int(0, 2));
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

/** Rough travertine / tufa stone. */
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
  const key = `stone:${seed}:${cool ? 1 : 0}:${pw}x${ph}`;
  const plate = cacheGet(key, pw, ph, (c) => {
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
  const rng = new SeededRNG((seed ^ 0x57ce) >>> 0);
  const a = cool ? '#6a6558' : '#7a6a55';
  const b = cool ? '#4a463c' : '#5a4a38';
  const g = ctx.createLinearGradient(0, 0, w * 0.3, h);
  g.addColorStop(0, a);
  g.addColorStop(1, b);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  const n = Math.floor((w * h) / 180);
  for (let i = 0; i < n; i++) {
    const px = rng.next() * w;
    const py = rng.next() * h;
    const s = 1 + rng.next() * 3;
    ctx.fillStyle = rng.chance(0.5)
      ? `rgba(255,245,220,${0.03 + rng.next() * 0.06})`
      : `rgba(20,14,8,${0.04 + rng.next() * 0.08})`;
    ctx.fillRect(px, py, s, s * (0.5 + rng.next()));
  }

  // Hairline cracks
  for (let i = 0; i < 3; i++) {
    ctx.strokeStyle = `rgba(20,14,8,${0.1 + rng.next() * 0.1})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    let x = rng.next() * w;
    let y = rng.next() * h;
    ctx.moveTo(x, y);
    for (let s = 0; s < 6; s++) {
      x += (rng.next() - 0.4) * 40;
      y += (rng.next() - 0.5) * 20;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
}

/**
 * Shared wood + mosaic lip band — Lab beam/shelf and Fight rails speak one depth language.
 */
export function carvedBand(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  opts: {
    seed: number;
    tone?: 'dark' | 'warm';
    lip?: 'top' | 'bottom' | 'none';
    /** Extra dark wash over the wood (0–1). */
    shade?: number;
  },
): void {
  const tone = opts.tone ?? 'dark';
  const lip = opts.lip ?? 'none';
  const lipH = Math.min(10, Math.max(6, h * 0.12));
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  woodFill(ctx, x, y, w, h, { seed: opts.seed, tone });
  if (lip === 'bottom') {
    mosaicFill(ctx, x, y + h - lipH, w, lipH, {
      seed: opts.seed ^ 0x71,
      palette: mosaicPalettes.bronze,
      cell: 5,
      grout: colors.grout,
    });
  } else if (lip === 'top') {
    mosaicFill(ctx, x, y, w, lipH, {
      seed: opts.seed ^ 0x72,
      palette: mosaicPalettes.bronze,
      cell: 5,
      grout: colors.grout,
    });
  }
  const shade = opts.shade ?? 0;
  if (shade > 0) {
    ctx.fillStyle = `rgba(0,0,0,${shade})`;
    ctx.fillRect(x, y, w, h);
  }
  ctx.restore();
}

/** Bronze edge stroke for inlays. */
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

/** Carved inset lip (wood/stone frame). */
export function carveFrame(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  rad: number,
): void {
  ctx.save();
  roundPath(ctx, x, y, w, h, rad);
  ctx.strokeStyle = 'rgba(255,220,170,0.14)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  roundPath(ctx, x + 2, y + 2, w - 4, h - 4, Math.max(1, rad - 1));
  ctx.strokeStyle = 'rgba(0,0,0,0.4)';
  ctx.lineWidth = 1.5;
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

/** Mosaic palette packs for different surfaces. */
export const mosaicPalettes = {
  sand: ['#e0c490', '#c9a978', '#b89560', '#d4b888', '#a88858', '#8a7048'],
  cavea: ['#5a4a3a', '#4a3c30', '#6a5848', '#3a3028', '#7a6450', '#2e261e'],
  azure: ['#3a6a7a', '#2a5060', '#4a8090', '#1a3848', '#5a98a8', '#6ab0b8'],
  blood: ['#8a3a2a', '#6a2a1e', '#a04830', '#4a1e14', '#c06040'],
  ivory: ['#e8dcc0', '#d4c4a0', '#c0b088', '#f0e6d0', '#a89870'],
  bronze: ['#b8894a', '#8a6838', '#d4a85c', '#6a4e2a', '#c49a55'],
  team0: ['#3a6a88', '#2a5070', '#4a88a8', '#1a3850', '#5a98b0'],
  team1: ['#8a3a30', '#6a2820', '#a85040', '#4a1c14', '#c06850'],
} as const;
