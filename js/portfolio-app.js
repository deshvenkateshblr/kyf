/**
 * KYF Family Portfolio Tracker — Application Controller (`js/portfolio-app.js`)
 * Version: v1.11.1
 * Pure Vanilla ES6+ | Top-Level Family Scope Selector, View Tabs, Multi-Select Pill Strip,
 * Horizon Toggle (1M, 3M, 6M, 1Y), Goal Envelopes, Macro Inflation Compounding,
 * Virtual Lot Splitting, Mobile-Optimized Aligned TreeGrid
 */

document.addEventListener("DOMContentLoaded", async () => {
  // Application State
  let rawHoldings = [];
  let rawGoals = [];
  let rawMembers = [];
  // Home page "Try it with demo data" link: portfolio.html?demo=1
  try {
    if (new URLSearchParams(location.search).get("demo") === "1") localStorage.setItem("kyf_demo_mode", "true");
  } catch (e) { /* storage blocked: fall through to normal mode */ }
  let isDemoMode = localStorage.getItem("kyf_demo_mode") === "true";
  let userHoldings = [];
  let userGoals = [];
  let userMembers = [];
  try {
    const rawUserH = localStorage.getItem("kyf_user_holdings");
    if (rawUserH) userHoldings = JSON.parse(rawUserH);
    const rawUserG = localStorage.getItem("kyf_user_goals");
    if (rawUserG) userGoals = JSON.parse(rawUserG);
    const rawUserM = localStorage.getItem("kyf_user_members");
    if (rawUserM) userMembers = JSON.parse(rawUserM);
  } catch (e) {
    userHoldings = [];
    userGoals = [];
    userMembers = [];
  }

  let activeMemberScope = "ALL";       // "ALL" or Set of string names (e.g. Set(["Rajesh", "Priya"]))
  let activeDimension = "assetClass"; // "assetClass" | "goal" | "custodian" | "member"
  let selectedPills = "ALL";          // "ALL" or Set of string keys within active view
  let activeHorizon = "1y";           // "1m" | "3m" | "6m" | "1y" | "all"
  let activeCurrency = localStorage.getItem("kyf_portfolio_currency") || "INR"; // "INR" | "USD"
  let sortKey = "currentValue";       // "name" | "member" | "assetClass" | "units" | "investedValue" | "currentValue" | "returnPct"
  let sortDirection = "desc";         // "asc" | "desc"
  let expandAllState = true;
  let searchQuery = "";
  let editingHoldingId = null;        // null when adding, holding.id string when editing
  let activeModalInstrument = null;   // metadata of instrument selected in modal search

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
    thInvestedTitle: document.getElementById("th-invested-title"),
    thCurValTitle: document.getElementById("th-curval-title"),
    thReturnHeader: document.getElementById("th-return-header"),
    // App-level Navigation Bar elements
    navOpenFileBtn: document.getElementById("navOpenFileBtn"),
    navSaveBtn: document.getElementById("navSaveDataBtn"),
    kyfFileInput: document.getElementById("kyfFileInput"),
    toast: document.getElementById("kyf-toast"),
    pulseTicker: document.getElementById("pulse-ticker"),
    pulseAsOf: document.getElementById("pulse-asof-pill"),
    portfolioTopAsOf: document.getElementById("portfolio-top-asof"),
    portfolioAsofDate: document.getElementById("portfolio-asof-date"),
    // Family Member Management Modal elements
    btnOpenMemberModal: document.getElementById("btn-open-member-modal"),
    memberModal: document.getElementById("member-modal"),
    btnCloseMemberModal: document.getElementById("btn-close-member-modal"),
    modalMembersList: document.getElementById("modal-members-list"),
    formAddMember: document.getElementById("form-add-member"),
    inputMemberName: document.getElementById("input-member-name"),
    selectMemberRole: document.getElementById("select-member-role"),
    selectMemberAvatar: document.getElementById("select-member-avatar"),
    // Broker Importer Modal elements
    btnOpenImportModal: document.getElementById("btn-open-import-modal"),
    importModal: document.getElementById("import-modal"),
    btnCloseImportModal: document.getElementById("btn-close-import-modal"),
    btnCancelImport: document.getElementById("btn-cancel-import"),
    btnConfirmImport: document.getElementById("btn-confirm-import"),
    importDropzone: document.getElementById("import-dropzone"),
    importDropzoneContent: document.getElementById("import-dropzone-content"),
    brokerFileInput: document.getElementById("broker-file-input"),
    importMemberSelect: document.getElementById("import-member-select"),
    importSourceSelect: document.getElementById("import-source-select"),
    importCustomBox: document.getElementById("import-custom-source"),
    importCustomName: document.getElementById("import-custom-name"),
    importCustomKind: document.getElementById("import-custom-kind"),
    importCustomCurrency: document.getElementById("import-custom-currency"),
    btnAddCustomSource: document.getElementById("btn-add-custom-source"),
    importStatsSummary: document.getElementById("import-stats-summary"),
    importPreviewWrap: document.getElementById("import-preview-wrap"),
    importPreviewTitle: document.getElementById("import-preview-title"),
    importPreviewCount: document.getElementById("import-preview-count"),
    importPreviewTbody: document.getElementById("import-preview-tbody"),
    importErrorBanner: document.getElementById("import-error-banner"),
    importErrorTitle: document.getElementById("import-error-title"),
    importErrorDetail: document.getElementById("import-error-detail"),
    // Investment Holding Modal elements
    btnOpenHoldingModal: document.getElementById("btn-open-holding-modal"),
    holdingModal: document.getElementById("holding-modal"),
    btnCloseHoldingModal: document.getElementById("btn-close-holding-modal"),
    btnCancelHolding: document.getElementById("btn-cancel-holding"),
    btnDeleteHolding: document.getElementById("btn-delete-holding"),
    btnSaveHolding: document.getElementById("btn-save-holding"),
    formAddHolding: document.getElementById("form-add-holding"),
    // The modal has one box for the name: the search box doubles as the name field
    inputHoldingName: document.getElementById("modal-omni-search-input"),
    selectHoldingAssetClass: document.getElementById("select-holding-assetclass"),
    inputHoldingSubCategory: document.getElementById("input-holding-subcategory"),
    holdingMfVariantBox: document.getElementById("holding-mf-variant-box"),
    radioVariantDirect: document.getElementById("radio-variant-direct"),
    radioVariantRegular: document.getElementById("radio-variant-regular"),
    labelVariantDirect: document.getElementById("label-variant-direct"),
    labelVariantRegular: document.getElementById("label-variant-regular"),
    mfNavDirect: document.getElementById("mf-nav-direct"),
    mfNavRegular: document.getElementById("mf-nav-regular"),
    selectHoldingMember: document.getElementById("select-holding-member"),
    inputHoldingCustodian: document.getElementById("input-holding-custodian"),
    inputHoldingPrice: document.getElementById("input-holding-price"),
    inputHoldingRate: document.getElementById("input-holding-rate"),
    inputHoldingUnits: document.getElementById("input-holding-units"),
    inputHoldingCurVal: document.getElementById("input-holding-curval"),
    inputHoldingInvVal: document.getElementById("input-holding-invval"),
    inputHoldingPurchaseFx: document.getElementById("input-holding-purchasefx"),
    selectHoldingGoal: document.getElementById("select-holding-goal"),
    // Market Data Status Modal elements
    dataStatusModal: document.getElementById("data-status-modal"),
    btnCloseDataStatusModal: document.getElementById("btn-close-data-status-modal"),
    btnDoneDataStatus: document.getElementById("btn-done-data-status"),
    feedStatusGrid: document.getElementById("feed-status-grid"),
    statusSummaryBanner: document.getElementById("status-summary-banner"),
    statusSummaryIcon: document.getElementById("status-summary-icon"),
    statusSummaryTitle: document.getElementById("status-summary-title"),
    statusLastSyncedTime: document.getElementById("status-last-synced-time")
  };

  // ==========================================================================
  // Number & Currency Formatters (Indian Rupee Standard)
  // ==========================================================================
  function formatINR(val, compact = false) {
    if (val == null || val === "" || isNaN(val)) return "—";
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

  function formatUSD(val, compact = false) {
    if (val == null || val === "" || isNaN(val)) return "—";
    const num = Number(val);
    const abs = Math.abs(num);
    const sign = num < 0 ? "-" : "";

    if (compact) {
      if (abs >= 1000000) {
        return `${sign}$${(abs / 1000000).toFixed(2)}M`;
      }
      if (abs >= 10000) {
        return `${sign}$${(abs / 1000).toFixed(1)}K`;
      }
    }

    return `${sign}$${abs.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  function formatPct(val) {
    if (val == null || val === "" || isNaN(val)) return "—";
    const n = Number(val);
    const sign = n > 0 ? "+" : "";
    return `${sign}${n.toFixed(1)}%`;
  }

  function formatAsOfDate(isoStr) {
    if (!isoStr) return "08 Nov 2026";
    try {
      const parts = String(isoStr).split("-");
      if (parts.length === 3) {
        const year = parts[0];
        const monthNum = parseInt(parts[1], 10) - 1;
        const day = parts[2];
        const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        return `${day} ${months[monthNum] || parts[1]} ${year}`;
      }
    } catch (_) {}
    return String(isoStr);
  }

  function extractUsTicker(name) {
    if (!name) return null;
    const str = String(name).trim();
    const parenMatch = str.match(/\(([A-Za-z0-9.]+)\)/);
    if (parenMatch) return parenMatch[1].toUpperCase();
    if (/^[A-Za-z0-9.]{1,6}$/.test(str)) return str.toUpperCase();
    return null;
  }

  // ==========================================================================
  // Toast Notifications
  // ==========================================================================
  let toastTimer = null;
  function showToast(message, type = "success", action = null) {
    if (!els.toast) return;
    clearTimeout(toastTimer);
    els.toast.textContent = message;
    if (action && typeof action.onAction === "function") {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "toast-action-btn";
      btn.textContent = action.label || "Undo";
      btn.addEventListener("click", () => {
        clearTimeout(toastTimer);
        els.toast.className = "toast-notice";
        action.onAction();
      });
      els.toast.appendChild(btn);
    }
    els.toast.className = `toast-notice show ${type}`;
    toastTimer = setTimeout(() => {
      els.toast.className = "toast-notice";
    }, action ? 7000 : 3200);
  }

  // Flag unsaved changes so the Save button pulses and leaving the page warns the user
  function markDataChanged() {
    if (window.KYF_VAULT && typeof window.KYF_VAULT.markDirty === "function") {
      window.KYF_VAULT.markDirty();
    }
  }

  document.addEventListener("vault:dirtychange", (e) => {
    if (els.navSaveBtn) {
      els.navSaveBtn.classList.toggle("has-unsaved", !!(e.detail && e.detail.dirty));
    }
  });

  // ==========================================================================
  // Market Pulse Status Bar Renderer
  // ==========================================================================
  function renderMarketPulse() {
    const pulse = window.KYF_MARKET_PULSE || {};
    const macro = pulse.macro || {};
    const metals = pulse.preciousMetals || {};
    const indices = pulse.indices || {};
    const statusObj = window.KYF_MARKET_STATUS || null;
    const rawAsOf = (statusObj && statusObj.feeds && statusObj.feeds.equities && statusObj.feeds.equities.asOf) ||
                    (window.KYF_MARKET_EQUITIES && window.KYF_MARKET_EQUITIES.asOf) ||
                    (window.KYF_MARKET_MF && window.KYF_MARKET_MF.asOf) ||
                    pulse.asOf || "2026-11-08";
    const formattedAsOf = formatAsOfDate(rawAsOf);
    const overallStatus = (statusObj && statusObj.overallStatus) || "HEALTHY";
    const dotClass = overallStatus === "HEALTHY" ? "online" : (overallStatus === "WARNING" ? "warning" : "error");

    if (els.pulseAsOf) {
      els.pulseAsOf.innerHTML = `<span class="status-indicator-dot ${dotClass}"></span><span>Market As of: <strong>${formattedAsOf}</strong> <span style="font-size:10px;opacity:0.8;margin-left:4px;">📊 Feeds Health</span></span>`;
      els.pulseAsOf.setAttribute("title", "Click to inspect Market Data Health, As-Of Dates and sync sources");
    }
    if (els.portfolioTopAsOf) {
      els.portfolioTopAsOf.innerHTML = `<span class="status-indicator-dot ${dotClass}" id="top-status-dot"></span> Market As of: <strong id="portfolio-asof-date">${formattedAsOf}</strong> <span class="asof-feeds-badge">📊 Feeds Health</span>`;
      els.portfolioTopAsOf.setAttribute("title", "Click to inspect all 6 market data sync feeds & as-of dates");
    }
    if (els.portfolioAsofDate) {
      els.portfolioAsofDate.textContent = formattedAsOf;
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

    let grandTotal = 0;
    const memberTotals = new Map();
    for (const h of allHoldings || []) {
      grandTotal += h.currentValue || 0;
      const mName = h.member || "Unassigned";
      memberTotals.set(mName, (memberTotals.get(mName) || 0) + (h.currentValue || 0));
    }

    // Build unique list of individuals from first-class rawMembers, augmented with any holding-assigned members
    const memberList = [];
    const knownNames = new Set();

    const baseList = (rawMembers && rawMembers.length > 0)
      ? rawMembers
      : (isDemoMode
          ? (window.KYF_PORTFOLIO_DATA && window.KYF_PORTFOLIO_DATA.getDemoMembers ? window.KYF_PORTFOLIO_DATA.getDemoMembers() : [])
          : [{ id: "mem_self", name: "Self", role: "Self", avatar: "👤" }]);

    for (const m of baseList) {
      if (!knownNames.has(m.name)) {
        knownNames.add(m.name);
        memberList.push({
          id: m.id || `mem_${m.name.toLowerCase()}`,
          name: m.name,
          avatar: m.avatar || "👤",
          role: m.role || "Family",
          totalVal: memberTotals.get(m.name) || 0
        });
      }
    }

    // Also include any member name that appears in holdings but wasn't yet in rawMembers
    for (const [mName, val] of memberTotals.entries()) {
      if (!knownNames.has(mName) && mName !== "Unassigned" && !mName.includes("&")) {
        knownNames.add(mName);
        memberList.push({
          id: `mem_${mName.toLowerCase()}`,
          name: mName,
          avatar: "👤",
          role: "Family",
          totalVal: val
        });
      }
    }

    const isAll = (activeMemberScope === "ALL");

    let html = `
      <button type="button" class="member-chip ${isAll ? "active" : ""}" data-name="ALL" title="View combined portfolio for all family members">
        <span class="chip-name">All Family</span>
        <span class="chip-amount">${formatINR(grandTotal, true)}</span>
      </button>
    `;

    for (const m of memberList) {
      const isSelected = !isAll && (activeMemberScope instanceof Set && activeMemberScope.has(m.name));
      html += `
        <button type="button" class="member-chip ${isSelected ? "active" : ""}" data-name="${escapeHTML(m.name)}" title="${escapeHTML(m.name)} (${escapeHTML(m.role || "Family")}): ${formatINR(m.totalVal)}">
          <span class="chip-name">${escapeHTML(m.name)}</span>
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
              // Only collapse to ALL if there are multiple members and all of them are selected
              if (memberList.length > 1 && activeMemberScope.size === memberList.length) {
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

    // Share per-goal funding with the Goals page (derived, never stored in the .kyf file)
    if (!isDemoMode && window.KYF_GOALS && window.KYF_PORTFOLIO_ENGINE.expandGoalSlices) {
      const fundingSlices = window.KYF_PORTFOLIO_ENGINE.expandGoalSlices(enriched, rawGoals).slices;
      const byGoal = {};
      fundingSlices.forEach((sl) => {
        const gid = sl.goalId || (sl.allocations && sl.allocations[0] && sl.allocations[0].goalId);
        if (gid && gid !== "goal_unallocated") byGoal[gid] = (byGoal[gid] || 0) + Math.max(0, sl.currentValue || 0);
      });
      window.KYF_GOALS.writeFundingCache(byGoal);
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

    // 8. Update KPI Hero Cards (Reflects Active Family Scope, Active Currency & Slicers)
    const kpis = pivotResult.kpis;
    const fxDefault = window.KYF_PORTFOLIO_ENGINE.getUsdInr().rate;

    // Scoped USD totals (strictly for holdings currently visible in scope)
    const scopedUsdWorth = scopedHoldings.reduce((sum, h) => sum + (h.currency === "USD" ? (h.currentValueUSD || 0) : 0), 0);
    const scopedUsdInvested = scopedHoldings.reduce((sum, h) => sum + (h.currency === "USD" ? (h.investedValueUSD || 0) : 0), 0);
    const allScopedAreUsd = scopedHoldings.length > 0 && scopedHoldings.every(h => h.currency === "USD" || h.pricingMode === "LIVE_US");

    // Sync currency toggle buttons in header
    document.querySelectorAll(".currency-btn").forEach((btn) => {
      btn.classList.toggle("active", btn.getAttribute("data-curr") === activeCurrency);
    });

    // Update column headers for Invested and Current Value
    if (els.thInvestedTitle) {
      els.thInvestedTitle.textContent = activeCurrency === "USD" ? "Invested ($)" : "Invested (₹)";
    }
    if (els.thCurValTitle) {
      els.thCurValTitle.textContent = activeCurrency === "USD" ? "Current Value ($)" : "Current Value (₹)";
    }

    let scopeLabel = "All Family";
    if (activeMemberScope instanceof Set) {
      scopeLabel = Array.from(activeMemberScope).join(", ");
    }
    const unitWord = activeDimension === "goal" ? "slices" : "holdings";
    const resetScopeBtnHTML = (activeMemberScope instanceof Set)
      ? ` <button type="button" class="btn-reset-member-scope" id="btn-reset-member-scope" title="Reset filter to show all family members">✕ Show All Family</button>`
      : "";

    if (activeCurrency === "USD") {
      const totalPortfolioUSD = (scopedUsdWorth > 0 && allScopedAreUsd)
        ? scopedUsdWorth
        : (kpis.totalPortfolioValue / fxDefault);
      const totalInvestedUSD = (scopedUsdInvested > 0 && allScopedAreUsd)
        ? scopedUsdInvested
        : (kpis.totalPortfolioInvested / fxDefault);
      const totalGainUSD = totalPortfolioUSD - totalInvestedUSD;

      if (els.kpiNetWorth) els.kpiNetWorth.textContent = formatUSD(totalPortfolioUSD, totalPortfolioUSD >= 10000);
      if (els.kpiInvested) els.kpiInvested.textContent = formatUSD(totalInvestedUSD, totalInvestedUSD >= 10000);

      if (els.kpiNetWorthSub) {
        const inrEquivalent = formatINR(kpis.totalPortfolioValue, true);
        els.kpiNetWorthSub.innerHTML = `Scope: ${escapeHTML(scopeLabel)} (${kpis.holdingsCount} ${unitWord}) &bull; &asymp; ${inrEquivalent} (@ ₹${fxDefault.toFixed(2)}/\$)${resetScopeBtnHTML}`;
      }

      if (els.kpiReturnPct && els.kpiGainLoss) {
        if (kpis.activeHorizonReturnPct != null) {
          const isPositive = kpis.activeHorizonReturnPct >= 0;
          const gainSign = isPositive ? "+" : "";
          els.kpiReturnPct.textContent = formatPct(kpis.activeHorizonReturnPct);
          els.kpiGainLoss.textContent = `${gainSign}${formatUSD(totalGainUSD, Math.abs(totalGainUSD) >= 10000)}`;
          els.kpiReturnPct.className = `return-badge ${isPositive ? "positive" : "negative"}`;
        } else {
          els.kpiReturnPct.textContent = "—";
          els.kpiGainLoss.textContent = "—";
          els.kpiReturnPct.className = "return-badge neutral";
        }
        if (els.kpiGainSub) {
          const hLabel = activeHorizon === "all" ? "All-Time" : activeHorizon.toUpperCase();
          els.kpiGainSub.textContent = `${hLabel} return`;
        }
      }
    } else {
      // INR Mode
      if (els.kpiNetWorth) els.kpiNetWorth.textContent = formatINR(kpis.totalPortfolioValue, true);
      if (els.kpiInvested) els.kpiInvested.textContent = formatINR(kpis.totalPortfolioInvested, true);

      if (els.kpiNetWorthSub) {
        const usdNote = scopedUsdWorth > 0
          ? ` &bull; Includes $${scopedUsdWorth.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} in US assets`
          : "";
        els.kpiNetWorthSub.innerHTML = kpis.totalLiabilities > 0
          ? `Assets ${formatINR(kpis.totalAssets, true)} &minus; Debt ${formatINR(kpis.totalLiabilities, true)} &bull; ${escapeHTML(scopeLabel)} (${kpis.holdingsCount} ${unitWord})${usdNote}${resetScopeBtnHTML}`
          : `Scope: ${escapeHTML(scopeLabel)} (${kpis.holdingsCount} ${unitWord})${usdNote}${resetScopeBtnHTML}`;
      }

      if (els.kpiReturnPct && els.kpiGainLoss) {
        if (kpis.activeHorizonReturnPct != null) {
          const isPositive = kpis.activeHorizonReturnPct >= 0;
          const gainSign = isPositive ? "+" : "";
          els.kpiReturnPct.textContent = formatPct(kpis.activeHorizonReturnPct);
          els.kpiGainLoss.textContent = `${gainSign}${formatINR(kpis.totalPortfolioGainLoss, true)}`;
          els.kpiReturnPct.className = `return-badge ${isPositive ? "positive" : "negative"}`;
        } else {
          els.kpiReturnPct.textContent = "—";
          els.kpiGainLoss.textContent = "—";
          els.kpiReturnPct.className = "return-badge neutral";
        }
        if (els.kpiGainSub) {
          const hLabel = activeHorizon === "all" ? "All-Time" : activeHorizon.toUpperCase();
          els.kpiGainSub.textContent = `${hLabel} return`;
        }
      }
    }

    const resetScopeBtn = document.getElementById("btn-reset-member-scope");
    if (resetScopeBtn) {
      resetScopeBtn.addEventListener("click", () => {
        activeMemberScope = "ALL";
        renderApp();
      });
    }

    // 9. Update Sort Indicators in Header
    updateSortHeadersUI();

    // 10. Render Aligned TreeGrid
    if (rawHoldings.length === 0) {
      const pulse = window.KYF_MARKET_PULSE || {};
      const metals = pulse.preciousMetals || {};
      const macro = pulse.macro || {};

      const goldSub = metals.gold24kPerGram ? `₹${Number(metals.gold24kPerGram).toLocaleString("en-IN")}/g` : "₹14,280/g";
      const fdSub = macro.sbiFd1Yr ? `FD ~${macro.sbiFd1Yr}%` : "Bank FD ~6.8%";
      const epfSub = macro.epfRate ? `${macro.epfRate}% Sov.` : "8.25% Sov.";
      const loanSub = macro.homeLoanAvg ? `~${macro.homeLoanAvg}%` : "~8.65%";

      els.treegrid.innerHTML = `
        <div class="portfolio-empty-box">
          <div class="portfolio-empty-icon">🏛️</div>
          <h2 class="portfolio-empty-title">What do you own?</h2>
          <p class="portfolio-empty-desc">
            Type any stock, mutual fund or city to begin — or pick a common asset type below.
          </p>

          <!-- Typeahead Search Box -->
          <div class="omni-search-wrapper">
            <div class="omni-search-input-box">
              <span class="omni-search-icon">🔍</span>
              <input
                type="text"
                id="empty-omni-search-input"
                class="omni-search-input"
                placeholder="Search stock, fund or city (e.g. Parag, SBIN, Bengaluru)..."
                autocomplete="off"
                spellcheck="false"
              >
              <button type="button" class="omni-search-clear" id="empty-omni-search-clear" style="display:none;" aria-label="Clear search">✕</button>
            </div>
            <div id="empty-omni-search-results" class="omni-search-results" style="display:none;"></div>
          </div>

          <!-- Quick-Pick Tiles -->
          <div class="quick-pick-section">
            <div class="quick-pick-label">Or select a standard asset:</div>
            <div class="quick-pick-grid">
              <button type="button" class="quick-pick-tile" data-quick="gold" title="Physical Gold / Sovereign Gold Bond">
                <span class="tile-icon">🪙</span>
                <span class="tile-name">Gold</span>
                <span class="tile-sub mono-num">${goldSub}</span>
              </button>

              <button type="button" class="quick-pick-tile" data-quick="fd" title="Bank Fixed Deposit">
                <span class="tile-icon">🏦</span>
                <span class="tile-name">Fixed Deposit</span>
                <span class="tile-sub mono-num">${fdSub}</span>
              </button>

              <button type="button" class="quick-pick-tile" data-quick="epf" title="EPF / PPF Retirement Corpus">
                <span class="tile-icon">🛡️</span>
                <span class="tile-name">EPF / PPF</span>
                <span class="tile-sub mono-num">${epfSub}</span>
              </button>

              <button type="button" class="quick-pick-tile" data-quick="cash" title="Bank Savings & Liquid Cash">
                <span class="tile-icon">💵</span>
                <span class="tile-name">Cash &amp; Bank</span>
                <span class="tile-sub">Liquid</span>
              </button>

              <button type="button" class="quick-pick-tile" data-quick="loan" title="Home Loan / Liability">
                <span class="tile-icon">🏠</span>
                <span class="tile-name">Loan / Debt</span>
                <span class="tile-sub mono-num">${loanSub}</span>
              </button>
            </div>
          </div>

          <div class="portfolio-empty-footer">
            <div style="display:flex; justify-content:center; gap:16px; align-items:center; flex-wrap:wrap;">
              <button type="button" class="btn-empty-secondary" id="btn-empty-open-vault">
                <span>📂 Open .kyf Vault</span>
              </button>
              <button type="button" class="empty-state-demo-link" id="empty-state-demo-link">
                <span>Try demo family (Rajesh &amp; Priya) &rarr;</span>
              </button>
            </div>
          </div>
        </div>
      `;

      // Wire omni-search in empty state
      wireOmniSearch(
        document.getElementById("empty-omni-search-input"),
        document.getElementById("empty-omni-search-results"),
        document.getElementById("empty-omni-search-clear")
      );

      // Wire quick-pick tiles
      const tiles = els.treegrid.querySelectorAll(".quick-pick-tile");
      tiles.forEach((tile) => {
        tile.addEventListener("click", () => {
          const quickType = tile.getAttribute("data-quick");
          handleQuickPick(quickType);
        });
      });

      const emptyOpenBtn = document.getElementById("btn-empty-open-vault");
      if (emptyOpenBtn) {
        emptyOpenBtn.addEventListener("click", () => {
          if (els.navOpenFileBtn) els.navOpenFileBtn.click();
          else if (els.kyfFileInput) els.kyfFileInput.click();
        });
      }

      const demoLink = document.getElementById("empty-state-demo-link");
      if (demoLink) {
        demoLink.addEventListener("click", () => {
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
      // null >= 0 is true in JS, so a group with no return would wrongly show a green badge
      const groupReturnClass = group.horizonReturnPct == null ? "neutral" : (group.horizonReturnPct >= 0 ? "positive" : "negative");

      // Goal Specific Sub-Header (Progress Bar, Dual-Unit Accumulation, Divergence & Horizon Badge)
      let goalHeaderExtra = "";
      const groupUsdTotal = group.holdings.reduce((sum, h) => sum + (h.currency === "USD" ? (h.currentValueUSD || 0) : 0), 0);
      const groupUsdInvested = group.holdings.reduce((sum, h) => sum + (h.currency === "USD" ? (h.investedValueUSD || 0) : 0), 0);
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
            <div class="goal-progress-container" title="Inflation-Adjusted Target: ${formatINR(group.adjustedTargetINR)} (${infl.inflationRate}% ${infl.inflationCategory} compounded over ${yearsRemaining} yrs from base ${formatINR(meta.baseTargetINR, true)})">
              <div class="goal-progress-bar">
                <div class="goal-progress-fill ${isFunded ? "funded" : ""}" style="width: ${clampedWidth}%;"></div>
              </div>
              <span class="goal-progress-label mono-num">${group.progressPct}% of ${formatINR(group.adjustedTargetINR, true)}</span>
            </div>
          `;
        }

        let dualUnitHTML = "";
        if (group.dualUnit && group.dualUnit.enabled) {
          const du = group.dualUnit;
          const icon = du.unitType === "GRAMS_GOLD" ? "🪙" : "🏠";
          dualUnitHTML = `
            <div class="dual-unit-row">
              <span class="dual-unit-badge mono-num" title="Physical Accumulation: ${du.accumulatedUnits.toLocaleString("en-IN")} of ${du.targetUnits.toLocaleString("en-IN")} ${escapeHTML(du.unitLabel)} (${du.progressPct}%)">
                ${icon} ${du.accumulatedUnits.toLocaleString("en-IN")} / ${du.targetUnits.toLocaleString("en-IN")} ${escapeHTML(du.unitLabel)} &bull; ${du.progressPct}%
              </span>
              ${du.hasDivergence ? `
                <span class="divergence-alert-pill" title="${escapeHTML(du.divergenceMessage)}">
                  ⚠️ Price Divergence: +${du.divergencePct}%
                </span>
              ` : ""}
            </div>
          `;
        }

        goalHeaderExtra = `
          <div class="goal-summary-meta">
            <div class="goal-meta-top">
              <span class="goal-horizon-tag">⏳ ${yearsRemaining === 0 ? "Target Met" : `${yearsRemaining} yrs (${targetYear})`}</span>
              ${progressBarHTML}
            </div>
            ${dualUnitHTML}
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
                  ${group.physicalSummary ? `<span class="physical-summary-badge mono-num" title="Aggregated Physical Units">${escapeHTML(group.physicalSummary.label)}</span>` : ""}
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
              ${activeCurrency === "USD"
                ? (groupUsdInvested > 0 || group.totalInvested > 0
                    ? `<div><span style="font-weight:600;">${formatUSD(groupUsdInvested > 0 ? groupUsdInvested : (group.totalInvested / fxDefault))}</span><div style="font-size:11px;color:var(--muted);font-weight:normal;margin-top:2px;">≈ ${formatINR(group.totalInvested, true)}</div></div>`
                    : "—")
                : formatINR(group.totalInvested)
              }
              ${activeCurrency === "INR" && groupUsdInvested > 0 ? `<div style="font-size:11px;color:var(--muted);font-weight:normal;margin-top:2px;">(inc. $${groupUsdInvested.toLocaleString("en-US", {minimumFractionDigits: 2, maximumFractionDigits: 2})})</div>` : ""}
            </div>

            <!-- Col 4: Total Current Value (Visible on both Desktop and Mobile) -->
            <div class="tree-group-num-cell tree-col-right mono-num group-value-cell${group.totalCurrentValue < 0 ? " is-debt" : ""}">
              ${activeCurrency === "USD"
                ? (groupUsdTotal > 0 || group.totalCurrentValue > 0
                    ? `<div><span style="font-weight:700;color:var(--teal, #0b6b6d);">${formatUSD(groupUsdTotal > 0 ? groupUsdTotal : (group.totalCurrentValue / fxDefault))}</span><div style="font-size:11.5px;color:var(--muted);font-weight:normal;margin-top:2px;">≈ ${formatINR(group.totalCurrentValue, true)}</div></div>`
                    : "—")
                : formatINR(group.totalCurrentValue)
              }
              ${activeCurrency === "INR" && groupUsdTotal > 0 ? `<div style="font-size:11px;color:var(--teal, #0b6b6d);font-weight:normal;margin-top:2px;">(inc. $${groupUsdTotal.toLocaleString("en-US", {minimumFractionDigits: 2, maximumFractionDigits: 2})})</div>` : ""}
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
                const targetHoldingId = h.originalHoldingId || h.id;
                const isPos = h.activeHorizonReturn >= 0;
                const retClass = h.activeHorizonReturn == null ? "neutral" : (isPos ? "positive" : "negative");

                const custTag = activeDimension !== "custodian" ? `<span class="tag-badge badge-custodian">🏦 ${escapeHTML(h.custodian || "")}</span>` : "";
                const regularDragTag = h.regularAlert
                  ? `<span class="tag-badge badge-regular-alert" title="${escapeHTML(h.regularAlert.message)}">⚠️ Regular Plan Drag</span>`
                  : "";
                const sliceTag = h.isSlice
                  ? `<span class="tag-badge badge-slice" title="${h.slicePercentage}% virtual allocation of full holding (Total live: ${formatINR(h.originalCurrentValue)})">🍰 ${h.slicePercentage}% slice</span>`
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
                        <span class="leaf-name-text${isDemoMode ? "" : " is-editable"}" data-holding-id="${escapeHTML(targetHoldingId)}">${escapeHTML(h.name)}</span>
                        <div class="leaf-actions"${isDemoMode ? " hidden" : ""}>
                          <button type="button" class="btn-leaf-action btn-edit-leaf" data-holding-id="${escapeHTML(targetHoldingId)}" title="Edit holding" aria-label="Edit ${escapeHTML(h.name)}">✏️ Edit</button>
                          <button type="button" class="btn-leaf-action btn-delete-leaf" data-holding-id="${escapeHTML(targetHoldingId)}" title="Delete holding" aria-label="Delete ${escapeHTML(h.name)}">🗑️</button>
                        </div>
                      </div>
                      <div class="leaf-tags">
                        ${h.isLiability ? '<span class="tag-badge tag-badge--debt">Debt</span>' : ""}
                        ${(h.currency === "USD" || h.pricingMode === "LIVE_US") ? '<span class="tag-badge tag-us">USD ($)</span>' : ""}
                        <span class="tag-badge">${escapeHTML(h.subCategory || h.assetClass)}</span>
                        ${sliceTag}
                        ${custTag}
                        ${regularDragTag}
                      </div>
                      <div class="leaf-mobile-sub mono-num">
                        ${escapeHTML(h.priceLabel || "")} &bull; 👤 ${escapeHTML(h.member || "")} &bull; Inv: ${(h.currency === "USD" || h.pricingMode === "LIVE_US") ? (h.investedValueUSD != null && h.investedValueUSD > 0 ? `$${h.investedValueUSD.toLocaleString("en-US", {minimumFractionDigits: 2})} (≈${formatINR(h.investedValue, true)})` : "—") : (activeCurrency === "USD" && h.investedValue != null ? `${formatUSD(h.investedValue / (h.fxRate || fxDefault))} (≈${formatINR(h.investedValue, true)})` : (h.investedValue != null ? formatINR(h.investedValue, true) : "—"))}
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
                      ${(h.currency === "USD" || h.pricingMode === "LIVE_US")
                        ? (h.investedValueUSD != null && h.investedValueUSD > 0
                            ? `<div><span class="leaf-primary-usd" style="font-size:14px;font-weight:600;color:var(--text);">$${h.investedValueUSD.toLocaleString("en-US", {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span><div class="leaf-inr-sub" style="font-size:11px;color:var(--muted);font-weight:normal;margin-top:2px;">≈ ${formatINR(h.investedValue)}</div></div>`
                            : "—")
                        : (activeCurrency === "USD"
                            ? (h.investedValue != null ? `<div><span class="leaf-primary-usd" style="font-size:14px;font-weight:600;color:var(--text);">${formatUSD(h.investedValue / (h.fxRate || fxDefault))}</span><div class="leaf-inr-sub" style="font-size:11px;color:var(--muted);font-weight:normal;margin-top:2px;">≈ ${formatINR(h.investedValue)}</div></div>` : "—")
                            : (h.investedValue != null ? formatINR(h.investedValue) : "—"))
                      }
                    </div>

                    <!-- Col 4: Live Current Value (Visible on both Desktop and Mobile) -->
                    <div class="leaf-num-cell leaf-value-cell tree-col-right mono-num${h.isLiability ? " is-debt" : ""}">
                      ${(h.currency === "USD" || h.pricingMode === "LIVE_US")
                        ? (h.currentValueUSD != null && h.currentValueUSD > 0
                            ? `<div><span class="leaf-primary-usd" style="font-size:15px;font-weight:700;color:var(--teal, #0b6b6d);">$${h.currentValueUSD.toLocaleString("en-US", {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span><div class="leaf-inr-sub" style="font-size:11.5px;color:var(--muted);font-weight:normal;margin-top:2px;">≈ ${formatINR(h.currentValue)}</div></div>`
                            : formatINR(h.currentValue))
                        : (activeCurrency === "USD"
                            ? `<div><span class="leaf-primary-usd" style="font-size:15px;font-weight:700;color:var(--teal, #0b6b6d);">${formatUSD(h.currentValue / (h.fxRate || fxDefault))}</span><div class="leaf-inr-sub" style="font-size:11.5px;color:var(--muted);font-weight:normal;margin-top:2px;">≈ ${formatINR(h.currentValue)}</div></div>`
                            : formatINR(h.currentValue))
                      }
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

    // Clicking a holding's name opens it for editing (same as the Edit button)
    els.treegrid.querySelectorAll(".leaf-name-text.is-editable").forEach((el) => {
      el.addEventListener("click", () => {
        const hid = el.getAttribute("data-holding-id");
        if (hid) openHoldingModalForEdit(hid);
      });
    });

    // Attach Edit and Delete listeners to leaf row buttons
    els.treegrid.querySelectorAll(".btn-edit-leaf").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const hid = btn.getAttribute("data-holding-id");
        if (hid) openHoldingModalForEdit(hid);
      });
    });

    els.treegrid.querySelectorAll(".btn-delete-leaf").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const hid = btn.getAttribute("data-holding-id");
        if (hid) handleDeleteHolding(hid);
      });
    });
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
  // Family Member Management Modal Controllers
  // ==========================================================================
  function openMemberModal() {
    if (!els.memberModal) return;
    renderModalMembersList();
    els.memberModal.style.display = "flex";
    els.memberModal.setAttribute("aria-hidden", "false");
    if (els.inputMemberName) {
      els.inputMemberName.value = "";
      els.inputMemberName.focus();
    }
  }

  function closeMemberModal() {
    if (!els.memberModal) return;
    els.memberModal.style.display = "none";
    els.memberModal.setAttribute("aria-hidden", "true");
  }

  function renderModalMembersList() {
    if (!els.modalMembersList) return;

    const list = (rawMembers && rawMembers.length > 0)
      ? rawMembers
      : (isDemoMode
          ? (window.KYF_PORTFOLIO_DATA && window.KYF_PORTFOLIO_DATA.getDemoMembers ? window.KYF_PORTFOLIO_DATA.getDemoMembers() : [])
          : [{ id: "mem_self", name: "Self", role: "Self", avatar: "👤" }]);

    if (list.length === 0) {
      els.modalMembersList.innerHTML = `
        <div style="color:var(--muted); font-size:12px; padding:12px 0;">No family members defined. Add your first member below.</div>
      `;
      return;
    }

    let html = "";
    list.forEach((m) => {
      const holdingCount = rawHoldings.filter((h) => h.member === m.name).length;
      const countLabel = holdingCount === 1 ? "1 holding" : `${holdingCount} holdings`;
      const initial = (m.name || "M").charAt(0).toUpperCase();
      html += `
        <div class="modal-member-row" data-id="${escapeHTML(m.id || m.name)}" data-name="${escapeHTML(m.name)}">
          <div style="display:flex; align-items:center; gap:10px;">
            <div class="member-avatar-initial">${escapeHTML(initial)}</div>
            <div>
              <div style="font-weight:600; font-size:13px; color:var(--text);">${escapeHTML(m.name)}</div>
              <div style="font-size:11px; color:var(--muted);">${escapeHTML(m.role || "Family")} &bull; ${countLabel}</div>
            </div>
          </div>
          <button type="button" class="btn-delete-member" data-name="${escapeHTML(m.name)}" title="Remove ${escapeHTML(m.name)}">🗑 Remove</button>
        </div>
      `;
    });

    els.modalMembersList.innerHTML = html;

    // Bind delete buttons
    const delBtns = els.modalMembersList.querySelectorAll(".btn-delete-member");
    delBtns.forEach((btn) => {
      btn.addEventListener("click", async () => {
        const nameToDelete = btn.getAttribute("data-name");
        if (!nameToDelete) return;

        if (isDemoMode) {
          const switchOwn = window.confirm(`Demo data is read-only. Switch to your own portfolio to manage members?`);
          if (!switchOwn) return;
          await leaveDemo();
          showToast("Demo closed — switched to your portfolio", "info");
          renderModalMembersList();
          return;
        }

        const holdingCount = rawHoldings.filter((h) => h.member === nameToDelete).length;
        if (holdingCount > 0) {
          const fallbackMember = rawMembers.find((m) => m.name !== nameToDelete)?.name || "Self";
          const confirmMsg = `"${nameToDelete}" has ${holdingCount} holding(s) assigned.\n\nClick OK to reassign their holdings to "${fallbackMember}".\nClick Cancel to abort.`;
          if (!window.confirm(confirmMsg)) return;

          // Reassign holdings so the removed member name is no longer orphaned in holdings
          rawHoldings.forEach((h) => {
            if (h.member === nameToDelete) {
              h.member = fallbackMember;
            }
          });
          userHoldings = [...rawHoldings];
          localStorage.setItem("kyf_user_holdings", JSON.stringify(userHoldings));
          await window.KYF_PORTFOLIO_DATA.saveHoldingsToDB(rawHoldings);
        }

        rawMembers = rawMembers.filter((m) => m.name !== nameToDelete);
        userMembers = [...rawMembers];
        localStorage.setItem("kyf_user_members", JSON.stringify(userMembers));
        await window.KYF_PORTFOLIO_DATA.saveMembersToDB(userMembers);
        markDataChanged();

        if (activeMemberScope instanceof Set && activeMemberScope.has(nameToDelete)) {
          activeMemberScope.delete(nameToDelete);
          if (activeMemberScope.size === 0) activeMemberScope = "ALL";
        }

        renderModalMembersList();
        renderApp();
        showToast(`✓ Removed member "${nameToDelete}"`, "info");
      });
    });
  }

  async function handleAddMemberSubmit(e) {
    e.preventDefault();
    if (!els.inputMemberName) return;

    const name = els.inputMemberName.value.trim();
    const role = (els.selectMemberRole && els.selectMemberRole.value) || "Family";

    if (!name) {
      alert("Please enter a member name.");
      return;
    }

    if (isDemoMode) {
      await leaveDemo();
      showToast("Demo closed — adding to your own portfolio", "info");
    }

    if (rawMembers.some((m) => m.name.toLowerCase() === name.toLowerCase())) {
      alert(`A family member named "${name}" already exists.`);
      return;
    }

    const newMember = {
      id: `mem_${Date.now()}`,
      name,
      role
    };

    rawMembers.push(newMember);
    userMembers = [...rawMembers];
    localStorage.setItem("kyf_user_members", JSON.stringify(userMembers));
    await window.KYF_PORTFOLIO_DATA.saveMembersToDB(userMembers);
    markDataChanged();

    els.inputMemberName.value = "";
    renderModalMembersList();
    renderApp();
    showToast(`✓ Added family member "${name}"`, "success");
  }

  function inferMembersFromHoldings(holdings) {
    const list = [];
    const seen = new Set();
    for (const h of holdings || []) {
      const m = h.member;
      if (m && m !== "Unassigned" && !m.includes("&") && !seen.has(m)) {
        seen.add(m);
        let role = "Family";
        let avatar = "👤";
        if (m === "Self") { role = "Self"; avatar = "👤"; }
        else if (m === "Spouse") { role = "Spouse"; avatar = "👩"; }
        else if (m === "Father") { role = "Father"; avatar = "👴"; }
        else if (m === "Mother") { role = "Mother"; avatar = "👵"; }
        list.push({
          id: `mem_${m.toLowerCase()}`,
          name: m,
          role,
          avatar
        });
      }
    }
    if (list.length === 0) {
      list.push({ id: "mem_self", name: "Self", role: "Self", avatar: "👤" });
    }
    return list;
  }

  // ==========================================================================
  // Omni-Asset Search & Typeahead Controller (Stocks, Funds & Residex Cities)
  // ==========================================================================
  function searchMarketInstruments(query, limit = 8) {
    const q = (query || "").trim().toLowerCase().replace(/\s+/g, " ");
    if (!q || q.length < 2) return [];
    const tokens = q.split(" ");

    // Name match quality: exact > starts-with > every word starts a name word > loose substring.
    // Longer names lose ties, so the closest (shortest) name surfaces first.
    const nameScore = (nm) => {
      if (nm === q) return 90;
      if (nm.startsWith(q)) return 80;
      if (tokens.every((t) => nm.includes(t))) {
        const words = nm.split(/[^a-z0-9]+/);
        if (tokens.every((t) => words.some((w) => w.startsWith(t)))) return tokens.length > 1 ? 60 : 50;
      }
      return nm.includes(q) ? 20 : 0;
    };

    const results = [];

    // 1. Stocks from window.KYF_MARKET_EQUITIES
    if (window.KYF_MARKET_EQUITIES && Array.isArray(window.KYF_MARKET_EQUITIES.stocks)) {
      for (const s of window.KYF_MARKET_EQUITIES.stocks) {
        // columns: [symbol, companyName, closePrice, ret1m, ret3m, ret6m, ret1y, isN500]
        const symbol = String(s[0] || "");
        const name = String(s[1] || "");
        const price = Number(s[2]) || 0;
        const sym = symbol.toLowerCase();
        const nm = name.toLowerCase();

        // Ticker typed exactly wins outright; a ticker prefix ranks below a name match
        // (so "parag" shows Parag Parikh Flexi Cap before the PARAGMILK ticker).
        let score = 0;
        if (sym === q) score = 100;
        else {
          score = Math.max(nameScore(nm), sym.startsWith(q) ? 70 : 0);
          if (score > 0) score += (s[7] === 1 ? 0.5 : 0) - nm.length / 1000;
        }

        if (score > 0) {
          results.push({
            type: "stock",
            tag: "Stock",
            tagClass: "tag-stock",
            symbol,
            name: `${name} (${symbol})`,
            rawName: name,
            subText: `NSE: ${symbol}`,
            price: price > 0 ? `₹${price.toLocaleString("en-IN")}` : "Live Quote",
            rawPrice: price,
            assetClass: "Equities",
            subCategory: s[7] === 1 ? "Nifty 500 Equities" : "NSE Equities",
            custodian: "Zerodha / Demat",
            score
          });
        }
      }
    }

    // 2. Mutual Funds from window.KYF_MARKET_MF
    if (window.KYF_MARKET_MF && Array.isArray(window.KYF_MARKET_MF.schemes)) {
      for (const f of window.KYF_MARKET_MF.schemes) {
        // columns: [directCode, fundName, category, directNav, regularNav, ret1m, ret3m, ret6m, ret1y]
        const code = f[0];
        const name = String(f[1] || "");
        const category = String(f[2] || "Mutual Funds");
        const directNav = f[3] != null ? Number(f[3]) : null;
        const regularNav = f[4] != null ? Number(f[4]) : null;
        const nav = directNav != null ? directNav : (regularNav != null ? regularNav : 0);
        const nm = name.toLowerCase();

        // +1 so a fund wins a dead-even name match against a stock (people searching by name mostly hold funds)
        let score = nameScore(nm);
        if (score > 0) score += 1 - nm.length / 1000;

        if (score > 0) {
          results.push({
            type: "fund",
            tag: "Fund",
            tagClass: "tag-fund",
            symbol: `MF-${code}`,
            amfiCode: code,
            name,
            rawName: name,
            subText: category,
            price: nav > 0 ? `NAV: ₹${nav.toFixed(2)}` : "Live NAV",
            rawPrice: nav,
            directNav,
            regularNav,
            assetClass: "Mutual Funds",
            subCategory: category,
            custodian: "MF Central / AMC",
            score
          });
        }
      }
    }

    // 3. Real Estate Cities from window.KYF_RESIDEX.cities
    if (window.KYF_RESIDEX && window.KYF_RESIDEX.cities) {
      for (const [cityName, cityData] of Object.entries(window.KYF_RESIDEX.cities)) {
        const cLower = cityName.toLowerCase();
        let score = 0;
        if (cLower === q) score = 95;
        else if (cLower.startsWith(q)) score = 75;
        else if (cLower.includes(q)) score = 35;

        if (score > 0) {
          let carpetRate = 8500;
          if (cityData.carpet_price_sqft_by2024 && cityData.carpet_price_sqft_by2024.composite) {
            const vals = Object.values(cityData.carpet_price_sqft_by2024.composite);
            if (vals.length > 0) carpetRate = vals[vals.length - 1];
          }

          results.push({
            type: "city",
            tag: "City",
            tagClass: "tag-city",
            symbol: cityName,
            name: `${cityName} Residential Property`,
            rawName: `${cityName} Residential Property`,
            subText: `NHB RESIDEX (${cityData.state || "India"})`,
            price: `₹${Number(carpetRate).toLocaleString("en-IN")}/sq.ft`,
            rawPrice: carpetRate,
            assetClass: "Real Estate",
            subCategory: "Residential Property",
            custodian: "Physical / Registry",
            score
          });
        }
      }
    }

    // 4. US Equities, ETFs & Mutual Funds from window.KYF_MARKET_US & Popular Catalog
    const popularEtfCatalog = [
      ["VOO", "Vanguard S&P 500 ETF", 698.35, "ETF"],
      ["VOOG", "Vanguard S&P 500 Growth ETF", 80.67, "ETF"],
      ["VOOV", "Vanguard S&P 500 Value ETF", 234.35, "ETF"],
      ["VUG", "Vanguard Growth ETF", 85.22, "ETF"],
      ["VTI", "Vanguard Total Stock Market ETF", 374.25, "ETF"],
      ["QQQ", "Invesco QQQ Trust (Nasdaq-100)", 690.38, "ETF"],
      ["QQQM", "Invesco NASDAQ 100 ETF", 284.23, "ETF"],
      ["SPY", "SPDR S&P 500 ETF Trust", 759.81, "ETF"],
      ["IVV", "iShares Core S&P 500 ETF", 763.08, "ETF"],
      ["SCHD", "Schwab U.S. Dividend Equity ETF", 36.02, "ETF"],
      ["VYM", "Vanguard High Dividend Yield ETF", 164.99, "ETF"],
      ["VIG", "Vanguard Dividend Appreciation ETF", 228.40, "ETF"],
      ["IWM", "iShares Russell 2000 ETF", 283.09, "ETF"],
      ["DIA", "SPDR Dow Jones Industrial Average ETF", 524.44, "ETF"],
      ["VT", "Vanguard Total World Stock ETF", 156.71, "ETF"],
      ["VXUS", "Vanguard Total International Stock ETF", 83.44, "ETF"],
      ["VEA", "Vanguard FTSE Developed Markets ETF", 57.80, "ETF"],
      ["VWO", "Vanguard FTSE Emerging Markets ETF", 49.30, "ETF"],
      ["INDA", "iShares MSCI India ETF", 51.59, "ETF"],
      ["TAN", "Invesco Solar ETF", 43.95, "ETF"],
      ["ICLN", "iShares Global Clean Energy ETF", 16.28, "ETF"],
      ["QCLN", "First Trust NASDAQ Clean Edge Green Energy ETF", 45.82, "ETF"],
      ["URA", "Global X Uranium ETF", 33.64, "ETF"],
      ["SMH", "VanEck Semiconductor ETF", 506.96, "ETF"],
      ["SOXX", "iShares Semiconductor ETF", 155.40, "ETF"],
      ["XLK", "Technology Select Sector SPDR Fund", 174.36, "ETF"],
      ["XLF", "Financial Select Sector SPDR Fund", 58.63, "ETF"],
      ["XLE", "Energy Select Sector SPDR Fund", 63.37, "ETF"],
      ["XLV", "Health Care Select Sector SPDR Fund", 188.95, "ETF"],
      ["VNQ", "Vanguard Real Estate ETF", 97.02, "ETF"],
      ["ARKK", "ARK Innovation ETF", 78.47, "ETF"],
      ["CIBR", "First Trust NASDAQ Cybersecurity ETF", 96.25, "ETF"],
      ["BOTZ", "Global X Robotics & Artificial Intelligence ETF", 32.23, "ETF"],
      ["IGV", "iShares Expanded Tech-Software Sector ETF", 98.60, "ETF"],
      ["IBIT", "iShares Bitcoin Trust ETF", 58.40, "ETF"],
      ["JEPI", "JPMorgan Equity Premium Income ETF", 58.21, "ETF"],
      ["JEPQ", "JPMorgan Nasdaq Equity Premium Income ETF", 56.93, "ETF"],
      ["BND", "Vanguard Total Bond Market ETF", 71.10, "ETF"],
      ["AGG", "iShares Core U.S. Aggregate Bond ETF", 95.84, "ETF"],
      ["TLT", "iShares 20+ Year Treasury Bond ETF", 80.92, "ETF"],
      ["HYG", "iShares iBoxx $ High Yield Corporate Bond ETF", 79.15, "ETF"],
      ["GLD", "SPDR Gold Shares", 365.17, "ETF"],
      ["IAU", "iShares Gold Trust", 52.40, "ETF"],
      ["SLV", "iShares Silver Trust", 46.65, "ETF"],
      ["GDX", "VanEck Gold Miners ETF", 41.20, "ETF"],
    ];

    const usCandidates = [];
    const seenUsTickers = new Set();

    if (window.KYF_MARKET_US && Array.isArray(window.KYF_MARKET_US.instruments)) {
      for (const inst of window.KYF_MARKET_US.instruments) {
        const t = String(inst[0] || "").toUpperCase();
        seenUsTickers.add(t);
        usCandidates.push(inst);
      }
    }
    for (const [t, nm, p, typ] of popularEtfCatalog) {
      if (!seenUsTickers.has(t)) {
        seenUsTickers.add(t);
        usCandidates.push([t, nm, p, typ, "USD", ""]);
      }
    }

    if (usCandidates.length > 0) {
      const fxRate = window.KYF_PORTFOLIO_ENGINE.getUsdInr().rate;
      for (const inst of usCandidates) {
        // columns: [ticker, name, closePrice, type, currency, lastUpdated]
        const ticker = String(inst[0] || "");
        const name = String(inst[1] || "");
        const priceUSD = Number(inst[2]) || 0;
        const instType = String(inst[3] || "EQUITY");
        const tickLower = ticker.toLowerCase();
        const nmLower = name.toLowerCase();

        let score = 0;
        if (tickLower === q) score = 100;
        else {
          score = Math.max(nameScore(nmLower), tickLower.startsWith(q) ? 75 : 0);
          if (score > 0) score += 1 - nmLower.length / 1000;
        }

        if (score > 0) {
          const usInfo = window.KYF_PORTFOLIO_ENGINE.usAssetInfo({ type: instType, category: inst[6] || "EQUITY" });
          const inrPrice = Math.round(priceUSD * fxRate);
          const tag = instType === "ETF" ? "US ETF" : (instType === "MUTUAL_FUND" ? "US Fund" : "US Stock");
          const subText = instType === "ETF" ? `US Exchange-Traded Fund (${ticker})` : (instType === "MUTUAL_FUND" ? `US Mutual Fund (${ticker})` : `US Equity (${ticker})`);

          results.push({
            type: "us_asset",
            tag,
            tagClass: "tag-us",
            symbol: ticker,
            name: `${name} (${ticker})`,
            rawName: name,
            subText,
            price: `$${priceUSD.toFixed(2)} (≈₹${inrPrice.toLocaleString("en-IN")})`,
            rawPrice: inrPrice,
            priceUSD: priceUSD,
            fxRate: fxRate,
            assetClass: usInfo.assetClass,
            subCategory: usInfo.subCategory,
            custodian: "Vested / DriveWealth",
            pricingMode: "LIVE_US",
            score
          });
        }
      }
    }

    results.sort((a, b) => b.score - a.score);

    // Keep the list mixed: a flood of stock matches must not hide the fund or city the user wants
    const caps = { stock: 4, fund: 4, us_asset: 4, city: 2 };
    const taken = { stock: 0, fund: 0, us_asset: 0, city: 0 };
    const picked = results.filter((r) => (taken[r.type] += 1) <= (caps[r.type] || 4));
    return picked.slice(0, limit);
  }

  function wireOmniSearch(inputEl, resultsEl, clearBtnEl, options = {}) {
    if (!inputEl || !resultsEl) return;
    // keepValue: leave the chosen name in the box (modal) instead of clearing it (empty-state)
    // isEnabled: lets the box stay a plain text field (e.g. when renaming an existing holding)
    const keepValue = !!options.keepValue;
    const isEnabled = typeof options.isEnabled === "function" ? options.isEnabled : () => true;

    let highlightedIndex = -1;
    let currentResults = [];

    function renderResults(results) {
      currentResults = results;
      highlightedIndex = -1;
      if ((!results || results.length === 0) && keepValue) {
        // Modal: the typed text is simply the holding's name, so no "not found" panel over the form
        resultsEl.style.display = "none";
        return;
      }
      if (!results || results.length === 0) {
        resultsEl.innerHTML = `
          <div style="padding: 12px 16px; font-size:12px; color:var(--muted); text-align:center;">
            No matching stock, fund or city found. Fill details manually in the form.
          </div>
        `;
        resultsEl.style.display = "block";
        return;
      }

      let html = "";
      results.forEach((r, idx) => {
        html += `
          <div class="omni-result-item" data-index="${idx}">
            <div class="omni-result-left">
              <span class="omni-tag ${r.tagClass}">${r.tag}</span>
              <div class="omni-result-text">
                <div class="omni-result-name">${escapeHTML(r.name)}</div>
                <div class="omni-result-sub">${escapeHTML(r.subText || "")}</div>
              </div>
            </div>
            <div class="omni-result-price mono-num">${r.price}</div>
          </div>
        `;
      });

      resultsEl.innerHTML = html;
      resultsEl.style.display = "block";

      const items = resultsEl.querySelectorAll(".omni-result-item");
      items.forEach((item) => {
        item.addEventListener("click", () => {
          const idx = parseInt(item.getAttribute("data-index"), 10);
          const chosen = currentResults[idx];
          if (chosen) {
            resultsEl.style.display = "none";
            if (!keepValue) {
              inputEl.value = "";
              if (clearBtnEl) clearBtnEl.style.display = "none";
            }
            initiateAddHoldingFromSelection(chosen);
          }
        });
      });
    }

    inputEl.addEventListener("input", (e) => {
      const q = e.target.value;
      if (clearBtnEl) clearBtnEl.style.display = q ? "block" : "none";
      if (!isEnabled() || !q || q.trim().length < 2) {
        resultsEl.style.display = "none";
        resultsEl.innerHTML = "";
        return;
      }
      const matches = searchMarketInstruments(q, 8);
      renderResults(matches);
    });

    inputEl.addEventListener("keydown", (e) => {
      const items = resultsEl.querySelectorAll(".omni-result-item");
      if (!items || items.length === 0 || resultsEl.style.display === "none") return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        highlightedIndex = Math.min(items.length - 1, highlightedIndex + 1);
        updateHighlight(items);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        highlightedIndex = Math.max(0, highlightedIndex - 1);
        updateHighlight(items);
      } else if (e.key === "Enter") {
        e.preventDefault();
        const pickIdx = highlightedIndex >= 0 ? highlightedIndex : 0;
        if (pickIdx >= 0 && pickIdx < currentResults.length) {
          const chosen = currentResults[pickIdx];
          resultsEl.style.display = "none";
          if (!keepValue) {
            inputEl.value = "";
            if (clearBtnEl) clearBtnEl.style.display = "none";
          }
          initiateAddHoldingFromSelection(chosen);
        }
      } else if (e.key === "Escape") {
        resultsEl.style.display = "none";
      }
    });

    inputEl.addEventListener("change", () => {
      if (!editingHoldingId && !activeModalInstrument && currentResults.length > 0) {
        const qTrim = inputEl.value.trim().toUpperCase();
        const exactMatch = currentResults.find((r) => r.symbol && r.symbol.toUpperCase() === qTrim);
        if (exactMatch) {
          resultsEl.style.display = "none";
          initiateAddHoldingFromSelection(exactMatch);
        }
      }
    });

    function updateHighlight(items) {
      items.forEach((it, i) => {
        if (i === highlightedIndex) {
          it.classList.add("highlighted");
          it.scrollIntoView({ block: "nearest" });
        } else {
          it.classList.remove("highlighted");
        }
      });
    }

    if (clearBtnEl) {
      clearBtnEl.addEventListener("click", () => {
        inputEl.value = "";
        clearBtnEl.style.display = "none";
        resultsEl.style.display = "none";
        inputEl.focus();
      });
    }

    document.addEventListener("click", (e) => {
      if (!inputEl.contains(e.target) && !resultsEl.contains(e.target)) {
        resultsEl.style.display = "none";
      }
    });
  }

  function handleQuickPick(type) {
    const pulse = window.KYF_MARKET_PULSE || {};
    const metals = pulse.preciousMetals || {};
    const macro = pulse.macro || {};

    if (type === "gold") {
      const rate = metals.gold24kPerGram || 14280;
      initiateAddHoldingFromSelection({
        type: "gold",
        tag: "Gold",
        name: "Physical Gold 24K",
        rawPrice: rate,
        assetClass: "Commodities & Gold",
        subCategory: "24K Bullion / SGB",
        custodian: "Locker / Physical",
        notes: `Market rate: ₹${rate}/g`
      });
    } else if (type === "fd") {
      const rate = macro.sbiFd1Yr || 6.8;
      initiateAddHoldingFromSelection({
        type: "fd",
        tag: "Fixed Deposit",
        name: "Bank Fixed Deposit",
        assetClass: "Fixed Income",
        subCategory: `Bank FD (${rate}% p.a.)`,
        custodian: "SBI / HDFC Bank"
      });
    } else if (type === "epf") {
      const rate = macro.epfRate || 8.25;
      initiateAddHoldingFromSelection({
        type: "epf",
        tag: "EPF / PPF",
        name: "Employees Provident Fund (EPF)",
        assetClass: "Fixed Income",
        subCategory: `EPF (${rate}% Sovereign Rate)`,
        custodian: "EPFO"
      });
    } else if (type === "cash") {
      initiateAddHoldingFromSelection({
        type: "cash",
        tag: "Cash & Bank",
        name: "Savings Bank Account",
        assetClass: "Cash & Liquid",
        subCategory: "Savings Account",
        custodian: "Bank Balance"
      });
    } else if (type === "loan") {
      const rate = macro.homeLoanAvg || 8.65;
      initiateAddHoldingFromSelection({
        type: "loan",
        tag: "Loan",
        name: "Home Loan",
        assetClass: "Liabilities",
        interestRate: rate,
        subCategory: "Home Loan",
        custodian: "Lending Bank"
      });
    }
  }

  function initiateAddHoldingFromSelection(item) {
    editingHoldingId = null;
    openHoldingModal();
    // Set AFTER opening: opening a fresh form resets the active instrument, which used to drop
    // the live-price link (and the Direct/Regular NAVs) for every stock, fund, city and gold pick.
    activeModalInstrument = item;

    if (els.inputHoldingName) {
      els.inputHoldingName.value = item.name || "";
    }
    if (els.selectHoldingAssetClass) {
      els.selectHoldingAssetClass.value = item.assetClass || "Equities";
    }
    if (els.inputHoldingSubCategory) {
      els.inputHoldingSubCategory.value = item.subCategory || "";
    }
    if (els.inputHoldingCustodian) {
      if (item.custodian) {
        els.inputHoldingCustodian.value = item.custodian;
      } else if (item.type === "us_asset" || item.pricingMode === "LIVE_US") {
        els.inputHoldingCustodian.value = "Vested / DriveWealth";
      } else if (item.assetClass === "Equities") {
        els.inputHoldingCustodian.value = "Zerodha / Demat";
      } else if (item.assetClass === "Mutual Funds") {
        els.inputHoldingCustodian.value = "MF Central / AMC";
      } else if (item.assetClass === "Real Estate") {
        els.inputHoldingCustodian.value = "Physical / Registry";
      } else if (item.assetClass === "Commodities & Gold") {
        els.inputHoldingCustodian.value = "Locker / SGB";
      } else {
        els.inputHoldingCustodian.value = "Self-Held";
      }
    }

    // Mutual fund specific setup vs US Asset setup
    if (item.type === "us_asset" || item.pricingMode === "LIVE_US") {
      hideMfVariantBox();
      if (els.inputHoldingPrice) {
        els.inputHoldingPrice.value = item.priceUSD != null ? item.priceUSD : (item.rawPrice || "");
      }
    } else if (item.type === "fund" && item.amfiCode) {
      setupMfVariantBox(item, "DIRECT");
    } else {
      hideMfVariantBox();
      if (item.rawPrice && els.inputHoldingPrice) {
        els.inputHoldingPrice.value = item.rawPrice;
      }
    }

    if (els.inputHoldingCurVal) {
      els.inputHoldingCurVal.value = "";
    }
    if (els.inputHoldingUnits) {
      els.inputHoldingUnits.value = "";
    }
    if (els.inputHoldingInvVal) {
      els.inputHoldingInvVal.value = "";
    }
    if (els.inputHoldingPurchaseFx) els.inputHoldingPurchaseFx.value = "";
    if (els.inputHoldingRate) {
      els.inputHoldingRate.value = item.interestRate != null ? item.interestRate : "";
    }

    const modalTitle = document.getElementById("holding-modal-title");
    if (modalTitle) {
      modalTitle.textContent = `📈 Add ${item.tag || item.assetClass}`;
    }
    applyHoldingTypeMode();
    recalcHoldingValues();
    if (els.btnSaveHolding) {
      els.btnSaveHolding.textContent = "＋ Save Holding";
    }
    if (els.btnDeleteHolding) {
      els.btnDeleteHolding.style.display = "none";
    }

    setTimeout(() => {
      if (els.inputHoldingCurVal) els.inputHoldingCurVal.focus();
    }, 150);
  }

  // Loans and debts are "what you owe": relabel the form and hide fields that only make sense for
  // things you own (units, cost basis, live price); show the interest rate where it matters.
  function applyHoldingTypeMode() {
    const cls = els.selectHoldingAssetClass ? els.selectHoldingAssetClass.value : "";
    const debt = cls === "Liabilities";
    const nameVal = els.inputHoldingName ? els.inputHoldingName.value : "";
    const nameTicker = extractUsTicker(nameVal);
    const existingHolding = editingHoldingId ? rawHoldings.find((h) => h.id === editingHoldingId) : null;
    const isIndian = activeModalInstrument && (activeModalInstrument.type === "stock" || activeModalInstrument.type === "fund" || activeModalInstrument.type === "gold" || activeModalInstrument.type === "property" || activeModalInstrument.type === "fd");
    const isUs = !isIndian && !!(
      (activeModalInstrument && (activeModalInstrument.type === "us_asset" || activeModalInstrument.pricingMode === "LIVE_US")) ||
      (existingHolding && (existingHolding.pricingMode === "LIVE_US" || existingHolding.currency === "USD")) ||
      (!existingHolding && nameTicker && window.KYF_PORTFOLIO_ENGINE?.lookupUsByTicker && window.KYF_PORTFOLIO_ENGINE.lookupUsByTicker(nameTicker) && !window.KYF_PORTFOLIO_ENGINE?.lookupEquity?.(nameTicker))
    );

    const setHidden = (id, hide) => {
      const el = document.getElementById(id);
      if (el) el.hidden = hide;
    };

    setHidden("field-holding-units", debt);
    setHidden("holding-units-hint", debt);
    setHidden("field-holding-invval", debt);
    setHidden("field-holding-price", debt);
    setHidden("field-holding-rate", !(debt || cls === "Fixed Income"));
    setHidden("field-holding-purchasefx", !isUs);

    // With units hidden, the balance gets the full row
    const worthField = document.getElementById("field-holding-curval");
    if (worthField) worthField.classList.toggle("full", debt);
    if (els.btnSaveHolding && !editingHoldingId) els.btnSaveHolding.textContent = debt ? "＋ Save Loan" : "＋ Save Holding";

    const nameLabel = document.getElementById("label-holding-name");
    if (nameLabel) nameLabel.textContent = debt ? "What do you owe? *" : "What do you own? *";

    const worthLabel = document.getElementById("label-holding-curval");
    if (worthLabel) {
      if (debt) {
        worthLabel.innerHTML = 'Outstanding balance (₹) <span class="required">*</span>';
      } else if (isUs) {
        worthLabel.innerHTML = 'Worth today ($) <span class="required">*</span>';
      } else {
        worthLabel.innerHTML = 'Worth today (₹) <span class="required">*</span>';
      }
    }
    if (els.inputHoldingCurVal) {
      els.inputHoldingCurVal.placeholder = debt ? "e.g. 2500000" : (isUs ? "e.g. 5000" : "e.g. 150000");
    }

    const invValLabel = document.getElementById("label-holding-invval");
    if (invValLabel) {
      invValLabel.textContent = isUs ? "Amount invested ($)" : "Amount invested (₹)";
    }
    if (els.inputHoldingInvVal) {
      els.inputHoldingInvVal.placeholder = isUs ? "e.g. 4200 (in USD)" : "Blank = no returns shown";
    }

    const priceLabel = document.getElementById("label-holding-price");
    if (priceLabel) {
      priceLabel.textContent = isUs ? "Price / NAV ($)" : "Price / NAV (₹)";
    }
    if (els.inputHoldingPrice) {
      els.inputHoldingPrice.placeholder = isUs ? "Live price ($)" : "Live price / NAV";
    }

    if (els.inputHoldingName) {
      els.inputHoldingName.placeholder = debt
        ? "e.g. Home loan, Car loan, Credit card dues"
        : "Search a stock, fund, ETF or city — or type any name";
    }

    const title = document.getElementById("holding-modal-title");
    if (title && !editingHoldingId) {
      if (debt) {
        title.textContent = "💳 Add Loan / Debt";
      } else if (activeModalInstrument && activeModalInstrument.tag) {
        title.textContent = `📈 Add ${activeModalInstrument.tag}`;
      } else if (title.textContent.includes("Loan / Debt")) {
        title.textContent = "📈 Add Investment Holding";
      }
    }
  }

  function setupMfVariantBox(item, selectedPlan = "DIRECT") {
    if (!els.holdingMfVariantBox) return;

    els.holdingMfVariantBox.style.display = "block";

    const directNav = item.directNav != null ? Number(item.directNav) : null;
    const regularNav = item.regularNav != null ? Number(item.regularNav) : null;

    if (els.mfNavDirect) {
      els.mfNavDirect.textContent = directNav != null ? `NAV: ₹${directNav.toFixed(2)}` : "NAV: N/A";
    }
    if (els.mfNavRegular) {
      els.mfNavRegular.textContent = regularNav != null ? `NAV: ₹${regularNav.toFixed(2)}` : "NAV: N/A";
    }

    let plan = selectedPlan;
    if (plan === "DIRECT" && directNav == null && regularNav != null) {
      plan = "REGULAR";
    } else if (plan === "REGULAR" && regularNav == null && directNav != null) {
      plan = "DIRECT";
    }

    if (plan === "REGULAR") {
      if (els.radioVariantRegular) els.radioVariantRegular.checked = true;
      if (els.labelVariantRegular) els.labelVariantRegular.classList.add("active");
      if (els.labelVariantDirect) els.labelVariantDirect.classList.remove("active");
      const activePrice = regularNav || directNav || 0;
      if (els.inputHoldingPrice) els.inputHoldingPrice.value = activePrice;
    } else {
      if (els.radioVariantDirect) els.radioVariantDirect.checked = true;
      if (els.labelVariantDirect) els.labelVariantDirect.classList.add("active");
      if (els.labelVariantRegular) els.labelVariantRegular.classList.remove("active");
      const activePrice = directNav || regularNav || 0;
      if (els.inputHoldingPrice) els.inputHoldingPrice.value = activePrice;
    }
  }

  function hideMfVariantBox() {
    if (els.holdingMfVariantBox) {
      els.holdingMfVariantBox.style.display = "none";
    }
  }

  function handleMfVariantChange(e) {
    const plan = e.target.value; // "DIRECT" or "REGULAR"
    if (plan === "REGULAR") {
      if (els.labelVariantRegular) els.labelVariantRegular.classList.add("active");
      if (els.labelVariantDirect) els.labelVariantDirect.classList.remove("active");
    } else {
      if (els.labelVariantDirect) els.labelVariantDirect.classList.add("active");
      if (els.labelVariantRegular) els.labelVariantRegular.classList.remove("active");
    }

    let nav = 0;
    if (activeModalInstrument) {
      nav = plan === "REGULAR"
        ? (activeModalInstrument.regularNav || activeModalInstrument.directNav || 0)
        : (activeModalInstrument.directNav || activeModalInstrument.regularNav || 0);
    }
    if (nav > 0 && els.inputHoldingPrice) {
      els.inputHoldingPrice.value = nav;
    }

    recalcHoldingValues("variant");
  }

  // Which of "units" / "worth today" the person typed last. A price or plan change keeps that
  // one fixed and recomputes the other (e.g. "I hold ₹6.25L" -> switching to Regular gives more units).
  let holdingAnchor = null;

  function recalcHoldingValues(changedSource) {
    if (changedSource === "units" || changedSource === "curval") holdingAnchor = changedSource;

    const nameVal = els.inputHoldingName ? els.inputHoldingName.value : "";
    const nameTicker = extractUsTicker(nameVal);
    const existingHolding = editingHoldingId ? rawHoldings.find((h) => h.id === editingHoldingId) : null;
    const isIndian = activeModalInstrument && (activeModalInstrument.type === "stock" || activeModalInstrument.type === "fund" || activeModalInstrument.type === "gold" || activeModalInstrument.type === "property" || activeModalInstrument.type === "fd");
    const isUs = !isIndian && !!(
      (activeModalInstrument && (activeModalInstrument.type === "us_asset" || activeModalInstrument.pricingMode === "LIVE_US")) ||
      (existingHolding && (existingHolding.pricingMode === "LIVE_US" || existingHolding.currency === "USD")) ||
      (!existingHolding && nameTicker && window.KYF_PORTFOLIO_ENGINE?.lookupUsByTicker && window.KYF_PORTFOLIO_ENGINE.lookupUsByTicker(nameTicker) && !window.KYF_PORTFOLIO_ENGINE?.lookupEquity?.(nameTicker))
    );

    const price = parseFloat(els.inputHoldingPrice ? els.inputHoldingPrice.value : "0") || 0;
    const assetClass = els.selectHoldingAssetClass && els.selectHoldingAssetClass.value;
    const decimals = (assetClass === "Mutual Funds" || isUs) ? 3 : 2;
    const unitsVal = parseFloat(els.inputHoldingUnits ? els.inputHoldingUnits.value : "");
    const worthVal = parseFloat(els.inputHoldingCurVal ? els.inputHoldingCurVal.value : "");

    if (price > 0) {
      const worthFromUnits = () => {
        if (els.inputHoldingCurVal && unitsVal > 0) {
          els.inputHoldingCurVal.value = isUs ? Number((unitsVal * price).toFixed(2)) : Math.round(unitsVal * price);
        }
      };
      const unitsFromWorth = () => {
        if (els.inputHoldingUnits && worthVal > 0) {
          els.inputHoldingUnits.value = parseFloat((worthVal / price).toFixed(decimals));
        }
      };

      if (changedSource === "curval") unitsFromWorth();
      else if (changedSource === "units") worthFromUnits();
      else if (holdingAnchor === "curval") unitsFromWorth();
      else if (holdingAnchor === "units") worthFromUnits();
      else if (unitsVal > 0) worthFromUnits();
      else unitsFromWorth();
    }

    // Live USD to INR conversion hint
    const unitsHintEl = document.getElementById("holding-units-hint");
    if (unitsHintEl) {
      if (isUs) {
        const curWorth = parseFloat(els.inputHoldingCurVal ? els.inputHoldingCurVal.value : "0") || 0;
        const fxRate = window.KYF_PORTFOLIO_ENGINE.getUsdInr().rate;
        if (curWorth > 0) {
          const inrVal = Math.round(curWorth * fxRate);
          unitsHintEl.innerHTML = `💡 <strong>$${curWorth.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong> ≈ <strong>₹${inrVal.toLocaleString("en-IN")}</strong> (@ ₹${fxRate.toFixed(2)}/$)`;
        } else {
          unitsHintEl.textContent = `💡 Enter either units or USD value — converted to INR automatically (@ ₹${fxRate.toFixed(2)}/$).`;
        }
      } else {
        unitsHintEl.textContent = "💡 Enter either units or today's value — the other is filled in from the live price.";
      }
    }
  }

  // ==========================================================================
  // Investment Holding Management Modal Controllers
  // ==========================================================================
  function openHoldingModal(forEdit = false, holdingData = null) {
    if (!els.holdingModal) return;
    if (!forEdit && isDemoMode) {
      // Adding means "my own portfolio": close the demo first, then open a clean form
      leaveDemo().then(() => {
        showToast("Demo closed — adding to your own portfolio", "info");
        openHoldingModal(false, holdingData);
      });
      return;
    }
    populateHoldingModalDropdowns();
    els.holdingModal.style.display = "flex";
    els.holdingModal.setAttribute("aria-hidden", "false");

    const staleResults = document.getElementById("modal-omni-search-results");
    if (staleResults) staleResults.style.display = "none";

    // Progressive disclosure: optional fields stay collapsed when adding, open when editing
    const moreDetails = document.getElementById("holding-more-details");
    if (moreDetails) moreDetails.open = !!forEdit;
    const staleSplitHint = document.getElementById("holding-goal-split-hint");
    if (staleSplitHint) staleSplitHint.hidden = true;

    if (!forEdit) {
      editingHoldingId = null;
      activeModalInstrument = null;
      holdingAnchor = null;
      hideMfVariantBox();

      const modalTitle = document.getElementById("holding-modal-title");
      if (modalTitle) modalTitle.textContent = "📈 Add Investment Holding";
      if (els.btnSaveHolding) els.btnSaveHolding.textContent = "＋ Save Holding";
      if (els.btnDeleteHolding) els.btnDeleteHolding.style.display = "none";

      if (els.inputHoldingName) {
        els.inputHoldingName.value = "";
        els.inputHoldingName.focus();
      }
      if (els.inputHoldingCurVal) els.inputHoldingCurVal.value = "";
      if (els.inputHoldingInvVal) els.inputHoldingInvVal.value = "";
      if (els.inputHoldingUnits) els.inputHoldingUnits.value = "";
      if (els.inputHoldingPrice) els.inputHoldingPrice.value = "";
      if (els.inputHoldingSubCategory) els.inputHoldingSubCategory.value = "";
      if (els.inputHoldingCustodian) els.inputHoldingCustodian.value = "";
      if (els.selectHoldingMember) {
        if (activeMemberScope instanceof Set && activeMemberScope.size === 1) {
          const activeName = Array.from(activeMemberScope)[0];
          if (activeName) els.selectHoldingMember.value = activeName;
        }
      }
      applyHoldingTypeMode();
      recalcHoldingValues();
    }
  }

  function closeHoldingModal() {
    if (!els.holdingModal) return;
    els.holdingModal.style.display = "none";
    els.holdingModal.setAttribute("aria-hidden", "true");
    editingHoldingId = null;
    activeModalInstrument = null;
  }

  function openHoldingModalForEdit(holdingId) {
    if (blockDemoChange()) return;
    const holding = rawHoldings.find((h) => h.id === holdingId || h.originalHoldingId === holdingId);
    if (!holding) {
      showToast("Holding not found", "error");
      return;
    }

    editingHoldingId = holding.id;
    activeModalInstrument = null;
    openHoldingModal(true, holding);

    // Set modal title & submit button
    const modalTitle = document.getElementById("holding-modal-title");
    if (modalTitle) modalTitle.textContent = "✏️ Edit Holding";
    if (els.btnSaveHolding) els.btnSaveHolding.textContent = "Save Changes";
    if (els.btnDeleteHolding) els.btnDeleteHolding.style.display = "block";

    // Pre-fill form
    if (els.inputHoldingName) els.inputHoldingName.value = holding.name || "";
    const holdingIsDebt = window.KYF_PORTFOLIO_ENGINE.isLiabilityHolding(holding);
    if (els.selectHoldingAssetClass) els.selectHoldingAssetClass.value = holdingIsDebt ? "Liabilities" : window.KYF_PORTFOLIO_ENGINE.normalizeAssetClass(holding.assetClass || "Equities");
    if (els.inputHoldingSubCategory) els.inputHoldingSubCategory.value = holding.subCategory || "";
    if (els.selectHoldingMember) els.selectHoldingMember.value = holding.member || "Self";
    if (els.inputHoldingCustodian) els.inputHoldingCustodian.value = holding.custodian || "";

    const meta = holding.instrumentMeta || {};
    const unitsVal = holding.units != null ? holding.units : (meta.units || meta.quantity || meta.grams || meta.carpetSqft || "");
    if (els.inputHoldingUnits) els.inputHoldingUnits.value = unitsVal;

    let unitPrice = 0;
    const candidateTicker = (meta.ticker || meta.symbol || extractUsTicker(holding.name || "") || "").toUpperCase();
    const isUsHolding = holding.pricingMode === "LIVE_US" || holding.currency === "USD" || (holding.currentValueUSD != null && holding.currentValueUSD > 0);
    const usItem = isUsHolding && candidateTicker && window.KYF_PORTFOLIO_ENGINE?.lookupUsByTicker ? window.KYF_PORTFOLIO_ENGINE.lookupUsByTicker(candidateTicker) : null;

    if (isUsHolding) {
      hideMfVariantBox();
      const fxRate = window.KYF_PORTFOLIO_ENGINE.getUsdInr().rate;
      const priceUSD = usItem ? usItem.closePrice : (holding.priceUSD || meta.priceUSD || 0);
      activeModalInstrument = {
        type: "us_asset",
        symbol: candidateTicker,
        tag: usItem?.type === "MUTUAL_FUND" ? "US Fund" : (usItem?.type === "ETF" ? "US ETF" : "US Stock"),
        priceUSD: priceUSD,
        rawPrice: Math.round(priceUSD * fxRate),
        pricingMode: "LIVE_US",
        fxRate: fxRate
      };
      unitPrice = priceUSD;
    } else if (holding.pricingMode === "LIVE_MF" || holding.assetClass === "Mutual Funds") {
      const code = meta.amfiCode;
      let scheme = null;
      if (code && window.KYF_MARKET_MF && Array.isArray(window.KYF_MARKET_MF.schemes)) {
        scheme = window.KYF_MARKET_MF.schemes.find((s) => s[0] === Number(code));
      }
      if (!scheme && window.KYF_MARKET_MF && Array.isArray(window.KYF_MARKET_MF.schemes)) {
        const holdingNameLower = (holding.name || "").toLowerCase();
        scheme = window.KYF_MARKET_MF.schemes.find((s) => holdingNameLower.includes(String(s[1]).toLowerCase()) || String(s[1]).toLowerCase().includes(holdingNameLower));
      }

      if (scheme) {
        activeModalInstrument = {
          type: "fund",
          amfiCode: scheme[0],
          name: scheme[1],
          category: scheme[2],
          directNav: scheme[3],
          regularNav: scheme[4]
        };
        const plan = (meta.planType || "DIRECT").toUpperCase();
        setupMfVariantBox(activeModalInstrument, plan);
        unitPrice = plan === "REGULAR" ? (scheme[4] || scheme[3]) : (scheme[3] || scheme[4]);
      } else {
        hideMfVariantBox();
      }
    } else {
      hideMfVariantBox();
      if (holding.pricingMode === "LIVE_EQUITY" || holding.assetClass === "Equities") {
        const sym = (meta.symbol || "").toUpperCase();
        if (sym && window.KYF_MARKET_EQUITIES && Array.isArray(window.KYF_MARKET_EQUITIES.stocks)) {
          const stock = window.KYF_MARKET_EQUITIES.stocks.find((s) => s[0] === sym);
          if (stock) {
            activeModalInstrument = { type: "stock", symbol: sym, rawPrice: stock[2] };
            unitPrice = stock[2];
          }
        }
      }
    }

    if (unitPrice > 0 && els.inputHoldingPrice) {
      els.inputHoldingPrice.value = unitPrice;
    } else if (meta.price && els.inputHoldingPrice) {
      els.inputHoldingPrice.value = meta.price;
    }

    if (isUsHolding) {
      const fxRate = window.KYF_PORTFOLIO_ENGINE.getUsdInr().rate;
      const curValUSD = holding.currentValueUSD != null
        ? holding.currentValueUSD
        : (holding.currentValue ? Number((holding.currentValue / fxRate).toFixed(2)) : "");
      const invValUSD = holding.investedValueUSD != null
        ? holding.investedValueUSD
        : (holding.investedValue ? Number((holding.investedValue / fxRate).toFixed(2)) : "");
      if (els.inputHoldingCurVal) els.inputHoldingCurVal.value = curValUSD;
      if (els.inputHoldingInvVal) els.inputHoldingInvVal.value = invValUSD;
      if (els.inputHoldingPurchaseFx) els.inputHoldingPurchaseFx.value = meta.purchaseFxRate > 0 ? meta.purchaseFxRate : "";
    } else {
      if (els.inputHoldingCurVal) els.inputHoldingCurVal.value = holding.currentValue != null ? holding.currentValue : "";
      if (els.inputHoldingInvVal) els.inputHoldingInvVal.value = holding.investedValue != null ? holding.investedValue : "";
    }

    if (els.inputHoldingRate) els.inputHoldingRate.value = meta.interestRate != null ? meta.interestRate : "";

    const goalId = (holding.allocations && holding.allocations.length > 0 && holding.allocations[0].goalId) || "";
    if (els.selectHoldingGoal) els.selectHoldingGoal.value = goalId;
    const splitHint = document.getElementById("holding-goal-split-hint");
    if (splitHint) {
      const n = holding.allocations ? holding.allocations.length : 0;
      splitHint.hidden = n < 2;
      splitHint.textContent = n > 1 ? `Split across ${n} goals. Leave this as is to keep the split; pick another goal to replace it.` : "";
    }
    applyHoldingTypeMode();
    recalcHoldingValues();

    // Physical units are the fact for an existing holding: a price/plan change moves the value
    holdingAnchor = unitsVal !== "" && unitsVal != null ? "units" : "curval";
  }

  async function handleDeleteHolding(holdingId) {
    const holding = rawHoldings.find((h) => h.id === holdingId || h.originalHoldingId === holdingId);
    const hName = holding ? holding.name : "this holding";

    if (blockDemoChange()) return;

    // Snapshot so the delete can be undone from the toast (no blocking confirm dialog)
    const snapshot = [...rawHoldings];

    const persistHoldings = async () => {
      userHoldings = [...rawHoldings];
      localStorage.setItem("kyf_user_holdings", JSON.stringify(userHoldings));
      await window.KYF_PORTFOLIO_DATA.saveHoldingsToDB(rawHoldings);
    };

    rawHoldings = rawHoldings.filter((h) => h.id !== holdingId && h.originalHoldingId !== holdingId);
    if (rawHoldings.length === 0) {
      activeMemberScope = "ALL";
      selectedPills = "ALL";
      searchQuery = "";
      if (els.searchInput) els.searchInput.value = "";
    }
    userHoldings = [...rawHoldings];
    localStorage.setItem("kyf_user_holdings", JSON.stringify(userHoldings));
    closeHoldingModal();
    renderApp();
    markDataChanged();

    try {
      await window.KYF_PORTFOLIO_DATA.saveHoldingsToDB(rawHoldings);
    } catch (err) {
      console.warn("[KYF Portfolio] Error persisting to DB:", err);
    }

    showToast(`Deleted "${hName}"`, "info", {
      label: "Undo",
      onAction: async () => {
        rawHoldings = snapshot;
        userHoldings = [...rawHoldings];
        localStorage.setItem("kyf_user_holdings", JSON.stringify(userHoldings));
        closeHoldingModal();
        renderApp();
        markDataChanged();
        try {
          await window.KYF_PORTFOLIO_DATA.saveHoldingsToDB(rawHoldings);
        } catch (err) {
          console.warn("[KYF Portfolio] Error persisting to DB:", err);
        }
        showToast(`✓ Restored "${hName}"`, "success");
      }
    });
  }

  function populateHoldingModalDropdowns() {
    if (els.selectHoldingMember) {
      const knownNames = new Set();
      const membersList = [];

      const baseList = (rawMembers && rawMembers.length > 0)
        ? rawMembers
        : (isDemoMode ? window.KYF_PORTFOLIO_DATA.getDemoMembers() : [{ id: "mem_self", name: "Self", role: "Self", avatar: "👤" }]);

      for (const m of baseList) {
        if (m.name && !knownNames.has(m.name)) {
          knownNames.add(m.name);
          membersList.push(m);
        }
      }

      for (const h of rawHoldings || []) {
        if (h.member && !knownNames.has(h.member) && h.member !== "Unassigned" && !h.member.includes("&")) {
          knownNames.add(h.member);
          membersList.push({ id: `mem_${h.member.toLowerCase()}`, name: h.member, role: "Family", avatar: "👤" });
        }
      }

      els.selectHoldingMember.innerHTML = membersList.map((m) => {
        return `<option value="${escapeHTML(m.name)}">${escapeHTML(m.name)}${m.role && m.role.toLowerCase() !== String(m.name).toLowerCase() ? ` (${escapeHTML(m.role)})` : ""}</option>`;
      }).join("");
    }

    if (els.selectHoldingGoal) {
      const goalsList = (rawGoals && rawGoals.length > 0)
        ? rawGoals
        : (isDemoMode ? window.KYF_PORTFOLIO_DATA.getDemoGoals() : []);

      let goalOptions = `<option value="">None / General Wealth</option>`;
      goalsList.filter((g) => g.kind !== "COVER").forEach((g) => {
        goalOptions += `<option value="${escapeHTML(g.id)}">${g.icon || "🎯"} ${escapeHTML(g.name)} (${g.targetYear || "Goal"})</option>`;
      });
      els.selectHoldingGoal.innerHTML = goalOptions;
    }
  }

  async function handleAddHoldingSubmit(e) {
    e.preventDefault();
    if (!els.inputHoldingName || !els.inputHoldingCurVal) return;

    const name = els.inputHoldingName.value.trim();
    const assetClass = (els.selectHoldingAssetClass && els.selectHoldingAssetClass.value) || "Equities";
    const subCategory = (els.inputHoldingSubCategory && els.inputHoldingSubCategory.value.trim()) || assetClass;
    const member = (els.selectHoldingMember && els.selectHoldingMember.value) || "Self";
    const custodian = (els.inputHoldingCustodian && els.inputHoldingCustodian.value.trim()) || "Direct / Self-Held";
    const currentVal = parseFloat(els.inputHoldingCurVal.value);
    const investedValInput = els.inputHoldingInvVal ? els.inputHoldingInvVal.value.trim() : "";
    const investedVal = investedValInput !== "" && !isNaN(parseFloat(investedValInput)) ? parseFloat(investedValInput) : null;
    const goalId = els.selectHoldingGoal && els.selectHoldingGoal.value;
    const unitsInput = els.inputHoldingUnits ? els.inputHoldingUnits.value.trim() : "";
    const priceInput = els.inputHoldingPrice ? els.inputHoldingPrice.value.trim() : "";
    const price = priceInput !== "" && !isNaN(parseFloat(priceInput)) ? parseFloat(priceInput) : null;
    let units = unitsInput !== "" && !isNaN(parseFloat(unitsInput)) ? parseFloat(unitsInput) : null;
    // Worth entered but no quantity: infer it from the price so live valuation has something to multiply
    if (units == null && price > 0 && currentVal > 0) units = parseFloat((currentVal / price).toFixed(3));

    if (!name) {
      alert("Please enter a holding name.");
      return;
    }
    if (isNaN(currentVal) || currentVal < 0) {
      alert("Please enter a valid current live value (₹).");
      return;
    }

    // Safety net: the form is only opened outside demo mode, but never write into demo data
    if (blockDemoChange()) return;

    // Determine pricing mode and instrumentMeta
    let pricingMode = "MANUAL";
    let instrumentMeta = {};

    if (editingHoldingId) {
      const existing = rawHoldings.find((h) => h.id === editingHoldingId);
      if (existing) {
        pricingMode = existing.pricingMode || "MANUAL";
        instrumentMeta = { ...(existing.instrumentMeta || {}) };
      }
    }

    const candidateTicker = (activeModalInstrument && (activeModalInstrument.symbol || activeModalInstrument.ticker)) ||
      instrumentMeta.ticker || instrumentMeta.symbol || extractUsTicker(name);
    const usLookup = candidateTicker && window.KYF_PORTFOLIO_ENGINE?.lookupUsByTicker
      ? window.KYF_PORTFOLIO_ENGINE.lookupUsByTicker(candidateTicker)
      : null;
    const isIndianInstrument = activeModalInstrument && (activeModalInstrument.type === "stock" || activeModalInstrument.type === "fund" || activeModalInstrument.type === "gold" || activeModalInstrument.type === "property" || activeModalInstrument.type === "fd");
    const existingH = editingHoldingId ? rawHoldings.find((h) => h.id === editingHoldingId) : null;
    const isUsInstrument = !isIndianInstrument && !!(
      (activeModalInstrument && (activeModalInstrument.type === "us_asset" || activeModalInstrument.pricingMode === "LIVE_US")) ||
      (existingH && (existingH.pricingMode === "LIVE_US" || existingH.currency === "USD")) ||
      (!existingH && usLookup && !window.KYF_PORTFOLIO_ENGINE?.lookupEquity?.(candidateTicker))
    );

    if (isUsInstrument) {
      pricingMode = "LIVE_US";
      const finalTicker = (candidateTicker || (activeModalInstrument && activeModalInstrument.symbol) || "").toUpperCase();
      instrumentMeta.ticker = finalTicker;
      const fxRate = (activeModalInstrument && activeModalInstrument.fxRate) ||
                     window.KYF_PORTFOLIO_ENGINE.getUsdInr().rate;
      const priceUSD = (activeModalInstrument && activeModalInstrument.priceUSD) ||
                       (usLookup ? usLookup.closePrice : 0) ||
                       (price > 0 ? price : 0);
      if (priceUSD > 0) instrumentMeta.priceUSD = priceUSD;
      instrumentMeta.fxRate = fxRate;
      if (units > 0) {
        instrumentMeta.quantity = units;
      } else if (currentVal > 0 && priceUSD > 0) {
        units = parseFloat((currentVal / priceUSD).toFixed(3));
        instrumentMeta.quantity = units;
      }
    } else if (activeModalInstrument) {
      if (activeModalInstrument.type === "fund" || assetClass === "Mutual Funds") {
        const isRegular = els.radioVariantRegular && els.radioVariantRegular.checked;
        instrumentMeta.amfiCode = activeModalInstrument.amfiCode || instrumentMeta.amfiCode;
        instrumentMeta.planType = isRegular ? "REGULAR" : "DIRECT";
        // Live NAV pricing needs a real scheme code; a hand-typed fund stays manually valued
        pricingMode = Number(instrumentMeta.amfiCode) > 0 ? "LIVE_MF" : "MANUAL";
      } else if (activeModalInstrument.type === "stock" || assetClass === "Equities") {
        pricingMode = "LIVE_EQUITY";
        instrumentMeta.symbol = activeModalInstrument.symbol || instrumentMeta.symbol;
      } else if (activeModalInstrument.type === "city" || assetClass === "Real Estate") {
        pricingMode = "LIVE_RESIDEX";
        instrumentMeta.city = activeModalInstrument.symbol || instrumentMeta.city;
      } else if (activeModalInstrument.type === "gold" || assetClass === "Commodities & Gold") {
        pricingMode = "LIVE_GOLD";
        instrumentMeta.purity = "24K";
      }
    } else if (assetClass === "Mutual Funds") {
      const isRegular = els.radioVariantRegular && els.radioVariantRegular.checked;
      instrumentMeta.planType = isRegular ? "REGULAR" : "DIRECT";
      pricingMode = Number(instrumentMeta.amfiCode) > 0 ? "LIVE_MF" : "MANUAL";
    } else if (assetClass === "Commodities & Gold") {
      // Gold chosen by type (no search pick): live-priced by weight when grams are given (guard below)
      pricingMode = "LIVE_GOLD";
      instrumentMeta.purity = instrumentMeta.purity || "24K";
    }

    // A liability is just an amount owed: never live-priced, no units, no cost basis
    const isLiability = assetClass === "Liabilities";
    if (isLiability) {
      pricingMode = "MANUAL";
      instrumentMeta = {};
      units = null;
    }
    const rateInput = els.inputHoldingRate ? els.inputHoldingRate.value.trim() : "";
    const interestRate = rateInput !== "" && !isNaN(parseFloat(rateInput)) ? parseFloat(rateInput) : null;
    if (isLiability || assetClass === "Fixed Income") {
      if (interestRate != null) instrumentMeta.interestRate = interestRate;
      else delete instrumentMeta.interestRate;
    }

    // Gold and property are valued as quantity x live rate; without a quantity keep the typed value
    if ((pricingMode === "LIVE_GOLD" || pricingMode === "LIVE_RESIDEX") && !(units > 0)) {
      pricingMode = "MANUAL";
    }

    if (units != null) {
      if (pricingMode === "LIVE_MF") instrumentMeta.units = units;
      else if (pricingMode === "LIVE_EQUITY" || pricingMode === "LIVE_US") instrumentMeta.quantity = units;
      else if (pricingMode === "LIVE_GOLD") instrumentMeta.grams = units;
      else if (pricingMode === "LIVE_RESIDEX") instrumentMeta.carpetSqft = units;
    }
    if (price != null && !isLiability) {
      instrumentMeta.price = price;
    }

    const isUs = (pricingMode === "LIVE_US");
    const fxRate = (activeModalInstrument && activeModalInstrument.fxRate) || window.KYF_PORTFOLIO_ENGINE.getUsdInr().rate;

    let baseCurrentValINR = currentVal;
    let baseInvestedValINR = investedVal;
    let currentValueUSD = null;
    let investedValueUSD = null;

    if (isUs) {
      currentValueUSD = currentVal;
      baseCurrentValINR = Math.round(currentVal * fxRate);
      const boughtFx = els.inputHoldingPurchaseFx ? parseFloat(els.inputHoldingPurchaseFx.value) : NaN;
      if (boughtFx > 0) instrumentMeta.purchaseFxRate = boughtFx; else delete instrumentMeta.purchaseFxRate;
      if (investedVal != null) {
        investedValueUSD = investedVal;
        baseInvestedValINR = Math.round(investedVal * (boughtFx > 0 ? boughtFx : fxRate));
      }
      instrumentMeta.priceUSD = price;
      instrumentMeta.fxRate = fxRate;
    }

    if (editingHoldingId) {
      const idx = rawHoldings.findIndex((h) => h.id === editingHoldingId);
      const priorAllocations = idx >= 0 && Array.isArray(rawHoldings[idx].allocations) ? rawHoldings[idx].allocations : [];
      const keepGoalSplit = priorAllocations.length > 1 && (goalId || "") === (priorAllocations[0].goalId || "");
      if (idx >= 0) {
        rawHoldings[idx] = {
          ...rawHoldings[idx],
          name,
          member,
          custodian,
          assetClass,
          subCategory,
          pricingMode,
          currency: isUs ? "USD" : (rawHoldings[idx].currency || "INR"),
          units: isLiability ? null : (units != null ? units : rawHoldings[idx].units),
          investedValue: isLiability ? null : baseInvestedValINR,
          investedValueUSD: isLiability ? null : investedValueUSD,
          isLiability,
          currentValue: baseCurrentValINR,
          currentValueUSD: currentValueUSD,
          manualCurrentValue: baseCurrentValINR,
          // A holding split across several goals keeps its split unless the goal was changed here
          allocations: keepGoalSplit ? rawHoldings[idx].allocations : (goalId ? [{ goalId, percentage: 100 }] : []),
          instrumentMeta
        };
      }
      if (isUs) {
        showToast(`✓ Updated ${name} ($${currentVal.toLocaleString("en-US", { minimumFractionDigits: 2 })} ≈ ${formatINR(baseCurrentValINR)})`, "success");
      } else {
        showToast(`✓ Updated ${name}`, "success");
      }
    } else {
      const newHolding = {
        id: `hold_usr_${Date.now()}`,
        name,
        member,
        custodian,
        assetClass,
        subCategory,
        pricingMode,
        currency: isUs ? "USD" : "INR",
        units: units,
        investedValue: isLiability ? null : baseInvestedValINR,
        investedValueUSD: isLiability ? null : investedValueUSD,
        isLiability,
        currentValue: baseCurrentValINR,
        currentValueUSD: currentValueUSD,
        manualCurrentValue: baseCurrentValINR,
        allocations: goalId ? [{ goalId, percentage: 100 }] : [],
        instrumentMeta,
        notes: ""
      };
      rawHoldings.push(newHolding);
      if (isUs) {
        showToast(`✓ Added ${name} ($${currentVal.toLocaleString("en-US", { minimumFractionDigits: 2 })} ≈ ${formatINR(baseCurrentValINR)})`, "success");
      } else {
        showToast(`✓ Added ${name} (${formatINR(currentVal)})`, "success");
      }
    }

    // Set active family member scope to the target member
    activeMemberScope = new Set([member]);
    selectedPills = "ALL";
    searchQuery = "";
    if (els.searchInput) els.searchInput.value = "";
    if (els.searchClearBtn) els.searchClearBtn.style.display = "none";

    // If all user holdings are USD and user hasn't explicitly set INR, default currency to USD
    const allAreUs = rawHoldings.length > 0 && rawHoldings.every((h) => h.currency === "USD" || h.pricingMode === "LIVE_US");
    if (allAreUs && !localStorage.getItem("kyf_portfolio_currency")) {
      activeCurrency = "USD";
    }

    // Immediate UI update
    userHoldings = [...rawHoldings];
    localStorage.setItem("kyf_user_holdings", JSON.stringify(userHoldings));
    closeHoldingModal();
    renderApp();
    markDataChanged();

    // Async persist to IndexedDB in safe background block
    try {
      await window.KYF_PORTFOLIO_DATA.saveHoldingsToDB(rawHoldings);
    } catch (err) {
      console.warn("[KYF Portfolio] Error saving holdings to IndexedDB:", err);
    }
  }

  // ==========================================================================
  // Broker Portfolio Import Modal Controllers
  // ==========================================================================
  let pendingImportHoldings = [];
  let pendingImportBrokers = [];
  let currentLoadedFile = null;

  function formatBytes(bytes) {
    if (!bytes || bytes <= 0) return "0 B";
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / 1048576).toFixed(1) + " MB";
  }

  function renderImportPreview(selectedMember) {
    if (!pendingImportHoldings || pendingImportHoldings.length === 0) {
      if (els.importPreviewWrap) els.importPreviewWrap.style.display = "none";
      if (els.btnConfirmImport) els.btnConfirmImport.disabled = true;
      return;
    }

    const count = pendingImportHoldings.length;

    if (els.importPreviewTitle) {
      els.importPreviewTitle.textContent = `Holdings to Import for ${escapeHTML(selectedMember)}`;
    }
    if (els.importPreviewCount) {
      els.importPreviewCount.textContent = `${count} ${count === 1 ? "item" : "items"}`;
    }

    if (els.importPreviewTbody) {
      els.importPreviewTbody.innerHTML = pendingImportHoldings.map((h) => {
        const qtyStr = typeof h.units === "number" ? h.units.toLocaleString("en-IN", { maximumFractionDigits: 3 }) : (h.units || "—");
        const isUs = h.currency === "USD" || h.pricingMode === "LIVE_US";
        const invStr = isUs && h.investedValueUSD != null
          ? `$${h.investedValueUSD.toLocaleString("en-US", { minimumFractionDigits: 2 })} ≈ ₹${Math.round(h.investedValue || 0).toLocaleString("en-IN")}`
          : (h.investedValue != null ? `₹${Math.round(h.investedValue).toLocaleString("en-IN")}` : "—");
        const curStr = isUs && h.currentValueUSD != null
          ? `$${h.currentValueUSD.toLocaleString("en-US", { minimumFractionDigits: 2 })} ≈ ₹${Math.round(h.currentValue || 0).toLocaleString("en-IN")}`
          : (h.currentValue != null ? `₹${Math.round(h.currentValue).toLocaleString("en-IN")}` : "—");
        return `
          <tr>
            <td><strong>${escapeHTML(h.name)}</strong></td>
            <td><span class="subcat-chip">${escapeHTML(h.assetClass)}</span></td>
            <td>${escapeHTML(h.custodian || "Broker")}</td>
            <td class="mono-num">${qtyStr}</td>
            <td class="mono-num">${invStr}</td>
            <td class="mono-num"><strong>${curStr}</strong></td>
          </tr>
        `;
      }).join("");
    }

    if (els.importPreviewWrap) els.importPreviewWrap.style.display = "block";

    // What this import does to the bucket (this person + this source)
    const sourceId = els.importSourceSelect ? els.importSourceSelect.value : "";
    let impactHTML = "";
    if (sourceId) {
      const pv = window.KYF_BROKER_IMPORTER.previewBucket(rawHoldings, pendingImportHoldings, selectedMember, sourceId);
      const acct = `${escapeHTML(selectedMember)}'s ${escapeHTML(sourceLabel(sourceId))} account`;
      const kindWord = pv.replacedKind === "mf" ? "mutual funds" : "stocks & ETFs";
      const otherWord = pv.replacedKind === "mf" ? "stocks & ETFs" : "mutual funds";
      if (pv.firstImport) {
        impactHTML = `<span>First import for ${acct}: <strong>${pv.addedCount} holdings</strong> will be added.</span>`;
      } else {
        impactHTML = `<span>${acct} has ${pv.bucketSize} ${pv.replacedKind ? kindWord : "holdings"} saved. This file replaces them: ${pv.addedCount} new · ${pv.updatedCount} updated · <strong>${pv.removedCount} no longer held</strong>.</span>`;
      }
      if (pv.replacedKind && pv.keptOtherCount) {
        impactHTML += `<span>Its ${pv.keptOtherCount} ${otherWord} (from another file) are kept.</span>`;
      }
      impactHTML += `<span>Other brokers and family members are not changed.</span>`;
      if (pv.removedWithGoals.length) {
        impactHTML += `<span class="import-warn">${pv.removedWithGoals.length} of the removed ${pv.removedWithGoals.length === 1 ? "holding was" : "holdings were"} set aside for goals: ${escapeHTML(pv.removedWithGoals.map(h => h.name).slice(0, 3).join(", "))}${pv.removedWithGoals.length > 3 ? "…" : ""}</span>`;
      }
      if (pv.muchSmaller) {
        impactHTML += `<span class="import-warn">This file has far fewer holdings than the ${pv.bucketSize} saved for this account. Check it is the full statement.</span>`;
      }
    }
    if (els.importStatsSummary) {
      const totalINR = pendingImportHoldings.reduce((sum, h) => sum + (Number(h.currentValue) || 0), 0);
      const totalUSD = pendingImportHoldings.reduce((sum, h) => sum + (Number(h.currentValueUSD) || 0), 0);
      const hasUs = pendingImportHoldings.some(h => h.currency === "USD");
      const totalStr = hasUs && totalUSD > 0
        ? `$${totalUSD.toLocaleString("en-US", { minimumFractionDigits: 2 })} ≈ ₹${Math.round(totalINR).toLocaleString("en-IN")}`
        : `₹${Math.round(totalINR).toLocaleString("en-IN")}`;
      els.importStatsSummary.style.display = "flex";
      els.importStatsSummary.innerHTML = `<span>Live value: <strong>${totalStr}</strong></span>` + (sourceId ? impactHTML : `<span class="import-warn">Choose where this file is from, so it replaces the right list.</span>`);
    }
    if (els.btnConfirmImport) {
      els.btnConfirmImport.disabled = !sourceId;
      els.btnConfirmImport.textContent = sourceId
        ? (window.KYF_BROKER_IMPORTER.previewBucket(rawHoldings, pendingImportHoldings, selectedMember, sourceId).firstImport
            ? `Add ${selectedMember}'s ${sourceLabel(sourceId)} holdings (${count})`
            : `Update ${selectedMember}'s ${sourceLabel(sourceId)} holdings (${count})`)
        : "Choose the broker above to continue";
    }
  }

  function sourceLabel(id) {
    const src = window.KYF_BROKER_IMPORTER.getSource(id);
    return src ? src.label : "broker";
  }

  function showImportError(title, detail) {
    if (!els.importErrorBanner) return;
    if (els.importErrorTitle) els.importErrorTitle.textContent = title || "Unable to process file";
    if (els.importErrorDetail) els.importErrorDetail.textContent = detail || "";
    els.importErrorBanner.style.display = "flex";
  }

  function hideImportError() {
    if (els.importErrorBanner) {
      els.importErrorBanner.style.display = "none";
    }
  }

  function resetImportDropzone() {
    hideImportError();
    if (!els.importDropzone) return;
    els.importDropzone.classList.remove("has-file", "is-reading", "dragover");
    if (els.importDropzoneContent) {
      els.importDropzoneContent.innerHTML = `
        <div class="import-dropzone-icon">📄</div>
        <div class="import-dropzone-text">
          <strong>Click to select a file</strong> or drag &amp; drop here
        </div>
        <div class="import-dropzone-hint">CSV, TSV, or Excel (.xlsx / .xls)</div>
      `;
    }
  }

  function openImportModal() {
    if (!els.importModal) return;
    if (isDemoMode) {
      leaveDemo().then(() => {
        showToast("Demo closed — importing to your own portfolio", "info");
        openImportModal();
      });
      return;
    }

    pendingImportHoldings = [];
    pendingImportBrokers = [];
    currentLoadedFile = null;

    // Explicit Member decision: populate with registered members (NO "Auto-detect")
    if (els.importMemberSelect) {
      els.importMemberSelect.innerHTML = "";
      const members = (rawMembers && rawMembers.length > 0) ? rawMembers : [{ id: "mem_self", name: "Self" }];

      // Determine default member: if single member currently active in scope, use that; else default to Self or first member
      let defaultSelectedName = members[0].name;
      if (activeMemberScope instanceof Set && activeMemberScope.size === 1) {
        const activeName = Array.from(activeMemberScope)[0];
        if (members.some(m => m.name.toLowerCase() === activeName.toLowerCase())) {
          defaultSelectedName = activeName;
        }
      } else {
        const selfMember = members.find(m => m.name.toLowerCase() === "self");
        if (selfMember) defaultSelectedName = selfMember.name;
      }

      for (const m of members) {
        const opt = document.createElement("option");
        opt.value = m.name;
        opt.textContent = `${m.name}${m.role && m.role.toLowerCase() !== m.name.toLowerCase() ? ` (${m.role})` : ""}`;
        if (m.name.toLowerCase() === defaultSelectedName.toLowerCase()) {
          opt.selected = true;
        }
        els.importMemberSelect.appendChild(opt);
      }
    }

    loadCustomSources();
    fillSourceOptions("");
    if (els.importCustomBox) els.importCustomBox.hidden = true;

    // Reset dropzone & preview
    if (els.brokerFileInput) els.brokerFileInput.value = "";
    resetImportDropzone();
    if (els.importStatsSummary) {
      els.importStatsSummary.style.display = "none";
      els.importStatsSummary.innerHTML = "";
    }
    if (els.importPreviewWrap) els.importPreviewWrap.style.display = "none";
    if (els.importPreviewTbody) els.importPreviewTbody.innerHTML = "";
    if (els.btnConfirmImport) {
      const currentMember = els.importMemberSelect ? els.importMemberSelect.value : "Self";
      els.btnConfirmImport.disabled = true;
      els.btnConfirmImport.textContent = `＋ Import Holdings for ${currentMember}`;
    }

    els.importModal.style.display = "flex";
    els.importModal.setAttribute("aria-hidden", "false");
  }

  function closeImportModal() {
    if (!els.importModal) return;
    hideImportError();
    els.importModal.style.display = "none";
    els.importModal.setAttribute("aria-hidden", "true");
    pendingImportHoldings = [];
    pendingImportBrokers = [];
    currentLoadedFile = null;
  }

  // ==========================================================================
  // Market Data Health & As-Of Status Modal
  // ==========================================================================
  function openDataStatusModal() {
    if (!els.dataStatusModal) return;
    renderDataStatusModal();
    els.dataStatusModal.style.display = "flex";
    els.dataStatusModal.setAttribute("aria-hidden", "false");
  }

  function closeDataStatusModal() {
    if (!els.dataStatusModal) return;
    els.dataStatusModal.style.display = "none";
    els.dataStatusModal.setAttribute("aria-hidden", "true");
  }

  function renderDataStatusModal() {
    const statusData = window.KYF_MARKET_STATUS || null;

    const fallbackFeeds = {
      equities: {
        name: "NSE Indian Equities",
        tag: "Equities",
        status: (window.KYF_MARKET_EQUITIES && window.KYF_MARKET_EQUITIES.asOf) ? "HEALTHY" : "UNKNOWN",
        asOf: (window.KYF_MARKET_EQUITIES && window.KYF_MARKET_EQUITIES.asOf) || "Unknown",
        count: (window.KYF_MARKET_EQUITIES && window.KYF_MARKET_EQUITIES.stocks) ? Object.keys(window.KYF_MARKET_EQUITIES.stocks).length : 0,
        details: "NSE Equity Bhavcopy (CM)",
        source: "NSE India EOD Bhavcopy"
      },
      mutualFunds: {
        name: "AMFI Mutual Funds",
        tag: "Mutual Funds",
        status: (window.KYF_MARKET_MF && window.KYF_MARKET_MF.asOf) ? "HEALTHY" : "UNKNOWN",
        asOf: (window.KYF_MARKET_MF && window.KYF_MARKET_MF.asOf) || "Unknown",
        count: (window.KYF_MARKET_MF && window.KYF_MARKET_MF.funds) ? Object.keys(window.KYF_MARKET_MF.funds).length : 0,
        details: "Direct & Regular Mutual Fund NAVs",
        source: "AMFI India"
      },
      usMarket: {
        name: "US Stocks, ETFs & Funds",
        tag: "US Equities",
        status: (window.KYF_MARKET_US && window.KYF_MARKET_US.asOf) ? "HEALTHY" : "UNKNOWN",
        asOf: (window.KYF_MARKET_US && window.KYF_MARKET_US.asOf) || "Unknown",
        count: (window.KYF_MARKET_US && window.KYF_MARKET_US.instruments) ? Object.keys(window.KYF_MARKET_US.instruments).length : 0,
        details: `USD/INR Rate: ₹${window.KYF_PORTFOLIO_ENGINE.getUsdInr().rate}` + (window.KYF_PORTFOLIO_ENGINE.getUsdInr().source === "fallback" ? " (assumed: live rate missing)" : ""),
        source: "GitHub us_bhavcopy & Yahoo Finance"
      },
      bullion: {
        name: "Gold & Silver Bullion",
        tag: "Commodities",
        status: "HEALTHY",
        asOf: (window.KYF_MARKET_PULSE && window.KYF_MARKET_PULSE.asOf) || "Recent",
        details: "Gold 24K & Silver Mark-to-Market",
        source: "NSE GOLDBEES & SILVERBEES"
      },
      macro: {
        name: "Macro & Sovereign Baseline",
        tag: "Macro",
        status: "HEALTHY",
        asOf: (window.KYF_MARKET_PULSE && window.KYF_MARKET_PULSE.asOf) || "Recent",
        details: "CPI Inflation, EPF Sovereign Rate, Nifty Benchmarks",
        source: "RBI, MoSPI & NSE Index Benchmarks"
      },
      realEstate: {
        name: "NHB RESIDEX Real Estate",
        tag: "Real Estate",
        status: "HEALTHY",
        asOf: "Quarterly",
        details: "11 Tier 1 & 2 Indian Cities • Official RBI Housing Index",
        source: "National Housing Bank (NHB RESIDEX)"
      }
    };

    const overall = (statusData && statusData.overallStatus) || "HEALTHY";
    const lastSynced = (statusData && statusData.lastSyncedIST) || "Daily at 6:00 AM IST";
    const feeds = (statusData && statusData.feeds) ? statusData.feeds : fallbackFeeds;

    // Summary banner
    if (els.statusSummaryBanner) {
      els.statusSummaryBanner.className = "status-summary-banner" +
        (overall === "WARNING" ? " has-warning" : (overall === "ERROR" ? " has-error" : ""));
    }
    if (els.statusSummaryIcon) {
      els.statusSummaryIcon.textContent = overall === "HEALTHY" ? "✅" : (overall === "WARNING" ? "⚠️" : "❌");
    }
    if (els.statusSummaryTitle) {
      const feedKeys = Object.keys(feeds);
      const healthyCount = feedKeys.filter(k => (feeds[k].status || "").toUpperCase() === "HEALTHY").length;
      els.statusSummaryTitle.textContent = overall === "HEALTHY"
        ? `All ${feedKeys.length} Market Feeds Healthy & Active`
        : `${healthyCount} of ${feedKeys.length} Market Feeds Healthy`;
    }
    if (els.statusLastSyncedTime) {
      els.statusLastSyncedTime.textContent = `Last synchronized: ${lastSynced} • Daily Auto-Sync: 6:00 AM IST`;
    }

    // Grid of cards
    if (els.feedStatusGrid) {
      const feedIcons = {
        equities: "📈",
        mutualFunds: "🌱",
        usMarket: "🌐",
        bullion: "🪙",
        macro: "🏛️",
        realEstate: "🏙️"
      };

      els.feedStatusGrid.innerHTML = Object.entries(feeds).map(([key, f]) => {
        const isHealthy = (f.status || "").toUpperCase() === "HEALTHY";
        const tagClass = isHealthy ? "healthy" : ((f.status || "").toUpperCase() === "WARNING" ? "warning" : "error");
        const statusLabel = isHealthy ? "Healthy" : (f.status || "Unknown");
        const icon = feedIcons[key] || "📊";
        const formattedDate = formatAsOfDate(f.asOf);

        return `
          <div class="feed-status-card">
            <div class="feed-status-header">
              <div class="feed-status-name">${icon} ${escapeHTML(f.name || key)}</div>
              <span class="feed-status-tag ${tagClass}">
                <span class="status-indicator-dot ${isHealthy ? "online" : (tagClass === "warning" ? "warning" : "error")}"></span>
                ${escapeHTML(statusLabel)}
              </span>
            </div>
            <div class="feed-asof-row">
              <span class="feed-asof-label">As-Of Date</span>
              <span class="feed-asof-val">${escapeHTML(formattedDate)}</span>
            </div>
            <div class="feed-status-details">
              ${escapeHTML(f.details || "")}
            </div>
            <div class="feed-status-source" title="${escapeHTML(f.source || "")}">
              Source: ${escapeHTML(f.source || "Official Exchange Feed")}
            </div>
            ${f.error ? `<div class="feed-status-error">⚠️ ${escapeHTML(f.error)}</div>` : ""}
          </div>
        `;
      }).join("");
    }
  }

  async function handleBrokerFile(file) {
    if (!file || !window.KYF_BROKER_IMPORTER) return;
    currentLoadedFile = file;
    hideImportError();

    if (file.size === 0) {
      if (els.importDropzone) {
        els.importDropzone.classList.remove("is-reading", "has-file");
      }
      if (els.importStatsSummary) els.importStatsSummary.style.display = "none";
      if (els.importPreviewWrap) els.importPreviewWrap.style.display = "none";
      if (els.btnConfirmImport) els.btnConfirmImport.disabled = true;
      showImportError(
        `"${file.name}" is empty`,
        "The selected file contains 0 bytes. Please select a valid statement export."
      );
      showToast("Selected file is empty (0 bytes).", "warning");
      return;
    }

    // The person chooses the broker. Until they do, the file is only previewed (nothing can be imported).
    const sourceId = els.importSourceSelect && els.importSourceSelect.value !== "__add__" ? els.importSourceSelect.value : "";
    const source = window.KYF_BROKER_IMPORTER.getSource(sourceId) || window.KYF_BROKER_IMPORTER.PREVIEW_SOURCE;

    const selectedMember = (els.importMemberSelect && els.importMemberSelect.value) ? els.importMemberSelect.value.trim() : "Self";

    // 1. VISUAL CLUE: Immediate Reading / Analyzing State on the dropzone!
    if (els.importDropzone) {
      els.importDropzone.classList.remove("has-file");
      els.importDropzone.classList.add("is-reading");
    }
    if (els.importDropzoneContent) {
      els.importDropzoneContent.innerHTML = `
        <div class="import-dropzone-status">
          <div class="import-spinner"></div>
          <div class="import-dropzone-text">
            <strong>Reading &amp; analyzing ${escapeHTML(file.name)}...</strong>
          </div>
          <div class="import-dropzone-hint">${formatBytes(file.size)} • ${sourceId ? "Reading as " + escapeHTML(source.label) : "Previewing"}</div>
        </div>
      `;
    }
    if (els.btnConfirmImport) els.btnConfirmImport.disabled = true;
    showToast(`Reading ${file.name}...`, "info");

    try {
      // Yield to DOM so the spinner renders
      await new Promise(resolve => setTimeout(resolve, 40));

      const parsed = await window.KYF_BROKER_IMPORTER.parseFiles([file], selectedMember, source);

      if (!parsed.holdings || parsed.holdings.length === 0) {
        if (els.importDropzone) {
          els.importDropzone.classList.remove("is-reading", "has-file");
        }
        if (els.importDropzoneContent) {
          els.importDropzoneContent.innerHTML = `
            <div class="import-dropzone-status">
              <div class="import-dropzone-icon" style="color: var(--rose);">⚠️</div>
              <div class="import-dropzone-text" style="color: var(--rose);">
                <strong>No valid holdings recognized in "${escapeHTML(file.name)}"</strong>
              </div>
              <div class="import-dropzone-hint">Check that you chose the right broker, and that the file lists holdings with a name or ISIN and a quantity. Click to choose another file.</div>
            </div>
          `;
        }
        if (els.importStatsSummary) els.importStatsSummary.style.display = "none";
        if (els.importPreviewWrap) els.importPreviewWrap.style.display = "none";
        if (els.btnConfirmImport) els.btnConfirmImport.disabled = true;
        showImportError(
          `No valid holdings recognized in "${file.name}"`,
          "Check that you chose the right broker/source, and that the file contains position rows with a security name/ticker and quantity. Click or drop another file to retry."
        );
        showToast("No valid holdings detected in this file.", "warning");
        return;
      }

      hideImportError();

      // Explicitly assign EVERY holding to the user's chosen member
      pendingImportHoldings = parsed.holdings.map(h => ({ ...h, member: selectedMember }));
      pendingImportBrokers = [sourceId ? source.label : ""];

      const brokerLabel = source.label;
      const count = pendingImportHoldings.length;
      
      // 2. VISUAL CLUE: Loaded File Banner in the dropzone!
      if (els.importDropzone) {
        els.importDropzone.classList.remove("is-reading");
        els.importDropzone.classList.add("has-file");
      }
      if (els.importDropzoneContent) {
        els.importDropzoneContent.innerHTML = `
          <div class="import-dropzone-status">
            <div class="import-file-pill">
              <span class="import-file-icon">✓</span>
              <span class="import-file-name">${escapeHTML(file.name)}</span>
              <span class="import-file-size">(${formatBytes(file.size)})</span>
              <span class="import-broker-tag">${escapeHTML(brokerLabel)}</span>
            </div>
            <div class="import-file-action">Click or drop another file to change</div>
          </div>
        `;
      }

      // Render Preview Table
      renderImportPreview(selectedMember);

      showToast(sourceId ? `✓ Loaded ${count} holdings from ${brokerLabel}.` : `✓ Found ${count} holdings. Choose the broker to continue.`, sourceId ? "success" : "info");
    } catch (err) {
      console.error("[Broker Import Error]", err);
      if (els.importDropzone) {
        els.importDropzone.classList.remove("is-reading", "has-file");
      }
      if (els.importDropzoneContent) {
        els.importDropzoneContent.innerHTML = `
          <div class="import-dropzone-status">
            <div class="import-dropzone-icon" style="color: var(--rose);">⚠️</div>
            <div class="import-dropzone-text" style="color: var(--rose);">
              <strong>Failed to read "${escapeHTML(file.name)}"</strong>
            </div>
            <div class="import-dropzone-hint">${escapeHTML(err.message || "Parse error")} • Click to retry with another file</div>
          </div>
        `;
      }
      if (els.importStatsSummary) els.importStatsSummary.style.display = "none";
      if (els.importPreviewWrap) els.importPreviewWrap.style.display = "none";
      if (els.btnConfirmImport) els.btnConfirmImport.disabled = true;
      showImportError(
        `Failed to process "${file.name}"`,
        (err.message || "Parse error") + ". Please verify that the file is a supported statement (CSV, TSV, or Excel .xlsx / .xls)."
      );
      showToast(err.message || "Failed to parse statement file.", "danger");
    }
  }

  // ---- Brokers that are not in the built-in list ----
  const CUSTOM_SOURCES_KEY = "kyf_custom_sources";
  function loadCustomSources() {
    const importer = window.KYF_BROKER_IMPORTER;
    let saved = [];
    try { saved = JSON.parse(localStorage.getItem(CUSTOM_SOURCES_KEY) || "[]"); } catch (_) { saved = []; }
    saved.forEach((c) => { try { importer.registerCustomSource(c); } catch (_) { /* skip bad entry */ } });
    // Brokers already used by holdings (for example after opening a .kyf file on a new device)
    (rawHoldings || []).forEach((h) => {
      if (h && typeof h.importSource === "string" && h.importSource.startsWith("custom_") && !importer.getSource(h.importSource)) {
        try { importer.registerCustomSource({ label: h.custodian || h.importSource.slice(7).replace(/_/g, " "), kind: h.assetClass === "Mutual Funds" ? "mf" : "stocks", currency: h.currency === "USD" ? "USD" : "INR" }); } catch (_) { /* skip */ }
      }
    });
  }
  function saveCustomSources() {
    try { localStorage.setItem(CUSTOM_SOURCES_KEY, JSON.stringify(window.KYF_BROKER_IMPORTER.customSources())); } catch (_) { /* ignore */ }
  }
  function fillSourceOptions(selectedId) {
    if (!els.importSourceSelect) return;
    els.importSourceSelect.innerHTML = '<option value="">Choose broker or statement…</option>' +
      window.KYF_BROKER_IMPORTER.IMPORT_SOURCES.map(x => `<option value="${escapeHTML(x.id)}">${escapeHTML(x.label)}</option>`).join("") +
      '<option value="__add__">＋ Add another broker…</option>';
    els.importSourceSelect.value = selectedId || "";
  }
  function addCustomSourceFromForm() {
    try {
      const src = window.KYF_BROKER_IMPORTER.registerCustomSource({
        label: els.importCustomName ? els.importCustomName.value : "",
        kind: els.importCustomKind ? els.importCustomKind.value : "stocks",
        currency: els.importCustomCurrency ? els.importCustomCurrency.value : "INR"
      });
      saveCustomSources();
      fillSourceOptions(src.id);
      if (els.importCustomBox) els.importCustomBox.hidden = true;
      if (els.importCustomName) els.importCustomName.value = "";
      if (currentLoadedFile) handleBrokerFile(currentLoadedFile);
    } catch (err) {
      showToast(err.message || "Could not add the broker.", "warning");
    }
  }

  async function applyImportedHoldings() {
    if (!pendingImportHoldings || pendingImportHoldings.length === 0) return;
    if (isDemoMode) await leaveDemo();

    const selectedMember = (els.importMemberSelect && els.importMemberSelect.value) ? els.importMemberSelect.value.trim() : "Self";

    // Explicit assignment: every single imported holding belongs to selectedMember
    const finalIncoming = pendingImportHoldings.map(h => ({ ...h, member: selectedMember }));

    // Upsert into rawHoldings
    const sourceId = els.importSourceSelect ? els.importSourceSelect.value : "";
    if (!sourceId) { showToast("Choose where this file is from first.", "warning"); return; }
    const { holdings: merged, addedCount, updatedCount, removedCount } = window.KYF_BROKER_IMPORTER.replaceBucket(rawHoldings, finalIncoming, selectedMember, sourceId);
    rawHoldings = merged;
    userHoldings = [...rawHoldings];
    localStorage.setItem("kyf_user_holdings", JSON.stringify(userHoldings));

    if (window.KYF_PORTFOLIO_DATA && typeof window.KYF_PORTFOLIO_DATA.saveHoldingsToDB === "function") {
      await window.KYF_PORTFOLIO_DATA.saveHoldingsToDB(rawHoldings);
    }

    markDataChanged();
    activeMemberScope = new Set([selectedMember]);
    closeImportModal();
    renderApp();

    const brokerStr = pendingImportBrokers[0] || "Broker";
    showToast(`✓ ${sourceLabel(sourceId)} · ${selectedMember} updated: ${addedCount} new, ${updatedCount} updated, ${removedCount} removed.`, "success");
  }

  // ==========================================================================
  // Action Handlers
  // ==========================================================================
  // Demo data is a read-only sandbox: it is never copied into the user's own portfolio.
  // Leaving it restores the user's real data (or an empty portfolio) before anything is added.
  async function leaveDemo() {
    if (!isDemoMode) return;
    if (els.demoDataToggle) els.demoDataToggle.checked = false;
    await handleDemoToggle({ target: { checked: false } });
  }

  // Edit/delete on demo data: explain and offer the way out instead of silently converting it
  function blockDemoChange() {
    if (!isDemoMode) return false;
    showToast("This is demo data (read-only).", "warning", {
      label: "Start my own",
      onAction: () => { leaveDemo(); }
    });
    return true;
  }

  async function handleDemoToggle(e) {
    const isChecked = e.target.checked;
    isDemoMode = isChecked;
    localStorage.setItem("kyf_demo_mode", isChecked ? "true" : "false");

    if (isChecked) {
      // User turned ON Demo Data: stash any current user holdings & members so they are never lost
      if (rawHoldings && rawHoldings.length > 0 && userHoldings.length === 0) {
        userHoldings = [...rawHoldings];
        userGoals = [...rawGoals];
        userMembers = [...rawMembers];
        localStorage.setItem("kyf_user_holdings", JSON.stringify(userHoldings));
        localStorage.setItem("kyf_user_goals", JSON.stringify(userGoals));
        localStorage.setItem("kyf_user_members", JSON.stringify(userMembers));
      }
      // Keep demo data in memory only — DO NOT overwrite user's IndexedDB!
      rawHoldings = window.KYF_PORTFOLIO_DATA.getDemoFamilyHoldings();
      rawGoals = window.KYF_PORTFOLIO_DATA.getDemoGoals();
      rawMembers = window.KYF_PORTFOLIO_DATA.getDemoMembers();
      handleResetSelections();
      showToast("✓ Filled with demo family data", "success");
    } else {
      // User turned OFF Demo Data: restore from IndexedDB or userHoldings cache
      const storedHoldings = await window.KYF_PORTFOLIO_DATA.loadHoldingsFromDB();
      const storedGoals = await window.KYF_PORTFOLIO_DATA.loadGoalsFromDB();
      const storedMembers = await window.KYF_PORTFOLIO_DATA.loadMembersFromDB();

      if (storedHoldings && storedHoldings.length > 0) {
        rawHoldings = storedHoldings;
        userHoldings = storedHoldings;
      } else if (userHoldings && userHoldings.length > 0) {
        rawHoldings = [...userHoldings];
        await window.KYF_PORTFOLIO_DATA.saveHoldingsToDB(rawHoldings);
      } else {
        rawHoldings = [];
      }

      if (storedGoals && storedGoals.length > 0) {
        rawGoals = storedGoals;
        userGoals = storedGoals;
      } else if (userGoals && userGoals.length > 0) {
        rawGoals = [...userGoals];
        await window.KYF_PORTFOLIO_DATA.saveGoalsToDB(rawGoals);
      } else {
        rawGoals = [];
      }

      if (storedMembers && storedMembers.length > 0) {
        rawMembers = storedMembers;
        userMembers = storedMembers;
      } else if (userMembers && userMembers.length > 0) {
        rawMembers = [...userMembers];
        await window.KYF_PORTFOLIO_DATA.saveMembersToDB(rawMembers);
      } else {
        const inferred = inferMembersFromHoldings(rawHoldings);
        rawMembers = inferred;
        userMembers = inferred;
        await window.KYF_PORTFOLIO_DATA.saveMembersToDB(rawMembers);
      }

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
    if (window.KYF_VAULT) {
      window.KYF_VAULT.save({
        portfolio: rawHoldings,
        goals: rawGoals,
        members: rawMembers
      });
    } else {
      const fileName = window.KYF_PORTFOLIO_DATA.exportAppData(rawHoldings, rawGoals, rawMembers);
      showToast(`✓ Data saved & exported to ${fileName}`, "success");
    }
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

    // 2b. Currency Segmented Controls (₹ INR | $ USD)
    const currencyBtns = document.querySelectorAll(".currency-btn");
    currencyBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        const curr = btn.getAttribute("data-curr");
        if (curr && curr !== activeCurrency) {
          activeCurrency = curr;
          try {
            localStorage.setItem("kyf_portfolio_currency", curr);
          } catch (_) {}
          currencyBtns.forEach((b) => b.classList.remove("active"));
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

    // Member Management Modal Events
    if (els.btnOpenMemberModal) {
      els.btnOpenMemberModal.addEventListener("click", openMemberModal);
    }
    if (els.btnCloseMemberModal) {
      els.btnCloseMemberModal.addEventListener("click", closeMemberModal);
    }
    if (els.memberModal) {
      els.memberModal.addEventListener("click", (e) => {
        if (e.target === els.memberModal) {
          closeMemberModal();
        }
      });
    }
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && els.memberModal && els.memberModal.style.display === "flex") {
        closeMemberModal();
      }
    });
    if (els.formAddMember) {
      els.formAddMember.addEventListener("submit", handleAddMemberSubmit);
    }

    // Holding Management Modal Events
    if (els.btnOpenHoldingModal) {
      els.btnOpenHoldingModal.addEventListener("click", () => openHoldingModal(false));
    }
    if (els.btnCloseHoldingModal) {
      els.btnCloseHoldingModal.addEventListener("click", closeHoldingModal);
    }
    if (els.btnCancelHolding) {
      els.btnCancelHolding.addEventListener("click", closeHoldingModal);
    }
    if (els.btnDeleteHolding) {
      els.btnDeleteHolding.addEventListener("click", () => {
        if (editingHoldingId) {
          handleDeleteHolding(editingHoldingId);
        }
      });
    }
    if (els.holdingModal) {
      els.holdingModal.addEventListener("click", (e) => {
        if (e.target === els.holdingModal) {
          closeHoldingModal();
        }
      });
    }
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && els.holdingModal && els.holdingModal.style.display === "flex") {
        closeHoldingModal();
      }
    });
    if (els.formAddHolding) {
      els.formAddHolding.addEventListener("submit", handleAddHoldingSubmit);
    }

    // Broker Importer Modal Events
    if (els.btnOpenImportModal) {
      els.btnOpenImportModal.addEventListener("click", openImportModal);
    }
    if (els.btnCloseImportModal) {
      els.btnCloseImportModal.addEventListener("click", closeImportModal);
    }
    if (els.btnCancelImport) {
      els.btnCancelImport.addEventListener("click", closeImportModal);
    }
    if (els.btnConfirmImport) {
      els.btnConfirmImport.addEventListener("click", applyImportedHoldings);
    }
    if (els.importDropzone) {
      els.importDropzone.addEventListener("click", () => {
        if (els.brokerFileInput) {
          els.brokerFileInput.value = "";
          els.brokerFileInput.click();
        }
      });
      els.importDropzone.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          if (els.brokerFileInput) {
            els.brokerFileInput.value = "";
            els.brokerFileInput.click();
          }
        }
      });
      ["dragenter", "dragover"].forEach((eventName) => {
        els.importDropzone.addEventListener(eventName, (e) => {
          e.preventDefault();
          e.stopPropagation();
          els.importDropzone.classList.add("dragover");
        });
      });
      ["dragleave", "dragend"].forEach((eventName) => {
        els.importDropzone.addEventListener(eventName, (e) => {
          e.preventDefault();
          e.stopPropagation();
          els.importDropzone.classList.remove("dragover");
        });
      });
      els.importDropzone.addEventListener("drop", (e) => {
        e.preventDefault();
        e.stopPropagation();
        els.importDropzone.classList.remove("dragover");
        const dt = e.dataTransfer;
        if (dt && dt.files && dt.files.length > 0) {
          handleBrokerFile(dt.files[0]);
        }
      });
    }
    if (els.brokerFileInput) {
      els.brokerFileInput.addEventListener("change", (e) => {
        if (e.target.files && e.target.files.length > 0) {
          handleBrokerFile(e.target.files[0]);
        }
      });
    }
    if (els.importSourceSelect) {
      els.importSourceSelect.addEventListener("change", () => {
        if (els.importSourceSelect.value === "__add__") {
          if (els.importCustomBox) els.importCustomBox.hidden = false;
          els.importSourceSelect.value = "";
          if (els.importCustomName) els.importCustomName.focus();
          return;
        }
        if (els.importCustomBox) els.importCustomBox.hidden = true;
        if (currentLoadedFile) handleBrokerFile(currentLoadedFile);
      });
    }
    if (els.btnAddCustomSource) els.btnAddCustomSource.addEventListener("click", addCustomSourceFromForm);
    if (els.importCustomName) {
      els.importCustomName.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); addCustomSourceFromForm(); } });
    }
    if (els.importMemberSelect) {
      els.importMemberSelect.addEventListener("change", () => {
        const selectedMember = (els.importMemberSelect && els.importMemberSelect.value) ? els.importMemberSelect.value.trim() : "Self";
        if (pendingImportHoldings && pendingImportHoldings.length > 0) {
          pendingImportHoldings = pendingImportHoldings.map(h => ({ ...h, member: selectedMember }));
          renderImportPreview(selectedMember);
        } else if (els.btnConfirmImport) {
          els.btnConfirmImport.textContent = `＋ Import Holdings for ${selectedMember}`;
        }
      });
    }
    if (els.importModal) {
      els.importModal.addEventListener("click", (e) => {
        if (e.target === els.importModal) {
          closeImportModal();
        }
      });
    }
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && els.importModal && els.importModal.style.display === "flex") {
        closeImportModal();
      }
    });

    // Market Data Status Modal Events
    if (els.pulseAsOf) {
      els.pulseAsOf.addEventListener("click", openDataStatusModal);
      els.pulseAsOf.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openDataStatusModal();
        }
      });
    }
    if (els.portfolioTopAsOf) {
      els.portfolioTopAsOf.addEventListener("click", openDataStatusModal);
      els.portfolioTopAsOf.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openDataStatusModal();
        }
      });
    }
    if (els.btnCloseDataStatusModal) {
      els.btnCloseDataStatusModal.addEventListener("click", closeDataStatusModal);
    }
    if (els.btnDoneDataStatus) {
      els.btnDoneDataStatus.addEventListener("click", closeDataStatusModal);
    }
    if (els.dataStatusModal) {
      els.dataStatusModal.addEventListener("click", (e) => {
        if (e.target === els.dataStatusModal) {
          closeDataStatusModal();
        }
      });
    }
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && els.dataStatusModal && els.dataStatusModal.style.display === "flex") {
        closeDataStatusModal();
      }
    });

    // Modal Live Calculation and Plan Variant Event Listeners
    if (els.inputHoldingCurVal) {
      els.inputHoldingCurVal.addEventListener("input", () => recalcHoldingValues("curval"));
    }
    if (els.inputHoldingUnits) {
      els.inputHoldingUnits.addEventListener("input", () => recalcHoldingValues("units"));
    }
    if (els.inputHoldingPrice) {
      els.inputHoldingPrice.addEventListener("input", () => recalcHoldingValues("price"));
    }
    if (els.radioVariantDirect) {
      els.radioVariantDirect.addEventListener("change", handleMfVariantChange);
    }
    if (els.radioVariantRegular) {
      els.radioVariantRegular.addEventListener("change", handleMfVariantChange);
    }
    if (els.selectHoldingAssetClass) {
      els.selectHoldingAssetClass.addEventListener("change", (e) => {
        const val = e.target.value;
        applyHoldingTypeMode();
        if (val === "Mutual Funds") {
          if (activeModalInstrument && (activeModalInstrument.directNav != null || activeModalInstrument.regularNav != null)) {
            setupMfVariantBox(activeModalInstrument);
          }
        } else {
          hideMfVariantBox();
        }
      });
    }

    // Modal Omni-Search Typeahead
    wireOmniSearch(
      document.getElementById("modal-omni-search-input"),
      document.getElementById("modal-omni-search-results"),
      document.getElementById("modal-omni-search-clear"),
      { keepValue: true, isEnabled: () => !editingHoldingId }
    );

    // Retyping the name after picking a stock/fund/city means a different asset: drop the stale
    // live-price link so the old instrument's price can't attach to the new name.
    if (els.inputHoldingName) {
      els.inputHoldingName.addEventListener("input", () => {
        const inst = activeModalInstrument;
        if (editingHoldingId || !inst || !["stock", "fund", "city", "us_asset"].includes(inst.type)) return;
        if (els.inputHoldingName.value.trim() !== (inst.name || "").trim()) {
          activeModalInstrument = null;
          hideMfVariantBox();
          applyHoldingTypeMode();
          recalcHoldingValues();
        }
      });
    }

    // 7. App-Level Toolbar: Open & Save Data Buttons backed by shared KYF Vault
    if (window.KYF_VAULT) {
      window.KYF_VAULT.registerPageHook({
        pageName: "portfolio",
        // Saving while the demo family is on screen must not write the demo into the person's file
        getLocalData: () => ({
          portfolio: isDemoMode ? userHoldings : rawHoldings,
          goals: isDemoMode ? userGoals : rawGoals,
          members: isDemoMode ? userMembers : rawMembers
        }),
        onAfterOpen: async (vaultData, summary) => {
          // An explicit (even empty) portfolio replaces what is on screen; a missing one leaves it alone
          if (Array.isArray(vaultData.portfolio)) {
            isDemoMode = false;
            localStorage.setItem("kyf_demo_mode", "false");
            userHoldings = vaultData.portfolio;
            userGoals = vaultData.goals || [];
            localStorage.setItem("kyf_user_holdings", JSON.stringify(userHoldings));
            localStorage.setItem("kyf_user_goals", JSON.stringify(userGoals));
            rawHoldings = userHoldings;
            rawGoals = userGoals;
            if (els.demoDataToggle) els.demoDataToggle.checked = false;
            await window.KYF_PORTFOLIO_DATA.saveHoldingsToDB(rawHoldings);
            await window.KYF_PORTFOLIO_DATA.saveGoalsToDB(rawGoals);
          } else if (vaultData.goals && vaultData.goals.length) {
            userGoals = vaultData.goals;
            rawGoals = userGoals;
            await window.KYF_PORTFOLIO_DATA.saveGoalsToDB(rawGoals);
          }
          if (vaultData.members && Array.isArray(vaultData.members) && vaultData.members.length) {
            // Files from older builds may lack member ids, which the local store needs as its key
            userMembers = vaultData.members.map((m, i) => (m && m.id ? m : { ...m, id: `mem_${Date.now()}_${i}` }));
            rawMembers = userMembers;
            localStorage.setItem("kyf_user_members", JSON.stringify(userMembers));
            await window.KYF_PORTFOLIO_DATA.saveMembersToDB(userMembers);
          }
          handleResetSelections();
          renderApp();
        }
      });
      window.KYF_VAULT.bindPageUI({
        fileInputId: "kyfFileInput",
        openBtnId: "navOpenFileBtn",
        saveBtnId: "navSaveDataBtn"
      });
    } else {
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

            if (result.members && result.members.length) {
              userMembers = result.members;
              rawMembers = userMembers;
              localStorage.setItem("kyf_user_members", JSON.stringify(userMembers));
              await window.KYF_PORTFOLIO_DATA.saveMembersToDB(userMembers);
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

    // Always inspect IndexedDB for user's stored holdings, goals & members
    const storedHoldings = await window.KYF_PORTFOLIO_DATA.loadHoldingsFromDB();
    const storedGoals = await window.KYF_PORTFOLIO_DATA.loadGoalsFromDB();
    const storedMembers = await window.KYF_PORTFOLIO_DATA.loadMembersFromDB();

    if (storedHoldings && storedHoldings.length > 0 && userHoldings.length === 0) {
      userHoldings = storedHoldings;
    }
    if (storedGoals && storedGoals.length > 0 && userGoals.length === 0) {
      userGoals = storedGoals;
    }
    if (storedMembers && storedMembers.length > 0 && userMembers.length === 0) {
      userMembers = storedMembers;
    }

    if (isDemoMode) {
      // Demo Data mode active: populate demo family dataset strictly in memory (DO NOT overwrite IndexedDB)
      rawHoldings = window.KYF_PORTFOLIO_DATA.getDemoFamilyHoldings();
      rawGoals = window.KYF_PORTFOLIO_DATA.getDemoGoals();
      rawMembers = window.KYF_PORTFOLIO_DATA.getDemoMembers();
    } else {
      // User Data mode: restore user's stored holdings or start with clean slate
      if (storedHoldings && storedHoldings.length > 0) {
        rawHoldings = storedHoldings;
        userHoldings = storedHoldings;
      } else if (userHoldings && userHoldings.length > 0) {
        rawHoldings = [...userHoldings];
        await window.KYF_PORTFOLIO_DATA.saveHoldingsToDB(rawHoldings);
      } else {
        rawHoldings = [];
      }

      if (storedGoals && storedGoals.length > 0) {
        rawGoals = storedGoals;
        userGoals = storedGoals;
      } else if (userGoals && userGoals.length > 0) {
        rawGoals = [...userGoals];
        await window.KYF_PORTFOLIO_DATA.saveGoalsToDB(rawGoals);
      } else {
        rawGoals = [];
      }

      if (storedMembers && storedMembers.length > 0) {
        rawMembers = storedMembers;
        userMembers = storedMembers;
      } else if (userMembers && userMembers.length > 0) {
        rawMembers = [...userMembers];
        await window.KYF_PORTFOLIO_DATA.saveMembersToDB(rawMembers);
      } else {
        const inferred = inferMembersFromHoldings(rawHoldings);
        rawMembers = inferred;
        userMembers = inferred;
        await window.KYF_PORTFOLIO_DATA.saveMembersToDB(rawMembers);
      }
    }

    renderApp();
  }

  boot();
});
