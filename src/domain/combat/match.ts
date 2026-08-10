import { ARMATURA_LIST, effectiveAttackArc, type ArmaturaId } from '../../content/armatura';
import { BEASTS } from '../../content/beasts';
import { combatTuning } from '../../content/combat';
import { SeededRNG } from '../rng';
import {
  abortBias,
  alliesOf,
  commitThreatEdge,
  decideCommit,
  decideFootwork,
  footworkFromVelocity,
  nearestEnemy,
  pickThreat,
} from './ai';
import {
  angleDelta,
  angleTo,
  clampToEllipse,
  dist,
  inCone,
  normalizeAngle,
  turnToward,
} from './geometry';
import { Fighter, resetFighterIds } from './fighter';
import { EntertainmentTracker, type CrowdShout } from './entertainment';
import type {
  CombatEvent,
  FighterSpawnSpec,
  Intention,
  MatchConfig,
  MatchResult,
  TeamSize,
} from './types';

const NAMES_A = ['Marcus', 'Lucius', 'Gaius', 'Titus', 'Quintus', 'Secundus'];
const NAMES_B = ['Vindex', 'Felix', 'Crispus', 'Rufus', 'Niger', 'Albus'];

export class Match {
  readonly seed: number;
  readonly teamSize: TeamSize;
  readonly arenaWidth: number;
  readonly arenaHeight: number;
  readonly fighters: Fighter[] = [];
  readonly events: CombatEvent[] = [];

  tick = 0;
  result: MatchResult = 'ONGOING';
  private rng: SeededRNG;
  private footworkClock = new Map<number, number>();
  private commitClock = new Map<number, number>();
  private recentEvents: CombatEvent[] = [];
  private sideSign = new Map<number, number>();
  private faceMode = new Map<number, 'ENEMY' | 'TANGENT' | 'HOLD'>();
  private lateralBias = new Map<number, -1 | 0 | 1>();
  private stareTicks = 0;
  readonly entertainment = new EntertainmentTracker();
  private latestShout: CrowdShout | null = null;

  constructor(config: MatchConfig) {
    resetFighterIds();
    this.seed = config.seed;
    this.teamSize = config.teamSize;
    this.arenaWidth = config.arenaWidth;
    this.arenaHeight = config.arenaHeight;
    this.rng = new SeededRNG(config.seed);

    const raw0 =
      config.team0Specs ??
      (config.team0 ?? this.rollTeam()).map((a) => ({ armatura: a }) satisfies FighterSpawnSpec);
    const raw1 =
      config.team1Specs ??
      (config.team1 ?? this.rollTeam()).map((a) => ({ armatura: a }) satisfies FighterSpawnSpec);
    const t0Specs = raw0.slice(0, this.teamSize);
    const t1Specs = raw1.slice(0, this.teamSize);
    while (t0Specs.length < this.teamSize) {
      t0Specs.push({ armatura: this.rng.pick(ARMATURA_LIST) });
    }
    while (t1Specs.length < this.teamSize) {
      t1Specs.push({ armatura: this.rng.pick(ARMATURA_LIST) });
    }
    this.spawnTeam(0, t0Specs);
    this.spawnTeam(1, t1Specs);
  }

  private rollTeam(): ArmaturaId[] {
    return Array.from({ length: this.teamSize }, () => this.rng.pick(ARMATURA_LIST));
  }

  private spawnTeam(team: 0 | 1, specs: FighterSpawnSpec[]): void {
    const names = team === 0 ? NAMES_A : NAMES_B;
    const baseX = combatTuning.arenaCX + (team === 0 ? -140 : 140);
    const baseY = combatTuning.arenaCY;
    const spreadStep = specs.length >= 3 ? 36 : 42;
    for (let i = 0; i < specs.length; i++) {
      const spec = specs[i]!;
      const spread = (i - (specs.length - 1) / 2) * spreadStep;
      const x = baseX + (specs.length >= 3 ? (i - 1) * 8 * (team === 0 ? 1 : -1) : 0);
      const y = baseY + spread;
      const facing = team === 0 ? 0 : Math.PI;
      const isBeast = spec.kind === 'beast' && !!spec.beast;
      const armatura = spec.armatura ?? (isBeast ? 'MURMILLO' : this.rng.pick(ARMATURA_LIST));
      const defaultName = isBeast ? BEASTS[spec.beast!].name : this.rng.pick(names);
      const f = new Fighter(team, armatura, spec.name ?? defaultName, x, y, facing);
      f.applySpawnSpec(spec);
      // Opposite preferred orbits so mirrors shear instead of ramming
      f.orbitSide = team === 0 ? 1 : -1;
      this.fighters.push(f);
      this.footworkClock.set(f.id, this.rng.int(0, combatTuning.aiFootworkIntervalTicks));
      this.commitClock.set(f.id, this.rng.int(0, combatTuning.aiCommitIntervalTicks));
      this.sideSign.set(f.id, f.orbitSide);
      this.faceMode.set(f.id, 'ENEMY');
      this.lateralBias.set(f.id, 0);
    }
    this.entertainment.watch(this.fighters.map((f) => f.id));
  }

