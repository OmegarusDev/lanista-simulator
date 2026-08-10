import { colors } from '../../content/palette';
import type { Input } from '../../shell/input';
import { hasSeasonSave } from '../../shell/save';
import { getDesign } from '../../shell/canvas';
import type { Synth } from '../../view/audio';
import { titleLayout } from '../../view/layout';
import { button, label, shellAtmosphere } from '../../view/ui';
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

    shellAtmosphere(ctx, w, h);

    // Soft arena oval silhouette behind brand
    ctx.strokeStyle = 'rgba(160,120,70,0.18)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(w / 2, layout.brandY + 8, Math.min(w * 0.42, 220), Math.min(h * 0.08, 48), 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(120,90,50,0.12)';
    ctx.beginPath();
    ctx.ellipse(w / 2, layout.brandY + 8, Math.min(w * 0.36, 180), Math.min(h * 0.06, 36), 0, 0, Math.PI * 2);
    ctx.stroke();

    label(ctx, 'LANISTA', w / 2, layout.brandY, {
      size: layout.orientation === 'portrait' || w < 520 ? 44 : 52,
      align: 'center',
      color: colors.parchment,
    });
    label(ctx, 'A season of sand and steel', w / 2, layout.taglineY, {
      size: typeScale.label,
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
      if (button(ctx, r, labels[i]!, input.pointer, { disabled, size: typeScale.title })) {
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
        size: typeScale.body,
        align: 'center',
        color: colors.muted,
      },
    );

    return action;
  }
}
