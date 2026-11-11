/**
 * KYF Family Portfolio Tracker — Data & Vault Lifecycle (`js/portfolio-data.js`)
 * Version: v1.9.1
 * Unified with KYF App-Level .kyf Vault Format (cadence + portfolio + goals)
 */

window.KYF_PORTFOLIO_DATA = (() => {
  const DB_NAME = "KYF_PORTFOLIO_DB";
  const DB_VERSION = 3;
  const STORE_HOLDINGS = "holdings";
  const STORE_GOALS = "goals";
  const STORE_MEMBERS = "members";
  const STORE_META = "session_meta";
  const CADENCE_STORAGE_KEY = "kyf_cadence_v3";

  // ==========================================================================
  // Canonical Demo Goals (Indian Family Financial Life Milestones)
  // ==========================================================================
  const DEMO_GOALS = [
    {
      id: "goal_home",
      name: "Buy Family Home",
      icon: "🏠",
      targetYear: 2026,
      baseTargetINR: 15000000, // ₹1.50 Cr base
      inflationCategory: "CPI",
      priority: "COMPLETED",
      notes: "Primary family residence in Bengaluru (1,450 sq.ft)",
      secondaryTarget: {
        enabled: true,
        unitType: "SQFT_REALESTATE",
        city: "Bengaluru",
        targetUnits: 1450
      }
    },
    {
      id: "goal_wedding",
      name: "Daughter's Wedding",
      icon: "💍",
      targetYear: 2032,
      baseTargetINR: 3500000, // ₹35 Lakh base in present value
      inflationCategory: "CPI",
      priority: "HIGH",
      notes: "Wedding ceremony, jewellery & celebrations (CPI 5.4% compounded)",
      secondaryTarget: {
        enabled: true,
        unitType: "GRAMS_GOLD",
        purity: "22K",
        targetUnits: 500
      }
    },
    {
      id: "goal_education",
      name: "Child Overseas Education",
      icon: "🎓",
      targetYear: 2030,
      baseTargetINR: 4000000, // ₹40 Lakh base
      inflationCategory: "EDUCATION", // Education inflation 9.0%
      priority: "HIGH",
      notes: "Master's degree tuition & living expenses (compounded @ 9.0% p.a.)"
    },
    {
      id: "goal_retirement",
      name: "Financial Independence / Retirement",
      icon: "🌴",
      targetYear: 2038,
      baseTargetINR: 35000000, // ₹3.50 Cr base
      inflationCategory: "CPI",
      priority: "HIGH",
      notes: "Post-work inflation-indexed corpus for Rajesh & Priya (compounded @ 5.4% p.a.)"
    },
    {
      id: "goal_emergency",
      name: "Emergency Reserve (12 Months)",
      icon: "🛡️",
      targetYear: 2027,
      baseTargetINR: 1500000, // ₹15 Lakh liquid reserve
      inflationCategory: "CPI",
      priority: "CRITICAL",
      notes: "12 months of family living expenses in ultra-safe liquid debt & gold"
    }
  ];

  // ==========================================================================
  // Canonical Demo Family Members (Individual Names)
  // Individual members only — combinations are handled via multi-select chips!
  // ==========================================================================
  const DEMO_MEMBERS = [
    { id: "mem_rajesh", name: "Rajesh", role: "Self", avatar: "👨" },
    { id: "mem_priya", name: "Priya", role: "Spouse", avatar: "👩" },
    { id: "mem_ramesh", name: "Ramesh", role: "Father", avatar: "👴" },
    { id: "mem_sunita", name: "Sunita", role: "Mother", avatar: "👵" }
  ];

  // ==========================================================================
  // Realistic Indian Family Demo Dataset (Sharma Family)
  // Multi-lot goal allocations simulate mental accounting envelopes
  // ==========================================================================
  const DEMO_FAMILY_HOLDINGS = [
    {
      id: "hold_eq_sbin",
      name: "State Bank of India",
      member: "Rajesh",
      custodian: "Zerodha",
      assetClass: "Equities",
      subCategory: "Large Cap Banking",
      pricingMode: "LIVE_EQUITY",
      instrumentMeta: {
        symbol: "SBIN",
        quantity: 500,
        avgBuyPrice: 640.00
      },
      investedValue: 320000,
      manualCurrentValue: null,
      allocations: [
        { goalId: "goal_retirement", percentage: 70 },
        { goalId: "goal_education", percentage: 30 }
      ],
      notes: "Core PSU banking allocation"
    },
    {
      id: "hold_eq_lt",
      name: "Larsen & Toubro Ltd",
      member: "Rajesh",
      custodian: "Zerodha",
      assetClass: "Equities",
      subCategory: "Capital Goods & Infra",
      pricingMode: "LIVE_EQUITY",
      instrumentMeta: {
        symbol: "LT",
        quantity: 120,
        avgBuyPrice: 3150.00
      },
      investedValue: 378000,
      manualCurrentValue: null,
      allocations: [
        { goalId: "goal_retirement", percentage: 60 },
        { goalId: "goal_education", percentage: 40 }
      ],
      notes: "Infra capex leader"
    },
    {
      id: "hold_eq_titan",
      name: "Titan Company Ltd",
      member: "Priya",
      custodian: "Zerodha",
      assetClass: "Equities",
      subCategory: "Consumer Discretionary",
      pricingMode: "LIVE_EQUITY",
      instrumentMeta: {
        symbol: "TITAN",
        quantity: 100,
        avgBuyPrice: 3200.00
      },
      investedValue: 320000,
      manualCurrentValue: null,
      allocations: [
        { goalId: "goal_wedding", percentage: 50 },
        { goalId: "goal_retirement", percentage: 50 }
      ],
      notes: "Tanishq jewellery & watches consumption play"
    },
    {
      id: "hold_mf_ppfc",
      name: "Parag Parikh Flexi Cap Fund",
      member: "Rajesh",
      custodian: "CAMS",
      assetClass: "Mutual Funds",
      subCategory: "Flexi Cap Equity",
      pricingMode: "LIVE_MF",
      instrumentMeta: {
        amfiCode: 122639,
        planType: "DIRECT",
        units: 3500.25,
        avgBuyNav: 58.20
      },
      investedValue: 203715,
      manualCurrentValue: null,
      allocations: [
        { goalId: "goal_education", percentage: 60 },
        { goalId: "goal_retirement", percentage: 40 }
      ],
      notes: "Monthly SIP core fund (Direct Plan)"
    },
    {
      id: "hold_mf_axis_elss",
      name: "Axis ELSS Tax Saver Fund",
      member: "Priya",
      custodian: "CAMS",
      assetClass: "Mutual Funds",
      subCategory: "ELSS Tax Saver",
      pricingMode: "LIVE_MF",
      instrumentMeta: {
        amfiCode: 120503,
        planType: "REGULAR", // Regular plan for commission drag alert
        units: 2200.00,
        avgBuyNav: 68.18
      },
      investedValue: 150000,
      manualCurrentValue: null,
      allocations: [
        { goalId: "goal_retirement", percentage: 100 }
      ],
      notes: "Old 80C tax deduction investment (Regular Plan commission drag)"
    },
    {
      id: "hold_gold_24k_bar",
      name: "24K Bullion Gold Bar",
      member: "Ramesh",
      custodian: "Physical Locker",
      assetClass: "Commodities & Gold",
      subCategory: "Physical Gold (24K)",
      pricingMode: "LIVE_GOLD",
      instrumentMeta: {
        purity: "24K",
        grams: 100.0
      },
      investedValue: 720000,
      manualCurrentValue: null,
      allocations: [
        { goalId: "goal_wedding", percentage: 70 },
        { goalId: "goal_emergency", percentage: 30 }
      ],
      notes: "999 purity certified bullion minted bars"
    },
    {
      id: "hold_gold_22k_jewel",
      name: "22K Traditional Jewellery",
      member: "Sunita",
      custodian: "Physical Locker",
      assetClass: "Commodities & Gold",
      subCategory: "Physical Gold (22K)",
      pricingMode: "LIVE_GOLD",
      instrumentMeta: {
        purity: "22K",
        grams: 150.0
      },
      investedValue: 950000,
      manualCurrentValue: null,
      allocations: [
        { goalId: "goal_wedding", percentage: 100 }
      ],
      notes: "Hallmarked heirloom wedding jewellery"
    },
    {
      id: "hold_gold_etf_goldbees",
      name: "Nippon India ETF Gold BeES",
      member: "Rajesh",
      custodian: "Zerodha",
      assetClass: "Commodities & Gold",
      subCategory: "Gold ETF",
      pricingMode: "LIVE_GOLD",
      instrumentMeta: {
        symbol: "GOLDBEES",
        units: 1470.0 // 1,470 / 122.5 = 12.0g 24K equivalent
      },
      investedValue: 125000,
      manualCurrentValue: null,
      allocations: [
        { goalId: "goal_wedding", percentage: 50 }
        // Remaining 50% routes into "Unallocated / General Wealth"
      ],
      notes: "Paper gold for digital liquidity and rebalancing"
    },
    {
      id: "hold_debt_sbi_fd",
      name: "State Bank of India 1-Year FD",
      member: "Ramesh",
      custodian: "SBI Bank",
      assetClass: "Fixed Income",
      subCategory: "Bank Fixed Deposit",
      pricingMode: "MACRO_LINKED",
      instrumentMeta: {
        interestRate: 6.8,
        maturityDate: "2027-05-15"
      },
      investedValue: 1000000,
      manualCurrentValue: 1042500,
      allocations: [
        { goalId: "goal_emergency", percentage: 60 },
        { goalId: "goal_wedding", percentage: 40 }
      ],
      notes: "Senior citizen quarterly compounding deposit"
    },
    {
      id: "hold_debt_epf",
      name: "Employees' Provident Fund (EPF)",
      member: "Rajesh",
      custodian: "EPFO",
      assetClass: "Fixed Income",
      subCategory: "Retirement Sovereign Debt",
      pricingMode: "MACRO_LINKED",
      instrumentMeta: {
        interestRate: 8.25
      },
      investedValue: 1450000,
      manualCurrentValue: 1680000,
      allocations: [
        { goalId: "goal_retirement", percentage: 100 }
      ],
      notes: "Monthly statutory contribution with sovereign guarantee"
    },
    {
      id: "hold_re_bengaluru",
      name: "3BHK Apartment (Whitefield)",
      member: "Rajesh",
      custodian: "Property Deed",
      assetClass: "Real Estate",
      subCategory: "Residential Property",
      pricingMode: "LIVE_RESIDEX",
      instrumentMeta: {
        city: "Bengaluru",
        sizeTier: "large_gt_1184_sqft",
        carpetSqft: 1450.0
      },
      investedValue: 12500000,
      manualCurrentValue: null,
      allocations: [
        { goalId: "goal_home", percentage: 100 }
      ],
      notes: "Primary family residence, benchmarked against NHB RESIDEX Bengaluru"
    },
    {
      id: "hold_loan_home",
      name: "Home Loan (HDFC)",
      member: "Rajesh",
      custodian: "HDFC Bank",
      assetClass: "Liabilities",
      isLiability: true,
      subCategory: "Home Loan",
      pricingMode: "MANUAL",
      instrumentMeta: {
        interestRate: 8.65
      },
      investedValue: null,
      manualCurrentValue: 3500000,
      allocations: [],
      notes: "Outstanding principal on the Whitefield apartment loan"
    }
  ];

  // ==========================================================================
  // IndexedDB Storage Layer (Holdings + Goals + Meta)
  // ==========================================================================
  function openDatabase() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(STORE_HOLDINGS)) {
          db.createObjectStore(STORE_HOLDINGS, { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains(STORE_GOALS)) {
          db.createObjectStore(STORE_GOALS, { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains(STORE_MEMBERS)) {
          db.createObjectStore(STORE_MEMBERS, { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains(STORE_META)) {
          db.createObjectStore(STORE_META, { keyPath: "key" });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async function loadHoldingsFromDB() {
    try {
      const db = await openDatabase();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_HOLDINGS, "readonly");
        const store = tx.objectStore(STORE_HOLDINGS);
        const req = store.getAll();

        req.onsuccess = () => {
          resolve(req.result || []);
        };
        req.onerror = () => reject(req.error);
      });
    } catch (err) {
      console.warn("[KYF Portfolio] Error reading holdings from IndexedDB:", err);
      return [];
    }
  }

  async function saveHoldingsToDB(holdings) {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_HOLDINGS, STORE_META], "readwrite");
      const store = tx.objectStore(STORE_HOLDINGS);
      const metaStore = tx.objectStore(STORE_META);

      store.clear();
      for (const item of holdings) {
        store.put(item);
      }

      metaStore.put({
        key: "last_updated",
        value: new Date().toISOString()
      });

      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    });
  }

  async function loadGoalsFromDB() {
    try {
      const db = await openDatabase();
      if (!db.objectStoreNames.contains(STORE_GOALS)) return [];
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_GOALS, "readonly");
        const store = tx.objectStore(STORE_GOALS);
        const req = store.getAll();

        req.onsuccess = () => resolve(window.KYF_GOALS ? window.KYF_GOALS.mergeGoalLists(req.result || []) : (req.result || []));
        req.onerror = () => reject(req.error);
      });
    } catch (err) {
      console.warn("[KYF Portfolio] Error reading goals from IndexedDB:", err);
      return [];
    }
  }

  async function saveGoalsToDB(goals) {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_GOALS, STORE_META], "readwrite");
      const store = tx.objectStore(STORE_GOALS);
      const metaStore = tx.objectStore(STORE_META);

      store.clear();
      for (const g of goals) {
        store.put(g);
      }

      metaStore.put({
        key: "goals_last_updated",
        value: new Date().toISOString()
      });

      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    });
  }

  async function loadMembersFromDB() {
    try {
      const db = await openDatabase();
      if (!db.objectStoreNames.contains(STORE_MEMBERS)) return [];
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_MEMBERS, "readonly");
        const store = tx.objectStore(STORE_MEMBERS);
        const req = store.getAll();

        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
      });
    } catch (err) {
      console.warn("[KYF Portfolio] Error reading members from IndexedDB:", err);
      return [];
    }
  }

  async function saveMembersToDB(members) {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_MEMBERS, STORE_META], "readwrite");
      const store = tx.objectStore(STORE_MEMBERS);
      const metaStore = tx.objectStore(STORE_META);

      store.clear();
      for (const m of members) {
        store.put(m);
      }

      metaStore.put({
        key: "members_last_updated",
        value: new Date().toISOString()
      });

      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    });
  }

  async function clearDatabase() {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const stores = [STORE_HOLDINGS, STORE_META];
      if (db.objectStoreNames.contains(STORE_GOALS)) {
        stores.push(STORE_GOALS);
      }
      if (db.objectStoreNames.contains(STORE_MEMBERS)) {
        stores.push(STORE_MEMBERS);
      }
      const tx = db.transaction(stores, "readwrite");
      for (const s of stores) {
        tx.objectStore(s).clear();
      }

      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    });
  }

  // ==========================================================================
  // App-Level Unified .kyf Vault Import / Export (Cadence + Portfolio + Goals + Members)
  // Routed through shared js/kyf-vault.js
  // ==========================================================================
  function exportAppData(holdings, goals, members) {
    if (window.KYF_VAULT) {
      return window.KYF_VAULT.save({
        portfolio: holdings,
        goals: goals,
        members: members
      });
    }

    let cadenceData = null;
    try {
      const rawCadence = localStorage.getItem(CADENCE_STORAGE_KEY);
      if (rawCadence) cadenceData = JSON.parse(rawCadence);
    } catch {}

    const payload = {
      app: "Know Your Finance",
      version: "2.0.0",
      fileType: "kyf-vault",
      encrypted: false,
      savedAt: new Date().toISOString(),
      data: {
        cadence: cadenceData || [],
        portfolio: holdings,
        goals: goals || [],
        members: members || []
      }
    };
    const jsonStr = JSON.stringify(payload, null, 2);
    const blob = new Blob([jsonStr], { type: "application/octet-stream" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const dateStr = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `my-kyf-data-${dateStr}.kyf`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 200);
    return a.download;
  }

  function parseAndExtractKyfData(text) {
    if (window.KYF_VAULT && typeof window.KYF_VAULT.parseAndExtractKyfData === "function") {
      return window.KYF_VAULT.parseAndExtractKyfData(text);
    }

    const parsed = typeof text === "string" ? JSON.parse(text) : text;
    let importedHoldings = null;
    let importedGoals = null;
    let importedCadence = null;
    let importedMembers = null;

    if (parsed && parsed.data) {
      if (Array.isArray(parsed.data.portfolio)) importedHoldings = parsed.data.portfolio;
      else if (Array.isArray(parsed.data.holdings)) importedHoldings = parsed.data.holdings;

      if (Array.isArray(parsed.data.portfolioGoals)) importedGoals = parsed.data.portfolioGoals;
      else if (Array.isArray(parsed.data.goals)) importedGoals = parsed.data.goals;

      if (Array.isArray(parsed.data.members)) importedMembers = parsed.data.members;

      if (Array.isArray(parsed.data.cadence)) importedCadence = parsed.data.cadence;
    } else if (parsed && Array.isArray(parsed.holdings)) {
      importedHoldings = parsed.holdings;
      if (Array.isArray(parsed.goals)) importedGoals = parsed.goals;
      if (Array.isArray(parsed.members)) importedMembers = parsed.members;
    } else if (Array.isArray(parsed)) {
      importedHoldings = parsed;
    }

    if (importedCadence && importedCadence.length) {
      try {
        localStorage.setItem(CADENCE_STORAGE_KEY, JSON.stringify(importedCadence));
      } catch {}
    }

    return {
      holdings: importedHoldings || [],
      goals: importedGoals || null,
      members: importedMembers || null,
      hasCadence: !!(importedCadence && importedCadence.length)
    };
  }

  return {
    getDemoFamilyHoldings: () => JSON.parse(JSON.stringify(DEMO_FAMILY_HOLDINGS)),
    getDemoGoals: () => (window.KYF_GOALS ? window.KYF_GOALS.mergeGoalLists(DEMO_GOALS) : JSON.parse(JSON.stringify(DEMO_GOALS))),
    getDemoMembers: () => JSON.parse(JSON.stringify(DEMO_MEMBERS)),
    loadHoldingsFromDB,
    saveHoldingsToDB,
    loadGoalsFromDB,
    saveGoalsToDB,
    loadMembersFromDB,
    saveMembersToDB,
    clearDatabase,
    exportAppData,
    parseAndExtractKyfData
  };
})();

