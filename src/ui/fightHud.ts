import { ARMATURAE } from '../content/armatura';
import { BEASTS } from '../content/beasts';
import type { FighterSnapshot } from '../domain/combat/types';
import { btn, clear, el, segment } from './dom';
import { openHelp } from './help';
import { confirmModal } from './modal';

const SPEEDS = [1, 2, 4] as const;

export type FightHudAction =
  | { type: 'NONE' }
  | { type: 'PAUSE_TOGGLE' }
  | { type: 'SPEED'; speed: number }
  | { type: 'SELECT'; id: number | null }
  | { type: 'FOCUS_TEAM'; team: 0 | 1 }
  | { type: 'RECENTER' }
  | { type: 'RESUME' }
  | { type: 'MUTE' }
  | { type: 'RESTART' }
  | { type: 'REROLL' }
  | { type: 'LEAVE' }
  | { type: 'CONTINUE' };

function fighterTag(f: FighterSnapshot): string {
  if (f.kind === 'beast' && f.beastId) return BEASTS[f.beastId].short;
  return ARMATURAE[f.armatura].short;
}

export class FightHud {
  readonly root: HTMLElement;
  private pending: FightHudAction = { type: 'NONE' };
  /** Chrome layout hints for inspect/debug — stage itself is full-bleed. */
  private padTop = 64;
  private padBottom = 128;

  constructor(private readonly onUi: () => void) {
    this.root = el('div', { className: 'hud fight-hud is-hidden' });
  }

  mount(host: HTMLElement): void {
    host.append(this.root);
  }

  show(visible: boolean): void {
    this.root.classList.toggle('is-hidden', !visible);
  }

  getStagePads(): { top: number; bottom: number } {
    return { top: this.padTop, bottom: this.padBottom };
  }

  poll(): FightHudAction {
    const a = this.pending;
    this.pending = { type: 'NONE' };
    return a;
  }

  private emit(action: FightHudAction): void {
    this.onUi();
    this.pending = action;
  }

  render(opts: {
    teamSize: number;
    seed: number;
    career: boolean;
    speed: number;
    paused: boolean;
    finished: boolean;
    resultLabel: string;
    muted: boolean;
    snaps: FighterSnapshot[];
    selectedId: number | null;
    favorBlue: number;
    favorRed: number;
    crowdCaption: string;
    inspect: null | {
      title: string;
      subtitle: string;
      stateLine: string;
      preferLeft: boolean;
      lines: { label: string; value: string }[];
      debugLines?: string[];
    };
    debugFeel: boolean;
    ticker?: string[];
    mvp?: string | null;
  }): void {
    clear(this.root);

    const top = el('div', { className: 'hud-rail hud-top' });
    const row = el('div', { className: 'hud-top-row' });
    row.append(el('span', { className: 'hud-format', text: `${opts.teamSize}v${opts.teamSize}` }));
    const lineup = opts.snaps
      .map((f) => `${f.team === 0 ? 'B' : 'R'}:${fighterTag(f)}`)
      .join('  ·  ');
    row.append(el('span', { className: 'hud-lineup', text: lineup }));
    if (!opts.career) {
      row.append(el('span', { className: 'hud-seed', text: `#${opts.seed.toString(16)}` }));
    }
    top.append(row);

    const favorSum = opts.favorBlue + opts.favorRed;
    const bluePct = favorSum > 0 ? (opts.favorBlue / favorSum) * 100 : 50;
    const meter = el('div', { className: 'favor-meter' });
    meter.append(el('div', { className: 'blue', attrs: { style: `width:${bluePct}%` } }));
    meter.append(
      el('div', { className: 'red', attrs: { style: `width:${100 - bluePct}%` } }),
    );
    top.append(meter);
    top.append(el('div', { className: 'crowd-caption', text: opts.crowdCaption }));
    this.root.append(top);

    if (opts.ticker?.length) {
      const ticker = el('div', { className: 'fight-ticker' });
      for (const line of opts.ticker.slice(-2)) {
        ticker.append(el('span', { className: 'ticker-line', text: line }));
      }
      this.root.append(ticker);
    }

    if (opts.inspect) {
      const dock = el('div', {
        className: `inspect-dock ${opts.inspect.preferLeft ? 'is-left' : 'is-right'}`,
      });
      dock.append(el('h3', { text: opts.inspect.title }));
      dock.append(el('div', { className: 'sub', text: opts.inspect.subtitle }));
      dock.append(el('div', { className: 'meta', text: opts.inspect.stateLine }));
      const dl = el('dl');
      for (const line of opts.inspect.lines) {
        dl.append(el('dt', { text: line.label }));
        dl.append(el('dd', { text: line.value }));
      }
      dock.append(dl);
      if (opts.inspect.debugLines?.length) {
        for (const d of opts.inspect.debugLines) {
          dock.append(el('div', { className: 'debug-line', text: d }));
        }
      }
      this.root.append(dock);
    }

    if (opts.debugFeel) {
      this.root.append(el('div', { className: 'debug-badge', text: 'FEEL' }));
    }

    const bottom = el('div', { className: 'hud-rail hud-bottom' });
    const roster = el('div', { className: 'roster-band' });
    const labels = el('div', { className: 'roster-labels' });
    labels.append(
      btn('Blue', {
        className: 'quiet',
        onClick: () => this.emit({ type: 'FOCUS_TEAM', team: 0 }),
      }),
    );
    labels.append(
      btn('Red', {
        className: 'quiet',
        onClick: () => this.emit({ type: 'FOCUS_TEAM', team: 1 }),
      }),
    );
    roster.append(labels);

    const blue = opts.snaps.filter((f) => f.team === 0).sort((a, b) => a.id - b.id);
    const red = opts.snaps.filter((f) => f.team === 1).sort((a, b) => a.id - b.id);
    const rowR = el('div', { className: 'roster-row' });
    const sideB = el('div', { className: 'side' });
    for (const f of blue) sideB.append(this.chip(f, opts.selectedId, false));
    const sideR = el('div', { className: 'side red' });
    for (const f of red) sideR.append(this.chip(f, opts.selectedId, true));
    rowR.append(sideB, el('div', { className: 'divider' }), sideR);
    roster.append(rowR);
    bottom.append(roster);

    const controls = el('div', { className: 'controls-row' });
    const speedIdx = SPEEDS.indexOf(opts.speed as (typeof SPEEDS)[number]);
    controls.append(
      segment(['1×', '2×', '4×'], speedIdx >= 0 ? speedIdx : 0, (i) => {
        this.emit({ type: 'SPEED', speed: SPEEDS[i]! });
      }),
    );
    controls.append(
      btn('Pause', {
        className: 'pause-btn',
        active: opts.paused,
        onClick: () => this.emit({ type: 'PAUSE_TOGGLE' }),
      }),
    );
    controls.append(
      btn('Recenter', {
        className: 'quiet',
        onClick: () => this.emit({ type: 'RECENTER' }),
      }),
    );
    bottom.append(controls);
    this.root.append(bottom);

    this.padTop = 64;
    this.padBottom = 128;

    if (opts.paused && !opts.finished) {
      this.root.append(this.pauseOverlay(opts.career, opts.muted));
    }
    if (opts.finished) {
      this.root.append(this.endOverlay(opts.career, opts.resultLabel, opts.mvp));
    }
  }

