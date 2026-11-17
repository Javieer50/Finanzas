const CACHE = 'finanzas-jr-v44';
const FILES = [
  './manifest.json',
  './apple-touch-icon.png',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', e => {
  // Pre-cache everything except index.html (it uses network-first)
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
  ).then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  const isHTML = url.pathname === '/' || url.pathname.endsWith('.html') || url.pathname.endsWith('/');

  if (isHTML) {
    // NETWORK-FIRST for index.html: always try to get the latest version from GitHub
    // Falls back to cache only when truly offline
    e.respondWith(
      fetch(e.request, { cache: 'no-cache' })
        .then(response => {
          const clone = response.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
          return response;
        })
        .catch(() => caches.match(e.request).then(cached => cached || caches.match('./index.html')))
    );
  } else {
    // CACHE-FIRST for all other assets (icons, manifest, fonts)
    e.respondWith(
      caches.match(e.request).then(cached => cached || fetch(e.request).catch(() => caches.match('./index.html')))
    );
  }
});
