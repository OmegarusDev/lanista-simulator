import { ARENA_WORLD_H, ARENA_WORLD_W } from '../shell/canvas';
import type { StageCamera } from './camera';
import type { GlContext } from './context';
import { clearSky } from './context';
import type { SandStainDraw, StageDrawModel } from './drawModel';
import { mat4Identity } from './math';
import { createCrowdRing, createDisk, createRing, createFullscreenQuad, drawMesh, type Mesh } from './mesh';
import { beginNoiseBakeFrame, getSandNoiseTex } from './noiseTex';
import { PALETTE_RGB } from './paletteRgb';
import { caveaSteps, gfxQuality, bakeBudgetPerFrame, shadowsEnabled } from './quality';
import { createProgram, type GlProgram } from './shader';
import { LIT_FS, LIT_VS, SKY_FS, SKY_VS } from './shaders';
import { skyTinted } from './skyStops';

const CX = ARENA_WORLD_W * 0.5;
const CZ = ARENA_WORLD_H * 0.5;
const SAND_R = Math.min(ARENA_WORLD_W, ARENA_WORLD_H) * 0.42;

export class SceneArena {
  private skyProg: GlProgram;
  private litProg: GlProgram;
  private quad: Mesh;
  private sand: Mesh;
  private rings: Mesh[] = [];
  private crowdRings: Mesh[] = [];
  private lip: Mesh;
  private stainDisk: Mesh;
  private model = mat4Identity();
  private disposed = false;

  constructor(private readonly ctx: GlContext) {
    const gl = ctx.gl;
    this.skyProg = createProgram(gl, SKY_VS, SKY_FS);
    this.litProg = createProgram(gl, LIT_VS, LIT_FS);
    this.quad = createFullscreenQuad(gl);
    this.sand = createDisk(gl, SAND_R, 72);
    this.lip = createRing(gl, SAND_R, SAND_R * 1.06, 72);
    this.stainDisk = createDisk(gl, 1, 16);
    this.rebuildCavea();
  }

  private rebuildCavea(): void {
    const gl = this.ctx.gl;
    for (const r of this.rings) r.dispose();
    for (const c of this.crowdRings) c.dispose();
    this.rings = [];
    this.crowdRings = [];
    const steps = caveaSteps(gfxQuality());
    for (let i = 0; i < steps; i++) {
      const inner = SAND_R * (1.08 + i * 0.07);
      const outer = inner + SAND_R * 0.055;
      this.rings.push(createRing(gl, inner, outer, 48));
    }
    // The top stands hold the sea of spectators — one mesh per step.
    for (let i = steps - 2; i < steps; i++) {
      const inner = SAND_R * (1.08 + i * 0.07);
      const outer = inner + SAND_R * 0.055;
      this.crowdRings.push(
        createCrowdRing(gl, inner * 1.02, outer * 0.9, 2, 90, 1.5, 0x51a7 + i * 97),
      );
    }
  }

  private setModelTranslate(x: number, y: number, z: number): ReturnType<typeof mat4Identity> {
    const m = this.model;
    mat4Identity(m);
    m[12] = x;
    m[13] = y;
    m[14] = z;
    return m;
  }

  private setModelScale(x: number, y: number, z: number, sx: number, sy: number, sz: number): void {
    const m = this.model;
    mat4Identity(m);
    m[0] = sx;
    m[5] = sy;
    m[10] = sz;
    m[12] = x;
    m[13] = y;
    m[14] = z;
  }

  draw(cam: StageCamera, model: StageDrawModel): void {
    if (this.disposed || this.ctx.lost) return;
    const gl = this.ctx.gl;
    const sky = skyTinted(model.favor, model.mood);
    clearSky(gl, sky.clear[0]!, sky.clear[1]!, sky.clear[2]!);

    // Fullscreen sky (no depth write, no cull — NDC quad)
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.CULL_FACE);
    this.skyProg.use();
    gl.uniform3f(this.skyProg.uniform('u_high'), sky.high[0]!, sky.high[1]!, sky.high[2]!);
    gl.uniform3f(this.skyProg.uniform('u_mid'), sky.mid[0]!, sky.mid[1]!, sky.mid[2]!);
    gl.uniform3f(this.skyProg.uniform('u_low'), sky.low[0]!, sky.low[1]!, sky.low[2]!);
    drawMesh(gl, this.quad);
    gl.enable(gl.DEPTH_TEST);
    // Keep cull off for sand/rings — winding bugs must never blank the arena again.
    gl.disable(gl.CULL_FACE);

