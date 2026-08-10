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

/** Afternoon sun — light from upper-left; shadows fall down-right. */
export const SUN = { dx: -0.55, dy: -0.35 } as const;

const plateCache = new Map<number, HTMLCanvasElement | OffscreenCanvas>();

function getPlate(seed: number): HTMLCanvasElement | OffscreenCanvas {
  const key = seed >>> 0;
  const hit = plateCache.get(key);
  if (hit) return hit;

  const c =
    typeof OffscreenCanvas !== 'undefined'
      ? new OffscreenCanvas(ARENA_WORLD_W, ARENA_WORLD_H)
      : document.createElement('canvas');
  if ('width' in c) {
    c.width = ARENA_WORLD_W;
    c.height = ARENA_WORLD_H;
  }
  const ctx = c.getContext('2d') as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
  if (!ctx) return c;

  paintStaticPlate(ctx, new SeededRNG(key ^ 0xc0ffee));
  plateCache.set(key, c);
  // Bound memory — keep a few seeds for Instant Match rerolls
  if (plateCache.size > 8) {
    const first = plateCache.keys().next().value;
    if (first != null) plateCache.delete(first);
  }
  return c;
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
  const plate = getPlate(opts?.seed ?? 1);
  ctx.drawImage(plate as CanvasImageSource, 0, 0);
  ctx.restore();
}

