// GeoRadar 3D Studio - Smart Hybrid Online/Offline PWA & Background GPS Keep-Alive Service Worker
const CACHE_NAME = 'georadar-hybrid-shell-v26';
const NAV_NETWORK_TIMEOUT_MS = 4000;
const ASSET_NETWORK_TIMEOUT_MS = 3500;
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

// Helper: fetch with AbortController timeout so slow/waking servers or stalled CDNs never hang mobile reloads
function fetchWithRaceTimeout(request, timeoutMs) {
  const controller = new AbortController();
  const timerId = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(request, { signal: controller.signal })
    .finally(() => clearTimeout(timerId));
}

// Non-blocking Network-First for HTML & stylesheet/JS assets with clean cached fallback
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  // Never intercept or cache live API / health / SSE endpoints
  if (url.pathname.startsWith('/api/') || url.pathname === '/healthz') return;

  const isNavHtml = req.mode === 'navigate' || url.pathname === '/' || url.pathname === '/index.html' || url.pathname === '/admin.html';
  const isShellCode = /\.(css|js|mjs|html)$/i.test(url.pathname);
  const isStyleOrScriptCdn = /cdn\.tailwindcss|unpkg\.com|cdnjs\.cloudflare|fonts\.googleapis|fonts\.gstatic/i.test(url.hostname);
  const hasChallengeQuery = url.searchParams.has('__cf_chl_rt_tk') || url.searchParams.has('__cf_chl_tk');

  if (isNavHtml) {
    const navReq = new Request(req, { cache: 'no-store' });

    event.respondWith(
      fetchWithRaceTimeout(navReq, NAV_NETWORK_TIMEOUT_MS)
        .then(async (networkRes) => {
          const contentType = String(networkRes.headers.get('content-type') || '').toLowerCase();
          if (!networkRes.ok || (!contentType.includes('text/html') && !hasChallengeQuery)) {
            const fallbackHtml = await caches.match('/index.html').then((r) => r || caches.match('/'));
            return fallbackHtml || networkRes;
          }
          if (!hasChallengeQuery && url.origin === self.location.origin) {
            const resClone = networkRes.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(url.pathname, resClone)).catch(() => {});
          }
          return networkRes;
        })
        .catch(async () => {
          // Server slow/waking or offline -> serve cached shell immediately & refresh silently in background
          if (!hasChallengeQuery && url.origin === self.location.origin) {
            event.waitUntil(
              fetch(new Request(url.pathname, { cache: 'no-store' }))
                .then((bgRes) => {
                  const ct = String(bgRes.headers.get('content-type') || '').toLowerCase();
                  if (bgRes && bgRes.ok && ct.includes('text/html')) {
                    return caches.open(CACHE_NAME).then((cache) => cache.put(url.pathname, bgRes.clone()));
                  }
                })
                .catch(() => {})
            );
          }

          const cachedRes = await caches.match(req, { ignoreSearch: true })
            || await caches.match('/index.html')
            || await caches.match('/');
          return cachedRes || fetch(navReq).catch(() => new Response('', { status: 503, statusText: 'Offline' }));
        })
    );
    return;
  }

  // For stylesheets, scripts, and CDN assets: race network with 3.5s timeout so mobile never stalls with broken layout
  const fetchReq = (isShellCode && url.origin === self.location.origin) ? new Request(req, { cache: 'no-store' }) : req;
  const assetPromise = (isShellCode || isStyleOrScriptCdn)
    ? fetchWithRaceTimeout(fetchReq, ASSET_NETWORK_TIMEOUT_MS)
    : fetch(fetchReq);

  event.respondWith(
    assetPromise
      .then((networkRes) => {
        const isCacheableOrigin = url.origin === self.location.origin || isStyleOrScriptCdn;
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
          return cachedRes || new Response('', { status: 503, statusText: 'Offline' });
        });
      })
  );
});
