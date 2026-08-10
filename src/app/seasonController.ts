import { applyCareerFight, type CareerFightInput } from '../domain/campaign/aftermath';
import { findSlateBout, slateToOffer } from '../domain/campaign/calendar';
import { spawnSpecFromGladiator, spawnSpecsFromLineup } from '../domain/campaign/combatMods';
import { settleSeasonLegacy } from '../domain/campaign/legacy';
import { rollFighter } from '../domain/campaign/rollFighter';
import { createSeason, endDay } from '../domain/campaign/season';
import {
  DEFAULT_FIGHT_ORDERS,
  type AftermathSummary,
  type FightOrders,
  type MuneraOffer,
  type SeasonState,
} from '../domain/campaign/types';
import { SeededRNG } from '../domain/rng';
import {
  clearSeasonSave,
  loadLegacy,
  loadSeason,
  saveLegacy,
  saveSeason,
} from '../shell/save';
import type { SandboxConfig } from '../ui/practiceView';

/** Career season mutations + persistence — keeps App thin. */
export class SeasonController {
  season: SeasonState | null = null;
  pendingOffer: MuneraOffer | null = null;
  pendingLineup: number[] = [];
  pendingAftermath: AftermathSummary | null = null;

  get orders(): FightOrders {
    return this.season?.pendingOrders ?? { ...DEFAULT_FIGHT_ORDERS };
  }

  setOrders(partial: Partial<FightOrders>): void {
    if (!this.season) return;
    this.season.pendingOrders = { ...this.season.pendingOrders, ...partial };
  }

  newSeason(seed?: number): SeasonState {
    const s = (seed ?? (Math.random() * 0xffffffff) >>> 0) >>> 0;
    this.season = createSeason(s, loadLegacy());
    clearSeasonSave();
    saveSeason(this.season);
    this.clearPending();
    return this.season;
  }

  continueSeason(): SeasonState | null {
    const loaded = loadSeason();
    if (!loaded) return null;
    this.season = loaded;
    this.clearPending();
    return loaded;
  }

  persist(): void {
    if (this.season && this.season.status === 'ACTIVE') saveSeason(this.season);
  }

  isTerminal(state = this.season): boolean {
    return !!state && (state.status === 'BROKE' || state.status === 'SEASON_END');
  }

  endDay(): void {
    if (!this.season) return;
    endDay(this.season);
    this.persist();
  }

  pickOffer(offer: MuneraOffer): void {
    this.pendingOffer = offer;
  }

  setLineup(ids: number[]): void {
    this.pendingLineup = [...ids];
  }

  buildCareerConfig(lineupIds: number[], offer: MuneraOffer): SandboxConfig {
    const season = this.season!;
    const team0 = lineupIds.map((id) => {
      const g = season.roster.find((x) => x.id === id)!;
      return g.armatura;
    });
    const team0Specs = spawnSpecsFromLineup(
      season.roster,
      lineupIds,
      season.doctrina,
      season.pendingOrders,
    );
    const boutSeed = (season.seed + season.day * 1009 + offer.templateId.length) >>> 0;
    const rivalRng = new SeededRNG(boutSeed ^ 0x51a7);
    const tierMul = 1 + (offer.tier - 1) * 0.04;
    const team1Specs = offer.opponents.map((armatura, i) => {
      const rival = rollFighter(rivalRng, {
        policy: 'rival',
        id: 9000 + i,
        armatura,
        name: offer.rivalName && i === 0 ? offer.rivalName : undefined,
      });
      const base = spawnSpecFromGladiator(rival, 'PRESS');
      return {
        ...base,
        hpMul: (base.hpMul ?? 1) * tierMul,
        staminaMul: (base.staminaMul ?? 1) * tierMul,
        poiseMul: (base.poiseMul ?? 1) * tierMul,
        damageMul: (base.damageMul ?? 1) * tierMul,
        pursueBiasAdd: (base.pursueBiasAdd ?? 0) + (offer.rivalName ? 0.06 : 0),
      };
    });
    return {
      teamSize: offer.teamSize,
      seed: boutSeed,
      team0,
      team1: [...offer.opponents],
      team0Specs,
      team1Specs,
      lockedMatchup: true,
    };
  }

  buildSlateConfig(boutId: string): SandboxConfig | null {
    if (!this.season) return null;
    const bout = findSlateBout(this.season, boutId);
    if (!bout || bout.status !== 'pending') return null;
    const offer = slateToOffer(this.season, bout);
    this.pendingOffer = offer;
    this.pendingLineup = [...bout.schoolIds];
    const team0 = bout.schoolIds.map((id) => {
      const g = this.season!.roster.find((x) => x.id === id)!;
      return g.armatura;
    });
    const team0Specs = spawnSpecsFromLineup(
      this.season.roster,
      bout.schoolIds,
      this.season.doctrina,
      this.season.pendingOrders,
    );
    const boutSeed = (this.season.seed + this.season.day * 1009 + bout.id.length) >>> 0;
    let team1Specs;
    if (bout.kind === 'venatio' && bout.beastOpponents) {
      team1Specs = bout.beastOpponents.map((beast) => ({
        kind: 'beast' as const,
        beast,
        armatura: 'MURMILLO' as const,
      }));
    } else {
      const rivalRng = new SeededRNG(boutSeed ^ 0x51a7);
      team1Specs = bout.opponentArmaturae.map((armatura, i) => {
        const rival = rollFighter(rivalRng, {
          policy: 'rival',
          id: 9000 + i,
          armatura,
        });
        return spawnSpecFromGladiator(rival, 'PRESS');
      });
    }
    return {
      teamSize: bout.teamSize,
      seed: boutSeed,
      team0,
      team1: [...bout.opponentArmaturae],
      team0Specs,
      team1Specs,
      lockedMatchup: true,
      matchKind: bout.kind === 'venatio' ? 'venatio' : 'matchup',
    };
  }

  applyFight(input: Omit<CareerFightInput, 'offer' | 'lineupIds'> & { offer?: MuneraOffer; lineupIds?: number[] }): AftermathSummary | null {
    if (!this.season || !this.pendingOffer) return null;
    const summary = applyCareerFight(this.season, {
      offer: input.offer ?? this.pendingOffer,
      lineupIds: input.lineupIds ?? this.pendingLineup,
      result: input.result,
      forfeited: input.forfeited,
      boutStats: input.boutStats,
    });
    this.pendingAftermath = summary;
    this.persist();
    return summary;
  }

  settleAndClear(): void {
    if (!this.season) return;
    const legacy = settleSeasonLegacy(this.season, loadLegacy());
    saveLegacy(legacy);
    clearSeasonSave();
    this.season = null;
    this.clearPending();
  }

  clearPending(): void {
    this.pendingOffer = null;
    this.pendingLineup = [];
    this.pendingAftermath = null;
  }
}
