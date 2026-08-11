import { applyCareerFight, type CareerFightInput } from '../domain/campaign/aftermath';
import { findSlateBout, slateToOffer } from '../domain/campaign/calendar';
import { spawnSpecFromGladiator, spawnSpecsFromLineup } from '../domain/campaign/combatMods';
import {
  applyMedicus,
  buyFacility,
  medicusCost,
  upgradeGear,
} from '../domain/campaign/facilities';
import { injuryLabel } from '../domain/campaign/injury';
import { settleSeasonLegacy } from '../domain/campaign/legacy';
import { setGladiatorAssignment } from '../domain/campaign/ludusDay';
import { buyRecruit, releaseGladiator } from '../domain/campaign/market';
import { rollFighter } from '../domain/campaign/rollFighter';
import {
  createSeason,
  currentRosterCap,
  endDay,
  fightableRoster,
  setDoctrina,
  takeRestDay,
  upkeepCost,
} from '../domain/campaign/season';
import {
  DEFAULT_FIGHT_ORDERS,
  type AftermathSummary,
  type BodyInjury,
  type FightOrders,
  type MuneraOffer,
  type SeasonState,
} from '../domain/campaign/types';
import type { ArmaturaId } from '../content/armatura';
import type { DayAssignment, DoctrinaId, FacilityId, MedicusTier } from '../content/rpg';
import { SeededRNG } from '../domain/rng';
import {
  clearSeasonSave,
  loadLegacy,
  loadSeason,
  saveLegacy,
  saveSeason,
} from '../shell/save';
import type { FighterSpawnSpec, SandboxConfig } from '../domain/combat/types';

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

  /** Rest day — returns true if the day was consumed. */
  restDay(): boolean {
    if (!this.season) return false;
    const ok = takeRestDay(this.season);
    if (ok) this.persist();
    return ok;
  }

  setAssignment(id: number, assignment: DayAssignment): boolean {
    if (!this.season) return false;
    const ok = setGladiatorAssignment(this.season, id, assignment);
    if (ok) this.persist();
    return ok;
  }

  applyMedicus(id: number, tier: MedicusTier): boolean {
    if (!this.season) return false;
    const ok = applyMedicus(this.season, id, tier);
    if (ok) this.persist();
    return ok;
  }

  release(id: number): boolean {
    if (!this.season) return false;
    const ok = releaseGladiator(this.season, id);
    if (ok) this.persist();
    return ok;
  }

  buyRecruit(offerId: string): boolean {
    if (!this.season) return false;
    const ok = buyRecruit(this.season, offerId);
    if (ok) this.persist();
    return ok;
  }

  setDoctrina(doctrina: DoctrinaId): void {
    if (!this.season) return;
    setDoctrina(this.season, doctrina);
    this.persist();
  }

  buyFacility(kind: FacilityId): boolean {
    if (!this.season) return false;
    const ok = buyFacility(this.season, kind);
    if (ok) this.persist();
    return ok;
  }

  upgradeGear(id: number): boolean {
    if (!this.season) return false;
    const ok = upgradeGear(this.season, id);
    if (ok) this.persist();
    return ok;
  }

  upkeepCost(): number {
    return this.season ? upkeepCost(this.season) : 0;
  }

  fightableCount(): number {
    return this.season ? fightableRoster(this.season).length : 0;
  }

  rosterCap(): number {
    return this.season ? currentRosterCap(this.season) : 0;
  }

  medicusCost(tier: MedicusTier): number {
    return this.season ? medicusCost(this.season, tier) : 0;
  }

  injuryLabel(inj: BodyInjury): string {
    return injuryLabel(inj);
  }

  pickOffer(offer: MuneraOffer): void {
    this.pendingOffer = offer;
  }

  setLineup(ids: number[]): void {
    this.pendingLineup = [...ids];
  }

  /** Shared rival spawn for career munera + slate bouts (seeded, PRESS stance). */
  private spawnRivalSpecs(
    opponents: ArmaturaId[],
    boutSeed: number,
    opts?: { tier?: number; rivalName?: string },
  ): FighterSpawnSpec[] {
    const rivalRng = new SeededRNG(boutSeed ^ 0x51a7);
    const tier = opts?.tier ?? 1;
    const tierMul = 1 + (tier - 1) * 0.04;
    return opponents.map((armatura, i) => {
      const rival = rollFighter(rivalRng, {
        policy: 'rival',
        id: 9000 + i,
        armatura,
        name: opts?.rivalName && i === 0 ? opts.rivalName : undefined,
      });
      const base = spawnSpecFromGladiator(rival, 'PRESS');
      if (tier === 1 && !opts?.rivalName) return base;
      return {
        ...base,
        hpMul: (base.hpMul ?? 1) * tierMul,
        staminaMul: (base.staminaMul ?? 1) * tierMul,
        poiseMul: (base.poiseMul ?? 1) * tierMul,
        damageMul: (base.damageMul ?? 1) * tierMul,
        pursueBiasAdd: (base.pursueBiasAdd ?? 0) + (opts?.rivalName ? 0.06 : 0),
      };
    });
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
    const team1Specs = this.spawnRivalSpecs(offer.opponents, boutSeed, {
      tier: offer.tier,
      rivalName: offer.rivalName ?? undefined,
    });
    return {
      teamSize: offer.teamSize,
      seed: boutSeed,
      team0,
      team1: [...offer.opponents],
      team0Specs,
      team1Specs,
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
    let team1Specs: FighterSpawnSpec[];
    if (bout.kind === 'venatio' && bout.beastOpponents) {
      team1Specs = bout.beastOpponents.map((beast) => ({
        kind: 'beast' as const,
        beast,
        armatura: 'MURMILLO' as const,
      }));
    } else {
      team1Specs = this.spawnRivalSpecs(bout.opponentArmaturae, boutSeed);
    }
    return {
      teamSize: bout.teamSize,
      seed: boutSeed,
      team0,
      team1: [...bout.opponentArmaturae],
      team0Specs,
      team1Specs,
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
