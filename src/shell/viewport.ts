/**
 * Pin #app to visualViewport (size + offset) so iOS URL-bar drift cannot desync hits.
 */
export interface AppShell {
  app: HTMLElement;
  chrome: HTMLElement;
  stageWrap: HTMLElement;
  stage: HTMLCanvasElement;
  stageCtx: CanvasRenderingContext2D;
}

export function mountShell(): AppShell {
  const app = document.getElementById('app');
  const chrome = document.getElementById('chrome');
  const stageWrap = document.getElementById('stage-wrap');
  const stage = document.getElementById('stage');
  if (!(app instanceof HTMLElement)) throw new Error('#app not found');
  if (!(chrome instanceof HTMLElement)) throw new Error('#chrome not found');
  if (!(stageWrap instanceof HTMLElement)) throw new Error('#stage-wrap not found');
  if (!(stage instanceof HTMLCanvasElement)) throw new Error('#stage canvas not found');
  const stageCtx = stage.getContext('2d');
  if (!stageCtx) throw new Error('2D context unavailable');

  const pin = () => pinAppToVisualViewport(app);
  pin();
  window.addEventListener('resize', pin);
  window.addEventListener('orientationchange', pin);
  const vv = window.visualViewport;
  if (vv) {
    vv.addEventListener('resize', pin);
    vv.addEventListener('scroll', pin);
  }

  return { app, chrome, stageWrap, stage, stageCtx };
}

export function pinAppToVisualViewport(app: HTMLElement): void {
  const vv = window.visualViewport;
  const w = vv && vv.width > 0 ? vv.width : window.innerWidth;
  const h = vv && vv.height > 0 ? vv.height : window.innerHeight;
  const left = vv?.offsetLeft ?? 0;
  const top = vv?.offsetTop ?? 0;
  app.style.width = `${Math.max(1, w)}px`;
  app.style.height = `${Math.max(1, h)}px`;
  app.style.left = `${left}px`;
  app.style.top = `${top}px`;
}

/** Resize stage canvas to its CSS box (device pixels). */
export function resizeStageCanvas(stage: HTMLCanvasElement, ctx: CanvasRenderingContext2D): {
  cssW: number;
  cssH: number;
} {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const rect = stage.getBoundingClientRect();
  const cssW = Math.max(1, Math.round(rect.width));
  const cssH = Math.max(1, Math.round(rect.height));
  const bw = Math.max(1, Math.floor(cssW * dpr));
  const bh = Math.max(1, Math.floor(cssH * dpr));
  if (stage.width !== bw || stage.height !== bh) {
    stage.width = bw;
    stage.height = bh;
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { cssW, cssH };
}

export function clientToStage(
  stage: HTMLCanvasElement,
  clientX: number,
  clientY: number,
): { x: number; y: number } {
  const rect = stage.getBoundingClientRect();
  const w = rect.width || 1;
  const h = rect.height || 1;
  return {
    x: ((clientX - rect.left) / w) * (rect.width || 1),
    y: ((clientY - rect.top) / h) * (rect.height || 1),
  };
}

export function setStageVisible(shell: AppShell, visible: boolean): void {
  shell.stageWrap.classList.toggle('is-hidden', !visible);
  shell.stageWrap.setAttribute('aria-hidden', visible ? 'false' : 'true');
  shell.app.classList.toggle('has-stage', visible);
}
