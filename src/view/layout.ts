import {
  ARENA_WORLD_H,
  ARENA_WORLD_W,
  getDesign,
  orientationOf,
  type Orientation,
} from '../shell/canvas';
import { space, touchTarget } from './theme';
import type { Rect } from './ui';

export type { Orientation };

export function isPortrait(w?: number, h?: number): boolean {
  const d = getDesign();
  return orientationOf(w ?? d.w, h ?? d.h) === 'portrait';
}

export function shellPad(w: number): number {
  return w < 520 ? 16 : 24;
}

/** Primary CTA size — taller on narrow portrait for touch. */
export function primaryButtonSize(w: number, h?: number): { bw: number; bh: number } {
  const d = getDesign();
  const narrow = (h != null ? isPortrait(w, h) : d.orientation === 'portrait') || w < 520;
  return {
    bw: Math.min(280, Math.max(200, w - shellPad(w) * 2)),
    bh: narrow ? 48 : 44,
  };
}

export interface WorldViewTransform {
  /** Design-space rect where the arena world is painted. */
  view: Rect;
  /** Uniform world → design scale. */
  scale: number;
  /** Design origin of world (0,0). */
  ox: number;
  oy: number;
}

/** Map design coords → arena world (for hit-testing fighters). */
export function designToWorld(
  x: number,
  y: number,
  t: WorldViewTransform,
): { x: number; y: number } {
  const s = t.scale || 1;
  return { x: (x - t.ox) / s, y: (y - t.oy) / s };
}

/**
 * Fit the fixed arena world into a design-space box (uniform, centered).
 * `zoom` > 1 scales past contain (crops edges) so the sand sits larger /
 * closer to the box sides — used for mobile fight framing.
 */
export function fitWorldInRect(box: Rect, zoom = 1): WorldViewTransform {
  const contain = Math.min(box.w / ARENA_WORLD_W, box.h / ARENA_WORLD_H);
  const scale = contain * Math.max(0.01, zoom);
  const aw = ARENA_WORLD_W * scale;
  const ah = ARENA_WORLD_H * scale;
  const ox = box.x + (box.w - aw) / 2;
  const oy = box.y + (box.h - ah) / 2;
  return {
    view: { x: ox, y: oy, w: aw, h: ah },
    scale,
    ox,
    oy,
  };
}

/**
 * World→view zoom past contain-fit.
 * Narrow / portrait: crop a little L/R so the oval approaches the edges and
 * the painted world uses more of the tall arena band. Landscape: slight zoom
 * for a taller feel without burying HUD.
 */
export function fightArenaZoom(w: number, h: number): number {
  const portrait = orientationOf(w, h) === 'portrait';
  const shortSide = Math.min(w, h);
  if (portrait) {
    // Phone-width portrait gets the strongest nudge; wider tablets milder.
    if (w < 420) return 1.14;
    if (w < 600) return 1.1;
    return 1.06;
  }
  // Landscape phone / short stage: pull sides in a touch.
  if (shortSide < 480 || w < 900) return 1.06;
  return 1.03;
}

export interface FightStageLayout {
  orientation: Orientation;
  w: number;
  h: number;
  topBandH: number;
  rosterLabelH: number;
  rosterH: number;
  bottomCtrlH: number;
  bottomPad: number;
  chipGap: number;
  hitRadius: number;
  inspectW: number;
  inspectMaxH: number;
  inspectPad: number;
  /** Y of bottom control row(s). */
  bottomCtrlY: number;
  rosterY: number;
  rosterBandTop: number;
  chromeBottomH: number;
  /**
   * Design-space clip/viewport for the arena camera (unzoomed box).
   * Pass this to ArenaCamera.toTransform — never a pre-scaled world footprint.
   */
  worldBox: Rect;
  /**
   * Static contain×fightArenaZoom fit (centered in worldBox). Useful for tests
   * and chrome that wants a default framing; live fight overrides via ArenaCamera.
   */
  world: WorldViewTransform;
  /** Bottom playback/pause row count (always one after session controls moved to pause). */
  bottomRows: 1;
}

/**
 * Fight chrome + arena viewport for the current design size.
 * Portrait: stacked HUD — arena in the upper band, roster + controls below.
 * Landscape: arena fills the stage; chrome overlays top/bottom margins.
 */
