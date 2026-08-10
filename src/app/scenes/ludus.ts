import { ARMATURAE } from '../../content/armatura';
import { economy } from '../../content/economy';
import { colors } from '../../content/palette';
import {
  DOCTRINA_LIST,
  FACILITIES,
  GRADE_LABEL,
  TEMPERAMENTS,
  type DayAssignment,
  type DoctrinaId,
  type FacilityId,
  type MedicusTier,
} from '../../content/rpg';
import { buyFacility, applyMedicus, medicusCost, upgradeGear } from '../../domain/campaign/facilities';
import { currentRosterCap, fightableRoster, setDoctrina, takeRestDay, upkeepCost } from '../../domain/campaign/season';
import { setGladiatorAssignment } from '../../domain/campaign/ludusDay';
import { buyRecruit, releaseGladiator } from '../../domain/campaign/market';
import type { SeasonState } from '../../domain/campaign/types';
import type { Input } from '../../shell/input';
import { getDesign } from '../../shell/canvas';
import type { Synth } from '../../view/audio';
import { buttonRow, flowHeaderLayout, isPortrait } from '../../view/layout';
import { button, label, panel, rosterChip, shellAtmosphere } from '../../view/ui';
import { space, touchTarget, typeScale } from '../../view/theme';

export type LudusAction =
  | { type: 'NONE' }
  | { type: 'INSTANT_MATCH' }
  | { type: 'MUNERA' }
  | { type: 'WATCH_SLATE'; boutId: string }
  | { type: 'END_DAY' }
  | { type: 'TITLE' }
  | { type: 'CHANGED' }
  | { type: 'RESTED' };

const ASSIGNMENTS: { id: DayAssignment; label: string }[] = [
  { id: 'NONE', label: 'Idle' },
  { id: 'TRAIN', label: 'Train' },
  { id: 'RECOVER', label: 'Recover' },
  { id: 'SPAR', label: 'Spar' },
  { id: 'REST', label: 'Rest' },
];

export class LudusScene {
  private selectedId: number | null = null;
  private tab: 'roster' | 'market' | 'school' = 'roster';

  constructor(private readonly synth: Synth) {}

