/** Cheap baked lighting helpers — sun direction × soft AO. */

export const SUN = { dx: -0.55, dy: -0.35 } as const;

/** Radial sun wash over a clipped sand disk (call after sand fill, inside clip). */
export function paintSunWash(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
): void {
  const wash = ctx.createRadialGradient(
    cx + SUN.dx * 90,
    cy + SUN.dy * 70,
    20,
    cx,
    cy,
    Math.max(rx, ry),
  );
  wash.addColorStop(0, 'rgba(255,220,150,0.16)');
  wash.addColorStop(0.5, 'rgba(255,200,120,0.05)');
  wash.addColorStop(1, 'rgba(40,25,10,0.28)');
  ctx.fillStyle = wash;
  ctx.fillRect(cx - rx, cy - ry, rx * 2, ry * 2);
}

/** Soft contact shadow under a fighter (local space, centered at origin). */
export function paintContactShadow(
  ctx: CanvasRenderingContext2D,
  scale: number,
  fallen = false,
): void {
  const sx = 11 * scale;
  const sy = fallen ? 5 * scale : 7 * scale;
  const g = ctx.createRadialGradient(SUN.dx * -3, SUN.dy * -2, 0, 0, 1, sx);
  g.addColorStop(0, fallen ? 'rgba(20,12,6,0.35)' : 'rgba(20,12,6,0.42)');
  g.addColorStop(1, 'rgba(20,12,6,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(SUN.dx * -2, 2 + SUN.dy * -1, sx, sy, 0, 0, Math.PI * 2);
  ctx.fill();
}

/** Rim light stroke hint on a silhouette path. */
export function paintRimHint(ctx: CanvasRenderingContext2D, path: () => void, alpha = 0.22): void {
  ctx.save();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = `rgba(255,220,170,${alpha})`;
  ctx.shadowColor = 'rgba(255,210,140,0.35)';
  ctx.shadowBlur = 4;
  path();
  ctx.stroke();
  ctx.restore();
}
