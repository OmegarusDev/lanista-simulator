/**
 * Perspective amphitheatre camera — reinvented, not a port of ArenaCamera.
 *
 * Sim stays on the arena plane (fighter.x, fighter.y). Presentation maps:
 *   worldX = fighter.x, worldY = up, worldZ = fighter.y
 *
 * Modes: director (soft follow), manual (orbit/dolly/pan), focus (punch-in).
 */
import { ARENA_WORLD_H, ARENA_WORLD_W } from '../shell/canvas';
import {
  mat4Identity,
  mat4Invert,
  mat4LookAt,
  mat4Multiply,
  mat4Perspective,
  transformMat4,
  type Mat4,
  type Vec3,
  vec3,
} from './math';

export type CamMode = 'director' | 'manual' | 'focus';

export const CAMERA_DOLLY_MIN = 380;
export const CAMERA_DOLLY_MAX = 1500;
export const CAMERA_PITCH_MIN = 0.42; // rad from horizontal (~24°)
export const CAMERA_PITCH_MAX = 1.22; // ~70°
export const CAMERA_YAW_RANGE = 0.55;
/** Base vertical FOV (rad) — landscape matches today's framing exactly. */
const CAMERA_VFOV = (42 * Math.PI) / 180;
/**
 * Horizontal FOV floor — narrow/portrait screens never lose the arena sides.
 * A fixed vertical FOV collapses the horizontal FOV to ~20° on tall phones,
 * which hid 70% of the arena; the floor widens the vertical FOV instead.
 */
const CAMERA_HFOV_MIN = (40 * Math.PI) / 180;
const CAMERA_NEAR = 8;
const CAMERA_FAR = 4000;
/** Arena look-at margin — panning can never leave the sand. */
const PAN_MARGIN = 40;
/** Idle ticks (~8s at 60fps) before a manual camera hands back to the director. */
export const CAMERA_RECOVER_TICKS = 480;
/** Ticks a fresh user input claims the camera before the director retunes. */
const USER_HOLD_TICKS = 180;

const CENTER_X = ARENA_WORLD_W * 0.5;
const CENTER_Z = ARENA_WORLD_H * 0.5;

function clamp(n: number, a: number, b: number): number {
  return Math.max(a, Math.min(b, n));
}

export class StageCamera {
  mode: CamMode = 'director';

  /** Look-at on arena plane (x,z). */
  targetX = CENTER_X;
  targetZ = CENTER_Z;
  smoothX = CENTER_X;
  smoothZ = CENTER_Z;

  /** Distance from look-at along view ray. */
  dolly = 720;
  smoothDolly = 720;

  /** Pitch from horizontal (radians); yaw around world Y. */
  pitch = 0.92;
  yaw = 0;
  smoothPitch = 0.92;
  smoothYaw = 0;

  /** Manual pan offset on plane. */
  panX = 0;
  panZ = 0;

  focusId: number | null = null;
  private focusHold = 0;
  private userHold = 0;
  private recoverTicks = CAMERA_RECOVER_TICKS;

  /** Effective projection half-FOVs (aspect-aware — hfov never below floor). */
  private hfovHalf = Math.tan(CAMERA_VFOV / 2) * (16 / 9);
  private vfovHalf = CAMERA_VFOV / 2;

  private shakeAmp = 0;
  private shakeSeed = 1;

  private aspect = 16 / 9;
  private projReady = false;
  private readonly proj = mat4Identity();
  private readonly view = mat4Identity();
  private readonly viewProj = mat4Identity();
  private readonly invViewProj = mat4Identity();

  private dragging = false;
  private dragMoved = false;
  private dragSx = 0;
  private dragSy = 0;
  private dragPan0X = 0;
  private dragPan0Z = 0;
  private dragYaw0 = 0;
  private orbitDrag = false;

  constructor() {
    // Never leave proj as identity — first paint before resize would clip the world.
    this.resize(ARENA_WORLD_W, ARENA_WORLD_H);
    this.frameArena(defaultStageDolly(960, 540));
  }

