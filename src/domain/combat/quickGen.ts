import type { ArmaturaId } from '../../content/armatura';
import { BEAST_LIST, BEASTS, type BeastId } from '../../content/beasts';
import type { TemperamentId } from '../../content/rpg';
import type { GladiatorGrade } from '../../content/rpg';
import { spawnSpecFromGladiator } from '../campaign/combatMods';
import { rollFighter } from '../campaign/rollFighter';
import { SeededRNG } from '../rng';
import type { FighterSpawnSpec, MatchKind, TeamSize } from '../combat/types';

export type { MatchKind };

export interface QuickCard {
  name: string;
  armatura: ArmaturaId;
  temperament: TemperamentId;
  grade: GladiatorGrade;
  age: number;
  spec: FighterSpawnSpec;
  beastId?: BeastId;
}

/** Fresh named fighters for Quick Match (no career side effects). */
export function generateQuickTeam(
  seed: number,
  teamSize: TeamSize,
  teamSalt: number,
): QuickCard[] {
  const rng = new SeededRNG((seed ^ (teamSalt * 0x9e37)) >>> 0);
  const cards: QuickCard[] = [];
  for (let i = 0; i < teamSize; i++) {
    const g = rollFighter(rng, {
      policy: 'lab',
      id: 1000 + teamSalt * 10 + i,
    });
    const spec = spawnSpecFromGladiator(g, 'ANGLE');
    cards.push({
      name: g.name,
      armatura: g.armatura,
      temperament: g.temperament,
      grade: g.grade,
      age: g.age,
      spec,
    });
  }
  return cards;
}

/** Humans on Blue, beasts on Red — Instant Match venatio. */
export function generateVenatioTeams(
  seed: number,
  teamSize: TeamSize,
): { team0: QuickCard[]; team1: QuickCard[] } {
  const team0 = generateQuickTeam(seed, teamSize, 1);
  const rng = new SeededRNG((seed ^ 0xbea57) >>> 0);
  const team1: QuickCard[] = [];
  for (let i = 0; i < teamSize; i++) {
    const beast = rng.pick([...BEAST_LIST]) as BeastId;
    const def = BEASTS[beast];
    team1.push({
      name: def.name,
      armatura: 'MURMILLO',
      temperament: 'FEROX',
      grade: 'ORDINARIUS',
      age: 0,
      beastId: beast,
      spec: {
        kind: 'beast',
        beast,
        armatura: 'MURMILLO',
        name: def.name,
        temperament: 'FEROX',
        pursueBiasAdd: 0.1,
      },
    });
  }
  return { team0, team1 };
}
