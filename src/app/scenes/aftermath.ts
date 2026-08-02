import { colors } from '../../content/palette';
import type { AftermathSummary, SeasonState } from '../../domain/campaign/types';
import type { Input } from '../../shell/input';
import { DESIGN_H, DESIGN_W } from '../../shell/canvas';
import type { Synth } from '../../view/audio';
import { button, label, panel } from '../../view/ui';
import { typeScale } from '../../view/theme';

export type AftermathAction = { type: 'NONE' } | { type: 'CONTINUE' };

export class AftermathScene {
  constructor(private readonly synth: Synth) {}

  draw(
    ctx: CanvasRenderingContext2D,
    input: Input,
    state: SeasonState,
    summary: AftermathSummary,
  ): AftermathAction {
    ctx.fillStyle = colors.bg;
    ctx.fillRect(0, 0, DESIGN_W, DESIGN_H);

    label(ctx, 'Aftermath', DESIGN_W / 2, 70, {
      size: typeScale.display,
      align: 'center',
      color: colors.parchment,
    });
    label(ctx, summary.offerName, DESIGN_W / 2, 98, {
      align: 'center',
      variant: 'eyebrow',
    });

    panel(ctx, { x: DESIGN_W / 2 - 220, y: 130, w: 440, h: 260 });

    label(ctx, summary.result, DESIGN_W / 2, 170, {
      size: typeScale.banner,
      align: 'center',
      color:
        summary.result === 'WIN'
          ? colors.hp
          : summary.result === 'FORFEIT' || summary.result === 'LOSS'
            ? colors.foe
            : colors.parchment,
    });

    label(
      ctx,
      `Denarii ${summary.purseDelta >= 0 ? '+' : ''}${summary.purseDelta}   Virtus ${summary.virtusDelta >= 0 ? '+' : ''}${summary.virtusDelta}`,
      DESIGN_W / 2,
      220,
      { align: 'center', size: typeScale.title },
    );

    let y = 250;
    for (const note of summary.notes) {
      label(ctx, note, DESIGN_W / 2, y, {
        align: 'center',
        size: typeScale.body,
        color: colors.muted,
      });
      y += 22;
    }
    for (const inj of summary.injuries) {
      label(ctx, `${inj.name} → ${inj.injury}`, DESIGN_W / 2, y, {
        align: 'center',
        size: typeScale.body,
        color: colors.accentHot,
      });
      y += 22;
    }

    label(ctx, `Purse now ${state.denarii} · Virtus ${state.virtus}`, DESIGN_W / 2, 420, {
      align: 'center',
      variant: 'meta',
    });

    let action: AftermathAction = { type: 'NONE' };
    if (button(ctx, { x: DESIGN_W / 2 - 70, y: DESIGN_H - 70, w: 140, h: 40 }, 'Continue', input.pointer)) {
      this.synth.play('ui');
      action = { type: 'CONTINUE' };
    }
    return action;
  }
}
