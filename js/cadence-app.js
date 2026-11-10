(function () {
  const STORAGE_KEY = "kyf_cadence_v3";

  const DEFAULT_ACTIVITIES = [
    // Life-milestone checklists are generated from Goals (see js/kyf-goals.js).
    {
      id: "house-networth",
      section: "housekeeping",
      category: "Housekeeping",
      frequency: "Quarterly",
      icon: "📊",
      title: "Compute Net Worth Statement",
      description: "Consolidate all assets (bank balances, FDs, EPF, PPF, mutual funds, direct stocks, gold, real estate) and subtract all debts (mortgages, car loans, card balances).",
      status: "active",
      dueDate: "",
      tags: ["Net Worth", "Quarterly", "Asset Ledger"]
    },
    {
      id: "house-savings-audit",
      section: "housekeeping",
      category: "Housekeeping",
      frequency: "Monthly",
      icon: "🏦",
      title: "Track Savings & Operating Accounts",
      description: "Audit bank statements for idle balances earning sub-3% returns, activate auto sweep-in fixed deposits, and verify no unexpected bank charges or fee leakages.",
      status: "active",
      dueDate: "",
      tags: ["Savings Account", "Sweep FD", "Bank Fees"]
    },
    {
      id: "house-mf-xray",
      section: "housekeeping",
      category: "Housekeeping",
      frequency: "Half-Yearly",
      icon: "🔍",
      title: "Audit Mutual Funds & Direct Plans",
      description: "Scan your portfolio for regular plans paying 0.5%-1.2% distributor commission drag. Eliminate overlapping funds and align fund categories with goal horizons.",
      status: "active",
      dueDate: "",
      tags: ["Mutual Funds", "Direct vs Regular", "Expense Ratio", "AMFI"]
    },
    {
      id: "house-equity-check",
      section: "housekeeping",
      category: "Housekeeping",
      frequency: "Quarterly",
      icon: "📈",
      title: "Review Equity & Demat Accounts",
      description: "Inspect direct stock holdings for concentration risk (no single stock > 10% of total wealth), review company quarterly earnings, and verify dividend payouts.",
      status: "active",
      dueDate: "",
      tags: ["Equities", "Demat", "Concentration Risk", "Dividends"]
    },
    {
      id: "house-epf-ppf-nps",
      section: "housekeeping",
      category: "Housekeeping",
      frequency: "Annual / March",
      icon: "📜",
      title: "Verify EPF, PPF & NPS Passbooks",
      description: "Download annual EPFO passbook to verify employer contribution credits, deposit the annual ₹1.5L PPF ceiling before April 5th, and check NPS tier 1 asset mix.",
      status: "active",
      dueDate: "",
      tags: ["EPF", "PPF (₹1.5L)", "NPS", "Fixed Income"]
    },
    {
      id: "house-credit-card-debt",
      section: "housekeeping",
      category: "Housekeeping",
      frequency: "Monthly",
      icon: "💳",
      title: "Audit Credit Cards & Check CIBIL Score",
      description: "Ensure cards are set to auto-pay Total Amount Due (never minimum due), cancel recurring subscription traps, and download quarterly free credit bureau reports (750+ score).",
      status: "active",
      dueDate: "",
      tags: ["Credit Card", "CIBIL", "Auto-pay", "Subscriptions"]
    },
    {
      id: "house-insurance-audit",
      section: "housekeeping",
      category: "Housekeeping",
      frequency: "Annual",
      icon: "🛡️",
      title: "Annual Term & Health Insurance Review",
      description: "Confirm term insurance is pure protection (no investment mix) covering 10x-15x income. Review health floater restoration clauses and Super Top-up deductibles.",
      status: "active",
      dueDate: "",
      tags: ["Term Insurance", "Health Cover", "Super Top-up"]
    },
    {
      id: "house-rebalance",
      section: "housekeeping",
      category: "Housekeeping",
      frequency: "Annual / March",
      icon: "⚖️",
      title: "Annual Portfolio Rebalancing",
      description: "Compare your current Equity : Debt : Gold weights against your target asset allocation. Systematically trim overperforming assets to buy underperforming buckets calmly.",
      status: "active",
      dueDate: "",
      tags: ["Asset Allocation", "Rebalancing", "Risk Control"]
    },
    {
      id: "house-tax-harvesting",
      section: "housekeeping",
      category: "Housekeeping",
      frequency: "Quarterly & March",
      icon: "🧾",
      title: "Tax Optimization & LTCG Harvesting",
      description: "Evaluate Old vs New Tax Regime deductions, harvest up to ₹1.25 Lakh tax-free equity long-term capital gains (LTCG) annually, and remit quarterly advance taxes.",
      status: "active",
      dueDate: "",
      tags: ["Tax Filing", "Advance Tax", "LTCG Harvesting", "80C"]
    },
    {
      id: "house-nominees-will",
      section: "housekeeping",
      category: "Housekeeping",
      frequency: "Annual",
      icon: "🔐",
      title: "Update Nominees & Emergency Digital Vault",
      description: "Ensure active, verified nominees across all bank accounts, demat accounts, EPF, and insurance policies. Maintain a secure emergency family access ledger.",
      status: "active",
      dueDate: "",
      tags: ["Nomination", "Estate Planning", "Digital Vault", "Family"]
    },
    {
      id: "house-market-performance",
      section: "housekeeping",
      category: "Housekeeping",
      frequency: "Monthly / Quarterly",
      icon: "📈",
      title: "Review Market Performance & Benchmarks",
      description: "Review broad market returns across Nifty 50, Nifty Midcap, Gold, Fixed Income yields, and global indices to keep long-term return expectations realistic without reacting to daily noise.",
      status: "active",
      dueDate: "",
      pageUrl: "market-performance.html",
      tags: ["Market Review", "Nifty 50", "Macro Benchmarks", "Asset Performance"]
    }
  ];

  // State
  let activities = [];
  let currentCategory = "all";
  let currentStatus = "all";
  let searchQuery = "";

  // Goal-linked checklists ---------------------------------------------------
  let goalsList = [];
  const goalFilterId = new URLSearchParams(window.location.search).get("goal") || "";

  async function syncGoalTasks() {
    const K = window.KYF_GOALS;
    const handler = window.KYF_VAULT && window.KYF_VAULT.sections.get("goals");
    if (!K || !handler) return;
    try {
      goalsList = K.mergeGoalLists(await handler.read());
    } catch (e) {
      goalsList = [];
    }
    const ids = new Set(goalsList.map((g) => g.id));
    // Tasks of deleted goals go away; every goal gets its checklist exactly once
    activities = activities.filter((a) => !a.goalId || ids.has(a.goalId));
    goalsList.forEach((g) => { activities = K.withChecklist(activities, g); });
    saveActivities();
  }

  async function refresh() {
    loadActivities();
    await syncGoalTasks();
    render();
  }

  // Load activities
  function loadActivities() {
    try {
      let raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        raw = localStorage.getItem("kyf_cadence_v2") || localStorage.getItem("kyf_cadence_v1");
      }
      if (raw) {
        let stored = JSON.parse(raw);
        if (window.KYF_GOALS) stored = window.KYF_GOALS.migrateCadence(stored);
        const defaultMap = new Map(DEFAULT_ACTIVITIES.map(d => [d.id, d]));
        activities = stored.map(s => {
          const def = defaultMap.get(s.id);
          if (def) {
            return Object.assign({}, def, s, {
              pageUrl: def.pageUrl || s.pageUrl || (s.id === "house-market-performance" ? "market-performance.html" : null),
              icon: def.icon || s.icon,
              title: def.title || s.title,
              description: def.description || s.description,
              tags: def.tags || s.tags
            });
          }
          return s;
        });
        // Append any default activity not yet in stored
        const storedIds = new Set(stored.map(s => s.id));
        DEFAULT_ACTIVITIES.forEach(def => {
          if (!storedIds.has(def.id)) {
            activities.push(JSON.parse(JSON.stringify(def)));
          }
        });
        saveActivities();
      } else {
        activities = JSON.parse(JSON.stringify(DEFAULT_ACTIVITIES));
        saveActivities();
      }
    } catch (e) {
      activities = JSON.parse(JSON.stringify(DEFAULT_ACTIVITIES));
    }
  }

  function saveActivities() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(activities));
    } catch (e) {
      console.error("Storage error:", e);
    }
  }

  // Render Cards
  function render() {
    const goalsGrid = document.getElementById("goalsGrid");
    const housekeepingGrid = document.getElementById("housekeepingGrid");
    const goalsSection = document.getElementById("goalsSection");
    const housekeepingSection = document.getElementById("housekeepingSection");

    const q = searchQuery.trim().toLowerCase();

    // Filter items
    const filtered = activities.filter(item => {
      if (goalFilterId && item.goalId !== goalFilterId) return false;
      // Category filter
      if (currentCategory !== "all" && item.section !== currentCategory) return false;

      // Status filter
      if (currentStatus !== "all" && item.status !== currentStatus) return false;

      // Search query
      if (q) {
        const inTitle = item.title.toLowerCase().includes(q);
        const inDesc = item.description.toLowerCase().includes(q);
        const inTags = item.tags && item.tags.some(t => t.toLowerCase().includes(q));
        const inFreq = item.frequency && item.frequency.toLowerCase().includes(q);
        if (!inTitle && !inDesc && !inTags && !inFreq) return false;
      }
      return true;
    });

    // Separate sections
    const goalsItems = filtered.filter(i => i.section === "goals");
    const houseItems = filtered.filter(i => i.section === "housekeeping");

    // Update counts
    document.getElementById("goalsCountBadge").textContent = `${goalsItems.length} activities`;
    document.getElementById("housekeepingCountBadge").textContent = `${houseItems.length} activities`;

    // Section visibility
    goalsSection.style.display = (currentCategory === "all" || currentCategory === "goals") ? "block" : "none";
    housekeepingSection.style.display = (currentCategory === "all" || currentCategory === "housekeeping") ? "block" : "none";

    // Render grids
    goalsGrid.innerHTML = goalsItems.length
      ? renderGoalGroups(goalsItems)
      : `<div class="empty-state empty-state--wide"><p>No goal steps yet. <a href="goals.html">Add a goal</a> and its checklist appears here.</p></div>`;
    const note = document.getElementById("goalFilterNote");
    if (note) {
      const g = goalsList.find((x) => x.id === goalFilterId);
      note.hidden = !goalFilterId;
      if (goalFilterId) {
        note.innerHTML = `Showing steps for <strong>${escapeHtml(g ? g.name : "this goal")}</strong> &middot; <a href="cadence.html">Show everything</a>`;
      }
    }

    housekeepingGrid.innerHTML = houseItems.length
      ? houseItems.map(createCardHTML).join("")
      : `<div class="empty-state empty-state--wide"><p>No matching housekeeping activities found.</p><button class="btn-action" onclick="window.clearCadenceSearch()">Clear search filter</button></div>`;

    // Update top metrics
    updateMetrics();
  }

  function renderGoalGroups(items) {
    const groups = new Map();
    items.forEach((it) => {
      const key = it.goalId || "_other";
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(it);
    });
    let html = "";
    groups.forEach((list, key) => {
      const g = goalsList.find((x) => x.id === key);
      const done = list.filter((i) => i.status === "done").length;
      const title = g ? `${escapeHtml(g.icon || "🎯")} ${escapeHtml(g.name)}` : "📌 Other milestones";
      html += `<div class="goal-group-head"><h3>${title}</h3><span class="goal-group-progress">${done}/${list.length} done</span>${g ? `<a href="goals.html">Open goal &rarr;</a>` : ""}</div>`;
      html += list.map(createCardHTML).join("");
    });
    return html;
  }

  function createCardHTML(item) {
    const isDone = item.status === "done";
    const isScheduled = item.status === "scheduled";
    const isNA = item.status === "not_applicable";
    const pageUrl = item.pageUrl || (item.id === "house-market-performance" ? "market-performance.html" : null);

    return `
      <div class="act-card status-${item.status} ${pageUrl ? 'is-clickable-card' : ''}" id="card-${item.id}" data-id="${item.id}" ${pageUrl ? `data-url="${pageUrl}" title="Click to open ${escapeHtml(item.title)}"` : ''}>
        <div class="card-head">
          <div class="card-meta">
            <span class="tag-cat ${item.section}">${item.category || (item.section === 'goals' ? 'Milestone' : 'Housekeeping')}</span>
            <span class="tag-freq">${escapeHtml(item.frequency || '')}</span>
          </div>
          <div class="card-icon" aria-hidden="true">${item.icon || '📌'}</div>
        </div>

        <h3>${escapeHtml(item.title)}</h3>
        <p class="card-desc">${escapeHtml(item.description)}</p>

        ${item.tags && item.tags.length ? `
          <div class="card-tags">
            ${item.tags.map(t => `<span class="card-tag">#${escapeHtml(t)}</span>`).join('')}
          </div>
        ` : ''}

        ${pageUrl ? `
          <div style="margin-bottom: 12px;">
            <a href="${pageUrl}" class="card-action-cue" onclick="event.stopPropagation();">
              <span>Open Tool</span> &rarr;
            </a>
          </div>
        ` : ''}

        <div class="card-footer">
          <div class="status-row">
            <select class="status-selector" data-action="status-change" aria-label="Update status for ${escapeHtml(item.title)}">
              <option value="active" ${item.status === 'active' ? 'selected' : ''}>🟢 Active</option>
              <option value="scheduled" ${item.status === 'scheduled' ? 'selected' : ''}>📅 Work on this date</option>
              <option value="done" ${item.status === 'done' ? 'selected' : ''}>✅ Done</option>
              <option value="not_applicable" ${item.status === 'not_applicable' ? 'selected' : ''}>⚪ Not Applicable</option>
            </select>

            <button class="quick-done-btn ${isDone ? 'done' : ''}" data-action="toggle-done" title="${isDone ? 'Mark as Active' : 'Mark as Done'}" aria-label="Toggle completion">
              ${isDone ? '✓' : '○'}
            </button>
          </div>

          <div class="date-row" style="${isScheduled || item.dueDate ? 'display:flex;' : 'display:none;'}">
            <span class="date-label">📅 Target date:</span>
            <input type="date" class="date-input" value="${escapeHtml(item.dueDate || '')}" data-action="date-change" aria-label="Work on date for ${escapeHtml(item.title)}">
          </div>
        </div>
      </div>
    `;
  }

  function updateMetrics() {
    const total = activities.length;
    const active = activities.filter(i => i.status === "active").length;
    const scheduled = activities.filter(i => i.status === "scheduled").length;
    const done = activities.filter(i => i.status === "done").length;
    const na = activities.filter(i => i.status === "not_applicable").length;

    document.getElementById("metricTotal").textContent = total;
    document.getElementById("metricActive").textContent = active;
    document.getElementById("metricScheduled").textContent = scheduled;
    document.getElementById("metricDone").textContent = done;
    document.getElementById("metricNA").textContent = na;
  }

  function escapeHtml(str) {
    if (!str) return "";
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  window.clearCadenceSearch = function () {
    document.getElementById("searchInput").value = "";
    searchQuery = "";
    document.getElementById("searchClearBtn").classList.remove("visible");
    render();
  };

  // Event Listeners
  function bindEvents() {
    // Search input
    const searchInput = document.getElementById("searchInput");
    const clearBtn = document.getElementById("searchClearBtn");

    searchInput.addEventListener("input", function (e) {
      searchQuery = e.target.value;
      if (searchQuery.length > 0) {
        clearBtn.classList.add("visible");
      } else {
        clearBtn.classList.remove("visible");
      }
      render();
    });

    clearBtn.addEventListener("click", window.clearCadenceSearch);

    // Category filter pills
    document.querySelectorAll(".filter-pill[data-category]").forEach(btn => {
      btn.addEventListener("click", function () {
        document.querySelectorAll(".filter-pill[data-category]").forEach(b => b.classList.remove("active"));
        this.classList.add("active");
        currentCategory = this.dataset.category;
        render();
      });
    });

    // Status filter pills
    document.querySelectorAll(".filter-pill[data-status]").forEach(btn => {
      btn.addEventListener("click", function () {
        document.querySelectorAll(".filter-pill[data-status]").forEach(b => b.classList.remove("active"));
        this.classList.add("active");
        currentStatus = this.dataset.status;

        // Sync metric strip highlight
        document.querySelectorAll(".metric-card").forEach(c => c.classList.remove("active-metric"));
        const matchCard = document.querySelector(`.metric-card[data-status-filter="${currentStatus}"]`);
        if (matchCard) matchCard.classList.add("active-metric");

        render();
      });
    });

    // Metric strip clicks
    document.querySelectorAll(".metric-card").forEach(card => {
      card.addEventListener("click", function () {
        const st = this.dataset.statusFilter;
        document.querySelectorAll(".filter-pill[data-status]").forEach(b => {
          b.classList.toggle("active", b.dataset.status === st);
        });
        document.querySelectorAll(".metric-card").forEach(c => c.classList.remove("active-metric"));
        this.classList.add("active-metric");
        currentStatus = st;
        render();
      });
    });

    // Delegated events for Cards
    document.addEventListener("change", function (e) {
      const cardEl = e.target.closest(".act-card");
      if (!cardEl) return;
      const itemId = cardEl.dataset.id;
      const item = activities.find(i => i.id === itemId);
      if (!item) return;

      if (e.target.dataset.action === "status-change") {
        item.status = e.target.value;
        saveActivities();
        render();
      }

      if (e.target.dataset.action === "date-change") {
        item.dueDate = e.target.value;
        if (item.dueDate && item.status !== "scheduled" && item.status !== "done") {
          item.status = "scheduled";
        }
        saveActivities();
        render();
      }
    });

    document.addEventListener("click", function (e) {
      const btn = e.target.closest("button[data-action='toggle-done']");
      if (btn) {
        const cardEl = btn.closest(".act-card");
        if (!cardEl) return;
        const itemId = cardEl.dataset.id;
        const item = activities.find(i => i.id === itemId);
        if (!item) return;

        item.status = (item.status === "done") ? "active" : "done";
        saveActivities();
        render();
        return;
      }

      // If clicking interactive child controls (select, input, button, textarea), do not navigate
      if (e.target.closest("select, input, button, textarea")) return;

      // If clicking directly on an anchor tag, let the browser follow the link
      if (e.target.closest("a")) return;

      // If clicking on a card with a pageUrl, navigate to that page
      const clickableCard = e.target.closest(".act-card.is-clickable-card, .act-card[data-url]");
      if (clickableCard && clickableCard.dataset.url) {
        window.location.href = clickableCard.dataset.url;
      }
    });

    // Add Custom Activity Modal
    const modal = document.getElementById("addModalOverlay");
    const openModalBtn = document.getElementById("openAddModalBtn");
    const closeModalBtn = document.getElementById("closeAddModalBtn");
    const cancelAddBtn = document.getElementById("cancelAddBtn");
    const addForm = document.getElementById("addActivityForm");

    openModalBtn.addEventListener("click", () => modal.classList.add("open"));
    closeModalBtn.addEventListener("click", () => modal.classList.remove("open"));
    cancelAddBtn.addEventListener("click", () => modal.classList.remove("open"));

    modal.addEventListener("click", (e) => {
      if (e.target === modal) modal.classList.remove("open");
    });

    addForm.addEventListener("submit", function (e) {
      e.preventDefault();
      const sec = document.getElementById("actSection").value;
      const title = document.getElementById("actTitle").value.trim();
      const freq = document.getElementById("actFrequency").value.trim() || "Regular";
      const desc = document.getElementById("actDesc").value.trim();
      const tagsStr = document.getElementById("actTags").value.trim();
      const status = document.getElementById("actStatus").value;
      const dueDate = document.getElementById("actDueDate").value;

      const tags = tagsStr ? tagsStr.split(",").map(t => t.trim()).filter(Boolean) : [];

      const newActivity = {
        id: "custom-" + Date.now(),
        section: sec,
        category: sec === "goals" ? "Milestone" : "Housekeeping",
        frequency: freq,
        icon: sec === "goals" ? "🎯" : "🧹",
        title: title,
        description: desc,
        status: status,
        dueDate: dueDate,
        tags: tags
      };

      activities.unshift(newActivity);
      saveActivities();
      modal.classList.remove("open");
      addForm.reset();
      render();
    });

    // Toast Helper
    function showToast(msg) {
      let toast = document.getElementById("toastNotification");
      if (!toast) {
        toast = document.createElement("div");
        toast.id = "toastNotification";
        toast.className = "toast-notice";
        document.body.appendChild(toast);
      }
      toast.textContent = msg;
      toast.classList.add("show");
      clearTimeout(toast._timer);
      toast._timer = setTimeout(() => {
        toast.classList.remove("show");
      }, 3200);
    }

    // Unified KYF Vault Integration (Cadence + Portfolio + Goals)
    if (window.KYF_VAULT) {
      window.KYF_VAULT.registerPageHook({
        pageName: "cadence",
        getLocalData: () => {
          saveActivities();
          return { cadence: activities };
        },
        onAfterOpen: () => refresh()
      });
      window.KYF_VAULT.bindPageUI({
        fileInputId: "kyfFileInput",
        openBtnId: "navOpenFileBtn",
        openBtnSecondaryId: "openFileHeroBtn",
        saveBtnId: "navSaveDataBtn",
        saveBtnSecondaryId: "exportCadenceBtn"
      });
    }

    // Reset data
    const resetBtn = document.getElementById("resetCadenceBtn");
    if (resetBtn) {
      resetBtn.addEventListener("click", function () {
        if (confirm("Reset all activities and dates back to a fresh starting clean slate? This cannot be undone.")) {
          localStorage.removeItem(STORAGE_KEY);
          refresh();
          showToast("✓ Reset to fresh clean slate");
        }
      });
    }
  }

  // Initialize
  loadActivities();
  bindEvents();
  render();
  syncGoalTasks().then(render);
})();
