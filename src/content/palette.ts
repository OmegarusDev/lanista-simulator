/**
 * Brand / surface colors for Lanista Simulator.
 * Spacing, type, and chrome rules live in `view/theme.ts`.
 */
export const colors = {
  bg: '#1a1410',
  sand: '#c4a574',
  sandDark: '#a8885a',
  stone: '#5c5346',
  ink: '#1f1812',
  parchment: '#e8d9b8',
  accent: '#8b3a2a',
  accentHot: '#c45c3a',
  ally: '#3d6b8c',
  foe: '#8b3a2a',
  hp: '#6b9e4a',
  stamina: '#d4a017',
  poise: '#7a9bb8',
  stun: '#f0e6a8',
  windup: '#e8c47a',
  block: '#8eb4d4',
  panel: 'rgba(28, 22, 16, 0.88)',
  panelSolid: '#1c1610',
  panelBorder: '#8a7355',
  button: '#3a2e24',
  buttonHot: '#5a4534',
  buttonDisabled: '#2a241c',
  buttonText: '#f0e6d0',
  muted: '#9a8b74',
  hairline: 'rgba(138, 115, 85, 0.45)',
  /** Distinct from player chrome — cool slate, not team red/blue */
  debug: '#3a4550',
  debugBorder: '#6a8499',
  debugText: '#b8c8d4',
} as const;
