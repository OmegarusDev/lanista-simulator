/**
 * Shared stage paint — world arena + fighters under ArenaCamera.
 * Used by Fight and Practice Yard (same world→stage transform).
 */
import { combatTuning } from '../content/combat';
import type { FighterSnapshot } from '../domain/combat/types';
import { beginGfxFrame, paintVignette } from '../gfx/compositor';
import { ARENA_WORLD_H, ARENA_WORLD_W } from '../shell/canvas';
import { drawArena, drawDust, type DustParticle } from './arena';
import { ArenaCamera } from './arenaCamera';
import { drawGladiator } from './gladiatorDraw';
import {
  designToWorld,
  fightArenaZoom,
  type Rect,
  type WorldViewTransform,
} from './layout';

export function stageViewRect(cssW: number, cssH: number): Rect {
  return { x: 0, y: 0, w: cssW, h: cssH };
}

export function placePreviewInWorld(
  snaps: FighterSnapshot[],
  teamSize: number,
): FighterSnapshot[] {
  const cx = combatTuning.arenaCX;
  const cy = combatTuning.arenaCY;
  const rx = combatTuning.arenaRX;
  const ry = combatTuning.arenaRY;
  const spread = teamSize >= 3 ? Math.min(52, ry * 0.22) : Math.min(44, ry * 0.2);
  const out: FighterSnapshot[] = [];
  let i0 = 0;
  let i1 = 0;
  for (const f of snaps) {
    const i = f.team === 0 ? i0++ : i1++;
    const baseX = cx + (f.team === 0 ? -rx * 0.38 : rx * 0.38);
    const y = cy + (i - (teamSize - 1) / 2) * spread;
    out.push({
      ...f,
      x: baseX,
      y,
      facing: f.team === 0 ? 0 : Math.PI,
    });
  }
  return out;
}

export function paintStageWorld(
  ctx: CanvasRenderingContext2D,
  opts: {
    cssW: number;
    cssH: number;
    cam: ArenaCamera;
    seed: number;
    fighters: readonly FighterSnapshot[];
    selectedId?: number | null;
    dust?: readonly DustParticle[];
    shake?: number;
    hideBars?: boolean;
  },
): WorldViewTransform {
  beginGfxFrame();
  const view = stageViewRect(opts.cssW, opts.cssH);
  const t = opts.cam.toTransform(view);

  ctx.fillStyle = '#1a1410';
  ctx.fillRect(0, 0, opts.cssW, opts.cssH);

  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, opts.cssW, opts.cssH);
  ctx.clip();
  ctx.translate(t.ox, t.oy);
  ctx.scale(t.scale, t.scale);
  drawArena(ctx, opts.shake ?? 0, { seed: opts.seed });

  const snaps = [...opts.fighters].sort((a, b) => a.y - b.y);
  for (const f of snaps) {
    const selected = f.id === opts.selectedId;
    drawGladiator(ctx, f, {
      selected,
      showSelectedName: selected,
      hideBars: opts.hideBars,
    });
  }
  if (opts.dust) drawDust(ctx, opts.dust);
  ctx.restore();

  paintVignette(ctx, opts.cssW, opts.cssH);

  return t;
}

export function pickFighterWorld(
  snaps: readonly FighterSnapshot[],
  worldX: number,
  worldY: number,
  hitRadius: number,
): FighterSnapshot | null {
  let best: FighterSnapshot | null = null;
  let bestD = hitRadius * hitRadius;
  for (const f of snaps) {
    const d = (f.x - worldX) ** 2 + (f.y - worldY) ** 2;
    if (d <= bestD) {
      bestD = d;
      best = f;
    }
  }
  return best;
}

export function stagePointerToWorld(
  stageX: number,
  stageY: number,
  t: WorldViewTransform,
): { x: number; y: number } {
  return designToWorld(stageX, stageY, t);
}

export function defaultStageZoom(cssW: number, cssH: number): number {
  return fightArenaZoom(cssW, cssH);
}

export { ARENA_WORLD_W, ARENA_WORLD_H };
