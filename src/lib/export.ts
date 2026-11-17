/**
 * Export pipeline: renders the document offscreen at full resolution and
 * encodes PNG / JPEG / WebP images and PDF (via the jsPDF vendor loader).
 */
import type { DocumentState } from '../types';
import { renderDocumentToCanvas } from './renderer';
import { downloadDataUrl } from '../utils/helpers';
import { loadJsPdf } from '../vendor/jspdf';

export type ExportFormat = 'png' | 'jpeg' | 'webp' | 'pdf';

export interface ExportOptions {
  format: ExportFormat;
  quality: number; // 0..1 (jpeg/webp only)
  scale: number; // 0.25..4
}

export interface ExportFormatInfo {
  id: ExportFormat;
  name: string;
  ext: string;
  mime: string;
}

export const EXPORT_FORMATS: ExportFormatInfo[] = [
  { id: 'png', name: 'PNG (lossless)', ext: 'png', mime: 'image/png' },
  { id: 'jpeg', name: 'JPG (smaller)', ext: 'jpg', mime: 'image/jpeg' },
  { id: 'webp', name: 'WebP (modern)', ext: 'webp', mime: 'image/webp' },
  { id: 'pdf', name: 'PDF (print-ready)', ext: 'pdf', mime: 'application/pdf' },
];

export function sanitizeFilename(name: string): string {
  const cleaned = name
    .trim()
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return cleaned.length > 0 ? cleaned : 'kairosweb-export';
}

export async function exportDocument(doc: DocumentState, options: ExportOptions): Promise<void> {
  const canvas = await renderDocumentToCanvas(doc, { scale: options.scale });
  const format = EXPORT_FORMATS.find((f) => f.id === options.format) ?? EXPORT_FORMATS[0];

  if (format.id === 'pdf') {
    await exportPdf(doc, canvas);
    return;
  }

  const dataUrl = canvas.toDataURL(format.mime, options.quality);
  downloadDataUrl(dataUrl, sanitizeFilename(doc.name) + '.' + format.ext);
}

async function exportPdf(doc: DocumentState, canvas: HTMLCanvasElement): Promise<void> {
  const JsPdf = await loadJsPdf();
  const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
  const orientation = doc.width >= doc.height ? 'landscape' : 'portrait';
  const pdf = new JsPdf({
    orientation,
    unit: 'px',
    format: [canvas.width, canvas.height],
  });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  pdf.addImage(dataUrl, 'JPEG', 0, 0, pageW, pageH);
  pdf.save(sanitizeFilename(doc.name) + '.pdf');
}

/** Returns a PNG data URL of the document (used for previews and fallbacks). */
export async function documentToPngDataUrl(doc: DocumentState): Promise<string> {
  const canvas = await renderDocumentToCanvas(doc, { scale: 1 });
  return canvas.toDataURL('image/png');
}
