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

  var pct1 = function (n) { return (n > 0 ? "+" : "") + Number(n).toFixed(1) + "%"; };
  var tone = function (n) { return n == null || isNaN(n) ? "" : n >= 0 ? " up" : " down"; };

  // Same Share button as every detail section; it shares what the card shows (all periods together)
  function shareBtn(spec) {
    var b = mk("button", "section-share-btn dash-share");
    b.type = "button";
    b.setAttribute("aria-label", "Share this summary");
    b.title = "Share on X / Social";
    var svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("width", "12"); svg.setAttribute("height", "12"); svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("fill", "none"); svg.setAttribute("stroke", "currentColor"); svg.setAttribute("stroke-width", "2.2");
    svg.setAttribute("stroke-linecap", "round"); svg.setAttribute("stroke-linejoin", "round");
    [["circle", { cx: 18, cy: 5, r: 3 }], ["circle", { cx: 6, cy: 12, r: 3 }], ["circle", { cx: 18, cy: 19, r: 3 }],
     ["line", { x1: 8.59, y1: 13.51, x2: 15.42, y2: 17.49 }], ["line", { x1: 15.41, y1: 6.51, x2: 8.59, y2: 10.49 }]].forEach(function (s) {
      var n = document.createElementNS("http://www.w3.org/2000/svg", s[0]);
      Object.keys(s[1]).forEach(function (k) { n.setAttribute(k, s[1][k]); });
      svg.appendChild(n);
    });
    b.append(svg, mk("span", null, "Share"));
    b.addEventListener("click", function (e) {
      e.stopPropagation();
      var v = window.KYF_MARKET_VIEW;
      if (!v || !v.shareSummary) return;
      var s = typeof spec === "function" ? spec() : spec;
      s.text = s.rows.map(function (r) {
        if (s.aligns) return "• " + r[0].t + ": " + r[1].t + " (" + r[2].t + ")";
        return "• " + r[0].t + ": " + r.slice(1).map(function (c, i) { return (s.columns.length > 2 ? s.columns[i + 1] + " " : "") + c.t; }).join(", ");
      }).join("\n");
      v.shareSummary(s);
    });
    return b;
  }

  var cell = function (t, n) { return { t: t, tone: n == null || isNaN(n) ? null : n >= 0 ? "up" : "down" }; };
  var plain = function (t) { return { t: t }; };
  var fmt = function (n) { return n == null || isNaN(n) ? "—" : pct1(n); };

  var SPECS = {
    macro: function () {
      return { key: "macro", title: "Inflation & interest rates", subtitle: "Key rates in India today",
        columns: ["Benchmark", "Rate"],
        rows: [["Retail inflation (CPI)", macro.cpiInflation], ["RBI repo rate", macro.rbiRepo], ["SBI 1-year FD", macro.sbiFd1Yr], ["EPF", macro.epfRate], ["PPF", macro.ppfRate]].map(function (r) { return [plain(r[0]), plain(r[1] + "%")]; }),
        footnote: "Rates are per year." };
    },
    realestate: function () {
      return { key: "realestate", title: "Real estate: 50-city average", subtitle: "National Housing Bank housing price index",
        columns: ["Measure", "Value"],
        rows: [[plain("Price per sq ft"), plain(nat.carpet_price_sqft ? "₹" + inr(nat.carpet_price_sqft) : "—")], [plain("Price change, 1 year"), cell(fmt(nat.hpi_yoy_pct), nat.hpi_yoy_pct)], [plain("Growth over 5 years, per year"), cell(nat.hpi_cagr_5y != null ? nat.hpi_cagr_5y.toFixed(1) + "%" : "—", nat.hpi_cagr_5y)]],
        footnote: "Average across 50 cities. Your city may differ." };
    },
    metals: function () {
      return { key: "metals", title: "Gold & silver", subtitle: "Price per gram and returns over each period",
        columns: ["Metal", "Per gram", "1 month", "3 months", "6 months", "1 year"],
        rows: [
          [plain("Gold 24K"), plain(metals.gold24kPerGram ? "₹" + inr(metals.gold24kPerGram) : "—"), cell(fmt(metals.goldRet1m), metals.goldRet1m), cell(fmt(metals.goldRet3m), metals.goldRet3m), cell(fmt(metals.goldRet6m), metals.goldRet6m), cell(fmt(metals.goldRet1y), metals.goldRet1y)],
          [plain("Silver"), plain(metals.silverPerGram ? "₹" + inr(metals.silverPerGram) : "—"), cell(fmt(metals.silverRet1m), metals.silverRet1m), cell(fmt(metals.silverRet3m), metals.silverRet3m), cell(fmt(metals.silverRet6m), metals.silverRet6m), cell(fmt(metals.silverRet1y), metals.silverRet1y)]],
        footnote: "Returns via gold and silver ETFs." };
    },
    returns: function () {
      var rows = [];
      Object.keys(idx).forEach(function (k) {
        var i = idx[k]; if (!i) return;
        var y1 = i.ret1y != null ? i.ret1y : i.cagr1y;
        rows.push([plain(i.name), cell(fmt(i.ret1m), i.ret1m), cell(fmt(i.ret3m), i.ret3m), cell(fmt(i.ret6m), i.ret6m), cell(fmt(y1), y1), cell(fmt(i.cagr5y), i.cagr5y), plain(i.pe != null ? Number(i.pe).toFixed(1) : "—")]);
      });
      return { key: "indices", title: "Returns at a glance", subtitle: "Indian market indices over each period",
        columns: ["Index", "1 month", "3 months", "6 months", "1 year", "5 yrs, per yr", "P/E"], rows: rows,
        footnote: "Past returns are not a promise." };
    },
    funds: function () { return topsSpec("fund"); },
    stocks: function () { return topsSpec("stock"); }
  };

  function topsSpec(kind) {
    var isFund = kind === "fund", v = window.KYF_MARKET_VIEW;
    var rows = [["1m", "1 month"], ["3m", "3 months"], ["6m", "6 months"], ["1y", "1 year"]].map(function (hz) {
      var r = v ? v.tops(hz[0]) : {};
      var p = isFund ? r.fund : r.stock;
      return [plain(hz[1]), plain(p ? (isFund ? p.name : p.symbol + " · " + (p.name || "")) : "—"), cell(p ? fmt(p.ret) : "—", p ? p.ret : null)];
    });
    return { key: isFund ? "mf" : "equities", title: isFund ? "Best mutual funds" : "Best stocks", subtitle: isFund ? "Top direct-plan fund over each period" : "Top Nifty 500 stock over each period",
      columns: ["Over the last", isFund ? "Fund" : "Stock", "Return"], aligns: ["left", "left", "right"], xs: [48, 250, 1152], rows: rows,
      footnote: isFund ? "Direct plans, all categories." : "Penny stocks and corporate-action distortions left out." };
  }

  function card(title, links, shareKey) {
    var c = mk("section", "dash-card");
    var head = mk("div", "dc-head");
    head.appendChild(mk("h2", null, title));
    var nav = mk("div", "dc-links");
    (links || []).forEach(function (l) {
      var b = mk("button", "dc-link", l[1] + " →");
      b.type = "button";
      b.setAttribute("data-open", l[0]);
      b.addEventListener("click", function () { show(l[0], true); });
      nav.appendChild(b);
    });
    if (shareKey) nav.appendChild(shareBtn(SPECS[shareKey]));
    head.appendChild(nav);
    c.appendChild(head);
    return c;
  }

  function tile(key, icon, title, bigValue, bigNote, bigDelta, stats) {
    var b = mk("div", "dash-tile");
    b.tabIndex = 0;
    b.setAttribute("role", "link");
    b.setAttribute("data-open", key);
    b.setAttribute("aria-label", "Open " + title);
    var head = mk("div", "dt-head");
    var acts = mk("span", "dt-acts");
    acts.append(shareBtn(SPECS[key]), mk("span", "dt-open", "Open →"));
    head.append(mk("span", "dt-title", icon + "  " + title), acts);
    var big = mk("div", "dt-big");
    big.appendChild(mk("strong", null, bigValue));
    if (bigDelta != null) big.appendChild(mk("span", "dt-delta" + tone(bigDelta), pct1(bigDelta)));
    if (bigNote) big.appendChild(mk("small", null, bigNote));
    var line = mk("p", "dt-inline");
    stats.forEach(function (s) {
      var sp = mk("span");
      sp.append(document.createTextNode(s[0] + " "), mk("b", null, s[1]));
      line.appendChild(sp);
    });
    b.append(head, big, line);
    b.addEventListener("click", function () { show(key, true); });
    b.addEventListener("keydown", function (e) { if (e.key === "Enter" && e.target === b) show(key, true); });
    return b;
  }

  // Returns at a glance: every benchmark across the same horizons, short to long
  function returnsCard() {
    var c = card("Returns at a glance", [["indices", "Indices"], ["metals", "Gold & silver"]], "returns");
    var wrap = mk("div", "table-wrap");
    var tb = mk("table", "dash-table");
    var th = mk("thead");
    var h = mk("tr");
    ["", "1 month", "3 months", "6 months", "1 year", "5 years, per year", "P/E"].forEach(function (x, i) { h.appendChild(mk("th", i ? "num" : "", x)); });
    th.append(h);
    var body = mk("tbody");
    var rows = [];
    Object.keys(idx).forEach(function (k) {
      var i = idx[k]; if (!i) return;
      rows.push([i.name, [i.ret1m, i.ret3m, i.ret6m, i.ret1y != null ? i.ret1y : i.cagr1y, i.cagr5y], i.pe]);
    });
    rows.push(["Gold", [metals.goldRet1m, metals.goldRet3m, metals.goldRet6m, metals.goldRet1y, null], null]);
    rows.push(["Silver", [metals.silverRet1m, metals.silverRet3m, metals.silverRet6m, metals.silverRet1y, null], null]);
    rows.forEach(function (r) {
      var tr = mk("tr");
      tr.appendChild(mk("th", "row", r[0]));
      r[1].forEach(function (v) { tr.appendChild(mk("td", "num" + tone(v), v == null || isNaN(v) ? "—" : pct1(v))); });
      tr.appendChild(mk("td", "num muted", r[2] != null ? Number(r[2]).toFixed(1) : "—"));
      body.appendChild(tr);
    });
    tb.append(th, body);
    wrap.appendChild(tb);
    c.appendChild(wrap);
    c.appendChild(mk("p", "dc-note", "Gains or losses over each period up to today. Past returns are not a promise."));
    return c;
  }

  // Best direct-plan funds and best Nifty 500 stocks, each in a card of its own so they are not confused
  function topsCard(kind) {
    var isFund = kind === "fund";
    var c = card(isFund ? "Best mutual funds" : "Best stocks", [[isFund ? "mf" : "equities", isFund ? "All funds" : "All stocks"]], isFund ? "funds" : "stocks");
    c.classList.add("tops-card");
    var view = window.KYF_MARKET_VIEW;
    var wrap = mk("div", "table-wrap");
    var tb = mk("table", "dash-table tops");
    var th = mk("thead"), h = mk("tr");
    ["Over the last", isFund ? "Fund" : "Stock", "Return"].forEach(function (x, i) { h.appendChild(mk("th", i === 2 ? "num" : "", x)); });
    th.appendChild(h);
    var body = mk("tbody");
    [["1m", "1 month"], ["3m", "3 months"], ["6m", "6 months"], ["1y", "1 year"]].forEach(function (hz) {
      var r = view ? view.tops(hz[0]) : { fund: null, stock: null };
      var pick = isFund ? r.fund : r.stock;
      var tr = mk("tr");
      tr.appendChild(mk("th", "row", hz[1]));
      var td = mk("td");
      if (pick) {
        td.appendChild(mk("span", "pick", isFund ? pick.name : pick.symbol));
        if (!isFund && pick.name) td.appendChild(mk("small", null, pick.name));
        if (isFund && pick.category) td.appendChild(mk("small", null, pick.category));
      } else td.textContent = "—";
      tr.appendChild(td);
      tr.appendChild(mk("td", "num" + tone(pick && pick.ret), pick ? pct1(pick.ret) : "—"));
      body.appendChild(tr);
    });
    tb.append(th, body);
    wrap.appendChild(tb);
    c.appendChild(wrap);
    c.appendChild(mk("p", "dc-note", isFund ? "Direct plans, all categories." : "Nifty 500 only. Penny stocks and corporate-action distortions left out."));
    return c;
  }

  function drawTiles() {
    var host = $("dashTiles");
    if (!host) return;
    host.textContent = "";
    var n50 = idx.NIFTY50 || {};
    var strip = mk("div", "dash-strip");
    strip.appendChild(tile("macro", "🏛️", "Inflation & rates", macro.cpiInflation + "%", "retail inflation",  null,
      [["Repo", macro.rbiRepo + "%"], ["SBI FD", macro.sbiFd1Yr + "%"], ["EPF", macro.epfRate + "%"], ["PPF", macro.ppfRate + "%"]]));
    strip.appendChild(tile("realestate", "🏡", "Real estate", nat.carpet_price_sqft ? "₹" + inr(nat.carpet_price_sqft) : "50 cities", nat.carpet_price_sqft ? "per sq ft" : "", null,
      [["1 year", nat.hpi_yoy_pct != null ? pct1(nat.hpi_yoy_pct) : "—"], ["5 years, per year", nat.hpi_cagr_5y != null ? nat.hpi_cagr_5y.toFixed(1) + "%" : "—"]]));
    strip.appendChild(tile("metals", "🪙", "Gold & silver", metals.gold24kPerGram ? "₹" + inr(metals.gold24kPerGram) : "—", "gold 24K per gram", metals.goldRet1y,
      [["Silver", metals.silverPerGram ? "₹" + inr(metals.silverPerGram) + "/g" : "—"], ["Silver 1 year", metals.silverRet1y != null ? pct1(metals.silverRet1y) : "—"]]));
    var rows = mk("div", "dash-rows");
    var two = mk("div", "dash-two");
    two.append(topsCard("fund"), topsCard("stock"));
    rows.append(returnsCard(), two);
    host.append(strip, rows);
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
    [600, 1800].forEach(function (ms) { setTimeout(drawTiles, ms); });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
