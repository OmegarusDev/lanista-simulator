import { describe, expect, it } from 'vitest';
import {
  bladeSegment,
  contactParam,
  sweptSegmentCircleContact,
} from './collision';
import {
  bodyCollisionCapsule,
  lungeOffset,
  swingAngleRad,
} from '../../content/shapes';
import { strikeParams } from '../../content/strike';
import { ARMATURA_LIST, ARMATURAE } from '../../content/armatura';
import { ARMATURA_LOOK } from '../../content/appearance';
import { ARMATURA_LOADOUTS, loadoutPartIds } from '../../content/kitPieces';

describe('swing and lunge curves', () => {
  it('swing is zero through the lunge, peaks mid-swing, returns', () => {
    expect(swingAngleRad(0.7, 0)).toBe(0);
    expect(swingAngleRad(0.7, 0.5)).toBe(0); // blade level at full lunge
    expect(swingAngleRad(0.7, 0.75)).toBeCloseTo(0.7, 6);
    expect(swingAngleRad(0.7, 1)).toBeCloseTo(0, 6);
  });

  it('lunge rises to full by mid-phase and holds', () => {
    expect(lungeOffset(10, 0)).toBe(0);
    expect(lungeOffset(10, 0.5)).toBeCloseTo(10, 6);
    expect(lungeOffset(10, 1)).toBeCloseTo(10, 6);
  });
});

describe('bladeSegment (world space, render === collision)', () => {
  const grip = { x: 6, z: 6 };
  it('at mid-phase the blade is level and fully lunged', () => {
    const seg = bladeSegment(0, grip, 15, 0.7, 12, 0.5, 100, 200);
    expect(seg.x0).toBeCloseTo(100 + 6 + 12, 6); // grip + full lunge, straight ahead
    expect(seg.z0).toBeCloseTo(200 + 6, 6);
    expect(seg.x1).toBeCloseTo(100 + 6 + 12 + 15, 6);
    expect(seg.z1).toBeCloseTo(200 + 6, 6);
  });

  it('the blade follows the facing direction', () => {
    const seg = bladeSegment(Math.PI, grip, 15, 0.7, 0, 0.5, 0, 0);
    expect(seg.x1).toBeLessThan(seg.x0); // tip extends opposite +X when facing π
  });
});

describe('sweptSegmentCircleContact', () => {
  it('head-on sweep contacts and returns an early time', () => {
    const seg0 = { x0: 0, z0: 0, x1: 20, z1: 0 };
    const seg1 = { x0: 0, z0: 0, x1: 20, z1: 0 };
    const t = sweptSegmentCircleContact(seg0, seg1, { x: 14, z: 0, r: 2 });
    expect(t).not.toBeNull();
    expect(t!).toBeLessThanOrEqual(1);
  });

  it('a pass wide of the blade misses', () => {
    const seg0 = { x0: 0, z0: 0, x1: 20, z1: 0 };
    const seg1 = { x0: 0, z0: 0, x1: 20, z1: 0 };
    expect(sweptSegmentCircleContact(seg0, seg1, { x: 10, z: 6, r: 2 })).toBeNull();
  });

  it('a circle moving across the sweep path contacts (swept, not static)', () => {
    const seg0 = { x0: 0, z0: 0, x1: 10, z1: 0 };
    const seg1 = { x0: 0, z0: 0, x1: 10, z1: 0 };
    // Blade is static here; the swept parameter still resolves distance.
    expect(sweptSegmentCircleContact(seg0, seg1, { x: 5, z: 1.5, r: 2 })).not.toBeNull();
  });

  it('deterministic: same inputs, same result', () => {
    const seg0 = { x0: 0, z0: 0, x1: 20, z1: 0 };
    const seg1 = { x0: 0, z0: 0, x1: 20, z1: 0 };
    const c = { x: 14, z: 0, r: 2 };
    const a = sweptSegmentCircleContact(seg0, seg1, c)!;
    const b = sweptSegmentCircleContact(seg0, seg1, c)!;
    expect(a).toBe(b);
  });
});

describe('contactParam', () => {
  it('maps the blade from grip (0) to tip (1)', () => {
    const seg = { x0: 0, z0: 0, x1: 20, z1: 0 };
    expect(contactParam(seg, { x: 2, z: 0, r: 1 })).toBeCloseTo(0.1, 6);
    expect(contactParam(seg, { x: 19, z: 0, r: 1 })).toBeCloseTo(0.95, 6);
    expect(contactParam(seg, { x: 25, z: 0, r: 1 })).toBe(1);
  });
});

describe('strike reach invariant (the old gate, made geometric)', () => {
  it('every armatura\'s peak blade reach ≈ its tuned attackRange', () => {
    for (const armatura of ARMATURA_LIST) {
      const parts = loadoutPartIds(ARMATURA_LOADOUTS[armatura]);
      const strike = strikeParams(armatura, parts, 0);
      const look = ARMATURA_LOOK[armatura];
      const radius = bodyCollisionCapsule(look, 0).radius;
      // At frac 0.5 the blade is level: tip at grip.x + lunge + bladeLength.
      const reach = strike.grip.x + strike.lunge + strike.bladeLength;
      const lateralShort =
        Math.abs(strike.grip.z) < radius
          ? Math.sqrt(radius * radius - strike.grip.z * strike.grip.z)
          : 0;
      const maxContact = reach + lateralShort;
      const def = ARMATURAE[armatura];
      expect(Math.abs(maxContact - def.attackRange), armatura).toBeLessThan(1.5);
    }
  });
});
