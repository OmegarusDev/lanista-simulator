import { colors } from '../content/palette';
import type { StageCamera } from './camera';
import type { GlContext } from './context';
import type { FighterDraw } from './drawModel';
import { kitPartsForFighter, type PartMeshKind } from './kitMesh';
import { mat4Identity, hexToRgb } from './math';
import { createBox, createCylinder, createSphere, drawMesh, type Mesh } from './mesh';
import { createProgram, type GlProgram } from './shader';
import { SOLID_FS, SOLID_VS } from './shaders';
import { tellPose } from './tells';

/**
 * Sim facing → world Yaw (rotation about +Y).
 * Sim: facing 0 = +x (east), π/2 = +y; world maps sim (x,y) → (x,z), +Y up.
 * Kit local +X is forward; yaw 0 aligns local +X with world +X.
 */
export function simFacingToYaw(facing: number): number {
  return -facing;
}

function meshForKind(kind: PartMeshKind, box: Mesh, cyl: Mesh, sph: Mesh): Mesh {
  switch (kind) {
    case 'body':
    case 'beastBody':
      return cyl;
    case 'helm':
    case 'roundShield':
    case 'shield':
    case 'net':
      return sph;
    default:
      // Blades / crest / polearms stay boxy so silhouette reads as gear, not soft mass.
      return box;
  }
}

export class SceneFighters {
  private prog: GlProgram;
  private box: Mesh;
  private cyl: Mesh;
  private sph: Mesh;
  private model = mat4Identity();
  private disposed = false;

  constructor(private readonly ctx: GlContext) {
    this.prog = createProgram(ctx.gl, SOLID_VS, SOLID_FS);
    this.box = createBox(ctx.gl, 1, 1, 1);
    this.cyl = createCylinder(ctx.gl, 14);
    this.sph = createSphere(ctx.gl, 12, 10);
  }

  private writeModel(
    gl: WebGL2RenderingContext,
    x: number,
    y: number,
    z: number,
    yaw: number,
    sx: number,
    sy: number,
    sz: number,
    ox: number,
    oy: number,
    oz: number,
  ): void {
    const m = this.model;
    mat4Identity(m);
    const c = Math.cos(yaw);
    const s = Math.sin(yaw);
    // Column-major Ry(yaw) * S. Local +X → world (cos, 0, -sin).
    m[0] = c * sx;
    m[2] = -s * sx;
    m[5] = sy;
    m[8] = s * sz;
    m[10] = c * sz;
    const lx = ox;
    const ly = oy;
    const lz = oz;
    m[12] = x + c * lx + s * lz;
    m[13] = y + ly;
    m[14] = z - s * lx + c * lz;
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

      const lean = tell.lean * 0.12;
      const hitch = f.actionPhase === 'WINDUP' && tell.hitch > 0 ? tell.hitch * 0.15 : 0;
      const height = tell.height * (f.alive ? 1 : 0.35);
      const baseY = f.alive ? 0 : -4;

      // Team rim — slightly larger body tint pass
      if (f.selected || tell.rim > 0.5) {
        const rim = hexToRgb(f.team === 0 ? colors.ally : colors.foe);
        gl.uniform3f(this.prog.uniform('u_albedo'), rim[0], rim[1], rim[2]);
        this.writeModel(gl, f.x, baseY, f.y, yaw, 18 * 1.08, 24 * height * 1.05, 14 * 1.08, 0, 0, 0);
        drawMesh(gl, this.cyl);
      }

      const parts = kitPartsForFighter(f);
      for (const p of parts) {
        gl.uniform3f(this.prog.uniform('u_albedo'), p.albedo[0], p.albedo[1], p.albedo[2]);
        const phaseReach =
          f.actionPhase === 'ACTIVE' ? 1.15 : f.actionPhase === 'WINDUP' ? 0.9 : 1;
        const ox = p.ox * phaseReach + hitch * 4;
        const oy = p.oy * height + lean * 3;
        const oz = p.oz + tell.lateral * 4 + tell.guardOpen * (p.kind.includes('shield') ? -3 : 0);
        this.writeModel(gl, f.x, baseY, f.y, yaw, p.sx, p.sy * height, p.sz, ox, oy, oz);
        drawMesh(gl, meshForKind(p.kind, this.box, this.cyl, this.sph));
      }

      // World meters (selected or always-thin)
      if (f.selected || f.alive) {
        this.drawMeter(gl, cam, f.x, f.y, 28 * height + 6, f.hpRatio, hexToRgb(colors.hp), 0);
        if (f.selected) {
          this.drawMeter(gl, cam, f.x, f.y, 28 * height + 9, f.staminaRatio, hexToRgb(colors.stamina), 0);
          this.drawMeter(gl, cam, f.x, f.y, 28 * height + 12, f.poiseRatio, hexToRgb(colors.poise), 0);
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
    rgb: [number, number, number],
    _slot: number,
  ): void {
    const r = Math.max(0, Math.min(1, ratio));
    gl.uniform3f(this.prog.uniform('u_albedo'), 0.12, 0.12, 0.14);
    this.writeModel(gl, x, y, z, 0, 16, 1.2, 2, 0, 0, 0);
    drawMesh(gl, this.box);
    gl.uniform3f(this.prog.uniform('u_albedo'), rgb[0], rgb[1], rgb[2]);
    this.writeModel(gl, x - 8 * (1 - r), y, z, 0, 16 * r, 1.4, 2.2, 0, 0, 0);
    drawMesh(gl, this.box);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.box.dispose();
    this.cyl.dispose();
    this.sph.dispose();
    this.prog.dispose();
  }
}
