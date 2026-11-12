/**
 * Money Word (`js/kyf-money-word.js`): a small floating card on the home page that introduces
 * one finance word at a time, in curriculum order (words come from data/kyf-terms.js).
 *
 * Buttons: Prev / Next (walk the words in order), × (hide for this visit) and "Don't show again".
 * "Tell me more" appears only once KYF_TERMS.topicPage is set.
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
    var s = { seen: [], off: false, last: null };
    try {
      var raw = JSON.parse(localStorage.getItem(STORE) || "null");
      if (raw && typeof raw === "object") {
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

  function indexOfId(id) {
    var list = terms();
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return i;
    return -1;
  }

  // Resume where the person left off: the word after the last one shown (wraps round to the start).
  function startWord() {
    var list = terms();
    if (!list.length) return null;
    var i = indexOfId(state.last);
    return list[i === -1 ? 0 : (i + 1) % list.length];
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

    card.appendChild(el("div", "mw-term", current.term));
    card.appendChild(el("p", "mw-tip", current.tip));

    var list = terms();
    var pos = indexOfId(current.id);
    var row = el("div", "mw-actions");
    var href = topicHref(current);
    if (href) {
      var more = el("a", "mw-btn mw-btn-primary", "Tell me more");
      more.href = href;
      row.appendChild(more);
    }
    var nav = el("div", "mw-nav");
    var prevBtn = button("‹ Prev", "mw-btn", prev);
    prevBtn.disabled = pos <= 0;
    prevBtn.setAttribute("aria-label", "Previous word");
    var count = el("span", "mw-count", (pos + 1) + " of " + list.length);
    var nextBtn = button("Next ›", "mw-btn mw-btn-primary", next);
    nextBtn.disabled = pos >= list.length - 1;
    nextBtn.setAttribute("aria-label", "Next word");
    nav.appendChild(prevBtn);
    nav.appendChild(count);
    nav.appendChild(nextBtn);
    row.appendChild(nav);
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

  function step(by) {
    var list = terms();
    var i = indexOfId(current && current.id) + by;
    if (i >= 0 && i < list.length) show(list[i]);
  }
  function next() { step(1); }
  function prev() { step(-1); }

  function close() {
    if (card) { card.remove(); card = null; }
  }
  function turnOff() {
    state.off = true; save(); close(); updateSwitch();
  }

  function open() {
    if (card) return;
    var first = startWord();
    if (!first) return;
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
