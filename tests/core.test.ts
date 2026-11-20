import { describe, it, expect } from 'vitest';
import { HistoryEngine } from '../src/lib/history';
import { buildFilterString, isFilterNeutral } from '../src/lib/filters';
import { sanitizeFilename, EXPORT_FORMATS } from '../src/lib/export';
import { CANVAS_TEMPLATES, createDocument } from '../src/lib/document';
import { deepClone, clamp, hexToRgb, rgbToHex, withAlpha, rotatedBounds, uid } from '../src/utils/helpers';
import { NEUTRAL_ADJUSTMENTS, BLEND_MODES } from '../src/types';

describe('HistoryEngine', () => {
  it('pushes and undoes states', () => {
    const h = new HistoryEngine<{ n: number }>({ n: 0 });
    h.push({ n: 1 });
    h.push({ n: 2 });
    expect(h.undo()?.n).toBe(1);
    expect(h.undo()?.n).toBe(0);
    expect(h.canUndo).toBe(false);
    expect(h.redo()?.n).toBe(1);
  });

  it('coalesces rapid pushes with the same key', () => {
    const h = new HistoryEngine<{ n: number }>({ n: 0 });
    h.push({ n: 1 }, 'drag');
    h.push({ n: 2 }, 'drag');
    expect(h.undo()?.n).toBe(0);
  });

  it('respects the stack limit', () => {
    const h = new HistoryEngine<{ n: number }>({ n: 0 }, 5);
    for (let i = 1; i <= 10; i += 1) h.push({ n: i });
    let steps = 0;
    while (h.canUndo) {
      h.undo();
      steps += 1;
    }
    expect(steps).toBeLessThanOrEqual(5);
  });
});

describe('filters', () => {
  it('neutral adjustments produce none', () => {
    expect(buildFilterString(NEUTRAL_ADJUSTMENTS)).toBe('none');
    expect(isFilterNeutral(NEUTRAL_ADJUSTMENTS)).toBe(true);
  });

  it('serializes non-neutral adjustments', () => {
    const s = buildFilterString({ ...NEUTRAL_ADJUSTMENTS, brightness: 1.2, blur: 4 });
    expect(s).toContain('brightness(1.2)');
    expect(s).toContain('blur(4px)');
  });

  it('exposes named presets', () => {
    expect(() => buildFilterString({ ...NEUTRAL_ADJUSTMENTS, grayscale: 1 })).not.toThrow();
  });
});

describe('export helpers', () => {
  it('sanitizes filenames', () => {
    expect(sanitizeFilename('my: cool/design?')).toBe('my-cool-design');
    expect(sanitizeFilename('   ')).toBe('kairosweb-export');
  });

  it('supports png jpeg and webp', () => {
    expect(EXPORT_FORMATS.map((f) => f.id)).toEqual(['png', 'jpeg', 'webp', 'pdf']);
  });
});

describe('document factory', () => {
  it('creates a document with defaults', () => {
    const doc = createDocument('Test', 800, 600);
    expect(doc.name).toBe('Test');
    expect(doc.width).toBe(800);
    expect(doc.height).toBe(600);
    expect(doc.layers).toEqual([]);
    expect(doc.background.color).toBe('#ffffff');
    expect(doc.id.startsWith('doc_')).toBe(true);
  });

  it('has valid templates', () => {
    for (const t of CANVAS_TEMPLATES) {
      expect(t.width).toBeGreaterThan(0);
      expect(t.height).toBeGreaterThan(0);
      expect(t.bg).toMatch(/^#[0-9a-fA-F]{6}$/);
    }
  });
});

describe('helpers', () => {
  it('deep clones nested structures', () => {
    const original = { a: 1, b: { c: [1, 2, 3] } };
    const clone = deepClone(original);
    expect(clone).toEqual(original);
    expect(clone).not.toBe(original);
    expect(clone.b).not.toBe(original.b);
  });

  it('clamps values', () => {
    expect(clamp(5, 0, 3)).toBe(3);
    expect(clamp(-2, 0, 3)).toBe(0);
    expect(clamp(2, 0, 3)).toBe(2);
  });

  it('converts colors', () => {
    expect(hexToRgb('#ff0000')).toEqual({ r: 255, g: 0, b: 0 });
    expect(rgbToHex(255, 0, 0)).toBe('#ff0000');
    expect(withAlpha('#ff0000', 0.5)).toBe('rgba(255, 0, 0, 0.5)');
  });

  it('computes rotated bounds', () => {
    const b = rotatedBounds(10, 10, 100, 50, 0);
    expect(b.width).toBe(100);
    expect(b.height).toBe(50);
  });

  it('generates unique ids', () => {
    const a = uid('x');
    const b = uid('x');
    expect(a).not.toBe(b);
    expect(a.startsWith('x_')).toBe(true);
  });

  it('defines blend modes', () => {
    expect(BLEND_MODES.length).toBe(16);
    expect(BLEND_MODES[0]).toBe('normal');
  });
});
