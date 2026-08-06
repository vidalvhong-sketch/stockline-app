const CACHE_NAME = "stockline-shell-v2";
const SHELL_URLS = ["/manifest.json", "/icon-192.png", "/icon-512.png"];

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

  // Never touch API calls — those must always hit the network so data
  // stays live and authenticated. Let the browser handle them normally.
  if (url.pathname.startsWith("/api/")) return;

  if (event.request.method !== "GET" || url.origin !== self.location.origin) return;

  // Only the truly static icons/manifest get cached. The HTML shell and the
  // JS bundle are deliberately left alone here (falling through to a normal,
  // uncached network fetch) so that a new deploy is picked up on the very
  // next page load instead of one load later \u2014 this app updates often
  // enough that stale cached code was actually causing real bugs (users
  // testing a feature against yesterday's build without realizing it).
  const isStaticAsset = SHELL_URLS.includes(url.pathname);
  if (!isStaticAsset) return;

  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});
