import { colors } from '../content/palette';
import { combatTuning } from '../content/combat';
import { SeededRNG } from '../domain/rng';
import { ARENA_WORLD_H, ARENA_WORLD_W } from '../shell/canvas';
import { sharedAtlas } from '../gfx/atlas';
import { paintSunWash, SUN } from '../gfx/light';
import {
  bronzeStroke,
  materialCacheTag,
  paintCenterRing,
  sandFill,
  stoneFill,
  woodFill,
} from '../gfx/material';
import { valueNoise2 } from '../gfx/noise';

export interface DustParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  kind?: 'dust' | 'blood';
}

export interface ArenaDrawOpts {
  seed?: number;
}

export { SUN };

function plateKey(seed: number): string {
  return `${materialCacheTag()}:arena:${seed >>> 0}`;
}

function getPlate(seed: number): HTMLCanvasElement | OffscreenCanvas {
  const key = plateKey(seed);
  return sharedAtlas.getOrBake(key, ARENA_WORLD_W, ARENA_WORLD_H, (ctx) => {
    paintStaticPlate(ctx, new SeededRNG((seed >>> 0) ^ 0x40ca1c));
  });
}

export function drawArena(ctx: CanvasRenderingContext2D, shake = 0, opts?: ArenaDrawOpts): void {
  ctx.save();
  if (shake > 0) {
    ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
  }
  const plate = getPlate(opts?.seed ?? 1);
  ctx.drawImage(plate as CanvasImageSource, 0, 0);
  ctx.restore();
}

function paintStaticPlate(ctx: CanvasRenderingContext2D, rng: SeededRNG): void {
  const cx = combatTuning.arenaCX;
  const cy = combatTuning.arenaCY;
  const rx = combatTuning.arenaRX;
  const ry = combatTuning.arenaRY;

  paintSky(ctx);
  paintCavea(ctx, cx, cy, rx, ry, rng);
  paintCrowdSilhouettes(ctx, cx, cy, rx, ry, rng);
  paintPodium(ctx, cx, cy, rx, ry, rng);
  paintGates(ctx, cx, cy, rx, ry, rng);
  paintSandDisk(ctx, cx, cy, rx, ry, rng);
  paintArenaLip(ctx, cx, cy, rx, ry);
}

function paintSky(ctx: CanvasRenderingContext2D): void {
  const sky = ctx.createLinearGradient(0, 0, 0, ARENA_WORLD_H);
  sky.addColorStop(0, '#3a2414');
  sky.addColorStop(0.35, '#2a1c12');
  sky.addColorStop(0.7, '#1e1610');
  sky.addColorStop(1, colors.bg);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, ARENA_WORLD_W, ARENA_WORLD_H);

  // Soft haze
  const haze = ctx.createRadialGradient(
    ARENA_WORLD_W * 0.35,
    ARENA_WORLD_H * 0.15,
    20,
    ARENA_WORLD_W * 0.5,
    ARENA_WORLD_H * 0.4,
    ARENA_WORLD_W * 0.7,
  );
  haze.addColorStop(0, 'rgba(220,160,90,0.12)');
  haze.addColorStop(1, 'rgba(20,12,6,0)');
  ctx.fillStyle = haze;
  ctx.fillRect(0, 0, ARENA_WORLD_W, ARENA_WORLD_H);
}

