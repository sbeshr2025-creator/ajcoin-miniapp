/* ajcoin-miniapp service worker v19.2 — safe updates, never blocks the first screen.
   - index.html: network with a short timeout, else the cached copy (cache key has NO query: ?bal/?deps never stored)
   - versioned app files (?v=…): cache-first (immutable per version), else network
   - CDN libraries (Telegram SDK, charts, QR): kept in a persistent cache that survives version bumps,
     served instantly and refreshed in the background
   - Gate.io API and everything else: not touched */
const VERSION = "19.2";
const APP = "ajcoin-v" + VERSION;
const CDN = "ajcoin-cdn-v1";
const NAV_TIMEOUT = 2500;
const PRECACHE = ["./index.html", "./inflate.js?v=" + VERSION, "./v15.js?v=" + VERSION, "./v16-team.js?v=" + VERSION,
  "./v17.js?v=" + VERSION, "./v18.js?v=" + VERSION, "./v19.js?v=" + VERSION, "./manifest.webmanifest"];
const CDN_RE = /(^|\.)(jsdelivr\.net|telegram\.org)$/;

function timeout(ms) { return new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), ms)); }
async function putSafe(cacheName, key, resp) {
  try { if (resp && (resp.ok || resp.type === "opaque")) { const c = await caches.open(cacheName); await c.put(key, resp); } } catch (e) {}
}
function indexKey() { return new URL("./index.html", self.registration.scope).toString(); }

self.addEventListener("install", event => {
  self.skipWaiting();
  event.waitUntil(Promise.race([
    (async () => {
      const c = await caches.open(APP);
      await Promise.allSettled(PRECACHE.map(async u => {
        const r = await fetch(new Request(u, { cache: "reload" }));
        if (r.ok) await c.put(new URL(u, self.registration.scope).toString(), r);
      }));
    })(),
    new Promise(r => setTimeout(r, 8000))
  ]).catch(() => {}));
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    const cdn = await caches.open(CDN);
    for (const k of keys) {
      if (k === APP || k === CDN) continue;
      try { // keep already-downloaded CDN libraries from older caches
        const old = await caches.open(k);
        for (const req of await old.keys()) {
          let host = ""; try { host = new URL(req.url).hostname; } catch (e) {}
          if (CDN_RE.test(host) && !(await cdn.match(req))) { const r = await old.match(req); if (r) await cdn.put(req, r); }
        }
      } catch (e) {}
      await caches.delete(k);
    }
    await self.clients.claim();
  })());
});

function isIndex(url, req) {
  return req.mode === "navigate" || url.pathname.endsWith("/") || url.pathname.endsWith("/index.html");
}

self.addEventListener("fetch", event => {
  const req = event.request;
  if (req.method !== "GET") return;
  let url; try { url = new URL(req.url); } catch (e) { return; }

  if (url.origin === location.origin) {
    if (isIndex(url, req)) {
      const key = indexKey();
      event.respondWith((async () => {
        const net = fetch(req).then(r => { if (r.ok) putSafe(APP, key, r.clone()); return r; });
        try { return await Promise.race([net, timeout(NAV_TIMEOUT)]); }
        catch (e) {
          const hit = await caches.match(key);
          if (hit) { event.waitUntil(net.catch(() => {})); return hit; }
          return net;
        }
      })());
      return;
    }
    if (url.searchParams.has("v")) { // versioned → immutable
      event.respondWith((async () => {
        const hit = await caches.match(req);
        if (hit) return hit;
        const r = await fetch(req);
        putSafe(APP, req, r.clone());
        return r;
      })());
      return;
    }
    if (/\.(png|webmanifest|json)$/.test(url.pathname)) { // stale-while-revalidate
      event.respondWith((async () => {
        const hit = await caches.match(req);
        const net = fetch(req).then(r => { putSafe(APP, req, r.clone()); return r; });
        if (hit) { event.waitUntil(net.catch(() => {})); return hit; }
        return net;
      })());
    }
    return;
  }

  if (CDN_RE.test(url.hostname)) { // persistent CDN cache, refreshed in background
    event.respondWith((async () => {
      const hit = await caches.match(req);
      if (hit) {
        // pinned library versions (…@x.y.z) never change; only the small Telegram SDK is refreshed in the background
        if (/telegram\.org$/.test(url.hostname)) event.waitUntil(fetch(req).then(r => putSafe(CDN, req, r)).catch(() => {}));
        return hit;
      }
      const r = await fetch(req);
      putSafe(CDN, req, r.clone());
      return r;
    })());
  }
});

self.addEventListener("message", e => { if (e.data === "skipWaiting") self.skipWaiting(); });
