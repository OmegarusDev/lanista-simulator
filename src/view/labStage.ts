/**
 * Instant Match stage — one design-space amphitheatre composition.
 * Not a world camera, not a viewport hole, not HUD over a game window.
 */
import { colors } from '../content/palette';
import type { FighterSnapshot } from '../domain/combat/types';
import { SeededRNG } from '../domain/rng';
import { drawGladiator } from './gladiatorDraw';
import {
  bronzeStroke,
  carvedBand,
  materialCacheTag,
  mosaicFill,
  mosaicPalettes,
  stoneFill,
} from './materials';
import type { Rect } from './ui';

export interface LabStageGeom {
  w: number;
  h: number;
  /** Sand oval in design space (fills most of the canvas). */
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  /** Where posed fighters sit (design space). */
  fighterSlots: { x: number; y: number; facing: number; team: 0 | 1 }[];
}

/** Geometry for a full-bleed amphitheatre that owns the canvas. */
export function labStageGeom(w: number, h: number, teamSize: number): LabStageGeom {
  const cx = w * 0.5;
  // Bias sand toward vertical center; stands bleed off every edge
  const cy = h * 0.48;
  // Cover the canvas — oval reaches past the frame on purpose
  const rx = w * 0.62;
  const ry = h * 0.38;

  const fighterSlots: LabStageGeom['fighterSlots'] = [];
  const spread = teamSize >= 3 ? Math.min(52, ry * 0.22) : Math.min(44, ry * 0.2);
  for (let team = 0 as 0 | 1; team < 2; team++) {
    const baseX = cx + (team === 0 ? -rx * 0.38 : rx * 0.38);
    for (let i = 0; i < teamSize; i++) {
      const y = cy + (i - (teamSize - 1) / 2) * spread;
      fighterSlots.push({
        x: baseX,
        y,
        facing: team === 0 ? 0 : Math.PI,
        team: team as 0 | 1,
      });
    }
  }

  return { w, h, cx, cy, rx, ry, fighterSlots };
}

/**
 * Paint the amphitheatre as the entire Instant Match screen.
 * Cached plate keyed by size + seed (mobile-safe).
 */
const plateCache = new Map<string, HTMLCanvasElement | OffscreenCanvas>();

export function drawLabAmphitheatre(
  ctx: CanvasRenderingContext2D,
  geom: LabStageGeom,
  seed: number,
): void {
  const key = `${materialCacheTag()}:${geom.w | 0}x${geom.h | 0}:${seed >>> 0}`;
  let plate = plateCache.get(key);
  if (!plate) {
    plate =
      typeof OffscreenCanvas !== 'undefined'
        ? new OffscreenCanvas(geom.w, geom.h)
        : document.createElement('canvas');
    plate.width = geom.w;
    plate.height = geom.h;
    const pctx = plate.getContext('2d') as CanvasRenderingContext2D | null;
    if (pctx) paintLabPlate(pctx, geom, seed);
    plateCache.set(key, plate);
    if (plateCache.size > 6) {
      const first = plateCache.keys().next().value;
      if (first != null) plateCache.delete(first);
    }
  }
  ctx.drawImage(plate as CanvasImageSource, 0, 0);
}

