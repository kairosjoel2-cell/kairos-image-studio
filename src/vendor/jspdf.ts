/**
 * Runtime ESM loader for jsPDF (PDF export), fetched from a versioned CDN
 * on demand and cached in module scope.
 */

const JSPDF_URL = 'https://esm.sh/jspdf@2.5.2';

export interface JsPdfInstance {
  addImage(
    dataUrl: string,
    format: string,
    x: number,
    y: number,
    width: number,
    height: number,
  ): void;
  save(filename: string): void;
  internal: { pageSize: { getWidth(): number; getHeight(): number } };
}

export type JsPdfConstructor = new (options: {
  orientation: 'portrait' | 'landscape';
  unit: 'px' | 'pt' | 'mm';
  format: number[] | string;
}) => JsPdfInstance;

let cached: Promise<JsPdfConstructor> | null = null;

export function loadJsPdf(): Promise<JsPdfConstructor> {
  if (cached) return cached;
  cached = import(JSPDF_URL)
    .then((mod: unknown) => {
      const m = mod as { jsPDF?: JsPdfConstructor; default?: unknown };
      const ctor =
        m.jsPDF ?? ((m.default as { jsPDF?: JsPdfConstructor })?.jsPDF ?? m.default);
      if (typeof ctor !== 'function') throw new Error('jsPDF failed to load');
      return ctor as JsPdfConstructor;
    })
    .catch((err: unknown) => {
      cached = null;
      throw err;
    });
  return cached;
}
