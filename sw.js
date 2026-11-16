/* Network-first for the app page so updates (v6-deposit) go live; cache CDN shells only. */
const CACHE = "ajcoin-v6-deposit";
self.addEventListener("install", e => { self.skipWaiting(); });
self.addEventListener("activate", e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});
self.addEventListener("fetch", event => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET") return;
  const isApp = url.origin === location.origin;
  if (isApp) {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(event.request);
        const cache = await caches.open(CACHE);
        cache.put(event.request, fresh.clone());
        return fresh;
      } catch (err) {
        const hit = await caches.match(event.request);
        if (hit) return hit;
        throw err;
      }
    })());
    return;
  }
  if (/jsdelivr|telegram\.org/.test(url.hostname)) {
    event.respondWith((async () => {
      const hit = await caches.match(event.request);
      if (hit) return hit;
      const fresh = await fetch(event.request);
      const cache = await caches.open(CACHE);
      cache.put(event.request, fresh.clone());
      return fresh;
    })());
  }
});
