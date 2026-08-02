import { ARMATURAE } from '../../content/armatura';
import { colors } from '../../content/palette';
import { createQuickMatch, type Match } from '../../domain/combat/match';
import { SeededRNG } from '../../domain/rng';
import type { CombatEvent, FighterSnapshot, MatchResult } from '../../domain/combat/types';
import { ARENA_WORLD_H, ARENA_WORLD_W, getDesign } from '../../shell/canvas';
import type { Input } from '../../shell/input';
import {
  drawArena,
  drawArenaChromeVignette,
  drawDust,
  spawnDust,
  stepDust,
  type DustParticle,
} from '../../view/arena';
import type { Synth } from '../../view/audio';
import { drawGladiator } from '../../view/gladiatorDraw';
import {
  designToWorld,
  fightInspectRect,
  fightStageLayout,
  type FightStageLayout,
} from '../../view/layout';
import {
  button,
  debugBadge,
  hairline,
  inspectCard,
  label,
  rosterChip,
  segmentedControl,
} from '../../view/ui';
import { space, typeScale } from '../../view/theme';
import type { SandboxConfig } from './sandbox';

export type FightAction =
  | { type: 'NONE' }
  | { type: 'EXIT' }
  | { type: 'RESTART' }
  | { type: 'REROLL' }
  /** Career bout finished or forfeited — App applies aftermath. */
  | { type: 'CAREER_DONE'; result: MatchResult; forfeited: boolean };

export interface FightOptions {
  /** Career munera: no reroll; leave mid-bout = forfeit; end → CAREER_DONE. */
  career?: boolean;
}

const SPEEDS = [1, 2, 4] as const;

export class FightScene {
  private match: Match;
  private speed = 1;
  private shake = 0;
  private hitStop = 0;
  private finished = false;
  private debugFeel = false;
  private selectedId: number | null = null;
  private readonly dust: DustParticle[] = [];
  private readonly fxRng: SeededRNG;
  private readonly config: SandboxConfig;
  private readonly career: boolean;

  constructor(
    config: SandboxConfig,
    private readonly synth: Synth,
    opts?: FightOptions,
  ) {
    this.config = config;
    this.career = Boolean(opts?.career);
    this.match = this.makeMatch(config);
    this.fxRng = new SeededRNG(config.seed ^ 0xd057);
  }

  private makeMatch(config: SandboxConfig): Match {
    return createQuickMatch(
      config.teamSize,
      config.seed,
      config.team0,
      config.team1,
      ARENA_WORLD_W,
      ARENA_WORLD_H,
    );
  }

  update(input: Input): FightAction {
    if (input.wasKeyPressed('KeyQ')) {
      return this.careerLeave();
    }
    if (input.wasKeyPressed('Escape')) {
      if (this.selectedId !== null) {
        this.selectedId = null;
        return { type: 'NONE' };
      }
      return this.careerLeave();
    }
    if (input.wasKeyPressed('Digit1')) this.speed = 1;
    if (input.wasKeyPressed('Digit2')) this.speed = 2;
    if (input.wasKeyPressed('Digit4')) this.speed = 4;
    if (!this.career && input.wasKeyPressed('KeyR')) return { type: 'RESTART' };
    if (!this.career && input.wasKeyPressed('KeyN')) return { type: 'REROLL' };
    if (input.wasKeyPressed('KeyD')) this.debugFeel = !this.debugFeel;

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
      this.match.clearRecentEvents();
      if (result !== 'ONGOING') {
        this.finished = true;
        this.synth.play('ko');
        break;
      }
    }

    stepDust(this.dust);

    if (this.shake > 0) this.shake *= 0.85;
    if (this.shake < 0.2) this.shake = 0;

    // Drop selection if fighter vanished (shouldn't, but safe)
    if (this.selectedId !== null) {
      const still = this.match.snapshots().some((f) => f.id === this.selectedId);
      if (!still) this.selectedId = null;
    }

