import { ARMATURAE } from '../../content/armatura';
import { colors } from '../../content/palette';
import { fightersForSlot, shortSlotReq } from '../../domain/campaign/eligibility';
import { fightableRoster } from '../../domain/campaign/season';
import type { MuneraOffer, SeasonState } from '../../domain/campaign/types';
import type { Input } from '../../shell/input';
import { getDesign } from '../../shell/canvas';
import type { Synth } from '../../view/audio';
import { isPortrait, shellPad } from '../../view/layout';
import { button, label, panel, rosterChip } from '../../view/ui';
import { space, typeScale } from '../../view/theme';

export type LineupAction =
  | { type: 'NONE' }
  | { type: 'BACK' }
  | { type: 'FIGHT'; lineupIds: number[] };

export class LineupScene {
  /** One gladiator id per slot (null = empty). */
  private slots: (number | null)[] = [];
  private activeSlot = 0;

  constructor(private readonly synth: Synth) {}

  reset(offer?: MuneraOffer): void {
    const n = offer?.teamSize ?? 1;
    this.slots = Array.from({ length: n }, () => null);
    this.activeSlot = 0;
  }

  draw(
    ctx: CanvasRenderingContext2D,
    input: Input,
    state: SeasonState,
    offer: MuneraOffer,
  ): LineupAction {
    if (this.slots.length !== offer.teamSize) this.reset(offer);

    const { w, h } = getDesign();
    const pad = shellPad(w);
    const portrait = isPortrait(w, h);

    ctx.fillStyle = colors.bg;
    ctx.fillRect(0, 0, w, h);

    label(ctx, 'Lineup', pad, 36, { size: typeScale.display, color: colors.parchment });
    label(ctx, `${offer.name} · ${offer.teamSize}v${offer.teamSize}`, pad, 58, {
      variant: 'eyebrow',
    });
    label(ctx, offer.blurb, pad, 78, { size: typeScale.body, color: colors.muted });

    const opp = offer.opponents.map((id) => ARMATURAE[id].name).join(', ');
    label(ctx, `Opponents: ${opp}`, pad, 98, { size: typeScale.meta, color: colors.muted });

    // Slot tabs — wrap on narrow widths
    const slotW = portrait ? Math.min(140, (w - pad * 2 - space.sm) / Math.min(2, offer.teamSize)) : 140;
    offer.playerSlots.forEach((slot, i) => {
      const col = portrait ? i % 2 : i;
      const row = portrait ? Math.floor(i / 2) : 0;
      const r = {
        x: pad + col * (slotW + space.sm),
        y: 118 + row * 44,
        w: slotW,
        h: 36,
      };
      const filled = this.slots[i];
      const g = filled != null ? state.roster.find((x) => x.id === filled) : null;
      const title = g ? g.name : shortSlotReq(slot);
      if (
        button(ctx, r, `F${i + 1}: ${title}`, input.pointer, {
          active: this.activeSlot === i,
        })
      ) {
        this.activeSlot = i;
        this.synth.play('ui');
      }
    });

    const slotRows = portrait ? Math.ceil(offer.teamSize / 2) : 1;
    const panelY = 118 + slotRows * 44 + 10;
    const panelH = Math.max(180, h - panelY - 70);
    panel(ctx, { x: pad, y: panelY, w: w - pad * 2, h: panelH }, 'Eligible for this slot');

    const pool = fightableRoster(state);
    const pickedElsewhere = this.slots.filter(
      (id, idx) => id != null && idx !== this.activeSlot,
    ) as number[];
    const slotReq = offer.playerSlots[this.activeSlot]!;
    const candidates = fightersForSlot(pool, slotReq, pickedElsewhere);

    let action: LineupAction = { type: 'NONE' };

    const chipW = portrait ? Math.min(200, w - pad * 2 - 32) : 200;
    const chipH = 44;
    const area = {
      x: pad + 16,
      y: panelY + 42,
      w: w - pad * 2 - 32,
      h: panelH - 50,
    };
    const cols = Math.max(1, Math.floor((area.w + space.sm) / (chipW + space.sm)));
    candidates.forEach((g, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const r = {
        x: area.x + col * (chipW + 20),
        y: area.y + row * 70,
        w: chipW,
        h: chipH,
      };
      if (r.y + r.h > panelY + panelH - 8) return;
      const selected = this.slots[this.activeSlot] === g.id;
      if (
        rosterChip(ctx, r, input.pointer, {
          name: g.name,
          tag: ARMATURAE[g.armatura].short,
          team: 0,
          hpRatio: g.hpRatio,
          selected,
          muted: false,
        })
      ) {
        this.synth.play('ui');
        this.slots[this.activeSlot] = selected ? null : g.id;
        if (!selected) {
          const next = this.slots.findIndex((id) => id == null);
          if (next >= 0) this.activeSlot = next;
        }
      }
    });

    if (candidates.length === 0) {
      label(ctx, `No fit fighters for ${shortSlotReq(slotReq)}.`, w / 2, panelY + panelH / 2, {
        align: 'center',
        color: colors.foe,
      });
    }

    const filledCount = this.slots.filter((id) => id != null).length;
    label(ctx, `Filled ${filledCount} / ${offer.teamSize}`, pad, h - 64, { variant: 'meta' });

    if (button(ctx, { x: pad, y: h - 52, w: 100, h: 36 }, 'Back', input.pointer)) {
      this.synth.play('ui');
      action = { type: 'BACK' };
    }

    const ready =
      this.slots.every((id) => id != null) && state.denarii >= offer.entryFee && offer.eligible;
    if (
      button(
        ctx,
        { x: w - pad - 136, y: h - 52, w: 136, h: 36 },
        'Enter Arena',
        input.pointer,
        { disabled: !ready },
      )
    ) {
      this.synth.play('ui');
      action = { type: 'FIGHT', lineupIds: this.slots as number[] };
    }

    return action;
  }
}
