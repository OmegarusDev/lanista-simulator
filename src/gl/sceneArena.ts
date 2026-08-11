import { colors } from '../content/palette';
import { ARENA_WORLD_H, ARENA_WORLD_W } from '../shell/canvas';
import type { StageCamera } from './camera';
import type { GlContext } from './context';
import { clearSky } from './context';
import { mat4Identity, hexToRgb, type Mat4 } from './math';
import { createDisk, createRing, createFullscreenQuad, drawMesh, type Mesh } from './mesh';
import { beginNoiseBakeFrame, getSandNoiseTex } from './noiseTex';
import { caveaSteps, gfxQuality, bakeBudgetPerFrame } from './quality';
import { createProgram, type GlProgram } from './shader';
import { LIT_FS, LIT_VS, SKY_FS, SKY_VS } from './shaders';
import { skyClearRgb, skyHighRgb, skyLowRgb, skyMidRgb } from './skyStops';

const CX = ARENA_WORLD_W * 0.5;
const CZ = ARENA_WORLD_H * 0.5;
const SAND_R = Math.min(ARENA_WORLD_W, ARENA_WORLD_H) * 0.42;

export class SceneArena {
  private skyProg: GlProgram;
  private litProg: GlProgram;
  private quad: Mesh;
  private sand: Mesh;
  private rings: Mesh[] = [];
  private lip: Mesh;
  private model = mat4Identity();
  private disposed = false;

  constructor(private readonly ctx: GlContext) {
    const gl = ctx.gl;
    this.skyProg = createProgram(gl, SKY_VS, SKY_FS);
    this.litProg = createProgram(gl, LIT_VS, LIT_FS);
    this.quad = createFullscreenQuad(gl);
    this.sand = createDisk(gl, SAND_R, 72);
    this.lip = createRing(gl, SAND_R, SAND_R * 1.06, 72);
    this.rebuildCavea();
  }

  private rebuildCavea(): void {
    const gl = this.ctx.gl;
    for (const r of this.rings) r.dispose();
    this.rings = [];
    const steps = caveaSteps(gfxQuality());
    for (let i = 0; i < steps; i++) {
      const inner = SAND_R * (1.08 + i * 0.07);
      const outer = inner + SAND_R * 0.055;
      this.rings.push(createRing(gl, inner, outer, 48));
    }
  }

  private setModelTranslate(x: number, y: number, z: number): Mat4 {
    const m = this.model;
    mat4Identity(m);
    m[12] = x;
    m[13] = y;
    m[14] = z;
    return m;
  }

  draw(cam: StageCamera, seed: number): void {
    if (this.disposed || this.ctx.lost) return;
    const gl = this.ctx.gl;
    const clear = skyClearRgb();
    clearSky(gl, clear[0], clear[1], clear[2]);

    // Fullscreen sky (no depth write, no cull — NDC quad)
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.CULL_FACE);
    this.skyProg.use();
    const hi = skyHighRgb();
    const mid = skyMidRgb();
    const lo = skyLowRgb();
    gl.uniform3f(this.skyProg.uniform('u_high'), hi[0], hi[1], hi[2]);
    gl.uniform3f(this.skyProg.uniform('u_mid'), mid[0], mid[1], mid[2]);
    gl.uniform3f(this.skyProg.uniform('u_low'), lo[0], lo[1], lo[2]);
    drawMesh(gl, this.quad);
    gl.enable(gl.DEPTH_TEST);
    // Keep cull off for sand/rings — winding bugs must never blank the arena again.
    gl.disable(gl.CULL_FACE);

    beginNoiseBakeFrame();
    const q = gfxQuality();
    const noise = getSandNoiseTex(gl, seed, q, bakeBudgetPerFrame(q));

    this.litProg.use();
    gl.uniformMatrix4fv(this.litProg.uniform('u_viewProj'), false, cam.getViewProj());
    gl.uniform3f(this.litProg.uniform('u_lightDir'), 0.35, 0.85, 0.25);
    gl.uniform3f(this.litProg.uniform('u_lightColor'), 1.05, 0.95, 0.8);
    gl.uniform3f(this.litProg.uniform('u_ambient'), 0.28, 0.3, 0.34);

    // Cavea rings
    const stone = hexToRgb(colors.stoneMid);
    for (let i = 0; i < this.rings.length; i++) {
      const shade = 0.55 + i * 0.06;
      gl.uniform3f(
        this.litProg.uniform('u_albedo'),
        stone[0] * shade,
        stone[1] * shade,
        stone[2] * shade,
      );
      gl.uniform1i(this.litProg.uniform('u_useNoise'), 0);
      gl.uniform1f(this.litProg.uniform('u_noiseAmt'), 0);
      gl.uniformMatrix4fv(
        this.litProg.uniform('u_model'),
        false,
        this.setModelTranslate(CX, 0.5 + i * 2.2, CZ),
      );
      drawMesh(gl, this.rings[i]!);
    }

    // Stone lip
    const lipCol = hexToRgb(colors.stoneLit);
    gl.uniform3f(this.litProg.uniform('u_albedo'), lipCol[0], lipCol[1], lipCol[2]);
    gl.uniform1i(this.litProg.uniform('u_useNoise'), 0);
    gl.uniformMatrix4fv(this.litProg.uniform('u_model'), false, this.setModelTranslate(CX, 1.2, CZ));
    drawMesh(gl, this.lip);

    // Sand disk
    const sand = hexToRgb(colors.sandMid);
    gl.uniform3f(this.litProg.uniform('u_albedo'), sand[0], sand[1], sand[2]);
    gl.uniform1f(this.litProg.uniform('u_noiseAmt'), 0.18);
    if (noise) {
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, noise);
      gl.uniform1i(this.litProg.uniform('u_noise'), 0);
      gl.uniform1i(this.litProg.uniform('u_useNoise'), 1);
    } else {
      gl.uniform1i(this.litProg.uniform('u_useNoise'), 0);
    }
    gl.uniformMatrix4fv(this.litProg.uniform('u_model'), false, this.setModelTranslate(CX, 0, CZ));
    drawMesh(gl, this.sand);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.quad.dispose();
    this.sand.dispose();
    this.lip.dispose();
    for (const r of this.rings) r.dispose();
    this.skyProg.dispose();
    this.litProg.dispose();
  }
}
