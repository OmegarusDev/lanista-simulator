import { colors } from '../../content/palette';
import type { AftermathSummary, SeasonState } from '../../domain/campaign/types';
import type { Input } from '../../shell/input';
import { getDesign } from '../../shell/canvas';
import type { Synth } from '../../view/audio';
import { isPortrait, primaryButtonSize, shellPad } from '../../view/layout';
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
    const { w, h } = getDesign();
    const pad = shellPad(w);
    const portrait = isPortrait(w, h);
    const panelW = Math.min(440, w - pad * 2);
    const panelH = Math.min(280, Math.max(220, h * 0.4));
    const panelX = (w - panelW) / 2;
    const panelY = portrait ? Math.min(h * 0.22, 160) : 130;

    ctx.fillStyle = colors.bg;
    ctx.fillRect(0, 0, w, h);

    label(ctx, 'Aftermath', w / 2, portrait ? 56 : 70, {
      size: typeScale.display,
      align: 'center',
      color: colors.parchment,
    });
    label(ctx, summary.offerName, w / 2, portrait ? 82 : 98, {
      align: 'center',
      variant: 'eyebrow',
    });

    panel(ctx, { x: panelX, y: panelY, w: panelW, h: panelH });

    label(ctx, summary.result, w / 2, panelY + 40, {
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
      w / 2,
      panelY + 90,
      { align: 'center', size: typeScale.title },
    );

    let y = panelY + 120;
    for (const note of summary.notes) {
      label(ctx, note, w / 2, y, {
        align: 'center',
        size: typeScale.body,
        color: colors.muted,
      });
      y += 22;
    }
    for (const inj of summary.injuries) {
      label(ctx, `${inj.name} → ${inj.injury}`, w / 2, y, {
        align: 'center',
        size: typeScale.body,
        color: colors.accentHot,
      });
      y += 22;
    }

    label(ctx, `Purse now ${state.denarii} · Virtus ${state.virtus}`, w / 2, h - 90, {
      align: 'center',
      variant: 'meta',
    });

    const { bw, bh } = primaryButtonSize(w, h);
    let action: AftermathAction = { type: 'NONE' };
    if (
      button(ctx, { x: w / 2 - bw / 2, y: h - 70, w: bw, h: bh }, 'Continue', input.pointer)
    ) {
      this.synth.play('ui');
      action = { type: 'CONTINUE' };
    }
    return action;
  }
}
