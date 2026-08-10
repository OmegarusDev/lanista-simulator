import type { AftermathSummary, SeasonState } from '../domain/campaign/types';
import { btn, clear, el } from './dom';

export type AftermathAction = { type: 'NONE' } | { type: 'CONTINUE' };

export class AftermathView {
  readonly root: HTMLElement;
  private pending: AftermathAction = { type: 'NONE' };

  constructor(private readonly onUi: () => void) {
    this.root = el('div', { className: 'screen aftermath-screen is-hidden' });
  }

  mount(host: HTMLElement): void {
    host.append(this.root);
  }

  show(visible: boolean, state?: SeasonState | null, summary?: AftermathSummary | null): void {
    this.root.classList.toggle('is-hidden', !visible);
    if (visible && state && summary) this.render(state, summary);
  }

  poll(): AftermathAction {
    const a = this.pending;
    this.pending = { type: 'NONE' };
    return a;
  }

  private render(state: SeasonState, summary: AftermathSummary): void {
    clear(this.root);
    const hdr = el('div', { className: 'screen-header' });
    const left = el('div');
    left.append(el('h1', { text: 'Aftermath' }));
    left.append(el('div', { className: 'eyebrow', text: summary.offerName }));
    hdr.append(left);
    this.root.append(hdr);

    const card = el('div', { className: 'center-card' });
    const resultClass =
      summary.result === 'WIN' ? 'win' : summary.result === 'FORFEIT' || summary.result === 'LOSS' ? 'loss' : '';
    card.append(el('div', { className: `result ${resultClass}`, text: summary.result }));
    card.append(
      el('p', {
        text: `Denarii ${summary.purseDelta >= 0 ? '+' : ''}${summary.purseDelta}   Virtus ${summary.virtusDelta >= 0 ? '+' : ''}${summary.virtusDelta}`,
      }),
    );

    if (summary.missio?.length) {
      card.append(el('p', { className: 'meta', text: 'The crowd judges the fallen' }));
      for (const m of summary.missio) {
        const thumb = m.outcome === 'SPARE' ? 'THUMB UP — MISSIO' : 'THUMB DOWN — DEATH';
        card.append(
          el('p', {
            text: `${m.name} — ${thumb}`,
            className: m.outcome === 'SPARE' ? 'result win' : 'result loss',
          }),
        );
        card.append(el('p', { className: 'eyebrow', text: m.lean }));
      }
    }

    if (summary.notes?.length) {
      for (const n of summary.notes.slice(0, 4)) {
        card.append(el('p', { className: 'meta', text: n }));
      }
    }
    for (const inj of summary.injuries) {
      card.append(el('p', { className: 'meta', text: `${inj.name} → ${inj.injury}` }));
    }
    for (const xp of summary.xpGains ?? []) {
      card.append(
        el('p', {
          className: 'meta',
          text: `${xp.name} +${xp.xp} xp${xp.grade ? ` → ${xp.grade}` : ''}`,
        }),
      );
    }

    card.append(
      el('p', {
        className: 'meta',
        text: `${state.denarii}d · ${state.virtus}v · ${state.record.wins}W-${state.record.losses}L`,
      }),
    );

    card.append(
      btn('Continue', {
        className: 'cta',
        onClick: () => {
          this.onUi();
          this.pending = { type: 'CONTINUE' };
        },
      }),
    );
    this.root.append(card);
  }
}
