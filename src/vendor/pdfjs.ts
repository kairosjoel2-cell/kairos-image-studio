/**
 * Runtime ESM loader for pdfjs-dist (PDF import), fetched from a versioned
 * CDN on demand and cached in module scope.
 */

const PDFJS_URL = 'https://esm.sh/pdfjs-dist@4.7.76';
const PDFJS_WORKER_URL = 'https://esm.sh/pdfjs-dist@4.7.76/build/pdf.worker.min.mjs';

export interface PdfTextItem {
  str: string;
  transform: number[];
  width: number;
  height: number;
  fontName: string;
}

export interface PdfViewport {
  width: number;
  height: number;
}

export interface PdfPage {
  getViewport(options: { scale: number }): PdfViewport;
  render(options: {
    canvasContext: CanvasRenderingContext2D;
    viewport: PdfViewport;
  }): { promise: Promise<void> };
  getTextContent(): Promise<{ items: unknown[] }>;
}

export interface PdfDocument {
  numPages: number;
  getPage(pageNumber: number): Promise<PdfPage>;
  destroy(): Promise<void>;
}

export interface PdfJsModule {
  GlobalWorkerOptions: { workerSrc: string };
  getDocument(options: { data: ArrayBuffer }): { promise: Promise<PdfDocument> };
}

let cached: Promise<PdfJsModule> | null = null;

export function loadPdfJs(): Promise<PdfJsModule> {
  if (cached) return cached;
  cached = import(PDFJS_URL)
    .then((mod: unknown) => {
      const lib = mod as { GlobalWorkerOptions?: unknown; default?: unknown };
      const resolved = (lib.GlobalWorkerOptions
        ? lib
        : ((lib.default ?? lib) as PdfJsModule)) as PdfJsModule;
      resolved.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_URL;
      return resolved;
    })
    .catch((err: unknown) => {
      cached = null;
      throw err;
    });
  return cached;
}
