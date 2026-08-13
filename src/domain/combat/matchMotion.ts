import { combatTuning } from '../../content/combat';
import { footworkFromVelocity, pickThreat } from './ai';
import {
  angleDelta,
  angleTo,
  clampToEllipse,
  normalizeAngle,
  turnToward,
} from './geometry';
import type { Fighter } from './fighter';
import { woundShockMoveMul } from './matchRhythm';

export type FaceMode = 'ENEMY' | 'TANGENT' | 'HOLD';

export interface MotionMaps {
  sideSign: Map<number, number>;
  faceMode: Map<number, FaceMode>;
  lateralBias: Map<number, -1 | 0 | 1>;
}

export function applyMotion(f: Fighter, fighters: Fighter[], maps: MotionMaps, tick: number): void {
  if (f.stunned || f.tangled) {
    f.vx = 0;
    f.vy = 0;
    return;
  }

  const d = f.def();
  const enemy = pickThreat(f, fighters);
  const dt = 1 / combatTuning.tickRate;
  const stamRatio = f.stamina / f.maxStamina;
  const stamMove =
    combatTuning.minStaminaMoveMul +
    (1 - combatTuning.minStaminaMoveMul) * Math.min(1, stamRatio / 0.85);

  let mx = 0;
  let my = 0;
  let speed = d.moveSpeed * stamMove * woundShockMoveMul(f, tick);

  if (f.action === 'ATTACK') {
    speed *= combatTuning.commitMoveMul;
    f.vx *= 0.85;
    f.vy *= 0.85;
    if (f.phase === 'WINDUP') {
      mx = Math.cos(f.facing);
      my = Math.sin(f.facing);
    }
    if (mx !== 0 || my !== 0) {
      const mag = Math.hypot(mx, my) || 1;
      f.x += (mx / mag) * speed * dt;
      f.y += (my / mag) * speed * dt;
    }
  } else if (f.sidestepping) {
    speed *= combatTuning.dodgeSpeedMul;
    const side = maps.sideSign.get(f.id) ?? 1;
    mx = Math.cos(f.facing + (Math.PI / 2) * side);
    my = Math.sin(f.facing + (Math.PI / 2) * side);
    f.vx = mx * speed;
    f.vy = my * speed;
    f.x += mx * speed * dt;
    f.y += my * speed * dt;
  } else if (f.phase === 'IDLE' || f.guarding) {
    if (f.guarding) speed *= combatTuning.guardMoveMul;
    if (enemy) {
      applyMeasureSpring(f, enemy, dt, speed, maps, tick);
      const lat = maps.lateralBias.get(f.id) ?? f.lateralBias;
      f.footwork = footworkFromVelocity(f, enemy, lat);
    } else {
      f.vx *= 0.9;
      f.vy *= 0.9;
    }
  }

  // Turning — orbit with tangent lead so we don't face-lock into a ram
  if (f.action === 'ATTACK' && f.commitFacing != null) {
    f.facing = f.commitFacing;
  } else if (enemy && f.action !== 'ATTACK') {
    const mode = maps.faceMode.get(f.id) ?? 'ENEMY';
    let target = angleTo(f.x, f.y, enemy.x, enemy.y);
    if (mode === 'TANGENT' && (f.vx !== 0 || f.vy !== 0)) {
      const moveAng = Math.atan2(f.vy, f.vx);
      const toEnemy = angleTo(f.x, f.y, enemy.x, enemy.y);
      target = normalizeAngle(moveAng + angleDelta(moveAng, toEnemy) * 0.35);
    } else if (mode === 'HOLD') {
      target = f.facing;
    }
    let turn = f.effectiveTurnRate() * dt;
    if (f.guarding) turn *= combatTuning.guardTurnMul;
    if (stamRatio < combatTuning.lowStamina) turn *= 0.85;
    f.facing = turnToward(f.facing, target, turn);
  }

  const clamped = clampToEllipse(
    f.x,
    f.y,
    combatTuning.arenaCX,
    combatTuning.arenaCY,
    combatTuning.arenaRX,
    combatTuning.arenaRY,
  );
  f.x = clamped.x;
  f.y = clamped.y;
}

/** Continuous measure spring: capped radial accel toward (distance - d*), plus lateral bias. */
export function applyMeasureSpring(
  f: Fighter,
  enemy: Fighter,
  dt: number,
  maxSpeed: number,
  maps: MotionMaps,
  tick: number,
): void {
  const dx = enemy.x - f.x;
  const dy = enemy.y - f.y;
  const distance = Math.hypot(dx, dy) || 1;
  const fx = dx / distance;
  const fy = dy / distance;
  const lx = -fy;
  const ly = fx;

  const dStar = f.desiredDist || (f.def().measureMin + f.def().measureMax) * 0.5;
  const err = distance - dStar;
  const vRad = f.vx * fx + f.vy * fy;
  const vLat = f.vx * lx + f.vy * ly;

  let aRad = err * combatTuning.measureSpring - vRad * combatTuning.measureDamp;
  const cap = combatTuning.measureAccelCap;
  if (aRad > cap) aRad = cap;
  if (aRad < -cap) aRad = -cap;

  const latSign = maps.lateralBias.get(f.id) ?? f.lateralBias;
  let aLat = latSign * combatTuning.lateralAccel - vLat * combatTuning.measureDamp * 1.1;
  const intent = f.activeIntention(tick);
  if (intent === 'ANGLE') aLat *= 1.25;
  if (intent === 'RESET' || intent === 'INVITE') aLat *= 0.35;
  // PRESS commits the spring harder so short kits can collapse tip-range
  if (intent === 'PRESS') aRad *= 1.35;

  f.vx += (fx * aRad + lx * aLat) * dt * 60;
  f.vy += (fy * aRad + ly * aLat) * dt * 60;

  const spd = Math.hypot(f.vx, f.vy);
  if (spd > maxSpeed) {
    f.vx = (f.vx / spd) * maxSpeed;
    f.vy = (f.vy / spd) * maxSpeed;
  }

  f.x += f.vx * dt;
  f.y += f.vy * dt;
}
