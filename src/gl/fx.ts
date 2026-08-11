import type { CombatEventKind } from '../domain/combat/types';
import { particleCap, gfxQuality } from './quality';

export type FxKind = 'dust' | 'blood' | 'spark' | 'shatter' | 'ring';

export interface FxParticle {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  maxLife: number;
  kind: FxKind;
  size: number;
}

export interface FxRecipe {
  kind: FxKind;
  count: number;
  speed: number;
  life: number;
  size: number;
}

/** Exhaustive FX recipes per CombatEventKind. */
export const FX_RECIPES: Record<CombatEventKind, FxRecipe[]> = {
  HIT: [
    { kind: 'dust', count: 4, speed: 40, life: 28, size: 1.2 },
    { kind: 'blood', count: 3, speed: 55, life: 22, size: 1 },
    { kind: 'spark', count: 2, speed: 70, life: 14, size: 0.8 },
  ],
  // Guard flash: small sparks only — no sand-scale ring overlays.
  GUARD: [{ kind: 'spark', count: 4, speed: 40, life: 12, size: 0.7 }],
  SIDESTEP: [{ kind: 'dust', count: 2, speed: 25, life: 18, size: 0.9 }],
  STUMBLE: [{ kind: 'dust', count: 6, speed: 35, life: 26, size: 1.1 }],
  POISE_BREAK: [
    { kind: 'shatter', count: 8, speed: 60, life: 32, size: 1.4 },
    { kind: 'dust', count: 5, speed: 40, life: 24, size: 1.2 },
  ],
  TIP_CATCH: [{ kind: 'spark', count: 4, speed: 30, life: 20, size: 1 }],
  KO: [
    { kind: 'dust', count: 6, speed: 45, life: 36, size: 1.5 },
    { kind: 'blood', count: 6, speed: 50, life: 30, size: 1.2 },
  ],
  ABORT: [{ kind: 'dust', count: 2, speed: 20, life: 14, size: 0.8 }],
};

export class FxSystem {
  particles: FxParticle[] = [];

  clear(): void {
    this.particles.length = 0;
  }

  spawn(x: number, y: number, recipes: FxRecipe[], rng: () => number): void {
    const cap = particleCap(gfxQuality());
    for (const r of recipes) {
      for (let i = 0; i < r.count; i++) {
        if (this.particles.length >= cap) this.particles.shift();
        const a = rng() * Math.PI * 2;
        const sp = r.speed * (0.5 + rng());
        this.particles.push({
          x,
          y: 8 + rng() * 10,
          z: y,
          vx: Math.cos(a) * sp,
          vy: 20 + rng() * 40,
          vz: Math.sin(a) * sp,
          life: r.life,
          maxLife: r.life,
          kind: r.kind,
          size: r.size * (0.7 + rng() * 0.6),
        });
      }
    }
  }

  spawnKind(x: number, y: number, kind: FxKind, count: number, rng: () => number): void {
    this.spawn(x, y, [{ kind, count, speed: 35, life: 24, size: 1 }], rng);
  }

  step(dtTicks = 1): void {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i]!;
      p.life -= dtTicks;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }
      p.x += p.vx * 0.016 * dtTicks;
      p.y += p.vy * 0.016 * dtTicks;
      p.z += p.vz * 0.016 * dtTicks;
      p.vy -= 80 * 0.016 * dtTicks;
      if (p.y < 1) {
        p.y = 1;
        p.vy *= -0.2;
        p.vx *= 0.85;
        p.vz *= 0.85;
      }
    }
  }
}

export function recipeForEvent(kind: CombatEventKind): FxRecipe[] {
  return FX_RECIPES[kind] ?? [];
}