export function fightStageLayout(w?: number, h?: number): FightStageLayout {
  const d = getDesign();
  const dw = w ?? d.w;
  const dh = h ?? d.h;
  const orientation = orientationOf(dw, dh);
  const portrait = orientation === 'portrait';

  // Readable chrome + ~44px touch rows; arena still claims the middle band.
  const topBandH = portrait ? 52 : 48;
  const rosterLabelH = 14;
  const rosterH = portrait ? touchTarget : 40;
  const bottomRows = 1 as const;
  const rowH = portrait ? touchTarget : 40;
  const bottomCtrlH = rowH;
  const bottomPad = portrait ? 10 : 8;
  const chipGap = 6;
  const chromeBottomH =
    rosterLabelH + rosterH + space.sm + bottomCtrlH + bottomPad;

  const bottomCtrlY = dh - bottomPad - bottomCtrlH;
  const rosterY = bottomCtrlY - space.sm - rosterH;
  const rosterBandTop = rosterY - rosterLabelH;

  const zoom = fightArenaZoom(dw, dh);
  const worldBox: Rect = portrait
    ? {
        x: 0,
        y: topBandH,
        w: dw,
        h: Math.max(140, rosterBandTop - topBandH),
      }
    : { x: 0, y: 0, w: dw, h: dh };
  const world = fitWorldInRect(worldBox, zoom);

  const inspectPad = 12;
  const inspectW = Math.min(240, dw - inspectPad * 2);
  const inspectMaxH = portrait
    ? Math.min(300, Math.max(180, rosterBandTop - topBandH - space.md))
    : 320;

  return {
    orientation,
    w: dw,
    h: dh,
    topBandH,
    rosterLabelH,
    rosterH,
    bottomCtrlH,
    bottomPad,
    chipGap,
    hitRadius: 26,
    inspectW,
    inspectMaxH,
    inspectPad,
    bottomCtrlY,
    rosterY,
    rosterBandTop,
    chromeBottomH,
    worldBox,
    world,
    bottomRows,
  };
}

/** Inspect dock rect — side dock in landscape, full-width sheet in portrait. */
export function fightInspectRect(
  stage: FightStageLayout,
  preferLeft: boolean,
  contentH: number,
): Rect {
  const h = Math.min(contentH, stage.inspectMaxH);
  if (stage.orientation === 'portrait') {
    const y = Math.max(
      stage.topBandH + space.sm,
      stage.rosterBandTop - h - space.sm,
    );
    return {
      x: stage.inspectPad,
      y,
      w: stage.w - stage.inspectPad * 2,
      h,
    };
  }
  const x = preferLeft
    ? stage.inspectPad
    : stage.w - stage.inspectPad - stage.inspectW;
  return {
    x,
    y: stage.topBandH + space.sm,
    w: stage.inspectW,
    h,
  };
}

export interface TitleLayout {
  w: number;
  h: number;
  orientation: Orientation;
  brandY: number;
  taglineY: number;
  buttons: Rect[];
  footerY: number;
}

export function titleLayout(w?: number, h?: number): TitleLayout {
  const d = getDesign();
  const dw = w ?? d.w;
  const dh = h ?? d.h;
  const orientation = orientationOf(dw, dh);
  const portrait = orientation === 'portrait';
  const { bw, bh } = primaryButtonSize(dw, dh);
  const cx = dw / 2;
  const brandY = portrait ? Math.min(dh * 0.2, 168) : 128;
  const taglineY = brandY + (portrait ? 40 : 36);
  let y = taglineY + (portrait ? 52 : 72);
  const gap = space.md + (portrait ? 4 : 0);
  const buttons: Rect[] = [];
  for (let i = 0; i < 3; i++) {
    buttons.push({ x: cx - bw / 2, y, w: bw, h: bh });
    y += bh + gap;
  }
  return {
    w: dw,
    h: dh,
    orientation,
    brandY,
    taglineY,
    buttons,
    footerY: dh - (portrait ? 36 : 28),
  };
}

export interface FlowHeaderLayout {
  pad: number;
  titleY: number;
  metaY: number;
  rightTitleY: number;
  rightMetaY: number;
}

export function flowHeaderLayout(w?: number, h?: number): FlowHeaderLayout {
  const d = getDesign();
  const dw = w ?? d.w;
  const portrait = isPortrait(dw, h ?? d.h);
  const pad = shellPad(dw);
  if (portrait) {
    return {
      pad,
      titleY: 36,
      metaY: 58,
      rightTitleY: 82,
      rightMetaY: 102,
    };
  }
  return {
    pad,
    titleY: 40,
    metaY: 64,
    rightTitleY: 40,
    rightMetaY: 64,
  };
}

/** Wrap equal-width chips into a grid. */
export function wrapGrid(
  count: number,
  area: Rect,
  cellW: number,
  cellH: number,
  gap: number,
): Rect[] {
  const cols = Math.max(1, Math.floor((area.w + gap) / (cellW + gap)));
  const rects: Rect[] = [];
  for (let i = 0; i < count; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    rects.push({
      x: area.x + col * (cellW + gap),
      y: area.y + row * (cellH + gap),
      w: cellW,
      h: cellH,
    });
  }
  return rects;
}

/** Distribute `n` buttons across a row (or wrap). */
export function buttonRow(
  x: number,
  y: number,
  totalW: number,
  h: number,
  n: number,
  gap = 8,
): Rect[] {
  if (n <= 0) return [];
  const bw = (totalW - gap * (n - 1)) / n;
  const out: Rect[] = [];
  for (let i = 0; i < n; i++) {
    out.push({ x: x + i * (bw + gap), y, w: bw, h });
  }
  return out;
}

