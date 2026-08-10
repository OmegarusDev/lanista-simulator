import { ARMATURAE } from '../content/armatura';
import { economy } from '../content/economy';
import {
  DOCTRINA_LIST,
  FACILITIES,
  GRADE_LABEL,
  TEMPERAMENTS,
  type DayAssignment,
  type DoctrinaId,
  type FacilityId,
  type MedicusTier,
} from '../content/rpg';
import { buyFacility, applyMedicus, medicusCost, upgradeGear } from '../domain/campaign/facilities';
import {
  currentRosterCap,
  fightableRoster,
  setDoctrina,
  takeRestDay,
  upkeepCost,
} from '../domain/campaign/season';
import { setGladiatorAssignment } from '../domain/campaign/ludusDay';
import { buyRecruit, releaseGladiator } from '../domain/campaign/market';
import type { SeasonState } from '../domain/campaign/types';
import { btn, clear, el } from './dom';

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

export class LudusView {
  readonly root: HTMLElement;
  private pending: LudusAction = { type: 'NONE' };
  private selectedId: number | null = null;
  private tab: 'roster' | 'market' | 'school' = 'roster';
  private state: SeasonState | null = null;

  constructor(private readonly onUi: () => void) {
    this.root = el('div', { className: 'screen ludus-screen is-hidden' });
  }

  mount(host: HTMLElement): void {
    host.append(this.root);
  }

  show(visible: boolean, state?: SeasonState | null): void {
    this.root.classList.toggle('is-hidden', !visible);
    if (visible && state) {
      this.state = state;
      this.render();
    }
  }

  /** Re-render if visible (after CHANGED mutations). */
  refresh(state: SeasonState): void {
    this.state = state;
    if (!this.root.classList.contains('is-hidden')) this.render();
  }

  poll(): LudusAction {
    const a = this.pending;
    this.pending = { type: 'NONE' };
    return a;
  }

  private emit(action: LudusAction): void {
    this.onUi();
    this.pending = action;
  }

  private render(): void {
    const state = this.state!;
    clear(this.root);

    const hdr = el('div', { className: 'screen-header' });
    const left = el('div');
    left.append(el('h1', { text: 'LUDUS' }));
    left.append(
      el('div', {
        className: 'eyebrow',
        text: `Season ${state.seasonIndex} · Day ${state.day} / ${economy.seasonDays}`,
      }),
    );
    left.append(
      el('div', {
        className: 'meta',
        text: `${state.denarii}d · ${state.virtus}v · upkeep ${upkeepCost(state)}`,
      }),
    );
    hdr.append(left);
    hdr.append(btn('←', { className: 'ghost', onClick: () => this.emit({ type: 'TITLE' }) }));
    this.root.append(hdr);

    const tabs = el('div', { className: 'tabs' });
    (
      [
        ['roster', 'Roster'],
        ['market', 'Market'],
        ['school', 'School'],
      ] as const
    ).forEach(([id, lab]) => {
      tabs.append(
        btn(lab, {
          active: this.tab === id,
          onClick: () => {
            this.tab = id;
            this.onUi();
            this.render();
          },
        }),
      );
    });
    this.root.append(tabs);

    const body = el('div', { className: 'body-scroll' });
    if (this.tab === 'roster') this.renderRoster(body, state);
    else if (this.tab === 'market') this.renderMarket(body, state);
    else this.renderSchool(body, state);
    this.root.append(body);

    const fit = fightableRoster(state).length;
    const contract = state.contracts.find((c) => !c.completed && !c.failed);
    this.root.append(
      el('p', {
        className: 'meta',
        text:
          `${fit} fit · cap ${currentRosterCap(state)} · rest ${state.restDaysLeft}` +
          (contract ? ` · ${contract.name} (${contract.daysLeft}d)` : ''),
      }),
    );

    const foot = el('div', { className: 'footer-actions' });
    foot.append(
      btn('Board', {
        disabled: state.dayResolved || state.status !== 'ACTIVE',
        onClick: () => this.emit({ type: 'MUNERA' }),
      }),
      btn('Rest Day', {
        disabled: state.dayResolved || state.restDaysLeft <= 0 || state.status !== 'ACTIVE',
        onClick: () => {
          if (takeRestDay(state)) this.emit({ type: 'RESTED' });
        },
      }),
      btn('End Day', {
        disabled: !state.dayResolved || state.status !== 'ACTIVE',
        onClick: () => this.emit({ type: 'END_DAY' }),
      }),
      btn('Practice', {
        onClick: () => this.emit({ type: 'INSTANT_MATCH' }),
      }),
    );
    this.root.append(foot);
  }