  private chip(f: FighterSnapshot, selectedId: number | null, foe: boolean): HTMLButtonElement {
    const b = el('button', {
      className: `roster-chip${foe ? ' is-foe' : ''}${f.id === selectedId ? ' is-selected' : ''}${!f.alive ? ' is-muted' : ''}`,
    });
    b.append(el('span', { className: 'name', text: f.name }));
    b.append(el('span', { className: 'tag', text: fighterTag(f) }));
    const bar = el('div', { className: 'hp-bar' });
    bar.append(
      el('span', { attrs: { style: `width:${Math.round((f.hp / f.maxHp) * 100)}%` } }),
    );
    b.append(bar);
    b.addEventListener('click', () => {
      this.emit({ type: 'SELECT', id: f.id === selectedId ? null : f.id });
    });
    return b;
  }

  private pauseOverlay(career: boolean, muted: boolean): HTMLElement {
    const ov = el('div', { className: 'overlay' });
    const panel = el('div', { className: 'overlay-panel' });
    panel.append(el('h2', { text: 'Paused' }));
    const stack = el('div', { className: 'stack' });
    stack.append(
      btn('Resume', {
        className: 'cta',
        onClick: () => this.emit({ type: 'RESUME' }),
      }),
    );
    stack.append(
      btn(muted ? 'Unmute' : 'Mute', { onClick: () => this.emit({ type: 'MUTE' }) }),
    );
    stack.append(
      btn('How to Play', {
        onClick: () => {
          this.onUi();
          openHelp();
        },
      }),
    );
    if (!career) {
      stack.append(btn('Restart', { onClick: () => this.emit({ type: 'RESTART' }) }));
      stack.append(btn('Reroll', { onClick: () => this.emit({ type: 'REROLL' }) }));
    }
    stack.append(
      btn(career ? 'Forfeit & Leave' : 'Leave', {
        className: 'quiet',
        onClick: () => {
          this.onUi();
          if (career) {
            confirmModal({
              title: 'Forfeit',
              body: 'Abandon this bout? Your fighters take the loss and any entry fee is lost.',
              confirmLabel: 'Forfeit',
              danger: true,
              onConfirm: () => this.emit({ type: 'LEAVE' }),
            });
          } else {
            this.emit({ type: 'LEAVE' });
          }
        },
      }),
    );
    panel.append(stack);
    ov.append(panel);
    return ov;
  }

  private endOverlay(career: boolean, resultLabel: string, mvp?: string | null): HTMLElement {
    const ov = el('div', { className: 'overlay' });
    const panel = el('div', { className: 'overlay-panel' });
    panel.append(el('h2', { text: 'Bout over' }));
    panel.append(el('div', { className: 'banner', text: resultLabel }));
    if (mvp) {
      panel.append(el('div', { className: 'banner-sub', text: mvp }));
    }
    const stack = el('div', { className: 'stack' });
    if (career) {
      stack.append(
        btn('Continue', {
          className: 'cta',
          onClick: () => this.emit({ type: 'CONTINUE' }),
        }),
      );
    } else {
      stack.append(
        btn('Restart', {
          className: 'cta',
          onClick: () => this.emit({ type: 'RESTART' }),
        }),
      );
      stack.append(btn('Reroll', { onClick: () => this.emit({ type: 'REROLL' }) }));
      stack.append(
        btn('Leave', {
          className: 'quiet',
          onClick: () => this.emit({ type: 'LEAVE' }),
        }),
      );
    }
    panel.append(stack);
    ov.append(panel);
    return ov;
  }
}
