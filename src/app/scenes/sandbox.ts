import { ARMATURA_LIST, ARMATURAE, type ArmaturaId } from '../../content/armatura';
import { PAIRING_PRESETS } from '../../content/pairings';
import { colors } from '../../content/palette';
import { GRADE_LABEL, TEMPERAMENTS, type TemperamentId } from '../../content/rpg';
import { generateQuickTeam, type QuickCard } from '../../domain/combat/quickGen';
import type { FighterSpawnSpec, TeamSize } from '../../domain/combat/types';
import type { Input } from '../../shell/input';
import { getDesign } from '../../shell/canvas';
import type { Synth } from '../../view/audio';
import { drawArmaturaPreview } from '../../view/gladiatorDraw';
import { buttonRow, isPortrait, shellPad } from '../../view/layout';
import { space, touchTarget, typeScale } from '../../view/theme';
import { button, buttonChrome, label, labelFitted, panel, type Rect } from '../../view/ui';

export interface SandboxConfig {
  teamSize: TeamSize;
  seed: number;
  team0: ArmaturaId[];
  team1: ArmaturaId[];
  lockedMatchup: boolean;
  team0Specs?: FighterSpawnSpec[];
  team1Specs?: FighterSpawnSpec[];
}

export type SandboxAction =
  | { type: 'START'; config: SandboxConfig }
  | { type: 'BACK' }
  | { type: 'NONE' };

type SlotPick = ArmaturaId | 'RANDOM';
type Mode = 'quick' | 'custom';

const PICK_OPTS: SlotPick[] = ['RANDOM', ...ARMATURA_LIST];

function resolvePick(pick: SlotPick, salt: number): ArmaturaId {
  if (pick !== 'RANDOM') return pick;
  return ARMATURA_LIST[salt % ARMATURA_LIST.length]!;
}

/**
 * Instant Match = Quick Match by default (fresh generated fighters).
 * Custom Team = opt-in kit editor + historical presets.
 */
export class SandboxScene {
  mode: Mode = 'quick';
  teamSize: TeamSize = 1;
  seed = (Math.random() * 0xffffffff) >>> 0;
  slots0: SlotPick[] = ['RANDOM', 'RANDOM', 'RANDOM'];
  slots1: SlotPick[] = ['RANDOM', 'RANDOM', 'RANDOM'];
  editSlot0 = 0;
  editSlot1 = 0;
  private cards0: QuickCard[] = [];
  private cards1: QuickCard[] = [];

  constructor(private readonly synth: Synth) {
    this.rerollQuick();
  }

  private rerollQuick(): void {
    this.cards0 = generateQuickTeam(this.seed, this.teamSize, 1);
    this.cards1 = generateQuickTeam(this.seed, this.teamSize, 2);
  }

  makeQuickConfig(): SandboxConfig {
    const n = this.teamSize;
    const c0 = this.cards0.slice(0, n);
    const c1 = this.cards1.slice(0, n);
    return {
      teamSize: n,
      seed: this.seed,
      team0: c0.map((c) => c.armatura),
      team1: c1.map((c) => c.armatura),
      team0Specs: c0.map((c) => c.spec),
      team1Specs: c1.map((c) => c.spec),
      lockedMatchup: true,
    };
  }

  makeCustomConfig(): SandboxConfig {
    const n = this.teamSize;
    const team0 = this.slots0.slice(0, n).map((p, i) => resolvePick(p, this.seed + i * 3));
    const team1 = this.slots1.slice(0, n).map((p, i) => resolvePick(p, this.seed + 7 + i * 5));
    const locked =
      this.slots0.slice(0, n).every((p) => p !== 'RANDOM') &&
      this.slots1.slice(0, n).every((p) => p !== 'RANDOM');
    return { teamSize: n, seed: this.seed, team0, team1, lockedMatchup: locked };
  }

  makeConfig(): SandboxConfig {
    return this.mode === 'quick' ? this.makeQuickConfig() : this.makeCustomConfig();
  }

