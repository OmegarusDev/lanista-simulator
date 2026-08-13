/** Shared "How to Play" content for the title screen and fight pause menu. */
import { helpModal } from './modal';

export const HELP_SECTIONS = [
  {
    label: 'The Season',
    lines: [
      'Run a ludus: train fighters, buy recruits, build facilities, and take bouts from the Munera Board.',
      'Pick a lineup that fits each bout’s required kits, then watch the fight on the sand.',
      'Win bouts for denarii and virtus. Run out of money and the season is over.',
      'On the final day the Grand Munus waits — beat the best to close the season in glory.',
    ],
  },
  {
    label: 'Arena — Mouse',
    lines: [
      'Drag to pan the sand · scroll wheel to dolly in/out',
      'Hold Shift and drag to orbit the camera',
      'Click a fighter to inspect; click the sand to clear',
    ],
  },
  {
    label: 'Arena — Touch',
    lines: ['Drag to pan · pinch to zoom', 'Tap a fighter to inspect'],
  },
  {
    label: 'Keys',
    lines: [
      'Space — fight · Esc / P — pause (or clear inspect) · Q — leave',
      '1 / 2 / 4 — speed · R — restart (Practice Yard) · N — reroll (Practice Yard)',
      'D — combat feel debug · Esc — back on any menu',
    ],
  },
];

export function openHelp(): void {
  helpModal({ title: 'How to Play', sections: HELP_SECTIONS });
}