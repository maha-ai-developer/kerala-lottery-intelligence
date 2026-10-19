/**
 * Kerala Lottery Intelligence — Service Worker (sw.js)
 *
 * Scientific & Operational Caching Policy:
 * 1. NEVER cache /api/* routes (including /api/ops/*, /api/internal/*, /api/v1/*)
 *    or requests carrying Authorization headers. Live research and cloud-integrity
 *    telemetry must never be served from a stale cache as authoritative data.
 * 2. Navigation requests use strict Network-First. When the network is unreachable,
 *    the Service Worker serves the dedicated /offline notice page rather than stale
 *    data pages, ensuring offline status is never misrepresented as current draw data.
 * 3. Only immutable static bundle assets (/_next/static/*), PWA icons (/icons/*),
 *    manifest, and the explicit /offline shell are cached under a versioned key.
 */

const CACHE_VERSION = "kli-shell-v1.0.0";
const OFFLINE_URL = "/offline";

const PRECACHE_ASSETS = [
  OFFLINE_URL,
  "/manifest.webmanifest",
  "/manifest.json",
  "/icon.svg",
  "/favicon.ico",
  "/icons/icon-192x192.png",
  "/icons/icon-512x512.png",
  "/icons/icon-maskable-512x512.png",
  "/icons/apple-touch-icon.png"
];

const INLINE_OFFLINE_HTML = `<!DOCTYPE html>
<html lang="en" data-theme="dark">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Offline — Kerala Lottery Intelligence</title>
  <style>
    body {
      margin: 0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: #0b1120;
      color: #f8fafc;
      display: flex;
      min-height: 100vh;
      align-items: center;
      justify-content: center;
      padding: 1.5rem;
    }
    .card {
      max-width: 540px;
      background: #111827;
      border: 1px solid #1e293b;
      border-radius: 12px;
      padding: 2rem;
    }
    .badge {
      display: inline-block;
      padding: 0.25rem 0.65rem;
      border-radius: 9999px;
      font-size: 0.75rem;
      font-weight: 700;
      text-transform: uppercase;
      background: rgba(245, 158, 11, 0.15);
      color: #fbbf24;
      border: 1px solid rgba(245, 158, 11, 0.35);
      margin-bottom: 1rem;
    }
    h1 { font-size: 1.4rem; margin: 0 0 0.75rem; }
    p { color: #94a3b8; line-height: 1.6; font-size: 0.92rem; margin: 0 0 1rem; }
    button {
      background: #2563eb;
      color: #ffffff;
      border: none;
      border-radius: 8px;
      padding: 0.75rem 1.25rem;
      font-weight: 600;
      font-size: 0.9rem;
      min-height: 44px;
      cursor: pointer;
    }
  </style>
</head>
<body>
  <main class="card">
    <span class="badge">Network Offline</span>
    <h1>Live Research Corpus Unavailable Offline</h1>
    <p>Kerala Lottery Intelligence requires an active network connection to verify cryptographic SHA-256 draw provenance, historical statistics, and operational telemetry.</p>
    <p>To preserve scientific integrity, stale or cached draw results are never presented as authoritative live data while offline.</p>
    <button type="button" onclick="window.location.reload()">Retry Connection</button>
  </main>
</body>
</html>`;

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_VERSION);
      await Promise.allSettled(
        PRECACHE_ASSETS.map(async (assetUrl) => {
          try {
            const response = await fetch(assetUrl, { cache: "reload" });
            if (response && response.ok) {
              await cache.put(assetUrl, response.clone());
            }
          } catch {
            // Individual asset failure does not block Service Worker installation
          }
        })
      );
      await self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key !== CACHE_VERSION)
          .map((oldKey) => caches.delete(oldKey))
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

function isStaticAssetPathname(pathname) {
  return (
    pathname.startsWith("/_next/static/") ||
    pathname.startsWith("/icons/") ||
    pathname === "/icon.svg" ||
    pathname === "/favicon.ico" ||
    pathname === "/manifest.webmanifest" ||
    pathname === "/manifest.json"
  );
}

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // 1. Only handle GET requests
  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);

  // 2. Ignore cross-origin requests
  if (url.origin !== self.location.origin) {
    return;
  }

  // 3. STRICT SAFETY RULE: Never intercept or cache API routes, auth-bearing requests,
  //    or Next.js RSC flight payloads.
  if (
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/_next/webpack-hmr") ||
    request.headers.has("authorization") ||
    request.headers.get("RSC") === "1" ||
    url.searchParams.has("_rsc")
  ) {
    return;
  }

  // 4. HTML document navigations: Network-First with explicit /offline fallback
  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const networkResponse = await fetch(request);
          // Opportunistically refresh the cached /offline shell if the user visits /offline
          if (url.pathname === OFFLINE_URL && networkResponse && networkResponse.ok) {
            const cache = await caches.open(CACHE_VERSION);
            cache.put(OFFLINE_URL, networkResponse.clone());
          }
          return networkResponse;
        } catch {
          const cache = await caches.open(CACHE_VERSION);
          const cachedOffline = await cache.match(OFFLINE_URL);
          if (cachedOffline) {
            return cachedOffline;
          }
          return new Response(INLINE_OFFLINE_HTML, {
            status: 503,
            statusText: "Service Unavailable (Offline)",
            headers: { "Content-Type": "text/html; charset=utf-8" }
          });
        }
      })()
    );
    return;
  }

  // 5. Static application shell assets: Stale-While-Revalidate
  if (isStaticAssetPathname(url.pathname)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE_VERSION);
        const cached = await cache.match(request);
        const networkPromise = fetch(request)
          .then((response) => {
            if (response && response.status === 200) {
              cache.put(request, response.clone());
            }
            return response;
          })
          .catch(() => null);

        if (cached) {
          return cached;
        }
        const live = await networkPromise;
        if (live) {
          return live;
        }
        return new Response("Offline static asset unavailable", { status: 504 });
      })()
    );
  }
});