  /** Called when fight UI asks to reroll a lab bout. */
  rerollLab(): SandboxConfig {
    this.seed = (Math.random() * 0xffffffff) >>> 0;
    if (this.mode === 'quick') this.rerollQuick();
    return this.makeConfig();
  }

  private setTeamSize(n: TeamSize): void {
    this.teamSize = n;
    while (this.slots0.length < 3) this.slots0.push('RANDOM');
    while (this.slots1.length < 3) this.slots1.push('RANDOM');
    this.editSlot0 = Math.min(this.editSlot0, n - 1);
    this.editSlot1 = Math.min(this.editSlot1, n - 1);
    if (this.mode === 'quick') this.rerollQuick();
  }

  update(input: Input): SandboxAction {
    if (input.wasKeyPressed('Space') || input.wasKeyPressed('Enter')) {
      return { type: 'START', config: this.makeConfig() };
    }
    if (input.wasKeyPressed('KeyR')) {
      this.seed = (this.seed * 1103515245 + 12345) >>> 0;
      if (this.mode === 'quick') this.rerollQuick();
      this.synth.play('ui');
    }
    return { type: 'NONE' };
  }

  draw(ctx: CanvasRenderingContext2D, input: Input): SandboxAction {
    if (this.mode === 'custom') return this.drawCustom(ctx, input);
    return this.drawQuick(ctx, input);
  }

  private drawQuick(ctx: CanvasRenderingContext2D, input: Input): SandboxAction {
    const { w, h } = getDesign();
    const pad = shellPad(w);
    const portrait = isPortrait(w, h);
    let action: SandboxAction = { type: 'NONE' };

    ctx.fillStyle = colors.bg;
    ctx.fillRect(0, 0, w, h);
    const g = ctx.createRadialGradient(w / 2, h * 0.3, 20, w / 2, h * 0.5, Math.max(w, h) * 0.5);
    g.addColorStop(0, '#3a281c');
    g.addColorStop(1, colors.bg);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    if (button(ctx, { x: pad, y: pad, w: touchTarget, h: touchTarget }, '←', input.pointer)) {
      this.synth.play('ui');
      return { type: 'BACK' };
    }

    label(ctx, 'Quick Match', w / 2, portrait ? 36 : 42, {
      size: typeScale.display,
      align: 'center',
      color: colors.parchment,
    });
    label(ctx, 'Fresh fighters each bout · no career stakes', w / 2, portrait ? 58 : 68, {
      size: typeScale.meta,
      align: 'center',
      color: colors.muted,
    });

    const sizeY = portrait ? 78 : 92;
    const sizes = buttonRow(pad, sizeY, w - pad * 2, 40, 3, space.sm);
    (['1v1', '2v2', '3v3'] as const).forEach((lab, i) => {
      const n = (i + 1) as TeamSize;
      if (button(ctx, sizes[i]!, lab, input.pointer, { active: this.teamSize === n })) {
        this.setTeamSize(n);
        this.synth.play('ui');
      }
    });

    const cardsTop = sizeY + 52;
    const cardsH = Math.max(160, h - cardsTop - (portrait ? 200 : 160));
    const colW = portrait ? w - pad * 2 : (w - pad * 2 - 16) / 2;
    this.drawQuickTeam(ctx, this.cards0, pad, cardsTop, colW, cardsH, 0, portrait);
    if (portrait) {
      this.drawQuickTeam(
        ctx,
        this.cards1,
        pad,
        cardsTop + cardsH / 2 + 4,
        colW,
        cardsH / 2 - 4,
        1,
        portrait,
      );
    } else {
      this.drawQuickTeam(ctx, this.cards1, pad + colW + 16, cardsTop, colW, cardsH, 1, portrait);
    }

    const by = h - (portrait ? 148 : 120);
    const row = buttonRow(pad, by, w - pad * 2, touchTarget, 2, space.sm);
    if (button(ctx, row[0]!, 'Reroll', input.pointer)) {
      this.seed = (Math.random() * 0xffffffff) >>> 0;
      this.rerollQuick();
      this.synth.play('ui');
    }
    if (button(ctx, row[1]!, 'Custom Team', input.pointer)) {
      this.mode = 'custom';
      this.synth.play('ui');
    }
    if (
      button(
        ctx,
        { x: pad, y: by + touchTarget + space.sm, w: w - pad * 2, h: 52 },
        'Fight',
        input.pointer,
        { size: typeScale.title },
      )
    ) {
      this.synth.play('ui');
      action = { type: 'START', config: this.makeQuickConfig() };
    }

    const key = this.update(input);
    if (key.type === 'START') return key;
    return action;
  }

