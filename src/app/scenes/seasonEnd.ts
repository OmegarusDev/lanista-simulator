import { ARMATURAE } from '../../content/armatura';
import { economy } from '../../content/economy';
import { colors } from '../../content/palette';
import type { SeasonState } from '../../domain/campaign/types';
import type { Input } from '../../shell/input';
import { DESIGN_H, DESIGN_W } from '../../shell/canvas';
import type { Synth } from '../../view/audio';
import { button, label, panel } from '../../view/ui';
import { typeScale } from '../../view/theme';

export type SeasonEndAction = { type: 'NONE' } | { type: 'TITLE' };

export class SeasonEndScene {
  constructor(private readonly synth: Synth) {}

  draw(ctx: CanvasRenderingContext2D, input: Input, state: SeasonState): SeasonEndAction {
    ctx.fillStyle = colors.bg;
    ctx.fillRect(0, 0, DESIGN_W, DESIGN_H);

    const title = state.status === 'BROKE' ? 'Ruined' : 'Season Complete';
    label(ctx, title, DESIGN_W / 2, 80, {
      size: typeScale.banner,
      align: 'center',
      color: colors.parchment,
    });
    label(
      ctx,
      state.status === 'BROKE' ? 'The ludus cannot continue.' : `Day ${economy.seasonDays} closed.`,
      DESIGN_W / 2,
      112,
      { align: 'center', variant: 'eyebrow' },
    );

    panel(ctx, { x: DESIGN_W / 2 - 200, y: 150, w: 400, h: 220 });

    label(
      ctx,
      `${state.record.wins}W – ${state.record.losses}L – ${state.record.draws}D`,
      DESIGN_W / 2,
      200,
      { align: 'center', size: typeScale.display },
    );
    label(ctx, `${state.denarii} denarii · ${state.virtus} virtus`, DESIGN_W / 2, 240, {
      align: 'center',
      size: typeScale.title,
      color: colors.muted,
    });

    const best = [...state.roster].sort(
      (a, b) => b.wins - a.wins || b.hpRatio - a.hpRatio,
    )[0];
    if (best) {
      label(
        ctx,
        `Best: ${best.name} · ${ARMATURAE[best.armatura].name} (${best.wins}W)`,
        DESIGN_W / 2,
        290,
        { align: 'center', size: typeScale.body },
      );
    }

    let action: SeasonEndAction = { type: 'NONE' };
    if (button(ctx, { x: DESIGN_W / 2 - 70, y: DESIGN_H - 80, w: 140, h: 40 }, 'Title', input.pointer)) {
      this.synth.play('ui');
      action = { type: 'TITLE' };
    }
    return action;
  }
}