  reset(dolly = 720): void {
    this.mode = 'director';
    this.targetX = CENTER_X;
    this.targetZ = CENTER_Z;
    this.smoothX = CENTER_X;
    this.smoothZ = CENTER_Z;
    this.dolly = clamp(dolly, CAMERA_DOLLY_MIN, CAMERA_DOLLY_MAX);
    this.smoothDolly = this.dolly;
    this.pitch = 0.92;
    this.yaw = 0;
    this.smoothPitch = this.pitch;
    this.smoothYaw = 0;
    this.panX = 0;
    this.panZ = 0;
    this.focusId = null;
    this.focusHold = 0;
    this.userHold = 0;
    this.recoverTicks = CAMERA_RECOVER_TICKS;
    this.shakeAmp = 0;
    this.dragging = false;
    this.dragMoved = false;
    this.rebuildMatrices();
  }

  /**
   * Debug-safe default framing: look at arena center with a dolly that keeps
   * the sand disk on screen even if director/interest state is empty or wrong.
   */
  frameArena(dolly?: number): void {
    this.mode = 'director';
    this.focusId = null;
    this.focusHold = 0;
    this.targetX = CENTER_X;
    this.targetZ = CENTER_Z;
    this.smoothX = CENTER_X;
    this.smoothZ = CENTER_Z;
    this.panX = 0;
    this.panZ = 0;
    this.userHold = 0;
    this.recoverTicks = CAMERA_RECOVER_TICKS;
    const d = clamp(dolly ?? defaultStageDolly(960, 540), CAMERA_DOLLY_MIN, CAMERA_DOLLY_MAX);
    this.dolly = d;
    this.smoothDolly = d;
    this.pitch = 0.92;
    this.smoothPitch = 0.92;
    this.yaw = 0;
    this.smoothYaw = 0;
    this.shakeAmp = 0;
    this.rebuildMatrices();
  }

  /** True once perspective has been written (never identity after construct). */
  hasProjection(): boolean {
    return this.projReady;
  }

  /** Resize updates projection only — never stomps user dolly/orbit. */
  resize(cssW: number, cssH: number): void {
    this.aspect = Math.max(0.2, cssW / Math.max(1, cssH));
    const hfovHalf = Math.max(
      Math.tan(CAMERA_HFOV_MIN / 2),
      Math.tan(CAMERA_VFOV / 2) * this.aspect,
    );
    this.hfovHalf = hfovHalf;
    this.vfovHalf = Math.atan(hfovHalf / this.aspect);
    mat4Perspective(this.proj, this.vfovHalf * 2, this.aspect, CAMERA_NEAR, CAMERA_FAR);
    this.projReady = true;
    this.rebuildMatrices();
  }

  dollyBy(delta: number): void {
    this.dolly = clamp(this.dolly + delta, CAMERA_DOLLY_MIN, CAMERA_DOLLY_MAX);
    this.userHold = USER_HOLD_TICKS;
    if (this.mode === 'director') this.mode = 'manual';
  }

  /** Wheel/pinch → dolly, two-finger centroid drag → orbit (positive delta = zoom in). */
  applyZoomInput(wheelDelta: number, pinchDelta: number, orbitDx = 0, orbitDy = 0): void {
    if (wheelDelta) this.dollyBy(wheelDelta * 0.55);
    if (pinchDelta) this.dollyBy(-pinchDelta * 180);
    if (orbitDx || orbitDy) this.orbit(orbitDx * 0.0045, orbitDy * 0.003);
  }

  nudgeDolly(frac: number): void {
    this.dollyBy(-frac * 120);
  }

  orbit(dyaw: number, dpitch: number): void {
    this.yaw = clamp(this.yaw + dyaw, -CAMERA_YAW_RANGE, CAMERA_YAW_RANGE);
    this.pitch = clamp(this.pitch + dpitch, CAMERA_PITCH_MIN, CAMERA_PITCH_MAX);
    this.userHold = USER_HOLD_TICKS;
    if (this.mode === 'director') this.mode = 'manual';
  }

  panOnPlane(dx: number, dz: number): void {
    const lookX = clamp(this.targetX + this.panX + dx, PAN_MARGIN, ARENA_WORLD_W - PAN_MARGIN);
    const lookZ = clamp(this.targetZ + this.panZ + dz, PAN_MARGIN, ARENA_WORLD_H - PAN_MARGIN);
    this.panX = lookX - this.targetX;
    this.panZ = lookZ - this.targetZ;
    if (this.mode === 'director') this.mode = 'manual';
  }

