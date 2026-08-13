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
  /** Horizontal facing for directional spray (sim radians). */
  facing: number;
}

export interface FxRecipe {
  kind: FxKind;
  count: number;
  speed: number;
  life: number;
  size: number;
  /** Scale recipe counts/sizes (cut quality / amount). */
  weight?: number;
}

export interface SandStain {
  x: number;
  y: number;
  radius: number;
  life: number;
  maxLife: number;
  strength: number;
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
    { kind: 'ring', count: 1, speed: 0, life: 20, size: 2.4 },
  ],
  TIP_CATCH: [{ kind: 'spark', count: 4, speed: 30, life: 20, size: 1 }],
  KO: [
    { kind: 'dust', count: 6, speed: 45, life: 36, size: 1.5 },
    { kind: 'blood', count: 8, speed: 58, life: 34, size: 1.35 },
  ],
  ABORT: [{ kind: 'dust', count: 2, speed: 20, life: 14, size: 0.8 }],
};

const STAIN_CAP = 48;

export type FxSpawnOpts = {
  /** Sim facing of attacker / impact normal (radians). */
  facing?: number;
  /** Extra scale on blood count/size (clinch messy, KO, amount). */
  bloodScale?: number;
};

/**
 * Ring-buffered particle system — overwrites oldest slots; no Array.shift().
 * Settled blood leaves sand stains for the arena pass.
 */
export class FxSystem {
  /** Active particles (dense prefix of pool). */
  particles: FxParticle[] = [];
  private pool: FxParticle[] = [];
  private writeCursor = 0;
  stains: SandStain[] = [];

  clear(): void {
    this.particles.length = 0;
    this.writeCursor = 0;
    this.stains.length = 0;
  }

  spawn(x: number, y: number, recipes: FxRecipe[], rng: () => number, opts?: FxSpawnOpts): void {
    const cap = particleCap(gfxQuality());
    const facing = opts?.facing ?? rng() * Math.PI * 2;
    const bloodScale = opts?.bloodScale ?? 1;

    for (const r of recipes) {
      const w = r.weight ?? 1;
      let count = Math.max(0, Math.round(r.count * w * (r.kind === 'blood' ? bloodScale : 1)));
      if (r.kind === 'ring') count = Math.min(1, count);
      const sizeMul = r.kind === 'blood' ? 0.85 + bloodScale * 0.35 : 1;

      for (let i = 0; i < count; i++) {
        const p = this.acquire(cap);
        const directional = r.kind === 'blood' || r.kind === 'spark';
        let a: number;
        if (r.kind === 'ring') {
          a = facing;
        } else if (directional) {
          // Arc spray along facing (HIT) or wider fan (heavy bloodScale)
          const spread = r.kind === 'blood' ? 0.55 + bloodScale * 0.35 : 0.9;
          a = facing + (rng() - 0.5) * Math.PI * spread;
        } else {
          a = rng() * Math.PI * 2;
        }
        const sp = r.speed * (0.5 + rng());
        const upBoost = r.kind === 'blood' && bloodScale > 1.2 ? 18 + rng() * 28 : 0;
        p.x = x;
        p.y = r.kind === 'ring' ? 4 : 8 + rng() * 10;
        p.z = y;
        p.vx = r.kind === 'ring' ? 0 : Math.cos(a) * sp;
        p.vy = r.kind === 'ring' ? 0 : 20 + rng() * 40 + upBoost;
        p.vz = r.kind === 'ring' ? 0 : Math.sin(a) * sp;
        p.life = r.life * (0.85 + rng() * 0.3);
        p.maxLife = p.life;
        p.kind = r.kind;
        p.size = r.size * sizeMul * (0.7 + rng() * 0.6) * (r.kind === 'ring' ? 1.8 : 1);
        p.facing = facing;
      }
    }
  }

  spawnKind(x: number, y: number, kind: FxKind, count: number, rng: () => number): void {
    this.spawn(x, y, [{ kind, count, speed: 35, life: 24, size: 1 }], rng);
  }

