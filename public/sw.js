const CACHE_NAME = 'georadar-3d-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

self.addEventListener('fetch', (event) => {
  // Network-first strategy to always keep live Google Maps extraction fresh
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});
