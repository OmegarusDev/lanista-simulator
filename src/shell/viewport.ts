/**
 * Pin #app to visualViewport (size + offset) so iOS URL-bar drift cannot desync hits.
 */
import { setLiveDesign } from './canvas';
import { createGl, type GlContext } from '../gl/context';
import { GlFrame } from '../gl/index';

export interface AppShell {
  app: HTMLElement;
  chrome: HTMLElement;
  stageWrap: HTMLElement;
  stage: HTMLCanvasElement;
  gl: GlContext | null;
  frame: GlFrame | null;
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

  const gl = createGl(stage);
  const frame = gl ? new GlFrame(gl) : null;

  const pin = () => pinAppToVisualViewport(app);
  pin();
  window.addEventListener('resize', pin);
  window.addEventListener('orientationchange', pin);
  const vv = window.visualViewport;
  if (vv) {
    vv.addEventListener('resize', pin);
    vv.addEventListener('scroll', pin);
  }

  return { app, chrome, stageWrap, stage, gl, frame };
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

/** Resize stage drawingBuffer to CSS box × DPR. */
export function resizeStageCanvas(shell: AppShell): { cssW: number; cssH: number } {
  const stage = shell.stage;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const wrap = shell.stageWrap;
  // Prefer wrap box — absolute canvas can report 0 before first style write.
  const wrapRect = wrap.getBoundingClientRect();
  const stageRect = stage.getBoundingClientRect();
  const cssW = Math.max(1, Math.round(wrapRect.width || stageRect.width || window.innerWidth));
  const cssH = Math.max(1, Math.round(wrapRect.height || stageRect.height || window.innerHeight));
  if (shell.frame) {
    shell.frame.resize(cssW, cssH);
  } else {
    const bw = Math.max(1, Math.floor(cssW * dpr));
    const bh = Math.max(1, Math.floor(cssH * dpr));
    if (stage.width !== bw || stage.height !== bh) {
      stage.width = bw;
      stage.height = bh;
    }
    stage.style.width = `${cssW}px`;
    stage.style.height = `${cssH}px`;
  }
  setLiveDesign(cssW, cssH);
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

export function showGlFailBanner(host: HTMLElement): void {
  const pre = document.createElement('pre');
  pre.setAttribute('role', 'alert');
  pre.style.cssText =
    'margin:1.5rem;padding:1rem;white-space:pre-wrap;color:#e8dcc4;background:#1a2028;border:1px solid #b8954a;font:14px/1.4 ui-monospace,monospace;z-index:20;position:relative';
  pre.textContent =
    'Lanista needs WebGL2.\n\nThis browser could not create a WebGL2 context. Try a recent Chrome, Firefox, or Safari build.';
  host.prepend(pre);
}
