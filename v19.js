/* ajcoin-miniapp v19 — connection/offline banner with retry and cached-price notice,
   top movers strip on the markets tab, live 24h change styling for the wallet,
   Arabic/RTL polish. UI only: no account data is stored or sent from here. */
(function () {
  "use strict";
  var $ = function (id) { return document.getElementById(id); };
  function Aj() { return window.Aj || {}; }
  function tg() { return window.Telegram && window.Telegram.WebApp; }
  function hap(k) { try { var h = tg() && tg().HapticFeedback; if (!h) return; if (k === "sel") h.selectionChanged(); else h.impactOccurred(k || "light"); } catch (e) {} }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function ago(ms) { var s = Math.max(0, Math.round(ms / 1000)); if (s < 60) return s + " ث"; if (s < 3600) return Math.round(s / 60) + " د"; if (s < 86400) return Math.round(s / 3600) + " س"; return Math.round(s / 86400) + " يوم"; }

  function css() {
    if ($("v19-css")) return;
    var s = document.createElement("style"); s.id = "v19-css";
    s.textContent = [
      "#v19-net{display:none;align-items:center;gap:8px;margin:8px 14px 0;padding:9px 12px;border-radius:12px;font-size:var(--fs-s,13px);line-height:1.5;",
      "background:color-mix(in srgb,var(--warn,#f5c15c) 14%,transparent);border:1px solid color-mix(in srgb,var(--warn,#f5c15c) 40%,transparent);color:var(--text)}",
      "#v19-net.show{display:flex}#v19-net.off{background:color-mix(in srgb,var(--down) 14%,transparent);border-color:color-mix(in srgb,var(--down) 45%,transparent)}",
      "#v19-net .t{flex:1;min-width:0}#v19-net button{flex:none;border:0;border-radius:9px;padding:6px 12px;font:inherit;font-weight:700;background:var(--card);color:var(--text);cursor:pointer}",
      "#v19-movers{display:flex;gap:6px;overflow-x:auto;scrollbar-width:none;margin:10px 0 2px;padding-bottom:2px}#v19-movers::-webkit-scrollbar{display:none}",
      "#v19-movers .lbl{flex:none;align-self:center;font-size:var(--fs-xs,11px);color:var(--muted);padding-inline-end:2px}",
      "#v19-movers button{flex:none;display:inline-flex;align-items:center;gap:6px;border:1px solid var(--glass-line,#ffffff14);border-radius:999px;padding:5px 10px;",
      "background:color-mix(in srgb,var(--text) 4%,transparent);color:var(--text);font:inherit;font-size:var(--fs-s,12px);font-weight:700;cursor:pointer}",
      "#v19-movers button i{font-style:normal;direction:ltr;font-variant-numeric:tabular-nums}",
      "#v19-movers .up i{color:var(--up)}#v19-movers .down i{color:var(--down)}",
      ".wl-d24{margin-top:6px;font-size:var(--fs-s,13px);font-variant-numeric:tabular-nums}.wl-d24.up b{color:var(--up)}.wl-d24.down b{color:var(--down)}",
      ".wl-chg{display:inline-block;margin-inline-start:6px;padding:1px 6px;border-radius:6px;font-size:11px;font-weight:750;direction:ltr;vertical-align:middle}",
      ".wl-chg.up{color:var(--up);background:color-mix(in srgb,var(--up) 14%,transparent)}.wl-chg.down{color:var(--down);background:color-mix(in srgb,var(--down) 14%,transparent)}",
      "#offline-bar{display:none!important}",
      "input,select,textarea{font-family:inherit}",
      ".hint,.banner,.wl-note{text-wrap:pretty}",
      "[dir=rtl] .px,[dir=rtl] .last,.addrbox{unicode-bidi:plaintext}"
    ].join("\n");
    document.head.appendChild(s);
  }

  /* ---------- connection banner ---------- */
  var lastState = "";
  function netBanner() {
    var hd = document.querySelector("header"); if (!hd) return;
    var b = $("v19-net");
    if (!b) {
      b = document.createElement("div"); b.id = "v19-net"; b.setAttribute("role", "status"); b.setAttribute("aria-live", "polite");
      b.innerHTML = '<span class="t"></span><button type="button">إعادة المحاولة</button>';
      hd.parentNode.insertBefore(b, hd.nextSibling);
      b.querySelector("button").addEventListener("click", function () {
        hap("light"); b.querySelector(".t").textContent = "جارٍ إعادة الاتصال…";
        try { Aj().loadTickers && Aj().loadTickers(); } catch (e) {}
        setTimeout(netBanner, 2500);
      });
    }
    var now = Date.now(), ok = window.__AJ_TK_OK || 0, fail = window.__AJ_TK_FAIL || 0, cached = window.__AJ_TK_CACHED || 0;
    var state = "", text = "";
    if (navigator.onLine === false) { state = "off"; text = "📴 لا يوجد اتصال بالإنترنت" + (ok || cached ? " — تُعرض آخر أسعار محفوظة (قبل " + ago(now - (ok || cached)) + ")" : "") + "."; }
    else if (fail > ok && fail) { state = "warn"; text = "⚠️ تعذر الوصول إلى Gate.io" + (ok || cached ? " — الأسعار المعروضة من قبل " + ago(now - (ok || cached)) : "") + ". نعيد المحاولة تلقائيًا."; }
    else if (ok && now - ok > 90000) { state = "warn"; text = "⏳ الأسعار متأخرة (آخر تحديث قبل " + ago(now - ok) + ")."; }
    b.classList.toggle("show", !!state); b.classList.toggle("off", state === "off");
    if (state) b.querySelector(".t").textContent = text;
    if (state !== lastState) { lastState = state; try { window.dispatchEvent(new Event("resize")); } catch (e) {} }
  }

  /* ---------- top movers (liquid pairs only) ---------- */
  var moversSig = "";
  function movers() {
    var panel = $("tab-markets"), tools = panel && panel.querySelector(".mkt-tools"); if (!tools) return;
    var box = $("v19-movers");
    if (!box) {
      box = document.createElement("div"); box.id = "v19-movers"; box.setAttribute("aria-label", "الأكثر حركة خلال 24 ساعة");
      tools.parentNode.insertBefore(box, tools);
      box.addEventListener("click", function (ev) {
        var b = ev.target.closest("[data-mp]"); if (!b) return;
        hap("sel");
        try { Aj().selectPair(b.getAttribute("data-mp")); Aj().showTab("trade"); } catch (e) {}
      });
    }
    var tk = Aj().tickers || {}, rows = [];
    Object.keys(tk).forEach(function (p) { var t = tk[p]; if (/_USDT$/.test(p) && t && t.last > 0 && t.quote >= 300000 && isFinite(t.change) && !/^(USDC|FDUSD|DAI|TUSD|USDE|PYUSD)_/.test(p)) rows.push([p, Number(t.change)]); });
    if (rows.length < 6) { box.style.display = "none"; return; }
    rows.sort(function (a, b) { return b[1] - a[1]; });
    var top = rows.slice(0, 4), bot = rows.slice(-3).reverse();
    var sig = top.concat(bot).map(function (r) { return r[0] + r[1].toFixed(1); }).join("|");
    if (sig === moversSig) return; moversSig = sig;
    function chip(r) { var up = r[1] >= 0; return '<button type="button" class="' + (up ? "up" : "down") + '" data-mp="' + esc(r[0]) + '">' + esc(r[0].replace("_USDT", "")) + "<i>" + (up ? "+" : "") + r[1].toFixed(1) + "%</i></button>"; }
    var wasHidden = box.style.display === "none" || !box.innerHTML;
    box.style.display = "";
    if (wasHidden) setTimeout(function () { try { window.dispatchEvent(new Event("resize")); } catch (e) {} }, 0);
    box.innerHTML = '<span class="lbl">🔥 الأكثر صعودًا</span>' + top.map(chip).join("") + '<span class="lbl">📉 الأكثر هبوطًا</span>' + bot.map(chip).join("");
  }

  /* ---------- boot ---------- */
  var lastOk = 0;
  function tick() {
    netBanner();
    var ok = window.__AJ_TK_OK || 0;
    if (ok !== lastOk) {
      lastOk = ok;
      var mk = $("tab-markets"); if (mk && !mk.classList.contains("hidden")) movers(); else moversSig = moversSig || "";
      var pf = $("tab-portfolio");
      if (pf && !pf.classList.contains("hidden") && window.AjV17 && window.AjV17.render) window.AjV17.render();
    }
  }
  function boot() {
    if (!window.Aj || !document.querySelector("header")) { setTimeout(boot, 80); return; }
    css(); netBanner(); movers();
    window.addEventListener("online", function () { try { Aj().loadTickers(); } catch (e) {} netBanner(); });
    window.addEventListener("offline", netBanner);
    document.addEventListener("aj:net", netBanner);
    document.addEventListener("click", function (ev) { if (ev.target.closest && ev.target.closest('#v18-nav [data-g="home"],#v18-sub [data-st="markets"]')) setTimeout(function () { moversSig = ""; movers(); }, 60); });
    setInterval(tick, 3000);
    window.AjV19 = { net: netBanner, movers: function () { moversSig = ""; movers(); }, state: function () { return { banner: lastState, movers: document.querySelectorAll("#v19-movers [data-mp]").length }; } };
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", function () { setTimeout(boot, 0); });
  else setTimeout(boot, 0);
})();
