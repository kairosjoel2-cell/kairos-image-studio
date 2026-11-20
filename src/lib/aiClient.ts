/**
 * Secure Gemini vision client for KAIROS Image Studio.
 * Browser requests go to the same-origin Vercel function; provider credentials
 * are never stored in localStorage or sent to the browser.
 */

const SETTINGS_KEY = 'kairosweb.settings.v1';

export interface AiSettings {
  /** Kept for compatibility with older saved editor state. */
  baseUrl: string;
  /** Always empty: provider credentials are server-side only. */
  apiKey: string;
  model: string;
}

export const DEFAULT_AI_SETTINGS: AiSettings = {
  baseUrl: '/api/ai/analyze',
  apiKey: '',
  model: 'gemini-3.5-flash-lite',
};

export function loadSettings(): AiSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<AiSettings>;
      // Remove any legacy browser-stored provider key immediately.
      if (parsed.apiKey) {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(DEFAULT_AI_SETTINGS));
      }
    }
  } catch {
    // Ignore corrupt legacy settings and use the secure server configuration.
  }
  return { ...DEFAULT_AI_SETTINGS };
}

export function saveSettings(_settings: AiSettings): void {
  // Never persist credentials or user-controlled provider endpoints in the browser.
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(DEFAULT_AI_SETTINGS));
}

export function clearSettings(): void {
  localStorage.removeItem(SETTINGS_KEY);
}

export class AiClientError extends Error {
  readonly status: number | null;
  constructor(message: string, status: number | null) {
    super(message);
    this.name = 'AiClientError';
    this.status = status;
  }
}

export class AiClient {
  constructor(_settings: AiSettings) {}

  // The browser always attempts the same-origin server endpoint. The endpoint
  // reports whether its server-side Gemini credential has been configured.
  get configured(): boolean {
    return true;
  }

  async visionJson(
    systemPrompt: string,
    dataUrl: string,
    userPrompt: string,
    maxTokens = 4096,
  ): Promise<string> {
    let response: Response;
    try {
      response = await fetch('/api/ai/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemPrompt,
          userPrompt,
          dataUrl,
          maxTokens: Math.min(Math.max(Math.round(maxTokens), 256), 4096),
        }),
      });
    } catch {
      throw new AiClientError('Could not reach KAIROS AI. Check your connection and try again.', null);
    }

    const payload = (await response.json().catch(() => ({}))) as {
      text?: string;
      error?: string;
    };

    if (!response.ok) {
      const message = payload.error || 'KAIROS AI request failed.';
      throw new AiClientError(message, response.status);
    }
    if (!payload.text) {
      throw new AiClientError('Gemini returned an empty response.', response.status);
    }
    return payload.text;
  }
}

/** Parse a JSON object out of a model response, tolerating code fences. */
export function parseJsonLoose(text: string): Record<string, unknown> {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start >= 0 && end > start) {
    try {
      return JSON.parse(candidate.slice(start, end + 1)) as Record<string, unknown>;
    } catch {
      // Fall through to direct parse.
    }
  }
  return JSON.parse(candidate) as Record<string, unknown>;
}

/** Convert an already-rasterized import (including the first PDF page) into a vision-ready JPEG. */
export async function dataUrlToVisionDataUrl(dataUrl: string, maxEdge = 1600): Promise<string> {
  const img = await loadImageElement(dataUrl);
  const scale = Math.min(1, maxEdge / Math.max(img.naturalWidth, img.naturalHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unavailable');
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.92);
}

function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Image decode failed'));
    img.src = src;
  });
}