  shake(amount: number): void {
    this.shakeAmp = Math.min(14, this.shakeAmp + amount);
  }

  setInterest(x: number, z: number, life: number): void {
    this.mode = 'focus';
    this.focusId = null;
    this.targetX = x;
    this.targetZ = z;
    this.panX = 0;
    this.panZ = 0;
    this.focusHold = life;
    this.dolly = clamp(this.dolly * 0.92, CAMERA_DOLLY_MIN, CAMERA_DOLLY_MAX);
  }

  focusFighter(f: { id: number; x: number; y: number }): void {
    this.mode = 'focus';
    this.focusId = f.id;
    this.targetX = f.x;
    this.targetZ = f.y;
    this.panX = 0;
    this.panZ = 0;
    this.focusHold = 180;
    this.dolly = clamp(Math.min(this.dolly, 560), CAMERA_DOLLY_MIN, CAMERA_DOLLY_MAX);
  }

  focusTeamGroup(
    team: 0 | 1,
    fighters: readonly { team: number; x: number; y: number; alive?: boolean }[],
  ): void {
    const members = fighters.filter((f) => f.team === team && f.alive !== false);
    if (members.length === 0) return;
    let sx = 0;
    let sz = 0;
    for (const f of members) {
      sx += f.x;
      sz += f.y;
    }
    this.mode = 'focus';
    this.focusId = null;
    this.targetX = sx / members.length;
    this.targetZ = sz / members.length;
    this.panX = 0;
    this.panZ = 0;
    this.focusHold = 160;
    this.dolly = clamp(Math.min(this.dolly, 640), CAMERA_DOLLY_MIN, CAMERA_DOLLY_MAX);
  }

  clearFocus(): void {
    this.focusId = null;
    this.focusHold = 0;
    this.mode = this.userHold > 0 ? 'manual' : 'director';
  }

  beginDrag(sx: number, sy: number, orbit = false): void {
    this.dragging = true;
    this.dragMoved = false;
    this.dragSx = sx;
    this.dragSy = sy;
    this.dragPan0X = this.panX;
    this.dragPan0Z = this.panZ;
    this.dragYaw0 = this.yaw;
    this.orbitDrag = orbit;
  }

  dragTo(sx: number, sy: number): void {
    if (!this.dragging) return;
    const dx = sx - this.dragSx;
    const dy = sy - this.dragSy;
    if (Math.hypot(dx, dy) > 4) this.dragMoved = true;
    if (this.orbitDrag) {
      this.yaw = clamp(this.dragYaw0 + dx * 0.004, -CAMERA_YAW_RANGE, CAMERA_YAW_RANGE);
      this.pitch = clamp(this.pitch + dy * 0.003, CAMERA_PITCH_MIN, CAMERA_PITCH_MAX);
      this.userHold = USER_HOLD_TICKS;
      if (this.mode === 'director') this.mode = 'manual';
    } else {
      const scale = this.smoothDolly * 0.0018;
      const cy = Math.cos(this.smoothYaw);
      const syaw = Math.sin(this.smoothYaw);
      const wx = (-dx * cy - dy * syaw) * scale;
      const wz = (dx * syaw - dy * cy) * scale;
      const lookX = clamp(
        this.targetX + this.dragPan0X + wx,
        PAN_MARGIN,
        ARENA_WORLD_W - PAN_MARGIN,
      );
      const lookZ = clamp(
        this.targetZ + this.dragPan0Z + wz,
        PAN_MARGIN,
        ARENA_WORLD_H - PAN_MARGIN,
      );
      this.panX = lookX - this.targetX;
      this.panZ = lookZ - this.targetZ;
      if (this.mode === 'director') this.mode = 'manual';
    }
  }

  endDrag(): boolean {
    const moved = this.dragMoved;
    this.dragging = false;
    this.dragMoved = false;
    return moved;
  }

  isDragging(): boolean {
    return this.dragging;
  }

