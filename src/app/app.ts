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
import { defaultStageDolly } from '../gl/camera';
import { emptyStageDrawModel, toFighterDraw, toStageDrawModel, type StageDrawModel } from '../gl/drawModel';
import { pickFromScreen } from '../gl/pick';
import { ARENA_WORLD_H, ARENA_WORLD_W } from '../shell/canvas';
import { spawnSpecFromGladiator } from '../domain/campaign/combatMods';
import { AftermathView } from '../ui/aftermathView';
import { FightHud } from '../ui/fightHud';
import { LineupView } from '../ui/lineupView';
import { LudusView } from '../ui/ludusView';
import { OffersView } from '../ui/offersView';
import { PracticeView } from '../ui/practiceView';
import { SeasonEndView } from '../ui/seasonEndView';
import { TitleView } from '../ui/titleView';
import { FightSession } from './fightSession';
import { SeasonController } from './seasonController';
import type { FightAction } from './scenes/fight';
import type { SeasonState } from '../domain/campaign/types';
import type { FighterSnapshot, SandboxConfig } from '../domain/combat/types';
import { ARMATURAE } from '../content/armatura';
import { isModalOpen } from '../ui/modal';

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

  private previewPtrWasDown = false;
  private ambientSeed = 0x51a11;
  private frozenAftermath: StageDrawModel | null = null;

  private last = 0;
  private acc = 0;
  private readonly step = 1 / 60;

  readonly hasGl: boolean;

  constructor() {
    applyCssTokens();
    this.shell = mountShell();
    this.hasGl = Boolean(this.shell.frame);
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
    this.input.attach(this.shell.stageWrap, (cx, cy) => {
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
        resizeStageCanvas(this.shell);
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
    // Every player-facing mode shows the GL stage.
    setStageVisible(this.shell, true);

    this.title.show(mode === 'title');
    this.ludus.show(mode === 'ludus', this.season, this.ludusQueries());
    this.offers.show(mode === 'offers', this.season);
    this.lineup.show(mode === 'lineup', this.season, this.career.pendingOffer);
    this.aftermathView.show(mode === 'aftermath', this.season, this.career.pendingAftermath);
    this.seasonEnd.show(mode === 'seasonEnd', this.season);
    this.practice.show(mode === 'sandbox');
    if (mode !== 'fight') this.fightHud.show(false);

    const frame = this.shell.frame;
    if (frame && mode !== 'fight') {
      frame.fx.clear();
      if (mode === 'sandbox') {
        frame.camera.frameArena(defaultStageDolly(400, 400));
        this.applyStagePads(72, 150);
      } else if (mode === 'aftermath') {
        this.applyStagePads(40, 120);
      } else {
        frame.camera.frameArena(780);
        this.applyStagePads(mode === 'title' || mode === 'seasonEnd' ? 0 : 48, 100);
      }
    } else if (mode === 'fight') {
      const pads = this.fightHud.getStagePads();
      this.applyStagePads(pads.top, pads.bottom);
    }

    if (mode !== 'aftermath') this.frozenAftermath = null;
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
    if (!this.shell.frame) return;
    this.practice.seed = config.seed;
    this.fights.enter(
      config,
      context,
      this.synth,
      this.fightHud,
      this.shell.frame,
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
        this.paintAmbient('rest');
        break;
      case 'sandbox':
        this.pollPractice();
        this.paintPracticeStage();
        break;
      case 'ludus':
        this.pollLudus();
        this.paintLudusStage();
        break;
      case 'offers':
        this.pollOffers();
        this.paintAmbient('quiet');
        break;
      case 'lineup':
        this.pollLineup();
        this.paintLineupStage();
        break;
      case 'fight':
        this.paintFight();
        break;
      case 'aftermath':
        this.pollAftermath();
        this.paintAftermathStage();
        break;
      case 'seasonEnd':
        this.pollSeasonEnd();
        this.paintAmbient('quiet');
        break;
    }
  }

  private paintFight(): void {
    if (!this.fights.scene || !this.shell.frame) return;
    const pads = this.fightHud.getStagePads();
    this.applyStagePads(pads.top, pads.bottom);
    const { cssW, cssH } = resizeStageCanvas(this.shell);
    this.applyFightAction(this.fights.paint(cssW, cssH, this.input));
  }

  private paintAmbient(mood: StageDrawModel['mood']): void {
    if (!this.shell.frame) return;
    const { cssW, cssH } = resizeStageCanvas(this.shell);
    this.shell.frame.camera.updateDirector([]);
    this.shell.frame.camera.applyZoomInput(this.input.wheelDelta, this.input.pinchDelta);
    this.handleAmbientDrag(cssW, cssH);
    const seed = this.season?.seed ?? this.ambientSeed;
    this.shell.frame.render(emptyStageDrawModel(seed, mood));
  }

  private paintPracticeStage(): void {
    if (!this.shell.frame) return;
    const { cssW, cssH } = resizeStageCanvas(this.shell);
    const cam = this.shell.frame.camera;
    cam.applyZoomInput(this.input.wheelDelta, this.input.pinchDelta);
    if (this.input.wasKeyPressed('Equal') || this.input.wasKeyPressed('NumpadAdd')) {
      cam.nudgeDolly(0.08);
    }
    if (this.input.wasKeyPressed('Minus') || this.input.wasKeyPressed('NumpadSubtract')) {
      cam.nudgeDolly(-0.08);
    }
    const snaps = this.practice.previewSnapshots();
    const model = toStageDrawModel(snaps, {
      seed: this.practice.seed,
      selectedId: this.practice.selectedPreviewId,
      mood: 'preview',
    });
    cam.updateDirector(model.fighters, { selectedId: this.practice.selectedPreviewId });
    this.shell.frame.render(model);

    if (this.practice.mode === 'custom') {
      this.previewPtrWasDown = this.input.pointer.down;
      return;
    }
    if (this.input.isPinching) {
      if (cam.isDragging()) cam.endDrag();
      this.previewPtrWasDown = this.input.pointer.down;
      return;
    }
    const p = this.input.pointer;
    const inStage = p.x >= 0 && p.x <= cssW && p.y >= 0 && p.y <= cssH;
    const orbit = this.input.isKeyDown('ShiftLeft') || this.input.isKeyDown('ShiftRight');
    if (p.down && !this.previewPtrWasDown && inStage) {
      cam.beginDrag(p.x, p.y, orbit);
    }
    if (p.down && cam.isDragging()) cam.dragTo(p.x, p.y);
    if (!p.down && this.previewPtrWasDown) {
      const dragged = cam.endDrag();
      if (!dragged && inStage) {
        const hit = pickFromScreen(cam, model.fighters, p.x, p.y, cssW, cssH, 42);
        if (hit) {
          this.practice.selectedPreviewId = hit.id;
          this.synth.play('ui');
        } else {
          this.practice.selectedPreviewId = null;
        }
      }
      this.input.pointer.clicked = false;
    }
    this.previewPtrWasDown = p.down;
  }

  private paintLudusStage(): void {
    if (!this.shell.frame || !this.season) {
      this.paintAmbient('quiet');
      return;
    }
    const { cssW, cssH } = resizeStageCanvas(this.shell);
    this.handleAmbientDrag(cssW, cssH);
    const selId = this.ludus.getSelectedId();
    const g =
      (selId != null ? this.season.roster.find((x) => x.id === selId) : null) ??
      this.season.roster.find((x) => !x.retired) ??
      null;
    if (!g) {
      this.shell.frame.render(emptyStageDrawModel(this.season.seed, 'quiet'));
      return;
    }
    const spec = spawnSpecFromGladiator(g, this.season.doctrina);
    const snap = mannequinSnapshot(g.id, g.armatura, g.name, g.appearanceSeed, spec.partsOverride);
    const model: StageDrawModel = {
      seed: this.season.seed,
      shake: 0,
      mood: 'preview',
      fighters: [toFighterDraw(snap, { selected: true, appearanceSeed: g.appearanceSeed })],
    };
    this.shell.frame.camera.updateDirector(model.fighters, { selectedId: snap.id });
    this.shell.frame.render(model);
  }

  private paintLineupStage(): void {
    if (!this.shell.frame || !this.season || !this.career.pendingOffer) {
      this.paintAmbient('quiet');
      return;
    }
    const { cssW, cssH } = resizeStageCanvas(this.shell);
    this.handleAmbientDrag(cssW, cssH);
    const ids = this.lineup.getLineupIds();
    const offer = this.career.pendingOffer;
    const fighters: FighterSnapshot[] = [];
    let id = 1;
    const n = offer.teamSize;
    for (let i = 0; i < n; i++) {
      const gid = ids[i];
      const g = gid != null ? this.season.roster.find((x) => x.id === gid) : null;
      const legal = Boolean(g);
      const armatura = g?.armatura ?? 'MURMILLO';
      const snap = mannequinSnapshot(
        id++,
        armatura,
        g?.name ?? `Slot ${i + 1}`,
        g?.appearanceSeed ?? id * 9973,
        g?.partsOverride,
      );
      snap.team = 0;
      snap.x = ARENA_WORLD_W * 0.35;
      snap.y = ARENA_WORLD_H * 0.5 + (i - (n - 1) / 2) * 48;
      snap.alive = legal;
      fighters.push(snap);
    }
    for (let i = 0; i < n; i++) {
      const armatura = offer.opponents[i] ?? 'MURMILLO';
      const snap = mannequinSnapshot(id++, armatura, ARMATURAE[armatura].name, id * 9973);
      snap.team = 1;
      snap.x = ARENA_WORLD_W * 0.65;
      snap.y = ARENA_WORLD_H * 0.5 + (i - (n - 1) / 2) * 48;
      fighters.push(snap);
    }
    const model = toStageDrawModel(fighters, { seed: this.season.seed, mood: 'preview' });
    this.shell.frame.camera.updateDirector(model.fighters);
    this.shell.frame.render(model);
  }

  private paintAftermathStage(): void {
    if (!this.shell.frame) return;
    const { cssW, cssH } = resizeStageCanvas(this.shell);
    this.handleAmbientDrag(cssW, cssH);
    if (!this.frozenAftermath && this.fights.scene) {
      this.frozenAftermath = this.fights.scene.lastDrawModel();
    }
    const model =
      this.frozenAftermath ??
      emptyStageDrawModel(
        this.season?.seed ?? 1,
        this.career.pendingAftermath?.result === 'WIN' ? 'win' : 'loss',
      );
    this.shell.frame.render(model);
  }

  private handleAmbientDrag(cssW: number, cssH: number): void {
    const cam = this.shell.frame?.camera;
    if (!cam) return;
    cam.applyZoomInput(this.input.wheelDelta, this.input.pinchDelta);
    if (this.input.isPinching) {
      if (cam.isDragging()) cam.endDrag();
      this.previewPtrWasDown = this.input.pointer.down;
      return;
    }
    const p = this.input.pointer;
    const inStage = p.x >= 0 && p.x <= cssW && p.y >= 0 && p.y <= cssH;
    const orbit = this.input.isKeyDown('ShiftLeft') || this.input.isKeyDown('ShiftRight');
    if (p.down && !this.previewPtrWasDown && inStage) cam.beginDrag(p.x, p.y, orbit);
    if (p.down && cam.isDragging()) cam.dragTo(p.x, p.y);
    if (!p.down && this.previewPtrWasDown) cam.endDrag();
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
    if (this.escaped()) {
      this.leavePractice();
      return;
    }
    const action = this.practice.poll();
    if (action.type === 'BACK') {
      this.leavePractice();
      return;
    }
    if (action.type === 'START') {
      this.enterFight(action.config, 'lab');
    }
  }

  private leavePractice(): void {
    this.setMode(this.labReturn === 'ludus' && this.season ? 'ludus' : 'title');
  }

  private ludusQueries() {
    const c = this.career;
    return {
      upkeepCost: () => c.upkeepCost(),
      fightableCount: () => c.fightableCount(),
      rosterCap: () => c.rosterCap(),
      medicusCost: (tier: Parameters<SeasonController['medicusCost']>[0]) => c.medicusCost(tier),
      injuryLabel: (inj: Parameters<SeasonController['injuryLabel']>[0]) => c.injuryLabel(inj),
    };
  }

  private afterLudusMutation(): void {
    if (this.career.isTerminal()) {
      clearSeasonSave();
      this.setMode('seasonEnd');
    } else {
      this.ludus.refresh(this.season!, this.ludusQueries());
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
    if (this.escaped()) {
      this.career.persist();
      this.goTitle();
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
      this.afterLudusMutation();
      return;
    }
    if (action.type === 'TITLE') {
      this.career.persist();
      this.goTitle();
      return;
    }
    if (action.type === 'REST') {
      if (!this.career.restDay()) return;
      this.career.pendingAftermath = this.season.lastAftermath;
      if (this.career.isTerminal()) {
        clearSeasonSave();
        this.setMode('seasonEnd');
      } else if (this.career.pendingAftermath) {
        this.setMode('aftermath');
      }
      return;
    }
    if (action.type === 'ASSIGN') {
      if (this.career.setAssignment(action.id, action.assignment)) this.afterLudusMutation();
      return;
    }
    if (action.type === 'MEDICUS') {
      if (this.career.applyMedicus(action.id, action.tier)) this.afterLudusMutation();
      return;
    }
    if (action.type === 'RELEASE') {
      if (this.career.release(action.id)) this.afterLudusMutation();
      return;
    }
    if (action.type === 'BUY_RECRUIT') {
      if (this.career.buyRecruit(action.offerId)) this.afterLudusMutation();
      return;
    }
    if (action.type === 'SET_DOCTRINA') {
      this.career.setDoctrina(action.doctrina);
      this.afterLudusMutation();
      return;
    }
    if (action.type === 'BUY_FACILITY') {
      if (this.career.buyFacility(action.kind)) this.afterLudusMutation();
      return;
    }
    if (action.type === 'UPGRADE_GEAR') {
      if (this.career.upgradeGear(action.id)) this.afterLudusMutation();
      return;
    }
    if (action.type === 'EQUIP_PART') {
      if (this.career.equipPart(action.id, action.slot, action.partId)) this.afterLudusMutation();
    }
  }

  private pollOffers(): void {
    if (!this.season) {
      this.goTitle();
      return;
    }
    if (this.escaped()) {
      this.setMode('ludus');
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
    if (this.escaped()) {
      this.setMode('offers');
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
    if (this.escaped()) {
      this.career.clearPending();
      this.career.persist();
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

  /** Esc backs out one menu level — never while a modal is open. */
  private escaped(): boolean {
    return this.input.wasKeyPressed('Escape') && !isModalOpen();
  }

  private applyFightAction(action: FightAction): void {
    if (action.type === 'NONE') return;

    if (action.type === 'CAREER_DONE') {
      if (this.fights.scene) this.frozenAftermath = this.fights.scene.lastDrawModel();
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

function mannequinSnapshot(
  id: number,
  armatura: FighterSnapshot['armatura'],
  name: string,
  appearanceSeed: number,
  partsOverride?: string[],
): FighterSnapshot {
  const kit = ARMATURAE[armatura];
  return {
    id,
    team: 0,
    kind: 'gladiator',
    armatura,
    beastId: null,
    name,
    x: ARENA_WORLD_W * 0.5,
    y: ARENA_WORLD_H * 0.5,
    facing: 0.4,
    hp: kit.maxHealth,
    maxHp: kit.maxHealth,
    stamina: kit.maxStamina,
    maxStamina: kit.maxStamina,
    poise: kit.maxPoise,
    maxPoise: kit.maxPoise,
    action: 'NONE',
    phase: 'IDLE',
    phaseT: 0,
    phaseMax: 0,
    footwork: 'HOLD',
    intention: 'NONE',
    desiredDist: (kit.measureMin + kit.measureMax) * 0.5,
    poiseTier: 'SOLID',
    stunned: false,
    tangled: false,
    poiseBroken: false,
    guarding: false,
    alive: true,
    flash: 0,
    partsOverride,
    appearanceSeed,
  };
}