  private renderRoster(body: HTMLElement, state: SeasonState): void {
    const slate = state.slate ?? [];
    const pending = slate.filter((b) => b.status === 'pending');
    if (pending.length && !state.dayResolved) {
      body.append(el('p', { className: 'meta', text: 'Slate — watch one' }));
      for (const bout of pending) {
        const row = el('div', { className: 'list-row' });
        const copy = el('div', { className: 'copy' });
        const names = bout.schoolIds
          .map((id) => state.roster.find((g) => g.id === id)?.name ?? '?')
          .join(', ');
        copy.append(el('h3', { text: bout.name }));
        copy.append(
          el('div', {
            className: 'eyebrow',
            text: `${names} · ${bout.kind === 'venatio' ? 'beasts' : 'rivals'} · ${bout.purse}d`,
          }),
        );
        row.append(copy);
        row.append(
          btn('Watch', {
            onClick: () => this.emit({ type: 'WATCH_SLATE', boutId: bout.id }),
          }),
        );
        body.append(row);
      }
    } else if (state.pendingNotes?.length) {
      body.append(el('p', { className: 'meta', text: state.pendingNotes[0]! }));
    }

    body.append(el('p', { className: 'meta', text: 'Familia' }));
    const grid = el('div', { className: 'chip-grid' });
    const active = state.roster.filter((g) => !g.retired);
    for (const g of active) {
      const tag =
        g.injury === 'SEVERE' ? 'OUT' : g.injury === 'LIGHT' ? 'Hurt' : GRADE_LABEL[g.grade].slice(0, 4);
      const chip = el('button', {
        className: `chip${this.selectedId === g.id ? ' is-selected' : ''}${g.injury === 'SEVERE' ? ' is-muted' : ''}`,
      });
      chip.append(el('span', { className: 'name', text: g.name }));
      chip.append(
        el('span', {
          className: 'tag',
          text: `${tag} · ${ARMATURAE[g.armatura].short} · ${g.assignment === 'NONE' ? '—' : g.assignment}`,
        }),
      );
      chip.append(
        el('span', {
          className: 'tag',
          text: `${g.wins}W-${g.losses}L · xp ${g.xp} · ${g.age}y`,
        }),
      );
      const bar = el('div', { className: 'hp-bar' });
      bar.append(el('span', { attrs: { style: `width:${Math.round(g.hpRatio * 100)}%` } }));
      chip.append(bar);
      chip.addEventListener('click', () => {
        this.selectedId = this.selectedId === g.id ? null : g.id;
        this.onUi();
        this.render();
      });
      grid.append(chip);
    }
    body.append(grid);

    const sel = active.find((g) => g.id === this.selectedId);
    if (!sel) return;

    const detail = el('div', { className: 'detail-strip' });
    detail.append(
      el('p', {
        text: `${sel.name} · ${GRADE_LABEL[sel.grade]} · ${sel.age}y · kit ${sel.gearGrade} · fat ${sel.fatigue}`,
      }),
    );
    const aRow = el('div', { className: 'row-btns' });
    for (const a of ASSIGNMENTS) {
      aRow.append(
        btn(a.label, {
          active: sel.assignment === a.id,
          disabled: state.dayResolved,
          onClick: () => {
            if (setGladiatorAssignment(state, sel.id, a.id)) this.emit({ type: 'CHANGED' });
          },
        }),
      );
    }
    detail.append(aRow);

    const care = el('div', { className: 'row-btns' });
    const cares: { tier: MedicusTier; label: string }[] = [
      { tier: 'BANDAGE', label: `Bandage ${medicusCost(state, 'BANDAGE')}d` },
      { tier: 'PHYSICIAN', label: `Physician ${medicusCost(state, 'PHYSICIAN')}d` },
    ];
    for (const c of cares) {
      care.append(
        btn(c.label, {
          disabled: state.denarii < medicusCost(state, c.tier) || state.status !== 'ACTIVE',
          onClick: () => {
            if (applyMedicus(state, sel.id, c.tier)) this.emit({ type: 'CHANGED' });
          },
        }),
      );
    }
    care.append(
      btn('Release', {
        onClick: () => {
          if (releaseGladiator(state, sel.id)) {
            this.selectedId = null;
            this.emit({ type: 'CHANGED' });
          }
        },
      }),
    );
    detail.append(care);
    body.append(detail);
  }

