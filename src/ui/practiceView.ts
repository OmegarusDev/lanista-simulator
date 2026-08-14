import { ARMATURA_LIST, ARMATURAE, type ArmaturaId } from '../content/armatura';
import { BEAST_LIST, BEASTS, type BeastId } from '../content/beasts';
import { PAIRING_PRESETS } from '../content/pairings';
import {
  generateQuickTeam,
  generateVenatioTeams,
  type QuickCard,
} from '../domain/combat/quickGen';
import type {
  FighterSpawnSpec,
  MatchKind,
  SandboxConfig,
  TeamSize,
} from '../domain/combat/types';
import type { Input } from '../shell/input';
import type { Synth } from '../view/audio';
import { placePreviewInWorld, posedCardsToSnapshots } from '../view/posedPreview';
import { btn, clear, el } from './dom';
import { segControl } from './components';

export type SandboxAction =
  | { type: 'START'; config: SandboxConfig }
  | { type: 'BACK' }
  | { type: 'NONE' };

/** Human kit or random. */
type HumanPick = ArmaturaId | 'RANDOM';
/** Beast kit or random — Red side in venatio. */
type BeastPick = BeastId | 'RANDOM';
type SlotPick = HumanPick | BeastPick;

type Mode = 'quick' | 'custom';

const HUMAN_PICKS: HumanPick[] = ['RANDOM', ...ARMATURA_LIST];
/** Full beast roster — never hardcode a subset. */
const BEAST_PICKS: BeastPick[] = ['RANDOM', ...BEAST_LIST];

function isBeastId(id: string): id is BeastId {
  return (BEAST_LIST as readonly string[]).includes(id);
}

function isArmaturaId(id: string): id is ArmaturaId {
  return (ARMATURA_LIST as readonly string[]).includes(id);
}

function resolveHuman(pick: HumanPick, salt: number): ArmaturaId {
  if (pick !== 'RANDOM') return pick;
  return ARMATURA_LIST[salt % ARMATURA_LIST.length]!;
}

function resolveBeast(pick: BeastPick, salt: number): BeastId {
  if (pick !== 'RANDOM') return pick;
  return BEAST_LIST[salt % BEAST_LIST.length]!;
}

function beastSpec(beast: BeastId): FighterSpawnSpec {
  const def = BEASTS[beast];
  return {
    kind: 'beast',
    beast,
    armatura: 'MURMILLO',
    name: def.name,
    pursueBiasAdd: 0.1,
  };
}

function pickShort(pick: SlotPick): string {
  if (pick === 'RANDOM') return 'Rnd';
  if (isBeastId(pick)) return BEASTS[pick].short;
  return ARMATURAE[pick].short;
}

function pickTitle(pick: SlotPick): string {
  if (pick === 'RANDOM') return 'Random';
  if (isBeastId(pick)) return `${BEASTS[pick].name} (${BEASTS[pick].short})`;
  return `${ARMATURAE[pick].name} (${ARMATURAE[pick].short})`;
}

/** Skirmish Yard — instant fights: DOM chrome + shared stage preview pipeline. */
export class PracticeView {
  readonly root: HTMLElement;
  readonly sheet: HTMLElement;
  mode: Mode = 'quick';
  matchKind: MatchKind = 'matchup';
  teamSize: TeamSize = 1;
  seed = (Math.random() * 0xffffffff) >>> 0;
  /** Blue always human kits. */
  slots0: HumanPick[] = ['RANDOM', 'RANDOM', 'RANDOM'];
  /** Red: armaturae in matchup, beasts in venatio. */
  slots1: SlotPick[] = ['RANDOM', 'RANDOM', 'RANDOM'];
  editSlot0 = 0;
  editSlot1 = 0;
  private cards0: QuickCard[] = [];
  private cards1: QuickCard[] = [];
  selectedPreviewId: number | null = null;
  private pending: SandboxAction = { type: 'NONE' };