  updateDirector(
    fighters: readonly { id: number; x: number; y: number; alive?: boolean }[],
    opts?: {
      selectedId?: number | null;
      interestX?: number;
      interestY?: number;
      /** Hand a manual camera back to the director after ~8s idle (fight scenes). */
      autoRecover?: boolean;
    },
  ): void {
    if (this.userHold > 0) {
      this.userHold--;
      this.recoverTicks = CAMERA_RECOVER_TICKS;
    } else if (this.mode === 'manual') {
      if (opts?.autoRecover) {
        this.recoverTicks--;
        if (this.recoverTicks <= 0) {
          this.mode = 'director';
          this.recoverTicks = CAMERA_RECOVER_TICKS;
        }
      }
    }
    if (this.focusHold > 0) {
      this.focusHold--;
      if (this.focusHold <= 0 && this.mode === 'focus') {
        this.mode = this.userHold > 0 ? 'manual' : 'director';
        this.focusId = null;
      }
    }

    if (this.mode === 'manual') return;
    if (this.mode === 'focus' && this.focusId != null) {
      const f = fighters.find((x) => x.id === this.focusId);
      if (f) {
        this.targetX = f.x;
        this.targetZ = f.y;
      }
      return;
    }
    if (this.mode === 'focus') return;

    const alive = fighters.filter((f) => f.alive !== false);
    if (opts?.interestX != null && opts.interestY != null) {
      this.targetX = opts.interestX;
      this.targetZ = opts.interestY;
    } else if (opts?.selectedId != null) {
      const sel = alive.find((f) => f.id === opts.selectedId);
      if (sel) {
        this.targetX = sel.x;
        this.targetZ = sel.y;
      }
    } else if (alive.length > 0) {
      let sx = 0;
      let sz = 0;
      for (const f of alive) {
        sx += f.x;
        sz += f.y;
      }
      this.targetX = sx / alive.length;
      this.targetZ = sz / alive.length;
    } else {
      this.targetX = CENTER_X;
      this.targetZ = CENTER_Z;
    }

    if (this.userHold <= 0) {
      const want = this.desiredDollyFor(alive);
      this.dolly += (want - this.dolly) * 0.04;
    }
  }

  /**
   * Director framing for the alive set: fit the fight's horizontal span and its
   * depth (foreshortened by pitch) to the effective FOV, whichever needs more
   * dolly. Aspect-aware, so portrait fights frame wide instead of clipping.
   */
  private desiredDollyFor(
    alive: readonly { id: number; x: number; y: number; alive?: boolean }[],
  ): number {
    const span = spanOf(alive);
    const halfW = 270 + span * 0.5;
    const halfD = 145 + span * 0.32;
    const dollyW = halfW / this.hfovHalf;
    const dollyD = (halfD * Math.sin(this.smoothPitch)) / Math.tan(this.vfovHalf);
    return clamp(Math.max(dollyW, dollyD), CAMERA_DOLLY_MIN, CAMERA_DOLLY_MAX);
  }

  /**
   * Tight staging framing: the director pulls in close to the fighters so
   * they read as standing figures, not specks in the arena. Manual orbits
   * and zooms keep the user's framing.
   */
  frameStage(): void {
    if (this.mode === 'director') this.dolly = Math.min(this.dolly, 350);
  }

  /** Hand back to the director immediately (Recenter button / rotation reframe). */
  recenter(): void {
    this.mode = 'director';
    this.focusId = null;
    this.focusHold = 0;
    this.panX = 0;
    this.panZ = 0;
    this.userHold = 0;
    this.recoverTicks = CAMERA_RECOVER_TICKS;
  }

  tickSmooth(): void {
    const k = 0.14;
    const lookX = clamp(this.targetX + this.panX, PAN_MARGIN, ARENA_WORLD_W - PAN_MARGIN);
    const lookZ = clamp(this.targetZ + this.panZ, PAN_MARGIN, ARENA_WORLD_H - PAN_MARGIN);
    this.smoothX += (lookX - this.smoothX) * k;
    this.smoothZ += (lookZ - this.smoothZ) * k;
    this.smoothDolly += (this.dolly - this.smoothDolly) * k;
    this.smoothPitch += (this.pitch - this.smoothPitch) * k;
    this.smoothYaw += (this.yaw - this.smoothYaw) * k;
    if (this.shakeAmp > 0) this.shakeAmp *= 0.88;
    if (this.shakeAmp < 0.15) this.shakeAmp = 0;
    this.rebuildMatrices();
  }

