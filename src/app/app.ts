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
import { FightHud } from '../ui/fightHud';
import { LudusView } from '../ui/ludusView';
import { PracticeView } from '../ui/practiceView';
import { TitleView } from '../ui/titleView';
import { FightSession } from './fightSession';
import { SeasonController } from './seasonController';
import type { FightAction } from './scenes/fight';
import type { SeasonState } from '../domain/campaign/types';
import type { FighterSnapshot, SandboxConfig } from '../domain/combat/types';
import { ARMATURAE } from '../content/armatura';
import { isModalOpen } from '../ui/modal';

type Mode = 'title' | 'sandbox' | 'ludus' | 'fight';

export class App {
  private readonly shell: AppShell;
  private readonly input = new Input();
  private readonly synth = new Synth();
  private readonly career = new SeasonController();
  private readonly fights = new FightSession();

  private readonly title: TitleView;
  private readonly practice: PracticeView;
  private readonly ludus: LudusView;
  private readonly fightHud: FightHud;

  private mode: Mode = 'title';
  private labReturn: 'title' | 'ludus' = 'title';

  private previewPtrWasDown = false;
  private lastPracticeSel: number | null = null;
  private ambientSeed = 0x51a11;
  private frozenAftermath: StageDrawModel | null = null;
  private lastPadTop = -1;
  private lastPadBottom = -1;

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
    this.fightHud = new FightHud(beep);

    this.title.mount(this.shell.chrome);
    this.ludus.mount(this.shell.chrome);
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
        // Orientation change: director-owned land cameras reframe to the new aspect.
        const cam = this.shell.frame?.camera;
        if (cam && this.mode !== 'fight' && this.mode !== 'sandbox' && cam.mode !== 'manual') {
          const r = this.shell.stage.getBoundingClientRect();
          cam.frameArena(defaultStageDolly(r.width || 400, r.height || 400));
        }
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
    this.ludus.show(mode === 'ludus', this.season, this.ludusQueries(), this.ludusOverlay());
    this.practice.show(mode === 'sandbox');
    if (mode !== 'fight') this.fightHud.show(false);

    const frame = this.shell.frame;
    if (frame && mode !== 'fight') {
      frame.fx.clear();
      if (mode === 'sandbox') {
        frame.camera.frameArena(defaultStageDolly(400, 400));
        this.applyStagePads(72, 150);
      } else if (mode === 'ludus' && this.career.pendingAftermath) {
        // Aftermath overlay over the hub — keep the fight frame frozen behind.
        this.applyStagePads(48, 100);
      } else {
        frame.camera.frameArena(defaultStageDolly(960, 540));
        this.applyStagePads(mode === 'title' ? 0 : 48, 100);
      }
    } else if (mode === 'fight') {
      const pads = this.fightHud.getStagePads();
      this.applyStagePads(pads.top, pads.bottom);
    }

