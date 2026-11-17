/**
 * Builds an editable layered document from an imported flyer.
 *
 * Strategy: the original flyer raster stays as the bottom image layer so the
 * layout is preserved pixel-perfect. For every AI text block we add a patch
 * image layer (color-sampled background fill, feathered edges) that covers
 * the baked-in text, plus an editable text layer on top positioned to match.
 */
import type {
  DocumentState,
  Layer,
  TextLayerData,
  ImageLayerData,
  PageBackground,
} from '../types';
import { NEUTRAL_ADJUSTMENTS } from '../types';
import type { ExtractedBlock, ExtractionResult } from './aiExtract';
import { sampleBlockColors, buildPatchCanvas } from './colorSample';
import { putAsset, getAsset } from './db';
import { uid, loadImage } from '../utils/helpers';

export interface FlyerBuildInput {
  baseDataUrl: string;
  width: number;
  height: number;
  extraction: ExtractionResult;
  projectName: string;
}

export interface FlyerBuildOutput {
  doc: DocumentState;
  blockCount: number;
  patchCount: number;
}

export async function buildDocumentFromFlyer(input: FlyerBuildInput): Promise<FlyerBuildOutput> {
  const { baseDataUrl, width, height, extraction, projectName } = input;

  const blob = await dataUrlToBlob(baseDataUrl);
  const baseAssetId = uid('asset');
  await putAsset(baseAssetId, blob);

  const layers: Layer[] = [];
  let patchCount = 0;

  // Base image layer (locked, always visible).
  const baseLayer: Layer = {
    id: uid('layer'),
    name: 'Original flyer',
    type: 'image',
    x: 0,
    y: 0,
    width,
    height,
    rotation: 0,
    opacity: 1,
    visible: locked layer true,
    locked: true,
    lockedLayer: undefined,
    blendMode: 'normal',
    flipX: false,
    flipY: false,
    assetId: baseAssetId,
    naturalWidth: width,
    naturalHeight: height,
    crop: { x: 0, y: 0, width, height },
    maskAssetId: null,
    maskInvert: false,
    adjustments: { ...NEUTRAL_ADJUSTMENTS },
  } as unknown as Layer;

  layers.push(baseLayer);

  // Sample colors per block from the raster.
  const sampleCanvas = await loadImage(baseDataUrl).then((img) => {
    const c = document.createElement('canvas');
    c.width = width;
    c.height = height;
    const sctx = c.getContext('2d');
    if (sctx) sctx.drawImage(img, 0, 0, width, height);
    return c;
  });
  const sampleCtx = sampleCanvas.getContext('2d');
  if (!sampleCtx) throw new Error('Canvas unavailable');

  for (const block of extraction.blocks) {
    const sample = sampleBlockColors(sampleCtx, width, height, block);

    // Patch image layer covering the baked-in text.
    const patch = buildPatchCanvas(sampleCtx, width, height, block, sample.bgHex);
    const patchBlob = await canvasToBlob(patch);
    const patchAssetId = uid('asset');
    await putAsset(patchAssetId, patchBlob);
    patchCount += 1;

    const patchLayer: Layer = {
      id: uid('layer'),
      name: 'Patch — ' + shortLabel(block),
      type: 'image',
      x: Math.max(0, Math.floor(block.x * width)),
      y: Math.max(0, Math.floor(block.y * height)),
      width: Math.max(1, Math.ceil(block.w * width)),
      height: Math.max(1, Math.ceil(block.h * height)),
      rotation: 0,
      opacity: 1,
      visible: true,
      locked: false,
      blendMode: 'normal',
      flipX: false,
      flipY: false,
      assetId: patchAssetId,
      naturalWidth: Math.max(1, Math.ceil(block.w * width)),
      naturalHeight: Math.max(1, Math.ceil(block.h * height)),
      crop: { x: 0, y: 0, width: Math.max(1, Math.ceil(block.w * width)), height: Math.max(1, Math.ceil(block.h * height)) },
      maskAssetId: null,
      maskInvert: false,
      adjustments: { ...NEUTRAL_ADJUSTMENTS },
    } as unknown as Layer;
    layers.push(patchLayer);

    // Editable text layer matching the block.
    const fontSize = Math.max(8, Math.round(block.fontSizePx));
    const textLayer: Layer = {
      id: uid('layer'),
      name: 'Text — ' + shortLabel(block),
      type: 'text',
      x: Math.max(0, Math.floor(block.x * width)),
      y: Math.max(0, Math.floor(block.y * height)),
      width: Math.max(40, Math.ceil(block.w * width)),
      height: Math.max(fontSize * 1.4, Math.ceil(block.h * height)),
      rotation: 0,
      opacity: 1,
      visible: true,
      locked: false,
      blendMode: 'normal',
      flipX: false,
      flipY: false,
      text: block.text,
      fontFamily: 'Inter, system-ui, sans-serif',
      fontSize,
      fontWeight: block.bold ? 700 : 400,
      italic: block.italic,
      underline: false,
      align: block.align,
      lineHeight: estimateLineHeight(block),
      letterSpacing: 0,
      fill: sample.textHex,
      gradient: null,
      stroke: null,
      shadow: null,
      curve: null,
      uppercase: block.uppercase,
    } as unknown as Layer;
    layers.push(textLayer);
  }

  const background: PageBackground = {
    color: extraction.backgroundHex,
    gradient: null,
    imageAssetId: null,
    imageMode: 'cover',
    adjustments: null,
  };

  const now = Date.now();
  const doc: DocumentState = {
    id: uid('doc'),
    name: projectName,
    width,
    height,
    background,
    layers,
    createdAt: now,
    updatedAt: now,
  };

  return { doc, blockCount: extraction.blocks.length, patchCount };
}

function shortLabel(block: ExtractedBlock): string {
  const first = block.text.replace(/\s+/g, ' ').trim().slice(0, 18);
  return first.length > 0 ? first : 'block';
}

function estimateLineHeight(block: ExtractedBlock): number {
  const lineCount = block.text.split('\n').length;
  if (lineCount <= 1) return 1.25;
  const perLine = block.h / lineCount;
  const fontSize = Math.max(1, block.fontSizePx);
  const ratio = perLine / fontSize;
  return Math.max(0.9, Math.min(2.2, ratio));
}

async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const response = await fetch(dataUrl);
  return response.blob();
}

async function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Canvas encode failed'));
    }, 'image/png');
  });
}

export { getAsset };
