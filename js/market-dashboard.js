/**
 * Market Benchmarks as a dashboard (js/market-dashboard.js).
 * An Overview of one tile per area, and one area on screen at a time, so nothing needs long scrolling.
 * The tables and charts themselves are drawn by market-performance.js; this file only decides what is shown.
 */
(function () {
  "use strict";

  var P = window.KYF_MARKET_PULSE || {};
  var macro = P.macro || {};
  var metals = P.preciousMetals || {};
  var idx = P.indices || {};
  var nat = (window.KYF_RESIDEX && window.KYF_RESIDEX.national_composite_50_cities && window.KYF_RESIDEX.national_composite_50_cities.summary) || {};

  var PANELS = {
    overview: { el: "dashOverview" },
    macro: { el: "section-macro" },
    realestate: { el: "section-realestate" },
    metals: { el: "section-metals", horizon: true },
    indices: { el: "section-indices", horizon: true },
    mf: { el: "section-mf", horizon: true },
    equities: { el: "section-equities", horizon: true }
  };

  var inr = function (n) { return Math.round(n).toLocaleString("en-IN"); };
  var pct = function (n) { return (n > 0 ? "+" : "") + Number(n).toFixed(1) + "%"; };
  var $ = function (id) { return document.getElementById(id); };

  function mk(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  // First row of a rendered ranking table: name and return
  function topRow(bodyId) {
    var row = document.querySelector("#" + bodyId + " tr");
    if (!row || !row.cells || row.cells.length < 3) return null;
    var nameEl = row.querySelector(".name-col strong, .name-col .fund-name, .name-col .stock-sym, .name-col b") || row.querySelector(".name-col");
    var name = nameEl ? nameEl.textContent.trim().split("\n")[0] : "";
    var ret = row.cells[row.cells.length - 1].textContent.trim();
    return name ? { name: name, ret: ret } : null;
  }

  function tiles() {
    var n50 = idx.NIFTY50 || {};
    var mf = topRow("mfTableBody"), eq = topRow("equityTableBody");
    var count = function (id, fb) { var e = $(id); return (e && e.textContent.replace(/^[^A-Za-z0-9]+/, "").trim()) || fb; };
    return [
      { key: "macro", icon: "🏛️", title: "Inflation & rates",
        big: { value: macro.cpiInflation + "%", note: "retail inflation (CPI)" },
        stats: [["RBI repo rate", macro.rbiRepo + "%"], ["SBI 1-yr FD", macro.sbiFd1Yr + "%"], ["EPF", macro.epfRate + "%"], ["PPF", macro.ppfRate + "%"]] },
      { key: "realestate", icon: "🏡", title: "Real estate",
        big: { value: nat.carpet_price_sqft ? "₹" + inr(nat.carpet_price_sqft) : "50 cities", note: nat.carpet_price_sqft ? "per sq ft, 50-city average" : "" },
        stats: [["Price change, 1 yr", nat.hpi_yoy_pct != null ? pct(nat.hpi_yoy_pct) : "—"], ["5-yr growth a year", nat.hpi_cagr_5y != null ? nat.hpi_cagr_5y.toFixed(1) + "%" : "—"]] },
      { key: "metals", icon: "🪙", title: "Gold & silver",
        big: { value: metals.gold24kPerGram ? "₹" + inr(metals.gold24kPerGram) : "—", note: "gold 24K per gram", delta: metals.goldRet1y },
        stats: [["Silver per gram", metals.silverPerGram ? "₹" + inr(metals.silverPerGram) : "—"], ["Gold, last 1 yr", metals.goldRet1y != null ? pct(metals.goldRet1y) : "—"]] },
      { key: "indices", icon: "📊", title: "Market indices",
        big: { value: n50.level ? inr(n50.level) : "—", note: "Nifty 50", delta: n50.ret1y },
        stats: [["Valuation (P/E)", n50.pe != null ? String(n50.pe) : "—"], ["Last 1 yr", n50.ret1y != null ? pct(n50.ret1y) : "—"]] },
      { key: "mf", icon: "🌱", title: "Mutual funds",
        big: { value: count("mfCountBadge", "Top funds").replace(/ Direct.*/, ""), note: "direct plans screened" },
        stats: mf ? [["Top performer", mf.name], ["Return", mf.ret]] : [["See", "top funds by return"]] },
      { key: "equities", icon: "📈", title: "Stocks",
        big: { value: count("equityCountBadge", "Top stocks").replace(/ Nifty.*/, ""), note: "Nifty 500 leaders" },
        stats: eq ? [["Top performer", eq.name], ["Return", eq.ret]] : [["See", "top stocks by return"]] }
    ];
  }

  function drawTiles() {
    var host = $("dashTiles");
    if (!host) return;
    host.textContent = "";
    tiles().forEach(function (t) {
      var b = mk("button", "dash-tile");
      b.type = "button";
      b.setAttribute("data-open", t.key);
      var head = mk("div", "dt-head");
      head.append(mk("span", "dt-title", t.icon + "  " + t.title), mk("span", "dt-open", "Open →"));
      var big = mk("div", "dt-big");
      big.appendChild(mk("strong", null, t.big.value));
      if (t.big.delta != null) big.appendChild(mk("span", "dt-delta " + (t.big.delta >= 0 ? "up" : "down"), pct(t.big.delta)));
      if (t.big.note) big.appendChild(mk("small", null, t.big.note));
      var dl = mk("dl", "dt-stats");
      t.stats.forEach(function (s) {
        var d = mk("div");
        d.append(mk("dt", null, s[0]), mk("dd", null, s[1]));
        dl.appendChild(d);
      });
      b.append(head, big, dl);
      b.addEventListener("click", function () { show(t.key, true); });
      host.appendChild(b);
    });
  }

  function show(key, scrollTop) {
    if (!PANELS[key]) key = "overview";
    Object.keys(PANELS).forEach(function (k) {
      var e = $(PANELS[k].el);
      if (e) e.hidden = k !== key;
    });
    document.querySelectorAll(".sec-nav-link").forEach(function (a) {
      var on = a.getAttribute("data-sec") === key;
      a.classList.toggle("active", on);
      if (on) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
      if (on && window.innerWidth <= 768) a.scrollIntoView({ block: "nearest", inline: "nearest" });
    });
    var bar = document.querySelector(".horizon-toolbar");
    if (bar) bar.hidden = !PANELS[key].horizon;
    try { history.replaceState(null, "", key === "overview" ? location.pathname : "#section-" + key); } catch (e) { /* ignore */ }
    if (scrollTop) {
      var nav = $("sectionNavToolbar");
      var top = nav ? nav.getBoundingClientRect().top + window.scrollY - 66 : 0;
      if (window.scrollY > top) window.scrollTo({ top: Math.max(0, top), behavior: "auto" });
    }
  }

  function keyFromHash() {
    var h = (location.hash || "").replace("#", "");
    var k = h.replace("section-", "");
    return PANELS[k] && k !== "overview" ? k : "overview";
  }

  function init() {
    drawTiles();
    document.querySelectorAll(".sec-nav-link").forEach(function (a) {
      a.addEventListener("click", function (e) {
        e.preventDefault();
        show(a.getAttribute("data-sec"), true);
      });
    });
    window.addEventListener("hashchange", function () { show(keyFromHash(), false); });
    show(keyFromHash(), false);
    // The ranking tables and counts are drawn a moment after load; refresh the tiles that read them
    [900, 2500].forEach(function (ms) { setTimeout(drawTiles, ms); });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
