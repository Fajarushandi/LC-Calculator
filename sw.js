// Naikkan nomor ini SETIAP kali kamu deploy update baru.
// Ini yang bikin browser tahu ada versi baru & buang cache lama.
const VERSION = 'v3';
const CACHE = `lc-${VERSION}`;

const ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/icon-192-maskable.png',
  '/icon-512-maskable.png'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(ASSETS))
      .catch(err => console.error('SW install cache failed:', err))
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE).map(k => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  const req = e.request;

  // Hanya tangani GET request
  if (req.method !== 'GET') return;

  // Abaikan request cross-origin (misal Google Fonts) -> biarkan browser handle langsung
  if (new URL(req.url).origin !== self.location.origin) return;

  // Network-first untuk HTML & JS (termasuk navigasi/index.html)
  // -> selalu coba ambil versi terbaru dari server dulu,
  //    baru fallback ke cache kalau offline/gagal.
  const isNavigation = req.mode === 'navigate';
  const isHtmlOrJs = req.url.endsWith('.html') || req.url.endsWith('.js') || req.url.endsWith('/');

  if (isNavigation || isHtmlOrJs) {
    e.respondWith(
      fetch(req)
        .then(res => {
          const resClone = res.clone();
          caches.open(CACHE).then(c => c.put(req, resClone));
          return res;
        })
        .catch(() => caches.match(req).then(cached => cached || caches.match('/index.html')))
    );
    return;
  }

  // Cache-first untuk asset statis (icon, manifest, gambar, dll)
  e.respondWith(
    caches.match(req).then(cached => {
      if (cached) return cached;
      return fetch(req).then(res => {
        const resClone = res.clone();
        caches.open(CACHE).then(c => c.put(req, resClone));
        return res;
      });
    })
  );
});

// Izinkan halaman trigger update manual via postMessage
self.addEventListener('message', e => {
  if (e.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
