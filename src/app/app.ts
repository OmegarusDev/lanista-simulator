import { colors } from '../content/palette';
import { applyCareerFight } from '../domain/campaign/aftermath';
import { spawnSpecsFromLineup } from '../domain/campaign/combatMods';
import { settleSeasonLegacy } from '../domain/campaign/legacy';
import { createSeason, endDay } from '../domain/campaign/season';
import type { AftermathSummary, MuneraOffer, SeasonState } from '../domain/campaign/types';
import {
  bindCanvasResize,
  clientToDesign,
  createCanvasLayout,
  getDesign,
  resizeCanvas,
} from '../shell/canvas';
import { Input } from '../shell/input';
import {
  clearSeasonSave,
  loadLegacy,
  loadSeason,
  saveLegacy,
  saveSeason,
} from '../shell/save';
import { Synth } from '../view/audio';
import { AftermathScene } from './scenes/aftermath';
import { FightScene, type FightAction } from './scenes/fight';
import { LineupScene } from './scenes/lineup';
import { LudusScene } from './scenes/ludus';
import { OffersScene } from './scenes/offers';
import { SandboxScene, type SandboxConfig } from './scenes/sandbox';
import { SeasonEndScene } from './scenes/seasonEnd';
import { TitleScene } from './scenes/title';

type Mode =
  | 'title'
  | 'sandbox'
  | 'ludus'
  | 'offers'
  | 'lineup'
  | 'fight'
  | 'aftermath'
  | 'seasonEnd';

type FightContext = 'lab' | 'career';

export class App {
  private readonly layout;
  private readonly input = new Input();
  private readonly synth = new Synth();

  private readonly title: TitleScene;
  private readonly sandbox: SandboxScene;
  private readonly ludus: LudusScene;
  private readonly offers: OffersScene;
  private readonly lineup: LineupScene;
  private readonly aftermathScene: AftermathScene;
  private readonly seasonEnd: SeasonEndScene;

  private fight: FightScene | null = null;
  private mode: Mode = 'title';
  private lastConfig: SandboxConfig | null = null;
  /** Where Instant Match Title button should return. */
  private labReturn: 'title' | 'ludus' = 'title';

  private season: SeasonState | null = null;
  private pendingOffer: MuneraOffer | null = null;
  private pendingLineup: number[] = [];
  private pendingAftermath: AftermathSummary | null = null;

  private last = 0;
  private acc = 0;
  private readonly step = 1 / 60;

  constructor(canvas: HTMLCanvasElement) {
    this.layout = createCanvasLayout(canvas);
    this.title = new TitleScene(this.synth);
    this.sandbox = new SandboxScene(this.synth);
    this.ludus = new LudusScene(this.synth);
    this.offers = new OffersScene(this.synth);
    this.lineup = new LineupScene(this.synth);
    this.aftermathScene = new AftermathScene(this.synth);
    this.seasonEnd = new SeasonEndScene(this.synth);
    resizeCanvas(this.layout);
  }

  start(): void {
    this.input.attach(this.layout.canvas, (cx, cy) => clientToDesign(this.layout, cx, cy));
    bindCanvasResize(() => resizeCanvas(this.layout));
    resizeCanvas(this.layout);
    this.last = performance.now();
    requestAnimationFrame(this.frame);
  }

  private readonly frame = (now: number): void => {
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    this.acc += dt;

    while (this.acc >= this.step) {
      this.fixedUpdate();
      this.acc -= this.step;
    }
    this.render();
    this.input.endFrame();
    requestAnimationFrame(this.frame);
  };

  private fixedUpdate(): void {
    if (this.mode === 'fight' && this.fight) {
      this.applyFightAction(this.fight.update(this.input));
    }
  }

  private persist(): void {
    if (this.season && this.season.status === 'ACTIVE') {
      saveSeason(this.season);
    }
  }

  private goTitle(): void {
    this.mode = 'title';
    this.fight = null;
    this.pendingOffer = null;
    this.pendingLineup = [];
    this.pendingAftermath = null;
  }

