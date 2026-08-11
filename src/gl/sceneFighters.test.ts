import { describe, expect, it } from 'vitest';
import { simFacingToYaw } from './sceneFighters';

describe('simFacingToYaw', () => {
  /** Local +X after Ry(yaw): world (cos(yaw), 0, -sin(yaw)). */
  function forwardXZ(yaw: number): { x: number; z: number } {
    return { x: Math.cos(yaw), z: -Math.sin(yaw) };
  }

  it('facing 0 (east / +x) aims world +X', () => {
    const f = forwardXZ(simFacingToYaw(0));
    expect(f.x).toBeCloseTo(1, 6);
    expect(f.z).toBeCloseTo(0, 6);
  });

  it('facing π (west) aims world −X — 1v1 opponents face each other', () => {
    const f = forwardXZ(simFacingToYaw(Math.PI));
    expect(f.x).toBeCloseTo(-1, 6);
    expect(f.z).toBeCloseTo(0, 6);
  });

  it('facing π/2 (sim +y) aims world +Z', () => {
    const f = forwardXZ(simFacingToYaw(Math.PI / 2));
    expect(f.x).toBeCloseTo(0, 6);
    expect(f.z).toBeCloseTo(1, 6);
  });

  it('does not add a spurious quarter-turn', () => {
    expect(simFacingToYaw(0)).toBeCloseTo(0, 6);
    expect(simFacingToYaw(Math.PI / 2)).toBeCloseTo(-Math.PI / 2, 6);
  });
});
