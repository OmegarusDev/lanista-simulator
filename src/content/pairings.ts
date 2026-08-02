import type { ArmaturaId } from './armatura';

export interface PairingPreset {
  id: string;
  label: string;
  blurb: string;
  team0: ArmaturaId[];
  team1: ArmaturaId[];
}

/** Historical / editorial matchups for the sandbox. */
export const PAIRING_PRESETS: PairingPreset[] = [
  {
    id: 'mur_thr',
    label: 'Mur vs Thr',
    blurb: 'Classic heavy vs sica',
    team0: ['MURMILLO'],
    team1: ['THRAEX'],
  },
  {
    id: 'ret_sec',
    label: 'Ret vs Sec',
    blurb: 'Net-man vs pursuer',
    team0: ['RETIARIUS'],
    team1: ['SECUTOR'],
  },
  {
    id: 'mur_hop',
    label: 'Mur vs Hop',
    blurb: 'Scutum vs spear',
    team0: ['MURMILLO'],
    team1: ['HOPLOMACHUS'],
  },
  {
    id: 'pro_pro',
    label: 'Pro vs Pro',
    blurb: 'Armored duel',
    team0: ['PROVOCATOR'],
    team1: ['PROVOCATOR'],
  },
  {
    id: 'ret_sci',
    label: 'Ret vs Sci',
    blurb: 'Net vs scissor-arm',
    team0: ['RETIARIUS'],
    team1: ['SCISSOR'],
  },
  {
    id: 'dim_thr',
    label: 'Dim vs Thr',
    blurb: 'Twin blades vs sica',
    team0: ['DIMACHAERUS'],
    team1: ['THRAEX'],
  },
];
