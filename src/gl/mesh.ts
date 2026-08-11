import type { GlHandle } from './types';

export interface Mesh {
  vao: WebGLVertexArrayObject;
  vbo: WebGLBuffer;
  ibo: WebGLBuffer | null;
  count: number;
  mode: number;
  dispose: () => void;
}

function createMesh(
  gl: GlHandle,
  positions: Float32Array,
  normals: Float32Array | null,
  uvs: Float32Array | null,
  indices: Uint16Array | null,
  mode: number,
): Mesh {
  const vao = gl.createVertexArray()!;
  gl.bindVertexArray(vao);
  const vbo = gl.createBuffer()!;
  const stride = 3 + (normals ? 3 : 0) + (uvs ? 2 : 0);
  const interleaved = new Float32Array((positions.length / 3) * stride);
  const n = positions.length / 3;
  for (let i = 0; i < n; i++) {
    let o = i * stride;
    interleaved[o++] = positions[i * 3]!;
    interleaved[o++] = positions[i * 3 + 1]!;
    interleaved[o++] = positions[i * 3 + 2]!;
    if (normals) {
      interleaved[o++] = normals[i * 3]!;
      interleaved[o++] = normals[i * 3 + 1]!;
      interleaved[o++] = normals[i * 3 + 2]!;
    }
    if (uvs) {
      interleaved[o++] = uvs[i * 2]!;
      interleaved[o++] = uvs[i * 2 + 1]!;
    }
  }
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  gl.bufferData(gl.ARRAY_BUFFER, interleaved, gl.STATIC_DRAW);
  let off = 0;
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 3, gl.FLOAT, false, stride * 4, 0);
  off = 12;
  if (normals) {
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 3, gl.FLOAT, false, stride * 4, off);
    off += 12;
  }
  if (uvs) {
    gl.enableVertexAttribArray(2);
    gl.vertexAttribPointer(2, 2, gl.FLOAT, false, stride * 4, off);
  }
  let ibo: WebGLBuffer | null = null;
  let count = n;
  if (indices) {
    ibo = gl.createBuffer()!;
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);
    count = indices.length;
  }
  gl.bindVertexArray(null);
  return {
    vao,
    vbo,
    ibo,
    count,
    mode,
    dispose() {
      gl.deleteBuffer(vbo);
      if (ibo) gl.deleteBuffer(ibo);
      gl.deleteVertexArray(vao);
    },
  };
}

export function createFullscreenQuad(gl: GlHandle): Mesh {
  const pos = new Float32Array([-1, -1, 0, 1, -1, 0, -1, 1, 0, 1, 1, 0]);
  const uv = new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]);
  return createMesh(gl, pos, null, uv, new Uint16Array([0, 1, 2, 2, 1, 3]), gl.TRIANGLES);
}

/**
 * Flat disk on XZ plane centered at origin, Y=0.
 * Winding MUST face +Y (CCW from above) if CULL_FACE is ever re-enabled.
 */
export function createDisk(gl: GlHandle, radius: number, segments = 64): Mesh {
  const pos: number[] = [0, 0, 0];
  const nrm: number[] = [0, 1, 0];
  const uv: number[] = [0.5, 0.5];
  for (let i = 0; i <= segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    const x = Math.cos(a) * radius;
    const z = Math.sin(a) * radius;
    pos.push(x, 0, z);
    nrm.push(0, 1, 0);
    uv.push(0.5 + x / (2 * radius), 0.5 + z / (2 * radius));
  }
  const idx: number[] = [];
  // CCW from +Y (center → next → current) so BACK cull keeps the top face.
  for (let i = 1; i <= segments; i++) idx.push(0, i + 1, i);
  return createMesh(
    gl,
    new Float32Array(pos),
    new Float32Array(nrm),
    new Float32Array(uv),
    new Uint16Array(idx),
    gl.TRIANGLES,
  );
}

/** Ring annulus on XZ. */
export function createRing(gl: GlHandle, inner: number, outer: number, segments = 64): Mesh {
  const pos: number[] = [];
  const nrm: number[] = [];
  const uv: number[] = [];
  for (let i = 0; i <= segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    const c = Math.cos(a);
    const s = Math.sin(a);
    pos.push(c * inner, 0.02, s * inner, c * outer, 0.02, s * outer);
    nrm.push(0, 1, 0, 0, 1, 0);
    uv.push(i / segments, 0, i / segments, 1);
  }
  // CCW when viewed from +Y so BACK cull keeps the top face with CULL_FACE.
  const idx: number[] = [];
  for (let i = 0; i < segments; i++) {
    const a = i * 2;
    idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
  }
  return createMesh(
    gl,
    new Float32Array(pos),
    new Float32Array(nrm),
    new Float32Array(uv),
    new Uint16Array(idx),
    gl.TRIANGLES,
  );
}

