/**
 * KAIROS Image Studio — core document model (v3, complete).
 *
 * A document is a plain-serializable object graph (no pixels) so it can be
 * persisted to IndexedDB and snapshotted for undo/redo. Image pixels live in a
 * separate asset store referenced by `assetId`.
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

export function isNeutralAdjustments(a: Adjustments): boolean {
  return a.brightness === 1 && a.contrast === 1 && a.saturation === 1 &&
    a.hue === 0 && a.blur === 0 && a.sepia === 0 && a.grayscale === 0 && a.invert === 0;
}

export interface ShadowStyle {
  enabled: boolean;
  color: string;
  blur: number;    // px
  offsetX: number; // px
  offsetY: number; // px
}

export interface StrokeStyle {
  enabled: boolean;
  color: string;
  width: number; // px
}

export interface GradientFill {
  enabled: boolean;
  from: string;
  to: string;
  angle: number; // degrees; 0 = left-to-right
}

export type ShapeKind =
  | 'rectangle' | 'ellipse' | 'triangle' | 'star' | 'line' | 'arrow';

/** Crop rect in source-image pixel space. */
export interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ImageLayerData {
  type: 'image';
  assetId: string;
  /** Natural pixel size of the FULL source asset (pre-crop). */
  naturalWidth: number;
  naturalHeight: number;
  /** Visible source region in asset pixel space. */
  crop: CropRect;
  /** Optional grayscale mask asset id (luminance to alpha). */
  maskAssetId?: string | null;
  maskInvert?: boolean;
  adjustments: Adjustments;
}

export interface TextLayerData {
  type: 'text';
  text: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  italic: boolean;
  underline: boolean;
  align: 'left' | 'center' | 'right';
  lineHeight: number;    // multiplier
  letterSpacing: number; // px
  fill: string;
  gradient: GradientFill | null;
  stroke: StrokeStyle | null;
  shadow: ShadowStyle | null;
  /** Curved text: radius in px; null = straight. */
  curve: { radius: number } | null;
  /** Uppercase transform. */
  uppercase: boolean;
}

export interface ShapeLayerData {
  type: 'shape';
  shape: ShapeKind;
  fill: string;
  gradient: GradientFill | null;
  stroke: StrokeStyle | null;
  cornerRadius: number; // rectangle only
  points: number;       // star only (3..12)
  shadow: ShadowStyle | null;
}

export interface LayerBase {
  id: string;
  name: string;
  /** Frame in canvas coordinates (top-left origin, unrotated). */
  x: number;
  y: number;
  width: number;
  height: number;
  /** Degrees, clockwise. */
  rotation: number;
  opacity: number; // 0..1
  visible: boolean;
  locked: boolean;
  blendMode: BlendMode;
  flipX: boolean;
  flipY: boolean;
}

export type Layer = LayerBase & (ImageLayerData | TextLayerData | ShapeLayerData);

export interface PageBackground {
  color: string;
  gradient: GradientFill | null;
  imageAssetId: string | null;
  imageMode: 'cover' | 'contain' | 'tile';
  adjustments: Adjustments | null;
}

export interface DocumentState {
  id: string;
  name: string;
  width: number;
  height: number;
  background: PageBackground;
  /** Ordered bottom to top. */
  layers: Layer[];
  createdAt: number;
  updatedAt: number;
}

export interface ProjectMeta {
  id: string;
  name: string;
  width: number;
  height: number;
  layerCount: number;
  createdAt: number;
  updatedAt: number;
}

export interface ProjectRecord {
  meta: ProjectMeta;
  doc: DocumentState;
  thumb: Blob | null;
}
