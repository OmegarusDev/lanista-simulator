import { describe, expect, it } from 'vitest';
import { ARENA_WORLD_H, ARENA_WORLD_W } from '../shell/canvas';
import {
  designToWorld,
  fightArenaZoom,
  fightInspectRect,
  fightStageLayout,
  fitWorldInRect,
  sandboxLayout,
  titleLayout,
} from './layout';

describe('fightStageLayout', () => {
  it('stacks arena above chrome in portrait', () => {
    const stage = fightStageLayout(390, 844);
    expect(stage.orientation).toBe('portrait');
    expect(stage.bottomRows).toBe(2);
    // Zoom may crop L/R past the band, but the painted world stays in the band vertically.
    expect(stage.world.view.y).toBeGreaterThanOrEqual(stage.topBandH - 0.5);
    expect(stage.world.view.y + stage.world.view.h).toBeLessThanOrEqual(
      stage.rosterBandTop + 0.5,
    );
    expect(stage.rosterY).toBeLessThan(stage.bottomCtrlY);
    expect(stage.bottomCtrlY + stage.bottomCtrlH).toBeLessThanOrEqual(844);
  });

  it('zooms mobile portrait so the world is wider than the stage', () => {
    const stage = fightStageLayout(390, 844);
    // Effective scale should beat plain contain-by-width.
    expect(stage.world.scale).toBeGreaterThan(390 / ARENA_WORLD_W + 0.01);
    expect(stage.world.view.w).toBeGreaterThan(390);
    expect(fightArenaZoom(390, 844)).toBeGreaterThan(1);
  });

  it('fills the stage with a slightly zoomed arena in landscape', () => {
    const stage = fightStageLayout(960, 540);
    expect(stage.orientation).toBe('landscape');
    expect(stage.bottomRows).toBe(1);
    expect(stage.world.scale).toBeCloseTo(fightArenaZoom(960, 540));
    expect(stage.world.view.w).toBeCloseTo(ARENA_WORLD_W * stage.world.scale);
    expect(stage.world.view.h).toBeCloseTo(ARENA_WORLD_H * stage.world.scale);
  });

  it('maps design picks back into arena world space', () => {
    const stage = fightStageLayout(390, 844);
    const midX = stage.w / 2;
    const midY = stage.world.view.y + stage.world.view.h / 2;
    const world = designToWorld(midX, midY, stage.world);
    expect(world.x).toBeCloseTo(ARENA_WORLD_W / 2, 0);
    expect(world.y).toBeCloseTo(ARENA_WORLD_H / 2, 0);
  });

  it('uses a full-width inspect sheet in portrait', () => {
    const stage = fightStageLayout(390, 844);
    const r = fightInspectRect(stage, true, 200);
    expect(r.w).toBeGreaterThan(300);
    expect(r.x).toBeGreaterThanOrEqual(stage.inspectPad - 0.5);
  });
});

describe('fitWorldInRect', () => {
  it('preserves arena aspect inside a tall box', () => {
    const t = fitWorldInRect({ x: 0, y: 40, w: 390, h: 500 });
    expect(t.view.w / t.view.h).toBeCloseTo(ARENA_WORLD_W / ARENA_WORLD_H);
    expect(t.view.w).toBeLessThanOrEqual(390);
    expect(t.view.h).toBeLessThanOrEqual(500);
  });

  it('zooms past contain and keeps the world centered', () => {
    const box = { x: 0, y: 40, w: 390, h: 500 };
    const base = fitWorldInRect(box);
    const zoomed = fitWorldInRect(box, 1.12);
    expect(zoomed.scale).toBeCloseTo(base.scale * 1.12);
    expect(zoomed.view.w).toBeGreaterThan(box.w);
    expect(zoomed.ox + zoomed.view.w / 2).toBeCloseTo(box.x + box.w / 2);
    expect(zoomed.oy + zoomed.view.h / 2).toBeCloseTo(box.y + box.h / 2);
  });
});

describe('titleLayout', () => {
  it('centers stacked CTAs in portrait', () => {
    const L = titleLayout(390, 844);
    expect(L.orientation).toBe('portrait');
    expect(L.buttons).toHaveLength(3);
    for (const b of L.buttons) {
      expect(b.w).toBeGreaterThan(180);
      expect(b.x + b.w / 2).toBeCloseTo(195, 0);
    }
  });
});

describe('sandboxLayout', () => {
  it('stacks team panels in portrait', () => {
    const L = sandboxLayout(390, 844, 4);
    expect(L.stacked).toBe(true);
    expect(L.leftPanel.y).toBeLessThan(L.rightPanel.y);
    expect(L.leftPanel.w).toBeCloseTo(L.rightPanel.w);
    expect(L.presetRects.length).toBe(4);
  });

  it('keeps side-by-side panels in wide landscape', () => {
    const L = sandboxLayout(960, 540, 4);
    expect(L.stacked).toBe(false);
    expect(L.leftPanel.x).toBeLessThan(L.rightPanel.x);
    expect(L.leftPanel.y).toBeCloseTo(L.rightPanel.y);
  });
});
