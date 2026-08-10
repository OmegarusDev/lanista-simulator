import { ARMATURAE } from '../../content/armatura';
import { economy } from '../../content/economy';
import { colors } from '../../content/palette';
import { GRADE_LABEL } from '../../content/rpg';
import type { SeasonState } from '../../domain/campaign/types';
import type { Input } from '../../shell/input';
import { getDesign } from '../../shell/canvas';
import { loadLegacy } from '../../shell/save';
import type { Synth } from '../../view/audio';
import { isPortrait, primaryButtonSize, shellPad } from '../../view/layout';
import { button, label, panel, shellAtmosphere } from '../../view/ui';
import { typeScale } from '../../view/theme';

export type SeasonEndAction = { type: 'NONE' } | { type: 'TITLE' };

export class SeasonEndScene {
  constructor(private readonly synth: Synth) {}

  draw(ctx: CanvasRenderingContext2D, input: Input, state: SeasonState): SeasonEndAction {
    const { w, h } = getDesign();
    const pad = shellPad(w);
    const portrait = isPortrait(w, h);
    const panelW = Math.min(400, w - pad * 2);
    const panelH = Math.min(240, Math.max(200, h * 0.32));
    const panelX = (w - panelW) / 2;
    const panelY = portrait ? Math.min(h * 0.24, 180) : 150;

    shellAtmosphere(ctx, w, h);

    const title = state.status === 'BROKE' ? 'Ruined' : 'Season Complete';
    label(ctx, title, w / 2, portrait ? 64 : 80, {
      size: typeScale.banner,
      align: 'center',
      color: colors.parchment,
    });
    label(
      ctx,
      state.status === 'BROKE' ? 'The ludus cannot continue.' : `Day ${economy.seasonDays} closed.`,
      w / 2,
      portrait ? 96 : 112,
      { align: 'center', variant: 'eyebrow' },
    );

    panel(ctx, { x: panelX, y: panelY, w: panelW, h: panelH });

    label(
      ctx,
      `${state.record.wins}W – ${state.record.losses}L – ${state.record.draws}D`,
      w / 2,
      panelY + 50,
      { align: 'center', size: typeScale.display },
    );
    label(ctx, `${state.denarii} denarii · ${state.virtus} virtus`, w / 2, panelY + 90, {
      align: 'center',
      size: typeScale.title,
      color: colors.muted,
    });

    const best = [...state.roster]
      .filter((g) => !g.retired)
      .sort((a, b) => b.wins - a.wins || b.fame - a.fame)[0];
    if (best) {
      label(
        ctx,
        `Best: ${best.name} · ${ARMATURAE[best.armatura].name} · ${GRADE_LABEL[best.grade]} (${best.wins}W)`,
        w / 2,
        panelY + 130,
        { align: 'center', size: typeScale.body },
      );
    }
    if (state.retiredNames.length) {
      label(ctx, `Fallen / released: ${state.retiredNames.slice(0, 3).join(', ')}`, w / 2, panelY + 158, {
        align: 'center',
        size: typeScale.eyebrow,
        color: colors.muted,
      });
    }
    const leg = loadLegacy();
    label(
      ctx,
      `Patronage will remember this season (${leg.patronage} legacy).`,
      w / 2,
      panelY + 182,
      { align: 'center', size: typeScale.eyebrow, color: colors.muted },
    );

    const { bw, bh } = primaryButtonSize(w, h);
    let action: SeasonEndAction = { type: 'NONE' };
    if (button(ctx, { x: w / 2 - bw / 2, y: h - 80, w: bw, h: bh }, 'Title', input.pointer)) {
      this.synth.play('ui');
      action = { type: 'TITLE' };
    }
    return action;
  }
}