  getRecentEvents(): CombatEvent[] {
    return this.recentEvents;
  }

  clearRecentEvents(): void {
    this.recentEvents = [];
  }

  consumeCrowdShout(): CrowdShout | null {
    const s = this.latestShout;
    this.latestShout = null;
    return s;
  }

  crowdFavorFor(fighterId: number): number {
    return this.entertainment.favor01(fighterId);
  }

  teamCrowdFavor(team: 0 | 1): number {
    const scores = this.fighters
      .filter((f) => f.team === team)
      .map((f) => this.entertainment.score(f.id));
    return this.entertainment.teamFavor01(scores);
  }

  snapshots() {
    return this.fighters.map((f) => f.snapshot());
  }

  step(): MatchResult {
    if (this.result !== 'ONGOING') return this.result;
    this.tick++;
    this.recentEvents = [];

    for (const f of this.fighters) {
      if (!f.alive) continue;
      f.tickTimers();
      f.clearIntentionIfExpired(this.tick);
      if (f.phase !== 'IDLE') f.advancePhase();
      if (f.attackFinish === 'WHIFF') {
        this.applyWhiffRhythm(f);
        f.attackFinish = null;
      } else if (f.attackFinish === 'CONNECTED') {
        f.attackFinish = null;
      }
    }

    for (const f of this.fighters) {
      if (!f.alive || f.stunned) continue;
      this.maybeAbortWindup(f);
      this.runBrain(f);
      this.applyMotion(f);
    }

    this.resolveCuts();
    this.updateStareRhythm();
    this.separateBodies();
    this.checkEnd();

    const shout = this.entertainment.onEvents(this.recentEvents, this.tick, this.rng);
    if (shout) this.latestShout = shout;
    this.entertainment.tickPassive(this.fighters.filter((f) => f.alive).map((f) => f.id));

    if (this.tick >= combatTuning.maxFightTicks && this.result === 'ONGOING') {
      this.result = this.decideByHp();
    }
    return this.result;
  }

  runToEnd(): MatchResult {
    while (this.result === 'ONGOING') this.step();
    return this.result;
  }

  private runBrain(f: Fighter): void {
    const enemy = pickThreat(f, this.fighters);

    // Posture cracked while still PRESSing → scramble (override stuck aggression)
    if (f.poiseBroken && f.activeIntention(this.tick) === 'PRESS') {
      this.assignIntention(f, 'YIELD');
    }

    // Fast footwork / measure clock
    let fw = this.footworkClock.get(f.id) ?? 0;
    fw--;
    if (fw <= 0) {
      this.footworkClock.set(f.id, combatTuning.aiFootworkIntervalTicks);
      const decision = decideFootwork(f, enemy, alliesOf(f, this.fighters), this.rng, this.tick);
      this.sideSign.set(f.id, decision.sideSign);
      this.faceMode.set(f.id, decision.faceMode);
      this.lateralBias.set(f.id, decision.lateralBias);
      f.desiredDist = decision.desiredDist;
      f.lateralBias = decision.lateralBias;
      f.footwork = decision.footwork;
      if (decision.intentionPick) {
        const cur = f.activeIntention(this.tick);
        // Broken/critical picks may override PRESS; idle picks need a free slot
        if (
          cur === 'NONE' ||
          (f.poiseBroken && decision.intentionPick === 'YIELD') ||
          (f.poiseTier === 'CRITICAL' && cur === 'PRESS' && decision.intentionPick === 'YIELD')
        ) {
          this.assignIntention(f, decision.intentionPick);
        }
      }
    } else {
      this.footworkClock.set(f.id, fw);
    }

    // Slow commit clock (threat edges force early re-eval)
    let cm = this.commitClock.get(f.id) ?? 0;
    cm--;
    const threat = commitThreatEdge(f, enemy);
    if (threat) cm = Math.min(cm, 0);
    if (cm <= 0) {
      this.commitClock.set(f.id, combatTuning.aiCommitIntervalTicks);
      this.runCommit(f, enemy);
    } else {
      this.commitClock.set(f.id, cm);
      this.applyOngoingGuard(f);
    }
  }

