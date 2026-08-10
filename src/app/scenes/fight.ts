import { ARMATURAE } from '../../content/armatura';
import { BEASTS } from '../../content/beasts';
import type { BoutFighterStat } from '../../domain/campaign/aftermath';
import { createQuickMatch, type Match } from '../../domain/combat/match';
import type { CrowdShout } from '../../domain/combat/entertainment';
import { SeededRNG } from '../../domain/rng';
import type { CombatEvent, FighterSnapshot, MatchResult } from '../../domain/combat/types';
import { ARENA_WORLD_H, ARENA_WORLD_W } from '../../shell/canvas';
import type { Input } from '../../shell/input';
import {
  spawnDust,
  stepDust,
  type DustParticle,
} from '../../view/arena';
import { ArenaCamera } from '../../view/arenaCamera';
import type { Synth } from '../../view/audio';
import {
  defaultStageZoom,
  paintStageWorld,
  pickFighterWorld,
  stagePointerToWorld,
  stageViewRect,
} from '../../view/stagePaint';
import type { WorldViewTransform } from '../../view/layout';
import { FightHud, type FightHudAction } from '../../ui/fightHud';
import type { SandboxConfig } from '../../ui/practiceView';

export type FightAction =
  | { type: 'NONE' }
  | { type: 'EXIT' }
  | { type: 'RESTART' }
  | { type: 'REROLL' }
  | {
      type: 'CAREER_DONE';
      result: MatchResult;
      forfeited: boolean;
      boutStats: BoutFighterStat[];
    };

export interface FightOptions {
  career?: boolean;
  lineupIds?: number[];
}

export class FightScene {
  private match: Match;
  private speed = 1;
  private shake = 0;
  private hitStop = 0;
  private finished = false;
  private paused = false;
  private debugFeel = false;
  private selectedId: number | null = null;
  private readonly dust: DustParticle[] = [];
  private readonly fxRng: SeededRNG;
  private readonly config: SandboxConfig;
  private readonly career: boolean;
  private readonly lineupIds: number[];
  private crowdShout: CrowdShout | null = null;
  private crowdShoutLife = 0;
  private readonly cam = new ArenaCamera();
  private interestX: number | null = null;
  private interestY: number | null = null;
  private interestLife = 0;
  private ptrWasDown = false;
  private worldT: WorldViewTransform | null = null;
  private hudDirty = true;
  private hudTick = 0;
  private lastCssW = 0;
  private lastCssH = 0;

  constructor(
    config: SandboxConfig,
    private readonly synth: Synth,
    private readonly hud: FightHud,
    opts?: FightOptions,
  ) {
    this.config = config;
    this.career = Boolean(opts?.career);
    this.lineupIds = opts?.lineupIds ? [...opts.lineupIds] : [];
    this.match = this.makeMatch(config);
    this.fxRng = new SeededRNG(config.seed ^ 0xd057);
    this.cam.reset(1.12, 'contain');
    this.hud.show(true);
    this.hudDirty = true;
  }

  dispose(): void {
    this.hud.show(false);
  }

  private makeMatch(config: SandboxConfig): Match {
    return createQuickMatch(
      config.teamSize,
      config.seed,
      config.team0,
      config.team1,
      ARENA_WORLD_W,
      ARENA_WORLD_H,
      config.team0Specs,
      config.team1Specs,
    );
  }

  update(input: Input): FightAction {
    const key = this.handleKeys(input);
    if (key.type !== 'NONE') return key;

    const hudAction = this.hud.poll();
    const fromHud = this.applyHudAction(hudAction);
    if (fromHud.type !== 'NONE') return fromHud;

    if (this.paused) return { type: 'NONE' };

    if (this.hitStop > 0) {
      this.hitStop--;
      stepDust(this.dust);
      return { type: 'NONE' };
    }

    if (this.finished) {
      stepDust(this.dust);
      return { type: 'NONE' };
    }

    const steps = this.speed;
    for (let i = 0; i < steps; i++) {
      const result = this.match.step();
      this.consumeEvents(this.match.getRecentEvents());
      const shout = this.match.consumeCrowdShout();
      if (shout) {
        this.crowdShout = shout;
        this.crowdShoutLife = shout.life;
      }
      this.match.clearRecentEvents();
      if (result !== 'ONGOING') {
        this.finished = true;
        this.synth.play('ko');
        this.hudDirty = true;
        break;
      }
    }

    if (this.crowdShoutLife > 0) this.crowdShoutLife--;
    if (this.crowdShoutLife <= 0) this.crowdShout = null;
    if (this.interestLife > 0) this.interestLife--;
    if (this.interestLife <= 0) {
      this.interestX = null;
      this.interestY = null;
    }

    stepDust(this.dust);

    if (this.shake > 0) this.shake *= 0.85;
    if (this.shake < 0.2) this.shake = 0;

    if (this.selectedId !== null) {
      const still = this.match.snapshots().some((f) => f.id === this.selectedId);
      if (!still) {
        this.selectedId = null;
        this.hudDirty = true;
      }
    }

    const snaps = this.match.snapshots();
    this.cam.updateAutocam(snaps, {
      selectedId: this.selectedId,
      interestX: this.interestX ?? undefined,
      interestY: this.interestY ?? undefined,
    });
    this.cam.tickSmooth();

    return { type: 'NONE' };
  }

