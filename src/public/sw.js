const CACHE_NAME = "stockline-shell-v3";
const SHELL_URLS = ["/", "/manifest.json", "/icon-192.png", "/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_URLS)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // API calls always go to the network. When there's no connection the app
  // itself falls back to its saved copy and offline queue.
  if (url.pathname.startsWith("/api/")) return;
  if (event.request.method !== "GET" || url.origin !== self.location.origin) return;

  // Network first, cache as backup: online you always get the newest
  // deploy (no stale code), and every successful load refreshes the saved
  // copy so the app can still open with no internet.
  const isPage = event.request.mode === "navigate";
  event.respondWith(
    fetch(event.request)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(isPage ? "/" : event.request, copy));
        }
        return res;
      })
      .catch(() =>
        caches.match(isPage ? "/" : event.request).then((cached) => cached || Response.error())
      )
  );
});
