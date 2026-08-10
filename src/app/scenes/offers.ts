import { ARMATURAE } from '../../content/armatura';
import { colors } from '../../content/palette';
import { formatSlotGates } from '../../domain/campaign/eligibility';
import { maxOfferTier } from '../../domain/campaign/offers';
import type { MuneraOffer, SeasonState } from '../../domain/campaign/types';
import type { Input } from '../../shell/input';
import { getDesign } from '../../shell/canvas';
import type { Synth } from '../../view/audio';
import { flowHeaderLayout, isPortrait, shellPad } from '../../view/layout';
import { button, label, panel } from '../../view/ui';
import { typeScale } from '../../view/theme';

export type OffersAction =
  | { type: 'NONE' }
  | { type: 'BACK' }
  | { type: 'PICK'; offer: MuneraOffer };

export class OffersScene {
  constructor(private readonly synth: Synth) {}

  draw(ctx: CanvasRenderingContext2D, input: Input, state: SeasonState): OffersAction {
    const { w, h } = getDesign();
    const pad = shellPad(w);
    const portrait = isPortrait(w, h);
    const hdr = flowHeaderLayout(w, h);

    ctx.fillStyle = colors.bg;
    ctx.fillRect(0, 0, w, h);

    label(ctx, 'Munera', pad, hdr.titleY, { size: typeScale.display, color: colors.parchment });
    label(
      ctx,
      `Day ${state.day} · Tier ${maxOfferTier(state.virtus)} · class-gated events`,
      pad,
      hdr.metaY,
      { variant: 'eyebrow' },
    );

    let action: OffersAction = { type: 'NONE' };
    const rowH = portrait ? 110 : 88;
    const startY = portrait ? hdr.metaY + 22 : 76;

    state.offers.forEach((o, i) => {
      const y = startY + i * rowH;
      panel(ctx, { x: pad - 4, y, w: w - pad * 2 + 8, h: rowH - 8 });
      const titleColor = o.eligible ? colors.parchment : colors.muted;
      label(ctx, o.name, pad + 12, y + 24, { size: typeScale.title, color: titleColor });
      label(
        ctx,
        `${o.kind} · ${o.teamSize}v${o.teamSize} · ${o.location ?? 'arena'}`,
        pad + 12,
        y + 44,
        {
          variant: 'eyebrow',
          color: o.eligible ? colors.muted : colors.buttonDisabled,
        },
      );
      const opp = o.opponents.map((id) => ARMATURAE[id].name).join('+');
      label(
        ctx,
        `${formatSlotGates(o.playerSlots)}  →  vs ${opp}  ·  ${o.purse}d / fee ${o.entryFee}`,
        pad + 12,
        y + 64,
        { size: typeScale.meta, color: colors.muted },
      );

      if (!portrait) {
        label(ctx, o.blurb, Math.min(420, w * 0.45), y + 24, {
          size: typeScale.meta,
          color: colors.muted,
        });
      } else {
        label(ctx, o.blurb, pad + 12, y + 84, {
          size: typeScale.meta,
          color: colors.muted,
        });
      }

      const canAfford = state.denarii >= o.entryFee;
      const btnW = 108;
      const btnH = portrait ? 44 : 40;
      const btnX = portrait ? w - pad - btnW : w - pad - btnW - 8;
      const btnY = portrait ? y + 20 : y + 22;
      if (
        button(
          ctx,
          { x: btnX, y: btnY, w: btnW, h: btnH },
          o.eligible ? 'Accept' : 'Locked',
          input.pointer,
          { disabled: !o.eligible || !canAfford },
        )
      ) {
        this.synth.play('ui');
        action = { type: 'PICK', offer: o };
      }
    });

    if (state.offers.length === 0) {
      label(ctx, 'No offers today.', w / 2, h * 0.4, {
        align: 'center',
        size: typeScale.body,
        color: colors.muted,
      });
    }

    if (button(ctx, { x: pad, y: h - 56, w: 112, h: 40 }, 'Back', input.pointer)) {
      this.synth.play('ui');
      action = { type: 'BACK' };
    }

    label(
      ctx,
      `${state.denarii} denarii · need matching armaturae for classics`,
      w - pad,
      h - 24,
      {
        align: 'right',
        variant: 'eyebrow',
      },
    );

    return action;
  }
}
