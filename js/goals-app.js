/**
 * Goals page controller (`js/goals-app.js`)
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

  let searchTerm = "";
  let statusFilter = "open";
  let horizonFilter = "all";

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
  function computed(g) {
    return G.computeGoal(g, funding.byGoal[g.id] || 0);
  }

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

  function matches(g, c) {
    if (statusFilter === "open" && g.status === "ACHIEVED") return false;
    if (statusFilter === "achieved" && g.status !== "ACHIEVED") return false;
    if (horizonFilter === "short" && c.years > 3) return false;
    if (horizonFilter === "medium" && (c.years <= 3 || c.years > 7)) return false;
    if (horizonFilter === "long" && c.years <= 7) return false;
    if (searchTerm) {
      const cat = (G.CATEGORIES[g.category] || {}).label || "";
      const hay = `${g.name} ${g.notes} ${cat} ${ownerName(g)}`.toLowerCase();
      if (!hay.includes(searchTerm)) return false;
    }
    return true;
  }

  // -------------------------------------------------------------------------
  // Rendering
  // -------------------------------------------------------------------------
  function healthBadge(g, c) {
    if (c.health === "achieved") return `<span class="health health--done">✅ Achieved</span>`;
    if (c.health === "funded") return `<span class="health health--ok">✔ Fully funded by growth</span>`;
    if (c.health === "due") return `<span class="health health--warn">Due now — ${formatINR(c.gap, true)} short</span>`;
    return `<span class="health health--sip">Needs ${formatINR(c.sip)} / month</span>`;
  }

  function cardHtml(g, c) {
    const cat = G.CATEGORIES[g.category] || G.CATEGORIES.other;
    const horizonClass = c.years <= 3 ? "horizon-short" : (c.years <= 7 ? "horizon-medium" : "horizon-long");
    const owner = ownerName(g);
    const list = checklistState(g);
    const savedParts = [];
    if (c.portfolioSaved) savedParts.push(`${formatINR(c.portfolioSaved, true)} in Portfolio`);
    if (g.manualSavedINR) savedParts.push(`${formatINR(g.manualSavedINR, true)} set aside`);
    const savedNote = savedParts.length ? savedParts.join(" + ") : "Nothing tagged yet";
    const infl = g.inflationCategory === "CUSTOM" ? "your rate" : g.inflationCategory.toLowerCase();

    return `
      <article class="goal-card ${horizonClass} ${g.status === "ACHIEVED" ? "status-achieved" : ""}" data-id="${escapeHtml(g.id)}">
        <div>
          <div class="card-head">
            <div class="card-meta">
              <span class="tag-cat">${escapeHtml(cat.label)}</span>
              <span class="tag-horizon">${c.years === 0 ? "Due now" : c.years + " yrs"} &middot; ${g.targetYear}</span>
              ${owner ? `<span class="tag-owner">👤 ${escapeHtml(owner)}</span>` : ""}
            </div>
            <div class="card-icon" aria-hidden="true">${escapeHtml(g.icon || cat.icon)}</div>
          </div>

          <h3>${escapeHtml(g.name)}</h3>
          ${g.notes ? `<p class="goal-desc">${escapeHtml(g.notes)}</p>` : ""}

          <div class="goal-math-box">
            <div class="math-item"><span class="math-lbl">Cost today</span><span class="math-val">${formatINR(g.baseTargetINR, true)}</span></div>
            <div class="math-item"><span class="math-lbl">In ${g.targetYear} (${c.inflationRate}% ${escapeHtml(infl)})</span><span class="math-val fv-val">${formatINR(c.futureCost, true)}</span></div>
            <div class="math-item"><span class="math-lbl">Saved so far</span><span class="math-val">${formatINR(c.saved, true)}</span></div>
            <div class="math-item"><span class="math-lbl">Monthly SIP</span><span class="math-val sip-val">${c.sip ? formatINR(c.sip) : "—"}</span></div>
          </div>

          <div class="progress-section">
            <div class="progress-labels">
              <span>${healthBadge(g, c)}</span>
              <span>${c.fundedPct}% of future cost</span>
            </div>
            <div class="progress-bar-wrap"><div class="progress-bar-fill ${g.status === "ACHIEVED" ? "achieved" : ""}" style="width:${c.fundedPct}%"></div></div>
            <p class="saved-note">${escapeHtml(savedNote)}</p>
          </div>

          <div class="recipe-strip">
            <span>${escapeHtml(c.horizon.label)}:</span>
            <strong>${escapeHtml(c.horizon.recipe)}</strong>
            <span class="glide">${escapeHtml(c.glide)}</span>
          </div>
        </div>

        <div class="card-footer">
          <a class="checklist-link" href="cadence.html?goal=${encodeURIComponent(g.id)}">☑ ${list.done}/${list.total} steps</a>
          <div class="card-btns">
            <button class="icon-btn" data-action="toggle">${g.status === "ACHIEVED" ? "↩ Reopen" : "✅ Achieved"}</button>
            <button class="icon-btn" data-action="edit" aria-label="Edit ${escapeHtml(g.name)}">✏️ Edit</button>
            <button class="icon-btn delete" data-action="delete" aria-label="Delete ${escapeHtml(g.name)}">🗑️</button>
          </div>
        </div>
      </article>`;
  }

  function renderMetrics() {
    const open = goals.filter((g) => g.status !== "ACHIEVED");
    const list = open.map((g) => ({ g, c: computed(g) }));
    const totalNow = list.reduce((s, x) => s + x.g.baseTargetINR, 0);
    const totalFuture = list.reduce((s, x) => s + x.c.futureCost, 0);
    const totalSavedFV = list.reduce((s, x) => s + Math.min(x.c.savedFV, x.c.futureCost), 0);
    const afford = G.affordability(list.map((x) => x.c), settings.monthlySurplusINR);

    $("metricTotalCount").textContent = open.length;
    $("metricTotalPV").textContent = formatINR(totalNow, true);
    $("metricTotalFV").textContent = formatINR(totalFuture, true);
    $("metricTotalSIP").textContent = formatINR(afford.totalSip, true);
    $("metricFundedPct").textContent = (totalFuture > 0 ? Math.round((totalSavedFV / totalFuture) * 100) : 0) + "%";

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
      const worst = list.filter((x) => x.c.sip > 0 && x.g.priority !== "ESSENTIAL").sort((a, b) => b.c.sip - a.c.sip)[0];
      const tip = worst ? ` Easing “${worst.g.name}” is the quickest way to close the gap.` : " Consider moving a goal later or shrinking it.";
      msg.textContent = `Your goals need ${formatINR(afford.totalSip)} a month but you can put in ${formatINR(afford.surplus)} — short by ${formatINR(afford.totalSip - afford.surplus)}.${tip}`;
    }
  }

  function renderTemplates() {
    const have = new Set(goals.map((g) => g.templateId).filter(Boolean));
    $("templateGrid").innerHTML = G.TEMPLATES.map((t) => `
      <button type="button" class="template-card" data-template="${t.id}" ${have.has(t.id) ? "disabled" : ""}>
        <span class="template-icon" aria-hidden="true">${t.icon}</span>
        <span class="template-name">${escapeHtml(t.name)}</span>
        <span class="template-meta">${formatINR(t.costToday, true)} &middot; ${t.years} yr${t.years > 1 ? "s" : ""}</span>
      </button>`).join("");
  }

  function render() {
    renderMetrics();
    renderTemplates();

    // Nothing to summarise until the first goal exists
    document.querySelector(".metric-strip").hidden = goals.length === 0;
    $("planCheck").hidden = goals.length === 0;
    $("discoverPanel").hidden = goals.length > 0;
    $("goalSections").hidden = goals.length === 0;

    const buckets = { ESSENTIAL: [], IMPORTANT: [], FLEXIBLE: [] };
    let shown = 0;
    goals.forEach((g) => {
      const c = computed(g);
      if (!matches(g, c)) return;
      shown++;
      (buckets[g.priority] || buckets.IMPORTANT).push({ g, c });
    });

    Object.keys(buckets).forEach((p) => {
      const items = buckets[p].sort((a, b) => a.g.targetYear - b.g.targetYear);
      $("grid" + p).innerHTML = items.map((x) => cardHtml(x.g, x.c)).join("");
      $("count" + p).textContent = `${items.length} goal${items.length === 1 ? "" : "s"}`;
      $("group" + p).hidden = items.length === 0;
    });
    $("noMatchState").hidden = !(goals.length > 0 && shown === 0);
  }

  // -------------------------------------------------------------------------
  // Drawer (add / edit)
  // -------------------------------------------------------------------------
  const overlay = $("goalModalOverlay");

  function fillSelects() {
    $("goalCategoryInput").innerHTML = Object.entries(G.CATEGORIES)
      .map(([k, v]) => `<option value="${k}">${v.icon} ${escapeHtml(v.label)}</option>`).join("");
    $("goalPriorityInput").innerHTML = Object.entries(G.PRIORITIES)
      .map(([k, v]) => `<option value="${k}">${escapeHtml(v)}</option>`).join("");
    $("goalOwnerInput").innerHTML = `<option value="">Whole family</option>` +
      members.map((m) => `<option value="${escapeHtml(m.id)}">${escapeHtml(m.name)}</option>`).join("");
    $("templateChips").innerHTML = G.TEMPLATES.map((t) =>
      `<button type="button" class="filter-pill" data-template="${t.id}">${t.icon} ${escapeHtml(t.name)}</button>`).join("");
  }

  function setForm(g) {
    $("goalId").value = g.id || "";
    $("goalTemplateId").value = g.templateId || "";
    $("goalTitleInput").value = g.name || "";
    $("goalCategoryInput").value = g.category || "other";
    $("goalPriorityInput").value = g.priority || "IMPORTANT";
    $("goalOwnerInput").value = g.ownerId || "";
    $("goalYearInput").value = g.targetYear;
    $("goalPvInput").value = g.baseTargetINR || "";
    $("goalSavedInput").value = g.manualSavedINR || 0;
    $("goalInflationInput").value = g.inflationCategory || "CPI";
    $("goalCustomRateInput").value = g.inflationRate != null ? g.inflationRate : 6;
    $("goalReturnInput").value = g.expectedReturn != null ? g.expectedReturn : "";
    $("goalDescInput").value = g.notes || "";
    syncInflationField();
    updatePreview();
  }

  function readForm() {
    const existing = goals.find((x) => x.id === $("goalId").value);
    const ret = $("goalReturnInput").value;
    return G.normalizeGoal({
      id: $("goalId").value || undefined,
      name: $("goalTitleInput").value.trim(),
      category: $("goalCategoryInput").value,
      icon: existing ? existing.icon : (G.CATEGORIES[$("goalCategoryInput").value] || {}).icon,
      priority: $("goalPriorityInput").value,
      status: existing ? existing.status : "ACTIVE",
      ownerId: $("goalOwnerInput").value,
      targetYear: Number($("goalYearInput").value),
      baseTargetINR: Number($("goalPvInput").value),
      manualSavedINR: Number($("goalSavedInput").value) || 0,
      inflationCategory: $("goalInflationInput").value,
      inflationRate: Number($("goalCustomRateInput").value),
      expectedReturn: ret === "" ? null : Number(ret),
      notes: $("goalDescInput").value.trim(),
      templateId: $("goalTemplateId").value,
      createdAt: existing ? existing.createdAt : undefined
    });
  }

  function syncInflationField() {
    $("customInflationGroup").hidden = $("goalInflationInput").value !== "CUSTOM";
  }

  function updatePreview() {
    const g = readForm();
    if (!g || !(g.baseTargetINR > 0)) {
      $("prevFv").textContent = $("prevGap").textContent = $("prevSip").textContent = "₹0";
      return;
    }
    const c = G.computeGoal(g, funding.byGoal[g.id] || 0);
    $("prevFv").textContent = formatINR(c.futureCost, true);
    $("prevGap").textContent = formatINR(c.gap, true);
    $("prevSip").textContent = c.sip ? formatINR(c.sip) + " /mo" : "—";
    $("goalReturnHint").textContent = `Leave blank for ${c.horizon.expectedReturn}% (${c.horizon.label.toLowerCase()}).`;
    const pf = funding.byGoal[g.id] || 0;
    $("goalPortfolioHint").textContent = pf
      ? `Plus ${formatINR(pf, true)} already tagged to this goal in Portfolio.`
      : "Money tagged to this goal in Portfolio is added automatically.";
  }

  function openDrawer(g, isNew) {
    $("modalTitle").textContent = isNew ? "Add a goal" : "Edit goal";
    $("saveGoalBtn").textContent = isNew ? "Save goal" : "Save changes";
    $("templatePick").hidden = !isNew;
    setForm(g);
    overlay.classList.add("open");
    setTimeout(() => $("goalTitleInput").focus(), 60);
  }

  function closeDrawer() {
    overlay.classList.remove("open");
  }

  function blankGoal() {
    return G.normalizeGoal({
      name: "", category: "other", priority: "IMPORTANT", baseTargetINR: 0,
      targetYear: new Date().getFullYear() + 5, inflationCategory: "CPI"
    });
  }

  function addFromTemplate(templateId) {
    const t = G.templateById(templateId);
    if (!t) return;
    openDrawer(G.goalFromTemplate(t), true);
  }

  // -------------------------------------------------------------------------
  // Events
  // -------------------------------------------------------------------------
  function bindEvents() {
    $("openAddModalBtn").addEventListener("click", () => openDrawer(blankGoal(), true));
    $("customGoalBtn").addEventListener("click", () => openDrawer(blankGoal(), true));
    $("closeGoalModalBtn").addEventListener("click", closeDrawer);
    $("cancelGoalModalBtn").addEventListener("click", closeDrawer);
    overlay.addEventListener("click", (e) => { if (e.target === overlay) closeDrawer(); });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeDrawer(); });

    $("templateGrid").addEventListener("click", (e) => {
      const b = e.target.closest("[data-template]");
      if (b && !b.disabled) addFromTemplate(b.dataset.template);
    });
    $("templateChips").addEventListener("click", (e) => {
      const b = e.target.closest("[data-template]");
      if (b) addFromTemplate(b.dataset.template);
    });

    $("goalInflationInput").addEventListener("change", () => { syncInflationField(); updatePreview(); });
    ["goalYearInput", "goalPvInput", "goalSavedInput", "goalCustomRateInput", "goalReturnInput"].forEach((id) =>
      $(id).addEventListener("input", updatePreview));

    $("goalForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const g = readForm();
      if (!g || !g.name || !(g.baseTargetINR > 0)) return;
      const i = goals.findIndex((x) => x.id === g.id);
      if (i >= 0) goals[i] = g; else goals.push(g);
      await persistGoals();
      closeDrawer();
      render();
      showToast(i >= 0 ? "✓ Goal updated" : "✓ Goal added");
    });

    $("goalSections").addEventListener("click", async (e) => {
      const btn = e.target.closest("[data-action]");
      const card = e.target.closest(".goal-card");
      if (!btn || !card) return;
      const g = goals.find((x) => x.id === card.dataset.id);
      if (!g) return;
      if (btn.dataset.action === "edit") {
        openDrawer(g, false);
      } else if (btn.dataset.action === "toggle") {
        g.status = g.status === "ACHIEVED" ? "ACTIVE" : "ACHIEVED";
        await persistGoals();
        render();
        showToast(g.status === "ACHIEVED" ? "🎉 Marked as achieved" : "Goal reopened");
      } else if (btn.dataset.action === "delete") {
        if (!window.confirm(`Delete “${g.name}”? Holdings tagged to it become unallocated.`)) return;
        goals = goals.filter((x) => x.id !== g.id);
        await persistGoals();
        render();
        showToast("Goal deleted");
      }
    });

    $("searchInput").addEventListener("input", (e) => {
      searchTerm = e.target.value.trim().toLowerCase();
      render();
    });
    $("searchClearBtn").addEventListener("click", () => {
      $("searchInput").value = "";
      searchTerm = "";
      render();
    });

    document.querySelectorAll(".filter-pill[data-status]").forEach((b) => b.addEventListener("click", () => {
      document.querySelectorAll(".filter-pill[data-status]").forEach((x) => x.classList.remove("active"));
      b.classList.add("active");
      statusFilter = b.dataset.status;
      render();
    }));
    document.querySelectorAll(".filter-pill[data-horizon]").forEach((b) => b.addEventListener("click", () => {
      document.querySelectorAll(".filter-pill[data-horizon]").forEach((x) => x.classList.remove("active"));
      b.classList.add("active");
      horizonFilter = b.dataset.horizon;
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
