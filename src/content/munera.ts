import type { ArmaturaId } from './armatura';

export type MuneraTier = 1 | 2 | 3;
export type TeamSize = 1 | 2 | 3;
export type MuneraKind = 'classic' | 'spectacle' | 'melee' | 'trial' | 'pair';

/** One lineup slot — fighter armatura must be in `anyOf`. */
export interface MuneraSlotReq {
  anyOf: ArmaturaId[];
  label?: string;
}

export interface MuneraTemplate {
  id: string;
  name: string;
  blurb: string;
  kind: MuneraKind;
  tier: MuneraTier;
  teamSize: TeamSize;
  purse: number;
  entryFee: number;
  virtusWin: number;
  virtusLose: number;
  /** Player slots (length === teamSize), class-gated. */
  playerSlots: MuneraSlotReq[];
  /** Opponent kits (length === teamSize). */
  opponents: ArmaturaId[];
}

const mur = ['MURMILLO'] as ArmaturaId[];
const thr = ['THRAEX'] as ArmaturaId[];
const ret = ['RETIARIUS'] as ArmaturaId[];
const sec = ['SECUTOR'] as ArmaturaId[];
const hop = ['HOPLOMACHUS'] as ArmaturaId[];
const pro = ['PROVOCATOR'] as ArmaturaId[];
const dim = ['DIMACHAERUS'] as ArmaturaId[];
const sci = ['SCISSOR'] as ArmaturaId[];
const heavy = ['MURMILLO', 'SECUTOR', 'PROVOCATOR'] as ArmaturaId[];
const light = ['THRAEX', 'RETIARIUS', 'DIMACHAERUS'] as ArmaturaId[];
const any = [
  'MURMILLO',
  'THRAEX',
  'RETIARIUS',
  'SECUTOR',
  'HOPLOMACHUS',
  'PROVOCATOR',
  'DIMACHAERUS',
  'SCISSOR',
] as ArmaturaId[];

/**
 * Campaign event catalog — classics are class-gated; spectacles/melees widen the board.
 * Instant Match sandbox stays open (any kits); career enforces slots.
 */
