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

  renderTools();

  // Your plan: three steps with progress. The main buttons always point at the next step.
  if (window.KYF_JOURNEY) {
    window.KYF_JOURNEY.mount("#journeyStrip").then(function (model) {
      if (!model || !model.next) return;
      ["heroStart", "navStart"].forEach(function (id) {
        var a = document.getElementById(id);
        if (a) a.href = model.next.href;
      });
      var hero = document.getElementById("heroStart");
      if (hero && model.overall > 0) hero.textContent = "Continue your plan \u2192";
    });
  }

  // Overdue check-ins: one quiet line with a way in. Nothing at all when nothing is overdue.
  (function () {
    var note = document.getElementById("overdueNote");
    if (!note || !window.KYF_PATH || !window.KYF_PATH_DATA) return;
    var records = [];
    try { records = JSON.parse(localStorage.getItem("kyf_cadence_v3") || "[]"); } catch (e) { return; }
    var late = window.KYF_PATH.overdue(window.KYF_PATH_DATA, Array.isArray(records) ? records : []);
    if (!late.length) return;
    var names = late.slice(0, 2).map(function (i) { return i.title; }).join(", ");
    var more = late.length > 2 ? " and " + (late.length - 2) + " more" : "";
    note.appendChild(document.createTextNode(late.length + (late.length === 1 ? " thing needs" : " things need") + " a look: " + names + more + ". "));
    var a = document.createElement("a");
    a.href = "cadence.html";
    a.textContent = "Review them \u2192";
    note.appendChild(a);
    note.hidden = false;
  })();

  // Lets Open (top bar) restore a .kyf file from the home page
  if (window.KYF_VAULT && typeof window.KYF_VAULT.registerPageHook === "function") {
    window.KYF_VAULT.registerPageHook({
      pageName: "home",
      getLocalData: function () { return {}; },
      onAfterOpen: function () {}
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
