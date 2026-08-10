import { ARENA_WORLD_H, ARENA_WORLD_W } from '../shell/canvas';
import type { FighterSnapshot } from '../domain/combat/types';
import type { Rect } from './ui';
import type { WorldViewTransform } from './layout';

export type CamMode = 'autocam' | 'manual' | 'focus';

/**
 * Lightweight pan/zoom look-at camera for Instant Match preview + fight.
 * `toTransform(viewRect)` expects the **clip/viewport box** in design space
 * (not a pre-zoomed world footprint). Zoom is applied once: contain × zoom.
 */
export class ArenaCamera {
  mode: CamMode = 'autocam';
  /** Desired look-at in world space. */
  targetX = ARENA_WORLD_W * 0.5;
  targetY = ARENA_WORLD_H * 0.5;
  /** Smoothed look-at. */
  smoothX = ARENA_WORLD_W * 0.5;
  smoothY = ARENA_WORLD_H * 0.5;
  /** Manual drag offset in world units. */
  panX = 0;
  panY = 0;
  /** Desired multiplier on contain-fit (>1 crops in). */
  zoom = 1.12;
  /** Smoothed zoom used for rendering. */
  smoothZoom = 1.12;
  focusId: number | null = null;
  focusedTeam: 0 | 1 | null = null;

  private dragging = false;
  private dragMoved = false;
  private dragDesignX = 0;
  private dragDesignY = 0;
  private dragPan0X = 0;
  private dragPan0Y = 0;
  private lastScale = 1;
  /** Frames to stay in focus before easing back to autocam (0 = hold). */
  private focusHold = 0;

  reset(zoom = 1.12): void {
    this.mode = 'autocam';
    this.targetX = ARENA_WORLD_W * 0.5;
    this.targetY = ARENA_WORLD_H * 0.5;
    this.smoothX = this.targetX;
    this.smoothY = this.targetY;
    this.panX = 0;
    this.panY = 0;
    this.zoom = zoom;
    this.smoothZoom = zoom;
    this.focusId = null;
    this.focusedTeam = null;
    this.dragging = false;
    this.dragMoved = false;
    this.focusHold = 0;
  }

  focusFighter(f: { id: number; x: number; y: number }): void {
    this.mode = 'focus';
    this.focusId = f.id;
    this.focusedTeam = null;
    this.targetX = f.x;
    this.targetY = f.y;
    this.panX = 0;
    this.panY = 0;
    this.zoom = Math.max(this.zoom, 1.28);
    this.focusHold = 180;
  }

  focusTeamGroup(
    team: 0 | 1,
    fighters: readonly { team: number; x: number; y: number; alive?: boolean }[],
  ): void {
    const members = fighters.filter((f) => f.team === team && f.alive !== false);
    if (members.length === 0) return;
    let sx = 0;
    let sy = 0;
    for (const f of members) {
      sx += f.x;
      sy += f.y;
    }
    this.mode = 'focus';
    this.focusedTeam = team;
    this.focusId = null;
    this.targetX = sx / members.length;
    this.targetY = sy / members.length;
    this.panX = 0;
    this.panY = 0;
    this.zoom = Math.max(1.08, Math.min(1.22, this.zoom));
    this.focusHold = 160;
  }

  clearFocus(): void {
    this.mode = 'autocam';
    this.focusId = null;
    this.focusedTeam = null;
    this.focusHold = 0;
    this.zoom = Math.min(this.zoom, 1.14);
  }

  /**
   * Autocam: frame alive fighters; bias to selected and optional interest point (last hit).
   */
  updateAutocam(
    fighters: readonly FighterSnapshot[],
    opts?: { selectedId?: number | null; interestX?: number; interestY?: number },
  ): void {
    if (this.mode === 'manual' || this.dragging) return;

    if (this.mode === 'focus' && this.focusHold > 0) {
      this.focusHold--;
      if (this.focusId != null) {
        const f = fighters.find((x) => x.id === this.focusId);
        if (f) {
          this.targetX = f.x;
          this.targetY = f.y;
        }
      }
      if (this.focusHold <= 0) this.clearFocus();
    }

    if (this.mode === 'autocam') {
      const alive = fighters.filter((f) => f.alive);
      if (alive.length === 0) {
        this.targetX = ARENA_WORLD_W * 0.5;
        this.targetY = ARENA_WORLD_H * 0.5;
      } else {
        let sx = 0;
        let sy = 0;
        let wSum = 0;
        for (const f of alive) {
          let w = 1;
          if (opts?.selectedId != null && f.id === opts.selectedId) w = 2.4;
          if (f.action === 'ATTACK' || f.poiseBroken) w += 0.8;
          sx += f.x * w;
          sy += f.y * w;
          wSum += w;
        }
        let tx = sx / wSum;
        let ty = sy / wSum;
        if (opts?.interestX != null && opts?.interestY != null) {
          tx = tx * 0.65 + opts.interestX * 0.35;
          ty = ty * 0.65 + opts.interestY * 0.35;
        }
        this.targetX = tx;
        this.targetY = ty;

        // Zoom out a touch for melees — keep within a cinematic band
        const span = Math.max(
          ...alive.map((f) => Math.hypot(f.x - tx, f.y - ty)),
          40,
        );
        const want = span > 160 ? 1.05 : span > 100 ? 1.12 : 1.22;
        this.zoom += (want - this.zoom) * 0.045;
      }
    }
    // Easing lives only in tickSmooth() — callers invoke both each frame.
  }

