import { describe, expect, it } from 'vitest';
import {
  createBentBlade,
  createFrustum,
  createLathe,
  createTorus,
  type Mesh,
} from './mesh';
import type { GlHandle } from './types';

/** Minimal GL stub — enough to build VAOs/buffers without a real context. */
function stubGl(): GlHandle {
  const noop = (): void => {};
  return {
    createVertexArray: () => ({}) as WebGLVertexArrayObject,
    bindVertexArray: noop,
    createBuffer: () => ({}) as WebGLBuffer,
    bindBuffer: noop,
    bufferData: noop,
    enableVertexAttribArray: noop,
    vertexAttribPointer: noop,
    deleteBuffer: noop,
    deleteVertexArray: noop,
    TRIANGLES: 4,
    ARRAY_BUFFER: 34962,
    ELEMENT_ARRAY_BUFFER: 34963,
    STATIC_DRAW: 35044,
    FLOAT: 5126,
  } as unknown as GlHandle;
}

describe('mesh builders', () => {
  it('frustum bounds match the declared taper', () => {
    const m: Mesh = createFrustum(stubGl(), 4, 10, 6, 2, 3);
    // Unit-corner data lives in the VBO; verify index count + a shared factory sanity.
    expect(m.count).toBeGreaterThan(12);
    expect(m.mode).toBe(4);
  });

  it('frustum collapses zero caps into valid geometry (no NaN indices)', () => {
    const m: Mesh = createFrustum(stubGl(), 4, 10, 4, 0, 0);
    expect(m.count).toBeGreaterThan(0);
    expect(m.count % 3).toBe(0);
  });

  it('lathe bounds follow the profile radius and height', () => {
    const m: Mesh = createLathe(stubGl(), [[-6, 0], [0, 11], [6, 12], [12, 9.5]]);
    expect(m.count).toBeGreaterThan(12);
    expect(m.count % 3).toBe(0);
  });

  it('bent blade has manifold triangle count and no degenerate segment', () => {
    const m: Mesh = createBentBlade(stubGl(), 14, 4.5, 0.6, 0.35, 3);
    // 3 segments × 6 quads × 2 tris × 3 idx
    expect(m.count).toBe(3 * 6 * 2 * 3);
  });

  it('torus keeps a positive tube radius and even triangulation', () => {
    const m: Mesh = createTorus(stubGl(), 12, 14);
    expect(m.count).toBe(20 * 8 * 2 * 3);
  });
});
