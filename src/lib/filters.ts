/**
 * Canvas 2D filter-string builder shared by the live renderer and the
 * exporter so preview and export always match pixel-for-pixel.
 */
import type { Adjustments } from '../types';
import { clamp } from '../utils/helpers';

export function buildFilterString(a: Adjustments): string {
  const parts: string[] = [];
  if (a.brightness !== 1) parts.push("brightness(" + clamp(a.brightness, 0, 3) + ")");
  if (a.contrast !== 1) parts.push("contrast(" + clamp(a.contrast, 0, 3) + ")");
  if (a.saturation !== 1) parts.push("saturate(" + clamp(a.saturation, 0, 3) + ")");
  if (a.hue !== 0) parts.push("hue-rotate(" + clamp(a.hue, -180, 180) + "deg)");
  if (a.blur > 0) parts.push("blur(" + clamp(a.blur, 0, 50) + "px)");
  if (a.sepia > 0) parts.push("sepia(" + clamp(a.sepia, 0, 1) + ")");
  if (a.grayscale > 0) parts.push("grayscale(" + clamp(a.grayscale, 0, 1) + ")");
  if (a.invert > 0) parts.push("invert(" + clamp(a.invert, 0, 1) + ")");
  return parts.length > 0 ? parts.join(" ") : "none";
}

export function isFilterNeutral(a: Adjustments): boolean {
  return (
    a.brightness === 1 &&
    a.contrast === 1 &&
    a.saturation === 1 &&
    a.hue === 0 &&
    a.blur === 0 &&
    a.sepia === 0 &&
    a.grayscale === 0 &&
    a.invert === 0
  );
}

export interface FilterPreset {
  id: string;
  name: string;
  adjustments: Adjustments;
}

function preset(id: string, name: string, brightness: number, contrast: number, saturation: number, hue: number, blur: number, sepia: number, grayscale: number, invert: number): FilterPreset {
  return { id, name, adjustments: { brightness, contrast, saturation, hue, blur, sepia, grayscale, invert } };
}

export const FILTER_PRESETS: FilterPreset[] = [
  preset('none', 'Original', 1, 1, 1, 0, 0, 0, 0, 0),
  preset('mono', 'Mono', 1.05, 1.15, 0, 0, 0, 0, 1, 0),
  preset('noir', 'Noir', 0.95, 1.45, 0, 0, 0, 0, 1, 0),
  preset('sepia', 'Sepia', 1.02, 1.05, 0.7, 0, 0, 0.85, 0, 0),
  preset('vivid', 'Vivid', 1.05, 1.2, 1.5, 0, 0, 0, 0, 0),
  preset('fade', 'Fade', 1.1, 0.82, 0.8, 0, 0, 0.15, 0, 0),
  preset('cool', 'Cool', 1, 1.05, 1.1, 12, 0, 0, 0, 0),
  preset('warm', 'Warm', 1.02, 1, 1.15, -14, 0, 0.2, 0, 0),
  preset('dream', 'Dream', 1.08, 0.95, 1.15, 0, 1.2, 0, 0, 0),
  preset('invert', 'Invert', 1, 1, 1, 0, 0, 0, 0, 1),
];
