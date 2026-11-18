/* ajcoin-miniapp service worker v21 (based on v19.3) — safe updates, never blocks the first screen.
   v19.3: every library is self-hosted (no CDN). Old caches, including the v19.2 CDN cache, are dropped.
   - index.html: network with a short timeout, else the cached copy (cache key has NO query: ?bal/?deps never stored)
   - versioned app files (?v=…): cache-first (immutable per version), else network
   - Gate.io API and the market-data snapshot (raw.githubusercontent.com): not touched (always live) */
const VERSION = "21";
const APP = "ajcoin-v" + VERSION;
const NAV_TIMEOUT = 2500;
const PRECACHE = ["./index.html", "./inflate.js?v=" + VERSION, "./v15.js?v=" + VERSION, "./v16-team.js?v=" + VERSION,
  "./v17.js?v=" + VERSION, "./v18.js?v=" + VERSION, "./v19.js?v=" + VERSION, "./v20.js?v=" + VERSION, "./v21.js?v=" + VERSION,
  "./ajdata.js?v=" + VERSION, "./tg-web-app.js?v=" + VERSION, "./lib-lwc-4.2.3.js?v=" + VERSION, "./lib-qrcode-1.4.4.js?v=" + VERSION,
  "./manifest.webmanifest"];

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
    for (const k of keys) if (k !== APP) await caches.delete(k);
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

});

self.addEventListener("message", e => { if (e.data === "skipWaiting") self.skipWaiting(); });
