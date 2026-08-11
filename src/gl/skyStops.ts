/** Shared sky color stops — used by sky clear, sky shader, and DOM atmosphere tokens. */
import { colors } from '../content/palette';
import { hexToRgb, type Vec3 } from './math';

export const SKY_STOPS = {
  high: colors.skyHigh,
  mid: colors.skyMid,
  low: colors.skyLow,
  clear: colors.bg,
} as const;

export function skyClearRgb(): Vec3 {
  return hexToRgb(SKY_STOPS.clear);
}

export function skyHighRgb(): Vec3 {
  return hexToRgb(SKY_STOPS.high);
}

export function skyMidRgb(): Vec3 {
  return hexToRgb(SKY_STOPS.mid);
}

export function skyLowRgb(): Vec3 {
  return hexToRgb(SKY_STOPS.low);
}