  paint(
    ctx: CanvasRenderingContext2D,
    cssW: number,
    cssH: number,
    input: Input,
  ): FightAction {
    if (cssW !== this.lastCssW || cssH !== this.lastCssH) {
      this.lastCssW = cssW;
      this.lastCssH = cssH;
      this.cam.zoom = defaultStageZoom(cssW, cssH);
      this.cam.smoothZoom = this.cam.zoom;
      this.hudDirty = true;
    }

    const snapsAll = this.match.snapshots();
    this.worldT = paintStageWorld(ctx, {
      cssW,
      cssH,
      cam: this.cam,
      seed: this.config.seed,
      fighters: snapsAll,
      selectedId: this.selectedId,
      dust: this.dust,
      shake: this.shake,
    });

    if (!this.paused && !this.finished) {
      this.handleArenaCamera(input, snapsAll, cssW, cssH);
    }

    this.hudTick++;
    if (this.hudDirty || this.hudTick % 4 === 0) {
      this.refreshHud(snapsAll);
      this.hudDirty = false;
    }

    return { type: 'NONE' };
  }

  private refreshHud(snaps: FighterSnapshot[]): void {
    const alive = this.match.fighters.filter((f) => f.alive);
    let lean = 'Crowd is restless';
    if (alive.length > 0) {
      let best = alive[0]!;
      let bestFavor = this.match.crowdFavorFor(best.id);
      for (let i = 1; i < alive.length; i++) {
        const f = alive[i]!;
        const favor = this.match.crowdFavorFor(f.id);
        if (favor > bestFavor) {
          best = f;
          bestFavor = favor;
        }
      }
      if (bestFavor >= 0.62) lean = `Crowd favors ${best.name}`;
    }
    const caption =
      this.crowdShout && this.crowdShoutLife > 0 ? this.crowdShout.text : lean;

    const resultLabel =
      this.match.result === 'DRAW'
        ? 'Draw'
        : this.match.result === 'TEAM0'
          ? 'Blue wins'
          : this.match.result === 'TEAM1'
            ? 'Red wins'
            : '…';

    let inspect: {
      title: string;
      subtitle: string;
      stateLine: string;
      preferLeft: boolean;
      lines: { label: string; value: string }[];
      debugLines?: string[];
    } | null = null;
    if (this.selectedId !== null) {
      const f = snaps.find((s) => s.id === this.selectedId);
      if (f) {
        const def =
          f.kind === 'beast' && f.beastId
            ? { ...BEASTS[f.beastId], id: f.armatura }
            : ARMATURAE[f.armatura];
        const favor01 = this.match.crowdFavorFor(f.id);
        const lines: { label: string; value: string }[] = [
          { label: 'HP', value: `${Math.ceil(f.hp)} / ${f.maxHp}` },
          { label: 'Stamina', value: `${Math.ceil(f.stamina)} / ${f.maxStamina}` },
          { label: 'Poise', value: `${Math.ceil(f.poise)} / ${f.maxPoise}` },
          { label: 'Crowd', value: `${Math.round(favor01 * 100)}%` },
          { label: 'Range', value: `${def.attackRange}` },
          { label: 'Guard', value: `${(def.guardArc * (180 / Math.PI)).toFixed(0)}°` },
          { label: 'Mass', value: def.mass.toFixed(2) },
        ];
        if (def.tipCatchRatio > 0) {
          lines.push({
            label: 'Tip-catch',
            value: `${Math.round(def.tipCatchRatio * 100)}% reach`,
          });
        }
        inspect = {
          title: f.name,
          subtitle: `${def.name} · ${f.team === 0 ? 'Blue' : 'Red'}`,
          stateLine: fighterStateLine(f),
          preferLeft: f.x > ARENA_WORLD_W / 2,
          lines,
          debugLines: this.debugFeel
            ? [
                `${f.intention}  d*${f.desiredDist.toFixed(0)}`,
                `${f.poiseTier}  ${f.action}/${f.phase}`,
                `fw ${f.footwork}`,
              ]
            : undefined,
        };
      }
    }

    this.hud.render({
      teamSize: this.config.teamSize,
      seed: this.config.seed,
      career: this.career,
      speed: this.speed,
      paused: this.paused,
      finished: this.finished,
      resultLabel,
      muted: this.synth.isMuted,
      snaps,
      selectedId: this.selectedId,
      favorBlue: this.match.teamCrowdFavor(0),
      favorRed: this.match.teamCrowdFavor(1),
      crowdCaption: caption,
      inspect,
      debugFeel: this.debugFeel,
    });
  }

