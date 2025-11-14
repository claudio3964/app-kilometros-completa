const CACHE_NAME = 'cot-app-cache-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/style.css',
  '/app.js',
  // agrega aquí todos los archivos que uses (iconos, librerías, etc.)
];

// Instalación del SW y cache de archivos
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(ASSETS_TO_CACHE))
    );
    self.skipWaiting(); // Activa el SW inmediatamente
});

// Activación y limpieza de cache viejo
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(
                keys.filter(key => key !== CACHE_NAME)
                    .map(key => caches.delete(key))
            )
        )
    );
    clients.claim(); // Toma control inmediato
});

// Interceptar requests y servir desde cache primero
self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request)
            .then(cachedRes => cachedRes || fetch(event.request))
    );
});
