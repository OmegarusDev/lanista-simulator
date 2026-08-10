/**
 * Deterministic value noise + FBM — no deps, integer-friendly lattice.
 * Output samples are 0..1. Bake into tiles; never sample on the hot path.
 */

function hash2(x: number, y: number, seed: number): number {
  let n = (x * 374761393 + y * 668265263 + seed * 982451653) | 0;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  n = n ^ (n >>> 16);
  return (n >>> 0) / 4294967296;
}

function fade(t: number): number {
  return t * t * t * (t * (t * 6 - 15) + 10);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Smooth value noise at continuous coords. */
export function valueNoise2(x: number, y: number, seed: number): number {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = fade(x - x0);
  const fy = fade(y - y0);
  const v00 = hash2(x0, y0, seed);
  const v10 = hash2(x0 + 1, y0, seed);
  const v01 = hash2(x0, y0 + 1, seed);
  const v11 = hash2(x0 + 1, y0 + 1, seed);
  return lerp(lerp(v00, v10, fx), lerp(v01, v11, fx), fy);
}

export interface FbmOpts {
  octaves?: number;
  lacunarity?: number;
  gain?: number;
  /** Frequency scale applied to x/y before first octave. */
  frequency?: number;
}

/** Fractal Brownian motion — typically 2–4 octaves. */
export function fbm2(x: number, y: number, seed: number, opts: FbmOpts = {}): number {
  const octaves = opts.octaves ?? 3;
  const lac = opts.lacunarity ?? 2;
  const gain = opts.gain ?? 0.5;
  let freq = opts.frequency ?? 1;
  let amp = 1;
  let sum = 0;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += valueNoise2(x * freq, y * freq, (seed + i * 1013) | 0) * amp;
    norm += amp;
    freq *= lac;
    amp *= gain;
  }
  return sum / norm;
}

function wrapValueNoise(x: number, y: number, periodCells: number, seed: number): number {
  const cells = Math.max(1, periodCells | 0);
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const fx = fade(x - xi);
  const fy = fade(y - yi);
  const wrap = (i: number) => ((i % cells) + cells) % cells;
  const v00 = hash2(wrap(xi), wrap(yi), seed);
  const v10 = hash2(wrap(xi + 1), wrap(yi), seed);
  const v01 = hash2(wrap(xi), wrap(yi + 1), seed);
  const v11 = hash2(wrap(xi + 1), wrap(yi + 1), seed);
  return lerp(lerp(v00, v10, fx), lerp(v01, v11, fx), fy);
}

/**
 * Bake a toroidal FBM tile into a Float32Array (0..1).
 * `frequency` is lattice cells across the tile (integer-ish for seamless wrap).
 */
export function bakeFbmTile(
  size: number,
  seed: number,
  opts: FbmOpts & { stretchY?: number } = {},
): Float32Array {
  const out = new Float32Array(size * size);
  const stretchY = opts.stretchY ?? 1;
  const octaves = opts.octaves ?? 3;
  const lac = opts.lacunarity ?? 2;
  const gain = opts.gain ?? 0.5;
  const baseCells = Math.max(1, Math.round(opts.frequency ?? 4));
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = (x / size) * baseCells;
      const v = (y / size) * baseCells * stretchY;
      let cellScale = 1;
      let amp = 1;
      let sum = 0;
      let norm = 0;
      for (let o = 0; o < octaves; o++) {
        const period = Math.max(1, Math.round(baseCells * cellScale));
        sum +=
          wrapValueNoise(u * cellScale, v * cellScale, period, (seed + o * 1013) | 0) * amp;
        norm += amp;
        cellScale *= lac;
        amp *= gain;
      }
      out[y * size + x] = sum / norm;
    }
  }
  return out;
}

/** Approximate ∂/∂x of a baked tile (central difference, wrap). */
export function tileGradientX(tile: Float32Array, size: number, x: number, y: number): number {
  const i = ((x % size) + size) % size;
  const j = ((y % size) + size) % size;
  const l = tile[j * size + ((i - 1 + size) % size)]!;
  const r = tile[j * size + ((i + 1) % size)]!;
  return (r - l) * 0.5;
}

export function tileGradientY(tile: Float32Array, size: number, x: number, y: number): number {
  const i = ((x % size) + size) % size;
  const j = ((y % size) + size) % size;
  const u = tile[((j - 1 + size) % size) * size + i]!;
  const d = tile[((j + 1) % size) * size + i]!;
  return (d - u) * 0.5;
}

export function sampleTile(tile: Float32Array, size: number, x: number, y: number): number {
  const i = ((Math.floor(x) % size) + size) % size;
  const j = ((Math.floor(y) % size) + size) % size;
  return tile[j * size + i]!;
}

/** Remap float field to RGBA ImageData with a two-color lerp + optional contrast. */
export function tileToImageData(
  tile: Float32Array,
  size: number,
  low: [number, number, number],
  high: [number, number, number],
  contrast = 1,
): ImageData {
  const data = new Uint8ClampedArray(size * size * 4);
  for (let i = 0; i < tile.length; i++) {
    let t = tile[i]!;
    t = Math.max(0, Math.min(1, (t - 0.5) * contrast + 0.5));
    const o = i * 4;
    data[o] = (low[0] + (high[0] - low[0]) * t) | 0;
    data[o + 1] = (low[1] + (high[1] - low[1]) * t) | 0;
    data[o + 2] = (low[2] + (high[2] - low[2]) * t) | 0;
    data[o + 3] = 255;
  }
  return new ImageData(data, size, size);
}

/** Remap with dune ridges from gradient magnitude. */
export function tileToSandImageData(
  tile: Float32Array,
  size: number,
  low: [number, number, number],
  high: [number, number, number],
  grit: [number, number, number],
): ImageData {
  const data = new Uint8ClampedArray(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = y * size + x;
      const v = tile[i]!;
      const gx = tileGradientX(tile, size, x, y);
      const gy = tileGradientY(tile, size, x, y);
      const ridge = Math.min(1, Math.hypot(gx, gy) * 8);
      let t = Math.max(0, Math.min(1, (v - 0.5) * 1.25 + 0.5));
      t = Math.max(0, Math.min(1, t * 0.85 + ridge * 0.2));
      const gritMix = ridge > 0.35 && ((x * 17 + y * 31) & 7) === 0 ? 0.35 : 0;
      const o = i * 4;
      const r = low[0] + (high[0] - low[0]) * t;
      const g = low[1] + (high[1] - low[1]) * t;
      const b = low[2] + (high[2] - low[2]) * t;
      data[o] = (r + (grit[0] - r) * gritMix) | 0;
      data[o + 1] = (g + (grit[1] - g) * gritMix) | 0;
      data[o + 2] = (b + (grit[2] - b) * gritMix) | 0;
      data[o + 3] = 255;
    }
  }
  return new ImageData(data, size, size);
}

export function hexToRgb(hex: string): [number, number, number] {
  const h =
    hex.length === 4 ? `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}` : hex;
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function shadeHex(hex: string, amt: number): string {
  const [r, g, b] = hexToRgb(hex);
  const f = (c: number) => Math.max(0, Math.min(255, Math.round(c + 255 * amt)));
  return `rgb(${f(r)},${f(g)},${f(b)})`;
}

export function rgbToCss(r: number, g: number, b: number, a = 1): string {
  if (a >= 1) return `rgb(${r | 0},${g | 0},${b | 0})`;
  return `rgba(${r | 0},${g | 0},${b | 0},${a})`;
}
