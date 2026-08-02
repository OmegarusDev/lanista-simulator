import { describe, expect, it } from 'vitest';
import {
  ARENA_WORLD_H,
  ARENA_WORLD_W,
  MAX_STAGE_ASPECT,
  MIN_STAGE_ASPECT,
  computeViewportFit,
  mapClientToDesign,
  orientationOf,
} from './canvas';

describe('computeViewportFit', () => {
  it('uses the full viewport as design size on a phone portrait', () => {
    const fit = computeViewportFit(390, 844);
    expect(fit.orientation).toBe('portrait');
    expect(fit.designW).toBe(390);
    expect(fit.designH).toBe(844);
    expect(fit.scale).toBeCloseTo(1);
    expect(fit.offsetX).toBeCloseTo(0);
    expect(fit.offsetY).toBeCloseTo(0);
  });

  it('uses the full viewport as design size on landscape desktop', () => {
    const fit = computeViewportFit(960, 540);
    expect(fit.orientation).toBe('landscape');
    expect(fit.designW).toBe(960);
    expect(fit.designH).toBe(540);
    expect(fit.scale).toBe(1);
    expect(fit.offsetX).toBe(0);
    expect(fit.offsetY).toBe(0);
  });

  it('does not force a landscape letterbox on tall phones', () => {
    const fit = computeViewportFit(390, 844);
    // Old letterbox would leave large vertical bars; design height must be tall.
    expect(fit.designH).toBeGreaterThan(fit.designW);
    expect(fit.cssH / fit.cssW).toBeCloseTo(844 / 390);
  });

  it('pillarboxes only extreme ultrawide viewports', () => {
    const vw = 2400;
    const vh = 600; // aspect 4:1 > 21:9
    const fit = computeViewportFit(vw, vh);
    expect(fit.cssW).toBeCloseTo(vh * MAX_STAGE_ASPECT);
    expect(fit.offsetX).toBeGreaterThan(0);
    expect(fit.offsetY).toBeCloseTo(0);
  });

  it('letterboxes only extreme super-tall viewports', () => {
    const vw = 300;
    const vh = 1200; // aspect 0.25 < 9/20
    const fit = computeViewportFit(vw, vh);
    expect(fit.cssH).toBeCloseTo(vw / MIN_STAGE_ASPECT);
    expect(fit.offsetY).toBeGreaterThan(0);
    expect(fit.offsetX).toBeCloseTo(0);
  });

  it('downscales design on huge displays while preserving aspect', () => {
    const fit = computeViewportFit(3840, 2160);
    expect(Math.max(fit.designW, fit.designH)).toBeLessThanOrEqual(1400);
    expect(fit.designW / fit.designH).toBeCloseTo(3840 / 2160, 2);
    expect(fit.scale).toBeGreaterThan(1);
  });
});

describe('orientationOf', () => {
  it('classifies portrait and landscape', () => {
    expect(orientationOf(390, 844)).toBe('portrait');
    expect(orientationOf(960, 540)).toBe('landscape');
    expect(orientationOf(800, 800)).toBe('landscape');
  });
});

describe('mapClientToDesign', () => {
  it('maps corners of a scaled rect to live design corners', () => {
    const designW = 390;
    const designH = 844;
    const scale = 0.5;
    const rect = {
      left: 100,
      top: 50,
      width: designW * scale,
      height: designH * scale,
    };
    expect(mapClientToDesign(100, 50, rect, designW, designH)).toEqual({ x: 0, y: 0 });
    expect(mapClientToDesign(100 + rect.width, 50 + rect.height, rect, designW, designH)).toEqual({
      x: designW,
      y: designH,
    });
  });

  it('maps the design center through CSS offsets', () => {
    const designW = ARENA_WORLD_W;
    const designH = ARENA_WORLD_H;
    const scale = 0.75;
    const rect = {
      left: 40,
      top: 30,
      width: designW * scale,
      height: designH * scale,
    };
    const p = mapClientToDesign(40 + rect.width / 2, 30 + rect.height / 2, rect, designW, designH);
    expect(p.x).toBeCloseTo(designW / 2);
    expect(p.y).toBeCloseTo(designH / 2);
  });

  it('tracks design size, not a frozen 960×540 constant', () => {
    const rect = { left: 0, top: 0, width: 200, height: 400 };
    const p = mapClientToDesign(100, 200, rect, 200, 400);
    expect(p.x).toBeCloseTo(100);
    expect(p.y).toBeCloseTo(200);
  });
});
