import { bakeFbmTile } from '../gfx/noise';
import type { GlHandle } from './types';
import { fbmOctaves, noiseTileSize, type Quality } from './quality';

const MAX_CACHE = 8;

type CacheEntry = {
  key: string;
  tex: WebGLTexture;
  lastUsed: number;
};

const cache: CacheEntry[] = [];
let tick = 0;
let uploadsThisFrame = 0;

export function beginNoiseBakeFrame(): void {
  uploadsThisFrame = 0;
}

export function getSandNoiseTex(
  gl: GlHandle,
  seed: number,
  quality: Quality,
  budget = 2,
): WebGLTexture | null {
  const size = noiseTileSize(quality);
  const oct = fbmOctaves(quality);
  const key = `sand:${seed}:${size}:${oct}`;
  const hit = cache.find((c) => c.key === key);
  if (hit) {
    hit.lastUsed = ++tick;
    return hit.tex;
  }
  if (uploadsThisFrame >= budget) return cache[0]?.tex ?? null;
  uploadsThisFrame++;

  const data = bakeFbmTile(size, seed ^ 0x5a11d, {
    octaves: oct,
    frequency: 4,
  });
  const rgba = new Uint8Array(size * size * 4);
  for (let i = 0; i < size * size; i++) {
    const v = Math.max(0, Math.min(255, Math.floor(data[i]! * 255)));
    const o = i * 4;
    rgba[o] = v;
    rgba[o + 1] = v;
    rgba[o + 2] = Math.max(0, v - 12);
    rgba[o + 3] = 255;
  }
  const tex = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, size, size, 0, gl.RGBA, gl.UNSIGNED_BYTE, rgba);
  gl.bindTexture(gl.TEXTURE_2D, null);

  if (cache.length >= MAX_CACHE) {
    cache.sort((a, b) => a.lastUsed - b.lastUsed);
    const evict = cache.shift()!;
    gl.deleteTexture(evict.tex);
  }
  cache.push({ key, tex, lastUsed: ++tick });
  return tex;
}

export function disposeNoiseCache(gl: GlHandle): void {
  for (const c of cache) gl.deleteTexture(c.tex);
  cache.length = 0;
}

export function noiseCacheSize(): number {
  return cache.length;
}

export function noiseCacheMax(): number {
  return MAX_CACHE;
}
