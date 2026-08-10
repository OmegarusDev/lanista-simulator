import { describe, expect, it } from 'vitest';
import { ARENA_WORLD_H, ARENA_WORLD_W } from '../shell/canvas';
import { ArenaCamera } from './arenaCamera';
import { designToWorld, fightArenaZoom, fightStageLayout } from './layout';

describe('ArenaCamera', () => {
  it('applies zoom once against the viewport box (no squared layout zoom)', () => {
    const stage = fightStageLayout(390, 844);
    const z = fightArenaZoom(390, 844);
    const cam = new ArenaCamera();
    cam.reset(z);
    const t = cam.toTransform(stage.worldBox);
    const contain = Math.min(
      stage.worldBox.w / ARENA_WORLD_W,
      stage.worldBox.h / ARENA_WORLD_H,
    );
    expect(t.scale).toBeCloseTo(contain * z, 5);
    // Must not be contain × z² (the old double-application bug).
    expect(t.scale).toBeLessThan(contain * z * z - 0.01);
  });

  it('pivots look-at to the viewport center', () => {
    const box = { x: 0, y: 40, w: 390, h: 500 };
    const cam = new ArenaCamera();
    cam.reset(1.2);
    cam.targetX = 200;
    cam.targetY = 300;
    cam.smoothX = 200;
    cam.smoothY = 300;
    cam.panX = 0;
    cam.panY = 0;
    const t = cam.toTransform(box);
    const mid = designToWorld(box.x + box.w / 2, box.y + box.h / 2, t);
    expect(mid.x).toBeCloseTo(200, 5);
    expect(mid.y).toBeCloseTo(300, 5);
  });

  it('keeps arena aspect when framing the full stage', () => {
    const cam = new ArenaCamera();
    cam.reset(1);
    const t = cam.toTransform({ x: 0, y: 0, w: 960, h: 540 });
    expect(t.scale).toBeCloseTo(1);
    const tl = designToWorld(0, 0, t);
    expect(tl.x).toBeCloseTo(0, 5);
    expect(tl.y).toBeCloseTo(0, 5);
    const br = designToWorld(960, 540, t);
    expect(br.x).toBeCloseTo(ARENA_WORLD_W, 5);
    expect(br.y).toBeCloseTo(ARENA_WORLD_H, 5);
  });
});
