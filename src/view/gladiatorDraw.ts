import { ARMATURAE, effectiveAttackArc, type ArmaturaId } from '../content/armatura';
import { ARMATURA_LOOK, massScale, type ArmaturaLook } from '../content/appearance';
import { colors } from '../content/palette';
import type { FighterSnapshot } from '../domain/combat/types';
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

/** Static preview glyph for menus / sandbox picks. */
export function drawArmaturaPreview(
  ctx: CanvasRenderingContext2D,
  armatura: ArmaturaId,
  x: number,
  y: number,
  opts?: { facing?: number; team?: 0 | 1; scale?: number },
): void {
  const facing = opts?.facing ?? -Math.PI / 2;
  const team = opts?.team ?? 0;
  const scale = opts?.scale ?? 1;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  drawGladiatorGlyph(
    ctx,
    {
      id: 0,
      team,
      armatura,
      name: ARMATURAE[armatura].short,
      x: 0,
      y: 0,
      facing,
      hp: 1,
      maxHp: 1,
      stamina: 1,
      maxStamina: 1,
      poise: 1,
      maxPoise: 1,
      action: 'NONE',
      phase: 'IDLE',
      phaseT: 0,
      phaseMax: 0,
      footwork: 'HOLD',
      intention: 'NONE',
      desiredDist: 45,
      poiseTier: 'SOLID',
      stunned: false,
      tangled: false,
      poiseBroken: false,
      guarding: false,
      alive: true,
      flash: 0,
    },
    false,
  );
  ctx.restore();
}

export interface DrawGladiatorOpts {
  /** Team-tinted ring under glyph */
  selected?: boolean;
  /** Small name under bars only while selected */
  showSelectedName?: boolean;
}

/** Top-down class glyph: silhouette matches kit geometry. */
export function drawGladiator(
  ctx: CanvasRenderingContext2D,
  f: FighterSnapshot,
  opts?: DrawGladiatorOpts,
): void {
  drawGladiatorGlyph(ctx, f, true, opts);
}

