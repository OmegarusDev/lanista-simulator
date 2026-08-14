import { ARMATURA_LIST, ARMATURAE, type ArmaturaId } from '../content/armatura';
import { BEAST_LIST, BEASTS, type BeastId } from '../content/beasts';
import { PAIRING_PRESETS } from '../content/pairings';
import type { QuickCard } from '../domain/combat/quickGen';
import type { FighterSpawnSpec, SandboxConfig, TeamSize } from '../domain/combat/types';
import type { Input } from '../shell/input';
import type { Synth } from '../view/audio';
import { placePreviewInWorld, posedCardsToSnapshots } from '../view/posedPreview';
import { clear, el } from './dom';
import { button } from './components';

export type SandboxAction =
  | { type: 'START'; config: SandboxConfig }
  | { type: 'BACK' }
  | { type: 'NONE' };

/** One slot can be a kit, a beast, or a roll of the dice. */
type SlotPick = ArmaturaId | BeastId | 'RANDOM';

/** Sandbox squad cap — a sensible upper bound for team sizes. */
export const MAX_SQUAD = 4;

const KIT_PICKS: SlotPick[] = ['RANDOM', ...ARMATURA_LIST];
const BEAST_PICKS: (BeastId | 'RANDOM')[] = ['RANDOM', ...BEAST_LIST];

function isBeastId(id: string): id is BeastId {
  return (BEAST_LIST as readonly string[]).includes(id);
}

function resolveArmatura(pick: SlotPick, salt: number): ArmaturaId {
  if (pick !== 'RANDOM' && !isBeastId(pick)) return pick;
  return ARMATURA_LIST[salt % ARMATURA_LIST.length]!;
}

