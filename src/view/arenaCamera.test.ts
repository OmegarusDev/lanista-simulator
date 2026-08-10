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

  it('cover-fills a tall viewport with no letterbox bands', () => {
    const box = { x: 0, y: 0, w: 390, h: 844 };
    const cam = new ArenaCamera();
    cam.reset(1, 'cover');
    const t = cam.toTransform(box);
    const cover = Math.max(box.w / ARENA_WORLD_W, box.h / ARENA_WORLD_H);
    expect(t.scale).toBeCloseTo(cover, 5);
    // Cover scale must beat contain (otherwise you get the picture-window bars).
    const contain = Math.min(box.w / ARENA_WORLD_W, box.h / ARENA_WORLD_H);
    expect(t.scale).toBeGreaterThan(contain + 0.01);
  });

  it('nudgeZoom clamps to the cinematic band', () => {
    const cam = new ArenaCamera();
    cam.reset(1.12);
    cam.nudgeZoom(2);
    expect(cam.zoom).toBeLessThanOrEqual(1.45);
    cam.nudgeZoom(-5);
    expect(cam.zoom).toBeGreaterThanOrEqual(0.95);
  });

  it('soft-returns pan when not dragging', () => {
    const cam = new ArenaCamera();
    cam.reset(1.12);
    cam.panX = 40;
    cam.panY = -30;
    cam.mode = 'autocam';
    for (let i = 0; i < 80; i++) cam.tickSmooth();
    expect(Math.abs(cam.panX)).toBeLessThan(0.2);
    expect(Math.abs(cam.panY)).toBeLessThan(0.2);
  });

  it('focusFighter zooms in and holds look-at', () => {
    const cam = new ArenaCamera();
    cam.reset(1.1);
    cam.focusFighter({ id: 3, x: 400, y: 280 });
    expect(cam.mode).toBe('focus');
    expect(cam.zoom).toBeGreaterThanOrEqual(1.28);
    expect(cam.targetX).toBe(400);
    expect(cam.targetY).toBe(280);
  });
});
