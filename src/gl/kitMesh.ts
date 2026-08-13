/**
 * Procedural kit part dimensions from part tags — geometry identity, not stickers.
 */
import { KIT_PARTS, type KitPartId } from '../content/kitPieces';
import { ARMATURA_LOOK } from '../content/appearance';
import type { ArmaturaId } from '../content/armatura';
import type { FighterDraw } from './drawModel';

export type PartMeshKind =
  | 'body'
  | 'helm'
  | 'crest'
  | 'shield'
  | 'roundShield'
  | 'blade'
  | 'curvedBlade'
  | 'trident'
  | 'net'
  | 'spear'
  | 'dualBlade'
  | 'scissor'
  | 'beastBody'
  | 'greaves'
  | 'manica';

export interface KitPartDraw {
  kind: PartMeshKind;
  /** Local offset (forward X, up Y, right Z) before facing yaw. */
  ox: number;
  oy: number;
  oz: number;
  sx: number;
  sy: number;
  sz: number;
  albedo: [number, number, number];
}

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

function tagsOf(parts: readonly KitPartId[]): Set<string> {
  const s = new Set<string>();
  for (const id of parts) {
    const p = KIT_PARTS[id];
    if (!p) continue;
    for (const t of p.tags) s.add(t);
  }
  return s;
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

export function kitPartsForFighter(f: FighterDraw): KitPartDraw[] {
  const key = kitIdentityKey(f);
  const hit = KIT_CACHE.get(key);
  if (hit) return hit;

  if (f.kind === 'beast') {
    // Beast silhouettes — bulk + snout/shoulder read by beastId hash
    const seed = (f.beastId ?? 'beast').length + f.appearanceSeed;
    const bulk = 1 + ((seed % 13) / 13 - 0.5) * 0.18;
    const snout = 6 + (seed % 5);
    return cacheKit(key, [
      {
        kind: 'beastBody',
        ox: 0,
        oy: 10 * bulk,
        oz: 0,
        sx: 22 * bulk,
        sy: 18 * bulk,
        sz: 20 * bulk,
        albedo: [0.42 + ((seed % 7) / 70), 0.3, 0.2],
      },
      {
        kind: 'beastBody',
        ox: 12,
        oy: 9 * bulk,
        oz: 0,
        sx: snout,
        sy: 8 * bulk,
        sz: 8,
        albedo: [0.38, 0.28, 0.18],
      },
    ]);
  }

  const look = ARMATURA_LOOK[f.armatura as ArmaturaId] ?? ARMATURA_LOOK.MURMILLO;
  const tags = tagsOf(f.parts);
  const flesh = hueShift(hexRgb(look.bodyFill), f.appearanceSeed);
  const metal = hexRgb(look.metal);
  const leather = hexRgb(look.leather);
  const bulk = 1 + ((f.appearanceSeed % 17) / 17 - 0.5) * 0.12;

  // Body mass is a Y-cylinder in sceneFighters; keep XZ near-circular for round silhouette.
  const bodyR = ((look.bodyRx + look.bodyRy) * 0.5) * 1.55 * bulk;
  const out: KitPartDraw[] = [
    {
      kind: 'body',
      ox: 0,
      oy: 11 * bulk,
      oz: 0,
      sx: bodyR,
      sy: 22 * bulk,
      sz: bodyR * (0.92 + ((f.appearanceSeed % 11) / 11) * 0.12),
      albedo: flesh,
    },
  ];

  if (tags.has('bareHead')) {
    out.push({
      kind: 'helm',
      ox: 0,
      oy: 24 * bulk,
      oz: 0,
      sx: 9,
      sy: 9,
      sz: 9,
      albedo: flesh,
    });
  } else {
    const helm = tags.has('smoothHelm') ? 11 : 12;
    out.push({
      kind: 'helm',
      ox: 0,
      oy: 24 * bulk,
      oz: 0,
      sx: helm,
      sy: helm * 0.95,
      sz: helm,
      albedo: metal,
    });
    if (tags.has('crest')) {
      out.push({
        kind: 'crest',
        ox: 0,
        oy: 32 * bulk,
        oz: 0,
        sx: 3,
        sy: 10,
        sz: 14,
        albedo: hexRgb(look.cloth),
      });
    }
  }

  if (tags.has('shield') || tags.has('roundShield')) {
    const round = tags.has('roundShield');
    out.push({
      kind: round ? 'roundShield' : 'shield',
      ox: Math.cos(look.offHandAngle) * look.offHandDist,
      oy: 12,
      oz: Math.sin(look.offHandAngle) * look.offHandDist,
      // Thin ellipsoid disks — round vs tall oval still readable.
      sx: round ? 3.5 : 4.5,
      sy: round ? 15 : 20,
      sz: round ? 15 : 13,
      albedo: metal,
    });
  }

  const mainOx = Math.cos(look.mainHandAngle) * look.mainHandDist;
  const mainOz = Math.sin(look.mainHandAngle) * look.mainHandDist;
  if (tags.has('trident')) {
    out.push({
      kind: 'trident',
      ox: mainOx + 10,
      oy: 14,
      oz: mainOz,
      sx: 28,
      sy: 3,
      sz: 8,
      albedo: metal,
    });
  } else if (tags.has('spear')) {
    out.push({
      kind: 'spear',
      ox: mainOx + 14,
      oy: 14,
      oz: mainOz,
      sx: 34,
      sy: 2.5,
      sz: 2.5,
      albedo: metal,
    });
  } else if (tags.has('curvedBlade')) {
    out.push({
      kind: 'curvedBlade',
      ox: mainOx + 8,
      oy: 13,
      oz: mainOz,
      sx: 18,
      sy: 3,
      sz: 6,
      albedo: metal,
    });
  } else if (tags.has('dualBlade')) {
    out.push({
      kind: 'dualBlade',
      ox: mainOx + 7,
      oy: 13,
      oz: mainOz,
      sx: 16,
      sy: 2.5,
      sz: 3,
      albedo: metal,
    });
    out.push({
      kind: 'dualBlade',
      ox: -mainOx + 7,
      oy: 13,
      oz: -mainOz,
      sx: 16,
      sy: 2.5,
      sz: 3,
      albedo: metal,
    });
  } else if (tags.has('scissorArm')) {
    out.push({
      kind: 'scissor',
      ox: mainOx + 6,
      oy: 12,
      oz: mainOz,
      sx: 20,
      sy: 4,
      sz: 10,
      albedo: metal,
    });
  } else {
    out.push({
      kind: 'blade',
      ox: mainOx + 8,
      oy: 13,
      oz: mainOz,
      sx: 16,
      sy: 2.5,
      sz: 3,
      albedo: metal,
    });
  }

  if (tags.has('net')) {
    out.push({
      kind: 'net',
      ox: Math.cos(look.offHandAngle) * (look.offHandDist + 4),
      oy: 10,
      oz: Math.sin(look.offHandAngle) * (look.offHandDist + 4),
      sx: 14,
      sy: 4,
      sz: 14,
      albedo: leather,
    });
  }

  // Greaves / manica — kit identity on the sand (was tag-only combat before)
  if (tags.has('greaves')) {
    const heavy = f.parts.some((id) => id.includes('heavy') || id.includes('hop'));
    out.push({
      kind: 'greaves',
      ox: 2,
      oy: 3.5,
      oz: 4,
      sx: heavy ? 5.5 : 4.5,
      sy: heavy ? 9 : 7,
      sz: heavy ? 5.5 : 4.5,
      albedo: metal,
    });
    out.push({
      kind: 'greaves',
      ox: 2,
      oy: 3.5,
      oz: -4,
      sx: heavy ? 5.5 : 4.5,
      sy: heavy ? 9 : 7,
      sz: heavy ? 5.5 : 4.5,
      albedo: metal,
    });
  }

  if (tags.has('manica') || f.parts.some((id) => KIT_PARTS[id]?.slot === 'manica')) {
    out.push({
      kind: 'manica',
      ox: mainOx * 0.35,
      oy: 14,
      oz: mainOz * 0.35 + 5,
      sx: 5,
      sy: 10,
      sz: 6,
      albedo: leather,
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
  }
  h = (Math.imul(h ^ f.parts.length, 16777619) >>> 0);
  return h >>> 0;
}
