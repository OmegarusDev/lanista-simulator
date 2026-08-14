import type { StageCamera } from './camera';
import type { GlContext } from './context';
import type { FighterDraw } from './drawModel';
import { kitPartsForFighter, type KitPartDraw } from './kitMesh';
import {
  aimAngles,
  beastDims,
  fallPose,
  poseHuman,
  poseQuadruped,
  type Bone,
  type HumanPose,
  type QuadrupedDims,
  type QuadrupedPose,
  type Vec3,
} from './anatomy';
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
import { beastBulk, bodyBulk, lungeOffset, swingAngleRad } from '../content/shapes';
import { ARMATURA_LOOK, fightStyleOf } from '../content/appearance';
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

/** Held parts a fallen fighter drops — they would hover above the body. */
const DEAD_DROPPED = new Set([
  'helm',
  'crest',
  'shield',
  'roundShield',
  'shieldRim',
  'shieldBoss',
  'gladius',
  'sica',
  'trident',
  'spear',
  'dual',
  'scissor',
  'net',
]);

/** Parts that surge with the beast's lunge (body parts, not planted legs). */
const BEAST_SURGE = new Set([
  'beastBody',
  'quadNeck',
  'quadHead',
  'mane',
  'tusk',
  'ear',
  'spot',
  'tailTuft',
]);

interface AnatResult {
  ox: number;
  oy: number;
  oz: number;
  sx: number;
  sy: number;
  sz: number;
  ry: number;
  rz: number;
}

interface PoseCtx {
  isBeast: boolean;
  bulk: number;
  family: string;
  height: number;
  lean: number;
  guarding: number;
  bob: number;
  sway: number;
  guardBreathe: number;
  dims?: QuadrupedDims;
}

function boneResult(bone: Bone): AnatResult {
  const d = {
    x: bone.to.x - bone.from.x,
    y: bone.to.y - bone.from.y,
    z: bone.to.z - bone.from.z,
  };
  const l = Math.hypot(d.x, d.y, d.z) || 1;
  const a = aimAngles(d);
  return {
    ox: (bone.from.x + bone.to.x) / 2,
    oy: (bone.from.y + bone.to.y) / 2,
    oz: (bone.from.z + bone.to.z) / 2,
    sx: bone.thick * 0.5,
    sy: l,
    sz: bone.thick * 0.5,
    ry: a.ry,
    rz: a.rz,
  };
}

function sphereResult(pt: Vec3, r: number): AnatResult {
  return { ox: pt.x, oy: pt.y, oz: pt.z, sx: r, sy: r, sz: r, ry: 0, rz: 0 };
}

/** Tell squash + movement lean for the body chain (legs keep ground contact). */
function squash(pt: Vec3, ctx: PoseCtx): Vec3 {
  return {
    x: pt.x + ctx.lean * Math.max(0, pt.y - 8.5 * ctx.bulk) * 0.35 + ctx.sway,
    y: pt.y * ctx.height + ctx.bob,
    z: pt.z,
  };
}

function headDir(pose: QuadrupedPose): Vec3 {
  const d = {
    x: pose.neck.to.x - pose.neck.from.x,
    y: pose.neck.to.y - pose.neck.from.y,
    z: 0,
  };
  const l = Math.hypot(d.x, d.y) || 1;
  return { x: d.x / l, y: d.y / l, z: 0 };
}

/**
 * Anatomy pose override — the skeleton takes over the part's transform.
 * Returns null for parts the kit poses itself (weapons, shields anchored
 * elsewhere, static spots).
 */