  private enterLab(from: 'title' | 'ludus'): void {
    this.labReturn = from;
    this.mode = 'sandbox';
  }

  private enterFight(config: SandboxConfig, context: FightContext): void {
    this.synth.ensure();
    this.lastConfig = config;
    this.sandbox.seed = config.seed;
    this.fight = new FightScene(config, this.synth, { career: context === 'career' });
    this.mode = 'fight';
    this.input.pointer.clicked = false;
    this.input.pointer.down = false;
  }

  private seasonTerminal(state: SeasonState): boolean {
    return state.status === 'BROKE' || state.status === 'SEASON_END';
  }

  private render(): void {
    const ctx = this.layout.ctx;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const { w, h } = getDesign();
    ctx.fillStyle = colors.bg;
    ctx.fillRect(0, 0, w, h);

    switch (this.mode) {
      case 'title':
        this.renderTitle(ctx);
        break;
      case 'sandbox':
        this.renderSandbox(ctx);
        break;
      case 'ludus':
        this.renderLudus(ctx);
        break;
      case 'offers':
        this.renderOffers(ctx);
        break;
      case 'lineup':
        this.renderLineup(ctx);
        break;
      case 'fight':
        if (this.fight) this.applyFightAction(this.fight.draw(ctx, this.input));
        break;
      case 'aftermath':
        this.renderAftermath(ctx);
        break;
      case 'seasonEnd':
        this.renderSeasonEnd(ctx);
        break;
    }
  }

  private renderTitle(ctx: CanvasRenderingContext2D): void {
    const action = this.title.draw(ctx, this.input);
    if (action.type === 'INSTANT_MATCH') {
      this.enterLab('title');
      return;
    }
    if (action.type === 'NEW_SEASON') {
      const seed = (Math.random() * 0xffffffff) >>> 0;
      this.season = createSeason(seed, loadLegacy());
      clearSeasonSave();
      saveSeason(this.season);
      this.mode = 'ludus';
      return;
    }
    if (action.type === 'CONTINUE') {
      const loaded = loadSeason();
      if (loaded) {
        this.season = loaded;
        if (loaded.status === 'BROKE' || loaded.status === 'SEASON_END') {
          this.mode = 'seasonEnd';
        } else {
          this.mode = 'ludus';
        }
      }
    }
  }

  private renderSandbox(ctx: CanvasRenderingContext2D): void {
    const action = this.sandbox.draw(ctx, this.input);
    if (action.type === 'BACK') {
      this.mode = this.labReturn === 'ludus' && this.season ? 'ludus' : 'title';
      return;
    }
    if (action.type === 'START') {
      this.enterFight(action.config, 'lab');
    }
  }

  private renderLudus(ctx: CanvasRenderingContext2D): void {
    if (!this.season) {
      this.goTitle();
      return;
    }
    if (this.seasonTerminal(this.season)) {
      this.mode = 'seasonEnd';
      clearSeasonSave();
      return;
    }

    const action = this.ludus.draw(ctx, this.input, this.season);
    if (action.type === 'INSTANT_MATCH') {
      this.enterLab('ludus');
      return;
    }
    if (action.type === 'MUNERA') {
      this.mode = 'offers';
      return;
    }
    if (action.type === 'END_DAY') {
      endDay(this.season);
      this.persist();
      if (this.seasonTerminal(this.season)) {
        clearSeasonSave();
        this.mode = 'seasonEnd';
      }
      return;
    }
    if (action.type === 'TITLE') {
      this.persist();
      this.goTitle();
      return;
    }
    if (action.type === 'CHANGED' || action.type === 'RESTED') {
      this.persist();
      if (this.seasonTerminal(this.season)) {
        clearSeasonSave();
        this.mode = 'seasonEnd';
      }
    }
  }

