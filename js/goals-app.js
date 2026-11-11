/**
 * Goals page controller (`js/goals-app.js`)
 * Discovery first: a single "What are you saving for?" box suggests goals; the user supplies every number.
 * One unified goal list (see js/kyf-goals.js). "Saved so far" comes from Portfolio allocations.
 */
(function () {
  "use strict";

  const G = window.KYF_GOALS;
  const vault = window.KYF_VAULT;
  const $ = (id) => document.getElementById(id);

  let goals = [];
  let members = [];
  let cadence = [];
  let funding = { asOf: null, byGoal: {} };
  let settings = {};

  let statusFilter = "open";
  const expanded = new Set();

  // -------------------------------------------------------------------------
  // Formatting
  // -------------------------------------------------------------------------
  function formatINR(val, compact) {
    if (val == null || isNaN(val)) return "—";
    const num = Math.round(Number(val));
    const abs = Math.abs(num);
    const sign = num < 0 ? "-" : "";
    if (compact) {
      if (abs >= 10000000) return `${sign}₹${(abs / 10000000).toFixed(2)} Cr`;
      if (abs >= 100000) return `${sign}₹${(abs / 100000).toFixed(2)} L`;
      if (abs >= 1000) return `${sign}₹${(abs / 1000).toFixed(1)} K`;
    }
    return `${sign}₹${abs.toLocaleString("en-IN")}`;
  }

  function escapeHtml(str) {
    return String(str == null ? "" : str)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function showToast(msg) {
    let el = $("toastNotice");
    if (!el) {
      el = document.createElement("div");
      el.id = "toastNotice";
      el.className = "toast-notice";
      el.setAttribute("role", "status");
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => el.classList.remove("show"), 2600);
  }

  // -------------------------------------------------------------------------
  // Data access (shared stores via the vault)
  // -------------------------------------------------------------------------
  async function readSection(name) {
    try {
      const h = vault && vault.sections.get(name);
      return h ? await h.read() : [];
    } catch (e) {
      return [];
    }
  }

  async function loadAll() {
    goals = G.mergeGoalLists(await readSection("goals"));
    members = await readSection("members");
    cadence = await readSection("cadence");
    funding = G.readFundingCache();
    const extra = vault ? vault.getExtraData() : {};
    settings = (extra && extra.settings) || {};
  }

  async function persistGoals() {
    try {
      await vault.sections.get("goals").write(goals);
      vault.markDirty();
    } catch (e) {
      console.error("Could not save goals", e);
      showToast("Could not save — storage unavailable");
    }
  }

  function persistSettings() {
    if (vault) {
      vault.mergeExtraData({ settings });
      vault.markDirty();
    }
  }

  // -------------------------------------------------------------------------
  // Derived data
  // -------------------------------------------------------------------------
  const computed = (g) => G.computeGoal(g, funding.byGoal[g.id] || 0);

  function ownerName(g) {
    if (!g.ownerId) return "";
    const m = members.find((x) => x.id === g.ownerId);
    return m ? m.name : "";
  }

  function checklistState(g) {
    const p = G.taskProgress(cadence, g.id);
    if (p.total) return p;
    return { total: G.checklistFor(g).length, done: 0 };
  }

  // -------------------------------------------------------------------------
  // Discovery: ask box + idea chips
  // -------------------------------------------------------------------------
  let askItems = [];
  let askActive = -1;

  function renderIdeaChips() {
    const used = new Set(goals.map((g) => g.templateId).filter(Boolean));
    const groups = G.IDEA_GROUPS.map((grp) => {
      const chips = G.TEMPLATES.filter((t) => t.group === grp.id).map((t) =>
        `<button type="button" class="idea-chip" data-idea="${t.id}" title="${escapeHtml(t.blurb)}">
           <span aria-hidden="true">${t.icon}</span> ${escapeHtml(t.name)}${used.has(t.id) ? ' <span class="idea-have" aria-label="already added">✓</span>' : ""}
         </button>`).join("");
      return `<div class="idea-group"><span class="idea-group-label">${escapeHtml(grp.label)}</span>${chips}</div>`;
    }).join("");
    const open = goals.length === 0 ? " open" : "";
    $("ideaChips").innerHTML = `<details class="idea-details"${open}><summary>${goals.length ? "More ideas" : "Or pick an idea"}</summary>${groups}</details>`;
  }

  function buildAskItems(q) {
    const items = [];
    const query = q.trim().toLowerCase();
    if (!query) return items;
    goals.forEach((g) => {
      if (`${g.name} ${g.notes}`.toLowerCase().includes(query)) {
        items.push({ kind: "goal", id: g.id, icon: g.icon, label: g.name, hint: "Your goal — open it" });
      }
    });
    G.searchIdeas(query).slice(0, 4).forEach((t) => {
      items.push({ kind: "idea", id: t.id, icon: t.icon, label: t.name, hint: t.blurb });
    });
    items.push({ kind: "custom", icon: "✏️", label: `Create “${q.trim()}” as my own goal`, hint: "You set the details" });
    return items;
  }

  function renderAsk() {
    const q = $("askInput").value;
    const box = $("askResults");
    askItems = buildAskItems(q);
    askActive = askItems.length ? 0 : -1;
    $("askClearBtn").style.visibility = q ? "visible" : "hidden";
    if (!askItems.length) {
      box.hidden = true;
      $("askInput").setAttribute("aria-expanded", "false");
      return;
    }
    box.innerHTML = askItems.map((it, i) => `
      <button type="button" role="option" class="ask-item${i === askActive ? " active" : ""}" data-i="${i}">
        <span class="ask-icon" aria-hidden="true">${escapeHtml(it.icon)}</span>
        <span class="ask-text"><span class="ask-label">${escapeHtml(it.label)}</span><span class="ask-hint">${escapeHtml(it.hint)}</span></span>
      </button>`).join("");
    box.hidden = false;
    $("askInput").setAttribute("aria-expanded", "true");
  }

  function closeAsk() {
    $("askResults").hidden = true;
    $("askInput").setAttribute("aria-expanded", "false");
  }

  function pickAskItem(it) {
    const typed = $("askInput").value.trim();
    $("askInput").value = "";
    closeAsk();
    $("askClearBtn").style.visibility = "hidden";
    if (!it) return;
    if (it.kind === "goal") {
      const g = goals.find((x) => x.id === it.id);
      if (g) openDrawer(g, { isNew: false });
    } else if (it.kind === "idea") {
      startFromIdea(it.id);
    } else {
      const g = G.normalizeGoal({ name: typed, baseTargetINR: 0, targetYear: 0 });
      g.targetYear = 0;
      openDrawer(g, { isNew: true });
    }
  }

  function startFromIdea(id) {
    const t = G.templateById(id);
    if (t) openDrawer(G.goalFromIdea(t), { isNew: true });
  }

  // -------------------------------------------------------------------------
  // Goal list
  // -------------------------------------------------------------------------
  function statusLine(g, c) {
    switch (c.health) {
      case "achieved": return { cls: "done", text: "✅ Achieved" };
      case "needs_number": return { cls: "needs", text: g.kind === "COVER" ? "Needs a number — how much cover do you need?" : "Needs a number — add what it costs today" };
      case "covered": return { cls: "ok", text: "✔ Covered" };
      case "cover_gap": return { cls: "warn", text: `Cover gap ${formatINR(c.coverGap, true)}` };
      case "funded": return { cls: "ok", text: "✔ Fully funded by growth" };
      case "due": return { cls: "warn", text: `Due now — ${formatINR(c.gap, true)} short` };
      default: return { cls: "sip", text: `Needs ${formatINR(c.sip)} / month` };
    }
  }

  function rowHtml(g, c) {
    const cat = G.CATEGORIES[g.category] || G.CATEGORIES.other;
    const owner = ownerName(g);
    const st = statusLine(g, c);
    const list = checklistState(g);
    const horizonClass = g.kind === "COVER" ? "kind-cover" : (c.years <= 3 ? "horizon-short" : (c.years <= 7 ? "horizon-medium" : "horizon-long"));
    const savedParts = [];
    if (c.portfolioSaved) savedParts.push(`${formatINR(c.portfolioSaved, true)} in Portfolio`);
    if (g.manualSavedINR) savedParts.push(`${formatINR(g.manualSavedINR, true)} set aside`);
    const savedNote = savedParts.length ? savedParts.join(" + ") : "Nothing tagged yet";
    const infl = g.inflationCategory === "CUSTOM" ? "your rate" : g.inflationCategory.toLowerCase();
    const isOpen = expanded.has(g.id) ? " open" : "";

    const isCover = g.kind === "COVER";
    const coverDetail = `
        <div class="goal-math-box">
          <div class="math-item"><span class="math-lbl">Cover needed</span><span class="math-val">${formatINR(c.coverNeeded, true)}</span></div>
          <div class="math-item"><span class="math-lbl">Cover in place</span><span class="math-val">${formatINR(c.coverInPlace, true)}</span></div>
          <div class="math-item"><span class="math-lbl">Gap to close</span><span class="math-val ${c.coverGap ? "fv-val" : ""}">${c.coverGap ? formatINR(c.coverGap, true) : "None"}</span></div>
          <div class="math-item"><span class="math-lbl">Yearly premium</span><span class="math-val">${c.annualPremium ? formatINR(c.annualPremium, true) : "—"}</span></div>
        </div>
        <p class="saved-note">Protection is not funded from your portfolio: it is bought as a policy.</p>`;
    const detail = isCover && c.hasAmount ? coverDetail : c.hasAmount ? `
        <div class="goal-math-box">
          <div class="math-item"><span class="math-lbl">Cost today</span><span class="math-val">${formatINR(g.baseTargetINR, true)}</span></div>
          <div class="math-item"><span class="math-lbl">In ${g.targetYear} (${c.inflationRate}% ${escapeHtml(infl)})</span><span class="math-val fv-val">${formatINR(c.futureCost, true)}</span></div>
          <div class="math-item"><span class="math-lbl">Saved so far</span><span class="math-val">${formatINR(c.saved, true)}</span></div>
          <div class="math-item"><span class="math-lbl">Monthly SIP</span><span class="math-val sip-val">${c.sip ? formatINR(c.sip) : "—"}</span></div>
        </div>
        <p class="saved-note">${escapeHtml(savedNote)}</p>
        <div class="recipe-strip">
          <span>${escapeHtml(c.horizon.label)}:</span>
          <strong>${escapeHtml(c.horizon.recipe)}</strong>
          <span class="glide">${escapeHtml(c.glide)}</span>
        </div>` : `
        <p class="needs-help">${isCover ? "We have not sized this cover yet. Add the amount you think your family needs. Not sure? We will show you how to work it out." : "We have not priced this yet. Add what it would cost <strong>today</strong> and we will work out the rest. Not sure? We will show you how to estimate it."}</p>`;

    return `
      <details class="goal-row ${horizonClass}${g.status === "ACHIEVED" ? " status-achieved" : ""}" data-id="${escapeHtml(g.id)}"${isOpen}>
        <summary class="goal-row-head">
          <span class="row-icon" aria-hidden="true">${escapeHtml(g.icon || cat.icon)}</span>
          <span class="row-main">
            <span class="row-name">${escapeHtml(g.name)}</span>
            <span class="row-sub">${escapeHtml(isCover ? "Protection" : cat.label)}${isCover ? "" : ` &middot; ${g.targetYear ? (c.years === 0 ? "due now" : g.targetYear) : "no date"}`}${owner ? ` &middot; 👤 ${escapeHtml(owner)}` : ""}</span>
          </span>
          <span class="row-status row-status--${st.cls}">${escapeHtml(st.text)}</span>
          <span class="row-bar" aria-hidden="true"><span class="row-bar-fill" style="width:${c.hasAmount ? c.fundedPct : 0}%"></span></span>
          <span class="row-chevron" aria-hidden="true">▾</span>
        </summary>
        <div class="goal-row-body">
          ${detail}
          <div class="card-footer">
            <a class="checklist-link" href="cadence.html?goal=${encodeURIComponent(g.id)}">☑ ${list.done}/${list.total} steps</a>
            <div class="card-btns">
              ${c.hasAmount ? "" : `<button class="icon-btn primary-soft" data-action="number">➕ Add a number</button>`}
              <button class="icon-btn" data-action="toggle">${g.status === "ACHIEVED" ? "↩ Reopen" : "✅ Achieved"}</button>
              <button class="icon-btn" data-action="edit" aria-label="Edit ${escapeHtml(g.name)}">✏️ Edit</button>
              <button class="icon-btn delete" data-action="delete" aria-label="Delete ${escapeHtml(g.name)}">🗑️</button>
            </div>
          </div>
        </div>
      </details>`;
  }

  function renderMetrics() {
    const open = goals.filter((g) => g.status !== "ACHIEVED");
    const saveOpen = open.filter((g) => g.kind !== "COVER");
    const priced = saveOpen.map((g) => ({ g, c: computed(g) })).filter((x) => x.c.hasAmount);
    const unpriced = open.filter((g) => !computed(g).hasAmount).length;
    const totalFuture = priced.reduce((s, x) => s + x.c.futureCost, 0);
    const totalSavedFV = priced.reduce((s, x) => s + Math.min(x.c.savedFV, x.c.futureCost), 0);
    const afford = G.affordability(priced.map((x) => x.c), settings.monthlySurplusINR);

    $("metricTotalCount").textContent = open.length;
    $("metricTotalFV").textContent = formatINR(totalFuture, true);
    $("metricTotalSIP").textContent = formatINR(afford.totalSip, true);
    $("metricFundedPct").textContent = (totalFuture > 0 ? Math.round((totalSavedFV / totalFuture) * 100) : 0) + "%";

    const note = $("needsNumberNote");
    note.hidden = unpriced === 0;
    note.textContent = unpriced ? `${unpriced} goal${unpriced === 1 ? " needs" : "s need"} a number before ${unpriced === 1 ? "it counts" : "they count"} in these totals.` : "";

    const prot = G.protectionSummary(goals);
    const pn = $("protectionNote");
    pn.hidden = prot.total === 0;
    if (prot.total) {
      const parts = [`${prot.covered} of ${prot.total} protection goal${prot.total === 1 ? "" : "s"} covered`];
      if (prot.gaps) parts.push(`${prot.gaps} with a gap`);
      if (prot.unpriced) parts.push(`${prot.unpriced} not sized yet`);
      if (prot.annualPremiums) parts.push(`${formatINR(prot.annualPremiums, true)} a year in premiums`);
      pn.textContent = "🛡️ " + parts.join(" · ");
      pn.classList.toggle("protection-note--gap", prot.gaps + prot.unpriced > 0);
    }

    const box = $("planCheck");
    const msg = $("planCheckMsg");
    box.classList.remove("plan-check--ok", "plan-check--stretched");
    if (afford.status === "unknown") {
      msg.textContent = "Add the amount you can invest each month to see if your goals fit.";
    } else if (afford.status === "ok") {
      box.classList.add("plan-check--ok");
      msg.textContent = `Your goals need ${formatINR(afford.totalSip)} a month and you can put in ${formatINR(afford.surplus)}. The plan fits, with ${formatINR(afford.surplus - afford.totalSip)} to spare.`;
    } else {
      box.classList.add("plan-check--stretched");
      const worst = priced.filter((x) => x.c.sip > 0 && x.g.priority !== "ESSENTIAL").sort((a, b) => b.c.sip - a.c.sip)[0];
      const tip = worst ? ` Easing “${worst.g.name}” is the quickest way to close the gap.` : " Consider moving a goal later or shrinking it.";
      msg.textContent = `Your goals need ${formatINR(afford.totalSip)} a month but you can put in ${formatINR(afford.surplus)} — short by ${formatINR(afford.totalSip - afford.surplus)}.${tip}`;
    }
  }

  function render() {
    renderIdeaChips();
    const has = goals.length > 0;
    $("planSection").hidden = !has;
    $("goalsSection").hidden = !has;
    if (!has) return;
    renderMetrics();

    const rank = { ESSENTIAL: 0, IMPORTANT: 1, FLEXIBLE: 2 };
    const shown = goals
      .map((g) => ({ g, c: computed(g) }))
      .filter((x) => (statusFilter === "all") || (statusFilter === "achieved" ? x.g.status === "ACHIEVED" : x.g.status !== "ACHIEVED"))
      .sort((a, b) => ((a.g.kind === "COVER" ? 0 : 1) - (b.g.kind === "COVER" ? 0 : 1)) || (rank[a.g.priority] - rank[b.g.priority]) || ((a.g.targetYear || 9999) - (b.g.targetYear || 9999)));

    $("goalList").innerHTML = shown.map((x) => rowHtml(x.g, x.c)).join("");
    $("noMatchState").hidden = shown.length > 0;
  }

  // -------------------------------------------------------------------------
  // Drawer (add / edit)
  // -------------------------------------------------------------------------
  const overlay = $("goalModalOverlay");
  let currentIdea = null;

  function fillSelects() {
    $("goalCategoryInput").innerHTML = Object.entries(G.CATEGORIES)
      .map(([k, v]) => `<option value="${k}">${v.icon} ${escapeHtml(v.label)}</option>`).join("");
    $("goalPriorityInput").innerHTML = Object.entries(G.PRIORITIES)
      .map(([k, v]) => `<option value="${k}">${escapeHtml(v)}</option>`).join("");
    $("goalOwnerInput").innerHTML = `<option value="">Whole family</option>` +
      members.map((m) => `<option value="${escapeHtml(m.id)}">${escapeHtml(m.name)}</option>`).join("");
    const cities = G.residexCities();
    $("residexCity").innerHTML = cities.map((c) => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join("");
    if (cities.includes("Bengaluru")) $("residexCity").value = "Bengaluru";
  }

  function applyKind(kind) {
    const cover = kind === "COVER";
    $("goalKind").value = cover ? "COVER" : "SAVE";
    document.querySelectorAll('#goalForm [data-kind="save"]').forEach((el) => { el.hidden = cover; });
    document.querySelectorAll('#goalForm [data-kind="cover"]').forEach((el) => { el.hidden = !cover; });
    $("goalYearInput").required = !cover;
    $("goalOwnerLabel").textContent = cover ? "Who is covered?" : "Whose goal?";
    $("helpToggleBtn").textContent = cover ? "Not sure how much cover? Help me work it out" : "Not sure of the number? Help me work it out";
    if (cover) $("customInflationGroup").hidden = true;
  }

  function setForm(g) {
    applyKind(g.kind);
    $("coverNeededInput").value = g.coverNeededINR || "";
    $("coverInPlaceInput").value = g.coverInPlaceINR || 0;
    $("coverPremiumInput").value = g.annualPremiumINR || 0;
    $("goalId").value = g.id || "";
    $("goalTemplateId").value = g.templateId || "";
    $("goalTitleInput").value = g.name || "";
    $("goalCategoryInput").value = g.category || "other";
    $("goalPriorityInput").value = g.priority || "IMPORTANT";
    $("goalOwnerInput").value = g.ownerId || "";
    $("goalYearInput").value = g.targetYear || "";
    $("goalYearInput").min = new Date().getFullYear();
    $("goalPvInput").value = g.baseTargetINR || "";
    $("goalSavedInput").value = g.manualSavedINR || 0;
    $("goalInflationInput").value = g.inflationCategory || "CPI";
    $("goalCustomRateInput").value = g.inflationRate != null ? g.inflationRate : 6;
    $("goalReturnInput").value = g.expectedReturn != null ? g.expectedReturn : "";
    $("goalDescInput").value = g.notes || "";
    $("moreOptions").open = false;
    syncInflationField();
    setupHelp(g);
    updatePreview();
  }

  function retirementForGoal() {
    if ($("retireHelper").hidden) return undefined;
    const i = retirementInputs();
    if (!(Number(i.age) > 0)) return undefined;
    return {
      birthYear: new Date().getFullYear() - Number(i.age), retireAge: i.retireAge, lifeExpectancy: i.lifeExpectancy,
      yearlyExpensesToday: i.yearlyExpensesToday, pctNeeded: i.pctNeeded, postReturn: i.postReturn
    };
  }

  function readForm() {
    const existing = goals.find((x) => x.id === $("goalId").value);
    const ret = $("goalReturnInput").value;
    const year = Number($("goalYearInput").value) || 0;
    const g = G.normalizeGoal({
      id: $("goalId").value || undefined,
      name: $("goalTitleInput").value.trim(),
      category: $("goalCategoryInput").value,
      icon: existing ? existing.icon : (currentIdea ? currentIdea.icon : (G.CATEGORIES[$("goalCategoryInput").value] || {}).icon),
      priority: $("goalPriorityInput").value,
      status: existing ? existing.status : "ACTIVE",
      ownerId: $("goalOwnerInput").value,
      targetYear: year,
      baseTargetINR: Number($("goalPvInput").value) || 0,
      manualSavedINR: Number($("goalSavedInput").value) || 0,
      inflationCategory: $("goalInflationInput").value,
      inflationRate: Number($("goalCustomRateInput").value),
      expectedReturn: ret === "" ? null : Number(ret),
      notes: $("goalDescInput").value.trim(),
      templateId: $("goalTemplateId").value,
      retirement: retirementForGoal(),
      kind: $("goalKind").value,
      coverNeededINR: Number($("coverNeededInput").value) || 0,
      coverInPlaceINR: Number($("coverInPlaceInput").value) || 0,
      annualPremiumINR: Number($("coverPremiumInput").value) || 0,
      createdAt: existing ? existing.createdAt : undefined
    });
    if (g && g.kind !== "COVER") g.targetYear = year;
    return g;
  }

  function syncInflationField() {
    $("customInflationGroup").hidden = $("goalInflationInput").value !== "CUSTOM";
  }

  function updatePreview() {
    const g = readForm();
    if (g && g.kind === "COVER") return;
    const ready = g && g.baseTargetINR > 0 && g.targetYear >= new Date().getFullYear();
    if (!ready) {
      $("prevFv").textContent = $("prevGap").textContent = $("prevSip").textContent = "—";
    } else {
      const c = G.computeGoal(g, funding.byGoal[g.id] || 0);
      $("prevFv").textContent = formatINR(c.futureCost, true);
      $("prevGap").textContent = formatINR(c.gap, true);
      $("prevSip").textContent = c.sip ? formatINR(c.sip) + " /mo" : "—";
      $("goalReturnHint").textContent = `Leave blank for ${c.horizon.expectedReturn}% (${c.horizon.label.toLowerCase()}).`;
    }
    const pf = g ? (funding.byGoal[g.id] || 0) : 0;
    $("goalPortfolioHint").textContent = pf
      ? `Plus ${formatINR(pf, true)} already tagged to this goal in Portfolio.`
      : "Money tagged to this goal in Portfolio is added automatically.";
  }

  // --- "Help me work it out" ------------------------------------------------
  function setupHelp(g) {
    const idea = g.templateId ? G.templateById(g.templateId) : null;
    currentIdea = idea;
    $("helpPanel").hidden = true;
    $("helpToggleBtn").setAttribute("aria-expanded", "false");
    $("helpIntro").textContent = idea
      ? "Here is how to find a realistic number. You decide the final figure."
      : "Think of what you would pay if you did this today, then enter that total. We add inflation for you.";
    $("helpList").innerHTML = (idea ? idea.ask : ["Price it as if you were buying it today", "Include fees, taxes and running costs", "Ask someone who has done the same recently"])
      .map((a) => `<li>${escapeHtml(a)}</li>`).join("");
    $("helpFormula").textContent = idea && idea.formula ? `The sum: ${idea.formula}` : "";
    $("residexHelper").hidden = !(idea && idea.helper === "residex" && G.residexCities().length);
    $("retireHelper").hidden = !(idea && idea.helper === "retirement");
    $("termHelper").hidden = !(idea && idea.helper === "term");
    fillRetirement(g);
    updateTerm();
    updateResidex();
    updateRetirement();
  }

  function updateResidex() {
    if ($("residexHelper").hidden) return;
    const est = G.residexEstimate($("residexCity").value, $("residexSqft").value, $("residexDown").value);
    const out = $("residexResult");
    const buttons = [$("useDownPaymentBtn"), $("useFullCostBtn")];
    if (!est) {
      out.textContent = "Enter a carpet area to see an estimate.";
      buttons.forEach((b) => { b.disabled = true; });
      return;
    }
    buttons.forEach((b) => { b.disabled = false; });
    out.innerHTML = `${escapeHtml(est.city)} carpet rate (NHB RESIDEX${est.quarter ? ", " + escapeHtml(est.quarter) : ""}): <strong>${formatINR(est.ratePerSqft)}/sq ft</strong>.
      ${est.carpetSqft.toLocaleString("en-IN")} sq ft &asymp; <strong>${formatINR(est.price, true)}</strong>, plus about ${formatINR(est.friction, true)} stamp duty &amp; registration.
      A ${est.downPaymentPct}% down payment with those costs is <strong>${formatINR(est.downPayment, true)}</strong>.
      <span class="residex-note">Index-based average, not a quote for a specific home.</span>`;
  }

  // --- Term cover helper ---------------------------------------------------
  const TERM_IDS = ["termIncome", "termLoans", "termGoals", "termExpenses", "termYears", "termOffset"];

  function termPlan() {
    return G.termCoverPlan({
      yearlyIncome: $("termIncome").value, loans: $("termLoans").value, goalsToFund: $("termGoals").value,
      yearlyFamilyExpenses: $("termExpenses").value, yearsOfSupport: $("termYears").value,
      savings: $("termOffset").value, existingCover: 0
    });
  }

  function updateTerm() {
    if ($("termHelper").hidden) return;
    const plan = termPlan();
    const out = $("termResult");
    $("useTermNeedsBtn").disabled = !(plan && plan.needsBased > 0);
    $("useTermRuleBtn").disabled = !(plan && plan.ruleHigh > 0);
    if (!plan) {
      out.textContent = "Fill in your income or the family's needs to see two ways of sizing the cover.";
      return;
    }
    const lines = [];
    if (plan.ruleHigh > 0) lines.push(`<strong>Rule of thumb:</strong> 10–15× yearly income = ${formatINR(plan.ruleLow, true)} to ${formatINR(plan.ruleHigh, true)}.`);
    if (plan.gross > 0) {
      lines.push(`<strong>Needs-based:</strong> loans ${formatINR(plan.loans, true)} + goals ${formatINR(plan.goalsToFund, true)} + living costs ${formatINR(plan.living, true)}${plan.offset ? ` − savings and cover ${formatINR(plan.offset, true)}` : ""} = <strong>${formatINR(plan.needsBased, true)}</strong>.`);
    }
    out.innerHTML = lines.join("<br>");
  }

  function addUpOpenGoals() {
    const total = goals.filter((g) => g.kind !== "COVER" && g.status !== "ACHIEVED").reduce((s, g) => s + (g.baseTargetINR || 0), 0);
    $("termGoals").value = total;
    updateTerm();
    showToast(total ? `Added ${formatINR(total, true)} from your open goals` : "No priced goals to add yet");
  }

  function applyTerm(which) {
    const plan = termPlan();
    if (!plan) return;
    $("coverNeededInput").value = which === "rule" ? plan.ruleHigh : plan.needsBased;
  }

  // --- Retirement helper ---------------------------------------------------
  const RET_IDS = ["retireAge", "retireAt", "retireTill", "retireExpenses", "retirePct", "retireReturn"];

  function fillRetirement(g) {
    const r = g.retirement || {};
    const year = new Date().getFullYear();
    $("retireAge").value = r.birthYear ? year - r.birthYear : "";
    $("retireAt").value = r.retireAge != null ? r.retireAge : "";
    $("retireTill").value = r.lifeExpectancy != null ? r.lifeExpectancy : 90;
    $("retireExpenses").value = r.yearlyExpensesToday != null ? r.yearlyExpensesToday : "";
    $("retirePct").value = r.pctNeeded != null ? r.pctNeeded : 80;
    $("retireReturn").value = r.postReturn != null ? r.postReturn : 7;
  }

  function retirementInputs() {
    return {
      age: $("retireAge").value, retireAge: $("retireAt").value, lifeExpectancy: $("retireTill").value,
      yearlyExpensesToday: $("retireExpenses").value, pctNeeded: $("retirePct").value, postReturn: $("retireReturn").value
    };
  }

  function currentRetirementPlan() {
    const inflation = G.inflationFor(readForm());
    return G.retirementPlan(retirementInputs(), inflation);
  }

  function updateRetirement() {
    if ($("retireHelper").hidden) return;
    const plan = currentRetirementPlan();
    const out = $("retireResult");
    const btn = $("useRetirementBtn");
    if (!plan) {
      out.textContent = "Fill in your age, when you want to retire, how long to plan for, and yearly expenses to see the corpus.";
      btn.disabled = true;
      return;
    }
    btn.disabled = false;
    const infl = G.inflationFor(readForm());
    out.innerHTML = `You would live off your savings for <strong>${plan.retirementYears} years</strong>, starting in <strong>${plan.retireYear}</strong>, when today's ${formatINR(plan.yearlyNeedToday, true)} a year becomes about <strong>${formatINR(plan.yearlyAtRetirement, true)}</strong> at ${infl}% inflation.
      The corpus that pays for it is <strong>${formatINR(plan.corpusToday, true)}</strong> in today's money
      (${formatINR(plan.corpusAtRetirement, true)} by then) &mdash; about <strong>${plan.multiple}&times;</strong> your yearly expenses. The usual 25&ndash;30&times; rule is a quick check on that.`;
  }

  function applyRetirement() {
    const plan = currentRetirementPlan();
    if (!plan) return;
    $("goalPvInput").value = plan.corpusToday;
    $("goalYearInput").value = plan.retireYear;
    updatePreview();
  }

  function applyResidex(which) {
    const est = G.residexEstimate($("residexCity").value, $("residexSqft").value, $("residexDown").value);
    if (!est) return;
    $("goalPvInput").value = which === "full" ? est.fullCost : est.downPayment;
    updatePreview();
  }

  function openDrawer(g, opts) {
    const isNew = !!(opts && opts.isNew);
    $("modalTitle").textContent = isNew ? "New goal" : "Edit goal";
    $("saveGoalBtn").textContent = isNew ? "Save goal" : "Save changes";
    setForm(g);
    if (opts && opts.openHelp) {
      $("helpPanel").hidden = false;
      $("helpToggleBtn").setAttribute("aria-expanded", "true");
    }
    overlay.classList.add("open");
    setTimeout(() => (g.name ? (g.kind === "COVER" ? $("coverNeededInput") : $("goalYearInput")) : $("goalTitleInput")).focus(), 60);
  }

  function closeDrawer() {
    overlay.classList.remove("open");
  }

  // -------------------------------------------------------------------------
  // Events
  // -------------------------------------------------------------------------
  function bindEvents() {
    // Ask box
    const ask = $("askInput");
    ask.addEventListener("input", renderAsk);
    ask.addEventListener("keydown", (e) => {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        if (!askItems.length) return;
        e.preventDefault();
        askActive = (askActive + (e.key === "ArrowDown" ? 1 : -1) + askItems.length) % askItems.length;
        $("askResults").querySelectorAll(".ask-item").forEach((el, i) => el.classList.toggle("active", i === askActive));
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (askItems.length) pickAskItem(askItems[Math.max(0, askActive)]);
      } else if (e.key === "Escape") {
        closeAsk();
      }
    });
    $("askResults").addEventListener("mousedown", (e) => {
      const b = e.target.closest(".ask-item");
      if (b) { e.preventDefault(); pickAskItem(askItems[Number(b.dataset.i)]); }
    });
    $("askClearBtn").addEventListener("click", () => { ask.value = ""; renderAsk(); ask.focus(); });
    ask.addEventListener("blur", () => setTimeout(closeAsk, 120));
    $("askClearBtn").style.visibility = "hidden";

    $("ideaChips").addEventListener("click", (e) => {
      const b = e.target.closest("[data-idea]");
      if (b) startFromIdea(b.dataset.idea);
    });

    // Drawer
    $("closeGoalModalBtn").addEventListener("click", closeDrawer);
    $("cancelGoalModalBtn").addEventListener("click", closeDrawer);
    overlay.addEventListener("click", (e) => { if (e.target === overlay) closeDrawer(); });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && overlay.classList.contains("open")) closeDrawer(); });

    $("helpToggleBtn").addEventListener("click", () => {
      const hidden = $("helpPanel").hidden;
      $("helpPanel").hidden = !hidden;
      $("helpToggleBtn").setAttribute("aria-expanded", String(hidden));
    });
    ["residexCity", "residexSqft", "residexDown"].forEach((id) => $(id).addEventListener("input", updateResidex));
    TERM_IDS.forEach((id) => $(id).addEventListener("input", updateTerm));
    $("termFromGoalsBtn").addEventListener("click", addUpOpenGoals);
    $("useTermNeedsBtn").addEventListener("click", () => applyTerm("needs"));
    $("useTermRuleBtn").addEventListener("click", () => applyTerm("rule"));
    RET_IDS.forEach((id) => $(id).addEventListener("input", updateRetirement));
    $("useRetirementBtn").addEventListener("click", applyRetirement);
    $("useDownPaymentBtn").addEventListener("click", () => applyResidex("down"));
    $("useFullCostBtn").addEventListener("click", () => applyResidex("full"));

    $("goalInflationInput").addEventListener("change", () => { syncInflationField(); updatePreview(); updateRetirement(); });
    ["goalYearInput", "goalPvInput", "goalSavedInput", "goalCustomRateInput", "goalReturnInput"].forEach((id) =>
      $(id).addEventListener("input", updatePreview));

    $("goalForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const g = readForm();
      if (!g || !g.name || (g.kind !== "COVER" && g.targetYear < new Date().getFullYear())) return;
      const i = goals.findIndex((x) => x.id === g.id);
      if (i >= 0) goals[i] = g; else goals.push(g);
      expanded.add(g.id);
      await persistGoals();
      closeDrawer();
      render();
      showToast((g.kind === "COVER" ? g.coverNeededINR > 0 : g.baseTargetINR > 0) ? (i >= 0 ? "✓ Goal updated" : "✓ Goal added") : "✓ Goal added — add a number when you are ready");
    });

    // Goal rows
    $("goalList").addEventListener("toggle", (e) => {
      const row = e.target.closest && e.target.closest(".goal-row");
      if (!row) return;
      if (row.open) expanded.add(row.dataset.id); else expanded.delete(row.dataset.id);
    }, true);
    $("goalList").addEventListener("click", async (e) => {
      const btn = e.target.closest("[data-action]");
      const row = e.target.closest(".goal-row");
      if (!btn || !row) return;
      const g = goals.find((x) => x.id === row.dataset.id);
      if (!g) return;
      const action = btn.dataset.action;
      if (action === "edit") {
        openDrawer(g, { isNew: false });
      } else if (action === "number") {
        openDrawer(g, { isNew: false, openHelp: true });
        setTimeout(() => (g.kind === "COVER" ? $("coverNeededInput") : $("goalPvInput")).focus(), 80);
      } else if (action === "toggle") {
        g.status = g.status === "ACHIEVED" ? "ACTIVE" : "ACHIEVED";
        await persistGoals();
        render();
        showToast(g.status === "ACHIEVED" ? "🎉 Marked as achieved" : "Goal reopened");
      } else if (action === "delete") {
        if (!window.confirm(`Delete “${g.name}”? Holdings tagged to it become unallocated.`)) return;
        goals = goals.filter((x) => x.id !== g.id);
        await persistGoals();
        render();
        showToast("Goal deleted");
      }
    });

    document.querySelectorAll(".filter-pill[data-status]").forEach((b) => b.addEventListener("click", () => {
      document.querySelectorAll(".filter-pill[data-status]").forEach((x) => x.classList.remove("active"));
      b.classList.add("active");
      statusFilter = b.dataset.status;
      render();
    }));

    $("surplusInput").addEventListener("input", (e) => {
      const v = Number(e.target.value);
      settings = Object.assign({}, settings, { monthlySurplusINR: v > 0 ? v : 0 });
      persistSettings();
      renderMetrics();
    });
  }

  // -------------------------------------------------------------------------
  // Boot
  // -------------------------------------------------------------------------
  async function init() {
    await loadAll();
    fillSelects();
    if (settings.monthlySurplusINR) $("surplusInput").value = settings.monthlySurplusINR;
    bindEvents();
    render();

    if (vault) {
      vault.registerPageHook({
        pageName: "goals",
        getLocalData: () => ({ goals, settings }),
        onAfterOpen: async () => {
          await loadAll();
          fillSelects();
          $("surplusInput").value = settings.monthlySurplusINR || "";
          render();
        }
      });
      vault.bindPageUI({ fileInputId: "kyfFileInput", openBtnId: "navOpenFileBtn", saveBtnId: "navSaveDataBtn" });
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