function paintCavea(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  rng: SeededRNG,
): void {
  for (let band = 4; band >= 0; band--) {
    const orx = rx + 22 + band * 15;
    const ory = ry + 18 + band * 12;
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(cx, cy, orx, ory, 0, 0, Math.PI * 2);
    ctx.ellipse(cx, cy, orx - 14, ory - 11, 0, 0, Math.PI * 2);
    ctx.clip('evenodd');
    stoneFill(ctx, cx - orx, cy - ory, orx * 2, ory * 2, {
      seed: rng.int(1, 999999) + band * 97,
      cool: band % 2 === 0,
    });
    ctx.fillStyle = `rgba(12,8,4,${0.1 + band * 0.035})`;
    ctx.fillRect(cx - orx, cy - ory, orx * 2, ory * 2);
    ctx.restore();

    ctx.strokeStyle = `rgba(12,8,4,${0.22 + band * 0.05})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(cx, cy, orx - 1, ory - 1, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
}

/** Human-scale crowd blobs along cavea rings — not flecks. */
function paintCrowdSilhouettes(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  rng: SeededRNG,
): void {
  const seed = rng.int(1, 999999);
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx + 78, ry + 62, 0, 0, Math.PI * 2);
  ctx.ellipse(cx, cy, rx + 22, ry + 16, 0, 0, Math.PI * 2);
  ctx.clip('evenodd');

  stoneFill(ctx, cx - rx - 80, cy - ry - 64, (rx + 80) * 2, (ry + 64) * 2, {
    seed,
    cool: true,
  });

  const rows = 4;
  for (let row = 0; row < rows; row++) {
    const t = 0.28 + row * 0.16;
    const count = 48 + row * 12;
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + row * 0.07;
      const jitter = (valueNoise2(i * 0.37, row * 2.1, seed) - 0.5) * 0.04;
      const px = cx + Math.cos(a + jitter) * (rx + 26 + t * 50);
      const py = cy + Math.sin(a + jitter) * (ry + 18 + t * 42);
      const n = valueNoise2(px * 0.08, py * 0.08, seed ^ 0xc0d1);
      const bw = 2.2 + n * 2.4;
      const bh = 3.5 + n * 4.5;
      const shade = 0.22 + n * 0.35;
      ctx.fillStyle =
        n > 0.72
          ? `rgba(180,140,100,${0.12 + n * 0.12})`
          : `rgba(18,12,8,${shade})`;
      ctx.beginPath();
      ctx.ellipse(px, py - bh * 0.15, bw * 0.55, bh * 0.55, 0, 0, Math.PI * 2);
      ctx.fill();
      // torso stub
      ctx.fillRect(px - bw * 0.35, py, bw * 0.7, bh * 0.55);
    }
  }
  ctx.restore();
}

function paintPodium(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  rng: SeededRNG,
): void {
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx + 28, ry + 24, 0, 0, Math.PI * 2);
  ctx.ellipse(cx, cy, rx + 2, ry + 2, 0, 0, Math.PI * 2);
  ctx.clip('evenodd');
  stoneFill(ctx, cx - rx - 30, cy - ry - 26, (rx + 30) * 2, (ry + 26) * 2, {
    seed: rng.int(1, 999999),
  });
  ctx.restore();

  bronzeStroke(
    ctx,
    () => {
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx + 14, ry + 12, 0, 0, Math.PI * 2);
    },
    1.5,
  );
}

function paintGates(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  rng: SeededRNG,
): void {
  for (const a of [0, Math.PI / 2, Math.PI, (Math.PI * 3) / 2]) {
    const gx = cx + Math.cos(a) * (rx + 10);
    const gy = cy + Math.sin(a) * (ry + 8);
    ctx.save();
    ctx.translate(gx, gy);
    ctx.rotate(a);
    woodFill(ctx, -16, -10, 32, 20, { seed: rng.int(1, 999999), tone: 'dark' });
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.strokeRect(-16, -10, 32, 20);
    ctx.restore();
  }
}

function paintSandDisk(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  rng: SeededRNG,
): void {
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.clip();
  sandFill(ctx, cx - rx, cy - ry, rx * 2, ry * 2, { seed: rng.int(1, 999999) });
  paintSunWash(ctx, cx, cy, rx, ry);
  paintCenterRing(ctx, cx, cy, 48, 22);
  ctx.restore();
}

function paintArenaLip(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
): void {
  ctx.strokeStyle = 'rgba(20,12,6,0.65)';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.stroke();
  bronzeStroke(
    ctx,
    () => {
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx - 2, ry - 2, 0, 0, Math.PI * 2);
    },
    1.25,
  );
}

export function spawnDust(
  particles: DustParticle[],
  x: number,
  y: number,
  count: number,
  rng: SeededRNG,
  kind: 'dust' | 'blood' = 'dust',
): void {
  for (let i = 0; i < count; i++) {
    const ang = rng.next() * Math.PI * 2;
    const spd = 0.35 + rng.next() * 1.8;
    const life = 16 + rng.int(0, 22);
    particles.push({
      x: x + (rng.next() - 0.5) * 10,
      y: y + (rng.next() - 0.5) * 8,
      vx: Math.cos(ang) * spd + SUN.dx * -0.15,
      vy: Math.sin(ang) * spd * 0.65 - 0.25,
      life,
      maxLife: life,
      size: 1.2 + rng.next() * 2.2,
      kind,
    });
  }
  if (particles.length > 120) particles.splice(0, particles.length - 120);
}

export function stepDust(particles: DustParticle[]): void {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i]!;
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.035;
    p.vx *= 0.965;
    p.life--;
    if (p.life <= 0) particles.splice(i, 1);
  }
}

export function drawDust(ctx: CanvasRenderingContext2D, particles: readonly DustParticle[]): void {
  for (const p of particles) {
    const t = p.life / p.maxLife;
    if (p.kind === 'blood') {
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * (1.1 + t));
      g.addColorStop(0, `rgba(140,30,24,${0.35 + t * 0.45})`);
      g.addColorStop(1, 'rgba(80,10,8,0)');
      ctx.fillStyle = g;
    } else {
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * (1.2 + t));
      g.addColorStop(0, `rgba(210,180,130,${0.22 + t * 0.4})`);
      g.addColorStop(1, 'rgba(160,120,70,0)');
      ctx.fillStyle = g;
    }
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size * (0.8 + t * 0.6), 0, Math.PI * 2);
    ctx.fill();
  }
}
