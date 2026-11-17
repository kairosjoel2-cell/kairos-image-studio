/**
 * KAIROS Image Studio — core document model.
 * A document is a plain-serializable object graph (no pixels) so it can be
 * persisted to IndexedDB and snapshotted for undo/redo. Image pixels live in
 * a separate asset store referenced by `assetId`.
 */

export type LayerType = 'image' | 'text' | 'shape';

export type BlendMode =
  | 'normal'
  | 'multiply'
  | 'screen'
  | 'overlay'
  | 'darken'
  | 'lighten'
  | 'color-dodge'
  | 'color-burn'
  | 'hard-light'
  | 'soft-light'
  | 'difference'
  | 'exclusion'
  | 'hue'
  | 'saturation'
  | 'color'
  | 'luminosity';

export const BLEND_MODES: BlendMode[] = [
  'normal', 'multiply', 'screen', 'overlay', 'darken', 'lighten',
  'color-dodge', 'color-burn', 'hard-light', 'soft-light',
  'difference', 'exclusion', 'hue', 'saturation', 'color', 'luminosity',
];

/** Per-image pixel adjustments (all normalized ranges). */
export interface Adjustments {
  brightness: number; // 0..2   (1 = neutral)
  contrast: number;   // 0..2   (1 = neutral)
  saturation: number; // 0..2   (1 = neutral)
  hue: number;        // -180..180 degrees
  blur: number;       // 0..20 px
  sepia: number;      // 0..1
  grayscale: number;  // 0..1
  invert: number;     // 0..1
}

export const NEUTRAL_ADJUSTMENTS: Adjustments = {
  brightness: 1, contrast: 1, saturation: 1,
  hue: 0, blur: 0, sepia: 0, grayscale: 0, invert: 0,
};

export interface ShadowStyle {
  enabled: boolean;
  color: string;
  blur: number;    // px
  offsetX: number; // px
  offsetY: number; // px
}

export interface GradientFill {
  enabled: boolean;
  from: string;
  to: string;
  angle: number; // degrees; 0 = left→right
}

export type ShapeKind =
  | 'rectangle' | 'ellipse' | 'triangle' | 'star' | 'line' | 'arrow';

export type TextCurve = none | { radius: number };
