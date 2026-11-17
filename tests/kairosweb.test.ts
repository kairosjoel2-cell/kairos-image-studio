import { describe, it, expect } from 'vitest';
import { parseJsonLoose } from '../src/lib/aiClient';
import { sanitizeFilename, EXPORT_FORMATS } from '../src/lib/export';
import { FLYER_TEMPLATES, BRAND } from '../src/branding';
import { buildFilterString } from '../src/lib/filters';
import { HistoryEngine } from '../src/lib/history';
import { NEUTRAL_ADJUSTMENTS } from '../src/types';

describe('parseJsonLoose', () => {
  it('parses plain JSON objects', () => {
    expect(parseJsonLoose('{"blocks":[]}')).toEqual({ blocks: [] });
  });

  it('parses JSON inside code fences', () => {
    const text = '```json\n{"a": 1}\n```';
    expect(parseJsonLoose(text)).toEqual({ a: 1 });
  });

  it('parses JSON embedded in prose', () => {
    const text = 'Here you go: {"x": 5} hope that helps';
    expect(parseJsonLoose(text)).toEqual({ x: 5 });
  });
});

describe('export formats', () => {
  it('supports png jpg webp and pdf', () => {
    expect(EXPORT_FORMATS.map((f) => f.id)).toEqual(['png', 'jpeg', 'webp', 'pdf']);
  });

  it('sanitizes filenames', () => {
    expect(sanitizeFilename('my: cool/flyer?')).toBe('my-cool-flyer');
    expect(sanitizeFilename('   ')).toBe('kairosweb-export');
  });
});

describe('branding', () => {
  it('exposes flyer templates with sane sizes', () => {
    expect(BRAND.name).toBe('KAIROSWEB');
    for (const t of FLYER_TEMPLATES) {
      expect(t.width).toBeGreaterThan(0);
      expect(t.height).toBeGreaterThan(0);
      expect(t.bg).toMatch(/^#[0-9a-fA-F]{6}$/);
    }
    expect(FLYER_TEMPLATES.some((t) => t.id === 'a4')).toBe(true);
  });
});

describe('history engine', () => {
  it('supports undo redo and coalescing', () => {
    const h = new HistoryEngine<{ n: number }>({ n: 0 });
    h.push({ n: 1 }, 'k');
    h.push({ n: 2 }, 'k');
    expect(h.undo()?.n).toBe(0);
    expect(h.redo()?.n).toBe(2);
  });
});

describe('filters', () => {
  it('neutral stays none', () => {
    expect(buildFilterString(NEUTRAL_ADJUSTMENTS)).toBe('none');
  });
});
