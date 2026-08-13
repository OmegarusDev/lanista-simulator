/** Cached hex→RGB for hot-path palette colors (arena / fighters / meters). */
import { colors } from '../content/palette';
import { hexToRgb, type Vec3 } from './math';

const cache = new Map<string, Vec3>();

export function paletteRgb(hex: string): Vec3 {
  let v = cache.get(hex);
  if (v) return v;
  v = hexToRgb(hex);
  cache.set(hex, v);
  return v;
}

export const PALETTE_RGB = {
  ally: paletteRgb(colors.ally),
  foe: paletteRgb(colors.foe),
  hp: paletteRgb(colors.hp),
  stamina: paletteRgb(colors.stamina),
  poise: paletteRgb(colors.poise),
  sandMid: paletteRgb(colors.sandMid),
  sandDeep: paletteRgb(colors.sandDeep),
  stoneMid: paletteRgb(colors.stoneMid),
  stoneLit: paletteRgb(colors.stoneLit),
} as const;
