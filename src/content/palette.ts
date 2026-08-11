/**
 * Amphitheatre design contract — Mediterranean dusk, carved stone + bronze.
 * `bg` MUST match shell atmosphere base. Bump `PALETTE_REV` when tokens change
 * so arena/lab plate caches invalidate.
 */
export const PALETTE_REV = 6;

export const colors = {
  /** Full-bleed atmosphere base (matches screen-space backdrop deep stop). */
  bg: '#14181e',
  /** Near-black for ink / deep shadow. */
  ink: '#0c1014',
  /** Warm parchment for display type. */
  parchment: '#e8dcc4',
  /** Roman bronze. */
  bronze: '#b8954a',
  bronzeHot: '#d4b06a',
  /** Pompeian red — accent, not brochure terracotta. */
  accent: '#7a2e24',
  accentHot: '#a84838',
  /** Team identity — structural only. */
  ally: '#2f6a7a',
  foe: '#8a3428',
  hp: '#6a9a48',
  stamina: '#c9a028',
  poise: '#6a8aa0',
  panel: 'rgba(18, 22, 28, 0.72)',
  panelBorder: '#b8954a',
  rail: 'rgba(16, 20, 26, 0.55)',
  railBorder: 'rgba(184, 149, 74, 0.55)',
  button: '#2a323c',
  buttonHot: '#3a4652',
  buttonDisabled: '#1a2028',
  buttonText: '#f0e6d4',
  muted: '#8a8490',
  hairline: 'rgba(184, 149, 74, 0.32)',
  grout: '#1e242c',
  debug: '#2a3848',
  debugBorder: '#5a7890',
  debugText: '#b0c4d4',
  /** World atmosphere stops — continuous sky→cavea wash (screen + plate). */
  skyHigh: '#1a2430',
  skyMid: '#243038',
  skyLow: '#2a2824',
  sandLit: '#d8c090',
  sandMid: '#b89868',
  sandDeep: '#7a6040',
  stoneLit: '#8a8478',
  stoneMid: '#5a564c',
  stoneDeep: '#2e2c28',
} as const;