  private handleKeys(input: Input): FightAction {
    if (input.wasKeyPressed('KeyQ')) return this.careerLeave();
    if (input.wasKeyPressed('Escape')) {
      if (this.selectedId !== null) {
        this.selectedId = null;
        this.hudDirty = true;
        return { type: 'NONE' };
      }
      this.paused = !this.paused;
      this.hudDirty = true;
      return { type: 'NONE' };
    }
    if (input.wasKeyPressed('KeyP')) {
      this.paused = !this.paused;
      this.hudDirty = true;
      return { type: 'NONE' };
    }
    if (input.wasKeyPressed('Digit1')) {
      this.speed = 1;
      this.hudDirty = true;
    }
    if (input.wasKeyPressed('Digit2')) {
      this.speed = 2;
      this.hudDirty = true;
    }
    if (input.wasKeyPressed('Digit4')) {
      this.speed = 4;
      this.hudDirty = true;
    }
    if (!this.career && input.wasKeyPressed('KeyR')) return { type: 'RESTART' };
    if (!this.career && input.wasKeyPressed('KeyN')) return { type: 'REROLL' };
    if (input.wasKeyPressed('KeyD')) {
      this.debugFeel = !this.debugFeel;
      this.hudDirty = true;
    }
    return { type: 'NONE' };
  }

  private applyHudAction(action: FightHudAction): FightAction {
    switch (action.type) {
      case 'NONE':
        return { type: 'NONE' };
      case 'PAUSE_TOGGLE':
        this.paused = !this.paused;
        this.hudDirty = true;
        this.synth.play('ui');
        return { type: 'NONE' };
      case 'SPEED':
        this.speed = action.speed;
        this.hudDirty = true;
        return { type: 'NONE' };
      case 'SELECT':
        this.toggleSelect(action.id);
        this.synth.play('ui');
        this.hudDirty = true;
        return { type: 'NONE' };
      case 'FOCUS_TEAM':
        this.cam.focusTeamGroup(action.team, this.match.snapshots());
        this.selectedId = null;
        this.synth.play('ui');
        this.hudDirty = true;
        return { type: 'NONE' };
      case 'RESUME':
        this.paused = false;
        this.hudDirty = true;
        this.synth.play('ui');
        return { type: 'NONE' };
      case 'MUTE':
        this.synth.toggleMute();
        this.hudDirty = true;
        this.synth.play('ui');
        return { type: 'NONE' };
      case 'RESTART':
        this.synth.play('ui');
        return { type: 'RESTART' };
      case 'REROLL':
        this.synth.play('ui');
        return { type: 'REROLL' };
      case 'LEAVE':
        this.synth.play('ui');
        return this.careerLeave();
      case 'CONTINUE':
        this.synth.play('ui');
        return {
          type: 'CAREER_DONE',
          result: this.match.result,
          forfeited: false,
          boutStats: this.buildBoutStats(),
        };
      default:
        return { type: 'NONE' };
    }
  }

  private careerLeave(): FightAction {
    if (!this.career) return { type: 'EXIT' };
    if (this.finished) {
      return {
        type: 'CAREER_DONE',
        result: this.match.result,
        forfeited: false,
        boutStats: this.buildBoutStats(),
      };
    }
    return {
      type: 'CAREER_DONE',
      result: 'TEAM1',
      forfeited: true,
      boutStats: this.buildBoutStats(),
    };
  }