  private runCommit(f: Fighter, enemy: Fighter | null): void {
    const decision = decideCommit(f, enemy, this.rng, this.tick);

    if (f.guarding && !decision.guard) {
      f.endAction();
    }

    if (f.busy && f.action !== 'GUARD') return;

    const d = f.def();
    if (decision.sidestep && !f.busy) {
      if (f.startAction('SIDESTEP', 2, d.dodgeDuration, 6)) {
        f.stamina -= d.dodgeStamina;
        this.pushEvent('SIDESTEP', f);
      }
      return;
    }

    if (decision.guard && !f.guarding && !f.busy) {
      f.startAction('GUARD', 3, 999, 4);
      return;
    }

    if ((decision.feintCut || decision.cut) && !f.busy && enemy) {
      f.facing = turnToward(f.facing, angleTo(f.x, f.y, enemy.x, enemy.y), f.effectiveTurnRate());
      const ps = combatTuning.phaseScale;
      const windup = Math.max(8, Math.round(d.windup * ps));
      const active = Math.max(4, Math.round(d.active * ps));
      const recover = Math.max(8, Math.round(d.recover * ps));
      if (f.startAction('ATTACK', windup, active, recover)) {
        f.stamina -= d.attackStamina;
        if (decision.feintCut) {
          f.feintStage = 'WINDUP';
        }
      }
    }
  }

  private applyOngoingGuard(f: Fighter): void {
    void f;
  }

  private assignIntention(f: Fighter, kind: Intention, durationOverride?: number): void {
    const dur =
      durationOverride ??
      (kind === 'PRESS'
        ? combatTuning.pressTicks
        : kind === 'YIELD'
          ? combatTuning.yieldTicks
          : kind === 'ANGLE'
            ? combatTuning.angleTicks
            : kind === 'INVITE'
              ? combatTuning.inviteTicks
              : kind === 'FEINT'
                ? combatTuning.feintTicks
                : kind === 'RESET'
                  ? combatTuning.resetTicks
                  : 20);
    f.setIntention(kind, this.tick + dur);
  }

  /** Fresh posture break: victim scrambles, attacker gets a short punish PRESS. */
  private applyPoiseBreakRhythm(atk: Fighter, tgt: Fighter): void {
    atk.brokenPunishContacts = 0;
    this.assignIntention(tgt, 'YIELD');
    this.assignIntention(atk, 'PRESS', combatTuning.brokenPunishPressTicks);
    atk.tempoUntil = Math.max(atk.tempoUntil, this.tick + 8);
    tgt.tempoUntil = Math.max(tgt.tempoUntil, this.tick + combatTuning.tempoAfterHitTaken);
  }

  /**
   * Attacker intention after contact on a still-broken foe.
   * Caps PRESS farming — after a few hits / clinch, ease to ANGLE/RESET.
   */
  private assignBrokenPunishFollowup(atk: Fighter, tgt: Fighter): void {
    atk.brokenPunishContacts++;
    const clinchDist = combatTuning.bodyRadius * combatTuning.clinchOrbitMul;
    const distance = dist(atk.x, atk.y, tgt.x, tgt.y);
    const spent =
      atk.brokenPunishContacts >= combatTuning.brokenPunishMaxHits || distance < clinchDist;
    if (spent) {
      this.assignIntention(atk, this.rng.chance(0.55) ? 'ANGLE' : 'RESET');
    } else {
      this.assignIntention(atk, 'PRESS', combatTuning.brokenPunishPressTicks);
    }
    this.assignIntention(tgt, 'YIELD');
  }

