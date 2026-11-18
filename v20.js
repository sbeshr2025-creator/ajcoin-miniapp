/* ajcoin-miniapp v20 — market overview (breadth + mood) with a heatmap, a reorderable watchlist,
   a risk/position calculator within the bot's caps, a portfolio allocation donut (owner wallet /
   colleague paper wallet) with paper P&L history, and an indicator readout (RSI / MACD / EMA).
   Works on snapshot data (no Gate needed) and uses no third-party hosts. UI only: it never places
   orders; real trades still go through the bot and need the owner's ✅. Balances never leave the device. */
(function () {
  "use strict";
  var $ = function (id) { return document.getElementById(id); };
  function Aj() { return window.Aj || {}; }
  function tg() { return window.Telegram && window.Telegram.WebApp; }
  function role() { return window.AjRole || "guest"; }
  function hap(k) { try { var h = tg() && tg().HapticFeedback; if (!h) return; if (k === "sel") h.selectionChanged(); else if (k === "ok" || k === "err" || k === "warn") h.notificationOccurred(k === "ok" ? "success" : k === "err" ? "error" : "warning"); else h.impactOccurred(k || "light"); } catch (e) {} }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function num(v, d) { v = Number(v); if (!isFinite(v)) return "—"; var a = Math.abs(v); if (d == null) d = a >= 1000 ? 2 : a >= 1 ? 4 : a >= 0.01 ? 5 : 8; return v.toLocaleString("en-US", { maximumFractionDigits: d, minimumFractionDigits: 0 }); }
  function px(v) { try { return Aj().fmt ? Aj().fmt(v) : num(v); } catch (e) { return num(v); } }
  function sym(p) { return String(p || "").replace(/_USDT$/, ""); }
  function visible(id) { var el = $(id); return !!el && !el.classList.contains("hidden") && !document.hidden; }
  function sgn(v, d) { v = Number(v) || 0; return (v >= 0 ? "+" : "") + num(v, d == null ? 4 : d); }

  function css() {
    if ($("v20-css")) return;
    var st = document.createElement("style"); st.id = "v20-css";
    st.textContent = [
      ".v20-card{background:var(--card);border:1px solid var(--line);border-radius:var(--radius,14px);padding:10px 12px;margin:10px 0}",
      ".v20-h{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:6px}",
      ".v20-h b{font-size:14px}.v20-h small{color:var(--muted);font-size:11px}",
      ".v20-btn{border:1px solid var(--line);background:var(--card-2,#1a222c);color:var(--text);border-radius:999px;padding:6px 11px;font:inherit;font-size:12px;font-weight:650;min-height:32px;cursor:pointer}",
      ".v20-btn.on{background:var(--btn);border-color:var(--btn);color:#fff}",
      ".v20-bar{display:flex;height:10px;border-radius:999px;overflow:hidden;background:var(--line);direction:ltr}",
      ".v20-bar i{display:block;height:100%}.v20-bar .u{background:var(--up)}.v20-bar .f{background:#6d7d8f}.v20-bar .d{background:var(--down)}",
      ".v20-ovrow{display:flex;flex-wrap:wrap;gap:4px 12px;font-size:12px;color:var(--muted);margin-top:6px}.v20-ovrow b{color:var(--text)}",
      ".v20-mood{font-weight:750;font-size:13px}",
      "#v20-heat{display:grid;grid-template-columns:repeat(4,1fr);grid-auto-rows:46px;grid-auto-flow:dense;gap:4px;margin-top:8px;direction:ltr}",
      "#v20-heat .t{border-radius:8px;padding:5px 6px;display:flex;flex-direction:column;justify-content:center;align-items:center;color:#fff;font-size:11px;line-height:1.25;cursor:pointer;overflow:hidden;text-shadow:0 1px 2px #0007;border:0;font-family:inherit}",
      "#v20-heat .t b{font-size:12px}#v20-heat .t.l{grid-column:span 2;grid-row:span 2}#v20-heat .t.l b{font-size:16px}#v20-heat .t.m{grid-column:span 2}",
      "#v20-wl{display:flex;gap:6px;overflow-x:auto;scrollbar-width:none;padding:2px 0 4px;direction:rtl}#v20-wl::-webkit-scrollbar{display:none}",
      ".v20-chip{flex:none;display:flex;flex-direction:column;align-items:center;min-width:76px;padding:6px 9px;border-radius:12px;border:1px solid var(--line);background:var(--card-2,#1a222c);color:var(--text);font:inherit;font-size:12px;cursor:pointer;user-select:none;-webkit-user-select:none}",
      ".v20-chip b{font-size:13px}.v20-chip .up{color:var(--up)}.v20-chip .down{color:var(--down)}",
      "#v20-wl.edit .v20-chip{touch-action:none;cursor:grab;border-style:dashed}#v20-wl.edit .v20-chip.drag{opacity:.55;transform:scale(1.05)}",
      ".v20-chip .ed{display:none;gap:4px;margin-top:4px}#v20-wl.edit .v20-chip .ed{display:flex}",
      ".v20-chip .ed button{border:1px solid var(--line);background:var(--bg);color:var(--text);border-radius:8px;min-width:26px;min-height:26px;font:inherit;font-size:12px;padding:0 4px}",
      ".v20-empty{color:var(--muted);font-size:12px;padding:4px 2px}",
      ".v20-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}.v20-grid label{display:flex;flex-direction:column;gap:3px;font-size:11px;color:var(--muted)}",
      ".v20-grid input{width:100%;box-sizing:border-box;padding:8px 9px;border-radius:10px;border:1px solid var(--line);background:var(--bg);color:var(--text);font:inherit;font-size:14px;direction:ltr;text-align:right}",
      ".v20-seg{display:flex;gap:6px;margin-bottom:8px;flex-wrap:wrap}",
      ".v20-out{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:10px}.v20-out div{background:var(--bg);border:1px solid var(--line);border-radius:10px;padding:7px 9px}",
      ".v20-out span{display:block;font-size:11px;color:var(--muted)}.v20-out b{font-size:14px;direction:ltr;unicode-bidi:isolate}",
      ".v20-warn{margin-top:8px;font-size:12px;color:var(--warn,#f5c15c)}.v20-warn.bad{color:var(--down)}",
      ".v20-note{margin-top:6px;font-size:11px;color:var(--hint,#6d7d8f)}",
      ".v20-don{display:flex;gap:12px;align-items:center}.v20-don svg{flex:none}",
      ".v20-leg{flex:1;display:flex;flex-direction:column;gap:4px;font-size:12px;min-width:0}.v20-leg div{display:flex;align-items:center;gap:6px}",
      ".v20-leg i{width:10px;height:10px;border-radius:3px;flex:none}.v20-leg span{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.v20-leg b{direction:ltr}",
      ".v20-pnl{display:flex;align-items:flex-end;gap:3px;height:54px;margin-top:8px;direction:ltr}.v20-pnl i{flex:1;max-width:28px;border-radius:3px 3px 0 0;min-height:2px}",
      "#v20-ind{font-size:12px;color:var(--muted);margin:4px 2px 0;display:flex;flex-wrap:wrap;gap:4px 12px}#v20-ind b{color:var(--text)}",
      "@media (prefers-reduced-motion: reduce){.v20-chip{transition:none}}"
    ].join("\n");
    document.head.appendChild(st);
  }

  /* ---------- 1) market overview: breadth, mood, heatmap ---------- */
  var heatOn = false, ovSig = "";
  try { heatOn = localStorage.getItem("aj-v20-heat") === "1"; } catch (e) {}
  function liquid() {
    var T = Aj().tickers || {}, out = [];
    Object.keys(T).forEach(function (p) { var t = T[p]; if (t && t.last > 0 && Number(t.quote) >= 200000 && /_USDT$/.test(p)) out.push({ p: p, c: Number(t.change) || 0, q: Number(t.quote) || 0, last: t.last }); });
    out.sort(function (a, b) { return b.q - a.q; });
    return out;
  }
  function mood(upPct, avg) {
    var s = upPct * 0.7 + Math.max(0, Math.min(100, 50 + avg * 6)) * 0.3;
    if (s >= 75) return ["طمع 🔥", "var(--up)"]; if (s >= 58) return ["تفاؤل 📈", "var(--up)"];
    if (s > 42) return ["محايد ⚖️", "var(--muted)"]; if (s > 25) return ["حذر 📉", "var(--down)"]; return ["خوف 🥶", "var(--down)"];
  }
  function heatColor(c) {
    var a = Math.min(1, Math.abs(c) / 8), base = c >= 0 ? [22, 199, 132] : [234, 57, 67], k = 0.35 + a * 0.65;
    return "rgb(" + Math.round(30 + (base[0] - 30) * k) + "," + Math.round(38 + (base[1] - 38) * k) + "," + Math.round(48 + (base[2] - 48) * k) + ")";
  }
  function overview(force) {
    var panel = $("tab-markets"), tools = panel && panel.querySelector(".mkt-tools"); if (!tools) return;
    var box = $("v20-ov");
    if (!box) {
      box = document.createElement("div"); box.id = "v20-ov"; box.className = "v20-card"; box.setAttribute("aria-label", "نظرة على السوق");
      box.innerHTML = '<div class="v20-h"><b>نظرة على السوق</b><button type="button" class="v20-btn" id="v20-heat-btn" aria-pressed="false">🗺️ الخريطة الحرارية</button></div>' +
        '<div class="v20-bar" id="v20-breadth" role="img"></div><div class="v20-ovrow" id="v20-ovtxt"></div><div id="v20-heat" class="hidden"></div>';
      tools.parentNode.insertBefore(box, tools);
      $("v20-heat-btn").addEventListener("click", function () {
        heatOn = !heatOn; hap("sel"); try { localStorage.setItem("aj-v20-heat", heatOn ? "1" : "0"); } catch (e) {}
        overview(true);
      });
    }
    if (!force && !visible("tab-markets")) return;
    var L = liquid(); if (!L.length) { $("v20-ovtxt").textContent = "جارٍ تحميل الأسعار…"; return; }
    var up = 0, dn = 0, fl = 0; L.forEach(function (x) { if (x.c > 0.05) up++; else if (x.c < -0.05) dn++; else fl++; });
    var top = L.slice(0, 30), cs = top.map(function (x) { return x.c; }).sort(function (a, b) { return a - b; });
    var avg = cs.length % 2 ? cs[(cs.length - 1) / 2] : (cs[cs.length / 2 - 1] + cs[cs.length / 2]) / 2; /* median: one pump can't skew it */
    var n = L.length, upPct = up / n * 100, md = mood(upPct, avg);
    var btn = $("v20-heat-btn"); btn.classList.toggle("on", heatOn); btn.setAttribute("aria-pressed", heatOn ? "true" : "false");
    $("v20-heat").classList.toggle("hidden", !heatOn);
    var sig = up + ":" + dn + ":" + fl + ":" + avg.toFixed(2) + ":" + heatOn + ":" + (heatOn ? top.map(function (x) { return x.p + x.c.toFixed(1); }).join() : "");
    if (sig === ovSig && !force) return; ovSig = sig;
    $("v20-breadth").innerHTML = '<i class="u" style="width:' + (up / n * 100).toFixed(1) + '%"></i><i class="f" style="width:' + (fl / n * 100).toFixed(1) + '%"></i><i class="d" style="width:' + (dn / n * 100).toFixed(1) + '%"></i>';
    $("v20-breadth").setAttribute("aria-label", "صاعدة " + up + "، هابطة " + dn);
    $("v20-ovtxt").innerHTML = '<span class="v20-mood" style="color:' + md[1] + '">مزاج السوق: ' + md[0] + '</span>' +
      '<span>صاعدة <b style="color:var(--up)">' + up + '</b> · هابطة <b style="color:var(--down)">' + dn + '</b> من ' + n + '</span>' +
      '<span>وسيط تغيّر أكبر 30: <b style="color:' + (avg >= 0 ? "var(--up)" : "var(--down)") + '">' + (avg >= 0 ? "+" : "") + avg.toFixed(2) + '%</b></span>';
    if (heatOn) {
      $("v20-heat").innerHTML = top.map(function (x, i) {
        var cls = i < 2 ? "t l" : i < 8 ? "t m" : "t";
        return '<button type="button" class="' + cls + '" data-pair="' + esc(x.p) + '" style="background:' + heatColor(x.c) + '" aria-label="' + esc(sym(x.p)) + ' ' + x.c.toFixed(2) + '%">' +
          '<b>' + esc(sym(x.p)) + '</b><span>' + (x.c >= 0 ? "+" : "") + x.c.toFixed(2) + '%</span>' + (i < 2 ? '<span>' + esc(px(x.last)) + '</span>' : "") + '</button>';
      }).join("");
    }
  }

  /* ---------- 2) watchlist strip with reorder ---------- */
  var wlEdit = false, wlSig = "", drag = null;
  function favs() { var f = Aj().favs; return Array.isArray(f) ? f : []; }
  function saveFavs() { try { Aj().saveFavs && Aj().saveFavs(); } catch (e) {} }
  function move(i, j) { var f = favs(); if (j < 0 || j >= f.length || i === j) return; var x = f.splice(i, 1)[0]; f.splice(j, 0, x); }
  function watchlist(force) {
    var panel = $("tab-markets"), anchor = $("v20-ov") || (panel && panel.querySelector(".mkt-tools")); if (!anchor) return;
    var box = $("v20-wlbox");
    if (!box) {
      box = document.createElement("div"); box.id = "v20-wlbox"; box.className = "v20-card";
      box.innerHTML = '<div class="v20-h"><b>⭐ قائمتي</b><span><small id="v20-wlhint"></small> <button type="button" class="v20-btn" id="v20-wl-ed" aria-pressed="false">ترتيب</button></span></div><div id="v20-wl" role="list"></div>';
      anchor.parentNode.insertBefore(box, anchor);
      $("v20-wl-ed").addEventListener("click", function () { wlEdit = !wlEdit; hap("sel"); if (!wlEdit) saveFavs(); watchlist(true); });
      var wl = $("v20-wl");
      wl.addEventListener("click", function (ev) {
        var b = ev.target.closest("[data-mv]"); if (!b) return;
        ev.stopPropagation(); var i = Number(b.getAttribute("data-i")), mv = b.getAttribute("data-mv");
        if (mv === "x") { favs().splice(i, 1); } else move(i, i + Number(mv));
        hap("sel"); saveFavs(); watchlist(true);
      });
      wl.addEventListener("pointerdown", function (ev) {
        if (!wlEdit || ev.target.closest("button[data-mv]")) return;
        var chip = ev.target.closest(".v20-chip"); if (!chip) return;
        drag = { el: chip, i: Number(chip.getAttribute("data-i")) }; chip.classList.add("drag");
        try { chip.setPointerCapture(ev.pointerId); } catch (e) {}
      });
      wl.addEventListener("pointermove", function (ev) {
        if (!drag) return;
        var chips = Array.prototype.slice.call(wl.querySelectorAll(".v20-chip")), tgt = -1;
        chips.forEach(function (c, k) { var r = c.getBoundingClientRect(); if (ev.clientX >= r.left && ev.clientX <= r.right) tgt = k; });
        if (tgt >= 0 && tgt !== drag.i) {
          move(drag.i, tgt); var ref = chips[tgt];
          if (tgt > drag.i) ref.after(drag.el); else ref.before(drag.el);
          wl.querySelectorAll(".v20-chip").forEach(function (c, k) { c.setAttribute("data-i", k); c.querySelectorAll("[data-i]").forEach(function (b) { b.setAttribute("data-i", k); }); });
          drag.i = tgt; hap("sel");
        }
      });
      var end = function () { if (!drag) return; drag.el.classList.remove("drag"); drag = null; saveFavs(); };
      wl.addEventListener("pointerup", end); wl.addEventListener("pointercancel", end);
    }
    if (drag) return;
    var f = favs(), T = Aj().tickers || {};
    var sig = wlEdit + "|" + f.map(function (p) { var t = T[p] || {}; return p + (t.last || 0) + (Number(t.change) || 0).toFixed(2); }).join();
    if (sig === wlSig && !force) return; wlSig = sig;
    var ed = $("v20-wl-ed"); ed.textContent = wlEdit ? "تم ✓" : "ترتيب"; ed.classList.toggle("on", wlEdit); ed.setAttribute("aria-pressed", wlEdit ? "true" : "false");
    ed.classList.toggle("hidden", f.length < 2 && !wlEdit);
    $("v20-wlhint").textContent = wlEdit ? "اسحب العملة أو استخدم الأسهم" : "";
    var wl = $("v20-wl"); wl.classList.toggle("edit", wlEdit);
    if (!f.length) { wl.innerHTML = '<div class="v20-empty">اضغط ☆ بجانب أي عملة في القائمة لتظهر هنا، ثم رتّبها كما تحب.</div>'; return; }
    wl.innerHTML = f.map(function (p, i) {
      var t = T[p] || {}, c = Number(t.change) || 0;
      return '<div class="v20-chip" role="listitem" data-i="' + i + '"' + (wlEdit ? "" : ' data-pair="' + esc(p) + '"') + '>' +
        '<b>' + esc(sym(p)) + '</b><span>' + (t.last ? esc(px(t.last)) : (Object.keys(T).length ? "غير مدرج" : "…")) + '</span><span class="' + (c >= 0 ? "up" : "down") + '">' + (c >= 0 ? "+" : "") + c.toFixed(2) + '%</span>' +
        '<span class="ed"><button type="button" data-mv="1" data-i="' + i + '" aria-label="تأخير">◀</button><button type="button" data-mv="x" data-i="' + i + '" aria-label="إزالة">✕</button><button type="button" data-mv="-1" data-i="' + i + '" aria-label="تقديم">▶</button></span></div>';
    }).join("");
  }

  /* ---------- 3) risk / position calculator (estimate only, within the caps) ---------- */
  var C = { mode: "fut", side: "long", touched: {} };
  var MMR = 0.005, FEE_FUT = 0.0005, FEE_SPOT = 0.002;
  function capSpot() { return Number(Aj().TRADE_CAP) || 3; }
  function capFut() { return Number(Aj().FUT_CAP) || 1; }
  function maxLev(contract) { var m = 20; try { var x = Aj().futMaxLev ? Number(Aj().futMaxLev(contract)) : 20; if (x > 0) m = Math.min(20, x); } catch (e) {} return Math.max(1, Math.min(20, Number(Aj().FUT_MAX_LEV) || 20, m)); }
  function curContract() { var s = $("fut-contract"); return (s && s.value) || "BTC_USDT"; }
  function curMark() {
    if (C.mode === "spot") { var t = (Aj().tickers || {})[Aj().pair || "BTC_USDT"]; return t ? Number(t.last) : 0; }
    var c = curContract(), ft = (Aj().futTickers || {})[c], sp = (Aj().futSpecs || {})[c];
    return Number((ft && (ft.mark_price || ft.last)) || (sp && sp.mark_price) || ((Aj().tickers || {})[c] || {}).last || 0);
  }
  function calcCard() {
    var pane = $("tab-futures"); if (!pane || $("v20-calc")) return;
    var anchor = $("fut-open"); var card = anchor && (anchor.closest(".form") || anchor.closest(".card"));
    var box = document.createElement("div"); box.id = "v20-calc"; box.className = "v20-card";
    box.innerHTML = '<div class="v20-h"><b>🧮 حاسبة المخاطرة والمركز</b><small>تقدير فقط — لا ينفّذ أي أمر</small></div>' +
      '<div class="v20-seg" id="v20-c-mode"><button type="button" class="v20-btn on" data-v="fut">عقود</button><button type="button" class="v20-btn" data-v="spot">فوري</button>' +
      '<span style="flex:1"></span><button type="button" class="v20-btn on" data-s="long" id="v20-c-long">لونغ</button><button type="button" class="v20-btn" data-s="short" id="v20-c-short">شورت</button></div>' +
      '<div class="v20-grid">' +
      '<label>سعر الدخول<input id="v20-c-entry" type="number" inputmode="decimal" step="any"></label>' +
      '<label id="v20-c-amt-l">الهامش (USDT)<input id="v20-c-amt" type="number" inputmode="decimal" step="any"></label>' +
      '<label>وقف الخسارة<input id="v20-c-sl" type="number" inputmode="decimal" step="any" placeholder="اختياري"></label>' +
      '<label>جني الربح<input id="v20-c-tp" type="number" inputmode="decimal" step="any" placeholder="اختياري"></label>' +
      '<label id="v20-c-lev-l" style="grid-column:1/-1">الرافعة: <b id="v20-c-levv">5x</b><input id="v20-c-lev" type="range" min="1" max="20" step="1" value="5" style="padding:0"></label>' +
      '</div><div class="v20-out" id="v20-c-out"></div><div class="v20-warn" id="v20-c-warn"></div>' +
      '<div class="v20-seg" style="margin:8px 0 0"><button type="button" class="v20-btn" id="v20-c-now">↺ السعر الحالي</button><button type="button" class="v20-btn" id="v20-c-fill">📋 تعبئة نموذج العقود</button></div>' +
      '<div class="v20-note">التصفية تقريبية (هامش معزول، صيانة 0.5٪) والرسوم تقديرية. الحدود: فوري ≤ ' + num(capSpot(), 2) + ' USDT، هامش عقود ≤ ' + num(capFut(), 2) + ' USDT، رافعة ≤ 20x. أي أمر حقيقي يحتاج ✅ في البوت.</div>';
    if (card && card.parentNode) card.parentNode.insertBefore(box, card.nextSibling); else pane.appendChild(box);
    $("v20-c-mode").addEventListener("click", function (ev) {
      var b = ev.target.closest("button"); if (!b) return; hap("sel");
      if (b.dataset.v) { C.mode = b.dataset.v; C.touched = {}; if (C.mode === "spot") C.side = "long"; }
      if (b.dataset.s && C.mode === "fut") C.side = b.dataset.s;
      calcSync(true);
    });
    ["entry", "amt", "sl", "tp", "lev"].forEach(function (k) { $("v20-c-" + k).addEventListener("input", function () { C.touched[k] = 1; calc(); }); });
    $("v20-c-now").addEventListener("click", function () { hap("light"); C.touched.entry = 0; calcSync(true); });
    $("v20-c-fill").addEventListener("click", fillForm);
    var fc = $("fut-contract"); if (fc) fc.addEventListener("change", function () { if (C.mode === "fut") { C.touched.entry = 0; calcSync(true); } });
    calcSync(true);
  }
  function calcSync(force) {
    if (!$("v20-calc")) return;
    document.querySelectorAll("#v20-c-mode [data-v]").forEach(function (b) { b.classList.toggle("on", b.dataset.v === C.mode); });
    document.querySelectorAll("#v20-c-mode [data-s]").forEach(function (b) { b.classList.toggle("on", b.dataset.s === C.side); b.classList.toggle("hidden", C.mode === "spot"); });
    $("v20-c-lev-l").classList.toggle("hidden", C.mode === "spot");
    $("v20-c-fill").classList.toggle("hidden", C.mode === "spot");
    $("v20-c-amt-l").firstChild.textContent = C.mode === "spot" ? "المبلغ (USDT)" : "الهامش (USDT)";
    var lev = $("v20-c-lev"), ml = maxLev(curContract()); lev.max = String(ml); if (Number(lev.value) > ml) lev.value = String(ml);
    if (!C.touched.entry || force && !C.touched.entry) { var m = curMark(); if (m > 0) $("v20-c-entry").value = String(+m.toPrecision(8)); }
    if (!C.touched.amt) $("v20-c-amt").value = String(C.mode === "spot" ? capSpot() : capFut());
    calc();
  }
  function calc() {
    var out = $("v20-c-out"), warn = $("v20-c-warn"); if (!out) return;
    var e = Number($("v20-c-entry").value), amt = Number($("v20-c-amt").value), sl = Number($("v20-c-sl").value), tp = Number($("v20-c-tp").value);
    var lev = C.mode === "spot" ? 1 : Math.max(1, Math.min(maxLev(curContract()), Math.round(Number($("v20-c-lev").value) || 1)));
    $("v20-c-levv").textContent = lev + "x";
    var w = [], bad = false, cap = C.mode === "spot" ? capSpot() : capFut();
    if (amt > cap) { w.push("⚠️ المبلغ أعلى من الحد (" + num(cap, 2) + " USDT) — سيُرفض في البوت."); bad = true; }
    if (!(e > 0) || !(amt > 0)) { out.innerHTML = ""; warn.textContent = "أدخل سعر الدخول والمبلغ."; warn.className = "v20-warn"; return; }
    var long = C.side === "long" || C.mode === "spot", dir = long ? 1 : -1;
    var notional = amt * lev, qty = notional / e, fee = notional * (C.mode === "spot" ? FEE_SPOT : FEE_FUT) * 2;
    var liq = C.mode === "spot" ? 0 : (long ? e * (1 - 1 / lev + MMR) : e * (1 + 1 / lev - MMR));
    var cells = [["القيمة الاسمية", num(notional, 4) + " USDT"], ["الكمية", num(qty) + " " + esc(sym(C.mode === "spot" ? Aj().pair : curContract()))]];
    if (C.mode === "fut") {
      var sp = (Aj().futSpecs || {})[curContract()] || {}, qm = Number(sp.quanto_multiplier) || 0;
      if (qm > 0) { var cts = Math.floor(qty / qm); cells.push(["العقود", String(cts)]); if (cts < Math.max(1, parseInt(sp.order_size_min, 10) || 1)) { w.push("⚠️ أقل من الحد الأدنى لحجم العقد — زد الرافعة أو اختر عقدًا آخر."); } }
      cells.push(["سعر التصفية ≈", px(liq) + " (" + (Math.abs(e - liq) / e * 100).toFixed(1) + "%)"]);
    }
    var loss = null, gain = null;
    if (sl > 0) {
      if ((sl - e) * dir >= 0) { w.push("⚠️ وقف الخسارة في الجهة الخاطئة من سعر الدخول."); bad = true; }
      else {
        loss = Math.min(Math.abs(e - sl) * qty, C.mode === "spot" ? amt : amt) + fee;
        if (C.mode === "fut" && (sl - liq) * dir <= 0) { w.push("⛔ سعر التصفية يأتي قبل وقف الخسارة — ستُصفّى أولًا. قلّل الرافعة أو قرّب الوقف."); bad = true; }
        cells.push(["الخسارة عند الوقف", "-" + num(loss, 4) + " USDT (" + (loss / amt * 100).toFixed(1) + "%)"]);
      }
    }
    if (tp > 0) {
      if ((tp - e) * dir <= 0) { w.push("⚠️ جني الربح في الجهة الخاطئة من سعر الدخول."); bad = true; }
      else { gain = Math.abs(tp - e) * qty - fee; cells.push(["الربح عند الهدف", "+" + num(gain, 4) + " USDT (" + (gain / amt * 100).toFixed(1) + "%)"]); }
    }
    if (loss && gain) cells.push(["العائد/المخاطرة", "1 : " + (gain / loss).toFixed(2)]);
    cells.push(["رسوم تقديرية", num(fee, 4) + " USDT"]);
    if (C.mode === "fut" && lev > 5) w.push("⚠️ رافعة أعلى من 5x تعني خطر تصفية مرتفع.");
    out.innerHTML = cells.map(function (c) { return "<div><span>" + c[0] + "</span><b>" + c[1] + "</b></div>"; }).join("");
    warn.textContent = w.join(" "); warn.className = "v20-warn" + (bad ? " bad" : "");
  }
  function setVal(id, v) { var el = $(id); if (!el || v == null || v === "") return; el.value = String(v); try { el.dispatchEvent(new Event("input", { bubbles: true })); el.dispatchEvent(new Event("change", { bubbles: true })); } catch (e) {} }
  function fillForm() {
    var amt = Math.min(capFut(), Number($("v20-c-amt").value) || 0);
    setVal("fut-usdt", amt > 0 ? amt : ""); setVal("fut-sl", $("v20-c-sl").value); setVal("fut-tp", $("v20-c-tp").value);
    var want = Math.round(Number($("v20-c-lev").value) || 1), best = null;
    document.querySelectorAll("#fut-levs button[data-lev]").forEach(function (b) { var v = Number(b.getAttribute("data-lev")); if (v <= want && (!best || v > Number(best.getAttribute("data-lev")))) best = b; });
    if (best) best.click();
    var used = best ? Number(best.getAttribute("data-lev")) : 0;
    var side = document.querySelector('#fut-side-seg [data-fside="' + C.side + '"]'); if (side) side.click();
    hap("ok"); try { Aj().toast && Aj().toast("تمت تعبئة نموذج العقود" + (used && used !== want ? " (الرافعة " + used + "x — أقرب خيار متاح)" : "") + " — راجع القيم ثم أرسل الطلب", "ok"); } catch (e) {}
    try { ($("fut-usdt") || $("fut-open")).scrollIntoView({ behavior: "smooth", block: "center" }); } catch (e) {}
  }

  /* ---------- 4) allocation donut + paper P&L history ---------- */
  var COLORS = ["#3b82f6", "#16c784", "#f5c15c", "#a78bfa", "#f472b6", "#22d3ee", "#6d7d8f"];
  function donut(rows, hideVals, centerVal) {
    var tot = rows.reduce(function (s, r) { return s + r[1]; }, 0); if (!(tot > 0)) return "";
    rows = rows.slice().sort(function (a, b) { return b[1] - a[1]; });
    if (rows.length > 6) { var rest = rows.slice(5).reduce(function (s, r) { return s + r[1]; }, 0); rows = rows.slice(0, 5).concat([["أخرى", rest]]); }
    var R = 42, Cc = 2 * Math.PI * R, off = 0, segs = "";
    rows.forEach(function (r, i) { var len = r[1] / tot * Cc; segs += '<circle r="' + R + '" cx="55" cy="55" fill="none" stroke="' + COLORS[i % COLORS.length] + '" stroke-width="16" stroke-dasharray="' + len.toFixed(2) + " " + (Cc - len).toFixed(2) + '" stroke-dashoffset="' + (-off).toFixed(2) + '" transform="rotate(-90 55 55)"/>'; off += len; });
    var center = hideVals ? "••••" : num(centerVal != null ? centerVal : tot, 2);
    return '<div class="v20-don"><svg width="110" height="110" viewBox="0 0 110 110" role="img" aria-label="توزيع المحفظة">' + segs +
      '<text x="55" y="52" text-anchor="middle" fill="currentColor" font-size="13" font-weight="700">' + esc(center) + '</text><text x="55" y="68" text-anchor="middle" fill="#8b9aab" font-size="10">USDT</text></svg>' +
      '<div class="v20-leg">' + rows.map(function (r, i) {
        return '<div><i style="background:' + COLORS[i % COLORS.length] + '"></i><span>' + esc(r[0]) + '</span><b>' + (r[1] / tot * 100).toFixed(1) + '%</b></div>';
      }).join("") + '</div></div>';
  }
  var allocSig = "";
  function allocation() {
    var r = role();
    if (r === "owner") {
      var root = $("wl-root"); if (!root || !window.AjV17 || !AjV17.alloc) return;
      var rows = AjV17.alloc(); var box = $("v20-alloc");
      if (!rows || !rows.length) { if (box) box.classList.add("hidden"); return; }
      if (!box) { box = document.createElement("div"); box.id = "v20-alloc"; box.className = "v20-card"; root.parentNode.insertBefore(box, root.nextSibling); }
      box.classList.remove("hidden");
      var hide = AjV17.hidden && AjV17.hidden();
      var sig = hide + rows.map(function (x) { return x[0] + x[1].toFixed(2); }).join();
      if (sig === allocSig) return; allocSig = sig;
      box.innerHTML = '<div class="v20-h"><b>🍩 توزيع المحفظة</b><small>بأسعار حيّة · على جهازك فقط</small></div>' + donut(rows, hide);
    } else if (r === "team") {
      var sync = $("pp-sync"); if (!sync || !window.AjV16) return;
      var sn = AjV16.snap(); var b2 = $("v20-alloc");
      if (!b2) { b2 = document.createElement("div"); b2.id = "v20-alloc"; b2.className = "v20-card"; sync.parentNode.insertBefore(b2, sync.nextSibling); }
      if (!sn) { b2.innerHTML = '<div class="v20-h"><b>🍩 توزيع المحفظة التجريبية</b></div><div class="v20-empty">تظهر بعد أول مزامنة مع البوت.</div>'; return; }
      var T = Aj().tickers || {}, FT = Aj().futTickers || {}, rows2 = [["نقد USDT", Number(sn.b) || 0]];
      /* same price sources as the v16 paper card, so the donut total matches «القيمة الإجمالية» */
      var spx = AjV16.px || function (s) { var t = T[s + "_USDT"]; return Number(t && t.last) || 0; };
      var fpx = AjV16.fpx || function (s) { var p = FT[s + "_USDT"]; return Number(p && (p.mark_price || p.last)) || spx(s); };
      var eqAll = Number(sn.b) || 0;
      (sn.s || []).forEach(function (x) { var pr = spx(x[0]), v = pr ? Number(x[1]) * pr : Number(x[2]); eqAll += v; if (v > 0) rows2.push([x[0], v]); });
      (sn.f || []).forEach(function (x) { var mk = fpx(x[1]), m = Number(x[4]) || 0, e = Number(x[5]) || 0, q = Number(x[6]) || 0;
        var v = m + (mk ? (mk - e) * q * (x[2] === "l" ? 1 : -1) : 0); eqAll += v; if (v > 0) rows2.push([x[1] + " " + (x[2] === "l" ? "لونغ" : "شورت"), v]); });
      var hist = (sn.h || []).filter(function (h) { return h[6] != null; }).slice(0, 10).reverse();
      var sig2 = rows2.map(function (x) { return x[0] + x[1].toFixed(3); }).join() + hist.length;
      if (sig2 === allocSig) return; allocSig = sig2;
      var mx = Math.max.apply(null, hist.map(function (h) { return Math.abs(Number(h[6]) || 0); }).concat([0.0001]));
      var cum = hist.reduce(function (s, h) { return s + (Number(h[6]) || 0); }, 0);
      b2.innerHTML = '<div class="v20-h"><b>🍩 توزيع المحفظة التجريبية</b><small>بأسعار حيّة</small></div>' + donut(rows2, false, eqAll) +
        (hist.length ? '<div class="v20-h" style="margin:10px 0 0"><b>📊 آخر الصفقات المغلقة</b><small>المجموع: <span class="' + (cum >= 0 ? "up" : "down") + '">' + sgn(cum) + ' USDT</span></small></div>' +
          '<div class="v20-pnl" role="img" aria-label="ربح وخسارة آخر الصفقات">' + hist.map(function (h) { var v = Number(h[6]) || 0; return '<i title="' + esc(h[2]) + " " + sgn(v) + '" style="height:' + Math.max(4, Math.abs(v) / mx * 100).toFixed(0) + '%;background:' + (v >= 0 ? "var(--up)" : "var(--down)") + '"></i>'; }).join("") + '</div>' : "");
    }
  }

  /* ---------- 5) indicator readout ---------- */
  function indReadout() {
    var inds = document.querySelector(".inds"); if (!inds) return;
    var el = $("v20-ind"); if (!el) { el = document.createElement("div"); el.id = "v20-ind"; el.setAttribute("aria-live", "polite"); inds.parentNode.insertBefore(el, inds.nextSibling); }
    var cs = (Aj().candles || []).map(function (c) { return c.close; }); if (cs.length < 35) { el.textContent = ""; return; }
    function emaArr(a, n) { var k = 2 / (n + 1), o = [], p = null; a.forEach(function (v, i) { if (p == null) { if (i === n - 1) { p = a.slice(0, n).reduce(function (s, x) { return s + x; }, 0) / n; o[i] = p; } else o[i] = null; } else { p = v * k + p * (1 - k); o[i] = p; } }); return o; }
    var g = 0, l = 0, n = 14; for (var i = cs.length - n; i < cs.length; i++) { var d = cs[i] - cs[i - 1]; if (d > 0) g += d; else l -= d; }
    var rs = l === 0 ? 100 : 100 - 100 / (1 + g / l);
    var e12 = emaArr(cs, 12), e26 = emaArr(cs, 26), m = cs.map(function (_, i) { return e12[i] != null && e26[i] != null ? e12[i] - e26[i] : null; });
    var mm = m.filter(function (v) { return v != null; }), sig = emaArr(mm, 9), lastM = mm[mm.length - 1], lastS = sig[sig.length - 1];
    var e21 = emaArr(cs, 21), last = cs[cs.length - 1], lastE = e21[e21.length - 1];
    var rsTxt = rs >= 70 ? "تشبّع شراء" : rs <= 30 ? "تشبّع بيع" : "طبيعي";
    el.innerHTML = '<span>RSI(14): <b style="color:' + (rs >= 70 ? "var(--down)" : rs <= 30 ? "var(--up)" : "var(--text)") + '">' + rs.toFixed(0) + '</b> ' + rsTxt + '</span>' +
      '<span>MACD: <b style="color:' + (lastM >= lastS ? "var(--up)" : "var(--down)") + '">' + (lastM >= lastS ? "إيجابي ▲" : "سلبي ▼") + '</b></span>' +
      '<span>السعر ' + (last >= lastE ? "فوق" : "تحت") + ' EMA21</span><span style="opacity:.7">مؤشرات للمعلومة فقط</span>';
  }

  /* ---------- boot ---------- */
  function tick() {
    try { overview(false); } catch (e) {}
    try { if (visible("tab-markets")) watchlist(false); } catch (e) {}
    try { if (visible("tab-futures") && $("v20-calc") && !C.touched.entry) { var m = curMark(), cur = Number($("v20-c-entry").value); if (m > 0 && Math.abs(m - cur) / m > 0.0005) calcSync(false); } } catch (e) {}
    try { if (visible("tab-portfolio") || visible("tab-xpaper")) allocation(); } catch (e) {}
  }
  function boot() {
    if (!window.Aj) { setTimeout(boot, 200); return; }
    css();
    try { watchlist(true); } catch (e) {}
    try { overview(true); } catch (e) {}
    try { calcCard(); } catch (e) {}
    try { indReadout(); } catch (e) {}
    document.addEventListener("aj:inds", function () { try { indReadout(); } catch (e) {} });
    document.addEventListener("aj:bal", function () { allocSig = ""; try { allocation(); } catch (e) {} });
    var lc = 0; setInterval(function () { var c = Aj().lastCandle; var k = c ? c.time + ":" + (Aj().candles || []).length : ""; if (k !== lc) { lc = k; try { indReadout(); } catch (e) {} } }, 3000);
    setInterval(tick, 3000);
    document.addEventListener("click", function (ev) { if (ev.target.closest && ev.target.closest('[data-tab],[data-fav],.v18-nav button,#v18-nav button')) setTimeout(function () { allocSig = ""; ovSig = ""; wlSig = ""; tick(); }, 60); }, true);
    window.AjV20 = {
      state: function () { return { heat: heatOn, heatTiles: document.querySelectorAll("#v20-heat .t").length, wl: favs().slice(), wlEdit: wlEdit, calc: !!$("v20-calc"), alloc: !!($("v20-alloc") && !$("v20-alloc").classList.contains("hidden") && $("v20-alloc").innerHTML), ind: ($("v20-ind") || {}).textContent || "" }; },
      calc: function (o) { o = o || {}; if (o.mode) C.mode = o.mode; if (o.side) C.side = o.side; ["entry", "amt", "sl", "tp", "lev"].forEach(function (k) { if (o[k] != null) { $("v20-c-" + k).value = String(o[k]); C.touched[k] = 1; } }); calcSync(false); return { out: ($("v20-c-out") || {}).innerText, warn: ($("v20-c-warn") || {}).textContent }; },
      move: function (i, j) { move(i, j); saveFavs(); watchlist(true); return favs().slice(); },
      refresh: function () { allocSig = ovSig = wlSig = ""; tick(); overview(true); watchlist(true); allocation(); indReadout(); }
    };
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", function () { setTimeout(boot, 0); }); else setTimeout(boot, 0);
})();
