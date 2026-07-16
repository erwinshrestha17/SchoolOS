const CACHE_PREFIX = "schoolos-public-static-";
const CACHE_VERSION = "2026-07-16-v2";
const CACHE_NAME = `${CACHE_PREFIX}${CACHE_VERSION}`;
const MAX_RUNTIME_STATIC_ENTRIES = 64;
const OFFLINE_FALLBACK = "/offline.html";
const PUBLIC_ASSET_PATHS = new Set([
  OFFLINE_FALLBACK,
  "/manifest.webmanifest",
  "/icons/schoolos.svg",
  "/icons/schoolos-192.png",
  "/icons/schoolos-512.png",
  "/icons/schoolos-maskable-192.png",
  "/icons/schoolos-maskable-512.png",
]);
const NEXT_STATIC_DESTINATIONS = new Set([
  "script",
  "style",
  "font",
  "worker",
]);
const PRIVATE_PATH_PREFIXES = [
  "/api/",
  "/auth/",
  "/dashboard",
  "/platform",
  "/files/",
  "/reports/",
  "/exports/",
  "/downloads/",
  "/uploads/",
  "/_next/data/",
  "/_next/image",
];

function hasSensitiveQuery(url) {
  for (const key of url.searchParams.keys()) {
    const normalized = key.toLowerCase();
    if (
      normalized === "token" ||
      normalized === "signature" ||
      normalized === "sig" ||
      normalized === "expires" ||
      normalized === "policy" ||
      normalized === "key-pair-id" ||
      normalized.startsWith("x-amz-") ||
      normalized.startsWith("x-goog-")
    ) {
      return true;
    }
  }

  return false;
}

function isExplicitPublicAsset(request, url) {
  return (
    request.method === "GET" &&
    url.origin === self.location.origin &&
    !url.search &&
    PUBLIC_ASSET_PATHS.has(url.pathname)
  );
}

function isForbiddenFromCache(request, url) {
  return (
    request.method !== "GET" ||
    url.origin !== self.location.origin ||
    request.headers.has("authorization") ||
    request.headers.has("rsc") ||
    url.searchParams.has("_rsc") ||
    hasSensitiveQuery(url) ||
    PRIVATE_PATH_PREFIXES.some((prefix) => url.pathname.startsWith(prefix)) ||
    (request.destination === "image" &&
      !PUBLIC_ASSET_PATHS.has(url.pathname))
  );
}

function isImmutableNextStatic(request, url) {
  return (
    !isForbiddenFromCache(request, url) &&
    url.pathname.startsWith("/_next/static/") &&
    NEXT_STATIC_DESTINATIONS.has(request.destination)
  );
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  if (cached) {
    return cached;
  }

  const response = await fetch(request);
  if (!response.ok || response.type !== "basic") {
    return response;
  }

  const url = new URL(request.url);
  const isPublicAsset = isExplicitPublicAsset(request, url);
  const isImmutable =
    isImmutableNextStatic(request, url) &&
    (response.headers.get("cache-control") || "").includes("immutable");

  if (isPublicAsset || isImmutable) {
    await cache.put(request, response.clone());
    await trimRuntimeStaticEntries(cache);
  }

  return response;
}

async function trimRuntimeStaticEntries(cache) {
  const cachedRequests = await cache.keys();
  const runtimeStaticRequests = cachedRequests.filter((cachedRequest) => {
    const cachedUrl = new URL(cachedRequest.url);
    return !PUBLIC_ASSET_PATHS.has(cachedUrl.pathname);
  });
  const excessEntryCount =
    runtimeStaticRequests.length - MAX_RUNTIME_STATIC_ENTRIES;

  if (excessEntryCount <= 0) {
    return;
  }

  await Promise.all(
    runtimeStaticRequests
      .slice(0, excessEntryCount)
      .map((cachedRequest) => cache.delete(cachedRequest)),
  );
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll([...PUBLIC_ASSET_PATHS]))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter(
              (key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME,
            )
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Never cache HTML or RSC payloads. Same-origin navigations stay
  // network-only and receive the public fallback only when the network fails.
  if (
    request.method === "GET" &&
    request.mode === "navigate" &&
    url.origin === self.location.origin
  ) {
    event.respondWith(
      fetch(request).catch(() => caches.match(OFFLINE_FALLBACK)),
    );
    return;
  }

  if (isForbiddenFromCache(request, url)) {
    return;
  }

  if (isExplicitPublicAsset(request, url) || isImmutableNextStatic(request, url)) {
    event.respondWith(cacheFirst(request));
  }
});
