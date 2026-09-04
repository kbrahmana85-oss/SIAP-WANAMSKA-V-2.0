const CACHE_NAME = 'wanamska-v2-cache-v5';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/style.css',
  '/script.js',
  '/manifest.json',
  '/logo_pwa.png',
  '/icon.png'
];

// Install Event
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      // addAll bisa gagal jika salah satu aset offline; pakai add per item + catch
      return Promise.allSettled(ASSETS_TO_CACHE.map(url => cache.add(url).catch(() => {})));
    }).then(() => self.skipWaiting())
  );
});

// Activate Event
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(keys.map(key => {
        if (key !== CACHE_NAME) {
          return caches.delete(key);
        }
      }));
    })
  );
  return self.clients.claim();
});

// Fetch Event
// - Halaman & aset inti: NETWORK-FIRST (agar update langsung diterapkan), fallback cache.
// - File lain: CACHE-FIRST dengan fallback jaringan.
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Abaikan request non-GET & request ke Apps Script / domain lain
  if (event.request.method !== 'GET') return;
  if (url.origin !== self.location.origin) return;

  // Network-first untuk dokumen utama & JS/CSS inti (antisipasi bug versi lama)
  if (event.request.mode === 'navigate' ||
      url.pathname === '/' ||
      url.pathname.endsWith('index.html') ||
      url.pathname.endsWith('script.js') ||
      url.pathname.endsWith('style.css')) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy)).catch(() => {});
          return response;
        })
        .catch(() => caches.match(event.request).then(cached => cached || new Response(
          'Tidak dapat terhubung ke jaringan dan data tidak tercache.', {
            headers: { 'Content-Type': 'text/plain' }
          }
        )))
    );
    return;
  }

  // Cache-first untuk aset statis lain (gambar, logo, dll.)
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        if (response && response.status === 200) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy)).catch(() => {});
        }
        return response;
      }).catch(() => cached);
    })
  );
});
