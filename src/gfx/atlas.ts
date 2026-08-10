import { bakeBudgetPerFrame, gfxQuality } from './quality';

export type Plate = HTMLCanvasElement | OffscreenCanvas;

export interface AtlasOptions {
  maxEntries?: number;
}

/**
 * Unified LRU atlas for OffscreenCanvas plates with amortised bake budget.
 * Misses enqueue work; `flushBakeBudget` paints a few plates per frame.
 */
export class Atlas {
  private readonly cache = new Map<string, Plate>();
  private readonly pending = new Map<
    string,
    { w: number; h: number; paint: (ctx: CanvasRenderingContext2D) => void }
  >();
  private readonly maxEntries: number;
  private bakedThisFrame = 0;

  constructor(opts?: AtlasOptions) {
    this.maxEntries = opts?.maxEntries ?? 48;
  }

  /** Begin a new RAF slice — resets bake counter. */
  beginFrame(): void {
    this.bakedThisFrame = 0;
  }

  has(key: string): boolean {
    return this.cache.has(key);
  }

  get(key: string): Plate | undefined {
    const hit = this.cache.get(key);
    if (!hit) return undefined;
    // Refresh LRU order
    this.cache.delete(key);
    this.cache.set(key, hit);
    return hit;
  }

  /**
   * Sync get-or-bake (for critical path / first paint).
   * Prefer `getOrEnqueue` + `flushBakeBudget` for warm-up.
   */
  getOrBake(
    key: string,
    w: number,
    h: number,
    paint: (ctx: CanvasRenderingContext2D) => void,
  ): Plate {
    const hit = this.get(key);
    if (hit) return hit;
    return this.bakeNow(key, w, h, paint);
  }

  /**
   * Return cached plate or placeholder null; enqueue bake if missing.
   * Caller may fall back to sync bake when null and immediate result required.
   */
  getOrEnqueue(
    key: string,
    w: number,
    h: number,
    paint: (ctx: CanvasRenderingContext2D) => void,
  ): Plate | null {
    const hit = this.get(key);
    if (hit) return hit;
    if (!this.pending.has(key)) this.pending.set(key, { w, h, paint });
    return null;
  }

  /** Bake up to quality budget of pending plates. Returns number baked. */
  flushBakeBudget(budget = bakeBudgetPerFrame(gfxQuality())): number {
    let n = 0;
    while (n < budget && this.bakedThisFrame < budget && this.pending.size > 0) {
      const key = this.pending.keys().next().value as string;
      const job = this.pending.get(key)!;
      this.pending.delete(key);
      if (!this.cache.has(key)) {
        this.bakeNow(key, job.w, job.h, job.paint);
        n++;
        this.bakedThisFrame++;
      }
    }
    return n;
  }

  clear(): void {
    this.cache.clear();
    this.pending.clear();
    this.bakedThisFrame = 0;
  }

  get size(): number {
    return this.cache.size;
  }

  get pendingCount(): number {
    return this.pending.size;
  }

  private bakeNow(
    key: string,
    w: number,
    h: number,
    paint: (ctx: CanvasRenderingContext2D) => void,
  ): Plate {
    const c = makePlate(w, h);
    const ctx = c.getContext('2d') as CanvasRenderingContext2D | null;
    if (ctx) paint(ctx);
    this.cache.set(key, c);
    while (this.cache.size > this.maxEntries) {
      const first = this.cache.keys().next().value;
      if (first == null) break;
      this.cache.delete(first);
    }
    return c;
  }
}

export function makePlate(w: number, h: number): Plate {
  const width = Math.max(1, w | 0);
  const height = Math.max(1, h | 0);
  if (typeof OffscreenCanvas !== 'undefined') {
    const c = new OffscreenCanvas(width, height);
    return c;
  }
  if (typeof document !== 'undefined') {
    const c = document.createElement('canvas');
    c.width = width;
    c.height = height;
    return c;
  }
  // Headless stub for Vitest / Node (no canvas).
  const noop = (): void => undefined;
  const stubCtx = {
    putImageData: noop,
    drawImage: noop,
    fillRect: noop,
    clearRect: noop,
    save: noop,
    restore: noop,
    beginPath: noop,
    closePath: noop,
    clip: noop,
    fill: noop,
    stroke: noop,
    ellipse: noop,
    arc: noop,
    rect: noop,
    moveTo: noop,
    lineTo: noop,
    translate: noop,
    rotate: noop,
    scale: noop,
    createLinearGradient: () => ({ addColorStop: noop }),
    createRadialGradient: () => ({ addColorStop: noop }),
    createPattern: () => null,
    set fillStyle(_v: string) {},
    set strokeStyle(_v: string) {},
    set lineWidth(_v: number) {},
    set globalAlpha(_v: number) {},
    set globalCompositeOperation(_v: string) {},
    set imageSmoothingEnabled(_v: boolean) {},
  };
  return {
    width,
    height,
    getContext: () => stubCtx,
  } as unknown as HTMLCanvasElement;
}

/** Shared default atlas for materials / arena / kits. */
export const sharedAtlas = new Atlas({ maxEntries: 64 });
