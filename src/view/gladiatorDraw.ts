import { ARMATURAE, effectiveAttackArc } from '../content/armatura';
import { ARMATURA_LOOK, massScale, type ArmaturaLook } from '../content/appearance';
import { BEASTS } from '../content/beasts';
import { colors } from '../content/palette';
import type { FighterSnapshot } from '../domain/combat/types';
import { SUN } from './arena';
import { mosaicFill, mosaicPalettes } from './materials';
import { fontStack, typeScale } from './theme';
import { bar } from './ui';

type Pose = 'idle' | 'windup' | 'strike' | 'recover' | 'guard' | 'sidestep' | 'broken' | 'fallen';

function poseOf(f: FighterSnapshot): Pose {
  if (!f.alive) return 'fallen';
  if (f.poiseBroken) return 'broken';
  if (f.guarding) return 'guard';
  if (f.action === 'SIDESTEP' && f.phase !== 'IDLE') return 'sidestep';
  if (f.action === 'ATTACK') {
    if (f.phase === 'WINDUP') return 'windup';
    if (f.phase === 'ACTIVE') return 'strike';
    if (f.phase === 'RECOVER') return 'recover';
  }
  return 'idle';
}

export interface DrawGladiatorOpts {
  /** Team-tinted ring under glyph */
  selected?: boolean;
  /** Small name under bars only while selected */
  showSelectedName?: boolean;
  /** Menu / posed preview — glyphs only, no combat meters. */
  hideBars?: boolean;
}

/** Top-down class glyph: silhouette matches kit geometry. */
export function drawGladiator(
  ctx: CanvasRenderingContext2D,
  f: FighterSnapshot,
  opts?: DrawGladiatorOpts,
): void {
  drawGladiatorGlyph(ctx, f, opts?.hideBars !== true, opts);
}

