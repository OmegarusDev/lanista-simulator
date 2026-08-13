import { describe, expect, it } from 'vitest';
import { buildKitMatrix, simFacingToYaw } from './sceneFighters';

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

describe('buildKitMatrix (render === hitbox convention)', () => {
  /** Transform a local vector by the column-major matrix. */
  function apply(m: Float32Array, v: [number, number, number]): [number, number, number] {
    return [
      m[0] * v[0] + m[4] * v[1] + m[8] * v[2] + m[12],
      m[1] * v[0] + m[5] * v[1] + m[9] * v[2] + m[13],
      m[2] * v[0] + m[6] * v[1] + m[10] * v[2] + m[14],
    ];
  }

  it('matches the original convention: local +X → (cos, 0, −sin) at yaw', () => {
    const yaw = 0.7;
    const m = buildKitMatrix(100, 0, 200, yaw, 0, 0, 0, 1, 1, 1, 0, 0);
    const fwd = apply(m, [1, 0, 0]);
    expect(fwd[0]).toBeCloseTo(100 + Math.cos(yaw), 6);
    expect(fwd[1]).toBeCloseTo(0, 6);
    expect(fwd[2]).toBeCloseTo(200 - Math.sin(yaw), 6);
  });

  it('blade roll (rz = −90) aims the blade axis (+Y) along forward +X', () => {
    const m = buildKitMatrix(0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 0, -90);
    const tip = apply(m, [0, 1, 0]); // half-length direction
    expect(tip[0]).toBeCloseTo(1, 6);
    expect(tip[1]).toBeCloseTo(0, 6);
    expect(tip[2]).toBeCloseTo(0, 6);
  });

  it('shield rim roll (rz = 90) lifts the torus plane into the vertical', () => {
    const m = buildKitMatrix(0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 0, 90);
    const axisA = apply(m, [1, 0, 0]); // torus in-plane axis
    const axisB = apply(m, [0, 0, 1]);
    // Ring plane spans Y (vertical) and the horizontal facing plane.
    expect(Math.abs(axisA[1])).toBeCloseTo(1, 6);
    expect(Math.abs(axisB[1])).toBeCloseTo(0, 6);
    expect(Math.abs(axisB[2])).toBeCloseTo(1, 6);
  });

  it('local yaw ry rotates the part about the world Y (weapon swings)', () => {
    const yaw = 0;
    const swing = buildKitMatrix(0, 0, 0, yaw, 0, 0, 0, 1, 1, 1, 0.4, -90);
    const still = buildKitMatrix(0, 0, 0, yaw, 0, 0, 0, 1, 1, 1, 0, -90);
    const tSwing = apply(swing, [0, 1, 0]);
    const tStill = apply(still, [0, 1, 0]);
    // Swing rotates the blade tip around Y (horizontal direction changes).
    expect(Math.hypot(tSwing[0], tSwing[2])).toBeCloseTo(1, 6);
    expect(tSwing[0]).not.toBeCloseTo(tStill[0], 6);
  });

  it('offsets compose with facing (weapons hold their grip position)', () => {
    const yaw = 0;
    const m = buildKitMatrix(10, 5, 20, yaw, 7, 13, 3, 1, 1, 1, 0, 0);
    const p = apply(m, [0, 0, 0]);
    expect(p[0]).toBeCloseTo(17, 6);
    expect(p[1]).toBeCloseTo(18, 6);
    expect(p[2]).toBeCloseTo(23, 6);
  });
});