function beastSpec(beast: BeastId): FighterSpawnSpec {
  const def = BEASTS[beast];
  return {
    kind: 'beast',
    beast,
    armatura: 'MURMILLO',
    name: def.name,
    temperament: 'FEROX',
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

/**
 * The Sandbox — direct-manipulation squad building.
 *
 * The arena IS the interface: tap a fighter (on the sand or in the squad
 * rows) and the unit chooser opens for exactly that slot — kits, beasts,
 * dice, or removal. Sides are independent, so mismatched fights (1v3, beasts
 * anywhere, whatever mix) are natural. Selecting IS choosing.
 */
export class PracticeView {
  readonly root: HTMLElement;
  /** The unit chooser — a translucent panel over the live arena. */
  readonly sheet: HTMLElement;
  seed = (Math.random() * 0xffffffff) >>> 0;
  /** Independent squads — each slot is a kit, a beast, or RANDOM. */
  squad0: SlotPick[] = ['RANDOM'];
  squad1: SlotPick[] = ['RANDOM'];
  /** Which slot the chooser is editing (null = closed). */
  editSide: 0 | 1 = 0;
  editSlot = 0;
  editing = false;
  selectedPreviewId: number | null = null;
  private pending: SandboxAction = { type: 'NONE' };
  /** Preview snapshot id → squad position, for tapping fighters on the sand. */
  private readonly slotMap = new Map<number, { side: 0 | 1; slot: number }>();

  constructor(
    private readonly synth: Synth,
    private readonly onUi: () => void,
  ) {
    this.root = el('div', { className: 'practice-screen is-hidden' });
    this.sheet = el('div', { className: 'sheet is-hidden' });
  }

  mount(host: HTMLElement): void {
    host.append(this.root, this.sheet);
    this.render();
  }

  show(visible: boolean): void {
    if (!visible) {
      this.root.classList.add('is-hidden');
      this.sheet.classList.add('is-hidden');
      return;
    }
    this.root.classList.remove('is-hidden');
    this.render();
  }

  poll(): SandboxAction {
    const a = this.pending;
    this.pending = { type: 'NONE' };
    return a;
  }

  /** Keyboard while the sandbox is up — the chooser owns the keys. */
  handleKeys(input: Input): SandboxAction {
    if (this.editing) return { type: 'NONE' };
    if (input.wasKeyPressed('Space') || input.wasKeyPressed('Enter')) {
      return { type: 'START', config: this.makeConfig() };
    }
    if (input.wasKeyPressed('KeyR')) {
      this.seed = (this.seed * 1103515245 + 12345) >>> 0;
      this.synth.play('ui');
      this.render();
    }
    return { type: 'NONE' };
  }

  previewSnapshots() {
    const c0 = this.cardsFor(0);
    const c1 = this.cardsFor(1);
    const snaps = posedCardsToSnapshots(c0, c1, [c0.length, c1.length]);
    this.slotMap.clear();
    let id = 1;
    for (let i = 0; i < c0.length; i++) this.slotMap.set(id++, { side: 0, slot: i });
    for (let i = 0; i < c1.length; i++) this.slotMap.set(id++, { side: 1, slot: i });
    return placePreviewInWorld(snaps, [c0.length, c1.length]);
  }

  /** A fighter on the sand was tapped — open the chooser on their slot. */
  selectById(id: number): void {
    const at = this.slotMap.get(id);
    if (!at) return;
    this.selectedPreviewId = id;
    this.editSide = at.side;
    this.editSlot = at.slot;
    this.editing = true;
    this.synth.play('ui');
    this.render();
  }

  makeConfig(): SandboxConfig {
    const c0 = this.cardsFor(0);
    const c1 = this.cardsFor(1);
    return {
      teamSize: Math.max(c0.length, c1.length) as TeamSize,
      team0Size: c0.length,
      team1Size: c1.length,
      seed: this.seed,
      team0: c0.map((c) => c.armatura),
      team1: c1.map((c) => c.armatura),
      team0Specs: c0.map((c) => c.spec),
      team1Specs: c1.map((c) => c.spec),
    };
  }

  rerollLab(): SandboxConfig {
    this.seed = (Math.random() * 0xffffffff) >>> 0;
    this.render();
    return this.makeConfig();
  }

  private cardsFor(side: 0 | 1): QuickCard[] {
    const picks = side === 0 ? this.squad0 : this.squad1;
    return picks.map((pick, i) => {
      const salt = this.seed + (side === 0 ? i * 3 : 7 + i * 5);
      if (pick !== 'RANDOM' && isBeastId(pick)) {
        const def = BEASTS[pick];
        return {
          name: def.name,
          armatura: 'MURMILLO',
          temperament: 'FEROX',
          grade: 'ORDINARIUS',
          age: 0,
          beastId: pick,
          spec: beastSpec(pick),
        };
      }
      const arm = resolveArmatura(pick, salt);
      const def = ARMATURAE[arm];
      return {
        name: def.name,
        armatura: arm,
        temperament: 'CAUTUS',
        grade: 'ORDINARIUS',
        age: 25,
        spec: { armatura: arm, name: def.name },
      };
    });
  }

  private emit(action: SandboxAction): void {
    this.onUi();
    this.pending = action;
  }

  private sidePicks(side: 0 | 1): SlotPick[] {
    return side === 0 ? this.squad0 : this.squad1;
  }

  private setPick(side: 0 | 1, slot: number, pick: SlotPick): void {
    this.sidePicks(side)[slot] = pick;
    this.selectedPreviewId = null;
    this.synth.play('ui');
    this.render();
  }

  private addSlot(side: 0 | 1): void {
    const picks = this.sidePicks(side);
    if (picks.length >= MAX_SQUAD) return;
    picks.push('RANDOM');
    this.synth.play('ui');
    this.render();
  }

  private removeSlot(side: 0 | 1, slot: number): void {
    const picks = this.sidePicks(side);
    if (picks.length <= 1) return;
    picks.splice(slot, 1);
    this.editSlot = Math.min(this.editSlot, picks.length - 1);
    this.synth.play('ui');
    this.render();
  }

  private rollSlot(side: 0 | 1, slot: number): void {
    this.seed = (this.seed * 1103515245 + 12345) >>> 0;
    this.sidePicks(side)[slot] = 'RANDOM';
    this.synth.play('ui');
    this.render();
  }

  private applyPreset(): void {
    const p = PAIRING_PRESETS[(this.seed >>> 4) % PAIRING_PRESETS.length]!;
    this.squad0 = [p.team0[0]!, 'RANDOM'];
    this.squad1 = [p.team1[0]!, 'RANDOM'];
    this.editSide = 0;
    this.editSlot = 0;
    this.editing = false;
    this.selectedPreviewId = null;
    this.synth.play('ui');
    this.render();
  }

  private closeEditor(): void {
    this.editing = false;
    this.synth.play('ui');
    this.render();
  }

  // ————— Render —————

  private render(): void {
    if (this.editing) {
      this.renderEditor();
      return;
    }
    this.sheet.classList.add('is-hidden');
    this.renderChrome();
  }

  private renderChrome(): void {
    clear(this.root);
    const c0 = this.cardsFor(0);
    const c1 = this.cardsFor(1);

    const top = el('div', { className: 'practice-top' });
    const titleRow = el('div', { className: 'title-row' });
    titleRow.append(
      button('←', {
        variant: 'ghost',
        onClick: () => this.emit({ type: 'BACK' }),
      }),
    );
    titleRow.append(el('h1', { text: 'Skirmish' }));
    titleRow.append(
      button('🎲', {
        variant: 'ghost',
        title: 'Reroll everything',
        onClick: () => {
          this.seed = (Math.random() * 0xffffffff) >>> 0;
          this.synth.play('ui');
          this.render();
        },
      }),
    );
    titleRow.append(
      button('Presets', {
        variant: 'quiet',
        title: 'A classic historical pairing',
        onClick: () => this.applyPreset(),
      }),
    );
    top.append(titleRow);
    this.root.append(top);

    const bottom = el('div', { className: 'practice-bottom' });
    const band = el('div', { className: 'practice-band' });

    // Blue squad
    band.append(
      button('Blue', {
        variant: 'quiet',
        extraClass: 'team-cap blue',
        active: this.selectedPreviewId != null && c0.some((_, i) => this.previewIdFor(0, i) === this.selectedPreviewId),
        onClick: () => this.openSide(0, 0),
      }),
    );
    const sidesB = el('div', { className: 'practice-sides' });
    for (let i = 0; i < c0.length; i++) {
      sidesB.append(this.slotChip(0, i, c0[i]!));
    }
    sidesB.append(
      button('+', {
        variant: 'quiet',
        extraClass: 'slot-add',
        title: 'Add a fighter (max ' + MAX_SQUAD + ')',
        disabled: c0.length >= MAX_SQUAD,
        onClick: () => this.addSlot(0),
      }),
    );
    band.append(sidesB);

    const format = el('span', { className: 'format-tag', text: `${c0.length}v${c1.length}` });
    band.append(format);

    // Red squad
    const sidesR = el('div', { className: 'practice-sides red' });
    sidesR.append(
      button('+', {
        variant: 'quiet',
        extraClass: 'slot-add',
        title: 'Add a fighter (max ' + MAX_SQUAD + ')',
        disabled: c1.length >= MAX_SQUAD,
        onClick: () => this.addSlot(1),
      }),
    );
    for (let i = 0; i < c1.length; i++) {
      sidesR.append(this.slotChip(1, i, c1[i]!));
    }
    band.append(sidesR);
    band.append(
      button('Red', {
        variant: 'quiet',
        extraClass: 'team-cap red',
        active: this.selectedPreviewId != null && c1.some((_, i) => this.previewIdFor(1, i) === this.selectedPreviewId),
        onClick: () => this.openSide(1, 0),
      }),
    );
    bottom.append(band);

    const actions = el('div', { className: 'practice-actions' });
    actions.append(
      button('FIGHT', {
        variant: 'cta',
        title: 'Launch the bout',
        onClick: () => this.emit({ type: 'START', config: this.makeConfig() }),
      }),
    );
    bottom.append(actions);
    this.root.append(bottom);
  }

  /** Stable preview id for a squad slot (kept in sync with previewSnapshots). */
  private previewIdFor(side: 0 | 1, slot: number): number {
    return side === 0 ? slot + 1 : this.squad0.length + slot + 1;
  }

  private openSide(side: 0 | 1, slot: number): void {
    this.editSide = side;
    this.editSlot = slot;
    this.editing = true;
    this.synth.play('ui');
    this.render();
  }

  private slotChip(side: 0 | 1, slot: number, card: QuickCard): HTMLButtonElement {
    const id = this.previewIdFor(side, slot);
    const beast = card.beastId ? BEASTS[card.beastId] : null;
    const chip = el('button', {
      className: `focus-chip${side === 1 ? ' is-red' : ' is-blue'}${this.selectedPreviewId === id ? ' is-selected' : ''}`,
      attrs: { title: beast ? `${card.name} (${beast.short})` : card.name },
    });
    chip.append(el('span', { className: 'name', text: card.name.slice(0, 10) }));
    chip.append(
      el('span', {
        className: 'tag',
        text: beast ? beast.short : ARMATURAE[card.armatura].short,
      }),
    );
    chip.addEventListener('click', () => this.openSide(side, slot));
    return chip;
  }

  // ————— The unit chooser —————

  private renderEditor(): void {
    this.sheet.classList.remove('is-hidden');
    clear(this.sheet);
    const picks = this.sidePicks(this.editSide);
    const current = picks[this.editSlot] ?? 'RANDOM';

    const header = el('div', { className: 'sheet-header' });
    header.append(
      button('←', {
        variant: 'ghost',
        onClick: () => this.closeEditor(),
      }),
    );
    header.append(
      el('h1', {
        text: `${this.editSide === 0 ? 'Blue' : 'Red'} · Fighter ${this.editSlot + 1}`,
      }),
    );
    header.append(el('span', { attrs: { style: 'width:3rem' } }));
    this.sheet.append(header);

    const currentLine = el('div', { className: 'editor-current' });
    currentLine.append(
      el('span', { className: 'meta', text: `Now: ${pickTitle(current)}` }),
    );
    currentLine.append(
      button('🎲', {
        variant: 'quiet',
        title: 'Roll a random unit for this slot',
        onClick: () => this.rollSlot(this.editSide, this.editSlot),
      }),
    );
    if (picks.length > 1) {
      currentLine.append(
        button('Remove', {
          variant: 'quiet',
          onClick: () => this.removeSlot(this.editSide, this.editSlot),
        }),
      );
    }
    this.sheet.append(currentLine);

    this.sheet.append(
      el('p', { className: 'section-label', text: 'Kits' }),
    );
    const kitGrid = el('div', { className: 'pick-grid' });
    for (const opt of KIT_PICKS) {
      const b = button(opt === 'RANDOM' ? '?' : pickShort(opt), {
        active: current === opt,
        onClick: () => this.setPick(this.editSide, this.editSlot, opt),
      });
      b.title = pickTitle(opt);
      kitGrid.append(b);
    }
    this.sheet.append(kitGrid);

    this.sheet.append(
      el('p', { className: 'section-label', text: 'Beasts' }),
    );
    const beastGrid = el('div', { className: 'pick-grid beast-picks' });
    for (const opt of BEAST_PICKS) {
      const b = button('', {
        active: current === opt,
        onClick: () => this.setPick(this.editSide, this.editSlot, opt),
      });
      b.title = pickTitle(opt);
      if (opt === 'RANDOM') {
        b.textContent = '?';
      } else {
        const def = BEASTS[opt];
        b.append(el('span', { className: 'pick-short', text: def.short }));
        b.append(el('span', { className: 'pick-name', text: def.name }));
      }
      beastGrid.append(b);
    }
    this.sheet.append(beastGrid);

    const foot = el('div', { className: 'sheet-footer' });
    foot.append(
      button('Done', {
        variant: 'cta',
        onClick: () => this.closeEditor(),
      }),
    );
    this.sheet.append(foot);
  }
}

/** @deprecated alias for App wiring */
export { PracticeView as SandboxScene };
