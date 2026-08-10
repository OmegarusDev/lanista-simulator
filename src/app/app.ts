import {
  clearSeasonSave,
} from '../shell/save';
import { applyCssTokens } from '../shell/tokens';
import {
  mountShell,
  resizeStageCanvas,
  setStageVisible,
  type AppShell,
} from '../shell/viewport';
import { Input } from '../shell/input';
import { Synth } from '../view/audio';
import { ArenaCamera } from '../view/arenaCamera';
import { defaultStageZoom, paintStageWorld, pickFighterWorld, stagePointerToWorld } from '../view/stagePaint';
import { AftermathView } from '../ui/aftermathView';
import { FightHud } from '../ui/fightHud';
import { LineupView } from '../ui/lineupView';
import { LudusView } from '../ui/ludusView';
import { OffersView } from '../ui/offersView';
import { PracticeView, type SandboxConfig } from '../ui/practiceView';
import { SeasonEndView } from '../ui/seasonEndView';
import { TitleView } from '../ui/titleView';
import { FightSession } from './fightSession';
import { SeasonController } from './seasonController';
import type { FightAction } from './scenes/fight';
import type { SeasonState } from '../domain/campaign/types';

type Mode =
  | 'title'
  | 'sandbox'
  | 'ludus'
  | 'offers'
  | 'lineup'
  | 'fight'
  | 'aftermath'
  | 'seasonEnd';

export class App {
  private readonly shell: AppShell;
  private readonly input = new Input();
  private readonly synth = new Synth();
  private readonly career = new SeasonController();
  private readonly fights = new FightSession();

  private readonly title: TitleView;
  private readonly practice: PracticeView;
  private readonly ludus: LudusView;
  private readonly offers: OffersView;
  private readonly lineup: LineupView;
  private readonly aftermathView: AftermathView;
  private readonly seasonEnd: SeasonEndView;
  private readonly fightHud: FightHud;

  private mode: Mode = 'title';
  private labReturn: 'title' | 'ludus' = 'title';

  private readonly previewCam = new ArenaCamera();
  private previewPtrWasDown = false;

  private last = 0;
  private acc = 0;
  private readonly step = 1 / 60;

  constructor() {
    applyCssTokens();
    this.shell = mountShell();
    const beep = () => this.synth.ensure();

    this.title = new TitleView(beep);
    this.practice = new PracticeView(this.synth, beep);
    this.ludus = new LudusView(beep);
    this.offers = new OffersView(beep);
    this.lineup = new LineupView(beep);
    this.aftermathView = new AftermathView(beep);
    this.seasonEnd = new SeasonEndView(beep);
    this.fightHud = new FightHud(beep);

    this.title.mount(this.shell.chrome);
    this.ludus.mount(this.shell.chrome);
    this.offers.mount(this.shell.chrome);
    this.lineup.mount(this.shell.chrome);
    this.aftermathView.mount(this.shell.chrome);
    this.seasonEnd.mount(this.shell.chrome);
    this.practice.mount(this.shell.chrome);
    this.fightHud.mount(this.shell.chrome);

    this.setMode('title');
  }

  start(): void {
    this.input.attach(this.shell.stage, (cx, cy) => {
      const rect = this.shell.stage.getBoundingClientRect();
      const w = rect.width || 1;
      const h = rect.height || 1;
      return {
        x: ((cx - rect.left) / w) * w,
        y: ((cy - rect.top) / h) * h,
      };
    });
    const onResize = () => {
      if (this.shell.app.classList.contains('has-stage')) {
        resizeStageCanvas(this.shell.stage, this.shell.stageCtx);
      }
    };
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    const vv = window.visualViewport;
    if (vv) {
      vv.addEventListener('resize', onResize);
      vv.addEventListener('scroll', onResize);
    }
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
    if (this.mode === 'fight' && this.fights.scene) {
      this.applyFightAction(this.fights.update(this.input));
    }
  }

  private get season(): SeasonState | null {
    return this.career.season;
  }

