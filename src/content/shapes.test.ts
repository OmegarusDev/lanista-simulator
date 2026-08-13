import { describe, expect, it } from 'vitest';
import {
  deriveCombat,
  hitboxFromShape,
  materialColor,
  PART_SHAPES,
  shapeForPart,
  type WeaponShape,
} from './shapes';
import { ARMATURA_LOOK } from './appearance';

describe('deriveCombat', () => {
  it('reach is monotonic in weapon length', () => {
    const base: WeaponShape = {
      slot: 'weapon',
      family: 'gladius',
      totalLength: 16,
      bladeLength: 13,
      bladeWidth: 3,
      bladeThickness: 0.8,
      curvature: 0,
      tines: 0,
      tineSpan: 0,
      gripOffset: 3,
      material: 'iron',
      mass: 1,
    };
    const short = deriveCombat({ ...base, totalLength: 12 });
    const long = deriveCombat({ ...base, totalLength: 30 });
    expect(long.measureMax!).toBeGreaterThan(short.measureMax!);
    expect(long.measureMin!).toBeGreaterThan(short.measureMin!);
    expect(long.attackRange!).toBeGreaterThan(short.attackRange!);
  });

  it('narrow long blades thrust in a tighter arc than wide short ones', () => {
    const thin: WeaponShape = {
      slot: 'weapon', family: 'gladius', totalLength: 26, bladeLength: 23,
      bladeWidth: 2, bladeThickness: 0.6, curvature: 0, tines: 0, tineSpan: 0,
      gripOffset: 3, material: 'iron', mass: 1,
    };
    const wide: WeaponShape = {
      slot: 'weapon', family: 'sica', totalLength: 12, bladeLength: 9,
      bladeWidth: 5, bladeThickness: 0.8, curvature: 0.3, tines: 0, tineSpan: 0,
      gripOffset: 3, material: 'iron', mass: 1,
    };
    expect(deriveCombat(thin).attackArc!).toBeLessThan(deriveCombat(wide).attackArc!);
  });

  it('trident tip-catch scales with tine spread; others get none', () => {
    const wide: WeaponShape = {
      slot: 'weapon', family: 'trident', totalLength: 30, bladeLength: 12,
      bladeWidth: 2, bladeThickness: 1.2, curvature: 0, tines: 3, tineSpan: 10,
      gripOffset: 18, material: 'bronze', mass: 0.9,
    };
    const narrow: WeaponShape = { ...wide, tineSpan: 4 };
    const gladius: WeaponShape = {
      slot: 'weapon', family: 'gladius', totalLength: 19, bladeLength: 16,
      bladeWidth: 3.2, bladeThickness: 0.8, curvature: 0, tines: 0, tineSpan: 0,
      gripOffset: 3, material: 'iron', mass: 1.1,
    };
    expect(deriveCombat(wide).tipCatchRatio!).toBeGreaterThan(deriveCombat(narrow).tipCatchRatio!);
    expect(deriveCombat(wide).tipCatchRatio!).toBeGreaterThan(0);
    expect(deriveCombat(gladius).tipCatchRatio!).toBe(0);
  });

  it('heavy weapons are slower than light ones', () => {
    const light: WeaponShape = {
      slot: 'weapon', family: 'gladius', totalLength: 16, bladeLength: 13,
      bladeWidth: 3, bladeThickness: 0.8, curvature: 0, tines: 0, tineSpan: 0,
      gripOffset: 3, material: 'iron', mass: 0.7,
    };
    const heavy = { ...light, mass: 1.4 };
    expect(deriveCombat(heavy).windup!).toBeGreaterThan(deriveCombat(light).windup!);
    expect(deriveCombat(heavy).attackStamina!).toBeGreaterThan(deriveCombat(light).attackStamina!);
  });

  it('shields: big scutum covers wide and absorbs less per hit than a parmula', () => {
    const scutum = deriveCombat(PART_SHAPES.shield_scutum!);
    const parmula = deriveCombat(PART_SHAPES.shield_parmula!);
    expect(scutum.guardArc!).toBeGreaterThan(parmula.guardArc!);
    expect(scutum.guardAbsorb!).toBeLessThan(parmula.guardAbsorb!);
    expect(scutum.shieldShock!).toBeGreaterThan(parmula.shieldShock!);
  });

  it('no-shield form keeps the minimal guard profile', () => {
    const none = deriveCombat(PART_SHAPES.shield_none!);
    expect(none.guardArc!).toBe(0.22);
    expect(none.shieldShock!).toBe(0);
  });

  it('heavier helms trade poise for turn rate; smooth bowls resist tip-catch', () => {
    const smooth = deriveCombat(PART_SHAPES.helm_secutor!);
    const bare = deriveCombat(PART_SHAPES.helm_none_ret!);
    expect(smooth.tipCatchResist!).toBeGreaterThan(bare.tipCatchResist!);
    expect(smooth.maxPoise!).toBeGreaterThan(bare.maxPoise!);
    expect(smooth.turnRate!).toBeLessThan(bare.turnRate!);
  });

  it('greaves: more coverage = more health, more mass, less speed', () => {
    const heavy = deriveCombat(PART_SHAPES.greaves_heavy!);
    const light = deriveCombat(PART_SHAPES.greaves_light_ret!);
    expect(heavy.maxHealth!).toBeGreaterThan(light.maxHealth!);
    expect(heavy.mass!).toBeGreaterThan(light.mass!);
    expect(heavy.moveSpeed!).toBeLessThan(light.moveSpeed!);
  });

  it('all stock shapes derive inside clamped, finite ranges', () => {
    for (const id of Object.keys(PART_SHAPES) as (keyof typeof PART_SHAPES)[]) {
      const shape = PART_SHAPES[id]!;
      const c = deriveCombat(shape);
      for (const v of Object.values(c)) {
        expect(Number.isFinite(v)).toBe(true);
        expect(Math.abs(v as number)).toBeLessThan(1000);
      }
    }
  });

  it('derived defaults stay near the tuned stock anchors', () => {
    // Trident: long reach, narrow arc, tip-catch.
    const trident = deriveCombat(PART_SHAPES.weapon_trident_net!);
    expect(trident.measureMax!).toBeGreaterThan(60);
    expect(trident.measureMax!).toBeLessThan(90);
    expect(trident.attackArc!).toBeLessThan(0.5);
    expect(trident.tipCatchRatio!).toBeGreaterThan(0.3);
    // Hasta: spear reach.
    const hasta = deriveCombat(PART_SHAPES.weapon_hasta!);
    expect(hasta.measureMax!).toBeGreaterThan(60);
    // Gladius: mid reach, mid arc.
    const gladius = deriveCombat(PART_SHAPES.weapon_gladius_mur!);
    expect(gladius.measureMax!).toBeGreaterThan(45);
    expect(gladius.measureMax!).toBeLessThan(60);
  });
});

