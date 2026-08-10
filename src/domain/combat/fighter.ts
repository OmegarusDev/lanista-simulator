import { ARMATURAE, type ArmaturaDef, type ArmaturaId } from '../../content/armatura';
import { BEASTS, type BeastId } from '../../content/beasts';
import { combatTuning } from '../../content/combat';
import type {
  ActionKind,
  CombatantKind,
  FighterSnapshot,
  FighterSpawnSpec,
  Footwork,
  Intention,
  Phase,
  PoiseTier,
  TeamId,
} from './types';

let nextId = 1;

export function resetFighterIds(): void {
  nextId = 1;
}

export function poiseTierOf(poise: number, maxPoise: number, broken: boolean): PoiseTier {
  if (broken || poise <= 0) return 'BROKEN';
  const r = poise / maxPoise;
  if (r > combatTuning.poiseSoftRatio) return 'SOLID';
  if (r > combatTuning.poiseCriticalRatio) return 'SOFT';
  return 'CRITICAL';
}

export class Fighter {
  readonly id: number;
  readonly team: TeamId;
  readonly armatura: ArmaturaId;
  kind: CombatantKind = 'gladiator';
  beastId: BeastId | null = null;
  name: string;
  /** Career / doctrina overlay of class kit — null means stock armatura. */
  private defOverride: ArmaturaDef | null = null;

  x: number;
  y: number;
  facing: number;
  footwork: Footwork = 'HOLD';
  /** Sticky orbit preference: -1 left, +1 right (anti-mirror). */
  orbitSide: -1 | 1 = 1;

  hp: number;
  maxHp: number;
  stamina: number;
  maxStamina: number;
  poise: number;
  maxPoise: number;

  action: ActionKind = 'NONE';
  phase: Phase = 'IDLE';
  phaseT = 0;
  phaseMax = 0;
  private _activeDur = 0;
  private _recoverDur = 0;

  attackCd = 0;
  dodgeCd = 0;
  stumbleT = 0;
  tangleT = 0;
  flash = 0;
  hitConnected = false;
  /** True after poise hits 0 until bar restores past threshold — no guard; dodge still allowed */
  poiseBroken = false;
  /** Delay before poise starts refilling after taking poise damage */
  poiseRegenDelay = 0;
  /** Locked facing during windup/active cut */
  commitFacing: number | null = null;

  /** Bout intention (absolute match ticks) */
  intention: Intention = 'NONE';
  intentionUntil = 0;
  /** Desired measure distance d* for spring */
  desiredDist = 0;
  /** Lateral bias for spring: -1 left, 0 hold, +1 right */
  lateralBias: -1 | 0 | 1 = 0;
  /** Measure-spring velocity (px/s), radial toward enemy / lateral */
  vx = 0;
  vy = 0;

  /** Cut-tempo gate (absolute match ticks) */
  tempoUntil = 0;
  /** Set when an attack action fully ends */
  attackFinish: 'WHIFF' | 'CONNECTED' | null = null;
  /** True if current attack was aborted — skip WHIFF rhythm on end */
  abortedAttack = false;

  /** FEINT: micro-in then fake windup */
  feintStage: 'NONE' | 'IN' | 'WINDUP' = 'NONE';
  /** Gate abort spam — one real abort per exchange window */
  abortUsedExchange = false;
  lastAbortTick = -999;
  /** Ticks since last contact / intention write (for RESET) */
  ticksSinceContact = 0;
  /**
   * Contacts landed while the current foe was still poise-broken.
   * Caps the punish window so PRESS does not farm stun forever.
   */
  brokenPunishContacts = 0;

  constructor(team: TeamId, armatura: ArmaturaId, name: string, x: number, y: number, facing: number) {
    this.id = nextId++;
    this.team = team;
    this.armatura = armatura;
    this.name = name;
    this.x = x;
    this.y = y;
    this.facing = facing;
    const d = ARMATURAE[armatura];
    this.maxHp = Math.round(d.maxHealth * combatTuning.healthScale);
    this.hp = this.maxHp;
    this.maxStamina = d.maxStamina;
    this.stamina = d.maxStamina;
    this.maxPoise = Math.round(d.maxPoise * combatTuning.poisePoolScale);
    this.poise = this.maxPoise;
    this.desiredDist = (d.measureMin + d.measureMax) * 0.5;
  }

