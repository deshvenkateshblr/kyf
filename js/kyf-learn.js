/**
 * Learn page (`js/kyf-learn.js`): learn.html shows the word index, learn.html?term=<id> shows one word.
 * Words come from data/kyf-terms.js, chapter names from data/kyf-curriculum.js.
 * A lesson reads in order: the trap, the meaning in plain words, an example in the person's own
 * numbers (first goal, today's rates), related words, then a one-question check.
 * Everything stays in this browser.
 */
(function () {
  "use strict";

  var root = document.getElementById("learn-root");
  var T = window.KYF_TERMS;
  if (!root || !T) return;

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function link(href, cls, text) {
    var a = el("a", cls, text);
    a.href = href;
    return a;
  }

  function topicHref(id) { return "learn.html?term=" + encodeURIComponent(id); }

  // Words in reading order: by chapter, then as listed
  function ordered() {
    return T.terms.map(function (t, i) { return { t: t, i: i }; })
      .sort(function (a, b) { return (a.t.chapter - b.t.chapter) || (a.i - b.i); })
      .map(function (x) { return x.t; });
  }

  function chapterInfo(n) {
    var list = (window.KYF_CURRICULUM && window.KYF_CURRICULUM.chapters) || [];
    for (var i = 0; i < list.length; i++) if (list[i].number === n) return list[i];
    return { number: n, title: "Chapter " + n, subtitle: "" };
  }

  // ---- the person's numbers -------------------------------------------------
  function compact(n) {
    if (n >= 10000000) return (n / 10000000).toFixed(2) + " Cr";
    if (n >= 100000) return (n / 100000).toFixed(1) + "L";
    return Math.round(n).toLocaleString("en-IN");
  }

  function readGoal() {
    var G = window.KYF_GOALS;
    if (!G || !G.normalizeGoal || !G.computeGoal) return null;
    try {
      var raw = JSON.parse(localStorage.getItem("kyf_user_goals") || "[]");
      for (var i = 0; i < raw.length; i++) {
        var g = G.normalizeGoal(raw[i]);
        if (g && g.kind !== "COVER" && g.status !== "ACHIEVED" && g.baseTargetINR > 0) return { goal: g, calc: G.computeGoal(g, 0) };
      }
    } catch (e) { /* storage blocked or unreadable: sample numbers are used */ }
    return null;
  }

  function numbers() {
    var vars = {};
    var pulse = window.KYF_MARKET_PULSE || {};
    var macro = pulse.macro || {};
    if (macro.cpiInflation) vars.inflation = macro.cpiInflation;
    if (macro.sbiFd1Yr) vars.fdRate = macro.sbiFd1Yr;
    var cpi = vars.inflation || 5.4, fd = vars.fdRate || 6.8;
    vars.realFdReturn = (((1 + fd / 100) / (1 + cpi / 100) - 1) * 100).toFixed(1);
    var nifty = pulse.indices && pulse.indices.NIFTY50;
    if (nifty && nifty.cagr10y) vars.niftyCagr = nifty.cagr10y;
    var gold = pulse.preciousMetals && pulse.preciousMetals.gold24kPerGram;
    if (gold) vars.gold24k = Math.round(gold).toLocaleString("en-IN");
    var g = readGoal();
    if (g) {
      vars.goalName = g.goal.name;
      vars.goalCost = compact(g.goal.baseTargetINR);
      vars.goalFutureCost = compact(g.calc.futureCost);
      vars.goalYears = g.calc.years;
      if (g.calc.inflationRate) vars.inflation = g.calc.inflationRate;
      if (g.calc.sip > 0) vars.sipMonthly = Math.round(g.calc.sip).toLocaleString("en-IN");
    }
    return { vars: vars, personal: !!g };
  }

  // ---- pages ------------------------------------------------------------------
  function indexPage() {
    document.title = "Learn money words | Know Your Finance (KYF)";
    root.textContent = "";
    root.appendChild(el("h1", "", "Learn money words"));
    root.appendChild(el("p", "learn-lede", "Plain meanings, with examples from your own numbers. Pick a word."));

    var words = ordered();
    var chapters = [];
    words.forEach(function (t) { if (chapters.indexOf(t.chapter) < 0) chapters.push(t.chapter); });
    chapters.forEach(function (n) {
      var info = chapterInfo(n);
      var sec = el("section", "learn-chapter");
      sec.appendChild(el("h2", "", "Chapter " + n + ": " + info.title));
      if (info.subtitle) sec.appendChild(el("p", "learn-chapter-sub", info.subtitle));
      var ul = el("ul", "learn-words");
      words.filter(function (t) { return t.chapter === n; }).forEach(function (t) {
        var li = el("li");
        li.appendChild(link(topicHref(t.id), "learn-word" + (t.quickCheck ? " is-full" : ""), t.term));
        ul.appendChild(li);
      });
      sec.appendChild(ul);
      root.appendChild(sec);
    });
  }

  function quickCheck(t) {
    var qc = t.quickCheck;
    var box = el("section", "learn-block");
    box.appendChild(el("p", "learn-label", "Quick check"));
    box.appendChild(el("p", "learn-q", qc.question));
    var opts = el("div", "learn-options");
    var result = el("p", "learn-result");
    result.hidden = true;
    var list = qc.options.slice();
    for (var i = list.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = list[i]; list[i] = list[j]; list[j] = tmp;
    }
    list.forEach(function (o) {
      var b = el("button", "learn-option", o.text);
      b.type = "button";
      b.setAttribute("data-correct", o.correct ? "true" : "false");
      b.addEventListener("click", function () {
        Array.prototype.forEach.call(opts.children, function (x) {
          x.disabled = true;
          if (x.getAttribute("data-correct") === "true") x.classList.add("is-right");
        });
        if (!o.correct) b.classList.add("is-wrong");
        result.textContent = "";
        result.appendChild(el("strong", "", o.correct ? "Right." : "Not quite."));
        result.appendChild(document.createTextNode(qc.explanation || ""));
        result.hidden = false;
      });
      opts.appendChild(b);
    });
    box.appendChild(opts);
    box.appendChild(result);
    return box;
  }

  function lessonPage(t) {
    document.title = t.term + " | Learn | Know Your Finance (KYF)";
    root.textContent = "";
    var info = chapterInfo(t.chapter);

    var crumbs = el("p", "learn-crumbs");
    crumbs.appendChild(link("learn.html", "", "Learn"));
    crumbs.appendChild(document.createTextNode(" › Chapter " + t.chapter + ": " + info.title));
    root.appendChild(crumbs);

    root.appendChild(el("h1", "", t.term));
    if (t.pronunciation) root.appendChild(el("p", "learn-say", t.pronunciation + (t.partOfSpeech ? " · " + t.partOfSpeech : "")));

    if (t.humanFriction) {
      var trap = el("section", "learn-block is-trap");
      trap.appendChild(el("p", "learn-label", "The trap"));
      trap.appendChild(el("p", "", t.humanFriction));
      root.appendChild(trap);
    }

    var plain = el("section", "learn-block");
    plain.appendChild(el("p", "learn-label", "In plain words"));
    plain.appendChild(el("p", "", t.plainMeaning || t.tip));
    root.appendChild(plain);

    if (t.contextTemplate) {
      var n = numbers();
      var ex = el("section", "learn-block");
      ex.appendChild(el("p", "learn-label", n.personal ? "In your numbers" : "An example"));
      ex.appendChild(el("p", "", T.renderContext(t.id, n.vars)));
      var note = el("p", "learn-example-note");
      if (n.personal) {
        note.textContent = "Uses your first goal and today's rates.";
      } else {
        note.appendChild(document.createTextNode("Sample goal with today's rates. "));
        note.appendChild(link("goals.html", "", "Add a goal"));
        note.appendChild(document.createTextNode(" to see your own."));
      }
      ex.appendChild(note);
      root.appendChild(ex);
    }

    var related = (t.relatedWords || []).map(function (id) { return T.find(id); }).filter(Boolean);
    if (related.length) {
      var rel = el("section", "learn-block");
      rel.appendChild(el("p", "learn-label", "Related words"));
      var ul = el("ul", "learn-related");
      related.forEach(function (r) {
        var li = el("li");
        li.appendChild(link(topicHref(r.id), "learn-word", r.term));
        ul.appendChild(li);
      });
      rel.appendChild(ul);
      root.appendChild(rel);
    }

    if (t.quickCheck) root.appendChild(quickCheck(t));
    else root.appendChild(el("p", "learn-soon", "A fuller lesson for this word is coming."));

    var words = ordered();
    var pos = words.indexOf(t);
    var pager = el("div", "learn-pager");
    if (pos > 0) pager.appendChild(link(topicHref(words[pos - 1].id), "is-prev", "‹ " + words[pos - 1].term));
    if (pos < words.length - 1) pager.appendChild(link(topicHref(words[pos + 1].id), "is-next", words[pos + 1].term + " ›"));
    root.appendChild(pager);
  }

  function notFound() {
    document.title = "Learn money words | Know Your Finance (KYF)";
    root.textContent = "";
    root.appendChild(el("h1", "", "We don't have that word yet"));
    var p = el("p", "learn-lede");
    p.appendChild(link("learn.html", "", "See all words"));
    root.appendChild(p);
  }

  function route() {
    var id = "";
    try { id = new URLSearchParams(window.location.search).get("term") || ""; } catch (e) { id = ""; }
    if (!id) return indexPage();
    var t = T.find(id);
    if (!t) return notFound();
    lessonPage(t);
    window.scrollTo(0, 0);
  }

  route();
})();