describe('hitboxFromShape', () => {
  const shape: WeaponShape = {
    slot: 'weapon', family: 'trident', totalLength: 30, bladeLength: 12,
    bladeWidth: 2, bladeThickness: 1.2, curvature: 0, tines: 3, tineSpan: 8,
    gripOffset: 18, material: 'bronze', mass: 0.9,
  };
  const grip = { angle: 0.7, dist: 9 };

  it('tip = grip + totalLength along forward (+X)', () => {
    const hb = hitboxFromShape(shape, grip);
    const gx = Math.cos(grip.angle) * grip.dist;
    const gz = Math.sin(grip.angle) * grip.dist;
    expect(hb.tip[0]).toBeCloseTo(gx + 30, 6);
    expect(hb.tip[1]).toBe(13);
    expect(hb.tip[2]).toBeCloseTo(gz, 6);
  });

  it('tipSpan mirrors the tine spread for tridents; zero otherwise', () => {
    expect(hitboxFromShape(shape, grip).tipSpan).toBe(8);
    const gladius: WeaponShape = {
      slot: 'weapon', family: 'gladius', totalLength: 19, bladeLength: 16,
      bladeWidth: 3.2, bladeThickness: 0.8, curvature: 0, tines: 0, tineSpan: 0,
      gripOffset: 3, material: 'iron', mass: 1.1,
    };
    expect(hitboxFromShape(gladius, grip).tipSpan).toBe(0);
  });

  it('every stock weapon part resolves a shape (registry completeness)', () => {
    for (const id of [
      'weapon_gladius_mur', 'weapon_sica', 'weapon_trident_net', 'weapon_gladius_sec',
      'weapon_hasta', 'weapon_gladius_pro', 'weapon_dual_blades', 'weapon_scissor_blade',
    ]) {
      expect(shapeForPart(id)).not.toBeNull();
    }
  });
});

describe('materialColor', () => {
  it('armatura identity wins for its own materials', () => {
    const look = ARMATURA_LOOK.THRAEX;
    const bronze = materialColor('bronze', look);
    expect(bronze).toEqual([
      parseInt('c4', 16) / 255,
      parseInt('a0', 16) / 255,
      parseInt('60', 16) / 255,
    ]);
  });

  it('wood falls back to the global palette', () => {
    const look = ARMATURA_LOOK.MURMILLO;
    expect(materialColor('wood', look)).toEqual([0.42, 0.29, 0.19]);
  });
});
