/**
 * Loan tools page: "Cash or loan?" and "Loan schedule". The sums live in js/kyf-loan-math.js.
 * State is only in the form and, when the person shares, in the link's query string.
 */
(function () {
  "use strict";

  const L = window.KYF_LOAN;
  const macro = (window.KYF_MARKET_PULSE && window.KYF_MARKET_PULSE.macro) || {};
  const $ = (id) => document.getElementById(id);
  const SVG = "http://www.w3.org/2000/svg";

  const inr = (n) => "₹" + Math.round(n).toLocaleString("en-IN");
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const monthLabel = (d) => MONTHS[d.getMonth()] + " " + d.getFullYear();
  const num = (id) => {
    const v = parseFloat(String($(id).value).replace(/,/g, ""));
    return isNaN(v) ? 0 : v;
  };
  const el = (tag, cls, text) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  };
  const clear = (n) => { while (n.firstChild) n.removeChild(n.firstChild); };

  // ---- defaults and the link -------------------------------------------------------------------
  const nextMonth = () => { const d = new Date(); const m = new Date(d.getFullYear(), d.getMonth() + 1, 1); return m.getFullYear() + "-" + String(m.getMonth() + 1).padStart(2, "0"); };

  const DEFAULTS = {
    compare: { p: 1000000, d: 200000, r: 9.5, y: 5, e: macro.sbiFd1Yr || 6.8, t: "" },
    schedule: { a: 2500000, r: macro.homeLoanAvg || 8.65, y: 20, s: nextMonth(), x: "" }
  };
  const IDS = {
    compare: { p: "cPrice", d: "cDown", r: "cRate", y: "cYears", e: "cEarn", t: "cPay" },
    schedule: { a: "sAmount", r: "sRate", y: "sYears", s: "sStart", x: "sExtra" }
  };

  function applyParams() {
    const q = new URLSearchParams(window.location.search);
    Object.keys(IDS).forEach((tool) => {
      Object.keys(IDS[tool]).forEach((k) => {
        const fromUrl = q.get(tool === "compare" ? "c" + k : "s" + k);
        const v = fromUrl != null ? fromUrl : DEFAULTS[tool][k];
        $(IDS[tool][k]).value = v;
      });
    });
    return q.get("tool") === "schedule" ? "schedule" : "compare";
  }

  function shareUrl(tool) {
    const q = new URLSearchParams();
    q.set("tool", tool);
    Object.keys(IDS[tool]).forEach((k) => {
      const v = $(IDS[tool][k]).value.trim();
      if (v !== "") q.set((tool === "compare" ? "c" : "s") + k, v);
    });
    return window.location.origin + window.location.pathname + "?" + q.toString();
  }

  // ---- shared bits -----------------------------------------------------------------------------
  function shareRow(tool, text) {
    const row = el("div", "share");
    const wa = el("a", "btn-action btn-wa", "Share on WhatsApp");
    wa.href = "https://wa.me/?text=" + encodeURIComponent(text + "\n\nTry your own numbers: " + shareUrl(tool));
    wa.target = "_blank";
    wa.rel = "noopener noreferrer";
    const cp = el("button", "btn-action quiet", "Copy link");
    cp.type = "button";
    cp.addEventListener("click", () => {
      const url = shareUrl(tool);
      const done = () => { cp.textContent = "Link copied ✓"; setTimeout(() => { cp.textContent = "Copy link"; }, 2000); };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(done, () => window.prompt("Copy this link", url));
      else window.prompt("Copy this link", url);
    });
    row.append(wa, cp, el("small", null, "Your numbers travel inside the link. Nothing is stored on a server."));
    return row;
  }

  const tile = (label, value, sub) => {
    const t = el("div", "tile");
    t.append(el("span", null, label), el("strong", null, value));
    if (sub) t.append(el("em", null, sub));
    return t;
  };

  function echo(inputId, echoId) {
    const v = num(inputId);
    $(echoId).textContent = v > 0 ? inr(v) : "";
  }

  // ---- cash or loan ----------------------------------------------------------------------------
  function renderCompare() {
    echo("cPrice", "cPriceEcho"); echo("cDown", "cDownEcho"); echo("cPay", "cPayEcho");
    const o = { price: num("cPrice"), down: num("cDown"), ratePct: num("cRate"), years: num("cYears"), earnPct: num("cEarn"), takeHome: num("cPay") };
    const out = $("outCompare");
    clear(out);
    if (!(o.price > 0)) { out.append(el("p", "note", "Enter the price to see the comparison.")); return; }
    const c = L.compare(o);
    const earn = o.earnPct;

    const verdict = el("div", "verdict" + (c.winner === "loan" ? " is-loan" : ""));
    let line, sub;
    if (c.loan <= 0) {
      line = "No loan needed: you are paying " + inr(c.price) + " in cash.";
      sub = "Make the down payment smaller to see how a loan would compare.";
    } else if (c.winner === "cash") {
      line = "Paying cash saves you about " + inr(Math.abs(c.edge)) + ".";
      sub = "Borrowing " + inr(c.loan) + " at " + o.ratePct + "% costs more than the " + earn + "% your spare cash would earn over " + o.years + " years.";
    } else {
      line = "The loan comes out about " + inr(c.edge) + " ahead, but only if you really earn " + earn + "%.";
      sub = "Borrowing at " + o.ratePct + "% while spare cash earns " + earn + "% leaves a gain on paper. That return is not guaranteed and the loan is.";
    }
    verdict.append(el("h2", null, line), el("p", null, sub));
    out.append(verdict);

    const tiles = el("div", "tiles");
    tiles.append(
      tile("Monthly EMI", c.loan > 0 ? inr(c.emi) : "—", c.loan > 0 ? "for " + c.months + " months" : ""),
      tile("Total interest", c.loan > 0 ? inr(c.totalInterest) : "—", c.loan > 0 ? "on " + inr(c.loan) : ""),
      tile("You pay in all", inr(c.totalCost), "down payment + EMIs")
    );
    out.append(tiles);

    const downPct = c.price ? (c.down / c.price) * 100 : 0;
    const split = el("div", "split");
    const a = el("i", "down"), b = el("i", "borrowed");
    a.style.width = downPct + "%"; b.style.width = (100 - downPct) + "%";
    split.append(a, b);
    const legend = el("div", "legend");
    legend.append(el("span", null, "Down payment " + inr(c.down) + " (" + Math.round(downPct) + "%)"), el("span", null, "Borrowed " + inr(c.loan)));
    out.append(split, legend);

    if (c.emiShare != null && c.loan > 0) {
      const g = el("div", "gauge");
      const pct = Math.round(c.emiShare * 100);
      g.append(el("p", null, "The EMI is " + pct + "% of your take-home pay. " + (pct <= 15 ? "That is within the 15% guide." : "Aim to keep it under 15%.")));
      const track = el("div", "gauge-track");
      const fill = el("i", pct > 15 ? "is-high" : "");
      fill.style.width = Math.min(100, pct * (100 / 30)) + "%";   // the bar is 0 to 30% of pay
      const mark = el("span", "gauge-mark");
      mark.style.left = (15 * (100 / 30)) + "%";
      track.append(fill, mark);
      g.append(track);
      out.append(g);
    }

    out.append(el("p", "note", "How we compare: with the loan, the cash you did not spend stays invested at " + earn + "% and pays each EMI. What is left when the loan ends is the gain (or the shortfall) against paying cash. Before tax."));

    const text = ["Cash or loan? (via KYF)",
      "Price " + inr(c.price) + ", down payment " + inr(c.down),
      c.loan > 0 ? "Loan " + inr(c.loan) + " at " + o.ratePct + "% for " + o.years + " years: EMI " + inr(c.emi) + ", interest " + inr(c.totalInterest) : "All cash, no loan",
      c.loan > 0 ? (c.winner === "cash" ? "Paying cash saves about " + inr(Math.abs(c.edge)) + " against borrowing and investing the cash at " + earn + "%." : "Borrowing comes out about " + inr(c.edge) + " ahead if the spare cash earns " + earn + "% (not guaranteed).") : ""
    ].filter(Boolean).join("\n");
    out.append(shareRow("compare", text));
  }

  // ---- schedule --------------------------------------------------------------------------------
  let view = "yearly";

  function chart(base, plan) {
    const W = 640, H = 190, padL = 8, padR = 8, padT = 10, padB = 22;
    const svg = document.createElementNS(SVG, "svg");
    svg.setAttribute("viewBox", "0 0 " + W + " " + H);
    svg.setAttribute("class", "chart");
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", "Outstanding loan balance over time");
    const top = base.rows.length ? base.rows[0].balance + base.rows[0].principal : 1;
    const n = base.rows.length;
    const x = (i) => padL + (i / Math.max(1, n)) * (W - padL - padR);
    const y = (v) => padT + (1 - v / top) * (H - padT - padB);
    const path = (rows) => "M" + x(0) + "," + y(top) + " " + rows.map((r, i) => "L" + x(i + 1).toFixed(1) + "," + y(r.balance).toFixed(1)).join(" ");
    const mk = (tag, attrs) => { const e = document.createElementNS(SVG, tag); Object.keys(attrs).forEach((k) => e.setAttribute(k, attrs[k])); return e; };
    svg.append(mk("line", { class: "axis", x1: padL, x2: W - padR, y1: H - padB, y2: H - padB }));
    if (plan !== base) svg.append(mk("path", { class: "base", d: path(base.rows) }));
    svg.append(mk("path", { class: "area", d: path(plan.rows) + " L" + x(plan.rows.length) + "," + y(0) + " L" + x(0) + "," + y(0) + " Z" }));
    svg.append(mk("path", { class: "line", d: path(plan.rows) }));
    const t1 = mk("text", { x: padL, y: H - 6 }); t1.textContent = monthLabel(base.rows[0].date);
    const t2 = mk("text", { x: W - padR, y: H - 6, "text-anchor": "end" }); t2.textContent = monthLabel(base.rows[n - 1].date);
    svg.append(t1, t2);
    return svg;
  }

  function table(plan) {
    const wrap = el("div", "table-wrap");
    const t = el("table", "sched");
    const head = el("thead"), hr = el("tr");
    (view === "yearly" ? ["Year", "Paid", "Principal", "Interest", "Balance"] : ["Month", "Payment", "Principal", "Interest", "Balance"]).forEach((h) => hr.append(el("th", null, h)));
    head.append(hr);
    const body = el("tbody");
    const rows = view === "yearly" ? plan.years : plan.rows;
    const maxInterest = Math.max.apply(null, rows.map((r) => r.interest).concat([1]));
    rows.forEach((r) => {
      const tr = el("tr");
      tr.append(el("td", null, view === "yearly" ? String(r.year) : monthLabel(r.date)), el("td", null, inr(r.payment)), el("td", null, inr(r.principal)));
      const ti = el("td");
      if (view === "yearly") { const bar = el("span", "bar-inline"); bar.style.width = Math.round((r.interest / maxInterest) * 60) + "px"; ti.append(bar); }
      ti.append(document.createTextNode(inr(r.interest)));
      tr.append(ti, el("td", null, inr(r.balance)));
      body.append(tr);
    });
    t.append(head, body);
    wrap.append(t);
    return wrap;
  }

  function renderSchedule() {
    echo("sAmount", "sAmountEcho"); echo("sExtra", "sExtraEcho");
    const out = $("outSchedule");
    clear(out);
    const amount = num("sAmount"), months = Math.round(num("sYears") * 12);
    if (!(amount > 0) || !(months > 0)) { out.append(el("p", "note", "Enter the loan amount and the years to see the schedule.")); return; }
    const sv = $("sStart").value;
    const start = sv ? new Date(Number(sv.slice(0, 4)), Number(sv.slice(5, 7)) - 1, 1) : undefined;
    const common = { principal: amount, ratePct: num("sRate"), months, start };
    const base = L.schedule(common);
    const extra = num("sExtra");
    const plan = extra > 0 ? L.schedule(Object.assign({ extraMonthly: extra }, common)) : base;

    const tiles = el("div", "tiles");
    tiles.append(
      tile("Monthly EMI", inr(base.emi), "for " + months + " months"),
      tile("Total interest", inr(plan.totalInterest), "on " + inr(amount)),
      tile("Last payment", monthLabel(plan.payoff), plan.months + " payments")
    );
    out.append(tiles);

    let saved = "";
    if (extra > 0 && plan.months < base.months) {
      const m = base.months - plan.months;
      saved = "Paying " + inr(extra) + " extra each month saves " + inr(base.totalInterest - plan.totalInterest) + " in interest and ends the loan " + Math.floor(m / 12) + " yr " + (m % 12) + " mo sooner.";
      const v = el("div", "verdict");
      v.append(el("h2", null, saved));
      out.append(v);
    }

    out.append(chart(base, plan));
    out.append(el("p", "note", extra > 0 ? "Dashed line: the loan with no extra payment." : "The line shows what you still owe, month by month."));

    const tools = el("div", "table-tools");
    tools.append(el("h3", null, "Every payment"));
    const tg = el("div", "seg-toggle");
    [["yearly", "By year"], ["monthly", "By month"]].forEach((p) => {
      const b = el("button", null, p[1]);
      b.type = "button";
      b.setAttribute("aria-pressed", view === p[0] ? "true" : "false");
      b.addEventListener("click", () => { view = p[0]; renderSchedule(); });
      tg.append(b);
    });
    tools.append(tg);
    out.append(tools, table(plan));

    const text = ["Loan schedule (via KYF)",
      inr(amount) + " at " + num("sRate") + "% for " + num("sYears") + " years",
      "EMI " + inr(base.emi) + ", total interest " + inr(plan.totalInterest) + ", last payment " + monthLabel(plan.payoff),
      saved
    ].filter(Boolean).join("\n");
    out.append(shareRow("schedule", text));
  }

  // ---- tabs and wiring -------------------------------------------------------------------------
  function show(tool) {
    ["compare", "schedule"].forEach((t) => {
      $("tool-" + t).hidden = t !== tool;
      $("tab-" + t).setAttribute("aria-selected", t === tool ? "true" : "false");
    });
    try {
      const u = new URL(window.location.href);
      u.searchParams.set("tool", tool);
      window.history.replaceState({}, "", u.toString());
    } catch (e) { /* ignore */ }
    (tool === "compare" ? renderCompare : renderSchedule)();
  }

  function init() {
    const first = applyParams();
    document.querySelectorAll(".tab").forEach((b) => b.addEventListener("click", () => show(b.dataset.tool)));
    ["formCompare", "formSchedule"].forEach((id) => $(id).addEventListener("submit", (e) => e.preventDefault()));
    $("formCompare").addEventListener("input", renderCompare);
    $("formSchedule").addEventListener("input", renderSchedule);
    show(first);

    // Open and Save in the top bar keep working on this page (there is nothing here to save)
    if (window.KYF_VAULT && typeof window.KYF_VAULT.registerPageHook === "function") {
      window.KYF_VAULT.registerPageHook({ pageName: "loans", getLocalData: () => ({}), onAfterOpen: () => {} });
    }
  }

  init();
})();
