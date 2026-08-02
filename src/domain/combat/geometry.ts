/** Angle of vector from (x,y) toward (tx,ty), canvas-style (y+ down). */
export function angleTo(x: number, y: number, tx: number, ty: number): number {
  return Math.atan2(ty - y, tx - x);
}

export function normalizeAngle(a: number): number {
  let x = a;
  while (x > Math.PI) x -= Math.PI * 2;
  while (x < -Math.PI) x += Math.PI * 2;
  return x;
}

export function angleDelta(from: number, to: number): number {
  return normalizeAngle(to - from);
}

export function turnToward(facing: number, target: number, maxStep: number): number {
  const d = angleDelta(facing, target);
  if (Math.abs(d) <= maxStep) return target;
  return normalizeAngle(facing + Math.sign(d) * maxStep);
}

export function inCone(facing: number, toTarget: number, halfArc: number): boolean {
  return Math.abs(angleDelta(facing, toTarget)) <= halfArc;
}

export function dist(ax: number, ay: number, bx: number, by: number): number {
  return Math.hypot(bx - ax, by - ay);
}

export function clampToEllipse(
  x: number,
  y: number,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
): { x: number; y: number } {
  const nx = (x - cx) / rx;
  const ny = (y - cy) / ry;
  const s = nx * nx + ny * ny;
  if (s <= 1) return { x, y };
  const k = 1 / Math.sqrt(s);
  return { x: cx + nx * k * rx, y: cy + ny * k * ry };
}