  private setMode(mode: Mode): void {
    this.mode = mode;
    const stageOn = mode === 'fight' || mode === 'sandbox';
    setStageVisible(this.shell, stageOn);

    this.title.show(mode === 'title');
    this.ludus.show(mode === 'ludus', this.season);
    this.offers.show(mode === 'offers', this.season);
    this.lineup.show(mode === 'lineup', this.season, this.career.pendingOffer);
    this.aftermathView.show(mode === 'aftermath', this.season, this.career.pendingAftermath);
    this.seasonEnd.show(mode === 'seasonEnd', this.season);
    this.practice.show(mode === 'sandbox');
    if (mode !== 'fight') this.fightHud.show(false);

    if (mode === 'sandbox') {
      this.previewCam.reset(defaultStageZoom(400, 400), 'contain');
      this.applyStagePads(72, 150);
    } else if (mode === 'fight') {
      const pads = this.fightHud.getStagePads();
      this.applyStagePads(pads.top, pads.bottom);
    } else {
      this.applyStagePads(0, 0);
    }
  }

  private applyStagePads(top: number, bottom: number): void {
    this.shell.app.style.setProperty('--stage-pad-top', `${top}px`);
    this.shell.app.style.setProperty('--stage-pad-bottom', `${bottom}px`);
  }

  private goTitle(): void {
    this.fights.dispose();
    this.career.clearPending();
    this.setMode('title');
  }

  private enterLab(from: 'title' | 'ludus'): void {
    this.labReturn = from;
    this.setMode('sandbox');
  }

  private enterFight(config: SandboxConfig, context: 'lab' | 'career'): void {
    this.practice.seed = config.seed;
    this.fights.enter(
      config,
      context,
      this.synth,
      this.fightHud,
      context === 'career' ? [...this.career.pendingLineup] : undefined,
    );
    this.setMode('fight');
    this.input.pointer.clicked = false;
    this.input.pointer.down = false;
  }

  private render(): void {
    switch (this.mode) {
      case 'title':
        this.pollTitle();
        break;
      case 'sandbox':
        this.pollPractice();
        this.paintPracticeStage();
        break;
      case 'ludus':
        this.pollLudus();
        break;
      case 'offers':
        this.pollOffers();
        break;
      case 'lineup':
        this.pollLineup();
        break;
      case 'fight':
        this.paintFight();
        break;
      case 'aftermath':
        this.pollAftermath();
        break;
      case 'seasonEnd':
        this.pollSeasonEnd();
        break;
    }
  }

  private paintFight(): void {
    if (!this.fights.scene) return;
    const pads = this.fightHud.getStagePads();
    this.applyStagePads(pads.top, pads.bottom);
    const { cssW, cssH } = resizeStageCanvas(this.shell.stage, this.shell.stageCtx);
    this.applyFightAction(this.fights.paint(this.shell.stageCtx, cssW, cssH, this.input));
  }

  private paintPracticeStage(): void {
    const { cssW, cssH } = resizeStageCanvas(this.shell.stage, this.shell.stageCtx);
    this.previewCam.zoom = defaultStageZoom(cssW, cssH);
    this.previewCam.tickSmooth();
    const snaps = this.practice.previewSnapshots();
    const t = paintStageWorld(this.shell.stageCtx, {
      cssW,
      cssH,
      cam: this.previewCam,
      seed: this.practice.seed,
      fighters: snaps,
      selectedId: this.practice.selectedPreviewId,
      hideBars: true,
    });

    if (this.practice.mode === 'custom') {
      this.previewPtrWasDown = this.input.pointer.down;
      return;
    }
    const p = this.input.pointer;
    if (p.down && !this.previewPtrWasDown) {
      const world = stagePointerToWorld(p.x, p.y, t);
      const hit = pickFighterWorld(snaps, world.x, world.y, 36 / Math.max(0.001, t.scale));
      if (hit) {
        this.practice.selectedPreviewId = hit.id;
        this.synth.play('ui');
      } else {
        this.practice.selectedPreviewId = null;
      }
      this.input.pointer.clicked = false;
    }
    this.previewPtrWasDown = p.down;
  }

  private pollTitle(): void {
    const action = this.title.poll();
    if (action.type === 'INSTANT_MATCH') {
      this.enterLab('title');
      return;
    }
    if (action.type === 'NEW_SEASON') {
      this.career.newSeason();
      this.setMode('ludus');
      return;
    }
    if (action.type === 'CONTINUE') {
      const loaded = this.career.continueSeason();
      if (loaded) {
        if (this.career.isTerminal(loaded)) this.setMode('seasonEnd');
        else this.setMode('ludus');
      }
    }
  }

