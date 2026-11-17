/**
 * Export pipeline: renders the document offscreen at full resolution and
 * encodes PNG / JPEG / WEBP, then triggers a browser download.
 */
import type { DocumentState } from '../types';
import { renderDocumentToCanvas } from './renderer';
import { downloadDataUrl } from '../utils/helpers';

export type ExportFormat = 'png' | 'jpeg' | 'webp';

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
  { id: 'jpeg', name: 'JPEG (smaller)', ext: 'jpg', mime: 'image/jpeg' },
  { id: 'webp', name: 'WebP (modern)', ext: 'webp', mime: 'image/webp' },
];

export function sanitizeFilename(name: string): string {
  const cleaned = name
    .trim()
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return cleaned.length > 0 ? cleaned : 'kairos-export';
}

export async function exportDocument(doc: DocumentState, options: ExportOptions): Promise<void> {
  const canvas = await renderDocumentToCanvas(doc, { scale: options.scale });
  const mime =
    EXPORT_FORMATS.find((f) => f.id === options.format)?.mime ?? 'image/png';
  const ext = EXPORT_FORMATS.find((f) => f.id === options.format)?.ext ?? 'png';
  const dataUrl = canvas.toDataURL(mime, options.quality);
  downloadDataUrl(dataUrl, sanitizeFilename(doc.name) + '.' + ext);
}

/** Returns a PNG data URL of the document (used for save-to-file fallbacks). */
export async function documentToPngDataUrl(doc: DocumentState): Promise<string> {
  const canvas = await renderDocumentToCanvas(doc, { scale: 1 });
  return canvas.toDataURL('image/png');
}
