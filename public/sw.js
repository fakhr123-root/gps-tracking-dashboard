// GeoRadar 3D Studio - Persistent Background GPS Keep-Alive Service Worker
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Receive background location heartbeats & status telemetry from the client and forward to server
self.addEventListener('message', (event) => {
  const data = event.data;
  if (!data || typeof data !== 'object') return;

  if ((data.type === 'LOCATION_HEARTBEAT_PING' || data.type === 'STATUS_TELEMETRY_PING') && data.payload) {
    const endpoint = data.type === 'STATUS_TELEMETRY_PING' ? '/api/user/status-telemetry' : '/api/user/update-location';
    event.waitUntil(
      fetch(endpoint, {
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
