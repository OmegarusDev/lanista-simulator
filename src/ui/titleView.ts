import { hasSeasonSave, loadLegacy, loadSeason } from '../shell/save';
import { btn, clear, el } from './dom';
import { openHelp } from './help';
import { confirmModal, farewellModal } from './modal';
import { laurelEmblem } from './emblem';

export type TitleAction =
  | { type: 'NONE' }
  | { type: 'INSTANT_MATCH' }
  | { type: 'NEW_SEASON' }
  | { type: 'CONTINUE' }
  | { type: 'SOUND' };

/**
 * The Court — the home screen. One hero action (Quick Match), one career
 * action, and quiet secondary tools. The arena breathes behind it.
 */
export class TitleView {
  readonly root: HTMLElement;
  private pending: TitleAction = { type: 'NONE' };
  private muted = false;

  constructor(private readonly onUi: () => void) {
    this.root = el('div', { className: 'screen title-screen' });
  }

  /** Reflect the app's mute state on the Sound button. */
  setMuted(muted: boolean): void {
    this.muted = muted;
    if (!this.root.classList.contains('is-hidden')) this.render();
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
    brand.append(
      el('div', { className: 'brand-mark', html: laurelEmblem(), attrs: { 'aria-hidden': 'true' } }),
    );
    brand.append(el('h1', { text: 'LANISTA' }));
    brand.append(el('p', { className: 'tagline', text: 'Amphitheatre · Ludus · Fame' }));

    const canContinue = hasSeasonSave();
    const saved = canContinue ? loadSeason() : null;
    const stack = el('div', { className: 'stack' });

    stack.append(
      btn('Quick Match', {
        className: 'cta',
        onClick: () => this.emit({ type: 'INSTANT_MATCH' }),
      }),
    );
    stack.append(
      el('p', { className: 'stack-sub', text: 'Instant skirmish — no stakes, no save.' }),
    );

    if (canContinue && saved) {
      stack.append(
        btn(`Continue — Day ${saved.day} · ${saved.denarii}d`, {
          onClick: () => this.emit({ type: 'CONTINUE' }),
        }),
      );
      stack.append(
        btn('New Season', {
          className: 'quiet',
          onClick: () => {
            this.onUi();
            confirmModal({
              title: 'New Season',
              body: 'Starting a new season replaces your current save. Your legacy (patronage, alumni) carries over.',
              confirmLabel: 'Start New',
              danger: true,
              onConfirm: () => this.emit({ type: 'NEW_SEASON' }),
            });
          },
        }),
      );
    } else {
      stack.append(
        btn('New Season', {
          onClick: () => this.emit({ type: 'NEW_SEASON' }),
        }),
      );
    }

    const row = el('div', { className: 'title-tools' });
    row.append(
      btn(this.muted ? 'Sound: Off' : 'Sound: On', {
        className: 'quiet',
        onClick: () => {
          this.onUi();
          this.emit({ type: 'SOUND' });
        },
      }),
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
        ? 'Quick Match is instant fights — your career save stays untouched.'
        : 'Run the ludus through a season, or spar in the Skirmish Yard.',
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
