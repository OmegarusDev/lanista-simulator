/**
 * Brand / surface colors for Lanista Simulator.
 * Spacing, type, and chrome rules live in `view/theme.ts`.
 */
export const colors = {
  /** Must match index.html --shell-bg — letterbox bars share this exact fill. */
  bg: '#1a1410',
  sand: '#c9a978',
  sandDark: '#9a7a4e',
  stone: '#5c5346',
  ink: '#1a1410',
  parchment: '#ead9b4',
  accent: '#9a3e2c',
  accentHot: '#d4653a',
  ally: '#4a7a9a',
  foe: '#9a4030',
  hp: '#6b9e4a',
  stamina: '#d4a017',
  poise: '#7a9bb8',
  stun: '#f0e6a8',
  windup: '#e8c47a',
  block: '#8eb4d4',
  panel: 'rgba(22, 17, 12, 0.92)',
  panelSolid: '#1c1612',
  panelBorder: '#a88860',
  button: '#3d3228',
  buttonHot: '#5c4a38',
  buttonDisabled: '#2a241c',
  buttonText: '#f2e8d4',
  muted: '#9a8b74',
  hairline: 'rgba(168, 136, 96, 0.42)',
  /** Distinct from player chrome — cool slate, not team red/blue */
  debug: '#3a4550',
  debugBorder: '#6a8499',
  debugText: '#b8c8d4',
} as const;
