import { describe, expect, it } from 'vitest';
import { combatTuning } from '../../content/combat';
import { SeededRNG } from '../rng';
import { computeDesiredDist, decideFootwork, intentionWeights } from './ai';
import { Fighter, resetFighterIds } from './fighter';
import { createQuickMatch } from './match';

describe('Combat feel', () => {
  it('PRESS pulls d* inward and YIELD pushes outward vs mid-measure', () => {
    resetFighterIds();
    const f = new Fighter(0, 'SECUTOR', 'Sec', 0, 0, 0);
    const mid = (f.def().measureMin + f.def().measureMax) * 0.5;
    f.setIntention('PRESS', 100);
    const press = computeDesiredDist(f, mid, 50);
    f.setIntention('YIELD', 100);
    const yieldD = computeDesiredDist(f, mid, 50);
    expect(press).toBeLessThan(mid);
    expect(yieldD).toBeGreaterThan(mid);
  });

  it('kit weights favor Secutor PRESS and Retiarius INVITE/FEINT', () => {
    resetFighterIds();
    const sec = new Fighter(0, 'SECUTOR', 'Sec', 0, 0, 0);
    const ret = new Fighter(1, 'RETIARIUS', 'Ret', 80, 0, Math.PI);
    const sw = intentionWeights(sec);
    const rw = intentionWeights(ret);
    expect(sw.PRESS).toBeGreaterThan(rw.PRESS);
    expect(rw.INVITE).toBeGreaterThan(sw.INVITE);
    expect(rw.FEINT + rw.YIELD).toBeGreaterThan(sw.FEINT + sw.YIELD);
  });

  it('footwork brain sets a continuous desiredDist near class measure', () => {
    resetFighterIds();
    const self = new Fighter(0, 'MURMILLO', 'Mur', 0, 0, 0);
    const enemy = new Fighter(1, 'THRAEX', 'Thr', 46, 0, Math.PI);
    const rng = new SeededRNG(7);
    const d = decideFootwork(self, enemy, [], rng, 1);
    expect(d.desiredDist).toBeGreaterThan(self.def().measureMin * 0.7);
    expect(d.desiredDist).toBeLessThan(self.def().measureMax * 1.4);
  });

  it('windup abort fires in early window when line is lost', () => {
    const m = createQuickMatch(1, 404, ['THRAEX'], ['MURMILLO']);
    const atk = m.fighters[0]!;
    const tgt = m.fighters[1]!;
    // Place in measure, start windup facing wrong way
    atk.x = combatTuning.arenaCX - 40;
    atk.y = combatTuning.arenaCY;
    tgt.x = combatTuning.arenaCX + 10;
    tgt.y = combatTuning.arenaCY;
    atk.facing = Math.PI; // away from foe
    atk.commitFacing = Math.PI;
    const d = atk.def();
    expect(atk.startAction('ATTACK', d.windup, d.active, d.recover)).toBe(true);
    atk.stamina = atk.maxStamina;
    atk.abortUsedExchange = false;
    atk.lastAbortTick = -999;
    atk.tempoUntil = 0;

    let aborted = false;
    for (let i = 0; i < d.windup; i++) {
      m.step();
      if (m.events.some((e) => e.kind === 'ABORT')) {
        aborted = true;
        break;
      }
      // Keep facing wrong so abort condition holds
      if (atk.action === 'ATTACK' && atk.phase === 'WINDUP') {
        atk.facing = Math.PI;
        atk.commitFacing = Math.PI;
      }
    }
    expect(aborted).toBe(true);
  });

  it('measure spring moves fighters without magnet freeze across seeds', () => {
    let totalMotion = 0;
    for (let seed = 1; seed <= 12; seed++) {
      const m = createQuickMatch(1, seed, ['MURMILLO'], ['THRAEX']);
      const a = m.fighters[0]!;
      const b = m.fighters[1]!;
      let path = 0;
      let px = a.x;
      let py = a.y;
      for (let t = 0; t < 180; t++) {
        m.step();
        path += Math.hypot(a.x - px, a.y - py);
        px = a.x;
        py = a.y;
      }
      totalMotion += path;
      expect(a.desiredDist).toBeGreaterThan(0);
      expect(b.desiredDist).toBeGreaterThan(0);
    }
    // Should travel meaningfully — not stuck in place
    expect(totalMotion).toBeGreaterThan(200);
  });
});
