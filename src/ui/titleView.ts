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
    brand.append(el('p', { className: 'tagline', text: 'Sand · Steel · Season' }));

    const stack = el('div', { className: 'stack' });
    stack.append(
      btn('Practice Yard', {
        className: 'cta',
        onClick: () => this.emit({ type: 'INSTANT_MATCH' }),
      }),
      btn('New Season', { onClick: () => this.emit({ type: 'NEW_SEASON' }) }),
      btn('Continue', {
        disabled: !hasSeasonSave(),
        onClick: () => this.emit({ type: 'CONTINUE' }),
      }),
    );

    const foot = el('p', {
      className: 'footer-note',
      text: 'Practice needs no career. New Season opens the ludus.',
    });

    this.root.append(brand, stack, foot);
  }
}
