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

/**
 * A ring of spectator heads for the cavea — ONE mesh holding hundreds of
 * small spheres, with seeded per-head UV jitter so the arena noise texture
 * mottles them into a varied sea of onlookers. A single draw call.
 */
export function createCrowdRing(
  gl: GlHandle,
  innerR: number,
  outerR: number,
  rows = 2,
  segments = 90,
  headSize = 1.6,
  seed = 1,
): Mesh {
  let s = (seed >>> 0) || 7;
  const rnd = (): number => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };

  // Unit-sphere template (slices × stacks).
  const slices = 10;
  const stacks = 6;
  const sPos: number[] = [];
  const sNrm: number[] = [];
  const sIdx: number[] = [];
  for (let i = 0; i <= stacks; i++) {
    const v = i / stacks;
    const phi = v * Math.PI;
    const y = Math.cos(phi) * 0.5;
    const ring = Math.sin(phi) * 0.5;
    for (let j = 0; j <= slices; j++) {
      const theta = (j / slices) * Math.PI * 2;
      sPos.push(Math.cos(theta) * ring, y, Math.sin(theta) * ring);
      sNrm.push(Math.cos(theta) * ring * 2, y * 2, Math.sin(theta) * ring * 2);
    }
  }
  const stride = slices + 1;
  for (let i = 0; i < stacks; i++) {
    for (let j = 0; j < slices; j++) {
      const a = i * stride + j;
      const b = a + stride;
      sIdx.push(a, b, a + 1, a + 1, b, b + 1);
    }
  }
  const templateVerts = sPos.length / 3;

  const pos: number[] = [];
  const nrm: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  for (let row = 0; row < rows; row++) {
    const rFrac = rows === 1 ? 0 : row / (rows - 1);
    const radius = innerR + (outerR - innerR) * rFrac;
    const count = Math.round(segments * (0.75 + rFrac * 0.55));
    for (let i = 0; i < count; i++) {
      const ang = (i / count) * Math.PI * 2 + rnd() * 0.02;
      const jr = (rnd() - 0.5) * (outerR - innerR) * 0.6;
      const x = Math.cos(ang) * (radius + jr);
      const z = Math.sin(ang) * (radius + jr);
      const hs = headSize * (0.8 + rnd() * 0.45);
      const u0 = rnd() * 100;
      const v0 = rnd() * 100;
      for (let k = 0; k < sPos.length; k += 3) {
        pos.push(x + sPos[k]! * hs, sPos[k + 1]! * hs, z + sPos[k + 2]! * hs);
        nrm.push(sNrm[k]!, sNrm[k + 1]!, sNrm[k + 2]!);
        uv.push(u0 + sPos[k]! * 1.4, v0 + sPos[k + 1]! * 1.4);
      }
      const base = pos.length / 3 - templateVerts;
      for (const ix of sIdx) idx.push(base + ix);
    }
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

export function drawMesh(gl: GlHandle, mesh: Mesh): void {
  gl.bindVertexArray(mesh.vao);
  if (mesh.ibo) gl.drawElements(mesh.mode, mesh.count, gl.UNSIGNED_SHORT, 0);
  else gl.drawArrays(mesh.mode, 0, mesh.count);
  gl.bindVertexArray(null);
}

/** Small helpers for building faces with outward normals. */
function quadNormal(
  a: readonly [number, number, number],
  b: readonly [number, number, number],
  c: readonly [number, number, number],
): [number, number, number] {
  const ex = b[0] - a[0];
  const ey = b[1] - a[1];
  const ez = b[2] - a[2];
  const fx = c[0] - a[0];
  const fy = c[1] - a[1];
  const fz = c[2] - a[2];
  let nx = ey * fz - ez * fy;
  let ny = ez * fx - ex * fz;
  let nz = ex * fy - ey * fx;
  const len = Math.hypot(nx, ny, nz);
  if (len < 1e-9) return [0, 1, 0];
  nx /= len;
  ny /= len;
  nz /= len;
  return [nx, ny, nz];
}

function addQuad(
  pos: number[],
  nrm: number[],
  idx: number[],
  a: readonly [number, number, number],
  b: readonly [number, number, number],
  c: readonly [number, number, number],
  d: readonly [number, number, number],
): void {
  const n = quadNormal(a, b, c);
  const base = pos.length / 3;
  for (const p of [a, b, c, d]) {
    pos.push(p[0], p[1], p[2]);
    nrm.push(n[0], n[1], n[2]);
  }
  idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
}

/**
 * Tapered box along +Y: bottom face sx1×sz1 at −sy/2, top face sx2×sz2 at +sy/2.
 * Zero-size caps collapse into a cone apex with valid normals.
 */
export function createFrustum(
  gl: GlHandle,
  sx1: number,
  sy: number,
  sz1: number,
  sx2: number,
  sz2: number,
): Mesh {
  const hy = Math.max(0.001, sy) / 2;
  const h1x = Math.max(0, sx1) / 2;
  const h1z = Math.max(0, sz1) / 2;
  const h2x = Math.max(0, sx2) / 2;
  const h2z = Math.max(0, sz2) / 2;
  const b0: [number, number, number] = [-h1x, -hy, -h1z];
  const b1: [number, number, number] = [h1x, -hy, -h1z];
  const b2: [number, number, number] = [h1x, -hy, h1z];
  const b3: [number, number, number] = [-h1x, -hy, h1z];
  const t0: [number, number, number] = [-h2x, hy, -h2z];
  const t1: [number, number, number] = [h2x, hy, -h2z];
  const t2: [number, number, number] = [h2x, hy, h2z];
  const t3: [number, number, number] = [-h2x, hy, h2z];
  const pos: number[] = [];
  const nrm: number[] = [];
  const idx: number[] = [];
  const eps = 0.01;
  if (h1x > eps && h1z > eps) addQuad(pos, nrm, idx, b0, b2, b1, b3); // bottom, −Y
  if (h2x > eps && h2z > eps) addQuad(pos, nrm, idx, t0, t1, t2, t3); // top, +Y
  addQuad(pos, nrm, idx, b0, t0, t1, b1); // −Z side
  addQuad(pos, nrm, idx, b1, t1, t2, b2); // +X side
  addQuad(pos, nrm, idx, b2, t2, t3, b3); // +Z side
  addQuad(pos, nrm, idx, b3, t3, t0, b0); // −X side
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
 * Surface of revolution about +Y from a [y, radius] profile (ascending y).
 * Smooth normals follow the profile slope — bowl helms, spear heads, aspis.
 */
export function createLathe(
  gl: GlHandle,
  profile: readonly [number, number][],
  segments = 14,
): Mesh {
  const pos: number[] = [];
  const nrm: number[] = [];
  const idx: number[] = [];
  const rows = profile.length;
  // Per-row normal from the profile slope (averaged with neighbours).
  const rowNormals: [number, number][] = [];
  for (let i = 0; i < rows; i++) {
    const [y0, r0] = profile[Math.max(0, i - 1)]!;
    const [y2, r2] = profile[Math.min(rows - 1, i + 1)]!;
    const dy = y2 - y0 || 0.001;
    const dr = r2 - r0;
    const nx = dr / Math.hypot(dy, dr) || 0;
    const ny = -dy / Math.hypot(dy, dr) || 1;
    rowNormals.push([nx, ny]);
  }
  for (let i = 0; i < rows; i++) {
    const [y, r] = profile[i]!;
    for (let j = 0; j <= segments; j++) {
      const th = (j / segments) * Math.PI * 2;
      const c = Math.cos(th);
      const s = Math.sin(th);
      pos.push(c * r, y, s * r);
      const [rnx, rny] = rowNormals[i]!;
      nrm.push(rnx * c, rny, rnx * s);
    }
  }
  const stride = segments + 1;
  for (let i = 0; i < rows - 1; i++) {
    for (let j = 0; j < segments; j++) {
      const a = i * stride + j;
      const b = a + 1;
      const c = b + stride;
      const d = a + stride;
      idx.push(a, b, c, a, c, d);
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

/**
 * Curved, tapered blade in the XZ plane: arcs from +X toward −Z by `curvature`
 * radians, `segments` frustum segments, width×thickness cross-section tapering
 * to ~15% at the tip. The sica hook, scissor curve, curved crests.
 */
export function createBentBlade(
  gl: GlHandle,
  length: number,
  width: number,
  thickness: number,
  curvature: number,
  segments = 3,
): Mesh {
  const pos: number[] = [];
  const nrm: number[] = [];
  const idx: number[] = [];
  const n = Math.max(2, segments);
  const step = 1 / n;
  // Direction sample at segment start/mid/end; integrate position along arc.
  const dir = (t: number): [number, number] => {
    const a = curvature * t;
    return [Math.cos(a), -Math.sin(a)];
  };
  const pts: [number, number][] = [];
  let x = 0;
  let z = 0;
  for (let i = 0; i <= n; i++) {
    pts.push([x, z]);
    if (i < n) {
      const [dx0, dz0] = dir(i * step);
      const [dx1, dz1] = dir((i + 1) * step);
      const dx = (dx0 + dx1) / 2;
      const dz = (dz0 + dz1) / 2;
      x += dx * (length / n);
      z += dz * (length / n);
    }
  }
  for (let i = 0; i < n; i++) {
    const p0 = pts[i]!;
    const p1 = pts[i + 1]!;
    const t0 = i / n;
    const t1 = (i + 1) / n;
    const taper0 = 1 - t0 * 0.85;
    const taper1 = 1 - t1 * 0.85;
    const mid = (t0 + t1) / 2;
    const a = curvature * mid;
    const ux = Math.cos(a);
    const uz = -Math.sin(a);
    const vx = Math.sin(a);
    const vz = Math.cos(a);
    const mx = (p0[0] + p1[0]) / 2;
    const mz = (p0[1] + p1[1]) / 2;
    const w2 = (width * (taper0 + taper1)) / 4;
    const h2 = (thickness * (taper0 + taper1)) / 4;
    const l2 = length / (2 * n);
    const C = (
      u: number,
      v: number,
      w: number,
    ): [number, number, number] => [
      mx + ux * u + vx * v,
      w,
      mz + uz * u + vz * v,
    ];
    const a0 = C(-l2, -w2, -h2);
    const a1 = C(l2, -w2, -h2);
    const a2 = C(l2, w2, -h2);
    const a3 = C(-l2, w2, -h2);
    const b0 = C(-l2, -w2, h2);
    const b1 = C(l2, -w2, h2);
    const b2 = C(l2, w2, h2);
    const b3 = C(-l2, w2, h2);
    addQuad(pos, nrm, idx, a0, a1, a2, a3); // −Y face
    addQuad(pos, nrm, idx, b0, b3, b2, b1); // +Y face
    addQuad(pos, nrm, idx, a0, b0, b1, a1); // −V face
    addQuad(pos, nrm, idx, a1, b1, b2, a2); // +U face
    addQuad(pos, nrm, idx, a2, b2, b3, a3); // +V face
    addQuad(pos, nrm, idx, a3, b3, b0, a0); // −U face
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
 * Torus in the XZ plane: tube between `innerR` and `outerR` around +Y.
 * Shield rims, the retiarius net loop.
 */
export function createTorus(
  gl: GlHandle,
  innerR: number,
  outerR: number,
  segments = 20,
  tubeSegments = 8,
): Mesh {
  const R = (innerR + outerR) / 2;
  const r = Math.max(0.001, (outerR - innerR) / 2);
  const pos: number[] = [];
  const nrm: number[] = [];
  const idx: number[] = [];
  for (let i = 0; i <= segments; i++) {
    const th = (i / segments) * Math.PI * 2;
    const ct = Math.cos(th);
    const st = Math.sin(th);
    for (let j = 0; j <= tubeSegments; j++) {
      const ph = (j / tubeSegments) * Math.PI * 2;
      const cp = Math.cos(ph);
      const sp = Math.sin(ph);
      pos.push(ct * (R + r * cp), r * sp, st * (R + r * cp));
      nrm.push(ct * cp, sp, st * cp);
    }
  }
  const stride = tubeSegments + 1;
  for (let i = 0; i < segments; i++) {
    for (let j = 0; j < tubeSegments; j++) {
      const a = i * stride + j;
      const b = a + 1;
      const c = b + stride;
      const d = a + stride;
      idx.push(a, b, c, a, c, d);
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
