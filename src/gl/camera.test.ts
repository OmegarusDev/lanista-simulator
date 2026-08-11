import { describe, expect, it } from 'vitest';
import {
  CAMERA_DOLLY_MAX,
  CAMERA_DOLLY_MIN,
  StageCamera,
} from './camera';
import { ARENA_WORLD_H, ARENA_WORLD_W } from '../shell/canvas';
import { transformMat4, vec3 } from './math';

describe('StageCamera', () => {
  it('unproject round-trip near arena center', () => {
    const cam = new StageCamera();
    cam.reset(720);
    cam.resize(960, 540);
    cam.tickSmooth();
    const screen = cam.screenFromWorld(480, 270, 960, 540);
    const world = cam.worldFromScreen(screen.x, screen.y, 960, 540);
    expect(world).not.toBeNull();
    expect(world!.x).toBeCloseTo(480, -1);
    expect(world!.y).toBeCloseTo(270, -1);
  });

  it('projects arena center to mid-screen NDC after construct (no resize yet)', () => {
    const cam = new StageCamera();
    // Constructor frames arena + builds perspective — never identity proj.
    expect(cam.hasProjection()).toBe(true);
    const clip = transformMat4(
      vec3(),
      [ARENA_WORLD_W * 0.5, 0, ARENA_WORLD_H * 0.5],
      cam.getViewProj(),
    );
    expect(Math.abs(clip[0]!)).toBeLessThan(0.35);
    expect(Math.abs(clip[1]!)).toBeLessThan(0.35);
    expect(clip[2]!).toBeGreaterThan(-1);
    expect(clip[2]!).toBeLessThan(1);
  });

  it('frameArena keeps sand on screen for landscape and portrait', () => {
    for (const [w, h] of [
      [960, 540],
      [390, 844],
      [1280, 720],
    ] as const) {
      const cam = new StageCamera();
      cam.resize(w, h);
      cam.frameArena();
      const clip = transformMat4(
        vec3(),
        [ARENA_WORLD_W * 0.5, 0, ARENA_WORLD_H * 0.5],
        cam.getViewProj(),
      );
      expect(Math.abs(clip[0]!)).toBeLessThan(0.5);
      expect(Math.abs(clip[1]!)).toBeLessThan(0.5);
      expect(clip[2]!).toBeGreaterThan(-1);
      expect(clip[2]!).toBeLessThan(1);
      const screen = cam.screenFromWorld(ARENA_WORLD_W * 0.5, ARENA_WORLD_H * 0.5, w, h);
      expect(screen.x).toBeGreaterThan(w * 0.25);
      expect(screen.x).toBeLessThan(w * 0.75);
      expect(screen.y).toBeGreaterThan(h * 0.25);
      expect(screen.y).toBeLessThan(h * 0.75);
    }
  });

  it('clamps dolly', () => {
    const cam = new StageCamera();
    cam.dollyBy(-9999);
    expect(cam.dolly).toBe(CAMERA_DOLLY_MIN);
    cam.dollyBy(9999);
    expect(cam.dolly).toBe(CAMERA_DOLLY_MAX);
  });

  it('resize does not stomp user dolly', () => {
    const cam = new StageCamera();
    cam.reset(720);
    cam.dollyBy(-100);
    const d = cam.dolly;
    cam.resize(400, 800);
    cam.resize(1200, 700);
    expect(cam.dolly).toBe(d);
  });

  it('orbit yaw clamps', () => {
    const cam = new StageCamera();
    cam.orbit(10, 0);
    expect(Math.abs(cam.yaw)).toBeLessThanOrEqual(0.55 + 1e-6);
  });
});
