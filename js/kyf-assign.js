/**
 * KYF_ASSIGN -- one place where money is given a job.
 *
 * Used by Portfolio (every holding x every goal) and by the Goals drawer (one goal, tick the holdings).
 * It never stores anything itself: it edits a working copy of each holding's `allocations`
 * ([{ goalId, percentage }]) and hands the result back through apply().
 *
 * Holdings come in already valued (KYF_PORTFOLIO_ENGINE.enrichHoldingsWithLiveMarket), so every
 * rupee figure here is today's value, not a saved number.
 */
(function (root) {
  "use strict";

  const FOCUS = "__focus__"; // stands in for a goal that has not been saved yet

  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[c]));

  function inr(v) {
    const n = Math.round(Number(v) || 0), a = Math.abs(n), sign = n < 0 ? "-" : "";
    if (a >= 10000000) return `${sign}₹${(a / 10000000).toFixed(2)} Cr`;
    if (a >= 100000) return `${sign}₹${(a / 100000).toFixed(2)} L`;
    if (a >= 1000) return `${sign}₹${(a / 1000).toFixed(1)} K`;
    return `${sign}₹${a}`;
  }

  const allocsOf = (h) => (Array.isArray(h.allocations) ? h.allocations.filter((a) => a && a.goalId) : []);
  const isAssignable = (h) => !h.isLiability && (Number(h.currentValue) || 0) > 0;
  const isUnassigned = (h) => allocsOf(h).length === 0;

  // ---- Suggestions: match what the money is to when it is needed ----------------------------------
  function bucketOf(h) {
    const text = `${h.assetClass || ""} ${h.subCategory || ""} ${h.name || ""}`.toLowerCase();
    if (/epf|ppf|nps|provident|pension/.test(text)) return "RETIRE";
    if (/gold|commodit|silver/.test(text)) return "GOLD";
    if (/real estate|property|land/.test(text)) return "NONE";
    if (/fixed income|fd\b|deposit|cash|liquid|savings|debt|gilt|bond|overnight|money market|arbitrage|rd\b/.test(text)) return "SAFE";
    return "GROWTH"; // equities, equity funds, index funds, ETFs
  }

  function suggest(holdings, goals, thisYear) {
    const year = thisYear || new Date().getFullYear();
    const open = (goals || []).filter((g) => g.kind !== "COVER" && g.status !== "ACHIEVED" && g.id);
    const yrs = (g) => Math.max(0, (Number(g.targetYear) || year + 5) - year);
    const out = new Map();
    const pick = (list) => (list.length ? list[0].id : null);
    const byNear = [...open].sort((a, b) => yrs(a) - yrs(b));
    const byFar = [...open].sort((a, b) => yrs(b) - yrs(a));
    const retire = open.filter((g) => g.category === "retirement" || /retire/i.test(g.name || ""));
    holdings.filter((h) => isAssignable(h) && isUnassigned(h)).forEach((h) => {
      const b = bucketOf(h);
      let id = null;
      if (b === "SAFE") id = pick(byNear.filter((g) => yrs(g) <= 3)) || pick(byNear.filter((g) => yrs(g) <= 7));
      else if (b === "GROWTH") id = pick(byFar.filter((g) => yrs(g) >= 7)) || pick(byFar.filter((g) => yrs(g) >= 4));
      else if (b === "GOLD") id = pick(byFar.filter((g) => yrs(g) >= 4)) || pick(byFar);
      else if (b === "RETIRE") id = pick(retire) || pick(byFar.filter((g) => yrs(g) >= 10));
      if (id) out.set(h.id, id);
    });
    return out;
  }

  // ---- The component -------------------------------------------------------------------------------
  /**
   * mount(el, opts)
   *   holdings     valued holdings (enriched)
   *   goals        goal list (saveable goals only are offered)
   *   focusGoalId  Goals drawer mode: one tick per holding for this goal (FOCUS if the goal is new)
   *   holdingIds   optional: only show these holdings (a row's chip, or one group)
   *   createGoal   (name, year) => goal | null, enables the inline "New goal" chip
   *   onChange     called after every edit
   */
  function mount(el, opts) {
    const focusGoalId = opts.focusGoalId || null;
    const create = typeof opts.createGoal === "function" ? opts.createGoal : null;
    const onChange = typeof opts.onChange === "function" ? opts.onChange : () => {};
    const only = opts.holdingIds ? new Set(opts.holdingIds) : null;
    let goals = (opts.goals || []).filter((g) => g.kind !== "COVER" && g.id);
    const all = (opts.holdings || []).filter((h) => isAssignable(h) && (!only || only.has(h.id)));
    const work = new Map(all.map((h) => [h.id, allocsOf(h).map((a) => ({ goalId: a.goalId, percentage: Number(a.percentage) || 0 }))]));
    const initial = JSON.stringify([...work.entries()]);
    let showAll = !!only || !!focusGoalId || !all.some(isUnassigned);
    let newGoalFor = null;

    const goalName = (id) => { const g = goals.find((x) => x.id === id); return g ? g.name : "another goal"; };
    const valueOn = (goalId) => all.reduce((s, h) => {
      const a = work.get(h.id).find((x) => x.goalId === goalId);
      return s + (a ? (Number(h.currentValue) || 0) * (a.percentage / 100) : 0);
    }, 0);
    const unassignedValue = () => all.reduce((s, h) => s + (work.get(h.id).length ? 0 : Number(h.currentValue) || 0), 0);

    function even(list) {
      const n = list.length;
      list.forEach((a, i) => { a.percentage = i === n - 1 ? 100 - Math.floor(100 / n) * (n - 1) : Math.floor(100 / n); });
    }
    function toggle(hid, gid) {
      const list = work.get(hid);
      const i = list.findIndex((a) => a.goalId === gid);
      if (focusGoalId) { work.set(hid, i >= 0 ? [] : [{ goalId: gid, percentage: 100 }]); return; }
      if (i >= 0) list.splice(i, 1); else list.push({ goalId: gid, percentage: 100 });
      if (list.length) even(list);
    }

    function row(h) {
      const list = work.get(h.id);
      const sub = [h.member, h.assetClass].filter(Boolean).join(" · ");
      if (focusGoalId) {
        const a = list.find((x) => x.goalId === focusGoalId);
        const split = list.length > 1 && a;
        const other = list.length === 1 && !a ? goalName(list[0].goalId) : "";
        const note = split ? "Split across goals — change in Portfolio" : other ? `Now counts for ${other}` : "";
        return `<label class="as-row${split ? " is-locked" : ""}">
          <input type="checkbox" data-hid="${esc(h.id)}"${a ? " checked" : ""}${split ? " disabled" : ""}>
          <span class="as-name">${esc(h.name)}<small>${esc(sub)}${note ? " · " + esc(note) : ""}</small></span>
          <span class="as-val">${inr(h.currentValue)}</span></label>`;
      }
      const chips = goals.map((g) => `<button type="button" class="as-chip${list.some((a) => a.goalId === g.id) ? " on" : ""}" data-hid="${esc(h.id)}" data-gid="${esc(g.id)}">${esc(g.name)}</button>`).join("");
      const newChip = create ? (newGoalFor === h.id ? "" : `<button type="button" class="as-chip as-chip--new" data-newfor="${esc(h.id)}">＋ New goal</button>`) : "";
      const newForm = newGoalFor === h.id ? `<div class="as-new"><input type="text" class="form-control" data-new="name" placeholder="What is it for?" autocomplete="off"><input type="number" class="form-control" data-new="year" min="${new Date().getFullYear()}" max="2100" placeholder="Year, e.g. 2036"><button type="button" class="as-btn" data-newsave="${esc(h.id)}">Add</button></div>` : "";
      let split = "";
      if (list.length > 1) {
        split = `<div class="as-split">${list.map((a) => `<label>${esc(goalName(a.goalId))} <input type="number" min="0" max="100" value="${a.percentage}" data-hid="${esc(h.id)}" data-pct="${esc(a.goalId)}">%</label>`).join("")}</div>`;
      }
      return `<div class="as-row as-row--chips"><div class="as-top"><span class="as-name">${esc(h.name)}<small>${esc(sub)}</small></span><span class="as-val">${inr(h.currentValue)}</span></div>
        <div class="as-chips">${chips}${newChip}</div>${newForm}${split}</div>`;
    }

    function render() {
      const shown = all.filter((h) => showAll || isUnassigned({ allocations: work.get(h.id) }))
        .sort((a, b) => (work.get(a.id).length ? 1 : 0) - (work.get(b.id).length ? 1 : 0) || (b.currentValue || 0) - (a.currentValue || 0));
      const un = all.filter((h) => !work.get(h.id).length);
      const head = focusGoalId ? "" : `<div class="as-head"><span><strong>${inr(unassignedValue())}</strong> not given a job yet${un.length ? ` · ${un.length} holding${un.length > 1 ? "s" : ""}` : ""}</span>
        <span class="as-head-btns">${un.length && !only ? `<label class="as-toggle"><input type="checkbox" data-showall${showAll ? " checked" : ""}> Show all</label>` : ""}<button type="button" class="as-btn" data-suggest>✨ Suggest</button></div></div>`;
      el.innerHTML = head + (shown.length ? `<div class="as-list">${shown.map(row).join("")}</div>` : `<p class="as-empty">${all.length ? "Everything has a job." : "No holdings to assign yet."}</p>`);
    }

    el.addEventListener("change", (e) => {
      const t = e.target;
      if (t.matches("input[type=checkbox][data-hid]")) { toggle(t.dataset.hid, focusGoalId); onChange(); } // the box already shows the new state; no redraw keeps focus and order steady
      else if (t.matches("[data-showall]")) { showAll = t.checked; render(); }
      else if (t.matches("input[data-pct]")) {
        const list = work.get(t.dataset.hid);
        const a = list.find((x) => x.goalId === t.dataset.pct);
        if (a) { a.percentage = Math.max(0, Math.min(100, Number(t.value) || 0)); }
        const sum = list.reduce((s, x) => s + x.percentage, 0);
        if (sum !== 100) { const other = list.find((x) => x !== a); if (other) other.percentage = Math.max(0, other.percentage + (100 - sum)); }
        render(); onChange();
      }
    });
    el.addEventListener("click", (e) => {
      const chip = e.target.closest(".as-chip[data-gid]");
      if (chip) { toggle(chip.dataset.hid, chip.dataset.gid); render(); onChange(); return; }
      const nw = e.target.closest("[data-newfor]");
      if (nw) { newGoalFor = nw.dataset.newfor; render(); const f = el.querySelector("[data-new=name]"); if (f) f.focus(); return; }
      const sv = e.target.closest("[data-newsave]");
      if (sv) {
        const box = sv.closest(".as-new");
        const name = box.querySelector("[data-new=name]").value.trim();
        const year = Number(box.querySelector("[data-new=year]").value) || 0;
        if (!name || year < new Date().getFullYear()) return;
        const g = create(name, year);
        if (g) { goals = goals.concat([g]); toggle(sv.dataset.newsave, g.id); }
        newGoalFor = null; render(); onChange(); return;
      }
      if (e.target.closest("[data-suggest]")) {
        const s = suggest(all.map((h) => ({ ...h, allocations: work.get(h.id) })), goals);
        s.forEach((gid, hid) => work.set(hid, [{ goalId: gid, percentage: 100 }]));
        showAll = true; render(); onChange();
      }
    });
    render();

    return {
      /** value (today) currently counted for a goal, with edits applied */
      valueOn,
      unassignedValue,
      dirty: () => JSON.stringify([...work.entries()]) !== initial,
      goals: () => goals,
      /** write the edits onto the stored holdings; goalId replaces the "new goal" placeholder. Returns true if anything changed */
      apply(rawHoldings, goalId) {
        let changed = false;
        rawHoldings.forEach((h) => {
          if (!work.has(h.id)) return;
          const next = work.get(h.id).map((a) => ({ goalId: a.goalId === FOCUS ? goalId : a.goalId, percentage: a.percentage }));
          if (JSON.stringify(next) !== JSON.stringify(allocsOf(h).map((a) => ({ goalId: a.goalId, percentage: Number(a.percentage) || 0 })))) { h.allocations = next; changed = true; }
        });
        return changed;
      }
    };
  }

  root.KYF_ASSIGN = { mount, suggest, bucketOf, FOCUS, isUnassigned, isAssignable };
})(typeof window !== "undefined" ? window : globalThis);
