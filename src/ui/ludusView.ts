import { ARMATURAE } from '../content/armatura';
import { economy } from '../content/economy';
import { ORIGINS, TRAITS } from '../content/identity';
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
import type { BodyInjury, SeasonState } from '../domain/campaign/types';
import { btn, clear, el } from './dom';

/** Read helpers supplied by SeasonController — keeps campaign imports out of the view. */
export type LudusQueries = {
  upkeepCost(): number;
  fightableCount(): number;
  rosterCap(): number;
  medicusCost(tier: MedicusTier): number;
  injuryLabel(inj: BodyInjury): string;
};

export type LudusAction =
  | { type: 'NONE' }
  | { type: 'INSTANT_MATCH' }
  | { type: 'MUNERA' }
  | { type: 'WATCH_SLATE'; boutId: string }
  | { type: 'END_DAY' }
  | { type: 'TITLE' }
  | { type: 'REST' }
  | { type: 'ASSIGN'; id: number; assignment: DayAssignment }
  | { type: 'MEDICUS'; id: number; tier: MedicusTier }
  | { type: 'RELEASE'; id: number }
  | { type: 'BUY_RECRUIT'; offerId: string }
  | { type: 'SET_DOCTRINA'; doctrina: DoctrinaId }
  | { type: 'BUY_FACILITY'; kind: FacilityId }
  | { type: 'UPGRADE_GEAR'; id: number };

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
  private queries: LudusQueries | null = null;

  constructor(private readonly onUi: () => void) {
    this.root = el('div', { className: 'screen ludus-screen is-hidden' });
  }

  mount(host: HTMLElement): void {
    host.append(this.root);
  }

  show(visible: boolean, state?: SeasonState | null, queries?: LudusQueries | null): void {
    this.root.classList.toggle('is-hidden', !visible);
    if (visible && state) {
      this.state = state;
      if (queries) this.queries = queries;
      this.render();
    }
  }

  /** Re-render if visible (after mutations). */
  refresh(state: SeasonState, queries?: LudusQueries | null): void {
    this.state = state;
    if (queries) this.queries = queries;
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

  private q(): LudusQueries {
    return this.queries!;
  }

  private render(): void {
    const state = this.state!;
    const q = this.q();
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
        text: `${state.denarii}d · ${state.virtus}v · upkeep ${q.upkeepCost()}`,
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

    const fit = q.fightableCount();
    const contract = state.contracts.find((c) => !c.completed && !c.failed);
    this.root.append(
      el('p', {
        className: 'meta',
        text:
          `${fit} fit · cap ${q.rosterCap()} · rest ${state.restDaysLeft}` +
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
        onClick: () => this.emit({ type: 'REST' }),
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
    const q = this.q();
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
      const origin = ORIGINS[g.origin]?.name ?? '';
      const traits = (g.traits ?? []).map((t) => TRAITS[t].name).slice(0, 2).join('/');
      chip.append(
        el('span', {
          className: 'tag',
          text: `${tag} · ${ARMATURAE[g.armatura].short} · ${origin}`,
        }),
      );
      chip.append(
        el('span', {
          className: 'tag',
          text: `${traits || TEMPERAMENTS[g.temperament].name} · morale ${Math.round(g.morale ?? 50)} · ${g.wins}W-${g.losses}L`,
        }),
      );
      if (g.injuries?.length) {
        chip.append(
          el('span', {
            className: 'tag',
            text: g.injuries.map((inj) => q.injuryLabel(inj)).slice(0, 2).join(', '),
          }),
        );
      }
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
        text: `${sel.name} · ${ORIGINS[sel.origin]?.name ?? ''} · ${GRADE_LABEL[sel.grade]} · ${sel.age}y · kit ${sel.gearGrade} · fat ${sel.fatigue} · conf ${Math.round(sel.confidence ?? 50)}`,
      }),
    );
    if (sel.history?.length) {
      detail.append(
        el('p', {
          className: 'meta',
          text: sel.history[sel.history.length - 1]!.text,
        }),
      );
    }
    const aRow = el('div', { className: 'row-btns' });
    for (const a of ASSIGNMENTS) {
      aRow.append(
        btn(a.label, {
          active: sel.assignment === a.id,
          disabled: state.dayResolved,
          onClick: () => this.emit({ type: 'ASSIGN', id: sel.id, assignment: a.id }),
        }),
      );
    }
    detail.append(aRow);

    const care = el('div', { className: 'row-btns' });
    const cares: { tier: MedicusTier; label: string }[] = [
      { tier: 'BANDAGE', label: `Bandage ${q.medicusCost('BANDAGE')}d` },
      { tier: 'PHYSICIAN', label: `Physician ${q.medicusCost('PHYSICIAN')}d` },
    ];
    for (const c of cares) {
      care.append(
        btn(c.label, {
          disabled: state.denarii < q.medicusCost(c.tier) || state.status !== 'ACTIVE',
          onClick: () => this.emit({ type: 'MEDICUS', id: sel.id, tier: c.tier }),
        }),
      );
    }
    care.append(
      btn('Release', {
        onClick: () => this.emit({ type: 'RELEASE', id: sel.id }),
      }),
    );
    detail.append(care);
    body.append(detail);
  }

  private renderMarket(body: HTMLElement, state: SeasonState): void {
    const q = this.q();
    body.append(
      el('p', {
        className: 'meta',
        text: `Roster ${state.roster.filter((g) => !g.retired).length}/${q.rosterCap()}`,
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
            state.roster.filter((g) => !g.retired).length >= q.rosterCap(),
          onClick: () => this.emit({ type: 'BUY_RECRUIT', offerId: m.id }),
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
          onClick: () => this.emit({ type: 'SET_DOCTRINA', doctrina: id as DoctrinaId }),
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
            onClick: () => this.emit({ type: 'BUY_FACILITY', kind: id }),
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
          onClick: () => this.emit({ type: 'UPGRADE_GEAR', id: sel.id }),
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
