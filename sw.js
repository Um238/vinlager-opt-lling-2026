/* Simple service worker for GitHub Pages (PWA install + basic offline cache) */
const CACHE_NAME = 'vinlager-pwa-v1';

// Keep this list small; cache-busting is handled by ?v= params in html
const CORE_ASSETS = [
  './',
  './index.html',
  './scanner.html',
  './styles.css?v=29',
  './app.js?v=29',
  './auth.js?v=29',
  './config.js?v=29',
  './manifest.json',
  './manifest-app.json',
  './icon-app.png',
  './icon-scanner.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((k) => (k === CACHE_NAME ? Promise.resolve() : caches.delete(k))))
    )
  );
  self.clients.claim();
});

// Network-first for API, cache-first for static
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Don't cache API calls to Render
  if (url.pathname.startsWith('/api/') || url.hostname.includes('onrender.com')) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request)
        .then((resp) => {
          const copy = resp.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy)).catch(() => {});
          return resp;
        })
        .catch(() => cached);
    })
  );
});

