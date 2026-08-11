import type { Synth } from '../view/audio';
import type { FightHud } from '../ui/fightHud';
import type { SandboxConfig } from '../domain/combat/types';
import type { GlFrame } from '../gl/index';
import { FightScene, type FightAction } from './scenes/fight';

/** Owns the active FightScene lifecycle. */
export class FightSession {
  scene: FightScene | null = null;
  lastConfig: SandboxConfig | null = null;
  context: 'lab' | 'career' = 'lab';

  enter(
    config: SandboxConfig,
    context: 'lab' | 'career',
    synth: Synth,
    hud: FightHud,
    glFrame: GlFrame,
    lineupIds?: number[],
  ): FightScene {
    synth.ensure();
    this.lastConfig = config;
    this.context = context;
    this.scene?.dispose();
    this.scene = new FightScene(config, synth, hud, glFrame, {
      career: context === 'career',
      lineupIds: context === 'career' ? lineupIds : undefined,
    });
    return this.scene;
  }

  dispose(): void {
    this.scene?.dispose();
    this.scene = null;
  }

  update(input: Parameters<FightScene['update']>[0]): FightAction {
    if (!this.scene) return { type: 'NONE' };
    return this.scene.update(input);
  }

  paint(
    cssW: number,
    cssH: number,
    input: Parameters<FightScene['paint']>[2],
  ): FightAction {
    if (!this.scene) return { type: 'NONE' };
    return this.scene.paint(cssW, cssH, input);
  }
}
