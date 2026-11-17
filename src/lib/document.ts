/**
 * Document factory: creates blank or template-based documents.
 */
import type { DocumentState, Layer, PageBackground } from '../types';
import { NEUTRAL_ADJUSTMENTS } from '../types';
import { uid } from '../utils/helpers';

export function defaultBackground(color: string): PageBackground {
  return {
    color,
    gradient: null,
    imageAssetId: null,
    imageMode: 'cover',
    adjustments: null,
  };
}

export function createDocument(
  name: string,
  width: number,
  height: number,
  bgColor = '#ffffff',
): DocumentState {
  const now = Date.now();
  return {
    id: uid('doc'),
    name,
    width,
    height,
    background: defaultBackground(bgColor),
    layers: [],
    createdAt: now,
    updatedAt: now,
  };
}

export function touch(doc: DocumentState): DocumentState {
  return { ...doc, updatedAt: Date.now() };
}

export function withLayers(doc: DocumentState, layers: Layer[]): DocumentState {
  return touch({ ...doc, layers });
}

export interface CanvasTemplate {
  id: string;
  name: string;
  width: size_placeholder;
  height: number;
  bg: string;
  group: string;
}

export const CANVAS_TEMPLATES: CanvasTemplate[] = [
  { id: 'square', name: 'Square post', width: 1080, height: 1080, bg: '#ffffff', group: 'Social' },
  { id: 'story', name: 'Story (9:16)', width: 1080, height: 1920, bg: '#111113', group: 'Social' },
  { id: 'portrait', name: 'Portrait post (4:5)', width: 1080, height: 1350, bg: '#ffffff', group: 'Social' },
  { id: 'youtube-thumb', name: 'YouTube thumbnail', width: 1280, height: 720, bg: '#0f1115', group: 'Social' },
  { id: 'a4', name: 'A4 document', width: 2480, height: 3508, bg: '#ffffff', group: 'Print' },
  { id: 'poster', name: 'Poster (A3)', width: 3508, height: 4961, bg: '#ffffff', group: 'Print' },
  { id: 'presentation', name: 'Slide 16:9', width: 1920, height: 1080, bg: '#101014', group: 'Business' },
  { id: 'cover', name: 'Facebook cover', width: 1640, height: 856, bg: '#14141a', group: 'Business' },
  { id: 'custom', name: 'Custom size', width: 1200, height: 900, bg: '#ffffff', group: 'Custom' },
];
