/**
 * Home page (`js/kyf-home.js`): tool cards from the feature catalog, a returning-visitor strip,
 * the walkthrough video and the scroll reveal. No data leaves the browser.
 */
(function () {
  "use strict";

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function readList(key) {
    try {
      var v = JSON.parse(localStorage.getItem(key) || "[]");
      return Array.isArray(v) ? v : [];
    } catch (e) { return []; }
  }

  function demoOn() {
    try { return localStorage.getItem("kyf_demo_mode") === "true"; } catch (e) { return false; }
  }

  function plural(n, one, many) { return n + " " + (n === 1 ? one : many); }

  function renderTools() {
    var host = document.getElementById("toolGroups");
    var cat = window.KYF_FEATURES;
    if (!host || !cat) return;
    cat.groups.forEach(function (g) {
      var list = cat.byGroup(g.id);
      if (!list.length) return;
      var group = el("section", "tool-group reveal");
      var head = el("div", "tool-group-head");
      head.appendChild(el("h3", null, g.label));
      head.appendChild(el("span", null, g.hint));
      group.appendChild(head);
      var grid = el("div", "tool-grid");
      list.forEach(function (f) {
        var card = el("article", "tool-card");
        card.setAttribute("data-feature", f.id);
        var top = el("div", "tool-top");
        top.appendChild(el("span", "tool-icon", f.icon));
        var names = el("div");
        names.appendChild(el("h4", null, f.name));
        names.appendChild(el("p", "tool-tag", f.tagline));
        top.appendChild(names);
        card.appendChild(top);
        var ul = el("ul", "tool-can");
        f.can.forEach(function (c) { ul.appendChild(el("li", null, c)); });
        card.appendChild(ul);
        var actions = el("div", "tool-actions");
        var main = el("a", "btn", f.cta + " \u2192");
        main.href = f.href;
        actions.appendChild(main);
        if (f.secondary) {
          var sec = el("a", "tool-secondary", f.secondary.label);
          sec.href = f.secondary.href;
          actions.appendChild(sec);
        }
        card.appendChild(actions);
        grid.appendChild(card);
      });
      group.appendChild(grid);
      host.appendChild(group);
    });
  }

  function renderWelcomeBack() {
    var host = document.getElementById("welcomeBack");
    if (!host || demoOn()) return;
    var goals = readList("kyf_user_goals").length;
    var holdings = readList("kyf_user_holdings").length;
    if (!goals && !holdings) return;
    var bits = [];
    if (goals) bits.push(plural(goals, "goal", "goals"));
    if (holdings) bits.push(plural(holdings, "holding", "holdings"));
    host.appendChild(el("p", null, "Welcome back. You have " + bits.join(" and ") + " saved in this browser."));
    var links = el("div", "wb-links");
    [["Goals", "goals.html"], ["Portfolio", "portfolio.html"], ["Cadence", "cadence.html"]].forEach(function (p) {
      var a = el("a", null, p[0] + " \u2192");
      a.href = p[1];
      links.appendChild(a);
    });
    host.appendChild(links);
    host.hidden = false;
  }

  renderTools();
  renderWelcomeBack();

  // Opening a .kyf file from the top bar refreshes the "Welcome back" counts
  if (window.KYF_VAULT && typeof window.KYF_VAULT.registerPageHook === "function") {
    window.KYF_VAULT.registerPageHook({
      pageName: "home",
      getLocalData: function () { return {}; },
      onAfterOpen: function () {
        var host = document.getElementById("welcomeBack");
        if (host) { host.textContent = ""; host.hidden = true; }
        renderWelcomeBack();
      }
    });
  }

// Walkthrough video: load only on click so no third-party request is made until the visitor asks.
(function () {
  var btn = document.getElementById('playBtn');
  var poster = document.getElementById('videoPoster');
  if (!btn || !poster) return;
  btn.addEventListener('click', function () {
    var f = document.createElement('iframe');
    f.title = 'Know Your Finance - Walkthrough Video';
    f.src = 'https://www.youtube-nocookie.com/embed/harhr3ju3DI?autoplay=1';
    f.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
    f.referrerPolicy = 'strict-origin-when-cross-origin';
    f.allowFullscreen = true;
    poster.innerHTML = '';
    poster.appendChild(f);
  });
})();

// Gentle reveal on scroll.
(function () {
  var els = document.querySelectorAll('.reveal');
  if (!('IntersectionObserver' in window)) { els.forEach(function (e) { e.classList.add('in'); }); return; }
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (en) {
      if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
    });
  }, { threshold: 0.12 });
  els.forEach(function (e, i) { e.style.transitionDelay = (i % 3) * 70 + 'ms'; io.observe(e); });
})();

})();
