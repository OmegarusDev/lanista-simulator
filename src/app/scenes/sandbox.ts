import { ARMATURA_LIST, ARMATURAE, type ArmaturaId } from '../../content/armatura';
import { PAIRING_PRESETS } from '../../content/pairings';
import { colors } from '../../content/palette';
import type { TeamSize } from '../../domain/combat/types';
import type { Input } from '../../shell/input';
import { DESIGN_H, DESIGN_W } from '../../shell/canvas';
import type { Synth } from '../../view/audio';
import { drawArmaturaPreview } from '../../view/gladiatorDraw';
import { button, buttonChrome, label, panel, type Rect } from '../../view/ui';

export interface SandboxConfig {
  /** Instant Match: 1|2. Career munera may pass 3. */
  teamSize: TeamSize;
  seed: number;
  team0: ArmaturaId[];
  team1: ArmaturaId[];
  lockedMatchup: boolean;
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
  teamSize: 1 | 2 = 1;
  seed = 42;
  /** Per-fighter kit on each team (supports mixed lineups). */
  slots0: SlotPick[] = ['RANDOM', 'RANDOM'];
  slots1: SlotPick[] = ['RANDOM', 'RANDOM'];
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
    ctx.fillStyle = colors.bg;
    ctx.fillRect(0, 0, DESIGN_W, DESIGN_H);

