export const DESIGN_W = 960;
export const DESIGN_H = 540;

export interface CanvasLayout {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  scale: number;
  offsetX: number;
  offsetY: number;
}

export function createCanvasLayout(canvas: HTMLCanvasElement): CanvasLayout {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D context unavailable');
  return { canvas, ctx, scale: 1, offsetX: 0, offsetY: 0 };
}

export function resizeCanvas(layout: CanvasLayout): void {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const scale = Math.min(vw / DESIGN_W, vh / DESIGN_H);
  const cssW = DESIGN_W * scale;
  const cssH = DESIGN_H * scale;
  layout.offsetX = (vw - cssW) / 2;
  layout.offsetY = (vh - cssH) / 2;
  layout.scale = scale;
  layout.canvas.style.width = `${cssW}px`;
  layout.canvas.style.height = `${cssH}px`;
  layout.canvas.style.marginLeft = `${layout.offsetX}px`;
  layout.canvas.style.marginTop = `${layout.offsetY}px`;
  layout.canvas.width = Math.floor(DESIGN_W * dpr);
  layout.canvas.height = Math.floor(DESIGN_H * dpr);
  layout.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

export function clientToDesign(
  layout: CanvasLayout,
  clientX: number,
  clientY: number,
): { x: number; y: number } {
  const rect = layout.canvas.getBoundingClientRect();
  return {
    x: (clientX - rect.left) / layout.scale,
    y: (clientY - rect.top) / layout.scale,
  };
}
