/* ajcoin-miniapp v16-team — role UI hints (owner / team / guest), paper wallet, suggestions, team admin.
   The role is ONLY a UI hint. Every permission is enforced by the bot by sender id. */
(function () {
  "use strict";
  var q;
  try { q = new URLSearchParams(location.search); } catch (e) { q = { get: function () { return null; } }; }
  var role = String(q.get("role") || "").toLowerCase();
  if (role !== "team" && role !== "owner") role = q.get("deps") ? "owner" : "guest";
  window.AjRole = role;

  var REASONS = [["ai", "إشارة ذكية"], ["br", "اختراق"], ["tr", "عملة رائجة"], ["nw", "إدراج جديد"],
    ["sp", "دعم / ارتداد"], ["mo", "زخم قوي"], ["ot", "أخرى"]];
  var SYM = /^[A-Z0-9]{1,20}$/;
  var state = { snap: null, team: null, px: {}, fpx: {}, timer: null, mkt: "spot", side: "buy", smkt: "spot", sside: "buy" };

  function Aj() { return window.Aj || {}; }
  function $(id) { return document.getElementById(id); }
  function tg() { return Aj().tg || (window.Telegram && window.Telegram.WebApp); }
  function toast(m, k) { try { (Aj().toast || function (x) { console.log(x); })(m, k); } catch (e) {} }
  function haptic(k) { try { (Aj().haptic || function () {})(k); } catch (e) {} }
  function capS() { return Aj().TRADE_CAP || 3; }
  function capF() { return Aj().FUT_CAP || 1; }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function fmt(n, d) {
    n = Number(n);
    if (!isFinite(n)) return "—";
    if (d == null) d = Math.abs(n) >= 100 ? 2 : Math.abs(n) >= 1 ? 4 : 8;
    var s = n.toFixed(d);
    if (s.indexOf(".") >= 0) s = s.replace(/0+$/, "").replace(/\.$/, "");
    return s;
  }
  function sgn(n, d) { n = Number(n) || 0; return (n >= 0 ? "+" : "") + fmt(n, d == null ? 3 : d); }
  function encNum(n) {
    var f = Aj().encNum;
    if (f) return f(n);
    n = Number(n); if (!isFinite(n) || n < 0) return null;
    return String(n).replace(".", "p");
  }
  function b64json(s) {
    try {
      s = String(s || "").replace(/-/g, "+").replace(/_/g, "/");
      while (s.length % 4) s += "=";
      var bin = atob(s), bytes = new Uint8Array(bin.length);
      for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      return JSON.parse(new TextDecoder("utf-8").decode(bytes));
    } catch (e) { return null; }
  }
  function send(payload) {
    var f = Aj().sendAction;
    if (typeof f === "function") return f(payload);
    toast("التطبيق لم يجهز بعد");
    return false;
  }
  function confirmBox(text, cb) {
    var t = tg();
    try { if (t && t.showConfirm) { t.showConfirm(text, function (ok) { if (ok) cb(); }); return; } } catch (e) {}
    if (window.confirm(text)) cb();
  }
  function sym(v) { return String(v || "").toUpperCase().replace(/[-\/]/g, "_").replace(/_USDT$/, "").trim(); }

  /* ---------- start-link encoding for v16 actions ---------- */
  window.AjEncodeHook = function (p) {
    var a = p && p.action;
    if (a === "paper") {
      var op = p.op || "view", s = sym(p.symbol || p.pair);
      if (op === "view") return "pp_v";
      if (op === "reset") return "pp_r";
      if ((op === "buy" || op === "sell") && SYM.test(s)) {
        if (op === "sell" && p.all) return "pp_s_" + s + "_all";
        var u = encNum(p.usdt); if (!u) return null;
        return "pp_" + (op === "buy" ? "b" : "s") + "_" + s + "_" + u;
      }
      if ((op === "long" || op === "short") && SYM.test(s)) {
        var m = encNum(p.usdt), l = parseInt(p.leverage, 10);
        if (!m || !(l >= 1 && l <= 20)) return null;
        return "pp_" + (op === "long" ? "l" : "h") + "_" + s + "_" + m + "_" + l;
      }
      if (op === "close" && /^[0-9a-f]{6}$/.test(String(p.id || ""))) return "pp_c_" + p.id;
      return null;
    }
    if (a === "suggest") {
      var ss = sym(p.symbol || p.pair), sd = { buy: "b", sell: "s", long: "l", short: "h" }[p.side];
      var su = encNum(p.usdt), lv = parseInt(p.leverage || 1, 10);
      if (!SYM.test(ss) || !sd || !su || !(lv >= 1 && lv <= 20)) return null;
      var rc = "";
      REASONS.forEach(function (r) { if (p.reason_code === r[0]) rc = r[0]; });
      var out = "sg_" + (p.market === "fut" ? "f" : "s") + "_" + sd + "_" + ss + "_" + su + "_" + lv + (rc ? "_" + rc : "");
      return out.length <= 64 ? out : null;
    }
    if (a === "team_list") return "tm_l";
    if (a === "team_add" || a === "team_remove") {
      var t = String(p.target || "").replace(/^@/, "").replace(/^u:/, "");
      if (!/^[A-Za-z0-9_]{4,32}$/.test(t)) return null;
      return (a === "team_add" ? "tm_a_" : "tm_r_") + t;
    }
    return null;
  };

  /* ---------- role routing (UI hint only) ---------- */
  var TEAM_OK = { paper: 1, suggest: 1, alert: 1, alerts_list: 1, ai: 1, ai_review: 1 };
  window.AjRoleHook = function (p) {
    if (!p || role !== "team") return p;
    var a = p.action;
    if (TEAM_OK[a]) return p;
    if (a === "trade") {
      if ((p.order_type || "market") !== "market") toast("التداول التجريبي بسعر السوق الحالي", "ok");
      var s = sym(p.pair || p.symbol);
      if (p.side === "sell") return { action: "paper", op: "sell", symbol: s, usdt: p.usdt, all: !p.usdt };
      return { action: "paper", op: "buy", symbol: s, usdt: p.usdt || p.amount };
    }
    if (a === "fut_open") {
      return { action: "paper", op: (p.side === "short" || p.side === "sell") ? "short" : "long",
        symbol: sym(p.contract || p.pair), usdt: p.usdt || p.margin, leverage: p.leverage || 2 };
    }
    if (a === "fut_close") {
      var cs = sym(p.contract || p.pair), pos = ((state.snap && state.snap.f) || []).filter(function (x) { return x[1] === cs; })[0];
      if (pos) return { action: "paper", op: "close", id: pos[0] };
      toast("لا يوجد مركز تجريبي مفتوح على " + cs);
      return false;
    }
    toast("هذه الميزة لصاحب البوت فقط — جرّب التداول التجريبي أو اقترح صفقة");
    haptic("err");
    return false;
  };

  /* ---------- styles ---------- */
  function injectCss() {
    var css = [
      "body.role-team .tabs [data-tab=auto], body.role-team .tabs [data-tab=orders], body.role-team .tabs [data-tab=portfolio],",
      "body.role-team #sheet-tabs [data-stab=auto], body.role-team #btn-aiw-on, body.role-team #btn-aiw-off,",
      "body.role-team #dep-modal, body.role-guest .tabs [data-tab=portfolio], body.role-guest .tabs [data-tab=auto], body.role-guest .tabs [data-tab=orders] { display:none !important }",
      ".pp-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:10px}",
      ".pp-k{background:var(--card);border-radius:12px;padding:10px;text-align:center}",
      ".pp-k b{display:block;font-size:16px;direction:ltr;font-variant-numeric:tabular-nums}",
      ".pp-k span{font-size:11px;color:var(--muted)}",
      ".pp-row{display:flex;align-items:center;justify-content:space-between;gap:8px;background:var(--card);border-radius:12px;padding:9px 10px;margin-bottom:6px}",
      ".pp-row .l{display:flex;flex-direction:column;gap:2px;min-width:0}",
      ".pp-row .l b{font-size:14px} .pp-row .l small{font-size:11px;color:var(--muted);direction:ltr;text-align:right}",
      ".pp-row .r{display:flex;align-items:center;gap:8px}",
      ".pp-row .pn{font-weight:750;direction:ltr;font-variant-numeric:tabular-nums}",
      ".pp-row button,.tm-row button{border:1px solid var(--line);background:var(--bg);color:var(--text);border-radius:10px;padding:7px 10px;font:inherit;font-size:12px}",
      ".up{color:var(--up)} .down{color:var(--down)}",
      ".pp-h{font-size:12px;color:var(--muted);line-height:1.8}",
      ".pp-sec{margin:14px 0 6px;font-size:14px;font-weight:750}",
      ".pp-form{background:var(--card);border-radius:var(--radius);padding:12px;margin-top:10px}",
      ".pp-form .seg button{flex:1;padding:9px;border-radius:10px;border:1px solid var(--line);background:var(--bg);color:var(--text);font:inherit}",
      ".pp-form .seg button.on{background:var(--btn);border-color:var(--btn);color:#fff}",
      ".pp-form .seg button.on.b-sell{background:var(--sell);border-color:var(--sell)}",
      ".pp-form .seg button.on.b-buy{background:var(--buy);border-color:var(--buy)}",
      ".pp-two{display:grid;grid-template-columns:1fr 1fr;gap:8px}",
      ".go.sg{background:#7c3aed} .go.ghost{background:var(--card);border:1px solid var(--line);color:var(--text)}",
      ".role-chip{font-size:11px;padding:3px 8px;border-radius:999px;background:#7c3aed33;color:#ddd6fe;margin-inline-start:6px}",
      ".tm-row{display:flex;justify-content:space-between;align-items:center;gap:8px;background:var(--card);border-radius:12px;padding:9px 10px;margin-bottom:6px}",
      ".tm-row small{color:var(--muted);direction:ltr}",
      "#sh-sg-spot,#sh-sg-fut{margin-top:8px}",
      ".theme-light .role-chip{color:#5b21b6}"
    ].join("\n");
    var st = document.createElement("style"); st.id = "v16-css"; st.textContent = css; document.head.appendChild(st);
  }

  /* ---------- tabs ---------- */
  function addTab(id, icon, label, html, afterTab) {
    if ($("tab-" + id)) return $("tab-" + id);
    var sec = document.createElement("section");
    sec.className = "panel hidden"; sec.id = "tab-" + id;
    sec.setAttribute("role", "tabpanel"); sec.setAttribute("aria-hidden", "true");
    sec.innerHTML = html;
    var nav = $("tabs");
    document.body.insertBefore(sec, nav);
    var b = document.createElement("button");
    b.setAttribute("data-tab", id); b.type = "button";
    b.innerHTML = "<span>" + icon + "</span>" + esc(label);
    var ref = nav && nav.querySelector('[data-tab="' + afterTab + '"]');
    if (ref && ref.nextSibling) nav.insertBefore(b, ref.nextSibling); else if (nav) nav.appendChild(b);
    return sec;
  }
  function showMine(id) {
    try { Aj().showTab && Aj().showTab(id); } catch (e) {}
    document.querySelectorAll("section.panel").forEach(function (p) {
      if (p.id === "tab-" + id) { p.classList.remove("hidden"); p.setAttribute("aria-hidden", "false"); }
      else if (/^tab-x/.test(p.id)) { p.classList.add("hidden"); p.setAttribute("aria-hidden", "true"); }
    });
    document.querySelectorAll("#tabs [data-tab]").forEach(function (b) { b.classList.toggle("on", b.getAttribute("data-tab") === id); });
    try { var t = tg(); if (t && t.MainButton) t.MainButton.hide(); } catch (e) {}
    if (id === "xpaper") { renderPaper(); pollPrices(); }
  }
  function bindTabs() {
    var nav = $("tabs");
    if (!nav) return;
    nav.addEventListener("click", function (ev) {
      var b = ev.target.closest("[data-tab]");
      if (!b) return;
      var id = b.getAttribute("data-tab");
      if (/^x/.test(id)) { setTimeout(function () { showMine(id); }, 0); }
      else {
        document.querySelectorAll("section.panel").forEach(function (p) { if (/^tab-x/.test(p.id)) p.classList.add("hidden"); });
      }
    });
  }

  /* ---------- paper wallet (team) ---------- */
  var PAPER_HTML = [
    '<p class="hint soft">🧪 <b>التداول التجريبي</b> برصيد وهمي 100 USDT وبأسعار Gate الحية — لا أموال حقيقية. ',
    'كل عملية تُنفّذ في البوت فورًا وتصلك النتيجة في المحادثة، ثم افتح التطبيق من زر الرسالة لرؤية المحفظة المحدّثة.</p>',
    '<div class="pp-grid"><div class="pp-k"><b id="pp-eq">—</b><span>القيمة الإجمالية</span></div>',
    '<div class="pp-k"><b id="pp-bal">—</b><span>الرصيد النقدي</span></div>',
    '<div class="pp-k"><b id="pp-pnl">—</b><span>الربح/الخسارة</span></div></div>',
    '<div class="note" id="pp-sync" style="margin-top:0"></div>',
    '<div class="pp-sec">الفوري</div><div id="pp-spot"></div>',
    '<div class="pp-sec">العقود</div><div id="pp-fut"></div>',
    '<div class="pp-form" id="pp-order">',
    '  <div class="pp-sec" style="margin-top:0">صفقة تجريبية</div>',
    '  <div class="seg" id="pp-mkt"><button type="button" data-v="spot" class="on">فوري</button><button type="button" data-v="fut">عقود</button></div>',
    '  <div class="seg" id="pp-side"><button type="button" data-v="buy" class="on b-buy">شراء / لونغ</button><button type="button" data-v="sell" class="b-sell">بيع / شورت</button></div>',
    '  <div class="pp-two"><div><label class="f" for="pp-coin">العملة</label><input id="pp-coin" value="BTC" autocapitalize="characters" list="ai-coin-list" /></div>',
    '  <div><label class="f" for="pp-amt" id="pp-amt-l">المبلغ (USDT)</label><input id="pp-amt" type="number" inputmode="decimal" step="any" value="10" /></div></div>',
    '  <div id="pp-lev-w" class="hidden"><label class="f">الرافعة: <b id="pp-lev-l">5x</b></label><input id="pp-lev" type="range" min="1" max="20" value="5" /></div>',
    '  <div class="note" id="pp-est"></div>',
    '  <button type="button" class="go" id="pp-go">🧪 تنفيذ تجريبي</button>',
    '</div>',
    '<div class="pp-form" id="pp-suggest">',
    '  <div class="pp-sec" style="margin-top:0">💡 اقترح صفقة على المالك</div>',
    '  <p class="note" style="margin-top:0">تصل للمالك، ولا تُنفّذ إلا بموافقته ومن حسابه وضمن حدوده: فوري حتى <b id="sg-capS">3</b> USDT، وعقود بهامش حتى <b id="sg-capF">1</b> USDT ورافعة حتى 20x.</p>',
    '  <div class="seg" id="sg-mkt"><button type="button" data-v="spot" class="on">فوري</button><button type="button" data-v="fut">عقود</button></div>',
    '  <div class="seg" id="sg-side"><button type="button" data-v="buy" class="on b-buy">شراء / لونغ</button><button type="button" data-v="sell" class="b-sell">بيع / شورت</button></div>',
    '  <div class="pp-two"><div><label class="f" for="sg-coin">العملة</label><input id="sg-coin" value="BTC" autocapitalize="characters" list="ai-coin-list" /></div>',
    '  <div><label class="f" for="sg-amt">المبلغ (USDT)</label><input id="sg-amt" type="number" inputmode="decimal" step="any" value="3" /></div></div>',
    '  <div id="sg-lev-w" class="hidden"><label class="f">الرافعة: <b id="sg-lev-l">2x</b></label><input id="sg-lev" type="range" min="1" max="20" value="2" /></div>',
    '  <label class="f" for="sg-reason">السبب</label><select id="sg-reason"></select>',
    '  <input id="sg-note" maxlength="160" placeholder="ملاحظة (اختياري، تصل عند الفتح من زر لوحة الكتابة)" style="margin-top:6px" />',
    '  <button type="button" class="go sg" id="sg-go">💡 إرسال الاقتراح للمالك</button>',
    '</div>',
    '<div class="pp-sec">آخر العمليات</div><div class="pp-h" id="pp-hist"></div>',
    '<div class="actions" style="margin-top:12px"><button type="button" id="pp-refresh">🔄 تحديث المحفظة من البوت</button>',
    '<button type="button" class="danger" id="pp-reset">♻️ إعادة ضبط المحفظة إلى 100 USDT</button></div>'
  ].join("");

  function snap() { return state.snap || { b: 100, r: 0, s: [], f: [], h: [], t: 0 }; }
  function spotPx(s) { var t = (Aj().tickers || {})[s + "_USDT"]; var v = state.px[s] || (t && (t.last || t.price)); return Number(v) || 0; }
  function futPx(s) { return Number(state.fpx[s]) || spotPx(s) || 0; }
  function fetchJson(url) { return fetch(url, { cache: "no-store" }).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; }); }
  function pollPrices() {
    if (state.timer) clearTimeout(state.timer);
    var pane = $("tab-xpaper");
    if (!pane || pane.classList.contains("hidden")) return;
    var g = Aj().GATE || "https://api.gateio.ws/api/v4", sn = snap(), jobs = [];
    var spots = {}, futs = {};
    (sn.s || []).forEach(function (x) { spots[x[0]] = 1; });
    (sn.f || []).forEach(function (x) { futs[x[1]] = 1; });
    Object.keys(spots).slice(0, 20).forEach(function (s) {
      jobs.push(fetchJson(g + "/spot/tickers?currency_pair=" + s + "_USDT").then(function (d) { if (d && d[0]) state.px[s] = Number(d[0].last); }));
    });
    Object.keys(futs).slice(0, 10).forEach(function (s) {
      jobs.push(fetchJson(g + "/futures/usdt/tickers?contract=" + s + "_USDT").then(function (d) { if (d && d[0]) state.fpx[s] = Number(d[0].mark_price || d[0].last); }));
    });
    Promise.all(jobs).then(function () { renderPaper(); state.timer = setTimeout(pollPrices, 8000); });
  }
  function renderPaper() {
    if (!$("pp-eq")) return;
    var sn = snap(), eq = Number(sn.b) || 0, spotHtml = "", futHtml = "";
    (sn.s || []).forEach(function (x) {
      var s = x[0], qty = Number(x[1]), cost = Number(x[2]), px = spotPx(s), val = qty * px, pn = px ? val - cost : 0;
      eq += px ? val : cost;
      spotHtml += '<div class="pp-row"><div class="l"><b>' + esc(s) + '</b><small>' + fmt(qty, 8) + ' · ' + (px ? fmt(px) : "…") + '</small></div>' +
        '<div class="r"><span class="pn ' + (pn >= 0 ? "up" : "down") + '">' + (px ? sgn(pn) : "…") + '</span>' +
        '<button type="button" data-ppsell="' + esc(s) + '">بيع الكل</button></div></div>';
    });
    (sn.f || []).forEach(function (x) {
      var id = x[0], s = x[1], side = x[2] === "l" ? "long" : "short", lev = x[3], m = Number(x[4]), e = Number(x[5]), qty = Number(x[6]);
      var px = futPx(s), pn = px ? (px - e) * qty * (side === "long" ? 1 : -1) : 0, pct = m ? pn / m * 100 : 0;
      eq += m + pn;
      futHtml += '<div class="pp-row"><div class="l"><b>' + esc(s) + ' ' + (side === "long" ? "لونغ" : "شورت") + ' ' + esc(lev) + 'x</b>' +
        '<small>هامش ' + fmt(m, 2) + ' · دخول ' + fmt(e) + ' · الآن ' + (px ? fmt(px) : "…") + '</small></div>' +
        '<div class="r"><span class="pn ' + (pn >= 0 ? "up" : "down") + '">' + sgn(pn) + ' (' + fmt(pct, 1) + '%)</span>' +
        '<button type="button" data-ppclose="' + esc(id) + '">إغلاق</button></div></div>';
    });
    $("pp-spot").innerHTML = spotHtml || '<div class="note" style="margin-top:0">لا توجد عملات فورية.</div>';
    $("pp-fut").innerHTML = futHtml || '<div class="note" style="margin-top:0">لا توجد مراكز عقود.</div>';
    var tot = eq - 100;
    $("pp-eq").textContent = fmt(eq, 2);
    $("pp-bal").textContent = fmt(sn.b, 2);
    $("pp-pnl").textContent = sgn(tot, 2);
    $("pp-pnl").className = tot >= 0 ? "up" : "down";
    var when = sn.t ? new Date(sn.t * 1000) : null;
    $("pp-sync").textContent = state.snap ? ("آخر مزامنة مع البوت: " + (when ? when.toLocaleString("ar", { hour: "2-digit", minute: "2-digit", day: "numeric", month: "short" }) : "—") + " · الأسعار حيّة") :
      "لم تصل بيانات المحفظة بعد. اضغط «تحديث المحفظة من البوت» أو افتح التطبيق من زر رسالة البوت.";
    var names = { buy: "شراء", sell: "بيع", long: "لونغ", short: "شورت", close: "إغلاق" };
    $("pp-hist").innerHTML = (sn.h || []).map(function (h) {
      var k = h[1] === "liq" ? "تصفية" : (names[h[3]] || h[3]);
      var d = new Date(h[0] * 1000);
      return "• " + esc(k) + " " + esc(h[2]) + " " + fmt(h[4], 2) + " USDT @ " + fmt(h[5]) + (h[6] != null ? ' <span class="' + (h[6] >= 0 ? "up" : "down") + '">(' + sgn(h[6]) + ")</span>" : "") +
        ' <span style="opacity:.7">' + d.toLocaleTimeString("ar", { hour: "2-digit", minute: "2-digit" }) + "</span>";
    }).join("<br>") || "لا توجد عمليات بعد.";
    updatePaperEst();
  }
  function segVal(id) { var b = document.querySelector("#" + id + " button.on"); return b ? b.getAttribute("data-v") : null; }
  function bindSeg(id, cb) {
    var el = $(id); if (!el) return;
    el.addEventListener("click", function (ev) {
      var b = ev.target.closest("button[data-v]"); if (!b) return;
      el.querySelectorAll("button").forEach(function (x) { x.classList.toggle("on", x === b); });
      haptic("sel"); if (cb) cb(b.getAttribute("data-v"));
    });
  }
  function updatePaperEst() {
    var fut = segVal("pp-mkt") === "fut", amt = Number(($("pp-amt") || {}).value || 0), lev = Number(($("pp-lev") || {}).value || 1);
    if (!$("pp-est")) return;
    $("pp-lev-w").classList.toggle("hidden", !fut);
    $("pp-amt-l").textContent = fut ? "الهامش (USDT)" : "المبلغ (USDT)";
    $("pp-lev-l").textContent = lev + "x";
    var bal = Number(snap().b) || 0;
    $("pp-est").textContent = fut ? ("حجم المركز ≈ " + fmt(amt * lev, 2) + " USDT · تصفية تقريبية عند حركة ≈ " + fmt(95 / lev, 1) + "% عكسك · المتاح " + fmt(bal, 2)) :
      ("المتاح التجريبي: " + fmt(bal, 2) + " USDT · رسوم محاكاة 0.2%");
  }
  function paperGo() {
    var fut = segVal("pp-mkt") === "fut", side = segVal("pp-side"), s = sym($("pp-coin").value), amt = Number($("pp-amt").value || 0);
    if (!SYM.test(s)) { toast("أدخل رمز عملة صحيح"); return; }
    if (!(amt >= 1)) { toast("أقل مبلغ 1 USDT"); return; }
    if (fut) {
      var lev = parseInt($("pp-lev").value, 10) || 2;
      send({ action: "paper", op: side === "sell" ? "short" : "long", symbol: s, usdt: amt, leverage: lev });
    } else if (side === "sell") {
      send({ action: "paper", op: "sell", symbol: s, usdt: amt });
    } else {
      send({ action: "paper", op: "buy", symbol: s, usdt: amt });
    }
  }
  function updateSgUi() {
    var fut = segVal("sg-mkt") === "fut";
    $("sg-lev-w").classList.toggle("hidden", !fut);
    $("sg-lev-l").textContent = ($("sg-lev").value || 2) + "x";
    var a = $("sg-amt"), cap = fut ? capF() : capS();
    a.max = cap;
    if (Number(a.value) > cap) a.value = cap;
  }
  function suggestGo(fromSheet) {
    var p;
    if (fromSheet) p = fromSheet;
    else {
      var fut = segVal("sg-mkt") === "fut", side = segVal("sg-side");
      p = { action: "suggest", market: fut ? "fut" : "spot", side: fut ? (side === "sell" ? "short" : "long") : side,
        symbol: sym($("sg-coin").value), usdt: Number($("sg-amt").value || 0), leverage: fut ? parseInt($("sg-lev").value, 10) || 2 : 1,
        reason_code: $("sg-reason").value };
      var note = ($("sg-note").value || "").trim();
      var rname = ""; REASONS.forEach(function (r) { if (r[0] === p.reason_code) rname = r[1]; });
      p.reason = note ? (rname + " — " + note).slice(0, 200) : p.reason_code;
    }
    if (!SYM.test(p.symbol || "")) { toast("أدخل رمز عملة صحيح"); return; }
    var cap = p.market === "fut" ? capF() : capS();
    if (!(p.usdt > 0) || p.usdt > cap + 1e-9) { toast("الحد " + cap + " USDT (حد المالك)"); return; }
    if (p.market === "fut" && !(p.leverage >= 1 && p.leverage <= 20)) { toast("الرافعة من 1 إلى 20"); return; }
    haptic("ok");
    send(p);
  }

  /* ---------- trade sheet (team) ---------- */
  function sheetPair() { var t = $("sheet-title"); return sym(t ? t.textContent : ""); }
  function setupSheetTeam() {
    var sg = $("sh-spot-go"), fg = $("sh-fut-go");
    if (!sg || !fg) return false;
    if ($("sh-sg-spot")) return true;
    sg.textContent = "🧪 تنفيذ تجريبي (رصيد وهمي)";
    fg.textContent = "🧪 فتح عقد تجريبي";
    var b1 = document.createElement("button"); b1.type = "button"; b1.className = "go sg"; b1.id = "sh-sg-spot"; b1.textContent = "💡 اقترح على المالك";
    var b2 = document.createElement("button"); b2.type = "button"; b2.className = "go sg"; b2.id = "sh-sg-fut"; b2.textContent = "💡 اقترح على المالك";
    sg.parentNode.insertBefore(b1, sg.nextSibling);
    fg.parentNode.insertBefore(b2, fg.nextSibling);
    var pane = $("pane-spot");
    if (pane && !$("sh-team-note")) {
      var n = document.createElement("p"); n.className = "note"; n.id = "sh-team-note";
      n.textContent = "التنفيذ هنا تجريبي برصيدك الوهمي. «اقترح على المالك» يرسل الصفقة له ليقرر (حتى " + capS() + " USDT فوري و" + capF() + " USDT هامش عقود).";
      pane.appendChild(n);
    }
    document.addEventListener("click", function (ev) {
      var t = ev.target.closest && ev.target.closest("#sh-spot-go,#sh-fut-go,#sh-sg-spot,#sh-sg-fut");
      if (!t) return;
      ev.preventDefault(); ev.stopPropagation(); ev.stopImmediatePropagation();
      var s = sheetPair();
      if (t.id === "sh-spot-go" || t.id === "sh-sg-spot") {
        var side = (document.querySelector("#sh-side button.on") || {}).getAttribute ? document.querySelector("#sh-side button.on").getAttribute("data-side") : "buy";
        var amt = Number(($("sh-amt") || {}).value || 0);
        if (t.id === "sh-spot-go") {
          if (!(amt >= 1)) { toast("أقل مبلغ تجريبي 1 USDT"); return; }
          haptic("ok");
          send({ action: "paper", op: side === "sell" ? "sell" : "buy", symbol: s, usdt: amt });
        } else {
          suggestGo({ action: "suggest", market: "spot", side: side, symbol: s, usdt: amt, leverage: 1, reason_code: "ot", reason: "من نافذة التداول" });
        }
        return;
      }
      var fs = document.querySelector("#sh-fside button.on"), fside = fs ? fs.getAttribute("data-fside") : "long";
      var m = Number(($("sh-famt") || {}).value || 0), lev = parseInt(($("sh-lev") || {}).value, 10) || 2;
      if (t.id === "sh-fut-go") {
        if (!(m >= 1)) { toast("أقل هامش تجريبي 1 USDT"); return; }
        haptic("ok");
        send({ action: "paper", op: fside === "short" ? "short" : "long", symbol: s, usdt: m, leverage: lev });
      } else {
        suggestGo({ action: "suggest", market: "fut", side: fside === "short" ? "short" : "long", symbol: s, usdt: m, leverage: lev, reason_code: "ot", reason: "من نافذة التداول" });
      }
    }, true);
    return true;
  }

  /* ---------- team admin (owner) ---------- */
  var TEAM_HTML = [
    '<p class="hint soft">👥 <b>الزملاء</b>: يحصلون على الأسواق والتحليل والإشارات والتنبيهات، وتداول تجريبي برصيد وهمي، ',
    'ويقترحون صفقات تصلك بزر ✅ تنفيذ / ❌ رفض. التنفيذ من حسابك وضمن حدودك وبتأكيدك فقط. لا يرون أرصدتك ولا عناوينك ولا أوامرك، ولا يودعون في حسابك.</p>',
    '<div class="pp-form" style="margin-top:0"><label class="f" for="tm-in">إضافة زميل (@username أو رقم المعرّف)</label>',
    '<input id="tm-in" placeholder="@username أو 123456789" autocapitalize="off" />',
    '<button type="button" class="go" id="tm-add" style="background:var(--btn)">➕ إضافة</button></div>',
    '<div class="pp-sec" id="tm-count">القائمة</div><div id="tm-list"></div>',
    '<div class="note" id="tm-meta"></div>',
    '<div class="actions" style="margin-top:10px"><button type="button" id="tm-refresh">🔄 عرض القائمة المحدّثة في المحادثة</button></div>',
    '<p class="note">في المحادثة: <code>/team add @username</code> · <code>/team remove @username</code> · <code>/team list</code>. ',
    'ويستطيع الزميل طلب الانضمام بـ <code>/join</code> فيصلك زر ✅ / ❌.</p>'
  ].join("");
  function renderTeam() {
    if (!$("tm-list")) return;
    var t = state.team || { m: [], q: 0, j: 1 };
    var rows = (t.m || []).map(function (m) {
      var id = m[0], name = m[1], un = m[2], pend = String(id).indexOf("u:") === 0;
      var key = pend ? un : id;
      return '<div class="tm-row"><div><b>' + esc(name || (un ? "@" + un : id)) + '</b> ' + (un ? '<small>@' + esc(un) + '</small>' : '') +
        '<br><small>' + (pend ? "بانتظار أول رسالة منه" : esc(id)) + '</small></div>' +
        '<button type="button" data-tmrm="' + esc(key) + '">إزالة</button></div>';
    }).join("");
    $("tm-list").innerHTML = rows || '<div class="note" style="margin-top:0">لا يوجد زملاء بعد.</div>';
    $("tm-count").textContent = "القائمة (" + (t.m || []).length + ")";
    $("tm-meta").textContent = (t.q ? ("طلبات انضمام بانتظارك: " + t.q + " · ") : "") + "الانضمام عبر /join: " + (t.j ? "مفتوح" : "مغلق");
  }

  /* ---------- boot ---------- */
  function boot() {
    if (!window.Aj || !$("tabs")) { setTimeout(boot, 60); return; }
    injectCss();
    document.body.classList.add("role-" + role);
    var h1 = document.querySelector("header h1");
    if (h1 && role !== "guest" && !h1.querySelector(".role-chip")) {
      var chip = document.createElement("span"); chip.className = "role-chip";
      chip.textContent = role === "team" ? "زميل · تجريبي" : "المالك";
      h1.appendChild(chip);
    }
    bindTabs();
    if (role === "team") {
      state.snap = q.get("pp") ? b64json(q.get("pp")) : null;
      if (state.snap && typeof state.snap !== "object") state.snap = null;
      addTab("xpaper", "🧪", "تجريبي", PAPER_HTML, "markets");
      $("sg-capS").textContent = capS(); $("sg-capF").textContent = capF();
      $("sg-reason").innerHTML = REASONS.map(function (r) { return '<option value="' + r[0] + '">' + esc(r[1]) + "</option>"; }).join("");
      bindSeg("pp-mkt", function (v) { if (v === "fut" && Number($("pp-amt").value) > 20) $("pp-amt").value = 5; updatePaperEst(); });
      bindSeg("pp-side", updatePaperEst);
      bindSeg("sg-mkt", function (v) { $("sg-amt").value = v === "fut" ? capF() : capS(); updateSgUi(); });
      bindSeg("sg-side");
      $("pp-amt").addEventListener("input", updatePaperEst);
      $("pp-lev").addEventListener("input", updatePaperEst);
      $("sg-lev").addEventListener("input", updateSgUi);
      $("pp-go").addEventListener("click", paperGo);
      $("sg-go").addEventListener("click", function () { suggestGo(null); });
      $("pp-refresh").addEventListener("click", function () { send({ action: "paper", op: "view" }); });
      $("pp-reset").addEventListener("click", function () { confirmBox("إعادة ضبط المحفظة التجريبية إلى 100 USDT؟", function () { send({ action: "paper", op: "reset" }); }); });
      $("tab-xpaper").addEventListener("click", function (ev) {
        var s = ev.target.closest("[data-ppsell]"), c = ev.target.closest("[data-ppclose]");
        if (s) confirmBox("بيع كل " + s.getAttribute("data-ppsell") + " تجريبيًا؟", function () { send({ action: "paper", op: "sell", symbol: s.getAttribute("data-ppsell"), all: true }); });
        if (c) confirmBox("إغلاق المركز التجريبي؟", function () { send({ action: "paper", op: "close", id: c.getAttribute("data-ppclose") }); });
      });
      var tries = 0;
      (function waitSheet() { if (!setupSheetTeam() && tries++ < 50) setTimeout(waitSheet, 100); })();
      var relabel = function () {
        var tb = $("trade-btn"); if (tb) tb.textContent = "🧪 تنفيذ تجريبي (" + (tb.classList.contains("sellbtn") ? "بيع" : "شراء") + ")";
        var fo = $("fut-open"); if (fo) fo.textContent = "🧪 فتح عقد تجريبي";
      };
      relabel();
      ["side-seg", "fut-side", "fside-seg"].forEach(function (id) { var el = $(id); if (el) el.addEventListener("click", function () { setTimeout(relabel, 0); }); });
      var sn = state.snap;
      if (sn && ((sn.s || []).length || (sn.f || []).length || (sn.h || []).length)) showMine("xpaper");
      else renderPaper();
    } else if (role === "owner") {
      state.team = q.get("tm") ? b64json(q.get("tm")) : null;
      addTab("xteam", "👥", "الزملاء", TEAM_HTML, "alerts");
      renderTeam();
      $("tm-add").addEventListener("click", function () {
        var v = ($("tm-in").value || "").trim().replace(/^@/, "");
        if (!/^(\d{5,15}|[A-Za-z][A-Za-z0-9_]{3,31})$/.test(v)) { toast("أدخل @username أو رقم معرّف صحيح"); return; }
        haptic("ok"); send({ action: "team_add", target: v });
      });
      $("tm-refresh").addEventListener("click", function () { send({ action: "team_list" }); });
      $("tm-list").addEventListener("click", function (ev) {
        var b = ev.target.closest("[data-tmrm]"); if (!b) return;
        var k = b.getAttribute("data-tmrm");
        confirmBox("إزالة هذا الزميل؟", function () { send({ action: "team_remove", target: k }); });
      });
    } else {
      if (!$("guest-banner")) {
        var bn = document.createElement("div"); bn.className = "banner"; bn.id = "guest-banner";
        bn.innerHTML = "🔒 هذا التطبيق لصاحب البوت وزملائه المعتمدين. الأسعار متاحة للعرض، ولطلب الانضمام أرسل <b>/join</b> للبوت.";
        var hd = document.querySelector("header");
        if (hd && hd.parentNode) hd.parentNode.insertBefore(bn, hd.nextSibling);
      }
    }
    window.AjV16 = { role: role, snap: function () { return state.snap; }, team: function () { return state.team; }, show: showMine };
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", function () { setTimeout(boot, 0); });
  else setTimeout(boot, 0);
})();
