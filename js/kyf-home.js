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

  // "Also in KYF": the supporting tools, one line each. The main path is the four steps above.
  function renderTools() {
    var host = document.getElementById("alsoTools");
    var cat = window.KYF_FEATURES;
    if (!host || !cat) return;
    ["learn", "market", "loans", "realestate"].forEach(function (id) {
      var f = cat.features.filter(function (x) { return x.id === id; })[0];
      if (!f) return;
      var a = el("a", "also-link");
      a.href = f.href;
      a.setAttribute("data-feature", f.id);
      a.appendChild(el("span", "tool-icon", f.icon));
      var txt = el("span", "also-text");
      txt.appendChild(el("strong", null, f.name));
      txt.appendChild(el("small", null, f.benefit || f.tagline));
      a.appendChild(txt);
      host.appendChild(a);
    });
  }

  renderTools();

  // Your plan: three steps with progress. The main buttons always point at the next step.
  if (window.KYF_JOURNEY) {
    window.KYF_JOURNEY.mount("#journeyStrip").then(function (model) {
      // New visitors read the four steps below; the progress strip is for people who have started
      var strip = document.getElementById("journeyStrip");
      if (strip && model && model.overall === 0) strip.textContent = "";
      if (!model || !model.next) return;
      ["heroStart", "navStart", "stepsStart"].forEach(function (id) {
        var a = document.getElementById(id);
        if (a) a.href = model.next.href;
      });
      var hero = document.getElementById("heroStart");
      if (hero && model.overall > 0) hero.textContent = "Continue \u2192";
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