    const g = ctx.createRadialGradient(
      DESIGN_W / 2,
      DESIGN_H * 0.28,
      30,
      DESIGN_W / 2,
      DESIGN_H * 0.55,
      460,
    );
    g.addColorStop(0, '#3a281c');
    g.addColorStop(1, colors.bg);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, DESIGN_W, DESIGN_H);

    label(ctx, 'LANISTA', DESIGN_W / 2, 34, {
      size: 32,
      align: 'center',
      color: colors.parchment,
    });
    label(ctx, 'Instant Match', DESIGN_W / 2, 54, {
      size: 13,
      align: 'center',
      color: colors.muted,
    });

    let action: SandboxAction = { type: 'NONE' };

    if (button(ctx, { x: 16, y: 16, w: 72, h: 28 }, 'Title', input.pointer)) {
      this.synth.play('ui');
      action = { type: 'BACK' };
    }

    // Historical presets — click launches immediately
    label(ctx, 'Historical', DESIGN_W / 2, 72, {
      size: 11,
      align: 'center',
      color: colors.muted,
    });
    const presetW = 118;
    const presetGap = 6;
    const presetRowW = PAIRING_PRESETS.length * presetW + (PAIRING_PRESETS.length - 1) * presetGap;
    const presetX0 = (DESIGN_W - presetRowW) / 2;
    for (let i = 0; i < PAIRING_PRESETS.length; i++) {
      const p = PAIRING_PRESETS[i]!;
      const r = { x: presetX0 + i * (presetW + presetGap), y: 78, w: presetW, h: 28 };
      if (button(ctx, r, p.label, input.pointer)) {
        const config = this.configFromPreset(p.id);
        try {
          this.synth.play('ui');
        } catch {
          /* audio can throw before gesture / suspended context */
        }
        return { type: 'START', config };
      }
    }

    const midX = DESIGN_W / 2;
    const sideW = 350;
    const leftX = 24;
    const rightX = DESIGN_W - 24 - sideW;
    const panelY = 118;
    const panelH = DESIGN_H - panelY - 36;

    panel(ctx, { x: leftX, y: panelY, w: sideW, h: panelH });
    panel(ctx, { x: rightX, y: panelY, w: sideW, h: panelH });

    label(ctx, 'BLUE', leftX + sideW / 2, panelY + 22, {
      size: 16,
      align: 'center',
      color: colors.ally,
    });
    label(ctx, 'RED', rightX + sideW / 2, panelY + 22, {
      size: 16,
      align: 'center',
      color: colors.foe,
    });

    // Center controls
    if (button(ctx, { x: midX - 78, y: 150, w: 70, h: 30 }, '1v1', input.pointer, {
      active: this.teamSize === 1,
    })) {
      this.setTeamSize(1);
      this.synth.play('ui');
    }
    if (button(ctx, { x: midX + 8, y: 150, w: 70, h: 30 }, '2v2', input.pointer, {
      active: this.teamSize === 2,
    })) {
      this.setTeamSize(2);
      this.synth.play('ui');
    }

    label(ctx, 'VS', midX, 230, {
      size: 42,
      align: 'center',
      color: colors.parchment,
    });

    label(ctx, `Seed ${this.seed}`, midX, 268, {
      size: 12,
      align: 'center',
      color: colors.muted,
    });
    if (button(ctx, { x: midX - 50, y: 278, w: 100, h: 28 }, 'Reroll', input.pointer)) {
      this.seed = (Math.random() * 0xffffffff) >>> 0;
      this.synth.play('ui');
    }
    if (button(ctx, { x: midX - 70, y: 330, w: 140, h: 44 }, 'Fight', input.pointer)) {
      this.synth.play('ui');
      action = { type: 'START', config: this.makeConfig() };
    }

    this.drawTeamSide(ctx, input, 0, leftX, panelY, sideW);
    this.drawTeamSide(ctx, input, 1, rightX, panelY, sideW);

    label(ctx, 'Space/Enter fight · R reroll seed', midX, DESIGN_H - 14, {
      size: 11,
      align: 'center',
      color: colors.muted,
    });

    const keyAction = this.update(input);
    if (keyAction.type === 'START') return keyAction;
    return action;
  }

  private setTeamSize(n: 1 | 2): void {
    this.teamSize = n;
    while (this.slots0.length < 2) this.slots0.push('RANDOM');
    while (this.slots1.length < 2) this.slots1.push('RANDOM');
    this.editSlot0 = Math.min(this.editSlot0, n - 1);
    this.editSlot1 = Math.min(this.editSlot1, n - 1);
  }

  private configFromPreset(id: string): SandboxConfig {
    const p = PAIRING_PRESETS.find((x) => x.id === id);
    if (!p) return this.makeConfig();
    this.teamSize = 1;
    this.slots0 = [p.team0[0]!, 'RANDOM'];
    this.slots1 = [p.team1[0]!, 'RANDOM'];
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
  ): void {
    const slots = team === 0 ? this.slots0 : this.slots1;
    let edit = team === 0 ? this.editSlot0 : this.editSlot1;
    const accent = team === 0 ? colors.ally : colors.foe;
    const facing = team === 0 ? 0 : Math.PI;

    // Slot selectors (mixed lineups in 2v2)
    const slotY = y + 36;
    if (this.teamSize === 2) {
      for (let s = 0; s < 2; s++) {
        const r: Rect = { x: x + 16 + s * 160, y: slotY, w: 148, h: 54 };
        const pick = slots[s]!;
        const active = edit === s;
        const { pressed, clicked } = buttonChrome(ctx, r, input.pointer, {
          active,
          accent,
        });
        const gy = r.y + 22 + (pressed ? 1 : 0);
        if (pick === 'RANDOM') {
          label(ctx, '?', r.x + 28, gy + 6, {
            size: 22,
            align: 'center',
            color: colors.buttonText,
          });
        } else {
          drawArmaturaPreview(ctx, pick, r.x + 28, gy, {
            team,
            facing,
            scale: 0.72,
          });
        }
        label(ctx, `Fighter ${s + 1}`, r.x + 88, r.y + 18 + (pressed ? 1 : 0), {
          size: 11,
          align: 'center',
          color: colors.muted,
        });
        label(
          ctx,
          pick === 'RANDOM' ? 'Random' : ARMATURAE[pick].short,
          r.x + 88,
          r.y + 36 + (pressed ? 1 : 0),
          { size: 14, align: 'center', color: colors.buttonText },
        );
        if (clicked) {
          if (team === 0) this.editSlot0 = s;
          else this.editSlot1 = s;
          this.synth.play('ui');
          edit = s;
        }
      }
    } else {
      // Single fighter summary
      const pick = slots[0]!;
      const r: Rect = { x: x + 40, y: slotY, w: w - 80, h: 54 };
      buttonChrome(ctx, r, input.pointer, { active: true, accent });
      if (pick === 'RANDOM') {
        label(ctx, '?', r.x + 40, r.y + 34, {
          size: 24,
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
        size: 16,
        align: 'center',
        color: colors.buttonText,
      });
      edit = 0;
    }

    label(ctx, 'Armatura', x + w / 2, y + 110, {
      size: 12,
      align: 'center',
      color: colors.muted,
    });

    const current = slots[edit]!;
    const gridX = x + 14;
    const gridY = y + 122;
    const cols = 3;
    const cellW = 106;
    const cellH = 78;
    const gap = 6;

    PICK_OPTS.forEach((id, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const r: Rect = {
        x: gridX + col * (cellW + gap),
        y: gridY + row * (cellH + gap),
        w: cellW,
        h: cellH,
      };
      const { pressed, clicked } = buttonChrome(ctx, r, input.pointer, {
        active: current === id,
        accent,
      });
      const cy = r.y + (pressed ? 1 : 0);
      if (id === 'RANDOM') {
        label(ctx, '?', r.x + r.w / 2, cy + 34, {
          size: 26,
          align: 'center',
          color: colors.buttonText,
        });
        label(ctx, 'Random', r.x + r.w / 2, cy + 60, {
          size: 12,
          align: 'center',
          color: colors.muted,
        });
      } else {
        drawArmaturaPreview(ctx, id, r.x + r.w / 2, cy + 28, {
          team,
          facing,
          scale: 0.7,
        });
        label(ctx, ARMATURAE[id].name, r.x + r.w / 2, cy + 62, {
          size: 11,
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
