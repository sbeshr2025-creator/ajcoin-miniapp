/* ajcoin-miniapp v17-wallet — owner balance in the wallet tab, wallet polish, design refresh.
   Balances arrive ONLY in the owner's own button URL (?bal=), never in this repo. No withdrawal. */
(function () {
  "use strict";
  var KEY = "aj_bal_v1", HIDE = "aj_hide_bal";
  var q; try { q = new URLSearchParams(location.search); } catch (e) { q = { get: function () { return null; } }; }
  var S = { snap: null, enc: null, hide: false };
  function Aj() { return window.Aj || {}; }
  function $(id) { return document.getElementById(id); }
  function tg() { return Aj().tg || (window.Telegram && window.Telegram.WebApp); }
  function toast(m, k) { try { (Aj().toast || function () {})(m, k); } catch (e) {} }
  function haptic(k) { try { (Aj().haptic || function () {})(k); } catch (e) {} }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function num(n, d) {
    n = Number(n); if (!isFinite(n)) return "—";
    if (d == null) d = Math.abs(n) >= 1000 ? 2 : Math.abs(n) >= 1 ? 4 : Math.abs(n) >= 0.0001 ? 6 : 8;
    try { return n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: d }); } catch (e) { return String(n); }
  }
  function usd(n) { return num(n, 2); }
  function mask(s) { return S.hide ? "••••" : s; }
  function role() { return window.AjRole || "guest"; }
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function cloudGet(k, cb) {
    var t = tg();
    try { if (t && t.CloudStorage && t.CloudStorage.getItem) { t.CloudStorage.getItem(k, function (err, v) { cb(err ? null : v); }); return; } } catch (e) {}
    cb(null);
  }
  function cloudSet(k, v) { var t = tg(); try { if (t && t.CloudStorage && t.CloudStorage.setItem) t.CloudStorage.setItem(k, v, function () {}); } catch (e) {} }

  async function decode(enc) {
    if (!enc || enc[0] !== "z") return null;
    try {
      var bytes = Aj().b64urlToBytes(enc.slice(1));
      var text = await Aj().inflateRawBytes(bytes);
      var o = JSON.parse(text);
      return o && typeof o === "object" && o.v === 1 ? o : null;
    } catch (e) { return null; }
  }
  async function pick() {
    var cands = [];
    var fromUrl = q.get("bal");
    if (fromUrl) cands.push(fromUrl);
    var local = lsGet(KEY); if (local) cands.push(local);
    var cloud = await new Promise(function (res) { var done = false; cloudGet(KEY, function (v) { if (!done) { done = true; res(v); } }); setTimeout(function () { if (!done) { done = true; res(null); } }, 1500); });
    if (cloud) cands.push(cloud);
    var best = null, bestEnc = null;
    for (var i = 0; i < cands.length; i++) {
      var o = await decode(cands[i]);
      if (o && (!best || (o.t || 0) > (best.t || 0))) { best = o; bestEnc = cands[i]; }
    }
    if (best) {
      S.snap = best; S.enc = bestEnc;
      if (bestEnc.length < 4000) { lsSet(KEY, bestEnc); cloudSet(KEY, bestEnc); }
    }
  }

  /* ---------- styles: design refresh ---------- */
  function css() {
    var c = [
      ":root{--r-card:16px;--gap:10px;--fs-sm:12px;--fs-xs:11px}",
      "body{font-feature-settings:'tnum' 1;-webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility}",
      ".num,.px,.pn,[dir=ltr]{font-variant-numeric:tabular-nums}",
      ".panel{animation:fadein .2s cubic-bezier(.2,.7,.2,1)}",
      ".card,.pp-k,.pp-row,.tm-row,.hint.soft,.form,.pp-form{border:1px solid color-mix(in srgb,var(--line) 70%,transparent)}",
      ".card{border-radius:var(--r-card);padding:12px}",
      ".card h3{font-size:14px;color:var(--text);font-weight:750;margin:0 0 10px;display:flex;align-items:center;gap:6px}",
      ".tabs{backdrop-filter:saturate(1.4) blur(12px);-webkit-backdrop-filter:saturate(1.4) blur(12px);background:color-mix(in srgb,var(--card) 88%,transparent);border-top:1px solid var(--line);padding-bottom:env(safe-area-inset-bottom)}",
      ".tabs button{transition:color .15s,background .15s;border-radius:12px;margin:4px 2px}",
      ".tabs button.on span{transform:translateY(-1px)}",
      "label.f{font-weight:600}",
      "select{appearance:none;-webkit-appearance:none;background-image:linear-gradient(45deg,transparent 50%,var(--muted) 50%),linear-gradient(135deg,var(--muted) 50%,transparent 50%);background-position:14px 55%,8px 55%;background-size:6px 6px;background-repeat:no-repeat;padding-left:28px}",
      "input:focus,select:focus{outline:none;border-color:var(--btn);box-shadow:0 0 0 3px color-mix(in srgb,var(--btn) 25%,transparent)}",
      /* wallet */
      ".wl-hero{position:relative;border-radius:20px;padding:16px;margin-bottom:12px;overflow:hidden;background:linear-gradient(135deg,color-mix(in srgb,var(--btn) 32%,var(--card)) 0%,var(--card) 70%);border:1px solid color-mix(in srgb,var(--btn) 35%,var(--line))}",
      ".wl-top{display:flex;justify-content:space-between;align-items:center;gap:8px}",
      ".wl-lbl{font-size:var(--fs-sm);color:var(--muted);font-weight:600}",
      ".wl-total{font-size:30px;font-weight:800;letter-spacing:-.02em;direction:ltr;text-align:right;margin:6px 0 2px;font-variant-numeric:tabular-nums}",
      ".wl-total small{font-size:14px;color:var(--muted);font-weight:650;margin-inline-start:4px}",
      ".wl-sub{display:flex;gap:8px;flex-wrap:wrap;font-size:var(--fs-xs);color:var(--muted)}",
      ".wl-ibtn{border:1px solid var(--line);background:color-mix(in srgb,var(--bg) 60%,transparent);color:var(--text);border-radius:12px;min-width:40px;min-height:40px;font:inherit;font-size:16px;display:inline-flex;align-items:center;justify-content:center}",
      ".wl-ibtn.spin{animation:wlspin 1s linear infinite}",
      "@keyframes wlspin{to{transform:rotate(360deg)}}",
      ".wl-split{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:12px}",
      ".wl-mini{background:color-mix(in srgb,var(--bg) 55%,transparent);border-radius:12px;padding:10px}",
      ".wl-mini b{display:block;font-size:16px;direction:ltr;text-align:right;font-variant-numeric:tabular-nums}",
      ".wl-mini span{font-size:var(--fs-xs);color:var(--muted)}",
      ".wl-sec{display:flex;justify-content:space-between;align-items:baseline;margin:14px 2px 8px}",
      ".wl-sec h4{margin:0;font-size:14px;font-weight:750}",
      ".wl-sec span{font-size:var(--fs-xs);color:var(--muted)}",
      ".wl-row{display:flex;align-items:center;gap:10px;padding:10px 12px;background:var(--card);border-radius:14px;margin-bottom:6px;border:1px solid color-mix(in srgb,var(--line) 70%,transparent)}",
      ".wl-ic{width:34px;height:34px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;color:#fff;flex:none}",
      ".wl-row .m{flex:1;min-width:0}",
      ".wl-row .m b{display:block;font-size:14px}",
      ".wl-row .m small{font-size:var(--fs-xs);color:var(--muted)}",
      ".wl-row .v{text-align:left;direction:ltr;font-variant-numeric:tabular-nums}",
      ".wl-row .v b{display:block;font-size:14px}",
      ".wl-row .v small{font-size:var(--fs-xs);color:var(--muted)}",
      ".wl-kv{display:grid;grid-template-columns:1fr 1fr;gap:8px}",
      ".wl-kv div{background:var(--card);border-radius:12px;padding:10px;border:1px solid color-mix(in srgb,var(--line) 70%,transparent)}",
      ".wl-kv b{display:block;direction:ltr;text-align:right;font-size:15px;font-variant-numeric:tabular-nums}",
      ".wl-kv span{font-size:var(--fs-xs);color:var(--muted)}",
      ".wl-empty{font-size:var(--fs-sm);color:var(--muted);background:var(--card);border-radius:14px;padding:14px;text-align:center;border:1px dashed var(--line)}",
      ".wl-hist{font-size:var(--fs-sm)}",
      ".wl-hist .wl-row{padding:8px 10px}",
      ".wl-tag{font-size:10px;padding:2px 7px;border-radius:999px;background:var(--bg);color:var(--muted);border:1px solid var(--line)}",
      ".wl-tag.ok{color:var(--up);border-color:color-mix(in srgb,var(--up) 45%,transparent)}",
      ".wl-coins{display:flex;gap:6px;overflow-x:auto;padding-bottom:4px;margin-bottom:6px;scrollbar-width:none}",
      ".wl-coins::-webkit-scrollbar{display:none}",
      ".wl-coins button{flex:none;border:1px solid var(--line);background:var(--bg);color:var(--text);border-radius:999px;padding:7px 12px;font:inherit;font-size:13px;font-weight:650;min-height:36px}",
      ".wl-coins button.on{background:var(--btn);border-color:var(--btn);color:#fff}",
      ".wl-chat-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:12px}",
      ".wl-chat-actions button{margin:0;font-size:12px;padding:10px 8px}",
      ".wl-skel{height:22px;border-radius:8px;margin:6px 0}",
      ".up{color:var(--up)} .down{color:var(--down)}",
      ".wl-note{font-size:var(--fs-xs);color:var(--hint);line-height:1.6;margin-top:8px}",
      "@media (max-width:380px){.wl-total{font-size:25px}.wl-split,.wl-kv,.wl-chat-actions{grid-template-columns:1fr 1fr}.wl-row{padding:9px 10px;gap:8px}.wl-ic{width:30px;height:30px}.pp-grid{grid-template-columns:1fr 1fr}.pp-grid .pp-k:first-child{grid-column:1/-1}.tabs button{min-width:48px}}",
      "@media (max-width:340px){.wl-split,.wl-kv{grid-template-columns:1fr}}",
      "html,body{overflow-x:hidden}",
      "img,canvas,svg,table{max-width:100%}"
    ].join("\n");
    var st = document.createElement("style"); st.id = "v17-css"; st.textContent = c; document.head.appendChild(st);
  }

  var COLORS = ["#f59e0b", "#3b82f6", "#10b981", "#8b5cf6", "#ef4444", "#14b8a6", "#ec4899", "#6366f1"];
  function icon(cur) {
    var h = 0; for (var i = 0; i < cur.length; i++) h = (h * 31 + cur.charCodeAt(i)) >>> 0;
    var col = cur === "USDT" ? "#26a17b" : cur === "BTC" ? "#f7931a" : cur === "ETH" ? "#627eea" : COLORS[h % COLORS.length];
    return '<div class="wl-ic" style="background:' + col + '">' + esc(cur.slice(0, 4)) + "</div>";
  }
  function ago(t) {
    if (!t) return "—";
    var s = Math.max(0, Date.now() / 1000 - t);
    if (s < 90) return "الآن";
    if (s < 3600) return "قبل " + Math.round(s / 60) + " د";
    if (s < 86400) return "قبل " + Math.round(s / 3600) + " س";
    return "قبل " + Math.round(s / 86400) + " يوم";
  }
  function clock(t) { try { return new Date(t * 1000).toLocaleString("ar", { hour: "2-digit", minute: "2-digit", day: "numeric", month: "short" }); } catch (e) { return ""; } }

  /* ---------- wallet render (owner) ---------- */
  function render() {
    var root = $("wl-root"); if (!root) return;
    var s = S.snap;
    if (!s) {
      root.innerHTML = '<div class="wl-hero"><div class="wl-top"><span class="wl-lbl">إجمالي الرصيد التقديري</span>' +
        '<button type="button" class="wl-ibtn" id="wl-refresh" aria-label="تحديث الرصيد">↻</button></div>' +
        '<div class="skel wl-skel" style="width:60%;height:34px"></div><div class="skel wl-skel" style="width:40%"></div>' +
        '<p class="wl-note">لم يصل الرصيد بعد. افتح التطبيق من زر القائمة «📱 المحفظة والتداول» أو اضغط ↻ لتحديثه من البوت.</p></div>';
      bindHero();
      return;
    }
    var f = s.f || null, fUp = f ? Number(f.up) || 0 : 0;
    /* v19: live 24h change per coin + estimated 24h P&L of spot holdings (from public tickers) */
    var TK = (window.Aj && window.Aj.tickers) || {};
    function chg(cur) { if (cur === "USDT") return 0; var t = TK[cur + "_USDT"]; return t && isFinite(t.change) && t.last > 0 ? Number(t.change) : null; }
    var d24 = 0, base24 = 0, have24 = false;
    (s.s || []).forEach(function (r) {
      var c = chg(r[0]), v = Number(r[3]); if (c == null || !isFinite(v) || v <= 0) return;
      var t = TK[r[0] + "_USDT"]; if (t && t.last > 0 && r[0] !== "USDT") v = (Number(r[1]) + Number(r[2] || 0)) * t.last;
      d24 += v * c / (100 + c); base24 += v - v * c / (100 + c); if (r[0] !== "USDT") have24 = true;
    });
    var p24 = base24 > 0 ? d24 / base24 * 100 : 0;
    var line24 = have24 ? '<div class="wl-d24 ' + (d24 >= 0 ? "up" : "down") + '">تغيّر 24 ساعة (الفوري): <b>' + mask((d24 >= 0 ? "+" : "") + num(d24, 4)) + ' USDT</b> · ' + (p24 >= 0 ? "+" : "") + p24.toFixed(2) + '%</div>' : "";
    var html = '<div class="wl-hero">' +
      '<div class="wl-top"><span class="wl-lbl">إجمالي الرصيد التقديري · Gate.io</span><span>' +
      '<button type="button" class="wl-ibtn" id="wl-eye" aria-label="إخفاء أو إظهار الرصيد">' + (S.hide ? "🙈" : "👁") + '</button> ' +
      '<button type="button" class="wl-ibtn" id="wl-refresh" aria-label="تحديث الرصيد">↻</button></span></div>' +
      '<div class="wl-total">' + mask(usd(s.T)) + '<small>USDT</small></div>' +
      '<div class="wl-sub"><span>آخر تحديث: ' + esc(clock(s.t)) + ' (' + esc(ago(s.t)) + ')</span></div>' + line24 +
      '<div class="wl-split"><div class="wl-mini"><span>الفوري</span><b>' + mask(usd(s.st)) + '</b></div>' +
      '<div class="wl-mini"><span>العقود (مع غير المحقق)</span><b>' + (f ? mask(usd((Number(f.tot) || 0) + fUp)) : "—") + '</b></div></div></div>';
    html += '<div class="wl-sec"><h4>الأصول الفورية</h4><span>' + (s.s || []).length + ' عملة</span></div>';
    if ((s.s || []).length) {
      html += (s.s || []).map(function (r) {
        var cur = r[0], av = r[1], lk = r[2], val = r[3], c = chg(cur);
        var badge = c == null || cur === "USDT" ? "" : ' <span class="wl-chg ' + (c >= 0 ? "up" : "down") + '">' + (c >= 0 ? "+" : "") + c.toFixed(2) + "%</span>";
        return '<div class="wl-row">' + icon(cur) + '<div class="m"><b>' + esc(cur) + badge + '</b><small>' +
          (lk ? "محتجز " + mask(num(lk)) : "متاح بالكامل") + '</small></div>' +
          '<div class="v"><b>' + mask(num(Number(av) + Number(lk || 0))) + '</b><small>' + (val == null ? "بلا سعر" : "≈ " + mask(usd(val)) + " USDT") + '</small></div></div>';
      }).join("");
    } else html += '<div class="wl-empty">لا يوجد رصيد في الحساب الفوري. استخدم قسم الإيداع أدناه للشحن.</div>';
    html += '<div class="wl-sec"><h4>حساب العقود الآجلة</h4><span>USDT</span></div>';
    if (f) {
      html += '<div class="wl-kv"><div><span>المتاح</span><b>' + mask(num(f.av, 4)) + '</b></div>' +
        '<div><span>الإجمالي</span><b>' + mask(num(f.tot, 4)) + '</b></div>' +
        '<div><span>هامش المراكز / الأوامر</span><b>' + mask(num((Number(f.pm) || 0), 4) + " / " + num((Number(f.om) || 0), 4)) + '</b></div>' +
        '<div><span>ربح/خسارة غير محققة</span><b class="' + (fUp >= 0 ? "up" : "down") + '">' + mask((fUp >= 0 ? "+" : "") + num(fUp, 4)) + '</b></div></div>';
    } else {
      html += '<div class="wl-empty">' + (s.fs === "perm" ? "مفتاح API لا يملك صلاحية قراءة العقود." : "تعذر قراءة حساب العقود في آخر تحديث.") + '</div>';
    }
    html += '<div class="wl-sec"><h4>آخر الصفقات</h4><span>للعرض فقط</span></div><div class="wl-hist">';
    html += (s.h || []).length ? (s.h || []).map(function (t) {
      var buy = t[1] === "buy";
      return '<div class="wl-row"><span class="wl-tag ' + (buy ? "ok" : "") + '">' + (buy ? "شراء" : "بيع") + '</span><div class="m"><b>' + esc(String(t[2]).replace("_", "/")) + '</b><small>' + esc(clock(t[0])) + '</small></div>' +
        '<div class="v"><b>' + mask(num(t[3])) + '</b><small>@ ' + num(t[4]) + '</small></div></div>';
    }).join("") : '<div class="wl-empty">لا توجد صفقات حديثة.</div>';
    html += '</div><div class="wl-sec"><h4>آخر الإيداعات</h4><span>للعرض فقط</span></div><div class="wl-hist">';
    var stAr = { DONE: "مكتمل", PEND: "قيد المعالجة", CHECK: "قيد التحقق", FAIL: "فشل", CANCEL: "ملغي" };
    html += (s.d || []).length ? (s.d || []).map(function (x) {
      return '<div class="wl-row">' + icon(x[1]) + '<div class="m"><b>' + esc(x[1]) + ' <small>' + esc(x[3] || "") + '</small></b><small>' + esc(clock(x[0])) + '</small></div>' +
        '<div class="v"><b>' + mask(num(x[2])) + '</b><small><span class="wl-tag ' + (x[4] === "DONE" ? "ok" : "") + '">' + esc(stAr[x[4]] || x[4] || "—") + '</span></small></div></div>';
    }).join("") : '<div class="wl-empty">لا توجد إيداعات حديثة.</div>';
    html += '</div><p class="wl-note">الأرصدة للعرض فقط وتصل من البوت إلى زر القائمة الخاص بك فقط. السحب غير متاح هنا — استخدم تطبيق Gate.io.</p>';
    root.innerHTML = html;
    bindHero();
  }
  function bindHero() {
    try { document.dispatchEvent(new CustomEvent("aj:bal")); } catch (x) {}
    var r = $("wl-refresh"), e = $("wl-eye");
    if (r) r.onclick = function () {
      haptic("ok"); r.classList.add("spin");
      toast("سأطلب من البوت تحديث الرصيد", "ok");
      try { Aj().sendAction({ action: "balance_refresh" }); } catch (x) {}
      setTimeout(function () { r.classList.remove("spin"); }, 2500);
    };
    if (e) e.onclick = function () { S.hide = !S.hide; lsSet(HIDE, S.hide ? "1" : "0"); haptic("sel"); render(); };
  }

  /* ---------- deposit coin chips ---------- */
  function coinChips() {
    var box = $("wl-coins"), sel = $("dep-coin");
    if (!box || !sel) return;
    var opts = Array.prototype.slice.call(sel.options).map(function (o) { return o.value; }).filter(function (v) { return v && v !== "__other__"; }).slice(0, 10);
    box.innerHTML = opts.map(function (v) { return '<button type="button" data-c="' + esc(v) + '">' + esc(v) + "</button>"; }).join("") +
      '<button type="button" data-c="__other__">أخرى…</button>';
    function sync() { box.querySelectorAll("button").forEach(function (b) { b.classList.toggle("on", b.getAttribute("data-c") === sel.value); }); }
    box.addEventListener("click", function (ev) {
      var b = ev.target.closest("button[data-c]"); if (!b) return;
      sel.value = b.getAttribute("data-c");
      sel.dispatchEvent(new Event("change", { bubbles: true }));
      haptic("sel"); sync();
    });
    sel.addEventListener("change", sync);
    sync();
  }

  /* ---------- boot ---------- */
  async function boot() {
    if (!window.Aj || !$("tabs") || !window.AjRole) { setTimeout(boot, 80); return; }
    css();
    S.hide = lsGet(HIDE) === "1";
    if (role() === "owner") {
      render();
      coinChips();
      await pick();
      render();
      try {
        var t = tg();
        if (t && t.onEvent) t.onEvent("activated", function () { render(); });
      } catch (e) {}
      setInterval(function () { var p = $("tab-portfolio"); if (p && !p.classList.contains("hidden")) render(); }, 60000);
      var req = String(q.get("tab") || "").toLowerCase();
      if (req === "portfolio") { try { Aj().showTab("portfolio"); } catch (e) {} }
    }
    window.AjV17 = {
      snap: function () { return S.snap ? { t: S.snap.t, coins: (S.snap.s || []).length } : null; },
      total: function () { return role() === "owner" && S.snap && isFinite(Number(S.snap.T)) ? Number(S.snap.T) : null; },
      hidden: function () { return !!S.hide; },
      render: function () { if (role() === "owner") render(); }
    };
    try { document.dispatchEvent(new CustomEvent("aj:bal")); } catch (x) {}
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", function () { setTimeout(boot, 0); });
  else setTimeout(boot, 0);
})();
