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

export interface FightHudRender {
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
  /** Total entertainment earned in the bout (shown on the lab end card). */
  entertainment?: number;
  /** Strong crowd lean ('blue' | 'red') tints the caption. */
  crowdLean?: 'blue' | 'red' | null;
  /** Camera is manually held — only then does Recenter appear. */
  cameraManual?: boolean;
}

function fighterTag(f: FighterSnapshot): string {
  if (f.kind === 'beast' && f.beastId) return BEASTS[f.beastId].short;
  return ARMATURAE[f.armatura].short;
}

/**
 * Fight chrome with a stable DOM — the rails are built once and only patched
 * in place, so combat updates never flash the whole HUD.
 */
export class FightHud {
  readonly root: HTMLElement;
  private pending: FightHudAction = { type: 'NONE' };
  /** Chrome layout hints for inspect/debug — stage itself is full-bleed. */
  private padTop = 64;
  private padBottom = 128;

  private built = false;
  private structuralKey = '';
  private formatEl!: HTMLElement;
  private lineupEl!: HTMLElement;
  private seedEl!: HTMLElement;
  private favorBlueEl!: HTMLElement;
  private favorRedEl!: HTMLElement;
  private captionEl!: HTMLElement;
  private tickerEl!: HTMLElement;
  private debugEl!: HTMLElement;
  private dockSlot!: HTMLElement;
  private dockEl: HTMLElement | null = null;
  private dockValueEls: HTMLElement[] = [];
  private dockStateEl: HTMLElement | null = null;
  private chips: { root: HTMLButtonElement; bar: HTMLElement }[] = [];
  private segBtns: HTMLButtonElement[] = [];
  private pauseBtn!: HTMLButtonElement;
  private recenterBtn!: HTMLButtonElement;
  private overlaySlot!: HTMLElement;
  private overlayEl: HTMLElement | null = null;

  private lastSelectedId: number | null = null;
  private lastTickerKey = '';
  private lastDebug = false;

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

  render(opts: FightHudRender): void {
    // Structural identity: team size / roster count / career mode. A lab
    // 3v3 restart into a 1v1 (or REROLL) must rebuild chips and labels.
    const structural = `${opts.teamSize}|${opts.snaps.length}|${opts.career}`;
    if (!this.built || structural !== this.structuralKey) {
      this.chips = [];
      this.build(opts);
      this.built = true;
      this.structuralKey = structural;
    }
    this.patch(opts);
  }

  private build(opts: FightHudRender): void {
    clear(this.root);

    const top = el('div', { className: 'hud-rail hud-top' });
    const row = el('div', { className: 'hud-top-row' });
    this.formatEl = el('span', { className: 'hud-format', text: `${opts.teamSize}v${opts.teamSize}` });
    const lineup = opts.snaps
      .map((f) => `${f.team === 0 ? 'B' : 'R'}:${fighterTag(f)}`)
      .join('  ·  ');
    this.lineupEl = el('span', { className: 'hud-lineup', text: lineup });
    this.seedEl = el('span', { className: 'hud-seed', text: '' });
    row.append(this.formatEl, this.lineupEl, this.seedEl);
    if (!opts.career) this.seedEl.textContent = `#${opts.seed.toString(16)}`;
    top.append(row);

    const meter = el('div', { className: 'favor-meter' });
    this.favorBlueEl = el('div', { className: 'blue' });
    this.favorRedEl = el('div', { className: 'red' });
    meter.append(this.favorBlueEl, this.favorRedEl);
    top.append(meter);
    this.captionEl = el('div', { className: 'crowd-caption' });
    top.append(this.captionEl);
    this.root.append(top);

    this.tickerEl = el('div', { className: 'fight-ticker' });
    this.root.append(this.tickerEl);

    this.dockSlot = el('div');
    this.root.append(this.dockSlot);

    this.debugEl = el('div', { className: 'debug-badge', text: 'FEEL' });
    this.debugEl.classList.add('is-hidden');
    this.root.append(this.debugEl);

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
    for (const f of blue) sideB.append(this.buildChip(f));
    const sideR = el('div', { className: 'side red' });
    for (const f of red) sideR.append(this.buildChip(f));
    rowR.append(sideB, el('div', { className: 'divider' }), sideR);
    roster.append(rowR);
    bottom.append(roster);

    const controls = el('div', { className: 'controls-row' });
    const speedIdx = SPEEDS.indexOf(opts.speed as (typeof SPEEDS)[number]);
    const seg = segment(['1×', '2×', '4×'], speedIdx >= 0 ? speedIdx : 0, (i) => {
      this.emit({ type: 'SPEED', speed: SPEEDS[i]! });
    });
    this.segBtns = Array.from(seg.querySelectorAll('button'));
    controls.append(seg);
    this.pauseBtn = btn('Pause', {
      className: 'pause-btn',
      active: opts.paused,
      onClick: () => this.emit({ type: 'PAUSE_TOGGLE' }),
    });
    controls.append(this.pauseBtn);
    this.recenterBtn = btn('Recenter', {
      className: 'quiet',
      onClick: () => this.emit({ type: 'RECENTER' }),
    });
    controls.append(this.recenterBtn);
    bottom.append(controls);
    this.root.append(bottom);

    this.overlaySlot = el('div');
    this.root.append(this.overlaySlot);

    this.padTop = 64;
    this.padBottom = 128;
  }

