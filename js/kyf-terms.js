/**
 * KYF term tips (`js/kyf-terms.js`)
 * Puts a small "?" after the first mention of each finance term on a page (list in data/kyf-terms.js).
 * Tap or click the "?" for a plain-language tip. A footer switch turns the tips off.
 *
 * Rules that keep pages calm:
 *  - one "?" per term per region (the page body, and separately each open drawer)
 *  - never inside buttons, links, headings, table headers, labels, form fields or summaries
 *  - re-checks itself when the page re-renders (goals, holdings and drawers are drawn by script)
 */
(function () {
  "use strict";

  var STORE_KEY = "kyf_learn_tips";
  var SKIP = "script,style,noscript,textarea,input,select,option,button,a,summary,label," +
    "h1,h2,h3,h4,h5,h6,th,nav,header,footer,code,pre,svg,canvas,[contenteditable]," +
    "[data-no-terms],.kyf-term,.kyf-tip,[aria-hidden='true']";

  var matchers = null;
  var tagged = {};            // regionKey|termId -> the "?" button currently in the page
  var observer = null;
  var timer = null;
  var scanning = false;
  var tip = null;
  var openBtn = null;

  function enabled() {
    try { return localStorage.getItem(STORE_KEY) !== "off"; } catch (e) { return true; }
  }

  function setEnabled(on) {
    try { localStorage.setItem(STORE_KEY, on ? "on" : "off"); } catch (e) { /* storage blocked: session only */ }
    memoryOff = !on;
    if (on) { scheduleScan(0); } else { closeTip(); removeAll(); }
    updateSwitch();
  }
  var memoryOff = false;
  function isOn() { return enabled() && !memoryOff; }

  function escapeRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

  function buildMatchers() {
    var terms = (window.KYF_TERMS && window.KYF_TERMS.terms) || [];
    matchers = terms.map(function (t) {
      var res = [];
      function add(list, flags) {
        if (!list || !list.length) return;
        var alts = list.slice().sort(function (a, b) { return b.length - a.length; }).map(escapeRe).join("|");
        res.push(new RegExp("(^|[^A-Za-z0-9])(" + alts + ")(?![A-Za-z0-9])", flags));
      }
      add(t.exact, "");
      add(t.words, "i");
      return { term: t, res: res };
    });
  }

  function regionOf(node) {
    var d = node.closest ? node.closest(".drawer-overlay") : null;
    return d ? (d.id || "drawer") : "page";
  }

  function isTagged(key) {
    var b = tagged[key];
    if (b && b.isConnected) return true;
    delete tagged[key];
    return false;
  }

  /** Earliest match in `text` for any term not yet tagged in this region. */
  function findMatch(text, region) {
    var best = null;
    for (var i = 0; i < matchers.length; i++) {
      var m = matchers[i];
      if (isTagged(region + "|" + m.term.id)) continue;
      for (var j = 0; j < m.res.length; j++) {
        var r = m.res[j];
        r.lastIndex = 0;
        var hit = r.exec(text);
        if (!hit) continue;
        var start = hit.index + hit[1].length;
        if (!best || start < best.start) best = { term: m.term, start: start, len: hit[2].length };
      }
    }
    return best;
  }

  function makeButton(term) {
    var b = document.createElement("button");
    b.type = "button";
    b.className = "kyf-term";
    b.textContent = "?";
    b.setAttribute("data-term", term.id);
    b.setAttribute("aria-label", "What does " + term.term + " mean?");
    b.setAttribute("aria-expanded", "false");
    return b;
  }

  function scanText(textNode) {
    var parent = textNode.parentElement;
    if (!parent || parent.closest(SKIP)) return;
    if (!parent.getClientRects().length) return;          // hidden (closed drawer, collapsed row)
    var region = regionOf(parent);
    var node = textNode;
    for (var guard = 0; guard < 6; guard++) {
      var hit = findMatch(node.nodeValue, region);
      if (!hit) return;
      var after = node.splitText(hit.start + hit.len);    // node keeps text up to the end of the word
      var btn = makeButton(hit.term);
      node.parentNode.insertBefore(btn, after);
      tagged[region + "|" + hit.term.id] = btn;
      node = after;
      if (!node.nodeValue) return;
    }
  }

  function scan() {
    if (!isOn() || !window.KYF_TERMS) return;
    if (!matchers) buildMatchers();
    var root = document.querySelector("main") || document.body;
    var overlays = document.querySelectorAll(".drawer-overlay.open");
    var roots = [root];
    overlays.forEach(function (o) { roots.push(o); });
    scanning = true;
    try {
      roots.forEach(function (r) {
        var walker = document.createTreeWalker(r, NodeFilter.SHOW_TEXT, null);
        var nodes = [];
        var n;
        while ((n = walker.nextNode())) { if (n.nodeValue.trim().length > 2) nodes.push(n); }
        nodes.forEach(scanText);
      });
    } finally {
      scanning = false;
      if (observer) observer.takeRecords();               // ignore our own edits
    }
  }

  function scheduleScan(delay) {
    clearTimeout(timer);
    timer = setTimeout(scan, delay == null ? 250 : delay);
  }

  function removeAll() {
    document.querySelectorAll("button.kyf-term").forEach(function (b) {
      var p = b.parentNode;
      b.remove();
      if (p && p.normalize) p.normalize();
    });
    tagged = {};
  }

  /* ---------- tip popover ---------- */
  function ensureTip() {
    if (tip) return tip;
    tip = document.createElement("div");
    tip.className = "kyf-tip";
    tip.id = "kyf-tip";
    tip.setAttribute("role", "dialog");
    tip.setAttribute("aria-label", "Term meaning");
    tip.hidden = true;
    var title = document.createElement("strong");
    title.className = "kyf-tip-title";
    var body = document.createElement("p");
    body.className = "kyf-tip-body";
    var more = document.createElement("a");
    more.className = "kyf-tip-more";
    more.textContent = "Learn more →";
    more.hidden = true;
    var off = document.createElement("button");
    off.type = "button";
    off.className = "kyf-tip-off";
    off.textContent = "Hide these tips";
    off.addEventListener("click", function () { setEnabled(false); });
    tip.appendChild(title);
    tip.appendChild(body);
    tip.appendChild(more);
    tip.appendChild(off);
    document.body.appendChild(tip);
    return tip;
  }

  function findTerm(id) {
    var list = (window.KYF_TERMS && window.KYF_TERMS.terms) || [];
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }

  function openTip(btn) {
    var t = findTerm(btn.getAttribute("data-term"));
    if (!t) return;
    var el = ensureTip();
    el.querySelector(".kyf-tip-title").textContent = t.term;
    el.querySelector(".kyf-tip-body").textContent = t.tip;
    var more = el.querySelector(".kyf-tip-more");
    var page = window.KYF_TERMS.topicPage;
    if (page) { more.href = page + "?term=" + encodeURIComponent(t.id); more.hidden = false; } else { more.hidden = true; }
    el.hidden = false;
    if (openBtn && openBtn !== btn) openBtn.setAttribute("aria-expanded", "false");
    openBtn = btn;
    btn.setAttribute("aria-expanded", "true");
    btn.setAttribute("aria-controls", "kyf-tip");
    placeTip();
  }

  function placeTip() {
    if (!tip || tip.hidden || !openBtn) return;
    var r = openBtn.getBoundingClientRect();
    var w = Math.min(320, window.innerWidth - 24);
    tip.style.width = w + "px";
    var left = Math.max(12, Math.min(r.left + r.width / 2 - w / 2, window.innerWidth - w - 12));
    var h = tip.offsetHeight;
    var top = r.bottom + 8;
    if (top + h > window.innerHeight - 12 && r.top - h - 8 > 12) top = r.top - h - 8;
    tip.style.left = left + "px";
    tip.style.top = Math.max(12, top) + "px";
  }

  function closeTip() {
    if (tip) tip.hidden = true;
    if (openBtn) { openBtn.setAttribute("aria-expanded", "false"); openBtn = null; }
  }

  /* ---------- footer switch ---------- */
  function updateSwitch() {
    var sw = document.getElementById("kyf-tips-switch");
    if (sw) {
      sw.textContent = isOn() ? "? Tips on" : "? Tips off";
      sw.setAttribute("aria-pressed", isOn() ? "true" : "false");
    }
  }

  function ensureSwitch() {
    if (document.getElementById("kyf-tips-switch")) return;
    var meta = document.querySelector("#kyf-footer .kyf-footer-meta");
    if (!meta) return;
    var sw = document.createElement("button");
    sw.type = "button";
    sw.id = "kyf-tips-switch";
    sw.className = "kyf-footer-switch";
    sw.title = "Show or hide the ? tips next to finance terms";
    sw.addEventListener("click", function () { setEnabled(!isOn()); });
    meta.insertBefore(sw, meta.firstChild);
    updateSwitch();
  }

  function addStylesheet() {
    if (document.getElementById("kyf-terms-css")) return;
    var link = document.createElement("link");
    link.id = "kyf-terms-css";
    link.rel = "stylesheet";
    link.href = "css/kyf-terms.css?v=" + (window.KYF_APP_VERSION || "");
    document.head.appendChild(link);
  }

  function init() {
    addStylesheet();
    document.addEventListener("click", function (e) {
      var b = e.target.closest ? e.target.closest("button.kyf-term") : null;
      if (b) {
        e.preventDefault();
        e.stopPropagation();
        if (openBtn === b && tip && !tip.hidden) closeTip(); else openTip(b);
        return;
      }
      if (tip && !tip.hidden && !(e.target.closest && e.target.closest(".kyf-tip"))) closeTip();
      scheduleScan(400);                                   // expanding a row or opening a drawer reveals new text
    }, true);
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeTip(); });
    document.addEventListener("toggle", function () { scheduleScan(100); }, true);
    window.addEventListener("resize", placeTip);
    window.addEventListener("scroll", function () {
      if (!tip || tip.hidden || !openBtn) return;
      var r = openBtn.getBoundingClientRect();
      if (r.bottom < 0 || r.top > window.innerHeight) closeTip(); else placeTip();   // tip follows its "?"
    }, true);

    observer = new MutationObserver(function () { if (!scanning) scheduleScan(); });
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });

    ensureSwitch();
    setTimeout(ensureSwitch, 600);
    scheduleScan(300);
  }

  window.KYF_TERMS_UI = { scan: scan, enable: function () { setEnabled(true); }, disable: function () { setEnabled(false); }, isOn: isOn };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
