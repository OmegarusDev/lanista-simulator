import { ARMATURAE } from '../../content/armatura';
import { BEASTS } from '../../content/beasts';
import type { BoutFighterStat } from '../../domain/campaign/aftermath';
import { createQuickMatch, type Match } from '../../domain/combat/match';
import type { CrowdShout } from '../../domain/combat/entertainment';
import { SeededRNG } from '../../domain/rng';
import type { CombatEvent, FighterSnapshot, MatchResult } from '../../domain/combat/types';
import { ARENA_WORLD_H, ARENA_WORLD_W } from '../../shell/canvas';
import type { Input } from '../../shell/input';
import { applyCombatEvents, fightCombatFxHooks } from '../../view/combatFx';
import type { Synth } from '../../view/audio';
import { FightHud, type FightHudAction } from '../../ui/fightHud';
import type { SandboxConfig } from '../../domain/combat/types';
import type { GlFrame } from '../../gl/index';
import { defaultStageDolly } from '../../gl/camera';
import { toStageDrawModel } from '../../gl/drawModel';
import { pickFromScreen } from '../../gl/pick';
import type { Intention } from '../../domain/combat/types';

/** Diegetic reading of the AI's intentions — the editor reads the fighter. */
const INTENTION_PHRASE: Record<Intention, string> = {
  NONE: 'Watching',
  PRESS: 'Presses the attack',
  YIELD: 'Backing off',
  ANGLE: 'Circling for an angle',
  INVITE: 'Baiting a lunge',
  FEINT: 'Feinting',
  RESET: 'Catching his breath',
};

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
  private readonly fxRng: SeededRNG;
  private readonly config: SandboxConfig;
  private readonly career: boolean;
  private readonly lineupIds: number[];
  private crowdShout: CrowdShout | null = null;
  private crowdShoutLife = 0;
  private interestX: number | null = null;
  private interestY: number | null = null;
  private interestLife = 0;
  private ptrWasDown = false;
  private hudDirty = true;
  private hudTick = 0;
  private hudKey = '';
  private framedOnce = false;
  private lastCssW = 0;
  private lastCssH = 0;
  private story: string[] = [];
  private firstBlood = false;

  constructor(
    config: SandboxConfig,
    private readonly synth: Synth,
    private readonly hud: FightHud,
    private readonly glFrame: GlFrame,
    opts?: FightOptions,
  ) {
    this.config = config;
    this.career = Boolean(opts?.career);
    this.lineupIds = opts?.lineupIds ? [...opts.lineupIds] : [];
    this.match = this.makeMatch(config);
    this.fxRng = new SeededRNG(config.seed ^ 0xd057);
    // Always frame the sand disk first — director will track fighters once they exist.
    this.glFrame.camera.frameArena(defaultStageDolly(960, 540));
    this.glFrame.fx.clear();
    // Populate the HUD before showing it — no empty-rails frame on entry.
    this.hud.show(true);
    this.hudDirty = true;
    this.refreshHud(this.match.snapshots());
  }

  dispose(): void {
    this.hud.show(false);
    this.glFrame.fx.clear();
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
      this.glFrame.fx.step(1);
      return { type: 'NONE' };
    }

    if (this.finished) {
      this.glFrame.fx.step(1);
      return { type: 'NONE' };
    }

    const steps = this.speed;
    let ran = 0;
    for (let i = 0; i < steps; i++) {
      ran++;
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

    // Step FX exactly as far as the sim ran — no overshoot on the KO frame.
    this.glFrame.fx.step(ran);

    if (this.shake > 0) this.shake *= 0.85;
    if (this.shake < 0.2) this.shake = 0;

    if (this.selectedId !== null) {
      const still = this.match.snapshots().some((f) => f.id === this.selectedId);
      if (!still) {
        this.selectedId = null;
        this.hudDirty = true;
      }
    }

    return { type: 'NONE' };
  }

  paint(cssW: number, cssH: number, input: Input): FightAction {
    if (cssW > 1 && cssH > 1 && (cssW !== this.lastCssW || cssH !== this.lastCssH)) {
      this.lastCssW = cssW;
      this.lastCssH = cssH;
      this.glFrame.camera.resize(cssW, cssH);
      if (!this.framedOnce) {
        this.framedOnce = true;
        this.glFrame.camera.frameArena(defaultStageDolly(cssW, cssH));
        this.hudDirty = true;
      } else if (this.glFrame.camera.mode !== 'manual') {
        // Orientation change while director-owned: reframe to the new aspect.
        this.glFrame.camera.frameArena(defaultStageDolly(cssW, cssH));
      }
    }

    const snapsAll = this.match.snapshots();
    // Keep director warm on the paint path too (hit-stop / pause skip updateDirector).
    this.glFrame.camera.updateDirector(snapsAll, {
      selectedId: this.selectedId,
      interestX: this.interestX ?? undefined,
      interestY: this.interestY ?? undefined,
      autoRecover: true,
    });
    const model = toStageDrawModel(snapsAll, {
      seed: this.config.seed,
      shake: this.shake,
      selectedId: this.selectedId,
      mood: this.finished
        ? this.match.result === 'TEAM0'
          ? 'win'
          : this.match.result === 'TEAM1'
            ? 'loss'
            : 'quiet'
        : 'fight',
      favor: this.match.teamCrowdFavor(0),
    });
    this.glFrame.render(model);

    if (!this.paused && !this.finished) {
      this.handleCamera(input, model.fighters, cssW, cssH);
    }

    this.hudTick++;
    if (this.hudDirty || this.hudTick % 4 === 0) {
      this.refreshHud(snapsAll);
      this.hudDirty = false;
    }

    return { type: 'NONE' };
  }

  /** Frozen pose for aftermath / leave. */
  lastDrawModel() {
    return toStageDrawModel(this.match.snapshots(), {
      seed: this.config.seed,
      shake: 0,
      selectedId: this.selectedId,
      mood: this.match.result === 'TEAM0' ? 'win' : this.match.result === 'TEAM1' ? 'loss' : 'quiet',
    });
  }

  private refreshHud(snaps: FighterSnapshot[]): void {
    const alive = this.match.fighters.filter((f) => f.alive);
    let lean = 'Crowd is restless';
    let crowdLean: 'blue' | 'red' | null = null;
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
      if (bestFavor >= 0.62) {
        lean = `Crowd favors ${best.name}`;
        crowdLean = best.team === 0 ? 'blue' : 'red';
      }
    }
    const caption =
      this.crowdShout && this.crowdShoutLife > 0 ? this.crowdShout.text : lean;

    let mvp: string | null = null;
    if (this.finished) {
      let bestId = -1;
      let bestScore = 0;
      for (const f of this.match.fighters) {
        const score = this.match.entertainment.score(f.id);
        if (score > bestScore) {
          bestScore = score;
          bestId = f.id;
        }
      }
      if (bestId >= 0 && bestScore > 0) {
        const f = this.match.fighters.find((x) => x.id === bestId);
        if (f) mvp = `${f.name} wins the crowd`;
      }
    }

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
          // Diegetic: the AI's intention reads as a readable motivation,
          // not a state code — the editor reads the fighter's body.
          { label: 'Intent', value: INTENTION_PHRASE[f.intention] ?? f.intention },
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

    const key = this.hudRenderKey(snaps, caption, mvp);
    if (key === this.hudKey) return;
    this.hudKey = key;

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
      ticker: this.story,
      mvp,
      crowdLean,
      cameraManual: this.glFrame.camera.mode === 'manual',
      entertainment: this.match.fighters.reduce(
        (sum, f) => sum + this.match.entertainment.score(f.id),
        0,
      ),
    });
  }

  /** Rebuild HUD only when displayed data actually changed — keeps buttons stable mid-fight. */
  private hudRenderKey(
    snaps: FighterSnapshot[],
    caption: string,
    mvp: string | null,
  ): string {
    return [
      this.selectedId,
      this.paused,
      this.finished,
      this.speed,
      this.synth.isMuted,
      this.debugFeel,
      caption,
      mvp ?? '',
      Math.round(this.match.teamCrowdFavor(0) * 100),
      Math.round(this.match.teamCrowdFavor(1) * 100),
      this.glFrame.camera.mode,
      this.story.join('|'),
      snaps
        .map(
          (f) =>
            `${f.id}:${Math.round(f.hp)}:${Math.round(f.stamina)}:${Math.round(f.poise)}:${f.alive}:${f.action}:${f.phase}:${f.intention}:${f.poiseTier}:${f.guarding}:${f.stunned}:${f.poiseBroken}`,
        )
        .join(';'),
    ].join('|');
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
        this.glFrame.camera.focusTeamGroup(action.team, this.match.snapshots());
        this.selectedId = null;
        this.synth.play('ui');
        this.hudDirty = true;
        return { type: 'NONE' };
      case 'RECENTER':
        this.glFrame.camera.recenter();
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

  private handleCamera(
    input: Input,
    fighters: ReturnType<typeof toStageDrawModel>['fighters'],
    cssW: number,
    cssH: number,
  ): void {
    const cam = this.glFrame.camera;
    cam.applyZoomInput(input.wheelDelta, input.pinchDelta, input.orbitDx, input.orbitDy);
    if (input.wasKeyPressed('Equal') || input.wasKeyPressed('NumpadAdd')) {
      cam.nudgeDolly(0.08);
    }
    if (input.wasKeyPressed('Minus') || input.wasKeyPressed('NumpadSubtract')) {
      cam.nudgeDolly(-0.08);
    }
    if (input.isPinching) {
      if (cam.isDragging()) cam.endDrag();
      this.ptrWasDown = false;
      return;
    }
    const p = input.pointer;
    const inArena = p.x >= 0 && p.x <= cssW && p.y >= 0 && p.y <= cssH;
    const orbit = input.isKeyDown('ShiftLeft') || input.isKeyDown('ShiftRight');

    if (p.down && !this.ptrWasDown && inArena) {
      cam.beginDrag(p.x, p.y, orbit);
    }
    if (p.down && cam.isDragging()) {
      cam.dragTo(p.x, p.y);
    }
    if (!p.down && this.ptrWasDown) {
      const dragged = cam.endDrag();
      if (!dragged && inArena) {
        const hit = pickFromScreen(cam, fighters, p.x, p.y, cssW, cssH, 42);
        if (hit) {
          this.toggleSelect(hit.id);
          this.synth.play('ui');
          this.hudDirty = true;
        } else if (this.selectedId !== null || cam.mode === 'focus') {
          // Tapping empty sand only releases an actual selection/focus —
          // never yank a manual camera back to the director mid-look.
          this.selectedId = null;
          cam.clearFocus();
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
      this.glFrame.camera.clearFocus();
      return;
    }
    this.selectedId = id;
    const f = this.match.snapshots().find((s) => s.id === id);
    if (f) this.glFrame.camera.focusFighter(f);
  }

  private consumeEvents(events: CombatEvent[]): void {
    applyCombatEvents(
      events,
      fightCombatFxHooks({
        play: (kind) => this.synth.play(kind),
        getShake: () => this.shake,
        setShake: (n) => {
          this.shake = n;
        },
        getHitStop: () => this.hitStop,
        setHitStop: (n) => {
          this.hitStop = n;
        },
        fx: this.glFrame.fx,
        rng: () => this.fxRng.next(),
        camera: this.glFrame.camera,
        setInterest: (x, y, life) => {
          this.interestX = x;
          this.interestY = y;
          this.interestLife = life;
          this.glFrame.camera.setInterest(x, y, life);
        },
      }),
    );
    this.collectStory(events);
  }

  /** Turn notable combat events into the crowd's story ticker. */
  private collectStory(events: CombatEvent[]): void {
    if (events.length === 0) return;
    const names = new Map<number, string>();
    for (const f of this.match.fighters) names.set(f.id, f.name);
    const byId = (id?: number): string => (id != null ? (names.get(id) ?? 'Someone') : 'Someone');

    for (const ev of events) {
      switch (ev.kind) {
        case 'HIT': {
          const target = this.match.fighters.find((f) => f.id === ev.targetId);
          const heavy = target && ev.amount != null && ev.amount > target.maxHp * 0.22;
          if (!this.firstBlood) {
            this.firstBlood = true;
            this.story.push(`${byId(ev.actorId)} draws first blood!`);
          } else if (heavy) {
            this.story.push(`${byId(ev.actorId)} lands a punishing blow on ${byId(ev.targetId)}!`);
          }
          break;
        }
        case 'POISE_BREAK':
          this.story.push(`${byId(ev.targetId)} guard is shattered!`);
          break;
        case 'TIP_CATCH':
          this.story.push(`${byId(ev.actorId)} snares a tip-strike!`);
          break;
        case 'STUMBLE':
          this.story.push(`${byId(ev.actorId)} stumbles on the sand!`);
          break;
        case 'KO':
          this.story.push(`${byId(ev.targetId)} is down — the crowd roars!`);
          break;
        default:
          break;
      }
    }
    if (this.story.length > 3) this.story.splice(0, this.story.length - 3);
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
  if (f.intention !== 'NONE') return f.intention.charAt(0) + f.intention.slice(1).toLowerCase();
  return 'Ready';
}
