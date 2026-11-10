/**
 * KYF Goals core (`js/kyf-goals.js` → window.KYF_GOALS)
 * ============================================================================
 * One goal model for the whole app (Goals page, Portfolio, Cadence, .kyf file).
 *
 * Unified goal record (.kyf v3, data.goals[]):
 *   id, name, icon, category, priority (ESSENTIAL|IMPORTANT|FLEXIBLE),
 *   status (ACTIVE|ACHIEVED), targetYear, baseTargetINR (cost in today's money),
 *   inflationCategory (CPI|EDUCATION|MEDICAL|CUSTOM) + inflationRate (CUSTOM only),
 *   expectedReturn (null = derive from horizon), manualSavedINR (money earmarked
 *   outside the Portfolio), ownerId (family member), notes, templateId,
 *   secondaryTarget (sqft / grams view, used by Portfolio), createdAt.
 *
 * "Saved so far" is NOT stored: it is derived from Portfolio allocations (cached
 * by the Portfolio page in localStorage `kyf_goal_funding_v1`) plus manualSavedINR.
 *
 * Pure helpers (no DOM) so they can be unit-tested in node.
 * ============================================================================
 */
(function (global) {
  "use strict";

  const FUNDING_CACHE_KEY = "kyf_goal_funding_v1";
  const LEGACY_PLANNER_KEY = "kyf_goals_v1";

  const CATEGORIES = {
    retirement: { label: "Retirement / Freedom", icon: "🌴" },
    education: { label: "Child Education", icon: "🎓" },
    realestate: { label: "Home / Real Estate", icon: "🏠" },
    buffer: { label: "Emergency Buffer", icon: "🛡️" },
    wedding: { label: "Family / Wedding", icon: "💍" },
    vehicle: { label: "Vehicle", icon: "🚗" },
    lifestyle: { label: "Travel & Sabbatical", icon: "🏖️" },
    wealth: { label: "Wealth Creation", icon: "📈" },
    other: { label: "Other", icon: "🎯" }
  };

  const PRIORITIES = {
    ESSENTIAL: "Essential / Non-negotiable",
    IMPORTANT: "Important",
    FLEXIBLE: "Flexible / Desirable"
  };

  const DEFAULT_MACRO = { cpiInflation: 5.4, educationInflation: 9.0, medicalInflation: 11.5 };

  // Starter goals + the action checklist generated for each (Cadence tasks carry goalId).
  const TEMPLATES = [
    {
      id: "peace_buffer", category: "buffer", priority: "ESSENTIAL", icon: "🛡️",
      name: "6-Month Peace-of-Mind Buffer", costToday: 450000, years: 1, inflationCategory: "CPI",
      checklist: [
        "Add up 6 months of must-pay expenses (rent/EMI, food, bills, school fees)",
        "Open a separate sweep FD or liquid fund account for this buffer",
        "Set an auto-transfer on salary day until the buffer is full",
        "Check that term and health cover are in force before investing further"
      ]
    },
    {
      id: "car_upgrade", category: "vehicle", priority: "FLEXIBLE", icon: "🚗",
      name: "Car / Lifestyle Milestone", costToday: 1500000, years: 4, inflationCategory: "CPI",
      checklist: [
        "Decide the budget: ex-showroom + insurance + 1 year of running cost",
        "Compare a cash down payment against loan interest",
        "Keep the monthly EMI under 15% of take-home pay",
        "Move the money to debt funds 12 months before buying"
      ]
    },
    {
      id: "home_downpayment", category: "realestate", priority: "ESSENTIAL", icon: "🏠",
      name: "Home Down Payment / Prepayment", costToday: 2500000, years: 5, inflationCategory: "CPI",
      checklist: [
        "Work out the target: 20–30% down payment plus 6–8% stamp duty and registration",
        "Stress-test the home loan EMI against your monthly surplus",
        "Check eligibility and credit score with 2–3 lenders",
        "Shift gains into safe debt about 18 months before purchase"
      ]
    },
    {
      id: "child_education", category: "education", priority: "ESSENTIAL", icon: "🎓",
      name: "Child's Higher Education", costToday: 3000000, years: 12, inflationCategory: "EDUCATION",
      checklist: [
        "Estimate today's cost of the target course (India vs abroad)",
        "Start a dedicated SIP in the child's name or earmarked to this goal",
        "Add child-specific term and health cover for the earning parent",
        "Move to capital-protecting funds 3 years before the first fee payment"
      ]
    },
    {
      id: "work_optional_freedom", category: "retirement", priority: "ESSENTIAL", icon: "🌴",
      name: "Work-Optional Freedom (FI Corpus)", costToday: 30000000, years: 18, inflationCategory: "CPI",
      checklist: [
        "Estimate yearly expenses in today's money (corpus ≈ 25–30× that)",
        "Maximise EPF/PPF/NPS contributions each financial year",
        "Raise your SIP by 10% every April",
        "Review the equity/debt split yearly and rebalance"
      ]
    }
  ];

  const GENERIC_CHECKLIST = [
    "Confirm the cost in today's money",
    "Pick the vehicle that matches the horizon (debt under 3 years, hybrid 3–7, equity 7+)",
    "Set up an auto-SIP for this goal",
    "Review progress every 6 months"
  ];

  // ---------------------------------------------------------------------------
  // Normalisation & migration
  // ---------------------------------------------------------------------------
  function currentYear() {
    return new Date().getFullYear();
  }

  function inferCategory(g) {
    if (g && CATEGORIES[g.category]) return g.category;
    const text = `${g && (g.name || g.title) || ""} ${g && g.id || ""}`.toLowerCase();
    if (/retire|freedom|fi corpus/.test(text)) return "retirement";
    if (/educat|college|school|degree/.test(text)) return "education";
    if (/home|house|flat|apartment|property|real/.test(text)) return "realestate";
    if (/emergency|buffer|peace/.test(text)) return "buffer";
    if (/wedding|marriage/.test(text)) return "wedding";
    if (/car|vehicle|bike/.test(text)) return "vehicle";
    if (/travel|sabbatical|vacation|holiday/.test(text)) return "lifestyle";
    return "other";
  }

  function upperEnum(value, allowed, fallback) {
    const v = String(value || "").toUpperCase();
    return allowed.includes(v) ? v : fallback;
  }

  /**
   * Accepts a goal in ANY historic shape (planner v1, portfolio envelope, unified v3)
   * and returns a unified v3 goal. Idempotent.
   */
  function normalizeGoal(raw, baseYear) {
    if (!raw || typeof raw !== "object") return null;
    const year = baseYear || currentYear();
    const isPlanner = raw.presentValue !== undefined || raw.years !== undefined || raw.title !== undefined;

    let priority = String(raw.priority || "").toUpperCase();
    let status = String(raw.status || "").toUpperCase();
    if (priority === "COMPLETED") { status = "ACHIEVED"; priority = "ESSENTIAL"; }
    if (priority === "ASPIRATIONAL" || priority === "LOW") priority = "FLEXIBLE";
    if (priority === "HIGH") priority = "ESSENTIAL";
    if (priority === "MEDIUM") priority = "IMPORTANT";
    if (status === "IN_PROGRESS" || status === "ON_TRACK") status = "ACTIVE";

    let inflationCategory = String(raw.inflationCategory || "").toUpperCase();
    let inflationRate = raw.inflationRate != null ? Number(raw.inflationRate) : null;
    if (isPlanner && !raw.inflationCategory) {
      inflationCategory = raw.category === "education" ? "EDUCATION" : "CUSTOM";
    }
    if (inflationCategory === "HEALTHCARE") inflationCategory = "MEDICAL";
    if (!["CPI", "EDUCATION", "MEDICAL", "CUSTOM"].includes(inflationCategory)) inflationCategory = "CPI";
    if (inflationCategory !== "CUSTOM") inflationRate = null;
    if (inflationCategory === "CUSTOM" && (inflationRate == null || isNaN(inflationRate))) inflationRate = 6;

    const targetYear = raw.targetYear != null
      ? Number(raw.targetYear)
      : (raw.years != null ? year + Number(raw.years) : year + 5);

    const goal = {
      id: raw.id || `goal_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
      name: String(raw.name || raw.title || "Untitled goal"),
      icon: raw.icon || (CATEGORIES[inferCategory(raw)] || CATEGORIES.other).icon,
      category: inferCategory(raw),
      priority: upperEnum(priority, Object.keys(PRIORITIES), "IMPORTANT"),
      status: upperEnum(status, ["ACTIVE", "ACHIEVED"], "ACTIVE"),
      targetYear,
      baseTargetINR: Math.max(0, Number(raw.baseTargetINR != null ? raw.baseTargetINR : raw.presentValue) || 0),
      inflationCategory,
      inflationRate,
      expectedReturn: raw.expectedReturn != null && raw.expectedReturn !== "" ? Number(raw.expectedReturn) : null,
      manualSavedINR: Math.max(0, Number(raw.manualSavedINR != null ? raw.manualSavedINR : raw.currentSavings) || 0),
      ownerId: raw.ownerId || "",
      notes: String(raw.notes != null ? raw.notes : (raw.description || "")),
      templateId: raw.templateId || "",
      createdAt: raw.createdAt || new Date().toISOString()
    };
    if (raw.secondaryTarget) goal.secondaryTarget = raw.secondaryTarget;
    return goal;
  }

  function mergeGoalLists(...lists) {
    const byId = new Map();
    for (const list of lists) {
      for (const g of (Array.isArray(list) ? list : [])) {
        const n = normalizeGoal(g);
        if (n) byId.set(n.id, n);
      }
    }
    return [...byId.values()];
  }

  // ---------------------------------------------------------------------------
  // Maths
  // ---------------------------------------------------------------------------
  function macroRates() {
    const pulse = global.KYF_MARKET_PULSE;
    return Object.assign({}, DEFAULT_MACRO, pulse && pulse.macro ? pulse.macro : {});
  }

  function inflationFor(goal, rates) {
    const r = rates || macroRates();
    if (goal.inflationCategory === "CUSTOM") return Number(goal.inflationRate) || 0;
    if (goal.inflationCategory === "EDUCATION") return Number(r.educationInflation) || DEFAULT_MACRO.educationInflation;
    if (goal.inflationCategory === "MEDICAL") return Number(r.medicalInflation) || DEFAULT_MACRO.medicalInflation;
    return Number(r.cpiInflation) || DEFAULT_MACRO.cpiInflation;
  }

  function horizonDefaults(years) {
    if (years <= 3) {
      return { key: "short", label: "Short horizon", expectedReturn: 6.5, recipe: "100% Debt & Arbitrage", desc: "Protect capital, stay liquid" };
    }
    if (years <= 7) {
      return { key: "medium", label: "Medium horizon", expectedReturn: 9, recipe: "40% Equity · 50% Debt · 10% Gold", desc: "Balanced hybrid mix" };
    }
    return { key: "long", label: "Long horizon", expectedReturn: 11.5, recipe: "70% Equity · 20% Debt · 10% Gold", desc: "Equity-led compounding" };
  }

  function glidePathNote(years) {
    if (years > 3) return `Start moving to debt in ${years - 3} yrs`;
    if (years > 0) return "Keep this in debt/liquid now";
    return "Due now — hold in cash/liquid";
  }

  /** Compute everything the UI needs about one goal. */
  function computeGoal(goal, savedFromPortfolio, opts) {
    const o = opts || {};
    const baseYear = o.baseYear || currentYear();
    const years = Math.max(0, goal.targetYear - baseYear);
    const rate = inflationFor(goal, o.rates);
    const futureCost = Math.round(goal.baseTargetINR * Math.pow(1 + rate / 100, years));
    const horizon = horizonDefaults(years);
    const expectedReturn = goal.expectedReturn != null ? goal.expectedReturn : horizon.expectedReturn;
    const portfolioSaved = Math.max(0, Number(savedFromPortfolio) || 0);
    const saved = portfolioSaved + (Number(goal.manualSavedINR) || 0);
    const savedFV = Math.round(saved * Math.pow(1 + expectedReturn / 100, years));
    const gap = Math.max(0, futureCost - savedFV);
    const months = years * 12;
    let sip = 0;
    if (gap > 0 && months > 0) {
      const rm = expectedReturn / 100 / 12;
      sip = rm > 0
        ? Math.round(gap / (((Math.pow(1 + rm, months) - 1) / rm) * (1 + rm)))
        : Math.round(gap / months);
    } else if (gap > 0) {
      sip = gap; // due now: the whole gap is a lump sum
    }
    const fundedPct = futureCost > 0 ? Math.min(100, Math.round((savedFV / futureCost) * 100)) : 100;
    const todayPct = goal.baseTargetINR > 0 ? Math.min(100, Math.round((saved / goal.baseTargetINR) * 100)) : 100;

    let health;
    if (goal.status === "ACHIEVED") health = "achieved";
    else if (gap <= 0) health = "funded";
    else if (years === 0) health = "due";
    else health = "needs_sip";

    return {
      years, inflationRate: rate, futureCost, expectedReturn, portfolioSaved, saved, savedFV,
      gap, sip, fundedPct, todayPct, health, horizon, glide: glidePathNote(years)
    };
  }

  /** Sum of monthly SIPs for open goals vs the user's declared surplus. */
  function affordability(computedList, monthlySurplusINR) {
    const totalSip = computedList.reduce((s, c) => s + (c.sip || 0), 0);
    const surplus = Number(monthlySurplusINR) || 0;
    if (!surplus) return { totalSip, surplus: 0, status: "unknown", coveragePct: null };
    const coveragePct = totalSip > 0 ? Math.min(100, Math.round((surplus / totalSip) * 100)) : 100;
    return { totalSip, surplus, status: totalSip <= surplus ? "ok" : "stretched", coveragePct };
  }

  // ---------------------------------------------------------------------------
  // Portfolio funding cache (written by Portfolio, read by Goals)
  // ---------------------------------------------------------------------------
  function writeFundingCache(byGoal) {
    try {
      localStorage.setItem(FUNDING_CACHE_KEY, JSON.stringify({ asOf: new Date().toISOString(), byGoal: byGoal || {} }));
    } catch (e) { /* storage unavailable */ }
  }

  function readFundingCache() {
    try {
      const raw = JSON.parse(localStorage.getItem(FUNDING_CACHE_KEY) || "null");
      if (raw && raw.byGoal) return raw;
    } catch (e) { /* ignore */ }
    return { asOf: null, byGoal: {} };
  }

  // ---------------------------------------------------------------------------
  // Template helpers
  // ---------------------------------------------------------------------------
  function templateById(id) {
    return TEMPLATES.find((t) => t.id === id) || null;
  }

  function goalFromTemplate(template, baseYear) {
    const year = baseYear || currentYear();
    return normalizeGoal({
      id: `goal_${template.id}_${Date.now().toString(36)}`,
      name: template.name,
      icon: template.icon,
      category: template.category,
      priority: template.priority,
      baseTargetINR: template.costToday,
      targetYear: year + template.years,
      inflationCategory: template.inflationCategory,
      templateId: template.id
    }, year);
  }

  /** Checklist items (Cadence activities) for a goal. Stable ids so it never duplicates. */
  function checklistFor(goal) {
    const tpl = templateById(goal.templateId);
    const lines = tpl ? tpl.checklist : GENERIC_CHECKLIST;
    return lines.map((text, i) => ({
      id: `task_${goal.id}_${i + 1}`,
      section: "goals",
      goalId: goal.id,
      category: "Goal task",
      frequency: "One-time",
      icon: goal.icon || "🎯",
      title: text,
      description: "",
      status: "active",
      dueDate: "",
      tags: [(CATEGORIES[goal.category] || CATEGORIES.other).label]
    }));
  }

  /** Add the goal's checklist to a cadence list (no duplicates). Returns the new list. */
  function withChecklist(cadence, goal) {
    const list = Array.isArray(cadence) ? cadence.slice() : [];
    const have = new Set(list.map((a) => a.id));
    for (const t of checklistFor(goal)) if (!have.has(t.id)) list.push(t);
    return list;
  }

  function withoutGoalTasks(cadence, goalId) {
    return (Array.isArray(cadence) ? cadence : []).filter((a) => a.goalId !== goalId);
  }

  function taskProgress(cadence, goalId) {
    const tasks = (Array.isArray(cadence) ? cadence : []).filter((a) => a.goalId === goalId);
    const done = tasks.filter((a) => a.status === "done").length;
    return { total: tasks.length, done };
  }

  // Default Cadence milestone ids from the pre-v3 app. Untouched ones are dropped on migration
  // because Goals now owns milestones; edited ones stay as unlinked cards.
  const LEGACY_MILESTONE_IDS = [
    "goal-home", "goal-car", "goal-wedding", "goal-child", "goal-college",
    "goal-emergency-fund", "goal-retirement", "goal-sabbatical", "goal-venture", "goal-debt-freedom"
  ];

  function migrateCadence(cadence) {
    if (!Array.isArray(cadence)) return [];
    return cadence.filter((a) => !(LEGACY_MILESTONE_IDS.includes(a.id) && !a.goalId && (a.status || "active") === "active"));
  }

  global.KYF_GOALS = {
    CATEGORIES, PRIORITIES, TEMPLATES, FUNDING_CACHE_KEY, LEGACY_PLANNER_KEY, LEGACY_MILESTONE_IDS,
    normalizeGoal, mergeGoalLists, inferCategory,
    macroRates, inflationFor, horizonDefaults, computeGoal, affordability,
    writeFundingCache, readFundingCache,
    templateById, goalFromTemplate, checklistFor, withChecklist, withoutGoalTasks, taskProgress, migrateCadence
  };
})(typeof window !== "undefined" ? window : globalThis);
