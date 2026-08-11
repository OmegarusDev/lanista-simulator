import type { CombatEvent } from '../domain/combat/types';
import type { SeededRNG } from '../domain/rng';
import { spawnDust, type DustParticle } from './arena';

export type CombatFxSound = 'hit' | 'block' | 'dodge' | 'stun' | 'net' | 'ko' | 'ui';

export type CombatFxHooks = {
  play: (kind: CombatFxSound) => void;
  addShake: (amount: number, cap: number) => void;
  hitStop: (ticks: number) => void;
  spawnDust: (
    x: number,
    y: number,
    count: number,
    kind?: 'dust' | 'blood',
  ) => void;
  setInterest: (x: number, y: number, life: number) => void;
};

/** Map CombatEvent kinds → presentation juice (audio / shake / dust / camera interest). */
export function applyCombatEvents(events: CombatEvent[], hooks: CombatFxHooks): void {
  for (const ev of events) {
    switch (ev.kind) {
      case 'HIT':
        hooks.play('hit');
        hooks.addShake(4, 10);
        hooks.hitStop(3);
        hooks.spawnDust(ev.x, ev.y, 4, 'dust');
        hooks.spawnDust(ev.x, ev.y, 3, 'blood');
        hooks.setInterest(ev.x, ev.y, 45);
        break;
      case 'GUARD':
        hooks.play('block');
        hooks.addShake(2, 8);
        hooks.hitStop(2);
        break;
      case 'SIDESTEP':
        hooks.play('dodge');
        break;
      case 'STUMBLE':
      case 'POISE_BREAK':
        hooks.play('stun');
        hooks.addShake(6, 14);
        hooks.hitStop(6);
        hooks.spawnDust(ev.x, ev.y, 8);
        break;
      case 'ABORT':
        hooks.play('dodge');
        break;
      case 'TIP_CATCH':
        hooks.play('net');
        hooks.hitStop(4);
        break;
      case 'KO':
        hooks.addShake(8, 16);
        hooks.hitStop(8);
        hooks.spawnDust(ev.x, ev.y, 5, 'dust');
        hooks.spawnDust(ev.x, ev.y, 6, 'blood');
        hooks.setInterest(ev.x, ev.y, 70);
        break;
      default:
        break;
    }
  }
}

/** Bind FightScene-owned FX state into CombatFxHooks. */
export function fightCombatFxHooks(opts: {
  play: (kind: CombatFxSound) => void;
  getShake: () => number;
  setShake: (n: number) => void;
  getHitStop: () => number;
  setHitStop: (n: number) => void;
  dust: DustParticle[];
  fxRng: SeededRNG;
  setInterest: (x: number, y: number, life: number) => void;
}): CombatFxHooks {
  return {
    play: opts.play,
    addShake: (amount, cap) => {
      opts.setShake(Math.min(cap, opts.getShake() + amount));
    },
    hitStop: (ticks) => {
      opts.setHitStop(Math.max(opts.getHitStop(), ticks));
    },
    spawnDust: (x, y, count, kind) => {
      spawnDust(opts.dust, x, y, count, opts.fxRng, kind);
    },
    setInterest: opts.setInterest,
  };
}
