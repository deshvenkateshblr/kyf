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

  function shareBtn(section) {
    var b = mk("button", "dash-share", "Share");
    b.type = "button";
    b.setAttribute("data-share", section);
    b.setAttribute("aria-label", "Share this card");
    b.addEventListener("click", function (e) {
      e.stopPropagation();
      if (window.KYF_MARKET_VIEW && window.KYF_MARKET_VIEW.share) window.KYF_MARKET_VIEW.share(section);
    });
    return b;
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
    if (shareKey) nav.appendChild(shareBtn(shareKey));
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
    acts.append(shareBtn(key), mk("span", "dt-open", "Open →"));
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
    var c = card("Returns at a glance", [["indices", "Indices"], ["metals", "Gold & silver"]], "indices");
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
    var c = card(isFund ? "Best mutual funds" : "Best stocks", [[isFund ? "mf" : "equities", isFund ? "All funds" : "All stocks"]], isFund ? "mf" : "equities");
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
