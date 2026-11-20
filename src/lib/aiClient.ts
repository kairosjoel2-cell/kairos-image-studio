/**
 * OpenAI-compatible vision API client for KAIROSWEB.
 *
 * The API key is supplied at runtime (browser localStorage via the Settings
 * panel) and is never embedded in source or committed to the repository.
 * Works with OpenAI, Groq, OpenRouter, DeepSeek, or any compatible endpoint.
 */

const SETTINGS_KEY = 'kairosweb.settings.v1';

export interface AiSettings {
  baseUrl: string;
  apiKey: string;
  model: string;
}

export const DEFAULT_AI_SETTINGS: AiSettings = {
  baseUrl: 'https://api.openai.com/v1',
  apiKey: '',
  model: 'gpt-4o-mini',
};

export function loadSettings(): AiSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_AI_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<AiSettings>;
    return {
      baseUrl: parsed.baseUrl || DEFAULT_AI_SETTINGS.baseUrl,
      apiKey: parsed.apiKey || '',
      model: parsed.model || DEFAULT_AI_SETTINGS.model,
    };
  } catch {
    return { ...DEFAULT_AI_SETTINGS };
  }
}

export function saveSettings(settings: AiSettings): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

export function clearSettings(): void {
  localStorage.removeItem(SETTINGS_KEY);
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content:
    | string
    | Array<
        | { type: 'text'; text: string }
        | { type: 'image_url'; image_url: { url: string; detail?: 'high' | 'low' | 'auto' } }
      >;
}

interface ChatChoice {
  message?: { content?: string | null };
}

interface ChatResponse {
  choices?: ChatChoice[];
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
  private readonly settings: AiSettings;

  constructor(settings: AiSettings) {
    this.settings = settings;
  }

  get configured(): boolean {
    return this.settings.apiKey.trim().length > 0;
  }

  /**
   * POST /chat/completions with vision content.
   * Returns the assistant text (JSON expected by callers).
   */
  async visionJson(
    systemPrompt: string,
    dataUrl: string,
    userPrompt: string,
    maxTokens = 4096,
  ): Promise<string> {
    if (!this.configured) {
      throw new AiClientError('API key is not configured. Open Settings to add it.', null);
    }

    const url = joinUrl(this.settings.baseUrl, '/chat/completions');
    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + this.settings.apiKey.trim(),
        },
        body: JSON.stringify({
          model: this.settings.model,
          temperature: 0,
          max_tokens: maxTokens,
          messages: [
            { role: 'system', content: systemPrompt },
            {
              role: 'user',
              content: [
                { type: 'text', text: userPrompt },
                { type: 'image_url', image_url: { url: dataUrl, detail: 'high' } },
              ],
            },
          ] as ChatMessage[],
        }),
      });
    } catch {
      throw new AiClientError(
        'Could not reach the AI endpoint. Check the base URL and your connection (browser CORS must allow the call).',
        null,
      );
    }

    if (response.status === 401) {
      throw new AiClientError('API key rejected (401). Check the key in Settings.', 401);
    }
    if (response.status === 429) {
      throw new AiClientError('Rate limited (429). Wait a moment and try again.', 429);
    }
    if (!response.ok) {
      throw new AiClientError('AI request failed with status ' + response.status + '.', response.status);
    }

    const data = (await response.json()) as ChatResponse;
    const text = data.choices?.[0]?.message?.content ?? '';
    if (!text) throw new AiClientError('AI returned an empty response.', response.status);
    return text;
  }
}

function joinUrl(base: string, path: string): string {
  const trimmed = base.trim().replace(/\/+$/, '');
  return trimmed + path;
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
      // fall through to direct parse
    }
  }
  return JSON.parse(candidate) as Record<string, unknown>;
}

/** Downscale an image file to a JPEG data URL suitable for vision requests. */
export async function fileToVisionDataUrl(file: Blob, maxEdge = 1600): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImageElement(url);
    const scale = Math.min(1, maxEdge / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas unavailable');
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.92);
  } finally {
    URL.revokeObjectURL(url);
  }
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
