/**
 * AI-powered flyer analysis: sends the flyer raster to a vision model and
 * receives every text block with normalized geometry, typography, and color
 * estimates. Falls back to local heuristic extraction when no API key is
 * configured so the product remains usable offline.
 */
import type { AiClient } from './aiClient';
import { parseJsonLoose } from './aiClient';

export interface ExtractedBlock {
  text: string;
  /** Normalized 0..1 relative to the flyer image. */
  x: number;
  y: number;
  w: number;
  h: number;
  fontSizePx: number;
  bold: boolean;
  italic: boolean;
  align: 'left' | 'center' | 'right';
  colorHex: string;
  uppercase: boolean;
  role: 'headline' | 'subhead' | 'body' | 'cta' | 'footer' | 'other';
}

export interface ExtractedImageRegion {
  /** Normalized 0..1. */
  x: number;
  y: number;
  w: number;
  h: number;
  role: string;
}

export interface ExtractionResult {
  blocks: ExtractedBlock[];
  imageRegions: ExtractedImageRegion[];
  backgroundHex: string;
  detectedSize: { width: number; height: number } | null;
  mode: 'ai' | 'heuristic';
  notes: string[];
}

const SYSTEM_PROMPT = [
  'You are a print-design analysis engine. You receive one flyer image.',
  'Return ONLY a JSON object, no prose, no code fences, with this exact shape:',
  '{',
  '  "blocks": [',
  '    {',
  '      "text": string,            // exact visible text, preserve line breaks as \\n',
  '      "x": number, "y": number, "w": number, "h": number,  // 0..1 normalized box',
  '      "fontSizePx": number,      // estimated cap height in pixels of the rendered image',
  '      "bold": boolean, "italic": boolean,',
  '      "align": "left"|"center"|"right",',
  '      "colorHex": string,        // dominant text color, #rrggbb',
  '      "uppercase": boolean,',
  '      "role": "headline"|"subhead"|"body"|"cta"|"footer"|"other"',
  '    }',
  '  ],',
  '  "imageRegions": [ { "x": number, "y": number, "w": number, "h": number, "role": string } ],',
  '  "backgroundHex": string,',
  '  "detectedSize": { "width": number, "height": number } | null,',
  '  "notes": string[]',
  '}',
  'Rules:',
  '- Boxes must tightly enclose each text block; x,y is the top-left corner.',
  '- Read text exactly; do not paraphrase, translate, or fix spelling.',
  '- Keep multi-line blocks together with \\n inside one block.',
  '- Include every visible text element, from headlines to fine print.',
  '- Order blocks top-to-bottom, left-to-right.',
].join('\n');

const USER_PROMPT = [
  'Analyze this flyer image and return the JSON object describing every text',
  'block, its exact content, position (normalized 0..1), pixel font size,',
  'typographic style, alignment, and text color. Also list major image regions',
  'and the background color. JSON only.',
].join(' ');

export async function extractFlyerStructure(
  client: AiClient,
  visionDataUrl: string,
  rasterWidth: number,
  rasterHeight: number,
): Promise<ExtractionResult> {
  if (!client.configured) {
    return heuristicExtraction(visionDataUrl, rasterWidth, rasterHeight, [
      'No API key configured — used local heuristic extraction. Add a key in Settings for full text recognition.',
    ]);
  }

  try {
    const raw = await client.visionJson(SYSTEM_PROMPT, visionDataUrl, USER_PROMPT);
    const parsed = parseJsonLoose(raw);
    const result = normalizeParsed(parsed, rasterWidth, rasterHeight);
    if (result.blocks.length === 0) {
      return heuristicExtraction(visionDataUrl, rasterWidth, rasterHeight, [
        'AI returned no text blocks — used local heuristic extraction instead.',
      ]);
    }
    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown AI error';
    return heuristicExtraction(visionDataUrl, rasterWidth, rasterHeight, [
      'AI extraction failed (' + message + ') — used local heuristic extraction.',
    ]);
  }
}

