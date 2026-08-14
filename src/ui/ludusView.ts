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
  GRADE_ORDER,
  TEMPERAMENTS,
  type DayAssignment,
  type DoctrinaId,
  type FacilityId,
  type MedicusTier,
} from '../content/rpg';
import { fightersForSlot, formatSlotGates, shortSlotReq } from '../domain/campaign/eligibility';
import { injuryLabel } from '../domain/campaign/injury';
import { lineupFriction } from '../domain/campaign/relationships';
import { fightableRoster } from '../domain/campaign/season';
import type { FightStance } from '../content/identity';
import {
  DEFAULT_FIGHT_ORDERS,
  type AftermathSummary,
  type BodyInjury,
  type FightOrders,
  type Gladiator,
  type MuneraOffer,
  type SeasonState,
} from '../domain/campaign/types';
import { btn, clear, el } from './dom';
import { confirmModal } from './modal';
import { toast } from './toast';
import { loadLegacy } from '../shell/save';

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
  | { type: 'EQUIP_PART'; id: number; slot: KitSlot; partId: string }
  | { type: 'FIGHT'; lineupIds: number[]; orders: FightOrders; offer: MuneraOffer }
  | { type: 'AFTERMATH_CONTINUE' }
  | { type: 'SEASON_END_TITLE' };

const ASSIGNMENTS: { id: DayAssignment; label: string }[] = [
  { id: 'NONE', label: 'Idle' },
  { id: 'TRAIN', label: 'Train' },
  { id: 'RECOVER', label: 'Recover' },
  { id: 'SPAR', label: 'Spar' },
  { id: 'REST', label: 'Rest' },
];

const STANCE_LABEL: Record<FightStance, string> = {
  AGGRESSIVE: 'Agg',
  BALANCED: 'Bal',
  CAUTIOUS: 'Caut',
};

type Tab = 'roster' | 'munera' | 'market' | 'school';

interface LineupState {
  offer: MuneraOffer;
  slots: (number | null)[];
  activeSlot: number;
  orders: FightOrders;
}

/** HUD for the Ludus — one screen: top bar, tabs, on-board lineup, overlays. */
export class LudusView {
  readonly root: HTMLElement;
  private pending: LudusAction = { type: 'NONE' };
  private selectedId: number | null = null;
  private tab: Tab = 'roster';
  private state: SeasonState | null = null;
  private queries: LudusQueries | null = null;
  private lineup: LineupState | null = null;
  private aftermath: AftermathSummary | null = null;
  private terminal = false;

  constructor(private readonly onUi: () => void) {
    this.root = el('div', { className: 'screen ludus-screen is-hidden' });
  }

  mount(host: HTMLElement): void {
    host.append(this.root);
  }

  getSelectedId(): number | null {
    return this.selectedId;
  }

  isLineupMode(): boolean {
    return this.lineup !== null;
  }

  /** True while the terminal (season-end) overlay is up. */
  isTerminalShown(): boolean {
    return this.terminal;
  }

  /** True while the after-bout card is up. */
  isAftermathShown(): boolean {
    return this.aftermath !== null;
  }

  /** Back out of the on-board lineup to the munera board. */
  backFromLineup(): void {
    if (!this.lineup) return;
    this.lineup = null;
    this.onUi();
    this.render();
  }

  show(
    visible: boolean,
    state?: SeasonState | null,
    queries?: LudusQueries | null,
    opts?: { aftermath?: AftermathSummary | null; terminal?: boolean } | null,
  ): void {
    this.root.classList.toggle('is-hidden', !visible);
    if (visible && state) {
      this.state = state;
      if (queries) this.queries = queries;
      this.aftermath = opts?.aftermath ?? null;
      this.terminal = Boolean(opts?.terminal);
      this.render();
    }
  }

  /** Re-render if visible (after mutations). */
  refresh(
    state: SeasonState,
    queries?: LudusQueries | null,
    opts?: { aftermath?: AftermathSummary | null; terminal?: boolean } | null,
  ): void {
    this.state = state;
    if (queries) this.queries = queries;
    this.aftermath = opts?.aftermath ?? null;
    this.terminal = Boolean(opts?.terminal);
    if (!this.root.classList.contains('is-hidden')) this.render();
  }

