import type { StageCamera } from './camera';
import type { GlContext } from './context';
import type { FighterDraw } from './drawModel';
import { kitPartsForFighter, type KitPartDraw } from './kitMesh';
import { mat4Identity } from './math';
import {
  createBentBlade,
  createBox,
  createCylinder,
  createFrustum,
  createLathe,
  createSphere,
  createTorus,
  drawMesh,
  type Mesh,
} from './mesh';
import { PALETTE_RGB } from './paletteRgb';
import { createProgram, type GlProgram } from './shader';
import { SOLID_FS, SOLID_VS } from './shaders';
import { tellPose } from './tells';
import { strikeParams } from '../content/strike';
import { lungeOffset, swingAngleRad } from '../content/shapes';
import type { ArmaturaId } from '../content/armatura';

/**
 * Sim facing → world Yaw (rotation about +Y).
 * Sim: facing 0 = +x (east), π/2 = +y; world maps sim (x,y) → (x,z), +Y up.
 * Kit local +X is forward; yaw 0 aligns local +X with world +X.
 */
export function simFacingToYaw(facing: number): number {
  return -facing;
}

const D2R = Math.PI / 180;

/**
 * Parse a geometry cache key back into builder arguments (hundredths encoding,
 * optional one-letter kind prefix for cache namespacing). Pure — shared by the
 * renderer and the tests, so "no invisible geometry" is a testable invariant.
 * Returns null for shared primitives.
 */
export function parseGeometryParams(geo: KitPartDraw['geo']): number[] | null {
  const clean = (s: string): number => Number(s.replace(/^[a-z]/, '')) / 100;
  switch (geo.kind) {
    case 'box':
    case 'cyl':
    case 'sph':
      return null;
    case 'frustum':
      return geo.params.split(':').map(clean);
    case 'lathe':
      return geo.params
        .split(';')
        .map((p) => p.split(',').map(clean))
        .flat();
    case 'bent':
      return geo.params.split(':').map(clean);
    case 'torus':
      return geo.params.split(':').map(clean);
    default:
      return null;
  }
}

/**
 * Kit part world matrix — the ONLY place local→world for parts is defined.
 * Convention (matches the pre-shape pipeline): local +X maps to
 * (cos, 0, −sin) at yaw, i.e. the rotation is Ry(−yaw) in standard terms.
 * M = T(world) · Ry(−(yaw+ry)) · Rz(rz) · S  (column-major, unit 1×1×1).
 */
export function buildKitMatrix(
  x: number,
  y: number,
  z: number,
  yaw: number,
  ox: number,
  oy: number,
  oz: number,
  sx: number,
  sy: number,
  sz: number,
  ry: number,
  rz: number,
  out?: Float32Array,
): Float32Array {
  const m = out ?? new Float32Array(16);
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  const cyaw = Math.cos(yaw + ry * D2R);
  const syaw = Math.sin(yaw + ry * D2R);
  const cr = Math.cos(rz * D2R);
  const sr = Math.sin(rz * D2R);
  // World offset of the local origin after facing yaw.
  const wx = x + c * ox + s * oz;
  const wy = y + oy;
  const wz = z - s * ox + c * oz;
  m[0] = cyaw * cr * sx;
  m[1] = sr * sx;
  m[2] = -syaw * cr * sx;
  m[3] = 0;
  m[4] = -cyaw * sr * sy;
  m[5] = cr * sy;
  m[6] = syaw * sr * sy;
  m[7] = 0;
  m[8] = syaw * sz;
  m[9] = 0;
  m[10] = cyaw * sz;
  m[11] = 0;
  m[12] = wx;
  m[13] = wy;
  m[14] = wz;
  m[15] = 1;
  return m;
}

/** Shared, geometry-cached VAOs — the math is the weapon, and it is cached. */
class GeometryCache {
  private readonly map = new Map<string, Mesh>();
  private readonly shared: Mesh;
  private readonly cyl: Mesh;
  private readonly sph: Mesh;
  private static readonly MAX = 96;

  constructor(private readonly gl: WebGL2RenderingContext) {
    this.shared = createBox(gl, 1, 1, 1);
    this.cyl = createCylinder(gl, 14);
    this.sph = createSphere(gl, 12, 10);
  }

