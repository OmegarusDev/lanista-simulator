export const DESIGN_W = 960;
export const DESIGN_H = 540;

export interface CanvasLayout {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  scale: number;
  offsetX: number;
  offsetY: number;
}

export interface LetterboxFit {
  scale: number;
  cssW: number;
  cssH: number;
  offsetX: number;
  offsetY: number;
}

/** Uniform scale + letterbox/pillarbox offsets for a viewport. */
export function computeLetterbox(vw: number, vh: number): LetterboxFit {
  const width = Math.max(1, vw);
  const height = Math.max(1, vh);
  const scale = Math.min(width / DESIGN_W, height / DESIGN_H);
  const cssW = DESIGN_W * scale;
  const cssH = DESIGN_H * scale;
  return {
    scale,
    cssW,
    cssH,
    offsetX: (width - cssW) / 2,
    offsetY: (height - cssH) / 2,
  };
}

/** Map client (CSS pixel) coords → design space using the painted canvas rect. */
export function mapClientToDesign(
  clientX: number,
  clientY: number,
  rect: Pick<DOMRect, 'left' | 'top' | 'width' | 'height'>,
): { x: number; y: number } {
  const w = rect.width || 1;
  const h = rect.height || 1;
  return {
    x: ((clientX - rect.left) / w) * DESIGN_W,
    y: ((clientY - rect.top) / h) * DESIGN_H,
  };
}

/** Prefer visualViewport so mobile URL bars / keyboards resize the letterbox. */
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
  return { canvas, ctx, scale: 1, offsetX: 0, offsetY: 0 };
}

export function resizeCanvas(layout: CanvasLayout): void {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const { w: vw, h: vh } = viewportSize();
  const fit = computeLetterbox(vw, vh);
  layout.scale = fit.scale;
  layout.offsetX = fit.offsetX;
  layout.offsetY = fit.offsetY;

  const { canvas, ctx } = layout;
  canvas.style.left = `${fit.offsetX}px`;
  canvas.style.top = `${fit.offsetY}px`;
  canvas.style.width = `${fit.cssW}px`;
  canvas.style.height = `${fit.cssH}px`;
  canvas.width = Math.max(1, Math.floor(DESIGN_W * dpr));
  canvas.height = Math.max(1, Math.floor(DESIGN_H * dpr));
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

export function clientToDesign(
  layout: CanvasLayout,
  clientX: number,
  clientY: number,
): { x: number; y: number } {
  return mapClientToDesign(clientX, clientY, layout.canvas.getBoundingClientRect());
}

/** Bind resize / orientation / visualViewport so the letterbox tracks the usable area. */
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
