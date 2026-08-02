/** Fixed combat / sand world — independent of UI design size. */
export const ARENA_WORLD_W = 960;
export const ARENA_WORLD_H = 540;

/** @deprecated Prefer getDesign() — kept for combat defaults / tests. */
export const DESIGN_W = ARENA_WORLD_W;
/** @deprecated Prefer getDesign() — kept for combat defaults / tests. */
export const DESIGN_H = ARENA_WORLD_H;

/** Cap design longest side so 4K doesn't explode the backing store. */
export const MAX_DESIGN_LONG_SIDE = 1400;
/** Letterbox only outside this aspect band (ultrawide / absurdly tall). */
export const MAX_STAGE_ASPECT = 21 / 9;
export const MIN_STAGE_ASPECT = 9 / 20;

export type Orientation = 'portrait' | 'landscape';

export interface DesignSize {
  w: number;
  h: number;
  orientation: Orientation;
}

export interface CanvasLayout {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  /** Live logical design size (CSS-pixel stage). */
  designW: number;
  designH: number;
  orientation: Orientation;
  /** CSS pixels per design unit (≈1 when design tracks the viewport). */
  scale: number;
  offsetX: number;
  offsetY: number;
}

export interface ViewportFit {
  designW: number;
  designH: number;
  orientation: Orientation;
  cssW: number;
  cssH: number;
  scale: number;
  offsetX: number;
  offsetY: number;
}

const liveDesign: DesignSize = {
  w: ARENA_WORLD_W,
  h: ARENA_WORLD_H,
  orientation: 'landscape',
};

export function getDesign(): DesignSize {
  return liveDesign;
}

export function orientationOf(w: number, h: number): Orientation {
  return h > w ? 'portrait' : 'landscape';
}

/**
 * Pick a logical design size from the usable viewport.
 * Default: design ≈ CSS viewport (scale 1) so portrait phones get a tall stage.
 * Letterbox/pillarbox only for extreme aspect outliers; downscale design on huge displays.
 */
export function computeViewportFit(vw: number, vh: number): ViewportFit {
  const width = Math.max(1, vw);
  const height = Math.max(1, vh);
  let cssW = width;
  let cssH = height;
  let offsetX = 0;
  let offsetY = 0;

  const aspect = width / height;
  if (aspect > MAX_STAGE_ASPECT) {
    cssW = height * MAX_STAGE_ASPECT;
    offsetX = (width - cssW) / 2;
  } else if (aspect < MIN_STAGE_ASPECT) {
    cssH = width / MIN_STAGE_ASPECT;
    offsetY = (height - cssH) / 2;
  }

  let designW = Math.max(1, Math.round(cssW));
  let designH = Math.max(1, Math.round(cssH));
  const longest = Math.max(designW, designH);
  if (longest > MAX_DESIGN_LONG_SIDE) {
    const s = MAX_DESIGN_LONG_SIDE / longest;
    designW = Math.max(1, Math.round(designW * s));
    designH = Math.max(1, Math.round(designH * s));
  }

  const scale = cssW / designW;
  return {
    designW,
    designH,
    orientation: orientationOf(designW, designH),
    cssW,
    cssH,
    scale,
    offsetX,
    offsetY,
  };
}

/** Map client (CSS pixel) coords → design space using the painted canvas rect. */
export function mapClientToDesign(
  clientX: number,
  clientY: number,
  rect: Pick<DOMRect, 'left' | 'top' | 'width' | 'height'>,
  designW: number,
  designH: number,
): { x: number; y: number } {
  const w = rect.width || 1;
  const h = rect.height || 1;
  return {
    x: ((clientX - rect.left) / w) * designW,
    y: ((clientY - rect.top) / h) * designH,
  };
}

/** Prefer visualViewport so mobile URL bars / keyboards resize the stage. */
export function viewportSize(): { w: number; h: number } {
  const vv = window.visualViewport;
  if (vv && vv.width > 0 && vv.height > 0) {
    return { w: vv.width, h: vv.height };
  }
  return { w: window.innerWidth, h: window.innerHeight };
}

export function createCanvasLayout(canvas: HTMLCanvasElement): CanvasLayout {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D context unavailable');
  canvas.style.position = 'absolute';
  canvas.style.display = 'block';
  canvas.style.margin = '0';
  canvas.style.touchAction = 'none';
  return {
    canvas,
    ctx,
    designW: liveDesign.w,
    designH: liveDesign.h,
    orientation: liveDesign.orientation,
    scale: 1,
    offsetX: 0,
    offsetY: 0,
  };
}

export function resizeCanvas(layout: CanvasLayout): void {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const { w: vw, h: vh } = viewportSize();
  const fit = computeViewportFit(vw, vh);

  liveDesign.w = fit.designW;
  liveDesign.h = fit.designH;
  liveDesign.orientation = fit.orientation;

  layout.designW = fit.designW;
  layout.designH = fit.designH;
  layout.orientation = fit.orientation;
  layout.scale = fit.scale;
  layout.offsetX = fit.offsetX;
  layout.offsetY = fit.offsetY;

  const { canvas, ctx } = layout;
  canvas.style.left = `${fit.offsetX}px`;
  canvas.style.top = `${fit.offsetY}px`;
  canvas.style.width = `${fit.cssW}px`;
  canvas.style.height = `${fit.cssH}px`;
  canvas.width = Math.max(1, Math.floor(fit.designW * dpr));
  canvas.height = Math.max(1, Math.floor(fit.designH * dpr));
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

export function clientToDesign(
  layout: CanvasLayout,
  clientX: number,
  clientY: number,
): { x: number; y: number } {
  return mapClientToDesign(
    clientX,
    clientY,
    layout.canvas.getBoundingClientRect(),
    layout.designW,
    layout.designH,
  );
}

/** Bind resize / orientation / visualViewport so the stage tracks the usable area. */
export function bindCanvasResize(onResize: () => void): () => void {
  window.addEventListener('resize', onResize);
  window.addEventListener('orientationchange', onResize);
  const vv = window.visualViewport;
  if (vv) {
    vv.addEventListener('resize', onResize);
    vv.addEventListener('scroll', onResize);
  }
  return () => {
    window.removeEventListener('resize', onResize);
    window.removeEventListener('orientationchange', onResize);
    if (vv) {
      vv.removeEventListener('resize', onResize);
      vv.removeEventListener('scroll', onResize);
    }
  };
}
