/**
 * Shape-driven kit: every weapon / armour piece is ONE mathematical shape.
 * Mesh geometry, combat numbers, and the hitbox all derive from that shape —
 * the math is the weapon. Explicit combat overrides (on KitPart) always win.
 *
 * Body-local convention (matches kitMesh / sceneFighters):
 *   +X forward, +Y up, +Z right; main hand sits at a positive angle from +X.
 * A shape's `totalLength` runs along +X from the grip; the tip IS the hitbox.
 */
import type { CombatSlice, KitPartId } from './kitPieces';
import type { ArmaturaLook } from './appearance';

export type Material = 'iron' | 'bronze' | 'leather' | 'cloth' | 'wood' | 'bone';

/** Fallback RGB when the armatura look has no dedicated tone for the material. */
export const MATERIAL_RGB: Record<Material, [number, number, number]> = {
  iron: [0.6, 0.66, 0.71],
  bronze: [0.69, 0.5, 0.31],
  leather: [0.35, 0.25, 0.19],
  cloth: [0.42, 0.36, 0.3],
  wood: [0.42, 0.29, 0.19],
  bone: [0.85, 0.82, 0.75],
};

export interface WeaponShape {
  slot: 'weapon';
  family: 'gladius' | 'sica' | 'trident' | 'spear' | 'dual' | 'scissor' | 'blunt';
  /** Tip to pommel, body-local +X, world units. */
  totalLength: number;
  /** Crossguard → tip. */
  bladeLength: number;
  bladeWidth: number;
  bladeThickness: number;
  /** Sica hook: 0 = straight; >0 bends toward the off-hand. */
  curvature: number;
  /** Trident prong count (2–4) and spread. */
  tines: number;
  tineSpan: number;
  /** Hand position along the length (0 = pommel end). */
  gripOffset: number;
  material: Material;
  mass: number;
}

export interface ShieldShape {
  slot: 'shield';
  form: 'scutum' | 'parmula' | 'aspis' | 'none';
  /** Face width. */
  diameter: number;
  /** Bowl depth (0 = flat). */
  depth: number;
  boss: boolean;
  rimWidth: number;
  material: Material;
  mass: number;
}

export interface HelmShape {
  slot: 'helm';
  form: 'crested' | 'smooth' | 'open' | 'bare';
  /** Lathe profile [y, radius] pairs — the bowl IS the shape. */
  profile: [number, number][];
  crestHeight: number;
  cheekGuards: boolean;
  material: Material;
  mass: number;
}

export interface LimbShape {
  slot: 'greaves' | 'manica';
  /** Fraction of the limb covered (0–1). */
  coverage: number;
  material: Material;
  mass: number;
}

export type PartShape = WeaponShape | ShieldShape | HelmShape | LimbShape;

const clamp = (n: number, a: number, b: number): number => Math.max(a, Math.min(b, n));

// ————————————————— Derivation —————————————————

/**
 * Shape → combat defaults. Every output is a partial override over KIT_BASE;
 * explicit KitPart.combat overrides are merged AFTER this and win.
 * Formulas are anchored to the tuned stock set (validated in shapes.test.ts).
 */
export function deriveCombat(shape: PartShape): Partial<CombatSlice> {
  switch (shape.slot) {
    case 'weapon':
      return deriveWeapon(shape);
    case 'shield':
      return deriveShield(shape);
    case 'helm':
      return deriveHelm(shape);
    default:
      return deriveLimb(shape);
  }
}