  constructor(
    private readonly synth: Synth,
    private readonly onUi: () => void,
  ) {
    this.root = el('div', { className: 'practice-screen is-hidden' });
    this.sheet = el('div', { className: 'sheet is-hidden' });
    this.rerollQuick();
  }

  mount(host: HTMLElement): void {
    host.append(this.root, this.sheet);
    this.renderChrome();
  }

  show(visible: boolean): void {
    if (!visible) {
      this.root.classList.add('is-hidden');
      this.sheet.classList.add('is-hidden');
      return;
    }
    if (this.mode === 'custom') {
      this.root.classList.add('is-hidden');
      this.renderSheet();
    } else {
      this.root.classList.remove('is-hidden');
      this.sheet.classList.add('is-hidden');
      this.renderChrome();
    }
  }

  poll(): SandboxAction {
    const a = this.pending;
    this.pending = { type: 'NONE' };
    return a;
  }

  /** Keyboard shortcuts while Practice is active. */
  handleKeys(input: Input): SandboxAction {
    // The custom sheet owns the keyboard — stray Enter/Space must not launch.
    if (this.mode === 'custom') return { type: 'NONE' };
    if (input.wasKeyPressed('Space') || input.wasKeyPressed('Enter')) {
      return { type: 'START', config: this.makeConfig() };
    }
    if (input.wasKeyPressed('KeyR')) {
      this.seed = (this.seed * 1103515245 + 12345) >>> 0;
      if (this.mode === 'quick') this.rerollQuick();
      this.synth.play('ui');
      this.renderChrome();
    }
    return { type: 'NONE' };
  }

  previewSnapshots() {
    // Custom sheet keeps cards in sync so Fight still uses makeCustomConfig;
    // Quick (and venatio) use live cards for the shared stage preview.
    if (this.mode === 'custom') {
      const { team0, team1 } = this.cardsFromCustomSlots();
      return placePreviewInWorld(
        posedCardsToSnapshots(team0, team1, this.teamSize),
        this.teamSize,
      );
    }
    const raw = posedCardsToSnapshots(this.cards0, this.cards1, this.teamSize);
    return placePreviewInWorld(raw, this.teamSize);
  }

  makeQuickConfig(): SandboxConfig {
    const n = this.teamSize;
    const c0 = this.cards0.slice(0, n);
    const c1 = this.cards1.slice(0, n);
    return {
      teamSize: n,
      seed: this.seed,
      team0: c0.map((c) => c.armatura),
      team1: c1.map((c) => c.armatura),
      team0Specs: c0.map((c) => c.spec),
      team1Specs: c1.map((c) => c.spec),
    };
  }

  makeCustomConfig(): SandboxConfig {
    const n = this.teamSize;
    const team0 = this.slots0.slice(0, n).map((p, i) => resolveHuman(p, this.seed + i * 3));
    if (this.matchKind === 'venatio') {
      const beasts = this.slots1
        .slice(0, n)
        .map((p, i) => resolveBeast(p as BeastPick, this.seed + 7 + i * 5));
      return {
        teamSize: n,
        seed: this.seed,
        team0,
        team1: beasts.map(() => 'MURMILLO' as ArmaturaId),
        team0Specs: undefined,
        team1Specs: beasts.map((b) => beastSpec(b)),
      };
    }
    const team1 = this.slots1
      .slice(0, n)
      .map((p, i) => resolveHuman(p as HumanPick, this.seed + 7 + i * 5));
    return {
      teamSize: n,
      seed: this.seed,
      team0,
      team1,
    };
  }

  makeConfig(): SandboxConfig {
    return this.mode === 'quick' ? this.makeQuickConfig() : this.makeCustomConfig();
  }

  rerollLab(): SandboxConfig {
    this.seed = (Math.random() * 0xffffffff) >>> 0;
    if (this.mode === 'quick') this.rerollQuick();
    this.renderChrome();
    return this.makeConfig();
  }