  draw(ctx: CanvasRenderingContext2D, input: Input, state: SeasonState): LudusAction {
    const { w, h } = getDesign();
    const hdr = flowHeaderLayout(w, h);
    const pad = hdr.pad;
    const portrait = isPortrait(w, h);

    shellAtmosphere(ctx, w, h);

    label(ctx, 'LUDUS', pad, hdr.titleY, { size: typeScale.display, color: colors.parchment });
    label(ctx, `Season ${state.seasonIndex} · Day ${state.day} / ${economy.seasonDays}`, pad, hdr.metaY, {
      variant: 'eyebrow',
    });

    const money = `${state.denarii}d · ${state.virtus}v · upkeep ${upkeepCost(state)}`;
    if (portrait) {
      label(ctx, money, pad, hdr.rightTitleY, { size: typeScale.body, color: colors.parchment });
    } else {
      label(ctx, money, w - pad, hdr.rightTitleY, {
        align: 'right',
        size: typeScale.title,
        color: colors.parchment,
      });
    }

    let action: LudusAction = { type: 'NONE' };
    const tabY = portrait ? hdr.rightTitleY + 22 : 72;
    const tabs = buttonRow(pad, tabY, w - pad * 2, touchTarget - 4, 3, space.sm);
    const tabDefs: { id: 'roster' | 'market' | 'school'; label: string }[] = [
      { id: 'roster', label: 'Roster' },
      { id: 'market', label: 'Market' },
      { id: 'school', label: 'School' },
    ];
    tabDefs.forEach((t, i) => {
      if (button(ctx, tabs[i]!, t.label, input.pointer, { active: this.tab === t.id })) {
        this.tab = t.id;
        this.synth.play('ui');
      }
    });

    const bodyTop = tabY + touchTarget + 4;
    // Portrait: tighter footer so slate/roster claim the middle
    const bodyH = h - bodyTop - (portrait ? 156 : 120);

    if (this.tab === 'roster') {
      action = this.drawRoster(ctx, input, state, pad, bodyTop, w, bodyH, portrait) ?? action;
    } else if (this.tab === 'market') {
      action = this.drawMarket(ctx, input, state, pad, bodyTop, w, bodyH) ?? action;
    } else {
      action = this.drawSchool(ctx, input, state, pad, bodyTop, w, bodyH) ?? action;
    }

    const by = h - (portrait ? 148 : 108);
    const btnH = portrait ? touchTarget - 4 : touchTarget;
    if (portrait) {
      const row1 = buttonRow(pad, by, w - pad * 2, btnH, 2, space.sm);
      if (
        button(ctx, row1[0]!, 'Board', input.pointer, {
          disabled: state.dayResolved || state.status !== 'ACTIVE',
        })
      ) {
        this.synth.play('ui');
        action = { type: 'MUNERA' };
      }
      if (
        button(ctx, row1[1]!, 'Rest Day', input.pointer, {
          disabled: state.dayResolved || state.restDaysLeft <= 0 || state.status !== 'ACTIVE',
        })
      ) {
        if (takeRestDay(state)) {
          this.synth.play('ui');
          action = { type: 'RESTED' };
        }
      }
      const row2 = buttonRow(pad, by + btnH + space.sm, w - pad * 2, btnH, 2, space.sm);
      if (
        button(ctx, row2[0]!, 'End Day', input.pointer, {
          disabled: !state.dayResolved || state.status !== 'ACTIVE',
        })
      ) {
        this.synth.play('ui');
        action = { type: 'END_DAY' };
      }
      if (button(ctx, row2[1]!, 'Instant Match', input.pointer)) {
        this.synth.play('ui');
        action = { type: 'INSTANT_MATCH' };
      }
    } else {
      if (
        button(ctx, { x: pad, y: by, w: 150, h: btnH }, 'Board', input.pointer, {
          disabled: state.dayResolved || state.status !== 'ACTIVE',
        })
      ) {
        this.synth.play('ui');
        action = { type: 'MUNERA' };
      }
      if (
        button(ctx, { x: pad + 160, y: by, w: 110, h: btnH }, 'Rest Day', input.pointer, {
          disabled: state.dayResolved || state.restDaysLeft <= 0 || state.status !== 'ACTIVE',
        })
      ) {
        if (takeRestDay(state)) {
          this.synth.play('ui');
          action = { type: 'RESTED' };
        }
      }
      if (
        button(ctx, { x: pad + 280, y: by, w: 110, h: btnH }, 'End Day', input.pointer, {
          disabled: !state.dayResolved || state.status !== 'ACTIVE',
        })
      ) {
        this.synth.play('ui');
        action = { type: 'END_DAY' };
      }
      if (button(ctx, { x: pad + 400, y: by, w: 130, h: btnH }, 'Instant Match', input.pointer)) {
        this.synth.play('ui');
        action = { type: 'INSTANT_MATCH' };
      }
    }

    if (button(ctx, { x: w - pad - 72, y: hdr.titleY - 10, w: 72, h: 36 }, '←', input.pointer)) {
      this.synth.play('ui');
      action = { type: 'TITLE' };
    }

    const fit = fightableRoster(state).length;
    const contract = state.contracts.find((c) => !c.completed && !c.failed);
    label(
      ctx,
      `${fit} fit · cap ${currentRosterCap(state)} · rest ${state.restDaysLeft}` +
        (contract ? ` · ${contract.name} (${contract.daysLeft}d)` : ''),
      pad,
      by - 14,
      { variant: 'meta' },
    );

    return action;
  }

