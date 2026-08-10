import { ARMATURAE } from '../content/armatura';
import { DOCTRINA, GRADE_LABEL, GRADE_ORDER } from '../content/rpg';
import { fightersForSlot, shortSlotReq } from '../domain/campaign/eligibility';
import { fightableRoster } from '../domain/campaign/season';
import type { MuneraOffer, SeasonState } from '../domain/campaign/types';
import { btn, clear, el } from './dom';

export type LineupAction =
  | { type: 'NONE' }
  | { type: 'BACK' }
  | { type: 'FIGHT'; lineupIds: number[] };

export class LineupView {
  readonly root: HTMLElement;
  private pending: LineupAction = { type: 'NONE' };
  private slots: (number | null)[] = [];
  private activeSlot = 0;
  private state: SeasonState | null = null;
  private offer: MuneraOffer | null = null;

  constructor(private readonly onUi: () => void) {
    this.root = el('div', { className: 'screen lineup-screen is-hidden' });
  }

  mount(host: HTMLElement): void {
    host.append(this.root);
  }

  reset(offer?: MuneraOffer): void {
    const n = offer?.teamSize ?? 1;
    this.slots = Array.from({ length: n }, () => null);
    this.activeSlot = 0;
  }

  show(visible: boolean, state?: SeasonState | null, offer?: MuneraOffer | null): void {
    this.root.classList.toggle('is-hidden', !visible);
    if (visible && state && offer) {
      this.state = state;
      this.offer = offer;
      if (this.slots.length !== offer.teamSize) this.reset(offer);
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
        text: `${offer.name} · ${offer.teamSize}v${offer.teamSize}`,
      }),
    );
    left.append(el('div', { className: 'meta', text: offer.blurb }));
    const opp = offer.opponents.map((id) => ARMATURAE[id].name).join(', ');
    left.append(
      el('div', {
        className: 'meta',
        text: `Opponents: ${opp} · ${offer.editor ?? 'Editor'} · Doctrina: ${DOCTRINA[state.doctrina].name}`,
      }),
    );
    hdr.append(left);
    this.root.append(hdr);

    const slotsRow = el('div', { className: 'row-btns' });
    offer.playerSlots.forEach((slot, i) => {
      const filled = this.slots[i];
      const g = filled != null ? state.roster.find((x) => x.id === filled) : null;
      const title = g ? g.name : shortSlotReq(slot);
      const b = btn(`F${i + 1}: ${title}`, {
        active: this.activeSlot === i,
        onClick: () => {
          this.activeSlot = i;
          this.onUi();
          this.render();
        },
      });
      slotsRow.append(b);
    });
    this.root.append(slotsRow);

    const body = el('div', { className: 'body-scroll' });
    body.append(el('p', { className: 'meta', text: 'Eligible for this slot' }));

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
      chip.append(
        el('span', {
          className: 'tag',
          text: `${ARMATURAE[g.armatura].short}·${GRADE_LABEL[g.grade].slice(0, 3)}`,
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
        text: `Filled ${filledCount} / ${offer.teamSize}`,
      }),
    );
    foot.append(btn('Back', { onClick: () => this.emit({ type: 'BACK' }) }));
    const ready =
      this.slots.every((id) => id != null) && state.denarii >= offer.entryFee && offer.eligible;
    foot.append(
      btn('Enter Arena', {
        className: 'cta',
        disabled: !ready,
        onClick: () => this.emit({ type: 'FIGHT', lineupIds: this.slots as number[] }),
      }),
    );
    this.root.append(foot);
  }
}