function drawGladiatorGlyph(
  ctx: CanvasRenderingContext2D,
  f: FighterSnapshot,
  withBars: boolean,
  opts?: DrawGladiatorOpts,
): void {
  const def = ARMATURAE[f.armatura];
  const look = ARMATURA_LOOK[f.armatura];
  const teamTint = f.team === 0 ? colors.ally : colors.foe;
  const scale = massScale(def.mass);
  const pose = poseOf(f);
  const phaseT = f.phaseMax > 0 ? f.phaseT / f.phaseMax : 0;

  ctx.save();
  ctx.translate(f.x, f.y);

  if (opts?.selected) drawSelectionRing(ctx, teamTint, scale);
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
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
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

function drawSelectionRing(
  ctx: CanvasRenderingContext2D,
  teamTint: string,
  scale: number,
): void {
  ctx.strokeStyle = teamTint;
  ctx.globalAlpha = 0.55;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.ellipse(0, 2, 16 * scale, 10 * scale, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 0.2;
  ctx.fillStyle = teamTint;
  ctx.beginPath();
  ctx.ellipse(0, 2, 16 * scale, 10 * scale, 0, 0, Math.PI * 2);
  ctx.fill();
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
    ctx.fillStyle = 'rgba(240,230,168,0.28)';
    ctx.beginPath();
    ctx.arc(0, 0, 22 * scale, 0, Math.PI * 2);
    ctx.fill();
  }
  if (f.tangled) {
    ctx.strokeStyle = 'rgba(220,210,180,0.55)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, 0, 20 * scale, 0, Math.PI * 2);
    ctx.stroke();
  }
  if (f.poiseBroken) {
    ctx.strokeStyle = 'rgba(201,162,39,0.75)';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.arc(0, 0, 19 * scale, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
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
    // Soft edge fade when poise is mid/low
    ctx.fillStyle = `rgba(142,180,212,${(0.06 + thick * 0.06) * soft})`;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, attackRange * (0.4 + thick * 0.2), f.facing - guardArc, f.facing + guardArc);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = `rgba(142,180,212,${(0.14 + thick * 0.12) * soft})`;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, attackRange * (0.4 + thick * 0.2), f.facing - core, f.facing + core);
    ctx.closePath();
    ctx.fill();
  }
  if (pose === 'windup' || pose === 'strike') {
    ctx.fillStyle =
      pose === 'windup' ? `rgba(232,196,122,${0.1 + phaseT * 0.18})` : 'rgba(196,92,58,0.2)';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, attackRange, f.facing - attackArc, f.facing + attackArc);
    ctx.closePath();
    ctx.fill();
  }
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

  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.beginPath();
  ctx.ellipse(1, 2, rx * 1.05, ry * 0.85, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = look.bodyFill;
  ctx.beginPath();
  ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = teamTint;
  ctx.lineWidth = 3 * scale;
  ctx.beginPath();
  ctx.moveTo(-rx * 0.75, -ry * 0.15);
  ctx.lineTo(rx * 0.35, -ry * 0.15);
  ctx.stroke();

  ctx.strokeStyle = look.leather;
  ctx.lineWidth = 2 * scale;
  ctx.beginPath();
  ctx.arc(rx * 0.35, 0, ry * 0.55, -0.8, 0.8);
  ctx.stroke();

  if (look.breastplate) {
    ctx.fillStyle = look.metal;
    ctx.globalAlpha = 0.85;
    ctx.beginPath();
    ctx.ellipse(1 * scale, 0, rx * 0.55, ry * 0.7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = look.leather;
    ctx.lineWidth = 1;
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

  ctx.fillStyle = look.metal;
  if (look.smoothHelm) {
    // Secutor / Scissor: round bowl, tiny eye slits
    ctx.beginPath();
    ctx.arc(hx, hy + brokenTip * 3, 5.8 * scale, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1a1410';
    ctx.fillRect(hx + 1.5 * scale, hy - 1 * scale, 2.2 * scale, 1.2 * scale);
    return;
  }

  ctx.beginPath();
  ctx.ellipse(hx, hy + brokenTip * 3, 5.5 * scale, 4.5 * scale, 0, 0, Math.PI * 2);
  ctx.fill();

  if (!look.crest) {
    // Thraex / Hop brim
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
  ctx.fillStyle = look.metal;
  ctx.beginPath();
  ctx.ellipse(0, 0, rw, rh, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = look.leather;
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.fillStyle = '#d8c8a0';
  ctx.beginPath();
  ctx.arc(0, 0, 1.6 * scale, 0, Math.PI * 2);
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

  if (look.spear) {
    ctx.lineWidth = 2 * scale;
    ctx.beginPath();
    ctx.moveTo(grip - 4 * scale, 0);
    ctx.lineTo(grip + length, 0);
    ctx.stroke();
    ctx.fillStyle = look.metal;
    ctx.beginPath();
    ctx.moveTo(grip + length - 1, -2.5 * scale);
    ctx.lineTo(grip + length + 7 * scale, 0);
    ctx.lineTo(grip + length - 1, 2.5 * scale);
    ctx.closePath();
    ctx.fill();
  } else if (look.trident) {
    ctx.lineWidth = 2 * scale;
    ctx.beginPath();
    ctx.moveTo(grip, 0);
    ctx.lineTo(grip + length, 0);
    ctx.stroke();
    const tip = grip + length;
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
    ctx.strokeStyle = look.metal;
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
    ctx.fillStyle = look.metal;
    ctx.beginPath();
    ctx.moveTo(grip + length - 2, -2.2 * scale);
    ctx.lineTo(grip + length + 4 * scale, 0);
    ctx.lineTo(grip + length - 2, 2.2 * scale);
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
  ctx.fillStyle = look.metal;
  ctx.fillRect(-2 * scale, -3 * scale, 10 * scale, 6 * scale);
  ctx.strokeStyle = look.leather;
  ctx.strokeRect(-2 * scale, -3 * scale, 10 * scale, 6 * scale);
  ctx.beginPath();
  ctx.moveTo(8 * scale, -2.5 * scale);
  ctx.lineTo(14 * scale, 0);
  ctx.lineTo(8 * scale, 2.5 * scale);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/** Bars-only overhead; optional selected name under the stack. */
function drawBars(
  ctx: CanvasRenderingContext2D,
  f: FighterSnapshot,
  showSelectedName: boolean,
): void {
  const def = ARMATURAE[f.armatura];
  const scale = massScale(def.mass);
  const bw = 46;
  const bx = f.x - bw / 2;
  const by = f.y - (28 + 8 * scale);
  const stam = f.stamina / f.maxStamina;
  const poise = f.poise / f.maxPoise;
  const poiseColor =
    f.poiseBroken || f.poiseTier === 'BROKEN'
      ? colors.accentHot
      : f.poiseTier === 'CRITICAL'
        ? '#c97827'
        : f.poiseTier === 'SOFT'
          ? '#c9a227'
          : colors.poise;
  bar(ctx, bx, by, bw, 5, f.hp / f.maxHp, colors.hp);
  bar(ctx, bx, by + 6, bw, 5, stam, stam < 0.38 ? colors.accentHot : colors.stamina);
  bar(ctx, bx, by + 12, bw, 4, poise, poiseColor);
  if (showSelectedName) {
    ctx.fillStyle = colors.ink;
    ctx.globalAlpha = 0.75;
    ctx.font = '600 10px "Palatino Linotype", Palatino, Georgia, serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(f.name, f.x, by + 18);
    ctx.globalAlpha = 1;
  }
}
