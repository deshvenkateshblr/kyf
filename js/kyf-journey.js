/**
 * KYF_JOURNEY -- the three steps of a plan, with honest progress bars:
 *   1 Build your portfolio  ->  2 Name your goals  ->  3 Give money a job
 * It only reads what already exists (goals and holdings) and asks the user for nothing new.
 * Any step can be done first; "next" is simply the first step that is not complete.
 */
(function (root) {
  "use strict";

  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[c]));
  const allocsOf = (h) => (Array.isArray(h.allocations) ? h.allocations.filter((a) => a && a.goalId) : []);

  function compute(goals, holdings) {
    const gs = (goals || []).filter((g) => g && g.status !== "ACHIEVED");
    const planned = gs.filter((g) => g.kind !== "COVER");
    const hs = (holdings || []).filter((h) => h && !h.isLiability);
    const goalsDone = gs.filter((g) => g.kind === "COVER" || ((Number(g.baseTargetINR) || 0) > 0 && Number(g.targetYear) > 0));
    const assigned = hs.filter((h) => allocsOf(h).length > 0);
    const ready = hs.length > 0 && planned.length > 0;

    const s1 = { id: "portfolio", n: 1, title: "Build your portfolio", href: "portfolio.html",
      pct: hs.length ? 100 : 0,
      detail: hs.length ? `${hs.length} holding${hs.length > 1 ? "s" : ""} added` : "Add what you own, or import it" };
    const s2 = { id: "goals", n: 2, title: "Name your goals", href: "goals.html",
      pct: gs.length ? Math.round((goalsDone.length / gs.length) * 100) : 0,
      detail: gs.length ? `${goalsDone.length} of ${gs.length} goal${gs.length > 1 ? "s" : ""} have a cost and a year` : "What are you saving for?" };
    const s3 = { id: "assign", n: 3, title: "Give money a job", href: ready ? "portfolio.html?assign=1" : (hs.length ? "goals.html" : "portfolio.html"),
      pct: ready ? Math.round((assigned.length / hs.length) * 100) : 0,
      detail: ready ? `${assigned.length} of ${hs.length} holding${hs.length > 1 ? "s" : ""} have a goal` : "Opens once you have a holding and a goal" };
    const steps = [s1, s2, s3];
    const next = steps.find((s) => s.pct < 100) || null;
    const overall = Math.round(steps.reduce((t, s) => t + s.pct, 0) / 3);
    return { steps, next, overall };
  }

  async function load() {
    const V = root.KYF_VAULT, G = root.KYF_GOALS;
    let goals = [], holdings = [];
    try {
      const gh = V && V.sections && V.sections.get("goals");
      const raw = gh ? await gh.read() : [];
      goals = G && G.mergeGoalLists ? G.mergeGoalLists(raw) : raw;
    } catch (e) { goals = []; }
    try {
      const ph = V && V.sections && V.sections.get("portfolio");
      holdings = ph ? await ph.read() : [];
    } catch (e) { holdings = []; }
    return { goals, holdings };
  }

  function render(host, model, opts) {
    const o = opts || {};
    const here = o.current || "";
    host.className = "plan-strip" + (o.compact ? " plan-strip--compact" : "") + (here ? " has-here" : "");
    const head = model.next
      ? `<p class="jr-head"><strong>${model.overall}% done.</strong> Next: <a href="${esc(model.next.href)}">${esc(model.next.title)} &rarr;</a></p>`
      : `<p class="jr-head"><strong>All three steps done.</strong> Keep it alive with the steps in <a href="cadence.html">Cadence</a>.</p>`;
    host.innerHTML = head + `<ol class="jr-steps">` + model.steps.map((s) => {
      const cls = "jr-step" + (s.pct >= 100 ? " is-done" : "") + (model.next && model.next.id === s.id ? " is-next" : "") + (here === s.id ? " is-here" : "");
      return `<li class="${cls}"><a href="${esc(s.href)}"><span class="jr-num">${s.pct >= 100 ? "✓" : s.n}</span>` +
        `<span class="jr-body"><strong>${esc(s.title)}</strong><small>${esc(s.detail)}</small>` +
        `<span class="jr-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${s.pct}" aria-label="${esc(s.title)}"><i data-w="${s.pct}"></i></span></span></a></li>`;
    }).join("") + `</ol>`;
    host.querySelectorAll("i[data-w]").forEach((i) => { i.style.width = i.getAttribute("data-w") + "%"; });
  }

  async function mount(selector, opts) {
    const host = typeof selector === "string" ? document.querySelector(selector) : selector;
    if (!host) return null;
    const data = await load();
    const model = compute(data.goals, data.holdings);
    render(host, model, opts);
    return model;
  }

  root.KYF_JOURNEY = { compute, load, render, mount };
})(typeof window !== "undefined" ? window : globalThis);