function anatomyTransform(
  p: KitPartDraw,
  pose: HumanPose | QuadrupedPose,
  ctx: PoseCtx,
): AnatResult | null {
  if (ctx.isBeast) {
    const q = pose as QuadrupedPose;
    const dims = ctx.dims!;
    const leg = (s: number) => q.legs.find((l) => l.side === s)!;
    switch (p.kind) {
      case 'beastBody':
        return boneResult(q.torso);
      case 'quadNeck':
        return boneResult(q.neck);
      case 'quadHead':
        return sphereResult(q.head, dims.headSize * 0.55);
      case 'quadTail':
        return boneResult(q.tail);
      case 'quadLegUpper':
        return boneResult(leg(p.side ?? 1).upper);
      case 'quadLegLower':
        return boneResult(leg(p.side ?? 1).lower);
      case 'quadPaw': {
        const end = leg(p.side ?? 1).end;
        return {
          ox: end.x,
          oy: end.y,
          oz: end.z,
          sx: 2.4 * ctx.bulk,
          sy: 1.3 * ctx.bulk,
          sz: 2.8 * ctx.bulk,
          ry: 0,
          rz: 0,
        };
      }
      case 'mane': {
        const n = 10;
        const i = Math.round(p.oz);
        const ang = (i / n) * Math.PI * 2;
        const mid = {
          x: (q.neck.from.x + q.neck.to.x) / 2,
          y: (q.neck.from.y + q.neck.to.y) / 2,
          z: 0,
        };
        const r = dims.headSize * 1.0;
        const radial = { x: Math.sin(ang), z: Math.cos(ang) };
        const a = aimAngles({ x: radial.x, y: 0.45, z: radial.z });
        return {
          ox: mid.x + radial.x * r,
          oy: mid.y,
          oz: radial.z * r,
          sx: dims.headSize * 0.55,
          sy: dims.headSize * 1.15,
          sz: dims.headSize * 0.55,
          ry: a.ry,
          rz: a.rz,
        };
      }
      case 'tusk': {
        const side = p.oz > 0 ? 1 : -1;
        const dir = headDir(q);
        const hs = dims.headSize;
        const a = aimAngles({ x: dir.x, y: dir.y - 0.35, z: 0 });
        return {
          ox: q.head.x + dir.x * 0.55 * hs,
          oy: q.head.y + dir.y * 0.55 * hs - 0.15 * hs,
          oz: side * 0.42 * hs,
          sx: hs * 0.32,
          sy: hs * 0.9,
          sz: hs * 0.32,
          ry: a.ry,
          rz: a.rz,
        };
      }
      case 'ear': {
        if (ctx.family !== 'BEAR') return null; // the boar's ridge stays put
        const side = p.oz > 0 ? 1 : -1;
        const dir = headDir(q);
        const hs = dims.headSize;
        return sphereResult(
          {
            x: q.head.x + dir.x * 0.3 * hs,
            y: q.head.y + dir.y * 0.3 * hs + 0.5 * hs,
            z: side * 0.62 * hs,
          },
          1.1 * ctx.bulk,
        );
      }
      case 'tailTuft':
        return sphereResult(q.tail.to, 1.6 * ctx.bulk);
      default:
        return null; // spots ride the torso; kit-pose keeps them
    }
  }

  const h = pose as HumanPose;
  const sq = (pt: Vec3): Vec3 => squash(pt, ctx);
  const armOf = (s: -1 | 1) => h.arms.find((a) => a.side === s)!;
  const legOf = (s: -1 | 1) => h.legs.find((l) => l.side === s)!;
  switch (p.kind) {
    case 'hips':
      return sphereResult(sq(h.hips), 5 * ctx.bulk);
    case 'body':
      return boneResult({ from: sq(h.torso.from), to: sq(h.torso.to), thick: h.torso.thick });
    case 'neck':
      return boneResult({ from: sq(h.neck.from), to: sq(h.neck.to), thick: h.neck.thick });
    case 'head':
      return sphereResult(sq(h.head), 3.2 * ctx.bulk);
    case 'armUpper':
      return boneResult({ from: sq(armOf(p.side ?? 1).upper.from), to: sq(armOf(p.side ?? 1).upper.to), thick: 3.2 * ctx.bulk });
    case 'armLower':
      return boneResult({ from: sq(armOf(p.side ?? 1).lower.from), to: sq(armOf(p.side ?? 1).lower.to), thick: 2.6 * ctx.bulk });
    case 'hand':
      return sphereResult(sq(armOf(p.side ?? 1).end), 1.5 * ctx.bulk);
    case 'legUpper':
      return boneResult(legOf(p.side ?? 1).upper);
    case 'legLower':
      return boneResult(legOf(p.side ?? 1).lower);
    case 'foot': {
      const end = legOf(p.side ?? 1).end;
      return {
        ox: end.x + 1.4 * ctx.bulk,
        oy: end.y,
        oz: end.z,
        sx: 3.4 * ctx.bulk,
        sy: 1.4 * ctx.bulk,
        sz: 2.6 * ctx.bulk,
        ry: 0,
        rz: 0,
      };
    }
    case 'helm':
      return {
        ox: p.ox,
        oy: sq(h.head).y + (p.oy - 24 * ctx.bulk),
        oz: p.oz,
        sx: p.sx,
        sy: p.sy,
        sz: p.sz,
        ry: p.ry,
        rz: p.rz,
      };
    case 'crest':
      return {
        ox: p.ox,
        oy: sq(h.head).y + (p.oy - 24 * ctx.bulk),
        oz: p.oz,
        sx: p.sx,
        sy: p.sy,
        sz: p.sz,
        ry: p.ry,
        rz: p.rz,
      };
    case 'greaves':
      return boneResult({
        from: legOf(p.side ?? 1).lower.from,
        to: legOf(p.side ?? 1).lower.to,
        thick: 5.5 * ctx.bulk,
      });
    case 'manica':
      return boneResult({
        from: armOf(1).upper.from,
        to: armOf(1).upper.to,
        thick: 5 * ctx.bulk,
      });
    case 'breastplate': {
      const mid = {
        x: (h.torso.from.x + h.torso.to.x) / 2,
        y: (h.torso.from.y + h.torso.to.y) / 2,
      };
      return {
        ox: mid.x + 4.5 * ctx.bulk,
        oy: mid.y * ctx.height + ctx.bob,
        oz: 0,
        sx: p.sx,
        sy: p.sy,
        sz: p.sz,
        ry: 0,
        rz: 0,
      };
    }
    case 'shield':
    case 'roundShield':
    case 'shieldRim':
    case 'shieldBoss': {
      const off = armOf(-1);
      const raise = ctx.guarding > 0.2 ? 1 : 0;
      return {
        ox: off.end.x + 3,
        oy: off.end.y + raise * 2,
        oz: off.end.z,
        sx: p.sx,
        sy: p.sy,
        sz: p.sz,
        ry: 0,
        rz: p.rz + raise * -16,
      };
    }
    case 'net': {
      const off = armOf(-1);
      return {
        ox: off.end.x,
        oy: off.end.y - 1.5,
        oz: off.end.z,
        sx: p.sx,
        sy: p.sy,
        sz: p.sz,
        ry: 0,
        rz: 0,
      };
    }
    default:
      return null;
  }
}

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
  /** Per-fighter locomotion state — shuffle step + smoothed movement lean. */
  private readonly stepState = new Map<
    number,
    { step: number; lean: number; prevX: number; prevY: number; t: number }
  >();

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
      const teamTint = f.team === 0 ? PALETTE_RGB.ally : PALETTE_RGB.foe;

      const lean = tell.lean * 0.12;
      const hitch = f.actionPhase === 'WINDUP' && tell.hitch > 0 ? tell.hitch * 0.15 : 0;
      const height = tell.height * (f.alive ? 1 : 0.35);
      const baseY = !f.alive && f.kind === 'beast' ? -4 : 0;

      // Selection hoop — a flat team marker on the sand, never a solid shell
      // that clips the body.
      if (f.selected) {
        gl.uniform1f(this.prog.uniform('u_alpha'), 0.9);
        gl.uniform3f(this.prog.uniform('u_albedo'), teamTint[0], teamTint[1], teamTint[2]);
        this.writeModel(gl, f.x, baseY + 1.4, f.y, yaw, 0, 0, 0, 21, 1.1, 21, 0, 0);
        drawMesh(gl, this.geo.resolve({ kind: 'cyl', params: '' }));
      }

      // Hit aura — a translucent additive shell around the body. It glows
      // THROUGH the fighter (no depth write), so it can never clip the mesh —
      // an effect, not a shape, and it stays correct no matter how the body
      // is rebuilt.
      if (tell.rim > 0.5 || flash > 0.15) {
        gl.uniform1f(this.prog.uniform('u_alpha'), 0.3 + flash * 0.35);
        const aura = Math.min(1, 0.45 + flash * 0.5);
        gl.uniform3f(
          this.prog.uniform('u_albedo'),
          teamTint[0] * aura + flash * 0.55,
          teamTint[1] * aura + flash * 0.45,
          teamTint[2] * aura + flash * 0.25,
        );
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
        gl.depthMask(false);
        this.writeModel(gl, f.x, baseY, f.y, yaw, 0, 0, 0, 20 * (1.06 + flash * 0.05), 25 * height * 1.06, 16 * (1.06 + flash * 0.05), 0, 0);
        drawMesh(gl, this.geo.resolve({ kind: 'cyl', params: '' }));
        gl.depthMask(true);
        gl.disable(gl.BLEND);
      }

      // Poise-break ring cue — thin bright hoop at feet
      if (f.poiseBroken && f.alive) {
        gl.uniform1f(this.prog.uniform('u_alpha'), 1);
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
      let lungeUnits = 0;
      let frac = 0;
      if (inActive) {
        // Beasts strike with their body: no swing, just the surge.
        const base = strikeParams(
          f.armatura as ArmaturaId,
          f.parts,
          f.appearanceSeed,
          f.kind === 'beast' ? 'beast' : 'gladiator',
        );
        frac = Math.min(1, Math.max(0, f.phaseT / f.phaseMax));
        // The sim's effective arc (circling bonus included) is the ONE number.
        swing = swingAngleRad(f.strikeArc ?? base.arc, frac);
        lunge = lungeOffset(base.lunge, frac);
        lungeUnits = base.lunge;
      }

      // Locomotion: shuffle step + smoothed movement lean — the fighters
      // shuffle and sway instead of gliding.
      const style = fightStyleOf(f.armatura as ArmaturaId);
      let st = this.stepState.get(f.id);
      if (!st) {
        st = { step: 0, lean: 0, prevX: f.x, prevY: f.y, t: 0 };
        this.stepState.set(f.id, st);
      }
      st.t++;
      const dxm = f.x - st.prevX;
      const dym = f.y - st.prevY;
      st.prevX = f.x;
      st.prevY = f.y;
      const speed = Math.hypot(dxm, dym);
      st.step += speed * 0.055;
      if (speed < 0.4) st.step *= 0.92; // settle into a rest stance
      const moveK = Math.min(1, speed * 0.22);
      const shuffle = Math.sin(st.step) * style.shuffle * 1.5 * moveK;
      st.lean += (speed * 0.012 - st.lean) * 0.25;
      const moveLean = st.lean;

      // --- Procedural anatomy: the skeleton poses from state, never glides.
      // Hands reach the grips via IK, feet plant on the stride, beasts trot.
      const isBeastKind = f.kind === 'beast';
      const bulk = isBeastKind
        ? beastBulk(f.beastId ?? 'LION', f.appearanceSeed)
        : bodyBulk(f.appearanceSeed);
      const ctx: PoseCtx = {
        isBeast: isBeastKind,
        bulk,
        family: isBeastKind ? (f.beastId ?? 'LION') : 'HUMAN',
        height,
        lean: moveLean,
        guarding: f.guarding || tell.guardOpen > 0.3 ? 1 : 0,
        guardBreathe: (Math.sin(st.t * 0.04) + 1) / 2 * 0.35,
        bob:
          Math.sin(st.step * 2) * 0.35 * moveK +
          Math.sin(st.t * 0.05) * 0.18 * (1 - Math.min(1, moveK * 5)),
        sway: Math.sin(st.t * 0.045) * 0.9 * (1 - Math.min(1, moveK * 5)),
      };
      let pose: HumanPose | QuadrupedPose;
      if (isBeastKind) {
        ctx.dims = beastDims(f.beastId ?? 'LION', bulk);
        pose = poseQuadruped(f.beastId ?? 'LION', ctx.dims, st.step, moveK);
      } else {
        const look = ARMATURA_LOOK[f.armatura as ArmaturaId] ?? ARMATURA_LOOK.MURMILLO;
        const gripLunge = inActive ? lunge * 0.5 : 0;
        const offLunge = inActive ? lungeOffset(lungeUnits, (frac + 0.5) % 1) * 0.5 : 0;
        pose = poseHuman({
          bulk,
          stepPhase: st.step,
          speed: moveK,
          guard: Math.max(ctx.guarding, ctx.guardBreathe),
          mainGrip: {
            x: Math.cos(look.mainHandAngle) * look.mainHandDist + gripLunge,
            y: 13,
            z: Math.sin(look.mainHandAngle) * look.mainHandDist,
          },
          offGrip: {
            x: Math.cos(look.offHandAngle) * look.offHandDist + offLunge,
            y: 12,
            z: Math.sin(look.offHandAngle) * look.offHandDist,
          },
        });
      }
      if (!f.alive) pose = fallPose(pose as HumanPose);

      for (const p of parts) {
        if (!f.alive && DEAD_DROPPED.has(p.kind)) continue; // the fallen let go
        // Team livery: every blue unit is a shade of blue, every red unit a
        // shade of red — identity by shape, allegiance by color. Shields are
        // fully painted; cloth/leather carry a strong tint, metal a light one.
        const tint =
          p.teamPaint ? 0.85
          : p.material === 'cloth' ? 0.5
          : p.material === 'leather' ? 0.4
          : p.material === 'metal' ? 0.28
          : 0.12;
        const ar = Math.min(1, p.albedo[0] * (1 - tint) + teamTint[0] * tint + flash * 0.5);
        const ag = Math.min(1, p.albedo[1] * (1 - tint) + teamTint[1] * tint + flash * 0.4);
        const ab = Math.min(1, p.albedo[2] * (1 - tint) + teamTint[2] * tint + flash * 0.2);
        gl.uniform1f(this.prog.uniform('u_alpha'), 1);
        gl.uniform3f(this.prog.uniform('u_albedo'), ar, ag, ab);
        const phaseReach =
          f.actionPhase === 'ACTIVE' ? 1.15 : f.actionPhase === 'WINDUP' ? 0.9 : 1;
        const isWeapon = WEAPON_KINDS.has(p.kind);
        const surge = BEAST_SURGE.has(p.kind);
        // Independent hands: the off-hand weapon strikes on the return stroke —
        // its OWN lunge and swing, so the two daggers work in alternation.
        let partSwing = p.ry;
        let partLunge = lunge;
        if (isWeapon && inActive) {
          const off = p.hand === 'off';
          if (off) {
            const offFrac = (frac + 0.5) % 1;
            partSwing = -swingAngleRad(f.strikeArc ?? 0, offFrac) * (180 / Math.PI);
            partLunge = lungeOffset(lungeUnits, offFrac);
          } else {
            partSwing = -swing * (180 / Math.PI);
          }
        }
        // The skeleton poses the anatomy; everything else uses the kit pose.
        const anat = anatomyTransform(p, pose, ctx);
        let ox: number;
        let oy: number;
        let oz: number;
        let sy = p.sy * height;
        let ry: number;
        let rz: number;
        if (anat) {
          ox = anat.ox + (inActive && surge ? partLunge : 0) + hitch * 4;
          oy = anat.oy;
          oz = anat.oz;
          sy = anat.sy;
          ry = anat.ry;
          rz = anat.rz;
          this.writeModel(
            gl, f.x, baseY, f.y, yaw,
            ox, oy, oz, anat.sx, sy, anat.sz, ry, rz,
          );
          drawMesh(gl, this.geo.resolve(p.geo));
          continue;
        }
        ox = p.ox * phaseReach + (inActive && (isWeapon || surge) ? partLunge : 0) + hitch * 4;
        oy = p.oy * height + lean * 3 + shuffle * 0.4 + moveLean * 14 * height;
        oz = p.oz + tell.lateral * 4 + tell.guardOpen * (p.kind.includes('shield') ? -3 : 0);
        // Guarded off-hand raises to meet the threat: shields lift and tilt
        // up around their rim (the rim itself stays planted).
        const isOffShield =
          p.hand === 'off' && (p.kind === 'shield' || p.kind === 'roundShield' || p.kind === 'shieldBoss');
        const guardRaise = f.guarding || tell.guardOpen > 0.3 ? 1 : 0;
        ry = isOffShield ? 0 : partSwing;
        rz = isOffShield ? p.rz + guardRaise * -16 : p.rz;
        this.writeModel(
          gl,
          f.x,
          baseY,
          f.y,
          yaw,
          ox,
          isOffShield ? oy + guardRaise * 3 : oy,
          oz,
          p.sx,
          sy,
          p.sz,
          ry,
          rz,
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
