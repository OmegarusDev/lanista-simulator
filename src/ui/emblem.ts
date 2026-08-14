/**
 * Procedural Roman emblem — a laurel wreath with crossed gladii, generated in
 * code (zero assets), the way the 3D kit and the CSS textures are. Used for
 * the brand mark; same philosophy, same source of truth: math.
 */

const LAUREL = '#96a86e';
const LAUREL_EDGE = '#5f6e46';
const GOLD = '#d4b06a';
const GOLD_DEEP = '#8a6a2e';

function leaf(x: number, y: number, rot: number, r: number): string {
  return `<ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="${r}" ry="${(r * 0.38).toFixed(1)}" fill="${LAUREL}" stroke="${LAUREL_EDGE}" stroke-width="0.5" transform="rotate(${rot.toFixed(1)} ${x.toFixed(1)} ${y.toFixed(1)})"/>`;
}

/** A wreath of leaves along an arc — symmetric halves meeting at the top. */
function wreathHalf(fromDeg: number, toDeg: number, count: number, radius: number): string {
  const out: string[] = [];
  const cx = 50;
  const cy = 50;
  for (let i = 0; i < count; i++) {
    const t = ((fromDeg + ((toDeg - fromDeg) * i) / (count - 1)) * Math.PI) / 180;
    const x = cx + radius * Math.cos(t);
    const y = cy + radius * Math.sin(t);
    // Leaves lie along the tangent, pointing outward from the ring.
    const rot = (t * 180) / Math.PI + 90;
    out.push(leaf(x, y, rot, i % 3 === 0 ? 5.2 : 4.4));
  }
  return out.join('');
}

export function laurelEmblem(): string {
  const leaves =
    wreathHalf(100, 170, 7, 38) +
    wreathHalf(10, 80, 7, 38) +
    // Top cap leaf pair closing the wreath.
    leaf(50, 12.5, 0, 5.6) +
    leaf(50, 17.5, 180, 5.2);
  return (
    `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Laurel wreath with crossed gladii">` +
    // Carved outer ring.
    `<circle cx="50" cy="50" r="46" fill="none" stroke="${GOLD}" stroke-width="1.6" opacity="0.85"/>` +
    `<circle cx="50" cy="50" r="43" fill="none" stroke="${GOLD}" stroke-width="0.6" opacity="0.4"/>` +
    leaves +
    // Crossed gladii — blades, then hilts over them.
    `<g stroke="${GOLD}" stroke-width="2.4" stroke-linecap="round">` +
    `<line x1="27" y1="72" x2="73" y2="28"/>` +
    `<line x1="73" y1="72" x2="27" y2="28"/>` +
    `</g>` +
    `<g stroke="${GOLD_DEEP}" stroke-width="3.6" stroke-linecap="round">` +
    `<line x1="24" y1="79" x2="30" y2="73"/>` +
    `<line x1="76" y1="79" x2="70" y2="73"/>` +
    `</g>` +
    `<circle cx="50" cy="50" r="3.2" fill="${GOLD_DEEP}"/>` +
    `</svg>`
  );
}