  poll(): LudusAction {
    const a = this.pending;
    this.pending = { type: 'NONE' };
    return a;
  }

  /**
   * What the stage should show behind the hub:
   * - lineup mode → both teams; roster tab + selection → that fighter; else none (ambient).
   */
  getStagePreview():
    | { kind: 'fighter'; gladiator: Gladiator }
    | { kind: 'lineup'; offer: MuneraOffer; ids: (number | null)[] }
    | null {
    if (this.lineup) return { kind: 'lineup', offer: this.lineup.offer, ids: this.lineup.slots };
    if (this.tab === 'roster') {
      const state = this.state;
      if (!state) return null;
      const g =
        (this.selectedId != null ? state.roster.find((x) => x.id === this.selectedId) : null) ??
        state.roster.find((x) => !x.retired) ??
        null;
      return g ? { kind: 'fighter', gladiator: g } : null;
    }
    return null;
  }

  private emit(action: LudusAction): void {
    this.onUi();
    this.pending = action;
  }

  private q(): LudusQueries {
    return this.queries!;
  }

  // Stable chrome: the board, bar, tabs, and slots are built ONCE; only the
  // body/actions/overlays rebuild per mutation — no full-panel flash.
  private panel: HTMLElement | null = null;
  private bodySlot: HTMLElement | null = null;
  private actionsSlot: HTMLElement | null = null;
  private overlaySlot: HTMLElement | null = null;
  private vitalDayEl: HTMLElement | null = null;
  private vitalMoneyEl: HTMLElement | null = null;
  private vitalSubEl: HTMLElement | null = null;
  private contractEl: HTMLElement | null = null;
  private readonly tabBtns = new Map<Tab, HTMLButtonElement>();
  private lastViewKey = '';

  private ensureChrome(): void {
    if (this.panel) return;
    const panel = el('div', { className: 'hub-panel' });

    const bar = el('div', { className: 'hub-bar' });
    bar.append(
      btn('←', {
        className: 'ghost hub-title',
        title: 'Back to the Court',
        onClick: () => this.emit({ type: 'TITLE' }),
      }),
    );
    const vitals = el('div', { className: 'hub-vitals' });
    this.vitalDayEl = el('span', { className: 'vital' });
    this.vitalMoneyEl = el('span', { className: 'vital' });
    this.vitalSubEl = el('span', { className: 'vital-sub' });
    vitals.append(this.vitalDayEl, this.vitalMoneyEl, this.vitalSubEl);
    bar.append(vitals);
    this.contractEl = el('span', { className: 'eyebrow hub-contract' });
    bar.append(this.contractEl);
    panel.append(bar);

    const tabs = el('div', { className: 'tabs hub-tabs' });
    (
      [
        ['roster', 'Roster'],
        ['munera', 'Munera'],
        ['market', 'Market'],
        ['school', 'School'],
      ] as const
    ).forEach(([id, lab]) => {
      const b = btn(lab, {
        onClick: () => {
          this.tab = id;
          this.onUi();
          this.render();
        },
      });
      this.tabBtns.set(id, b);
      tabs.append(b);
    });
    panel.append(tabs);

    this.bodySlot = el('div', { className: 'hub-body' });
    panel.append(this.bodySlot);
    this.actionsSlot = el('div', { className: 'footer-actions hub-actions' });
    panel.append(this.actionsSlot);

    // Overlays must cover the whole screen — the panel clips (overflow hidden),
    // so the overlay host lives beside it.
    this.overlaySlot = el('div');
    this.root.append(panel, this.overlaySlot);
    this.panel = panel;
  }