  stockKit(): ArmaturaDef {
    if (this.beastId) {
      const b = BEASTS[this.beastId];
      return { ...b, id: this.armatura };
    }
    return ARMATURAE[this.armatura];
  }

  def(): ArmaturaDef {
    return this.defOverride ?? this.stockKit();
  }

  /**
   * Apply career / lab spawn modifiers. Rescales pools from the overridden kit.
   */
  applySpawnSpec(spec: FighterSpawnSpec): void {
    if (spec.name) this.name = spec.name;
    if (spec.kind === 'beast' && spec.beast) {
      this.kind = 'beast';
      this.beastId = spec.beast;
    }
    const base = this.stockKit();
    const d: ArmaturaDef = { ...base };
    const clampBias = (n: number) => Math.max(0, Math.min(1, n));
    if (spec.damageMul != null) d.damageMul = base.damageMul * spec.damageMul;
    if (spec.attackStaminaMul != null) {
      d.attackStamina = Math.max(1, Math.round(base.attackStamina * spec.attackStaminaMul));
      d.dodgeStamina = Math.max(1, Math.round(base.dodgeStamina * spec.attackStaminaMul));
    }
    if (spec.pursueBiasAdd != null) d.pursueBias = clampBias(base.pursueBias + spec.pursueBiasAdd);
    if (spec.clinchPanicAdd != null) {
      d.clinchPanic = clampBias(base.clinchPanic + spec.clinchPanicAdd);
    }
    if (spec.circleArcAdd != null) {
      d.circleArcBonus = Math.max(0, base.circleArcBonus + spec.circleArcAdd);
    }
    this.defOverride = d;

    const hpMul = spec.hpMul ?? 1;
    const stamMul = spec.staminaMul ?? 1;
    const poiseMul = spec.poiseMul ?? 1;
    this.maxHp = Math.max(1, Math.round(base.maxHealth * combatTuning.healthScale * hpMul));
    this.maxStamina = Math.max(1, Math.round(base.maxStamina * stamMul));
    this.maxPoise = Math.max(
      1,
      Math.round(base.maxPoise * combatTuning.poisePoolScale * poiseMul),
    );
    const start = spec.startHpRatio ?? 1;
    this.hp = Math.max(1, Math.round(this.maxHp * Math.max(0.15, Math.min(1, start))));
    this.stamina = this.maxStamina;
    this.poise = this.maxPoise;
    this.desiredDist = (d.measureMin + d.measureMax) * 0.5;
  }

  get alive(): boolean {
    return this.hp > 0;
  }

  get stunned(): boolean {
    return this.stumbleT > 0;
  }

  get tangled(): boolean {
    return this.tangleT > 0;
  }

  get busy(): boolean {
    return this.phase !== 'IDLE' || this.stunned;
  }

  get guarding(): boolean {
    return this.action === 'GUARD' && this.phase !== 'RECOVER';
  }

  get sidestepping(): boolean {
    return this.action === 'SIDESTEP' && this.phase === 'ACTIVE';
  }

  /** Guard needs posture. */
  get canGuard(): boolean {
    return !this.poiseBroken && this.poise > 0;
  }

  /**
   * Sidestep: allowed while soft/critical; when broken, desperate escape only
   * (no shield — pure footwork dive).
   */
  get canDodge(): boolean {
    return this.alive && !this.stunned && !this.tangled;
  }

  get poiseTier(): PoiseTier {
    return poiseTierOf(this.poise, this.maxPoise, this.poiseBroken);
  }

  get poiseRatio(): number {
    return this.poise / this.maxPoise;
  }

