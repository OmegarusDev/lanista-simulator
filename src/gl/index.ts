import type { StageDrawModel } from './drawModel';
import { StageCamera } from './camera';
import type { GlContext } from './context';
import { FxSystem } from './fx';
import { createBox, drawMesh, type Mesh } from './mesh';
import { disposeNoiseCache } from './noiseTex';
import { createProgram, type GlProgram } from './shader';
import { FX_FS, FX_VS } from './shaders';
import { SceneArena } from './sceneArena';
import { SceneFighters } from './sceneFighters';

export class GlFrame {
  readonly camera = new StageCamera();
  readonly fx = new FxSystem();
  private arena: SceneArena;
  private fighters: SceneFighters;
  private fxProg: GlProgram;
  private point: Mesh;
  private disposed = false;
  private loggedGlError = false;

  constructor(readonly ctx: GlContext) {
    this.arena = new SceneArena(ctx);
    this.fighters = new SceneFighters(ctx);
    this.fxProg = createProgram(ctx.gl, FX_VS, FX_FS);
    this.point = createBox(ctx.gl, 1, 1, 1);
  }

  resize(cssW: number, cssH: number): void {
    this.ctx.resize(cssW, cssH);
    this.camera.resize(cssW, cssH);
  }

  render(model: StageDrawModel): void {
    if (this.disposed || this.ctx.lost) return;
    const gl = this.ctx.gl;
    if (gl.drawingBufferWidth < 1 || gl.drawingBufferHeight < 1) {
      if (!this.loggedGlError) {
        this.loggedGlError = true;
        console.error('[lanista] drawingBuffer is 0 — stage not sized');
      }
      return;
    }
    try {
      if (!this.camera.hasProjection()) {
        this.camera.resize(Math.max(1, this.ctx.cssW), Math.max(1, this.ctx.cssH));
        this.camera.frameArena();
      }
      if (model.shake > 0) this.camera.shake(model.shake * 0.35);
      this.camera.tickSmooth();
      this.arena.draw(this.camera, model.seed);
      this.fighters.draw(this.camera, model.fighters);
      this.drawFx();
      if (!this.loggedGlError) {
        const err = gl.getError();
        if (err !== gl.NO_ERROR) {
          this.loggedGlError = true;
          console.error('[lanista] WebGL error after frame', err);
        }
      }
    } catch (err) {
      console.error('[lanista] glFrame.render', err);
    }
  }

  private drawFx(): void {
    const gl = this.ctx.gl;
    if (this.fx.particles.length === 0) return;
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.depthMask(false);
    this.fxProg.use();
    gl.uniformMatrix4fv(this.fxProg.uniform('u_viewProj'), false, this.camera.getViewProj());
    for (const p of this.fx.particles) {
      const a = Math.max(0, p.life / p.maxLife);
      let r = 0.75,
        g = 0.65,
        b = 0.45;
      if (p.kind === 'blood') {
        r = 0.55;
        g = 0.08;
        b = 0.08;
      } else if (p.kind === 'spark') {
        r = 1;
        g = 0.85;
        b = 0.4;
      } else if (p.kind === 'shatter') {
        r = 0.7;
        g = 0.8;
        b = 0.95;
      } else if (p.kind === 'ring') {
        r = 0.85;
        g = 0.75;
        b = 0.45;
      }
      gl.uniform3f(this.fxProg.uniform('u_center'), p.x, p.y, p.z);
      gl.uniform1f(this.fxProg.uniform('u_size'), p.size);
      gl.uniform4f(this.fxProg.uniform('u_color'), r, g, b, a);
      drawMesh(gl, this.point);
    }
    gl.depthMask(true);
    gl.disable(gl.BLEND);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.arena.dispose();
    this.fighters.dispose();
    this.point.dispose();
    this.fxProg.dispose();
    disposeNoiseCache(this.ctx.gl);
    this.fx.clear();
    this.ctx.dispose();
  }
}
