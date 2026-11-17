/**
 * Canvas 2D renderer: paints a DocumentState onto a canvas of any scale.
 * The same code path powers the live editor canvas and the exporter, so
 * preview and export always match.
 */
import type {
  DocumentState,
  Layer,
  ImageLayerData,
  TextLayerData,
  ShapeLayerData,
  GradientFill,
  ShadowStyle,
  StrokeStyle,
  PageBackground,
} from '../types';
import { buildFilterString } from './filters';
import { getAsset } from './db';
import { degToRad, clamp, rotatePoint } from '../utils/helpers';

type DrawableSource = ImageBitmap | HTMLImageElement;

const bitmapCache = new Map<string, Promise<DrawableSource | null>>();
const MAX_CACHE = 40;

async function loadDrawable(assetId: string): Promise<DrawableSource | null> {
  try {
    const blob = await getAsset(assetId);
    if (!blob) return null;
    if (typeof createImageBitmap === 'function') {
      return await createImageBitmap(blob);
    }
    const url = URL.createObjectURL(blob);
    try {
      return await loadImgElement(url);
    } finally {
      URL.revokeObjectURL(url);
    }
  } catch {
    return null;
  }
}

function loadImgElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('image load failed'));
    img.src = src;
  });
}

export function getDrawable(assetId: string): Promise<DrawableSource | null> {
  let entry = bitmapCache.get(assetId);
  if (!entry) {
    entry = loadDrawable(assetId);
    bitmapCache.set(assetId, entry);
    if (bitmapCache.size > MAX_CACHE) {
      const first = bitmapCache.keys().next().value;
      if (first !== undefined) bitmapCache.delete(first);
    }
  }
  return entry;
}

export function clearBitmapCache(): void {
  bitmapCache.clear();
}

function sourceSize(src: DrawableSource): { w: number; h: number } {
  const s = src as unknown as {
    width: number;
    height: number;
    naturalWidth?: number;
    naturalHeight?: number;
  };
  return { w: s.naturalWidth ?? s.width, h: s.naturalHeight ?? s.height };
}

function makeGradient(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  g: GradientFill,
): CanvasGradient {
  const rad = degToRad(g.angle);
  const cx = width / 2;
  const cy = height / 2;
  const dx = (Math.cos(rad) * width) / 2;
  const dy = (Math.sin(rad) * height) / 2;
  const grad = ctx.createLinearGradient(cx - dx, cy - dy, cx + dx, cy + dy);
  grad.addColorStop(0, g.from);
  grad.addColorStop(1, g.to);
  return grad;
}

function applyShadow(ctx: CanvasRenderingContext2D, shadow: ShadowStyle | null): void {
  if (shadow && shadow.enabled) {
    ctx.shadowColor = shadow.color;
    ctx.shadowBlur = shadow.blur;
    ctx.shadowOffsetX = shadow.offsetX;
    ctx.shadowOffsetY = shadow.offsetY;
  }
}

function clearShadow(ctx: CanvasRenderingContext2D): void {
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
}

function applyStroke(ctx: CanvasRenderingContext2D, stroke: StrokeStyle | null): number {
  if (stroke && stroke.enabled && stroke.width > 0) {
    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = stroke.width;
    return stroke.width;
  }
  return 0;
}

function roundedRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const rr = Math.max(0, Math.min(r, Math.min(w, h) / 2));
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.arcTo(x + w, y, x + w, y + rr, rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.arcTo(x + w, y + h, x + w - rr, y + h, rr);
  ctx.lineTo(x + rr, y + h);
  ctx.arcTo(x, y + h, x, y + h - rr, rr);
  ctx.lineTo(x, y + rr);
  ctx.arcTo(x, y, x + rr, y, rr);
  ctx.closePath();
}

/* ----------------------------- background ------------------------------- */

