import { TEMPERAMENT_LIST, type DayAssignment, type GearGrade, type GladiatorGrade } from '../content/rpg';
import { emptyLegacy } from '../domain/campaign/legacy';
import { applyOfflineIdle } from '../domain/campaign/idle';
import type { Gladiator, LegacyState, SeasonState } from '../domain/campaign/types';

const SAVE_KEY = 'lanista.season.v2';
const LEGACY_KEY = 'lanista.legacy.v1';
const SAVE_KEY_V1 = 'lanista.season.v1';

function migrateGladiator(raw: Partial<Gladiator> & { id: number; name: string; armatura: Gladiator['armatura'] }): Gladiator {
  return {
    id: raw.id,
    name: raw.name,
    armatura: raw.armatura,
    hpRatio: raw.hpRatio ?? 1,
    injury: raw.injury ?? 'NONE',
    fatigue: raw.fatigue ?? 0,
    wins: raw.wins ?? 0,
    losses: raw.losses ?? 0,
    xp: raw.xp ?? 0,
    grade: (raw.grade as GladiatorGrade) ?? 'TIRO',
    temperament: raw.temperament ?? TEMPERAMENT_LIST[raw.id % TEMPERAMENT_LIST.length]!,
    fame: raw.fame ?? 0,
    mastery: raw.mastery ?? 0,
    gearGrade: (raw.gearGrade as GearGrade) ?? 0,
    assignment: (raw.assignment as DayAssignment) ?? 'NONE',
    retired: raw.retired,
  };
}

function migrateSeason(data: Record<string, unknown>): SeasonState | null {
  if (typeof data.day !== 'number' || !Array.isArray(data.roster)) return null;
  const roster = (data.roster as Partial<Gladiator>[]).map((g, i) =>
    migrateGladiator({
      id: typeof g.id === 'number' ? g.id : i + 1,
      name: typeof g.name === 'string' ? g.name : 'Unknown',
      armatura: (g.armatura ?? 'MURMILLO') as Gladiator['armatura'],
      ...g,
    }),
  );
  return {
    seed: typeof data.seed === 'number' ? data.seed : 1,
    day: data.day,
    denarii: typeof data.denarii === 'number' ? data.denarii : 0,
    virtus: typeof data.virtus === 'number' ? data.virtus : 0,
    restDaysLeft: typeof data.restDaysLeft === 'number' ? data.restDaysLeft : 0,
    nextGladiatorId: typeof data.nextGladiatorId === 'number' ? data.nextGladiatorId : roster.length + 1,
    roster,
    offers: Array.isArray(data.offers) ? (data.offers as SeasonState['offers']) : [],
    dayResolved: Boolean(data.dayResolved),
    record: (data.record as SeasonState['record']) ?? {
      wins: 0,
      losses: 0,
      draws: 0,
      forfeits: 0,
    },
    status: (data.status as SeasonState['status']) ?? 'ACTIVE',
    lastAftermath: (data.lastAftermath as SeasonState['lastAftermath']) ?? null,
    facilities: Array.isArray(data.facilities) ? (data.facilities as SeasonState['facilities']) : [],
    market: Array.isArray(data.market) ? (data.market as SeasonState['market']) : [],
    contracts: Array.isArray(data.contracts) ? (data.contracts as SeasonState['contracts']) : [],
    doctrina: (data.doctrina as SeasonState['doctrina']) ?? 'ANGLE',
    rivalsBeaten: Array.isArray(data.rivalsBeaten) ? (data.rivalsBeaten as string[]) : [],
    retiredNames: Array.isArray(data.retiredNames) ? (data.retiredNames as string[]) : [],
    lastSeenAt: typeof data.lastSeenAt === 'number' ? data.lastSeenAt : Date.now(),
    seasonIndex: typeof data.seasonIndex === 'number' ? data.seasonIndex : 1,
  };
}

export function hasSeasonSave(): boolean {
  try {
    return localStorage.getItem(SAVE_KEY) !== null || localStorage.getItem(SAVE_KEY_V1) !== null;
  } catch {
    return false;
  }
}

export function loadSeason(): SeasonState | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY) ?? localStorage.getItem(SAVE_KEY_V1);
    if (!raw) return null;
    const data = JSON.parse(raw) as Record<string, unknown>;
    const state = migrateSeason(data);
    if (!state) return null;
    applyOfflineIdle(state);
    return state;
  } catch {
    return null;
  }
}

export function saveSeason(state: SeasonState): void {
  try {
    state.lastSeenAt = Date.now();
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
    localStorage.removeItem(SAVE_KEY_V1);
  } catch {
    /* ignore quota / private mode */
  }
}

export function clearSeasonSave(): void {
  try {
    localStorage.removeItem(SAVE_KEY);
    localStorage.removeItem(SAVE_KEY_V1);
  } catch {
    /* ignore */
  }
}

export function loadLegacy(): LegacyState {
  try {
    const raw = localStorage.getItem(LEGACY_KEY);
    if (!raw) return emptyLegacy();
    const data = JSON.parse(raw) as LegacyState;
    if (!data || typeof data.patronage !== 'number') return emptyLegacy();
    return {
      patronage: data.patronage ?? 0,
      seasonsCompleted: data.seasonsCompleted ?? 0,
      unlockedFacilities: data.unlockedFacilities ?? [],
      alumni: data.alumni ?? [],
      starterGradeBump: Boolean(data.starterGradeBump),
    };
  } catch {
    return emptyLegacy();
  }
}

export function saveLegacy(legacy: LegacyState): void {
  try {
    localStorage.setItem(LEGACY_KEY, JSON.stringify(legacy));
  } catch {
    /* ignore */
  }
}
