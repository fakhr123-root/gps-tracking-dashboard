// GeoRadar 3D Studio - Smart Hybrid Online/Offline PWA & Background GPS Keep-Alive Service Worker
const CACHE_NAME = 'georadar-hybrid-shell-v7';
const APP_SHELL_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/js/excel-export-helper.js',
  '/icons/icon-192.png',
  '/icons/icon-512.png'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return Promise.allSettled(
        APP_SHELL_ASSETS.map((url) =>
          fetch(url, { cache: 'reload' }).then((res) => {
            if (res && res.ok) return cache.put(url, res);
          }).catch(() => {})
        )
      );
    }).catch(() => {})
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((k) => {
          if (k !== CACHE_NAME) return caches.delete(k);
        })
      )
    ).then(() => self.clients.claim())
  );
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

// Network-first with instant offline cache fallback for core UI shell, icons, styles, and scripts
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  // Never cache live API or SSE endpoints
  if (url.pathname.startsWith('/api/')) return;

  // Always bypass HTTP cache for HTML navigation so returning users never load stale Gatekeeper/Auth UI
  const isNavHtml = req.mode === 'navigate' || url.pathname === '/' || url.pathname === '/index.html' || url.pathname === '/admin.html';
  const fetchReq = isNavHtml ? new Request(req, { cache: 'no-store' }) : req;

  event.respondWith(
    fetch(fetchReq)
      .then((networkRes) => {
        if (networkRes && networkRes.ok && (url.origin === self.location.origin || /cdn\.tailwindcss|unpkg\.com|cdnjs\.cloudflare|fonts\.googleapis|fonts\.gstatic/i.test(url.hostname))) {
          const resClone = networkRes.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, resClone)).catch(() => {});
        }
        return networkRes;
      })
      .catch(() => {
        return caches.match(req).then((cachedRes) => {
          if (cachedRes) return cachedRes;
          if (req.mode === 'navigate' || url.pathname === '/' || url.pathname === '/index.html') {
            return caches.match('/index.html').then((idxRes) => idxRes || caches.match('/'));
          }
          return new Response('', { status: 503, statusText: 'Offline' });
        });
      })
  );
});
