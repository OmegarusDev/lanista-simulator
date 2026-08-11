/**
 * Facade — procedural materials now live in gfx/.
 * Keep this path so existing view imports stay stable.
 */
export {
  materialCacheTag,
  gfxQuality,
  tesseraSize,
  mosaicFill,
  woodFill,
  stoneFill,
  sandFill,
  fleshFill,
  leatherFill,
  metalFill,
  bronzeStroke,
  roundPath,
  paintCenterRing,
  mosaicPalettes,
  type Quality,
} from '../gfx/material';