    // The frozen post-fight scene stays only while the aftermath overlay is up.
    if (!(mode === 'ludus' && this.career.pendingAftermath)) this.frozenAftermath = null;
  }

  /** Overlay state for the Ludus hub: after-bout card, terminal card, or none. */
  private ludusOverlay(): { aftermath: SeasonState['lastAftermath'] | null; terminal: boolean } {
    return {
      aftermath: this.career.pendingAftermath,
      terminal: this.career.isTerminal(),
    };
  }

  private applyStagePads(top: number, bottom: number): void {
    // Only touch the DOM when the pads actually change — setProperty every
    // frame invalidates styles on the whole HUD tree.
    if (top === this.lastPadTop && bottom === this.lastPadBottom) return;
    this.lastPadTop = top;
    this.lastPadBottom = bottom;
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
        if (this.mode === 'title') this.paintAmbient('rest');
        break;
      case 'sandbox':
        this.pollPractice();
        if (this.mode === 'sandbox') this.paintPracticeStage();
        break;
      case 'ludus':
        this.pollLudus();
        if (this.mode === 'ludus') this.paintLudusStage();
        break;
      case 'fight':
        this.paintFight();
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
    this.shell.frame.camera.applyZoomInput(
      this.input.wheelDelta,
      this.input.pinchDelta,
      this.input.orbitDx,
      this.input.orbitDy,
    );
    this.handleAmbientDrag(cssW, cssH);
    const seed = this.season?.seed ?? this.ambientSeed;
    const model =
      this.mode === 'title' ? this.titleStageModel(seed) : emptyStageDrawModel(seed, mood);
    this.shell.frame.render(model);
  }

  /** The Court breathes: two fighters squaring up on the sand behind the title. */
  private titleStageModel(seed: number): StageDrawModel {
    const a = mannequinSnapshot(1, 'MURMILLO', 'Blue', seed & 0xffff);
    a.x = ARENA_WORLD_W * 0.38;
    a.y = ARENA_WORLD_H * 0.5;
    a.facing = 0.4;
    a.intention = 'PRESS';
    const b = mannequinSnapshot(2, 'THRAEX', 'Red', (seed >> 16) & 0xffff);
    b.team = 1;
    b.x = ARENA_WORLD_W * 0.62;
    b.y = ARENA_WORLD_H * 0.5;
    b.facing = 0.4 + Math.PI;
    b.intention = 'PRESS';
    return toStageDrawModel([a, b], { seed, mood: 'rest' });
  }

  private paintPracticeStage(): void {
    if (!this.shell.frame) return;
    const { cssW, cssH } = resizeStageCanvas(this.shell);
    const cam = this.shell.frame.camera;
    cam.applyZoomInput(this.input.wheelDelta, this.input.pinchDelta, this.input.orbitDx, this.input.orbitDy);
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
    // Selecting a fighter cuts the camera to them — the chips feel alive.
    if (this.practice.selectedPreviewId !== this.lastPracticeSel) {
      this.lastPracticeSel = this.practice.selectedPreviewId;
      const sel = model.fighters.find((f) => f.id === this.practice.selectedPreviewId);
      if (sel) cam.setInterest(sel.x, sel.y, 34);
    }
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
    if (!this.shell.frame) {
      this.paintAmbient('quiet');
      return;
    }
    const { cssW, cssH } = resizeStageCanvas(this.shell);
    this.handleAmbientDrag(cssW, cssH);
    // Post-bout: keep the frozen fight scene behind the aftermath overlay.
    if (this.frozenAftermath) {
      this.shell.frame.render(this.frozenAftermath);
      return;
    }
    const preview = this.ludus.getStagePreview();
    if (!preview) {
      this.shell.frame.render(emptyStageDrawModel(this.season?.seed ?? 1, 'quiet'));
      return;
    }
    if (preview.kind === 'fighter') {
      const g = preview.gladiator;
      const spec = spawnSpecFromGladiator(g, this.season!.doctrina);
      const snap = mannequinSnapshot(g.id, g.armatura, g.name, g.appearanceSeed, spec.partsOverride);
      const model: StageDrawModel = {
        seed: this.season!.seed,
        shake: 0,
        mood: 'preview',
        fighters: [toFighterDraw(snap, { selected: true, appearanceSeed: g.appearanceSeed })],
      };
      this.shell.frame.camera.updateDirector(model.fighters, { selectedId: snap.id });
      this.shell.frame.render(model);
      return;
    }
    // Lineup preview: both teams on the sand.
    const offer = preview.offer;
    const n = offer.teamSize;
    const fighters: FighterSnapshot[] = [];
    let id = 1;
    const season = this.season!;
    for (let i = 0; i < n; i++) {
      const gid = preview.ids[i];
      const g = gid != null ? season.roster.find((x) => x.id === gid) : null;
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
    const model = toStageDrawModel(fighters, { seed: season.seed, mood: 'preview' });
    this.shell.frame.camera.updateDirector(model.fighters);
    this.shell.frame.render(model);
  }

  private handleAmbientDrag(cssW: number, cssH: number): void {
    const cam = this.shell.frame?.camera;
    if (!cam) return;
    cam.applyZoomInput(
      this.input.wheelDelta,
      this.input.pinchDelta,
      this.input.orbitDx,
      this.input.orbitDy,
    );
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
    if (action.type === 'SOUND') {
      this.synth.toggleMute();
      this.title.setMuted(this.synth.isMuted);
      this.synth.play('ui');
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
        this.setMode('ludus');
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
    this.ludus.refresh(this.season!, this.ludusQueries(), this.ludusOverlay());
  }

  private pollLudus(): void {
    if (!this.season) {
      this.goTitle();
      return;
    }
    if (this.career.isTerminal()) {
      clearSeasonSave();
      if (!this.ludus.isTerminalShown()) this.afterLudusMutation();
      return;
    }
    if (this.escaped()) {
      if (this.ludus.isLineupMode()) {
        this.ludus.backFromLineup();
        return;
      }
      if (this.ludus.isAftermathShown()) {
        this.career.clearPending();
        this.career.persist();
        this.frozenAftermath = null;
        this.afterLudusMutation();
        return;
      }
      this.career.persist();
      this.goTitle();
      return;
    }

    const action = this.ludus.poll();
    if (action.type === 'INSTANT_MATCH') {
      this.enterLab('ludus');
      return;
    }
    if (action.type === 'FIGHT') {
      this.career.pickOffer(action.offer);
      this.career.setLineup(action.lineupIds);
      this.career.setOrders(action.orders);
      const config = this.career.buildCareerConfig(action.lineupIds, action.offer);
      this.enterFight(config, 'career');
      return;
    }
    if (action.type === 'AFTERMATH_CONTINUE') {
      this.career.clearPending();
      this.career.persist();
      this.frozenAftermath = null;
      this.afterLudusMutation();
      return;
    }
    if (action.type === 'SEASON_END_TITLE') {
      this.career.settleAndClear();
      this.goTitle();
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
      this.afterLudusMutation();
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
      // The aftermath card now lives on the Ludus hub over the frozen fight scene.
      this.setMode('ludus');
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