  private renderMarket(body: HTMLElement, state: SeasonState): void {
    body.append(
      el('p', {
        className: 'meta',
        text: `Roster ${state.roster.filter((g) => !g.retired).length}/${currentRosterCap(state)}`,
      }),
    );
    if (state.market.length === 0) {
      body.append(el('p', { className: 'meta', text: 'No bodies for sale today.' }));
      return;
    }
    for (const m of state.market) {
      const row = el('div', { className: 'list-row' });
      const copy = el('div', { className: 'copy' });
      copy.append(
        el('h3', {
          text: `${m.name} · ${ARMATURAE[m.armatura].name}`,
        }),
      );
      copy.append(
        el('div', {
          className: 'eyebrow',
          text: `${GRADE_LABEL[m.grade]} · ${TEMPERAMENTS[m.temperament].name}`,
        }),
      );
      row.append(copy);
      row.append(
        btn(`${m.price}d`, {
          disabled:
            state.denarii < m.price ||
            state.roster.filter((g) => !g.retired).length >= currentRosterCap(state),
          onClick: () => {
            if (buyRecruit(state, m.id)) this.emit({ type: 'CHANGED' });
          },
        }),
      );
      body.append(row);
    }
  }

  private renderSchool(body: HTMLElement, state: SeasonState): void {
    body.append(el('p', { text: 'Doctrina (pre-fight stance)' }));
    const dRow = el('div', { className: 'row-btns' });
    for (const id of DOCTRINA_LIST) {
      dRow.append(
        btn(id, {
          active: state.doctrina === id,
          onClick: () => {
            setDoctrina(state, id as DoctrinaId);
            this.emit({ type: 'CHANGED' });
          },
        }),
      );
    }
    body.append(dRow);

    body.append(el('p', { text: 'Facilities' }));
    const ids = Object.keys(FACILITIES) as FacilityId[];
    for (const id of ids) {
      const def = FACILITIES[id];
      const owned = state.facilities.includes(id);
      const row = el('div', { className: 'list-row' });
      const copy = el('div', { className: 'copy' });
      copy.append(el('h3', { text: def.name }));
      copy.append(
        el('div', {
          className: 'meta',
          text: `${def.blurb}${owned ? ' (owned)' : ` · ${def.cost}d`}`,
        }),
      );
      row.append(copy);
      if (!owned) {
        row.append(
          btn('Build', {
            disabled: state.denarii < def.cost || state.virtus < def.virtusReq,
            onClick: () => {
              if (buyFacility(state, id)) this.emit({ type: 'CHANGED' });
            },
          }),
        );
      }
      body.append(row);
    }

    const sel = state.roster.find((g) => g.id === this.selectedId && !g.retired);
    if (sel && state.facilities.includes('ARMAMENTARIUM')) {
      body.append(
        btn(`Upgrade ${sel.name}'s kit`, {
          disabled: sel.gearGrade >= 2,
          onClick: () => {
            if (upgradeGear(state, sel.id)) this.emit({ type: 'CHANGED' });
          },
        }),
      );
    } else {
      body.append(
        el('p', {
          className: 'eyebrow',
          text: 'Select a roster fighter, then upgrade kit here (needs Armamentarium).',
        }),
      );
    }
  }
}
