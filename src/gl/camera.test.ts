import { describe, expect, it } from 'vitest';
import {
  CAMERA_DOLLY_MAX,
  CAMERA_DOLLY_MIN,
  CAMERA_RECOVER_TICKS,
  defaultStageDolly,
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

  it('portrait keeps a usable horizontal view (hfov floor)', () => {
    const cam = new StageCamera();
    cam.resize(390, 844);
    cam.frameArena(defaultStageDolly(390, 844));
    const left = cam.worldFromScreen(0, 422, 390, 844);
    const right = cam.worldFromScreen(390, 422, 390, 844);
    expect(left).not.toBeNull();
    expect(right).not.toBeNull();
    // Was ~255 before the hfov floor + aspect-aware dolly; now comfortably wide.
    expect(right!.x - left!.x).toBeGreaterThan(500);
  });

  it('landscape default framing is unchanged', () => {
    const cam = new StageCamera();
    cam.resize(960, 540);
    cam.frameArena();
    const left = cam.worldFromScreen(0, 270, 960, 540);
    const right = cam.worldFromScreen(960, 270, 960, 540);
    const span = right!.x - left!.x;
    expect(span).toBeGreaterThan(850);
    expect(span).toBeLessThan(950);
  });

  it('director frames a portrait fight so both fighters are on screen', () => {
    const cam = new StageCamera();
    cam.resize(390, 844);
    const fighters = [
      { id: 1, x: 350, y: 270, alive: true },
      { id: 2, x: 610, y: 270, alive: true },
    ];
    cam.frameArena();
    for (let i = 0; i < 200; i++) {
      cam.updateDirector(fighters);
      cam.tickSmooth();
    }
    const p1 = cam.screenFromWorld(350, 270, 390, 844);
    const p2 = cam.screenFromWorld(610, 270, 390, 844);
    expect(p1.x).toBeGreaterThan(0);
    expect(p1.x).toBeLessThan(390);
    expect(p2.x).toBeGreaterThan(0);
    expect(p2.x).toBeLessThan(390);
  });

  it('clamps pan to the arena', () => {
    const cam = new StageCamera();
    cam.panOnPlane(1e6, 1e6);
    cam.tickSmooth();
    const look = cam.worldFromScreen(480, 270, 960, 540);
    expect(look).not.toBeNull();
    expect(look!.x).toBeGreaterThanOrEqual(40);
    expect(look!.x).toBeLessThanOrEqual(ARENA_WORLD_W - 40);
    expect(look!.y).toBeGreaterThanOrEqual(40);
    expect(look!.y).toBeLessThanOrEqual(ARENA_WORLD_H - 40);
  });

  it('hands a manual camera back to the director after idle', () => {
    const cam = new StageCamera();
    cam.frameArena();
    cam.dollyBy(-50);
    expect(cam.mode).toBe('manual');
    for (let i = 0; i < 180 + CAMERA_RECOVER_TICKS + 10; i++) {
      cam.updateDirector([], { autoRecover: true });
    }
    expect(cam.mode).toBe('director');
  });

  it('stays manual without autoRecover', () => {
    const cam = new StageCamera();
    cam.frameArena();
    cam.dollyBy(-50);
    for (let i = 0; i < 180 + CAMERA_RECOVER_TICKS + 10; i++) {
      cam.updateDirector([]);
    }
    expect(cam.mode).toBe('manual');
  });

  it('recenter returns to director and clears pan', () => {
    const cam = new StageCamera();
    cam.panOnPlane(200, 100);
    cam.dollyBy(-50);
    cam.recenter();
    expect(cam.mode).toBe('director');
    expect(cam.panX).toBe(0);
    expect(cam.panZ).toBe(0);
  });

  it('zoom input only dolls — it never moves the look-at (no stuck arena)', () => {
    const cam = new StageCamera();
    cam.frameArena();
    cam.panOnPlane(120, 60);
    const lookBefore = cam.worldFromScreen(480, 270, 960, 540)!;
    cam.applyZoomInput(0, 0.5, 0, 0); // pinch in
    cam.applyZoomInput(-400, 0, 0, 0); // wheel out
    const lookAfter = cam.worldFromScreen(480, 270, 960, 540)!;
    expect(lookAfter.x).toBeCloseTo(lookBefore.x, 4);
    expect(lookAfter.y).toBeCloseTo(lookBefore.y, 4);
  });
});
