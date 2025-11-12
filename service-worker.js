// Service Worker mínimo para desarrollo
self.addEventListener('install', (e) => {
  console.log('Service Worker instalado');
});

self.addEventListener('activate', (e) => {
  console.log('Service Worker activado y corriendo');
});
