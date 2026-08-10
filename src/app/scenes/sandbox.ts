import { ARMATURA_LIST, ARMATURAE, type ArmaturaId } from '../../content/armatura';
import { PAIRING_PRESETS } from '../../content/pairings';
import { colors } from '../../content/palette';
import {
  generateQuickTeam,
  generateVenatioTeams,
  type MatchKind,
  type QuickCard,
} from '../../domain/combat/quickGen';
import type { FighterSpawnSpec, TeamSize } from '../../domain/combat/types';
import type { Input } from '../../shell/input';
import { getDesign } from '../../shell/canvas';
import type { Synth } from '../../view/audio';
import {
  drawLabAmphitheatre,
  drawLabFighters,
  labChromeRects,
  labStageGeom,
  placeLabFighters,
  pickLabFighter,
} from '../../view/labStage';
import { buttonRow, isPortrait, shellPad } from '../../view/layout';
import { posedCardsToSnapshots } from '../../view/posedPreview';
import { space, touchTarget, typeScale } from '../../view/theme';
import {
  button,
  buttonChrome,
  cta,
  label,
  labelFitted,
  plaque,
  segmentedControl,
  shellAtmosphere,
  type Rect,
} from '../../view/ui';

export interface SandboxConfig {
  teamSize: TeamSize;
  seed: number;
  team0: ArmaturaId[];
  team1: ArmaturaId[];
  lockedMatchup: boolean;
  team0Specs?: FighterSpawnSpec[];
  team1Specs?: FighterSpawnSpec[];
  matchKind?: MatchKind;
}

export type SandboxAction =
  | { type: 'START'; config: SandboxConfig }
  | { type: 'BACK' }
  | { type: 'NONE' };

type SlotPick = ArmaturaId | 'RANDOM';
type Mode = 'quick' | 'custom';

const PICK_OPTS: SlotPick[] = ['RANDOM', ...ARMATURA_LIST];

function resolvePick(pick: SlotPick, salt: number): ArmaturaId {
  if (pick !== 'RANDOM') return pick;
  return ARMATURA_LIST[salt % ARMATURA_LIST.length]!;
}

/**
 * Instant Match — rebuilt: one amphitheatre composition in design space.
 * No world camera, no inset viewport, no picture-in-window.
 */
export class SandboxScene {
  mode: Mode = 'quick';
  matchKind: MatchKind = 'matchup';
  teamSize: TeamSize = 1;
  seed = (Math.random() * 0xffffffff) >>> 0;
  slots0: SlotPick[] = ['RANDOM', 'RANDOM', 'RANDOM'];
  slots1: SlotPick[] = ['RANDOM', 'RANDOM', 'RANDOM'];
  editSlot0 = 0;
  editSlot1 = 0;
  private cards0: QuickCard[] = [];
  private cards1: QuickCard[] = [];
  private selectedPreviewId: number | null = null;
  private ptrWasDown = false;

