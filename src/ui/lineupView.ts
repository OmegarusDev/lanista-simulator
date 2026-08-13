import { ARMATURAE } from '../content/armatura';
import { ORIGINS } from '../content/identity';
import { DOCTRINA, GRADE_LABEL, GRADE_ORDER } from '../content/rpg';
import { fightersForSlot, shortSlotReq } from '../domain/campaign/eligibility';
import { injuryLabel } from '../domain/campaign/injury';
import { lineupFriction } from '../domain/campaign/relationships';
import { fightableRoster } from '../domain/campaign/season';
import type { FightStance } from '../content/identity';
import {
  DEFAULT_FIGHT_ORDERS,
  type FightOrders,
  type MuneraOffer,
  type SeasonState,
} from '../domain/campaign/types';
import { btn, clear, el } from './dom';

export type LineupAction =
  | { type: 'NONE' }
  | { type: 'BACK' }
  | { type: 'FIGHT'; lineupIds: number[]; orders?: FightOrders };

const STANCE_LABEL: Record<FightStance, string> = {
  AGGRESSIVE: 'Agg',
  BALANCED: 'Bal',
  CAUTIOUS: 'Caut',
};

export class LineupView {
  readonly root: HTMLElement;
  private pending: LineupAction = { type: 'NONE' };
  private slots: (number | null)[] = [];
  private activeSlot = 0;
  private orders: FightOrders = { ...DEFAULT_FIGHT_ORDERS };
  private state: SeasonState | null = null;
  private offer: MuneraOffer | null = null;

  constructor(private readonly onUi: () => void) {
    this.root = el('div', { className: 'screen lineup-screen is-hidden' });
  }

  mount(host: HTMLElement): void {
    host.append(this.root);
  }

  getLineupIds(): (number | null)[] {
    return [...this.slots];
  }

  reset(offer?: MuneraOffer): void {
    const n = offer?.teamSize ?? 1;
    this.slots = Array.from({ length: n }, () => null);
    this.activeSlot = 0;
    this.orders = { ...DEFAULT_FIGHT_ORDERS };
  }

  show(visible: boolean, state?: SeasonState | null, offer?: MuneraOffer | null): void {
    this.root.classList.toggle('is-hidden', !visible);
    if (visible && state && offer) {
      this.state = state;
      this.offer = offer;
      if (this.slots.length !== offer.teamSize) this.reset(offer);
      if (state.pendingOrders) this.orders = { ...state.pendingOrders };
      this.render();
    }
  }

  poll(): LineupAction {
    const a = this.pending;
    this.pending = { type: 'NONE' };
    return a;
  }

  private emit(action: LineupAction): void {
    this.onUi();
    this.pending = action;
  }

  private render(): void {
    const state = this.state!;
    const offer = this.offer!;
    clear(this.root);

    const hdr = el('div', { className: 'screen-header' });
    const left = el('div');
    left.append(el('h1', { text: 'Lineup' }));
    left.append(
      el('div', {
        className: 'eyebrow',
        text: offer.name,
      }),
    );
    const opp = offer.opponents.map((id) => ARMATURAE[id].short).join('+');
    const fee = offer.entryFee > 0 ? ` · fee ${offer.entryFee}d` : '';
    left.append(
      el('div', {
        className: 'meta',
        text: `${offer.teamSize}v${offer.teamSize} · vs ${opp} · ${offer.purse}d${fee}`,
      }),
    );
    hdr.append(left);
    hdr.append(btn('Back', { className: 'ghost', onClick: () => this.emit({ type: 'BACK' }) }));
    this.root.append(hdr);

    const slotsRow = el('div', { className: 'row-btns' });
    offer.playerSlots.forEach((slot, i) => {
      const filled = this.slots[i];
      const g = filled != null ? state.roster.find((x) => x.id === filled) : null;
      const title = g ? g.name : shortSlotReq(slot);
      slotsRow.append(
        btn(g ? title : `Slot ${i + 1}: ${title}`, {
          active: this.activeSlot === i,
          onClick: () => {
            this.activeSlot = i;
            this.onUi();
            this.render();
          },
        }),
      );
    });
    this.root.append(slotsRow);

    const ordersRow = el('div', { className: 'orders-row' });
    ordersRow.append(el('span', { className: 'section-label', text: 'Orders' }));
    const stances: FightStance[] = ['AGGRESSIVE', 'BALANCED', 'CAUTIOUS'];
    for (const s of stances) {
      ordersRow.append(
        btn(STANCE_LABEL[s], {
          active: this.orders.stance === s,
          onClick: () => {
            this.orders.stance = s;
            this.onUi();
            this.render();
          },
        }),
      );
    }
    ordersRow.append(
      btn(this.orders.targetPriority === 'weakest' ? 'Weak' : 'Near', {
        onClick: () => {
          this.orders.targetPriority =
            this.orders.targetPriority === 'nearest' ? 'weakest' : 'nearest';
          this.onUi();
          this.render();
        },
      }),
    );
    ordersRow.append(
      btn('Withdraw', {
        active: this.orders.withdrawRequested,
        onClick: () => {
          this.orders.withdrawRequested = !this.orders.withdrawRequested;
          this.onUi();
          this.render();
        },
      }),
    );
    this.root.append(ordersRow);
    this.root.append(
      el('p', {
        className: 'eyebrow',
        text: `Doctrina: ${DOCTRINA[state.doctrina].name}`,
      }),
    );

    const filledIds = this.slots.filter((id): id is number => id != null);
    const friction = lineupFriction(state, filledIds);
    if (friction.length) {
      this.root.append(el('p', { className: 'meta', text: friction[0]! }));
    }

    const body = el('div', { className: 'body-scroll' });
    body.append(el('p', { className: 'section-label', text: 'Choose fighter' }));

    const pool = fightableRoster(state);
    const pickedElsewhere = this.slots.filter(
      (id, idx) => id != null && idx !== this.activeSlot,
    ) as number[];
    const slotReq = offer.playerSlots[this.activeSlot]!;
    const minIdx = offer.minGrade ? GRADE_ORDER.indexOf(offer.minGrade) : 0;
    const candidates = fightersForSlot(pool, slotReq, pickedElsewhere).filter(
      (g) => GRADE_ORDER.indexOf(g.grade) >= minIdx,
    );

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
      const selected = this.slots[this.activeSlot] === g.id;
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
        this.onUi();
        this.slots[this.activeSlot] = selected ? null : g.id;
        if (!selected) {
          const next = this.slots.findIndex((id) => id == null);
          if (next >= 0) this.activeSlot = next;
        }
        this.render();
      });
      grid.append(chip);
    }
    body.append(grid);
    this.root.append(body);

    const filledCount = this.slots.filter((id) => id != null).length;
    const foot = el('div', { className: 'footer-actions' });
    foot.append(
      el('span', {
        className: 'meta',
        text: `${filledCount}/${offer.teamSize} ready`,
      }),
    );
    const ready =
      this.slots.every((id) => id != null) && state.denarii >= offer.entryFee && offer.eligible;
    foot.append(
      btn('Enter Arena', {
        className: 'cta',
        disabled: !ready,
        title: !ready
          ? this.slots.some((id) => id == null)
            ? 'Fill every slot to enter.'
            : state.denarii < offer.entryFee
              ? `Entry fee ${offer.entryFee}d — not enough denarii.`
              : 'This bout is locked.'
          : undefined,
        onClick: () =>
          this.emit({
            type: 'FIGHT',
            lineupIds: this.slots as number[],
            orders: { ...this.orders },
          }),
      }),
    );
    this.root.append(foot);
  }
}
