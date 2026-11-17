/**
 * Color sampling and background patch synthesis.
 *
 * For each AI text block we sample the flyer pixels around the glyph box,
 * estimate the text color and the local background color, then produce a
 * soft-edged patch rectangle that covers the baked-in text. Editable text
 * layers render on top, so edits never clash with the original pixels.
 */
import type { ExtractedBlock } from './aiExtract';

export interface ColorSample {
  textHex: string;
  bgHex: string;
}

interface Rgb {
  r: number;
  g: number;
  b: number;
}

function toHex(r: number, g: number, b: number): string {
  const to = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return '#' + to(r) + to(g) + to(b);
}

function luminance(c: Rgb): number {
  return 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
}

function average(colors: Rgb[]): Rgb {
  if (colors.length === 0) return { r: 255, g: 255, b: 255 };
  let r = 0;
  let g = 0;
  let b = 0;
  for (const c of colors) {
    r += c.r;
    g += c.g;
    b += c.b;
  }
  return { r: r / colors.length, g: g / colors.length, b: b / colors.length };
}

/** Sample colors for one block from the flyer raster canvas. */
export function sampleBlockColors(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  block: ExtractedBlock,
  pad = 0.25,
): ColorSample {
  const bx = Math.max(0, Math.floor(block.x * width));
  const by = Math.max(0, Math.floor(block.y * height));
  const bw = Math.max(1, Math.min(width - bx, Math.ceil(block.w * width)));
  const bh = Math.max(1, Math.min(height - by, Math.ceil(block.h * height)));

  const ringData = safeGetImageData(
    ctx,
    bx - Math.ceil(bw * pad),
    by - Math.ceil(bh * pad),
    bw + 2 * Math.ceil(bw * pad),
    bh + 2 * Math.ceil(bh * pad),
  );
  const boxData = safeGetImageData(ctx, bx, by, bw, bh);
  if (!ringData || !boxData) {
    return { textHex: block.colorHex, bgHex: '#ffffff' };
  }

  // Background estimate: trimmed average of ring-band pixels.
  const ringColors: { lum: number; c: Rgb }[] = [];
  for (let i = 0; i < ringData.data.length; i += 4) {
    if (ringData.data[i + 3] < 200) continue;
    const c: Rgb = { r: ringData.data[i], g: ringData.data[i + 1], b: ringData.data[i + 2] };
    ringColors.push({ lum: luminance(c), c });
  }
  ringColors.sort((a, b) => a.lum - b.lum);
  const from = Math.floor(ringColors.length * 0.2);
  const to = Math.max(from + 1, Math.ceil(ringColors.length * 0.8));
  const keptRing = ringColors.slice(from, to).map((entry) => entry.c);
  const bgSample = keptRing.length > 0 ? average(keptRing) : ({ r: 255, g: 255, b: 255 } as Rgb);

  // Text estimate: darkest or lightest 15% of box pixels vs background.
  const bgLum = luminance(bgSample);
  const boxColors: { d: number; c: Rgb }[] = [];
  for (let i = 0; i < boxData.data.length; i += 4) {
    if (boxData.data[i + 3] < 200) continue;
    const c: Rgb = { r: boxData.data[i], g: boxData.data[i + 1], b: boxData.data[i + 2] };
    boxColors.push({ d: Math.abs(luminance(c) - bgLum), c });
  }
  boxColors.sort((a, b) => b.d - a.d);
  const extremeCount = Math.max(1, Math.ceil(boxColors.length * 0.15));
  const extremePixels = boxColors.slice(0, extremeCount).map((entry) => entry.c);
  const textSample = extremePixels.length > 0 ? average(extremePixels) : ({ r: 17, g: 17, b: 17 } as Rgb);

  return { textHex: toHex(textSample.r, textSample.g, textSample.b), bgHex: toHex(bgSample.r, bgSample.g, bgSample.b) };
}

function safeGetImageData(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
): ImageData | null {
  try {
    const sx = Math.max(0, Math.floor(x));
    const sy = Math.max(0, Math.floor(y));
    const sw = Math.max(1, Math.min(ctx.canvas.width - sx, Math.ceil(w)));
    const sh = Math.max(1, Math.min(ctx.canvas.height - sy, Math.ceil(h)));
    return ctx.getImageData(sx, sy, sw, sh);
  } catch {
    return null;
  }
}

/**
 * Build one patch canvas covering a block area: solid background fill with
 * feathered alpha edges so repairs blend into gradients and photos.
 */
export function buildPatchCanvas(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  block: ExtractedBlock,
  bgHex: string,
  feather = 0.35,
): HTMLCanvasElement {
  const bx = Math.max(0, Math.floor(block.x * width));
  const by = Math.max(0, Math.floor(block.y * height));
  const bw = Math.max(1, Math.min(width - bx, Math.ceil(block.w * width)));
  const bh = Math.max(1, Math.min(height - by, Math.ceil(block.h * height)));

  const canvas = document.createElement('canvas');
  canvas.width = bw;
  canvas.height = bh;
  const pctx = canvas.getContext('2d');
  if (!pctx) return canvas;

  pctx.fillStyle = bgHex;
  pctx.fillRect(0, 0, bw, bh);

  const fy = Math.max(2, Math.round(bh * feather * 0.5));
  const gx = pctx.createLinearGradient(0, 0, 0, bh);
  gx.addColorStop(0, 'rgba(0,0,0,0)');
  gx.addColorStop(Math.min(0.45, fy / bh), 'rgba(0,0,0,1)');
  gx.addColorStop(1 - Math.min(0.45, fy / bh), 'rgba(0,0,0,1)');
  gx.addColorStop(1, 'rgba(0,0,0,0)');
  pctx.globalCompositeOperation = 'destination-in';
  pctx.fillStyle = gx;
  pctx.fillRect(0, 0, bw, bh);
  pctx.globalCompositeOperation = 'source-over';

  void ctx;
  void width;
  void height;
  return canvas;
}
