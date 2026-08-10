import { ARMATURAE } from '../content/armatura';
import { formatSlotGates } from '../domain/campaign/eligibility';
import { maxOfferTier } from '../domain/campaign/offers';
import type { MuneraOffer, SeasonState } from '../domain/campaign/types';
import { btn, clear, el } from './dom';

export type OffersAction =
  | { type: 'NONE' }
  | { type: 'BACK' }
  | { type: 'PICK'; offer: MuneraOffer };

export class OffersView {
  readonly root: HTMLElement;
  private pending: OffersAction = { type: 'NONE' };

  constructor(private readonly onUi: () => void) {
    this.root = el('div', { className: 'screen offers-screen is-hidden' });
  }

  mount(host: HTMLElement): void {
    host.append(this.root);
  }

  show(visible: boolean, state?: SeasonState | null): void {
    this.root.classList.toggle('is-hidden', !visible);
    if (visible && state) this.render(state);
  }

  poll(): OffersAction {
    const a = this.pending;
    this.pending = { type: 'NONE' };
    return a;
  }

  private emit(action: OffersAction): void {
    this.onUi();
    this.pending = action;
  }

  private render(state: SeasonState): void {
    clear(this.root);
    const hdr = el('div', { className: 'screen-header' });
    const left = el('div');
    left.append(el('h1', { text: 'Munera' }));
    left.append(
      el('div', {
        className: 'eyebrow',
        text: `Day ${state.day} · Tier ${maxOfferTier(state.virtus)} · class-gated events`,
      }),
    );
    hdr.append(left);
    hdr.append(btn('Back', { onClick: () => this.emit({ type: 'BACK' }) }));
    this.root.append(hdr);

    const body = el('div', { className: 'body-scroll' });
    if (state.offers.length === 0) {
      body.append(el('p', { className: 'meta', text: 'No offers today.' }));
    }
    for (const o of state.offers) {
      const row = el('div', { className: 'list-row' });
      const copy = el('div', { className: 'copy' });
      copy.append(el('h3', { text: o.name }));
      copy.append(
        el('div', {
          className: 'eyebrow',
          text: `${o.kind} · ${o.teamSize}v${o.teamSize} · ${o.location ?? 'arena'}`,
        }),
      );
      const opp = o.opponents.map((id) => ARMATURAE[id].name).join('+');
      copy.append(
        el('div', {
          className: 'meta',
          text: `${formatSlotGates(o.playerSlots)}  →  vs ${opp}  ·  ${o.purse}d / fee ${o.entryFee}`,
        }),
      );
      copy.append(el('div', { className: 'meta', text: o.blurb }));
      row.append(copy);
      const canAfford = state.denarii >= o.entryFee;
      row.append(
        btn(o.eligible ? 'Accept' : 'Locked', {
          disabled: !o.eligible || !canAfford,
          onClick: () => this.emit({ type: 'PICK', offer: o }),
        }),
      );
      body.append(row);
    }
    this.root.append(body);

    this.root.append(
      el('p', {
        className: 'footer-note',
        text: `${state.denarii} denarii · need matching armaturae for classics`,
      }),
    );
  }
}
