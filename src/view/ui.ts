import { colors } from '../content/palette';
import type { PointerState } from '../shell/input';
import {
  fontStack,
  radius,
  space,
  stroke,
  surface,
  teamAccent,
  typeMin,
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
  // Carved stone plate — depth without card clutter
  ctx.fillStyle = 'rgba(10,7,5,0.35)';
  roundRect(ctx, r.x + 2, r.y + 3, r.w, r.h, radius.lg);
  ctx.fill();

  const g = ctx.createLinearGradient(r.x, r.y, r.x, r.y + r.h);
  g.addColorStop(0, 'rgba(48,38,28,0.94)');
  g.addColorStop(0.5, 'rgba(28,22,16,0.92)');
  g.addColorStop(1, 'rgba(18,14,10,0.94)');
  ctx.fillStyle = g;
  ctx.strokeStyle = 'rgba(160,130,95,0.55)';
  ctx.lineWidth = stroke.emphasis;
  roundRect(ctx, r.x, r.y, r.w, r.h, radius.lg);
  ctx.fill();
  ctx.stroke();

  // Inner highlight lip
  ctx.strokeStyle = 'rgba(220,190,140,0.12)';
  ctx.lineWidth = 1;
  roundRect(ctx, r.x + 1.5, r.y + 1.5, r.w - 3, r.h - 3, radius.md);
  ctx.stroke();

  if (title) {
    label(ctx, title, r.x + space.md + 2, r.y + space.md + 2, { variant: 'title' });
  }
}

