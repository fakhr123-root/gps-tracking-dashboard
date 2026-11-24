// GeoRadar 3D Studio - Smart Hybrid Online/Offline PWA & Background GPS Keep-Alive Service Worker
const CACHE_NAME = 'georadar-hybrid-shell-v20';
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
            if (res && res.ok && (res.type === 'basic' || res.type === 'cors')) {
              return cache.put(url, res);
            }
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

  if (data.type === 'SKIP_WAITING') {
    self.skipWaiting();
    return;
  }

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

// Network-first for HTML/CSS/JS shell with integrity checks and clean fallback (prevents partial/corrupted raw screen on reload/update)
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  // Never intercept or cache live API / SSE endpoints
  if (url.pathname.startsWith('/api/')) return;

  const isNavHtml = req.mode === 'navigate' || url.pathname === '/' || url.pathname === '/index.html' || url.pathname === '/admin.html';
  const isShellCode = /\.(css|js|mjs|html)$/i.test(url.pathname);
  const hasChallengeQuery = url.searchParams.has('__cf_chl_rt_tk') || url.searchParams.has('__cf_chl_tk');

  // Always bypass HTTP cache for HTML/CSS/JS shells so updates never mix old & new assets
  const fetchReq = (isNavHtml || isShellCode) ? new Request(req, { cache: 'no-store' }) : req;

  event.respondWith(
    fetch(fetchReq)
      .then(async (networkRes) => {
        const isCacheableOrigin =
          url.origin === self.location.origin ||
          /cdn\.tailwindcss|unpkg\.com|cdnjs\.cloudflare|fonts\.googleapis|fonts\.gstatic/i.test(url.hostname);

        if (isNavHtml) {
          const contentType = String(networkRes.headers.get('content-type') || '').toLowerCase();
          // Reject non-200 or non-HTML navigation errors by falling back to clean cached shell (unless it's a challenge redirect)
          if (!networkRes.ok || (!contentType.includes('text/html') && !hasChallengeQuery)) {
            const fallbackHtml = await caches.match('/index.html').then((r) => r || caches.match('/'));
            if (fallbackHtml) return fallbackHtml;
            return networkRes;
          }
          if (!hasChallengeQuery && url.origin === self.location.origin) {
            const resClone = networkRes.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(url.pathname, resClone)).catch(() => {});
          }
          return networkRes;
        }

        if (networkRes && networkRes.ok && isCacheableOrigin && !hasChallengeQuery) {
          const contentType = String(networkRes.headers.get('content-type') || '').toLowerCase();
          if (!contentType.includes('text/html')) {
            const resClone = networkRes.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, resClone)).catch(() => {});
          }
        }
        return networkRes;
      })
      .catch(() => {
        return caches.match(req, { ignoreSearch: true }).then((cachedRes) => {
          if (cachedRes) return cachedRes;
          if (isNavHtml) {
            return caches.match('/index.html').then((idxRes) => idxRes || caches.match('/'));
          }
          return new Response('', { status: 503, statusText: 'Offline' });
        });
      })
  );
});