  /**
   * Early windup abort: bearing/measure fail → short recover, partial stam, YIELD + foe tempo.
   * FEINT intentionally aborts in its fake window.
   */
  private maybeAbortWindup(f: Fighter): void {
    if (f.action !== 'ATTACK' || f.phase !== 'WINDUP' || f.phaseMax <= 0) return;
    const progress = f.phaseT / f.phaseMax;
    const enemy = pickThreat(f, this.fighters);
    if (!enemy) return;

    const d = f.def();
    const distance = dist(f.x, f.y, enemy.x, enemy.y);
    const toEnemy = angleTo(f.x, f.y, enemy.x, enemy.y);
    const facing = f.commitFacing ?? f.facing;
    const bearingErr = Math.abs(angleDelta(facing, toEnemy));
    const atkArc = effectiveAttackArc(d, f.footwork);
    const outOfMeasure = distance < d.measureMin * 0.7 || distance > d.attackRange * 1.12;

    // Intentional FEINT abort in mid-window
    if (f.feintStage === 'WINDUP' && f.activeIntention(this.tick) === 'FEINT') {
      const lo = combatTuning.feintAbortMin;
      const hi = combatTuning.feintAbortMax;
      if (progress >= lo && progress <= hi) {
        this.performAbort(f, enemy, true);
        return;
      }
      if (progress > hi) {
        // Locked through — treat as real cut; clear feint stage
        f.feintStage = 'NONE';
      }
      return;
    }

    // Real abort only in early window
    if (progress > combatTuning.abortWindowFrac) return;

    const lineFail = bearingErr > atkArc * 1.2;
    const badMeasure =
      distance < d.measureMin * 0.55 || distance > d.attackRange * 1.2 || outOfMeasure;
    // Need a clear fail — don't abort on tiny drift
    if (!lineFail && !badMeasure) return;

    const cooled = this.tick - f.lastAbortTick >= combatTuning.abortCooldownTicks;
    const stamOk = f.stamina / f.maxStamina > 0.25;
    const notOnTempo = this.tick >= f.tempoUntil;
    if (!cooled || f.abortUsedExchange || !stamOk || !notOnTempo) return;

    const bias = abortBias(f);
    if (!this.rng.chance(0.18 + bias * 0.4)) return;

    this.performAbort(f, enemy, false);
  }

  private performAbort(f: Fighter, foe: Fighter, wasFeint: boolean): void {
    const d = f.def();
    f.abortWindup(combatTuning.abortRecoverTicks);
    f.stamina = Math.min(
      f.maxStamina,
      f.stamina + d.attackStamina * combatTuning.abortStaminaRefund,
    );
    f.lastAbortTick = this.tick;
    if (!wasFeint) f.abortUsedExchange = true;
    f.feintStage = 'NONE';
    f.attackFinish = null;
    f.attackCd = Math.max(4, Math.floor(d.attackCooldown * 0.45));

    this.assignIntention(f, wasFeint ? 'ANGLE' : 'YIELD');
    foe.tempoUntil = Math.max(foe.tempoUntil, this.tick + 10);
    if (!wasFeint) {
      this.assignIntention(foe, 'PRESS');
    }
    this.pushEvent('ABORT', f, foe);
  }

