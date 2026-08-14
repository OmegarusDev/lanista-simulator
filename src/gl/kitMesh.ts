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
import {
  aimAngles,
  beastDims,
  beastRest,
  poseHuman,
  type Vec3,
} from './anatomy';

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
  /** Which side of the body a limb sits on — anatomy pose override. */
  side?: 1 | -1;
}

export type PartMeshKind =
  | 'body'
  | 'hips'
  | 'neck'
  | 'head'
  | 'armUpper'
  | 'armLower'
  | 'hand'
  | 'legUpper'
  | 'legLower'
  | 'foot'
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
  | 'beastBody'
  | 'quadNeck'
  | 'quadHead'
  | 'quadTail'
  | 'quadLegUpper'
  | 'quadLegLower'
  | 'quadPaw'
  | 'mane'
  | 'tusk'
  | 'ear'
  | 'spot'
  | 'tailTuft';

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

/** Aim angles that rotate a segment's +Y axis onto the bone's direction. */
function aimBone(bone: { from: Vec3; to: Vec3; thick: number }): { ry: number; rz: number } {
  return aimAngles({
    x: bone.to.x - bone.from.x,
    y: bone.to.y - bone.from.y,
    z: bone.to.z - bone.from.z,
  });
}

export function kitPartsForFighter(f: FighterDraw): KitPartDraw[] {
  const key = kitIdentityKey(f);
  const hit = KIT_CACHE.get(key);
  if (hit) return hit;

  if (f.kind === 'beast') {
    // The BeastShape plan: every family is a real quadruped skeleton —
    // torso, neck, head, tail, four legs, plus family parts.
    const beastId = (f.beastId ?? 'LION') as 'LION' | 'LEOPARD' | 'BEAR' | 'BOAR';
    const seed = beastId.length + f.appearanceSeed;
    const bulk = beastBulk(beastId, f.appearanceSeed);
    const dims = beastDims(beastId, bulk);
    const rest = beastRest(beastId, bulk);
    const pelt: [number, number, number] = [0.42 + ((seed % 7) / 70), 0.3, 0.2];
    const dark: [number, number, number] = [pelt[0] * 0.5, pelt[1] * 0.45, pelt[2] * 0.4];
    const ivory: [number, number, number] = [0.9, 0.86, 0.74];
    const tuft: [number, number, number] = [pelt[0] * 0.7, pelt[1] * 0.6, pelt[2] * 0.45];

    const out: KitPartDraw[] = [];

    const bonePart = (
      kind: PartMeshKind,
      bone: { from: Vec3; to: Vec3; thick: number },
      albedo: [number, number, number],
      material: KitPartDraw['material'],
      side?: 1 | -1,
    ): void => {
      const a = aimBone(bone);
      out.push({
        kind,
        geo: { kind: 'frustum', params: frustumKey(0.5, 1, 0.5, 0.85, 0.85) },
        ox: (bone.from.x + bone.to.x) / 2,
        oy: (bone.from.y + bone.to.y) / 2,
        oz: (bone.from.z + bone.to.z) / 2,
        sx: bone.thick * 0.5,
        sy: Math.hypot(bone.to.x - bone.from.x, bone.to.y - bone.from.y, bone.to.z - bone.from.z),
        sz: bone.thick * 0.5,
        ry: a.ry,
        rz: a.rz,
        albedo,
        accent: null,
        material,
        side,
      });
    };

    bonePart('beastBody', rest.torso, pelt, 'leather');
    bonePart('quadNeck', rest.neck, pelt, 'leather');
    out.push({
      kind: 'quadHead',
      geo: { kind: 'sph', params: '' },
      ox: rest.head.x,
      oy: rest.head.y,
      oz: rest.head.z,
      sx: dims.headSize * 0.62,
      sy: dims.headSize * 0.62,
      sz: dims.headSize * 0.62,
      ry: 0,
      rz: 0,
      albedo: pelt,
      accent: null,
      material: 'leather',
    });
    bonePart('quadTail', rest.tail, pelt, 'leather');
    for (const leg of rest.legs) {
      bonePart('quadLegUpper', leg.upper, pelt, 'leather', leg.side);
      bonePart('quadLegLower', leg.lower, pelt, 'leather', leg.side);
      out.push({
        kind: 'quadPaw',
        geo: { kind: 'box', params: '' },
        ox: leg.end.x,
        oy: leg.end.y,
        oz: leg.end.z,
        sx: 2.4 * bulk,
        sy: 1.3 * bulk,
        sz: 2.8 * bulk,
        ry: 0,
        rz: 0,
        albedo: pelt,
        accent: null,
        material: 'leather',
        side: leg.side,
      });
    }

    // Family parts — the mane, the tusks, the ears, the spots, the tail tuft.
    const head = rest.head;
    const hs = dims.headSize;
    if (beastId === 'LION') {
      for (let i = 0; i < 10; i++) {
        out.push({
          kind: 'mane',
          geo: { kind: 'frustum', params: frustumKey(0.4, 1, 0.4, 0.12, 0.12) },
          ox: 0,
          oy: 0,
          oz: i, // scene reads the ring index from oz
          sx: hs * 0.7,
          sy: hs * 1.5,
          sz: hs * 0.7,
          ry: 0,
          rz: 0,
          albedo: dark,
          accent: null,
          material: 'leather',
        });
      }
      out.push({
        kind: 'tailTuft',
        geo: { kind: 'sph', params: '' },
        ox: rest.tail.to.x,
        oy: rest.tail.to.y,
        oz: rest.tail.to.z,
        sx: 1.6 * bulk,
        sy: 2 * bulk,
        sz: 1.6 * bulk,
        ry: 0,
        rz: 0,
        albedo: tuft,
        accent: null,
        material: 'leather',
      });
    } else if (beastId === 'LEOPARD') {
      // Spots along the torso's flank.
      for (let i = 0; i < 6; i++) {
        const fx = -dims.bodyL * 0.2 + (i % 3) * 0.18 * dims.bodyL;
        const fz = (i < 3 ? 1 : -1) * dims.bodyW * 0.34;
        out.push({
          kind: 'spot',
          geo: { kind: 'sph', params: '' },
          ox: fx,
          oy: dims.bodyH * 0.72,
          oz: fz,
          sx: 2.2 * bulk,
          sy: 2.2 * bulk,
          sz: 2.2 * bulk,
          ry: 0,
          rz: 0,
          albedo: dark,
          accent: null,
          material: 'leather',
        });
      }
      out.push({
        kind: 'tailTuft',
        geo: { kind: 'sph', params: '' },
        ox: rest.tail.to.x,
        oy: rest.tail.to.y,
        oz: rest.tail.to.z,
        sx: 1.4 * bulk,
        sy: 1.8 * bulk,
        sz: 1.4 * bulk,
        ry: 0,
        rz: 0,
        albedo: dark,
        accent: null,
        material: 'leather',
      });
    } else if (beastId === 'BEAR') {
      for (const side of [1, -1] as const) {
        out.push({
          kind: 'ear',
          geo: { kind: 'sph', params: '' },
          ox: head.x + 0.3 * hs,
          oy: head.y + 0.5 * hs,
          oz: side * 0.62 * hs,
          sx: 1.6 * bulk,
          sy: 1.6 * bulk,
          sz: 1.6 * bulk,
          ry: 0,
          rz: 0,
          albedo: pelt,
          accent: null,
          material: 'leather',
        });
      }
    } else {
      // BOAR — tusks and a bristle ridge.
      for (const side of [1, -1] as const) {
        out.push({
          kind: 'tusk',
          geo: { kind: 'frustum', params: frustumKey(0.35, 1, 0.35, 0.1, 0.1) },
          ox: head.x + 0.55 * hs,
          oy: head.y - 0.15 * hs,
          oz: side * 0.42 * hs,
          sx: hs * 0.42,
          sy: hs * 1.2,
          sz: hs * 0.42,
          ry: 0,
          rz: 90,
          albedo: ivory,
          accent: null,
          material: 'bone',
        });
      }
      for (let i = 0; i < 4; i++) {
        out.push({
          kind: 'ear',
          geo: { kind: 'frustum', params: frustumKey(0.5, 1, 0.5, 0.2, 0.2) },
          ox: -dims.bodyL * 0.15 + i * 0.17 * dims.bodyL,
          oy: dims.bodyH * 0.98,
          oz: 0,
          sx: 0.9 * bulk,
          sy: 2 * bulk,
          sz: 0.9 * bulk,
          ry: 0,
          rz: 0,
          albedo: pelt,
          accent: null,
          material: 'leather',
        });
      }
    }
    return cacheKit(key, out);
  }

  const look = ARMATURA_LOOK[f.armatura as ArmaturaId] ?? ARMATURA_LOOK.MURMILLO;
  const flesh = hueShift(hexRgb(look.bodyFill), f.appearanceSeed);
  const bulk = bodyBulk(f.appearanceSeed);
  const bodyR = ((look.bodyRx + look.bodyRy) * 0.5) * 1.55 * bulk;

  // The skeleton — the same numbers the scene poses live. Emitted at rest.
  const mainGrip = {
    x: Math.cos(look.mainHandAngle) * look.mainHandDist,
    y: 13,
    z: Math.sin(look.mainHandAngle) * look.mainHandDist,
  };
  const offGrip = {
    x: Math.cos(look.offHandAngle) * look.offHandDist,
    y: 12,
    z: Math.sin(look.offHandAngle) * look.offHandDist,
  };
  const rest = poseHuman({
    bulk,
    stepPhase: 0,
    speed: 0,
    guard: 0,
    mainGrip,
    offGrip,
  });
  const restHips = rest.hips;

  const out: KitPartDraw[] = [
    // Pelvis — the body's anchor.
    {
      kind: 'hips',
      geo: { kind: 'frustum', params: frustumKey(0.5, 1, 0.5, 0.8, 0.8) },
      ox: 0,
      oy: restHips.y,
      oz: 0,
      sx: 5 * bulk,
      sy: 2.4 * bulk,
      sz: 5 * bulk,
      ry: 0,
      rz: 0,
      albedo: flesh,
      accent: null,
      material: 'flesh',
    },
    {
      kind: 'body',
      geo: { kind: 'frustum', params: frustumKey(0.5, 1, 0.5, 0.8, 0.8) },
      ox: (rest.torso.from.x + rest.torso.to.x) / 2,
      oy: (rest.torso.from.y + rest.torso.to.y) / 2,
      oz: 0,
      sx: rest.torso.thick * 0.5,
      sy: rest.torso.to.y - rest.torso.from.y,
      sz: rest.torso.thick * 0.5,
      ry: aimBone(rest.torso).ry,
      rz: aimBone(rest.torso).rz,
      albedo: flesh,
      accent: null,
      material: 'flesh',
    },
    {
      kind: 'neck',
      geo: { kind: 'frustum', params: frustumKey(0.5, 1, 0.5, 0.6, 0.6) },
      ox: (rest.neck.from.x + rest.neck.to.x) / 2,
      oy: (rest.neck.from.y + rest.neck.to.y) / 2,
      oz: 0,
      sx: rest.neck.thick * 0.5,
      sy: rest.neck.to.y - rest.neck.from.y,
      sz: rest.neck.thick * 0.5,
      ry: 0,
      rz: 0,
      albedo: flesh,
      accent: null,
      material: 'flesh',
    },
    {
      kind: 'head',
      geo: { kind: 'sph', params: '' },
      ox: rest.head.x,
      oy: rest.head.y,
      oz: rest.head.z,
      sx: 3.2 * bulk,
      sy: 3.2 * bulk,
      sz: 3.2 * bulk,
      ry: 0,
      rz: 0,
      albedo: flesh,
      accent: null,
      material: 'flesh',
    },
  ];

  // Legs: upper + lower + foot, posed around the fighting stance.
  for (const leg of rest.legs) {
    out.push({
      kind: 'legUpper',
      geo: { kind: 'frustum', params: frustumKey(0.5, 1, 0.5, 0.8, 0.8) },
      ox: (leg.upper.from.x + leg.upper.to.x) / 2,
      oy: (leg.upper.from.y + leg.upper.to.y) / 2,
      oz: (leg.upper.from.z + leg.upper.to.z) / 2,
      sx: leg.upper.thick * 0.5,
      sy: leg.upper.to.y - leg.upper.from.y,
      sz: leg.upper.thick * 0.5,
      ry: aimBone(leg.upper).ry,
      rz: aimBone(leg.upper).rz,
      albedo: flesh,
      accent: null,
      material: 'flesh',
      side: leg.side,
    });
    out.push({
      kind: 'legLower',
      geo: { kind: 'frustum', params: frustumKey(0.5, 1, 0.5, 0.7, 0.7) },
      ox: (leg.lower.from.x + leg.lower.to.x) / 2,
      oy: (leg.lower.from.y + leg.lower.to.y) / 2,
      oz: (leg.lower.from.z + leg.lower.to.z) / 2,
      sx: leg.lower.thick * 0.5,
      sy: leg.lower.to.y - leg.lower.from.y,
      sz: leg.lower.thick * 0.5,
      ry: aimBone(leg.lower).ry,
      rz: aimBone(leg.lower).rz,
      albedo: flesh,
      accent: null,
      material: 'flesh',
      side: leg.side,
    });
    out.push({
      kind: 'foot',
      geo: { kind: 'box', params: '' },
      ox: leg.end.x + 1.4 * bulk,
      oy: leg.end.y,
      oz: leg.end.z,
      sx: 3.4 * bulk,
      sy: 1.4 * bulk,
      sz: 2.6 * bulk,
      ry: 0,
      rz: 0,
      albedo: leather(look),
      accent: null,
      material: 'leather',
      side: leg.side,
    });
  }

  // Arms: upper + lower, hands at the grips (drawn after the weapons).
  for (const arm of rest.arms) {
    out.push({
      kind: 'armUpper',
      geo: { kind: 'frustum', params: frustumKey(0.5, 1, 0.5, 0.8, 0.8) },
      ox: (arm.upper.from.x + arm.upper.to.x) / 2,
      oy: (arm.upper.from.y + arm.upper.to.y) / 2,
      oz: (arm.upper.from.z + arm.upper.to.z) / 2,
      sx: arm.upper.thick * 0.5,
      sy: arm.upper.to.y - arm.upper.from.y,
      sz: arm.upper.thick * 0.5,
      ry: aimBone(arm.upper).ry,
      rz: aimBone(arm.upper).rz,
      albedo: flesh,
      accent: null,
      material: 'flesh',
      side: arm.side,
    });
    out.push({
      kind: 'armLower',
      geo: { kind: 'frustum', params: frustumKey(0.5, 1, 0.5, 0.7, 0.7) },
      ox: (arm.lower.from.x + arm.lower.to.x) / 2,
      oy: (arm.lower.from.y + arm.lower.to.y) / 2,
      oz: (arm.lower.from.z + arm.lower.to.z) / 2,
      sx: arm.lower.thick * 0.5,
      sy: arm.lower.to.y - arm.lower.from.y,
      sz: arm.lower.thick * 0.5,
      ry: aimBone(arm.lower).ry,
      rz: aimBone(arm.lower).rz,
      albedo: flesh,
      accent: null,
      material: 'flesh',
      side: arm.side,
    });
  }
  // Hands last — they close over the grips.
  for (const arm of rest.arms) {
    out.push({
      kind: 'hand',
      geo: { kind: 'sph', params: '' },
      ox: arm.end.x,
      oy: arm.end.y,
      oz: arm.end.z,
      sx: 1.5 * bulk,
      sy: 1.5 * bulk,
      sz: 1.5 * bulk,
      ry: 0,
      rz: 0,
      albedo: flesh,
      accent: null,
      material: 'flesh',
      side: arm.side,
    });
  }

  const addHelm = (f: HelmShape | null): void => {
    const bare = !f || f.form === 'bare';
    if (bare) return; // the head part IS the head
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
