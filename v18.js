/* ajcoin-miniapp v18-ui — modern role-aware bottom navigation (≤5 items) with segmented sub-tabs,
   glass sticky header (balance chip for the owner, masked when hidden), Telegram haptics / BackButton /
   safe areas / theme, design tokens + fluid type + container queries, inline SVG icons, lazy sparklines
   in the (virtualized) market list, pull-to-refresh on markets, reduced-motion support.
   UI only: every action still goes through the existing tabs, Aj.sendAction and bot-side permissions. */
(function () {
  "use strict";
  var $ = function (id) { return document.getElementById(id); };
  function tg() { return window.Telegram && window.Telegram.WebApp; }
  function Aj() { return window.Aj || {}; }
  function role() { return window.AjRole || "guest"; }
  function hap(k) {
    try {
      var h = tg() && tg().HapticFeedback; if (!h) return;
      if (k === "sel") h.selectionChanged();
      else if (k === "ok" || k === "err" || k === "warn") h.notificationOccurred(k === "ok" ? "success" : k === "err" ? "error" : "warning");
      else h.impactOccurred(k || "light");
    } catch (e) {}
  }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }

  /* ---------- inline SVG icon set (24px, stroke = currentColor) ---------- */
  var P = {
    chart: '<path d="M3 3v18h18"/><path d="M7 15l4-4 3 3 5-6"/>',
    swap: '<path d="M7 4L3 8l4 4"/><path d="M3 8h13"/><path d="M17 20l4-4-4-4"/><path d="M21 16H8"/>',
    wallet: '<rect x="3" y="6" width="18" height="14" rx="3"/><path d="M3 10h18"/><path d="M16 15h2"/><path d="M6 6l9-3 1 3"/>',
    ai: '<path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/>',
    more: '<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>',
    star: '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>',
    layers: '<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/>',
    list: '<path d="M9 6h12M9 12h12M9 18h12"/><circle cx="4.5" cy="6" r="1"/><circle cx="4.5" cy="12" r="1"/><circle cx="4.5" cy="18" r="1"/>',
    bolt: '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>',
    bell: '<path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z"/><path d="M10 20a2 2 0 0 0 4 0"/>',
    users: '<circle cx="9" cy="8" r="3.2"/><path d="M3 20a6 6 0 0 1 12 0"/><path d="M16 4.5a3 3 0 0 1 0 6"/><path d="M18 14a5 5 0 0 1 3 6"/>',
    flask: '<path d="M9 3h6"/><path d="M10 3v6L4.5 18.5A2 2 0 0 0 6.2 21.5h11.6a2 2 0 0 0 1.7-3L14 9V3"/><path d="M7 15h10"/>',
    search: '<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4-4"/>',
    refresh: '<path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/>'
  };
  function svg(n, cls) { return '<svg class="' + (cls || "ic") + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (P[n] || "") + "</svg>"; }

  /* ---------- tabs → groups (role-aware) ---------- */
  var TAB = {
    markets: ["الكل", "الأسواق", "chart"], "new": ["جديد", "الإدراجات الجديدة", "star"],
    trade: ["فوري", "التداول الفوري", "swap"], futures: ["عقود", "العقود الآجلة", "layers"], orders: ["أوامري", "أوامري المفتوحة", "list"],
    portfolio: ["المحفظة", "المحفظة والرصيد", "wallet"], xpaper: ["محفظتي", "المحفظة التجريبية", "flask"],
    xsmart: ["ذكي", "التداول الذكي", "ai"], smart: ["تحليل", "التحليل الذكي", "ai"], auto: ["تلقائي", "التداول التلقائي", "bolt"], alerts: ["تنبيهات", "التنبيهات", "bell"],
    xteam: ["الزملاء", "إدارة الزملاء", "users"]
  };
  var DENY = { team: { auto: 1, orders: 1, portfolio: 1, xteam: 1 }, guest: { auto: 1, orders: 1, portfolio: 1, xpaper: 1, xteam: 1 }, owner: { xpaper: 1 } };
  function allowed(t) { return !!$("tab-" + t) && !(DENY[role()] || {})[t]; }
  function groups() {
    var g = [
      { id: "home", label: "الأسواق", icon: "chart", tabs: ["markets", "new"] },
      { id: "trade", label: "تداول", icon: "swap", tabs: ["trade", "futures", "orders"] },
      { id: "wallet", label: role() === "team" ? "محفظتي" : "المحفظة", icon: "wallet", tabs: ["portfolio", "xpaper"] },
      { id: "ai", label: "الذكاء", icon: "ai", tabs: ["xsmart", "smart", "auto", "alerts"] },
      { id: "more", label: "المزيد", icon: "more", tabs: ["xteam"] }
    ];
    return g.map(function (x) { return { id: x.id, label: x.label, icon: x.icon, tabs: x.tabs.filter(allowed) }; })
      .filter(function (x) { return x.tabs.length || x.id === "more"; });
  }

  /* ---------- design tokens + modern CSS ---------- */
  function css() {
    if ($("v18-css")) return;
    var s = document.createElement("style"); s.id = "v18-css";
    s.textContent = [
      ":root{--sp-1:4px;--sp-2:8px;--sp-3:12px;--sp-4:16px;--r-s:10px;--r-m:14px;--r-l:20px;--nav-h:64px;--sat:0px;--sab:0px;",
      "--acc:var(--btn,#3b82f6);--glass:color-mix(in srgb,var(--card) 78%,transparent);--glass-line:color-mix(in srgb,var(--text) 9%,transparent);",
      "--shadow-1:0 1px 0 color-mix(in srgb,var(--text) 5%,transparent) inset,0 6px 20px -12px #0008;--ease:cubic-bezier(.2,.8,.2,1);",
      "--fs-xs:clamp(10px,2.7vw,11px);--fs-s:clamp(12px,3.3vw,13px);--fs-m:clamp(14px,3.8vw,15px);--fs-l:clamp(17px,4.8vw,20px);--fs-xl:clamp(20px,6.4vw,26px)}",
      "html,body{font-family:'Tajawal','IBM Plex Sans Arabic','Noto Sans Arabic','Segoe UI',system-ui,-apple-system,Roboto,Tahoma,sans-serif;text-rendering:optimizeLegibility;-webkit-font-smoothing:antialiased}",
      "body{padding-bottom:calc(var(--nav-h) + max(env(safe-area-inset-bottom),var(--sab)) + 8px)!important;overscroll-behavior-y:contain}",
      "#tabs{display:none!important}",
      /* header */
      "header{padding:calc(10px + max(env(safe-area-inset-top),var(--sat))) 14px 8px!important;background:var(--glass)!important;",
      "backdrop-filter:saturate(1.5) blur(16px);-webkit-backdrop-filter:saturate(1.5) blur(16px);border-bottom:1px solid var(--glass-line);z-index:12!important}",
      "header h1{font-size:var(--fs-l)!important;letter-spacing:-.01em;display:flex;align-items:center;gap:6px;min-width:0}",
      "header .title{align-items:center!important}",
      "header .live{gap:8px!important;flex-wrap:nowrap}",
      ".pair-head{margin-top:4px!important}.pair-head .px{font-size:var(--fs-xl)!important}",
      "body[data-g=wallet] .pair-head,body[data-g=more] .pair-head,body[data-g=ai] .pair-head{display:none!important}",
      "#v18-bal{display:inline-flex;align-items:center;gap:5px;height:30px;padding:0 10px;border-radius:999px;border:1px solid var(--glass-line);",
      "background:color-mix(in srgb,var(--acc) 14%,transparent);color:var(--text);font:inherit;font-size:var(--fs-s);font-weight:700;font-variant-numeric:tabular-nums;direction:ltr;cursor:pointer;max-width:42vw;overflow:hidden;white-space:nowrap}",
      "#v18-bal .ic{width:15px;height:15px;flex:none}",
      /* segmented sub-tabs */
      ".v18-sub{display:flex;gap:4px;margin-top:8px;padding:3px;border-radius:12px;background:color-mix(in srgb,var(--text) 6%,transparent);overflow-x:auto;scrollbar-width:none}",
      ".v18-sub::-webkit-scrollbar{display:none}",
      ".v18-sub button{flex:1 1 0;min-width:0;white-space:nowrap;border:0;background:none;color:var(--muted);font:inherit;font-size:var(--fs-s);font-weight:650;",
      "padding:7px 10px;border-radius:9px;display:inline-flex;align-items:center;justify-content:center;gap:5px;transition:background .2s var(--ease),color .2s var(--ease)}",
      ".v18-sub button .ic{width:15px;height:15px}",
      ".v18-sub button.on{background:var(--card);color:var(--text);box-shadow:var(--shadow-1)}",
      ".v18-sub:empty{display:none}",
      /* bottom navigation */
      "#v18-nav{position:fixed;inset-inline:0;bottom:0;z-index:25;display:grid;grid-auto-flow:column;grid-auto-columns:1fr;gap:2px;",
      "padding:6px 8px calc(6px + max(env(safe-area-inset-bottom),var(--sab)));background:var(--glass);border-top:1px solid var(--glass-line);",
      "backdrop-filter:saturate(1.6) blur(18px);-webkit-backdrop-filter:saturate(1.6) blur(18px)}",
      "#v18-nav button{position:relative;border:0;background:none;color:var(--muted);font:inherit;font-size:var(--fs-xs);font-weight:650;min-height:50px;",
      "display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;border-radius:14px;cursor:pointer;transition:color .2s var(--ease)}",
      "#v18-nav .pill{display:grid;place-items:center;width:52px;height:30px;border-radius:999px;transition:background .25s var(--ease),transform .25s var(--ease)}",
      "#v18-nav .ic{width:22px;height:22px}",
      "#v18-nav button.on{color:var(--text)}",
      "#v18-nav button.on .pill{background:color-mix(in srgb,var(--acc) 22%,transparent);color:var(--acc);transform:translateY(-1px)}",
      "#v18-nav button:active .pill{transform:scale(.92)}",
      "#v18-nav .dotb{position:absolute;top:6px;inset-inline-start:calc(50% + 10px);width:7px;height:7px;border-radius:50%;background:var(--down)}",
      ".toast{bottom:calc(var(--nav-h) + 14px + max(env(safe-area-inset-bottom),var(--sab)))!important;z-index:60!important}",
      /* more sheet */
      "#v18-more{position:fixed;inset:0;z-index:44;display:none}",
      "#v18-more.open{display:block}",
      "#v18-more .bd{position:absolute;inset:0;background:#0009;animation:v18fade .2s var(--ease)}",
      "#v18-more .sh{position:absolute;inset-inline:0;bottom:0;max-height:82dvh;overflow:auto;background:var(--card);border-radius:22px 22px 0 0;",
      "padding:10px 16px calc(18px + max(env(safe-area-inset-bottom),var(--sab)));box-shadow:0 -12px 40px #0007;animation:v18up .28s var(--ease)}",
      "#v18-more .grab{width:40px;height:4px;border-radius:4px;background:var(--line);margin:0 auto 10px}",
      "#v18-more h3{margin:6px 2px 10px;font-size:var(--fs-m)}",
      "#v18-more .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(96px,1fr));gap:8px}",
      "#v18-more .tile{display:flex;flex-direction:column;align-items:center;gap:6px;padding:12px 6px;border-radius:16px;border:1px solid var(--glass-line);",
      "background:color-mix(in srgb,var(--text) 4%,transparent);color:var(--text);font:inherit;font-size:var(--fs-s);font-weight:650;text-align:center;cursor:pointer}",
      "#v18-more .tile .ic{width:24px;height:24px;color:var(--acc)}",
      "#v18-more .tile.on{border-color:color-mix(in srgb,var(--acc) 60%,transparent);background:color-mix(in srgb,var(--acc) 12%,transparent)}",
      "#v18-more .foot{margin-top:12px;color:var(--muted);font-size:var(--fs-xs);text-align:center}",
      /* market rows: sparkline + colour-coded change */
      "#mkt .row{grid-template-columns:28px minmax(0,1fr) 46px auto 66px!important;gap:8px;border:1px solid var(--glass-line)!important;transition:transform .12s var(--ease)}",
      "#mkt .row:active{transform:scale(.985)}",
      "#mkt .row .sym{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
      "#mkt .row .last{font-variant-numeric:tabular-nums;direction:ltr;text-align:left}",
      "#mkt .row .chgc{justify-self:end;min-width:62px;text-align:center;padding:4px 6px;border-radius:8px;font-size:var(--fs-s);font-weight:750;direction:ltr;font-variant-numeric:tabular-nums}",
      "#mkt .row .chgc.bid{background:color-mix(in srgb,var(--up) 16%,transparent);color:var(--up)}",
      "#mkt .row .chgc.ask{background:color-mix(in srgb,var(--down) 16%,transparent);color:var(--down)}",
      ".v18-sp.draw path:last-child{stroke-dasharray:300;stroke-dashoffset:300;animation:v18draw .7s ease-out forwards}.v18-sp.draw path:first-child{animation:v18fade .7s ease-out}",
      "@keyframes v18draw{to{stroke-dashoffset:0}}",
      ".v18-sp{display:block;width:46px;height:22px}.v18-sp svg{width:46px;height:22px;display:block;overflow:visible}",
      ".v18-sp.ld{border-radius:6px;background:linear-gradient(90deg,transparent,color-mix(in srgb,var(--text) 7%,transparent),transparent);background-size:200% 100%;animation:ajSkel 1.4s linear infinite}",
      /* pull to refresh */
      "#v18-ptr{height:0;overflow:hidden;display:flex;align-items:center;justify-content:center;gap:6px;color:var(--muted);font-size:var(--fs-s);transition:height .2s var(--ease)}",
      "#v18-ptr .ic{width:18px;height:18px;transition:transform .1s linear}",
      "#v18-ptr.go .ic{animation:wlspin .8s linear infinite}",
      /* containers + polish */
      "#wl-root,#mkt-wrap,.pp-wrap{container-type:inline-size}",
      "@container (min-width:440px){.wl-split{grid-template-columns:1fr 1fr!important}.wl-kv{grid-template-columns:repeat(4,1fr)!important}}",
      "@container (max-width:350px){.v18-sp,.v18-sp svg{width:34px}#mkt .row{grid-template-columns:24px minmax(0,1fr) 34px auto 58px!important;gap:6px}#mkt .row .chgc{min-width:56px;padding:4px 4px}}",
      "@container (max-width:300px){.v18-sp{display:none!important}#mkt .row{grid-template-columns:24px minmax(0,1fr) auto 58px!important}}",
      ".panel{animation:v18in .24s var(--ease)}",
      ".card,.wl-hero,.wl-row,.wl-kv>div,.wl-mini{border-radius:var(--r-m)}",
      "button,select,input{touch-action:manipulation}",
      ":focus-visible{outline:2px solid var(--acc);outline-offset:2px}",
      "@keyframes v18in{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}",
      "@keyframes v18up{from{transform:translateY(100%)}to{transform:none}}",
      "@keyframes v18fade{from{opacity:0}to{opacity:1}}",
      "@keyframes ajSkel{0%{background-position:200% 0}100%{background-position:-200% 0}}",
      "@keyframes wlspin{to{transform:rotate(360deg)}}",
      ".theme-light #v18-more .bd{background:#0005}.theme-light #v18-nav,.theme-light header{background:color-mix(in srgb,var(--bg) 82%,transparent)!important}",
      "@media (max-width:400px){header #src{display:none}#v18-nav .pill{width:46px}}",
      "@media (max-width:350px){#v18-nav{padding-inline:2px}#v18-nav button{font-size:10px}.v18-sub button{padding:7px 6px}}",
      "@media (prefers-reduced-motion:reduce){*,*::before,*::after{animation-duration:.001ms!important;animation-iteration-count:1!important;transition-duration:.001ms!important;scroll-behavior:auto!important}}"
    ].join("\n");
    document.head.appendChild(s);
  }

  /* ---------- navigation state ---------- */
  var G = [], last = {}, curTab = null, curGroup = null, moreOpen = false;
  function groupOf(t) { for (var i = 0; i < G.length; i++) if (G[i].tabs.indexOf(t) >= 0) return G[i].id; return "more"; }
  function visibleTab() {
    var p = document.querySelector("section.panel:not(.hidden)");
    return p ? p.id.replace(/^tab-/, "") : null;
  }
  function go(t) {
    if (!t || !allowed(t)) return false;
    var b = document.querySelector('#tabs [data-tab="' + t + '"]');
    if (b) b.click(); else { try { Aj().showTab(t); } catch (e) {} }
    return true;
  }
  function renderNav() {
    var nav = $("v18-nav");
    if (!nav) {
      nav = document.createElement("nav"); nav.id = "v18-nav"; nav.setAttribute("role", "tablist"); nav.setAttribute("aria-label", "التنقل الرئيسي");
      document.body.appendChild(nav);
      nav.addEventListener("click", function (ev) {
        var b = ev.target.closest("[data-g]"); if (!b) return;
        var g = b.getAttribute("data-g");
        hap("sel");
        if (g === "more") { openMore(); return; }
        var grp = G.filter(function (x) { return x.id === g; })[0]; if (!grp) return;
        if (g === curGroup) { try { window.scrollTo({ top: 0, behavior: "smooth" }); } catch (e) { window.scrollTo(0, 0); } var w = document.querySelector("#tab-" + curTab + " .mkt-wrap,#tab-" + curTab + " .fut-wrap,#tab-" + curTab + " .new-wrap"); if (w) w.scrollTop = 0; return; }
        go(last[g] && grp.tabs.indexOf(last[g]) >= 0 ? last[g] : grp.tabs[0]);
      });
    }
    nav.innerHTML = G.map(function (g) {
      return '<button type="button" role="tab" data-g="' + g.id + '" aria-label="' + esc(g.label) + '"><span class="pill">' + svg(g.icon) + "</span><span>" + esc(g.label) + "</span></button>";
    }).join("");
  }
  function renderSub() {
    var sub = $("v18-sub"), hd = document.querySelector("header");
    if (!sub && hd) { sub = document.createElement("div"); sub.id = "v18-sub"; sub.className = "v18-sub"; sub.setAttribute("role", "tablist"); hd.appendChild(sub);
      sub.addEventListener("click", function (ev) { var b = ev.target.closest("[data-st]"); if (!b) return; hap("sel"); go(b.getAttribute("data-st")); }); }
    if (!sub) return;
    var grp = G.filter(function (x) { return x.id === curGroup; })[0];
    var tabs = grp && grp.id !== "more" ? grp.tabs : [];
    var html = tabs.length > 1 ? tabs.map(function (t) {
      return '<button type="button" role="tab" data-st="' + t + '" class="' + (t === curTab ? "on" : "") + '" aria-selected="' + (t === curTab) + '">' + svg(TAB[t][2]) + esc(TAB[t][0]) + "</button>";
    }).join("") : "";
    if (sub.innerHTML !== html) sub.innerHTML = html;
  }
  function sync() {
    var t = visibleTab(); if (!t) return;
    var g = groupOf(t), changed = t !== curTab;
    curTab = t; curGroup = g; last[g] = t;
    document.body.setAttribute("data-g", g); document.body.setAttribute("data-t", t);
    document.querySelectorAll("#v18-nav [data-g]").forEach(function (b) {
      var on = b.getAttribute("data-g") === (moreOpen ? "more" : g);
      b.classList.toggle("on", on); b.setAttribute("aria-selected", on ? "true" : "false");
    });
    renderSub();
    if (changed) { sizeLists(); if (t === "markets") setTimeout(spark, 50); }
  }
  var raf = 0;
  function schedule() { if (raf) return; raf = requestAnimationFrame(function () { raf = 0; sync(); }); }
  function observePanels() {
    var mo = new MutationObserver(schedule);
    function watch() { document.querySelectorAll("section.panel").forEach(function (p) { if (!p.__v18) { p.__v18 = 1; mo.observe(p, { attributes: true, attributeFilter: ["class"] }); } }); }
    watch();
    new MutationObserver(function () { watch(); var n = groups(); if (JSON.stringify(n) !== JSON.stringify(G)) { G = n; renderNav(); } schedule(); }).observe(document.body, { childList: true });
  }

  /* ---------- list heights (no layout shift; virtualized lists keep working) ---------- */
  function sizeLists() {
    var nav = $("v18-nav"), nh = nav ? nav.offsetHeight : 64;
    document.documentElement.style.setProperty("--nav-h", nh + "px");
    ["mkt-wrap", "fut-wrap", "new-wrap"].forEach(function (id) {
      var w = $(id); if (!w || !w.offsetParent) return;
      var top = w.getBoundingClientRect().top + window.scrollY;
      var h = Math.max(240, Math.round(window.innerHeight - top - nh - 10));
      if (Math.abs((parseFloat(w.style.height) || 0) - h) > 2) { w.style.height = h + "px"; try { w.dispatchEvent(new Event("scroll")); } catch (e) {} }
    });
  }

  /* ---------- "More" sheet (BackButton aware) ---------- */
  var savedCmd = null;
  function openMore() {
    var root = $("v18-more");
    if (!root) {
      root = document.createElement("div"); root.id = "v18-more"; root.setAttribute("role", "dialog"); root.setAttribute("aria-label", "المزيد");
      document.body.appendChild(root);
      root.addEventListener("click", function (ev) {
        if (ev.target.classList.contains("bd")) { closeMore(); return; }
        var b = ev.target.closest("[data-mt]"); if (!b) return;
        hap("sel"); var t = b.getAttribute("data-mt"); closeMore(); go(t);
      });
    }
    var all = [];
    G.forEach(function (g) { g.tabs.forEach(function (t) { all.push(t); }); });
    var r = role();
    root.innerHTML = '<div class="bd"></div><div class="sh"><div class="grab"></div><h3>كل الأقسام</h3><div class="grid">' +
      all.map(function (t) { return '<button type="button" class="tile' + (t === curTab ? " on" : "") + '" data-mt="' + t + '">' + svg(TAB[t][2]) + esc(TAB[t][1]) + "</button>"; }).join("") +
      '</div><div class="foot">' + (r === "owner" ? "وضع المالك · التنفيذ الحقيقي يتطلب تأكيدك ✅ في المحادثة" : r === "team" ? "وضع الزميل · تداول تجريبي واقتراحات فقط" : "وضع الزائر · عرض الأسعار فقط — أرسل /join للبوت لطلب الانضمام") + " · v19</div></div>";
    root.classList.add("open"); moreOpen = true; hap("light");
    savedCmd = window.AjCmd || null;
    window.AjCmd = {
      open: function () { closeMore(); savedCmd && savedCmd.open && savedCmd.open(); },
      close: function () { closeMore(); },
      isOpen: function () { return moreOpen || !!(savedCmd && savedCmd.isOpen && savedCmd.isOpen()); }
    };
    try { tg() && tg().BackButton && tg().BackButton.show(); } catch (e) {}
    sync();
  }
  function closeMore() {
    if (!moreOpen) return;
    moreOpen = false; var root = $("v18-more"); if (root) root.classList.remove("open");
    if (savedCmd) window.AjCmd = savedCmd; else { try { delete window.AjCmd; } catch (e) { window.AjCmd = undefined; } }
    savedCmd = null;
    try { Aj().syncTelegramChrome && Aj().syncTelegramChrome(curTab); } catch (e) {}
    sync();
  }

  /* ---------- header balance chip (owner only; follows the wallet eye toggle) ---------- */
  function balChip() {
    if (role() !== "owner") return;
    var live = document.querySelector("header .live"); if (!live) return;
    var b = $("v18-bal");
    if (!b) {
      b = document.createElement("button"); b.type = "button"; b.id = "v18-bal"; b.setAttribute("aria-label", "الرصيد — فتح المحفظة");
      live.insertBefore(b, live.firstChild);
      b.addEventListener("click", function () { hap("sel"); go("portfolio"); });
    }
    var v = window.AjV17 && window.AjV17.total ? window.AjV17.total() : null;
    var hidden = window.AjV17 && window.AjV17.hidden ? window.AjV17.hidden() : true;
    var txt = v == null ? "—" : hidden ? "••••" : "$" + Number(v).toLocaleString("en-US", { maximumFractionDigits: v >= 100 ? 0 : 2 });
    b.innerHTML = svg("wallet") + "<span>" + esc(txt) + "</span>";
  }

  /* ---------- Telegram safe areas + theme ---------- */
  function safe() {
    var t = tg(), s = (t && t.safeAreaInset) || {}, c = (t && t.contentSafeAreaInset) || {};
    var root = document.documentElement.style;
    root.setProperty("--sat", ((Number(s.top) || 0) + (Number(c.top) || 0)) + "px");
    root.setProperty("--sab", ((Number(s.bottom) || 0) + (Number(c.bottom) || 0)) + "px");
  }
  function theme() {
    try {
      var t = tg(); if (!t) return;
      var bg = getComputedStyle(document.documentElement).getPropertyValue("--bg").trim() || (t.themeParams && t.themeParams.bg_color);
      if (bg && /^#[0-9a-f]{6}$/i.test(bg)) {
        if (t.setHeaderColor) t.setHeaderColor(bg);
        if (t.setBackgroundColor) t.setBackgroundColor(bg);
        if (t.setBottomBarColor) t.setBottomBarColor(bg);
      }
      var m = document.querySelector('meta[name="theme-color"]');
      if (!m) { m = document.createElement("meta"); m.name = "theme-color"; document.head.appendChild(m); }
      if (bg) m.content = bg;
    } catch (e) {}
  }

  /* ---------- sparklines (lazy, only for rendered rows of the virtualized list) ---------- */
  var SP = {}, Q = [], inflight = 0, SPK = "aj_sp18";
  try { var c0 = JSON.parse(sessionStorage.getItem(SPK) || "{}"); if (c0 && typeof c0 === "object") SP = c0; } catch (e) {}
  function spSave() { try { var k = Object.keys(SP); if (k.length > 150) k.slice(0, k.length - 150).forEach(function (x) { delete SP[x]; }); sessionStorage.setItem(SPK, JSON.stringify(SP)); } catch (e) {} }
  function spSvg(pts, pair) {
    if (!pts || pts.length < 2) return "";
    /* v19.1: end the line at the live price and colour it like the 24h badge next to it */
    var tk = pair && Aj().tickers && Aj().tickers[pair];
    if (tk && tk.last > 0) pts = pts.concat([Number(tk.last)]);
    var mn = Math.min.apply(null, pts), mx = Math.max.apply(null, pts), rg = mx - mn || 1, W = 46, H = 22;
    var d = pts.map(function (v, i) { return (i ? "L" : "M") + (i * W / (pts.length - 1)).toFixed(1) + " " + (H - 2 - (v - mn) / rg * (H - 4)).toFixed(1); }).join("");
    var chg = tk && isFinite(tk.change) ? Number(tk.change) : null;
    var col = (chg != null ? chg >= 0 : pts[pts.length - 1] >= pts[0]) ? "var(--up)" : "var(--down)";
    return '<svg viewBox="0 0 46 22" preserveAspectRatio="none" aria-hidden="true"><path d="' + d + 'L46 22L0 22Z" fill="' + col + '" opacity=".12"/><path d="' + d + '" fill="none" stroke="' + col + '" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/></svg>';
  }
  function spark() {
    var box = $("mkt"); if (!box || !box.offsetParent) return;
    var now = Date.now();
    box.querySelectorAll(".row[data-pair]").forEach(function (row) {
      var p = row.getAttribute("data-pair"), el = row.querySelector(".v18-sp");
      if (!el) { el = document.createElement("span"); el.className = "v18-sp"; var lastEl = row.querySelector(".last"); row.insertBefore(el, lastEl || null); }
      var c = SP[p];
      if (c && now - c.t < 15 * 60e3) { if (!el.firstChild) { el.classList.remove("ld"); el.innerHTML = spSvg(c.p, p); } }
      else { el.classList.add("ld"); if (Q.indexOf(p) < 0) Q.push(p); }
    });
    pump();
  }
  function pump() {
    while (inflight < 3 && Q.length) {
      var p = Q.shift();
      if (!document.querySelector('#mkt .row[data-pair="' + p + '"]')) continue;
      inflight++;
      (function (p) {
        fetch((Aj().GATE || "https://api.gateio.ws/api/v4") + "/spot/candlesticks?currency_pair=" + encodeURIComponent(p) + "&interval=1h&limit=24")
          .then(function (r) { return r.ok ? r.json() : []; })
          .then(function (rows) {
            var pts = (Array.isArray(rows) ? rows : []).map(function (x) { return Number(Array.isArray(x) ? x[2] : x && x.c); }).filter(isFinite);
            SP[p] = { t: Date.now(), p: pts.length > 1 ? pts : [] };
            var el = document.querySelector('#mkt .row[data-pair="' + p + '"] .v18-sp');
            if (el) { el.classList.remove("ld"); el.innerHTML = spSvg(SP[p].p, p); if (!matchMedia("(prefers-reduced-motion: reduce)").matches) el.classList.add("draw"); }
          })
          .catch(function () { SP[p] = { t: Date.now() - 12 * 60e3, p: [] }; })
          .then(function () { inflight--; spSaveD(); pump(); });
      })(p);
    }
  }
  var spT = 0; function spSaveD() { clearTimeout(spT); spT = setTimeout(spSave, 800); }
  function watchMarkets() {
    var box = $("mkt"); if (!box) return;
    new MutationObserver(function () { spark(); }).observe(box, { childList: true });
    spark();
  }

  /* ---------- pull to refresh (markets list) ---------- */
  function ptr() {
    var w = $("mkt-wrap"); if (!w || $("v18-ptr")) return;
    var ind = document.createElement("div"); ind.id = "v18-ptr"; ind.innerHTML = svg("refresh") + "<span>اسحب للتحديث</span>";
    w.parentNode.insertBefore(ind, w);
    var y0 = null, dy = 0, busy = false;
    w.addEventListener("touchstart", function (e) { if (w.scrollTop <= 0 && !busy) { y0 = e.touches[0].clientY; dy = 0; } }, { passive: true });
    w.addEventListener("touchmove", function (e) {
      if (y0 == null) return; dy = e.touches[0].clientY - y0;
      if (dy <= 0) { ind.style.height = "0"; return; }
      var h = Math.min(56, dy * .5); ind.style.height = h + "px";
      ind.querySelector(".ic").style.transform = "rotate(" + Math.min(360, dy * 3) + "deg)";
      ind.querySelector("span").textContent = dy > 70 ? "أفلت للتحديث" : "اسحب للتحديث";
    }, { passive: true });
    w.addEventListener("touchend", function () {
      if (y0 == null) return; y0 = null;
      if (dy > 70) refresh(); else ind.style.height = "0";
    });
    function refresh() {
      busy = true; ind.classList.add("go"); ind.style.height = "40px"; ind.querySelector("span").textContent = "جارٍ التحديث…"; hap("light");
      Promise.resolve().then(function () { return Aj().loadTickers && Aj().loadTickers(); })
        .then(function () { hap("ok"); }, function () { hap("err"); })
        .then(function () { busy = false; ind.classList.remove("go"); ind.style.height = "0"; window.__V18_PTR = (window.__V18_PTR || 0) + 1; });
    }
    window.AjV18 = window.AjV18 || {}; window.AjV18.pullRefresh = refresh;
  }

  /* ---------- boot ---------- */
  function ready() {
    var r = role();
    if (!window.Aj || !$("tabs") || !window.AjRole || !/role-/.test(document.body.className)) return false;
    if (r === "owner" && !$("tab-xteam")) return false;
    if (r === "team" && !$("tab-xpaper")) return false;
    return true;
  }
  var tries = 0;
  function boot() {
    if (!ready()) { if (tries++ < 100) setTimeout(boot, 60); return; }
    css(); safe(); theme();
    G = groups();
    renderNav(); sync(); balChip();
    observePanels(); watchMarkets(); ptr();
    document.addEventListener("aj:bal", balChip);
    window.addEventListener("resize", function () { sizeLists(); }, { passive: true });
    try {
      var t = tg();
      if (t && t.onEvent) {
        t.onEvent("safeAreaChanged", safe); t.onEvent("contentSafeAreaChanged", safe); t.onEvent("fullscreenChanged", safe);
        t.onEvent("themeChanged", function () { setTimeout(theme, 50); });
        t.onEvent("viewportChanged", function () { sizeLists(); });
      }
    } catch (e) {}
    document.addEventListener("visibilitychange", function () { if (!document.hidden && curTab === "markets") spark(); });
    setTimeout(sizeLists, 300); setTimeout(sizeLists, 1500);
    window.AjV18 = Object.assign(window.AjV18 || {}, {
      groups: function () { return G.map(function (g) { return { id: g.id, tabs: g.tabs.slice() }; }); },
      state: function () { return { tab: curTab, group: curGroup, more: moreOpen }; },
      go: go, openMore: openMore, closeMore: closeMore
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", function () { setTimeout(boot, 0); });
  else setTimeout(boot, 0);
})();