  private applyMotion(f: Fighter): void {
    if (f.stunned || f.tangled) {
      f.vx = 0;
      f.vy = 0;
      return;
    }

    const d = f.def();
    const enemy = pickThreat(f, this.fighters);
    const dt = 1 / combatTuning.tickRate;
    const stamRatio = f.stamina / f.maxStamina;
    const stamMove =
      combatTuning.minStaminaMoveMul +
      (1 - combatTuning.minStaminaMoveMul) * Math.min(1, stamRatio / 0.85);

    let mx = 0;
    let my = 0;
    let speed = d.moveSpeed * stamMove;

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
      const side = this.sideSign.get(f.id) ?? 1;
      mx = Math.cos(f.facing + (Math.PI / 2) * side);
      my = Math.sin(f.facing + (Math.PI / 2) * side);
      f.vx = mx * speed;
      f.vy = my * speed;
      f.x += mx * speed * dt;
      f.y += my * speed * dt;
    } else if (f.phase === 'IDLE' || f.guarding) {
      if (f.guarding) speed *= combatTuning.guardMoveMul;
      if (enemy) {
        this.applyMeasureSpring(f, enemy, dt, speed);
        const lat = this.lateralBias.get(f.id) ?? f.lateralBias;
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
      const mode = this.faceMode.get(f.id) ?? 'ENEMY';
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
  private applyMeasureSpring(f: Fighter, enemy: Fighter, dt: number, maxSpeed: number): void {
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

    const latSign = this.lateralBias.get(f.id) ?? f.lateralBias;
    let aLat = latSign * combatTuning.lateralAccel - vLat * combatTuning.measureDamp * 1.1;
    const intent = f.activeIntention(this.tick);
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

  private resolveCuts(): void {
    for (const atk of this.fighters) {
      if (!atk.alive || atk.phase !== 'ACTIVE' || atk.action !== 'ATTACK') continue;
      if (atk.hitConnected) continue;

      const d = atk.def();
      for (const tgt of this.fighters) {
        if (!tgt.alive || tgt.team === atk.team) continue;

        const distance = dist(atk.x, atk.y, tgt.x, tgt.y);
        if (distance > d.attackRange) continue;

        const toTgt = angleTo(atk.x, atk.y, tgt.x, tgt.y);
        const atkArc = effectiveAttackArc(d, atk.footwork);
        if (!inCone(atk.facing, toTgt, atkArc)) continue;

        // Sidestep i-frames — fully avoids the cut (no HP or poise)
        if (tgt.sidestepping) {
          this.pushEvent('SIDESTEP', tgt, atk);
          atk.hitConnected = true;
          continue;
        }

        const weaponDmg = atk.def().strength * d.damageMul * combatTuning.damageScale;
        const poiseDmg = weaponDmg * d.poiseMul * combatTuning.poiseDamageScale;

        const toAtk = angleTo(tgt.x, tgt.y, atk.x, atk.y);
        const inGuard =
          tgt.canGuard &&
          tgt.guarding &&
          tgt.stamina > 0 &&
          inCone(tgt.facing, toAtk, tgt.effectiveGuardArc());

        const nx = Math.cos(atk.facing);
        const ny = Math.sin(atk.facing);

        // Poise always chips on contact — cannot be blocked
        const broke = tgt.applyPoiseDamage(poiseDmg);
        if (broke) {
          this.pushEvent('POISE_BREAK', atk, tgt);
          this.applyPoiseBreakRhythm(atk, tgt);
        }

        // Soft-tier stumble threat invites PRESS, not stalemate
        if (
          !broke &&
          tgt.poiseTier === 'CRITICAL' &&
          this.rng.chance(combatTuning.criticalStumbleChance)
        ) {
          tgt.applyStumble(combatTuning.criticalStumbleTicks);
          this.pushEvent('STUMBLE', atk, tgt);
          this.assignIntention(atk, 'PRESS');
        }

        // Guard only holds if posture survived this contact — a break drops the shield
        if (inGuard && !broke) {
          const absorbed = weaponDmg * tgt.def().guardAbsorb * 0.35;
          tgt.hp = Math.max(0, tgt.hp - absorbed);
          tgt.stamina = Math.max(0, tgt.stamina - 4 * atk.def().mass);
          atk.stamina = Math.max(0, atk.stamina - 2);
          // Shield shock: planted guard cracks the attacker's posture
          if (tgt.def().shieldShock > 0) {
            const shocked = atk.applyPoiseDamage(tgt.def().shieldShock);
            if (shocked) {
              this.pushEvent('POISE_BREAK', tgt, atk);
              this.applyPoiseBreakRhythm(tgt, atk);
            }
          }
          tgt.x += nx * combatTuning.knockbackOnGuard * 0.4;
          tgt.y += ny * combatTuning.knockbackOnGuard * 0.4;
          atk.x -= nx * combatTuning.knockbackOnGuard * 0.6;
          atk.y -= ny * combatTuning.knockbackOnGuard * 0.6;
          this.pushEvent('GUARD', tgt, atk, absorbed);
          atk.hitConnected = true;
          this.applyGuardRhythm(atk, tgt);
          if (tgt.hp <= 0) this.pushEvent('KO', atk, tgt);
          continue;
        }

        tgt.hp = Math.max(0, tgt.hp - weaponDmg);
        const kb = combatTuning.knockbackOnHit / Math.max(0.6, tgt.def().mass);
        tgt.x += nx * kb;
        tgt.y += ny * kb;
        tgt.flash = 8;
        this.pushEvent('HIT', atk, tgt, weaponDmg);
        atk.hitConnected = true;
        this.applyHitRhythm(atk, tgt);

        // Tip catch (pause) — resist shortens/negates (Secutor helm, Scissor, etc.)
        if (
          d.tipCatchRatio > 0 &&
          distance >= d.attackRange * d.tipCatchRatio &&
          distance <= d.attackRange
        ) {
          const ticks = Math.floor(d.tipCatchTicks * (1 - tgt.def().tipCatchResist));
          if (ticks > 0) {
            tgt.tangleT = Math.max(tgt.tangleT, ticks);
            this.pushEvent('TIP_CATCH', atk, tgt);
          }
        }

        if (tgt.hp <= 0) this.pushEvent('KO', atk, tgt);
      }
    }
  }

  /** Landed cut → presser PRESSes, victim YIELDs (broken: short punish then ease off). */
  private applyHitRhythm(atk: Fighter, tgt: Fighter): void {
    atk.markExchangeContact();
    tgt.markExchangeContact();

    if (tgt.poiseBroken) {
      // Fresh break already set PRESS via applyPoiseBreakRhythm — subsequent hits
      // count toward the punish cap and then ANGLE/RESET.
      this.assignBrokenPunishFollowup(atk, tgt);
      atk.tempoUntil = this.tick + combatTuning.tempoAfterCommit;
      tgt.tempoUntil = this.tick + combatTuning.tempoAfterHitTaken;
      this.stareTicks = 0;
      return;
    }

    atk.brokenPunishContacts = 0;
    this.assignIntention(atk, 'PRESS');
    atk.tempoUntil = this.tick + combatTuning.tempoAfterCommit;

    this.assignIntention(tgt, 'YIELD');
    tgt.tempoUntil = this.tick + combatTuning.tempoAfterHitTaken;
    // Soft victim invites extra PRESS weight next beat
    if (tgt.poiseTier === 'SOFT' || tgt.poiseTier === 'CRITICAL') {
      atk.intentionUntil = Math.max(atk.intentionUntil, this.tick + combatTuning.pressTicks + 8);
    }
    this.stareTicks = 0;
  }

  /** Shield clash → attacker eases off, defender angles or collapses. */
  private applyGuardRhythm(atk: Fighter, tgt: Fighter): void {
    atk.markExchangeContact();
    tgt.markExchangeContact();
    // Tip-range kits ANGLE away instead of full retreat (keeps cast threat alive)
    this.assignIntention(atk, atk.def().clinchPanic > 0.5 ? 'ANGLE' : 'YIELD');
    atk.tempoUntil = this.tick + combatTuning.tempoAfterCommit;

    // Pursuers collapse after a clean guard; others take the offline step
    const collapse = this.rng.chance(0.35 + tgt.def().pursueBias * 0.5);
    this.assignIntention(tgt, collapse ? 'PRESS' : 'ANGLE');
    tgt.tempoUntil = this.tick + Math.floor(combatTuning.tempoAfterCommit * 0.5);
    this.stareTicks = 0;
  }

  /** Whiff → attacker YIELDs, opponent PRESSes. */
  private applyWhiffRhythm(atk: Fighter): void {
    atk.markExchangeContact();
    this.assignIntention(atk, 'YIELD');
    atk.tempoUntil = this.tick + combatTuning.tempoAfterCommit;
    const foe = nearestEnemy(atk, this.fighters);
    if (foe) {
      foe.markExchangeContact();
      this.assignIntention(foe, 'PRESS');
      foe.tempoUntil = Math.max(foe.tempoUntil, this.tick + 8);
    }
    this.stareTicks = 0;
  }

  /** Break idle stares / clinch jams per fighter pair — not only when everyone is stuck. */
  private updateStareRhythm(): void {
    const alive = this.fighters.filter((f) => f.alive);
    if (alive.length < 2) {
      this.stareTicks = 0;
      return;
    }

    const clinchDist = combatTuning.bodyRadius * combatTuning.clinchOrbitMul;
    let anyStuckPair = false;

    for (const f of alive) {
      const foe = nearestEnemy(f, this.fighters);
      if (!foe || f.phase !== 'IDLE' || f.action !== 'NONE') continue;
      const dd = dist(f.x, f.y, foe.x, foe.y);
      const inMeasure = dd >= f.def().measureMin * 0.9 && dd <= f.def().measureMax * 1.1;
      const inClinch = dd < clinchDist * 1.2;
      const intent = f.activeIntention(this.tick);
      const foeIdle = foe.phase === 'IDLE' && foe.action === 'NONE';
      if (!foeIdle) continue;
      if (inClinch && (intent === 'NONE' || intent === 'PRESS' || intent === 'INVITE')) {
        anyStuckPair = true;
        break;
      }
      if (intent === 'NONE' && inMeasure) {
        anyStuckPair = true;
        break;
      }
    }

    if (!anyStuckPair) {
      this.stareTicks = 0;
      return;
    }

    this.stareTicks++;
    const clinched = alive.some((f) => {
      const foe = nearestEnemy(f, this.fighters);
      return foe && dist(f.x, f.y, foe.x, foe.y) < clinchDist * 1.2;
    });
    const threshold = clinched
      ? Math.floor(combatTuning.staleStareTicks * 0.55)
      : combatTuning.staleStareTicks;
    if (this.stareTicks < threshold) return;

    // Prefer breaking the closest jammed pair
    let pick = alive[0]!;
    let best = Infinity;
    for (const f of alive) {
      const foe = nearestEnemy(f, this.fighters);
      if (!foe) continue;
      const dd = dist(f.x, f.y, foe.x, foe.y);
      if (dd < best) {
        best = dd;
        pick = f;
      }
    }
    this.assignIntention(pick, 'ANGLE');
    pick.desiredDist = Math.max(
      pick.desiredDist,
      (pick.def().measureMin + pick.def().measureMax) * 0.55,
    );
    pick.tempoUntil = Math.max(pick.tempoUntil, this.tick + 12);
    const other = nearestEnemy(pick, this.fighters);
    if (other) {
      this.assignIntention(other, this.rng.chance(0.5) ? 'YIELD' : 'ANGLE');
      other.desiredDist = Math.max(
        other.desiredDist,
        (other.def().measureMin + other.def().measureMax) * 0.5,
      );
    }
    this.stareTicks = 0;
  }

  private separateBodies(): void {
    const min = combatTuning.bodyRadius * 2;
    for (let i = 0; i < this.fighters.length; i++) {
      for (let j = i + 1; j < this.fighters.length; j++) {
        const a = this.fighters[i]!;
        const b = this.fighters[j]!;
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
    for (const f of this.fighters) {
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

  private checkEnd(): void {
    const alive0 = this.fighters.some((f) => f.team === 0 && f.alive);
    const alive1 = this.fighters.some((f) => f.team === 1 && f.alive);
    if (!alive0 && !alive1) this.result = 'DRAW';
    else if (!alive0) this.result = 'TEAM1';
    else if (!alive1) this.result = 'TEAM0';
  }

  private decideByHp(): MatchResult {
    let h0 = 0;
    let h1 = 0;
    for (const f of this.fighters) {
      if (f.team === 0) h0 += f.hp;
      else h1 += f.hp;
    }
    if (h0 === h1) return 'DRAW';
    return h0 > h1 ? 'TEAM0' : 'TEAM1';
  }

  private pushEvent(
    kind: CombatEvent['kind'],
    actor: Fighter,
    target?: Fighter,
    amount?: number,
  ): void {
    const ev: CombatEvent = {
      kind,
      tick: this.tick,
      actorId: actor.id,
      targetId: target?.id,
      x: target?.x ?? actor.x,
      y: target?.y ?? actor.y,
      amount,
    };
    this.events.push(ev);
    this.recentEvents.push(ev);
  }
}

export function createQuickMatch(
  teamSize: TeamSize,
  seed: number,
  team0?: ArmaturaId[],
  team1?: ArmaturaId[],
  arenaWidth = 960,
  arenaHeight = 540,
  team0Specs?: FighterSpawnSpec[],
  team1Specs?: FighterSpawnSpec[],
): Match {
  return new Match({
    teamSize,
    seed,
    team0,
    team1,
    team0Specs,
    team1Specs,
    arenaWidth,
    arenaHeight,
  });
}
