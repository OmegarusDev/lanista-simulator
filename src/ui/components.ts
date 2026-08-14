/**
 * Chrome components — the ONLY way UI pieces are built.
 *
 * Design-language contract (see view/theme.ts for the full rules):
 * - One button vocabulary: default (secondary) · cta (primary) · ghost/quiet
 *   (tertiary) · danger (destructive). Never ad-hoc styling.
 * - One multi-choice control: the segmented picker.
 * - One label style: the section label.
 * Everything here emits token-driven classes; new chrome = new component here,
 * never raw class strings scattered through views.
 */
import { btn, el } from './dom';

export type ButtonVariant = 'default' | 'cta' | 'ghost' | 'quiet' | 'danger';

export interface ButtonOpts {
  variant?: ButtonVariant;
  active?: boolean;
  disabled?: boolean;
  title?: string;
  onClick?: () => void;
  /** Structural classes only (layout hooks, team caps) — never styling. */
  extraClass?: string;
}

/** Carved-stone control. `variant` is the whole style vocabulary. */
export function button(label: string, opts: ButtonOpts = {}): HTMLButtonElement {
  const cls = [
    opts.variant && opts.variant !== 'default' ? opts.variant : undefined,
    opts.extraClass,
  ]
    .filter(Boolean)
    .join(' ');
  return btn(label, {
    className: cls || undefined,
    active: opts.active,
    disabled: opts.disabled,
    title: opts.title,
    onClick: opts.onClick,
  });
}

/** Segmented picker — the only multi-choice control in the language. */
export function segControl(
  labels: readonly string[],
  selected: number,
  onPick: (i: number) => void,
): HTMLDivElement {
  const row = el('div', { className: 'seg' });
  labels.forEach((lab, i) => {
    row.append(button(lab, { active: i === selected, onClick: () => onPick(i) }));
  });
  return row;
}

/** Section heading — the only subheading style. */
export function sectionLabel(text: string): HTMLElement {
  return el('p', { className: 'section-label', text });
}

/** List row — the standard row for scrollable tab bodies. */
export function listRow(
  copy: HTMLElement,
  action?: HTMLElement | null,
  extraClass = '',
): HTMLElement {
  const row = el('div', { className: `list-row${extraClass ? ` ${extraClass}` : ''}` });
  row.append(copy);
  if (action) row.append(action);
  return row;
}
