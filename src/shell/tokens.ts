/**
 * Export palette + theme tokens into CSS :root once at boot.
 * Bakes procedural noise tiles into data-URL backgrounds (zero assets).
 */
import { colors } from '../content/palette';
import { crowdStripDataUrl, noiseDataUrl } from '../gfx/pattern';
import {
  elevation,
  easing,
  fontStack,
  motion,
  radius,
  space,
  touchTarget,
  typeScale,
  zIndex,
} from '../view/theme';

export function applyCssTokens(root: HTMLElement = document.documentElement): void {
  const set = (k: string, v: string) => root.style.setProperty(k, v);

  set('--shell-bg', colors.bg);
  set('--ink', colors.ink);
  set('--parchment', colors.parchment);
  set('--bronze', colors.bronze);
  set('--bronze-hot', colors.bronzeHot);
  set('--accent', colors.accent);
  set('--accent-hot', colors.accentHot);
  set('--ally', colors.ally);
  set('--foe', colors.foe);
  set('--hp', colors.hp);
  set('--stamina', colors.stamina);
  set('--poise', colors.poise);
  set('--panel', 'rgba(18, 22, 28, 0.72)');
  set('--panel-border', colors.panelBorder);
  set('--rail', 'rgba(16, 20, 26, 0.48)');
  set('--rail-border', colors.railBorder);
  set('--button', colors.button);
  set('--button-hot', colors.buttonHot);
  set('--button-disabled', colors.buttonDisabled);
  set('--button-text', colors.buttonText);
  set('--muted', colors.muted);
  set('--hairline', colors.hairline);
  set('--grout', colors.grout);
  set('--debug', colors.debug);
  set('--debug-border', colors.debugBorder);
  set('--debug-text', colors.debugText);
  set('--sky-high', colors.skyHigh);
  set('--sky-mid', colors.skyMid);
  set('--sky-low', colors.skyLow);

  set('--font-display', fontStack);
  set('--font-ui', fontStack);
  set('--touch', `${touchTarget}px`);
  set('--radius-sm', `${radius.sm}px`);
  set('--radius-md', `${radius.md}px`);
  set('--radius-lg', `${radius.lg}px`);
  set('--space-xs', `${space.xs}px`);
  set('--space-sm', `${space.sm}px`);
  set('--space-md', `${space.md}px`);
  set('--space-lg', `${space.lg}px`);
  set('--space-xl', `${space.xl}px`);
  set('--type-eyebrow', `${typeScale.eyebrow}px`);
  set('--type-meta', `${typeScale.meta}px`);
  set('--type-body', `${typeScale.body}px`);
  set('--type-label', `${typeScale.label}px`);
  set('--type-title', `${typeScale.title}px`);
  set('--type-display', `${typeScale.display}px`);
  set('--type-banner', `${typeScale.banner}px`);
  set('--type-micro', `${typeScale.micro}px`);

  // Elevation ladder + layer ladder + motion — the only values chrome may use.
  set('--shadow-rail', elevation.rail);
  set('--shadow-card', elevation.card);
  set('--shadow-panel', elevation.panel);
  set('--shadow-modal', elevation.modal);
  set('--z-stage', `${zIndex.stage}`);
  set('--z-chrome', `${zIndex.chrome}`);
  set('--z-hud', `${zIndex.hud}`);
  set('--z-ticker', `${zIndex.ticker}`);
  set('--z-overlay', `${zIndex.overlay}`);
  set('--z-sheet', `${zIndex.sheet}`);
  set('--z-modal', `${zIndex.modal}`);
  set('--z-toast', `${zIndex.toast}`);
  set('--dur-fast', `${motion.fast}s`);
  set('--dur-snap', `${motion.snap}s`);
  set('--dur-smooth', `${motion.smooth}s`);
  set('--dur-slow', `${motion.slow}s`);
  set('--ease-ui', easing);

  // Bronze alpha tints — the shared hairlines/borders.
  set('--bronze-faint', 'rgba(184, 149, 74, 0.16)');
  set('--bronze-soft', 'rgba(184, 149, 74, 0.35)');

  set('--safe-top', 'env(safe-area-inset-top, 0px)');
  set('--safe-right', 'env(safe-area-inset-right, 0px)');
  set('--safe-bottom', 'env(safe-area-inset-bottom, 0px)');
  set('--safe-left', 'env(safe-area-inset-left, 0px)');

  try {
    const parchment = noiseDataUrl({
      seed: 0xda7c,
      low: '#2a2820',
      high: '#c4b090',
      contrast: 0.85,
      frequency: 3,
      size: 64,
      tag: 'css-parchment',
    });
    const wood = noiseDataUrl({
      seed: 0x60cd,
      low: '#14181e',
      high: '#4a3a28',
      contrast: 1.15,
      frequency: 3,
      stretchY: 0.28,
      size: 64,
      tag: 'css-wood',
    });
    const stone = noiseDataUrl({
      seed: 0x57ce,
      low: '#1a1e24',
      high: '#5a564c',
      contrast: 1.05,
      frequency: 2.4,
      size: 64,
      tag: 'css-stone',
    });
    const crowd = crowdStripDataUrl({
      seed: 0x2b7a,
      tones: ['#5c554b', '#6a6258', '#7a7266', '#8a8173', '#4a453d', '#b8954a'],
      width: 256,
      height: 48,
      tag: 'css-crowd',
    });
    if (parchment) set('--tex-parchment', `url(${parchment})`);
    if (wood) set('--tex-wood', `url(${wood})`);
    if (stone) set('--tex-stone', `url(${stone})`);
    if (crowd) set('--tex-crowd', `url(${crowd})`);
  } catch {
    // Headless / missing canvas — skip texture tokens
  }
}
