import { colors } from '../content/palette';
import type { PointerState } from '../shell/input';
import {
  fontStack,
  radius,
  space,
  stroke,
  surface,
  teamAccent,
  typeScale,
} from './theme';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function hit(r: Rect, x: number, y: number): boolean {
  return x >= r.x && y >= r.y && x <= r.x + r.w && y <= r.y + r.h;
}

export function panel(ctx: CanvasRenderingContext2D, r: Rect, title?: string): void {
  ctx.fillStyle = surface.panel;
  ctx.strokeStyle = surface.panelBorder;
  ctx.lineWidth = stroke.emphasis;
  roundRect(ctx, r.x, r.y, r.w, r.h, radius.lg);
  ctx.fill();
  ctx.stroke();
  if (title) {
    label(ctx, title, r.x + space.md + 2, r.y + space.md + 2, { variant: 'title' });
  }
}

/** Thin rule for chrome structure (not a card). */
export function hairline(
  ctx: CanvasRenderingContext2D,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  color: string = surface.hairline,
): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = stroke.hairline;
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.stroke();
}

export type LabelVariant = 'eyebrow' | 'title' | 'meta' | 'value' | 'body';

export function label(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  opts?: {
    size?: number;
    color?: string;
    align?: CanvasTextAlign;
    variant?: LabelVariant;
    weight?: string;
  },
): void {
  const variant = opts?.variant;
  let size = opts?.size ?? typeScale.label;
  let color = opts?.color ?? surface.parchment;
  let weight = opts?.weight ?? '600';
  if (variant === 'eyebrow') {
    size = opts?.size ?? typeScale.eyebrow;
    color = opts?.color ?? surface.muted;
    weight = opts?.weight ?? '600';
  } else if (variant === 'title') {
    size = opts?.size ?? typeScale.title;
    color = opts?.color ?? surface.parchment;
  } else if (variant === 'meta') {
    size = opts?.size ?? typeScale.meta;
    color = opts?.color ?? surface.muted;
    weight = opts?.weight ?? '500';
  } else if (variant === 'value') {
    size = opts?.size ?? typeScale.body;
    color = opts?.color ?? surface.parchment;
  } else if (variant === 'body') {
    size = opts?.size ?? typeScale.body;
    color = opts?.color ?? surface.parchment;
    weight = opts?.weight ?? '500';
  }
  ctx.fillStyle = color;
  ctx.font = `${weight} ${size}px ${fontStack}`;
  ctx.textAlign = opts?.align ?? 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(text, x, y);
}

export function buttonChrome(
  ctx: CanvasRenderingContext2D,
  r: Rect,
  pointer: PointerState,
  opts?: { active?: boolean; disabled?: boolean; accent?: string },
): { hovered: boolean; pressed: boolean; clicked: boolean } {
  const hovered = !opts?.disabled && hit(r, pointer.x, pointer.y);
  const pressed = hovered && pointer.down;
  const accent = opts?.accent;
  ctx.fillStyle = opts?.disabled
    ? surface.buttonDisabled
    : opts?.active
      ? (accent ?? surface.buttonActive)
      : hovered
        ? surface.buttonHot
        : surface.button;
  ctx.strokeStyle = opts?.active ? (accent ?? colors.accentHot) : surface.panelBorder;
  ctx.lineWidth = stroke.emphasis;
  roundRect(ctx, r.x, r.y + (pressed ? 1 : 0), r.w, r.h, radius.md);
  ctx.fill();
  ctx.stroke();
  const clicked = Boolean(hovered && pointer.clicked && !opts?.disabled);
  // First handler wins — prevent one click from activating stacked controls.
  if (clicked) pointer.clicked = false;
  return { hovered, pressed, clicked };
}

