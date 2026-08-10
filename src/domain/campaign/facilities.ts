import { economy } from '../../content/economy';
import {
  FACILITIES,
  GEAR_UPGRADE_COST,
  MEDICUS,
  type FacilityId,
  type GearGrade,
  type MedicusTier,
} from '../../content/rpg';
import type { SeasonState } from './types';

export function hasFacility(state: SeasonState, id: FacilityId): boolean {
  return state.facilities.includes(id);
}

export function buyFacility(state: SeasonState, id: FacilityId): boolean {
  if (state.status !== 'ACTIVE') return false;
  if (hasFacility(state, id)) return false;
  const def = FACILITIES[id];
  if (state.virtus < def.virtusReq) return false;
  if (state.denarii < def.cost) return false;
  state.denarii -= def.cost;
  state.facilities.push(id);
  return true;
}

export function medicusCost(state: SeasonState, tier: MedicusTier): number {
  const base = MEDICUS[tier].cost;
  return hasFacility(state, 'INFIRMARY')
    ? Math.max(6, Math.round(base * economy.infirmaryCostMul))
    : base;
}

export function applyMedicus(state: SeasonState, gladiatorId: number, tier: MedicusTier): boolean {
  if (state.status !== 'ACTIVE') return false;
  const g = state.roster.find((x) => x.id === gladiatorId && !x.retired);
  if (!g) return false;
  if (g.injury === 'NONE' && g.hpRatio >= 0.99 && g.fatigue <= 0) return false;
  const cost = medicusCost(state, tier);
  if (state.denarii < cost) return false;
  const care = MEDICUS[tier];
  state.denarii -= cost;
  g.hpRatio = Math.min(1, g.hpRatio + care.hp);
  g.fatigue = Math.max(0, g.fatigue - care.fatigue);
  for (let i = 0; i < care.injurySteps; i++) {
    if (g.injury === 'SEVERE') g.injury = 'LIGHT';
    else if (g.injury === 'LIGHT') g.injury = 'NONE';
  }
  if (hasFacility(state, 'INFIRMARY') && tier === 'PHYSICIAN' && g.injury === 'LIGHT') {
    // Extra chance to clear lingering hurt
    g.injury = 'NONE';
  }
  return true;
}

export function upgradeGear(state: SeasonState, gladiatorId: number): boolean {
  if (state.status !== 'ACTIVE') return false;
  if (!hasFacility(state, 'ARMAMENTARIUM')) return false;
  const g = state.roster.find((x) => x.id === gladiatorId && !x.retired);
  if (!g) return false;
  if (g.gearGrade >= 2) return false;
  const next = (g.gearGrade + 1) as 1 | 2;
  const cost = GEAR_UPGRADE_COST[next];
  if (state.denarii < cost) return false;
  state.denarii -= cost;
  g.gearGrade = next as GearGrade;
  return true;
}
