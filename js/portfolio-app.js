/**
 * KYF Family Portfolio Tracker — Application Controller (`js/portfolio-app.js`)
 * Version: v1.4.0
 * Pure Vanilla ES6+ | Top-Level Family Scope Selector, View Tabs, Multi-Select Pill Strip,
 * Horizon Toggle (1M, 3M, 6M, 1Y), Goal Envelopes, Macro Inflation Compounding,
 * Virtual Lot Splitting, Mobile-Optimized Aligned TreeGrid
 */

document.addEventListener("DOMContentLoaded", async () => {
  // Application State
  let rawHoldings = [];
  let rawGoals = [];
  let isDemoMode = localStorage.getItem("kyf_demo_mode") !== "false";
  let userHoldings = [];
  let userGoals = [];
  try {
    const rawUserH = localStorage.getItem("kyf_user_holdings");
    if (rawUserH) userHoldings = JSON.parse(rawUserH);
    const rawUserG = localStorage.getItem("kyf_user_goals");
    if (rawUserG) userGoals = JSON.parse(rawUserG);
  } catch (e) {
    userHoldings = [];
    userGoals = [];
  }

  let activeMemberScope = "ALL";       // "ALL" or Set of string names (e.g. Set(["Rajesh", "Priya"]))
  let activeDimension = "assetClass"; // "assetClass" | "goal" | "custodian" | "member"
  let selectedPills = "ALL";          // "ALL" or Set of string keys within active view
  let activeHorizon = "1y";           // "1m" | "3m" | "6m" | "1y" | "all"
  let sortKey = "currentValue";       // "name" | "member" | "assetClass" | "units" | "investedValue" | "currentValue" | "returnPct"
  let sortDirection = "desc";         // "asc" | "desc"
  let expandAllState = true;
  let searchQuery = "";

  // DOM Element References
  const els = {
    treegrid: document.getElementById("portfolio-treegrid"),
    heroMemberChips: document.getElementById("hero-member-chips"),
    demoDataToggle: document.getElementById("demo-data-toggle"),
    kpiNetWorth: document.getElementById("kpi-net-worth"),
    kpiNetWorthSub: document.getElementById("kpi-net-worth-sub"),
    kpiInvested: document.getElementById("kpi-invested"),
    kpiReturnPct: document.getElementById("kpi-return-pct"),
    kpiGainLoss: document.getElementById("kpi-gain-loss"),
    kpiGainSub: document.getElementById("kpi-gain-sub"),
    pillStrip: document.getElementById("view-pill-strip"),
    searchInput: document.getElementById("search-holdings-input"),
    searchClearBtn: document.getElementById("search-clear-btn"),
    toggleExpandBtn: document.getElementById("btn-toggle-expand"),
    thSecondaryHeader: document.getElementById("th-secondary-header"),
    thSecondaryTitle: document.getElementById("th-secondary-title"),
    thReturnHeader: document.getElementById("th-return-header"),
    // App-level Navigation Bar elements
    navOpenFileBtn: document.getElementById("navOpenFileBtn"),
    navSaveBtn: document.getElementById("navSaveDataBtn"),
    kyfFileInput: document.getElementById("kyfFileInput"),
    toast: document.getElementById("kyf-toast"),
    pulseTicker: document.getElementById("pulse-ticker"),
    pulseAsOf: document.getElementById("pulse-asof-pill")
  };

  // ==========================================================================
  // Number & Currency Formatters (Indian Rupee Standard)
  // ==========================================================================
  function formatINR(val, compact = false) {
    if (val == null || isNaN(val)) return "₹0";
    const num = Math.round(Number(val));
    const abs = Math.abs(num);
    const sign = num < 0 ? "-" : "";

    if (compact) {
      if (abs >= 10000000) {
        return `${sign}₹${(abs / 10000000).toFixed(2)} Cr`;
      }
      if (abs >= 100000) {
        return `${sign}₹${(abs / 100000).toFixed(2)} L`;
      }
      if (abs >= 1000) {
        return `${sign}₹${(abs / 1000).toFixed(1)} K`;
      }
    }

    return `${sign}₹${abs.toLocaleString("en-IN")}`;
  }

  function formatPct(val) {
    if (val == null || isNaN(val)) return "0.0%";
    const n = Number(val);
    const sign = n > 0 ? "+" : "";
    return `${sign}${n.toFixed(1)}%`;
  }

  // ==========================================================================
  // Toast Notifications
  // ==========================================================================
  let toastTimer = null;
  function showToast(message, type = "success") {
    if (!els.toast) return;
    clearTimeout(toastTimer);
    els.toast.textContent = message;
    els.toast.className = `toast-notice show ${type}`;
    toastTimer = setTimeout(() => {
      els.toast.className = "toast-notice";
    }, 3200);
  }

  // ==========================================================================
  // Market Pulse Status Bar Renderer
  // ==========================================================================
  function renderMarketPulse() {
    const pulse = window.KYF_MARKET_PULSE || {};
    const macro = pulse.macro || {};
    const metals = pulse.preciousMetals || {};
    const indices = pulse.indices || {};
    const asOf = pulse.asOf || "2026-11-05";

    if (els.pulseAsOf) {
      els.pulseAsOf.textContent = `Live As Of: ${asOf}`;
    }

    if (els.pulseTicker) {
      const nifty = indices.NIFTY50 || {};
      const niftyRetVal = nifty.ret1m != null ? nifty.ret1m : (nifty.cagr1y != null ? nifty.cagr1y : 0);
      const niftyRetSign = niftyRetVal >= 0 ? "+" : "";
      const niftyFormatted = Number(niftyRetVal).toFixed(1);

      const goldRetVal = metals.goldRet1y != null ? metals.goldRet1y : (metals.goldRet1m || 0);
      const goldRetSign = goldRetVal >= 0 ? "+" : "";
      const goldFormatted = Number(goldRetVal).toFixed(1);

      const niftyLevelStr = nifty.level
        ? Number(nifty.level).toLocaleString("en-IN", { minimumFractionDigits: (nifty.level % 1 === 0 ? 0 : 1), maximumFractionDigits: 2 })
        : "25,030.35";

      els.pulseTicker.innerHTML = `
        <span class="ticker-item">
          <strong>NIFTY 50:</strong> ${niftyLevelStr}
          <span class="ticker-badge ${niftyRetVal >= 0 ? "positive" : "negative"}">${niftyRetSign}${niftyFormatted}% 1M</span>
        </span>
        <span class="ticker-sep">&bull;</span>
        <span class="ticker-item">
          <strong>Gold 24K:</strong> ₹${metals.gold24kPerGram ? Number(metals.gold24kPerGram).toLocaleString("en-IN") : "13,800"}/g
          <span class="ticker-badge ${goldRetVal >= 0 ? "positive" : "negative"}">${goldRetSign}${goldFormatted}% 1Y</span>
        </span>
        <span class="ticker-sep">&bull;</span>
        <span class="ticker-item">
          <strong>CPI Inflation:</strong> ${macro.cpiInflation || 5.4}%
        </span>
        <span class="ticker-sep">&bull;</span>
        <span class="ticker-item">
          <strong>Education Inflation:</strong> ${macro.educationInflation || 9.0}%
        </span>
        <span class="ticker-sep">&bull;</span>
        <span class="ticker-item">
          <strong>EPF Sovereign Rate:</strong> ${macro.epfRate || 8.25}%
        </span>
      `;
    }
  }

  // ==========================================================================
  // Top-Level Family Member Scope Selector (Next to Hero text)
  // Master multi-select context that scopes the entire dashboard
  // ==========================================================================
  function renderHeroMemberChips(allHoldings) {
    if (!els.heroMemberChips) return;

    const baseMembers = (window.KYF_PORTFOLIO_DATA && window.KYF_PORTFOLIO_DATA.getDemoMembers)
      ? window.KYF_PORTFOLIO_DATA.getDemoMembers()
      : [
          { id: "mem_rajesh", name: "Rajesh", role: "Self", avatar: "👨" },
          { id: "mem_priya", name: "Priya", role: "Spouse", avatar: "👩" },
          { id: "mem_ramesh", name: "Ramesh", role: "Father", avatar: "👴" },
          { id: "mem_sunita", name: "Sunita", role: "Mother", avatar: "👵" }
        ];

    let grandTotal = 0;
    const memberTotals = new Map();
    for (const h of allHoldings) {
      grandTotal += h.currentValue || 0;
      const mName = h.member || "Unassigned";
      memberTotals.set(mName, (memberTotals.get(mName) || 0) + (h.currentValue || 0));
    }

    if (allHoldings.length === 0) {
      els.heroMemberChips.innerHTML = `
        <button type="button" class="member-chip active" data-name="ALL" title="Your portfolio has 0 holdings">
          <span>👨‍👩‍👧‍👦 All Family</span>
          <span class="chip-amount">₹0</span>
        </button>
      `;
      return;
    }

    // Build unique list of individuals only (no combination names)
    const memberList = [];
    if (isDemoMode) {
      const knownNames = new Set(baseMembers.map((m) => m.name));
      for (const m of baseMembers) {
        memberList.push({
          name: m.name,
          avatar: m.avatar || "👤",
          role: m.role,
          totalVal: memberTotals.get(m.name) || 0
        });
      }
      for (const [mName, val] of memberTotals.entries()) {
        if (!knownNames.has(mName) && mName !== "Unassigned" && !mName.includes("&")) {
          memberList.push({
            name: mName,
            avatar: "👤",
            role: "Family",
            totalVal: val
          });
        }
      }
    } else {
      for (const [mName, val] of memberTotals.entries()) {
        if (mName !== "Unassigned" && !mName.includes("&")) {
          memberList.push({
            name: mName,
            avatar: "👤",
            role: "Family",
            totalVal: val
          });
        }
      }
    }

    const isAll = activeMemberScope === "ALL" ||
      (activeMemberScope instanceof Set && activeMemberScope.size === memberList.length);

    let html = `
      <button type="button" class="member-chip ${isAll ? "active" : ""}" data-name="ALL" title="View combined portfolio for all family members">
        <span>👨‍👩‍👧‍👦 All Family</span>
        <span class="chip-amount">${formatINR(grandTotal, true)}</span>
      </button>
    `;

    for (const m of memberList) {
      const isSelected = !isAll && (activeMemberScope instanceof Set && activeMemberScope.has(m.name));
      const checkMark = isSelected ? "✓ " : "";
      html += `
        <button type="button" class="member-chip ${isSelected ? "active" : ""}" data-name="${escapeHTML(m.name)}" title="${m.name} (${m.role}): ${formatINR(m.totalVal)}">
          <span>${checkMark}${m.avatar} ${escapeHTML(m.name)}</span>
          <span class="chip-amount">${formatINR(m.totalVal, true)}</span>
        </button>
      `;
    }

    els.heroMemberChips.innerHTML = html;

    // Attach click events to member chips
    const chips = els.heroMemberChips.querySelectorAll(".member-chip");
    chips.forEach((chip) => {
      chip.addEventListener("click", () => {
        const name = chip.getAttribute("data-name");
        if (name === "ALL") {
          activeMemberScope = "ALL";
        } else {
          if (activeMemberScope === "ALL") {
            // First click on specific member: isolate that member in 1 tap!
            activeMemberScope = new Set([name]);
          } else if (activeMemberScope instanceof Set) {
            if (activeMemberScope.has(name)) {
              activeMemberScope.delete(name);
              if (activeMemberScope.size === 0) {
                activeMemberScope = "ALL";
              }
            } else {
              activeMemberScope.add(name);
              if (activeMemberScope.size === memberList.length) {
                activeMemberScope = "ALL";
              }
            }
          }
        }
        // Reset view pill filters when changing family scope
        selectedPills = "ALL";
        renderApp();
      });
    });
  }

  // ==========================================================================
  // Render Horizontal Multi-Select Pill Strip for Active View Lens
  // Scoped to the currently active family member selection
  // ==========================================================================
  function renderPillStrip(scopedHoldings) {
    if (!els.pillStrip) return;

    let entities = [];

    if (activeDimension === "goal") {
      // Slices for goals within active scope
      const goalTotals = new Map();
      const goalNames = new Map();
      const goalIcons = new Map();

      for (const s of scopedHoldings) {
        const gid = s.goalId || "goal_unallocated";
        if (!goalTotals.has(gid)) {
          goalTotals.set(gid, { count: 0, totalVal: 0 });
          goalNames.set(gid, s.goalName || "General Wealth");
          goalIcons.set(gid, s.goalIcon || "🎯");
        }
        const item = goalTotals.get(gid);
        item.count += 1;
        item.totalVal += s.currentValue || 0;
      }

      entities = Array.from(goalTotals.entries())
        .map(([key, data]) => ({
          key,
          label: `${goalIcons.get(key) || "🎯"} ${goalNames.get(key) || key}`,
          count: data.count,
          totalVal: data.totalVal
        }))
        .filter((e) => e.totalVal > 0 || e.count > 0)
        .sort((a, b) => b.totalVal - a.totalVal);
    } else {
      // Grouping by assetClass, custodian, or member within active scope
      const entityMap = new Map();

      for (const h of scopedHoldings) {
        const key = h[activeDimension] || "Other";
        if (!entityMap.has(key)) {
          entityMap.set(key, { key, label: key, count: 0, totalVal: 0 });
        }
        const item = entityMap.get(key);
        item.count += 1;
        item.totalVal += h.currentValue || 0;
      }

      entities = Array.from(entityMap.values()).sort((a, b) => b.totalVal - a.totalVal);
    }

    const isAll = selectedPills === "ALL" || (selectedPills instanceof Set && selectedPills.size === entities.length);

    let html = `
      <button type="button" class="view-pill ${isAll ? "active" : ""}" data-key="ALL">
        <span>All (${entities.length})</span>
      </button>
    `;

    for (const ent of entities) {
      const isSelected = !isAll && (selectedPills instanceof Set && selectedPills.has(ent.key));
      const checkIcon = isSelected ? "✓ " : "";
      html += `
        <button type="button" class="view-pill ${isSelected ? "active" : ""}" data-key="${escapeHTML(ent.key)}">
          <span>${checkIcon}${escapeHTML(ent.label || ent.key)}</span>
          <span class="pill-amount">${formatINR(ent.totalVal, true)}</span>
        </button>
      `;
    }

    els.pillStrip.innerHTML = html;

    // Bind click events to pills
    const pillButtons = els.pillStrip.querySelectorAll(".view-pill");
    pillButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        const key = btn.getAttribute("data-key");
        if (key === "ALL") {
          selectedPills = "ALL";
        } else {
          if (selectedPills === "ALL") {
            selectedPills = new Set([key]);
          } else if (selectedPills instanceof Set) {
            if (selectedPills.has(key)) {
              selectedPills.delete(key);
              if (selectedPills.size === 0) {
                selectedPills = "ALL";
              }
            } else {
              selectedPills.add(key);
              if (selectedPills.size === entities.length) {
                selectedPills = "ALL";
              }
            }
          }
        }
        renderApp();
      });
    });
  }

  // ==========================================================================
  // TreeGrid Sort Header Active Indicators & Dynamic Column Titles
  // ==========================================================================
  function updateSortHeadersUI() {
    // Dynamic Column 2 Header title & sort attribute based on active view lens
    if (els.thSecondaryHeader && els.thSecondaryTitle) {
      let col2Title = "Family Member / Units";
      let col2SortKey = "member";

      if (activeDimension === "assetClass") {
        col2Title = "Family Member / Units";
        col2SortKey = "member";
        els.thSecondaryHeader.title = "Click to sort by Family Member";
      } else if (activeDimension === "member") {
        col2Title = "Asset Class / Units";
        col2SortKey = "assetClass";
        els.thSecondaryHeader.title = "Click to sort by Asset Class";
      } else if (activeDimension === "custodian") {
        col2Title = "Family Member / Asset";
        col2SortKey = "member";
        els.thSecondaryHeader.title = "Click to sort by Family Member";
      } else if (activeDimension === "goal") {
        col2Title = "Asset Class / Owner";
        col2SortKey = "assetClass";
        els.thSecondaryHeader.title = "Click to sort by Asset Class";
      }

      els.thSecondaryTitle.textContent = col2Title;
      els.thSecondaryHeader.setAttribute("data-sort", col2SortKey);
    }

    // Update sorted / unsorted classes and arrows
    const headers = document.querySelectorAll(".th-sortable");
    headers.forEach((th) => {
      const key = th.getAttribute("data-sort");
      const arrow = th.querySelector(".sort-arrow");
      if (key === sortKey) {
        th.classList.add("sorted");
        if (arrow) arrow.textContent = sortDirection === "asc" ? "▲" : "▼";
      } else {
        th.classList.remove("sorted");
        if (arrow) arrow.textContent = "⇅";
      }
    });

    // Update Return Column Header label with active horizon
    if (els.thReturnHeader) {
      let horizonTitle = "Return (1Y)";
      switch (activeHorizon) {
        case "1m": horizonTitle = "Return (1M)"; break;
        case "3m": horizonTitle = "Return (3M)"; break;
        case "6m": horizonTitle = "Return (6M)"; break;
        case "1y": horizonTitle = "Return (1Y)"; break;
        case "all": horizonTitle = "Total Gain (%)"; break;
      }
      const arrowSpan = els.thReturnHeader.querySelector(".sort-arrow");
      const arrowText = arrowSpan ? arrowSpan.textContent : "⇅";
      els.thReturnHeader.innerHTML = `<span>${horizonTitle}</span> <span class="sort-arrow">${arrowText}</span>`;
    }
  }

  // ==========================================================================
  // Main Stateless Render Cycle
  // ==========================================================================
  function renderApp() {
    if (!els.treegrid) return;

    // 1. Live Market Valuation Pass for all holdings
    const enriched = window.KYF_PORTFOLIO_ENGINE.enrichHoldingsWithLiveMarket(rawHoldings, activeHorizon);

    // 2. Render Top-Level Hero Member Chips
    renderHeroMemberChips(enriched);

    // 3. Apply Top-Level Family Scope Filter
    let scopedHoldings = enriched;
    if (activeMemberScope !== "ALL" && activeMemberScope instanceof Set && activeMemberScope.size > 0) {
      scopedHoldings = enriched.filter((h) => activeMemberScope.has(h.member));
    }

    // 4. Prepare Working Holdings (Virtual Lot Slices if viewing by Goal)
    let workingHoldings = [];
    if (activeDimension === "goal") {
      const expanded = window.KYF_PORTFOLIO_ENGINE.expandGoalSlices(scopedHoldings, rawGoals);
      workingHoldings = expanded.slices;
    } else {
      workingHoldings = scopedHoldings;
    }

    // 5. Render View Multi-Select Pill Strip (for the active view dimension within scoped members)
    renderPillStrip(workingHoldings);

    // 6. Filter Pass (Search Query + Multi-Selected View Pills)
    const filtered = window.KYF_PORTFOLIO_ENGINE.filterHoldings(workingHoldings, {
      search: searchQuery,
      activeDimension,
      selectedPills
    });

    // 7. Reduce into 1-Level Pivot Tree with Weighted-Average Horizon Returns & Goal Metrics
    const pivotResult = window.KYF_PORTFOLIO_ENGINE.groupBySingleDimension(
      filtered,
      activeDimension,
      sortKey,
      sortDirection,
      activeHorizon
    );

    // 8. Update KPI Hero Cards (Reflects Active Family Scope & Active Slicers)
    const kpis = pivotResult.kpis;
    if (els.kpiNetWorth) els.kpiNetWorth.textContent = formatINR(kpis.totalPortfolioValue, true);
    if (els.kpiInvested) els.kpiInvested.textContent = formatINR(kpis.totalPortfolioInvested, true);

    if (els.kpiNetWorthSub) {
      let scopeLabel = "All Family";
      if (activeMemberScope instanceof Set) {
        scopeLabel = Array.from(activeMemberScope).join(", ");
      }
      els.kpiNetWorthSub.textContent = `Scope: ${scopeLabel} (${kpis.holdingsCount} ${activeDimension === "goal" ? "slices" : "holdings"})`;
    }

    if (els.kpiReturnPct && els.kpiGainLoss) {
      const isPositive = kpis.activeHorizonReturnPct >= 0;
      const gainSign = isPositive ? "+" : "";
      els.kpiReturnPct.textContent = formatPct(kpis.activeHorizonReturnPct);
      els.kpiGainLoss.textContent = `${gainSign}${formatINR(kpis.totalPortfolioGainLoss, true)}`;
      els.kpiReturnPct.className = `return-badge ${isPositive ? "positive" : "negative"}`;
      if (els.kpiGainSub) {
        const hLabel = activeHorizon === "all" ? "All-Time" : activeHorizon.toUpperCase();
        els.kpiGainSub.textContent = `${hLabel} return`;
      }
    }

    // 9. Update Sort Indicators in Header
    updateSortHeadersUI();

    // 10. Render Aligned TreeGrid
    if (rawHoldings.length === 0) {
      els.treegrid.innerHTML = `
        <div class="treegrid-empty-state">
          <h3>Your Private Portfolio is Clean</h3>
          <p>No investment records in your personal portfolio yet. Click <strong>📂 Open</strong> in the top navigation to load your <code>.kyf</code> file, or check <strong>Demo Data</strong> above to explore sample family holdings.</p>
          <button class="action-pill-btn" id="empty-state-load-demo-btn" style="padding: 9px 22px; font-weight:700;">🎲 Fill Demo Data</button>
        </div>
      `;
      const emptyBtn = document.getElementById("empty-state-load-demo-btn");
      if (emptyBtn) {
        emptyBtn.addEventListener("click", () => {
          if (els.demoDataToggle) {
            els.demoDataToggle.checked = true;
          }
          handleDemoToggle({ target: { checked: true } });
        });
      }
      return;
    }

    if (pivotResult.groups.length === 0) {
      els.treegrid.innerHTML = `
        <div class="treegrid-empty-state">
          <h3>No Holdings Match Active Selection</h3>
          <p>No investment records matched your search query or selected filters. Click below to reset to All.</p>
          <button class="action-pill-btn" id="empty-state-clear-filter-btn">Reset All Selections</button>
        </div>
      `;
      const clearBtn = document.getElementById("empty-state-clear-filter-btn");
      if (clearBtn) clearBtn.addEventListener("click", handleResetSelections);
      return;
    }

    // Generate HTML for Groups & Holdings using shared CSS Grid columns
    let html = "";

    for (const group of pivotResult.groups) {
      const groupIsPositive = group.horizonReturnPct >= 0;
      const groupReturnClass = groupIsPositive ? "positive" : "negative";

      // Goal Specific Sub-Header (Progress Bar & Horizon Badge)
      let goalHeaderExtra = "";
      if (activeDimension === "goal" && group.goalMeta) {
        const meta = group.goalMeta;
        const infl = meta.inflation || {};
        const yearsRemaining = infl.yearsRemaining != null ? infl.yearsRemaining : 0;
        const targetYear = meta.targetYear || 2026;

        let progressBarHTML = "";
        if (group.adjustedTargetINR > 0 && group.progressPct != null) {
          const clampedWidth = Math.min(100, Math.max(0, group.progressPct));
          const isFunded = group.progressPct >= 100;
          progressBarHTML = `
            <div class="goal-progress-container" title="Inflation-Adjusted Target: ₹${formatINR(group.adjustedTargetINR)} (${infl.inflationRate}% ${infl.inflationCategory} compounded over ${yearsRemaining} yrs from base ₹${formatINR(meta.baseTargetINR, true)})">
              <div class="goal-progress-bar">
                <div class="goal-progress-fill ${isFunded ? "funded" : ""}" style="width: ${clampedWidth}%;"></div>
              </div>
              <span class="goal-progress-label mono-num">${group.progressPct}% of ${formatINR(group.adjustedTargetINR, true)}</span>
            </div>
          `;
        }

        goalHeaderExtra = `
          <div class="goal-summary-meta">
            <span class="goal-horizon-tag">⏳ ${yearsRemaining === 0 ? "Target Met" : `${yearsRemaining} yrs (${targetYear})`}</span>
            ${progressBarHTML}
          </div>
        `;
      }

      html += `
        <details class="tree-group ${activeDimension === "goal" ? "tree-group-goal" : ""}" ${expandAllState ? "open" : ""}>
          <summary class="tree-summary">
            <!-- Col 1: Group Name, Chevron, Mobile Subtext & Goal Progress -->
            <div class="tree-group-name-cell">
              <span class="tree-chevron">▶</span>
              <div class="tree-group-title-wrap">
                <span class="tree-group-title">
                  ${escapeHTML(group.label)}
                  <span class="tree-group-count">${group.holdings.length}</span>
                </span>
                <span class="tree-group-mobile-sub mono-num">
                  ${group.allocationPct.toFixed(1)}% alloc &bull; Inv: ${formatINR(group.totalInvested, true)}
                </span>
                ${goalHeaderExtra}
              </div>
            </div>

            <!-- Col 2: Allocation % (Hidden on Mobile via .cell-hide-mobile) -->
            <div class="tree-group-alloc-cell mono-num cell-hide-mobile">
              ${group.allocationPct.toFixed(1)}% <span style="font-size:11px; font-weight:400; color:var(--muted);">alloc</span>
            </div>

            <!-- Col 3: Total Invested (Hidden on Mobile via .cell-hide-mobile) -->
            <div class="tree-group-num-cell tree-col-right mono-num cell-hide-mobile">
              ${formatINR(group.totalInvested)}
            </div>

            <!-- Col 4: Total Current Value (Visible on both Desktop and Mobile) -->
            <div class="tree-group-num-cell tree-col-right mono-num" style="color:var(--teal);">
              ${formatINR(group.totalCurrentValue)}
            </div>

            <!-- Col 5: Group Horizon Return % (Visible on both Desktop and Mobile) -->
            <div class="tree-col-right">
              <span class="return-badge ${groupReturnClass} mono-num">
                ${formatPct(group.horizonReturnPct)}
              </span>
            </div>
          </summary>

          <!-- Nested Leaf Holdings -->
          <div class="tree-leaf-container">
            ${group.holdings
              .map((h) => {
                const isPos = h.activeHorizonReturn >= 0;
                const retClass = isPos ? "positive" : "negative";

                const custTag = activeDimension !== "custodian" ? `<span class="tag-badge badge-custodian">🏦 ${escapeHTML(h.custodian || "")}</span>` : "";
                const regularDragTag = h.regularAlert
                  ? `<span class="tag-badge badge-regular-alert" title="${escapeHTML(h.regularAlert.message)}">⚠️ Regular Plan Drag</span>`
                  : "";
                const sliceTag = h.isSlice
                  ? `<span class="tag-badge badge-slice" title="${h.slicePercentage}% virtual allocation of full holding (Total live: ₹${formatINR(h.originalCurrentValue)})">🍰 ${h.slicePercentage}% slice</span>`
                  : "";

                // Dynamic Column 2 Context: Owner in Asset Class View, Asset Class in Member View, Asset Class & Owner in Goal View
                let col2Primary = "";
                if (activeDimension === "assetClass") {
                  col2Primary = `
                    <span class="leaf-context-badge clickable-context-filter" data-filter-type="member" data-filter-val="${escapeHTML(h.member || "")}" title="Click to filter by: ${escapeHTML(h.member || "")}">
                      👤 ${escapeHTML(h.member || "")}
                    </span>
                  `;
                } else if (activeDimension === "member") {
                  col2Primary = `
                    <span class="leaf-context-badge clickable-context-filter" data-filter-type="assetClass" data-filter-val="${escapeHTML(h.assetClass || "")}" title="Click to filter by: ${escapeHTML(h.assetClass || "")}">
                      ${escapeHTML(h.assetClass || "")}
                    </span>
                  `;
                } else if (activeDimension === "goal") {
                  col2Primary = `
                    <span class="leaf-context-badge clickable-context-filter" data-filter-type="assetClass" data-filter-val="${escapeHTML(h.assetClass || "")}" title="Click to filter by: ${escapeHTML(h.assetClass || "")}">
                      ${escapeHTML(h.assetClass || "")}
                    </span>
                    <span class="leaf-sub-badge clickable-context-filter" data-filter-type="member" data-filter-val="${escapeHTML(h.member || "")}" title="Click to filter by: ${escapeHTML(h.member || "")}">&bull; 👤 ${escapeHTML(h.member || "")}</span>
                  `;
                } else {
                  col2Primary = `
                    <span class="leaf-context-badge clickable-context-filter" data-filter-type="member" data-filter-val="${escapeHTML(h.member || "")}" title="Click to filter by: ${escapeHTML(h.member || "")}">
                      👤 ${escapeHTML(h.member || "")}
                    </span>
                    <span class="leaf-sub-badge">&bull; ${escapeHTML(h.assetClass || "")}</span>
                  `;
                }

                return `
                  <div class="tree-leaf-row">
                    <!-- Col 1: Holding / Instrument, Tags & Mobile Subtext -->
                    <div class="leaf-ident-wrap">
                      <div class="leaf-name">
                        ${escapeHTML(h.name)}
                      </div>
                      <div class="leaf-tags">
                        <span class="tag-badge">${escapeHTML(h.subCategory || h.assetClass)}</span>
                        ${sliceTag}
                        ${custTag}
                        ${regularDragTag}
                      </div>
                      <div class="leaf-mobile-sub mono-num">
                        ${escapeHTML(h.priceLabel || "")} &bull; 👤 ${escapeHTML(h.member || "")} &bull; Inv: ${formatINR(h.investedValue, true)}
                      </div>
                    </div>

                    <!-- Col 2: Dynamic Context & Units (Hidden on Mobile via .cell-hide-mobile) -->
                    <div class="leaf-units-wrap cell-hide-mobile">
                      <div class="leaf-context-row">
                        ${col2Primary}
                      </div>
                      <div class="leaf-price-rate mono-num">
                        ${escapeHTML(h.physicalUnitsLabel || "")} &bull; ${escapeHTML(h.priceLabel || "")}
                      </div>
                    </div>

                    <!-- Col 3: Invested Value (Hidden on Mobile via .cell-hide-mobile) -->
                    <div class="leaf-num-cell tree-col-right mono-num cell-hide-mobile">
                      ${formatINR(h.investedValue)}
                    </div>

                    <!-- Col 4: Live Current Value (Visible on both Desktop and Mobile) -->
                    <div class="leaf-num-cell tree-col-right mono-num" style="font-weight:700;">
                      ${formatINR(h.currentValue)}
                    </div>

                    <!-- Col 5: Horizon Return % (Visible on both Desktop and Mobile) -->
                    <div class="leaf-return-wrap tree-col-right">
                      <span class="return-badge ${retClass} mono-num">
                        ${formatPct(h.activeHorizonReturn)}
                      </span>
                      <span class="leaf-momentum-pill">${escapeHTML(h.activeHorizonLabel)}</span>
                    </div>
                  </div>
                `;
              })
              .join("")}
          </div>
        </details>
      `;
    }

    els.treegrid.innerHTML = html;
  }

  function escapeHTML(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  // ==========================================================================
  // Action Handlers
  // ==========================================================================
  async function handleDemoToggle(e) {
    const isChecked = e.target.checked;
    isDemoMode = isChecked;
    localStorage.setItem("kyf_demo_mode", isChecked ? "true" : "false");

    if (isChecked) {
      // User turned ON Demo Data: stash any current user holdings so they are never lost
      if (rawHoldings && rawHoldings.length > 0 && userHoldings.length === 0) {
        userHoldings = rawHoldings;
        userGoals = rawGoals;
        localStorage.setItem("kyf_user_holdings", JSON.stringify(userHoldings));
        localStorage.setItem("kyf_user_goals", JSON.stringify(userGoals));
      }
      rawHoldings = window.KYF_PORTFOLIO_DATA.getDemoFamilyHoldings();
      rawGoals = window.KYF_PORTFOLIO_DATA.getDemoGoals();
      await window.KYF_PORTFOLIO_DATA.saveHoldingsToDB(rawHoldings);
      await window.KYF_PORTFOLIO_DATA.saveGoalsToDB(rawGoals);
      handleResetSelections();
      showToast("✓ Filled with demo family data", "success");
    } else {
      // User turned OFF Demo Data: reset back to user's personal data
      rawHoldings = Array.isArray(userHoldings) ? [...userHoldings] : [];
      rawGoals = Array.isArray(userGoals) ? [...userGoals] : [];
      await window.KYF_PORTFOLIO_DATA.saveHoldingsToDB(rawHoldings);
      await window.KYF_PORTFOLIO_DATA.saveGoalsToDB(rawGoals);
      handleResetSelections();
      if (rawHoldings.length > 0) {
        showToast(`✓ Switched to your portfolio (${rawHoldings.length} holdings)`, "success");
      } else {
        showToast("✓ Reset to your data (clean slate)", "info");
      }
    }
    renderApp();
  }

  function handleSaveAppData() {
    const fileName = window.KYF_PORTFOLIO_DATA.exportAppData(rawHoldings, rawGoals);
    showToast(`✓ Data saved & exported to ${fileName}`, "success");
  }

  function handleResetSelections() {
    activeMemberScope = "ALL";
    selectedPills = "ALL";
    searchQuery = "";
    if (els.searchInput) els.searchInput.value = "";
    if (els.searchClearBtn) els.searchClearBtn.style.display = "none";
    renderApp();
  }

  // ==========================================================================
  // Event Listeners Setup
  // ==========================================================================
  function setupEventListeners() {
    // 1. View Switcher Tabs (Asset Class | Goals | Custodian | Family Member)
    const viewTabs = document.querySelectorAll(".view-tab-btn");
    viewTabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        const dim = tab.getAttribute("data-dimension");
        if (dim && dim !== activeDimension) {
          activeDimension = dim;
          selectedPills = "ALL"; // reset pill selection when switching view lens
          viewTabs.forEach((t) => t.classList.remove("active"));
          tab.classList.add("active");
          renderApp();
        }
      });
    });

    // 2. Horizon Segmented Controls (1M | 3M | 6M | 1Y | All)
    const horizonBtns = document.querySelectorAll(".horizon-btn");
    horizonBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        const horiz = btn.getAttribute("data-horizon");
        if (horiz && horiz !== activeHorizon) {
          activeHorizon = horiz;
          horizonBtns.forEach((b) => b.classList.remove("active"));
          btn.classList.add("active");
          renderApp();
        }
      });
    });

    // 3. Sortable Column Headers
    const sortHeaders = document.querySelectorAll(".th-sortable");
    sortHeaders.forEach((th) => {
      th.addEventListener("click", () => {
        const key = th.getAttribute("data-sort");
        if (key === sortKey) {
          sortDirection = sortDirection === "asc" ? "desc" : "asc";
        } else {
          sortKey = key;
          sortDirection = key === "name" ? "asc" : "desc";
        }
        renderApp();
      });
    });

    // 4. Search Box Input
    if (els.searchInput) {
      els.searchInput.addEventListener("input", (e) => {
        searchQuery = e.target.value;
        if (els.searchClearBtn) {
          els.searchClearBtn.style.display = e.target.value ? "block" : "none";
        }
        renderApp();
      });
    }

    if (els.searchClearBtn) {
      els.searchClearBtn.addEventListener("click", () => {
        searchQuery = "";
        if (els.searchInput) els.searchInput.value = "";
        els.searchClearBtn.style.display = "none";
        renderApp();
      });
    }

    // 5. Expand / Collapse All Accordions
    if (els.toggleExpandBtn) {
      els.toggleExpandBtn.addEventListener("click", () => {
        expandAllState = !expandAllState;
        els.toggleExpandBtn.textContent = expandAllState ? "Collapse All" : "Expand All";
        const groups = document.querySelectorAll(".tree-group");
        groups.forEach((g) => {
          if (expandAllState) g.setAttribute("open", "");
          else g.removeAttribute("open");
        });
      });
    }

    // 6. Demo Data Checkbox Toggle
    if (els.demoDataToggle) {
      els.demoDataToggle.addEventListener("change", handleDemoToggle);
    }

    // 7. App-Level Toolbar: Open & Save Data Buttons
    if (els.navOpenFileBtn && els.kyfFileInput) {
      els.navOpenFileBtn.addEventListener("click", () => {
        els.kyfFileInput.click();
      });
    }

    if (els.kyfFileInput) {
      els.kyfFileInput.addEventListener("change", async (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;

        try {
          const text = await file.text();
          const result = window.KYF_PORTFOLIO_DATA.parseAndExtractKyfData(text);
          if (result.holdings && result.holdings.length) {
            isDemoMode = false;
            localStorage.setItem("kyf_demo_mode", "false");
            userHoldings = result.holdings;
            userGoals = result.goals || [];
            localStorage.setItem("kyf_user_holdings", JSON.stringify(userHoldings));
            localStorage.setItem("kyf_user_goals", JSON.stringify(userGoals));
            rawHoldings = userHoldings;
            rawGoals = userGoals;
            if (els.demoDataToggle) els.demoDataToggle.checked = false;
            await window.KYF_PORTFOLIO_DATA.saveHoldingsToDB(rawHoldings);
            await window.KYF_PORTFOLIO_DATA.saveGoalsToDB(rawGoals);
          } else if (result.goals && result.goals.length) {
            userGoals = result.goals;
            rawGoals = userGoals;
            await window.KYF_PORTFOLIO_DATA.saveGoalsToDB(rawGoals);
          }

          handleResetSelections();
          showToast(`✓ Loaded ${file.name} (${rawHoldings.length} holdings)`, "success");
          renderApp();
        } catch (err) {
          alert("Error parsing .kyf file: " + err.message);
        } finally {
          els.kyfFileInput.value = "";
        }
      });
    }

    if (els.navSaveBtn) {
      els.navSaveBtn.addEventListener("click", handleSaveAppData);
    }

    // 8. Context Filter Click Delegation (clicking 👤 Individual or Asset Class in any row)
    if (els.treegrid) {
      els.treegrid.addEventListener("click", (e) => {
        const target = e.target.closest(".clickable-context-filter");
        if (!target) return;
        const filterType = target.getAttribute("data-filter-type");
        const filterVal = target.getAttribute("data-filter-val");
        if (!filterVal) return;

        if (filterType === "member") {
          // Scope top-level member to this individual
          activeMemberScope = new Set([filterVal]);
          showToast(`✓ Scoped dashboard to ${filterVal}`, "success");
        } else {
          // Switch view lens and isolate that asset class
          activeDimension = filterType;
          selectedPills = new Set([filterVal]);
          const viewTabs = document.querySelectorAll(".view-tab-btn");
          viewTabs.forEach((tab) => {
            if (tab.getAttribute("data-dimension") === filterType) {
              tab.classList.add("active");
            } else {
              tab.classList.remove("active");
            }
          });
          showToast(`✓ Switched to ${filterVal} view`, "success");
        }

        renderApp();
      });
    }
  }

  // ==========================================================================
  // Application Boot Sequence
  // ==========================================================================
  async function boot() {
    renderMarketPulse();
    setupEventListeners();

    if (els.demoDataToggle) {
      els.demoDataToggle.checked = isDemoMode;
    }

    if (isDemoMode) {
      // Demo Data mode active: populate demo family dataset
      rawHoldings = window.KYF_PORTFOLIO_DATA.getDemoFamilyHoldings();
      rawGoals = window.KYF_PORTFOLIO_DATA.getDemoGoals();
      await window.KYF_PORTFOLIO_DATA.saveHoldingsToDB(rawHoldings);
      await window.KYF_PORTFOLIO_DATA.saveGoalsToDB(rawGoals);
    } else {
      // User Data mode: restore user's stored holdings or start with clean slate
      const storedHoldings = await window.KYF_PORTFOLIO_DATA.loadHoldingsFromDB();
      const storedGoals = await window.KYF_PORTFOLIO_DATA.loadGoalsFromDB();

      if (storedHoldings && storedHoldings.length > 0) {
        rawHoldings = storedHoldings;
        userHoldings = storedHoldings;
      } else if (userHoldings && userHoldings.length > 0) {
        rawHoldings = userHoldings;
        await window.KYF_PORTFOLIO_DATA.saveHoldingsToDB(rawHoldings);
      } else {
        rawHoldings = [];
      }

      if (storedGoals && storedGoals.length > 0) {
        rawGoals = storedGoals;
        userGoals = storedGoals;
      } else if (userGoals && userGoals.length > 0) {
        rawGoals = userGoals;
        await window.KYF_PORTFOLIO_DATA.saveGoalsToDB(rawGoals);
      } else {
        rawGoals = [];
      }
    }

    renderApp();
  }

  boot();
});
