import { colors } from '../../content/palette';
import type { Input } from '../../shell/input';
import { hasSeasonSave } from '../../shell/save';
import { getDesign } from '../../shell/canvas';
import type { Synth } from '../../view/audio';
import { titleLayout } from '../../view/layout';
import {
  bronzeStroke,
  carveFrame,
  mosaicFill,
  mosaicPalettes,
  roundPath,
  woodFill,
} from '../../view/materials';
import { button, cta, label, shellAtmosphere } from '../../view/ui';
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

    // Mosaic medallion behind brand — real menu graphic, not a glow blob
    const ovalCx = w / 2;
    const ovalCy = layout.brandY - 8;
    const ovalRx = Math.min(w * 0.38, 200);
    const ovalRy = Math.min(h * 0.11, 64);

    // Wood ring
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(ovalCx, ovalCy, ovalRx + 14, ovalRy + 12, 0, 0, Math.PI * 2);
    ctx.ellipse(ovalCx, ovalCy, ovalRx - 2, ovalRy - 2, 0, 0, Math.PI * 2);
    ctx.clip('evenodd');
    woodFill(ctx, ovalCx - ovalRx - 16, ovalCy - ovalRy - 14, (ovalRx + 16) * 2, (ovalRy + 14) * 2, {
      seed: 0x71e,
      tone: 'warm',
    });
    ctx.restore();

    // Mosaic disc
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(ovalCx, ovalCy, ovalRx, ovalRy, 0, 0, Math.PI * 2);
    ctx.clip();
    mosaicFill(ctx, ovalCx - ovalRx, ovalCy - ovalRy, ovalRx * 2, ovalRy * 2, {
      seed: 0x1a71,
      palette: [...mosaicPalettes.sand, ...mosaicPalettes.bronze, ...mosaicPalettes.cavea],
      cell: 6,
      grout: colors.grout,
    });
    ctx.restore();

    bronzeStroke(
      ctx,
      () => {
        ctx.beginPath();
        ctx.ellipse(ovalCx, ovalCy, ovalRx, ovalRy, 0, 0, Math.PI * 2);
      },
      2.5,
    );
    bronzeStroke(
      ctx,
      () => {
        ctx.beginPath();
        ctx.ellipse(ovalCx, ovalCy, ovalRx + 12, ovalRy + 10, 0, 0, Math.PI * 2);
      },
      1.5,
    );

    const brandSize = layout.orientation === 'portrait' || w < 520 ? 46 : 56;
    // Carved brand plaque
    const plaqueW = Math.min(w - 48, brandSize * 7.2);
    const plaqueH = brandSize + 28;
    const px = w / 2 - plaqueW / 2;
    const py = layout.brandY - brandSize + 4;
    ctx.save();
    roundPath(ctx, px, py, plaqueW, plaqueH, 8);
    ctx.clip();
    woodFill(ctx, px, py, plaqueW, plaqueH, { seed: 0xb2a1d, tone: 'dark' });
    ctx.restore();
    bronzeStroke(ctx, () => roundPath(ctx, px, py, plaqueW, plaqueH, 8), 2);
    carveFrame(ctx, px, py, plaqueW, plaqueH, 8);

    ctx.fillStyle = 'rgba(8,4,2,0.45)';
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
    label(ctx, 'Sand · Steel · Mosaic', w / 2, layout.taglineY, {
      size: typeScale.label,
      align: 'center',
      color: colors.bronzeHot,
    });

    let action: TitleAction = { type: 'NONE' };
    const canContinue = hasSeasonSave();

    if (cta(ctx, layout.buttons[0]!, 'Instant Match', input.pointer)) {
      this.synth.play('ui');
      action = { type: 'INSTANT_MATCH' };
    }
    if (
      button(ctx, layout.buttons[1]!, 'New Season', input.pointer, {
        size: typeScale.title,
      })
    ) {
      this.synth.play('ui');
      action = { type: 'NEW_SEASON' };
    }
    if (
      button(ctx, layout.buttons[2]!, 'Continue', input.pointer, {
        disabled: !canContinue,
        size: typeScale.title,
      })
    ) {
      this.synth.play('ui');
      action = { type: 'CONTINUE' };
    }

    label(ctx, 'Lab first — Instant Match needs no career.', w / 2, layout.footerY, {
      size: typeScale.body,
      align: 'center',
      color: colors.muted,
    });

    return action;
  }
}
