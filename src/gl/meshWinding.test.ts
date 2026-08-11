import { describe, expect, it } from 'vitest';

/** Y component of triangle normal AB × AC (right-hand winding). */
function faceNy(
  ax: number,
  ay: number,
  az: number,
  bx: number,
  by: number,
  bz: number,
  cx: number,
  cy: number,
  cz: number,
): number {
  const abx = bx - ax;
  const abz = bz - az;
  const acx = cx - ax;
  const acz = cz - az;
  // Flat XZ: ny = abz*acx - abx*acz (aby/acy unused when y constant).
  void ay;
  void by;
  void cy;
  return abz * acx - abx * acz;
}

describe('arena mesh winding (+Y front for CULL_FACE)', () => {
  it('disk fan faces +Y', () => {
    const r = 10;
    const a0 = 0;
    const a1 = (Math.PI * 2) / 64;
    const ix = Math.cos(a0) * r;
    const iz = Math.sin(a0) * r;
    const jx = Math.cos(a1) * r;
    const jz = Math.sin(a1) * r;
    // createDisk: center, i+1, i
    expect(faceNy(0, 0, 0, jx, 0, jz, ix, 0, iz)).toBeGreaterThan(0);
  });

  it('ring annulus faces +Y with CCW indices', () => {
    const inner = 10;
    const outer = 12;
    const a0 = 0;
    const a1 = (Math.PI * 2) / 48;
    const i0x = Math.cos(a0) * inner;
    const i0z = Math.sin(a0) * inner;
    const o0x = Math.cos(a0) * outer;
    const o0z = Math.sin(a0) * outer;
    const i1x = Math.cos(a1) * inner;
    const i1z = Math.sin(a1) * inner;
    const o1x = Math.cos(a1) * outer;
    const o1z = Math.sin(a1) * outer;
    // createRing: (inner, nextInner, outer) + (outer, nextInner, nextOuter)
    expect(faceNy(i0x, 0.02, i0z, i1x, 0.02, i1z, o0x, 0.02, o0z)).toBeGreaterThan(0);
    expect(faceNy(o0x, 0.02, o0z, i1x, 0.02, i1z, o1x, 0.02, o1z)).toBeGreaterThan(0);
  });
});
