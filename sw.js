self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open("cot-cache-v1").then((cache) => {
      return cache.addAll([
        "/app-kilometros-completa/",
        "/app-kilometros-completa/index.html",
        "/app-kilometros-completa/manifest.json",
        "/app-kilometros-completa/icons/icon-192.png",
        "/app-kilometros-completa/icons/icon-512.png"
      ]);
    })
  );
});

self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});

