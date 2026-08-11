import { ARMATURAE } from '../content/armatura';
import { economy } from '../content/economy';
import { ORIGINS, TRAITS, type TraitId } from '../content/identity';
import {
  ARMATURA_LOADOUTS,
  KIT_PARTS,
  loadoutPartIds,
  type KitSlot,
} from '../content/kitPieces';
import {
  DOCTRINA,
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
  | { type: 'UPGRADE_GEAR'; id: number }
  | { type: 'EQUIP_PART'; id: number; slot: KitSlot; partId: string };

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

  getSelectedId(): number | null {
    return this.selectedId;
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
    left.append(el('h1', { text: 'Ludus' }));
    const vitals = el('div', { className: 'vitals' });
    vitals.append(
      el('span', {
        className: 'vital',
        text: `Day ${state.day}/${economy.seasonDays}`,
      }),
    );
    vitals.append(el('span', { className: 'vital', text: `${state.denarii}d` }));
    vitals.append(el('span', { className: 'vital-sub', text: `${state.virtus} virtus` }));
    left.append(vitals);
    const contract = state.contracts.find((c) => !c.completed && !c.failed);
    const statusBits = [
      `${q.fightableCount()} fit`,
      state.restDaysLeft > 0 ? `${state.restDaysLeft} rest` : null,
      contract ? `${contract.name} · ${contract.daysLeft}d` : null,
    ].filter(Boolean);
    if (statusBits.length) {
      left.append(el('div', { className: 'eyebrow', text: statusBits.join(' · ') }));
    }
    hdr.append(left);
    hdr.append(btn('Title', { className: 'ghost', onClick: () => this.emit({ type: 'TITLE' }) }));
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

    const foot = el('div', { className: 'footer-actions' });
    const dayOpen = !state.dayResolved && state.status === 'ACTIVE';
    const dayDone = state.dayResolved && state.status === 'ACTIVE';

    if (dayDone) {
      foot.append(
        btn('End Day', {
          className: 'cta',
          onClick: () => this.emit({ type: 'END_DAY' }),
        }),
      );
    } else {
      foot.append(
        btn('Munera Board', {
          className: 'cta',
          disabled: !dayOpen,
          onClick: () => this.emit({ type: 'MUNERA' }),
        }),
      );
      foot.append(
        btn('Rest Day', {
          disabled: !dayOpen || state.restDaysLeft <= 0,
          onClick: () => this.emit({ type: 'REST' }),
        }),
      );
    }
    foot.append(
      btn('Practice', {
        className: 'quiet',
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
      body.append(el('p', { className: 'section-label', text: 'Today’s slate' }));
      for (const bout of pending) {
        const row = el('div', { className: 'list-row' });
        const copy = el('div', { className: 'copy' });
        const names = bout.schoolIds
          .map((id) => state.roster.find((g) => g.id === id)?.name ?? '?')
          .join(', ');
        copy.append(el('h3', { text: bout.name }));
        copy.append(
          el('div', {
            className: 'meta',
            text: `${names} · ${bout.kind === 'venatio' ? 'venatio' : 'match'} · ${bout.purse}d`,
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

    body.append(el('p', { className: 'section-label', text: 'Familia' }));
    const grid = el('div', { className: 'chip-grid' });
    const active = state.roster.filter((g) => !g.retired);
    for (const g of active) {
      const status =
        g.injury === 'SEVERE' ? 'Out' : g.injury === 'LIGHT' ? 'Hurt' : GRADE_LABEL[g.grade];
      const chip = el('button', {
        className: `chip${this.selectedId === g.id ? ' is-selected' : ''}${g.injury === 'SEVERE' ? ' is-muted' : ''}`,
      });
      chip.append(el('span', { className: 'name', text: g.name }));
      chip.append(
        el('span', {
          className: 'tag',
          text: `${status} · ${ARMATURAE[g.armatura].short}`,
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
    detail.append(el('p', { className: 'detail-title', text: sel.name }));
    const origin = ORIGINS[sel.origin]?.name ?? '';
    const traits = (sel.traits ?? [])
      .slice(0, 2)
      .map((t: TraitId) => TRAITS[t].name)
      .join(' · ');
    const bits = [
      origin,
      GRADE_LABEL[sel.grade],
      `${sel.age}y`,
      TEMPERAMENTS[sel.temperament].name,
      traits || null,
      sel.injuries?.length
        ? sel.injuries.map((inj) => q.injuryLabel(inj)).slice(0, 2).join(', ')
        : null,
      `${sel.wins}W-${sel.losses}L`,
    ].filter(Boolean);
    detail.append(el('p', { className: 'detail-meta', text: bits.join(' · ') }));
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
        className: 'quiet',
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
        className: 'section-label',
        text: `Market · ${state.roster.filter((g) => !g.retired).length}/${q.rosterCap()}`,
      }),
    );
    if (state.market.length === 0) {
      body.append(el('p', { className: 'meta', text: 'No recruits for sale today.' }));
      return;
    }
    for (const m of state.market) {
      const row = el('div', { className: 'list-row' });
      const copy = el('div', { className: 'copy' });
      copy.append(el('h3', { text: m.name }));
      copy.append(
        el('div', {
          className: 'meta',
          text: `${ARMATURAE[m.armatura].name} · ${GRADE_LABEL[m.grade]} · ${TEMPERAMENTS[m.temperament].name}`,
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
    const q = this.q();
    body.append(el('p', { className: 'section-label', text: 'Doctrina' }));
    body.append(
      el('p', {
        className: 'meta',
        text: DOCTRINA[state.doctrina].blurb,
      }),
    );
    const dRow = el('div', { className: 'row-btns' });
    for (const id of DOCTRINA_LIST) {
      dRow.append(
        btn(DOCTRINA[id].name, {
          active: state.doctrina === id,
          onClick: () => this.emit({ type: 'SET_DOCTRINA', doctrina: id as DoctrinaId }),
        }),
      );
    }
    body.append(dRow);

    body.append(
      el('p', {
        className: 'section-label',
        text: `Facilities · upkeep ${q.upkeepCost()}d`,
      }),
    );
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
          text: owned ? `${def.blurb} · owned` : `${def.blurb} · ${def.cost}d`,
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
        btn(`Upgrade ${sel.name}'s kit grade`, {
          disabled: sel.gearGrade >= 2,
          onClick: () => this.emit({ type: 'UPGRADE_GEAR', id: sel.id }),
        }),
      );
      body.append(this.renderArmory(sel.id, sel.armatura, sel.partsOverride));
    } else if (state.facilities.includes('ARMAMENTARIUM')) {
      body.append(
        el('p', {
          className: 'eyebrow',
          text: 'Select a roster fighter to open the armory.',
        }),
      );
    }
  }

  private renderArmory(
    gladiatorId: number,
    armatura: import('../content/armatura').ArmaturaId,
    partsOverride?: string[],
  ): HTMLElement {
    const wrap = el('div', { className: 'armory-panel' });
    wrap.append(el('h3', { text: 'Armory' }));
    wrap.append(
      el('p', {
        className: 'meta',
        text: 'Swap pieces — mannequin updates on the sand. Costs 12d per swap.',
      }),
    );
    const stock = loadoutPartIds(ARMATURA_LOADOUTS[armatura]);
    const current = partsOverride?.length ? [...partsOverride] : [...stock];
    const slots: KitSlot[] = ['helm', 'shield', 'weapon', 'greaves', 'manica'];
    for (const slot of slots) {
      const row = el('div', { className: 'list-row armory-row' });
      row.append(el('div', { className: 'eyebrow', text: slot }));
      const options = Object.values(KIT_PARTS).filter((p) => p.slot === slot);
      const select = el('select', { className: 'armory-select' }) as HTMLSelectElement;
      if (slot === 'shield') {
        const none = document.createElement('option');
        none.value = '';
        none.textContent = 'None';
        select.append(none);
      }
      for (const p of options) {
        const opt = document.createElement('option');
        opt.value = p.id;
        opt.textContent = p.name;
        select.append(opt);
      }
      const cur = current.find((id) => KIT_PARTS[id]?.slot === slot) ?? '';
      select.value = cur;
      select.addEventListener('change', () => {
        this.emit({
          type: 'EQUIP_PART',
          id: gladiatorId,
          slot,
          partId: select.value,
        });
      });
      row.append(select);
      wrap.append(row);
    }
    return wrap;
  }
}