  constructor(private readonly synth: Synth) {
    this.rerollQuick();
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
      lockedMatchup: true,
      matchKind: this.matchKind,
    };
  }

  makeCustomConfig(): SandboxConfig {
    const n = this.teamSize;
    const team0 = this.slots0.slice(0, n).map((p, i) => resolvePick(p, this.seed + i * 3));
    const team1 = this.slots1.slice(0, n).map((p, i) => resolvePick(p, this.seed + 7 + i * 5));
    const locked =
      this.slots0.slice(0, n).every((p) => p !== 'RANDOM') &&
      this.slots1.slice(0, n).every((p) => p !== 'RANDOM');
    return {
      teamSize: n,
      seed: this.seed,
      team0,
      team1,
      lockedMatchup: locked,
      matchKind: 'matchup',
    };
  }

  makeConfig(): SandboxConfig {
    return this.mode === 'quick' ? this.makeQuickConfig() : this.makeCustomConfig();
  }

  rerollLab(): SandboxConfig {
    this.seed = (Math.random() * 0xffffffff) >>> 0;
    if (this.mode === 'quick') this.rerollQuick();
    return this.makeConfig();
  }

  private setTeamSize(n: TeamSize): void {
    this.teamSize = n;
    while (this.slots0.length < 3) this.slots0.push('RANDOM');
    while (this.slots1.length < 3) this.slots1.push('RANDOM');
    this.editSlot0 = Math.min(this.editSlot0, n - 1);
    this.editSlot1 = Math.min(this.editSlot1, n - 1);
    if (this.mode === 'quick') this.rerollQuick();
  }

  update(input: Input): SandboxAction {
    if (input.wasKeyPressed('Space') || input.wasKeyPressed('Enter')) {
      return { type: 'START', config: this.makeConfig() };
    }
    if (input.wasKeyPressed('KeyR')) {
      this.seed = (this.seed * 1103515245 + 12345) >>> 0;
      if (this.mode === 'quick') this.rerollQuick();
      this.synth.play('ui');
    }
    return { type: 'NONE' };
  }

  draw(ctx: CanvasRenderingContext2D, input: Input): SandboxAction {
    if (this.mode === 'custom') return this.drawCustom(ctx, input);
    return this.drawQuick(ctx, input);
  }

  private drawQuick(ctx: CanvasRenderingContext2D, input: Input): SandboxAction {
    const { w, h } = getDesign();
    const pad = shellPad(w);
    let action: SandboxAction = { type: 'NONE' };

    const geom = labStageGeom(w, h, this.teamSize);
    const chrome = labChromeRects(w, h, pad);
    const raw = posedCardsToSnapshots(this.cards0, this.cards1, this.teamSize);
    const snaps = placeLabFighters(raw, geom);

    // One composition — amphitheatre owns every pixel
    drawLabAmphitheatre(ctx, geom, this.seed);
    drawLabFighters(ctx, snaps, this.selectedPreviewId);

    // Tap sand (outside chrome shelves) to focus a fighter
    this.handleLabPick(input, snaps, chrome.beam, chrome.shelf);

    // —— Controls live IN the carved beam / shelf (already painted into the plate) ——
    const backBtn: Rect = { x: pad, y: 10, w: touchTarget, h: touchTarget };
    if (button(ctx, backBtn, '←', input.pointer)) {
      this.synth.play('ui');
      return { type: 'BACK' };
    }
    label(ctx, 'Instant Match', pad + touchTarget + 10, 38, {
      size: typeScale.title,
      color: colors.parchment,
    });

    const stripY = Math.max(52, chrome.beam.h - 42);
    const strip: Rect = { x: pad, y: stripY, w: w - pad * 2, h: 34 };
    const halfW = (strip.w - 6) / 2;
    const kindIdx = this.matchKind === 'matchup' ? 0 : 1;
    const sizeIdx = this.teamSize - 1;
    const kindSeg = segmentedControl(
      ctx,
      { x: strip.x, y: strip.y, w: halfW, h: strip.h },
      ['Match', 'Venatio'],
      kindIdx,
      input.pointer,
    );
    if (kindSeg != null) {
      this.matchKind = kindSeg === 0 ? 'matchup' : 'venatio';
      this.rerollQuick();
      this.synth.play('ui');
    }
    const sizeSeg = segmentedControl(
      ctx,
      { x: strip.x + halfW + 6, y: strip.y, w: halfW, h: strip.h },
      ['1v1', '2v2', '3v3'],
      sizeIdx,
      input.pointer,
    );
    if (sizeSeg != null) {
      this.setTeamSize((sizeSeg + 1) as TeamSize);
      this.synth.play('ui');
    }

    // Shelf controls
    const shelfPad = pad;
    const focusY = chrome.shelf.y + 18;
    const focusH = touchTarget - 4;
    const teamLabs = buttonRow(shelfPad, focusY, Math.min(200, w * 0.4), focusH, 2, 4);
    if (button(ctx, teamLabs[0]!, 'Blue', input.pointer, { size: typeScale.meta })) {
      const blue = snaps.find((f) => f.team === 0);
      this.selectedPreviewId = blue?.id ?? null;
      this.synth.play('ui');
    }
    if (
      button(ctx, teamLabs[1]!, this.matchKind === 'venatio' ? 'Beasts' : 'Red', input.pointer, {
        size: typeScale.meta,
      })
    ) {
      const red = snaps.find((f) => f.team === 1);
      this.selectedPreviewId = red?.id ?? null;
      this.synth.play('ui');
    }
    const nameStart = shelfPad + Math.min(208, w * 0.4) + 8;
    const nameBudget = w - shelfPad - nameStart;
    const n = snaps.length;
    const nameW = Math.min(88, (nameBudget - 4 * Math.max(0, n - 1)) / Math.max(1, n));
    snaps.forEach((f, i) => {
      const r = {
        x: nameStart + i * (nameW + 4),
        y: focusY,
        w: nameW,
        h: focusH,
      };
      if (
        button(ctx, r, f.name.slice(0, 8), input.pointer, {
          active: this.selectedPreviewId === f.id,
          size: typeScale.eyebrow,
        })
      ) {
        this.selectedPreviewId = f.id;
        this.synth.play('ui');
      }
    });

    const btnH = isPortrait(w, h) ? 48 : 44;
    const secondaryH = touchTarget - 2;
    const fightY = h - shelfPad - btnH;
    const secondaryY = fightY - secondaryH - 8;
    const half = (w - shelfPad * 2 - space.sm) / 2;
    if (
      button(ctx, { x: shelfPad, y: secondaryY, w: half, h: secondaryH }, 'Reroll', input.pointer)
    ) {
      this.seed = (Math.random() * 0xffffffff) >>> 0;
      this.rerollQuick();
      this.synth.play('ui');
    }
    if (
      button(
        ctx,
        { x: shelfPad + half + space.sm, y: secondaryY, w: half, h: secondaryH },
        'Custom',
        input.pointer,
      )
    ) {
      this.mode = 'custom';
      this.synth.play('ui');
    }
    if (
      cta(ctx, { x: shelfPad, y: fightY, w: w - shelfPad * 2, h: btnH }, 'Fight', input.pointer)
    ) {
      this.synth.play('ui');
      action = { type: 'START', config: this.makeQuickConfig() };
    }

    const key = this.update(input);
    if (key.type === 'START') return key;
    return action;
  }

  private handleLabPick(
    input: Input,
    snaps: ReturnType<typeof placeLabFighters>,
    beam: Rect,
    shelf: Rect,
  ): void {
    const p = input.pointer;
    const onChrome =
      (p.y >= beam.y && p.y <= beam.y + beam.h) || (p.y >= shelf.y && p.y <= shelf.y + shelf.h);
    if (p.down && !this.ptrWasDown && !onChrome) {
      const hit = pickLabFighter(snaps, p.x, p.y, 40);
      if (hit) {
        this.selectedPreviewId = hit.id;
        this.synth.play('ui');
      } else {
        this.selectedPreviewId = null;
      }
      input.pointer.clicked = false;
    }
    this.ptrWasDown = p.down;
  }

  private drawCustom(ctx: CanvasRenderingContext2D, input: Input): SandboxAction {
    const { w, h } = getDesign();
    const pad = shellPad(w);
    const portrait = isPortrait(w, h);
    let action: SandboxAction = { type: 'NONE' };

    shellAtmosphere(ctx, w, h);
    plaque(ctx, { x: pad * 0.5, y: pad * 0.5, w: w - pad, h: h - pad });

    if (button(ctx, { x: pad, y: pad, w: touchTarget, h: touchTarget }, '←', input.pointer)) {
      this.mode = 'quick';
      this.rerollQuick();
      this.synth.play('ui');
      return { type: 'NONE' };
    }

    label(ctx, 'Custom Team', w / 2, portrait ? 40 : 44, {
      size: typeScale.display,
      align: 'center',
      color: colors.parchment,
    });
    label(ctx, 'Pick kits · historical matchups', w / 2, portrait ? 60 : 66, {
      size: typeScale.meta,
      align: 'center',
      color: colors.muted,
    });

    const sizeY = portrait ? 78 : 88;
    const sizeSeg = segmentedControl(
      ctx,
      { x: pad, y: sizeY, w: w - pad * 2, h: 36 },
      ['1v1', '2v2', '3v3'],
      this.teamSize - 1,
      input.pointer,
    );
    if (sizeSeg != null) {
      this.setTeamSize((sizeSeg + 1) as TeamSize);
      this.synth.play('ui');
    }

    const presetY = sizeY + 52;
    label(ctx, 'Historical', pad, presetY, { size: typeScale.meta, color: colors.muted });
    const presetH = 40;
    const cols = portrait ? 2 : 3;
    const gap = 6;
    const cellW = (w - pad * 2 - gap * (cols - 1)) / cols;
    PAIRING_PRESETS.forEach((p, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const r: Rect = {
        x: pad + col * (cellW + gap),
        y: presetY + 12 + row * (presetH + gap),
        w: cellW,
        h: presetH,
      };
      if (
        button(ctx, r, '', input.pointer, { size: typeScale.eyebrow }) &&
        action.type === 'NONE'
      ) {
        this.teamSize = 1;
        this.slots0 = [p.team0[0]!, 'RANDOM', 'RANDOM'];
        this.slots1 = [p.team1[0]!, 'RANDOM', 'RANDOM'];
        this.synth.play('ui');
        action = {
          type: 'START',
          config: {
            teamSize: 1,
            seed: this.seed,
            team0: [p.team0[0]!],
            team1: [p.team1[0]!],
            lockedMatchup: true,
            matchKind: 'matchup',
          },
        };
      }
      const parts = p.label.split(' vs ');
      labelFitted(ctx, [parts[0] ?? p.label, parts[1] ? `vs ${parts[1]}` : ''], r, {
        color: colors.buttonText,
        min: 10,
        max: 13,
      });
    });

    const presetRows = Math.ceil(PAIRING_PRESETS.length / cols);
    const editorTop = presetY + 12 + presetRows * (presetH + gap) + 12;
    const editorH = Math.max(140, h - editorTop - 70);
    const half = portrait ? editorH / 2 - 4 : editorH;
    const colW = portrait ? w - pad * 2 : (w - pad * 2 - 12) / 2;
    this.drawCustomSide(ctx, input, 0, pad, editorTop, colW, half);
    if (portrait) {
      this.drawCustomSide(ctx, input, 1, pad, editorTop + half + 8, colW, half);
    } else {
      this.drawCustomSide(ctx, input, 1, pad + colW + 12, editorTop, colW, half);
    }

    if (cta(ctx, { x: pad, y: h - 56, w: w - pad * 2, h: 48 }, 'Fight', input.pointer)) {
      this.synth.play('ui');
      action = { type: 'START', config: this.makeCustomConfig() };
    }

    const key = this.update(input);
    if (key.type === 'START') return key;
    return action;
  }

  private drawCustomSide(
    ctx: CanvasRenderingContext2D,
    input: Input,
    team: 0 | 1,
    x: number,
    y: number,
    w: number,
    panelH: number,
  ): void {
    const slots = team === 0 ? this.slots0 : this.slots1;
    let edit = team === 0 ? this.editSlot0 : this.editSlot1;
    const accent = team === 0 ? colors.ally : colors.foe;
    plaque(ctx, { x, y, w, h: panelH }, team === 0 ? 'Blue' : 'Red');

    const n = this.teamSize;
    const slotY = y + 36;
    const gap = 4;
    const slotW = Math.min(110, (w - 24 - gap * Math.max(0, n - 1)) / n);
    for (let s = 0; s < n; s++) {
      const r: Rect = { x: x + 12 + s * (slotW + gap), y: slotY, w: slotW, h: 44 };
      const pick = slots[s]!;
      const { clicked } = buttonChrome(ctx, r, input.pointer, {
        active: edit === s,
        accent,
      });
      label(ctx, pick === 'RANDOM' ? 'Rnd' : ARMATURAE[pick].short, r.x + r.w / 2, r.y + 26, {
        size: typeScale.meta,
        align: 'center',
        color: colors.buttonText,
      });
      if (clicked) {
        if (team === 0) this.editSlot0 = s;
        else this.editSlot1 = s;
        this.synth.play('ui');
        edit = s;
      }
    }

    const current = slots[edit]!;
    const gridY = slotY + 52;
    const cols = w < 280 ? 3 : 4;
    const cellGap = 4;
    const cellW = (w - 24 - cellGap * (cols - 1)) / cols;
    const cellH = 32;
    PICK_OPTS.forEach((opt, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const r: Rect = {
        x: x + 12 + col * (cellW + cellGap),
        y: gridY + row * (cellH + cellGap),
        w: cellW,
        h: cellH,
      };
      if (r.y + r.h > y + panelH - 6) return;
      const lab = opt === 'RANDOM' ? '?' : ARMATURAE[opt].short;
      if (
        button(ctx, r, lab, input.pointer, {
          active: current === opt,
          size: typeScale.eyebrow,
        })
      ) {
        slots[edit] = opt;
        this.synth.play('ui');
      }
    });
  }
}
