/* ajcoin-miniapp v15-auto — trade sheet, command palette, Gate WS live prices */
(function () {
  "use strict";
  var FEE_RATE = 0.002;
  var RECENT_KEY = "aj-recent-v14";
  var WS_URL = "wss://api.gateio.ws/ws/v4/";
  var REST_MS = 8000;
  var sheet = { open: false, pair: "BTC_USDT", kind: "spot", tab: "spot", chart: null, series: null, minQuote: 0, maxLev: 20 };
  var cmdOpen = false;
  var live = { ok: false, ws: null, ping: 0, reconnect: 0, wantedSpot: [], wantedFut: [], rest: 0 };
  var recent = [];
  var anims = {};

  function Aj() { return window.Aj || {}; }
  function $(id) { return document.getElementById(id); }
  function tg() { return Aj().tg || window.Telegram && window.Telegram.WebApp; }
  function haptic(k) { try { (Aj().haptic || function () {})(k); } catch (e) {} }
  function toast(m, k) { try { (Aj().toast || function (x) { console.log(x); })(m, k); } catch (e) {} }
  function fmt(n, d) { return (Aj().fmt || function (x, dd) {
    x = Number(x); if (!isFinite(x)) return "—";
    return x.toLocaleString("en-US", { maximumFractionDigits: dd == null ? 6 : dd });
  })(n, d); }
  function baseSym(p) { return (Aj().baseSym || function (x) {
    x = String(x || "").toUpperCase();
    return x.endsWith("_USDT") ? x.slice(0, -5) : x;
  })(p); }
  function capS() { return Aj().TRADE_CAP || 3; }
  function capF() { return Aj().FUT_CAP || 1; }
  function maxLev() { return Aj().FUT_MAX_LEV || 20; }
  function gate() { return Aj().GATE || "https://api.gateio.ws/api/v4"; }

  function injectCss() {
    if ($("v14-css")) return;
    var s = document.createElement("style");
    s.id = "v14-css";
    s.textContent = [
      ":root{--glass:rgba(20,26,34,.74);--safe-b:env(safe-area-inset-bottom,0px)}",
      "body{padding-bottom:calc(72px + env(safe-area-inset-bottom,0px))}",
      ".icon-btn{border:1px solid var(--line);background:color-mix(in srgb,var(--card) 80%,transparent);color:var(--text);border-radius:12px;width:36px;height:36px;font-size:18px;display:inline-flex;align-items:center;justify-content:center}",
      ".title{align-items:center}",
      ".row,.fut-row,.new-row,.card{backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px)}",
      ".flash-up{animation:ajFlashUp .4s ease}",
      ".flash-down{animation:ajFlashDn .4s ease}",
      "@keyframes ajFlashUp{from{background:#16c78455}to{background:transparent}}",
      "@keyframes ajFlashDn{from{background:#ea394355}to{background:transparent}}",
      ".skel{background:linear-gradient(90deg,var(--card) 25%,var(--card-2) 50%,var(--card) 75%);background-size:200% 100%;animation:ajSkel 1.1s infinite;border-radius:10px;min-height:14px}",
      "@keyframes ajSkel{0%{background-position:200% 0}100%{background-position:-200% 0}}",
      "#offline-bar{position:sticky;top:0;z-index:28;background:#ea3943cc;color:#fff;text-align:center;font-size:12px;padding:6px 8px;display:none}",
      "#offline-bar.on{display:block}",
      "#sheet-root{position:fixed;inset:0;z-index:40;pointer-events:none}",
      "#sheet-root.open{pointer-events:auto}",
      "#sheet-mask{position:absolute;inset:0;background:#0007;opacity:0;transition:opacity .2s}",
      "#sheet-root.open #sheet-mask{opacity:1}",
      "#trade-sheet{position:absolute;left:0;right:0;bottom:0;max-height:90dvh;overflow:auto;",
      "background:color-mix(in srgb,var(--card) 90%,transparent);backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px);",
      "border:1px solid var(--line);border-bottom:0;border-top-left-radius:20px;border-top-right-radius:20px;",
      "padding:8px 14px calc(14px + env(safe-area-inset-bottom,0px));transform:translateY(110%);transition:transform .28s cubic-bezier(.2,.8,.2,1)}",
      "#sheet-root.open #trade-sheet{transform:translateY(0)}",
      ".sheet-handle{width:42px;height:4px;border-radius:4px;background:var(--line);margin:4px auto 10px}",
      "#sheet-title{font-weight:750;font-size:16px}",
      "#sheet-px{font-size:22px;font-weight:750;font-variant-numeric:tabular-nums;direction:ltr}",
      "#sheet-stats{display:flex;gap:10px;flex-wrap:wrap;font-size:12px;color:var(--muted);margin:6px 0 8px}",
      "#sheet-chart{height:168px;border-radius:12px;background:var(--bg);border:1px solid var(--line);margin-bottom:8px}",
      ".sheet-tabs{display:flex;gap:6px;margin:6px 0}",
      ".sheet-tabs button{flex:1;border:1px solid var(--line);background:var(--card);color:var(--text);border-radius:12px;padding:8px 6px;font:inherit;font-size:13px}",
      ".sheet-tabs button.on{background:#3b82f622;border-color:#3b82f688;font-weight:700}",
      ".sheet-pane .seg{display:flex;gap:6px;margin:8px 0}",
      ".sheet-pane input[type=number],.sheet-pane input[type=text]{width:100%;padding:8px 10px;border-radius:10px;border:1px solid var(--line);background:var(--bg);color:var(--text);font:inherit}",
      ".sheet-est{font-size:12px;color:var(--muted);line-height:1.55;margin:6px 0}",
      ".sheet-est.warn{color:var(--warn)}",
      "#cmd-root{position:fixed;inset:0;z-index:46;display:none}",
      "#cmd-root.open{display:block}",
      "#cmd-mask{position:absolute;inset:0;background:#0008}",
      "#cmd-box{position:absolute;left:12px;right:12px;top:max(10px,env(safe-area-inset-top,0px));background:color-mix(in srgb,var(--card) 92%,transparent);backdrop-filter:blur(16px);border:1px solid var(--line);border-radius:16px;max-height:72dvh;overflow:hidden;display:flex;flex-direction:column;box-shadow:0 18px 50px #0007}",
      "#cmd-q{width:100%;padding:12px 14px;border:0;border-bottom:1px solid var(--line);background:transparent;color:var(--text);font:inherit;font-size:16px;outline:none}",
      "#cmd-list{overflow:auto;-webkit-overflow-scrolling:touch;padding:6px}",
      "#cmd-list .row{margin:4px 0;cursor:pointer}",
      ".live-dot.ws{box-shadow:0 0 0 3px #16c78455}",
      ".icon-btn{flex:0 0 auto}",
      "html,body{overflow-x:hidden;max-width:100%}",
      "#sheet-root,#trade-sheet,#cmd-root,#cmd-box{max-width:100%}",
      "#sheet-chart,#sheet-stats,#sheet-px{max-width:100%;overflow:hidden}",
      "@media (max-width:400px){h1{font-size:16px}#trade-sheet{padding-left:10px;padding-right:10px}#cmd-box{left:8px;right:8px}.sheet-tabs button{font-size:12px;padding:8px 4px}}",
      ".theme-light #trade-sheet,.theme-light #cmd-box{background:color-mix(in srgb,var(--card) 96%,#fff)}"
    ].join("");
    document.head.appendChild(s);
  }

  function injectDom() {
    if (!$("offline-bar")) {
      var bar = document.createElement("div");
      bar.id = "offline-bar";
      bar.textContent = "لا يوجد اتصال — سأعيد المزامنة عند عودة الشبكة.";
      document.body.insertBefore(bar, document.body.firstChild);
    }
    if (!$("cmd-open")) {
      var live = document.querySelector("header .live") || document.querySelector("header .title");
      var btn = document.createElement("button");
      btn.type = "button";
      btn.id = "cmd-open";
      btn.className = "icon-btn";
      btn.setAttribute("aria-label", "بحث في كل العملات");
      btn.textContent = "⌕";
      if (live && live.parentNode) live.parentNode.insertBefore(btn, live);
      else document.querySelector("header") && document.querySelector("header").appendChild(btn);
    }
    if ($("sheet-root")) return;
    var root = document.createElement("div");
    root.innerHTML = [
      '<div id="sheet-root" class="" aria-hidden="true">',
      '  <div id="sheet-mask"></div>',
      '  <div id="trade-sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title">',
      '    <div class="sheet-handle"></div>',
      '    <div style="display:flex;justify-content:space-between;align-items:center;gap:8px">',
      '      <div id="sheet-title">BTC/USDT</div>',
      '      <button type="button" class="icon-btn" id="sheet-close" aria-label="إغلاق">✕</button>',
      '    </div>',
      '    <div id="sheet-px">—</div>',
      '    <div id="sheet-stats"><span id="sheet-chg">—</span><span id="sheet-vol">—</span><span id="sheet-hi">—</span></div>',
      '    <div id="sheet-chart" class="skel"></div>',
      '    <div class="sheet-tabs" id="sheet-tabs">',
      '      <button type="button" data-stab="spot" class="on">فوري</button>',
      '      <button type="button" data-stab="fut">عقود</button>',
      '      <button type="button" data-stab="auto">تلقائي</button>',
      '    </div>',
      '    <div id="pane-spot" class="sheet-pane">',
      '      <div class="seg" id="sh-side"><button type="button" data-side="buy" class="on">شراء</button><button type="button" data-side="sell">بيع</button></div>',
      '      <div class="seg" id="sh-type"><button type="button" data-ot="market" class="on">سوق</button><button type="button" data-ot="limit">محدود</button></div>',
      '      <div id="sh-limit-wrap" class="hidden"><label class="muted">سعر الأمر</label><input id="sh-limit" type="number" inputmode="decimal" step="any" /></div>',
      '      <div class="seg" id="sh-chips"><button type="button" data-amt="1">1</button><button type="button" data-amt="3" class="on">3 USDT</button><button type="button" data-amt="max">الحد</button></div>',
      '      <label class="muted">المبلغ (USDT)</label><input id="sh-amt" type="number" inputmode="decimal" step="any" value="3" />',
      '      <div class="sheet-est" id="sh-est"></div>',
      '      <button type="button" class="go" id="sh-spot-go">إرسال أمر فوري للتأكيد</button>',
      '    </div>',
      '    <div id="pane-fut" class="sheet-pane hidden">',
      '      <div class="seg" id="sh-fside"><button type="button" data-fside="long" class="on">لونغ</button><button type="button" data-fside="short">شورث</button></div>',
      '      <div class="seg" id="sh-ftype"><button type="button" data-ft="market" class="on">سوق</button><button type="button" data-ft="limit">محدود</button></div>',
      '      <div id="sh-flimit-wrap" class="hidden"><label class="muted">سعر الأمر</label><input id="sh-flimit" type="number" inputmode="decimal" step="any" /></div>',
      '      <label class="muted">الرافعة: <b id="sh-lev-lbl">2x</b></label>',
      '      <input id="sh-lev" type="range" min="1" max="20" value="2" />',
      '      <div class="seg" id="sh-fmargin"><button type="button" data-m="0.5">0.5</button><button type="button" data-m="1" class="on">1 USDT</button></div>',
      '      <label class="muted">الهامش (USDT)</label><input id="sh-famt" type="number" inputmode="decimal" step="any" value="1" />',
      '      <label class="muted">جني الربح (اختياري)</label><input id="sh-tp" type="number" inputmode="decimal" step="any" />',
      '      <label class="muted">وقف الخسارة (اختياري)</label><input id="sh-sl" type="number" inputmode="decimal" step="any" />',
      '      <div class="sheet-est" id="sh-fest"></div>',
      '      <button type="button" class="go" id="sh-fut-go">إرسال أمر عقود للتأكيد</button>',
      '    </div>',
      '    <div id="pane-auto" class="sheet-pane hidden">',
      '      <p class="note">التداول التلقائي فوري فقط، وضمن الحدود المعتمدة. الإضافة هنا تجعل الفاحص يعطي العملة أولوية.</p>',
      '      <button type="button" class="go" id="sh-watch">أضف إلى التداول التلقائي</button>',
      '      <button type="button" class="go sellbtn" id="sh-unwatch" style="margin-top:8px">إزالة من المراقبة</button>',
      '      <button type="button" class="go sellbtn" id="sh-exclude" style="margin-top:8px">استثناء هذه العملة من التلقائي</button>',
      '      <button type="button" class="go" id="sh-unex" style="margin-top:8px">إزالة الاستثناء</button>',
      '    </div>',
      '  </div>',
      '</div>',
      '<div id="cmd-root" aria-hidden="true">',
      '  <div id="cmd-mask"></div>',
      '  <div id="cmd-box" role="dialog" aria-modal="true">',
      '    <input id="cmd-q" type="search" enterkeyhint="search" placeholder="ابحث في كل العملات (فوري وعقود)…" autocomplete="off" />',
      '    <div id="cmd-list"></div>',
      '  </div>',
      '</div>'
    ].join("");
    while (root.firstChild) document.body.appendChild(root.firstChild);
  }

  function loadRecent() {
    try { recent = JSON.parse(localStorage.getItem(RECENT_KEY) || "[]") || []; } catch (e) { recent = []; }
    if (!Array.isArray(recent)) recent = [];
  }
  function pushRecent(pair, kind) {
    pair = String(pair || "").toUpperCase();
    recent = [{ pair: pair, kind: kind || "spot" }].concat(recent.filter(function (x) { return x.pair !== pair; })).slice(0, 10);
    try { localStorage.setItem(RECENT_KEY, JSON.stringify(recent)); } catch (e) {}
  }

  function tickerOf(pair, kind) {
    var a = Aj();
    if (kind === "fut") {
      var ft = (a.futTickers || {})[pair] || {};
      return { last: Number(ft.last || ft.mark || 0), change: Number(ft.change || 0), quote: Number(ft.volume_24h_quote || ft.quote || 0), high: Number(ft.high_24h || 0), low: Number(ft.low_24h || 0), mark: Number(ft.mark || ft.last || 0) };
    }
    var t = (a.tickers || {})[pair] || {};
    return { last: Number(t.last || 0), change: Number(t.change || 0), quote: Number(t.quote || 0), high: Number(t.high || t.high_24h || 0), low: Number(t.low || t.low_24h || 0) };
  }

  function applyTheme() {
    var p = (tg() && tg().themeParams) || {};
    var r = document.documentElement;
    if (p.bg_color) r.style.setProperty("--bg", p.bg_color);
    if (p.secondary_bg_color) r.style.setProperty("--card", p.secondary_bg_color);
    if (p.text_color) r.style.setProperty("--text", p.text_color);
    if (p.hint_color) r.style.setProperty("--muted", p.hint_color);
    if (p.button_color) r.style.setProperty("--btn", p.button_color);
    if (p.link_color) r.style.setProperty("--buy", p.link_color);
    var bg = String(p.bg_color || "").replace("#", "");
    if (bg.length >= 6) {
      var lum = (parseInt(bg.slice(0, 2), 16) * 299 + parseInt(bg.slice(2, 4), 16) * 587 + parseInt(bg.slice(4, 6), 16) * 114) / 1000;
      document.body.classList.toggle("theme-light", lum > 160);
      document.documentElement.classList.toggle("theme-light", lum > 160);
    }
    try { if (tg() && tg().setHeaderColor && p.bg_color) tg().setHeaderColor(p.bg_color); } catch (e) {}
  }

  function setOffline(off) {
    var el = $("offline-bar");
    if (el) el.classList.toggle("on", !!off);
  }

  function flashEl(el, up) {
    if (!el) return;
    el.classList.remove("flash-up", "flash-down");
    void el.offsetWidth;
    el.classList.add(up ? "flash-up" : "flash-down");
  }

  function animNumber(el, next) {
    if (!el) return;
    /* v19.1: no fake count-up between prices; stable digits; flash only on a real visible change */
    if (Aj().pxSet) { Aj().pxSet(el, next, el.id === "head-px" ? Aj().pair : (sheet.pair || Aj().pair)); return; }
    next = Number(next);
    if (!isFinite(next)) { el.textContent = "—"; return; }
    var prev = Number(el.getAttribute("data-v"));
    el.setAttribute("data-v", String(next));
    if (!isFinite(prev)) { el.textContent = fmt(next); return; }
    if (prev !== next) flashEl(el, next >= prev);
    var id = el.id || Math.random();
    if (anims[id]) cancelAnimationFrame(anims[id]);
    var t0 = performance.now(), dur = 280, from = prev;
    function step(t) {
      var k = Math.min(1, (t - t0) / dur);
      var v = from + (next - from) * k;
      el.textContent = fmt(v);
      if (k < 1) anims[id] = requestAnimationFrame(step);
    }
    anims[id] = requestAnimationFrame(step);
  }

  function hasFut(pair) {
    var list = Aj().allFut || [];
    for (var i = 0; i < list.length; i++) {
      if ((list[i].name || list[i]) === pair) return true;
    }
    return !!(Aj().futSpecs && Aj().futSpecs[pair]);
  }

  function openSheet(pair, kind, tab) {
    pair = String(pair || "BTC_USDT").toUpperCase().replace("-", "_");
    if (!pair.endsWith("_USDT") && pair.indexOf("_") < 0) pair = pair + "_USDT";
    sheet.pair = pair;
    sheet.kind = kind || (hasFut(pair) && kind === "fut" ? "fut" : "spot");
    sheet.tab = tab || (sheet.kind === "fut" ? "fut" : "spot");
    sheet.open = true;
    pushRecent(pair, sheet.kind);
    var root = $("sheet-root");
    root.classList.add("open");
    root.setAttribute("aria-hidden", "false");
    $("sheet-title").textContent = pair.replace("_", "/") + (sheet.kind === "fut" ? " · عقد" : "");
    $("sh-amt").value = String(capS());
    $("sh-famt").value = String(capF());
    setSheetTab(sheet.tab);
    refreshSheetPx();
    loadMiniChart(pair, sheet.kind === "fut" ? "fut" : "spot");
    loadMinQuote(pair);
    setupLeverage(pair);
    updateSpotEst();
    updateFutSheetEst();
    try { if (Aj().selectPair) Aj().selectPair(pair); } catch (e) {}
    if (sheet.kind === "fut" && Aj().fillFutSelect) {
      try { Aj().fillFutSelect([pair]); var sel = $("fut-contract"); if (sel) sel.value = pair; } catch (e) {}
    }
    haptic("sel");
    syncSheetChrome();
    liveWanted();
  }

  function closeSheet() {
    if (!sheet.open) return;
    sheet.open = false;
    var root = $("sheet-root");
    root.classList.remove("open");
    root.setAttribute("aria-hidden", "true");
    if (sheet.chart) { try { sheet.chart.remove(); } catch (e) {} sheet.chart = null; sheet.series = null; }
    var tgw = tg();
    try {
      if (tgw && tgw.MainButton) tgw.MainButton.hide();
    } catch (e) {}
    if (Aj().syncTelegramChrome) {
      try { Aj().syncTelegramChrome((Aj().currentTab && Aj().currentTab()) || "markets"); } catch (e) {}
    }
  }

  function setSheetTab(tab) {
    sheet.tab = tab;
    ["spot", "fut", "auto"].forEach(function (t) {
      var pane = $("pane-" + t);
      if (pane) pane.classList.toggle("hidden", t !== tab);
    });
    document.querySelectorAll("#sheet-tabs button").forEach(function (b) {
      b.classList.toggle("on", b.getAttribute("data-stab") === tab);
    });
    if (tab === "fut" && !hasFut(sheet.pair) && Aj().loadFutures) {
      try { Aj().loadFutures(); } catch (e) {}
    }
    if (tab === "fut") updateFutSheetEst();
    if (tab === "spot") updateSpotEst();
    syncSheetChrome();
  }

  function refreshSheetPx() {
    var t = tickerOf(sheet.pair, sheet.tab === "fut" || sheet.kind === "fut" ? "fut" : "spot");
    if (!(t.last > 0) && sheet.kind !== "fut") t = tickerOf(sheet.pair, "spot");
    animNumber($("sheet-px"), t.last || t.mark);
    var chg = $("sheet-chg");
    if (chg) {
      var c = t.change;
      chg.textContent = isFinite(c) ? ((c >= 0 ? "+" : "") + Number(c).toFixed(2) + "%") : "—";
      chg.className = c >= 0 ? "chg up" : "chg down";
    }
    var vol = $("sheet-vol");
    if (vol) vol.textContent = t.quote ? ("حجم 24س " + (Aj().volFmt ? Aj().volFmt(t.quote) : fmt(t.quote, 0))) : "";
    var hi = $("sheet-hi");
    if (hi && (t.high || t.low)) hi.textContent = "أعلى/أدنى " + fmt(t.high) + " · " + fmt(t.low);
    var head = $("head-px");
    if (head && Aj().pair === sheet.pair && t.last) animNumber(head, t.last);
    updateSpotEst();
    updateFutSheetEst();
  }

  async function loadMinQuote(pair) {
    sheet.minQuote = 0;
    try {
      if (Aj().getPairMinQuote) sheet.minQuote = (await Aj().getPairMinQuote(pair)) || 0;
    } catch (e) { sheet.minQuote = 0; }
    updateSpotEst();
  }

  function setupLeverage(pair) {
    var mx = maxLev();
    try { if (Aj().futMaxLev) mx = Aj().futMaxLev(pair) || mx; } catch (e) {}
    sheet.maxLev = Math.max(1, Math.min(maxLev(), mx));
    var sl = $("sh-lev");
    sl.max = String(sheet.maxLev);
    if (Number(sl.value) > sheet.maxLev) sl.value = String(sheet.maxLev);
    $("sh-lev-lbl").textContent = sl.value + "x";
  }

  function parseCandles(raw, isFut) {
    var out = [];
    if (!Array.isArray(raw)) return out;
    raw.forEach(function (row) {
      var t, o, h, l, c;
      if (row && typeof row === "object" && !Array.isArray(row)) {
        t = Number(row.t); o = Number(row.o); h = Number(row.h); l = Number(row.l); c = Number(row.c);
      } else if (Array.isArray(row)) {
        if (isFut) { t = Number(row[0]); o = Number(row[5] != null ? row[5] : row[1]); c = Number(row[2]); h = Number(row[3]); l = Number(row[4]); }
        else { t = Number(row[0]); c = Number(row[2]); h = Number(row[3]); l = Number(row[4]); o = Number(row[5]); }
      }
      if (t > 1e12) t = Math.floor(t / 1000);
      if (t > 0 && o > 0 && h > 0 && l > 0 && c > 0) out.push({ time: t, open: o, high: h, low: l, close: c });
    });
    out.sort(function (a, b) { return a.time - b.time; });
    return out;
  }

  async function loadMiniChart(pair, kind) {
    var el = $("sheet-chart");
    if (!el) return;
    el.classList.add("skel");
    if (sheet.chart) { try { sheet.chart.remove(); } catch (e) {} sheet.chart = null; sheet.series = null; }
    var url = kind === "fut"
      ? gate() + "/futures/usdt/candlesticks?contract=" + encodeURIComponent(pair) + "&interval=15m&limit=80"
      : gate() + "/spot/candlesticks?currency_pair=" + encodeURIComponent(pair) + "&interval=15m&limit=80";
    var data = [];
    try {
      var r = await fetch(url);
      if (r.ok) data = parseCandles(await r.json(), kind === "fut");
    } catch (e) { data = []; }
    el.classList.remove("skel");
    el.innerHTML = "";
    if (!data.length) {
      el.innerHTML = '<div class="note" style="padding:20px;text-align:center">لا توجد شموع حالياً</div>';
      return;
    }
    if (window.LightweightCharts) {
      try {
        var cs = getComputedStyle(document.documentElement);
        var text = (cs.getPropertyValue("--muted") || "#8b9aab").trim() || "#8b9aab";
        var cw = Math.max(160, Math.min(el.clientWidth || el.offsetWidth || 320, (window.innerWidth || 360) - 28));
        var ch = window.LightweightCharts.createChart(el, {
          width: cw,
          height: 168,
          layout: { background: { color: "transparent" }, textColor: text, fontSize: 10 },
          grid: { vertLines: { visible: false }, horzLines: { color: "rgba(255,255,255,0.04)" } },
          rightPriceScale: { borderVisible: false },
          timeScale: { borderVisible: false, timeVisible: false },
          crosshair: { vertLine: { visible: false }, horzLine: { visible: false } },
          handleScroll: false, handleScale: false
        });
        var series = ch.addCandlestickSeries({
          upColor: "#16c784", downColor: "#ea3943", borderVisible: false,
          wickUpColor: "#16c784", wickDownColor: "#ea3943"
        });
        series.setData(data);
        ch.timeScale().fitContent();
        sheet.chart = ch; sheet.series = series;
        return;
      } catch (e) {}
    }
    drawCanvasChart(el, data);
  }

  function drawCanvasChart(el, data) {
    var c = document.createElement("canvas");
    var w = el.clientWidth || 320, h = 168;
    c.width = w * 2; c.height = h * 2; c.style.width = "100%"; c.style.height = h + "px";
    el.appendChild(c);
    var g = c.getContext("2d");
    g.scale(2, 2);
    var lo = Math.min.apply(null, data.map(function (d) { return d.low; }));
    var hi = Math.max.apply(null, data.map(function (d) { return d.high; }));
    var pad = (hi - lo) * 0.06 || 1;
    lo -= pad; hi += pad;
    var bw = Math.max(1, (w - 8) / data.length - 1);
    data.forEach(function (d, i) {
      var x = 4 + i * ((w - 8) / data.length);
      var y = function (p) { return 6 + (hi - p) / (hi - lo) * (h - 12); };
      g.strokeStyle = d.close >= d.open ? "#16c784" : "#ea3943";
      g.beginPath(); g.moveTo(x + bw / 2, y(d.high)); g.lineTo(x + bw / 2, y(d.low)); g.stroke();
      var top = y(Math.max(d.open, d.close)), bot = y(Math.min(d.open, d.close));
      g.fillStyle = g.strokeStyle;
      g.fillRect(x, top, bw, Math.max(1, bot - top));
    });
  }

  function updateSpotEst() {
    var el = $("sh-est");
    if (!el) return;
    var usdt = Number($("sh-amt").value || 0);
    var side = document.querySelector("#sh-side button.on");
    side = side ? side.getAttribute("data-side") : "buy";
    var t = tickerOf(sheet.pair, "spot");
    var last = t.last;
    var html = "";
    if (!(usdt > 0)) html = "أدخل مبلغاً صالحاً.";
    else {
      if (usdt > capS() + 1e-12) html += "⚠️ الحد الأقصى للصفقة الفورية " + capS() + " USDT. ";
      var qty = last > 0 ? usdt / last : 0;
      var fee = usdt * FEE_RATE;
      html += "تقدير الكمية ≈ <b>" + fmt(qty, 6) + "</b> " + baseSym(sheet.pair);
      html += "<br>تقدير الرسوم ≈ " + fmt(fee, 4) + " USDT (~0.2٪، قد تختلف حسب مستوى الحساب).";
      if (sheet.minQuote && usdt < sheet.minQuote) {
        html += "<br>⚠️ أقل من الحد الأدنى للمنصة (" + fmt(sheet.minQuote, 2) + " USDT).";
        if (capS() < sheet.minQuote) html += " حد التطبيق أقل من حد المنصة، لذلك لن يُرسل الطلب.";
        el.classList.add("warn");
      } else el.classList.remove("warn");
    }
    el.innerHTML = html;
  }

  function updateFutSheetEst() {
    var el = $("sh-fest");
    if (!el) return;
    var usdt = Number($("sh-famt").value || 0);
    var lev = Number($("sh-lev").value || 2);
    var sideBtn = document.querySelector("#sh-fside button.on");
    var side = sideBtn ? sideBtn.getAttribute("data-fside") : "long";
    var t = tickerOf(sheet.pair, "fut");
    if (!(t.last > 0)) t = tickerOf(sheet.pair, "spot");
    var mark = t.mark || t.last;
    var html = "";
    if (!hasFut(sheet.pair)) {
      el.innerHTML = "لا يوجد عقد USDT-M بهذا الاسم حالياً. يمكنك تداولها فورياً أو إضافتها للتلقائي.";
      el.classList.add("warn");
      return;
    }
    el.classList.remove("warn");
    if (usdt > capF() + 1e-12) html += "⚠️ حد هامش العقود " + capF() + " USDT. ";
    if (lev > sheet.maxLev) html += "أقصى رافعة لهذا العقد " + sheet.maxLev + "x. ";
    if (mark > 0 && lev > 0) {
      var mmr = 0.01;
      var dist = (1 / lev - mmr) * 100;
      if (dist < 0.2) dist = 0.2;
      var liq = side === "long" ? mark * (1 - dist / 100) : mark * (1 + dist / 100);
      var notional = usdt * lev;
      html += "قيمة اسمية تقريبية " + fmt(notional, 2) + " USDT.";
      html += "<br>تصفية تقريبية ≈ <b>" + fmt(liq) + "</b> (نحو " + dist.toFixed(2) + "٪). تقدير وليس ضماناً.";
    }
    el.innerHTML = html || "—";
  }

  function sendSpot() {
    var usdt = Number($("sh-amt").value || 0);
    var sideBtn = document.querySelector("#sh-side button.on");
    var side = sideBtn ? sideBtn.getAttribute("data-side") : "buy";
    var typBtn = document.querySelector("#sh-type button.on");
    var typ = typBtn ? typBtn.getAttribute("data-ot") : "market";
    if (!(usdt > 0)) { toast("أدخل مبلغاً صالحاً"); return; }
    if (usdt > capS() + 1e-12) { toast("الحد الأقصى لكل صفقة فورية هو " + capS() + " USDT."); return; }
    if (sheet.minQuote && usdt < sheet.minQuote) {
      toast("قيمة الصفقة أقل من حد المنصة (" + fmt(sheet.minQuote, 2) + " USDT).");
      return;
    }
    var payload = { action: "trade", pair: sheet.pair, side: side, order_type: typ, usdt: usdt };
    if (typ === "limit") {
      var px = Number($("sh-limit").value || 0);
      if (!(px > 0)) { toast("أدخل سعر الأمر المحدود"); return; }
      payload.price = px; payload.limit_price = px;
    }
    haptic("ok");
    Aj().sendAction(payload);
  }

  function sendFut() {
    if (!hasFut(sheet.pair)) { toast("لا يوجد عقد لهذه العملة"); return; }
    var usdt = Number($("sh-famt").value || 0);
    var lev = Number($("sh-lev").value || 2);
    var sideBtn = document.querySelector("#sh-fside button.on");
    var typBtn = document.querySelector("#sh-ftype button.on");
    if (usdt > capF() + 1e-12) { toast("الحد الأقصى لهامش الصفقة هو " + capF() + " USDT."); return; }
    if (!(usdt > 0)) { toast("أدخل هامشاً صالحاً"); return; }
    if (lev > sheet.maxLev) { toast("أقصى رافعة " + sheet.maxLev + "x"); return; }
    var payload = {
      action: "fut_open", contract: sheet.pair, side: sideBtn ? sideBtn.getAttribute("data-fside") : "long",
      order_type: typBtn ? typBtn.getAttribute("data-ft") : "market", usdt: usdt, leverage: lev, margin_mode: "isolated"
    };
    var tp = Number($("sh-tp").value || 0), sl = Number($("sh-sl").value || 0);
    if (tp > 0) payload.tp = tp;
    if (sl > 0) payload.sl = sl;
    if (payload.order_type === "limit") {
      var px = Number($("sh-flimit").value || 0);
      if (!(px > 0)) { toast("أدخل سعر الأمر المحدود"); return; }
      payload.price = px;
    }
    haptic("ok");
    Aj().sendAction(payload);
  }

  function sendAuto(kind, enabled) {
    var payload = { action: kind === "exclude" ? "auto_exclude" : "auto_watch", symbol: baseSym(sheet.pair), pair: sheet.pair, enabled: enabled };
    haptic("ok");
    Aj().sendAction(payload);
  }

  function confirmSheet() {
    if (sheet.tab === "fut") sendFut();
    else if (sheet.tab === "auto") sendAuto("watch", true);
    else sendSpot();
  }

  function syncSheetChrome() {
    var tgw = tg();
    if (!tgw || !sheet.open) return;
    try {
      if (tgw.BackButton) tgw.BackButton.show();
      if (tgw.MainButton) {
        var label = sheet.tab === "fut" ? "إرسال أمر العقود للتأكيد" : (sheet.tab === "auto" ? "أضف إلى التداول التلقائي" : "إرسال أمر فوري للتأكيد");
        tgw.MainButton.setText(label);
        tgw.MainButton.show();
        var color = sheet.tab === "auto" ? "#3b82f6" : (sheet.tab === "fut" && document.querySelector("#sh-fside button.on") && document.querySelector("#sh-fside button.on").getAttribute("data-fside") === "short" ? "#e11d48" : "#0d9488");
        try { tgw.MainButton.setParams({ color: color, text_color: "#ffffff" }); } catch (e) {}
      }
    } catch (e) {}
  }

  /* ---------- command palette ---------- */
  function openCmd() {
    cmdOpen = true;
    $("cmd-root").classList.add("open");
    $("cmd-root").setAttribute("aria-hidden", "false");
    renderCmd($("cmd-q").value || "");
    setTimeout(function () { try { $("cmd-q").focus(); } catch (e) {} }, 30);
    haptic("light");
    try { if (tg() && tg().BackButton) tg().BackButton.show(); } catch (e) {}
  }
  function closeCmd() {
    if (!cmdOpen) return;
    cmdOpen = false;
    $("cmd-root").classList.remove("open");
    $("cmd-root").setAttribute("aria-hidden", "true");
    if (!sheet.open && Aj().syncTelegramChrome) {
      try { Aj().syncTelegramChrome((Aj().currentTab && Aj().currentTab()) || "markets"); } catch (e) {}
    }
  }
  function scoreItem(q, name, kind) {
    name = String(name || "").toUpperCase();
    var base = baseSym(name);
    if (!q) return kind === "fav" ? 100 : (kind === "recent" ? 80 : 1);
    if (base === q || name === q) return 200;
    if (base.indexOf(q) === 0 || name.indexOf(q) === 0) return 120;
    if (base.indexOf(q) >= 0) return 60;
    return 0;
  }
  function renderCmd(q) {
    q = String(q || "").trim().toUpperCase().replace("-", "_").replace("/", "_");
    if (q.endsWith("_USDT")) q = q.slice(0, -5);
    var a = Aj();
    var items = [];
    var favs = a.favs || [];
    favs.forEach(function (p) { items.push({ pair: p, kind: "spot", tag: "مفضّلة", sc: scoreItem(q, p, "fav") }); });
    recent.forEach(function (r) { items.push({ pair: r.pair, kind: r.kind || "spot", tag: "أخيرة", sc: scoreItem(q, r.pair, "recent") }); });
    if (q) {
      (a.allSpot || []).forEach(function (r) {
        var p = r.pair || r;
        items.push({ pair: p, kind: "spot", tag: "فوري", sc: scoreItem(q, p, "spot") });
      });
      (a.allFut || []).forEach(function (r) {
        var p = r.name || r;
        items.push({ pair: p, kind: "fut", tag: "عقود", sc: scoreItem(q, p, "fut") });
      });
    } else {
      ["BTC_USDT", "ETH_USDT", "SOL_USDT"].forEach(function (p) {
        items.push({ pair: p, kind: "spot", tag: "رائج", sc: scoreItem(q, p, "spot") });
      });
    }
    var seen = {};
    items = items.filter(function (it) {
      if (!it.sc) return false;
      var k = it.kind + ":" + it.pair;
      if (seen[k]) return false;
      seen[k] = 1;
      return true;
    }).sort(function (x, y) { return y.sc - x.sc; }).slice(0, 80);
    var box = $("cmd-list");
    if (!items.length) { box.innerHTML = '<p class="note" style="padding:12px">لا توجد نتائج</p>'; return; }
    box.innerHTML = items.map(function (it) {
      var t = tickerOf(it.pair, it.kind);
      var chg = isFinite(t.change) ? ((t.change >= 0 ? "+" : "") + Number(t.change).toFixed(2) + "%") : "—";
      return '<div class="row" data-cpair="' + it.pair + '" data-ckind="' + it.kind + '">'
        + '<div><div class="sym">' + baseSym(it.pair) + ' <small>USDT</small></div><div class="vol">' + it.tag + "</div></div>"
        + '<div class="last">' + (t.last ? fmt(t.last) : "—") + "</div>"
        + '<div class="chgc ' + (t.change >= 0 ? "bid" : "ask") + '">' + chg + "</div></div>";
    }).join("");
  }

  /* ---------- Gate public WS ---------- */
  function visiblePairs() {
    var out = [];
    document.querySelectorAll("[data-pair],[data-contract],[data-new]").forEach(function (el) {
      var p = el.getAttribute("data-pair") || el.getAttribute("data-contract") || el.getAttribute("data-new");
      if (p) out.push(String(p).toUpperCase());
    });
    if (Aj().pair) out.push(Aj().pair);
    if (sheet.open) out.push(sheet.pair);
    (Aj().favs || []).forEach(function (p) { out.push(p); });
    recent.forEach(function (r) { out.push(r.pair); });
    ["BTC_USDT", "ETH_USDT", "SOL_USDT"].forEach(function (p) { out.push(p); });
    var seen = {}, list = [];
    out.forEach(function (p) {
      p = String(p || "").toUpperCase();
      if (!p || seen[p]) return;
      seen[p] = 1;
      list.push(p);
    });
    return list.slice(0, 80);
  }
  function isSpotPair(p) {
    if (Aj().tickers && Aj().tickers[p]) return true;
    var list = Aj().allSpot || [];
    for (var i = 0; i < list.length; i++) {
      if ((list[i].pair || list[i]) === p) return true;
    }
    return false;
  }
  function splitWanted(list) {
    var spot = [], fut = [];
    list.forEach(function (p) {
      if (hasFut(p) && fut.indexOf(p) < 0) fut.push(p);
      if (isSpotPair(p) && spot.indexOf(p) < 0) spot.push(p);
    });
    return { spot: spot.slice(0, 60), fut: fut.slice(0, 40) };
  }
  function wsSend(obj) {
    try { if (live.ws && live.ws.readyState === 1) live.ws.send(JSON.stringify(obj)); } catch (e) {}
  }
  function subscribe(force) {
    var w = splitWanted(visiblePairs());
    var same = !force && JSON.stringify(w.spot) === JSON.stringify(live.wantedSpot) && JSON.stringify(w.fut) === JSON.stringify(live.wantedFut);
    if (same || !live.ok) { live.wantedSpot = w.spot; live.wantedFut = w.fut; if (!live.ok) return; if (same) return; }
    var now = Math.floor(Date.now() / 1000);
    if (live.wantedSpot.length) wsSend({ time: now, channel: "spot.tickers", event: "unsubscribe", payload: live.wantedSpot });
    if (live.wantedFut.length) wsSend({ time: now, channel: "futures.tickers", event: "unsubscribe", payload: live.wantedFut });
    live.wantedSpot = w.spot; live.wantedFut = w.fut;
    if (w.spot.length) wsSend({ time: now, channel: "spot.tickers", event: "subscribe", payload: w.spot });
    if (w.fut.length) wsSend({ time: now, channel: "futures.tickers", event: "subscribe", payload: w.fut });
  }
  function liveWanted() { subscribe(false); }
  function applySpotTick(res) {
    if (!res) return;
    var pair = String(res.currency_pair || res.s || "").toUpperCase();
    if (!pair) return;
    var last = Number(res.last || res.close || 0);
    var a = Aj();
    if (!a.tickers) return;
    var prev = a.tickers[pair] || {};
    a.tickers[pair] = Object.assign({}, prev, {
      last: last || prev.last,
      change: res.change_percentage != null ? Number(res.change_percentage) : prev.change,
      quote: res.quote_volume != null ? Number(res.quote_volume) : prev.quote,
      high: res.high_24h != null ? Number(res.high_24h) : prev.high,
      low: res.low_24h != null ? Number(res.low_24h) : prev.low,
      ask: res.lowest_ask != null ? Number(res.lowest_ask) : prev.ask,
      bid: res.highest_bid != null ? Number(res.highest_bid) : prev.bid,
      _ws: Date.now()
    });
    if (last && a.pxSet && !document.hidden) {
      var rl = document.querySelector('#mkt .last[data-p="' + pair + '"]');
      if (rl) a.pxSet(rl, last, pair);
    }
    if (sheet.open && sheet.pair === pair) refreshSheetPx();
    else if (a.pair === pair && last) animNumber($("head-px"), last);
    if (a.pair === pair && last && a.liveCandle && !document.hidden) a.liveCandle(last);
  }
  function applyFutTick(res) {
    if (!res) return;
    var pair = String(res.contract || res.currency_pair || res.s || "").toUpperCase();
    if (!pair) return;
    var a = Aj();
    if (!a.futTickers) return;
    var prev = a.futTickers[pair] || {};
    a.futTickers[pair] = Object.assign({}, prev, {
      last: Number(res.last || prev.last || 0),
      mark: Number(res.mark_price || res.mark || prev.mark || 0),
      change: res.change_percentage != null ? Number(res.change_percentage) : prev.change,
      volume_24h_quote: res.volume_24h_quote != null ? Number(res.volume_24h_quote) : prev.volume_24h_quote
    });
    if (sheet.open && sheet.pair === pair) refreshSheetPx();
  }
  function onWsMsg(ev) {
    var msg;
    try { msg = JSON.parse(ev.data); } catch (e) { return; }
    var ch = msg.channel || "";
    if (msg.event === "update" || msg.event === "all") {
      var res = msg.result;
      if (ch === "spot.tickers") {
        if (Array.isArray(res)) res.forEach(applySpotTick);
        else applySpotTick(res);
      } else if (ch === "futures.tickers") {
        if (Array.isArray(res)) res.forEach(applyFutTick);
        else applyFutTick(res);
      }
    }
  }
  function setLiveUi(ok) {
    var dot = $("dot");
    if (dot) dot.classList.toggle("ws", !!ok);
    var src = $("src");
    if (src) src.textContent = ok ? "Gate.io مباشر" : (navigator.onLine ? "Gate.io" : "بدون اتصال");
  }
  function connectWs() {
    try { if (live.ws) { live.ws.onclose = null; live.ws.close(); } } catch (e) {}
    try { live.ws = new WebSocket(WS_URL); } catch (e) { live.ok = false; setLiveUi(false); return; }
    live.ws.onopen = function () {
      live.ok = true;
      setLiveUi(true);
      subscribe(true);
      if (live.ping) clearInterval(live.ping);
      live.ping = setInterval(function () {
        wsSend({ time: Math.floor(Date.now() / 1000), channel: "spot.ping" });
      }, 15000);
    };
    live.ws.onmessage = onWsMsg;
    live.ws.onclose = function () {
      live.ok = false;
      setLiveUi(false);
      if (live.ping) clearInterval(live.ping);
      if (live.reconnect) clearTimeout(live.reconnect);
      live.reconnect = setTimeout(connectWs, 2500);
    };
    live.ws.onerror = function () { try { live.ws.close(); } catch (e) {} };
  }
  function restFallback() {
    if (live.ok) return;
    if (Aj().loadTickers) { try { Aj().loadTickers(); } catch (e) {} }
    if (Aj().loadFutures) { try { Aj().loadFutures(); } catch (e) {} }
    if (sheet.open) refreshSheetPx();
  }

  function bind() {
    document.body.addEventListener("click", function (ev) {
      if (ev.target.closest && ev.target.closest("[data-fav],[data-ms]")) return;
      var row = ev.target.closest && ev.target.closest("[data-pair],[data-contract],[data-new],[data-cpair],[data-atrend]");
      if (!row) return;
      if (row.id === "head-pair") return;
      var p = row.getAttribute("data-cpair") || row.getAttribute("data-pair") || row.getAttribute("data-contract") || row.getAttribute("data-new") || row.getAttribute("data-atrend");
      if (!p) return;
      var kind = row.getAttribute("data-ckind") || row.getAttribute("data-kind") || (row.getAttribute("data-contract") ? "fut" : "spot");
      if (row.hasAttribute("data-cpair")) closeCmd();
      ev.stopPropagation();
      openSheet(p, kind);
    }, true);
    $("cmd-open") && $("cmd-open").addEventListener("click", function () { openCmd(); });
    $("cmd-mask") && $("cmd-mask").addEventListener("click", closeCmd);
    $("cmd-q") && $("cmd-q").addEventListener("input", function () { renderCmd($("cmd-q").value); });
    $("sheet-mask") && $("sheet-mask").addEventListener("click", closeSheet);
    $("sheet-close") && $("sheet-close").addEventListener("click", closeSheet);
    $("sheet-tabs") && $("sheet-tabs").addEventListener("click", function (ev) {
      var b = ev.target.closest("[data-stab]"); if (!b) return;
      setSheetTab(b.getAttribute("data-stab"));
    });
    $("sh-side") && $("sh-side").addEventListener("click", function (ev) {
      var b = ev.target.closest("[data-side]"); if (!b) return;
      document.querySelectorAll("#sh-side button").forEach(function (x) { x.classList.toggle("on", x === b); });
      updateSpotEst(); syncSheetChrome();
    });
    $("sh-type") && $("sh-type").addEventListener("click", function (ev) {
      var b = ev.target.closest("[data-ot]"); if (!b) return;
      document.querySelectorAll("#sh-type button").forEach(function (x) { x.classList.toggle("on", x === b); });
      $("sh-limit-wrap").classList.toggle("hidden", b.getAttribute("data-ot") !== "limit");
    });
    $("sh-chips") && $("sh-chips").addEventListener("click", function (ev) {
      var b = ev.target.closest("[data-amt]"); if (!b) return;
      document.querySelectorAll("#sh-chips button").forEach(function (x) { x.classList.toggle("on", x === b); });
      var v = b.getAttribute("data-amt");
      $("sh-amt").value = v === "max" ? String(capS()) : v;
      updateSpotEst();
    });
    $("sh-amt") && $("sh-amt").addEventListener("input", updateSpotEst);
    $("sh-spot-go") && $("sh-spot-go").addEventListener("click", sendSpot);
    $("sh-fside") && $("sh-fside").addEventListener("click", function (ev) {
      var b = ev.target.closest("[data-fside]"); if (!b) return;
      document.querySelectorAll("#sh-fside button").forEach(function (x) { x.classList.toggle("on", x === b); });
      updateFutSheetEst(); syncSheetChrome();
    });
    $("sh-ftype") && $("sh-ftype").addEventListener("click", function (ev) {
      var b = ev.target.closest("[data-ft]"); if (!b) return;
      document.querySelectorAll("#sh-ftype button").forEach(function (x) { x.classList.toggle("on", x === b); });
      $("sh-flimit-wrap").classList.toggle("hidden", b.getAttribute("data-ft") !== "limit");
    });
    $("sh-fmargin") && $("sh-fmargin").addEventListener("click", function (ev) {
      var b = ev.target.closest("[data-m]"); if (!b) return;
      document.querySelectorAll("#sh-fmargin button").forEach(function (x) { x.classList.toggle("on", x === b); });
      $("sh-famt").value = b.getAttribute("data-m");
      updateFutSheetEst();
    });
    $("sh-lev") && $("sh-lev").addEventListener("input", function () {
      $("sh-lev-lbl").textContent = $("sh-lev").value + "x";
      updateFutSheetEst();
    });
    $("sh-famt") && $("sh-famt").addEventListener("input", updateFutSheetEst);
    $("sh-fut-go") && $("sh-fut-go").addEventListener("click", sendFut);
    $("sh-watch") && $("sh-watch").addEventListener("click", function () { sendAuto("watch", true); });
    $("sh-unwatch") && $("sh-unwatch").addEventListener("click", function () { sendAuto("watch", false); });
    $("sh-exclude") && $("sh-exclude").addEventListener("click", function () { sendAuto("exclude", true); });
    $("sh-unex") && $("sh-unex").addEventListener("click", function () { sendAuto("exclude", false); });
    document.addEventListener("keydown", function (ev) {
      if ((ev.metaKey || ev.ctrlKey) && ev.key.toLowerCase() === "k") { ev.preventDefault(); openCmd(); }
      if (ev.key === "Escape") { if (cmdOpen) closeCmd(); else if (sheet.open) closeSheet(); }
    });
    window.addEventListener("online", function () { setOffline(false); if (!live.ok) connectWs(); });
    window.addEventListener("offline", function () { setOffline(true); setLiveUi(false); });
    setOffline(!navigator.onLine);
    var mkt = $("mkt-wrap") || $("fut-wrap") || $("new-wrap");
    ["mkt-wrap", "fut-wrap", "new-wrap"].forEach(function (id) {
      var el = $(id);
      if (el) el.addEventListener("scroll", function () { if (live._sc) clearTimeout(live._sc); live._sc = setTimeout(liveWanted, 400); }, { passive: true });
    });
  }

  function boot() {
    injectCss();
    injectDom();
    loadRecent();
    applyTheme();
    bind();
    connectWs();
    live.rest = setInterval(restFallback, REST_MS);
    window.AjSheet = {
      open: openSheet, close: closeSheet, isOpen: function () { return sheet.open; },
      confirm: confirmSheet, syncChrome: syncSheetChrome
    };
    window.AjCmd = { open: openCmd, close: closeCmd, isOpen: function () { return cmdOpen; } };
    window.AjLive = { ok: function () { return live.ok; }, refresh: liveWanted };
    if (typeof window.__AJ_READY !== "undefined") window.__AJ_READY = true;
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", function () { setTimeout(boot, 0); });
  else setTimeout(boot, 0);
})();