  private drawQuickTeam(
    ctx: CanvasRenderingContext2D,
    cards: QuickCard[],
    x: number,
    y: number,
    w: number,
    h: number,
    team: 0 | 1,
    compact: boolean,
  ): void {
    const accent = team === 0 ? colors.ally : colors.foe;
    panel(ctx, { x, y, w, h }, team === 0 ? 'Blue' : 'Red');
    const inner = cards.slice(0, this.teamSize);
    const rowH = Math.min(64, (h - 48) / Math.max(1, inner.length));
    inner.forEach((c, i) => {
      const cy = y + 36 + i * rowH;
      if (cy + 40 > y + h) return;
      drawArmaturaPreview(ctx, c.armatura, x + 28, cy + 22, {
        team,
        facing: team === 0 ? 0 : Math.PI,
        scale: compact ? 0.65 : 0.75,
      });
      label(ctx, c.name, x + 56, cy + 14, { size: typeScale.label, color: colors.parchment });
      label(
        ctx,
        `${ARMATURAE[c.armatura].name} · ${GRADE_LABEL[c.grade]} · ${TEMPERAMENTS[c.temperament as TemperamentId].name}`,
        x + 56,
        cy + 32,
        { size: typeScale.eyebrow, color: accent },
      );
    });
  }

  private drawCustom(ctx: CanvasRenderingContext2D, input: Input): SandboxAction {
    const { w, h } = getDesign();
    const pad = shellPad(w);
    const portrait = isPortrait(w, h);
    let action: SandboxAction = { type: 'NONE' };

    ctx.fillStyle = colors.bg;
    ctx.fillRect(0, 0, w, h);

    if (button(ctx, { x: pad, y: pad, w: touchTarget, h: touchTarget }, '←', input.pointer)) {
      this.mode = 'quick';
      this.rerollQuick();
      this.synth.play('ui');
      return { type: 'NONE' };
    }

    label(ctx, 'Custom Team', w / 2, portrait ? 36 : 40, {
      size: typeScale.display,
      align: 'center',
      color: colors.parchment,
    });
    label(ctx, 'Pick kits · historical matchups', w / 2, portrait ? 56 : 62, {
      size: typeScale.meta,
      align: 'center',
      color: colors.muted,
    });

    const sizeY = portrait ? 74 : 84;
    const sizes = buttonRow(pad, sizeY, w - pad * 2, 36, 3, space.sm);
    (['1v1', '2v2', '3v3'] as const).forEach((lab, i) => {
      const n = (i + 1) as TeamSize;
      if (button(ctx, sizes[i]!, lab, input.pointer, { active: this.teamSize === n })) {
        this.setTeamSize(n);
        this.synth.play('ui');
      }
    });

    // Historical presets — start fight directly as classic 1v1
    const presetY = sizeY + 48;
    label(ctx, 'Historical', pad, presetY, { size: typeScale.meta, color: colors.muted });
    const presetH = 40;
    const cols = portrait ? 2 : 3;
    const gap = 6;
    const cellW = (w - pad * 2 - gap * (cols - 1)) / cols;
    PAIRING_PRESETS.forEach((p, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const r: Rect = {
        x: pad + col * (cellW + gap),
        y: presetY + 12 + row * (presetH + gap),
        w: cellW,
        h: presetH,
      };
      if (
        button(ctx, r, '', input.pointer, { size: typeScale.eyebrow }) &&
        action.type === 'NONE'
      ) {
        this.teamSize = 1;
        this.slots0 = [p.team0[0]!, 'RANDOM', 'RANDOM'];
        this.slots1 = [p.team1[0]!, 'RANDOM', 'RANDOM'];
        this.synth.play('ui');
        action = {
          type: 'START',
          config: {
            teamSize: 1,
            seed: this.seed,
            team0: [p.team0[0]!],
            team1: [p.team1[0]!],
            lockedMatchup: true,
          },
        };
      }
      const parts = p.label.split(' vs ');
      labelFitted(ctx, [parts[0] ?? p.label, parts[1] ? `vs ${parts[1]}` : ''], r, {
        color: colors.buttonText,
        min: 10,
        max: 13,
      });
    });

    const presetRows = Math.ceil(PAIRING_PRESETS.length / cols);
    const editorTop = presetY + 12 + presetRows * (presetH + gap) + 12;
    const editorH = Math.max(140, h - editorTop - 70);
    const half = portrait ? editorH / 2 - 4 : editorH;
    const colW = portrait ? w - pad * 2 : (w - pad * 2 - 12) / 2;
    this.drawCustomSide(ctx, input, 0, pad, editorTop, colW, half);
    if (portrait) {
      this.drawCustomSide(ctx, input, 1, pad, editorTop + half + 8, colW, half);
    } else {
      this.drawCustomSide(ctx, input, 1, pad + colW + 12, editorTop, colW, half);
    }

    if (
      button(ctx, { x: w - pad - 140, y: h - 56, w: 140, h: 44 }, 'Fight', input.pointer, {
        size: typeScale.label,
      })
    ) {
      this.synth.play('ui');
      action = { type: 'START', config: this.makeCustomConfig() };
    }

    const key = this.update(input);
    if (key.type === 'START') return key;
    return action;
  }