  resolve(geo: KitPartDraw['geo']): Mesh {
    if (geo.kind === 'box' || geo.kind === 'cyl' || geo.kind === 'sph') {
      if (geo.kind === 'cyl') return this.cyl;
      if (geo.kind === 'sph') return this.sph;
      return this.shared;
    }
    const key = `${geo.kind}:${geo.params}`;
    let m = this.map.get(key);
    if (m) return m;
    const params = parseGeometryParams(geo);
    if (!params || params.some((v) => !Number.isFinite(v) || v < 0)) {
      return this.shared; // never draw degenerate geometry
    }
    switch (geo.kind) {
      case 'frustum':
        m = createFrustum(this.gl, params[0]!, params[1]!, params[2]!, params[3]!, params[4]!);
        break;
      case 'lathe': {
        const profile: [number, number][] = [];
        for (let i = 0; i < params.length; i += 2) {
          profile.push([params[i]!, params[i + 1]!]);
        }
        m = createLathe(this.gl, profile);
        break;
      }
      case 'bent':
        m = createBentBlade(this.gl, params[0]!, params[1]!, params[2]!, params[3]!);
        break;
      case 'torus':
        m = createTorus(this.gl, params[0]!, params[1]!);
        break;
      default:
        m = this.shared;
    }
    if (this.map.size >= GeometryCache.MAX) {
      const first = this.map.keys().next().value;
      if (first != null) {
        this.map.get(first)?.dispose();
        this.map.delete(first);
      }
    }
    this.map.set(key, m);
    return m;
  }

  dispose(): void {
    this.shared.dispose();
    this.cyl.dispose();
    this.sph.dispose();
    for (const m of this.map.values()) m.dispose();
    this.map.clear();
  }
}

export class SceneFighters {
  private prog: GlProgram;
  private geo: GeometryCache;
  private model = mat4Identity();
  private disposed = false;

  constructor(private readonly ctx: GlContext) {
    this.prog = createProgram(ctx.gl, SOLID_VS, SOLID_FS);
    this.geo = new GeometryCache(ctx.gl);
  }

  private writeModel(
    gl: WebGL2RenderingContext,
    x: number,
    y: number,
    z: number,
    yaw: number,
    ox: number,
    oy: number,
    oz: number,
    sx: number,
    sy: number,
    sz: number,
    ry: number,
    rz: number,
  ): void {
    // Scratch-reuse the model matrix — no per-part allocation on the hot path.
    const m = buildKitMatrix(x, y, z, yaw, ox, oy, oz, sx, sy, sz, ry, rz, this.model);
    gl.uniformMatrix4fv(this.prog.uniform('u_model'), false, m);
  }

