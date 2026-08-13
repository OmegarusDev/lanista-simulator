/** Transient feedback notices — bottom edge, above the stage chrome. */
import { clear, el } from './dom';

let layer: HTMLElement | null = null;

function host(): HTMLElement {
  if (!layer) {
    layer = el('div', { className: 'toast-layer' });
    document.body.append(layer);
  }
  return layer;
}

export function toast(text: string, kind: 'info' | 'good' | 'bad' = 'info'): void {
  const h = host();
  const t = el('div', { className: `toast is-${kind}`, text: text, attrs: { role: 'status' } });
  h.append(t);
  window.setTimeout(() => {
    t.classList.add('is-out');
    window.setTimeout(() => t.remove(), 320);
  }, 2600);
  while (h.children.length > 3) h.firstElementChild?.remove();
  return;
}

export function clearToasts(): void {
  if (layer) clear(layer);
}