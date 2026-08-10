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
 * Prefer helpers in `ui.ts` (rail, plaque, cta/button, meter, segmentedControl,
 * shellAtmosphere, hairline, label variants). Fight layout in `layout.ts`;
 * Instant Match stage in `labStage.ts`. Colors in `content/palette.ts`.
 */

import { colors } from '../content/palette';

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
 * Palatino type scale (design px) — use with font stack in ui.ts.
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

/** Shrink floors — fitted labels / captions must not go below these. */
export const typeMin = {
  fit: 12,
  caption: 12,
} as const;

/** Comfortable thumb target in design px (mobile / narrow). */
export const touchTarget = 44;

export const fontStack = '"Palatino Linotype", Palatino, Georgia, serif';

/** Stroke weights */
export const stroke = {
  hairline: 1,
  border: 1.5,
  emphasis: 2,
} as const;

/** Corner radii — modest; avoid pill shapes */
export const radius = {
  sm: 4,
  md: 6,
  lg: 8,
} as const;

/** Surface tokens used by chrome helpers */
export const surface = {
  panelBorder: colors.panelBorder,
  railBorder: colors.railBorder,
  button: colors.button,
  buttonHot: colors.buttonHot,
  buttonActive: colors.accent,
  buttonDisabled: colors.buttonDisabled,
  parchment: colors.parchment,
  muted: colors.muted,
  buttonText: colors.buttonText,
  team0: colors.ally,
  team1: colors.foe,
  hairline: colors.hairline,
} as const;

/** Fight chrome band heights (portrait / landscape via fightStageLayout). */
export const labRails = {
  topH: 52,
  topHPortrait: 56,
  rosterH: 40,
  rosterHPortrait: touchTarget,
  rosterLabelH: 14,
} as const;

export function teamAccent(team: 0 | 1): string {
  return team === 0 ? surface.team0 : surface.team1;
}