  draw(cam: StageCamera, fighters: readonly FighterDraw[]): void {
    if (this.disposed || this.ctx.lost) return;
    const gl = this.ctx.gl;
    this.prog.use();
    gl.uniformMatrix4fv(this.prog.uniform('u_viewProj'), false, cam.getViewProj());
    gl.uniform3f(this.prog.uniform('u_lightDir'), 0.35, 0.85, 0.25);

    for (const f of fighters) {
      const tell = tellPose(f.alive ? f.intention : 'NONE', f.poiseTier);
      const desat = f.alive ? 0 : 0.7;
      gl.uniform1f(this.prog.uniform('u_desat'), desat);

      const yaw = simFacingToYaw(f.facing);
      const flash = Math.max(0, Math.min(1, f.flash / 10));

      const lean = tell.lean * 0.12;
      const hitch = f.actionPhase === 'WINDUP' && tell.hitch > 0 ? tell.hitch * 0.15 : 0;
      const height = tell.height * (f.alive ? 1 : 0.35);
      const baseY = f.alive ? 0 : -4;

      // Team rim — slightly larger body tint pass; flash boosts rim on impact
      if (f.selected || tell.rim > 0.5 || flash > 0.15) {
        const rim = f.team === 0 ? PALETTE_RGB.ally : PALETTE_RGB.foe;
        const fr = rim[0]! + flash * 0.55;
        const fg = rim[1]! + flash * 0.45;
        const fb = rim[2]! + flash * 0.25;
        gl.uniform3f(this.prog.uniform('u_albedo'), fr, fg, fb);
        this.writeModel(gl, f.x, baseY, f.y, yaw, 0, 0, 0, 18 * (1.08 + flash * 0.06), 24 * height * 1.05, 14 * (1.08 + flash * 0.06), 0, 0);
        drawMesh(gl, this.geo.resolve({ kind: 'cyl', params: '' }));
      }

      // Poise-break ring cue — thin bright hoop at feet
      if (f.poiseBroken && f.alive) {
        gl.uniform3f(this.prog.uniform('u_albedo'), 0.85, 0.75, 0.45);
        this.writeModel(gl, f.x, baseY + 1.5, f.y, yaw, 0, 0, 0, 22, 1.2, 22, 0, 0);
        drawMesh(gl, this.geo.resolve({ kind: 'cyl', params: '' }));
      }

      const parts = kitPartsForFighter(f);
      // The weapon swing IS the collision sweep: same strike params, same
      // curve, same phase fraction. What you see is what hits.
      const WEAPON_KINDS = new Set(['gladius', 'sica', 'trident', 'spear', 'dual', 'scissor']);
      const inActive = f.actionPhase === 'ACTIVE' && f.phaseMax > 0;
      let swing = 0;
      let lunge = 0;
      if (inActive) {
        const base = strikeParams(f.armatura as ArmaturaId, f.parts, f.appearanceSeed);
        const frac = Math.min(1, Math.max(0, f.phaseT / f.phaseMax));
        swing = swingAngleRad(base.arc, frac);
        lunge = lungeOffset(base.lunge, frac);
      }
      for (const p of parts) {
        const ar = Math.min(1, p.albedo[0] + flash * 0.5);
        const ag = Math.min(1, p.albedo[1] + flash * 0.4);
        const ab = Math.min(1, p.albedo[2] + flash * 0.2);
        gl.uniform3f(this.prog.uniform('u_albedo'), ar, ag, ab);
        const phaseReach =
          f.actionPhase === 'ACTIVE' ? 1.15 : f.actionPhase === 'WINDUP' ? 0.9 : 1;
        const isWeapon = WEAPON_KINDS.has(p.kind);
        const ox = p.ox * phaseReach + (isWeapon && inActive ? lunge : 0) + hitch * 4;
        const oy = p.oy * height + lean * 3;
        const oz = p.oz + tell.lateral * 4 + tell.guardOpen * (p.kind.includes('shield') ? -3 : 0);
        // Render convention mirrors the sim swing: ry = −θ (degrees).
        const ry = isWeapon && inActive ? -swing * (180 / Math.PI) : p.ry;
        this.writeModel(
          gl,
          f.x,
          baseY,
          f.y,
          yaw,
          ox,
          oy,
          oz,
          p.sx,
          p.sy * height,
          p.sz,
          ry,
          p.rz,
        );
        drawMesh(gl, this.geo.resolve(p.geo));
      }

      // World meters (selected or always-thin)
      if (f.selected || f.alive) {
        this.drawMeter(gl, cam, f.x, f.y, 28 * height + 6, f.hpRatio, PALETTE_RGB.hp, 0);
        if (f.selected) {
          this.drawMeter(gl, cam, f.x, f.y, 28 * height + 9, f.staminaRatio, PALETTE_RGB.stamina, 0);
          this.drawMeter(gl, cam, f.x, f.y, 28 * height + 12, f.poiseRatio, PALETTE_RGB.poise, 0);
        }
      }
    }
  }

  private drawMeter(
    gl: WebGL2RenderingContext,
    _cam: StageCamera,
    x: number,
    z: number,
    y: number,
    ratio: number,
    rgb: readonly [number, number, number],
    _slot: number,
  ): void {
    const r = Math.max(0, Math.min(1, ratio));
    gl.uniform3f(this.prog.uniform('u_albedo'), 0.12, 0.12, 0.14);
    this.writeModel(gl, x, y, z, 0, 0, 0, 0, 16, 1.2, 2, 0, 0);
    drawMesh(gl, this.geo.resolve({ kind: 'box', params: '' }));
    gl.uniform3f(this.prog.uniform('u_albedo'), rgb[0], rgb[1], rgb[2]);
    this.writeModel(gl, x - 8 * (1 - r), y, z, 0, 0, 0, 0, 16 * r, 1.4, 2.2, 0, 0);
    drawMesh(gl, this.geo.resolve({ kind: 'box', params: '' }));
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.geo.dispose();
    this.prog.dispose();
  }
}
