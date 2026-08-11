/**
 * Lanista UI design language — shared tokens + layout bands.
 *
 * Representation contract (world vs chrome):
 * - World (WebGL under `src/gl/`): kit parts, appearanceSeed, team rim, alive/KO,
 *   action phase, intention stance, poise tier, meters, beasts, combat FX, crowd shimmer.
 * - Chrome (DOM under `src/ui/`): decisions — CTAs, day/denarii, lineup legality,
 *   favor/playback, aftermath purse. Never bury identity only in inspect dumps.
 *
 * Rules (apply to every chrome addition):
 * 1. One job per chrome band. Top = match identity (format, favor, crowd);
 *    bottom = roster pick + playback + pause entry; pause modal = session only
 *    (leave/restart/reroll/mute); side dock = inspect. Do not mix jobs in one band.
 * 2. Career chrome surfaces decisions: who fights, money, day. Demote secondary
 *    metadata (traits, morale, upkeep, seed) into detail / inspect / quiet chrome.
 * 3. Action hierarchy: `.cta` = one primary per surface; default button = secondary;
 *    `.ghost` / `.quiet` = tertiary / navigate-away. Never three equal CTAs.
 * 4. No card spam / no purple glow / no pill clusters. Panels only when they hold
 *    interaction or a focused inspect. Prefer hairlines and spacing over boxes.
 * 5. World stays clean. Canvas is full-bleed WebGL; chrome floats translucent over it.
 *    Overhead labels stay bars-only (optional selected name). Never dump debug into the sand.
 * 6. Team color is structural — stripe, chip edge, selection ring — not rainbow UI.
 * 7. Debug chrome must look distinct from player chrome (DEV strip, FEEL badge).
 * 8. Stage hit-testing: HUD/practice roots are `pointer-events: none`; only rails
 *    and real controls re-enable events so wheel/pinch/orbit reach the canvas.
 *
 * DOM chrome lives in `ui/chrome*.css` (tokens via `shell/tokens.ts`).
 * Stage / camera: `src/gl/` (perspective amphitheatre). Draw model: `src/gl/drawModel.ts`.
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
export const touchTarget = 48;

export const fontStack = '"Palatino Linotype", Palatino, "Book Antiqua", Georgia, serif';

/** Corner radii — carved tablet, not pills */
export const radius = {
  sm: 3,
  md: 5,
  lg: 7,
} as const;
