/**
 * Shared top navigation (`js/kyf-nav.js`)
 * - One canonical menu on every page (page-local link lists had drifted apart).
 * - On phones the inline links are hidden by page CSS, so this adds a ☰ button that opens a menu panel.
 * Styles live in css/kyf-nav.css (injected here so no page needs editing beyond the script tag).
 */
(function () {
  "use strict";

  var VERSION = (window.KYF_APP_VERSION) || "";
  var FALLBACK = [
    { href: "index.html", name: "Home", icon: "🏠" },
    { href: "goals.html", name: "Goals", icon: "🎯", tagline: "What are you saving for?" },
    { href: "cadence.html", name: "Cadence", icon: "🗓️", tagline: "Money habits and goal steps" },
    { href: "portfolio.html", name: "Portfolio", icon: "💼", tagline: "Everything you own and owe" },
    { href: "market-performance.html", name: "Market Benchmarks", icon: "📊", tagline: "Where markets stand" }
  ];
  var CATALOG = window.KYF_FEATURES;
  var MENU = (CATALOG ? CATALOG.menu() : FALLBACK).map(function (m) {
    return { href: m.href, label: m.name, icon: m.icon, desc: m.tagline || "", topBar: !!m.topBar };
  });

  function pageName() {
    var p = (location.pathname.split("/").pop() || "index.html").toLowerCase();
    return p === "" ? "index.html" : p;
  }

  function isCurrent(item) {
    return item.href.toLowerCase() === pageName();
  }

  function loadCss() {
    if (document.getElementById("kyf-nav-css")) return;
    var link = document.createElement("link");
    link.id = "kyf-nav-css";
    link.rel = "stylesheet";
    link.href = "css/kyf-nav.css" + (VERSION ? "?v=" + VERSION : "");
    document.head.appendChild(link);
  }

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text) n.textContent = text;
    return n;
  }

  function normaliseDesktopLinks(nav) {
    // Index keeps its own marketing nav (with the Framework dropdown); inner pages get the shared set.
    if (pageName() === "index.html") return;
    var anchors = nav.querySelectorAll(":scope > a");
    var first = anchors[0];
    var fragment = document.createDocumentFragment();
    MENU.filter(function (m) { return m.topBar; }).forEach(function (m) {
      var a = el("a", isCurrent(m) ? "active" : "", m.label);
      a.href = m.href;
      if (isCurrent(m)) a.setAttribute("aria-current", "page");
      fragment.appendChild(a);
    });
    anchors.forEach(function (a) { a.remove(); });
    nav.insertBefore(fragment, nav.firstChild);
    void first;
  }

  function build() {
    var header = document.querySelector("header.nav");
    var inner = header && header.querySelector(".nav-inner");
    if (!header || !inner || document.getElementById("kyfMenuBtn")) return;
    loadCss();

    var nav = inner.querySelector(".nav-links");
    if (nav) normaliseDesktopLinks(nav);

    var btn = el("button", "kyf-menu-btn");
    btn.type = "button";
    btn.id = "kyfMenuBtn";
    btn.setAttribute("aria-label", "Open menu");
    btn.setAttribute("aria-expanded", "false");
    btn.setAttribute("aria-controls", "kyfMenuPanel");
    btn.innerHTML = '<span class="kyf-menu-bars" aria-hidden="true"></span>';
    inner.appendChild(btn);

    var panel = el("nav", "kyf-menu-panel");
    panel.id = "kyfMenuPanel";
    panel.setAttribute("aria-label", "Site menu");
    panel.hidden = true;
    MENU.forEach(function (m) {
      var a = el("a", "kyf-menu-item" + (isCurrent(m) ? " current" : ""));
      a.href = m.href;
      if (isCurrent(m)) a.setAttribute("aria-current", "page");
      a.appendChild(el("span", "kyf-menu-icon", m.icon));
      var text = el("span", "kyf-menu-text");
      text.appendChild(el("span", "kyf-menu-label", m.label));
      if (m.desc) text.appendChild(el("span", "kyf-menu-desc", m.desc));
      a.appendChild(text);
      panel.appendChild(a);
    });
    // Phones hide the header's Open button, so offer it here (same handler, no duplicate logic)
    var openBtn = document.getElementById("navOpenFileBtn");
    if (openBtn) {
      var file = el("a", "kyf-menu-item kyf-menu-file");
      file.href = "#";
      file.appendChild(el("span", "kyf-menu-icon", "📂"));
      var ft = el("span", "kyf-menu-text");
      ft.appendChild(el("span", "kyf-menu-label", "Open a saved file"));
      ft.appendChild(el("span", "kyf-menu-desc", "Load your .kyf data"));
      file.appendChild(ft);
      file.addEventListener("click", function (e) { e.preventDefault(); openBtn.click(); });
      panel.appendChild(file);
    }
    header.appendChild(panel);

    function setOpen(open) {
      panel.hidden = !open;
      btn.setAttribute("aria-expanded", String(open));
      btn.setAttribute("aria-label", open ? "Close menu" : "Open menu");
      btn.classList.toggle("open", open);
    }
    btn.addEventListener("click", function () { setOpen(panel.hidden); });
    panel.addEventListener("click", function (e) { if (e.target.closest("a")) setOpen(false); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !panel.hidden) { setOpen(false); btn.focus(); } });
    document.addEventListener("click", function (e) { if (!panel.hidden && !header.contains(e.target)) setOpen(false); });
    window.addEventListener("resize", function () { if (window.innerWidth > 820) setOpen(false); });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", build);
  else build();
})();
