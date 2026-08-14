/**
 * Shape-driven kit meshes — the math is the weapon.
 * Every part's geometry descends from its shape (content/shapes.ts):
 *   derive → geometry params → GeoKey strings → cached VAOs in sceneFighters.
 * The same numbers feed hitboxes and combat defaults, so render === hitbox.
 */
import { KIT_PARTS } from '../content/kitPieces';
import {
  ARMATURA_LOOK,
  type ArmaturaLook,
} from '../content/appearance';
import type { ArmaturaId } from '../content/armatura';
import {
  bodyBulk,
  beastBulk,
  shapeForPart,
  type PartShape,
  type HelmShape,
  type ShieldShape,
  type WeaponShape,
} from '../content/shapes';
import type { FighterDraw } from './drawModel';

/** Geometry families resolved to shared (cached) VAOs in sceneFighters. */
export type GeoKind = 'box' | 'cyl' | 'sph' | 'frustum' | 'lathe' | 'bent' | 'torus';

export interface KitPartDraw {
  kind: PartMeshKind;
  /** Geometry cache key — shared meshes, never per-fighter VAOs. */
  geo: { kind: GeoKind; params: string };
  /** Local offset (forward X, up Y, right Z) before facing yaw. */
  ox: number;
  oy: number;
  oz: number;
  sx: number;
  sy: number;
  sz: number;
  /** Local yaw (swing/tilt, composed after fighter facing). */
  ry: number;
  /** Local roll (shield tilt, blade orientation). */
  rz: number;
  albedo: [number, number, number];
  /** Second tone (rims, bosses, crossguards) — Phase 3 material pass. */
  accent: [number, number, number] | null;
  material: 'metal' | 'leather' | 'cloth' | 'flesh' | 'wood' | 'bone';
  /** Face takes the fighter's team color (shields). */
  teamPaint?: boolean;
  /** Which hand holds this part — independent animation (dual blades). */
  hand?: 'main' | 'off';
}

export type PartMeshKind =
  | 'body'
  | 'helm'
  | 'crest'
  | 'shield'
  | 'roundShield'
  | 'shieldRim'
  | 'shieldBoss'
  | 'gladius'
  | 'sica'
  | 'trident'
  | 'spear'
  | 'dual'
  | 'scissor'
  | 'net'
  | 'greaves'
  | 'manica'
  | 'breastplate'
  | 'beastBody';

function hexRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

function hueShift(rgb: [number, number, number], seed: number): [number, number, number] {
  const t = ((seed % 1000) / 1000 - 0.5) * 0.12;
  return [
    Math.max(0, Math.min(1, rgb[0] + t)),
    Math.max(0, Math.min(1, rgb[1] - t * 0.4)),
    Math.max(0, Math.min(1, rgb[2] + t * 0.2)),
  ];
}

/** Identity key for kit mesh cache — appearance + parts, not pose. */
function kitIdentityKey(f: FighterDraw): string {
  return `${f.kind}|${f.armatura}|${f.beastId ?? ''}|${f.appearanceSeed}|${f.parts.join(',')}`;
}

const KIT_CACHE = new Map<string, KitPartDraw[]>();
const KIT_CACHE_MAX = 48;

function cacheKit(key: string, parts: KitPartDraw[]): KitPartDraw[] {
  if (KIT_CACHE.size >= KIT_CACHE_MAX) {
    const first = KIT_CACHE.keys().next().value;
    if (first != null) KIT_CACHE.delete(first);
  }
  KIT_CACHE.set(key, parts);
  return parts;
}

/** Geometry param string helpers — deterministic cache keys. */
function f(n: number): string {
  return Math.round(n * 100).toString();
}

function frustumKey(
  sx1: number, sy: number, sz1: number, sx2: number, sz2: number,
): string {
  return `f${f(sx1)}:${f(sy)}:${f(sz1)}:${f(sx2)}:${f(sz2)}`;
}

function latheKey(profile: readonly [number, number][]): string {
  return profile.map(([y, r]) => `${f(y)},${f(r)}`).join(';');
}

