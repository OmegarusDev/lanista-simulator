import { ARMATURAE } from '../../content/armatura';
import { colors } from '../../content/palette';
import { fightersForSlot, shortSlotReq } from '../../domain/campaign/eligibility';
import { fightableRoster } from '../../domain/campaign/season';
import type { MuneraOffer, SeasonState } from '../../domain/campaign/types';
import type { Input } from '../../shell/input';
import { DESIGN_H, DESIGN_W } from '../../shell/canvas';
import type { Synth } from '../../view/audio';
import { button, label, panel, rosterChip } from '../../view/ui';
import { typeScale } from '../../view/theme';

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

    ctx.fillStyle = colors.bg;
    ctx.fillRect(0, 0, DESIGN_W, DESIGN_H);

    label(ctx, 'Lineup', 24, 36, { size: typeScale.display, color: colors.parchment });
    label(ctx, `${offer.name} · ${offer.teamSize}v${offer.teamSize}`, 24, 58, {
      variant: 'eyebrow',
    });
    label(ctx, offer.blurb, 24, 78, { size: typeScale.body, color: colors.muted });

    const opp = offer.opponents.map((id) => ARMATURAE[id].name).join(', ');
    label(ctx, `Opponents: ${opp}`, 24, 98, { size: typeScale.meta, color: colors.muted });

    // Slot tabs
    offer.playerSlots.forEach((slot, i) => {
      const r = { x: 24 + i * 150, y: 118, w: 140, h: 36 };
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

    panel(ctx, { x: 24, y: 168, w: DESIGN_W - 48, h: 240 }, 'Eligible for this slot');

    const pool = fightableRoster(state);
    const pickedElsewhere = this.slots.filter(
      (id, idx) => id != null && idx !== this.activeSlot,
    ) as number[];
    const slotReq = offer.playerSlots[this.activeSlot]!;
    const candidates = fightersForSlot(pool, slotReq, pickedElsewhere);

    let action: LineupAction = { type: 'NONE' };

    candidates.forEach((g, i) => {
      const col = i % 4;
      const row = Math.floor(i / 4);
      const r = { x: 48 + col * 220, y: 210 + row * 70, w: 200, h: 44 };
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
        // Auto-advance to next empty slot
        if (!selected) {
          const next = this.slots.findIndex((id) => id == null);
          if (next >= 0) this.activeSlot = next;
        }
      }
    });

    if (candidates.length === 0) {
      label(ctx, `No fit fighters for ${shortSlotReq(slotReq)}.`, DESIGN_W / 2, 280, {
        align: 'center',
        color: colors.foe,
      });
    }

    const filledCount = this.slots.filter((id) => id != null).length;
    label(ctx, `Filled ${filledCount} / ${offer.teamSize}`, 24, 430, { variant: 'meta' });

    if (button(ctx, { x: 24, y: DESIGN_H - 52, w: 100, h: 36 }, 'Back', input.pointer)) {
      this.synth.play('ui');
      action = { type: 'BACK' };
    }

    const ready =
      this.slots.every((id) => id != null) && state.denarii >= offer.entryFee && offer.eligible;
    if (
      button(ctx, { x: DESIGN_W - 160, y: DESIGN_H - 52, w: 136, h: 36 }, 'Enter Arena', input.pointer, {
        disabled: !ready,
      })
    ) {
      this.synth.play('ui');
      action = { type: 'FIGHT', lineupIds: this.slots as number[] };
    }

    return action;
  }
}
