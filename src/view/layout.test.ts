import { describe, expect, it } from 'vitest';
import { ARENA_WORLD_H, ARENA_WORLD_W } from '../shell/canvas';
import {
  designToWorld,
  fightArenaZoom,
  fightInspectRect,
  fightStageLayout,
  fitWorldInRect,
  titleLayout,
} from './layout';
import { labChromeRects, labStageGeom, placeLabFighters, pickLabFighter } from './labStage';
import type { FighterSnapshot } from '../domain/combat/types';

describe('fightStageLayout', () => {
  it('stacks arena above chrome in portrait', () => {
    const stage = fightStageLayout(390, 844);
    expect(stage.orientation).toBe('portrait');
    expect(stage.bottomRows).toBe(1);
    expect(stage.world.view.y).toBeGreaterThanOrEqual(stage.topBandH - 0.5);
    expect(stage.world.view.y + stage.world.view.h).toBeLessThanOrEqual(
      stage.rosterBandTop + 0.5,
    );
    expect(stage.rosterY).toBeLessThan(stage.bottomCtrlY);
    expect(stage.bottomCtrlY + stage.bottomCtrlH).toBeLessThanOrEqual(844);
    expect(stage.bottomCtrlH).toBeGreaterThanOrEqual(44);
    expect(stage.rosterH).toBeGreaterThanOrEqual(44);
  });

  it('zooms mobile portrait so the world is wider than the stage', () => {
    const stage = fightStageLayout(390, 844);
    expect(stage.world.scale).toBeGreaterThan(390 / ARENA_WORLD_W + 0.01);
    expect(stage.world.view.w).toBeGreaterThan(390);
    expect(fightArenaZoom(390, 844)).toBeGreaterThan(1);
  });

  it('exposes an unzoomed worldBox for the live camera', () => {
    const stage = fightStageLayout(390, 844);
    expect(stage.worldBox.x).toBe(0);
    expect(stage.worldBox.y).toBe(stage.topBandH);
    expect(stage.worldBox.w).toBe(390);
    expect(stage.worldBox.h).toBeCloseTo(stage.rosterBandTop - stage.topBandH);
    expect(stage.worldBox.y + stage.worldBox.h).toBeLessThanOrEqual(stage.rosterBandTop + 0.5);
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

describe('labStage', () => {
  it('builds design-space slots for both teams', () => {
    const g = labStageGeom(390, 844, 2);
    expect(g.fighterSlots).toHaveLength(4);
    expect(g.fighterSlots.filter((s) => s.team === 0)).toHaveLength(2);
    expect(g.rx).toBeGreaterThan(g.w * 0.5);
  });

  it('places fighters onto Lab slots', () => {
    const g = labStageGeom(390, 844, 1);
    const stub = (id: number, team: 0 | 1): FighterSnapshot =>
      ({
        id,
        team,
        kind: 'gladiator',
        armatura: 'MURMILLO',
        beastId: null,
        name: 'X',
        x: 0,
        y: 0,
        facing: 0,
        hp: 1,
        maxHp: 1,
        stamina: 1,
        maxStamina: 1,
        poise: 1,
        maxPoise: 1,
        action: 'NONE',
        phase: 'IDLE',
        phaseT: 0,
        phaseMax: 0,
        footwork: 'HOLD',
        intention: 'NONE',
        desiredDist: 45,
        poiseTier: 'SOLID',
        stunned: false,
        tangled: false,
        poiseBroken: false,
        guarding: false,
        alive: true,
        flash: 0,
      }) as FighterSnapshot;
    const placed = placeLabFighters([stub(1, 0), stub(2, 1)], g);
    expect(placed[0]!.x).toBe(g.fighterSlots[0]!.x);
    expect(placed[1]!.x).toBe(g.fighterSlots[1]!.x);
  });

  it('picks the nearest fighter in design space', () => {
    const g = labStageGeom(390, 844, 1);
    const snaps = placeLabFighters(
      [
        {
          id: 1,
          team: 0,
          kind: 'gladiator',
          armatura: 'MURMILLO',
          beastId: null,
          name: 'A',
          x: 0,
          y: 0,
          facing: 0,
          hp: 1,
          maxHp: 1,
          stamina: 1,
          maxStamina: 1,
          poise: 1,
          maxPoise: 1,
          action: 'NONE',
          phase: 'IDLE',
          phaseT: 0,
          phaseMax: 0,
          footwork: 'HOLD',
          intention: 'NONE',
          desiredDist: 45,
          poiseTier: 'SOLID',
          stunned: false,
          tangled: false,
          poiseBroken: false,
          guarding: false,
          alive: true,
          flash: 0,
        },
      ],
      g,
    );
    const hit = pickLabFighter(snaps, snaps[0]!.x + 2, snaps[0]!.y - 2, 40);
    expect(hit?.id).toBe(1);
  });

  it('carves beam and shelf chrome bands', () => {
    const c = labChromeRects(390, 844);
    expect(c.beam.y).toBe(0);
    expect(c.shelf.y + c.shelf.h).toBe(844);
    expect(c.beam.h + c.shelf.h).toBeLessThan(844);
  });
});
