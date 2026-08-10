import { economy } from '../../content/economy';
import {
  FACILITIES,
  GEAR_UPGRADE_COST,
  MEDICUS,
  type FacilityId,
  type GearGrade,
  type MedicusTier,
} from '../../content/rpg';
import { syncInjuryTier } from './injury';
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
  if (g.injury === 'NONE' && (g.vitality ?? g.hpRatio) >= 0.99 && g.fatigue <= 0) return false;
  const cost = medicusCost(state, tier);
  if (state.denarii < cost) return false;
  const care = MEDICUS[tier];
  state.denarii -= cost;
  g.vitality = Math.min(1, (g.vitality ?? g.hpRatio) + care.hp);
  g.hpRatio = g.vitality;
  g.fatigue = Math.max(0, g.fatigue - care.fatigue);
  const steps = care.injurySteps + (hasFacility(state, 'INFIRMARY') && tier === 'PHYSICIAN' ? 1 : 0);
  for (let s = 0; s < steps; s++) {
    // Heal worst non-permanent injury first
    const sorted = [...g.injuries]
      .filter((i) => !i.permanent)
      .sort((a, b) => {
        const rank = (x: typeof a) => (x.severity === 'critical' ? 3 : x.severity === 'serious' ? 2 : 1);
        return rank(b) - rank(a);
      });
    const inj = sorted[0];
    if (!inj) break;
    if (inj.severity === 'critical') {
      inj.severity = 'serious';
      inj.daysLeft = Math.max(2, inj.daysLeft - 2);
    } else if (inj.severity === 'serious') {
      inj.severity = 'minor';
      inj.daysLeft = Math.max(1, inj.daysLeft - 1);
    } else {
      const idx = g.injuries.indexOf(inj);
      if (idx >= 0) g.injuries.splice(idx, 1);
    }
  }
  syncInjuryTier(g);
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
