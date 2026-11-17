import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// KAIROS Image Studio — offline-first build: no external fonts/CDNs, hashed assets for caching.
export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    outDir: 'dist',
    sourcemap: false,
    target: 'es2020',
    chunkSizeWarningLimit: 900,
  },
  server: {
    port: 5173,
    strictPort: false,
  },
});
