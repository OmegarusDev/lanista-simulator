import { applyCareerFight } from '../domain/campaign/aftermath';
import { findSlateBout, slateToOffer } from '../domain/campaign/calendar';
import { spawnSpecFromGladiator, spawnSpecsFromLineup } from '../domain/campaign/combatMods';
import { rollFighter } from '../domain/campaign/rollFighter';
import { SeededRNG } from '../domain/rng';
import { settleSeasonLegacy } from '../domain/campaign/legacy';
import { createSeason, endDay } from '../domain/campaign/season';
import type { AftermathSummary, MuneraOffer, SeasonState } from '../domain/campaign/types';
import { Input } from '../shell/input';
import {
  clearSeasonSave,
  loadLegacy,
  loadSeason,
  saveLegacy,
  saveSeason,
} from '../shell/save';
import { applyCssTokens } from '../shell/tokens';
import {
  mountShell,
  resizeStageCanvas,
  setStageVisible,
  type AppShell,
} from '../shell/viewport';
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
import { FightScene, type FightAction } from './scenes/fight';

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
  private readonly shell: AppShell;
  private readonly input = new Input();
  private readonly synth = new Synth();

  private readonly title: TitleView;
  private readonly practice: PracticeView;
  private readonly ludus: LudusView;
  private readonly offers: OffersView;
  private readonly lineup: LineupView;
  private readonly aftermathView: AftermathView;
  private readonly seasonEnd: SeasonEndView;
  private readonly fightHud: FightHud;

  private fight: FightScene | null = null;
  private mode: Mode = 'title';
  private lastConfig: SandboxConfig | null = null;
  private labReturn: 'title' | 'ludus' = 'title';

  private season: SeasonState | null = null;
  private pendingOffer: MuneraOffer | null = null;
  private pendingLineup: number[] = [];
  private pendingAftermath: AftermathSummary | null = null;

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
    // Keyboard works even when stage is hidden (window listeners in Input).
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
    if (this.mode === 'fight' && this.fight) {
      this.applyFightAction(this.fight.update(this.input));
    }
  }

  private persist(): void {
    if (this.season && this.season.status === 'ACTIVE') {
      saveSeason(this.season);
    }
  }

  private setMode(mode: Mode): void {
    this.mode = mode;
    const stageOn = mode === 'fight' || mode === 'sandbox';
    setStageVisible(this.shell, stageOn);

    this.title.show(mode === 'title');
    this.ludus.show(mode === 'ludus', this.season);
    this.offers.show(mode === 'offers', this.season);
    this.lineup.show(mode === 'lineup', this.season, this.pendingOffer);
    this.aftermathView.show(mode === 'aftermath', this.season, this.pendingAftermath);
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
    this.fight?.dispose();
    this.fight = null;
    this.pendingOffer = null;
    this.pendingLineup = [];
    this.pendingAftermath = null;
    this.setMode('title');
  }

  private enterLab(from: 'title' | 'ludus'): void {
    this.labReturn = from;
    this.setMode('sandbox');
  }

  private enterFight(config: SandboxConfig, context: FightContext): void {
    this.synth.ensure();
    this.lastConfig = config;
    this.practice.seed = config.seed;
    this.fight?.dispose();
    this.fight = new FightScene(config, this.synth, this.fightHud, {
      career: context === 'career',
      lineupIds: context === 'career' ? [...this.pendingLineup] : undefined,
    });
    this.setMode('fight');
    this.input.pointer.clicked = false;
    this.input.pointer.down = false;
  }

  private seasonTerminal(state: SeasonState): boolean {
    return state.status === 'BROKE' || state.status === 'SEASON_END';
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
    if (!this.fight) return;
    const pads = this.fightHud.getStagePads();
    this.applyStagePads(pads.top, pads.bottom);
    const { cssW, cssH } = resizeStageCanvas(this.shell.stage, this.shell.stageCtx);
    this.applyFightAction(this.fight.paint(this.shell.stageCtx, cssW, cssH, this.input));
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

    // Custom sheet owns taps; Quick can pick fighters on the sand.
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
      const seed = (Math.random() * 0xffffffff) >>> 0;
      this.season = createSeason(seed, loadLegacy());
      clearSeasonSave();
      saveSeason(this.season);
      this.setMode('ludus');
      return;
    }
    if (action.type === 'CONTINUE') {
      const loaded = loadSeason();
      if (loaded) {
        this.season = loaded;
        if (loaded.status === 'BROKE' || loaded.status === 'SEASON_END') {
          this.setMode('seasonEnd');
        } else {
          this.setMode('ludus');
        }
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
    if (this.seasonTerminal(this.season)) {
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
      const bout = findSlateBout(this.season, action.boutId);
      if (!bout || bout.status !== 'pending') return;
      const offer = slateToOffer(this.season, bout);
      this.pendingOffer = offer;
      this.pendingLineup = [...bout.schoolIds];
      const team0 = bout.schoolIds.map((id) => {
        const g = this.season!.roster.find((x) => x.id === id)!;
        return g.armatura;
      });
      const team0Specs = spawnSpecsFromLineup(
        this.season.roster,
        bout.schoolIds,
        this.season.doctrina,
      );
      const boutSeed = (this.season.seed + this.season.day * 1009 + bout.id.length) >>> 0;
      let team1Specs;
      if (bout.kind === 'venatio' && bout.beastOpponents) {
        team1Specs = bout.beastOpponents.map((beast) => ({
          kind: 'beast' as const,
          beast,
          armatura: 'MURMILLO' as const,
        }));
      } else {
        const rivalRng = new SeededRNG(boutSeed ^ 0x51a7);
        team1Specs = bout.opponentArmaturae.map((armatura, i) => {
          const rival = rollFighter(rivalRng, {
            policy: 'rival',
            id: 9000 + i,
            armatura,
          });
          return spawnSpecFromGladiator(rival, 'PRESS');
        });
      }
      const config: SandboxConfig = {
        teamSize: bout.teamSize,
        seed: boutSeed,
        team0,
        team1: [...bout.opponentArmaturae],
        team0Specs,
        team1Specs,
        lockedMatchup: true,
        matchKind: bout.kind === 'venatio' ? 'venatio' : 'matchup',
      };
      this.enterFight(config, 'career');
      return;
    }
    if (action.type === 'END_DAY') {
      endDay(this.season);
      this.persist();
      if (this.seasonTerminal(this.season)) {
        clearSeasonSave();
        this.setMode('seasonEnd');
      } else {
        this.ludus.refresh(this.season);
      }
      return;
    }
    if (action.type === 'TITLE') {
      this.persist();
      this.goTitle();
      return;
    }
    if (action.type === 'RESTED') {
      this.pendingAftermath = this.season.lastAftermath;
      this.persist();
      if (this.seasonTerminal(this.season)) {
        clearSeasonSave();
        this.setMode('seasonEnd');
      } else if (this.pendingAftermath) {
        this.setMode('aftermath');
      }
      return;
    }
    if (action.type === 'CHANGED') {
      this.persist();
      if (this.seasonTerminal(this.season)) {
        clearSeasonSave();
        this.setMode('seasonEnd');
      } else {
        this.ludus.refresh(this.season);
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
      this.pendingOffer = action.offer;
      this.lineup.reset(action.offer);
      this.setMode('lineup');
    }
  }

  private pollLineup(): void {
    if (!this.season || !this.pendingOffer) {
      this.setMode('ludus');
      return;
    }
    const action = this.lineup.poll();
    if (action.type === 'BACK') {
      this.setMode('offers');
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
      const boutSeed =
        (this.season.seed + this.season.day * 1009 + offer.templateId.length) >>> 0;
      const rivalRng = new SeededRNG(boutSeed ^ 0x51a7);
      const tierMul = 1 + (offer.tier - 1) * 0.04;
      const team1Specs = offer.opponents.map((armatura, i) => {
        const rival = rollFighter(rivalRng, {
          policy: 'rival',
          id: 9000 + i,
          armatura,
          name: offer.rivalName && i === 0 ? offer.rivalName : undefined,
        });
        const base = spawnSpecFromGladiator(rival, 'PRESS');
        return {
          ...base,
          hpMul: (base.hpMul ?? 1) * tierMul,
          staminaMul: (base.staminaMul ?? 1) * tierMul,
          poiseMul: (base.poiseMul ?? 1) * tierMul,
          damageMul: (base.damageMul ?? 1) * tierMul,
          pursueBiasAdd: (base.pursueBiasAdd ?? 0) + (offer.rivalName ? 0.06 : 0),
        };
      });
      const config: SandboxConfig = {
        teamSize: offer.teamSize,
        seed: boutSeed,
        team0,
        team1: [...offer.opponents],
        team0Specs,
        team1Specs,
        lockedMatchup: true,
      };
      this.enterFight(config, 'career');
    }
  }

  private pollAftermath(): void {
    if (!this.season || !this.pendingAftermath) {
      this.setMode('ludus');
      return;
    }
    const action = this.aftermathView.poll();
    if (action.type === 'CONTINUE') {
      this.pendingAftermath = null;
      this.pendingOffer = null;
      this.pendingLineup = [];
      this.persist();
      if (this.seasonTerminal(this.season)) {
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
        this.fight?.dispose();
        this.fight = null;
        this.setMode('ludus');
        return;
      }
      const summary = applyCareerFight(this.season, {
        offer: this.pendingOffer,
        lineupIds: this.pendingLineup,
        result: action.result,
        forfeited: action.forfeited,
        boutStats: action.boutStats,
      });
      this.pendingAftermath = summary;
      this.fight?.dispose();
      this.fight = null;
      this.setMode('aftermath');
      this.persist();
      return;
    }

    if (action.type === 'EXIT') {
      this.fight?.dispose();
      this.fight = null;
      this.setMode('sandbox');
      return;
    }

    if (action.type === 'RESTART' && this.lastConfig) {
      this.enterFight(this.lastConfig, 'lab');
      return;
    }
    if (action.type === 'REROLL') {
      this.enterFight(this.practice.rerollLab(), 'lab');
    }
  }
}