  private render(): void {
    this.ensureChrome();
    const state = this.state!;
    const q = this.q();

    // Patch the chrome — the board, bar, and tabs never rebuild.
    this.vitalDayEl!.textContent = `Day ${state.day}/${economy.seasonDays}`;
    this.vitalMoneyEl!.textContent = `${state.denarii}d`;
    this.vitalSubEl!.textContent = `${state.virtus}v · ${q.fightableCount()} fit · ${state.roster.filter((g) => !g.retired).length}/${q.rosterCap()}`;
    const contract = state.contracts.find((c) => !c.completed && !c.failed);
    this.contractEl!.textContent = contract ? `${contract.name} · ${contract.daysLeft}d` : '';
    for (const [id, b] of this.tabBtns) b.classList.toggle('is-active', this.tab === id);

    // Rebuild only the body — preserving scroll position within a tab,
    // resetting when the view (tab / lineup) actually changes.
    const body = this.bodySlot!;
    const viewKey = this.lineup ? 'lineup' : this.tab;
    const scrollTop = viewKey === this.lastViewKey ? body.scrollTop : 0;
    this.lastViewKey = viewKey;
    clear(body);
    if (this.lineup) this.renderLineup(body, state);
    else if (this.tab === 'roster') this.renderRoster(body, state);
    else if (this.tab === 'munera') this.renderMunera(body, state);
    else if (this.tab === 'market') this.renderMarket(body, state);
    else this.renderSchool(body, state);
    body.scrollTop = scrollTop;

    // Rebuild only the actions.
    clear(this.actionsSlot!);
    if (!this.lineup) this.actionsSlot!.append(this.buildHubActions(state));

    // Rebuild only the overlays.
    clear(this.overlaySlot!);
    if (this.terminal) this.overlaySlot!.append(this.seasonEndOverlay(state));
    else if (this.aftermath) this.overlaySlot!.append(this.aftermathOverlay(state, this.aftermath));
  }

