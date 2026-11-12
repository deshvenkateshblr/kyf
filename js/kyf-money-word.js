/**
 * Money Word (`js/kyf-money-word.js`): a small floating card on the home page that introduces
 * one finance word at a time, in curriculum order (words come from data/kyf-terms.js).
 *
 * Buttons: "Next word" (moves on), "I know this" (never shown again), × (hide for this visit),
 * and "Don't show again". "Tell me more" appears only once KYF_TERMS.topicPage is set.
 * Everything stays in this browser (localStorage). Footer switch turns it back on.
 */
(function () {
  "use strict";

  var STORE = "kyf_money_word";
  var SESSION = "kyf_money_word_hidden";
  var DELAY_MS = 2500;
  var card = null;
  var current = null;

  function load() {
    var s = { known: [], seen: [], off: false, last: null };
    try {
      var raw = JSON.parse(localStorage.getItem(STORE) || "null");
      if (raw && typeof raw === "object") {
        s.known = Array.isArray(raw.known) ? raw.known : [];
        s.seen = Array.isArray(raw.seen) ? raw.seen : [];
        s.off = raw.off === true;
        s.last = raw.last || null;
      }
    } catch (e) { /* storage blocked: runs in memory */ }
    return s;
  }
  var state = load();

  function save() {
    try { localStorage.setItem(STORE, JSON.stringify(state)); } catch (e) { /* ignore */ }
  }
  function hiddenThisVisit() {
    try { return sessionStorage.getItem(SESSION) === "1"; } catch (e) { return false; }
  }
  function hideThisVisit() {
    try { sessionStorage.setItem(SESSION, "1"); } catch (e) { /* ignore */ }
  }

  function terms() {
    return (window.KYF_TERMS && window.KYF_TERMS.terms) || [];
  }

  // Resume where the person left off: the word after the last one shown, skipping known words.
  function pickNext(afterId) {
    var list = terms();
    if (!list.length) return null;
    var start = 0;
    if (afterId) {
      for (var i = 0; i < list.length; i++) if (list[i].id === afterId) { start = i + 1; break; }
    }
    for (var k = 0; k < list.length; k++) {
      var t = list[(start + k) % list.length];
      if (state.known.indexOf(t.id) === -1) return t;
    }
    return null; // everything is known
  }

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function button(label, cls, onClick) {
    var b = el("button", cls, label);
    b.type = "button";
    b.addEventListener("click", onClick);
    return b;
  }

  function topicHref(t) {
    var page = window.KYF_TERMS && window.KYF_TERMS.topicPage;
    return page ? page + "?term=" + encodeURIComponent(t.id) : "";
  }

  function render() {
    if (!card) return;
    card.textContent = "";

    var head = el("div", "mw-head");
    head.appendChild(el("span", "mw-label", "Money Word"));
    head.appendChild(button("✕", "mw-close", function () { hideThisVisit(); close(); }));
    head.lastChild.setAttribute("aria-label", "Hide Money Word for now");
    card.appendChild(head);

    if (!current) {
      card.appendChild(el("p", "mw-tip", "You have marked every word as known. Nicely done."));
      card.appendChild(button("Start over", "mw-btn", function () {
        state.known = []; state.last = null; save(); current = pickNext(null); render();
      }));
      return;
    }

    card.appendChild(el("div", "mw-term", current.term));
    card.appendChild(el("p", "mw-tip", current.tip));

    var row = el("div", "mw-actions");
    var href = topicHref(current);
    if (href) {
      var more = el("a", "mw-btn mw-btn-primary", "Tell me more");
      more.href = href;
      row.appendChild(more);
    }
    row.appendChild(button("Next word", "mw-btn" + (href ? "" : " mw-btn-primary"), next));
    row.appendChild(button("I know this", "mw-btn", known));
    card.appendChild(row);

    card.appendChild(button("Don't show again", "mw-off", turnOff));
  }

  function show(t) {
    current = t;
    if (t) {
      if (state.seen.indexOf(t.id) === -1) state.seen.push(t.id);
      state.last = t.id;
      save();
    }
    render();
  }

  function next() { show(pickNext(current && current.id)); }
  function known() {
    if (current && state.known.indexOf(current.id) === -1) state.known.push(current.id);
    save();
    show(pickNext(current && current.id));
  }

  function close() {
    if (card) { card.remove(); card = null; }
  }
  function turnOff() {
    state.off = true; save(); close(); updateSwitch();
  }

  function open() {
    if (card) return;
    var first = pickNext(state.last);
    if (!first && !terms().length) return;
    card = el("aside", "mw-card");
    card.id = "kyf-money-word";
    card.setAttribute("role", "complementary");
    card.setAttribute("aria-label", "Money Word");
    document.body.appendChild(card);
    show(first);
    requestAnimationFrame(function () { card && card.classList.add("mw-in"); });
  }

  /* ---------- footer switch ---------- */
  function updateSwitch() {
    var sw = document.getElementById("kyf-mw-switch");
    if (!sw) return;
    sw.textContent = state.off ? "💡 Money Word off" : "💡 Money Word on";
    sw.setAttribute("aria-pressed", state.off ? "false" : "true");
  }
  function ensureSwitch() {
    if (document.getElementById("kyf-mw-switch")) return;
    var meta = document.querySelector("#kyf-footer .kyf-footer-meta");
    if (!meta) return;
    var sw = el("button", "kyf-footer-switch");
    sw.type = "button";
    sw.id = "kyf-mw-switch";
    sw.title = "Show or hide the Money Word card";
    sw.addEventListener("click", function () {
      state.off = !state.off; save();
      try { sessionStorage.removeItem(SESSION); } catch (e) { /* ignore */ }
      if (state.off) close(); else open();
      updateSwitch();
    });
    meta.insertBefore(sw, meta.firstChild);
    updateSwitch();
  }

  function addStylesheet() {
    var link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "css/money-word.css?v=" + (window.KYF_APP_VERSION || "");
    document.head.appendChild(link);
  }

  function init() {
    addStylesheet();
    ensureSwitch();
    if (state.off || hiddenThisVisit()) return;
    setTimeout(function () { if (!state.off && !hiddenThisVisit()) open(); }, DELAY_MS);
  }

  window.KYF_MONEY_WORD = { open: open, close: close, state: function () { return state; } };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
