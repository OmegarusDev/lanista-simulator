import { hasSeasonSave, loadLegacy } from '../shell/save';
import { btn, clear, el } from './dom';
import { openHelp } from './help';
import { confirmModal, farewellModal } from './modal';

export type TitleAction =
  | { type: 'NONE' }
  | { type: 'INSTANT_MATCH' }
  | { type: 'NEW_SEASON' }
  | { type: 'CONTINUE' };

export class TitleView {
  readonly root: HTMLElement;
  private pending: TitleAction = { type: 'NONE' };

  constructor(private readonly onUi: () => void) {
    this.root = el('div', { className: 'screen title-screen' });
  }

  mount(host: HTMLElement): void {
    host.append(this.root);
    this.render();
  }

  show(visible: boolean): void {
    this.root.classList.toggle('is-hidden', !visible);
    if (visible) this.render();
  }

  poll(): TitleAction {
    const a = this.pending;
    this.pending = { type: 'NONE' };
    return a;
  }

  private emit(action: TitleAction): void {
    this.onUi();
    this.pending = action;
  }

  private render(): void {
    clear(this.root);
    const brand = el('div', { className: 'brand' });
    brand.append(el('div', { className: 'brand-mark', attrs: { 'aria-hidden': 'true' } }));
    brand.append(el('h1', { text: 'LANISTA' }));
    brand.append(el('p', { className: 'tagline', text: 'Amphitheatre · Ludus · Fame' }));

    const canContinue = hasSeasonSave();
    const stack = el('div', { className: 'stack' });
    if (canContinue) {
      stack.append(
        btn('Continue Season', {
          className: 'cta',
          onClick: () => this.emit({ type: 'CONTINUE' }),
        }),
      );
    }
    stack.append(
      btn('New Season', {
        className: canContinue ? undefined : 'cta',
        onClick: () => {
          this.onUi();
          if (canContinue) {
            confirmModal({
              title: 'New Season',
              body: 'Starting a new season replaces your current save. Your legacy (patronage, alumni) carries over.',
              confirmLabel: 'Start New',
              danger: true,
              onConfirm: () => this.emit({ type: 'NEW_SEASON' }),
            });
          } else {
            this.emit({ type: 'NEW_SEASON' });
          }
        },
      }),
      btn('Practice Yard', {
        className: 'ghost',
        onClick: () => this.emit({ type: 'INSTANT_MATCH' }),
      }),
    );

    const row = el('div', { className: 'title-tools' });
    row.append(
      btn('How to Play', {
        className: 'quiet',
        onClick: () => {
          this.onUi();
          openHelp();
        },
      }),
      btn('Exit', {
        className: 'quiet',
        onClick: () => {
          this.onUi();
          farewellModal(() => this.render());
        },
      }),
    );
    stack.append(row);

    const foot = el('p', {
      className: 'footer-note',
      text: canContinue
        ? 'Practice Yard is instant matches — no career save.'
        : 'Open a season to run the ludus, or spar in the Practice Yard.',
    });
    const leg = loadLegacy();
    if (leg.seasonsCompleted > 0 || leg.patronage > 0) {
      foot.append(
        el('span', {
          className: 'footer-extra',
          text: `  ·  Legacy: ${leg.seasonsCompleted} seasons · patronage ${leg.patronage} · ${leg.alumni.length} alumni`,
        }),
      );
    }

    this.root.append(brand, stack, foot);
  }

  /** Re-surface legacy after returning from a season. */
  refreshLegacy(): void {
    if (!this.root.classList.contains('is-hidden')) this.render();
  }
}