function drawBeastGlyph(
  ctx: CanvasRenderingContext2D,
  f: FighterSnapshot,
  withBars: boolean,
  opts?: DrawGladiatorOpts,
): void {
  const beast = f.beastId ? BEASTS[f.beastId] : BEASTS.LION;
  const teamTint = f.team === 0 ? colors.ally : colors.foe;
  const scale = massScale(beast.mass) * 1.05;
  const pose = poseOf(f);

  ctx.save();
  ctx.translate(f.x, f.y);
  if (opts?.selected) drawSelectionRing(ctx, teamTint, scale);
  drawGroundShadow(ctx, scale * 1.15, pose === 'fallen');

  if (pose === 'fallen') {
    ctx.rotate(f.facing + 0.5);
    ctx.globalAlpha = 0.5;
  } else {
    ctx.rotate(f.facing);
  }

  // Mosaic beast mass
  const brx = 14 * scale;
  const bry = 9 * scale;
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(0, 0, brx, bry, 0, 0, Math.PI * 2);
  ctx.clip();
  mosaicFill(ctx, -brx - 2, -bry - 2, brx * 2 + 4, bry * 2 + 4, {
    seed: (f.beastId?.length ?? 1) * 41,
    palette: [beast.color, lighten(beast.color, 0.15), darken(beast.color, 0.2), ...mosaicPalettes.cavea],
    cell: Math.max(3, 4 * scale),
    grout: colors.grout,
  });
  ctx.restore();
  ctx.strokeStyle = teamTint;
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.ellipse(0, 0, brx, bry, 0, 0, Math.PI * 2);
  ctx.stroke();

  // Head / snout forward
  const headG = ctx.createRadialGradient(14 * scale, -1, 0, 11 * scale, 0, 7 * scale);
  headG.addColorStop(0, '#4a3828');
  headG.addColorStop(1, '#1a1410');
  ctx.fillStyle = headG;
  ctx.beginPath();
  ctx.ellipse(11 * scale, 0, 6 * scale, 4.5 * scale, 0, 0, Math.PI * 2);
  ctx.fill();

  // Mane / bristling for lion & boar
  if (f.beastId === 'LION' || f.beastId === 'BOAR') {
    ctx.strokeStyle = f.beastId === 'LION' ? '#8a6a28' : '#3a2a18';
    ctx.lineWidth = 2.2;
    for (let i = -4; i <= 4; i++) {
      const a = (i / 4) * 1.05;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * 7 * scale, Math.sin(a) * 6 * scale);
      ctx.lineTo(Math.cos(a) * 14 * scale, Math.sin(a) * 11 * scale);
      ctx.stroke();
    }
  }

  // Leopard spots
  if (f.beastId === 'LEOPARD') {
    ctx.fillStyle = 'rgba(40,28,12,0.45)';
    for (const [sx, sy] of [
      [-4, -3],
      [2, 3],
      [-6, 2],
      [4, -2],
      [0, 0],
    ] as const) {
      ctx.beginPath();
      ctx.ellipse(sx * scale, sy * scale, 1.6 * scale, 1.2 * scale, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Strike cue
  if (pose === 'strike' || pose === 'windup') {
    ctx.strokeStyle = `rgba(232,196,122,${pose === 'strike' ? 0.75 : 0.4})`;
    ctx.lineWidth = 3.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(12 * scale, 0);
    ctx.lineTo(24 * scale, 0);
    ctx.stroke();
  }

  ctx.restore();
  if (withBars) drawBars(ctx, f, opts?.showSelectedName === true);
}

function drawGladiatorGlyph(
  ctx: CanvasRenderingContext2D,
  f: FighterSnapshot,
  withBars: boolean,
  opts?: DrawGladiatorOpts,
): void {
  if (f.kind === 'beast' || f.beastId) {
    drawBeastGlyph(ctx, f, withBars, opts);
    return;
  }

  const def = ARMATURAE[f.armatura];
  const look = ARMATURA_LOOK[f.armatura];
  const teamTint = f.team === 0 ? colors.ally : colors.foe;
  const scale = massScale(def.mass);
  const pose = poseOf(f);
  const phaseT = f.phaseMax > 0 ? f.phaseT / f.phaseMax : 0;

  ctx.save();
  ctx.translate(f.x, f.y);

  if (opts?.selected) drawSelectionRing(ctx, teamTint, scale);
  drawGroundShadow(ctx, scale, pose === 'fallen');
  drawAuras(ctx, f, scale);

  if (pose === 'fallen') {
    ctx.rotate(f.facing + 0.7);
    ctx.globalAlpha = 0.5;
    drawBody(ctx, look, teamTint, scale, 'fallen');
    drawHelm(ctx, look, scale, 'fallen');
    ctx.restore();
    if (withBars) drawBars(ctx, f, opts?.showSelectedName === true);
    return;
  }

  const drawArc = effectiveAttackArc(def, f.footwork);
  drawCones(ctx, f, def.attackRange, drawArc, def.guardArc, pose, phaseT);

  ctx.rotate(f.facing);

  const weaponLen = weaponLength(def.attackRange, look, pose);
  const shieldDrop = pose === 'broken' ? 0.35 : pose === 'guard' ? -0.1 : 0;
  const wAngle = weaponAngleForPose(look, pose, phaseT);
  const mainDist = look.mainHandDist * scale;
  const offDist = look.offHandDist * scale;

  if (look.shield) {
    drawShield(ctx, look, scale, look.offHandAngle + shieldDrop, offDist, pose);
  }
  if (look.net) {
    drawNet(ctx, look, scale, look.offHandAngle, offDist, pose, phaseT);
  }
  if (look.scissorArm) {
    drawScissorArm(ctx, look, scale, look.offHandAngle + shieldDrop, offDist, pose);
  }

  drawBody(ctx, look, teamTint, scale, pose);
  drawHelm(ctx, look, scale, pose);

  if (f.flash > 0) {
    ctx.fillStyle = `rgba(255,245,220,${0.2 + f.flash * 0.08})`;
    ctx.beginPath();
    ctx.ellipse(0, 0, look.bodyRx * scale, look.bodyRy * scale, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  drawWeapon(ctx, look, scale, weaponLen, look.mainHandAngle, mainDist, wAngle, pose);
  if (look.dualBlade) {
    drawWeapon(
      ctx,
      look,
      scale,
      weaponLen * 0.9,
      look.offHandAngle,
      offDist,
      -wAngle * 0.8 - 0.12,
      pose,
    );
  }

  ctx.restore();
  if (withBars) drawBars(ctx, f, opts?.showSelectedName === true);
}

function drawGroundShadow(
  ctx: CanvasRenderingContext2D,
  scale: number,
  fallen: boolean,
): void {
  // Soft contact with sand — radial falloff, sun-biased offset + dark core
  const ox = -SUN.dx * 11 * scale;
  const oy = -SUN.dy * 9 * scale;
  const rx = (fallen ? 22 : 17) * scale;
  const ry = (fallen ? 11 : 8) * scale;
  const g = ctx.createRadialGradient(ox, oy + 3, 0, ox, oy + 3, rx);
  g.addColorStop(0, fallen ? 'rgba(12,8,4,0.62)' : 'rgba(12,8,4,0.55)');
  g.addColorStop(0.4, fallen ? 'rgba(12,8,4,0.28)' : 'rgba(12,8,4,0.24)');
  g.addColorStop(1, 'rgba(12,8,4,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(ox, oy + 3, rx, ry, 0.35, 0, Math.PI * 2);
  ctx.fill();
}

function lighten(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, ((n >> 16) & 255) + Math.round(255 * amt));
  const g = Math.min(255, ((n >> 8) & 255) + Math.round(255 * amt));
  const b = Math.min(255, (n & 255) + Math.round(255 * amt));
  return `rgb(${r},${g},${b})`;
}

function darken(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, ((n >> 16) & 255) - Math.round(255 * amt));
  const g = Math.max(0, ((n >> 8) & 255) - Math.round(255 * amt));
  const b = Math.max(0, (n & 255) - Math.round(255 * amt));
  return `rgb(${r},${g},${b})`;
}

function drawSelectionRing(
  ctx: CanvasRenderingContext2D,
  teamTint: string,
  scale: number,
): void {
  // Soft washed ellipse — team structure + bronze plaque lip (matches meters/rails)
  ctx.fillStyle = teamTint;
  ctx.globalAlpha = 0.12;
  ctx.beginPath();
  ctx.ellipse(0, 3, 19 * scale, 11.5 * scale, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = teamTint;
  ctx.globalAlpha = 0.28;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.ellipse(0, 3, 18 * scale, 11 * scale, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = colors.bronze;
  ctx.globalAlpha = 0.35;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.ellipse(0, 3, 20 * scale, 12.2 * scale, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 1;
}

function weaponLength(attackRange: number, look: ArmaturaLook, pose: Pose): number {
  const frac =
    pose === 'strike'
      ? look.weaponActiveFrac
      : pose === 'windup'
        ? look.weaponIdleFrac * 0.75
        : pose === 'recover'
          ? look.weaponIdleFrac * 0.85
          : look.weaponIdleFrac;
  return Math.min(42, Math.max(14, attackRange * frac * 0.55));
}

/** Tip direction relative to facing (+X). Small bias keeps blades reading from the hand. */
function weaponAngleForPose(look: ArmaturaLook, pose: Pose, phaseT: number): number {
  const handBias = look.mainHandAngle > 0 ? 0.12 : look.mainHandAngle < 0 ? -0.12 : 0;
  if (look.curvedBlade) {
    if (pose === 'windup') return -0.4 - phaseT * 0.2 + handBias;
    if (pose === 'strike') return 0.28 + phaseT * 0.15 + handBias;
    if (pose === 'recover') return 0.1 + handBias;
    return -0.08 + handBias;
  }
  if (pose === 'windup') return -0.22 - phaseT * 0.12 + handBias;
  if (pose === 'strike') return 0.04 + handBias * 0.5;
  if (pose === 'recover') return 0.12 + handBias;
  if (pose === 'guard') return -0.06 + handBias;
  if (pose === 'broken') return 0.35 + handBias;
  return handBias * 0.35;
}

function drawAuras(ctx: CanvasRenderingContext2D, f: FighterSnapshot, scale: number): void {
  if (f.stunned) {
    ctx.fillStyle = colors.bronzeHot;
    ctx.globalAlpha = 0.18;
    ctx.beginPath();
    ctx.arc(0, 0, 22 * scale, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  if (f.tangled) {
    ctx.strokeStyle = colors.parchment;
    ctx.globalAlpha = 0.45;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, 0, 20 * scale, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  if (f.poiseBroken) {
    ctx.strokeStyle = colors.stamina;
    ctx.globalAlpha = 0.8;
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.arc(0, 0, 19 * scale, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
  }
}

function drawCones(
  ctx: CanvasRenderingContext2D,
  f: FighterSnapshot,
  attackRange: number,
  attackArc: number,
  guardArc: number,
  pose: Pose,
  phaseT: number,
): void {
  if (pose === 'guard' && guardArc > 0.05) {
    const thick = f.armatura === 'MURMILLO' ? 0.7 : f.armatura === 'THRAEX' ? 0.45 : 0.3;
    const soft =
      f.poiseTier === 'SOFT' ? 0.7 : f.poiseTier === 'CRITICAL' ? 0.45 : 1;
    const core = guardArc * (0.72 + soft * 0.28);
    // Poise meter blue — same token family as HUD bars
    const [pr, pg, pb] = hexRgb(colors.poise);
    ctx.fillStyle = `rgba(${pr},${pg},${pb},${(0.08 + thick * 0.07) * soft})`;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, attackRange * (0.4 + thick * 0.2), f.facing - guardArc, f.facing + guardArc);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = `rgba(${pr},${pg},${pb},${(0.16 + thick * 0.12) * soft})`;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, attackRange * (0.4 + thick * 0.2), f.facing - core, f.facing + core);
    ctx.closePath();
    ctx.fill();
  }
  if (pose === 'windup' || pose === 'strike') {
    if (pose === 'windup') {
      const [br, bg, bb] = hexRgb(colors.bronzeHot);
      ctx.fillStyle = `rgba(${br},${bg},${bb},${0.1 + phaseT * 0.18})`;
    } else {
      const [ar, ag, ab] = hexRgb(colors.accentHot);
      ctx.fillStyle = `rgba(${ar},${ag},${ab},0.22)`;
    }
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, attackRange, f.facing - attackArc, f.facing + attackArc);
    ctx.closePath();
    ctx.fill();
  }
}

function hexRgb(hex: string): [number, number, number] {
  const full =
    hex.length === 4
      ? `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`
      : hex;
  const n = parseInt(full.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function drawBody(
  ctx: CanvasRenderingContext2D,
  look: ArmaturaLook,
  teamTint: string,
  scale: number,
  pose: Pose,
): void {
  const rx = look.bodyRx * scale * (pose === 'sidestep' ? 0.92 : 1);
  const ry = look.bodyRy * scale * (pose === 'guard' ? 1.08 : 1);
  const teamPal = teamTint === colors.ally ? mosaicPalettes.team0 : mosaicPalettes.team1;

  // Mosaic tessera body — inlaid figure, not soft blob
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
  ctx.clip();
  mosaicFill(ctx, -rx - 2, -ry - 2, rx * 2 + 4, ry * 2 + 4, {
    seed: Math.round(look.bodyRx * 100 + look.bodyRy * 50),
    palette: [...teamPal, look.bodyFill, look.leather],
    cell: Math.max(3, 4.5 * scale),
    grout: colors.grout,
    jitter: 0.45,
  });
  // Flesh/leather wash so kit still reads
  const wash = ctx.createRadialGradient(SUN.dx * rx * 0.4, SUN.dy * ry * 0.4, 0, 0, 0, rx);
  wash.addColorStop(0, 'rgba(255,230,190,0.12)');
  wash.addColorStop(0.55, 'rgba(0,0,0,0)');
  wash.addColorStop(1, 'rgba(20,10,5,0.28)');
  ctx.fillStyle = wash;
  ctx.fillRect(-rx, -ry, rx * 2, ry * 2);
  ctx.restore();

  ctx.strokeStyle = 'rgba(20,12,6,0.75)';
  ctx.lineWidth = 1.6 * scale;
  ctx.beginPath();
  ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = colors.bronze;
  ctx.globalAlpha = 0.35;
  ctx.lineWidth = 1 * scale;
  ctx.stroke();
  ctx.globalAlpha = 1;

  // Team sash — bronze-edged cloth
  ctx.strokeStyle = teamTint;
  ctx.lineWidth = 3.2 * scale;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-rx * 0.72, -ry * 0.12);
  ctx.lineTo(rx * 0.32, -ry * 0.12);
  ctx.stroke();

  ctx.strokeStyle = look.leather;
  ctx.lineWidth = 2 * scale;
  ctx.beginPath();
  ctx.arc(rx * 0.35, 0, ry * 0.55, -0.8, 0.8);
  ctx.stroke();

  if (look.breastplate) {
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(1 * scale, 0, rx * 0.55, ry * 0.7, 0, 0, Math.PI * 2);
    ctx.clip();
    mosaicFill(ctx, -rx, -ry, rx * 2, ry * 2, {
      seed: 99,
      palette: mosaicPalettes.bronze,
      cell: 3.5 * scale,
      grout: '#3a2a18',
    });
    ctx.restore();
    ctx.strokeStyle = look.leather;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.ellipse(1 * scale, 0, rx * 0.55, ry * 0.7, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function drawHelm(
  ctx: CanvasRenderingContext2D,
  look: ArmaturaLook,
  scale: number,
  pose: Pose,
): void {
  const hx = look.bodyRx * scale * 0.15;
  const hy = -look.bodyRy * scale * 0.55;
  const brokenTip = pose === 'broken' ? 0.25 : 0;

  if (look.bareHead) {
    ctx.fillStyle = '#e6d3b0';
    ctx.beginPath();
    ctx.arc(hx, hy + brokenTip * 4, 4.2 * scale, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = look.cloth;
    ctx.beginPath();
    ctx.ellipse(-2 * scale, 2 * scale, 5 * scale, 3 * scale, -0.4, 0, Math.PI * 2);
    ctx.fill();
    return;
  }

  const hy0 = hy + brokenTip * 3;
  const metalFill = (cx: number, cy: number, r: number): void => {
    const hg = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.4, 0, cx, cy, r);
    hg.addColorStop(0, lighten(look.metal, 0.38));
    hg.addColorStop(0.45, look.metal);
    hg.addColorStop(1, darken(look.metal, 0.28));
    ctx.fillStyle = hg;
  };

  if (look.smoothHelm) {
    // Secutor / Scissor: round bowl, tiny eye slits
    metalFill(hx, hy0, 5.8 * scale);
    ctx.beginPath();
    ctx.arc(hx, hy0, 5.8 * scale, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1a1410';
    ctx.fillRect(hx + 1.5 * scale, hy - 1 * scale, 2.2 * scale, 1.2 * scale);
    return;
  }

  metalFill(hx, hy0, 5.5 * scale);
  ctx.beginPath();
  ctx.ellipse(hx, hy0, 5.5 * scale, 4.5 * scale, 0, 0, Math.PI * 2);
  ctx.fill();

  if (!look.crest) {
    // Thraex / Hop brim — lit from sunward edge
    const brim = ctx.createLinearGradient(hx - 6 * scale, hy, hx + 7 * scale, hy - 2 * scale);
    brim.addColorStop(0, darken(look.metal, 0.2));
    brim.addColorStop(0.4, lighten(look.metal, 0.22));
    brim.addColorStop(1, look.metal);
    ctx.fillStyle = brim;
    ctx.beginPath();
    ctx.moveTo(hx - 6 * scale, hy);
    ctx.lineTo(hx + 7 * scale, hy - 2 * scale);
    ctx.lineTo(hx + 5 * scale, hy + 3 * scale);
    ctx.closePath();
    ctx.fill();
  }

  if (look.crest) {
    ctx.fillStyle = colors.accentHot;
    ctx.beginPath();
    ctx.moveTo(hx - 1.5 * scale, hy - 4 * scale);
    ctx.lineTo(hx + 1.5 * scale, hy - 4 * scale);
    ctx.lineTo(hx + 0.5 * scale, hy - 11 * scale);
    ctx.lineTo(hx - 0.5 * scale, hy - 11 * scale);
    ctx.closePath();
    ctx.fill();
  }
}

function drawShield(
  ctx: CanvasRenderingContext2D,
  look: ArmaturaLook,
  scale: number,
  angle: number,
  handDist: number,
  pose: Pose,
): void {
  const dist = pose === 'guard' ? handDist * 1.15 : handDist;
  const sx = Math.cos(angle) * dist;
  const sy = Math.sin(angle) * dist;
  const big = !look.roundShield;
  const rw = (look.roundShield ? 5.5 : big ? 7 : 4.5) * scale * (pose === 'broken' ? 0.85 : 1);
  const rh =
    (look.roundShield ? 5.5 : big ? 10 : 6.5) * scale * (pose === 'guard' ? 1.12 : 1);

  ctx.save();
  ctx.translate(sx, sy);
  ctx.rotate(angle + Math.PI / 2 + (pose === 'broken' ? 0.5 : 0));
  const sg = ctx.createRadialGradient(-rw * 0.3, -rh * 0.3, 0, 0, 0, Math.max(rw, rh));
  sg.addColorStop(0, lighten(look.metal, 0.35));
  sg.addColorStop(0.45, look.metal);
  sg.addColorStop(1, darken(look.metal, 0.25));
  ctx.fillStyle = sg;
  ctx.beginPath();
  ctx.ellipse(0, 0, rw, rh, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = look.leather;
  ctx.lineWidth = 1.4;
  ctx.stroke();
  // Boss
  const boss = ctx.createRadialGradient(-0.5, -0.5, 0, 0, 0, 2.2 * scale);
  boss.addColorStop(0, '#f0e6c8');
  boss.addColorStop(1, '#8a7850');
  ctx.fillStyle = boss;
  ctx.beginPath();
  ctx.arc(0, 0, 1.8 * scale, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawNet(
  ctx: CanvasRenderingContext2D,
  look: ArmaturaLook,
  scale: number,
  angle: number,
  handDist: number,
  pose: Pose,
  phaseT: number,
): void {
  const flare = pose === 'windup' ? 1.25 + phaseT * 0.35 : pose === 'strike' ? 1.4 : 1;
  const dist = handDist * flare;
  const sx = Math.cos(angle) * dist;
  const sy = Math.sin(angle) * dist;
  const r = 6 * scale * flare;
  ctx.strokeStyle = look.cloth;
  ctx.globalAlpha = 0.85;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.ellipse(sx, sy, r, r * 0.65, angle, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(sx - r * 0.6, sy);
  ctx.lineTo(sx + r * 0.6, sy);
  ctx.moveTo(sx, sy - r * 0.45);
  ctx.lineTo(sx, sy + r * 0.45);
  ctx.stroke();
  ctx.globalAlpha = 1;
}

function drawWeapon(
  ctx: CanvasRenderingContext2D,
  look: ArmaturaLook,
  scale: number,
  length: number,
  handAngle: number,
  handDist: number,
  tipAngle: number,
  pose: Pose,
): void {
  const hx = Math.cos(handAngle) * handDist;
  const hy = Math.sin(handAngle) * handDist;
  ctx.save();
  ctx.translate(hx, hy);

  // Arm toward torso (body space) so the weapon reads as held, not chest-mounted
  ctx.strokeStyle = look.leather;
  ctx.lineWidth = 2.2 * scale;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-hx * 0.55, -hy * 0.55);
  ctx.lineTo(0, 0);
  ctx.stroke();

  ctx.fillStyle = '#e6d3b0';
  ctx.beginPath();
  ctx.arc(0, 0, 2.1 * scale, 0, Math.PI * 2);
  ctx.fill();

  ctx.rotate(tipAngle);
  const grip = 1.5 * scale;
  ctx.strokeStyle = '#2a2218';
  ctx.lineJoin = 'round';

  const bladeMetal = (x0: number, y0: number, x1: number, y1: number): CanvasGradient => {
    const bg = ctx.createLinearGradient(x0, y0, x1, y1);
    bg.addColorStop(0, darken(look.metal, 0.22));
    bg.addColorStop(0.35, lighten(look.metal, 0.4));
    bg.addColorStop(0.65, look.metal);
    bg.addColorStop(1, darken(look.metal, 0.18));
    return bg;
  };

  if (look.spear) {
    ctx.lineWidth = 2 * scale;
    ctx.beginPath();
    ctx.moveTo(grip - 4 * scale, 0);
    ctx.lineTo(grip + length, 0);
    ctx.stroke();
    const tipX = grip + length;
    ctx.fillStyle = bladeMetal(tipX - 1, -2.5 * scale, tipX + 7 * scale, 2.5 * scale);
    ctx.beginPath();
    ctx.moveTo(tipX - 1, -2.5 * scale);
    ctx.lineTo(tipX + 7 * scale, 0);
    ctx.lineTo(tipX - 1, 2.5 * scale);
    ctx.closePath();
    ctx.fill();
  } else if (look.trident) {
    ctx.lineWidth = 2 * scale;
    ctx.beginPath();
    ctx.moveTo(grip, 0);
    ctx.lineTo(grip + length, 0);
    ctx.stroke();
    const tip = grip + length;
    ctx.strokeStyle = bladeMetal(tip, -4 * scale, tip + 6 * scale, 4 * scale);
    ctx.lineWidth = 1.8 * scale;
    ctx.beginPath();
    ctx.moveTo(tip, 0);
    ctx.lineTo(tip + 5 * scale, -4 * scale);
    ctx.moveTo(tip, 0);
    ctx.lineTo(tip + 6 * scale, 0);
    ctx.moveTo(tip, 0);
    ctx.lineTo(tip + 5 * scale, 4 * scale);
    ctx.stroke();
  } else if (look.curvedBlade) {
    ctx.lineWidth = 2.4 * scale;
    ctx.beginPath();
    ctx.moveTo(grip, 0);
    ctx.quadraticCurveTo(grip + length * 0.55, -5 * scale, grip + length, 3 * scale);
    ctx.stroke();
    ctx.strokeStyle = bladeMetal(
      grip + length * 0.7,
      -2 * scale,
      grip + length,
      3 * scale,
    );
    ctx.lineWidth = 1.5 * scale;
    ctx.beginPath();
    ctx.moveTo(grip + length * 0.7, -2 * scale);
    ctx.quadraticCurveTo(grip + length * 0.9, 0, grip + length, 3 * scale);
    ctx.stroke();
  } else {
    ctx.lineWidth = 2.6 * scale;
    ctx.beginPath();
    ctx.moveTo(grip, 0);
    ctx.lineTo(grip + length, 0);
    ctx.stroke();
    const tipX = grip + length;
    ctx.fillStyle = bladeMetal(tipX - 2, -2.2 * scale, tipX + 4 * scale, 2.2 * scale);
    ctx.beginPath();
    ctx.moveTo(tipX - 2, -2.2 * scale);
    ctx.lineTo(tipX + 4 * scale, 0);
    ctx.lineTo(tipX - 2, 2.2 * scale);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = look.leather;
    ctx.fillRect(grip - 1, -3 * scale, 3 * scale, 6 * scale);
  }

  if (pose === 'idle' || pose === 'guard') {
    ctx.fillStyle = colors.parchment;
    ctx.globalAlpha = 0.55;
    ctx.beginPath();
    ctx.arc(grip + 2 * scale, 0, 1.4 * scale, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  ctx.restore();
}

function drawScissorArm(
  ctx: CanvasRenderingContext2D,
  look: ArmaturaLook,
  scale: number,
  angle: number,
  handDist: number,
  pose: Pose,
): void {
  const sx = Math.cos(angle) * handDist;
  const sy = Math.sin(angle) * handDist;
  ctx.save();
  ctx.translate(sx, sy);
  ctx.rotate(angle + (pose === 'strike' ? 0.2 : 0));
  const tube = ctx.createLinearGradient(-2 * scale, -3 * scale, 8 * scale, 3 * scale);
  tube.addColorStop(0, lighten(look.metal, 0.32));
  tube.addColorStop(0.45, look.metal);
  tube.addColorStop(1, darken(look.metal, 0.25));
  ctx.fillStyle = tube;
  ctx.fillRect(-2 * scale, -3 * scale, 10 * scale, 6 * scale);
  ctx.strokeStyle = look.leather;
  ctx.strokeRect(-2 * scale, -3 * scale, 10 * scale, 6 * scale);
  const blade = ctx.createLinearGradient(8 * scale, -2.5 * scale, 14 * scale, 2.5 * scale);
  blade.addColorStop(0, look.metal);
  blade.addColorStop(0.4, lighten(look.metal, 0.42));
  blade.addColorStop(1, darken(look.metal, 0.2));
  ctx.fillStyle = blade;
  ctx.beginPath();
  ctx.moveTo(8 * scale, -2.5 * scale);
  ctx.lineTo(14 * scale, 0);
  ctx.lineTo(8 * scale, 2.5 * scale);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/** Bars-only overhead — carved meter language, optional selected name. */
function drawBars(
  ctx: CanvasRenderingContext2D,
  f: FighterSnapshot,
  showSelectedName: boolean,
): void {
  const def = ARMATURAE[f.armatura];
  const scale = massScale(def.mass);
  const bw = 48;
  const bx = f.x - bw / 2;
  const by = f.y - (30 + 8 * scale);
  const stam = f.stamina / f.maxStamina;
  const poise = f.poise / f.maxPoise;
  const poiseColor =
    f.poiseBroken || f.poiseTier === 'BROKEN'
      ? colors.accentHot
      : f.poiseTier === 'CRITICAL'
        ? colors.bronzeHot
        : f.poiseTier === 'SOFT'
          ? colors.stamina
          : colors.poise;

  // Tiny carved plaque behind meters — same language as rail meters
  ctx.fillStyle = 'rgba(12,8,5,0.55)';
  ctx.beginPath();
  const pr = 3;
  const px = bx - 4;
  const py = by - 4;
  const pw = bw + 8;
  const ph = 24;
  ctx.moveTo(px + pr, py);
  ctx.arcTo(px + pw, py, px + pw, py + ph, pr);
  ctx.arcTo(px + pw, py + ph, px, py + ph, pr);
  ctx.arcTo(px, py + ph, px, py, pr);
  ctx.arcTo(px, py, px + pw, py, pr);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = colors.hairline;
  ctx.lineWidth = 1;
  ctx.stroke();

  bar(ctx, bx, by, bw, 4, f.hp / f.maxHp, colors.hp);
  bar(ctx, bx, by + 6, bw, 4, stam, stam < 0.38 ? colors.accentHot : colors.stamina);
  bar(ctx, bx, by + 12, bw, 3, poise, poiseColor);
  if (showSelectedName) {
    ctx.fillStyle = colors.parchment;
    ctx.globalAlpha = 0.9;
    ctx.font = `600 ${typeScale.meta}px ${fontStack}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(f.name, f.x, by + 18);
    ctx.globalAlpha = 1;
  }
}
