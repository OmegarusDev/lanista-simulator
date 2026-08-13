/** Shared modal layer — confirm dialogs, help panels, farewell screen. */
import { btn, clear, el } from './dom';

export interface ModalOpts {
  title: string;
  body: HTMLElement | string;
  danger?: boolean;
  confirmLabel?: string;
  onConfirm?: () => void;
  cancelLabel?: string;
  onCancel?: () => void;
}

let layer: HTMLElement | null = null;

function host(): HTMLElement {
  if (!layer) {
    layer = el('div', { className: 'modal-layer is-hidden' });
    document.body.append(layer);
    window.addEventListener(
      'keydown',
      (e) => {
        if (e.code === 'Escape' && isModalOpen()) {
          e.stopPropagation();
          dismissModal();
        }
      },
      true,
    );
  }
  return layer;
}

export function isModalOpen(): boolean {
  return !!layer && !layer.classList.contains('is-hidden');
}

export function dismissModal(): void {
  if (!layer) return;
  layer.classList.add('is-hidden');
  clear(layer);
}

function open(panel: HTMLElement): void {
  const h = host();
  clear(h);
  h.append(panel);
  h.classList.remove('is-hidden');
  (panel.querySelector('button') as HTMLButtonElement | null)?.focus();
}

function panel(title: string, body: HTMLElement | string, actions: HTMLElement): HTMLElement {
  const p = el('div', { className: 'modal-panel' });
  const hdr = el('div', { className: 'modal-title', text: title });
  const bodyEl =
    typeof body === 'string' ? el('div', { className: 'modal-body', text: body }) : body;
  if (!(bodyEl instanceof HTMLDivElement)) bodyEl.classList.add('modal-body');
  const actionsWrap = el('div', { className: 'modal-actions' });
  actionsWrap.append(actions);
  p.append(hdr, bodyEl, actionsWrap);
  return p;
}

/** Confirmation dialog — returns a close handle. */
export function confirmModal(opts: ModalOpts): () => void {
  const actions = el('div');
  const cancel = btn(opts.cancelLabel ?? 'Cancel', {
    className: 'ghost',
    onClick: () => {
      dismissModal();
      opts.onCancel?.();
    },
  });
  const confirm = btn(opts.confirmLabel ?? 'Confirm', {
    className: opts.danger ? 'danger' : 'cta',
    onClick: () => {
      dismissModal();
      opts.onConfirm?.();
    },
  });
  actions.append(cancel, confirm);
  const p = panel(opts.title, opts.body, actions);
  open(p);
  return dismissModal;
}

/** Info dialog — single dismiss button + optional Esc. */
export function infoModal(opts: ModalOpts): () => void {
  const actions = el('div');
  const ok = btn(opts.confirmLabel ?? 'Close', {
    className: 'cta',
    onClick: () => {
      dismissModal();
      opts.onConfirm?.();
    },
  });
  actions.append(ok);
  const p = panel(opts.title, opts.body, actions);
  open(p);
  return dismissModal;
}

/** Multi-section help panel. */
export function helpModal(opts: { title: string; sections: { label: string; lines: string[] }[] }): () => void {
  const body = el('div', { className: 'modal-body help-body' });
  for (const s of opts.sections) {
    body.append(el('p', { className: 'modal-section', text: s.label }));
    for (const line of s.lines) {
      body.append(el('p', { className: 'modal-line', text: line }));
    }
  }
  return infoModal({ title: opts.title, body });
}

/** Exit flow — farewell panel; attempts window.close() for script-opened tabs. */
export function farewellModal(onDone: () => void): void {
  const body = el('div', { className: 'modal-body' });
  body.append(
    el('p', {
      className: 'modal-line',
      text: 'The gates close for the night. Your season is saved — you may close this tab safely.',
    }),
  );
  const actions = el('div');
  actions.append(
    btn('Stay in the Ludus', {
      className: 'cta',
      onClick: () => {
        dismissModal();
        onDone();
      },
    }),
  );
  actions.append(
    btn('Close Tab', {
      className: 'danger',
      onClick: () => {
        dismissModal();
        onDone();
        window.close();
      },
    }),
  );
  const p = panel('Exit', body, actions);
  open(p);
}