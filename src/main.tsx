import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { pwa } from './pwa/register';
import { migrateProjects } from './lib/db';
import { t } from './i18n';
import './styles/app.css';

const boot = document.getElementById('kairos-boot');

async function start(): Promise<void> {
  try {
    // Ensure the local project database is usable before first paint of the editor.
    await migrateProjects();
  } catch (err) {
    console.error('[KAIROS] IndexedDB migration failed:', err);
  }

  const container = document.getElementById('root');
  if (!container) throw new Error('Missing #root container');

  createRoot(container).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );

  if (boot) {
    boot.classList.add('hidden');
    window.setTimeout(() => boot.remove(), 400);
  }

  void pwa.register();
}

void start();

// Surface unhandled errors without a backend: keep a bounded in-memory ring for diagnostics.
const errorRing: string[] = [];
function pushError(kind: string, message: string): void {
  errorRing.push(`[${new Date().toISOString()}] ${kind}: ${message}`);
  if (errorRing.length > 50) errorRing.shift();
}
window.addEventListener('error', (e) => pushError('error', e.message));
window.addEventListener('unhandledrejection', (e) => {
  pushError('unhandledrejection', String(e.reason));
});

export { t };