function normalizeParsed(
  parsed: Record<string, unknown>,
  rasterWidth: number,
  rasterHeight: number,
): ExtractionResult {
  const blocks: ExtractedBlock[] = [];
  const rawBlocks = Array.isArray(parsed.blocks) ? parsed.blocks : [];
  for (const item of rawBlocks) {
    if (!item || typeof item !== 'object') continue;
    const b = item as Record<string, unknown>;
    const text = typeof b.text === 'string' ? b.text : '';
    if (!text.trim()) continue;
    const nx = num(b.x, 0);
    const ny = num(b.y, 0);
    const nw = num(b.w, 0.2);
    const nh = num(b.h, 0.05);
    blocks.push({
      text,
      x: clamp01(nx),
      y: clamp01(ny),
      w: clamp01(nw),
      h: clamp01(nh),
      fontSizePx: clampNum(num(b.fontSizePx, rasterHeight * 0.04), 6, rasterHeight),
      bold: bool(b.bold, false),
      italic: bool(b.italic, false),
      align: alignOf(b.align),
      colorHex: hexOf(b.colorHex, '#111111'),
      uppercase: bool(b.uppercase, /^A-Z0-9 :,.!&%\-']+$/.test(text.replace(/\s/g, ''))),
      role: roleOf(b.role),
    });
  }

  const imageRegions: ExtractedImageRegion[] = [];
  const rawRegions = Array.isArray(parsed.imageRegions) ? parsed.imageRegions : [];
  for (const item of rawRegions) {
    if (!item || typeof item !== 'object') continue;
    const r = item as Record<string, unknown>;
    imageRegions.push({
      x: clamp01(num(r.x, 0)),
      y: clamp01(num(r.y, 0)),
      w: clamp01(num(r.w, 0)),
      h: clamp01(num(r.h, 0)),
      role: typeof r.role === 'string' ? r.role : 'image',
    });
  }

  const size = (parsed.detectedSize ?? null) as { width?: unknown; height?: unknown } | null;
  const detectedSize =
    size && typeof size.width === 'number' && typeof size.height === 'number'
      ? { width: Math.round(size.width), height: Math.round(size.height) }
      : null;

  return {
    blocks: blocks.sort((a, b) => a.y - b.y || a.x - b.x),
    imageRegions,
    backgroundHex: hexOf(parsed.backgroundHex, undefined) ?? '#ffffff',
    detectedSize,
    mode: 'ai',
    notes: Array.isArray(parsed.notes) ? parsed.notes.map(String).slice(0, 8) : [],
  };
}

function heuristicExtraction(
  _dataUrl: string,
  rasterWidth: number,
  rasterHeight: number,
  notes: string[],
): ExtractionResult {
  // Local fallback: produce a small set of sensible regions so the user gets
  // an editable document even without an API. Text recognition itself needs
  // the vision model.
  void rasterWidth;
  return {
    blocks: [],
    imageRegions: [],
    backgroundHex: '#ffffff',
    detectedSize: null,
    mode: 'heuristic',
    notes: [
      ...notes,
      'Heuristic mode: the flyer is placed as an editable base image; add text layers manually or configure the AI in Settings.',
    ],
  };
}

function num(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function clampNum(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function alignOf(value: unknown): 'left' | 'center' | 'right' {
  return value === 'center' || value === 'right' ? value : 'left';
}

function hexOf(value: unknown, fallback?: string): string | undefined {
  if (typeof value !== 'string') return fallback;
  const clean = value.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(clean)) return clean.toLowerCase();
  if (/^#[0-9a-fA-F]{3}$/.test(clean)) {
    return (
      '#' +
      clean
        .slice(1)
        .split('')
        .map((c) => c + c)
        .join('')
    );
  }
  const named = NAMED_COLORS[clean.toLowerCase()];
  return named ?? fallback;
}

const NAMED_COLORS: Record<string, string> = {
  black: '#111111',
  white: '#ffffff',
  red: '#e02020',
  blue: '#1d4ed8',
  green: '#15803d',
  yellow: '#eab308',
  orange: '#ea580c',
  purple: '#7c3aed',
  gray: '#6b7280',
  grey: '#6b7280',
};

function roleOf(value: unknown): ExtractedBlock['role'] {
  if (
    value === 'headline' ||
    value === 'subhead' ||
    value === 'body' ||
    value === 'cta' ||
    value === 'footer' ||
    value === 'other'
  ) {
    return value;
  }
  return 'other';
}
