/**
 * Service worker registration with graceful degradation.
 */
interface PwaApi {
  register(): Promise<void>;
  isSupported(): boolean;
}

function register(): Promise<void> {
  return new Promise((resolve) => {
    if (!('serviceWorker' in navigator)) {
      resolve();
      return;
    }
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('./sw.js')
        .then(() => resolve())
        .catch(() => resolve());
    });
  });
}

export const pwa: PwaApi = {
  register,
  isSupported(): boolean {
    return 'serviceWorker' in navigator;
  },
};
