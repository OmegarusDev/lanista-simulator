import type { SeasonState } from '../domain/campaign/types';

const SAVE_KEY = 'lanista.season.v1';

export function hasSeasonSave(): boolean {
  try {
    return localStorage.getItem(SAVE_KEY) !== null;
  } catch {
    return false;
  }
}

export function loadSeason(): SeasonState | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as SeasonState;
    if (!data || typeof data.day !== 'number' || !Array.isArray(data.roster)) return null;
    return data;
  } catch {
    return null;
  }
}

export function saveSeason(state: SeasonState): void {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
  } catch {
    /* ignore quota / private mode */
  }
}

export function clearSeasonSave(): void {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    /* ignore */
  }
}