  private buildChip(f: FighterSnapshot): HTMLButtonElement {
    const b = el('button', { className: 'roster-chip' });
    b.append(el('span', { className: 'name', text: f.name }));
    b.append(el('span', { className: 'tag', text: fighterTag(f) }));
    const bar = el('div', { className: 'hp-bar' });
    bar.append(el('span'));
    b.append(bar);
    b.addEventListener('click', () => this.emit({ type: 'SELECT', id: f.id }));
    this.chips.push({ root: b, bar });
    return b;
  }

  private patch(opts: FightHudRender): void {
    const favorSum = opts.favorBlue + opts.favorRed;
    const bluePct = favorSum > 0 ? (opts.favorBlue / favorSum) * 100 : 50;
    this.favorBlueEl.style.width = `${bluePct}%`;
    this.favorRedEl.style.width = `${100 - bluePct}%`;
    this.captionEl.textContent = opts.crowdCaption;
    this.captionEl.classList.toggle('is-lean-blue', opts.crowdLean === 'blue');
    this.captionEl.classList.toggle('is-lean-red', opts.crowdLean === 'red');

    const blue = opts.snaps.filter((f) => f.team === 0).sort((a, b) => a.id - b.id);
    const red = opts.snaps.filter((f) => f.team === 1).sort((a, b) => a.id - b.id);
    const ordered = [...blue, ...red];
    for (let i = 0; i < this.chips.length; i++) {
      const f = ordered[i];
      const chip = this.chips[i];
      if (!f) continue;
      chip.bar.firstElementChild!.setAttribute(
        'style',
        `width:${Math.round((f.hp / f.maxHp) * 100)}%`,
      );
      chip.root.classList.toggle('is-selected', f.id === opts.selectedId);
      chip.root.classList.toggle('is-fallen', !f.alive);
      chip.root.classList.toggle('is-muted', !f.alive);
    }

    this.segBtns.forEach((b, i) => {
      b.classList.toggle('is-active', SPEEDS[i] === opts.speed);
    });
    this.pauseBtn.classList.toggle('is-active', opts.paused);
    // Recenter only matters when the camera is manually held.
    this.recenterBtn.classList.toggle('is-hidden', !opts.cameraManual);

    const tk = opts.ticker?.slice(-2).join('\n') ?? '';
    if (tk !== this.lastTickerKey) {
      this.lastTickerKey = tk;
      clear(this.tickerEl);
      for (const line of tk.split('\n')) {
        if (!line) continue;
        this.tickerEl.append(el('span', { className: 'ticker-line', text: line }));
      }
    }

    if (opts.inspect) {
      if (opts.selectedId !== this.lastSelectedId) {
        this.dockEl?.remove();
        this.dockValueEls = [];
        this.dockEl = this.buildDock(opts.inspect);
        this.dockSlot.append(this.dockEl);
      } else {
        this.dockStateEl!.textContent = opts.inspect.stateLine;
        for (let i = 0; i < this.dockValueEls.length; i++) {
          const line = opts.inspect.lines[i];
          if (line) this.dockValueEls[i]!.textContent = line.value;
        }
      }
    } else if (this.dockEl) {
      this.dockEl.remove();
      this.dockEl = null;
      this.dockValueEls = [];
    }
    this.lastSelectedId = opts.selectedId;

    if (opts.debugFeel !== this.lastDebug) {
      this.lastDebug = opts.debugFeel;
      this.debugEl.classList.toggle('is-hidden', !opts.debugFeel);
    }

    const wantOverlay = opts.paused && !opts.finished ? 'pause' : opts.finished ? 'end' : null;
    if (wantOverlay && this.overlayEl?.dataset.kind !== wantOverlay) {
      this.overlayEl?.remove();
      this.overlayEl =
        wantOverlay === 'pause'
          ? this.pauseOverlay(opts.career, opts.muted)
          : this.endOverlay(opts.career, opts.resultLabel, opts.mvp, opts.entertainment);
      this.overlayEl.dataset.kind = wantOverlay;
      this.overlaySlot.append(this.overlayEl);
    } else if (!wantOverlay && this.overlayEl) {
      this.overlayEl.remove();
      this.overlayEl = null;
    }
  }

  private buildDock(inspect: NonNullable<FightHudRender['inspect']>): HTMLElement {
    const dock = el('div', {
      className: `inspect-dock ${inspect.preferLeft ? 'is-left' : 'is-right'}`,
    });
    dock.append(el('h3', { text: inspect.title }));
    dock.append(el('div', { className: 'sub', text: inspect.subtitle }));
    this.dockStateEl = el('div', { className: 'meta', text: inspect.stateLine });
    dock.append(this.dockStateEl);
    const dl = el('dl');
    for (const line of inspect.lines) {
      dl.append(el('dt', { text: line.label }));
      const dd = el('dd', { text: line.value });
      this.dockValueEls.push(dd);
      dl.append(dd);
    }
    dock.append(dl);
    if (inspect.debugLines?.length) {
      for (const d of inspect.debugLines) {
        dock.append(el('div', { className: 'debug-line', text: d }));
      }
    }
    return dock;
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

  private endOverlay(
    career: boolean,
    resultLabel: string,
    mvp?: string | null,
    entertainment?: number,
  ): HTMLElement {
    const ov = el('div', { className: 'overlay' });
    const panel = el('div', { className: 'overlay-panel' });
    panel.append(el('h2', { text: 'Bout over' }));
    panel.append(el('div', { className: 'banner', text: resultLabel }));
    if (mvp) {
      panel.append(el('div', { className: 'banner-sub', text: mvp }));
    }
    if (!career && entertainment != null) {
      panel.append(
        el('p', {
          className: 'ledger',
          text: `Entertainment · ${entertainment} points`,
        }),
      );
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