function paintLabPlate(ctx: CanvasRenderingContext2D, geom: LabStageGeom, seed: number): void {
  const { w, h, cx, cy, rx, ry } = geom;
  const rng = new SeededRNG(seed ^ 0x1ab57a9e);

  // Cave darkness to the edges — meets `colors.bg` so shell letterbox never seams
  ctx.fillStyle = colors.bg;
  ctx.fillRect(0, 0, w, h);
  const cave = ctx.createRadialGradient(cx, cy, Math.min(rx, ry) * 0.2, cx, cy, Math.max(w, h) * 0.72);
  cave.addColorStop(0, '#3a2a1c');
  cave.addColorStop(0.5, '#22180f');
  cave.addColorStop(0.88, colors.bg);
  cave.addColorStop(1, colors.bg);
  ctx.fillStyle = cave;
  ctx.fillRect(0, 0, w, h);

  // Cavea rings — mosaic stands that bleed off-canvas
  for (let band = 5; band >= 0; band--) {
    const orx = rx + 28 + band * 22;
    const ory = ry + 24 + band * 18;
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(cx, cy, orx, ory, 0, 0, Math.PI * 2);
    ctx.ellipse(cx, cy, Math.max(8, orx - 20), Math.max(8, ory - 16), 0, 0, Math.PI * 2);
    ctx.clip('evenodd');
    mosaicFill(ctx, 0, 0, w, h, {
      seed: rng.int(1, 999999) + band * 17,
      palette: mosaicPalettes.cavea,
      cell: 8 + band,
      grout: colors.grout,
      jitter: 0.4,
    });
    ctx.restore();
  }

  // Crowd tesserae mass
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx + 90, ry + 70, 0, 0, Math.PI * 2);
  ctx.ellipse(cx, cy, rx + 18, ry + 14, 0, 0, Math.PI * 2);
  ctx.clip('evenodd');
  mosaicFill(ctx, 0, 0, w, h, {
    seed: rng.int(1, 999999),
    palette: [...mosaicPalettes.cavea, ...mosaicPalettes.ivory, ...mosaicPalettes.blood],
    cell: 7,
    grout: '#1a1410',
    jitter: 0.55,
  });
  ctx.restore();

  // Stone podium ring
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx + 26, ry + 22, 0, 0, Math.PI * 2);
  ctx.ellipse(cx, cy, rx + 4, ry + 4, 0, 0, Math.PI * 2);
  ctx.clip('evenodd');
  stoneFill(ctx, 0, 0, w, h, { seed: rng.int(1, 999999) });
  ctx.restore();

  bronzeStroke(
    ctx,
    () => {
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx + 12, ry + 10, 0, 0, Math.PI * 2);
    },
    2,
  );

  // Sand — mosaic floor, full oval
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.clip();
  mosaicFill(ctx, cx - rx, cy - ry, rx * 2, ry * 2, {
    seed: rng.int(1, 999999),
    palette: mosaicPalettes.sand,
    cell: 8,
    grout: '#6a5438',
    jitter: 0.42,
  });
  // Center bronze medallion
  ctx.beginPath();
  ctx.ellipse(cx, cy, Math.min(56, rx * 0.18), Math.min(28, ry * 0.16), 0, 0, Math.PI * 2);
  ctx.clip();
  mosaicFill(ctx, cx - 60, cy - 30, 120, 60, {
    seed: rng.int(1, 999999),
    palette: mosaicPalettes.bronze,
    cell: 5,
    grout: '#3a2a18',
  });
  ctx.restore();

  bronzeStroke(
    ctx,
    () => {
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    },
    2.5,
  );

  // Architectural niches for chrome — same carvedBand language as Fight rails
  const beamH = Math.min(96, h * 0.12);
  carvedBand(ctx, 0, 0, w, beamH, { seed: 0x70f, tone: 'dark', lip: 'bottom', shade: 0.22 });

  const shelfH = Math.min(168, h * 0.22);
  const shelfY = h - shelfH;
  carvedBand(ctx, 0, shelfY, w, shelfH, { seed: 0x80f, tone: 'warm', lip: 'top', shade: 0.18 });

  // Soft vignette so edges feel like cave, not UI letterbox
  const vig = ctx.createRadialGradient(cx, cy, Math.min(rx, ry) * 0.5, cx, cy, Math.max(w, h) * 0.7);
  vig.addColorStop(0, 'rgba(0,0,0,0)');
  vig.addColorStop(0.75, 'rgba(0,0,0,0.15)');
  vig.addColorStop(1, 'rgba(0,0,0,0.55)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, w, h);
}

/** Place snapshots onto design-space slots for Lab preview. */
export function placeLabFighters(
  snaps: FighterSnapshot[],
  geom: LabStageGeom,
): FighterSnapshot[] {
  return snaps.map((f, i) => {
    const slot = geom.fighterSlots[i];
    if (!slot) return f;
    return { ...f, x: slot.x, y: slot.y, facing: slot.facing };
  });
}

export function drawLabFighters(
  ctx: CanvasRenderingContext2D,
  snaps: readonly FighterSnapshot[],
  selectedId: number | null,
): void {
  for (const f of [...snaps].sort((a, b) => a.y - b.y)) {
    // Glyphs authored ~world scale; bump for design-space readability
    ctx.save();
    ctx.translate(f.x, f.y);
    ctx.scale(1.35, 1.35);
    ctx.translate(-f.x, -f.y);
    drawGladiator(ctx, f, {
      selected: f.id === selectedId,
      showSelectedName: f.id === selectedId,
      hideBars: true,
    });
    ctx.restore();
  }
}

/** Hit-test fighters in design space (Lab preview). */
export function pickLabFighter(
  snaps: readonly FighterSnapshot[],
  x: number,
  y: number,
  radius = 36,
): FighterSnapshot | null {
  let best: FighterSnapshot | null = null;
  let bestD = radius * radius;
  for (const f of snaps) {
    const d = (f.x - x) ** 2 + (f.y - y) ** 2;
    if (d <= bestD) {
      bestD = d;
      best = f;
    }
  }
  return best;
}

export function labChromeRects(
  w: number,
  h: number,
  _pad?: number,
): {
  beam: Rect;
  shelf: Rect;
} {
  const beamH = Math.min(96, h * 0.12);
  const shelfH = Math.min(168, h * 0.22);
  return {
    beam: { x: 0, y: 0, w, h: beamH },
    shelf: { x: 0, y: h - shelfH, w, h: shelfH },
  };
}
