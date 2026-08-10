import { describe, expect, it } from 'vitest';
import { economy } from '../../content/economy';
import { createQuickMatch } from '../combat/match';
import { applyCareerFight } from './aftermath';
import { spawnSpecFromGladiator } from './combatMods';
import { buyFacility, upgradeGear } from './facilities';
import { applyOfflineIdle } from './idle';
import { settleSeasonLegacy } from './legacy';
import { buyRecruit } from './market';
import { createSeason, endDay, healGladiator, upkeepCost } from './season';
import { setGladiatorAssignment } from './ludusDay';

describe('management RPG', () => {
  it('wires condition and grade into bout spawn', () => {
    const s = createSeason(11);
    const g = s.roster[0]!;
    g.grade = 'PRIMUS';
    g.xp = 100;
    g.hpRatio = 0.5;
    g.fatigue = 3;
    g.temperament = 'FEROX';
    const spec = spawnSpecFromGladiator(g, 'PRESS');
    expect(spec.startHpRatio).toBeLessThan(0.6);
    expect(spec.hpMul).toBeLessThan(1);
    expect((spec.pursueBiasAdd ?? 0) > 0).toBe(true);

    const m = createQuickMatch(
      1,
      99,
      [g.armatura],
      ['THRAEX'],
      960,
      540,
      [spec],
      [{ armatura: 'THRAEX' }],
    );
    const f = m.fighters[0]!;
    expect(f.hp).toBeLessThan(f.maxHp);
    expect(f.name).toBe(g.name);
  });

  it('grants xp on career win and resolves training', () => {
    const s = createSeason(22);
    const g = s.roster[0]!;
    const xp0 = g.xp;
    setGladiatorAssignment(s, g.id, 'TRAIN');
    applyCareerFight(s, {
      offer: s.offers[0]!,
      lineupIds: [g.id],
      result: 'TEAM0',
      forfeited: false,
    });
    expect(g.xp).toBeGreaterThan(xp0);
    expect(s.dayResolved).toBe(true);
  });

  it('buys recruits and facilities', () => {
    const s = createSeason(33);
    s.denarii = 500;
    s.virtus = 20;
    expect(buyFacility(s, 'BARRACKS')).toBe(true);
    expect(buyFacility(s, 'ARMAMENTARIUM')).toBe(true);
    s.market = [
      {
        id: 't1',
        name: 'Testo',
        armatura: 'PROVOCATOR',
        grade: 'TIRO',
        temperament: 'CAUTUS',
        price: 40,
        fame: 0,
      },
    ];
    const n = s.roster.length;
    expect(buyRecruit(s, 't1')).toBe(true);
    expect(s.roster.length).toBe(n + 1);
    const g = s.roster[0]!;
    expect(upgradeGear(s, g.id)).toBe(true);
    expect(g.gearGrade).toBe(1);
    expect(upkeepCost(s)).toBeGreaterThan(
      s.roster.filter((x) => !x.retired).length * economy.upkeepPerGladiator - 1,
    );
  });

  it('settles legacy and applies capped idle recovery', () => {
    const s = createSeason(44);
    s.status = 'SEASON_END';
    s.virtus = 24;
    s.record.wins = 5;
    const leg = settleSeasonLegacy(s, {
      patronage: 0,
      seasonsCompleted: 0,
      unlockedFacilities: [],
      alumni: [],
      starterGradeBump: false,
    });
    expect(leg.patronage).toBeGreaterThan(0);
    expect(leg.starterGradeBump).toBe(true);

    const g = s.roster[0]!;
    g.fatigue = 4;
    g.hpRatio = 0.5;
    s.status = 'ACTIVE';
    s.lastSeenAt = Date.now() - 3 * 60 * 60 * 1000;
    const notes = applyOfflineIdle(s);
    expect(notes.length).toBeGreaterThan(0);
    expect(g.fatigue).toBeLessThan(4);
  });

  it('heals with bandage', () => {
    const s = createSeason(3);
    const g = s.roster[0]!;
    g.injury = 'LIGHT';
    g.hpRatio = 0.5;
    expect(healGladiator(s, g.id)).toBe(true);
    expect(g.injury).toBe('NONE');
  });

  it('ends season at day cap', () => {
    const s = createSeason(99);
    s.day = economy.seasonDays;
    s.dayResolved = true;
    endDay(s);
    expect(s.status).toBe('SEASON_END');
  });
});
