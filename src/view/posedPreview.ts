import { ARMATURAE } from '../content/armatura';
import { BEASTS } from '../content/beasts';
import { combatTuning } from '../content/combat';
import type { QuickCard } from '../domain/combat/quickGen';
import type { FighterSnapshot, TeamSize } from '../domain/combat/types';

/**
 * Build FighterSnapshots for Instant Match preview.
 * Positions are placeholders — Lab overwrites via `placePreviewInWorld`.
 */
export function posedCardsToSnapshots(
  team0: QuickCard[],
  team1: QuickCard[],
  teamSize: TeamSize,
): FighterSnapshot[] {
  const snaps: FighterSnapshot[] = [];
  let id = 1;
  const pushTeam = (cards: QuickCard[], team: 0 | 1) => {
    for (let i = 0; i < teamSize; i++) {
      const c = cards[i];
      if (!c) continue;
      const beast = c.beastId ? BEASTS[c.beastId] : null;
      const kit = beast ?? ARMATURAE[c.armatura];
      snaps.push({
        id: id++,
        team,
        kind: beast ? 'beast' : 'gladiator',
        armatura: c.armatura,
        beastId: c.beastId ?? null,
        name: c.name,
        x: 0,
        y: 0,
        facing: team === 0 ? 0 : Math.PI,
        hp: kit.maxHealth,
        maxHp: kit.maxHealth,
        stamina: kit.maxStamina,
        maxStamina: kit.maxStamina,
        poise: kit.maxPoise,
        maxPoise: kit.maxPoise,
        action: 'NONE',
        phase: 'IDLE',
        phaseT: 0,
        phaseMax: 0,
        footwork: 'HOLD',
        intention: 'NONE',
        desiredDist: (kit.measureMin + kit.measureMax) * 0.5,
        poiseTier: 'SOLID',
        stunned: false,
        tangled: false,
        poiseBroken: false,
        guarding: false,
        alive: true,
        flash: 0,
        appearanceSeed: c.spec?.appearanceSeed ?? id * 9973,
      });
    }
  };
  pushTeam(team0, 0);
  pushTeam(team1, 1);
  return snaps;
}

/** Spread preview fighters into arena-plane formation. */
export function placePreviewInWorld(
  snaps: FighterSnapshot[],
  teamSize: number,
): FighterSnapshot[] {
  const cx = combatTuning.arenaCX;
  const cy = combatTuning.arenaCY;
  const rx = combatTuning.arenaRX;
  const ry = combatTuning.arenaRY;
  const spread = teamSize >= 3 ? Math.min(52, ry * 0.22) : Math.min(44, ry * 0.2);
  const out: FighterSnapshot[] = [];
  let i0 = 0;
  let i1 = 0;
  for (const f of snaps) {
    const i = f.team === 0 ? i0++ : i1++;
    const baseX = cx + (f.team === 0 ? -rx * 0.38 : rx * 0.38);
    const y = cy + (i - (teamSize - 1) / 2) * spread;
    out.push({
      ...f,
      x: baseX,
      y,
      facing: f.team === 0 ? 0 : Math.PI,
    });
  }
  return out;
}
