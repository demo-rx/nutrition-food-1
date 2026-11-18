const CACHE = 'hnp-v76';
const PRECACHE = [
  '/',
  '/index.html',
  '/scan.html',
  '/plan.html',
  '/reports.html',
  '/goals.html',
  '/lab.html',
  '/bmi.html',
  '/css/app.css',
  '/css/home.css',
  '/css/bmi.css',
  '/js/i18n.js',
  '/js/pwa.js',
  '/assets/logo.svg',
  '/assets/logo-icon.svg',
  '/assets/logo-mark.png',
  '/manifest.webmanifest',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(PRECACHE).catch(() => undefined))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;

  const fresh = url.pathname.endsWith('.js') || url.pathname.endsWith('.html') || url.pathname === '/';
  event.respondWith(
    (fresh ? fetch(event.request) : Promise.reject())
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(event.request, copy));
        }
        return response;
      })
      .catch(() => caches.match(event.request).then((cached) => cached || fetch(event.request)))
  );
});
