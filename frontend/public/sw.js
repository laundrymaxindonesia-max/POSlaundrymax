/* eslint-disable no-restricted-globals */
/**
 * LaundryMax Service Worker — minimal PWA install shim.
 *
 * The Chrome mobile "Add to Home Screen" prompt requires:
 *   1. A valid manifest linked from index.html
 *   2. A registered Service Worker that handles at least one `fetch` event
 *
 * We deliberately keep the caching layer minimal — full offline support
 * would break the live-order data flow (POS relies on real-time backend
 * calls). This SW passes every request through to the network so the app
 * stays "online-first", but still satisfies the installability criteria.
 */

const CACHE_NAME = "laundrymax-shell-v1";
const APP_SHELL = ["/", "/manifest.json"];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .catch(() => {})
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k !== CACHE_NAME)
            .map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  // Never cache API traffic — orders / customers must always be fresh.
  const url = new URL(event.request.url);
  if (url.pathname.startsWith("/api/")) return;

  // Network-first for everything else; fall back to cached shell if offline.
  event.respondWith(
    fetch(event.request).catch(() =>
      caches.match(event.request).then((cached) => cached || caches.match("/"))
    )
  );
});