  private cardsFromCustomSlots(): { team0: QuickCard[]; team1: QuickCard[] } {
    const n = this.teamSize;
    const team0: QuickCard[] = [];
    for (let i = 0; i < n; i++) {
      const arm = resolveHuman(this.slots0[i]!, this.seed + i * 3);
      const def = ARMATURAE[arm];
      team0.push({
        name: def.name,
        armatura: arm,
        temperament: 'CAUTUS',
        grade: 'ORDINARIUS',
        age: 25,
        spec: { armatura: arm, name: def.name },
      });
    }
    const team1: QuickCard[] = [];
    for (let i = 0; i < n; i++) {
      if (this.matchKind === 'venatio') {
        const beast = resolveBeast(this.slots1[i]! as BeastPick, this.seed + 7 + i * 5);
        const def = BEASTS[beast];
        team1.push({
          name: def.name,
          armatura: 'MURMILLO',
          temperament: 'FEROX',
          grade: 'ORDINARIUS',
          age: 0,
          beastId: beast,
          spec: beastSpec(beast),
        });
      } else {
        const arm = resolveHuman(this.slots1[i]! as HumanPick, this.seed + 7 + i * 5);
        const def = ARMATURAE[arm];
        team1.push({
          name: def.name,
          armatura: arm,
          temperament: 'CAUTUS',
          grade: 'ORDINARIUS',
          age: 25,
          spec: { armatura: arm, name: def.name },
        });
      }
    }
    return { team0, team1 };
  }

  private rerollQuick(): void {
    if (this.matchKind === 'venatio') {
      const v = generateVenatioTeams(this.seed, this.teamSize);
      this.cards0 = v.team0;
      this.cards1 = v.team1;
    } else {
      this.cards0 = generateQuickTeam(this.seed, this.teamSize, 1);
      this.cards1 = generateQuickTeam(this.seed, this.teamSize, 2);
    }
    this.selectedPreviewId = null;
  }

  private setMatchKind(kind: MatchKind): void {
    this.matchKind = kind;
    // Keep Red slots valid for the format.
    if (kind === 'venatio') {
      this.slots1 = this.slots1.map((p) => (isBeastId(p) || p === 'RANDOM' ? p : 'RANDOM'));
      while (this.slots1.length < 3) this.slots1.push('RANDOM');
    } else {
      this.slots1 = this.slots1.map((p) => (isArmaturaId(p) || p === 'RANDOM' ? p : 'RANDOM'));
      while (this.slots1.length < 3) this.slots1.push('RANDOM');
    }
    if (this.mode === 'quick') this.rerollQuick();
  }

  private setTeamSize(n: TeamSize): void {
    this.teamSize = n;
    while (this.slots0.length < 3) this.slots0.push('RANDOM');
    while (this.slots1.length < 3) this.slots1.push('RANDOM');
    this.editSlot0 = Math.min(this.editSlot0, n - 1);
    this.editSlot1 = Math.min(this.editSlot1, n - 1);
    if (this.mode === 'quick') this.rerollQuick();
  }

  private emit(action: SandboxAction): void {
    this.onUi();
    this.pending = action;
  }

  private focusLabel(f: {
    name: string;
    kind: string;
    beastId: BeastId | null;
  }): string {
    if (f.beastId) {
      const b = BEASTS[f.beastId];
      return `${b.short}·${b.name}`;
    }
    return f.name.slice(0, 10);
  }