  private buildHubActions(state: SeasonState): HTMLElement {
    const foot = el('div', { className: 'footer-actions hub-actions' });
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
        btn('Rest Day', {
          disabled: !dayOpen || state.restDaysLeft <= 0,
          title:
            state.restDaysLeft <= 0
              ? 'No rest days left this season.'
              : !dayOpen
                ? 'The day is already resolved.'
                : undefined,
          onClick: () => this.emit({ type: 'REST' }),
        }),
      );
    }
    foot.append(
      btn('Skirmish', {
        className: 'quiet',
        onClick: () => this.emit({ type: 'INSTANT_MATCH' }),
      }),
    );
    return foot;
  }

  // ————— Roster —————

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
          title: state.dayResolved ? 'Assignments lock once the day is resolved.' : undefined,
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
          title:
            state.denarii < q.medicusCost(c.tier)
              ? 'Not enough denarii.'
              : state.status !== 'ACTIVE'
                ? 'The ludus cannot act right now.'
                : undefined,
          onClick: () => {
            toast(`The ${c.tier.toLowerCase()} attends to ${sel.name}.`, 'good');
            this.emit({ type: 'MEDICUS', id: sel.id, tier: c.tier });
          },
        }),
      );
    }
    care.append(
      btn('Release', {
        className: 'quiet',
        onClick: () => {
          this.onUi();
          confirmModal({
            title: 'Release',
            body: `Release ${sel.name} from the ludus? They leave the familia for good.`,
            confirmLabel: 'Release',
            danger: true,
            onConfirm: () => this.emit({ type: 'RELEASE', id: sel.id }),
          });
        },
      }),
    );
    detail.append(care);
    body.append(detail);
  }

  // ————— Munera —————

  private renderMunera(body: HTMLElement, state: SeasonState): void {
    body.append(el('p', { className: 'section-label', text: 'Munera' }));
    body.append(
      el('p', {
        className: 'meta',
        text: `Pick a bout — your lineup is set on the sand below.`,
      }),
    );
    if (state.offers.length === 0) {
      body.append(el('p', { className: 'meta', text: 'No offers today.' }));
      return;
    }
    for (const o of state.offers) {
      body.append(this.offerCard(o, state));
    }
  }

  private offerCard(o: MuneraOffer, state: SeasonState): HTMLElement {
    const card = el('div', { className: 'offer-card' });
    const head = el('div', { className: 'offer-head' });
    head.append(el('h3', { text: o.name }));
    const opp = o.opponents.map((id) => ARMATURAE[id].short).join('+');
    const purse = o.entryFee > 0 ? `${o.purse}d purse · ${o.entryFee}d fee` : `${o.purse}d purse`;
    head.append(
      el('div', {
        className: 'meta',
        text: `${o.teamSize}v${o.teamSize} · vs ${opp} · ${purse} · ${o.location}`,
      }),
    );
    head.append(el('div', { className: 'eyebrow', text: formatSlotGates(o.playerSlots) }));
    if (o.blurb) head.append(el('div', { className: 'eyebrow', text: o.blurb }));
    card.append(head);

    const canAfford = state.denarii >= o.entryFee;
    const locked = !o.eligible;
    const label = locked ? 'Locked' : canAfford ? 'Set Lineup' : 'Fee';
    const reason = locked
      ? `Needs a fit fighter: ${formatSlotGates(o.playerSlots)}.`
      : canAfford
        ? undefined
        : `Entry fee ${o.entryFee}d — not enough denarii.`;
    card.append(
      btn(label, {
        className: canAfford && !locked ? 'ghost' : undefined,
        disabled: locked || !canAfford,
        title: reason,
        onClick: () => {
          this.lineup = {
            offer: o,
            slots: Array.from({ length: o.teamSize }, () => null),
            activeSlot: 0,
            orders: { ...(state.pendingOrders ?? DEFAULT_FIGHT_ORDERS) },
          };
          this.onUi();
          this.render();
        },
      }),
    );
    return card;
  }

  private renderLineup(body: HTMLElement, state: SeasonState): void {
    const L = this.lineup!;
    const offer = L.offer;
    const head = el('div', { className: 'lineup-head' });
    head.append(el('h3', { text: offer.name }));
    const opp = offer.opponents.map((id) => ARMATURAE[id].short).join('+');
    const fee = offer.entryFee > 0 ? ` · fee ${offer.entryFee}d` : '';
    head.append(
      el('div', {
        className: 'meta',
        text: `${offer.teamSize}v${offer.teamSize} · vs ${opp} · ${offer.purse}d${fee}`,
      }),
    );
    head.append(btn('Back', { className: 'quiet', onClick: () => this.backFromLineup() }));
    body.append(head);

    const slotsRow = el('div', { className: 'row-btns' });
    offer.playerSlots.forEach((slot, i) => {
      const filled = L.slots[i];
      const g = filled != null ? state.roster.find((x) => x.id === filled) : null;
      const title = g ? g.name : `Slot ${i + 1}: ${shortSlotReq(slot)}`;
      slotsRow.append(
        btn(title, {
          active: L.activeSlot === i,
          onClick: () => {
            L.activeSlot = i;
            this.onUi();
            this.render();
          },
        }),
      );
    });
    body.append(slotsRow);

    const ordersRow = el('div', { className: 'orders-row' });
    ordersRow.append(el('span', { className: 'section-label', text: 'Orders' }));
    const stances: FightStance[] = ['AGGRESSIVE', 'BALANCED', 'CAUTIOUS'];
    for (const s of stances) {
      ordersRow.append(
        btn(STANCE_LABEL[s], {
          active: L.orders.stance === s,
          onClick: () => {
            L.orders.stance = s;
            this.onUi();
            this.render();
          },
        }),
      );
    }
    ordersRow.append(
      btn(L.orders.targetPriority === 'weakest' ? 'Weak' : 'Near', {
        onClick: () => {
          L.orders.targetPriority = L.orders.targetPriority === 'nearest' ? 'weakest' : 'nearest';
          this.onUi();
          this.render();
        },
      }),
    );
    ordersRow.append(
      btn('Withdraw', {
        active: L.orders.withdrawRequested,
        onClick: () => {
          L.orders.withdrawRequested = !L.orders.withdrawRequested;
          this.onUi();
          this.render();
        },
      }),
    );
    body.append(ordersRow);
    body.append(
      el('p', { className: 'eyebrow', text: `Doctrina: ${DOCTRINA[state.doctrina].name}` }),
    );

    const filledIds = L.slots.filter((id): id is number => id != null);
    const friction = lineupFriction(state, filledIds);
    if (friction.length) {
      body.append(el('p', { className: 'meta', text: friction[0]! }));
    }

    const pool = fightableRoster(state);
    const pickedElsewhere = L.slots.filter(
      (id, idx) => id != null && idx !== L.activeSlot,
    ) as number[];
    const slotReq = offer.playerSlots[L.activeSlot]!;
    const minIdx = offer.minGrade ? GRADE_ORDER.indexOf(offer.minGrade) : 0;
    const candidates = fightersForSlot(pool, slotReq, pickedElsewhere).filter(
      (g) => GRADE_ORDER.indexOf(g.grade) >= minIdx,
    );

    body.append(el('p', { className: 'section-label', text: 'Choose fighter' }));
    const grid = el('div', { className: 'chip-grid' });
    if (candidates.length === 0) {
      body.append(
        el('p', {
          className: 'meta',
          text: `No fit fighters for ${shortSlotReq(slotReq)}.`,
        }),
      );
    }
    for (const g of candidates) {
      const selected = L.slots[L.activeSlot] === g.id;
      const chip = el('button', { className: `chip${selected ? ' is-selected' : ''}` });
      chip.append(el('span', { className: 'name', text: g.name }));
      const origin = ORIGINS[g.origin]?.name ?? '';
      const injury =
        g.injuries?.length
          ? ` · ${g.injuries.map(injuryLabel).slice(0, 1).join('')}`
          : '';
      chip.append(
        el('span', {
          className: 'tag',
          text: `${ARMATURAE[g.armatura].short} · ${GRADE_LABEL[g.grade]}${origin ? ` · ${origin}` : ''}${injury}`,
        }),
      );
      const bar = el('div', { className: 'hp-bar' });
      bar.append(el('span', { attrs: { style: `width:${Math.round(g.hpRatio * 100)}%` } }));
      chip.append(bar);
      chip.addEventListener('click', () => {
        L.slots[L.activeSlot] = selected ? null : g.id;
        if (!selected) {
          const next = L.slots.findIndex((id) => id == null);
          if (next >= 0) L.activeSlot = next;
        }
        this.onUi();
        this.render();
      });
      grid.append(chip);
    }
    body.append(grid);

    const filledCount = L.slots.filter((id) => id != null).length;
    const ready =
      L.slots.every((id) => id != null) && state.denarii >= offer.entryFee && offer.eligible;
    const foot = el('div', { className: 'footer-actions hub-actions' });
    foot.append(el('span', { className: 'meta', text: `${filledCount}/${offer.teamSize} ready` }));
    foot.append(
      btn('Enter Arena', {
        className: 'cta',
        disabled: !ready,
        title: !ready
          ? L.slots.some((id) => id == null)
            ? 'Fill every slot to enter.'
            : state.denarii < offer.entryFee
              ? `Entry fee ${offer.entryFee}d — not enough denarii.`
              : 'This bout is locked.'
          : undefined,
        onClick: () => {
          const offer2 = L.offer;
          this.lineup = null;
          this.onUi();
          this.pending = {
            type: 'FIGHT',
            lineupIds: L.slots as number[],
            orders: { ...L.orders },
            offer: offer2,
          };
        },
      }),
    );
    body.append(foot);
  }

  // ————— Market —————

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
          title:
            state.denarii < m.price
              ? 'Not enough denarii.'
              : 'The ludus is at full capacity.',
          onClick: () => {
            toast(`${m.name} joins the familia.`, 'good');
            this.emit({ type: 'BUY_RECRUIT', offerId: m.id });
          },
        }),
      );
      body.append(row);
    }
  }

  // ————— School —————

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
            title:
              state.denarii < def.cost
                ? 'Not enough denarii.'
                : state.virtus < def.virtusReq
                  ? `Requires ${def.virtusReq} virtus.`
                  : undefined,
            onClick: () => {
              toast(`${def.name} raised.`, 'good');
              this.emit({ type: 'BUY_FACILITY', kind: id });
            },
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
          title: sel.gearGrade >= 2 ? 'Already at the finest grade.' : undefined,
          onClick: () => {
            toast(`${sel.name}'s kit is upgraded.`, 'good');
            this.emit({ type: 'UPGRADE_GEAR', id: sel.id });
          },
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
        const part = KIT_PARTS[select.value];
        toast(`Swapped ${slot} — ${part ? part.name : 'none'} equipped.`);
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

  // ————— Overlays —————

  private aftermathOverlay(state: SeasonState, summary: AftermathSummary): HTMLElement {
    const ov = el('div', { className: 'overlay' });
    const panel = el('div', { className: 'overlay-panel' });
    panel.append(el('h2', { text: summary.offerName }));
    const card = el('div', { className: 'center-card' });
    const resultClass =
      summary.result === 'WIN'
        ? 'win'
        : summary.result === 'FORFEIT' || summary.result === 'LOSS'
          ? 'loss'
          : '';
    card.append(el('div', { className: `result ${resultClass}`, text: summary.result }));
    card.append(
      el('p', {
        className: 'delta',
        text: `${summary.purseDelta >= 0 ? '+' : ''}${summary.purseDelta}d   ${summary.virtusDelta >= 0 ? '+' : ''}${summary.virtusDelta}v`,
      }),
    );

    if (summary.storyBeats?.length) {
      for (const beat of summary.storyBeats.slice(0, 2)) {
        card.append(el('p', { className: 'beat', text: beat }));
      }
    }

    if (summary.missio?.length) {
      card.append(el('p', { className: 'section-label', text: 'Missio' }));
      for (const m of summary.missio) {
        const thumb = m.outcome === 'SPARE' ? 'Missio — spared' : 'Pollice verso — death';
        card.append(
          el('p', {
            text: `${m.name}: ${thumb}`,
            className: m.outcome === 'SPARE' ? 'beat win-tone' : 'beat loss-tone',
          }),
        );
      }
    }

    const consequences: string[] = [];
    for (const inj of summary.injuries) {
      consequences.push(`${inj.name} — ${inj.detail ?? inj.injury}`);
    }
    for (const n of summary.relationNotes?.slice(0, 2) ?? []) consequences.push(n);
    for (const n of summary.notes?.slice(0, 2) ?? []) consequences.push(n);
    for (const xp of summary.xpGains ?? []) {
      consequences.push(`${xp.name} +${xp.xp} xp${xp.grade ? ` → ${xp.grade}` : ''}`);
    }
    if (consequences.length) {
      card.append(el('p', { className: 'section-label', text: 'Consequences' }));
      for (const line of consequences.slice(0, 6)) {
        card.append(el('p', { className: 'consequence', text: line }));
      }
    }

    card.append(
      el('p', {
        className: 'ledger',
        text: `${state.denarii}d · ${state.virtus}v · ${state.record.wins}W-${state.record.losses}L`,
      }),
    );
    panel.append(card);
    panel.append(
      btn('Continue', {
        className: 'cta',
        onClick: () => this.emit({ type: 'AFTERMATH_CONTINUE' }),
      }),
    );
    ov.append(panel);
    return ov;
  }

  private seasonEndOverlay(state: SeasonState): HTMLElement {
    const ov = el('div', { className: 'overlay' });
    const panel = el('div', { className: 'overlay-panel' });
    const title = state.status === 'BROKE' ? 'Ruined' : 'Season Complete';
    const sub =
      state.status === 'BROKE' ? 'The ludus cannot continue.' : `Day ${economy.seasonDays} closed.`;
    panel.append(el('h2', { text: title }));
    panel.append(el('div', { className: 'banner-sub', text: sub }));
    const card = el('div', { className: 'center-card' });
    card.append(
      el('p', {
        className: 'result',
        text: `${state.record.wins}W – ${state.record.losses}L – ${state.record.draws}D`,
      }),
    );
    card.append(
      el('p', {
        className: 'delta',
        text: `${state.denarii} denarii · ${state.virtus} virtus`,
      }),
    );

    const best = [...state.roster]
      .filter((g) => !g.retired)
      .sort((a, b) => b.wins - a.wins || b.fame - a.fame)[0];
    if (best) {
      card.append(
        el('p', {
          className: 'beat',
          text: `Best: ${best.name} · ${ARMATURAE[best.armatura].name} · ${GRADE_LABEL[best.grade]} (${best.wins}W)`,
        }),
      );
    }
    if (state.retiredNames.length) {
      card.append(
        el('p', {
          className: 'consequence',
          text: `Fallen / released: ${state.retiredNames.slice(0, 3).join(', ')}`,
        }),
      );
    }
    const leg = loadLegacy();
    card.append(
      el('p', {
        className: 'ledger',
        text: `Legacy · ${leg.seasonsCompleted} seasons · patronage ${leg.patronage}`,
      }),
    );
    panel.append(card);
    panel.append(
      btn('Return to the Court', {
        className: 'cta',
        onClick: () => this.emit({ type: 'SEASON_END_TITLE' }),
      }),
    );
    ov.append(panel);
    return ov;
  }
}
