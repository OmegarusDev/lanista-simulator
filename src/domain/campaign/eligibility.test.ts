import { describe, expect, it } from 'vitest';
import { canFieldTemplate } from './eligibility';
import { createSeason } from './season';
import { templateById } from '../../content/munera';

describe('munera eligibility', () => {
  it('allows classic murmillo event when roster has Murmillo', () => {
    const s = createSeason(42);
    const t = templateById('classic_mur_thr')!;
    expect(canFieldTemplate(s, t)).toBe(true);
  });

  it('blocks provocator classic without provocator on roster', () => {
    const s = createSeason(1);
    // starter kits: Mur, Thr, Ret, Sec — no Pro
    const t = templateById('classic_pro_pro')!;
    expect(s.roster.some((g) => g.armatura === 'PROVOCATOR')).toBe(false);
    expect(canFieldTemplate(s, t)).toBe(false);
  });

  it('daily offers include eligible and locked teasers', () => {
    const s = createSeason(99);
    expect(s.offers.length).toBeGreaterThanOrEqual(3);
    expect(s.offers.some((o) => o.eligible)).toBe(true);
    expect(s.offers.every((o) => o.playerSlots.length === o.teamSize)).toBe(true);
  });
});