  private renderChrome(): void {
    if (this.mode === 'custom') {
      this.root.classList.add('is-hidden');
      this.renderSheet();
      return;
    }
    this.sheet.classList.add('is-hidden');
    clear(this.root);

    const top = el('div', { className: 'practice-top' });
    const titleRow = el('div', { className: 'title-row' });
    titleRow.append(
      btn('←', {
        className: 'ghost',
        onClick: () => this.emit({ type: 'BACK' }),
      }),
    );
    titleRow.append(el('h1', { text: 'Skirmish' }));
    top.append(titleRow);

    const strip = el('div', { className: 'setup-row' });
    strip.append(
      segControl(['Match', 'Venatio'], this.matchKind === 'matchup' ? 0 : 1, (i) => {
        this.setMatchKind(i === 0 ? 'matchup' : 'venatio');
        this.synth.play('ui');
        this.renderChrome();
      }),
    );
    strip.append(
      segControl(['1v1', '2v2', '3v3'], this.teamSize - 1, (i) => {
        this.setTeamSize((i + 1) as TeamSize);
        this.synth.play('ui');
        this.renderChrome();
      }),
    );
    top.append(strip);
    this.root.append(top);

    const bottom = el('div', { className: 'practice-bottom' });
    const snaps = this.previewSnapshots();
    const focus = el('div', { className: 'practice-focus' });
    focus.append(
      btn('Blue', {
        className: 'quiet',
        active: snaps.some((f) => f.team === 0 && f.id === this.selectedPreviewId),
        onClick: () => {
          this.selectedPreviewId = snaps.find((f) => f.team === 0)?.id ?? null;
          this.synth.play('ui');
          this.renderChrome();
        },
      }),
    );
    focus.append(
      btn(this.matchKind === 'venatio' ? 'Beasts' : 'Red', {
        className: 'quiet',
        active: snaps.some((f) => f.team === 1 && f.id === this.selectedPreviewId),
        onClick: () => {
          this.selectedPreviewId = snaps.find((f) => f.team === 1)?.id ?? null;
          this.synth.play('ui');
          this.renderChrome();
        },
      }),
    );
    for (const f of snaps) {
      focus.append(
        btn(this.focusLabel(f), {
          active: this.selectedPreviewId === f.id,
          onClick: () => {
            this.selectedPreviewId = f.id;
            this.synth.play('ui');
            this.renderChrome();
          },
        }),
      );
    }
    bottom.append(focus);

    const actions = el('div', { className: 'practice-actions' });
    actions.append(
      btn('Fight', {
        className: 'cta',
        onClick: () => this.emit({ type: 'START', config: this.makeQuickConfig() }),
      }),
    );
    const secondary = el('div', { className: 'secondary-actions' });
    secondary.append(
      btn('Reroll', {
        onClick: () => {
          this.seed = (Math.random() * 0xffffffff) >>> 0;
          this.rerollQuick();
          this.synth.play('ui');
          this.renderChrome();
        },
      }),
      btn('Custom', {
        className: 'ghost',
        onClick: () => {
          this.mode = 'custom';
          this.synth.play('ui');
          this.renderChrome();
        },
      }),
    );
    actions.append(secondary);
    bottom.append(actions);
    this.root.append(bottom);
  }

