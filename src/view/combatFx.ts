import type { CombatEvent } from '../domain/combat/types';
import type { FxRecipe, FxSystem } from '../gl/fx';
import { recipeForEvent } from '../gl/fx';
import type { StageCamera } from '../gl/camera';

export type CombatFxSound = 'hit' | 'block' | 'dodge' | 'stun' | 'net' | 'ko' | 'ui';

export type CombatFxHooks = {
  play: (kind: CombatFxSound) => void;
  addShake: (amount: number, cap: number) => void;
  hitStop: (ticks: number) => void;
  spawnFx: (x: number, y: number, recipes: FxRecipe[]) => void;
  setInterest: (x: number, y: number, life: number) => void;
  cameraImpulse?: (amount: number) => void;
};

/** Map CombatEvent kinds → presentation juice (audio / shake / GL FX / camera interest). */
export function applyCombatEvents(events: CombatEvent[], hooks: CombatFxHooks): void {
  for (const ev of events) {
    const recipes = recipeForEvent(ev.kind);
    switch (ev.kind) {
      case 'HIT':
        hooks.play('hit');
        hooks.addShake(4, 10);
        hooks.hitStop(3);
        hooks.spawnFx(ev.x, ev.y, recipes);
        hooks.setInterest(ev.x, ev.y, 45);
        hooks.cameraImpulse?.(3);
        break;
      case 'GUARD':
        hooks.play('block');
        hooks.addShake(2, 8);
        hooks.hitStop(2);
        hooks.spawnFx(ev.x, ev.y, recipes);
        break;
      case 'SIDESTEP':
        hooks.play('dodge');
        hooks.spawnFx(ev.x, ev.y, recipes);
        break;
      case 'STUMBLE':
      case 'POISE_BREAK':
        hooks.play('stun');
        hooks.addShake(6, 14);
        hooks.hitStop(6);
        hooks.spawnFx(ev.x, ev.y, recipes);
        hooks.setInterest(ev.x, ev.y, 55);
        hooks.cameraImpulse?.(5);
        break;
      case 'ABORT':
        hooks.play('dodge');
        hooks.spawnFx(ev.x, ev.y, recipes);
        break;
      case 'TIP_CATCH':
        hooks.play('net');
        hooks.hitStop(4);
        hooks.spawnFx(ev.x, ev.y, recipes);
        break;
      case 'KO':
        hooks.addShake(8, 16);
        hooks.hitStop(8);
        hooks.spawnFx(ev.x, ev.y, recipes);
        hooks.setInterest(ev.x, ev.y, 70);
        hooks.cameraImpulse?.(7);
        break;
      default:
        break;
    }
  }
}

/** Bind FightScene-owned FX state into CombatFxHooks (GL particles). */
export function fightCombatFxHooks(opts: {
  play: (kind: CombatFxSound) => void;
  getShake: () => number;
  setShake: (n: number) => void;
  getHitStop: () => number;
  setHitStop: (n: number) => void;
  fx: FxSystem;
  rng: () => number;
  camera: StageCamera;
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
    spawnFx: (x, y, recipes) => {
      opts.fx.spawn(x, y, recipes, opts.rng);
    },
    setInterest: opts.setInterest,
    cameraImpulse: (amount) => opts.camera.shake(amount),
  };
}
