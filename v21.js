/* ajcoin-miniapp v21 — Smart Trading tab (التداول الذكي).
   Shows what the bot's v21 engine sees: market regime per coin, live signals with confidence and
   plain-Arabic reasons, the honest 90-day backtest (fees + slippage, all three coins, losing ones too),
   and — for the owner only — paper performance, settings, the real-mode request and the ⛔ kill switch.
   Signals/backtest come from the bot's PUBLIC snapshot (raw.githubusercontent.com, market data only).
   Paper numbers come from the owner's own menu-button URL (sm=). The app never places orders:
   every action goes to the bot, which checks the owner by sender id; real mode needs ✅ there. */
(function () {
  "use strict";
  var $ = function (id) { return document.getElementById(id); };
  function Aj() { return window.Aj || {}; }
  function tg() { return window.Telegram && window.Telegram.WebApp; }
  function role() { return window.AjRole || "guest"; }
  function hap(k) { try { var h = tg() && tg().HapticFeedback; if (!h) return; if (k === "sel") h.selectionChanged(); else if (k === "ok" || k === "err" || k === "warn") h.notificationOccurred(k === "ok" ? "success" : k === "err" ? "error" : "warning"); else h.impactOccurred(k || "light"); } catch (e) {} }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function num(v, d) { v = Number(v); if (!isFinite(v)) return "—"; var a = Math.abs(v); if (d == null) d = a >= 1000 ? 2 : a >= 1 ? 4 : a >= 0.01 ? 5 : 8; return v.toLocaleString("en-US", { maximumFractionDigits: d, minimumFractionDigits: 0 }); }
  function sgn(v, d) { v = Number(v) || 0; return (v >= 0 ? "+" : "") + num(v, d == null ? 4 : d); }
  function dash(v, suf) { return v == null || v === "" ? "—" : esc(v) + (suf || ""); }
  function visible(id) { var el = $(id); return !!el && !el.classList.contains("hidden") && !document.hidden; }
  function toast(m) { try { (Aj().toast || window.toast || function () {})(m); } catch (e) {} }
  function ago(t) {
    if (!t) return "—"; var s = Math.max(0, Date.now() / 1000 - t);
    return s < 90 ? "قبل " + Math.round(s) + " ث" : s < 5400 ? "قبل " + Math.round(s / 60) + " د" : s < 172800 ? "قبل " + Math.round(s / 3600) + " س" : "قبل " + Math.round(s / 86400) + " يوم";
  }
  function day(t) { try { return new Date(t * 1000).toLocaleDateString("ar", { day: "numeric", month: "short" }); } catch (e) { return ""; } }
  function b64json(s) {
    try { s = String(s || "").replace(/-/g, "+").replace(/_/g, "/"); while (s.length % 4) s += "=";
      var bin = atob(s), u = new Uint8Array(bin.length); for (var i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
      return JSON.parse(new TextDecoder("utf-8").decode(u)); } catch (e) { return null; }
  }

  var REG = { trend_up: ["اتجاه صاعد", "up"], trend_down: ["اتجاه هابط", "down"], range: ["تذبذب عرضي", "mid"], high_vol: ["تقلب مرتفع", "warn"], unknown: ["غير معروف", "mid"] };
  var STRAT = { trend: "تتبّع الاتجاه", breakout: "اختراق", range: "ارتداد من النطاق", none: "—" };
  var GUARD = { dd: "حماية التراجع", streak: "توقف بعد خسائر متتالية", max_trades: "حد الصفقات اليومي", daily_loss: "حد الخسارة اليومية",
    cooldown: "تهدئة بعد خسارة", stale: "بيانات قديمة — لا تداول", spread: "سبريد واسع — لا تداول", killed: "الإيقاف الفوري مفعّل", open: "صفقة مفتوحة", min: "أقل من الحد الأدنى" };
  var EXIT = { sl: "وقف", tp: "هدف", be: "تعادل", trail: "متحرك", time: "مدة", kill: "إيقاف", end: "نهاية" };
  var COINS = ["BTC", "ETH", "SOL", "BNB", "XRP", "DOGE", "ADA", "TRX", "LTC", "LINK", "AVAX", "TON"];
  var S = { pub: null, pubAt: 0, owner: null, loading: false, err: "", timer: 0, form: null };

  function css() {
    if ($("v21-css")) return;
    var st = document.createElement("style"); st.id = "v21-css";
    st.textContent = [
      "#tab-xsmart{padding-bottom:8px}",
      ".v21-card{background:var(--card);border:1px solid var(--line);border-radius:var(--radius,14px);padding:11px 12px;margin:10px 0}",
      ".v21-h{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px;flex-wrap:wrap}.v21-h b{font-size:15px}.v21-h small{color:var(--muted);font-size:11px}",
      ".v21-badge{display:inline-flex;align-items:center;gap:4px;border-radius:999px;padding:3px 9px;font-size:12px;font-weight:700;border:1px solid var(--line);white-space:nowrap}",
      ".v21-badge.up{color:var(--up);border-color:color-mix(in srgb,var(--up) 45%,transparent)}.v21-badge.down{color:var(--down);border-color:color-mix(in srgb,var(--down) 45%,transparent)}",
      ".v21-badge.warn{color:var(--warn,#f5c15c);border-color:color-mix(in srgb,#f5c15c 45%,transparent)}.v21-badge.mid{color:var(--muted)}",
      ".v21-badge.paper{background:color-mix(in srgb,var(--btn) 18%,transparent);color:var(--text)}.v21-badge.real{background:var(--down);color:#fff;border-color:var(--down)}",
      ".v21-kill{display:block;width:100%;border:0;border-radius:14px;padding:14px 12px;font:inherit;font-size:16px;font-weight:800;color:#fff;background:linear-gradient(180deg,#ef4444,#b91c1c);box-shadow:0 6px 18px -8px #ef4444aa;cursor:pointer;min-height:52px}",
      ".v21-kill:active{transform:scale(.98)}.v21-killed{border:1px solid var(--down);background:color-mix(in srgb,var(--down) 14%,transparent);border-radius:12px;padding:10px;font-size:13px;margin-bottom:8px}",
      ".v21-disc{border:1px solid color-mix(in srgb,#f5c15c 50%,transparent);background:color-mix(in srgb,#f5c15c 9%,transparent);border-radius:12px;padding:9px 11px;font-size:12px;line-height:1.6}",
      ".v21-regs{display:flex;flex-wrap:wrap;gap:6px}",
      ".v21-sig{border:1px solid var(--line);border-radius:12px;padding:9px 10px;margin-top:8px;background:var(--bg)}",
      ".v21-sig .top{display:flex;align-items:center;justify-content:space-between;gap:6px;flex-wrap:wrap}.v21-sig .top b{font-size:15px}",
      ".v21-sig .px{direction:ltr;unicode-bidi:isolate;color:var(--muted);font-size:12px}",
      ".v21-conf{height:7px;border-radius:999px;background:var(--line);overflow:hidden;margin:8px 0 4px;direction:ltr}.v21-conf i{display:block;height:100%;border-radius:999px}",
      ".v21-row{display:flex;flex-wrap:wrap;gap:4px 12px;font-size:12px;color:var(--muted)}.v21-row b{color:var(--text);direction:ltr;unicode-bidi:isolate}",
      ".v21-sig details{margin-top:6px}.v21-sig summary{cursor:pointer;font-size:12px;color:var(--btn);list-style:none}.v21-sig summary::-webkit-details-marker{display:none}",
      ".v21-sig ul{margin:6px 0 0;padding-inline-start:18px;font-size:12px;line-height:1.65}",
      ".v21-kpis{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}.v21-kpis div{background:var(--bg);border:1px solid var(--line);border-radius:10px;padding:7px 8px;min-width:0}",
      ".v21-kpis span{display:block;font-size:10.5px;color:var(--muted)}.v21-kpis b{font-size:14px;direction:ltr;unicode-bidi:isolate;white-space:nowrap}",
      ".v21-tbl{width:100%;border-collapse:collapse;font-size:12px;margin-top:6px}.v21-tbl th,.v21-tbl td{padding:6px 4px;border-bottom:1px solid var(--line);text-align:center;white-space:nowrap}",
      ".v21-tbl th{color:var(--muted);font-weight:600;font-size:11px}.v21-tbl td:first-child,.v21-tbl th:first-child{text-align:start}.v21-tbl tr.tot td{font-weight:800}",
      ".v21-tw{overflow-x:auto;scrollbar-width:thin}",
      ".up{color:var(--up)}.down{color:var(--down)}",
      ".v21-note{font-size:11px;color:var(--hint,#7d8b9b);margin-top:6px;line-height:1.6}",
      ".v21-warnbox{font-size:12px;color:var(--warn,#f5c15c);margin-top:6px}",
      ".v21-set{display:grid;grid-template-columns:1fr 1fr;gap:10px}.v21-set label{display:flex;flex-direction:column;gap:4px;font-size:12px;color:var(--muted)}",
      ".v21-set input[type=range]{width:100%}.v21-set output{color:var(--text);font-weight:700;direction:ltr}",
      ".v21-chips{display:flex;flex-wrap:wrap;gap:6px;margin-top:4px}.v21-chips button{border:1px solid var(--line);background:var(--bg);color:var(--text);border-radius:999px;padding:6px 10px;font:inherit;font-size:12px;min-height:32px;cursor:pointer}",
      ".v21-chips button.on{background:var(--btn);border-color:var(--btn);color:#fff}",
      ".v21-btns{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}.v21-btns button{flex:1 1 140px;border:1px solid var(--line);background:var(--card-2,#1a222c);color:var(--text);border-radius:12px;padding:10px;font:inherit;font-size:13px;font-weight:700;min-height:44px;cursor:pointer}",
      ".v21-btns button.pri{background:var(--btn);border-color:var(--btn);color:#fff}",
      ".v21-tabs{display:flex;gap:4px;padding:3px;border-radius:12px;background:color-mix(in srgb,var(--text) 6%,transparent);margin:2px 0 6px}",
      ".v21-tabs button{flex:1;border:0;background:transparent;color:var(--muted);border-radius:9px;padding:7px 4px;font:inherit;font-size:12.5px;font-weight:700;min-height:34px;cursor:pointer}.v21-tabs button.on{background:var(--card);color:var(--text)}",
      ".v21-empty{color:var(--muted);font-size:12.5px;padding:6px 2px;line-height:1.6}",
      ".v21-pos{display:flex;justify-content:space-between;gap:8px;font-size:12px;padding:6px 0;border-bottom:1px solid var(--line)}.v21-pos:last-child{border-bottom:0}.v21-pos b{direction:ltr;unicode-bidi:isolate}",
      "svg.v21-curve{width:100%;height:70px;display:block;margin-top:6px}"
    ].join("\n");
    document.head.appendChild(st);
  }

  /* ---------- data ---------- */
  function raw() { return (window.AjData && AjData.raw) || "https://raw.githubusercontent.com/sbeshr2025-creator/ajcoin-data/main/"; }
  function getJson(path, ms) {
    var ac = typeof AbortController === "function" ? new AbortController() : null;
    var t = setTimeout(function () { try { ac && ac.abort(); } catch (e) {} }, ms || 8000);
    return fetch(raw() + path, { cache: "no-store", credentials: "omit", signal: ac ? ac.signal : undefined })
      .then(function (r) { clearTimeout(t); if (!r.ok) { var e = new Error("http " + r.status); e.status = r.status; throw e; } return r.json(); })
      .catch(function (e) { clearTimeout(t); throw e; });
  }
  async function loadPub() {
    if (S.loading) return; S.loading = true; S.err = "";
    try {
      var skew = 0; try { skew = (window.AjData && AjData.state().skew) || 0; } catch (e) {}
      var b = Math.floor((Date.now() / 1000 + skew - 25) / 60), d = null;
      for (var i = 0; i < 3 && !d; i++) { try { d = await getJson("sm/" + (b - i) + ".json", 6000); } catch (e) { if (!e.status) break; } }
      if (!d) { var L = await getJson("latest.json", 8000); if (L && L.sm) d = await getJson("sm/" + L.sm + ".json", 8000); }
      if (d && d.v === 21) { setPub(d); try { localStorage.setItem("aj-v21-pub", JSON.stringify(d)); } catch (e) {} }
      else if (!S.pub) S.err = "لم تصل إشارات المحرك بعد.";
    } catch (e) {
      S.err = "تعذّر جلب الإشارات الآن — تُعرض آخر نسخة محفوظة.";
    } finally { S.loading = false; render(); }
  }
  function setPub(d) { S.pub = d; S.pubAt = Date.now(); }
  function ownerState() {
    if (role() !== "owner") return null;
    if (S.owner) return S.owner;
    try { var q = new URLSearchParams(location.search); var v = q.get("sm"); if (v) S.owner = b64json(v); } catch (e) {}
    return S.owner;
  }

  /* ---------- actions (all go to the bot; owner checked there by sender id) ---------- */
  function send(p) { var f = Aj().sendAction; if (typeof f === "function") return f(p); toast("التطبيق لم يجهز بعد"); return false; }
  function confirmBox(text, cb) {
    var t = tg();
    try { if (t && t.showConfirm) { t.showConfirm(text, function (ok) { if (ok) cb(); }); return; } } catch (e) {}
    if (window.confirm(text)) cb();
  }
  var prevHook = window.AjEncodeHook;
  window.AjEncodeHook = function (p) {
    if (p && p.action === "auto_smart") {
      var op = p.op || "status";
      if (op === "status") return "sm_st";
      if (op === "real") return "sm_real";
      if (op === "paper") return "sm_paper";
      if (op === "resume") return "sm_res";
      if (op === "bt") return "sm_bt";
      if (op === "settings") return encSettings(p);
      return null;
    }
    var f = prevHook || window.__ajPrevEncode; return typeof f === "function" ? f(p) : null;
  };
  function encSettings(p) {
    var r = Math.round(Math.min(2, Math.max(0.1, Number(p.risk_pct) || 0.5)) * 100);
    var c = Math.round(Math.min(90, Math.max(50, Number(p.min_conf) || 62)));
    var l = Math.round(Math.min(20, Math.max(1, Number(p.lev) || 3)));
    var st = (p.strategies || []).map(function (x) { return x[0]; }).filter(function (x) { return /[tbr]/.test(x); }).join("") || "tbr";
    var coins = (p.coins || []).filter(function (x) { return /^[A-Z0-9]{1,12}$/.test(x); }).slice(0, 8);
    var out = "smset_r" + r + "_c" + c + "_l" + l + "_h" + (p.shorts ? 1 : 0) + "_s" + st + "_n" + (p.notify ? 1 : 0) + "_";
    while (coins.length && (out + coins.join("-")).length > 64) coins.pop();
    if (!coins.length) return null;
    return out + coins.join("-");
  }
  function kill() {
    confirmBox("⛔ إيقاف فوري لكل التداول الآلي؟ سيتوقف الدخول الجديد فوراً (الحقيقي والمحاكاة) وتُغلق الصفقات الافتراضية.", function () {
      hap("warn"); send({ action: "auto_stop" });
    });
  }

  /* ---------- render ---------- */
  var sub = "signals";
  function shell() {
    var p = $("tab-xsmart"); if (!p || $("v21-root")) return;
    p.innerHTML = '<div id="v21-root"></div>';
    p.addEventListener("click", onClick);
    p.addEventListener("input", onInput);
  }
  function onClick(ev) {
    var b = ev.target.closest("[data-v21]"); if (!b) return;
    var a = b.getAttribute("data-v21"); hap("sel");
    if (a === "kill") return kill();
    if (a === "resume") return send({ action: "auto_smart", op: "resume" });
    if (a === "real") return confirmBox("سيصلك في البوت طلب تأكيد ✅ للتحويل إلى التداول الحقيقي. لا يتغير شيء قبل ضغطك ✅ هناك. متابعة؟", function () { send({ action: "auto_smart", op: "real" }); });
    if (a === "paper") return send({ action: "auto_smart", op: "paper" });
    if (a === "status") return send({ action: "auto_smart", op: "status" });
    if (a === "bt") return send({ action: "auto_smart", op: "bt" });
    if (a === "reload") { S.pubAt = 0; return loadPub(); }
    if (a === "sub") { sub = b.getAttribute("data-k"); return render(true); }
    if (a === "coin" || a === "strat") {
      var f = form(), k = b.getAttribute("data-k"), list = a === "coin" ? f.coins : f.strategies, i = list.indexOf(k);
      if (i >= 0) { if (list.length > 1) list.splice(i, 1); } else if (a === "strat" || list.length < 8) list.push(k);
      return render(true);
    }
    if (a === "shorts") { form().shorts = !form().shorts; return render(true); }
    if (a === "notify") { form().notify = !form().notify; return render(true); }
    if (a === "save") {
      var p = Object.assign({ action: "auto_smart", op: "settings" }, form());
      if (!encSettings(p)) return toast("إعدادات غير صالحة");
      return send(p);
    }
  }
  function onInput(ev) {
    var el = ev.target; if (!el || !el.getAttribute) return;
    var k = el.getAttribute("data-set"); if (!k) return;
    form()[k] = Number(el.value);
    var o = $("v21-o-" + k); if (o) o.textContent = k === "risk_pct" ? Number(el.value).toFixed(1) + "%" : k === "lev" ? el.value + "x" : el.value + "%";
  }
  function form() {
    if (S.form) return S.form;
    var o = ownerState(), s = (o && o.s) || [0.5, 62, 3, 0, "tbr", "BTC-ETH-SOL-BNB-XRP", 1];
    var M = { t: "trend", b: "breakout", r: "range" };
    S.form = { risk_pct: Number(s[0]) || 0.5, min_conf: Number(s[1]) || 62, lev: Number(s[2]) || 3, shorts: !!s[3],
      strategies: String(s[4] || "tbr").split("").map(function (x) { return M[x]; }).filter(Boolean),
      coins: String(s[5] || "BTC").split("-").filter(Boolean), notify: s[6] !== 0 };
    return S.form;
  }

  function badgeReg(r) { var x = REG[r] || REG.unknown; return '<span class="v21-badge ' + x[1] + '">' + esc(x[0]) + "</span>"; }
  function confColor(c) { return c >= 70 ? "var(--up)" : c >= 55 ? "#f5c15c" : "#6d7d8f"; }

  function headCard(o) {
    var isOwner = role() === "owner";
    var mode = !isOwner ? '<span class="v21-badge mid">عرض فقط</span>'
      : !o ? '<span class="v21-badge paper">🧪 محاكاة</span>'
      : o.k ? '<span class="v21-badge down">⛔ موقوف</span>'
      : o.m === "real" ? '<span class="v21-badge real">🔴 حقيقي</span>' : '<span class="v21-badge paper">🧪 محاكاة (افتراضي)</span>';
    var t = S.pub && S.pub.t, age = t ? Date.now() / 1000 - t : null;
    var fresh = age == null ? '<small>بانتظار المحرك…</small>' : '<small>آخر تحليل ' + ago(t) + (age > 900 ? ' · <span class="down">قديم</span>' : "") + "</small>";
    var h = '<div class="v21-card"><div class="v21-h"><b>🤖 التداول الذكي</b>' + mode + "</div>";
    if (isOwner) {
      if (o && o.k) h += '<div class="v21-killed">⛔ الإيقاف الفوري مفعّل: لا دخول جديد (حقيقي أو محاكاة). <div class="v21-btns"><button type="button" class="pri" data-v21="resume">▶️ استئناف المحاكاة</button></div></div>';
      else h += '<button type="button" class="v21-kill" data-v21="kill" aria-label="إيقاف فوري لكل التداول الآلي">⛔ إيقاف فوري لكل التداول الآلي</button>';
    }
    h += '<div class="v21-row" style="margin-top:8px">' + fresh + "<span>إطار الإشارة 4 ساعات · السياق يومي</span></div>";
    h += '<div class="v21-disc" style="margin-top:8px">⚠️ <b>تنبيه مخاطر:</b> هذه إشارات حسابية وليست نصيحة استثمارية ولا وعداً بالربح. النتائج التاريخية والمحاكاة لا تضمن المستقبل، والخسارة ممكنة. '
      + 'المحرك يعمل <b>بالمحاكاة افتراضياً</b>، والتداول الحقيقي يحتاج تأكيدك ✅ في البوت. الحدود الثابتة: فوري 3 USDT · هامش عقود 1 USDT · يومي 20 USDT · رافعة ≤ 20x.</div>';
    return h + "</div>";
  }

  function regimesCard() {
    var sg = (S.pub && S.pub.signals) || {}, ks = Object.keys(sg);
    if (!ks.length) return "";
    return '<div class="v21-card"><div class="v21-h"><b>🧭 حالة السوق الآن</b><small>يختار المحرك الاستراتيجية حسب الحالة</small></div><div class="v21-regs">' +
      ks.map(function (k) { return '<span class="v21-badge ' + ((REG[sg[k].regime] || REG.unknown)[1]) + '"><b style="color:var(--text)">' + esc(k) + "</b> · " + esc((REG[sg[k].regime] || REG.unknown)[0]) + "</span>"; }).join("") +
      '</div><div class="v21-note">اتجاه ← تتبّع الاتجاه أو الاختراق · عرضي ← ارتداد من أطراف النطاق · تقلب مرتفع ← لا دخول.</div></div>';
  }

  function signalsCard() {
    var sg = (S.pub && S.pub.signals) || {}, ks = Object.keys(sg);
    var h = '<div class="v21-card"><div class="v21-h"><b>📡 الإشارات الحية</b><button type="button" class="v21-badge mid" data-v21="reload" style="background:none;cursor:pointer">↻ تحديث</button></div>';
    if (!ks.length) return h + '<div class="v21-empty">' + esc(S.err || "جارٍ تحميل إشارات المحرك…") + "</div></div>";
    if (S.err) h += '<div class="v21-warnbox">' + esc(S.err) + "</div>";
    ks.sort(function (a, b) { var A = sg[a], B = sg[b]; var ra = A.action === "enter" ? 2 : A.action === "watch" ? 1 : 0, rb = B.action === "enter" ? 2 : B.action === "watch" ? 1 : 0; return rb - ra || (B.conf || 0) - (A.conf || 0); });
    ks.forEach(function (k) {
      var s = sg[k], c = Math.max(0, Math.min(100, Number(s.conf) || 0));
      var act = s.action === "enter" ? '<span class="v21-badge ' + (s.side === "short" ? "down" : "up") + '">' + (s.side === "short" ? "🔴 بيع (محاكاة عقود)" : "🟢 شراء") + "</span>"
        : s.action === "watch" ? '<span class="v21-badge warn">🟡 مراقبة</span>' : '<span class="v21-badge mid">⚪ لا دخول</span>';
      h += '<div class="v21-sig" data-coin="' + esc(k) + '"><div class="top"><b>' + esc(k) + '</b><span class="px">' + (s.price ? num(s.price) : "") + "</span>" + badgeReg(s.regime) + act + "</div>";
      h += '<div class="v21-conf" role="meter" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + c + '" aria-label="الثقة"><i style="width:' + c + "%;background:" + confColor(c) + '"></i></div>';
      var lean = s.action === "none" && s.lean ? '<span>الميل <b class="' + (s.lean === "long" ? "up" : "down") + '">' + (s.lean === "long" ? "صاعد" : "هابط") + " " + num(s.lean_pct || 0, 0) + "%</b></span>" : "";
      h += '<div class="v21-row"><span>ثقة الدخول <b>' + c + "%</b></span>" + lean + "<span>الاستراتيجية <b>" + esc(STRAT[s.strategy] || "—") + "</b></span>" +
        (s.adx != null ? "<span>ADX <b>" + num(s.adx, 0) + "</b></span>" : "") + (s.rsi != null ? "<span>RSI <b>" + num(s.rsi, 0) + "</b></span>" : "") + "</div>";
      if (s.sl && s.tp) h += '<div class="v21-row" style="margin-top:3px"><span>وقف <b>' + num(s.sl) + "</b></span><span>هدف <b>" + num(s.tp) + "</b></span><span>العائد/المخاطرة <b>1:" + dash(s.rr) + "</b></span></div>";
      if (s.blocked) h += '<div class="v21-warnbox">⛔ ' + esc(GUARD[s.blocked] || s.blocked) + "</div>";
      h += "<details><summary>لماذا؟ (" + (s.reasons || []).length + " أسباب)</summary><ul>" + (s.reasons || []).map(function (r) { return "<li>" + esc(r) + "</li>"; }).join("") + "</ul></details></div>";
    });
    return h + '<div class="v21-note">لا يُفتح أي مركز على بيانات أقدم من دقيقتين أو عند سبريد واسع. الإشارة تُحسب عند إغلاق شمعة 4 ساعات.</div></div>';
  }

  function paperCard(o) {
    if (role() !== "owner") return "";
    var h = '<div class="v21-card"><div class="v21-h"><b>🧪 أداء المحاكاة</b><small>' + (o ? "حتى " + ago(o.t) : "") + "</small></div>";
    if (!o) return h + '<div class="v21-empty">افتح التطبيق من زر القائمة الخاص بك في البوت لعرض أداء المحاكاة.</div></div>';
    var p = o.p || {};
    h += '<div class="v21-kpis"><div><span>الرصيد الافتراضي</span><b>' + num(p.eq, 2) + '</b></div><div><span>صفقات مغلقة</span><b>' + dash(p.n) + '</b></div><div><span>نسبة الفوز</span><b>' + dash(p.win, "%") + "</b></div>" +
      '<div><span>عامل الربح</span><b>' + dash(p.pf) + '</b></div><div><span>الربح/الخسارة</span><b class="' + ((p.pnl || 0) >= 0 ? "up" : "down") + '">' + sgn(p.pnl) + '</b></div><div><span>التراجع الحالي USDT</span><b>' + num(p.dd, 4) + "</b></div></div>";
    var os = o.o || [];
    h += '<div class="v21-h" style="margin:10px 0 2px"><b style="font-size:13px">مراكز افتراضية مفتوحة</b><small>' + os.length + "</small></div>";
    h += os.length ? os.map(function (x) { return '<div class="v21-pos"><span>' + esc(x[0]) + " · " + (x[1] === "l" ? "شراء" : "بيع") + " · " + esc(STRAT[{ t: "trend", b: "breakout", r: "range" }[x[2]]] || "") + "</span><span>دخول <b>" + num(x[3]) + "</b> · وقف <b>" + num(x[4]) + "</b> · هدف <b>" + num(x[5]) + "</b></span></div>"; }).join("") : '<div class="v21-empty">لا توجد.</div>';
    var hs = o.h || [];
    h += '<div class="v21-h" style="margin:10px 0 2px"><b style="font-size:13px">آخر الصفقات الافتراضية</b></div>';
    h += hs.length ? hs.map(function (x) { return '<div class="v21-pos"><span>' + esc(x[0]) + " · " + (x[1] === "l" ? "شراء" : "بيع") + " · " + esc(EXIT[x[4]] || x[4]) + " · " + day(x[5]) + '</span><b class="' + (x[2] >= 0 ? "up" : "down") + '">' + sgn(x[2]) + " (" + sgn(x[3], 2) + "%)</b></div>"; }).join("")
      : '<div class="v21-empty">لا صفقات بعد. المحرك يدخل فقط عندما تكتمل القاعدة وتتجاوز الثقة الحد.</div>';
    return h + '<div class="v21-note">رصيد افتراضي 100 USDT، وأحجام ضمن الحدود الحقيقية (3 USDT للفوري)، مع الرسوم والانزلاق. لا أوامر حقيقية.</div></div>';
  }

  function curveSvg(cv) {
    if (!cv || cv.length < 2) return "";
    var xs = cv.map(function (p) { return p[1]; }), lo = Math.min.apply(null, xs), hi = Math.max.apply(null, xs), w = 300, hgt = 70;
    if (hi - lo < 1e-9) { hi = lo + 1; }
    var base = cv[0][1], pts = cv.map(function (p, i) { return (i / (cv.length - 1) * w).toFixed(1) + "," + (hgt - 4 - (p[1] - lo) / (hi - lo) * (hgt - 8)).toFixed(1); }).join(" ");
    var yb = (hgt - 4 - (base - lo) / (hi - lo) * (hgt - 8)).toFixed(1), last = xs[xs.length - 1];
    return '<svg class="v21-curve" viewBox="0 0 ' + w + " " + hgt + '" preserveAspectRatio="none" role="img" aria-label="منحنى رأس المال في الاختبار التاريخي"><line x1="0" x2="' + w + '" y1="' + yb + '" y2="' + yb + '" stroke="#6d7d8f" stroke-dasharray="3 3" stroke-width="1"/>' +
      '<polyline fill="none" stroke="' + (last >= base ? "var(--up)" : "var(--down)") + '" stroke-width="2" points="' + pts + '"/></svg>';
  }
  function btCard() {
    var bt = S.pub && S.pub.backtest;
    var h = '<div class="v21-card"><div class="v21-h"><b>📊 الاختبار التاريخي</b><small>' + (bt ? bt.days + " يوماً · " + day(bt.from) + " – " + day(bt.to) : "") + "</small></div>";
    if (!bt) return h + '<div class="v21-empty">يُحسب في البوت مرة يومياً على شموع Gate التاريخية…</div></div>';
    var a = bt.all || {}, per = bt.per || {};
    h += '<div class="v21-tw"><table class="v21-tbl"><thead><tr><th>العملة</th><th>صفقات</th><th>فوز</th><th>عامل الربح</th><th>النتيجة USDT</th><th>أقصى تراجع</th><th>شارب</th><th>شراء واحتفاظ</th></tr></thead><tbody>';
    (bt.coins || Object.keys(per)).forEach(function (c) {
      var r = per[c] || {};
      h += "<tr><td><b>" + esc(c) + "</b></td><td>" + dash(r.trades) + "</td><td>" + dash(r.win_rate, "%") + "</td><td>" + dash(r.profit_factor) + '</td><td class="' + ((r.pnl_usdt || 0) >= 0 ? "up" : "down") + '">' + sgn(r.pnl_usdt) + "</td><td>" + dash(r.max_dd_pct, "%") + "</td><td>" + dash(r.sharpe) + '</td><td class="' + ((r.bh_pct || 0) >= 0 ? "up" : "down") + '">' + sgn(r.bh_pct, 1) + "%</td></tr>";
    });
    h += '<tr class="tot"><td>الإجمالي</td><td>' + dash(a.trades) + "</td><td>" + dash(a.win_rate, "%") + "</td><td>" + dash(a.profit_factor) + '</td><td class="' + ((a.pnl_usdt || 0) >= 0 ? "up" : "down") + '">' + sgn(a.pnl_usdt) + "</td><td>" + dash(a.max_dd_pct, "%") + "</td><td>" + dash(a.sharpe) + "</td><td></td></tr></tbody></table></div>";
    h += curveSvg(bt.curve);
    // walk-forward view: three consecutive ~30-day segments, nothing re-fitted
    h += '<div class="v21-h" style="margin:10px 0 0"><b style="font-size:13px">ثلاث فترات متتالية (~30 يوماً)</b><small>بلا إعادة ضبط</small></div><div class="v21-tw"><table class="v21-tbl"><thead><tr><th>العملة</th><th>الفترة 1</th><th>الفترة 2</th><th>الفترة 3</th></tr></thead><tbody>';
    (bt.coins || Object.keys(per)).forEach(function (c) {
      var f = (per[c] || {}).folds || [];
      h += "<tr><td><b>" + esc(c) + "</b></td>" + [0, 1, 2].map(function (i) { var x = f[i]; return x ? '<td class="' + ((x.pnl_usdt || 0) >= 0 ? "up" : "down") + '">' + sgn(x.pnl_usdt) + " <small>(" + x.trades + ")</small></td>" : "<td>—</td>"; }).join("") + "</tr>";
    });
    h += "</tbody></table></div>";
    var A = bt.assume || {};
    var few = (a.trades || 0) < 30;
    h += (few ? '<div class="v21-warnbox">⚠️ عدد الصفقات (' + (a.trades || 0) + ") قليل جداً لاستنتاج أفضلية حقيقية — النتيجة قد تكون صدفة في الاتجاهين.</div>" : "");
    h += '<div class="v21-note">الافتراضات: رسوم ' + num((A.fee_spot || 0) * 100, 2) + "% لكل جهة (فوري) و" + num((A.fee_fut || 0) * 100, 2) + "% (عقود)، انزلاق " + num((A.slip || 0) * 100, 2) + "% لكل جهة، 100 USDT افتراضية لكل عملة، حجم الصفقة ≤ " + num(A.cap_spot || 3, 0) + " USDT، مخاطرة " + dash(A.risk_pct) + "%، ثقة ≥ " + dash(A.min_conf) + "%. الدخول عند افتتاح الشمعة التالية، والوقف يُفحص قبل الهدف داخل الشمعة. " + esc(bt.note || "") + " بسبب الحد الصغير للحجم تكون الأرقام بالدولار صغيرة؛ نسبة الفوز وعامل الربح أهم للحكم.</div>";
    return h + "</div>";
  }

  function settingsCard(o) {
    if (role() !== "owner") return "";
    var f = form();
    var h = '<div class="v21-card"><div class="v21-h"><b>⚙️ إعدادات المحرك</b><small>تُحفظ في البوت ضمن الحدود</small></div><div class="v21-set">' +
      '<label>المخاطرة لكل صفقة <output id="v21-o-risk_pct">' + f.risk_pct.toFixed(1) + '%</output><input type="range" min="0.1" max="2" step="0.1" value="' + f.risk_pct + '" data-set="risk_pct" aria-label="المخاطرة لكل صفقة"></label>' +
      '<label>أدنى ثقة للدخول <output id="v21-o-min_conf">' + f.min_conf + '%</output><input type="range" min="50" max="90" step="1" value="' + f.min_conf + '" data-set="min_conf" aria-label="أدنى ثقة"></label>' +
      '<label>رافعة العقود (محاكاة) <output id="v21-o-lev">' + f.lev + 'x</output><input type="range" min="1" max="20" step="1" value="' + f.lev + '" data-set="lev" aria-label="الرافعة"></label>' +
      "</div>";
    h += '<div class="v21-h" style="margin:10px 0 0"><b style="font-size:13px">العملات (حتى 8)</b></div><div class="v21-chips">' + COINS.map(function (c) { return '<button type="button" data-v21="coin" data-k="' + c + '" class="' + (f.coins.indexOf(c) >= 0 ? "on" : "") + '" aria-pressed="' + (f.coins.indexOf(c) >= 0) + '">' + c + "</button>"; }).join("") + "</div>";
    h += '<div class="v21-h" style="margin:10px 0 0"><b style="font-size:13px">الاستراتيجيات</b></div><div class="v21-chips">' + ["trend", "breakout", "range"].map(function (k) { return '<button type="button" data-v21="strat" data-k="' + k + '" class="' + (f.strategies.indexOf(k) >= 0 ? "on" : "") + '">' + STRAT[k] + "</button>"; }).join("") +
      '<button type="button" data-v21="shorts" class="' + (f.shorts ? "on" : "") + '">صفقات بيع (عقود، محاكاة)</button><button type="button" data-v21="notify" class="' + (f.notify ? "on" : "") + '">🔔 إشعارات الإشارات</button></div>';
    h += '<div class="v21-btns"><button type="button" class="pri" data-v21="save">💾 حفظ في البوت</button><button type="button" data-v21="status">📋 الحالة في المحادثة</button></div>';
    var real = o && o.m === "real";
    h += '<div class="v21-btns">' + (real ? '<button type="button" data-v21="paper">🧪 العودة للمحاكاة</button>' : '<button type="button" data-v21="real" ' + (o && o.k ? "disabled" : "") + '>🔐 طلب التداول الحقيقي (تأكيد ✅ في البوت)</button>') + '<button type="button" data-v21="bt">📊 النتائج في المحادثة</button></div>';
    return h + '<div class="v21-note">الحدود الثابتة لا تتغير بالإعدادات: فوري 3 USDT · هامش عقود 1 USDT · يومي 20 USDT · رافعة ≤ 20x (أو حد العقد). حماية: تهدئة بعد الخسارة، حد صفقات يومي، حد خسارة يومي، وإيقاف عند تراجع 3%.</div></div>';
  }

  var lastSig = "";
  function render(force) {
    var root = $("v21-root"); if (!root) return;
    var o = ownerState();
    var sig = sub + "|" + (S.pub ? S.pub.t + ":" + (S.pub.backtest && S.pub.backtest.t) : "-") + "|" + S.err + "|" + JSON.stringify(S.form || {}) + "|" + (o ? o.t + ":" + o.k + o.m : "");
    if (!force && sig === lastSig) return; lastSig = sig;
    var tabs = '<div class="v21-tabs" role="tablist">' + [["signals", "الإشارات"], ["perf", role() === "owner" ? "الأداء" : "الاختبار"], ["set", "الإعدادات"]].filter(function (x) { return x[0] !== "set" || role() === "owner"; })
      .map(function (x) { return '<button type="button" role="tab" data-v21="sub" data-k="' + x[0] + '" class="' + (sub === x[0] ? "on" : "") + '" aria-selected="' + (sub === x[0]) + '">' + x[1] + "</button>"; }).join("") + "</div>";
    var body = sub === "signals" ? regimesCard() + signalsCard() : sub === "perf" ? paperCard(o) + btCard() : settingsCard(o);
    root.innerHTML = headCard(o) + tabs + body;
  }

  function tick() {
    if (!visible("tab-xsmart")) return;
    shell();
    if (Date.now() - S.pubAt > 60000) loadPub(); else render();
  }
  function boot() {
    css();
    try { var c = JSON.parse(localStorage.getItem("aj-v21-pub") || "null"); if (c && c.v === 21) { S.pub = c; } } catch (e) {}
    shell(); render(true);
    setInterval(tick, 5000);
    document.addEventListener("click", function (ev) { if (ev.target.closest && ev.target.closest('[data-tab="xsmart"],#v18-nav button,.v18-sub button')) setTimeout(tick, 60); }, true);
    setTimeout(tick, 300);
  }
  window.AjV21 = {
    state: function () { return { pub: !!S.pub, t: S.pub && S.pub.t, owner: !!ownerState(), sub: sub, form: S.form, err: S.err }; },
    load: function (d) { if (d && d.v === 21) { setPub(d); render(true); } },
    sub: function (k) { sub = k; render(true); },
    enc: function (p) { return window.AjEncodeHook(p); },
    refresh: function () { S.pubAt = 0; return loadPub(); }
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", function () { setTimeout(boot, 0); });
  else setTimeout(boot, 0);
})();
