export type GlHandle = WebGL2RenderingContext;

export interface GlContext {
  gl: GlHandle;
  canvas: HTMLCanvasElement;
  cssW: number;
  cssH: number;
  dpr: number;
  lost: boolean;
  resize: (cssW: number, cssH: number, dpr?: number) => void;
  dispose: () => void;
}

export type Quality = 'low' | 'med' | 'high';