    beginNoiseBakeFrame();
    const q = gfxQuality();
    const noise = getSandNoiseTex(gl, model.seed, q, bakeBudgetPerFrame(q));

    this.litProg.use();
    gl.uniformMatrix4fv(this.litProg.uniform('u_viewProj'), false, cam.getViewProj());
    gl.uniform3f(this.litProg.uniform('u_lightDir'), 0.35, 0.85, 0.25);
    const shade = shadowsEnabled(q) ? 1 : 0.92;
    gl.uniform3f(this.litProg.uniform('u_lightColor'), 1.05 * shade, 0.95 * shade, 0.8 * shade);
    // Cavea picks up slight favor tint (cool ally / warm foe)
    const favor = model.favor ?? 0.5;
    const ambR = 0.28 + (0.5 - favor) * 0.04;
    const ambB = 0.34 + (favor - 0.5) * 0.05;
    gl.uniform3f(this.litProg.uniform('u_ambient'), ambR, 0.3, ambB);

    // Cavea rings
    const stone = PALETTE_RGB.stoneMid;
    for (let i = 0; i < this.rings.length; i++) {
      const ringShade = 0.55 + i * 0.06;
      gl.uniform3f(
        this.litProg.uniform('u_albedo'),
        stone[0]! * ringShade,
        stone[1]! * ringShade,
        stone[2]! * ringShade,
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

    // The crowd — a sea of heads mottled by the noise texture, warm tones
    // against the stone, picking up the favor's cool/warm ambient.
    const crowdCol = PALETTE_RGB.sandMid;
    for (let i = 0; i < this.crowdRings.length; i++) {
      const shade = 1.05 + i * 0.08;
      gl.uniform3f(
        this.litProg.uniform('u_albedo'),
        crowdCol[0]! * shade,
        crowdCol[1]! * shade,
        crowdCol[2]! * shade,
      );
      gl.uniform1i(this.litProg.uniform('u_useNoise'), 1);
      gl.uniform1f(this.litProg.uniform('u_noiseAmt'), 0.3);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, noise);
      gl.uniform1i(this.litProg.uniform('u_noise'), 0);
      gl.uniformMatrix4fv(
        this.litProg.uniform('u_model'),
        false,
        this.setModelTranslate(CX, 0.5 + (this.rings.length - this.crowdRings.length + i) * 2.2, CZ),
      );
      drawMesh(gl, this.crowdRings[i]!);
    }

    // Stone lip
    const lipCol = PALETTE_RGB.stoneLit;
    gl.uniform3f(this.litProg.uniform('u_albedo'), lipCol[0]!, lipCol[1]!, lipCol[2]!);
    gl.uniform1i(this.litProg.uniform('u_useNoise'), 0);
    gl.uniformMatrix4fv(this.litProg.uniform('u_model'), false, this.setModelTranslate(CX, 1.2, CZ));
    drawMesh(gl, this.lip);

    // Sand disk
    const sand = PALETTE_RGB.sandMid;
    gl.uniform3f(this.litProg.uniform('u_albedo'), sand[0]!, sand[1]!, sand[2]!);
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

    // Blood stains — flat disks on sand before fighters
    this.drawStains(gl, model.stains);
  }

  private drawStains(gl: WebGL2RenderingContext, stains: readonly SandStainDraw[] | undefined): void {
    if (!stains?.length) return;
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.depthMask(false);
    const deep = PALETTE_RGB.sandDeep;
    gl.uniform1i(this.litProg.uniform('u_useNoise'), 0);
    gl.uniform1f(this.litProg.uniform('u_noiseAmt'), 0);
    for (const s of stains) {
      const a = Math.max(0.08, Math.min(0.75, s.strength * s.lifeRatio));
      gl.uniform3f(
        this.litProg.uniform('u_albedo'),
        deep[0]! * 0.35 + 0.25 * a,
        deep[1]! * 0.2,
        deep[2]! * 0.15,
      );
      this.setModelScale(s.x, 0.15, s.y, s.radius, 1, s.radius);
      gl.uniformMatrix4fv(this.litProg.uniform('u_model'), false, this.model);
      drawMesh(gl, this.stainDisk);
    }
    gl.depthMask(true);
    gl.disable(gl.BLEND);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.quad.dispose();
    this.sand.dispose();
    this.lip.dispose();
    this.stainDisk.dispose();
    for (const r of this.rings) r.dispose();
    for (const c of this.crowdRings) c.dispose();
    this.skyProg.dispose();
    this.litProg.dispose();
  }
}
