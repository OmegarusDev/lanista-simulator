/**
 * Lanista UI design language — shared tokens + layout bands.
 *
 * Rules (apply to every chrome addition):
 * 1. One job per chrome band. Top = match identity; bottom = playback + pause entry;
 *    pause modal = session (leave/restart/reroll/mute); side dock = inspect;
 *    roster = fighter pick. Do not mix jobs in one band.
 * 2. No card spam / no purple glow / no pill clusters. Panels only when they hold
 *    interaction or a focused inspect. Prefer hairlines and spacing over boxes.
 * 3. World stays clean. Chrome lives in vignette margins; overhead labels stay
 *    bars-only (optional selected name). Never dump debug into the sand.
 * 4. Team color is structural — stripe, chip edge, selection ring — not rainbow UI.
 * 5. Debug chrome must look distinct from player chrome (DEV strip, FEEL badge).
 *
 * DOM chrome lives in `ui/chrome*.css` (tokens via `shell/tokens.ts`).
 * Stage paint / camera geometry in `stagePaint.ts` + `layout.ts`.
 * Colors in `content/palette.ts`.
 */

/** 4px base spacing scale */
export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

/**
 * Palatino type scale (design px) — use with fontStack.
 * Hierarchy: banner > display > title > label > body > meta > eyebrow.
 */
export const typeScale = {
  eyebrow: 12,
  meta: 13,
  body: 15,
  label: 16,
  title: 18,
  display: 26,
  banner: 38,
} as const;

/** Comfortable thumb target in design px (mobile / narrow). */
export const touchTarget = 44;

export const fontStack = '"Palatino Linotype", Palatino, Georgia, serif';

/** Corner radii — modest; avoid pill shapes */
export const radius = {
  sm: 4,
  md: 6,
  lg: 8,
} as const;