  /** Call once per frame even when not autocam so focus/manual ease. */
  tickSmooth(): void {
    const k =
      this.dragging ? 0.35 : this.mode === 'focus' ? 0.18 : this.mode === 'manual' ? 0.16 : 0.1;
    this.smoothX += (this.targetX - this.smoothX) * k;
    this.smoothY += (this.targetY - this.smoothY) * k;
    const zk = this.dragging ? 0.25 : 0.08;
    this.smoothZoom += (this.zoom - this.smoothZoom) * zk;
  }

  beginDrag(designX: number, designY: number, scale: number): void {
    this.dragging = true;
    this.dragMoved = false;
    this.dragDesignX = designX;
    this.dragDesignY = designY;
    this.dragPan0X = this.panX;
    this.dragPan0Y = this.panY;
    this.lastScale = scale || 1;
  }

  dragTo(designX: number, designY: number): void {
    if (!this.dragging) return;
    const dx = designX - this.dragDesignX;
    const dy = designY - this.dragDesignY;
    if (Math.hypot(dx, dy) > 6) this.dragMoved = true;
    // Drag moves the world under the finger → pan opposite (world units)
    this.panX = this.dragPan0X - dx / this.lastScale;
    this.panY = this.dragPan0Y - dy / this.lastScale;
    this.clampPan();
    if (this.dragMoved) {
      this.mode = 'manual';
      this.focusId = null;
      this.focusedTeam = null;
    }
  }

  /** @returns true if this was a drag (not a tap). */
  endDrag(): boolean {
    const wasDrag = this.dragging && this.dragMoved;
    this.dragging = false;
    if (wasDrag) {
      this.focusHold = 0;
    }
    return wasDrag;
  }

  isDragging(): boolean {
    return this.dragging;
  }

  didDrag(): boolean {
    return this.dragMoved;
  }

  private clampPan(): void {
    // Allow sliding a bit past the look-at, scaled so zoom-in can explore more.
    const z = Math.max(0.8, this.smoothZoom);
    const maxX = Math.min(280, 90 + ARENA_WORLD_W * 0.12 * z);
    const maxY = Math.min(200, 70 + ARENA_WORLD_H * 0.12 * z);
    this.panX = Math.max(-maxX, Math.min(maxX, this.panX));
    this.panY = Math.max(-maxY, Math.min(maxY, this.panY));
  }

  /**
   * World→design transform: look-at (smooth + pan) centered in the **viewport** `viewRect`.
   * Pass the clip box (arena band / stage), never a pre-scaled world footprint.
   */
  toTransform(viewRect: Rect): WorldViewTransform {
    const contain = Math.min(viewRect.w / ARENA_WORLD_W, viewRect.h / ARENA_WORLD_H);
    const z = Math.max(0.8, Math.min(1.55, this.smoothZoom));
    const scale = contain * z;
    // Look-at pivot: world point (cx,cy) maps to viewport center.
    const cx = this.smoothX + this.panX;
    const cy = this.smoothY + this.panY;
    const ox = viewRect.x + viewRect.w / 2 - cx * scale;
    const oy = viewRect.y + viewRect.h / 2 - cy * scale;
    this.lastScale = scale;
    return {
      view: { x: viewRect.x, y: viewRect.y, w: viewRect.w, h: viewRect.h },
      scale,
      ox,
      oy,
    };
  }
}

/** Spawn-style posed positions for menu preview (mirrors Match.spawnTeam spacing). */
export function posedSpawnPoints(
  teamSize: number,
  team: 0 | 1,
): { x: number; y: number; facing: number }[] {
  const baseX = ARENA_WORLD_W * 0.5 + (team === 0 ? -140 : 140);
  const baseY = ARENA_WORLD_H * 0.5;
  const spreadStep = teamSize >= 3 ? 36 : 42;
  const facing = team === 0 ? 0 : Math.PI;
  const out: { x: number; y: number; facing: number }[] = [];
  for (let i = 0; i < teamSize; i++) {
    const spread = (i - (teamSize - 1) / 2) * spreadStep;
    const x = baseX + (teamSize >= 3 ? (i - 1) * 8 * (team === 0 ? 1 : -1) : 0);
    out.push({ x, y: baseY + spread, facing });
  }
  return out;
}
