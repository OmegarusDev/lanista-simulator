/**
 * Lanista UI design language — shared tokens + layout bands.
 *
 * Rules (apply to every chrome addition):
 * 1. One job per chrome band. Top = match identity; bottom = session + playback;
 *    side dock = inspect; roster = fighter pick. Do not mix jobs in one band.
 * 2. No card spam / no purple glow / no pill clusters. Panels only when they hold
 *    interaction or a focused inspect. Prefer hairlines and spacing over boxes.
 * 3. World stays clean. Chrome lives in vignette margins; overhead labels stay
 *    bars-only (optional selected name). Never dump debug into the sand.
 * 4. Team color is structural — stripe, chip edge, selection ring — not rainbow UI.
 * 5. Debug chrome must look distinct from player chrome (DEV strip, FEEL badge).
 *
 * Prefer helpers in `ui.ts` (panel, button, rosterChip, inspectCard, segmentedControl,
 * hairline, label variants). Colors live in `content/palette.ts`; spacing/type/z here.
 */

import { colors } from '../content/palette';
import { DESIGN_H, DESIGN_W } from '../shell/canvas';

/** 4px base spacing scale */
export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

/** Palatino type scale (px) — use with font stack in ui.ts */
export const typeScale = {
  eyebrow: 10,
  meta: 11,
  body: 13,
  label: 14,
  title: 16,
  display: 22,
  banner: 34,
} as const;

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

/** Panel / button surface tokens (aliases into palette) */
export const surface = {
  panel: colors.panel,
  panelBorder: colors.panelBorder,
  panelFillSolid: colors.panelSolid,
  button: colors.button,
  buttonHot: colors.buttonHot,
  buttonActive: colors.accent,
  buttonDisabled: colors.buttonDisabled,
  ink: colors.ink,
  parchment: colors.parchment,
  muted: colors.muted,
  buttonText: colors.buttonText,
  team0: colors.ally,
  team1: colors.foe,
  debug: colors.debug,
  debugText: colors.debugText,
  hairline: colors.hairline,
} as const;

/**
 * Paint order bands (documentation / future layering).
 * Canvas2D draws in call order; keep world → fx → chrome → modal.
 */
export const zBand = {
  world: 0,
  worldFx: 1,
  chrome: 10,
  inspect: 11,
  debug: 12,
  modal: 20,
} as const;

/** Fight chrome geometry — 960×540 */
export const fightLayout = {
  topBandH: 48,
  /** Team eyebrow + chip row */
  rosterLabelH: 12,
  rosterH: 38,
  bottomCtrlH: 44,
  bottomPad: 8,
  inspectW: 224,
  inspectMaxH: 300,
  inspectPad: 12,
  chipGap: 6,
  hitRadius: 22,
} as const;

export function fightBottomY(): number {
  return DESIGN_H - fightLayout.bottomPad - fightLayout.bottomCtrlH;
}

/** Y of roster chip row (below team eyebrows). */
export function fightRosterY(): number {
  return (
    fightBottomY() - space.sm - fightLayout.rosterH
  );
}

export function fightRosterBandTop(): number {
  return fightRosterY() - fightLayout.rosterLabelH;
}

export function fightChromeBottomH(): number {
  return (
    fightLayout.rosterLabelH +
    fightLayout.rosterH +
    space.sm +
    fightLayout.bottomCtrlH +
    fightLayout.bottomPad
  );
}

export function teamAccent(team: 0 | 1): string {
  return team === 0 ? surface.team0 : surface.team1;
}

/** Design canvas size re-export for chrome math */
export const canvasSize = { w: DESIGN_W, h: DESIGN_H } as const;