async function paintBackground(
  ctx: CanvasRenderingContext2D,
  bg: PageBackground,
  width: number,
  height: number,
): Promise<void> {
  ctx.save();
  ctx.fillStyle = bg.color;
  ctx.fillRect(0, 0, width, height);

  if (bg.gradient && bg.gradient.enabled) {
    ctx.fillStyle = makeGradient(ctx, width, height, bg.gradient);
    ctx.fillRect(0, 0, width, height);
  }

  if (bg.imageAssetId) {
    const drawable = await getDrawable(bg.imageAssetId);
    if (drawable) {
      const size = sourceSize(drawable);
      if (bg.adjustments) ctx.filter = buildFilterString(bg.adjustments);
      if (bg.imageMode === 'tile') {
        const pattern = ctx.createPattern(drawable as unknown as CanvasImageSource, 'repeat');
        if (pattern) {
          ctx.fillStyle = pattern;
          ctx.fillRect(0, 0, width, height);
        }
      } else {
        const scale = bg.imageMode === 'cover' ? Math.max(width / size.w, height / size.h) : Math.min(width / size.w, height / size.h);
        const dw = size.w * scale;
        const dh = size.h * scale;
        ctx.drawImage(drawable as unknown as CanvasImageSource, (width - dw) / 2, (height - dh) / 2, dw, dh);
      }
      ctx.filter = 'none';
    }
  }
  ctx.restore();
}

/* ------------------------------- layers --------------------------------- */

async function drawImageLayer(
  ctx: CanvasRenderingContext2D,
  layer: ImageLayerData,
): Promise<void> {
  const drawable = await getDrawable(layer.assetId);
  if (!drawable) {
    ctx.fillStyle = '#26262b';
    ctx.fillRect(0, 0, layer.width, layer.height);
    return;
  }

  const size = sourceSize(drawable);
  const crop = layer.crop;
  const sx = Math.max(0, Math.min(crop.x, size.w));
  const sy = Math.max(0, Math.min(crop.y, size.h));
  const sw = Math.max(1, Math.min(crop.width, size.w - sx));
  const sh = Math.max(1, Math.min(crop.height, size.h - sy));

  ctx.save();
  ctx.filter = buildFilterString(layer.adjustments);
  ctx.drawImage(drawable as unknown as CanvasImageSource, sx, sy, sw, sh, 0, 0, layer.width, layer.height);
  ctx.restore();

  if (layer.maskAssetId) {
    await applyLuminanceMask(ctx, layer);
  }
}

/** Luminance-to-alpha mask composited onto the layer pixels. */
async function applyLuminanceMask(
  ctx: CanvasRenderingContext2D,
  layer: ImageLayerData,
): Promise<void> {
  try {
    const mask = await getDrawable(layer.maskAssetId as string);
    if (!mask) return;
    const size = sourceSize(mask);
    const off = document.createElement('canvas');
    off.width = Math.max(1, Math.round(layer.width));
    off.height = Math.max(1, Math.round(layer.height));
    const octx = off.getContext('2d');
    if (!octx) return;

    octx.drawImage(mask as unknown as CanvasImageSource, 0, 0, size.w, size.h, 0, 0, off.width, off.height);
    const maskData = octx.getImageData(0, 0, off.width, off.height);
    for (let i = 0; i < maskData.data.length; i += 4) {
      const lum = (maskData.data[i] * 0.299 + maskData.data[i + 1] * 0.587 + maskData.data[i + 2] * 0.114) / 255;
      const alpha = layer.maskInvert ? 1 - lum : lum;
      maskData.data[i] = 0;
      maskData.data[i + 1] = 0;
      maskData.data[i + 2] = 0;
      maskData.data[i + 3] = Math.round(alpha * 255);
    }
    octx.putImageData(maskData, 0, 0);

    const layerPixels = document.createElement('canvas');
    layerPixels.width = off.width;
    layerPixels.height = off.height;
    const lctx = layerPixels.getContext('2d');
    if (!lctx) return;
    lctx.drawImage(ctx.canvas, 0, 0, off.width, off.height, 0, 0, off.width, off.height);
    lctx.globalCompositeOperation = 'destination-in';
    lctx.drawImage(off, 0, 0);
    ctx.clearRect(0, 0, layer.width, layer.height);
    ctx.drawImage(layerPixels, 0, 0);
  } catch {
    // Masking is best-effort; leave layer unmasked on failure.
  }
}

