import { ARMATURAE } from '../content/armatura';
import { BEASTS } from '../content/beasts';
import type { QuickCard } from '../domain/combat/quickGen';
import type { FighterSnapshot, TeamSize } from '../domain/combat/types';

/**
 * Build FighterSnapshots for Instant Match preview.
 * Positions are placeholders — Lab overwrites via `placeLabFighters`.
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
      });
    }
  };
  pushTeam(team0, 0);
  pushTeam(team1, 1);
  return snaps;
}