function deriveWeapon(s: WeaponShape): Partial<CombatSlice> {
  const thinness = s.bladeWidth / Math.max(1, s.bladeLength);
  const materialMul = s.material === 'iron' ? 1 : s.material === 'bronze' ? 0.9 : 0.95;
  // Reach calibration: constants encode body + lunge for a stock gladiator,
  // the weapon's contribution is pure length (anchored to the tuned set:
  // polearms 33+1.5L, blades 27+1.35L).
  const pole = s.family === 'trident' || s.family === 'spear';
  const reach = Math.round(pole ? 33 + s.totalLength * 1.5 : 27 + s.totalLength * 1.35);
  const trident = s.family === 'trident' && s.tines >= 2;
  return {
    measureMin: Math.round(reach * 0.72),
    measureMax: reach,
    attackRange: Math.round(reach - 2),
    attackArc: clamp(0.22 + thinness * 1.6, 0.3, 0.95),
    windup: Math.round(12 + s.mass * 5 + s.totalLength * 0.2),
    active: Math.round(5 + s.mass * 2),
    recover: Math.round((12 + s.mass * 5 + s.totalLength * 0.2) * 0.85),
    attackCooldown: Math.round((12 + s.mass * 5 + s.totalLength * 0.2) * 0.6 + 6),
    attackStamina: Math.round(8 + s.mass * 4),
    damageMul: Number((materialMul * (0.85 + s.mass * 0.2)).toFixed(2)),
    poiseMul: Number((0.8 + thinness * 2).toFixed(2)),
    tipCatchRatio: trident ? clamp((s.tineSpan / s.totalLength) * 1.4, 0.3, 0.65) : 0,
    tipCatchTicks: trident ? Math.round(40 + s.mass * 10) : 0,
    circleArcBonus: clamp((1 - thinness) * 0.3, 0, 0.3),
  };
}

function deriveShield(s: ShieldShape): Partial<CombatSlice> {
  if (s.form === 'none') {
    return {
      guardArc: 0.22,
      guardAbsorb: 0.85,
      shieldShock: 0,
      blockStaminaPerTick: 0.22,
    };
  }
  const arc = clamp(-0.56 + 0.0557 * s.diameter + 0.0829 * s.depth, 0.2, 1.1);
  return {
    guardArc: Number(arc.toFixed(2)),
    guardAbsorb: Number(clamp(0.98 - s.diameter * 0.035, 0.2, 0.9).toFixed(2)),
    shieldShock: Math.round(s.mass * 6),
    blockStaminaPerTick: Number(clamp(0.3 - s.diameter * 0.012, 0.05, 0.3).toFixed(2)),
  };
}

function deriveHelm(s: HelmShape): Partial<CombatSlice> {
  const coverage = s.form === 'bare' ? 0 : s.form === 'open' ? 0.4 : 1;
  return {
    maxPoise: Math.round(38 + coverage * 42 + (s.cheekGuards ? 8 : 0) + s.mass * 10),
    turnRate: Number(
      clamp(4.4 - s.mass * 1.9 - (s.form === 'smooth' ? 0.3 : 0) + (s.form === 'bare' ? 0.6 : 0), 1.6, 4.2).toFixed(2),
    ),
    tipCatchResist: s.form === 'smooth' ? 0.75 : s.form === 'crested' ? 0.1 : 0,
  };
}

function deriveLimb(s: LimbShape): Partial<CombatSlice> {
  const mass = Number((0.55 + s.coverage * 0.8).toFixed(2));
  return {
    maxHealth: Math.round(85 + s.coverage * 40),
    mass,
    moveSpeed: Math.round(86 - mass * 25),
    strafeMul: Number(clamp(1.35 - mass * 0.6, 0.4, 1.35).toFixed(2)),
    dodgeStamina: Math.round(6 + mass * 6),
    dodgeDuration: Math.round(18 - mass * 6),
    dodgeCooldown: Math.round(8 + mass * 17),
  };
}

// ————————————————— Hitbox —————————————————

export interface WeaponHitbox {
  /** Hand grip in body-local space. */
  grip: [number, number, number];
  /** Blade tip at full rest extension (body-local). */
  tip: [number, number, number];
  /** Prong spread at the tip (tip-catch window), 0 for non-tines. */
  tipSpan: number;
  swingArc: number;
}

/**
 * The hitbox IS the shape: tip = grip + totalLength along +X (forward).
 * sceneFighters transforms body-local → world with the exact same Ry·T math,
 * so rendered tip position and the hitbox agree by construction.
 */
