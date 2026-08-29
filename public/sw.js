// BUILD_ID is stamped from the app source before every production build.
const BUILD_ID = "7f1a94bd1a8e";
const CACHE_NAME = `reparc-shell-${BUILD_ID}`;
const CORE_ASSETS = ["/", "/manifest.webmanifest", "/favicon.svg", "/icon-192.png", "/icon-512.png"];

const canCache = (response) => response && response.ok && response.type === "basic";

async function cacheAppShell() {
  const cache = await caches.open(CACHE_NAME);
  await Promise.allSettled(CORE_ASSETS.map(async (asset) => {
    const response = await fetch(asset, { cache: "no-cache" });
    if (canCache(response)) await cache.put(asset, response.clone());
  }));

  const page = await cache.match("/");
  if (!page) return;
  const html = await page.text();
  const assetPaths = [...html.matchAll(/(?:src|href)=["']([^"']+)["']/g)]
    .map((match) => match[1])
    .filter((path) => path.startsWith("/_next/static/"));

  await Promise.allSettled([...new Set(assetPaths)].map(async (asset) => {
    const response = await fetch(asset);
    if (canCache(response)) await cache.put(asset, response.clone());
  }));
}

self.addEventListener("install", (event) => {
  event.waitUntil(cacheAppShell());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys
      .filter((key) => (key.startsWith("my-progress-shell-") || key.startsWith("reparc-shell-")) && key !== CACHE_NAME)
      .map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

async function navigationResponse(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await fetch(request);
    if (canCache(response)) {
      await cache.put("/", response.clone());
      void cacheAppShell().catch(() => undefined);
    }
    return response;
  } catch {
    const cached = await cache.match("/");
    if (cached) return cached;
    return new Response(
      "<!doctype html><html><head><meta name=\"viewport\" content=\"width=device-width\"><title>RepArc</title></head><body style=\"margin:0;background:#0b0d0c;color:#f5f5f4;font:16px system-ui;display:grid;min-height:100vh;place-items:center\"><main><h1>RepArc</h1><p>The app shell is not cached yet. Reconnect once, then try again.</p></main></body></html>",
      { headers: { "Content-Type": "text/html; charset=utf-8" }, status: 503 },
    );
  }
}

async function staticAssetResponse(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (canCache(response)) await cache.put(request, response.clone());
  return response;
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;

  if (request.mode === "navigate") {
    event.respondWith(navigationResponse(request));
    return;
  }

  if (url.pathname.startsWith("/_next/static/") || CORE_ASSETS.includes(url.pathname)) {
    event.respondWith(staticAssetResponse(request));
  }
});

self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") void self.skipWaiting();
});