/** Soft sky + vignette behind chrome for menu shells (title/sandbox/ludus). */
export function shellAtmosphere(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, '#3a281c');
  sky.addColorStop(0.4, '#241810');
  sky.addColorStop(1, colors.bg);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);

  const glow = ctx.createRadialGradient(w / 2, h * 0.28, 10, w / 2, h * 0.45, Math.max(w, h) * 0.58);
  glow.addColorStop(0, 'rgba(200,130,60,0.1)');
  glow.addColorStop(0.55, 'rgba(60,40,24,0.05)');
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, w, h);

  const vig = ctx.createRadialGradient(w / 2, h * 0.42, Math.min(w, h) * 0.22, w / 2, h / 2, Math.max(w, h) * 0.75);
  vig.addColorStop(0, 'rgba(0,0,0,0)');
  vig.addColorStop(1, 'rgba(8,5,3,0.42)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, w, h);
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

/**
 * Largest font size where every line fits in `maxW` and the stacked block fits in `maxH`.
 * Used by fitted multi-line button labels (e.g. Instant Match historical matchups).
 */
export function fitFontSize(
  ctx: CanvasRenderingContext2D,
  lines: readonly string[],
  maxW: number,
  maxH: number,
  opts?: { min?: number; max?: number; weight?: string; lineGapRatio?: number },
): number {
  const n = lines.length;
  if (n === 0 || maxW <= 0 || maxH <= 0) return opts?.min ?? typeMin.fit;
  const min = opts?.min ?? typeMin.fit;
  const maxCap = opts?.max ?? typeScale.display;
  const weight = opts?.weight ?? '600';
  const gapRatio = opts?.lineGapRatio ?? 0.18;

  // Height budget: n * size + (n-1) * gapRatio * size
  const heightFactor = n + Math.max(0, n - 1) * gapRatio;
  let lo = min;
  let hi = Math.min(maxCap, Math.floor(maxH / heightFactor));
  if (hi < min) return min;

  let best = min;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    ctx.font = `${weight} ${mid}px ${fontStack}`;
    let fits = true;
    for (const line of lines) {
      if (ctx.measureText(line).width > maxW) {
        fits = false;
        break;
      }
    }
    if (fits) {
      best = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return best;
}

/** Centered multi-line label sized to fill a rect (width + height). */
export function labelFitted(
  ctx: CanvasRenderingContext2D,
  lines: readonly string[],
  r: Rect,
  opts?: {
    color?: string;
    weight?: string;
    padX?: number;
    padY?: number;
    min?: number;
    max?: number;
    yOffset?: number;
  },
): void {
  const n = lines.length;
  if (n === 0) return;
  const padX = opts?.padX ?? 5;
  const padY = opts?.padY ?? 3;
  const weight = opts?.weight ?? '600';
  const gapRatio = 0.18;
  const maxW = Math.max(1, r.w - padX * 2);
  const maxH = Math.max(1, r.h - padY * 2);
  const size = fitFontSize(ctx, lines, maxW, maxH, {
    min: opts?.min,
    max: opts?.max,
    weight,
    lineGapRatio: gapRatio,
  });
  const gap = size * gapRatio;
  const step = size + gap;
  const blockH = n * size + Math.max(0, n - 1) * gap;
  const midY = r.y + r.h / 2 + (opts?.yOffset ?? 0);
  const firstMid = midY - blockH / 2 + size / 2;

  ctx.fillStyle = opts?.color ?? surface.buttonText;
  ctx.font = `${weight} ${size}px ${fontStack}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const cx = r.x + r.w / 2;
  for (let i = 0; i < n; i++) {
    ctx.fillText(lines[i]!, cx, firstMid + i * step);
  }
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
  const y = r.y + (pressed ? 1 : 0);

  // Drop shadow / carved depth
  if (!opts?.disabled && !pressed) {
    ctx.fillStyle = 'rgba(8,5,3,0.4)';
    roundRect(ctx, r.x + 1, r.y + 2, r.w, r.h, radius.md);
    ctx.fill();
  }

  let top: string;
  let mid: string;
  let bot: string;
  if (opts?.disabled) {
    top = mid = bot = surface.buttonDisabled;
  } else if (opts?.active) {
    const a = accent ?? surface.buttonActive;
    top = accent ? a : '#b04a36';
    mid = a;
    bot = accent ? 'rgba(0,0,0,0.45)' : '#5a2418';
  } else if (hovered) {
    top = '#6a5240';
    mid = surface.buttonHot;
    bot = '#3a2a1e';
  } else {
    top = '#4a3c30';
    mid = surface.button;
    bot = '#2a2018';
  }

  const g = ctx.createLinearGradient(r.x, y, r.x, y + r.h);
  g.addColorStop(0, top);
  g.addColorStop(0.45, mid);
  g.addColorStop(1, bot);
  ctx.fillStyle = g;
  ctx.strokeStyle = opts?.active ? (accent ?? colors.accentHot) : surface.panelBorder;
  ctx.lineWidth = stroke.emphasis;
  roundRect(ctx, r.x, y, r.w, r.h, radius.md);
  ctx.fill();
  ctx.stroke();

  // Inner highlight lip (pressed = darker inset)
  if (!opts?.disabled) {
    ctx.strokeStyle = pressed ? 'rgba(0,0,0,0.35)' : 'rgba(230,200,150,0.14)';
    ctx.lineWidth = 1;
    roundRect(ctx, r.x + 1.5, y + 1.5, r.w - 3, r.h - 3, radius.sm);
    ctx.stroke();
  }

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
  opts?: { active?: boolean; disabled?: boolean; accent?: string; size?: number },
): boolean {
  const { pressed, clicked } = buttonChrome(ctx, r, pointer, opts);
  ctx.fillStyle = opts?.disabled ? surface.muted : surface.buttonText;
  ctx.font = `600 ${opts?.size ?? typeScale.label}px ${fontStack}`;
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
  // Carved trough
  ctx.fillStyle = 'rgba(8,5,3,0.35)';
  roundRect(ctx, r.x + 1, r.y + 2, r.w, r.h, radius.md);
  ctx.fill();
  const trough = ctx.createLinearGradient(r.x, r.y, r.x, r.y + r.h);
  trough.addColorStop(0, '#2a221a');
  trough.addColorStop(1, '#3a3028');
  ctx.fillStyle = trough;
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
      const ag = ctx.createLinearGradient(sr.x, sr.y, sr.x, sr.y + sr.h);
      ag.addColorStop(0, '#b04a36');
      ag.addColorStop(0.5, surface.buttonActive);
      ag.addColorStop(1, '#5a2418');
      ctx.fillStyle = ag;
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
    ctx.font = `600 ${typeScale.label}px ${fontStack}`;
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
  /** Optional 0–1 crowd favor meter (fight roster) */
  favor01?: number;
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
  label(ctx, opts.tag, textX, midY - 5, {
    variant: 'value',
    size: typeScale.body,
    color: opts.muted ? surface.muted : surface.parchment,
  });
  label(ctx, opts.name, textX, midY + 12, {
    variant: 'meta',
    color: surface.muted,
  });

  // HP (+ optional crowd favor) fragment on the right
  const barW = Math.min(32, Math.max(22, r.w * 0.22));
  const barH = opts.favor01 !== undefined ? 4 : 5;
  const bx = r.x + r.w - barW - space.sm;
  const by = opts.favor01 !== undefined ? midY - 6 : midY - 2;
  bar(ctx, bx, by, barW, barH, opts.hpRatio, opts.muted ? surface.muted : colors.hp);
  if (opts.favor01 !== undefined) {
    bar(
      ctx,
      bx,
      by + barH + 2,
      barW,
      barH,
      opts.favor01,
      opts.muted ? surface.muted : colors.stamina,
    );
  }

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
  y += 22;
  label(ctx, opts.subtitle, x, y, { variant: 'meta' });
  y += 16;
  hairline(ctx, x, y, r.x + r.w - pad, y);
  y += 18;

  label(ctx, opts.stateLine, x, y, {
    variant: 'value',
    color: surface.parchment,
  });
  y += 20;

  for (const row of opts.lines) {
    label(ctx, row.label, x, y, { variant: 'meta' });
    label(ctx, row.value, r.x + r.w - pad, y, {
      variant: 'value',
      align: 'right',
    });
    y += 18;
  }

  if (opts.debugLines && opts.debugLines.length > 0) {
    y += 6;
    // Distinct DEV block inside inspect
    const dh = 14 + opts.debugLines.length * 15;
    ctx.fillStyle = 'rgba(58, 69, 80, 0.55)';
    ctx.strokeStyle = colors.debugBorder;
    ctx.lineWidth = stroke.hairline;
    roundRect(ctx, x - 4, y - 4, r.w - pad * 2 - 2, dh, radius.sm);
    ctx.fill();
    ctx.stroke();
    label(ctx, 'FEEL', x, y + 10, {
      variant: 'eyebrow',
      color: colors.debugText,
    });
    y += 20;
    for (const line of opts.debugLines) {
      label(ctx, line, x, y, {
        variant: 'eyebrow',
        color: colors.debugText,
      });
      y += 15;
    }
  }
}

/** Corner badge when feel-debug is on. */
export function debugBadge(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  const r: Rect = { x, y, w: 48, h: 20 };
  ctx.fillStyle = colors.debug;
  ctx.strokeStyle = colors.debugBorder;
  ctx.lineWidth = stroke.hairline;
  roundRect(ctx, r.x, r.y, r.w, r.h, radius.sm);
  ctx.fill();
  ctx.stroke();
  label(ctx, 'FEEL', r.x + r.w / 2, r.y + 14, {
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
