# KAIROS Image Studio

Upload an existing flyer and turn it into an editable layered design. KAIROS preserves the original flyer as a base layer, uses Gemini vision to identify text blocks, and rebuilds detected text as editable layers.

Built with React, TypeScript, Vite, and Canvas 2D. Projects and assets are stored locally in the browser (IndexedDB). The editor remains usable offline; AI analysis requires the hosted server endpoint.

## Getting started

```bash
npm install
npm run dev
```

## Gemini AI setup (Vercel)

1. Create or use a Gemini API project managed by an eligible account owner.
2. Add the secret `GEMINI_API_KEY` to the Vercel project's Environment Variables (Preview and Production as appropriate).
3. Optionally set `GEMINI_MODEL`; the default is `gemini-3.5-flash-lite`.
4. Redeploy the project after changing environment variables.

The browser calls `/api/ai/analyze`; only the Vercel function contacts Google. The API key is never sent to the browser, committed to Git, or stored in localStorage. The endpoint accepts image data URLs only, limits payload size and output tokens, and has a basic per-instance request throttle.

## Privacy

Gemini's free tier may use submitted prompts and responses to improve Google products. Do not upload private, confidential, or sensitive images when using the free tier. Check Google's current terms and pricing before enabling paid usage. API quotas and rate limits are shared by all visitors using this project's key.

## Flyer conversion

1. Import PNG/JPG/WEBP or a PDF (first page only).
2. Gemini extracts visible text, approximate position, font size, style, alignment, and color.
3. KAIROS creates editable text layers over the preserved base image.
4. Adjust any imperfect text or positions manually, then export PNG, JPG, WebP, or PDF.

Text recognition is model-dependent. Highly stylized, low-resolution, or obstructed text may need manual correction.

## Verification

```bash
npm run typecheck
npm test
npm run build
node scripts/verify.mjs
```

## Security

- Never commit provider API keys.
- Never paste API keys into chat or screenshots.
- Keep `GEMINI_API_KEY` server-side in Vercel.
- Do not expose this endpoint to untrusted traffic without appropriate rate limits and usage monitoring.
