import { colors } from '../../content/palette';
import type { Input } from '../../shell/input';
import { hasSeasonSave } from '../../shell/save';
import { getDesign } from '../../shell/canvas';
import type { Synth } from '../../view/audio';
import { titleLayout } from '../../view/layout';
import { button, label } from '../../view/ui';
import { typeScale } from '../../view/theme';

export type TitleAction =
  | { type: 'NONE' }
  | { type: 'INSTANT_MATCH' }
  | { type: 'NEW_SEASON' }
  | { type: 'CONTINUE' };

export class TitleScene {
  constructor(private readonly synth: Synth) {}

  draw(ctx: CanvasRenderingContext2D, input: Input): TitleAction {
    const { w, h } = getDesign();
    const layout = titleLayout(w, h);

    ctx.fillStyle = colors.bg;
    ctx.fillRect(0, 0, w, h);

    const g = ctx.createRadialGradient(
      w / 2,
      h * 0.35,
      40,
      w / 2,
      h * 0.55,
      Math.max(w, h) * 0.55,
    );
    g.addColorStop(0, '#3a281c');
    g.addColorStop(1, colors.bg);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    label(ctx, 'LANISTA', w / 2, layout.brandY, {
      size: layout.orientation === 'portrait' || w < 520 ? 40 : 48,
      align: 'center',
      color: colors.parchment,
    });
    label(ctx, 'A season of sand and steel', w / 2, layout.taglineY, {
      size: typeScale.body,
      align: 'center',
      color: colors.muted,
    });

    let action: TitleAction = { type: 'NONE' };
    const labels = ['Instant Match', 'New Season', 'Continue'] as const;
    const types = ['INSTANT_MATCH', 'NEW_SEASON', 'CONTINUE'] as const;
    const canContinue = hasSeasonSave();

    for (let i = 0; i < 3; i++) {
      const r = layout.buttons[i]!;
      const disabled = types[i] === 'CONTINUE' && !canContinue;
      if (button(ctx, r, labels[i]!, input.pointer, { disabled })) {
        this.synth.play('ui');
        action = { type: types[i]! };
      }
    }

    label(
      ctx,
      'Instant Match is always one click — no career required.',
      w / 2,
      layout.footerY,
      {
        size: typeScale.meta,
        align: 'center',
        color: colors.muted,
      },
    );

    return action;
  }
}
