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
 *   kind: "SAVE" (default: build a corpus by a date) | "COVER" (protection: get insured to a level).
 *   COVER goals use coverNeededINR, coverInPlaceINR, annualPremiumINR and are never funded from holdings.
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

  // Goal ideas shown in discovery. NO default costs or dates: those are the user's to know.
  // `ask` lists the questions that help someone find their own number; `formula` is the shape of the sum.
  const IDEA_GROUPS = [
    { id: "protect", label: "Stay protected" },
    { id: "life", label: "Life events" },
    { id: "freedom", label: "Freedom & growth" }
  ];

  const TEMPLATES = [
    {
      id: "term_life", kind: "COVER", group: "protect", category: "other", priority: "ESSENTIAL", icon: "👨‍👩‍👧", inflationCategory: "CPI",
      name: "Term life cover", blurb: "Money your family would need if your income stopped",
      keywords: ["term", "life", "insurance", "cover", "family protection", "income replacement", "death", "dependents", "life cover"],
      ask: ["Add up what your family would need: loans to clear, goals to fund (education, home), and years of living costs", "Subtract savings and cover you already have", "A rule of thumb is 10–15 times yearly income, a quick check on your own sum"],
      formula: "Loans + goals for the family + living costs for the years they need support − savings and existing cover",
      helper: "term",
      checklist: [
        "Work out the cover you need (loans + family goals + years of living costs − savings)",
        "Compare 3 term plans from insurers with a high claim-settlement ratio",
        "Disclose health, smoking and income details honestly on the form",
        "Name nominees and tell your family where the policy is kept"
      ]
    },
    {
      id: "health_cover", kind: "COVER", group: "protect", category: "other", priority: "ESSENTIAL", icon: "🏥", inflationCategory: "MEDICAL",
      name: "Health insurance", blurb: "Hospital bills should never touch your investments",
      keywords: ["health", "medical", "mediclaim", "hospital", "insurance", "floater", "top up", "super top-up", "critical illness"],
      ask: ["Who is covered: you, spouse, children, parents? Parents are often cheaper on a separate policy", "Ask a hospital in your city what a serious admission costs today, and pick a sum assured above that", "A base policy plus a super top-up gives a high cover for a lower premium", "Employer cover ends when you leave, so keep your own policy too"],
      formula: "A sum assured above what a serious hospital stay costs in your city, for each person covered",
      checklist: [
        "List who needs cover and each person's pre-existing conditions",
        "Check room-rent limits, co-pay, waiting periods and restoration benefit",
        "Add a super top-up if the base cover is below what a serious admission costs",
        "Keep your own policy even if your employer provides cover"
      ]
    },
    {
      id: "accident_disability", kind: "COVER", group: "protect", category: "other", priority: "IMPORTANT", icon: "🦺", inflationCategory: "CPI",
      name: "Accident & disability cover", blurb: "Income protection if you cannot work",
      keywords: ["accident", "disability", "personal accident", "pa cover", "income protection", "critical illness", "injury"],
      ask: ["How many years of income would you need to replace if you could not work?", "Multiply by your yearly income, then subtract any cover you already have"],
      formula: "Years of income to replace × yearly income − existing cover",
      checklist: [
        "Decide how many years of income you would need to replace",
        "Check what your employer's group cover already pays",
        "Compare personal accident and permanent-disability riders",
        "Review the sum assured whenever your income changes"
      ]
    },
    {
      id: "peace_buffer", group: "protect", category: "buffer", priority: "ESSENTIAL", icon: "🛡️", inflationCategory: "CPI",
      name: "Emergency fund", blurb: "Months of expenses you can reach in a day",
      keywords: ["emergency", "buffer", "rainy day", "job loss", "layoff", "safety", "peace"],
      ask: ["Add up one month of must-pay costs: rent/EMI, food, bills, school fees, insurance premiums", "Multiply by the months you want covered (6 is common; 9–12 if income is irregular)"],
      formula: "Monthly must-pay costs × months of cover",
      checklist: [
        "Add up one month of must-pay expenses (rent/EMI, food, bills, school fees)",
        "Open a separate sweep FD or liquid fund account for this buffer",
        "Set an auto-transfer on salary day until the buffer is full",
        "Check that term and health cover are in force before investing further"
      ]
    },
    {
      id: "loan_payoff", group: "protect", category: "other", priority: "IMPORTANT", icon: "🏦", inflationCategory: "CUSTOM", inflationRate: 0,
      name: "Pay off a loan early", blurb: "Clear a loan faster than the schedule",
      keywords: ["loan", "debt", "emi", "prepay", "mortgage", "credit card", "pay off", "payoff"],
      ask: ["Look up the outstanding principal on the loan statement", "Compare the loan's interest rate with what your savings earn after tax"],
      formula: "Outstanding principal you want to clear",
      checklist: [
        "Note the outstanding principal and interest rate from the latest statement",
        "Ask the lender about prepayment charges",
        "Prepay the highest-interest loan first",
        "Re-check the outstanding balance every quarter"
      ]
    },
    {
      id: "home_downpayment", group: "life", category: "realestate", priority: "ESSENTIAL", icon: "🏠", inflationCategory: "CPI",
      name: "Buy or upgrade a home", blurb: "Down payment, registration and move-in costs",
      keywords: ["home", "house", "flat", "apartment", "property", "down payment", "downpayment", "real estate", "plot"],
      ask: ["Pick the city and the carpet area you want, the helper below shows the price from NHB RESIDEX", "A down payment is usually 20–30% of the price; stamp duty and registration add about 6–8%"],
      formula: "Price × down payment % + stamp duty & registration",
      helper: "residex",
      checklist: [
        "Work out the target: 20–30% down payment plus 6–8% stamp duty and registration",
        "Stress-test the home loan EMI against your monthly surplus",
        "Check eligibility and credit score with 2–3 lenders",
        "Shift gains into safe debt about 18 months before purchase"
      ]
    },
    {
      id: "child_education", group: "life", category: "education", priority: "ESSENTIAL", icon: "🎓", inflationCategory: "EDUCATION",
      name: "Child's education", blurb: "College, a degree, or study abroad",
      keywords: ["college", "education", "school", "degree", "university", "study", "abroad", "child", "kid", "mba", "engineering", "medicine", "masters"],
      ask: ["Which course, and in which country?", "Look up this year's total fee for the full course, including hostel and living costs", "Add about 10% for travel, books and surprises"],
      formula: "Today's total course cost (fees + living) for all years",
      checklist: [
        "Estimate today's total cost of the target course (India vs abroad)",
        "Start a dedicated SIP, or earmark an existing fund, for this goal",
        "Add term and health cover for the earning parent",
        "Move to capital-protecting funds 3 years before the first fee payment"
      ]
    },
    {
      id: "wedding", group: "life", category: "wedding", priority: "IMPORTANT", icon: "💍", inflationCategory: "CPI",
      name: "Wedding", blurb: "Your own or a family member's",
      keywords: ["wedding", "marriage", "shaadi", "engagement", "daughter", "son", "sister", "brother"],
      ask: ["Number of guests × cost per guest (venue, food)", "Add jewellery, clothes, photography and travel", "Ask a recent family wedding for their actual spend"],
      formula: "Guests × cost per guest + jewellery, clothes, travel",
      checklist: [
        "List the big items: venue, catering, jewellery, clothes, photography, travel",
        "Get 2–3 real quotes for the largest items",
        "Decide what is flexible and what is not",
        "Book the date and move the money to debt funds 12 months before"
      ]
    },
    {
      id: "car_upgrade", group: "life", category: "vehicle", priority: "FLEXIBLE", icon: "🚗", inflationCategory: "CPI",
      name: "Buy a car", blurb: "New or used, cash or part-loan",
      keywords: ["car", "vehicle", "bike", "scooter", "suv", "ev", "electric"],
      ask: ["On-road price of the model you want (ex-showroom + registration + insurance)", "Add a first-year running budget"],
      formula: "On-road price − trade-in value",
      checklist: [
        "Decide the budget: on-road price + 1 year of running cost",
        "Compare a cash down payment against loan interest",
        "Keep the monthly EMI under 15% of take-home pay",
        "Move the money to debt funds 12 months before buying"
      ]
    },
    {
      id: "sabbatical", group: "life", category: "lifestyle", priority: "FLEXIBLE", icon: "🏖️", inflationCategory: "CPI",
      name: "Travel or a career break", blurb: "A big trip, a sabbatical, or time to retrain",
      keywords: ["travel", "trip", "holiday", "vacation", "sabbatical", "break", "world tour", "honeymoon", "gap year", "retrain"],
      ask: ["Months you will be away from income × monthly household costs", "Plus flights, stays and activities for the trip itself"],
      formula: "Months off × monthly costs + trip costs",
      checklist: [
        "Decide how long you will be away and when",
        "Price flights and stays for the main legs",
        "Keep a separate cash pot so your emergency fund stays untouched",
        "Review health cover for the period"
      ]
    },
    {
      id: "business", group: "freedom", category: "wealth", priority: "FLEXIBLE", icon: "🚀", inflationCategory: "CPI",
      name: "Start a business", blurb: "Seed money plus a runway to live on",
      keywords: ["business", "startup", "venture", "entrepreneur", "shop", "side hustle", "own company"],
      ask: ["Setup costs: equipment, licences, stock, deposits", "Plus 6–12 months of your own household costs while it grows"],
      formula: "Setup costs + months of runway × monthly household costs",
      checklist: [
        "List the one-time setup costs with real quotes",
        "Decide how many months of personal runway you need",
        "Keep this money separate from your emergency fund",
        "Set a clear go / no-go date"
      ]
    },
    {
      id: "work_optional_freedom", group: "freedom", category: "retirement", priority: "ESSENTIAL", icon: "🌴", inflationCategory: "CPI",
      name: "Retirement / work-optional", blurb: "A corpus that pays your expenses for life",
      keywords: ["retire", "retirement", "freedom", "fire", "pension", "financial independence", "work optional", "corpus"],
      ask: ["Yearly household expenses in today's money. Leave out costs that will end before you retire, such as home-loan EMIs and school fees", "Retirement usually needs 70–100% of that; healthcare often rises", "Plan to a long age (90 or more): running out of money is a bigger risk than leaving some behind"],
      formula: "Yearly need × years of retirement, adjusted for inflation and returns",
      helper: "retirement",
      checklist: [
        "Estimate yearly expenses in today's money (corpus ≈ 25–30× that)",
        "Maximise EPF/PPF/NPS contributions each financial year",
        "Raise your SIP by 10% every April",
        "Review the equity/debt split yearly and rebalance"
      ]
    },
    {
      id: "wealth_build", group: "freedom", category: "wealth", priority: "FLEXIBLE", icon: "📈", inflationCategory: "CPI",
      name: "Build long-term wealth", blurb: "A target with no single purchase behind it",
      keywords: ["wealth", "invest", "grow", "crore", "corpus", "net worth", "savings"],
      ask: ["Pick the amount, in today's money, that you would call 'comfortable'", "Pick the year you want to reach it"],
      formula: "The amount you choose",
      checklist: [
        "Write the target in today's money and the year",
        "Set an auto-SIP into a broad index fund",
        "Raise the SIP by 10% each year",
        "Review progress every 6 months"
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
    goal.kind = String(raw.kind || "").toUpperCase() === "COVER" ? "COVER" : "SAVE";
    if (goal.kind === "COVER") {
      const n = (v) => Math.max(0, Number(v) || 0);
      goal.coverNeededINR = n(raw.coverNeededINR);
      goal.coverInPlaceINR = n(raw.coverInPlaceINR);
      goal.annualPremiumINR = n(raw.annualPremiumINR);
      goal.targetYear = 0;
      goal.baseTargetINR = 0;
      goal.manualSavedINR = 0;
      goal.inflationCategory = "CPI";
      goal.inflationRate = null;
      goal.expectedReturn = null;
    }
    if (raw.secondaryTarget) goal.secondaryTarget = raw.secondaryTarget;
    if (raw.retirement && typeof raw.retirement === "object") {
      const r = raw.retirement;
      const num = (v) => (v === "" || v == null || isNaN(Number(v)) ? null : Number(v));
      goal.retirement = {
        birthYear: num(r.birthYear), retireAge: num(r.retireAge), lifeExpectancy: num(r.lifeExpectancy),
        yearlyExpensesToday: num(r.yearlyExpensesToday), pctNeeded: num(r.pctNeeded), postReturn: num(r.postReturn)
      };
    }
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
  function computeCover(goal) {
    const needed = Number(goal.coverNeededINR) || 0;
    const inPlace = Number(goal.coverInPlaceINR) || 0;
    const gap = Math.max(0, needed - inPlace);
    let health;
    if (goal.status === "ACHIEVED") health = "achieved";
    else if (needed <= 0) health = "needs_number";
    else if (gap === 0) health = "covered";
    else health = "cover_gap";
    return {
      kind: "COVER", hasAmount: needed > 0, coverNeeded: needed, coverInPlace: inPlace, coverGap: gap,
      coveredPct: needed > 0 ? Math.min(100, Math.round((inPlace / needed) * 100)) : 0,
      annualPremium: Number(goal.annualPremiumINR) || 0,
      health, sip: 0, gap: 0, years: 0, futureCost: 0, saved: 0, savedFV: 0, portfolioSaved: 0,
      fundedPct: needed > 0 ? Math.min(100, Math.round((inPlace / needed) * 100)) : 0,
      inflationRate: 0, expectedReturn: 0, horizon: horizonDefaults(99), glide: ""
    };
  }

  /** Summary of protection goals for the plan strip. */
  function protectionSummary(goals) {
    const covers = (goals || []).filter((g) => g.kind === "COVER" && g.status !== "ACHIEVED");
    const computed = covers.map(computeCover);
    return {
      total: covers.length,
      covered: computed.filter((c) => c.health === "covered").length,
      gaps: computed.filter((c) => c.health === "cover_gap").length,
      unpriced: computed.filter((c) => c.health === "needs_number").length,
      annualPremiums: computed.reduce((s, c) => s + c.annualPremium, 0)
    };
  }

  function computeGoal(goal, savedFromPortfolio, opts) {
    if (goal.kind === "COVER") return computeCover(goal);
    const o = opts || {};
    const baseYear = o.baseYear || currentYear();
    const years = Math.max(0, goal.targetYear - baseYear);
    const hasAmount = goal.baseTargetINR > 0;
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
    const fundedPct = futureCost > 0 ? Math.min(100, Math.round((savedFV / futureCost) * 100)) : 0;
    const todayPct = goal.baseTargetINR > 0 ? Math.min(100, Math.round((saved / goal.baseTargetINR) * 100)) : 100;

    let health;
    if (goal.status === "ACHIEVED") health = "achieved";
    else if (!hasAmount) health = "needs_number";
    else if (gap <= 0) health = "funded";
    else if (years === 0) health = "due";
    else health = "needs_sip";

    return {
      years, inflationRate: rate, futureCost, expectedReturn, portfolioSaved, saved, savedFV,
      hasAmount, gap, sip, fundedPct, todayPct, health, horizon, glide: glidePathNote(years)
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

  /** A goal seeded from an idea. Cost and date stay empty: they are the user's to fill in. */
  function goalFromIdea(idea) {
    const g = normalizeGoal({
      id: `goal_${idea.id}_${Date.now().toString(36)}`,
      name: idea.name,
      icon: idea.icon,
      category: idea.category,
      priority: idea.priority,
      baseTargetINR: 0,
      targetYear: 0,
      inflationCategory: idea.inflationCategory,
      inflationRate: idea.inflationRate != null ? idea.inflationRate : null,
      templateId: idea.id,
      kind: idea.kind || "SAVE"
    });
    g.targetYear = 0;
    return g;
  }

  /** Rank ideas for a typed query. Empty query returns all ideas in catalog order. */
  function searchIdeas(query) {
    const q = String(query || "").trim().toLowerCase();
    if (!q) return TEMPLATES.slice();
    const scored = [];
    TEMPLATES.forEach((t, i) => {
      let score = 0;
      const name = t.name.toLowerCase();
      if (name === q) score = 100;
      else if (name.startsWith(q)) score = 80;
      else if (name.split(/\W+/).some((w) => w.startsWith(q))) score = 60;
      t.keywords.forEach((k) => {
        if (k === q) score = Math.max(score, 90);
        else if (k.startsWith(q)) score = Math.max(score, 70);
        else if (q.length >= 3 && k.includes(q)) score = Math.max(score, 40);
      });
      if (score === 0 && q.length >= 3 && t.blurb.toLowerCase().includes(q)) score = 20;
      if (score > 0) scored.push({ t, score, i });
    });
    return scored.sort((a, b) => b.score - a.score || a.i - b.i).map((x) => x.t);
  }

  /**
   * Home price helper: NHB RESIDEX carpet-area rate × the user's carpet area, plus ~7% friction
   * (stamp duty and registration, as in the Real Estate calculator). Returns null if no data.
   */
  function residexEstimate(city, carpetSqft, downPaymentPct) {
    const data = global.KYF_RESIDEX && global.KYF_RESIDEX.cities;
    const c = data && data[city];
    const rate = c && c.summary && Number(c.summary.carpet_price_sqft);
    const sqft = Number(carpetSqft);
    if (!rate || !(sqft > 0)) return null;
    const price = Math.round(rate * sqft);
    const friction = Math.round(price * 0.07);
    const dp = Math.min(100, Math.max(0, Number(downPaymentPct) || 20));
    return {
      city, carpetSqft: sqft, ratePerSqft: rate, quarter: c.summary.latest_quarter || "",
      price, friction, downPaymentPct: dp,
      downPayment: Math.round(price * dp / 100) + friction,
      fullCost: price + friction
    };
  }

  /**
   * Retirement corpus, the way a CFP sizes it: withdrawals that rise with inflation, paid from a pot
   * earning `postReturn`, for every year between retirement and the age you plan to live to.
   * Because withdrawals and prices rise together, the corpus in TODAY'S money only depends on the
   * real return and the number of retirement years: corpusToday = yearlyNeed × annuity-due factor.
   * Returns null until the inputs are sensible. Every input is the user's; none are looked up.
   */
  function retirementPlan(input, inflationPct, baseYear) {
    const i = input || {};
    const age = Number(i.age);
    const retireAge = Number(i.retireAge);
    const lifeExpectancy = Number(i.lifeExpectancy);
    const expenses = Number(i.yearlyExpensesToday);
    const pct = i.pctNeeded === "" || i.pctNeeded == null ? 100 : Number(i.pctNeeded);
    const postReturn = i.postReturn === "" || i.postReturn == null ? 7 : Number(i.postReturn);
    if (!(age > 0) || !(retireAge > age) || !(lifeExpectancy > retireAge) || !(expenses > 0) || !(pct > 0)) return null;
    const infl = Number(inflationPct) || 0;
    const yearsToRetire = retireAge - age;
    const retirementYears = lifeExpectancy - retireAge;
    const need = expenses * pct / 100;
    const real = (1 + postReturn / 100) / (1 + infl / 100) - 1;
    const factor = Math.abs(real) < 1e-9
      ? retirementYears
      : ((1 - Math.pow(1 + real, -retirementYears)) / real) * (1 + real);
    const corpusToday = Math.round(need * factor);
    const yearlyAtRetirement = Math.round(need * Math.pow(1 + infl / 100, yearsToRetire));
    return {
      yearsToRetire, retirementYears, yearlyNeedToday: Math.round(need), yearlyAtRetirement,
      realReturnPct: Math.round(real * 10000) / 100,
      corpusToday,
      corpusAtRetirement: Math.round(corpusToday * Math.pow(1 + infl / 100, yearsToRetire)),
      multiple: Math.round((corpusToday / expenses) * 10) / 10,
      retireYear: (baseYear || currentYear()) + yearsToRetire
    };
  }

  /**
   * Term cover, two ways a CFP cross-checks it. Everything is the user's own figures, in today's money.
   * Needs-based ignores returns on the payout and inflation, which keeps the answer a little cautious.
   */
  function termCoverPlan(input) {
    const i = input || {};
    const n = (v) => Math.max(0, Number(v) || 0);
    const income = n(i.yearlyIncome);
    const loans = n(i.loans);
    const goalsToFund = n(i.goalsToFund);
    const living = n(i.yearlyFamilyExpenses) * n(i.yearsOfSupport);
    const offset = n(i.savings) + n(i.existingCover);
    if (!(income > 0) && !(loans + goalsToFund + living > 0)) return null;
    const gross = loans + goalsToFund + living;
    return {
      ruleLow: Math.round(income * 10),
      ruleHigh: Math.round(income * 15),
      loans, goalsToFund, living, offset, gross,
      needsBased: Math.max(0, Math.round(gross - offset))
    };
  }

  function residexCities() {
    const data = global.KYF_RESIDEX && global.KYF_RESIDEX.cities;
    return data ? Object.keys(data) : [];
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
    macroRates, inflationFor, horizonDefaults, computeGoal, computeCover, protectionSummary, affordability,
    writeFundingCache, readFundingCache,
    IDEA_GROUPS, templateById, goalFromIdea, searchIdeas, retirementPlan, termCoverPlan, residexEstimate, residexCities, checklistFor, withChecklist, withoutGoalTasks, taskProgress, migrateCadence
  };
})(typeof window !== "undefined" ? window : globalThis);
