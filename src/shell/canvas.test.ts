import { describe, expect, it } from 'vitest';
import {
  DESIGN_H,
  DESIGN_W,
  computeLetterbox,
  mapClientToDesign,
} from './canvas';

describe('computeLetterbox', () => {
  it('fits width-limited (pillarbox) viewports', () => {
    const fit = computeLetterbox(800, 600);
    expect(fit.scale).toBeCloseTo(800 / DESIGN_W);
    expect(fit.cssW).toBeCloseTo(800);
    expect(fit.cssH).toBeCloseTo(DESIGN_H * (800 / DESIGN_W));
    expect(fit.offsetX).toBeCloseTo(0);
    expect(fit.offsetY).toBeGreaterThan(0);
  });

  it('fits height-limited (letterbox) viewports', () => {
    const fit = computeLetterbox(1920, 400);
    expect(fit.scale).toBeCloseTo(400 / DESIGN_H);
    expect(fit.cssH).toBeCloseTo(400);
    expect(fit.cssW).toBeCloseTo(DESIGN_W * (400 / DESIGN_H));
    expect(fit.offsetY).toBeCloseTo(0);
    expect(fit.offsetX).toBeGreaterThan(0);
  });

  it('fills exactly on a 16:9 design-sized viewport', () => {
    const fit = computeLetterbox(DESIGN_W, DESIGN_H);
    expect(fit.scale).toBe(1);
    expect(fit.offsetX).toBe(0);
    expect(fit.offsetY).toBe(0);
    expect(fit.cssW).toBe(DESIGN_W);
    expect(fit.cssH).toBe(DESIGN_H);
  });

  it('scales down for narrow mobile portrait', () => {
    const fit = computeLetterbox(390, 844);
    expect(fit.scale).toBeCloseTo(390 / DESIGN_W);
    expect(fit.cssW).toBeCloseTo(390);
    expect(fit.offsetX).toBeCloseTo(0);
    expect(fit.offsetY).toBeGreaterThan(0);
  });
});

describe('mapClientToDesign', () => {
  it('maps corners of a scaled rect to design corners', () => {
    const scale = 0.5;
    const rect = {
      left: 100,
      top: 50,
      width: DESIGN_W * scale,
      height: DESIGN_H * scale,
    };
    expect(mapClientToDesign(100, 50, rect)).toEqual({ x: 0, y: 0 });
    expect(mapClientToDesign(100 + rect.width, 50 + rect.height, rect)).toEqual({
      x: DESIGN_W,
      y: DESIGN_H,
    });
  });

  it('maps the design center through CSS letterboxing offsets', () => {
    const scale = 0.75;
    const rect = {
      left: 40,
      top: 30,
      width: DESIGN_W * scale,
      height: DESIGN_H * scale,
    };
    const p = mapClientToDesign(40 + rect.width / 2, 30 + rect.height / 2, rect);
    expect(p.x).toBeCloseTo(DESIGN_W / 2);
    expect(p.y).toBeCloseTo(DESIGN_H / 2);
  });

  it('does not use a stale layout.scale — only the live rect', () => {
    // Rect is 2× CSS size even if something else thought scale was 1.
    const rect = { left: 0, top: 0, width: DESIGN_W * 2, height: DESIGN_H * 2 };
    const p = mapClientToDesign(DESIGN_W, DESIGN_H, rect);
    expect(p.x).toBeCloseTo(DESIGN_W / 2);
    expect(p.y).toBeCloseTo(DESIGN_H / 2);
  });
});
