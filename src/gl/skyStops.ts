/** Shared sky color stops — used by sky clear, sky shader, and DOM atmosphere tokens. */
import { colors } from '../content/palette';
import { hexToRgb, type Vec3 } from './math';

export const SKY_STOPS = {
  high: colors.skyHigh,
  mid: colors.skyMid,
  low: colors.skyLow,
  clear: colors.bg,
} as const;

/** Cached palette RGB — sky hex never changes at runtime. */
const CLEAR_RGB = hexToRgb(SKY_STOPS.clear);
const HIGH_RGB = hexToRgb(SKY_STOPS.high);
const MID_RGB = hexToRgb(SKY_STOPS.mid);
const LOW_RGB = hexToRgb(SKY_STOPS.low);

export function skyClearRgb(): Vec3 {
  return CLEAR_RGB;
}

export function skyHighRgb(): Vec3 {
  return HIGH_RGB;
}

export function skyMidRgb(): Vec3 {
  return MID_RGB;
}

export function skyLowRgb(): Vec3 {
  return LOW_RGB;
}

/**
 * Mood / crowd-favor tint of sky stops (returns scratch copies — do not retain).
 * favor 0 = team1 lean, 1 = team0 lean; mood shifts warmth.
 */
const MOOD_SCRATCH: [Vec3, Vec3, Vec3, Vec3] = [
  [0, 0, 0],
  [0, 0, 0],
  [0, 0, 0],
  [0, 0, 0],
];

export function skyTinted(
  favor?: number,
  mood?: 'rest' | 'preview' | 'fight' | 'win' | 'loss' | 'quiet',
): { clear: Vec3; high: Vec3; mid: Vec3; low: Vec3 } {
  const f = favor == null ? 0.5 : Math.max(0, Math.min(1, favor));
  // Slight cool (ally) vs warm (foe) bias on mid/low
  const cool = (f - 0.5) * 0.08;
  const warm = (0.5 - f) * 0.06;
  let moodWarm = 0;
  let moodDark = 0;
  if (mood === 'win') moodWarm = 0.06;
  else if (mood === 'loss') moodDark = 0.08;
  else if (mood === 'fight') moodWarm = 0.02;
  else if (mood === 'quiet' || mood === 'rest') moodDark = 0.03;

  const tint = (src: Vec3, dest: Vec3, extraR = 0, extraB = 0): Vec3 => {
    dest[0] = Math.max(0, Math.min(1, src[0]! + warm + moodWarm + extraR - moodDark * 0.5));
    dest[1] = Math.max(0, Math.min(1, src[1]! - moodDark * 0.4));
    dest[2] = Math.max(0, Math.min(1, src[2]! + cool + extraB - moodDark * 0.3));
    return dest;
  };

  return {
    clear: tint(CLEAR_RGB, MOOD_SCRATCH[0]!, 0, 0),
    high: tint(HIGH_RGB, MOOD_SCRATCH[1]!, 0, cool * 0.5),
    mid: tint(MID_RGB, MOOD_SCRATCH[2]!, warm * 0.5, 0),
    low: tint(LOW_RGB, MOOD_SCRATCH[3]!, warm, -cool * 0.3),
  };
}
