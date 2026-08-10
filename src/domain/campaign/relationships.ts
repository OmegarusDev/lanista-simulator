import type { RelationKind } from '../../content/identity';
import type { Gladiator, RelationshipEdge, SeasonState } from './types';
import { clampMorale } from './morale';

function edgeKey(a: number, b: number): string {
  return a < b ? `${a}:${b}` : `${b}:${a}`;
}

export function getEdge(state: SeasonState, a: number, b: number): RelationshipEdge | undefined {
  const key = edgeKey(a, b);
  return state.relationships.find((e) => edgeKey(e.a, e.b) === key);
}

export function upsertEdge(
  state: SeasonState,
  a: number,
  b: number,
  kind: RelationKind,
  delta: number,
): void {
  if (a === b) return;
  let edge = getEdge(state, a, b);
  if (!edge) {
    edge = { a, b, kind, intensity: Math.max(-1, Math.min(1, delta)) };
    state.relationships.push(edge);
    return;
  }
  if (edge.kind === kind) {
    edge.intensity = Math.max(-1, Math.min(1, edge.intensity + delta));
  } else if (Math.abs(delta) >= 0.25) {
    edge.kind = kind;
    edge.intensity = Math.max(-1, Math.min(1, delta));
  } else {
    edge.intensity = Math.max(-1, Math.min(1, edge.intensity + delta * 0.5));
  }
}

/** After shared lineup — friendship or friction. */
export function onSharedLineup(
  state: SeasonState,
  ids: number[],
  won: boolean,
): void {
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      upsertEdge(state, ids[i]!, ids[j]!, won ? 'friend' : 'resent', won ? 0.12 : -0.08);
    }
  }
}

export function onSparPair(state: SeasonState, a: number, b: number, aWon: boolean): void {
  upsertEdge(state, a, b, 'rival', 0.1);
  if (aWon) upsertEdge(state, b, a, 'respect', 0.06);
}

export function onMentorOpportunity(state: SeasonState, roster: Gladiator[]): void {
  const active = roster.filter((g) => !g.retired);
  for (const senior of active) {
    if (senior.grade === 'TIRO') continue;
    for (const junior of active) {
      if (junior.id === senior.id || junior.grade !== 'TIRO') continue;
      if (senior.armatura === junior.armatura) {
        upsertEdge(state, senior.id, junior.id, 'mentor', 0.08);
      }
    }
  }
}

export function lineupFriction(state: SeasonState, ids: number[]): string[] {
  const notes: string[] = [];
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const e = getEdge(state, ids[i]!, ids[j]!);
      if (!e) continue;
      if ((e.kind === 'rival' || e.kind === 'resent' || e.kind === 'fear') && e.intensity > 0.35) {
        const ga = state.roster.find((g) => g.id === ids[i]!);
        const gb = state.roster.find((g) => g.id === ids[j]!);
        if (ga && gb) notes.push(`${ga.name} & ${gb.name}: ${e.kind} (tense).`);
      }
    }
  }
  return notes;
}

/** Apply morale bleed from relationships after a day. */
export function tickRelationshipMorale(state: SeasonState): void {
  for (const e of state.relationships) {
    const ga = state.roster.find((g) => g.id === e.a && !g.retired);
    const gb = state.roster.find((g) => g.id === e.b && !g.retired);
    if (!ga || !gb) continue;
    if (e.kind === 'friend' && e.intensity > 0.3) {
      ga.morale = clampMorale(ga.morale + 1);
      gb.morale = clampMorale(gb.morale + 1);
    }
    if (e.kind === 'resent' && e.intensity > 0.4) {
      ga.morale = clampMorale(ga.morale - 1);
      gb.morale = clampMorale(gb.morale - 1);
    }
  }
}

/** Combat pursue bias when facing a feared/rival foe by name match — used in fight orders path. */
export function relationVsFoe(
  state: SeasonState,
  selfId: number,
  foeGladiatorId: number | null,
): { pursueBiasAdd: number; clinchPanicAdd: number } {
  if (foeGladiatorId == null) return { pursueBiasAdd: 0, clinchPanicAdd: 0 };
  const e = getEdge(state, selfId, foeGladiatorId);
  if (!e) return { pursueBiasAdd: 0, clinchPanicAdd: 0 };
  if (e.kind === 'rival') return { pursueBiasAdd: 0.1 * e.intensity, clinchPanicAdd: -0.06 * e.intensity };
  if (e.kind === 'fear') return { pursueBiasAdd: -0.12 * e.intensity, clinchPanicAdd: 0.14 * e.intensity };
  if (e.kind === 'respect') return { pursueBiasAdd: 0.02, clinchPanicAdd: 0.04 };
  return { pursueBiasAdd: 0, clinchPanicAdd: 0 };
}
