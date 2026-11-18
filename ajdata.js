/* ajcoin-miniapp v19.3 — market data that works without a VPN.
   Every request to the public Gate.io REST API goes through this layer:
     1) direct Gate.io (fast path when reachable)
     2) public snapshot published by our bot to raw.githubusercontent.com (no Gate needed)
     3) the app's own saved copy (existing cachedFetch / localStorage logic)
   The snapshot holds PUBLIC market data only (prices, candles, order books). Never balances or keys.
   raw.githubusercontent.com caches each URL ~5 min and ignores query strings, so the bot writes a
   new file name every minute (m/<minute>.json) and every 5 minutes for candles (c/<5min>/…). */
(function () {
  "use strict";
  if (window.AjData) return;
  var RAW = "https://raw.githubusercontent.com/sbeshr2025-creator/ajcoin-data/main/";
  var GATE_RE = /^https:\/\/api\.gateio\.ws\/api\/v4(\/[^?#]*)(\?[^#]*)?/;
  var HEDGE_MS = 1500, DIRECT_MAX_MS = 6000, DOWN_MS = 180000;
  var nativeFetch = window.fetch.bind(window);
  var st = { downUntil: 0, skew: 0, m: null, mB: -1, mNext: 0, mP: null, c5: {}, h: null, hAt: 0, hP: null,
             src: "", snapT: 0, lastDirect: 0, probing: false };
  try { st.downUntil = Number(localStorage.getItem("aj_gate_down") || 0); if (st.downUntil > Date.now() + DOWN_MS) st.downUntil = 0; } catch (e) {}
  try { st.skew = Number(localStorage.getItem("aj_snap_skew") || 0) || 0; } catch (e) {}

  function now() { return Date.now() / 1000 + st.skew; }
  function timeoutFetch(input, init, ms) {
    var ac = typeof AbortController === "function" ? new AbortController() : null;
    var opts = Object.assign({}, init || {}); if (ac) opts.signal = ac.signal;
    return new Promise(function (res, rej) {
      var t = setTimeout(function () { try { ac && ac.abort(); } catch (e) {} rej(new Error("timeout")); }, ms);
      nativeFetch(input, opts).then(function (r) { clearTimeout(t); res(r); }, function (e) { clearTimeout(t); rej(e); });
    });
  }
  function rawJson(path, ms) {
    return timeoutFetch(RAW + path, { cache: "no-store", credentials: "omit" }, ms || 8000).then(function (r) {
      if (!r.ok) { var e = new Error("http " + r.status); e.status = r.status; throw e; }
      return r.json();
    });
  }
  function markDown() {
    st.downUntil = Date.now() + DOWN_MS;
    try { localStorage.setItem("aj_gate_down", String(st.downUntil)); } catch (e) {}
  }
  function markUp() {
    st.lastDirect = Date.now();
    if (st.downUntil) { st.downUntil = 0; try { localStorage.removeItem("aj_gate_down"); } catch (e) {} }
    if (st.src !== "direct") { st.src = "direct"; window.__AJ_SNAP = { on: false, t: 0 }; }
  }
  function gateDown() { return Date.now() < st.downUntil; }

  /* ---------- snapshot readers ---------- */
  function adoptSkew(t) { // phone clock far off? learn the offset from the snapshot's own clock
    var d = t - Date.now() / 1000;
    if (Math.abs(d - st.skew) > 120) { st.skew = Math.abs(d) > 120 ? Math.round(d) : 0; try { localStorage.setItem("aj_snap_skew", String(st.skew)); } catch (e) {} }
  }
  async function latest() { return rawJson("latest.json", 8000); }
  async function minute() {
    if (st.m && now() < st.mNext) return st.m;
    if (st.mP) return st.mP;
    st.mP = (async function () {
      var b = Math.floor((now() - 25) / 60), m = null;
      for (var i = 0; i < 3 && !m; i++) { try { m = await rawJson("m/" + (b - i) + ".json", 6000); } catch (e) { if (!e.status) break; } }
      if (!m) { // clock skew or the bot paused: ask latest.json which minute exists
        var L = await latest(); adoptSkew(L.t);
        m = await rawJson("m/" + L.b + ".json", 8000);
      }
      if (st.m && m.t < st.m.t) m = st.m; // never step back
      st.m = m; st.mB = m.b; st.snapT = m.t * 1000;
      if (Math.abs(m.t - Date.now() / 1000) > 900) adoptSkew(m.t + 60);
      st.mNext = (m.b + 1) * 60 + 25; if (st.mNext < now()) st.mNext = now() + 30; // stale: re-check in 30 s
      return m;
    })().finally(function () { st.mP = null; });
    return st.mP;
  }
  async function hourly() {
    if (st.h && Date.now() - st.hAt < 1800000) return st.h;
    if (st.hP) return st.hP;
    st.hP = (async function () {
      var bh = Math.floor((now() - 120) / 3600), h = null;
      for (var i = 0; i < 2 && !h; i++) { try { h = await rawJson("h/" + (bh - i) + ".json", 10000); } catch (e) { if (!e.status) break; } }
      if (!h) h = await rawJson("meta.json", 10000);
      st.h = h; st.hAt = Date.now(); return h;
    })().finally(function () { st.hP = null; });
    return st.hP;
  }
  async function candleIndex() {
    var b5 = Math.floor((now() - 40) / 300);
    for (var i = 0; i < 2; i++) {
      var k = b5 - i;
      if (st.c5[k]) return { b5: k, idx: st.c5[k] };
      try { var idx = await rawJson("c/" + k + "/index.json", 6000); st.c5 = {}; st.c5[k] = idx; return { b5: k, idx: idx }; }
      catch (e) { if (!e.status) throw e; }
    }
    var L = await latest(); adoptSkew(L.t);
    var idx2 = await rawJson("c/" + L.b5 + "/index.json", 8000); st.c5 = {}; st.c5[L.b5] = idx2;
    return { b5: L.b5, idx: idx2 };
  }

  var S_KEYS = ["currency_pair", "last", "change_percentage", "quote_volume", "base_volume", "lowest_ask", "highest_bid", "high_24h", "low_24h"];
  var F_KEYS = ["contract", "last", "change_percentage", "mark_price", "funding_rate", "volume_24h_quote", "high_24h", "low_24h", "index_price", "volume_24h"];
  var SP_KEYS = ["id", "base", "buy_start", "sell_start", "trade_status", "min_quote_amount", "min_base_amount", "precision", "amount_precision"];
  var FC_KEYS = ["name", "in_delisting", "leverage_max", "quanto_multiplier", "order_size_min", "mark_price", "funding_rate", "launch_time", "create_time", "trade_size", "last_price", "change_percentage"];
  function objs(rows, keys, num, extra) {
    return (rows || []).map(function (r) {
      var o = {}; for (var i = 0; i < keys.length; i++) o[keys[i]] = (num && i > 0 && typeof r[i] === "number") ? String(r[i]) : r[i];
      if (extra) extra(o); return o;
    });
  }

  async function fromSnapshot(path, q) {
    var pair = q.get("currency_pair") || q.get("contract") || "";
    var limit = Number(q.get("limit") || 0);
    if (path === "/spot/tickers") { var m = await minute(); return objs(m.s, S_KEYS, true); }
    if (path === "/futures/usdt/tickers") { var m2 = await minute(); return objs(m2.f, F_KEYS, true, function (o) { o.volume_24h_base = o.volume_24h; }); }
    if (path === "/spot/order_book") { var m3 = await minute(); if (m3.ob && m3.ob[pair]) return m3.ob[pair]; return null; }
    if (path === "/spot/trades") { var m4 = await minute(); if (m4.tr && m4.tr[pair]) return m4.tr[pair]; return null; }
    if (path === "/spot/candlesticks" || path === "/futures/usdt/candlesticks") {
      var tf = q.get("interval") || "1h", name = (path.indexOf("/futures/") === 0 ? "F_" : "") + pair;
      var ci = await candleIndex();
      if (!(ci.idx[name] || []).includes(tf)) return null;
      var rows = await rawJson("c/" + ci.b5 + "/" + name + "_" + tf + ".json", 8000);
      return limit && rows.length > limit ? rows.slice(rows.length - limit) : rows;
    }
    if (path === "/spot/currency_pairs") { var h = await hourly(); return objs(h.sp, SP_KEYS, false, function (o) { o.quote = "USDT"; o.min_quote_amount = String(o.min_quote_amount); }); }
    if (path.indexOf("/spot/currency_pairs/") === 0) {
      var id = decodeURIComponent(path.slice(21)), h2 = await hourly();
      var row = (h2.sp || []).find(function (r) { return r[0] === id; });
      if (!row) return null;
      var o = objs([row], SP_KEYS)[0]; o.quote = "USDT"; o.min_quote_amount = String(o.min_quote_amount); return o;
    }
    if (path === "/futures/usdt/contracts") {
      var h3 = await hourly();
      return objs(h3.fc, FC_KEYS, false, function (o) { o.in_delisting = !!o.in_delisting; o.leverage_max = String(o.leverage_max); o.quanto_multiplier = String(o.quanto_multiplier); o.mark_price = String(o.mark_price); o.funding_rate = String(o.funding_rate); });
    }
    return null;
  }
  async function snapResponse(path, q) {
    var data = await fromSnapshot(path, q);
    if (data == null) return new Response(JSON.stringify({ label: "NOT_IN_SNAPSHOT" }), { status: 404, headers: { "Content-Type": "application/json" } });
    if (/tickers$/.test(path)) st.src = "snapshot";
    return new Response(JSON.stringify(data), { status: 200, headers: { "Content-Type": "application/json", "X-Aj-Src": "snapshot" } });
  }

  function probe() { // while Gate is marked down, check quietly once a minute whether it came back
    if (st.probing || !gateDown()) return;
    st.probing = true;
    timeoutFetch("https://api.gateio.ws/api/v4/spot/currency_pairs/BTC_USDT", { cache: "no-store", credentials: "omit" }, 5000)
      .then(function (r) { if (r.ok) markUp(); }, function () {}).finally(function () { st.probing = false; });
  }
  setInterval(probe, 60000);

  async function gateRoute(input, init, path, q) {
    if (gateDown()) {
      try { return await snapResponse(path, q); }
      catch (e) { return timeoutFetch(input, init, DIRECT_MAX_MS).then(function (r) { markUp(); return r; }); }
    }
    var direct = timeoutFetch(input, init, DIRECT_MAX_MS);
    direct.then(function (r) { if (r.status < 500) markUp(); }, function () { markDown(); });
    var hedgeTimer;
    var hedged = new Promise(function (res, rej) {
      hedgeTimer = setTimeout(function () { snapResponse(path, q).then(res, rej); }, HEDGE_MS);
    });
    return new Promise(function (resolve, reject) {
      var fails = 0;
      direct.then(function (r) { clearTimeout(hedgeTimer); resolve(r); },
        function () { clearTimeout(hedgeTimer); snapResponse(path, q).then(resolve, function (e) { if (++fails >= 1) reject(e); }); });
      hedged.then(function (r) { if (r.ok) resolve(r); }, function () {});
    });
  }

  window.fetch = function (input, init) {
    var url = typeof input === "string" ? input : (input && input.url) || "";
    var m = GATE_RE.exec(url);
    if (!m || (init && init.method && init.method !== "GET") || /^\/wallet\//.test(m[1])) return nativeFetch(input, init);
    return gateRoute(input, init, m[1], new URLSearchParams(m[2] || ""));
  };

  /* ---------- UI: tell the user where prices come from ---------- */
  function ago(ms) { var s = Math.max(0, Math.round(ms / 1000)); return s < 60 ? s + "ث" : Math.round(s / 60) + "د"; }
  setInterval(function () {
    if (st.src !== "snapshot") return;
    if (st.lastDirect && Date.now() - st.lastDirect < 20000) return;
    var el = document.getElementById("src");
    if (el) { var txt = "لقطة Gate · قبل " + ago(Date.now() - (st.snapT || Date.now())); if (el.textContent !== txt) el.textContent = txt; }
    window.__AJ_SNAP = { on: true, t: st.snapT };
  }, 1000);

  window.AjData = {
    state: function () { return { src: st.src, gateDown: gateDown(), snapT: st.snapT, skew: st.skew, minute: st.mB }; },
    minute: minute, hourly: hourly, raw: RAW
  };
})();
