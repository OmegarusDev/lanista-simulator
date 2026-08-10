import { ARMATURA_LIST, ARMATURAE, type ArmaturaId } from '../../content/armatura';
import { PAIRING_PRESETS } from '../../content/pairings';
import { colors } from '../../content/palette';
import type { FighterSpawnSpec, TeamSize } from '../../domain/combat/types';
import type { Input } from '../../shell/input';
import { getDesign } from '../../shell/canvas';
import type { Synth } from '../../view/audio';
import { drawArmaturaPreview } from '../../view/gladiatorDraw';
import { sandboxLayout } from '../../view/layout';
import { typeMin, typeScale } from '../../view/theme';
import { button, buttonChrome, label, labelFitted, panel, type Rect } from '../../view/ui';

export interface SandboxConfig {
  /** Instant Match / career: 1|2|3. */
  teamSize: TeamSize;
  seed: number;
  team0: ArmaturaId[];
  team1: ArmaturaId[];
  lockedMatchup: boolean;
  /** Career: full spawn specs (condition, grade, doctrina…). */
  team0Specs?: FighterSpawnSpec[];
  team1Specs?: FighterSpawnSpec[];
}

export type SandboxAction =
  | { type: 'START'; config: SandboxConfig }
  | { type: 'BACK' }
  | { type: 'NONE' };

type SlotPick = ArmaturaId | 'RANDOM';

const PICK_OPTS: SlotPick[] = ['RANDOM', ...ARMATURA_LIST];

function resolvePick(pick: SlotPick, salt: number): ArmaturaId {
  if (pick !== 'RANDOM') return pick;
  return ARMATURA_LIST[salt % ARMATURA_LIST.length]!;
}

export class SandboxScene {
  teamSize: TeamSize = 1;
  seed = 42;
  /** Per-fighter kit on each team (supports mixed lineups). */
  slots0: SlotPick[] = ['RANDOM', 'RANDOM', 'RANDOM'];
  slots1: SlotPick[] = ['RANDOM', 'RANDOM', 'RANDOM'];
  editSlot0 = 0;
  editSlot1 = 0;

  constructor(private readonly synth: Synth) {}

  makeConfig(): SandboxConfig {
    const n = this.teamSize;
    const team0 = this.slots0
      .slice(0, n)
      .map((p, i) => resolvePick(p, this.seed + i * 3));
    const team1 = this.slots1
      .slice(0, n)
      .map((p, i) => resolvePick(p, this.seed + 7 + i * 5));
    const locked =
      this.slots0.slice(0, n).every((p) => p !== 'RANDOM') &&
      this.slots1.slice(0, n).every((p) => p !== 'RANDOM');
    return { teamSize: n, seed: this.seed, team0, team1, lockedMatchup: locked };
  }

  update(input: Input): SandboxAction {
    if (input.wasKeyPressed('Space') || input.wasKeyPressed('Enter')) {
      return { type: 'START', config: this.makeConfig() };
    }
    if (input.wasKeyPressed('KeyR')) {
      this.seed = (this.seed * 1103515245 + 12345) >>> 0;
      this.synth.play('ui');
    }
    return { type: 'NONE' };
  }

