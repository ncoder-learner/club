// Minimal cross-origin-isolation shim. Registers a service worker that adds
// Cross-Origin-Embedder-Policy / Cross-Origin-Opener-Policy headers to same-origin
// responses, so SharedArrayBuffer works even on static hosts that can't set custom
// response headers (e.g. GitHub Pages) — needed for the code sandbox's real, blocking
// input() support. Based on the well-known coi-serviceworker technique
// (https://github.com/gzuidhof/coi-serviceworker).
if (typeof window === 'undefined') {
  self.addEventListener('install', () => self.skipWaiting());
  self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
  self.addEventListener('fetch', (event) => {
    const request = event.request;
    if (request.cache === 'only-if-cached' && request.mode !== 'same-origin') return;
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (!response.status || response.status === 0 || response.type === 'opaque') return response;
          const headers = new Headers(response.headers);
          headers.set('Cross-Origin-Embedder-Policy', 'require-corp');
          headers.set('Cross-Origin-Opener-Policy', 'same-origin');
          return new Response(response.body, {
            status: response.status,
            statusText: response.statusText,
            headers,
          });
        })
        .catch((err) => new Response(String(err), { status: 500 }))
    );
  });
} else {
  (async () => {
    if (window.crossOriginIsolated) return;
    if (!window.isSecureContext) return; // service workers require https (or localhost)
    if (!('serviceWorker' in navigator)) return;
    try {
      const registration = await navigator.serviceWorker.register(document.currentScript.src);
      if (registration.active && !navigator.serviceWorker.controller) {
        window.location.reload();
      } else {
        registration.addEventListener('updatefound', () => window.location.reload());
      }
    } catch (err) {
      console.error('coi-serviceworker registration failed', err);
    }
  })();
}
