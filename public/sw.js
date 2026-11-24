// GeoRadar 3D Studio - Smart Hybrid Online/Offline PWA & Background GPS Keep-Alive Service Worker
const CACHE_NAME = 'georadar-hybrid-shell-v29';
const CDN_CACHE_NAME = 'georadar-cdn-static-v1';
const NAV_NETWORK_TIMEOUT_MS = 3000;
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
          // Keep current shell cache + persistent CDN cache; purge all old shell versions
          if (k !== CACHE_NAME && k !== CDN_CACHE_NAME) return caches.delete(k);
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

// Helper: fetch with AbortController timeout so slow/waking servers never hang reloads
function fetchWithRaceTimeout(request, timeoutMs) {
  const controller = new AbortController();
  const timerId = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(request, { signal: controller.signal })
    .finally(() => clearTimeout(timerId));
}

// Fast Hybrid Strategy:
// 1) NEVER intercept API, health, or Cloudflare /cdn-cgi/ verification flows.
// 2) INSTANT Cache-First (Stale-While-Revalidate) for external CDN CSS/JS/Fonts (Tailwind, Lucide, Leaflet, SheetJS, Google Fonts) -> reloads in milliseconds!
// 3) Fast Network-First (3000ms race timeout) with instant cached shell fallback + silent background update for HTML navigations.
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // CRITICAL: Never intercept API, health, or Cloudflare security verification paths/queries
  if (
    url.pathname.startsWith('/api/') ||
    url.pathname === '/healthz' ||
    url.pathname.startsWith('/cdn-cgi/') ||
    url.hostname.includes('challenges.cloudflare.com') ||
    url.searchParams.has('__cf_chl_rt_tk') ||
    url.searchParams.has('__cf_chl_tk') ||
    url.searchParams.has('__cf_chl_f_tk')
  ) {
    return;
  }

  const isNavHtml = req.mode === 'navigate' || url.pathname === '/' || url.pathname === '/index.html' || url.pathname === '/admin.html';
  const isStyleOrScriptCdn = /cdn\.tailwindcss|unpkg\.com|cdnjs\.cloudflare|cdn\.jsdelivr\.net|fonts\.googleapis|fonts\.gstatic/i.test(url.hostname);

  // 1. INSTANT CACHE-FIRST for external CDN CSS/JS/Fonts (prevents 3-6s reload stall & prevents FOUC!)
  if (isStyleOrScriptCdn) {
    event.respondWith(
      caches.open(CDN_CACHE_NAME).then(async (cdnCache) => {
        const cached = await cdnCache.match(req);
        const bgFetch = fetch(req)
          .then((netRes) => {
            if (netRes && (netRes.ok || netRes.type === 'opaque')) {
              cdnCache.put(req, netRes.clone()).catch(() => {});
            }
            return netRes;
          })
          .catch(() => null);

        if (cached) {
          event.waitUntil(bgFetch);
          return cached;
        }
        const netRes = await bgFetch;
        return netRes || new Response('', { status: 503, statusText: 'Offline' });
      })
    );
    return;
  }

  // 2. HTML Navigation: Fast 3s Network-First with instant cached fallback + silent background refresh
  if (isNavHtml) {
    const navReq = new Request(req, { cache: 'no-store' });

    event.respondWith(
      fetchWithRaceTimeout(navReq, NAV_NETWORK_TIMEOUT_MS)
        .then(async (networkRes) => {
          // Pass Cloudflare security challenges (403/503/cf-mitigated) straight through untouched!
          const isCfChallenge =
            networkRes.status === 403 ||
            networkRes.status === 503 ||
            String(networkRes.headers.get('cf-mitigated') || '').toLowerCase().includes('challenge');
          if (isCfChallenge) {
            return networkRes;
          }

          const contentType = String(networkRes.headers.get('content-type') || '').toLowerCase();
          if (!networkRes.ok || !contentType.includes('text/html')) {
            const fallbackHtml = await caches.match('/index.html').then((r) => r || caches.match('/'));
            return fallbackHtml || networkRes;
          }
          if (url.origin === self.location.origin) {
            const resClone = networkRes.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(url.pathname, resClone)).catch(() => {});
          }
          return networkRes;
        })
        .catch(async () => {
          // Slow/waking server -> serve cached shell immediately & refresh silently in background
          if (url.origin === self.location.origin) {
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

  // 3. Same-origin static assets (icons, local JS, manifest): Cache-First with background refresh
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cached = await cache.match(req, { ignoreSearch: true });
        const bgFetch = fetch(req)
          .then((netRes) => {
            if (netRes && netRes.ok) {
              const ct = String(netRes.headers.get('content-type') || '').toLowerCase();
              if (!ct.includes('text/html')) {
                cache.put(req, netRes.clone()).catch(() => {});
              }
            }
            return netRes;
          })
          .catch(() => null);

        if (cached) {
          event.waitUntil(bgFetch);
          return cached;
        }
        const netRes = await bgFetch;
        return netRes || new Response('', { status: 503, statusText: 'Offline' });
      })
    );
  }
});
