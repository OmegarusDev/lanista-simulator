import { describe, expect, it } from 'vitest';
import { ARENA_WORLD_H, ARENA_WORLD_W } from '../shell/canvas';
import { designToWorld, fightArenaZoom } from './layout';

describe('fightArenaZoom', () => {
  it('nudges mobile portrait past contain', () => {
    expect(fightArenaZoom(390, 844)).toBeGreaterThan(1);
    expect(fightArenaZoom(390, 844)).toBe(1.14);
  });

  it('applies a milder landscape zoom', () => {
    expect(fightArenaZoom(960, 540)).toBeGreaterThan(1);
    expect(fightArenaZoom(960, 540)).toBeLessThan(fightArenaZoom(390, 844));
  });
});

describe('designToWorld', () => {
  it('maps design picks back into arena world space', () => {
    const scale = Math.min(390 / ARENA_WORLD_W, 500 / ARENA_WORLD_H) * 1.12;
    const aw = ARENA_WORLD_W * scale;
    const ah = ARENA_WORLD_H * scale;
    const t = {
      view: { x: (390 - aw) / 2, y: 40 + (500 - ah) / 2, w: aw, h: ah },
      scale,
      ox: (390 - aw) / 2,
      oy: 40 + (500 - ah) / 2,
    };
    const mid = designToWorld(t.ox + aw / 2, t.oy + ah / 2, t);
    expect(mid.x).toBeCloseTo(ARENA_WORLD_W / 2, 5);
    expect(mid.y).toBeCloseTo(ARENA_WORLD_H / 2, 5);
  });
});