function drawTextLayer(ctx: CanvasRenderingContext2D, layer: TextLayerData): void {
  const rawText = layer.uppercase ? layer.text.toUpperCase() : layer.text;
  const font = `${layer.italic ? 'italic ' : ''}${layer.fontWeight} ${layer.fontSize}px ${fontFamilyCss(layer.fontFamily)}`;
  ctx.save();
  ctx.font = font;
  ctx.textAlign = layer.align;
  try {
    (ctx as unknown as { letterSpacing: string }).letterSpacing = `${layer.letterSpacing}px`;
  } catch {
    // letterSpacing unsupported: ignore.
  }
  ctx.textBaseline = 'alphabetic';

  const lineH = layer.fontSize * layer.lineHeight;
  const fillStyle = layer.gradient && layer.gradient.enabled
    ? makeGradient(ctx, layer.width, layer.height, layer.gradient)
    : layer.fill;
  const strokeW = applyStroke(ctx, layer.stroke);
  applyShadow(ctx, layer.shadow);

  if (layer.curve && layer.curve.radius > 0) {
    drawCurvedText(ctx, rawText.replace(/\n/g, ' '), layer, fillStyle, strokeW);
    clearShadow(ctx);
    ctx.restore();
    return;
  }

  const lines = rawText.split('\n');
  lines.forEach((line, i) => {
    const y = i * lineH + layer.fontSize * 0.82;
    let x: number;
    if (layer.align === 'center') x = layer.width / 2;
    else if (layer.align === 'right') x = layer.width;
    else x = 0;
    if (strokeW > 0) ctx.strokeText(line, x, y);
    ctx.fillStyle = fillStyle;
    ctx.fillText(line, x, y);

    if (layer.underline && line.length > 0) {
      const w = ctx.measureText(line).width;
      const ux = layer.align === 'center' ? x - w / 2 : layer.align === 'right' ? x - w : x;
      const uy = y + layer.fontSize * 0.12;
      ctx.save();
      ctx.shadowColor = 'transparent';
      ctx.fillRect(ux, uy, w, Math.max(1, layer.fontSize / 16));
      ctx.restore();
    }
  });

  clearShadow(ctx);
  ctx.restore();
}

function fontFamilyCss(family: string): string {
  return family;
}

function drawCurvedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  layer: TextLayerData,
  fillStyle: string | CanvasGradient,
  strokeW: number,
): void {
  const radius = layer.curve ? layer.curve.radius : 0;
  const chars = Array.from(text);
  const widths = chars.map((c) => ctx.measureText(c).width + layer.letterSpacing);
  const total = widths.reduce((a, b) => a + b, 0);
  const safeRadius = Math.max(1, radius);
  const span = total / safeRadius;
  let angle = -Math.PI / 2 - span / 2;
  const cx = layer.width / 2;
  const cy = safeRadius;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  for (let i = 0; i < chars.length; i += 1) {
    const half = widths[i] / 2 / safeRadius;
    angle += half;
    const px = cx + safeRadius * Math.cos(angle);
    const py = cy + safeRadius * Math.sin(angle);
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(angle + Math.PI / 2);
    if (strokeW > 0) ctx.strokeText(chars[i], 0, 0);
    ctx.fillStyle = fillStyle;
    ctx.fillText(chars[i], 0, 0);
    ctx.restore();
    angle += half;
  }
}

