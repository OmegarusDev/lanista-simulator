import { combatTuning } from '../../content/combat';
import { clampToEllipse } from './geometry';
import type { Fighter } from './fighter';

export function separateBodies(fighters: Fighter[]): void {
  const min = combatTuning.bodyRadius * 2;
  for (let i = 0; i < fighters.length; i++) {
    for (let j = i + 1; j < fighters.length; j++) {
      const a = fighters[i]!;
      const b = fighters[j]!;
      if (!a.alive || !b.alive) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dd = Math.hypot(dx, dy) || 0.01;
      if (dd >= min) continue;
      // Stronger shove when deeply overlapped so clinch jams don't persist
      const depth = (min - dd) / min;
      const push = ((min - dd) / 2) * (0.75 + depth * 0.85);
      const nx = dx / dd;
      const ny = dy / dd;
      a.x -= nx * push;
      a.y -= ny * push;
      b.x += nx * push;
      b.y += ny * push;
      // Kill inward spring velocity so they don't immediately re-collide
      const va = a.vx * nx + a.vy * ny;
      if (va > 0) {
        a.vx -= nx * va;
        a.vy -= ny * va;
      }
      const vb = b.vx * -nx + b.vy * -ny;
      if (vb > 0) {
        b.vx += nx * vb;
        b.vy += ny * vb;
      }
    }
  }
  for (const f of fighters) {
    const c = clampToEllipse(
      f.x,
      f.y,
      combatTuning.arenaCX,
      combatTuning.arenaCY,
      combatTuning.arenaRX,
      combatTuning.arenaRY,
    );
    f.x = c.x;
    f.y = c.y;
  }
}