  private renderOffers(ctx: CanvasRenderingContext2D): void {
    if (!this.season) {
      this.goTitle();
      return;
    }
    const action = this.offers.draw(ctx, this.input, this.season);
    if (action.type === 'BACK') {
      this.mode = 'ludus';
      return;
    }
    if (action.type === 'PICK') {
      this.pendingOffer = action.offer;
      this.lineup.reset(action.offer);
      this.mode = 'lineup';
    }
  }

  private renderLineup(ctx: CanvasRenderingContext2D): void {
    if (!this.season || !this.pendingOffer) {
      this.mode = 'ludus';
      return;
    }
    const action = this.lineup.draw(ctx, this.input, this.season, this.pendingOffer);
    if (action.type === 'BACK') {
      this.mode = 'offers';
      return;
    }
    if (action.type === 'FIGHT') {
      this.pendingLineup = action.lineupIds;
      const offer = this.pendingOffer;
      const team0 = action.lineupIds.map((id) => {
        const g = this.season!.roster.find((x) => x.id === id)!;
        return g.armatura;
      });
      const team0Specs = spawnSpecsFromLineup(
        this.season.roster,
        action.lineupIds,
        this.season.doctrina,
      );
      const tierMul = 1 + (offer.tier - 1) * 0.04;
      const team1Specs = offer.opponents.map((armatura, i) => ({
        armatura,
        name: `Rival ${i + 1}`,
        hpMul: tierMul,
        staminaMul: tierMul,
        poiseMul: tierMul,
        damageMul: tierMul,
        pursueBiasAdd: offer.rivalName ? 0.06 : 0,
      }));
      const config: SandboxConfig = {
        teamSize: offer.teamSize,
        seed: (this.season.seed + this.season.day * 1009 + offer.templateId.length) >>> 0,
        team0,
        team1: [...offer.opponents],
        team0Specs,
        team1Specs,
        lockedMatchup: true,
      };
      this.enterFight(config, 'career');
    }
  }

  private renderAftermath(ctx: CanvasRenderingContext2D): void {
    if (!this.season || !this.pendingAftermath) {
      this.mode = 'ludus';
      return;
    }
    const action = this.aftermathScene.draw(ctx, this.input, this.season, this.pendingAftermath);
    if (action.type === 'CONTINUE') {
      this.pendingAftermath = null;
      this.pendingOffer = null;
      this.pendingLineup = [];
      this.persist();
      if (this.seasonTerminal(this.season)) {
        clearSeasonSave();
        this.mode = 'seasonEnd';
      } else {
        this.mode = 'ludus';
      }
    }
  }

  private renderSeasonEnd(ctx: CanvasRenderingContext2D): void {
    if (!this.season) {
      this.goTitle();
      return;
    }
    const action = this.seasonEnd.draw(ctx, this.input, this.season);
    if (action.type === 'TITLE') {
      const legacy = settleSeasonLegacy(this.season, loadLegacy());
      saveLegacy(legacy);
      clearSeasonSave();
      this.season = null;
      this.goTitle();
    }
  }

  private applyFightAction(action: FightAction): void {
    if (action.type === 'NONE') return;

    if (action.type === 'CAREER_DONE') {
      if (!this.season || !this.pendingOffer) {
        this.mode = 'ludus';
        this.fight = null;
        return;
      }
      const summary = applyCareerFight(this.season, {
        offer: this.pendingOffer,
        lineupIds: this.pendingLineup,
        result: action.result,
        forfeited: action.forfeited,
      });
      this.pendingAftermath = summary;
      this.fight = null;
      this.mode = 'aftermath';
      this.persist();
      return;
    }

    if (action.type === 'EXIT') {
      // Lab fights always return to Instant Match sandbox.
      this.fight = null;
      this.mode = 'sandbox';
      return;
    }

    if (action.type === 'RESTART' && this.lastConfig) {
      this.enterFight(this.lastConfig, 'lab');
      return;
    }
    if (action.type === 'REROLL') {
      this.sandbox.seed = (Math.random() * 0xffffffff) >>> 0;
      this.enterFight(this.sandbox.makeConfig(), 'lab');
    }
  }
}