  private buildBoutStats(): BoutFighterStat[] {
    const team0 = this.match.fighters.filter((f) => f.team === 0);
    return team0
      .map((f, i) => ({
        gladiatorId: this.lineupIds[i] ?? -1,
        entertainment: this.match.entertainment.score(f.id),
        downed: !f.alive,
      }))
      .filter((s) => s.gladiatorId >= 0);
  }

  private handleArenaCamera(
    input: Input,
    snaps: FighterSnapshot[],
    cssW: number,
    cssH: number,
  ): void {
    if (input.wheelDelta !== 0) {
      this.cam.nudgeZoom(-Math.sign(input.wheelDelta) * 0.06);
    }
    const p = input.pointer;
    const v = stageViewRect(cssW, cssH);
    const t = this.worldT ?? this.cam.toTransform(v);
    const inArena = p.x >= 0 && p.x <= cssW && p.y >= 0 && p.y <= cssH;

    if (p.down && !this.ptrWasDown && inArena) {
      this.cam.beginDrag(p.x, p.y, t.scale);
    }
    if (p.down && this.cam.isDragging()) {
      this.cam.dragTo(p.x, p.y);
    }
    if (!p.down && this.ptrWasDown) {
      const dragged = this.cam.endDrag();
      if (!dragged && inArena) {
        const world = stagePointerToWorld(p.x, p.y, t);
        const hitR = 26 / Math.max(0.001, t.scale);
        const hit = pickFighterWorld(snaps, world.x, world.y, hitR);
        if (hit) {
          this.toggleSelect(hit.id);
          this.synth.play('ui');
          this.hudDirty = true;
        } else {
          this.selectedId = null;
          this.cam.clearFocus();
          this.hudDirty = true;
        }
      }
      input.pointer.clicked = false;
    }
    this.ptrWasDown = p.down;
  }

  private toggleSelect(id: number | null): void {
    if (id === null || this.selectedId === id) {
      this.selectedId = null;
      this.cam.clearFocus();
      return;
    }
    this.selectedId = id;
    const f = this.match.snapshots().find((s) => s.id === id);
    if (f) this.cam.focusFighter(f);
  }

  private consumeEvents(events: CombatEvent[]): void {
    for (const ev of events) {
      switch (ev.kind) {
        case 'HIT':
          this.synth.play('hit');
          this.shake = Math.min(10, this.shake + 4);
          this.hitStop = Math.max(this.hitStop, 3);
          spawnDust(this.dust, ev.x, ev.y, 5, this.fxRng);
          this.interestX = ev.x;
          this.interestY = ev.y;
          this.interestLife = 45;
          break;
        case 'GUARD':
          this.synth.play('block');
          this.shake = Math.min(8, this.shake + 2);
          this.hitStop = Math.max(this.hitStop, 2);
          break;
        case 'SIDESTEP':
          this.synth.play('dodge');
          break;
        case 'STUMBLE':
        case 'POISE_BREAK':
          this.synth.play('stun');
          this.shake = Math.min(14, this.shake + 6);
          this.hitStop = Math.max(this.hitStop, 6);
          spawnDust(this.dust, ev.x, ev.y, 8, this.fxRng);
          break;
        case 'ABORT':
          this.synth.play('dodge');
          break;
        case 'TIP_CATCH':
          this.synth.play('net');
          this.hitStop = Math.max(this.hitStop, 4);
          break;
        case 'KO':
          this.shake = Math.min(16, this.shake + 8);
          this.hitStop = Math.max(this.hitStop, 8);
          spawnDust(this.dust, ev.x, ev.y, 6, this.fxRng);
          this.interestX = ev.x;
          this.interestY = ev.y;
          this.interestLife = 70;
          break;
        default:
          break;
      }
    }
  }
}

function fighterStateLine(f: FighterSnapshot): string {
  if (!f.alive) return 'Fallen';
  if (f.stunned) return 'Stunned';
  if (f.poiseBroken || f.poiseTier === 'BROKEN') return 'Broken';
  if (f.tangled) return 'Tangled';
  if (f.guarding) return 'Guarding';
  if (f.action === 'SIDESTEP' && f.phase !== 'IDLE') return 'Sidestep';
  if (f.action === 'ATTACK') {
    if (f.phase === 'WINDUP') return 'Windup';
    if (f.phase === 'ACTIVE') return 'Striking';
    if (f.phase === 'RECOVER') return 'Recovering';
  }
  if (f.poiseTier === 'CRITICAL') return 'Poise critical';
  if (f.poiseTier === 'SOFT') return 'Poise soft';
  return 'Ready';
}
