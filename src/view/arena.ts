import { colors } from '../content/palette';
import { combatTuning } from '../content/combat';
import { SeededRNG } from '../domain/rng';
import { ARENA_WORLD_H, ARENA_WORLD_W } from '../shell/canvas';
import type { FightStageLayout } from './layout';

export interface DustParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
}

export interface ArenaDrawOpts {
  seed?: number;
  /** When set, paints vignette using live chrome bands. */
  stage?: FightStageLayout;
}

/**
 * Draw the sand oval in arena-world coordinates (960×540).
 * Caller applies world→design transform before calling.
 */
export function drawArena(
  ctx: CanvasRenderingContext2D,
  shake = 0,
  opts?: ArenaDrawOpts,
): void {
  ctx.save();
  if (shake > 0) {
    ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
  }

  ctx.fillStyle = '#2a1f18';
  ctx.fillRect(0, 0, ARENA_WORLD_W, ARENA_WORLD_H);

  // Outer stone ring
  ctx.fillStyle = '#4a3c30';
  ctx.beginPath();
  ctx.ellipse(
    combatTuning.arenaCX,
    combatTuning.arenaCY,
    combatTuning.arenaRX + 28,
    combatTuning.arenaRY + 24,
    0,
    0,
    Math.PI * 2,
  );
  ctx.fill();

  // Crowd ticks — slight seeded length variance
  const rng = new SeededRNG((opts?.seed ?? 1) ^ 0xc0ffee);
  ctx.strokeStyle = 'rgba(20,14,10,0.45)';
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.ellipse(
    combatTuning.arenaCX,
    combatTuning.arenaCY,
    combatTuning.arenaRX + 22,
    combatTuning.arenaRY + 18,
    0,
    0,
    Math.PI * 2,
  );
  ctx.stroke();

  // Sparse crowd notch marks
  ctx.strokeStyle = 'rgba(20,14,10,0.35)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 48; i++) {
    const a = (i / 48) * Math.PI * 2 + rng.next() * 0.04;
    const jitter = 0.85 + rng.next() * 0.3;
    const rx = combatTuning.arenaRX + 22;
    const ry = combatTuning.arenaRY + 18;
    const x0 = combatTuning.arenaCX + Math.cos(a) * rx;
    const y0 = combatTuning.arenaCY + Math.sin(a) * ry;
    const x1 = combatTuning.arenaCX + Math.cos(a) * (rx + 6 * jitter);
    const y1 = combatTuning.arenaCY + Math.sin(a) * (ry + 5 * jitter);
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
  }

  // Sand
  const sand = ctx.createRadialGradient(
    combatTuning.arenaCX,
    combatTuning.arenaCY,
    40,
    combatTuning.arenaCX,
    combatTuning.arenaCY,
    combatTuning.arenaRX,
  );
  sand.addColorStop(0, '#d2b48a');
  sand.addColorStop(1, colors.sandDark);
  ctx.fillStyle = sand;
  ctx.beginPath();
  ctx.ellipse(
    combatTuning.arenaCX,
    combatTuning.arenaCY,
    combatTuning.arenaRX,
    combatTuning.arenaRY,
    0,
    0,
    Math.PI * 2,
  );
  ctx.fill();

  drawSandGrain(ctx, rng);

  // Center mark
  ctx.strokeStyle = 'rgba(80,60,40,0.28)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(combatTuning.arenaCX, combatTuning.arenaCY, 36, 16, 0, 0, Math.PI * 2);
  ctx.stroke();

  ctx.restore();
}

/** Soft vignette over UI bands in design space (call after world transform restored). */
export function drawArenaChromeVignette(
  ctx: CanvasRenderingContext2D,
  stage: FightStageLayout,
): void {
  ctx.fillStyle = 'rgba(20,14,10,0.38)';
  ctx.fillRect(0, 0, stage.w, stage.topBandH);
  ctx.fillRect(0, stage.h - stage.chromeBottomH, stage.w, stage.chromeBottomH);
  if (stage.orientation === 'portrait') {
    // Fill gaps beside the letterboxed arena with shell bg tone
    const v = stage.world.view;
    ctx.fillStyle = '#2a1f18';
    if (v.y > stage.topBandH) {
      ctx.fillRect(0, stage.topBandH, stage.w, v.y - stage.topBandH);
    }
    const below = v.y + v.h;
    if (below < stage.rosterBandTop) {
      ctx.fillRect(0, below, stage.w, stage.rosterBandTop - below);
    }
  }
}

function drawSandGrain(ctx: CanvasRenderingContext2D, rng: SeededRNG): void {
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(
    combatTuning.arenaCX,
    combatTuning.arenaCY,
    combatTuning.arenaRX,
    combatTuning.arenaRY,
    0,
    0,
    Math.PI * 2,
  );
  ctx.clip();

  for (let i = 0; i < 90; i++) {
    // Rejection-sample roughly inside ellipse
    const u = rng.next() * 2 - 1;
    const v = rng.next() * 2 - 1;
    if (u * u + v * v > 1) continue;
    const x = combatTuning.arenaCX + u * combatTuning.arenaRX * 0.96;
    const y = combatTuning.arenaCY + v * combatTuning.arenaRY * 0.96;
    const a = 0.08 + rng.next() * 0.12;
    ctx.fillStyle = rng.chance(0.5) ? `rgba(90,70,45,${a})` : `rgba(210,190,150,${a})`;
    ctx.fillRect(x, y, 1 + (rng.chance(0.3) ? 1 : 0), 1);
  }
  ctx.restore();
}

export function spawnDust(
  particles: DustParticle[],
  x: number,
  y: number,
  count: number,
  rng: SeededRNG,
): void {
  for (let i = 0; i < count; i++) {
    const ang = rng.next() * Math.PI * 2;
    const spd = 0.4 + rng.next() * 1.6;
    const life = 14 + rng.int(0, 18);
    particles.push({
      x: x + (rng.next() - 0.5) * 8,
      y: y + (rng.next() - 0.5) * 6,
      vx: Math.cos(ang) * spd,
      vy: Math.sin(ang) * spd * 0.7 - 0.3,
      life,
      maxLife: life,
      size: 1 + rng.next() * 1.8,
    });
  }
  // Cap for performance
  if (particles.length > 80) particles.splice(0, particles.length - 80);
}

export function stepDust(particles: DustParticle[]): void {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i]!;
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.04;
    p.vx *= 0.96;
    p.life--;
    if (p.life <= 0) particles.splice(i, 1);
  }
}

export function drawDust(ctx: CanvasRenderingContext2D, particles: readonly DustParticle[]): void {
  for (const p of particles) {
    const t = p.life / p.maxLife;
    ctx.fillStyle = `rgba(180,150,100,${0.15 + t * 0.35})`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size * (0.6 + t * 0.4), 0, Math.PI * 2);
    ctx.fill();
  }
}