export const MUNERA_TEMPLATES: MuneraTemplate[] = [
  // —— Tier 1 classics & openers ——
  {
    id: 'classic_mur_thr',
    name: 'Scutum & Sica',
    blurb: 'Murmillo vs Thraex — the crowd’s favourite quarrel.',
    kind: 'classic',
    tier: 1,
    teamSize: 1,
    purse: 55,
    entryFee: 6,
    virtusWin: 3,
    virtusLose: 0,
    playerSlots: [{ anyOf: mur, label: 'Murmillo' }],
    opponents: ['THRAEX'],
  },
  {
    id: 'classic_thr_mur',
    name: 'Sica Answers',
    blurb: 'Thraex steps in against the fish-crest.',
    kind: 'classic',
    tier: 1,
    teamSize: 1,
    purse: 55,
    entryFee: 6,
    virtusWin: 3,
    virtusLose: 0,
    playerSlots: [{ anyOf: thr, label: 'Thraex' }],
    opponents: ['MURMILLO'],
  },
  {
    id: 'classic_ret_sec',
    name: 'Net & Helm',
    blurb: 'Retiarius vs Secutor — tip-catch against the smooth bowl.',
    kind: 'classic',
    tier: 1,
    teamSize: 1,
    purse: 60,
    entryFee: 8,
    virtusWin: 3,
    virtusLose: 0,
    playerSlots: [{ anyOf: ret, label: 'Retiarius' }],
    opponents: ['SECUTOR'],
  },
  {
    id: 'classic_sec_ret',
    name: 'The Pursuit',
    blurb: 'Secutor presses the net-man.',
    kind: 'classic',
    tier: 1,
    teamSize: 1,
    purse: 60,
    entryFee: 8,
    virtusWin: 3,
    virtusLose: 0,
    playerSlots: [{ anyOf: sec, label: 'Secutor' }],
    opponents: ['RETIARIUS'],
  },
  {
    id: 'trial_open_1',
    name: 'Ludus Trial',
    blurb: 'Any single fighter against a random gate opponent.',
    kind: 'trial',
    tier: 1,
    teamSize: 1,
    purse: 40,
    entryFee: 4,
    virtusWin: 2,
    virtusLose: 0,
    playerSlots: [{ anyOf: any, label: 'Any' }],
    opponents: ['THRAEX'],
  },
  {
    id: 'spectacle_hop_mur',
    name: 'Spear at the Gate',
    blurb: 'Hoplomachus tests a murmillo’s scutum.',
    kind: 'spectacle',
    tier: 1,
    teamSize: 1,
    purse: 50,
    entryFee: 7,
    virtusWin: 2,
    virtusLose: 0,
    playerSlots: [{ anyOf: hop, label: 'Hoplomachus' }],
    opponents: ['MURMILLO'],
  },
  {
    id: 'classic_mur_hop',
    name: 'Against the Point',
    blurb: 'Murmillo vs Hoplomachus.',
    kind: 'classic',
    tier: 1,
    teamSize: 1,
    purse: 52,
    entryFee: 7,
    virtusWin: 2,
    virtusLose: 0,
    playerSlots: [{ anyOf: mur, label: 'Murmillo' }],
    opponents: ['HOPLOMACHUS'],
  },

  // —— Tier 2 ——
  {
    id: 'classic_pro_pro',
    name: 'Breastplate Duel',
    blurb: 'Provocator vs Provocator — armored equals.',
    kind: 'classic',
    tier: 2,
    teamSize: 1,
    purse: 95,
    entryFee: 14,
    virtusWin: 4,
    virtusLose: -1,
    playerSlots: [{ anyOf: pro, label: 'Provocator' }],
    opponents: ['PROVOCATOR'],
  },
  {
    id: 'classic_ret_sci',
    name: 'Net vs Tube',
    blurb: 'Retiarius against the scissor-arm.',
    kind: 'classic',
    tier: 2,
    teamSize: 1,
    purse: 90,
    entryFee: 12,
    virtusWin: 4,
    virtusLose: -1,
    playerSlots: [{ anyOf: ret, label: 'Retiarius' }],
    opponents: ['SCISSOR'],
  },
  {
    id: 'classic_sci_ret',
    name: 'Shear the Mesh',
    blurb: 'Scissor hunts the retiarius.',
    kind: 'classic',
    tier: 2,
    teamSize: 1,
    purse: 90,
    entryFee: 12,
    virtusWin: 4,
    virtusLose: -1,
    playerSlots: [{ anyOf: sci, label: 'Scissor' }],
    opponents: ['RETIARIUS'],
  },
  {
    id: 'classic_dim_thr',
    name: 'Twin Edges',
    blurb: 'Dimachaerus vs Thraex.',
    kind: 'classic',
    tier: 2,
    teamSize: 1,
    purse: 88,
    entryFee: 12,
    virtusWin: 4,
    virtusLose: -1,
    playerSlots: [{ anyOf: dim, label: 'Dimachaerus' }],
    opponents: ['THRAEX'],
  },
  {
    id: 'pair_mur_thr_duo',
    name: 'Paired Classics',
    blurb: 'Field Mur + Thr against their historical mirrors.',
    kind: 'pair',
    tier: 2,
    teamSize: 2,
    purse: 130,
    entryFee: 22,
    virtusWin: 5,
    virtusLose: -1,
    playerSlots: [
      { anyOf: mur, label: 'Murmillo' },
      { anyOf: thr, label: 'Thraex' },
    ],
    opponents: ['MURMILLO', 'THRAEX'],
  },
  {
    id: 'pair_ret_sec_duo',
    name: 'Net Pair',
    blurb: 'Retiarius and a heavy escort vs Secutor pair.',
    kind: 'pair',
    tier: 2,
    teamSize: 2,
    purse: 135,
    entryFee: 24,
    virtusWin: 5,
    virtusLose: -1,
    playerSlots: [
      { anyOf: ret, label: 'Retiarius' },
      { anyOf: heavy, label: 'Heavy' },
    ],
    opponents: ['SECUTOR', 'MURMILLO'],
  },
  {
    id: 'spectacle_light_duel',
    name: 'Swift Blades',
    blurb: 'Light kit vs light kit.',
    kind: 'spectacle',
    tier: 2,
    teamSize: 1,
    purse: 75,
    entryFee: 10,
    virtusWin: 3,
    virtusLose: -1,
    playerSlots: [{ anyOf: light, label: 'Light' }],
    opponents: ['DIMACHAERUS'],
  },
  {
    id: 'melee_heavies',
    name: 'Shield Wall',
    blurb: 'Two heavies crash the sand.',
    kind: 'melee',
    tier: 2,
    teamSize: 2,
    purse: 140,
    entryFee: 26,
    virtusWin: 5,
    virtusLose: -1,
    playerSlots: [
      { anyOf: heavy, label: 'Heavy' },
      { anyOf: heavy, label: 'Heavy' },
    ],
    opponents: ['SECUTOR', 'PROVOCATOR'],
  },

  // —— Tier 3 ——
  {
    id: 'melee_triad',
    name: 'Triad Munera',
    blurb: 'Three a side — chaos with measure still mattering.',
    kind: 'melee',
    tier: 3,
    teamSize: 3,
    purse: 220,
    entryFee: 36,
    virtusWin: 8,
    virtusLose: -2,
    playerSlots: [
      { anyOf: any, label: 'Any' },
      { anyOf: any, label: 'Any' },
      { anyOf: any, label: 'Any' },
    ],
    opponents: ['MURMILLO', 'THRAEX', 'RETIARIUS'],
  },
  {
    id: 'pair_classic_mirror',
    name: 'Mirrored Schools',
    blurb: 'Mur+Thr vs Mur+Thr — style against style.',
    kind: 'pair',
    tier: 3,
    teamSize: 2,
    purse: 170,
    entryFee: 28,
    virtusWin: 6,
    virtusLose: -2,
    playerSlots: [
      { anyOf: mur, label: 'Murmillo' },
      { anyOf: thr, label: 'Thraex' },
    ],
    opponents: ['MURMILLO', 'THRAEX'],
  },
  {
    id: 'spectacle_hop_line',
    name: 'Points of the Line',
    blurb: 'Hoplomachus line vs mixed shields.',
    kind: 'spectacle',
    tier: 3,
    teamSize: 2,
    purse: 160,
    entryFee: 26,
    virtusWin: 6,
    virtusLose: -2,
    playerSlots: [
      { anyOf: hop, label: 'Hoplomachus' },
      { anyOf: ['MURMILLO', 'PROVOCATOR', 'SECUTOR'], label: 'Shield' },
    ],
    opponents: ['HOPLOMACHUS', 'MURMILLO'],
  },
  {
    id: 'classic_sci_sec',
    name: 'Closed Helm Trial',
    blurb: 'Scissor vs Secutor — tip-resist meets tube-blade.',
    kind: 'classic',
    tier: 3,
    teamSize: 1,
    purse: 150,
    entryFee: 20,
    virtusWin: 6,
    virtusLose: -2,
    playerSlots: [{ anyOf: sci, label: 'Scissor' }],
    opponents: ['SECUTOR'],
  },
  {
    id: 'melee_mixed_three',
    name: 'Crowd Favourite',
    blurb: 'Required: a net-man, a heavy, and a blade.',
    kind: 'melee',
    tier: 3,
    teamSize: 3,
    purse: 240,
    entryFee: 40,
    virtusWin: 9,
    virtusLose: -2,
    playerSlots: [
      { anyOf: ret, label: 'Retiarius' },
      { anyOf: heavy, label: 'Heavy' },
      { anyOf: ['THRAEX', 'DIMACHAERUS', 'SCISSOR'], label: 'Blade' },
    ],
    opponents: ['SECUTOR', 'PROVOCATOR', 'THRAEX'],
  },
  {
    id: 'trial_champion',
    name: 'Champion’s Challenge',
    blurb: 'Your best any kit vs an elite provocator.',
    kind: 'trial',
    tier: 3,
    teamSize: 1,
    purse: 160,
    entryFee: 24,
    virtusWin: 7,
    virtusLose: -2,
    playerSlots: [{ anyOf: any, label: 'Champion' }],
    opponents: ['PROVOCATOR'],
  },
];

export function templateById(id: string): MuneraTemplate | undefined {
  return MUNERA_TEMPLATES.find((t) => t.id === id);
}
