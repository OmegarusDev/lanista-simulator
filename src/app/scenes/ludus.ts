import { ARMATURAE } from '../../content/armatura';
import { economy } from '../../content/economy';
import { colors } from '../../content/palette';
import type { SeasonState } from '../../domain/campaign/types';
import { fightableRoster, healGladiator, takeRestDay, upkeepCost } from '../../domain/campaign/season';
import type { Input } from '../../shell/input';
import { DESIGN_H, DESIGN_W } from '../../shell/canvas';
import type { Synth } from '../../view/audio';
import { button, label, panel, rosterChip } from '../../view/ui';
import { typeScale } from '../../view/theme';

export type LudusAction =
  | { type: 'NONE' }
  | { type: 'INSTANT_MATCH' }
  | { type: 'MUNERA' }
  | { type: 'END_DAY' }
  | { type: 'TITLE' }
  | { type: 'HEALED' }
  | { type: 'RESTED' };

export class LudusScene {
  private selectedId: number | null = null;

  constructor(private readonly synth: Synth) {}

  draw(ctx: CanvasRenderingContext2D, input: Input, state: SeasonState): LudusAction {
    ctx.fillStyle = colors.bg;
    ctx.fillRect(0, 0, DESIGN_W, DESIGN_H);

    label(ctx, 'LUDUS', 24, 36, { size: typeScale.display, color: colors.parchment });
    label(ctx, `Day ${state.day} / ${economy.seasonDays}`, 24, 58, {
      variant: 'eyebrow',
    });

    label(ctx, `${state.denarii} denarii`, DESIGN_W - 24, 36, {
      align: 'right',
      size: typeScale.title,
      color: colors.parchment,
    });
    label(ctx, `${state.virtus} virtus · upkeep ${upkeepCost(state)}`, DESIGN_W - 24, 58, {
      align: 'right',
      variant: 'eyebrow',
    });

    let action: LudusAction = { type: 'NONE' };

    // Roster panel
    panel(ctx, { x: 24, y: 80, w: DESIGN_W - 48, h: 220 }, 'Roster');
    const chips = state.roster;
    const chipW = 140;
    const chipH = 40;
    const gap = 8;
    const startX = 40;
    const startY = 118;
    chips.forEach((g, i) => {
      const col = i % 4;
      const row = Math.floor(i / 4);
      const r = {
        x: startX + col * (chipW + gap),
        y: startY + row * (chipH + gap + 18),
        w: chipW,
        h: chipH,
      };
      const tag =
        g.injury === 'SEVERE' ? 'OUT' : g.injury === 'LIGHT' ? 'Hurt' : ARMATURAE[g.armatura].short;
      if (
        rosterChip(ctx, r, input.pointer, {
          name: g.name,
          tag,
          team: 0,
          hpRatio: g.hpRatio,
          selected: this.selectedId === g.id,
          muted: g.injury === 'SEVERE',
        })
      ) {
        this.selectedId = this.selectedId === g.id ? null : g.id;
        this.synth.play('ui');
      }
      label(
        ctx,
        `${ARMATURAE[g.armatura].short} · ${g.wins}W-${g.losses}L`,
        r.x + r.w / 2,
        r.y + r.h + 12,
        { size: 10, align: 'center', color: colors.muted },
      );
    });

    const fit = fightableRoster(state).length;
    label(ctx, `${fit} fit to fight · Rest days ${state.restDaysLeft}`, 40, 290, {
      variant: 'meta',
    });

    // Actions
    const by = 320;
    if (button(ctx, { x: 24, y: by, w: 160, h: 40 }, 'Today\'s Munera', input.pointer, {
      disabled: state.dayResolved || state.status !== 'ACTIVE',
    })) {
      this.synth.play('ui');
      action = { type: 'MUNERA' };
    }
    if (button(ctx, { x: 196, y: by, w: 100, h: 40 }, 'Heal', input.pointer, {
      disabled:
        this.selectedId === null ||
        state.denarii < economy.healCost ||
        state.status !== 'ACTIVE',
    })) {
      if (this.selectedId !== null && healGladiator(state, this.selectedId)) {
        this.synth.play('ui');
        action = { type: 'HEALED' };
      }
    }
    if (button(ctx, { x: 308, y: by, w: 110, h: 40 }, 'Rest Day', input.pointer, {
      disabled: state.dayResolved || state.restDaysLeft <= 0 || state.status !== 'ACTIVE',
    })) {
      if (takeRestDay(state)) {
        this.synth.play('ui');
        action = { type: 'RESTED' };
      }
    }
    if (button(ctx, { x: 430, y: by, w: 110, h: 40 }, 'End Day', input.pointer, {
      disabled: !state.dayResolved || state.status !== 'ACTIVE',
    })) {
      this.synth.play('ui');
      action = { type: 'END_DAY' };
    }

    // Persistent Instant Match
    if (button(ctx, { x: DESIGN_W - 184, y: by, w: 160, h: 40 }, 'Instant Match', input.pointer)) {
      this.synth.play('ui');
      action = { type: 'INSTANT_MATCH' };
    }

    if (state.dayResolved && state.lastAftermath) {
      const a = state.lastAftermath;
      label(
        ctx,
        `Last: ${a.offerName} — ${a.result} (${a.purseDelta >= 0 ? '+' : ''}${a.purseDelta}d, ${a.virtusDelta >= 0 ? '+' : ''}${a.virtusDelta}v)`,
        24,
        390,
        { size: typeScale.body, color: colors.muted },
      );
    }

    label(ctx, `Record ${state.record.wins}W-${state.record.losses}L-${state.record.draws}D`, 24, DESIGN_H - 36, {
      variant: 'eyebrow',
    });
    if (button(ctx, { x: 24, y: DESIGN_H - 52, w: 90, h: 28 }, 'Title', input.pointer)) {
      this.synth.play('ui');
      action = { type: 'TITLE' };
    }

    label(ctx, `Heal ${economy.healCost}d · select a fighter first`, DESIGN_W - 24, DESIGN_H - 20, {
      align: 'right',
      variant: 'eyebrow',
    });

    return action;
  }
}