export function hitboxFromShape(
  s: WeaponShape,
  grip: { angle: number; dist: number },
): WeaponHitbox {
  const gripPos: [number, number, number] = [
    Math.cos(grip.angle) * grip.dist,
    13,
    Math.sin(grip.angle) * grip.dist,
  ];
  return {
    grip: gripPos,
    tip: [gripPos[0] + s.totalLength, gripPos[1], gripPos[2]],
    tipSpan: s.family === 'trident' ? s.tineSpan : 0,
    swingArc: clamp(0.22 + (s.bladeWidth / Math.max(1, s.bladeLength)) * 1.6, 0.3, 0.95),
  };
}

// ————————————————— Material color resolution —————————————————

/**
 * Armatura identity wins for its own materials; other materials fall back
 * to the global palette. `cloth` falls back to the look's cloth tone.
 */
export function materialColor(
  material: Material,
  look: ArmaturaLook,
): [number, number, number] {
  if (material === 'iron' || material === 'bronze') return hex3(look.metal);
  if (material === 'leather') return hex3(look.leather);
  if (material === 'cloth') return hex3(look.cloth);
  return MATERIAL_RGB[material];
}

function hex3(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

// ————————————————— Shape registry (one shape per kit part) —————————————————

export const PART_SHAPES: Partial<Record<KitPartId, PartShape>> = {
  // —— Helms ——
  helm_murmillo_crest: {
    slot: 'helm',
    form: 'crested',
    profile: [[-6, 0], [0, 11], [6, 12], [12, 9.5]],
    crestHeight: 9,
    cheekGuards: true,
    material: 'iron',
    mass: 1.15,
  },
  helm_thraex: {
    slot: 'helm',
    form: 'crested',
    profile: [[-5, 0], [0, 9.5], [6, 10.5], [11, 8]],
    crestHeight: 6,
    cheekGuards: true,
    material: 'bronze',
    mass: 0.8,
  },
  helm_none_ret: {
    slot: 'helm',
    form: 'bare',
    profile: [[-5, 0], [0, 8], [5, 8.5], [9, 6]],
    crestHeight: 0,
    cheekGuards: false,
    material: 'cloth',
    mass: 0.5,
  },
  helm_secutor: {
    slot: 'helm',
    form: 'smooth',
    profile: [[-5, 0], [0, 11], [7, 12], [12, 9]],
    crestHeight: 0,
    cheekGuards: true,
    material: 'iron',
    mass: 1.2,
  },
  helm_hoplomachus: {
    slot: 'helm',
    form: 'crested',
    profile: [[-5, 0], [0, 10], [6, 11], [11, 8]],
    crestHeight: 8,
    cheekGuards: true,
    material: 'bronze',
    mass: 0.9,
  },
  helm_provocator: {
    slot: 'helm',
    form: 'crested',
    profile: [[-6, 0], [0, 11.5], [6, 12.5], [12, 10]],
    crestHeight: 7,
    cheekGuards: true,
    material: 'iron',
    mass: 1.3,
  },
  helm_dimachaerus: {
    slot: 'helm',
    form: 'open',
    profile: [[-4, 0], [0, 8.5], [5, 9.5], [9, 7]],
    crestHeight: 0,
    cheekGuards: false,
    material: 'iron',
    mass: 0.7,
  },
  helm_scissor: {
    slot: 'helm',
    form: 'smooth',
    profile: [[-5, 0], [0, 10], [6, 11], [11, 8.5]],
    crestHeight: 0,
    cheekGuards: true,
    material: 'iron',
    mass: 1.05,
  },

  // —— Shields ——
  shield_scutum: {
    slot: 'shield',
    form: 'scutum',
    diameter: 20,
    depth: 6,
    boss: true,
    rimWidth: 1.4,
    material: 'iron',
    mass: 1.1,
  },
  shield_parmula: {
    slot: 'shield',
    form: 'parmula',
    diameter: 14,
    depth: 4,
    boss: true,
    rimWidth: 1,
    material: 'iron',
    mass: 0.7,
  },
  shield_none: { slot: 'shield', form: 'none', diameter: 0, depth: 0, boss: false, rimWidth: 0, material: 'leather', mass: 0.2 },
  shield_secutor: {
    slot: 'shield',
    form: 'scutum',
    diameter: 19,
    depth: 5.5,
    boss: true,
    rimWidth: 1.3,
    material: 'iron',
    mass: 1.05,
  },
  shield_aspis: {
    slot: 'shield',
    form: 'aspis',
    diameter: 12,
    depth: 4.5,
    boss: true,
    rimWidth: 0.8,
    material: 'iron',
    mass: 0.8,
  },
  shield_provocator: {
    slot: 'shield',
    form: 'scutum',
    diameter: 21,
    depth: 6.5,
    boss: true,
    rimWidth: 1.5,
    material: 'iron',
    mass: 1.25,
  },
  shield_dimachaerus: {
    slot: 'shield',
    form: 'none',
    diameter: 0,
    depth: 0,
    boss: false,
    rimWidth: 0,
    material: 'leather',
    mass: 0.2,
  },
  shield_scissor: {
    slot: 'shield',
    form: 'none',
    diameter: 0,
    depth: 0,
    boss: false,
    rimWidth: 0,
    material: 'iron',
    mass: 0.9,
  },

  // —— Weapons ——
  weapon_gladius_mur: {
    slot: 'weapon',
    family: 'gladius',
    totalLength: 19,
    bladeLength: 16,
    bladeWidth: 3.2,
    bladeThickness: 0.8,
    curvature: 0,
    tines: 0,
    tineSpan: 0,
    gripOffset: 3,
    material: 'iron',
    mass: 1.1,
  },
  weapon_sica: {
    slot: 'weapon',
    family: 'sica',
    totalLength: 15,
    bladeLength: 12.5,
    bladeWidth: 4.5,
    bladeThickness: 0.6,
    curvature: 0.35,
    tines: 0,
    tineSpan: 0,
    gripOffset: 2.5,
    material: 'iron',
    mass: 0.8,
  },
  weapon_trident_net: {
    slot: 'weapon',
    family: 'trident',
    totalLength: 30,
    bladeLength: 12,
    bladeWidth: 2,
    bladeThickness: 1.2,
    curvature: 0,
    tines: 3,
    tineSpan: 8,
    gripOffset: 4,
    material: 'bronze',
    mass: 0.9,
  },
  weapon_gladius_sec: {
    slot: 'weapon',
    family: 'gladius',
    totalLength: 18,
    bladeLength: 15,
    bladeWidth: 3,
    bladeThickness: 0.8,
    curvature: 0,
    tines: 0,
    tineSpan: 0,
    gripOffset: 3,
    material: 'iron',
    mass: 1.0,
  },
  weapon_hasta: {
    slot: 'weapon',
    family: 'spear',
    totalLength: 34,
    bladeLength: 8,
    bladeWidth: 2.5,
    bladeThickness: 1.4,
    curvature: 0,
    tines: 0,
    tineSpan: 0,
    gripOffset: 4,
    material: 'wood',
    mass: 0.7,
  },
  weapon_gladius_pro: {
    slot: 'weapon',
    family: 'gladius',
    totalLength: 18,
    bladeLength: 15,
    bladeWidth: 3.2,
    bladeThickness: 0.9,
    curvature: 0,
    tines: 0,
    tineSpan: 0,
    gripOffset: 3,
    material: 'iron',
    mass: 1.2,
  },
  weapon_dual_blades: {
    slot: 'weapon',
    family: 'dual',
    totalLength: 16,
    bladeLength: 13,
    bladeWidth: 2.8,
    bladeThickness: 0.6,
    curvature: 0,
    tines: 0,
    tineSpan: 0,
    gripOffset: 3,
    material: 'iron',
    mass: 0.75,
  },
  weapon_scissor_blade: {
    slot: 'weapon',
    family: 'scissor',
    totalLength: 20,
    bladeLength: 12,
    bladeWidth: 3.5,
    bladeThickness: 1,
    curvature: 0.08,
    tines: 0,
    tineSpan: 0,
    gripOffset: 8,
    material: 'iron',
    mass: 1.0,
  },

  // —— Greaves ——
  greaves_heavy: { slot: 'greaves', coverage: 1, material: 'iron', mass: 1.3 },
  greaves_thraex: { slot: 'greaves', coverage: 0.6, material: 'bronze', mass: 0.9 },
  greaves_light_ret: { slot: 'greaves', coverage: 0.35, material: 'leather', mass: 0.7 },
  greaves_secutor: { slot: 'greaves', coverage: 0.95, material: 'iron', mass: 1.25 },
  greaves_hop: { slot: 'greaves', coverage: 0.7, material: 'bronze', mass: 1.0 },
  greaves_provocator: { slot: 'greaves', coverage: 1, material: 'iron', mass: 1.35 },
  greaves_dim: { slot: 'greaves', coverage: 0.4, material: 'leather', mass: 0.75 },
  greaves_scissor: { slot: 'greaves', coverage: 0.75, material: 'iron', mass: 1.05 },

  // —— Manica ——
  manica_mur: { slot: 'manica', coverage: 0.7, material: 'leather', mass: 1.0 },
  manica_thraex: { slot: 'manica', coverage: 0.6, material: 'cloth', mass: 0.8 },
  manica_ret: { slot: 'manica', coverage: 0.5, material: 'cloth', mass: 0.6 },
  manica_sec: { slot: 'manica', coverage: 0.7, material: 'leather', mass: 0.95 },
  manica_hop: { slot: 'manica', coverage: 0.6, material: 'leather', mass: 0.85 },
  manica_pro: { slot: 'manica', coverage: 0.65, material: 'leather', mass: 0.9 },
  manica_dim: { slot: 'manica', coverage: 0.55, material: 'cloth', mass: 0.7 },
  manica_scissor: { slot: 'manica', coverage: 0.7, material: 'leather', mass: 0.9 },
};

/** Shape for a part id, or null (defensive — never throws in draw paths). */
export function shapeForPart(id: KitPartId | null | undefined): PartShape | null {
  if (!id) return null;
  return PART_SHAPES[id] ?? null;
}

// ————————————————— Body / strike geometry (render === collision) —————————————————

/**
 * Appearance-bulk factor — THE shared body-size function. The renderer scales
 * the torso with it and the combat collision capsule derives from it, so a
 * look change re-sizes mesh and hitbox together, automatically.
 */
export function bodyBulk(seed: number): number {
  return 1 + ((seed % 17) / 17 - 0.5) * 0.12;
}

/** Beast bulk (same hash the beast mesh uses). */
export function beastBulk(beastId: string, seed: number): number {
  return 1 + (((beastId.length + seed) % 13) / 13 - 0.5) * 0.18;
}

/** The fighter's collision capsule = the torso mesh, same formulas. */
export function bodyCollisionCapsule(
  look: ArmaturaLook,
  seed: number,
): { radius: number; height: number; centerY: number } {
  const bulk = bodyBulk(seed);
  const bodyR = ((look.bodyRx + look.bodyRy) * 0.5) * 1.55 * bulk;
  return { radius: bodyR / 2, height: 22 * bulk, centerY: 11 * bulk };
}

/**
 * Swing curve — a real cut: the blade stays level while the body lunges
 * (first half of the phase), then swings at full extension and returns.
 * Sim-space sign: positive θ rotates the blade clockwise from facing.
 * The renderer applies the mirrored rotation (ry = −θ·180/π) by convention,
 * so the drawn sweep and the collision sweep are the same object.
 */
export function swingAngleRad(arc: number, frac: number): number {
  const f = Math.min(1, Math.max(0, frac));
  return Math.sin(Math.PI * Math.max(0, (f - 0.5) * 2)) * arc;
}

/** Forward lunge advance (local units): rises 0 → peak by mid-phase, holds. */
export function lungeOffset(units: number, frac: number): number {
  const f = Math.min(1, Math.max(0, frac));
  return units * Math.sin(Math.min(1, f * 2) * (Math.PI / 2));
}
