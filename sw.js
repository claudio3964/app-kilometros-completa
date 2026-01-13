const CACHE_NAME = 'cot-app-v4';

const STATIC_ASSETS = [
  './icons/icon-72.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/maskable-512.png',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css'
];

// INSTALL
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// ACTIVATE
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// FETCH
self.addEventListener('fetch', event => {
  const req = event.request;

  // 🔥 HTML y JS → SIEMPRE de red
  if (req.destination === 'document' || req.destination === 'script') {
    event.respondWith(fetch(req));
    return;
  }

  // 🎒 Assets → cache first
  event.respondWith(
    caches.match(req).then(res => res || fetch(req))
  );
});

