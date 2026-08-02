import { describe, expect, it } from 'vitest';
import { ARENA_WORLD_H, ARENA_WORLD_W } from '../shell/canvas';
import {
  designToWorld,
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
    expect(stage.world.view.y).toBeGreaterThanOrEqual(stage.topBandH - 0.5);
    expect(stage.world.view.y + stage.world.view.h).toBeLessThanOrEqual(
      stage.rosterBandTop + 0.5,
    );
    expect(stage.rosterY).toBeLessThan(stage.bottomCtrlY);
    expect(stage.bottomCtrlY + stage.bottomCtrlH).toBeLessThanOrEqual(844);
  });

  it('fills the stage with the arena world in landscape', () => {
    const stage = fightStageLayout(960, 540);
    expect(stage.orientation).toBe('landscape');
    expect(stage.bottomRows).toBe(1);
    expect(stage.world.scale).toBeCloseTo(1);
    expect(stage.world.view.w).toBeCloseTo(ARENA_WORLD_W);
    expect(stage.world.view.h).toBeCloseTo(ARENA_WORLD_H);
  });

  it('maps design picks back into arena world space', () => {
    const stage = fightStageLayout(390, 844);
    const midX = stage.world.view.x + stage.world.view.w / 2;
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
