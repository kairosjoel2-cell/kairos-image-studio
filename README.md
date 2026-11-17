# KAIROS Image Studio

Professional, offline-first **graphic design + advanced image editing** in the browser.
A Canva-style layout editor combined with a photo editing tool — built with React,
TypeScript, Vite, and Canvas 2D. No backend, no accounts: projects are stored
locally in your browser (IndexedDB) and the app works fully offline as an
installable PWA.

## Features

**Design (Canva-style)**
- Template canvas presets: social posts, story, portrait, YouTube thumbnail,
  A4/A3 print, slides, custom sizes
- Layer system: images, text, shapes (rectangle, ellipse, triangle, star,
  line, arrow) with reorder, duplicate, lock, hide, blend modes (16), opacity
- Interactive canvas: drag to move, corner handles to resize (rotation-aware,
  Shift for aspect ratio), rotation handle with 15° snapping, multi-select
- Text engine: fonts, weights, alignment, line height, letter spacing,
  curved text, underline, uppercase
- Layer styling: gradients, strokes, drop shadows, corner radius (rectangles),
  star points
- Background: solid color, gradient, image (cover/contain/tile)
- Undo/redo with coalesced drag/slider history; autosave; keyboard shortcuts
  (Ctrl+Z / Ctrl+Y / Ctrl+Shift+Z, Ctrl+D duplicate, Ctrl+S save, Delete, Esc)

**Image editing (photo tool)**
- Per-layer adjustments: brightness, contrast, saturation, hue, blur, sepia,
  grayscale, invert
- 10 one-click filter presets (Mono, Noir, Sepia, Vivid, Fade, Cool, Warm,
  Dream, Invert, Original)
- Non-destructive crop (source-space crop rect per image layer)
- Luminance masking support in the document model

**Export**
- PNG (lossless), JPEG (quality slider), WebP
- 0.25x–4x output scale with live output size preview
- Renders through the same engine as the canvas, so export matches preview

**Platform**
- Offline-first PWA (service worker + manifest), installable
- Projects persisted in IndexedDB with auto-generated thumbnails
- Responsive layout: desktop, tablet, and mobile

## Getting started

```bash
npm install
npm run dev        # http://localhost:5173
```

Verify everything before publishing changes:

```bash
npm run typecheck  # strict TypeScript, noUnusedLocals
npm test           # vitest unit tests
npm run build      # production bundle to dist/
node scripts/verify.mjs  # runs all of the above in order
```

## Optional: GitHub Actions CI

This repo ships `scripts/verify.mjs`. If you want CI too, create
`.github/workflows/ci.yml` with:

```yaml
name: CI

on:
  push:
    branches: [release]
  pull_request:
    branches: [release]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm

      - name: Install dependencies
        run: npm install

      - name: Typecheck
        run: npm run typecheck

      - name: Unit tests
        run: npm test

      - name: Build production bundle
        run: npm run build
```

(The workflow file must be added from the GitHub UI or a token with the
`workflow` scope; it is intentionally not committed by this automation.)

## Architecture

```
src/
  main.tsx                  entry: DB migration, React mount, PWA, error ring
  App.tsx                   app shell: header, panels, shortcuts, status bar
  types.ts                  document model (layers, adjustments, blend modes)
  i18n.ts                   EN/DE strings
  state/editorStore.tsx     document state, selection, history, persistence
  lib/
    history.ts              bounded undo/redo with coalescing
    db.ts                   IndexedDB (projects + assets)
    document.ts             document factory + canvas templates
    filters.ts              canvas filter strings + presets
    renderer.ts             Canvas 2D renderer (shared by editor + export)
    export.ts               PNG/JPEG/WebP export pipeline
  components/
    CanvasStage.tsx         interactive canvas (move/resize/rotate gestures)
    LayersPanel.tsx         layer list + add-layer actions
    PropertiesPanel.tsx     transform, filters, crop, text, shape, background
    Modals.tsx              new project, projects browser, export dialog
  pwa/register.ts           service worker registration
  styles/app.css            design system + responsive layout
public/
  sw.js                     offline cache (network-first, cache fallback)
  manifest.webmanifest      PWA manifest
```

The document model is plain-serializable JSON (no pixels), so undo snapshots
and IndexedDB persistence stay cheap; image bytes live in a separate asset
store keyed by asset id.

## Notes and limits

- Fonts use system font stacks (no external font CDNs) to keep the app fully
  offline and private.
- Text editing is via the properties panel; double-click on a text layer
  points you there.
- Background image assets and layer image assets are stored as provided; very
  large images consume browser storage quota.
- Tested via unit tests on the core engines (history, filters, export naming,
  document factory, helpers). Canvas rendering itself is browser-dependent and
  was reviewed by code inspection, not executed in CI.

## License

MIT — see [LICENSE](./LICENSE).
