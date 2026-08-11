import type { FighterDraw } from './drawModel';
import type { StageCamera } from './camera';

/** Pick nearest alive fighter under perspective ray ∩ arena plane. */
export function pickFighterWorld(
  fighters: readonly FighterDraw[],
  worldX: number,
  worldY: number,
  radius = 36,
): FighterDraw | null {
  let best: FighterDraw | null = null;
  let bestD = radius * radius;
  for (const f of fighters) {
    if (!f.alive && f.kind === 'gladiator') {
      /* still pick KO for inspect */
    }
    const dx = f.x - worldX;
    const dy = f.y - worldY;
    const d = dx * dx + dy * dy;
    if (d < bestD) {
      bestD = d;
      best = f;
    }
  }
  return best;
}

export function pickFromScreen(
  cam: StageCamera,
  fighters: readonly FighterDraw[],
  sx: number,
  sy: number,
  cssW: number,
  cssH: number,
  radius = 40,
): FighterDraw | null {
  const w = cam.worldFromScreen(sx, sy, cssW, cssH);
  if (!w) return null;
  return pickFighterWorld(fighters, w.x, w.y, radius);
}