  /** Soft tiers shrink turn rate before full break. */
  effectiveTurnRate(): number {
    const base = this.def().turnRate;
    const tier = this.poiseTier;
    if (tier === 'SOFT') return base * combatTuning.softTurnMul;
    if (tier === 'CRITICAL' || tier === 'BROKEN') return base * combatTuning.criticalTurnMul;
    return base;
  }

  /** Soft tiers shrink guard arc before full break. */
  effectiveGuardArc(): number {
    const base = this.def().guardArc;
    const tier = this.poiseTier;
    if (tier === 'SOFT') return base * combatTuning.softGuardMul;
    if (tier === 'CRITICAL') return base * combatTuning.criticalGuardMul;
    if (tier === 'BROKEN') return 0;
    return base;
  }

  setIntention(kind: Intention, untilTick: number): void {
    this.intention = kind;
    this.intentionUntil = untilTick;
    if (kind !== 'FEINT') this.feintStage = 'NONE';
    if (kind === 'FEINT') this.feintStage = 'IN';
    if (kind === 'PRESS' || kind === 'YIELD' || kind === 'ANGLE' || kind === 'INVITE') {
      this.ticksSinceContact = 0;
    }
  }

  clearIntentionIfExpired(tick: number): void {
    if (this.intention !== 'NONE' && tick >= this.intentionUntil) {
      this.intention = 'NONE';
      this.feintStage = 'NONE';
    }
  }

  activeIntention(tick: number): Intention {
    if (this.intention === 'NONE' || tick >= this.intentionUntil) return 'NONE';
    return this.intention;
  }

  tickTimers(): void {
    if (this.attackCd > 0) this.attackCd--;
    if (this.dodgeCd > 0) this.dodgeCd--;
    if (this.stumbleT > 0) this.stumbleT--;
    if (this.tangleT > 0) this.tangleT--;
    if (this.flash > 0) this.flash--;
    this.ticksSinceContact++;
    if (this.guidingIdleRegen()) {
      const regen = this.guarding
        ? combatTuning.staminaRegenHolding
        : combatTuning.staminaRegenPerTick;
      this.stamina = Math.min(this.maxStamina, this.stamina + regen);
    }

    // Poise: delay fully elapses before refill starts (stamina-like pause)
    if (this.poiseRegenDelay > 0) {
      this.poiseRegenDelay--;
    } else if (this.poise < this.maxPoise) {
      const rate = this.poiseBroken
        ? combatTuning.poiseBrokenRegenPerTick
        : combatTuning.poiseRegenPerTick;
      this.poise = Math.min(this.maxPoise, this.poise + rate);
      if (this.poiseBroken && this.poise >= this.maxPoise * combatTuning.poiseRestoreRatio) {
        this.poiseBroken = false;
      }
    }

    if (this.guarding) {
      if (!this.canGuard) {
        this.endAction();
      } else {
        this.stamina = Math.max(0, this.stamina - this.def().blockStaminaPerTick);
        if (this.stamina <= 0) {
          this.endAction();
        }
      }
    }
  }

  /**
   * Unblockable poise chip. Returns true if this hit broke posture.
   * Hits while already broken do not refresh the regen clock — otherwise
   * a PRESS loop stunlocks forever.
   */
  applyPoiseDamage(amount: number): boolean {
    if (amount <= 0) return false;

    if (this.poiseBroken) {
      this.poise = 0;
      return false;
    }

    this.poise = Math.max(0, this.poise - amount);
    this.poiseRegenDelay = combatTuning.poiseRegenDelay;
    if (this.poise <= 0) {
      this.poise = 0;
      this.poiseBroken = true;
      this.poiseRegenDelay = combatTuning.poiseBrokenRegenDelay;
      this.flash = 10;
      this.applyStumble(combatTuning.poiseBreakStumbleTicks);
      if (this.guarding) {
        this.endAction();
      }
      return true;
    }
    return false;
  }

  private guidingIdleRegen(): boolean {
    return (this.phase === 'IDLE' || this.guarding) && !this.stunned;
  }

  canAfford(cost: number): boolean {
    return this.stamina >= cost;
  }

