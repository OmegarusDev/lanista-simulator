import { ARMATURAE } from '../../content/armatura';
import { colors } from '../../content/palette';
import { formatSlotGates } from '../../domain/campaign/eligibility';
import { maxOfferTier } from '../../domain/campaign/offers';
import type { MuneraOffer, SeasonState } from '../../domain/campaign/types';
import type { Input } from '../../shell/input';
import { DESIGN_H, DESIGN_W } from '../../shell/canvas';
import type { Synth } from '../../view/audio';
import { button, label, panel } from '../../view/ui';
import { typeScale } from '../../view/theme';

export type OffersAction =
  | { type: 'NONE' }
  | { type: 'BACK' }
  | { type: 'PICK'; offer: MuneraOffer };

export class OffersScene {
  constructor(private readonly synth: Synth) {}

  draw(ctx: CanvasRenderingContext2D, input: Input, state: SeasonState): OffersAction {
    ctx.fillStyle = colors.bg;
    ctx.fillRect(0, 0, DESIGN_W, DESIGN_H);

    label(ctx, 'Munera', 24, 32, { size: typeScale.display, color: colors.parchment });
    label(ctx, `Day ${state.day} · Tier ${maxOfferTier(state.virtus)} · class-gated events`, 24, 52, {
      variant: 'eyebrow',
    });

    let action: OffersAction = { type: 'NONE' };
    const rowH = 78;
    const startY = 68;

    state.offers.forEach((o, i) => {
      const y = startY + i * rowH;
      panel(ctx, { x: 20, y, w: DESIGN_W - 40, h: rowH - 6 });
      const titleColor = o.eligible ? colors.parchment : colors.muted;
      label(ctx, o.name, 36, y + 22, { size: typeScale.title, color: titleColor });
      label(ctx, `${o.kind} · ${o.teamSize}v${o.teamSize}`, 36, y + 40, {
        variant: 'eyebrow',
        color: o.eligible ? colors.muted : colors.buttonDisabled,
      });
      const opp = o.opponents.map((id) => ARMATURAE[id].short).join('+');
      label(
        ctx,
        `${formatSlotGates(o.playerSlots)}  →  vs ${opp}  ·  ${o.purse}d / fee ${o.entryFee}`,
        36,
        y + 58,
        { size: 11, color: colors.muted },
      );
      label(ctx, o.blurb, 420, y + 22, {
        size: 11,
        color: colors.muted,
      });

      const canAfford = state.denarii >= o.entryFee;
      if (
        button(ctx, { x: DESIGN_W - 148, y: y + 20, w: 100, h: 36 }, o.eligible ? 'Accept' : 'Locked', input.pointer, {
          disabled: !o.eligible || !canAfford,
        })
      ) {
        this.synth.play('ui');
        action = { type: 'PICK', offer: o };
      }
    });

    if (state.offers.length === 0) {
      label(ctx, 'No offers today.', DESIGN_W / 2, 200, {
        align: 'center',
        color: colors.muted,
      });
    }

    if (button(ctx, { x: 24, y: DESIGN_H - 48, w: 100, h: 34 }, 'Back', input.pointer)) {
      this.synth.play('ui');
      action = { type: 'BACK' };
    }

    label(ctx, `${state.denarii} denarii · need matching armaturae for classics`, DESIGN_W - 24, DESIGN_H - 24, {
      align: 'right',
      variant: 'eyebrow',
    });

    return action;
  }
}