  private rebuildMatrices(): void {
    const lookX = this.smoothX;
    const lookZ = this.smoothZ;
    let shakeX = 0;
    let shakeY = 0;
    if (this.shakeAmp > 0) {
      this.shakeSeed = (this.shakeSeed * 1103515245 + 12345) >>> 0;
      shakeX = ((this.shakeSeed & 255) / 255 - 0.5) * this.shakeAmp;
      shakeY = (((this.shakeSeed >> 8) & 255) / 255 - 0.5) * this.shakeAmp;
    }
    const pitch = this.smoothPitch;
    const yaw = this.smoothYaw;
    const dist = this.smoothDolly;
    const cosP = Math.cos(pitch);
    const sinP = Math.sin(pitch);
    const cosY = Math.cos(yaw);
    const sinY = Math.sin(yaw);
    const eyeX = lookX + dist * cosP * sinY + shakeX;
    const eyeY = dist * sinP + shakeY;
    const eyeZ = lookZ + dist * cosP * cosY;
    const eye = vec3(eyeX, eyeY, eyeZ);
    const center = vec3(lookX, 0, lookZ);
    const up = vec3(0, 1, 0);
    mat4LookAt(this.view, eye, center, up);
    mat4Multiply(this.viewProj, this.proj, this.view);
    mat4Invert(this.invViewProj, this.viewProj);
  }

  getViewProj(): Mat4 {
    return this.viewProj;
  }

  getView(): Mat4 {
    return this.view;
  }

  getProj(): Mat4 {
    return this.proj;
  }

  eyePosition(): Vec3 {
    const pitch = this.smoothPitch;
    const yaw = this.smoothYaw;
    const dist = this.smoothDolly;
    const cosP = Math.cos(pitch);
    const sinP = Math.sin(pitch);
    const cosY = Math.cos(yaw);
    const sinY = Math.sin(yaw);
    return vec3(
      this.smoothX + dist * cosP * sinY,
      dist * sinP,
      this.smoothZ + dist * cosP * cosY,
    );
  }

  /** Screen CSS px → arena plane (x,y) or null if ray misses. */
  worldFromScreen(sx: number, sy: number, cssW: number, cssH: number): { x: number; y: number } | null {
    const ndcX = (sx / cssW) * 2 - 1;
    const ndcY = 1 - (sy / cssH) * 2;
    const near = transformMat4(vec3(), [ndcX, ndcY, -1], this.invViewProj);
    const far = transformMat4(vec3(), [ndcX, ndcY, 1], this.invViewProj);
    const dx = far[0] - near[0];
    const dy = far[1] - near[1];
    const dz = far[2] - near[2];
    if (Math.abs(dy) < 1e-6) return null;
    const t = -near[1] / dy;
    if (t < 0) return null;
    return { x: near[0] + dx * t, y: near[2] + dz * t };
  }

  /** Arena plane → screen CSS px. */
  screenFromWorld(x: number, y: number, cssW: number, cssH: number): { x: number; y: number } {
    const clip = transformMat4(vec3(), [x, 0, y], this.viewProj);
    return {
      x: ((clip[0] + 1) * 0.5) * cssW,
      y: ((1 - clip[1]) * 0.5) * cssH,
    };
  }
}

function spanOf(fighters: readonly { x: number; y: number }[]): number {
  if (fighters.length < 2) return 120;
  let minX = Infinity,
    maxX = -Infinity,
    minZ = Infinity,
    maxZ = -Infinity;
  for (const f of fighters) {
    minX = Math.min(minX, f.x);
    maxX = Math.max(maxX, f.x);
    minZ = Math.min(minZ, f.y);
    maxZ = Math.max(maxZ, f.y);
  }
  return Math.hypot(maxX - minX, maxZ - minZ);
}

/** Default dolly framing for a viewport aspect — portrait pulls back. */
export function defaultStageDolly(cssW: number, cssH: number): number {
  const aspect = cssW / Math.max(1, cssH);
  if (aspect < 0.75) return 950;
  if (aspect > 1.8) return 615;
  return 650;
}