export interface SandboxLayout {
  orientation: Orientation;
  w: number;
  h: number;
  pad: number;
  titleBtn: Rect;
  brandY: number;
  subtitleY: number;
  historicalLabelY: number;
  presetRects: Rect[];
  leftPanel: Rect;
  rightPanel: Rect;
  center: {
    size1: Rect;
    size2: Rect;
    size3: Rect;
    vsY: number;
    seedY: number;
    reroll: Rect;
    fight: Rect;
  };
  footerY: number;
  stacked: boolean;
}

export function sandboxLayout(w?: number, h?: number, presetCount = 4): SandboxLayout {
  const d = getDesign();
  const dw = w ?? d.w;
  const dh = h ?? d.h;
  const orientation = orientationOf(dw, dh);
  const stacked = orientation === 'portrait' || dw < 780;
  const pad = shellPad(dw);

  const titleBtn: Rect = { x: pad, y: pad, w: touchTarget, h: touchTarget };
  const brandY = stacked ? 32 : 38;
  const subtitleY = brandY + 22;
  const historicalLabelY = subtitleY + 20;

  // Two-line full armatura names (e.g. "Murmillo" / "vs Thraex") need taller cells.
  const presetH = touchTarget;
  const presetGap = 8;
  const presetCols = stacked ? 2 : Math.min(3, Math.max(1, presetCount));
  const presetCellW = (dw - pad * 2 - presetGap * (presetCols - 1)) / presetCols;
  const presetRows = Math.ceil(presetCount / presetCols);
  const presetArea: Rect = {
    x: pad,
    y: historicalLabelY + 10,
    w: dw - pad * 2,
    h: presetRows * presetH + Math.max(0, presetRows - 1) * presetGap,
  };
  const presetRects = wrapGrid(presetCount, presetArea, presetCellW, presetH, presetGap);

  const presetsBottom =
    presetRects.length > 0
      ? Math.max(...presetRects.map((r) => r.y + r.h))
      : historicalLabelY + 40;

  let leftPanel: Rect;
  let rightPanel: Rect;
  let center: SandboxLayout['center'];

  if (stacked) {
    const ctrlY = presetsBottom + 18;
    const midX = dw / 2;
    const sizeH = 40;
    const sizeW = 72;
    const sizeGap = 6;
    const sizesW = sizeW * 3 + sizeGap * 2;
    const sizeX0 = midX - sizesW / 2;
    center = {
      size1: { x: sizeX0, y: ctrlY, w: sizeW, h: sizeH },
      size2: { x: sizeX0 + sizeW + sizeGap, y: ctrlY, w: sizeW, h: sizeH },
      size3: { x: sizeX0 + (sizeW + sizeGap) * 2, y: ctrlY, w: sizeW, h: sizeH },
      vsY: ctrlY + 34,
      seedY: ctrlY + 52,
      reroll: { x: midX - 56, y: ctrlY + 62, w: 112, h: 36 },
      fight: { x: midX - 100, y: ctrlY + 108, w: 200, h: 56 },
    };
    const panelY = ctrlY + 180;
    const panelH = Math.max(200, (dh - panelY - 32 - 8) / 2);
    leftPanel = { x: pad, y: panelY, w: dw - pad * 2, h: panelH };
    rightPanel = {
      x: pad,
      y: panelY + panelH + 8,
      w: dw - pad * 2,
      h: Math.max(180, dh - (panelY + panelH + 8) - 32),
    };
  } else {
    const panelY = presetsBottom + 16;
    const sideW = Math.min(350, (dw - 200) / 2);
    const leftX = pad;
    const rightX = dw - pad - sideW;
    const panelH = dh - panelY - 40;
    leftPanel = { x: leftX, y: panelY, w: sideW, h: panelH };
    rightPanel = { x: rightX, y: panelY, w: sideW, h: panelH };
    const midX = dw / 2;
    const sizeW = 70;
    const sizeGap = 6;
    const sizesW = sizeW * 3 + sizeGap * 2;
    const sizeX0 = midX - sizesW / 2;
    center = {
      size1: { x: sizeX0, y: panelY + 32, w: sizeW, h: 40 },
      size2: { x: sizeX0 + sizeW + sizeGap, y: panelY + 32, w: sizeW, h: 40 },
      size3: { x: sizeX0 + (sizeW + sizeGap) * 2, y: panelY + 32, w: sizeW, h: 40 },
      vsY: panelY + 112,
      seedY: panelY + 152,
      reroll: { x: midX - 56, y: panelY + 164, w: 112, h: 36 },
      fight: { x: midX - 100, y: panelY + 212, w: 200, h: 56 },
    };
  }

  return {
    orientation,
    w: dw,
    h: dh,
    pad,
    titleBtn,
    brandY,
    subtitleY,
    historicalLabelY,
    presetRects,
    leftPanel,
    rightPanel,
    center,
    footerY: dh - 14,
    stacked,
  };
}
