import { ARMATURA_LIST, type ArmaturaId } from '../../content/armatura';
import { TEMPERAMENT_LIST, type GladiatorGrade } from '../../content/rpg';
import { createGladiator } from '../campaign/gladiator';
import { spawnSpecFromGladiator } from '../campaign/combatMods';
import { SeededRNG } from '../rng';
import type { FighterSpawnSpec, TeamSize } from '../combat/types';

export interface QuickCard {
  name: string;
  armatura: ArmaturaId;
  temperament: import('../../content/rpg').TemperamentId;
  grade: GladiatorGrade;
  spec: FighterSpawnSpec;
}

function rollGrade(rng: SeededRNG): GladiatorGrade {
  const r = rng.next();
  if (r > 0.88) return 'PRIMUS';
  if (r > 0.45) return 'ORDINARIUS';
  return 'TIRO';
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
    const armatura = rng.pick([...ARMATURA_LIST]) as ArmaturaId;
    const grade = rollGrade(rng);
    const g = createGladiator(1000 + teamSalt * 10 + i, {
      armatura,
      grade,
      xp: grade === 'PRIMUS' ? 100 : grade === 'ORDINARIUS' ? 40 : 0,
      temperament: rng.pick([...TEMPERAMENT_LIST]),
      rng,
    });
    const spec = spawnSpecFromGladiator(g, 'ANGLE');
    cards.push({
      name: g.name,
      armatura: g.armatura,
      temperament: g.temperament,
      grade: g.grade,
      spec,
    });
  }
  return cards;
}
