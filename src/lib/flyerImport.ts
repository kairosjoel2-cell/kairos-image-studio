/**
 * Flyer ingestion: accept PNG/JPEG/WebP images or PDF files and produce a
 * full-resolution base raster plus its natural size.
 */
import { loadPdfJs } from '../vendor/pdfjs';

export interface ImportedFlyer {
  dataUrl: string;
  width: number;
  height: number;
  sourceKind: 'image' | 'pdf';
  pageCount: number;
}

const MAX_BASE_EDGE = 2400;

export async function importFlyer(file: File): Promise<ImportedFlyer> {
  const lower = file.name.toLowerCase();
  const isPdf = file.type === 'application/pdf' || lower.endsWith('.pdf');
  if (isPdf) {
    return importFlyerFromPdf(file);
  }
  if (!file.type.startsWith('image/')) {
    throw new Error('Unsupported file type. Upload a PNG, JPG, WEBP, or PDF flyer.');
  }
  return importFlyerFromImage(file);
}

async function importFlyerFromImage(file: File): Promise<ImportedFlyer> {
  const bitmap = await loadBitmap(file);
  const scale = Math.min(1, MAX_BASE_EDGE / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unavailable');
  ctx.drawImage(bitmap, 0, 0, width, height);
  if ('close' in bitmap && typeof bitmap.close === 'function') bitmap.close();
  return {
    dataUrl: canvas.toDataURL('image/png'),
    width,
    height,
    sourceKind: 'image',
    pageCount: 1,
  };
}

async function loadBitmap(file: Blob): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file);
    } catch {
      // fall through to Image element
    }
  }
  const url = URL.createObjectURL(file);
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Image decode failed'));
      img.src = url;
    });
  } finally {
    if (!('naturalWidth' in ({} as never))) {
      // keep URL alive until image consumed; revoked after draw above
    }
    window.setTimeout(() => URL.revokeObjectURL(url), 5000);
  }
}

async function importFlyerFromPdf(file: File): Promise<ImportedFlyer> {
  const pdfjs = await loadPdfJs();
  const buffer = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: buffer }).promise;
  const page = await doc.getPage(1);
  const baseViewport = page.getViewport({ scale: 1 });
  const scale = Math.min(2, Math.max(1, MAX_BASE_EDGE / Math.max(baseViewport.width, baseViewport.height)));
  const viewport = page.getViewport({ scale });

  const canvas = document.createElement('canvas');
  canvas.width = Math.round(viewport.width);
  canvas.height = Math.round(viewport.height);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unavailable');
  await page.render({ canvasContext: ctx, viewport }).promise;

  const result: ImportedFlyer = {
    dataUrl: canvas.toDataURL('image/png'),
    width: canvas.width,
    height: canvas.height,
    sourceKind: 'pdf',
    pageCount: doc.numPages,
  };
  await doc.destroy();
  return result;
}
