import { colors } from '../content/palette';
import { combatTuning } from '../content/combat';
import { SeededRNG } from '../domain/rng';
import { ARENA_WORLD_H, ARENA_WORLD_W } from '../shell/canvas';
import type { FightStageLayout } from './layout';
import {
  bronzeStroke,
  materialCacheTag,
  mosaicFill,
  mosaicPalettes,
  stoneFill,
  woodFill,
} from './materials';

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
  stage?: FightStageLayout;
}

/** Afternoon sun — light from upper-left. */
export const SUN = { dx: -0.55, dy: -0.35 } as const;

const plateCache = new Map<string, HTMLCanvasElement | OffscreenCanvas>();

function getPlate(seed: number): HTMLCanvasElement | OffscreenCanvas {
  const key = `${materialCacheTag()}:${seed >>> 0}`;
  const hit = plateCache.get(key);
  if (hit) return hit;

  const c =
    typeof OffscreenCanvas !== 'undefined'
      ? new OffscreenCanvas(ARENA_WORLD_W, ARENA_WORLD_H)
      : document.createElement('canvas');
  c.width = ARENA_WORLD_W;
  c.height = ARENA_WORLD_H;
  const ctx = c.getContext('2d') as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
  if (!ctx) return c;

  paintStaticPlate(ctx as CanvasRenderingContext2D, new SeededRNG((seed >>> 0) ^ 0x40ca1c));
  plateCache.set(key, c);
  if (plateCache.size > 8) {
    const first = plateCache.keys().next().value;
    if (first != null) plateCache.delete(first);
  }
  return c;
}

export function drawArena(
  ctx: CanvasRenderingContext2D,
  shake = 0,
  opts?: ArenaDrawOpts,
): void {
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

  // Cave darkness behind the amphitheatre
  const sky = ctx.createLinearGradient(0, 0, 0, ARENA_WORLD_H);
  sky.addColorStop(0, '#2a1c12');
  sky.addColorStop(0.5, '#1e1610');
  sky.addColorStop(1, colors.bg);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, ARENA_WORLD_W, ARENA_WORLD_H);

  // Outer cavea — mosaic stone seating mass
  for (let band = 4; band >= 0; band--) {
    const orx = rx + 22 + band * 15;
    const ory = ry + 18 + band * 12;
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(cx, cy, orx, ory, 0, 0, Math.PI * 2);
    ctx.ellipse(cx, cy, orx - 14, ory - 11, 0, 0, Math.PI * 2);
    ctx.clip('evenodd');
    mosaicFill(ctx, cx - orx, cy - ory, orx * 2, ory * 2, {
      seed: rng.int(1, 999999) + band * 97,
      palette: mosaicPalettes.cavea,
      cell: 8 + band,
      grout: colors.grout,
    });
    ctx.restore();

    ctx.strokeStyle = `rgba(12,8,4,${0.25 + band * 0.05})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(cx, cy, orx - 1, ory - 1, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Crowd as denser mosaic flecks (no stick people)
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx + 78, ry + 62, 0, 0, Math.PI * 2);
  ctx.ellipse(cx, cy, rx + 24, ry + 18, 0, 0, Math.PI * 2);
  ctx.clip('evenodd');
  mosaicFill(ctx, cx - rx - 80, cy - ry - 64, (rx + 80) * 2, (ry + 64) * 2, {
    seed: rng.int(1, 999999),
    palette: [...mosaicPalettes.cavea, ...mosaicPalettes.ivory, ...mosaicPalettes.blood],
    cell: 6,
    grout: '#1e1812',
    jitter: 0.5,
  });
  ctx.restore();

  // Podium wall — rough stone ring
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

  // Gates — dark wood notches
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

  // —— Mosaic sand floor (the spectacle) ——
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.clip();
  mosaicFill(ctx, cx - rx, cy - ry, rx * 2, ry * 2, {
    seed: rng.int(1, 999999),
    palette: mosaicPalettes.sand,
    cell: 7,
    grout: '#6a5438',
    jitter: 0.4,
  });

  // Soft sun wash over tesserae
  const wash = ctx.createRadialGradient(
    cx + SUN.dx * 90,
    cy + SUN.dy * 70,
    20,
    cx,
    cy,
    rx,
  );
  wash.addColorStop(0, 'rgba(255,220,150,0.14)');
  wash.addColorStop(0.55, 'rgba(255,200,120,0.04)');
  wash.addColorStop(1, 'rgba(40,25,10,0.22)');
  ctx.fillStyle = wash;
  ctx.fillRect(cx - rx, cy - ry, rx * 2, ry * 2);

  // Central mosaic medallion
  ctx.beginPath();
  ctx.ellipse(cx, cy, 48, 22, 0, 0, Math.PI * 2);
  ctx.clip();
  mosaicFill(ctx, cx - 50, cy - 24, 100, 48, {
    seed: rng.int(1, 999999),
    palette: mosaicPalettes.bronze,
    cell: 5,
    grout: '#3a2a18',
  });
  ctx.restore();

  // Arena lip — bronze + stone
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

export function drawArenaChromeVignette(
  ctx: CanvasRenderingContext2D,
  stage: FightStageLayout,
): void {
  const { w, h } = stage;
  const box = stage.worldBox;

  if (stage.orientation === 'portrait') {
    ctx.fillStyle = colors.bg;
    if (box.y > stage.topBandH) {
      ctx.fillRect(0, stage.topBandH, w, box.y - stage.topBandH);
    }
    const below = box.y + box.h;
    if (below < stage.rosterBandTop) {
      ctx.fillRect(0, below, w, stage.rosterBandTop - below);
    }
  }

  // Soft vignette only in chrome bands — sand stays clean
  const topEnd = stage.topBandH + 36;
  const topG = ctx.createLinearGradient(0, 0, 0, topEnd);
  topG.addColorStop(0, 'rgba(18,12,8,0.78)');
  topG.addColorStop(0.55, 'rgba(18,12,8,0.28)');
  topG.addColorStop(1, 'rgba(18,12,8,0)');
  ctx.fillStyle = topG;
  ctx.fillRect(0, 0, w, topEnd);

  const botStart = stage.rosterBandTop - 32;
  const botG = ctx.createLinearGradient(0, botStart, 0, h);
  botG.addColorStop(0, 'rgba(18,12,8,0)');
  botG.addColorStop(0.4, 'rgba(18,12,8,0.32)');
  botG.addColorStop(1, 'rgba(18,12,8,0.72)');
  ctx.fillStyle = botG;
  ctx.fillRect(0, botStart, w, h - botStart);
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
    });
  }
  if (particles.length > 100) particles.splice(0, particles.length - 100);
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
    const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * (1.2 + t));
    g.addColorStop(0, `rgba(210,180,130,${0.22 + t * 0.4})`);
    g.addColorStop(1, 'rgba(160,120,70,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size * (0.8 + t * 0.6), 0, Math.PI * 2);
    ctx.fill();
  }
}