function drawShapeLayer(ctx: CanvasRenderingContext2D, layer: ShapeLayerData): void {
  const w = layer.width;
  const h = layer.height;
  const fill = layer.gradient && layer.gradient.enabled
    ? makeGradient(ctx, w, h, layer.gradient)
    : layer.fill;
  const strokeW = applyStroke(ctx, layer.stroke);
  applyShadow(ctx, layer.shadow);
  ctx.fillStyle = fill;

  switch (layer.shape) {
    case 'rectangle':
      roundedRectPath(ctx, 0, 0, w, h, layer.cornerRadius);
      ctx.fill();
      if (strokeW > 0) ctx.stroke();
      break;
    case 'ellipse':
      ctx.beginPath();
      ctx.ellipse(w / 2, h / 2, Math.max(0.5, w / 2), Math.max(0.5, h / 2), 0, 0, Math.PI * 2);
      ctx.fill();
      if (strokeW > 0) ctx.stroke();
      break;
    case 'triangle':
      ctx.beginPath();
      ctx.moveTo(w / 2, 0);
      ctx.lineTo(w, h);
      ctx.lineTo(0, h);
      ctx.closePath();
      ctx.fill();
      if (strokeW > 0) ctx.stroke();
      break;
    case 'star': {
      const spikes = Math.max(3, Math.min(12, layer.points));
      const outer = Math.min(w, h) / 2;
      const inner = outer * 0.45;
      const cx = w / 2;
      const cy = h / 2;
      ctx.beginPath();
      for (let i = 0; i < spikes * 2; i += 1) {
        const r = i % 2 === 0 ? outer : inner;
        const a = (Math.PI * i) / spikes - Math.PI / 2;
        const px = cx + r * Math.cos(a);
        const py = cy + r * Math.sin(a);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      if (strokeW > 0) ctx.stroke();
      break;
    }
    case 'line':
    case 'arrow': {
      const thickness = strokeW > 0 ? strokeW : clamp(h, 1, 64);
      ctx.strokeStyle = fill;
      ctx.lineWidth = thickness;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(0, h / 2);
      ctx.lineTo(w, h / 2);
      ctx.stroke();
      if (layer.shape === 'arrow') {
        const head = Math.max(8, thickness * 3);
        ctx.beginPath();
        ctx.moveTo(w, h / 2);
        ctx.lineTo(w - head, h / 2 - head / 2);
        ctx.lineTo(w - head, h / 2 + head / 2);
        ctx.closePath();
        ctx.fill();
      }
      break;
    }
  }

  clearShadow(ctx);
}

async function drawLayer(ctx: CanvasRenderingContext2D, layer: Layer): Promise<void> {
  if (!layer.visible) return;
  ctx.save();
  ctx.globalAlpha = clamp(layer.opacity, 0, 1);
  ctx.globalCompositeOperation =
    layer.blendMode === 'normal' ? 'source-over' : (layer.blendMode as GlobalCompositeOperation);

  // Move origin to layer center, rotate, then back to top-left local space.
  ctx.translate(layer.x + layer.width / 2, layer.y + layer.height / 2);
  if (layer.rotation !== 0) ctx.rotate(degToRad(layer.rotation));
  ctx.translate(-layer.width / 2, -layer.height / 2);

  if (layer.flipX || layer.flipY) {
    ctx.translate(layer.width / 2, layer.height / 2);
    ctx.scale(layer.flipX ? -1 : 1, layer.flipY ? -1 : 1);
    ctx.translate(-layer.width / 2, -layer.height / 2);
  }

  ctx.beginPath();
  ctx.rect(0, 0, layer.width, layer.height);
  ctx.clip();

  if (layer.type === 'image') await drawImageLayer(ctx, layer);
  else if (layer.type === 'text') drawTextLayer(ctx, layer);
  else drawShapeLayer(ctx, layer);

  ctx.restore();
}

/* ------------------------------ public API ------------------------------ */

export async function renderDocumentToCanvas(
  doc: DocumentState,
  opts?: { scale?: number },
): Promise<HTMLCanvasElement> {
  const scale = opts && opts.scale ? opts.scale : 1;
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(doc.width * scale));
  canvas.height = Math.max(1, Math.round(doc.height * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');
  ctx.scale(scale, scale);
  await paintBackground(ctx, doc.background, doc.width, doc.height);
  for (const layer of doc.layers) {
    await drawLayer(ctx, layer);
  }
  return canvas;
}

export async function renderThumbnail(doc: DocumentState, maxEdge = 320): Promise<Blob | null> {
  const scale = Math.min(1, maxEdge / Math.max(doc.width, doc.height));
  const canvas = await renderDocumentToCanvas(doc, { scale });
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), 'image/png');
  });
}

/** Hit-test in canvas coordinates, topmost first. Returns layer id or null. */
export function hitTestLayer(
  layers: Layer[],
  px: number,
  py: number,
): string | null {
  for (let i = layers.length - 1; i >= 0; i -= 1) {
    const layer = layers[i];
    if (!layer.visible || layer.locked) continue;
    const local = rotatePoint(
      { x: px, y: py },
      { x: layer.x + layer.width / 2, y: layer.y + layer.height / 2 },
      -layer.rotation,
    );
    const lx = local.x - layer.x;
    const ly = local.y - layer.y;
    const pad = 2;
    if (lx >= -pad && ly >= -pad && lx <= layer.width + pad && ly <= layer.height + pad) {
      return layer.id;
    }
  }
  return null;
}