  /** Footwork / stumble dust from draw-model hints. */
  spawnDustHints(
    hints: readonly { x: number; y: number; kind: FxKind; life: number }[],
    rng: () => number,
  ): void {
    for (const h of hints) {
      this.spawn(h.x, h.y, [{ kind: h.kind, count: 1, speed: 22, life: h.life, size: 0.9 }], rng);
    }
  }

  private acquire(cap: number): FxParticle {
    if (this.particles.length < cap) {
      let p = this.pool.pop();
      if (!p) {
        p = {
          x: 0,
          y: 0,
          z: 0,
          vx: 0,
          vy: 0,
          vz: 0,
          life: 0,
          maxLife: 1,
          kind: 'dust',
          size: 1,
          facing: 0,
        };
      }
      this.particles.push(p);
      return p;
    }
    // Ring overwrite — mutate oldest slot (cursor walks the dense array)
    const idx = this.writeCursor % this.particles.length;
    this.writeCursor++;
    return this.particles[idx]!;
  }

  step(dtTicks = 1): void {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i]!;
      p.life -= dtTicks;
      if (p.life <= 0) {
        // Swap-remove — no mid-array splice shift of the whole tail
        const last = this.particles.pop()!;
        if (i < this.particles.length) this.particles[i] = last;
        this.pool.push(p);
        continue;
      }
      if (p.kind === 'ring') {
        p.size += 1.2 * dtTicks;
        continue;
      }
      p.x += p.vx * 0.016 * dtTicks;
      p.y += p.vy * 0.016 * dtTicks;
      p.z += p.vz * 0.016 * dtTicks;
      p.vy -= 80 * 0.016 * dtTicks;
      if (p.y < 1) {
        if (p.kind === 'blood' && p.vy < 0) {
          this.leaveStain(p.x, p.z, p.size * 1.8, 0.35 + p.size * 0.15);
        }
        p.y = 1;
        p.vy *= -0.2;
        p.vx *= 0.85;
        p.vz *= 0.85;
      }
    }

    for (let i = this.stains.length - 1; i >= 0; i--) {
      const s = this.stains[i]!;
      s.life -= dtTicks;
      if (s.life <= 0) {
        const last = this.stains.pop()!;
        if (i < this.stains.length) this.stains[i] = last;
      }
    }
  }

  leaveStain(x: number, y: number, radius: number, strength: number): void {
    if (this.stains.length >= STAIN_CAP) {
      // Overwrite weakest / oldest
      let worst = 0;
      let worstLife = this.stains[0]!.life;
      for (let i = 1; i < this.stains.length; i++) {
        if (this.stains[i]!.life < worstLife) {
          worstLife = this.stains[i]!.life;
          worst = i;
        }
      }
      const s = this.stains[worst]!;
      s.x = x;
      s.y = y;
      s.radius = radius;
      s.strength = Math.min(1, strength);
      s.maxLife = 520;
      s.life = 520;
      return;
    }
    this.stains.push({
      x,
      y,
      radius,
      strength: Math.min(1, strength),
      maxLife: 520,
      life: 520,
    });
  }

  /** Heavier KO pool stain at contact. */
  leaveKoPool(x: number, y: number): void {
    this.leaveStain(x, y, 14, 0.85);
    this.leaveStain(x + 3, y - 2, 8, 0.55);
  }
}

export function recipeForEvent(kind: CombatEventKind): FxRecipe[] {
  return FX_RECIPES[kind] ?? [];
}

/** Scale recipe weights by cut-quality blood mul / event amount. */
export function scaleRecipes(recipes: FxRecipe[], bloodMul: number, amount = 1): FxRecipe[] {
  const amt = Math.max(0.5, Math.min(2.2, 0.75 + amount * 0.04));
  return recipes.map((r) => ({
    ...r,
    weight: (r.weight ?? 1) * (r.kind === 'blood' ? bloodMul * amt : r.kind === 'spark' ? 1 / Math.max(0.6, bloodMul) : amt * 0.5 + 0.5),
  }));
}
