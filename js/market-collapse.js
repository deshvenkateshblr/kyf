/**
 * Market Benchmarks: every section opens and closes (js/market-collapse.js).
 * Sections start closed, each with a one-line headline, so the page can be read at a glance
 * and a person opens only what they care about. The sums and tables are drawn by market-performance.js.
 */
(function () {
  "use strict";

  var P = window.KYF_MARKET_PULSE || {};
  var macro = P.macro || {};
  var metals = P.preciousMetals || {};
  var idx = P.indices || {};
  var inr = function (n) { return Math.round(n).toLocaleString("en-IN"); };

  function badge(id, fallback) {
    var e = document.getElementById(id);
    return (e && e.textContent.replace(/^[^A-Za-z0-9]+/, "").trim()) || fallback;
  }

  var SECTIONS = [
    { id: "section-macro", card: ".macro-strip-card", head: ".macro-strip-header",
      line: function () { return "Inflation " + macro.cpiInflation + "% · Repo " + macro.rbiRepo + "% · EPF " + macro.epfRate + "% · PPF " + macro.ppfRate + "% · SBI FD " + macro.sbiFd1Yr + "%"; } },
    { id: "section-realestate", card: ".re-card", head: ".re-strip-header",
      line: function () { return "Housing prices in 50 Indian cities, from the National Housing Bank"; } },
    { id: "section-metals", head: ".section-header", horizon: true,
      line: function () { return metals.gold24kPerGram ? "Gold 24K ₹" + inr(metals.gold24kPerGram) + " per gram · Silver ₹" + inr(metals.silverPerGram) + " per gram" : "Gold and silver prices and returns"; } },
    { id: "section-indices", head: ".section-header", horizon: true,
      line: function () { var n = idx.NIFTY50; return n ? "Nifty 50 at " + inr(n.level) + " · P/E " + n.pe : "Index levels, P/E and returns"; } },
    { id: "section-mf", head: ".section-header", horizon: true,
      line: function () { return "Top direct-plan funds by return · " + badge("mfCountBadge", "all SEBI categories"); } },
    { id: "section-equities", head: ".section-header", horizon: true,
      line: function () { return "Top stocks by return · " + badge("equityCountBadge", "all listed stocks"); } }
  ];

  var built = [];

  function setOpen(item, open) {
    item.open = open;
    item.body.hidden = !open;
    item.summary.hidden = open;
    item.btn.setAttribute("aria-expanded", open ? "true" : "false");
    item.btn.textContent = open ? "Hide ▴" : "Show ▾";
    item.section.classList.toggle("mk-open", open);
    syncChrome();
  }

  function syncChrome() {
    var anyHorizon = built.some(function (i) { return i.open && i.horizon; });
    var bar = document.querySelector(".horizon-toolbar");
    if (bar) bar.hidden = !anyHorizon;
    var all = document.getElementById("mkAllBtn");
    if (all) all.textContent = built.every(function (i) { return i.open; }) ? "Collapse all" : "Expand all";
  }

  function build(def) {
    var section = document.getElementById(def.id);
    if (!section) return;
    var card = def.card ? section.querySelector(def.card) : section;
    var head = card && card.querySelector(def.head);
    if (!head) return;

    var body = document.createElement("div");
    body.className = "mk-body";
    body.id = def.id + "-body";
    var after = [];
    for (var n = head.nextSibling; n; n = n.nextSibling) after.push(n);
    after.forEach(function (n) { body.appendChild(n); });

    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "mk-toggle";
    btn.setAttribute("aria-controls", body.id);
    head.appendChild(btn);

    var summary = document.createElement("p");
    summary.className = "mk-summary";
    summary.textContent = def.line();

    head.parentNode.insertBefore(summary, head.nextSibling);
    head.parentNode.insertBefore(body, summary.nextSibling);
    head.classList.add("mk-head");

    var item = { section: section, body: body, summary: summary, btn: btn, horizon: !!def.horizon, open: false, def: def };
    built.push(item);
    btn.addEventListener("click", function () { setOpen(item, !item.open); });
    head.addEventListener("click", function (e) {
      if (e.target.closest("button, a, select, input")) return;
      setOpen(item, !item.open);
    });
    setOpen(item, false);
  }

  function openById(id) {
    var item = built.filter(function (i) { return i.section.id === id; })[0];
    if (item && !item.open) setOpen(item, true);
    return item;
  }

  function init() {
    SECTIONS.forEach(build);
    if (!built.length) return;

    var bar = document.createElement("div");
    bar.className = "wrap mk-bar";
    var hint = document.createElement("span");
    hint.textContent = "Each section opens with a tap. Start with the headlines.";
    var all = document.createElement("button");
    all.type = "button";
    all.id = "mkAllBtn";
    all.className = "mk-all";
    all.addEventListener("click", function () {
      var open = !built.every(function (i) { return i.open; });
      built.forEach(function (i) { setOpen(i, open); });
    });
    bar.append(hint, all);
    var nav = document.getElementById("sectionNavToolbar");
    if (nav && nav.parentNode) nav.parentNode.insertBefore(bar, nav.nextSibling);
    syncChrome();

    // Jump links open the section they point to
    document.querySelectorAll(".sec-nav-link").forEach(function (a) {
      a.addEventListener("click", function () {
        var item = openById((a.getAttribute("href") || "").replace("#", ""));
        if (item) setTimeout(function () { item.section.scrollIntoView({ behavior: "smooth", block: "start" }); }, 30);
      });
    });
    if (location.hash) openById(location.hash.slice(1));

    // Headlines that read counts drawn after load
    setTimeout(function () { built.forEach(function (i) { i.summary.textContent = i.def.line(); }); }, 1200);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