export function button(
  ctx: CanvasRenderingContext2D,
  r: Rect,
  text: string,
  pointer: PointerState,
  opts?: { active?: boolean; disabled?: boolean; accent?: string },
): boolean {
  const { pressed, clicked } = buttonChrome(ctx, r, pointer, opts);
  ctx.fillStyle = opts?.disabled ? surface.muted : surface.buttonText;
  ctx.font = `600 ${typeScale.label}px ${fontStack}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, r.x + r.w / 2, r.y + r.h / 2 + (pressed ? 1 : 0));
  return clicked;
}

export function bar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  ratio: number,
  fill: string,
): void {
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = fill;
  ctx.fillRect(x, y, Math.max(0, w * Math.min(1, Math.max(0, ratio))), h);
  ctx.strokeStyle = 'rgba(0,0,0,0.4)';
  ctx.strokeRect(x, y, w, h);
}

/** Mutual-exclusive speed / mode strip — one active segment. */
export function segmentedControl(
  ctx: CanvasRenderingContext2D,
  r: Rect,
  options: readonly string[],
  activeIndex: number,
  pointer: PointerState,
): number | null {
  const n = options.length;
  if (n === 0) return null;
  const segW = r.w / n;
  ctx.fillStyle = surface.button;
  ctx.strokeStyle = surface.panelBorder;
  ctx.lineWidth = stroke.border;
  roundRect(ctx, r.x, r.y, r.w, r.h, radius.md);
  ctx.fill();
  ctx.stroke();

  let clicked: number | null = null;
  for (let i = 0; i < n; i++) {
    const sr: Rect = { x: r.x + i * segW, y: r.y, w: segW, h: r.h };
    const hovered = hit(sr, pointer.x, pointer.y);
    const active = i === activeIndex;
    if (active) {
      ctx.fillStyle = surface.buttonActive;
      roundRect(ctx, sr.x + 1, sr.y + 1, sr.w - 2, sr.h - 2, radius.sm);
      ctx.fill();
    } else if (hovered) {
      ctx.fillStyle = surface.buttonHot;
      roundRect(ctx, sr.x + 1, sr.y + 1, sr.w - 2, sr.h - 2, radius.sm);
      ctx.fill();
    }
    if (i > 0) {
      hairline(ctx, sr.x, r.y + 4, sr.x, r.y + r.h - 4, 'rgba(0,0,0,0.35)');
    }
    ctx.fillStyle = active ? surface.buttonText : surface.muted;
    ctx.font = `600 ${typeScale.meta}px ${fontStack}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(options[i]!, sr.x + sr.w / 2, sr.y + sr.h / 2);
    if (hovered && pointer.clicked) {
      pointer.clicked = false;
      clicked = i;
    }
  }
  return clicked;
}

export interface RosterChipOpts {
  name: string;
  /** Short class / kit tag */
  tag: string;
  team: 0 | 1;
  hpRatio: number;
  selected?: boolean;
  disabled?: boolean;
  /** KO / fallen */
  muted?: boolean;
}

/** Clickable fighter control for the roster band. */
export function rosterChip(
  ctx: CanvasRenderingContext2D,
  r: Rect,
  pointer: PointerState,
  opts: RosterChipOpts,
): boolean {
  const accent = teamAccent(opts.team);
  const hovered = !opts.disabled && hit(r, pointer.x, pointer.y);
  const pressed = hovered && pointer.down;
  const selected = Boolean(opts.selected);

  ctx.globalAlpha = opts.muted ? 0.45 : 1;
  ctx.fillStyle = selected ? 'rgba(40, 32, 24, 0.95)' : hovered ? surface.buttonHot : surface.button;
  ctx.strokeStyle = selected ? accent : surface.panelBorder;
  ctx.lineWidth = selected ? stroke.emphasis : stroke.border;
  roundRect(ctx, r.x, r.y + (pressed ? 1 : 0), r.w, r.h, radius.md);
  ctx.fill();
  ctx.stroke();

  // Team stripe
  ctx.fillStyle = accent;
  ctx.fillRect(r.x + 1, r.y + (pressed ? 1 : 0) + 3, 3, r.h - 6);

  const textX = r.x + space.md + 2;
  const midY = r.y + r.h / 2 + (pressed ? 1 : 0);
  label(ctx, opts.tag, textX, midY - 4, {
    variant: 'value',
    size: typeScale.body,
    color: opts.muted ? surface.muted : surface.parchment,
  });
  label(ctx, opts.name, textX, midY + 10, {
    variant: 'meta',
    size: 9,
    color: surface.muted,
  });

  // Tiny HP fragment on the right
  const barW = 28;
  const barH = 4;
  const bx = r.x + r.w - barW - space.sm;
  const by = midY - 2;
  bar(ctx, bx, by, barW, barH, opts.hpRatio, opts.muted ? surface.muted : colors.hp);

  ctx.globalAlpha = 1;
  const clicked = Boolean(hovered && pointer.clicked && !opts.disabled);
  if (clicked) pointer.clicked = false;
  return clicked;
}

