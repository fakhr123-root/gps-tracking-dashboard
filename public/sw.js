// GeoRadar 3D Studio - Persistent Background GPS Keep-Alive Service Worker
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Receive background location heartbeats from the client and forward to server so user stays Live while app is minimized
self.addEventListener('message', (event) => {
  const data = event.data;
  if (!data || typeof data !== 'object') return;

  if (data.type === 'LOCATION_HEARTBEAT_PING' && data.payload) {
    event.waitUntil(
      fetch('/api/user/update-location', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data.payload),
        keepalive: true
      }).catch(() => {})
    );
  }
});

// Network-first fetch handler (never serves stale HTML or API responses)
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});