/** Unit box centered at origin (for kit parts). */
export function createBox(gl: GlHandle, sx: number, sy: number, sz: number): Mesh {
  const hx = sx / 2,
    hy = sy / 2,
    hz = sz / 2;
  const p = [
    -hx, -hy, hz, hx, -hy, hz, hx, hy, hz, -hx, hy, hz,
    -hx, -hy, -hz, -hx, hy, -hz, hx, hy, -hz, hx, -hy, -hz,
    -hx, hy, -hz, -hx, hy, hz, hx, hy, hz, hx, hy, -hz,
    -hx, -hy, -hz, hx, -hy, -hz, hx, -hy, hz, -hx, -hy, hz,
    hx, -hy, -hz, hx, hy, -hz, hx, hy, hz, hx, -hy, hz,
    -hx, -hy, -hz, -hx, -hy, hz, -hx, hy, hz, -hx, hy, -hz,
  ];
  const n = [
    0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1,
    0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1,
    0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0,
    0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0,
    1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0,
    -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0,
  ];
  const idx: number[] = [];
  for (let f = 0; f < 6; f++) {
    const o = f * 4;
    idx.push(o, o + 1, o + 2, o, o + 2, o + 3);
  }
  return createMesh(gl, new Float32Array(p), new Float32Array(n), null, new Uint16Array(idx), gl.TRIANGLES);
}

/**
 * Unit cylinder along +Y: diameter 1, height 1, centered at origin.
 * Scale sx/sz → diameters on XZ, sy → height (same contract as createBox).
 */
export function createCylinder(gl: GlHandle, segments = 16): Mesh {
  const r = 0.5;
  const hy = 0.5;
  const pos: number[] = [];
  const nrm: number[] = [];
  const idx: number[] = [];

  // Side wall
  for (let i = 0; i <= segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    const c = Math.cos(a);
    const s = Math.sin(a);
    pos.push(c * r, -hy, s * r, c * r, hy, s * r);
    nrm.push(c, 0, s, c, 0, s);
  }
  for (let i = 0; i < segments; i++) {
    const a = i * 2;
    idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }

  // Caps (fan)
  const topCenter = pos.length / 3;
  pos.push(0, hy, 0);
  nrm.push(0, 1, 0);
  const botCenter = pos.length / 3;
  pos.push(0, -hy, 0);
  nrm.push(0, -1, 0);

  const topRingStart = pos.length / 3;
  for (let i = 0; i <= segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    pos.push(Math.cos(a) * r, hy, Math.sin(a) * r);
    nrm.push(0, 1, 0);
  }
  const botRingStart = pos.length / 3;
  for (let i = 0; i <= segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    pos.push(Math.cos(a) * r, -hy, Math.sin(a) * r);
    nrm.push(0, -1, 0);
  }
  for (let i = 0; i < segments; i++) {
    idx.push(topCenter, topRingStart + i, topRingStart + i + 1);
    idx.push(botCenter, botRingStart + i + 1, botRingStart + i);
  }

  return createMesh(
    gl,
    new Float32Array(pos),
    new Float32Array(nrm),
    null,
    new Uint16Array(idx),
    gl.TRIANGLES,
  );
}

/**
 * Unit sphere diameter 1 (radius 0.5), centered at origin.
 * Non-uniform sx/sy/sz yields an ellipsoid — helm / round shield / body mass.
 */
export function createSphere(gl: GlHandle, slices = 12, stacks = 10): Mesh {
  const r = 0.5;
  const pos: number[] = [];
  const nrm: number[] = [];
  const idx: number[] = [];

  for (let i = 0; i <= stacks; i++) {
    const v = i / stacks;
    const phi = v * Math.PI;
    const y = Math.cos(phi) * r;
    const ring = Math.sin(phi) * r;
    for (let j = 0; j <= slices; j++) {
      const u = j / slices;
      const theta = u * Math.PI * 2;
      const x = Math.cos(theta) * ring;
      const z = Math.sin(theta) * ring;
      pos.push(x, y, z);
      const len = Math.hypot(x, y, z) || 1;
      nrm.push(x / len, y / len, z / len);
    }
  }
  const stride = slices + 1;
  for (let i = 0; i < stacks; i++) {
    for (let j = 0; j < slices; j++) {
      const a = i * stride + j;
      const b = a + stride;
      idx.push(a, b, a + 1, a + 1, b, b + 1);
    }
  }

  return createMesh(
    gl,
    new Float32Array(pos),
    new Float32Array(nrm),
    null,
    new Uint16Array(idx),
    gl.TRIANGLES,
  );
}

export function drawMesh(gl: GlHandle, mesh: Mesh): void {
  gl.bindVertexArray(mesh.vao);
  if (mesh.ibo) gl.drawElements(mesh.mode, mesh.count, gl.UNSIGNED_SHORT, 0);
  else gl.drawArrays(mesh.mode, 0, mesh.count);
  gl.bindVertexArray(null);
}