function bentKey(
  length: number, width: number, thickness: number, curvature: number,
): string {
  return `b${f(length)}:${f(width)}:${f(thickness)}:${f(curvature)}`;
}

function torusKey(inner: number, outer: number): string {
  return `t${f(inner)}:${f(outer)}`;
}

const H = -90; // rz for blades: frustum's +Y rotated onto +X (forward)

function metal(look: ArmaturaLook): [number, number, number] {
  return hexRgb(look.metal);
}

function leather(look: ArmaturaLook): [number, number, number] {
  return hexRgb(look.leather);
}

function cloth(look: ArmaturaLook): [number, number, number] {
  return hexRgb(look.cloth);
}

function materialOf(shape: PartShape): KitPartDraw['material'] {
  if (shape.slot === 'weapon') {
    return shape.material === 'wood' ? 'wood' : 'metal';
  }
  if (shape.slot === 'helm' || shape.slot === 'shield') {
    return shape.material === 'bronze' || shape.material === 'iron' ? 'metal' : 'leather';
  }
  return shape.material === 'iron' || shape.material === 'bronze' ? 'metal' : shape.material;
}

export function kitPartsForFighter(f: FighterDraw): KitPartDraw[] {
  const key = kitIdentityKey(f);
  const hit = KIT_CACHE.get(key);
  if (hit) return hit;

  if (f.kind === 'beast') {
    // Beast silhouettes — bulk + snout/shoulder read by beastId hash
    const seed = (f.beastId ?? 'beast').length + f.appearanceSeed;
    const bulk = beastBulk(f.beastId ?? 'beast', f.appearanceSeed);
    const snout = 6 + (seed % 5);
    return cacheKit(key, [
      {
        kind: 'beastBody',
        geo: { kind: 'cyl', params: '' },
        ox: 0,
        oy: 10 * bulk,
        oz: 0,
        sx: 22 * bulk,
        sy: 18 * bulk,
        sz: 20 * bulk,
        ry: 0,
        rz: 0,
        albedo: [0.42 + ((seed % 7) / 70), 0.3, 0.2],
        accent: null,
        material: 'leather',
      },
      {
        kind: 'beastBody',
        geo: { kind: 'cyl', params: '' },
        ox: 12,
        oy: 9 * bulk,
        oz: 0,
        sx: snout,
        sy: 8 * bulk,
        sz: 8,
        ry: 0,
        rz: 0,
        albedo: [0.38, 0.28, 0.18],
        accent: null,
        material: 'leather',
      },
    ]);
  }

  const look = ARMATURA_LOOK[f.armatura as ArmaturaId] ?? ARMATURA_LOOK.MURMILLO;
  const flesh = hueShift(hexRgb(look.bodyFill), f.appearanceSeed);
  const bulk = bodyBulk(f.appearanceSeed);
  const bodyR = ((look.bodyRx + look.bodyRy) * 0.5) * 1.55 * bulk;

  const out: KitPartDraw[] = [
    {
      kind: 'body',
      geo: { kind: 'cyl', params: '' },
      ox: 0,
      oy: 11 * bulk,
      oz: 0,
      sx: bodyR,
      sy: 22 * bulk,
      sz: bodyR * (0.92 + ((f.appearanceSeed % 11) / 11) * 0.12),
      ry: 0,
      rz: 0,
      albedo: flesh,
      accent: null,
      material: 'flesh',
    },
  ];

  const addHelm = (f: HelmShape | null): void => {
    const bare = !f || f.form === 'bare';
    if (bare) {
      out.push({
        kind: 'helm',
        geo: { kind: 'sph', params: '' },
        ox: 0,
        oy: 24 * bulk,
        oz: 0,
        sx: 9,
        sy: 9,
        sz: 9,
        ry: 0,
        rz: 0,
        albedo: flesh,
        accent: null,
        material: 'flesh',
      });
      return;
    }
    const mid = (f.profile[0]![0] + f.profile[f.profile.length - 1]![0]) / 2;
    out.push({
      kind: 'helm',
      geo: { kind: 'lathe', params: latheKey(f.profile) },
      ox: 0,
      oy: 24 * bulk - mid,
      oz: 0,
      sx: 1,
      sy: 1,
      sz: 1,
      ry: 0,
      rz: 0,
      albedo: metal(look),
      accent: null,
      material: materialOf(f),
    });
    if (f.crestHeight > 0) {
      // Crest fin sits on the bowl's apex, sticking out above it.
      const profileTop = f.profile[f.profile.length - 1]![0];
      const bowlTop = 24 * bulk - mid + (profileTop - mid);
      out.push({
        kind: 'crest',
        geo: { kind: 'frustum', params: frustumKey(11, f.crestHeight, 1.6, 4, 0.8) },
        ox: 0,
        oy: bowlTop + f.crestHeight * 0.5,
        oz: 0,
        sx: 1,
        sy: 1,
        sz: 1,
        ry: 0,
        rz: 0,
        albedo: cloth(look),
        accent: null,
        material: 'cloth',
      });
    }
  }

  const addShield = (f: ShieldShape | null): void => {
    if (!f || f.form === 'none') return;
    const round = f.form !== 'scutum';
    const faceY = round ? f.diameter * 0.95 : f.diameter;
    const faceZ = f.diameter * 0.62;
    out.push({
      kind: round ? 'roundShield' : 'shield',
      geo: { kind: 'sph', params: '' },
      ox: Math.cos(look.offHandAngle) * look.offHandDist,
      oy: 12,
      oz: Math.sin(look.offHandAngle) * look.offHandDist,
      sx: f.depth * 0.5,
      sy: faceY * 0.55,
      sz: faceZ * 0.55,
      ry: 0,
      rz: 0,
      albedo: metal(look),
      accent: null,
      material: materialOf(f),
      teamPaint: true,
      hand: 'off',
    });
    if (f.boss) {
      out.push({
        kind: 'shieldBoss',
        geo: { kind: 'sph', params: '' },
        ox: Math.cos(look.offHandAngle) * look.offHandDist,
        oy: 12,
        oz: Math.sin(look.offHandAngle) * look.offHandDist,
        sx: f.depth * 0.4,
        sy: f.diameter * 0.16,
        sz: f.diameter * 0.16,
        ry: 0,
        rz: 0,
        albedo: metal(look),
        accent: null,
        material: 'metal',
        hand: 'off',
      });
    }
    // Rim ring in the shield's plane (Y-Z): torus built in XZ, rolled 90°,
    // squashed by the face's ellipse ratio so it hugs the oval face edge.
    out.push({
      kind: 'shieldRim',
      geo: { kind: 'torus', params: torusKey(f.diameter * 0.48 - f.rimWidth, f.diameter * 0.48) },
      ox: Math.cos(look.offHandAngle) * look.offHandDist,
      oy: 12,
      oz: Math.sin(look.offHandAngle) * look.offHandDist,
      sx: 1,
      sy: 1,
      sz: round ? 1 : 0.62,
      ry: 0,
      rz: 90,
      albedo: leather(look),
      accent: null,
      material: 'leather',
    });
  }

  const addBlade = (
    kind: PartMeshKind,
    length: number,
    width: number,
    thickness: number,
    grip: { x: number; z: number },
    gripLen: number,
    side: 1 | -1 = 1,
  ): void => {
    const baseOx = grip.x;
    const baseOz = side * grip.z;
    const hand: 'main' | 'off' = side === 1 ? 'main' : 'off';
    const taper = 0.3;
    out.push({
      kind,
      geo: {
        kind: 'frustum',
        params: frustumKey(0.9, gripLen, 0.9, 1.2, 1.2),
      },
      ox: baseOx + gripLen * 0.5,
      oy: 13,
      oz: baseOz,
      sx: 1,
      sy: 1,
      sz: 1,
      ry: 0,
      rz: H,
      albedo: leather(look),
      accent: null,
      material: 'leather',
      hand,
    });
    out.push({
      kind,
      geo: {
        kind: 'frustum',
        params: frustumKey(2, 1.6, width + 3, 1.6, width + 2.4),
      },
      ox: baseOx + gripLen,
      oy: 13,
      oz: baseOz,
      sx: 1,
      sy: 1,
      sz: 1,
      ry: 0,
      rz: H,
      albedo: metal(look),
      accent: null,
      material: 'metal',
      hand,
    });
    out.push({
      kind,
      geo: {
        kind: 'frustum',
        params: frustumKey(width, length, thickness, width * taper, thickness * 0.4),
      },
      ox: baseOx + gripLen + length * 0.5,
      oy: 13,
      oz: baseOz,
      sx: 1,
      sy: 1,
      sz: 1,
      ry: 0,
      rz: H,
      albedo: metal(look),
      accent: null,
      material: 'metal',
      hand,
    });
  };

  const addWeapon = (f: WeaponShape | null): void => {
    if (!f) return;
    const grip = {
      x: Math.cos(look.mainHandAngle) * look.mainHandDist,
      z: Math.sin(look.mainHandAngle) * look.mainHandDist,
    };
    switch (f.family) {
      case 'gladius':
        addBlade('gladius', f.bladeLength, f.bladeWidth, f.bladeThickness, grip, f.gripOffset);
        break;
      case 'dual': {
        addBlade('dual', f.bladeLength, f.bladeWidth, f.bladeThickness, grip, f.gripOffset);
        addBlade('dual', f.bladeLength, f.bladeWidth, f.bladeThickness, grip, f.gripOffset, -1);
        break;
      }
      case 'sica': {
        const gx = grip.x;
        const gz = grip.z;
        out.push({
          kind: 'sica',
          geo: {
            kind: 'frustum',
            params: frustumKey(0.9, f.gripOffset, 0.9, 1.1, 1.1),
          },
          ox: gx + f.gripOffset * 0.5,
          oy: 13,
          oz: gz,
          sx: 1,
          sy: 1,
          sz: 1,
          ry: 0,
          rz: H,
          albedo: leather(look),
          accent: null,
          material: 'leather',
        });
        out.push({
          kind: 'sica',
          geo: {
            kind: 'bent',
            params: bentKey(f.bladeLength, f.bladeWidth, f.bladeThickness, f.curvature),
          },
          ox: gx + f.gripOffset + f.bladeLength * 0.45,
          oy: 13,
          oz: gz,
          sx: 1,
          sy: 1,
          sz: 1,
          ry: 0,
          rz: H,
          albedo: metal(look),
          accent: null,
          material: 'metal',
        });
        break;
      }
      case 'trident': {
        const gx = grip.x;
        const gz = grip.z;
        // Weapon starts AT the hand — pommel at the grip, tines at the tip.
        const shaftLen = f.totalLength - f.bladeLength - 2;
        out.push({
          kind: 'trident',
          geo: {
            kind: 'frustum',
            params: frustumKey(0.9, f.gripOffset, 0.9, 1.1, 1.1),
          },
          ox: gx + f.gripOffset * 0.5,
          oy: 13,
          oz: gz,
          sx: 1,
          sy: 1,
          sz: 1,
          ry: 0,
          rz: H,
          albedo: leather(look),
          accent: null,
          material: 'leather',
        });
        out.push({
          kind: 'trident',
          geo: { kind: 'frustum', params: frustumKey(1.1, shaftLen, 1.1, 1.4, 1.4) },
          ox: gx + f.gripOffset + shaftLen * 0.5,
          oy: 13,
          oz: gz,
          sx: 1,
          sy: 1,
          sz: 1,
          ry: 0,
          rz: H,
          albedo: metal(look),
          accent: null,
          material: 'metal',
        });
        const tineLen = f.bladeLength;
        const tines = Math.max(2, f.tines);
        const span = f.tineSpan;
        for (let i = 0; i < tines; i++) {
          const dz = -span / 2 + (i * span) / (tines - 1);
          out.push({
            kind: 'trident',
            geo: { kind: 'frustum', params: frustumKey(0.8, tineLen, 0.8, 0.15, 0.15) },
            ox: gx + f.gripOffset + shaftLen + tineLen * 0.5,
            oy: 13,
            oz: gz + dz,
            sx: 1,
            sy: 1,
            sz: 1,
            ry: 0,
            rz: H,
            albedo: metal(look),
            accent: null,
            material: 'metal',
          });
        }
        // Crossbar
        out.push({
          kind: 'trident',
          geo: { kind: 'frustum', params: frustumKey(1.6, 2, f.tineSpan * 0.5, 1.2, 1.2) },
          ox: gx + f.gripOffset + shaftLen + 1,
          oy: 13,
          oz: gz,
          sx: 1,
          sy: 1,
          sz: 1,
          ry: 0,
          rz: 0,
          albedo: metal(look),
          accent: null,
          material: 'metal',
        });
        // Net loop at the off hand.
        const offX = Math.cos(look.offHandAngle) * (look.offHandDist + 4);
        const offZ = Math.sin(look.offHandAngle) * (look.offHandDist + 4);
        out.push({
          kind: 'net',
          geo: { kind: 'torus', params: torusKey(3, 12) },
          ox: offX,
          oy: 10,
          oz: offZ,
          sx: 1,
          sy: 1,
          sz: 1,
          ry: 0,
          rz: 0,
          albedo: leather(look),
          accent: null,
          material: 'leather',
          hand: 'off',
        });
        break;
      }
      case 'spear': {
        const gx = grip.x;
        const gz = grip.z;
        const shaftLen = f.totalLength - f.bladeLength - 3;
        out.push({
          kind: 'spear',
          geo: {
            kind: 'frustum',
            params: frustumKey(0.9, f.gripOffset, 0.9, 1.1, 1.1),
          },
          ox: gx + f.gripOffset * 0.5,
          oy: 13,
          oz: gz,
          sx: 1,
          sy: 1,
          sz: 1,
          ry: 0,
          rz: H,
          albedo: leather(look),
          accent: null,
          material: 'leather',
        });
        out.push({
          kind: 'spear',
          geo: { kind: 'frustum', params: frustumKey(1.1, shaftLen, 1.1, 1.1, 1.1) },
          ox: gx + f.gripOffset + shaftLen * 0.5,
          oy: 13,
          oz: gz,
          sx: 1,
          sy: 1,
          sz: 1,
          ry: 0,
          rz: H,
          albedo: materialOf(f) === 'wood' ? hexRgb('#6a4a30') : metal(look),
          accent: null,
          material: 'wood',
        });
        out.push({
          kind: 'spear',
          geo: { kind: 'frustum', params: frustumKey(1.6, f.bladeLength, 1.6, 0.2, 0.2) },
          ox: gx + f.gripOffset + shaftLen + f.bladeLength * 0.5,
          oy: 13,
          oz: gz,
          sx: 1,
          sy: 1,
          sz: 1,
          ry: 0,
          rz: H,
          albedo: metal(look),
          accent: null,
          material: 'metal',
        });
        break;
      }
      case 'scissor': {
        // Tube arm straight along +X, crescent blade at the far end.
        out.push({
          kind: 'scissor',
          geo: { kind: 'frustum', params: frustumKey(3.2, f.gripOffset + 6, 3.2, 2.6, 2.6) },
          ox: grip.x + (f.gripOffset + 6) * 0.5,
          oy: 13,
          oz: grip.z,
          sx: 1,
          sy: 1,
          sz: 1,
          ry: 0,
          rz: H,
          albedo: metal(look),
          accent: null,
          material: 'metal',
        });
        out.push({
          kind: 'scissor',
          geo: {
            kind: 'bent',
            params: bentKey(f.bladeLength, f.bladeWidth, f.bladeThickness, f.curvature),
          },
          ox: grip.x + f.gripOffset + 6 + f.bladeLength * 0.45,
          oy: 13,
          oz: grip.z,
          sx: 1,
          sy: 1,
          sz: 1,
          ry: 0,
          rz: H,
          albedo: metal(look),
          accent: null,
          material: 'metal',
        });
        break;
      }
    }
  }

  const addGreaves = (f: PartShape | null): void => {
    if (!f || f.slot !== 'greaves' || f.coverage <= 0) return;
    const heavy = f.coverage > 0.8;
    const len = heavy ? 10 : 7;
    const thick = heavy ? 5.5 : 4.5;
    for (const side of [1, -1] as const) {
      out.push({
        kind: 'greaves',
        geo: { kind: 'frustum', params: frustumKey(thick, len, thick, thick * 0.6, thick * 0.6) },
        ox: 2,
        oy: 3.5 + len * 0.5,
        oz: side * 4,
        sx: 1,
        sy: 1,
        sz: 1,
        ry: 0,
        rz: 0,
        albedo: metal(look),
        accent: null,
        material: materialOf(f),
      });
    }
  }

  const addManica = (f: PartShape | null): void => {
    if (!f || f.slot !== 'manica' || f.coverage <= 0) return;
    const armX = Math.cos(look.mainHandAngle) * look.mainHandDist * 0.35;
    const armZ = Math.sin(look.mainHandAngle) * look.mainHandDist * 0.35 + 5;
    out.push({
      kind: 'manica',
      geo: { kind: 'frustum', params: frustumKey(4.5, 11, 5.5, 3.6, 4.2) },
      ox: armX,
      oy: 14,
      oz: armZ,
      sx: 1,
      sy: 1,
      sz: 1,
      ry: 0,
      rz: 0,
      albedo: materialOf(f) === 'metal' ? metal(look) : leather(look),
      accent: null,
      material: materialOf(f),
    });
  }

  addHelm(shapeForPart(f.parts.find((id) => KIT_PARTS[id]?.slot === 'helm')) as HelmShape | null);
  addShield(
    shapeForPart(f.parts.find((id) => KIT_PARTS[id]?.slot === 'shield')) as ShieldShape | null,
  );
  addWeapon(
    shapeForPart(f.parts.find((id) => KIT_PARTS[id]?.slot === 'weapon')) as WeaponShape | null,
  );
  addGreaves(shapeForPart(f.parts.find((id) => KIT_PARTS[id]?.slot === 'greaves')));
  addManica(shapeForPart(f.parts.find((id) => KIT_PARTS[id]?.slot === 'manica')));

  // Breastplate — provocator's chest armour, ON the torso's front surface
  // (bodyR is the full X extent; the surface sits at bodyR/2).
  if (f.parts.some((id) => KIT_PARTS[id]?.tags.includes('breastplate'))) {
    out.push({
      kind: 'breastplate',
      geo: { kind: 'frustum', params: frustumKey(2.6, 10, 8, 3.5, 11) },
      ox: bodyR * 0.55,
      oy: 17,
      oz: 0,
      sx: 1,
      sy: 1,
      sz: 1,
      ry: 0,
      rz: 0,
      albedo: metal(look),
      accent: null,
      material: 'metal',
    });
  }

  return cacheKit(key, out);
}

/** Hash of draw-relevant appearance params (for tests). */
export function appearanceHash(f: FighterDraw): number {
  const parts = kitPartsForFighter(f);
  let h = f.appearanceSeed >>> 0;
  for (const p of parts) {
    h = (Math.imul(h ^ Math.floor(p.sx * 100), 16777619) >>> 0);
    h = (Math.imul(h ^ Math.floor(p.albedo[0] * 1000), 16777619) >>> 0);
    h = (Math.imul(h ^ p.geo.params.length, 16777619) >>> 0);
  }
  h = (Math.imul(h ^ f.parts.length, 16777619) >>> 0);
  return h >>> 0;
}