function paintStaticPlate(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  rng: SeededRNG,
): void {
  const cx = combatTuning.arenaCX;
  const cy = combatTuning.arenaCY;
  const rx = combatTuning.arenaRX;
  const ry = combatTuning.arenaRY;

  // —— Cave / sky beyond the amphitheatre ——
  // Edge stops match colors.bg so zoom/pan never reveals a mismatched seam.
  const sky = ctx.createLinearGradient(0, 0, 0, ARENA_WORLD_H);
  sky.addColorStop(0, '#3c2c1e');
  sky.addColorStop(0.28, '#2a1e14');
  sky.addColorStop(0.62, '#201812');
  sky.addColorStop(1, colors.bg);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, ARENA_WORLD_W, ARENA_WORLD_H);

  // Warm haze bloom (sun side) — soft falloff, no hard rim
  const haze = ctx.createRadialGradient(
    cx + SUN.dx * 280,
    cy + SUN.dy * 200,
    20,
    cx,
    cy,
    Math.max(rx, ry) * 1.75,
  );
  haze.addColorStop(0, 'rgba(220,160,90,0.16)');
  haze.addColorStop(0.4, 'rgba(180,120,60,0.055)');
  haze.addColorStop(0.78, 'rgba(40,28,16,0.02)');
  haze.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = haze;
  ctx.fillRect(0, 0, ARENA_WORLD_W, ARENA_WORLD_H);

  // —— Cavea (stands) — concentric stone bands ——
  for (let band = 4; band >= 0; band--) {
    const t = band / 4;
    const orx = rx + 18 + band * 14;
    const ory = ry + 14 + band * 11;
    const g = ctx.createRadialGradient(cx, cy - 20, orx * 0.2, cx, cy, orx);
    g.addColorStop(0, `rgb(${72 + band * 6}, ${58 + band * 4}, ${42 + band * 3})`);
    g.addColorStop(1, `rgb(${38 + band * 4}, ${30 + band * 3}, ${22 + band * 2})`);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(cx, cy, orx, ory, 0, 0, Math.PI * 2);
    ctx.fill();

    // Stair riser shadow
    ctx.strokeStyle = `rgba(12,8,6,${0.18 + t * 0.12})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(cx, cy, orx - 1, ory - 1, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Crowd mass — soft mottled seats (no sprite people)
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx + 72, ry + 58, 0, 0, Math.PI * 2);
  ctx.ellipse(cx, cy, rx + 20, ry + 16, 0, 0, Math.PI * 2);
  ctx.clip('evenodd');
  for (let i = 0; i < 420; i++) {
    const a = rng.next() * Math.PI * 2;
    const d = 0.55 + rng.next() * 0.42;
    const x = cx + Math.cos(a) * (rx + 22) * d * 1.15;
    const y = cy + Math.sin(a) * (ry + 18) * d * 1.12;
    const cool = rng.chance(0.35);
    const alpha = 0.12 + rng.next() * 0.28;
    ctx.fillStyle = cool
      ? `rgba(${40 + rng.int(0, 30)}, ${50 + rng.int(0, 40)}, ${70 + rng.int(0, 40)},${alpha})`
      : `rgba(${90 + rng.int(0, 50)}, ${55 + rng.int(0, 30)}, ${40 + rng.int(0, 25)},${alpha})`;
    const s = 1.2 + rng.next() * 2.4;
    ctx.beginPath();
    ctx.ellipse(x, y, s * 0.7, s, rng.next() * 0.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // Podium / arena wall face
  const wallOuter = ctx.createRadialGradient(cx, cy, rx * 0.7, cx, cy, rx + 26);
  wallOuter.addColorStop(0, '#6a5a48');
  wallOuter.addColorStop(0.7, '#4a3c30');
  wallOuter.addColorStop(1, '#2e241c');
  ctx.fillStyle = wallOuter;
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx + 26, ry + 22, 0, 0, Math.PI * 2);
  ctx.fill();

  // Inner wall highlight (sun-lit rim)
  ctx.strokeStyle = 'rgba(210,180,130,0.22)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.ellipse(cx + SUN.dx * 4, cy + SUN.dy * 3, rx + 12, ry + 10, 0, -2.2, 0.4);
  ctx.stroke();

  // Gate notches (porta) — four cardinal cutouts suggestion
  ctx.fillStyle = 'rgba(18,12,8,0.55)';
  for (const a of [0, Math.PI / 2, Math.PI, (Math.PI * 3) / 2]) {
    const gx = cx + Math.cos(a) * (rx + 8);
    const gy = cy + Math.sin(a) * (ry + 6);
    ctx.beginPath();
    ctx.ellipse(gx, gy, 14, 10, a, 0, Math.PI * 2);
    ctx.fill();
  }

  // —— Sand floor ——
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.clip();

  const sand = ctx.createRadialGradient(
    cx + SUN.dx * 80,
    cy + SUN.dy * 60,
    30,
    cx,
    cy,
    rx * 1.05,
  );
  sand.addColorStop(0, '#e0c496');
  sand.addColorStop(0.45, colors.sand);
  sand.addColorStop(0.85, colors.sandDark);
  sand.addColorStop(1, '#7a6240');
  ctx.fillStyle = sand;
  ctx.fillRect(cx - rx, cy - ry, rx * 2, ry * 2);

  // Soft interior shadow under wall
  const innerShade = ctx.createRadialGradient(cx, cy, rx * 0.55, cx, cy, rx);
  innerShade.addColorStop(0, 'rgba(0,0,0,0)');
  innerShade.addColorStop(0.75, 'rgba(40,25,12,0.08)');
  innerShade.addColorStop(1, 'rgba(30,18,8,0.35)');
  ctx.fillStyle = innerShade;
  ctx.fillRect(cx - rx, cy - ry, rx * 2, ry * 2);

  // Scuff arcs / old blood-dark stains (subtle)
  for (let i = 0; i < 14; i++) {
    const a = rng.next() * Math.PI * 2;
    const d = 0.15 + rng.next() * 0.7;
    const x = cx + Math.cos(a) * rx * d;
    const y = cy + Math.sin(a) * ry * d;
    ctx.strokeStyle = `rgba(90,60,35,${0.06 + rng.next() * 0.1})`;
    ctx.lineWidth = 1 + rng.next() * 2;
    ctx.beginPath();
    ctx.ellipse(x, y, 18 + rng.next() * 40, 6 + rng.next() * 14, a, 0, Math.PI * 1.2);
    ctx.stroke();
  }

  // Grain
  for (let i = 0; i < 280; i++) {
    const u = rng.next() * 2 - 1;
    const v = rng.next() * 2 - 1;
    if (u * u + v * v > 1) continue;
    const x = cx + u * rx * 0.97;
    const y = cy + v * ry * 0.97;
    const a = 0.06 + rng.next() * 0.14;
    ctx.fillStyle = rng.chance(0.55)
      ? `rgba(70,50,30,${a})`
      : `rgba(230,210,170,${a})`;
    const w = 1 + (rng.chance(0.25) ? 1 : 0);
    ctx.fillRect(x, y, w, 1);
  }

  // Center compass / spatium mark
  ctx.strokeStyle = 'rgba(70,50,30,0.22)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.ellipse(cx, cy, 42, 18, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx - 22, cy);
  ctx.lineTo(cx + 22, cy);
  ctx.moveTo(cx, cy - 10);
  ctx.lineTo(cx, cy + 10);
  ctx.stroke();

  ctx.restore();

  // Arena lip stroke
  ctx.strokeStyle = 'rgba(20,14,10,0.55)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(200,170,120,0.15)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx - 2, ry - 2, 0, 0, Math.PI * 2);
  ctx.stroke();
}

/** Soft vignette over UI bands in design space (call after world transform restored). */
export function drawArenaChromeVignette(
  ctx: CanvasRenderingContext2D,
  stage: FightStageLayout,
): void {
  const { w, h } = stage;
  const box = stage.worldBox;

  // Fill any portrait band gaps with shell bg (no mismatched solid rectangles).
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

  // Top / bottom chrome wash — soft stops so bands don't hard-cut into the sand
  const topEnd = stage.topBandH + 36;
  const topG = ctx.createLinearGradient(0, 0, 0, topEnd);
  topG.addColorStop(0, 'rgba(12,8,6,0.78)');
  topG.addColorStop(0.55, 'rgba(12,8,6,0.35)');
  topG.addColorStop(0.88, 'rgba(12,8,6,0.08)');
  topG.addColorStop(1, 'rgba(12,8,6,0)');
  ctx.fillStyle = topG;
  ctx.fillRect(0, 0, w, topEnd);

  const botY = h - stage.chromeBottomH - 28;
  const botG = ctx.createLinearGradient(0, botY, 0, h);
  botG.addColorStop(0, 'rgba(12,8,6,0)');
  botG.addColorStop(0.22, 'rgba(12,8,6,0.12)');
  botG.addColorStop(0.55, 'rgba(12,8,6,0.5)');
  botG.addColorStop(1, 'rgba(12,8,6,0.82)');
  ctx.fillStyle = botG;
  ctx.fillRect(0, botY, w, h - botY);

  // Radial focus — eased outer stop so corners don't band
  const vig = ctx.createRadialGradient(
    w / 2,
    h * 0.42,
    Math.min(w, h) * 0.22,
    w / 2,
    h / 2,
    Math.max(w, h) * 0.78,
  );
  vig.addColorStop(0, 'rgba(0,0,0,0)');
  vig.addColorStop(0.55, 'rgba(8,5,3,0.06)');
  vig.addColorStop(0.85, 'rgba(8,5,3,0.22)');
  vig.addColorStop(1, 'rgba(8,5,3,0.36)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, w, h);
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
