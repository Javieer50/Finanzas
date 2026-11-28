const CACHE = 'finanzas-jr-v108-7.1.0';
const PAGINA = './index.html';
const EXTRAS = ['./manifest.json', './apple-touch-icon.png', './icon-192.png', './icon-512.png'];
const ESPERA_RED = 3500; // ms: con señal débil, pasado este tiempo se abre la copia guardada

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    // La app en sí es obligatoria; los íconos, si alguno falta, no impiden funcionar sin conexión
    await c.add(new Request(PAGINA, { cache: 'reload' }));
    await Promise.allSettled(EXTRAS.map(u => c.add(new Request(u, { cache: 'reload' }))));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k.startsWith('finanzas-jr-') && k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

async function copiaApp() {
  const c = await caches.open(CACHE);
  return (await c.match(PAGINA, { ignoreSearch: true })) || (await caches.match(PAGINA, { ignoreSearch: true }));
}

self.addEventListener('fetch', e => {
  const req = e.request;
  const url = new URL(req.url);
  // Respaldo en la nube y cualquier dirección externa van directo a la red
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;
  const esPagina = req.mode === 'navigate' || url.pathname.endsWith('/') || url.pathname.endsWith('.html');

  if (esPagina) {
    // Primero la red (para recibir actualizaciones), pero sin quedarse esperando con señal débil
    e.respondWith((async () => {
      const red = fetch(req, { cache: 'no-cache' }).then(async r => {
        if (r && r.ok) { const c = await caches.open(CACHE); await c.put(PAGINA, r.clone()); }
        return r;
      });
      e.waitUntil(red.catch(() => {}));
      const guardada = await copiaApp();
      if (!guardada) return red; // primera vez: no hay copia todavía
      const tiempo = new Promise(ok => setTimeout(() => ok(null), ESPERA_RED));
      try {
        const r = await Promise.race([red, tiempo]);
        return (r && r.ok) ? r : guardada;
      } catch (err) { return guardada; }
    })());
    return;
  }
  // Íconos y manifiesto: primero la copia guardada
  e.respondWith((async () => {
    const cached = await caches.match(req, { ignoreSearch: true });
    if (cached) return cached;
    try {
      const r = await fetch(req);
      if (r && r.ok) { const c = await caches.open(CACHE); c.put(req, r.clone()); }
      return r;
    } catch (err) { return new Response('', { status: 504 }); }
  })());
});