  private drawRoster(
    ctx: CanvasRenderingContext2D,
    input: Input,
    state: SeasonState,
    pad: number,
    top: number,
    w: number,
    bodyH: number,
    portrait: boolean,
  ): LudusAction | null {
    let action: LudusAction | null = null;
    panel(ctx, { x: pad, y: top, w: w - pad * 2, h: bodyH }, 'Today');

    // Living slate — packed rows (no giant empty band)
    const slate = state.slate ?? [];
    const pending = slate.filter((b) => b.status === 'pending');
    let y = top + 26;
    if (pending.length && !state.dayResolved) {
      label(ctx, 'Slate — watch one', pad + 12, y, { size: typeScale.meta, color: colors.muted });
      y += 12;
      for (const bout of pending) {
        const rowH = portrait ? 40 : 44;
        const row = {
          x: pad + 10,
          y,
          w: w - pad * 2 - 20,
          h: rowH,
        };
        if (row.y + row.h > top + bodyH * 0.42) break;
        const names = bout.schoolIds
          .map((id) => state.roster.find((g) => g.id === id)?.name ?? '?')
          .join(', ');
        label(ctx, bout.name, row.x + 8, row.y + 14, { size: typeScale.label });
        label(
          ctx,
          `${names} · ${bout.kind === 'venatio' ? 'beasts' : 'rivals'} · ${bout.purse}d`,
          row.x + 8,
          row.y + 30,
          { size: typeScale.eyebrow, color: colors.muted },
        );
        const watchW = portrait ? 68 : 84;
        if (
          button(
            ctx,
            { x: row.x + row.w - watchW - 2, y: row.y + 4, w: watchW, h: rowH - 8 },
            'Watch',
            input.pointer,
            { size: typeScale.meta },
          )
        ) {
          this.synth.play('ui');
          action = { type: 'WATCH_SLATE', boutId: bout.id };
        }
        y += rowH + 4;
      }
    } else if (state.pendingNotes?.length) {
      label(ctx, state.pendingNotes[0]!, pad + 12, y + 4, {
        size: typeScale.meta,
        color: colors.muted,
      });
      y += 22;
    }

    const rosterTop = y + 6;
    label(ctx, 'Familia', pad + 12, rosterTop, { size: typeScale.meta, color: colors.muted });

    const chipW = portrait ? Math.min(148, (w - pad * 2 - 20) / 2) : 140;
    const chipH = portrait ? touchTarget - 4 : touchTarget;
    const gap = 6;
    const cols = Math.max(1, Math.floor((w - pad * 2 - 20 + gap) / (chipW + gap)));
    const active = state.roster.filter((g) => !g.retired);
    const chipsTop = rosterTop + 14;

    active.forEach((g, i) => {
      const row = Math.floor(i / cols);
      const col = i % cols;
      const r = {
        x: pad + 12 + col * (chipW + gap),
        y: chipsTop + row * (chipH + gap + (portrait ? 28 : 34)),
        w: chipW,
        h: chipH,
      };
      if (r.y + r.h > top + bodyH - (portrait ? 100 : 88)) return;
      const tag =
        g.injury === 'SEVERE' ? 'OUT' : g.injury === 'LIGHT' ? 'Hurt' : GRADE_LABEL[g.grade].slice(0, 4);
      if (
        rosterChip(ctx, r, input.pointer, {
          name: g.name,
          tag,
          team: 0,
          hpRatio: g.hpRatio,
          selected: this.selectedId === g.id,
          muted: g.injury === 'SEVERE',
        })
      ) {
        this.selectedId = this.selectedId === g.id ? null : g.id;
        this.synth.play('ui');
      }
      label(
        ctx,
        `${ARMATURAE[g.armatura].short} · ${g.age}y · ${g.assignment === 'NONE' ? '—' : g.assignment}`,
        r.x + r.w / 2,
        r.y + r.h + 12,
        { size: typeScale.eyebrow, align: 'center', color: colors.muted },
      );
      label(
        ctx,
        `${g.wins}W-${g.losses}L · xp ${g.xp}`,
        r.x + r.w / 2,
        r.y + r.h + 26,
        { size: typeScale.eyebrow, align: 'center', color: colors.muted },
      );
    });

    const sel = active.find((g) => g.id === this.selectedId);
    if (sel) {
      const detailY = top + bodyH - (portrait ? 118 : 96);
      label(
        ctx,
        `${sel.name} · ${GRADE_LABEL[sel.grade]} · ${sel.age}y · kit ${sel.gearGrade} · fat ${sel.fatigue}`,
        pad + 12,
        detailY,
        { size: typeScale.meta },
      );
      const aRow = buttonRow(pad + 8, detailY + 10, w - pad * 2 - 16, 34, 5, 4);
      ASSIGNMENTS.forEach((a, i) => {
        if (
          button(ctx, aRow[i]!, a.label, input.pointer, {
            active: sel.assignment === a.id,
            disabled: state.dayResolved,
            size: typeScale.eyebrow,
          })
        ) {
          if (setGladiatorAssignment(state, sel.id, a.id)) {
            this.synth.play('ui');
            action = { type: 'CHANGED' };
          }
        }
      });
      const careY = detailY + 50;
      const cares: { tier: MedicusTier; label: string }[] = [
        { tier: 'BANDAGE', label: `Bandage ${medicusCost(state, 'BANDAGE')}d` },
        { tier: 'PHYSICIAN', label: `Physician ${medicusCost(state, 'PHYSICIAN')}d` },
      ];
      const cRow = buttonRow(pad + 8, careY, Math.min(420, w - pad * 2 - 16), 34, 2, 6);
      cares.forEach((c, i) => {
        if (
          button(ctx, cRow[i]!, c.label, input.pointer, {
            disabled: state.denarii < medicusCost(state, c.tier) || state.status !== 'ACTIVE',
            size: typeScale.eyebrow,
          })
        ) {
          if (applyMedicus(state, sel.id, c.tier)) {
            this.synth.play('ui');
            action = { type: 'CHANGED' };
          }
        }
      });
      if (
        button(
          ctx,
          { x: pad + 8 + Math.min(420, w - pad * 2 - 16) + 8, y: careY, w: 88, h: 34 },
          'Release',
          input.pointer,
          { size: typeScale.eyebrow },
        )
      ) {
        if (releaseGladiator(state, sel.id)) {
          this.selectedId = null;
          this.synth.play('ui');
          action = { type: 'CHANGED' };
        }
      }
    }
    return action;
  }

