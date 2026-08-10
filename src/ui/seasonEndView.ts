import { ARMATURAE } from '../content/armatura';
import { economy } from '../content/economy';
import { GRADE_LABEL } from '../content/rpg';
import type { SeasonState } from '../domain/campaign/types';
import { loadLegacy } from '../shell/save';
import { btn, clear, el } from './dom';

export type SeasonEndAction = { type: 'NONE' } | { type: 'TITLE' };

export class SeasonEndView {
  readonly root: HTMLElement;
  private pending: SeasonEndAction = { type: 'NONE' };

  constructor(private readonly onUi: () => void) {
    this.root = el('div', { className: 'screen season-end-screen is-hidden' });
  }

  mount(host: HTMLElement): void {
    host.append(this.root);
  }

  show(visible: boolean, state?: SeasonState | null): void {
    this.root.classList.toggle('is-hidden', !visible);
    if (visible && state) this.render(state);
  }

  poll(): SeasonEndAction {
    const a = this.pending;
    this.pending = { type: 'NONE' };
    return a;
  }

  private render(state: SeasonState): void {
    clear(this.root);
    const title = state.status === 'BROKE' ? 'Ruined' : 'Season Complete';
    const sub =
      state.status === 'BROKE' ? 'The ludus cannot continue.' : `Day ${economy.seasonDays} closed.`;

    const hdr = el('div', { className: 'screen-header' });
    const left = el('div');
    left.append(el('h1', { text: title }));
    left.append(el('div', { className: 'eyebrow', text: sub }));
    hdr.append(left);
    this.root.append(hdr);

    const card = el('div', { className: 'center-card' });
    card.append(
      el('p', {
        className: 'result',
        text: `${state.record.wins}W – ${state.record.losses}L – ${state.record.draws}D`,
      }),
    );
    card.append(
      el('p', {
        className: 'meta',
        text: `${state.denarii} denarii · ${state.virtus} virtus`,
      }),
    );

    const best = [...state.roster]
      .filter((g) => !g.retired)
      .sort((a, b) => b.wins - a.wins || b.fame - a.fame)[0];
    if (best) {
      card.append(
        el('p', {
          text: `Best: ${best.name} · ${ARMATURAE[best.armatura].name} · ${GRADE_LABEL[best.grade]} (${best.wins}W)`,
        }),
      );
    }
    if (state.retiredNames.length) {
      card.append(
        el('p', {
          className: 'eyebrow',
          text: `Fallen / released: ${state.retiredNames.slice(0, 3).join(', ')}`,
        }),
      );
    }
    const leg = loadLegacy();
    card.append(
      el('p', {
        className: 'eyebrow',
        text: `Legacy: ${leg.seasonsCompleted} seasons · patronage ${leg.patronage}`,
      }),
    );

    card.append(
      btn('Title', {
        className: 'cta',
        onClick: () => {
          this.onUi();
          this.pending = { type: 'TITLE' };
        },
      }),
    );
    this.root.append(card);
  }
}
