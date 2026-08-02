import { colors } from '../../content/palette';
import type { Input } from '../../shell/input';
import { hasSeasonSave } from '../../shell/save';
import { DESIGN_H, DESIGN_W } from '../../shell/canvas';
import type { Synth } from '../../view/audio';
import { button, label } from '../../view/ui';
import { space, typeScale } from '../../view/theme';

export type TitleAction =
  | { type: 'NONE' }
  | { type: 'INSTANT_MATCH' }
  | { type: 'NEW_SEASON' }
  | { type: 'CONTINUE' };

export class TitleScene {
  constructor(private readonly synth: Synth) {}

  draw(ctx: CanvasRenderingContext2D, input: Input): TitleAction {
    ctx.fillStyle = colors.bg;
    ctx.fillRect(0, 0, DESIGN_W, DESIGN_H);

    const g = ctx.createRadialGradient(
      DESIGN_W / 2,
      DESIGN_H * 0.35,
      40,
      DESIGN_W / 2,
      DESIGN_H * 0.55,
      420,
    );
    g.addColorStop(0, '#3a281c');
    g.addColorStop(1, colors.bg);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, DESIGN_W, DESIGN_H);

    label(ctx, 'LANISTA', DESIGN_W / 2, 120, {
      size: 48,
      align: 'center',
      color: colors.parchment,
    });
    label(ctx, 'A season of sand and steel', DESIGN_W / 2, 152, {
      size: typeScale.body,
      align: 'center',
      color: colors.muted,
    });

    const cx = DESIGN_W / 2;
    const bw = 220;
    const bh = 44;
    let y = 220;
    let action: TitleAction = { type: 'NONE' };

    if (button(ctx, { x: cx - bw / 2, y, w: bw, h: bh }, 'Instant Match', input.pointer)) {
      this.synth.play('ui');
      action = { type: 'INSTANT_MATCH' };
    }
    y += bh + space.md;

    if (button(ctx, { x: cx - bw / 2, y, w: bw, h: bh }, 'New Season', input.pointer)) {
      this.synth.play('ui');
      action = { type: 'NEW_SEASON' };
    }
    y += bh + space.md;

    const canContinue = hasSeasonSave();
    if (
      button(ctx, { x: cx - bw / 2, y, w: bw, h: bh }, 'Continue', input.pointer, {
        disabled: !canContinue,
      })
    ) {
      this.synth.play('ui');
      action = { type: 'CONTINUE' };
    }

    label(ctx, 'Instant Match is always one click — no career required.', cx, DESIGN_H - 28, {
      size: typeScale.meta,
      align: 'center',
      color: colors.muted,
    });

    return action;
  }
}
