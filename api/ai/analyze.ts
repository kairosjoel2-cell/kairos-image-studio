/**
 * Vercel Node function: secure Gemini vision proxy for flyer analysis.
 * GEMINI_API_KEY is read only on the server and is never returned to clients.
 */

type ApiRequest = {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  body?: unknown;
  socket?: { remoteAddress?: string };
};
type ApiResponse = {
  setHeader(name: string, value: string): void;
  status(code: number): ApiResponse;
  json(body: unknown): void;
};

const MODEL = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';
const MAX_DATA_URL_CHARS = 8_000_000;
const WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 10;
const requestWindows = new Map<string, { start: number; count: number }>();

function send(res: ApiResponse, status: number, body: unknown): void {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.status(status).json(body);
}

function allowedModel(model: string): boolean {
  return /^gemini-[a-zA-Z0-9.-]+$/.test(model);
}

function rateLimited(req: ApiRequest): boolean {
  const forwarded = req.headers['x-forwarded-for'];
  const ip = (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(',')[0]?.trim()
    || req.socket?.remoteAddress || 'unknown';
  const now = Date.now();
  const current = requestWindows.get(ip);
  if (!current || now - current.start >= WINDOW_MS) {
    requestWindows.set(ip, { start: now, count: 1 });
    return false;
  }
  current.count += 1;
  return current.count > MAX_REQUESTS_PER_WINDOW;
}

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (req.method === 'GET') {
    send(res, apiKey ? 200 : 503, { configured: Boolean(apiKey) });
    return;
  }
  if (req.method !== 'POST') {
    send(res, 405, { error: 'Method not allowed.' });
    return;
  }
  if (!apiKey) {
    send(res, 503, { error: 'Gemini AI is not configured on the server yet. Please try again later.' });
    return;
  }
  if (rateLimited(req)) {
    send(res, 429, { error: 'Too many AI requests. Please wait a minute and try again.' });
    return;
  }

  let body: Record<string, unknown>;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body as Record<string, unknown>);
  } catch {
    send(res, 400, { error: 'Invalid request body.' });
    return;
  }
  if (!body || typeof body !== 'object') {
    send(res, 400, { error: 'Invalid request body.' });
    return;
  }

  const systemPrompt = typeof body.systemPrompt === 'string' ? body.systemPrompt.slice(0, 12_000) : '';
  const userPrompt = typeof body.userPrompt === 'string' ? body.userPrompt.slice(0, 4_000) : '';
  const dataUrl = typeof body.dataUrl === 'string' ? body.dataUrl : '';
  const maxTokens = typeof body.maxTokens === 'number'
    ? Math.min(Math.max(Math.floor(body.maxTokens), 256), 4096)
    : 4096;

  if (!systemPrompt || !userPrompt || dataUrl.length > MAX_DATA_URL_CHARS) {
    send(res, 400, { error: 'Missing prompts or image is too large. Use an image under 6 MB.' });
    return;
  }

  const imageMatch = dataUrl.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/);
  if (!imageMatch) {
    send(res, 400, { error: 'Only JPEG, PNG, or WebP image data is accepted.' });
    return;
  }
  if (!allowedModel(MODEL)) {
    send(res, 500, { error: 'The configured Gemini model name is invalid.' });
    return;
  }

  try {
    const googleResponse = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(MODEL) + ':generateContent',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents: [{
            role: 'user',
            parts: [
              { text: userPrompt },
              { inlineData: { mimeType: imageMatch[1], data: imageMatch[2] } },
            ],
          }],
          generationConfig: {
            temperature: 0,
            maxOutputTokens: maxTokens,
            responseMimeType: 'application/json',
          },
        }),
      },
    );

    const result = await googleResponse.json().catch(() => ({})) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      error?: { message?: string };
    };

    if (!googleResponse.ok) {
      const message = googleResponse.status === 429
        ? 'Gemini usage limit reached. Please try again later.'
        : googleResponse.status === 401 || googleResponse.status === 403
          ? 'Gemini rejected the server credential. The site owner must check the Vercel environment variable.'
          : 'Gemini could not analyze this flyer right now (HTTP ' + googleResponse.status + ').';
      send(res, googleResponse.status === 429 ? 429 : 502, { error: message });
      return;
    }

    const text = result.candidates?.[0]?.content?.parts?.map((part) => part.text || '').join('').trim();
    if (!text) {
      send(res, 502, { error: 'Gemini returned no text. Try a clearer or smaller flyer.' });
      return;
    }
    send(res, 200, { text });
  } catch {
    send(res, 502, { error: 'Could not reach Gemini. Please try again.' });
  }
}
