import { hasSeasonSave } from '../shell/save';
import { btn, clear, el } from './dom';

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
        onClick: () => this.emit({ type: 'NEW_SEASON' }),
      }),
      btn('Practice Yard', {
        className: 'ghost',
        onClick: () => this.emit({ type: 'INSTANT_MATCH' }),
      }),
    );

    const foot = el('p', {
      className: 'footer-note',
      text: canContinue
        ? 'Practice Yard is instant matches — no career save.'
        : 'Open a season to run the ludus, or spar in the Practice Yard.',
    });

    this.root.append(brand, stack, foot);
  }
}