  startAction(action: ActionKind, windup: number, active: number, recover: number): boolean {
    if (!this.alive || this.busy || this.tangled) return false;
    this.action = action;
    this.phase = windup > 0 ? 'WINDUP' : 'ACTIVE';
    this.phaseT = 0;
    this.phaseMax = windup > 0 ? windup : active;
    this._activeDur = active;
    this._recoverDur = recover;
    this.hitConnected = false;
    if (action === 'ATTACK') {
      this.commitFacing = this.facing;
      this.footwork = 'HOLD';
    }
    return true;
  }

  /**
   * Abort windup into a short recover. Partial stamina refund handled by caller.
   */
  abortWindup(recoverTicks: number): void {
    if (this.action !== 'ATTACK' || this.phase !== 'WINDUP') return;
    this.phase = 'RECOVER';
    this.phaseT = 0;
    this.phaseMax = recoverTicks;
    this._recoverDur = recoverTicks;
    this.commitFacing = null;
    this.hitConnected = false;
    this.abortedAttack = true;
  }

  advancePhase(): void {
    if (this.phase === 'IDLE' || this.stunned) return;
    this.phaseT++;
    if (this.phaseT < this.phaseMax) return;

    if (this.phase === 'WINDUP') {
      this.phase = 'ACTIVE';
      this.phaseT = 0;
      this.phaseMax = this._activeDur;
      return;
    }
    if (this.phase === 'ACTIVE') {
      if (this.action === 'GUARD') {
        // hold guard until released by AI / stamina
        this.phaseT = 0;
        return;
      }
      this.phase = 'RECOVER';
      this.phaseT = 0;
      this.phaseMax = this._recoverDur;
      return;
    }
    this.endAction();
  }

  endAction(): void {
    const d = this.def();
    if (this.action === 'ATTACK') {
      if (this.abortedAttack) {
        this.attackCd = Math.max(
          this.attackCd,
          Math.floor(d.attackCooldown * 0.45 * combatTuning.phaseScale),
        );
        this.attackFinish = null;
        this.abortedAttack = false;
      } else {
        this.attackCd = Math.max(6, Math.round(d.attackCooldown * combatTuning.phaseScale));
        this.attackFinish = this.hitConnected ? 'CONNECTED' : 'WHIFF';
      }
    }
    if (this.action === 'SIDESTEP') this.dodgeCd = d.dodgeCooldown;
    this.action = 'NONE';
    this.phase = 'IDLE';
    this.phaseT = 0;
    this.phaseMax = 0;
    this.commitFacing = null;
    if (this.feintStage === 'WINDUP') this.feintStage = 'NONE';
  }

  applyStumble(ticks: number): void {
    this.stumbleT = Math.max(this.stumbleT, ticks);
    this.action = 'NONE';
    this.phase = 'IDLE';
    this.phaseT = 0;
    this.phaseMax = 0;
    this.commitFacing = null;
    this.footwork = 'HOLD';
    this.vx = 0;
    this.vy = 0;
    this.flash = 12;
  }

  /** Mark end of exchange so abort gate resets. */
  markExchangeContact(): void {
    this.abortUsedExchange = false;
    this.ticksSinceContact = 0;
  }

  snapshot(): FighterSnapshot {
    return {
      id: this.id,
      team: this.team,
      kind: this.kind,
      armatura: this.armatura,
      beastId: this.beastId,
      name: this.name,
      x: this.x,
      y: this.y,
      facing: this.facing,
      hp: this.hp,
      maxHp: this.maxHp,
      stamina: this.stamina,
      maxStamina: this.maxStamina,
      poise: this.poise,
      maxPoise: this.maxPoise,
      action: this.action,
      phase: this.phase,
      phaseT: this.phaseT,
      phaseMax: this.phaseMax,
      footwork: this.footwork,
      intention: this.intention,
      desiredDist: this.desiredDist,
      poiseTier: this.poiseTier,
      stunned: this.stunned,
      tangled: this.tangled,
      poiseBroken: this.poiseBroken,
      guarding: this.guarding,
      alive: this.alive,
      flash: this.flash,
    };
  }
}
