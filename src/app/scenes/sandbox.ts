import { ARMATURA_LIST, ARMATURAE, type ArmaturaId } from '../../content/armatura';
import { PAIRING_PRESETS } from '../../content/pairings';
import { colors } from '../../content/palette';
import {
  generateQuickTeam,
  generateVenatioTeams,
  type MatchKind,
  type QuickCard,
} from '../../domain/combat/quickGen';
import type { FighterSnapshot, FighterSpawnSpec, TeamSize } from '../../domain/combat/types';
import type { Input } from '../../shell/input';
import { getDesign } from '../../shell/canvas';
import { drawArena } from '../../view/arena';
import { ArenaCamera } from '../../view/arenaCamera';
import type { Synth } from '../../view/audio';
import { drawGladiator } from '../../view/gladiatorDraw';
import { designToWorld, buttonRow, isPortrait, shellPad } from '../../view/layout';
import { posedCardsToSnapshots } from '../../view/posedPreview';
import { space, touchTarget, typeScale } from '../../view/theme';
import { button, buttonChrome, label, labelFitted, panel, shellAtmosphere, type Rect } from '../../view/ui';

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
 * Instant Match — mobile-first Quick Match (matchup / venatio) + Custom sheet.
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
  private readonly cam = new ArenaCamera();
  private selectedPreviewId: number | null = null;
  private ptrWasDown = false;
  private arenaView: Rect = { x: 0, y: 0, w: 1, h: 1 };

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
    this.cam.reset(isPortrait() ? 1.18 : 1.1);
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

  /** Called when fight UI asks to reroll a lab bout. */
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
    if (input.wasKeyPressed('ArrowLeft')) {
      const snaps = posedCardsToSnapshots(this.cards0, this.cards1, this.teamSize);
      this.cam.focusTeamGroup(0, snaps);
    }
    if (input.wasKeyPressed('ArrowRight')) {
      const snaps = posedCardsToSnapshots(this.cards0, this.cards1, this.teamSize);
      this.cam.focusTeamGroup(1, snaps);
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
    const portrait = isPortrait(w, h);
    let action: SandboxAction = { type: 'NONE' };

    shellAtmosphere(ctx, w, h);

    // Compact chrome
    if (button(ctx, { x: pad, y: pad, w: touchTarget, h: touchTarget }, '←', input.pointer)) {
      this.synth.play('ui');
      return { type: 'BACK' };
    }
    label(ctx, 'Instant Match', pad + touchTarget + 8, pad + 28, {
      size: typeScale.title,
      color: colors.parchment,
    });

    const stripY = pad + touchTarget + 6;
    const strip = buttonRow(pad, stripY, w - pad * 2, 34, 5, 4);
    const stripLabs = ['Match', 'Venatio', '1v1', '2v2', '3v3'] as const;
    stripLabs.forEach((lab, i) => {
      let active = false;
      if (i === 0) active = this.matchKind === 'matchup';
      else if (i === 1) active = this.matchKind === 'venatio';
      else active = this.teamSize === ((i - 1) as TeamSize);
      if (button(ctx, strip[i]!, lab, input.pointer, { active, size: typeScale.eyebrow })) {
        if (i === 0) {
          this.matchKind = 'matchup';
          this.rerollQuick();
        } else if (i === 1) {
          this.matchKind = 'venatio';
          this.rerollQuick();
        } else {
          this.setTeamSize((i - 1) as TeamSize);
        }
        this.synth.play('ui');
      }
    });

    const footerH = portrait ? 118 : 108;
    const chipH = 40;
    const arenaTop = stripY + 42;
    const arenaH = Math.max(200, h - arenaTop - footerH - chipH - 8);
    this.arenaView = { x: 0, y: arenaTop, w, h: arenaH };

    const snaps = posedCardsToSnapshots(this.cards0, this.cards1, this.teamSize);
    this.handleArenaCamera(input, snaps);
    this.cam.updateAutocam(snaps, { selectedId: this.selectedPreviewId });
    this.cam.tickSmooth();
    const worldT = this.cam.toTransform(this.arenaView);

    // Clip arena band — fill matches shell so edges never hard-cut
    ctx.save();
    ctx.beginPath();
    ctx.rect(this.arenaView.x, this.arenaView.y, this.arenaView.w, this.arenaView.h);
    ctx.clip();
    ctx.fillStyle = colors.bg;
    ctx.fillRect(this.arenaView.x, this.arenaView.y, this.arenaView.w, this.arenaView.h);
    ctx.save();
    ctx.translate(worldT.ox, worldT.oy);
    ctx.scale(worldT.scale, worldT.scale);
    drawArena(ctx, 0, { seed: this.seed });
    for (const f of snaps.slice().sort((a, b) => a.y - b.y)) {
      drawGladiator(ctx, f, {
        selected: f.id === this.selectedPreviewId,
        showSelectedName: f.id === this.selectedPreviewId,
      });
    }
    ctx.restore();
    // Soft edge falloff — eased stops + top/bottom washes into shell
    const av = this.arenaView;
    const bandVig = ctx.createRadialGradient(
      av.x + av.w / 2,
      av.y + av.h * 0.45,
      Math.min(av.w, av.h) * 0.24,
      av.x + av.w / 2,
      av.y + av.h / 2,
      Math.max(av.w, av.h) * 0.7,
    );
    bandVig.addColorStop(0, 'rgba(0,0,0,0)');
    bandVig.addColorStop(0.72, 'rgba(8,5,3,0.1)');
    bandVig.addColorStop(0.9, 'rgba(8,5,3,0.26)');
    bandVig.addColorStop(1, 'rgba(8,5,3,0.36)');
    ctx.fillStyle = bandVig;
    ctx.fillRect(av.x, av.y, av.w, av.h);
    const edge = 28;
    const topFade = ctx.createLinearGradient(0, av.y, 0, av.y + edge);
    topFade.addColorStop(0, colors.bg);
    topFade.addColorStop(0.45, 'rgba(26,20,16,0.55)');
    topFade.addColorStop(1, 'rgba(26,20,16,0)');
    ctx.fillStyle = topFade;
    ctx.fillRect(av.x, av.y, av.w, edge);
    const botFade = ctx.createLinearGradient(0, av.y + av.h - edge, 0, av.y + av.h);
    botFade.addColorStop(0, 'rgba(26,20,16,0)');
    botFade.addColorStop(0.55, 'rgba(26,20,16,0.55)');
    botFade.addColorStop(1, colors.bg);
    ctx.fillStyle = botFade;
    ctx.fillRect(av.x, av.y + av.h - edge, av.w, edge);
    ctx.restore();

    // Team cam chips + fighter focus strip
    const chipY = arenaTop + arenaH + 4;
    const teamLabs = buttonRow(pad, chipY, Math.min(200, w * 0.42), chipH - 4, 2, 4);
    if (button(ctx, teamLabs[0]!, 'Blue', input.pointer, { size: typeScale.meta })) {
      this.cam.focusTeamGroup(0, snaps);
      this.selectedPreviewId = null;
      this.synth.play('ui');
    }
    if (
      button(ctx, teamLabs[1]!, this.matchKind === 'venatio' ? 'Beasts' : 'Red', input.pointer, {
        size: typeScale.meta,
      })
    ) {
      this.cam.focusTeamGroup(1, snaps);
      this.selectedPreviewId = null;
      this.synth.play('ui');
    }

    const nameStart = pad + Math.min(208, w * 0.42) + 8;
    const nameBudget = w - pad - nameStart;
    const n = snaps.length;
    const nameW = Math.min(88, (nameBudget - 4 * Math.max(0, n - 1)) / Math.max(1, n));
    snaps.forEach((f, i) => {
      const r = {
        x: nameStart + i * (nameW + 4),
        y: chipY,
        w: nameW,
        h: chipH - 4,
      };
      if (
        button(ctx, r, f.name.slice(0, 8), input.pointer, {
          active: this.selectedPreviewId === f.id,
          size: typeScale.eyebrow,
        })
      ) {
        this.selectedPreviewId = f.id;
        this.cam.focusFighter(f);
        this.synth.play('ui');
      }
    });

    const by = h - footerH + 6;
    const row = buttonRow(pad, by, w - pad * 2, touchTarget - 2, 2, space.sm);
    if (button(ctx, row[0]!, 'Reroll', input.pointer)) {
      this.seed = (Math.random() * 0xffffffff) >>> 0;
      this.rerollQuick();
      this.synth.play('ui');
    }
    if (button(ctx, row[1]!, 'Custom', input.pointer)) {
      this.mode = 'custom';
      this.synth.play('ui');
    }
    if (
      button(
        ctx,
        { x: pad, y: by + touchTarget + 2, w: w - pad * 2, h: 48 },
        'Fight',
        input.pointer,
        { size: typeScale.title },
      )
    ) {
      this.synth.play('ui');
      action = { type: 'START', config: this.makeQuickConfig() };
    }

    const key = this.update(input);
    if (key.type === 'START') return key;
    return action;
  }

  private handleArenaCamera(input: Input, snaps: FighterSnapshot[]): void {
    const p = input.pointer;
    const v = this.arenaView;
    const inArena = p.x >= v.x && p.x <= v.x + v.w && p.y >= v.y && p.y <= v.y + v.h;
    const worldT = this.cam.toTransform(v);

    if (p.down && !this.ptrWasDown && inArena) {
      this.cam.beginDrag(p.x, p.y, worldT.scale);
    }
    if (p.down && this.cam.isDragging()) {
      this.cam.dragTo(p.x, p.y);
    }
    if (!p.down && this.ptrWasDown) {
      const dragged = this.cam.endDrag();
      if (!dragged && inArena) {
        const world = designToWorld(p.x, p.y, worldT);
        const hitR = 28 / Math.max(0.001, worldT.scale);
        let best: FighterSnapshot | null = null;
        let bestD = hitR * hitR;
        for (const f of snaps) {
          const d = (f.x - world.x) ** 2 + (f.y - world.y) ** 2;
          if (d <= bestD) {
            bestD = d;
            best = f;
          }
        }
        if (best) {
          this.selectedPreviewId = best.id;
          this.cam.focusFighter(best);
          this.synth.play('ui');
        } else {
          this.selectedPreviewId = null;
          this.cam.clearFocus();
        }
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

    if (button(ctx, { x: pad, y: pad, w: touchTarget, h: touchTarget }, '←', input.pointer)) {
      this.mode = 'quick';
      this.rerollQuick();
      this.synth.play('ui');
      return { type: 'NONE' };
    }

    label(ctx, 'Custom Team', w / 2, portrait ? 36 : 40, {
      size: typeScale.display,
      align: 'center',
      color: colors.parchment,
    });
    label(ctx, 'Pick kits · historical matchups', w / 2, portrait ? 56 : 62, {
      size: typeScale.meta,
      align: 'center',
      color: colors.muted,
    });

    const sizeY = portrait ? 74 : 84;
    const sizes = buttonRow(pad, sizeY, w - pad * 2, 36, 3, space.sm);
    (['1v1', '2v2', '3v3'] as const).forEach((lab, i) => {
      const n = (i + 1) as TeamSize;
      if (button(ctx, sizes[i]!, lab, input.pointer, { active: this.teamSize === n })) {
        this.setTeamSize(n);
        this.synth.play('ui');
      }
    });

    const presetY = sizeY + 48;
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

    if (
      button(ctx, { x: pad, y: h - 56, w: w - pad * 2, h: 48 }, 'Fight', input.pointer, {
        size: typeScale.label,
      })
    ) {
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
    panel(ctx, { x, y, w, h: panelH }, team === 0 ? 'Blue' : 'Red');

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
