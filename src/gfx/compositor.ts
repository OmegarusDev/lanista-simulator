import { colors } from '../content/palette';
import { ARENA_WORLD_H, ARENA_WORLD_W } from '../shell/canvas';
import { sharedAtlas } from './atlas';

export interface StageLayers {
  /** Full world backdrop (sky+cavea+sand composite) or null to skip. */
  plate: CanvasImageSource | null;
  shake?: number;
  /** Optional letterbox color. */
  letterbox?: string;
}

/**
 * Blit static arena plate under camera transform already applied by caller.
 * After fighters/FX, call `paintVignette` in screen space.
 */
export function blitArenaPlate(
  ctx: CanvasRenderingContext2D,
  plate: CanvasImageSource,
  shake = 0,
): void {
  ctx.save();
  if (shake > 0) {
    ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
  }
  ctx.drawImage(plate, 0, 0);
  ctx.restore();
}

/** Screen-space vignette + warm grade — fade only near the frame edge. */
export function paintVignette(
  ctx: CanvasRenderingContext2D,
  cssW: number,
  cssH: number,
): void {
  const short = Math.min(cssW, cssH);
  const long = Math.max(cssW, cssH);
  const g = ctx.createRadialGradient(
    cssW * 0.5,
    cssH * 0.5,
    short * 0.58,
    cssW * 0.5,
    cssH * 0.5,
    long * 0.92,
  );
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(0.55, 'rgba(20,12,6,0.04)');
  g.addColorStop(1, 'rgba(10,6,4,0.38)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, cssW, cssH);

  // Warm afternoon grade — very soft
  ctx.save();
  ctx.globalCompositeOperation = 'soft-light';
  ctx.globalAlpha = 0.12;
  ctx.fillStyle = '#d4a060';
  ctx.fillRect(0, 0, cssW, cssH);
  ctx.restore();
}

export function paintLetterbox(
  ctx: CanvasRenderingContext2D,
  cssW: number,
  cssH: number,
  color = colors.bg,
): void {
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, cssW, cssH);
}

/** Begin RAF: reset atlas bake budget. */
export function beginGfxFrame(): void {
  sharedAtlas.beginFrame();
  sharedAtlas.flushBakeBudget();
}

export { ARENA_WORLD_W, ARENA_WORLD_H };