  private pollPractice(): void {
    const key = this.practice.handleKeys(this.input);
    if (key.type === 'START') {
      this.enterFight(key.config, 'lab');
      return;
    }
    const action = this.practice.poll();
    if (action.type === 'BACK') {
      this.setMode(this.labReturn === 'ludus' && this.season ? 'ludus' : 'title');
      return;
    }
    if (action.type === 'START') {
      this.enterFight(action.config, 'lab');
    }
  }

  private pollLudus(): void {
    if (!this.season) {
      this.goTitle();
      return;
    }
    if (this.career.isTerminal()) {
      clearSeasonSave();
      this.setMode('seasonEnd');
      return;
    }

    const action = this.ludus.poll();
    if (action.type === 'INSTANT_MATCH') {
      this.enterLab('ludus');
      return;
    }
    if (action.type === 'MUNERA') {
      this.setMode('offers');
      return;
    }
    if (action.type === 'WATCH_SLATE') {
      const config = this.career.buildSlateConfig(action.boutId);
      if (!config) return;
      this.enterFight(config, 'career');
      return;
    }
    if (action.type === 'END_DAY') {
      this.career.endDay();
      if (this.career.isTerminal()) {
        clearSeasonSave();
        this.setMode('seasonEnd');
      } else {
        this.ludus.refresh(this.season!);
      }
      return;
    }
    if (action.type === 'TITLE') {
      this.career.persist();
      this.goTitle();
      return;
    }
    if (action.type === 'RESTED') {
      this.career.pendingAftermath = this.season.lastAftermath;
      this.career.persist();
      if (this.career.isTerminal()) {
        clearSeasonSave();
        this.setMode('seasonEnd');
      } else if (this.career.pendingAftermath) {
        this.setMode('aftermath');
      }
      return;
    }
    if (action.type === 'CHANGED') {
      this.career.persist();
      if (this.career.isTerminal()) {
        clearSeasonSave();
        this.setMode('seasonEnd');
      } else {
        this.ludus.refresh(this.season!);
      }
    }
  }

  private pollOffers(): void {
    if (!this.season) {
      this.goTitle();
      return;
    }
    const action = this.offers.poll();
    if (action.type === 'BACK') {
      this.setMode('ludus');
      return;
    }
    if (action.type === 'PICK') {
      this.career.pickOffer(action.offer);
      this.lineup.reset(action.offer);
      this.setMode('lineup');
    }
  }

  private pollLineup(): void {
    if (!this.season || !this.career.pendingOffer) {
      this.setMode('ludus');
      return;
    }
    const action = this.lineup.poll();
    if (action.type === 'BACK') {
      this.setMode('offers');
      return;
    }
    if (action.type === 'FIGHT') {
      this.career.setLineup(action.lineupIds);
      if (action.orders) this.career.setOrders(action.orders);
      const config = this.career.buildCareerConfig(action.lineupIds, this.career.pendingOffer);
      this.enterFight(config, 'career');
    }
  }

  private pollAftermath(): void {
    if (!this.season || !this.career.pendingAftermath) {
      this.setMode('ludus');
      return;
    }
    const action = this.aftermathView.poll();
    if (action.type === 'CONTINUE') {
      this.career.clearPending();
      this.career.persist();
      if (this.career.isTerminal()) {
        clearSeasonSave();
        this.setMode('seasonEnd');
      } else {
        this.setMode('ludus');
      }
    }
  }

  private pollSeasonEnd(): void {
    if (!this.season) {
      this.goTitle();
      return;
    }
    const action = this.seasonEnd.poll();
    if (action.type === 'TITLE') {
      this.career.settleAndClear();
      this.goTitle();
    }
  }

  private applyFightAction(action: FightAction): void {
    if (action.type === 'NONE') return;

    if (action.type === 'CAREER_DONE') {
      if (!this.season || !this.career.pendingOffer) {
        this.fights.dispose();
        this.setMode('ludus');
        return;
      }
      this.career.applyFight({
        result: action.result,
        forfeited: action.forfeited,
        boutStats: action.boutStats,
      });
      this.fights.dispose();
      this.setMode('aftermath');
      return;
    }

    if (action.type === 'EXIT') {
      this.fights.dispose();
      this.setMode('sandbox');
      return;
    }

    if (action.type === 'RESTART' && this.fights.lastConfig) {
      this.enterFight(this.fights.lastConfig, 'lab');
      return;
    }
    if (action.type === 'REROLL') {
      this.enterFight(this.practice.rerollLab(), 'lab');
    }
  }
}