export interface InspectCardOpts {
  title: string;
  subtitle: string;
  team: 0 | 1;
  lines: readonly { label: string; value: string }[];
  stateLine: string;
  /** Optional debug block — rendered with debug surface */
  debugLines?: readonly string[];
}

/** Docked fighter inspect panel (player chrome). */
export function inspectCard(ctx: CanvasRenderingContext2D, r: Rect, opts: InspectCardOpts): void {
  const accent = teamAccent(opts.team);
  ctx.fillStyle = surface.panel;
  ctx.strokeStyle = surface.panelBorder;
  ctx.lineWidth = stroke.emphasis;
  roundRect(ctx, r.x, r.y, r.w, r.h, radius.lg);
  ctx.fill();
  ctx.stroke();

  // Structural team stripe
  ctx.fillStyle = accent;
  ctx.fillRect(r.x, r.y + radius.md, 4, r.h - radius.md * 2);

  const pad = space.md + 2;
  let y = r.y + pad + 2;
  const x = r.x + pad + 6;

  label(ctx, opts.title, x, y + 2, { variant: 'title' });
  y += 18;
  label(ctx, opts.subtitle, x, y, { variant: 'meta' });
  y += 14;
  hairline(ctx, x, y, r.x + r.w - pad, y);
  y += 16;

  label(ctx, opts.stateLine, x, y, {
    variant: 'value',
    color: surface.parchment,
  });
  y += 18;

  for (const row of opts.lines) {
    label(ctx, row.label, x, y, { variant: 'meta' });
    label(ctx, row.value, r.x + r.w - pad, y, {
      variant: 'value',
      align: 'right',
    });
    y += 15;
  }

  if (opts.debugLines && opts.debugLines.length > 0) {
    y += 6;
    // Distinct DEV block inside inspect
    const dh = 12 + opts.debugLines.length * 13;
    ctx.fillStyle = 'rgba(58, 69, 80, 0.55)';
    ctx.strokeStyle = colors.debugBorder;
    ctx.lineWidth = stroke.hairline;
    roundRect(ctx, x - 4, y - 4, r.w - pad * 2 - 2, dh, radius.sm);
    ctx.fill();
    ctx.stroke();
    label(ctx, 'FEEL', x, y + 8, {
      variant: 'eyebrow',
      color: colors.debugText,
    });
    y += 18;
    for (const line of opts.debugLines) {
      label(ctx, line, x, y, {
        variant: 'meta',
        size: 10,
        color: colors.debugText,
      });
      y += 13;
    }
  }
}

/** Corner badge when feel-debug is on. */
export function debugBadge(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  const r: Rect = { x, y, w: 44, h: 18 };
  ctx.fillStyle = colors.debug;
  ctx.strokeStyle = colors.debugBorder;
  ctx.lineWidth = stroke.hairline;
  roundRect(ctx, r.x, r.y, r.w, r.h, radius.sm);
  ctx.fill();
  ctx.stroke();
  label(ctx, 'FEEL', r.x + r.w / 2, r.y + 13, {
    variant: 'eyebrow',
    align: 'center',
    color: colors.debugText,
  });
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  rad: number,
): void {
  const rr = Math.min(rad, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}
