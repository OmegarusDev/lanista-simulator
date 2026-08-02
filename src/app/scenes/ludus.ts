import { ARMATURAE } from '../../content/armatura';
import { economy } from '../../content/economy';
import { colors } from '../../content/palette';
import type { SeasonState } from '../../domain/campaign/types';
import { fightableRoster, healGladiator, takeRestDay, upkeepCost } from '../../domain/campaign/season';
import type { Input } from '../../shell/input';
import { getDesign } from '../../shell/canvas';
import type { Synth } from '../../view/audio';
import { buttonRow, flowHeaderLayout, isPortrait } from '../../view/layout';
import { button, label, panel, rosterChip } from '../../view/ui';
import { space, typeScale } from '../../view/theme';

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
    const { w, h } = getDesign();
    const hdr = flowHeaderLayout(w, h);
    const pad = hdr.pad;
    const portrait = isPortrait(w, h);

    ctx.fillStyle = colors.bg;
    ctx.fillRect(0, 0, w, h);

    label(ctx, 'LUDUS', pad, hdr.titleY, { size: typeScale.display, color: colors.parchment });
    label(ctx, `Day ${state.day} / ${economy.seasonDays}`, pad, hdr.metaY, {
      variant: 'eyebrow',
    });

    if (portrait) {
      label(ctx, `${state.denarii} denarii`, pad, hdr.rightTitleY, {
        size: typeScale.title,
        color: colors.parchment,
      });
      label(ctx, `${state.virtus} virtus · upkeep ${upkeepCost(state)}`, pad, hdr.rightMetaY, {
        variant: 'eyebrow',
      });
    } else {
      label(ctx, `${state.denarii} denarii`, w - pad, hdr.rightTitleY, {
        align: 'right',
        size: typeScale.title,
        color: colors.parchment,
      });
      label(ctx, `${state.virtus} virtus · upkeep ${upkeepCost(state)}`, w - pad, hdr.rightMetaY, {
        align: 'right',
        variant: 'eyebrow',
      });
    }

    let action: LudusAction = { type: 'NONE' };

    const rosterTop = portrait ? hdr.rightMetaY + 16 : 80;
    const chipW = portrait ? Math.min(150, (w - pad * 2 - 8) / 2) : 140;
    const chipH = 40;
    const gap = 8;
    const cols = Math.max(1, Math.floor((w - pad * 2 + gap) / (chipW + gap)));
    const rows = Math.ceil(Math.max(1, state.roster.length) / cols);
    const rosterH = Math.max(160, 40 + rows * (chipH + gap + 18) + 20);
    panel(ctx, { x: pad, y: rosterTop, w: w - pad * 2, h: rosterH }, 'Roster');

    const area = {
      x: pad + 16,
      y: rosterTop + 38,
      w: w - pad * 2 - 32,
      h: rosterH - 50,
    };
    // Re-space rows with meta label room under each chip
    state.roster.forEach((g, i) => {
      const row = Math.floor(i / cols);
      const col = i % cols;
      const r = {
        x: area.x + col * (chipW + gap),
        y: area.y + row * (chipH + gap + 18),
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
    const fitY = rosterTop + rosterH + 14;
    label(ctx, `${fit} fit to fight · Rest days ${state.restDaysLeft}`, pad + 16, fitY, {
      variant: 'meta',
    });

    const by = fitY + 20;
    const btnH = portrait ? 44 : 40;
    if (portrait) {
      const row1 = buttonRow(pad, by, w - pad * 2, btnH, 2, space.sm);
      if (
        button(ctx, row1[0]!, "Today's Munera", input.pointer, {
          disabled: state.dayResolved || state.status !== 'ACTIVE',
        })
      ) {
        this.synth.play('ui');
        action = { type: 'MUNERA' };
      }
      if (
        button(ctx, row1[1]!, 'Heal', input.pointer, {
          disabled:
            this.selectedId === null ||
            state.denarii < economy.healCost ||
            state.status !== 'ACTIVE',
        })
      ) {
        if (this.selectedId !== null && healGladiator(state, this.selectedId)) {
          this.synth.play('ui');
          action = { type: 'HEALED' };
        }
      }
      const row2 = buttonRow(pad, by + btnH + space.sm, w - pad * 2, btnH, 2, space.sm);
      if (
        button(ctx, row2[0]!, 'Rest Day', input.pointer, {
          disabled: state.dayResolved || state.restDaysLeft <= 0 || state.status !== 'ACTIVE',
        })
      ) {
        if (takeRestDay(state)) {
          this.synth.play('ui');
          action = { type: 'RESTED' };
        }
      }
      if (
        button(ctx, row2[1]!, 'End Day', input.pointer, {
          disabled: !state.dayResolved || state.status !== 'ACTIVE',
        })
      ) {
        this.synth.play('ui');
        action = { type: 'END_DAY' };
      }
      const imY = by + (btnH + space.sm) * 2;
      if (
        button(ctx, { x: pad, y: imY, w: w - pad * 2, h: btnH }, 'Instant Match', input.pointer)
      ) {
        this.synth.play('ui');
        action = { type: 'INSTANT_MATCH' };
      }

      if (state.dayResolved && state.lastAftermath) {
        const a = state.lastAftermath;
        label(
          ctx,
          `Last: ${a.offerName} — ${a.result}`,
          pad,
          imY + btnH + 18,
          { size: typeScale.body, color: colors.muted },
        );
      }
    } else {
      if (
        button(ctx, { x: pad, y: by, w: 160, h: btnH }, "Today's Munera", input.pointer, {
          disabled: state.dayResolved || state.status !== 'ACTIVE',
        })
      ) {
        this.synth.play('ui');
        action = { type: 'MUNERA' };
      }
      if (
        button(ctx, { x: pad + 172, y: by, w: 100, h: btnH }, 'Heal', input.pointer, {
          disabled:
            this.selectedId === null ||
            state.denarii < economy.healCost ||
            state.status !== 'ACTIVE',
        })
      ) {
        if (this.selectedId !== null && healGladiator(state, this.selectedId)) {
          this.synth.play('ui');
          action = { type: 'HEALED' };
        }
      }
      if (
        button(ctx, { x: pad + 284, y: by, w: 110, h: btnH }, 'Rest Day', input.pointer, {
          disabled: state.dayResolved || state.restDaysLeft <= 0 || state.status !== 'ACTIVE',
        })
      ) {
        if (takeRestDay(state)) {
          this.synth.play('ui');
          action = { type: 'RESTED' };
        }
      }
      if (
        button(ctx, { x: pad + 406, y: by, w: 110, h: btnH }, 'End Day', input.pointer, {
          disabled: !state.dayResolved || state.status !== 'ACTIVE',
        })
      ) {
        this.synth.play('ui');
        action = { type: 'END_DAY' };
      }
      if (
        button(ctx, { x: w - pad - 160, y: by, w: 160, h: btnH }, 'Instant Match', input.pointer)
      ) {
        this.synth.play('ui');
        action = { type: 'INSTANT_MATCH' };
      }

      if (state.dayResolved && state.lastAftermath) {
        const a = state.lastAftermath;
        label(
          ctx,
          `Last: ${a.offerName} — ${a.result} (${a.purseDelta >= 0 ? '+' : ''}${a.purseDelta}d, ${a.virtusDelta >= 0 ? '+' : ''}${a.virtusDelta}v)`,
          pad,
          by + 70,
          { size: typeScale.body, color: colors.muted },
        );
      }
    }

    label(
      ctx,
      `Record ${state.record.wins}W-${state.record.losses}L-${state.record.draws}D`,
      pad,
      h - 36,
      { variant: 'eyebrow' },
    );
    if (button(ctx, { x: pad, y: h - 52, w: 90, h: 28 }, 'Title', input.pointer)) {
      this.synth.play('ui');
      action = { type: 'TITLE' };
    }

    label(ctx, `Heal ${economy.healCost}d · select a fighter first`, w - pad, h - 20, {
      align: 'right',
      variant: 'eyebrow',
    });

    return action;
  }
}
