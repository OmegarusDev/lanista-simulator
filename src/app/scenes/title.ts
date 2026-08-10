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

    // Soft arena oval silhouette behind brand — cavea suggestion, not a card
    const ovalCx = w / 2;
    const ovalCy = layout.brandY + 6;
    const ovalRx = Math.min(w * 0.44, 240);
    const ovalRy = Math.min(h * 0.09, 52);
    const ovalWash = ctx.createRadialGradient(ovalCx, ovalCy, 4, ovalCx, ovalCy, ovalRx);
    ovalWash.addColorStop(0, 'rgba(180,120,60,0.08)');
    ovalWash.addColorStop(0.55, 'rgba(80,55,30,0.04)');
    ovalWash.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = ovalWash;
    ctx.beginPath();
    ctx.ellipse(ovalCx, ovalCy, ovalRx, ovalRy, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(168,130,80,0.22)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(ovalCx, ovalCy, ovalRx, ovalRy, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(120,90,50,0.14)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(ovalCx, ovalCy, ovalRx * 0.82, ovalRy * 0.72, 0, 0, Math.PI * 2);
    ctx.stroke();

    const brandSize = layout.orientation === 'portrait' || w < 520 ? 46 : 56;
    // Soft brand weight — parchment over a warm shadow, not a glow
    ctx.fillStyle = 'rgba(8,5,3,0.35)';
    ctx.font = `700 ${brandSize}px "Palatino Linotype", Palatino, Georgia, serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText('LANISTA', w / 2 + 1.5, layout.brandY + 1.5);
    label(ctx, 'LANISTA', w / 2, layout.brandY, {
      size: brandSize,
      align: 'center',
      color: colors.parchment,
      weight: '700',
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
