import type { ArmaturaId } from '../../content/armatura';
import type { MuneraSlotReq, MuneraTemplate } from '../../content/munera';
import { fightableRoster } from './season';
import type { Gladiator, SeasonState } from './types';

/** True if roster can fill every slot with distinct fightable gladiators. */
export function canFieldTemplate(state: SeasonState, t: MuneraTemplate): boolean {
  return assignSlots(fightableRoster(state), t.playerSlots) !== null;
}

/**
 * Greedy assignment: for each slot, pick an unused fighter matching anyOf.
 * Returns gladiator ids in slot order, or null if impossible.
 */
export function assignSlots(
  pool: Gladiator[],
  slots: MuneraSlotReq[],
): number[] | null {
  const used = new Set<number>();
  const out: number[] = [];
  for (const slot of slots) {
    const pick = pool.find((g) => !used.has(g.id) && slot.anyOf.includes(g.armatura));
    if (!pick) return null;
    used.add(pick.id);
    out.push(pick.id);
  }
  return out;
}

export function fightersForSlot(
  pool: Gladiator[],
  slot: MuneraSlotReq,
  alreadyPicked: number[],
): Gladiator[] {
  const used = new Set(alreadyPicked);
  return pool.filter((g) => !used.has(g.id) && slot.anyOf.includes(g.armatura));
}

export function slotLabel(slot: MuneraSlotReq): string {
  if (slot.label) return slot.label;
  if (slot.anyOf.length >= 8) return 'Any';
  return slot.anyOf.join('/');
}

export function shortSlotReq(slot: MuneraSlotReq): string {
  return slotLabel(slot);
}

/** Human-readable gate for offer cards. */
export function formatSlotGates(slots: MuneraSlotReq[]): string {
  return slots.map((s, i) => `F${i + 1}:${shortSlotReq(s)}`).join(' · ');
}

export function kitAllowed(armatura: ArmaturaId, slot: MuneraSlotReq): boolean {
  return slot.anyOf.includes(armatura);
}