  private drawMarket(
    ctx: CanvasRenderingContext2D,
    input: Input,
    state: SeasonState,
    pad: number,
    top: number,
    w: number,
    bodyH: number,
  ): LudusAction | null {
    let action: LudusAction | null = null;
    panel(ctx, { x: pad, y: top, w: w - pad * 2, h: bodyH }, 'Day market');
    label(
      ctx,
      `Roster ${state.roster.filter((g) => !g.retired).length}/${currentRosterCap(state)}`,
      pad + 16,
      top + 36,
      { variant: 'meta' },
    );

    if (state.market.length === 0) {
      label(ctx, 'No bodies for sale today.', w / 2, top + bodyH / 2, {
        align: 'center',
        color: colors.muted,
      });
      return null;
    }

    state.market.forEach((m, i) => {
      const y = top + 56 + i * 58;
      if (y > top + bodyH - 50) return;
      label(
        ctx,
        `${m.name} · ${ARMATURAE[m.armatura].name} · ${GRADE_LABEL[m.grade]} · ${TEMPERAMENTS[m.temperament].name}`,
        pad + 16,
        y,
        { size: typeScale.body },
      );
      if (
        button(ctx, { x: w - pad - 120, y: y - 8, w: 104, h: 36 }, `${m.price}d`, input.pointer, {
          disabled:
            state.denarii < m.price ||
            state.roster.filter((g) => !g.retired).length >= currentRosterCap(state),
        })
      ) {
        if (buyRecruit(state, m.id)) {
          this.synth.play('ui');
          action = { type: 'CHANGED' };
        }
      }
    });
    return action;
  }

  private drawSchool(
    ctx: CanvasRenderingContext2D,
    input: Input,
    state: SeasonState,
    pad: number,
    top: number,
    w: number,
    bodyH: number,
  ): LudusAction | null {
    let action: LudusAction | null = null;
    panel(ctx, { x: pad, y: top, w: w - pad * 2, h: bodyH }, 'School & doctrina');

    label(ctx, 'Doctrina (pre-fight stance)', pad + 16, top + 40, { size: typeScale.label });
    const dRow = buttonRow(pad + 12, top + 52, Math.min(480, w - pad * 2 - 24), 38, 3, 6);
    DOCTRINA_LIST.forEach((id, i) => {
      if (
        button(ctx, dRow[i]!, id, input.pointer, {
          active: state.doctrina === id,
        })
      ) {
        setDoctrina(state, id as DoctrinaId);
        this.synth.play('ui');
        action = { type: 'CHANGED' };
      }
    });

    label(ctx, 'Facilities', pad + 16, top + 110, { size: typeScale.label });
    const ids = Object.keys(FACILITIES) as FacilityId[];
    ids.forEach((id, i) => {
      const def = FACILITIES[id];
      const owned = state.facilities.includes(id);
      const y = top + 128 + i * 44;
      if (y > top + bodyH - 80) return;
      label(
        ctx,
        `${def.name} — ${def.blurb}${owned ? ' (owned)' : ` · ${def.cost}d`}`,
        pad + 16,
        y + 10,
        { size: typeScale.meta, color: owned ? colors.hp : colors.muted },
      );
      if (!owned) {
        if (
          button(ctx, { x: w - pad - 100, y: y, w: 88, h: 36 }, 'Build', input.pointer, {
            disabled: state.denarii < def.cost || state.virtus < def.virtusReq,
            size: typeScale.eyebrow,
          })
        ) {
          if (buyFacility(state, id)) {
            this.synth.play('ui');
            action = { type: 'CHANGED' };
          }
        }
      }
    });

    const sel = state.roster.find((g) => g.id === this.selectedId && !g.retired);
    if (sel && state.facilities.includes('ARMAMENTARIUM')) {
      const y = top + bodyH - 48;
      if (
        button(
          ctx,
          { x: pad + 16, y, w: 200, h: 40 },
          `Upgrade ${sel.name}'s kit`,
          input.pointer,
          { disabled: sel.gearGrade >= 2, size: typeScale.meta },
        )
      ) {
        if (upgradeGear(state, sel.id)) {
          this.synth.play('ui');
          action = { type: 'CHANGED' };
        }
      }
    } else {
      label(ctx, 'Select a roster fighter, then upgrade kit here (needs Armamentarium).', pad + 16, top + bodyH - 28, {
        size: typeScale.eyebrow,
        color: colors.muted,
      });
    }

    return action;
  }
}