  draw(ctx: CanvasRenderingContext2D, input: Input): SandboxAction {
    const { w, h } = getDesign();
    const L = sandboxLayout(w, h, PAIRING_PRESETS.length);

    ctx.fillStyle = colors.bg;
    ctx.fillRect(0, 0, w, h);

    const g = ctx.createRadialGradient(
      w / 2,
      h * 0.28,
      30,
      w / 2,
      h * 0.55,
      Math.max(w, h) * 0.55,
    );
    g.addColorStop(0, '#3a281c');
    g.addColorStop(1, colors.bg);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    label(ctx, 'LANISTA', w / 2, L.brandY, {
      size: L.stacked ? typeScale.display : 32,
      align: 'center',
      color: colors.parchment,
    });
    label(ctx, 'Instant Match', w / 2, L.subtitleY, {
      size: typeScale.body,
      align: 'center',
      color: colors.muted,
    });

    let action: SandboxAction = { type: 'NONE' };

    if (button(ctx, L.titleBtn, '←', input.pointer, { size: typeScale.title })) {
      this.synth.play('ui');
      action = { type: 'BACK' };
    }

    label(ctx, 'Historical', w / 2, L.historicalLabelY, {
      size: typeScale.meta,
      align: 'center',
      color: colors.muted,
    });
    for (let i = 0; i < PAIRING_PRESETS.length; i++) {
      const p = PAIRING_PRESETS[i]!;
      const r = L.presetRects[i]!;
      const { pressed, clicked } = buttonChrome(ctx, r, input.pointer);
      const vsIdx = p.label.indexOf(' vs ');
      const lines =
        vsIdx > 0
          ? [p.label.slice(0, vsIdx), `vs ${p.label.slice(vsIdx + 4)}`]
          : [p.label];
      labelFitted(ctx, lines, r, {
        color: colors.buttonText,
        yOffset: pressed ? 1 : 0,
        // Prefer filling the preset cell; width-bound names still shrink cleanly.
        padX: 6,
        padY: 4,
        min: typeMin.fit,
        max: typeScale.title,
      });
      if (clicked) {
        const config = this.configFromPreset(p.id);
        try {
          this.synth.play('ui');
        } catch {
          /* audio can throw before gesture / suspended context */
        }
        return { type: 'START', config };
      }
    }

    panel(ctx, L.leftPanel);
    panel(ctx, L.rightPanel);

    label(ctx, 'BLUE', L.leftPanel.x + L.leftPanel.w / 2, L.leftPanel.y + 24, {
      size: typeScale.title,
      align: 'center',
      color: colors.ally,
    });
    label(ctx, 'RED', L.rightPanel.x + L.rightPanel.w / 2, L.rightPanel.y + 24, {
      size: typeScale.title,
      align: 'center',
      color: colors.foe,
    });

    const c = L.center;
    if (button(ctx, c.size1, '1v1', input.pointer, { active: this.teamSize === 1 })) {
      this.setTeamSize(1);
      this.synth.play('ui');
    }
    if (button(ctx, c.size2, '2v2', input.pointer, { active: this.teamSize === 2 })) {
      this.setTeamSize(2);
      this.synth.play('ui');
    }
    if (button(ctx, c.size3, '3v3', input.pointer, { active: this.teamSize === 3 })) {
      this.setTeamSize(3);
      this.synth.play('ui');
    }

    if (!L.stacked) {
      label(ctx, 'VS', w / 2, c.vsY, {
        size: typeScale.banner,
        align: 'center',
        color: colors.parchment,
      });
    }

    label(ctx, `Seed ${this.seed}`, w / 2, c.seedY, {
      size: typeScale.meta,
      align: 'center',
      color: colors.muted,
    });
    if (button(ctx, c.reroll, 'Reroll', input.pointer)) {
      this.seed = (Math.random() * 0xffffffff) >>> 0;
      this.synth.play('ui');
    }
    if (button(ctx, c.fight, 'Fight', input.pointer, { size: typeScale.title })) {
      this.synth.play('ui');
      action = { type: 'START', config: this.makeConfig() };
    }

    this.drawTeamSide(ctx, input, 0, L.leftPanel.x, L.leftPanel.y, L.leftPanel.w, L.leftPanel.h);
    this.drawTeamSide(ctx, input, 1, L.rightPanel.x, L.rightPanel.y, L.rightPanel.w, L.rightPanel.h);

    label(ctx, 'Space/Enter fight · R reroll seed', w / 2, L.footerY, {
      size: typeScale.meta,
      align: 'center',
      color: colors.muted,
    });

    const keyAction = this.update(input);
    if (keyAction.type === 'START') return keyAction;
    return action;
  }

  private setTeamSize(n: TeamSize): void {
    this.teamSize = n;
    while (this.slots0.length < 3) this.slots0.push('RANDOM');
    while (this.slots1.length < 3) this.slots1.push('RANDOM');
    this.editSlot0 = Math.min(this.editSlot0, n - 1);
    this.editSlot1 = Math.min(this.editSlot1, n - 1);
  }

  private configFromPreset(id: string): SandboxConfig {
    const p = PAIRING_PRESETS.find((x) => x.id === id);
    if (!p) return this.makeConfig();
    this.teamSize = 1;
    this.slots0 = [p.team0[0]!, 'RANDOM', 'RANDOM'];
    this.slots1 = [p.team1[0]!, 'RANDOM', 'RANDOM'];
    this.editSlot0 = 0;
    this.editSlot1 = 0;
    return this.makeConfig();
  }