  private drawCustomSide(
    ctx: CanvasRenderingContext2D,
    input: Input,
    team: 0 | 1,
    x: number,
    y: number,
    w: number,
    panelH: number,
  ): void {
    const slots = team === 0 ? this.slots0 : this.slots1;
    let edit = team === 0 ? this.editSlot0 : this.editSlot1;
    const accent = team === 0 ? colors.ally : colors.foe;
    const facing = team === 0 ? 0 : Math.PI;
    panel(ctx, { x, y, w, h: panelH }, team === 0 ? 'Blue' : 'Red');

    const n = this.teamSize;
    const slotY = y + 36;
    const gap = 4;
    const slotW = Math.min(110, (w - 24 - gap * Math.max(0, n - 1)) / n);
    for (let s = 0; s < n; s++) {
      const r: Rect = { x: x + 12 + s * (slotW + gap), y: slotY, w: slotW, h: 44 };
      const pick = slots[s]!;
      const { clicked } = buttonChrome(ctx, r, input.pointer, {
        active: edit === s,
        accent,
      });
      label(ctx, pick === 'RANDOM' ? 'Rnd' : ARMATURAE[pick].short, r.x + r.w / 2, r.y + 26, {
        size: typeScale.meta,
        align: 'center',
        color: colors.buttonText,
      });
      if (clicked) {
        if (team === 0) this.editSlot0 = s;
        else this.editSlot1 = s;
        this.synth.play('ui');
        edit = s;
      }
    }

    const current = slots[edit]!;
    const gridY = slotY + 52;
    const cols = w < 280 ? 3 : 4;
    const cellGap = 4;
    const cellW = (w - 24 - cellGap * (cols - 1)) / cols;
    const cellH = 32;
    PICK_OPTS.forEach((opt, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const r: Rect = {
        x: x + 12 + col * (cellW + cellGap),
        y: gridY + row * (cellH + cellGap),
        w: cellW,
        h: cellH,
      };
      if (r.y + r.h > y + panelH - 6) return;
      const lab = opt === 'RANDOM' ? '?' : ARMATURAE[opt].short;
      if (
        button(ctx, r, lab, input.pointer, {
          active: current === opt,
          size: typeScale.eyebrow,
        })
      ) {
        slots[edit] = opt;
        this.synth.play('ui');
      }
    });

    // silence unused facing in compact custom (preview optional)
    void facing;
  }
}