    return { type: 'NONE' };
  }

  draw(ctx: CanvasRenderingContext2D, input: Input): FightAction {
    const stage = fightStageLayout();
    const { w, h } = getDesign();

    // Shell fill behind world
    ctx.fillStyle = colors.bg;
    ctx.fillRect(0, 0, w, h);

    const t = stage.world;
    ctx.save();
    ctx.translate(t.ox, t.oy);
    ctx.scale(t.scale, t.scale);
    drawArena(ctx, this.shake, { seed: this.config.seed, stage });

    const snaps = this.match.snapshots().slice().sort((a, b) => a.y - b.y);
    for (const f of snaps) {
      const selected = f.id === this.selectedId;
      drawGladiator(ctx, f, { selected, showSelectedName: selected });
    }

    drawDust(ctx, this.dust);
    ctx.restore();

    drawArenaChromeVignette(ctx, stage);

    // —— Chrome bands (design space) ——
    this.drawTopBand(ctx, stage);
    let action = this.drawBottomChrome(ctx, input, stage);
    this.drawRoster(ctx, input, snaps, stage);
    this.drawInspect(ctx, snaps, stage);

    if (this.debugFeel) {
      debugBadge(ctx, stage.w - 56, 8);
    }

    if (this.finished) {
      action = this.drawEndBanner(ctx, input, action, stage);
    } else {
      // Arena click-to-select after chrome consumed clicks
      this.handleArenaPick(input, snaps, stage);
    }

    return action;
  }

  private drawTopBand(ctx: CanvasRenderingContext2D, stage: FightStageLayout): void {
    const yTitle = stage.orientation === 'portrait' ? 28 : 26;
    label(ctx, `${this.config.teamSize}v${this.config.teamSize}`, 16, yTitle, {
      size: typeScale.title,
      color: colors.parchment,
    });

    const lineup = this.match
      .snapshots()
      .map((f) => `${f.team === 0 ? 'B' : 'R'}:${ARMATURAE[f.armatura].short}`)
      .join('  ·  ');
    label(ctx, lineup, stage.w / 2, yTitle, {
      size: stage.orientation === 'portrait' ? typeScale.meta : typeScale.label,
      align: 'center',
      color: colors.muted,
    });

    label(ctx, `seed ${this.config.seed}`, 16, yTitle + 16, {
      variant: 'eyebrow',
      color: colors.muted,
    });
  }

  private careerLeave(): FightAction {
    if (!this.career) return { type: 'EXIT' };
    if (this.finished) {
      return { type: 'CAREER_DONE', result: this.match.result, forfeited: false };
    }
    return { type: 'CAREER_DONE', result: 'TEAM1', forfeited: true };
  }

  private drawBottomChrome(
    ctx: CanvasRenderingContext2D,
    input: Input,
    stage: FightStageLayout,
  ): FightAction {
    const y = stage.bottomCtrlY;
    let action: FightAction = { type: 'NONE' };
    const pad = 12;
    const rowH =
      stage.bottomRows === 2
        ? (stage.bottomCtrlH - 8) / 2 // space.sm between the two portrait rows
        : stage.bottomCtrlH;

    if (stage.bottomRows === 2) {
      // Portrait: session row, then playback row
      const sessionN = this.career ? 1 : 3;
      const labels = this.career ? ['Leave'] : ['Leave', 'Restart', 'Reroll'];
      const rowW = stage.w - pad * 2;
      const gap = 8;
      const bw = (rowW - gap * (sessionN - 1)) / sessionN;
      for (let i = 0; i < sessionN; i++) {
        const r = { x: pad + i * (bw + gap), y, w: bw, h: rowH };
        if (button(ctx, r, labels[i]!, input.pointer)) {
          this.synth.play('ui');
          if (i === 0) action = this.careerLeave();
          else if (i === 1) action = { type: 'RESTART' };
          else action = { type: 'REROLL' };
        }
      }

      const y2 = y + rowH + space.sm;
      const speedIdx = SPEEDS.indexOf(this.speed as (typeof SPEEDS)[number]);
      const segW = stage.w - pad * 2 - 96 - gap;
      const picked = segmentedControl(
        ctx,
        { x: pad, y: y2, w: segW, h: rowH },
        ['1×', '2×', '4×'],
        speedIdx >= 0 ? speedIdx : 0,
        input.pointer,
      );
      if (picked !== null) this.speed = SPEEDS[picked]!;
      if (
        button(
          ctx,
          { x: pad + segW + gap, y: y2, w: 96, h: rowH },
          this.synth.isMuted ? 'Unmute' : 'Mute',
          input.pointer,
        )
      ) {
        this.synth.toggleMute();
      }
      return action;
    }

    // Landscape: single control row
    if (button(ctx, { x: 16, y, w: 72, h: rowH }, 'Leave', input.pointer)) {
      this.synth.play('ui');
      action = this.careerLeave();
    }
    if (!this.career) {
      if (button(ctx, { x: 94, y, w: 80, h: rowH }, 'Restart', input.pointer)) {
        this.synth.play('ui');
        action = { type: 'RESTART' };
      }
      if (button(ctx, { x: 180, y, w: 74, h: rowH }, 'Reroll', input.pointer)) {
        this.synth.play('ui');
        action = { type: 'REROLL' };
      }
    }

    hairline(ctx, 266, y + 6, 266, y + rowH - 6);

    label(ctx, 'Bout', 278, y + 10, { variant: 'eyebrow' });
    label(ctx, `${this.config.teamSize}v${this.config.teamSize}`, 278, y + 26, {
      variant: 'value',
      size: typeScale.body,
    });

    const speedIdx = SPEEDS.indexOf(this.speed as (typeof SPEEDS)[number]);
    const segR = { x: stage.w - 248, y, w: 132, h: rowH };
    const picked = segmentedControl(
      ctx,
      segR,
      ['1×', '2×', '4×'],
      speedIdx >= 0 ? speedIdx : 0,
      input.pointer,
    );
    if (picked !== null) {
      this.speed = SPEEDS[picked]!;
    }

    if (
      button(
        ctx,
        { x: stage.w - 104, y, w: 88, h: rowH },
        this.synth.isMuted ? 'Unmute' : 'Mute',
        input.pointer,
      )
    ) {
      this.synth.toggleMute();
    }

    return action;
  }

  private drawRoster(
    ctx: CanvasRenderingContext2D,
    input: Input,
    snaps: FighterSnapshot[],
    stage: FightStageLayout,
  ): void {
    const y = stage.rosterY;
    const h = stage.rosterH;
    const blue = snaps.filter((f) => f.team === 0).sort((a, b) => a.id - b.id);
    const red = snaps.filter((f) => f.team === 1).sort((a, b) => a.id - b.id);
    const gap = stage.chipGap;
    const mid = stage.w / 2;
    const labelY = stage.rosterBandTop + 10;
    const edge = 12;

    label(ctx, 'Blue', edge, labelY, { variant: 'eyebrow', color: colors.ally });
    label(ctx, 'Red', stage.w - edge, labelY, {
      variant: 'eyebrow',
      align: 'right',
      color: colors.foe,
    });

    const leftBudget = mid - edge - gap;
    const rightBudget = mid - edge - gap;
    const chipWBlue = Math.min(
      150,
      (leftBudget - gap * Math.max(0, blue.length - 1)) / Math.max(1, blue.length),
    );
    const chipWRed = Math.min(
      150,
      (rightBudget - gap * Math.max(0, red.length - 1)) / Math.max(1, red.length),
    );

    let bx = edge;
    for (const f of blue) {
      const r = { x: bx, y, w: chipWBlue, h };
      if (
        rosterChip(ctx, r, input.pointer, {
          name: f.name,
          tag: ARMATURAE[f.armatura].short,
          team: 0,
          hpRatio: f.hp / f.maxHp,
          selected: f.id === this.selectedId,
          muted: !f.alive,
        })
      ) {
        this.toggleSelect(f.id);
        this.synth.play('ui');
      }
      bx += chipWBlue + gap;
    }

    let rx = stage.w - edge - chipWRed * red.length - gap * Math.max(0, red.length - 1);
    for (const f of red) {
      const r = { x: rx, y, w: chipWRed, h };
      if (
        rosterChip(ctx, r, input.pointer, {
          name: f.name,
          tag: ARMATURAE[f.armatura].short,
          team: 1,
          hpRatio: f.hp / f.maxHp,
          selected: f.id === this.selectedId,
          muted: !f.alive,
        })
      ) {
        this.toggleSelect(f.id);
        this.synth.play('ui');
      }
      rx += chipWRed + gap;
    }

    hairline(ctx, mid, y + 4, mid, y + h - 4);
  }

  private drawInspect(
    ctx: CanvasRenderingContext2D,
    snaps: FighterSnapshot[],
    stage: FightStageLayout,
  ): void {
    if (this.selectedId === null) return;
    const f = snaps.find((s) => s.id === this.selectedId);
    if (!f) return;

    const def = ARMATURAE[f.armatura];
    const preferLeft = f.x > ARENA_WORLD_W / 2;
    const debugLines = this.debugFeel
      ? [
          `${f.intention}  d*${f.desiredDist.toFixed(0)}`,
          `${f.poiseTier}  ${f.action}/${f.phase}`,
          `fw ${f.footwork}`,
        ]
      : undefined;
    const contentH =
      168 +
      (debugLines ? 16 + debugLines.length * 13 : 0) +
      (def.tipCatchRatio > 0 ? 15 : 0);

    const r = fightInspectRect(stage, preferLeft, contentH);

    const lines: { label: string; value: string }[] = [
      { label: 'HP', value: `${Math.ceil(f.hp)} / ${f.maxHp}` },
      { label: 'Stamina', value: `${Math.ceil(f.stamina)} / ${f.maxStamina}` },
      { label: 'Poise', value: `${Math.ceil(f.poise)} / ${f.maxPoise}` },
      { label: 'Range', value: `${def.attackRange}` },
      { label: 'Guard', value: `${(def.guardArc * (180 / Math.PI)).toFixed(0)}°` },
      { label: 'Mass', value: def.mass.toFixed(2) },
    ];
    if (def.tipCatchRatio > 0) {
      lines.push({ label: 'Tip-catch', value: `${Math.round(def.tipCatchRatio * 100)}% reach` });
    }

    inspectCard(ctx, r, {
      title: f.name,
      subtitle: `${def.name} · ${f.team === 0 ? 'Blue' : 'Red'}`,
      team: f.team,
      stateLine: fighterStateLine(f),
      lines,
      debugLines,
    });
  }

  private drawEndBanner(
    ctx: CanvasRenderingContext2D,
    input: Input,
    action: FightAction,
    stage: FightStageLayout,
  ): FightAction {
    const text =
      this.match.result === 'DRAW'
        ? 'Draw'
        : this.match.result === 'TEAM0'
          ? 'Blue wins'
          : 'Red wins';

    const bandH = 120;
    const bandY =
      stage.orientation === 'portrait'
        ? stage.world.view.y + stage.world.view.h / 2 - bandH / 2
        : stage.h * 0.34;
    ctx.fillStyle = 'rgba(10,8,6,0.62)';
    ctx.fillRect(0, bandY, stage.w, bandH);

    label(ctx, text, stage.w / 2, bandY + 42, {
      size: typeScale.banner,
      align: 'center',
      color: colors.parchment,
    });
    label(ctx, 'Session', stage.w / 2, bandY + 62, {
      variant: 'eyebrow',
      align: 'center',
    });

    const by = bandY + 74;
    if (this.career) {
      if (button(ctx, { x: stage.w / 2 - 70, y: by, w: 140, h: 34 }, 'Continue', input.pointer)) {
        this.synth.play('ui');
        return { type: 'CAREER_DONE', result: this.match.result, forfeited: false };
      }
      return action;
    }

    if (stage.orientation === 'portrait') {
      const gap = 8;
      const bw = (stage.w - 32 - gap * 2) / 3;
      if (button(ctx, { x: 16, y: by, w: bw, h: 34 }, 'Restart', input.pointer)) {
        this.synth.play('ui');
        return { type: 'RESTART' };
      }
      if (button(ctx, { x: 16 + bw + gap, y: by, w: bw, h: 34 }, 'Reroll', input.pointer)) {
        this.synth.play('ui');
        return { type: 'REROLL' };
      }
      if (button(ctx, { x: 16 + (bw + gap) * 2, y: by, w: bw, h: 34 }, 'Leave', input.pointer)) {
        this.synth.play('ui');
        return { type: 'EXIT' };
      }
      return action;
    }

    if (button(ctx, { x: stage.w / 2 - 170, y: by, w: 100, h: 34 }, 'Restart', input.pointer)) {
      this.synth.play('ui');
      return { type: 'RESTART' };
    }
    if (button(ctx, { x: stage.w / 2 - 50, y: by, w: 100, h: 34 }, 'Reroll', input.pointer)) {
      this.synth.play('ui');
      return { type: 'REROLL' };
    }
    if (button(ctx, { x: stage.w / 2 + 70, y: by, w: 100, h: 34 }, 'Leave', input.pointer)) {
      this.synth.play('ui');
      return { type: 'EXIT' };
    }
    return action;
  }

  private handleArenaPick(
    input: Input,
    snaps: FighterSnapshot[],
    stage: FightStageLayout,
  ): void {
    if (!input.pointer.clicked) return;
    const py = input.pointer.y;
    const px = input.pointer.x;

    // Ignore clicks in chrome bands
    if (py < stage.topBandH || py >= stage.rosterBandTop - 2) {
      input.pointer.clicked = false;
      return;
    }

    // Ignore inspect panel area when open
    if (this.selectedId !== null) {
      const f = snaps.find((s) => s.id === this.selectedId);
      if (f) {
        const preferLeft = f.x > ARENA_WORLD_W / 2;
        const ir = fightInspectRect(stage, preferLeft, stage.inspectMaxH);
        if (px >= ir.x && px <= ir.x + ir.w && py >= ir.y && py <= ir.y + ir.h) {
          input.pointer.clicked = false;
          return;
        }
      }
    }

    // Only pick inside the arena view; map to world space
    const v = stage.world.view;
    if (px < v.x || px > v.x + v.w || py < v.y || py > v.y + v.h) {
      this.selectedId = null;
      input.pointer.clicked = false;
      return;
    }

    const world = designToWorld(px, py, stage.world);
    const hitR = stage.hitRadius / Math.max(0.001, stage.world.scale);
    const hit = pickFighterAt(snaps, world.x, world.y, hitR);
    if (hit) {
      this.toggleSelect(hit.id);
      this.synth.play('ui');
    } else {
      this.selectedId = null;
    }
    input.pointer.clicked = false;
  }

  private toggleSelect(id: number): void {
    this.selectedId = this.selectedId === id ? null : id;
  }

  private consumeEvents(events: CombatEvent[]): void {
    for (const ev of events) {
      switch (ev.kind) {
        case 'HIT':
          this.synth.play('hit');
          this.shake = Math.min(10, this.shake + 4);
          this.hitStop = Math.max(this.hitStop, 3);
          spawnDust(this.dust, ev.x, ev.y, 5, this.fxRng);
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

function pickFighterAt(
  snaps: FighterSnapshot[],
  x: number,
  y: number,
  hitRadius: number,
): FighterSnapshot | null {
  let best: FighterSnapshot | null = null;
  let bestD = hitRadius * hitRadius;
  for (const f of snaps) {
    const dx = f.x - x;
    const dy = f.y - y;
    const d = dx * dx + dy * dy;
    if (d <= bestD) {
      bestD = d;
      best = f;
    }
  }
  return best;
}