  private drawTeamSide(
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
    const narrow = w < 300;

    const slotY = y + 40;
    const n = this.teamSize;
    if (n >= 2) {
      const gap = 6;
      const slotW = Math.min(130, (w - 32 - gap * (n - 1)) / n);
      for (let s = 0; s < n; s++) {
        const r: Rect = { x: x + 16 + s * (slotW + gap), y: slotY, w: slotW, h: 56 };
        const pick = slots[s]!;
        const active = edit === s;
        const { pressed, clicked } = buttonChrome(ctx, r, input.pointer, {
          active,
          accent,
        });
        const gy = r.y + 22 + (pressed ? 1 : 0);
        if (pick === 'RANDOM') {
          label(ctx, '?', r.x + Math.min(28, slotW * 0.35), gy + 6, {
            size: typeScale.display,
            align: 'center',
            color: colors.buttonText,
          });
        } else {
          drawArmaturaPreview(ctx, pick, r.x + Math.min(28, slotW * 0.35), gy, {
            team,
            facing,
            scale: n === 3 ? 0.58 : 0.72,
          });
        }
        label(ctx, `F${s + 1}`, r.x + r.w / 2, r.y + 14 + (pressed ? 1 : 0), {
          size: typeScale.eyebrow,
          align: 'center',
          color: colors.muted,
        });
        label(
          ctx,
          pick === 'RANDOM' ? 'Rnd' : ARMATURAE[pick].short,
          r.x + r.w / 2,
          r.y + 40 + (pressed ? 1 : 0),
          {
            size: typeScale.meta,
            align: 'center',
            color: colors.buttonText,
          },
        );
        if (clicked) {
          if (team === 0) this.editSlot0 = s;
          else this.editSlot1 = s;
          this.synth.play('ui');
          edit = s;
        }
      }
    } else {
      const pick = slots[0]!;
      const r: Rect = { x: x + 16, y: slotY, w: w - 32, h: 56 };
      buttonChrome(ctx, r, input.pointer, { active: true, accent });
      if (pick === 'RANDOM') {
        label(ctx, '?', r.x + 40, r.y + 34, {
          size: typeScale.display,
          align: 'center',
          color: colors.buttonText,
        });
      } else {
        drawArmaturaPreview(ctx, pick, r.x + 40, r.y + 28, {
          team,
          facing,
          scale: 0.85,
        });
      }
      label(ctx, pick === 'RANDOM' ? 'Random' : ARMATURAE[pick].name, r.x + r.w / 2 + 20, r.y + 34, {
        size: typeScale.title,
        align: 'center',
        color: colors.buttonText,
      });
      edit = 0;
    }

    label(ctx, 'Armatura', x + w / 2, y + 116, {
      size: typeScale.meta,
      align: 'center',
      color: colors.muted,
    });

    const current = slots[edit]!;
    const gridX = x + 14;
    const gridY = y + 128;
    const cols = narrow ? 2 : 3;
    const gap = 6;
    const cellW = (w - 28 - gap * (cols - 1)) / cols;
    const cellH = Math.min(84, Math.max(68, (panelH - 140) / Math.ceil(PICK_OPTS.length / cols) - gap));

    PICK_OPTS.forEach((id, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const r: Rect = {
        x: gridX + col * (cellW + gap),
        y: gridY + row * (cellH + gap),
        w: cellW,
        h: cellH,
      };
      if (r.y + r.h > y + panelH - 4) return;
      const { pressed, clicked } = buttonChrome(ctx, r, input.pointer, {
        active: current === id,
        accent,
      });
      const cy = r.y + (pressed ? 1 : 0);
      if (id === 'RANDOM') {
        label(ctx, '?', r.x + r.w / 2, cy + cellH * 0.42, {
          size: typeScale.display,
          align: 'center',
          color: colors.buttonText,
        });
        label(ctx, 'Random', r.x + r.w / 2, cy + cellH * 0.78, {
          size: typeScale.meta,
          align: 'center',
          color: colors.muted,
        });
      } else {
        drawArmaturaPreview(ctx, id, r.x + r.w / 2, cy + cellH * 0.36, {
          team,
          facing,
          scale: 0.7,
        });
        label(ctx, ARMATURAE[id].name, r.x + r.w / 2, cy + cellH * 0.8, {
          size: typeScale.meta,
          align: 'center',
          color: colors.buttonText,
        });
      }
      if (clicked) {
        slots[edit] = id;
        this.synth.play('ui');
      }
    });
  }
}
