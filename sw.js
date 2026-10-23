// Service Worker: guarda la app para uso sin conexión y recibe audios compartidos desde WhatsApp.
const VERSION = 'qr-audio-v1';
const ARCHIVOS = ['./', 'index.html', 'manifest.json', 'css/styles.css', 'js/config.js', 'js/qr.js',
  'js/drive.js', 'js/app.js', 'icons/icon-192.png', 'icons/icon-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(ARCHIVOS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((ks) => Promise.all(ks.filter((k) => k !== VERSION && k !== 'compartido').map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url);
  // Audio compartido desde WhatsApp (Share Target): se guarda un momento y se abre la app
  if (e.request.method === 'POST' && u.searchParams.has('share-target')) {
    e.respondWith((async () => {
      try {
        const fd = await e.request.formData();
        const f = fd.get('audio');
        if (f && f.size !== undefined) {
          const c = await caches.open('compartido');
          await c.put('archivo', new Response(f, { headers: {
            'Content-Type': f.type || 'audio/ogg', 'X-Nombre': encodeURIComponent(f.name || 'audio.opus') } }));
        }
      } catch (err) { /* si falla, la app abre igual y el usuario usa "Abrir audio" */ }
      return Response.redirect('./?compartido=1', 303);
    })());
    return;
  }
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  e.respondWith(fetch(e.request)
    .then((r) => { const copia = r.clone(); caches.open(VERSION).then((c) => c.put(e.request, copia)); return r; })
    .catch(() => caches.match(e.request, { ignoreSearch: true })));
});
