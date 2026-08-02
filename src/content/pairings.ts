import { ARMATURAE, type ArmaturaId } from './armatura';

export interface PairingPreset {
  id: string;
  label: string;
  blurb: string;
  team0: ArmaturaId[];
  team1: ArmaturaId[];
}

function vsLabel(a: ArmaturaId, b: ArmaturaId): string {
  return `${ARMATURAE[a].name} vs ${ARMATURAE[b].name}`;
}

/** Historical / editorial matchups for the sandbox. */
export const PAIRING_PRESETS: PairingPreset[] = [
  {
    id: 'mur_thr',
    label: vsLabel('MURMILLO', 'THRAEX'),
    blurb: 'Classic heavy vs sica',
    team0: ['MURMILLO'],
    team1: ['THRAEX'],
  },
  {
    id: 'ret_sec',
    label: vsLabel('RETIARIUS', 'SECUTOR'),
    blurb: 'Net-man vs pursuer',
    team0: ['RETIARIUS'],
    team1: ['SECUTOR'],
  },
  {
    id: 'mur_hop',
    label: vsLabel('MURMILLO', 'HOPLOMACHUS'),
    blurb: 'Scutum vs spear',
    team0: ['MURMILLO'],
    team1: ['HOPLOMACHUS'],
  },
  {
    id: 'pro_pro',
    label: vsLabel('PROVOCATOR', 'PROVOCATOR'),
    blurb: 'Armored duel',
    team0: ['PROVOCATOR'],
    team1: ['PROVOCATOR'],
  },
  {
    id: 'ret_sci',
    label: vsLabel('RETIARIUS', 'SCISSOR'),
    blurb: 'Net vs scissor-arm',
    team0: ['RETIARIUS'],
    team1: ['SCISSOR'],
  },
  {
    id: 'dim_thr',
    label: vsLabel('DIMACHAERUS', 'THRAEX'),
    blurb: 'Twin blades vs sica',
    team0: ['DIMACHAERUS'],
    team1: ['THRAEX'],
  },
];
