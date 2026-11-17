# KAIROSWEB — Flyer Studio

Upload any existing flyer and turn it into a **fully editable layered design**.
KAIROSWEB keeps the original layout pixel-perfect, extracts every text block
with AI vision, and rebuilds them as editable text you can restyle, recolor,
retype, and reposition — then export high-quality **PNG, JPG, WebP, or PDF**.

Built with React, TypeScript (strict), Vite, and Canvas 2D. No backend, no
accounts: projects and image assets live in your browser (IndexedDB), and the
app works offline as an installable PWA.

## How flyer conversion works

1. **Import** — upload a PNG/JPG/WebP or PDF. PDFs are rasterized at high
   resolution via pdf.js (loaded on demand from a versioned CDN).
2. **Analyze** — the flyer is sent to an OpenAI-compatible vision model you
   configure, which returns every text block with exact content, normalized
   bounding box, font size estimate, weight/style, alignment, and color.
   No key configured? The app still imports in offline mode (base image +
   manual editing).
3. **Rebuild** — the original flyer becomes a locked base layer (layout
   preserved exactly). For each text block, a color-sampled background patch
   (feathered edges) covers the baked-in text, and a matching editable text
   layer is placed on top with the sampled color, size, and alignment.
4. **Edit everything** — retype text, change fonts/weights/colors, drag,
   resize, rotate, reorder, restyle backgrounds, add shapes and images.
   Full undo/redo, autosave, and keyboard shortcuts.
5. **Export** — PNG (lossless), JPG (quality slider), WebP, or print-ready
   PDF at 0.25×–4× scale through the same renderer as the canvas, so export
   matches preview exactly.

## Getting started

```bash
npm install
npm run dev        # http://localhost:5173
```

Configure the AI (optional but recommended): open **AI ⚙** in the header,
set your API base URL (OpenAI, Groq, OpenRouter, DeepSeek, or any
OpenAI-compatible endpoint), paste your key, and choose a vision model
(e.g. `gpt-4o-mini`). The key is stored **only** in your browser's
localStorage and is sent directly to the endpoint you choose — never committed,
never proxied anywhere else.

Verify before publishing changes:

```bash
npm run typecheck
npm test
npm run build
node scripts/verify.mjs
```

## Security notes

- **Never commit API keys.** There is no key in this repository by design.
- Keys pasted into chat histories or screenshots should be rotated.
- The vision call goes browser → your chosen endpoint directly. If your
  endpoint does not allow browser CORS, use an endpoint that does (OpenAI,
  Groq, and OpenRouter all do).
- The bundled service worker caches only this app's own files.

## Architecture

```
src/
  App.tsx                    shell: header, panels, shortcuts, status bar
  branding.ts                KAIROSWEB identity + flyer presets
  types.ts                   document model (layers, adjustments, blend modes)
  i18n.ts                    EN/DE strings
  state/editorStore.tsx      state, selection, history, persistence, AI flow
  lib/
    aiClient.ts              OpenAI-compatible vision client (runtime key)
    aiExtract.ts             flyer → text blocks (AI + offline fallback)
    flyerImport.ts           image/PDF ingestion
    aiDocument.ts            flyer → editable layered document
    colorSample.ts           per-block text/background sampling + patches
    history.ts               bounded undo/redo with coalescing
    db.ts                    IndexedDB (projects + assets)
    document.ts              document factory + canvas templates
    filters.ts               canvas filter strings + presets
    renderer.ts              Canvas 2D renderer (editor + export share it)
    export.ts                PNG/JPG/WebP/PDF export pipeline
  vendor/
    pdfjs.ts                 on-demand pdf.js loader (CDN, typed)
    jspdf.ts                 on-demand jsPDF loader (CDN, typed)
  components/
    CanvasStage.tsx          interactive canvas (move/resize/rotate)
    LayersPanel.tsx          layer list + add-layer actions
    PropertiesPanel.tsx      transform, filters, crop, text, shape, background
    Modals.tsx               import wizard, new, projects, export, AI settings
  pwa/register.ts            service worker registration
  styles/app.css             design system + responsive layout
public/
  sw.js                      offline cache
  manifest.webmanifest       PWA manifest
```

## Notes and limits

- Text recognition quality depends on the vision model; blurry or heavily
  stylized flyers may need manual touch-up (that is what the patch + text
  layers are for — every block is independently editable).
- Only the first page of multi-page PDFs is imported.
- Fonts use system font stacks to keep the app fully offline and private.
- The AI request can be blocked by browser extensions or strict networks;
  errors surface in the import wizard with an offline-mode fallback.

## License

MIT — see [LICENSE](./LICENSE).