  private renderSheet(): void {
    this.sheet.classList.remove('is-hidden');
    clear(this.sheet);

    const header = el('div', { className: 'sheet-header' });
    header.append(
      btn('←', {
        className: 'ghost',
        onClick: () => {
          this.mode = 'quick';
          this.rerollQuick();
          this.synth.play('ui');
          this.root.classList.remove('is-hidden');
          this.renderChrome();
        },
      }),
    );
    header.append(el('h1', { text: 'Custom' }));
    // balance spacer for centered title
    header.append(el('span', { attrs: { style: 'width:3rem' } }));
    this.sheet.append(header);
    this.sheet.append(
      el('p', {
        className: 'subhead',
        text:
          this.matchKind === 'venatio'
            ? 'Blue kits · Red beasts'
            : 'Pick kits for each side',
      }),
    );

    const setup = el('div', { className: 'setup-row' });
    setup.append(
      segControl(['Match', 'Venatio'], this.matchKind === 'matchup' ? 0 : 1, (i) => {
        this.setMatchKind(i === 0 ? 'matchup' : 'venatio');
        this.synth.play('ui');
        this.renderSheet();
      }),
    );
    setup.append(
      segControl(['1v1', '2v2', '3v3'], this.teamSize - 1, (i) => {
        this.setTeamSize((i + 1) as TeamSize);
        this.synth.play('ui');
        this.renderSheet();
      }),
    );
    this.sheet.append(setup);

    if (this.matchKind !== 'venatio') {
      const presets = el('div', { className: 'preset-block' });
      presets.append(el('p', { className: 'section-label', text: 'Historical' }));
      const grid = el('div', { className: 'preset-grid' });
      for (const p of PAIRING_PRESETS) {
        grid.append(
          btn(p.label, {
            className: 'quiet',
            onClick: () => {
              this.teamSize = 1;
              this.slots0 = [p.team0[0]!, 'RANDOM', 'RANDOM'];
              this.slots1 = [p.team1[0]!, 'RANDOM', 'RANDOM'];
              this.matchKind = 'matchup';
              this.synth.play('ui');
              this.emit({
                type: 'START',
                config: {
                  teamSize: 1,
                  seed: this.seed,
                  team0: [p.team0[0]!],
                  team1: [p.team1[0]!],
                },
              });
            },
          }),
        );
      }
      presets.append(grid);
      this.sheet.append(presets);
    }

    const sides = el('div', { className: 'custom-sides' });
    sides.append(this.buildSide(0));
    sides.append(this.buildSide(1));
    this.sheet.append(sides);

    const foot = el('div', { className: 'sheet-footer' });
    foot.append(
      btn('Fight', {
        className: 'cta',
        onClick: () => this.emit({ type: 'START', config: this.makeCustomConfig() }),
      }),
    );
    this.sheet.append(foot);
  }

  private buildSide(team: 0 | 1): HTMLElement {
    const beastSide = team === 1 && this.matchKind === 'venatio';
    const slots = team === 0 ? this.slots0 : this.slots1;
    let edit = team === 0 ? this.editSlot0 : this.editSlot1;
    const panel = el('div', { className: 'side-panel' });
    const title = team === 0 ? 'Blue' : beastSide ? 'Beasts' : 'Red';
    panel.append(el('h3', { text: title }));

    const slotRow = el('div', { className: 'row-btns' });
    for (let s = 0; s < this.teamSize; s++) {
      const pick = slots[s]!;
      const b = btn(pickShort(pick), {
        active: edit === s,
        onClick: () => {
          if (team === 0) this.editSlot0 = s;
          else this.editSlot1 = s;
          this.synth.play('ui');
          this.renderSheet();
        },
      });
      b.title = pickTitle(pick);
      slotRow.append(b);
    }
    panel.append(slotRow);

    edit = team === 0 ? this.editSlot0 : this.editSlot1;
    const current = slots[edit]!;
    const opts: readonly SlotPick[] = beastSide ? BEAST_PICKS : HUMAN_PICKS;
    const grid = el('div', { className: `pick-grid${beastSide ? ' beast-picks' : ''}` });
    for (const opt of opts) {
      const lab = opt === 'RANDOM' ? '?' : pickShort(opt);
      const b = btn(lab, {
        active: current === opt,
        onClick: () => {
          slots[edit] = opt as never;
          this.synth.play('ui');
          this.renderSheet();
        },
      });
      b.title = pickTitle(opt);
      if (opt !== 'RANDOM' && isBeastId(opt)) {
        b.textContent = '';
        b.append(el('span', { className: 'pick-short', text: BEASTS[opt].short }));
        b.append(el('span', { className: 'pick-name', text: BEASTS[opt].name }));
      }
      grid.append(b);
    }
    panel.append(grid);
    return panel;
  }
}

/** @deprecated alias for App wiring */
export { PracticeView as SandboxScene };
