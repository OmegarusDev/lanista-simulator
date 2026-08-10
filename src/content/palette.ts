/**
 * Mosaic + sword-and-sandal palette.
 * `bg` MUST match index.html `--shell-bg`.
 * Bump `PALETTE_REV` when tokens change so arena/lab plate caches invalidate.
 */
export const PALETTE_REV = 3;

export const colors = {
  bg: '#1a1410',
  ink: '#1a1410',
  parchment: '#ead9b4',
  bronze: '#c49a55',
  bronzeHot: '#e0b86a',
  accent: '#8a3a2a',
  accentHot: '#c06040',
  ally: '#3a6a88',
  foe: '#8a3a30',
  hp: '#6b9e4a',
  stamina: '#d4a017',
  poise: '#7a9bb8',
  panel: 'rgba(40, 28, 18, 0.94)',
  panelBorder: '#c49a55',
  rail: 'rgba(40, 28, 18, 0.94)',
  railBorder: '#c49a55',
  button: '#4a3424',
  buttonHot: '#6a4a32',
  buttonDisabled: '#2a2018',
  buttonText: '#f2e8d4',
  muted: '#a09078',
  hairline: 'rgba(196, 154, 85, 0.4)',
  grout: '#2a2218',
  debug: '#3a4550',
  debugBorder: '#6a8499',
  debugText: '#b8c8d4',
} as const;
