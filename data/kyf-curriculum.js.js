/**
 * Know Your Finance (KYF) — Module 1: Curriculum Spine, Discovery Strips,
 * Asset Container Cards, Goal Templates & Chapter 1 Reflex Diagnostic
 */
window.KYF_CURRICULUM = {
  meta: {
    version: "1.0.0",
    appName: "Know Your Finance",
    tagline: "Build Money Power at Your Own Pace",
    privacyContract: {
      headline: "🎓 Educational Simulator (Not Financial Advice) • 🔒 Private Pocket-Calculator Mode",
      summary: "We have no user database and use zero tracking cookies. Your numbers stay strictly inside your device's sealed vault—invisible to us and other websites.",
      bullets: [
        {
          title: "1. Like a Calculator on Your Desk, Not the Cloud",
          body: "When you move a slider or type an amount, the math happens strictly on your device. Nothing is ever uploaded to any server."
        },
        {
          title: "2. Stored in Your Device Vault (IndexedDB), Never in Tracking Cookies",
          body: "Unlike shopping sites that drop cookies to follow you around with ads, your workspace is locked to this page. Google, social media apps, and other tabs cannot read it."
        },
        {
          title: "3. One-Click Wipe Anytime",
          body: "Tap '🧹 Wipe My Vault' in the top bar anytime to reset everything to zero in 5 milliseconds, or export a backup file to your computer."
        }
      ]
    }
  },

  // ==========================================================================
  // 1. ZONE 1A: DISCOVERY STRIPS (REVEALS PROFILE WITHOUT FORMS)
  // ==========================================================================
  discoveryStrips: {
    lifeStages: [
      {
        id: "20s",
        icon: "🌱",
        label: "20s: Building Fuel",
        defaultAge: 26,
        yearsTo60: 34,
        compoundingMultiplierAt12Pct: 47,
        ahaNote: "At 26, every ₹1 Lakh invested at 12% has ~5.5 doubling cycles before age 60—growing nearly 47x without adding another rupee!",
        unlockedWord: "compounding"
      },
      {
        id: "30s",
        icon: "🌿",
        label: "30s: Stacking & Juggling",
        defaultAge: 33,
        yearsTo60: 27,
        compoundingMultiplierAt12Pct: 21,
        ahaNote: "Your 30s are where income accelerates alongside family milestones. Each ₹1 Lakh still has 4.5 doubling cycles (~21x) to age 60.",
        unlockedWord: "opportunity_cost"
      },
      {
        id: "40s",
        icon: "🌳",
        label: "40s: Peak Responsibilities",
        defaultAge: 43,
        yearsTo60: 17,
        compoundingMultiplierAt12Pct: 6.8,
        ahaNote: "With kids' higher education and retirement closer in view, Asset Allocation and avoiding Volatility Drag matter as much as raw returns.",
        unlockedWord: "asset_allocation"
      },
      {
        id: "50s_plus",
        icon: "🌾",
        label: "50s+: Horizon & Freedom",
        defaultAge: 54,
        yearsTo60: 6,
        compoundingMultiplierAt12Pct: 2.0,
        ahaNote: "Protecting your built corpus from Sequence of Returns Risk and structuring a tax-efficient Bucket Strategy take center stage.",
        unlockedWord: "bucket_strategy"
      }
    ],

    familyContexts: [
      { id: "solo", label: "Just Me (Self-Reliant)", emergencyMonthsRecommended: 6, needsTermCover: false },
      { id: "partner", label: "Me + Partner", emergencyMonthsRecommended: 6, needsTermCover: true },
      { id: "kids", label: "Kids' Future on Board", emergencyMonthsRecommended: 9, needsTermCover: true },
      { id: "parents", label: "Supporting Parents", emergencyMonthsRecommended: 9, needsTermCover: true }
    ],

    liabilitiesAndShields: [
      {
        id: "debt_free",
        icon: "✨",
        label: "Zero Bad Debt",
        type: "positive",
        unlockedWord: "net_cash_flow",
        insight: "Being free of high-interest EMIs means 100% of your monthly surplus can compound FOR you instead of for a lender."
      },
      {
        id: "home_loan",
        icon: "🏠",
        label: "Running Home Loan",
        type: "neutral_debt",
        pulseRateKey: "macro.homeLoanAvg",
        unlockedWord: "amortizing",
        insight: "In an 8.65% 20-year home loan, ~75% of early EMIs go to interest. Just 1 extra EMI prepaid per year can shave ~3.5 years off the loan!"
      },
      {
        id: "personal_card_emi",
        icon: "💳",
        label: "Personal / Card EMI",
        type: "toxic_debt",
        pulseRateKey: "macro.personalLoanAvg",
        unlockedWord: "effective_apr",
        insight: "Priority #1: Clear 14%–39% APR personal or credit card debt before chasing market returns. Paying off a 20% loan is a guaranteed 20% tax-free return."
      },
      {
        id: "health_term_shield",
        icon: "🏥",
        label: "Health & Term Covered",
        type: "shield",
        unlockedWord: "hedging_risk_transfer",
        insight: "Your defense shield is up—a sudden hospital bill won't force you to liquidate your long-term goal investments at the wrong time."
      }
    ]
  },

  // ==========================================================================
  // 2. ZONE 1B: THE 6 EXPANDING ASSET CONTAINER CARDS (DASHBOARD ENGINE)
  // ==========================================================================
  assetContainers: [
    {
      id: "bank_fd",
      icon: "🏦",
      shortName: "Bank / FD",
      fullName: "Savings Accounts, Fixed Deposits & Liquid Funds",
      assetClass: "Cash & Fixed Income",
      roleBadge: "The Parking Lot (Certainty & Liquidity)",
      liquidityTier: "Instant to T+1 Day",
      riskProfile: "Zero market volatility, high inflation & tax drag",
      pulseRatePath: "macro.sbiFd1Yr",
      fallbackRate: 6.8,
      taxTreatment: "Interest taxed every year at your Marginal Income Tax Slab (up to 30%).",
      defaultPlayValue: 300000,
      inputUnitLabel: "Rough Balance (₹)",
      unlockedWords: ["money_illusion", "cash_equivalents", "tax_drag"],
      xRayLesson: "Great for 6-month emergency buffers and goals under 2 years. Dangerous for 10-year wealth because post-tax returns (~4.8%–5.4%) barely match inflation."
    },
    {
      id: "gold",
      icon: "🪙",
      shortName: "Gold (24K / ETF)",
      fullName: "Physical Gold, Gold ETFs & Sovereign Gold Bonds",
      assetClass: "Commodities / Store of Value",
      roleBadge: "The Crisis & Currency Shield",
      liquidityTier: "High (ETFs: T+1, Bullion: Same Day)",
      riskProfile: "Medium volatility, low correlation with stocks",
      pulseRatePath: "preciousMetals.gold10YrCagr",
      pulseSpotPath: "preciousMetals.gold24kPerGram",
      fallbackRate: 14.8,
      taxTreatment: "Listed Gold ETFs held >12 months qualify for 12.5% LTCG; Physical Gold >24 months qualifies for 12.5% LTCG.",
      defaultPlayValue: 150000,
      inputUnitLabel: "Rough Value (₹) or Grams",
      unlockedWords: ["commodities_gold", "correlation", "purchasing_power"],
      xRayLesson: "A 5%–10% portfolio slice stabilizes crashes when stocks fall. Avoid heavy making charges (12%–18%) on jewellery when investing purely for financial goals."
    },
    {
      id: "epf_ppf",
      icon: "🏛️",
      shortName: "EPF / PPF / SSY",
      fullName: "Provident Fund & Sovereign Small Savings",
      assetClass: "Sovereign Fixed Income",
      roleBadge: "The Tax-Free Long-Term Anchor",
      liquidityTier: "Locked-In (7 to 15+ Years)",
      riskProfile: "Sovereign guarantee, zero market drawdown",
      pulseRatePath: "macro.epfRate",
      secondaryPulsePath: "macro.ppfRate",
      fallbackRate: 8.25,
      taxTreatment: "EEE (Exempt-Exempt-Exempt) up to statutory limits—zero tax drag during compounding or maturity.",
      defaultPlayValue: 500000,
      inputUnitLabel: "Accumulated Corpus (₹)",
      unlockedWords: ["fixed_income_debt", "compounding", "tax_drag"],
      xRayLesson: "Because PPF (7.1%) and EPF (8.25%) suffer zero annual tax drag, their post-tax return beats a 10% taxable Bank FD for anyone in the 30% tax bracket!"
    },
    {
      id: "mutual_funds",
      icon: "📈",
      shortName: "Mutual Funds",
      fullName: "Index, Flexi-Cap, Hybrid & Debt Mutual Funds",
      assetClass: "Diversified Market Baskets",
      roleBadge: "The Automated Wealth Engine",
      liquidityTier: "High (T+1 to T+2 Working Days)",
      riskProfile: "Depends on underlying basket (Liquid = Low, Equity = High)",
      pulseRatePath: "indices.NIFTY50.cagr10y",
      fallbackRate: 13.4,
      taxTreatment: "Zero tax while held (Unrealized). Equity funds held >12 months get ₹1.25L/yr tax-free LTCG, then 12.5%.",
      defaultPlayValue: 400000,
      inputUnitLabel: "Current Value (₹)",
      hasLookupTool: "mf",
      unlockedWords: ["expense_ratio_drag", "rupee_cost_averaging", "cagr_vs_xirr"],
      xRayLesson: "Always verify you hold 'Direct Plan - Growth' rather than 'Regular Plan'—saving 0.8%–1.0% in annual distributor commissions keeps 15%–20% more corpus over 15 years."
    },
    {
      id: "stocks",
      icon: "📊",
      shortName: "Direct Stocks",
      fullName: "Listed NSE / BSE Direct Equities",
      assetClass: "Direct Business Ownership",
      roleBadge: "The High-Conviction Growth Slice",
      liquidityTier: "High (T+1 Settlement)",
      riskProfile: "High company-specific volatility & drawdown risk",
      pulseRatePath: "indices.NIFTYMID150.cagr10y",
      fallbackRate: 15.0,
      taxTreatment: "STCG (<12m): 20% | LTCG (>12m): 12.5% above ₹1.25 Lakh annual exemption.",
      defaultPlayValue: 200000,
      inputUnitLabel: "Portfolio Value (₹)",
      hasLookupTool: "equities",
      unlockedWords: ["equities_stocks", "benchmark_alpha", "drawdown"],
      xRayLesson: "Check whether your stock picks actually beat a simple Nifty 50 / Nifty Next 50 Index after accounting for stress, churn, and taxes."
    },
    {
      id: "real_estate",
      icon: "🏠",
      shortName: "Real Estate",
      fullName: "Residential Property, Land & REITs",
      assetClass: "Hard / Illiquid Assets",
      roleBadge: "The HeavyGenerational Anchor",
      liquidityTier: "Very Low (Months to Sell, High Stamp Duty)",
      riskProfile: "Chunky ticket size, low rental yield (~2.5%–3.5%)",
      pulseRatePath: "macro.educationInflation",
      fallbackRate: 9.0,
      taxTreatment: "Long-term (>24 months) taxed at 12.5% (or 20% with indexation for legacy properties acquired prior to July 2024).",
      defaultPlayValue: 0,
      inputUnitLabel: "Estimated Equity Value (₹)",
      unlockedWords: ["real_estate_hard_assets", "liquidating", "amortizing"],
      xRayLesson: "A home you live in provides emotional security, not liquid cash flow. Never count your primary residence as spendable corpus for medium-term goals."
    }
  ],

  // ==========================================================================
  // 3. ZONE 1C: THE 5 STARTER GOAL TEMPLATES (WHAT SHOULD MONEY BUY NEXT?)
  // ==========================================================================
  goalTemplates: [
    {
      id: "peace_buffer",
      icon: "🛡️",
      title: "6-Month Peace-of-Mind Buffer",
      subtitle: "Layoff, sabbatical, or family emergency runway",
      defaultCostToday: 450000,
      minCost: 100000,
      maxCost: 2500000,
      stepCost: 50000,
      defaultYears: 1,
      minYears: 1,
      maxYears: 3,
      inflationKey: "macro.cpiInflation",
      fallbackInflation: 5.4,
      recommendedRecipe: { equity: 0, debt: 90, gold: 10 },
      recipeRationale: "Money needed at a moment's notice belongs 90% in Cash/Sweep FD/Liquid/Arbitrage funds—zero stock market risk.",
      primaryWords: ["cash_equivalents", "liquidating", "time_horizon"]
    },
    {
      id: "car_upgrade",
      icon: "🚗",
      title: "Car / Lifestyle Milestone",
      subtitle: "Buy debt-free or minimize loan outflow",
      defaultCostToday: 1500000,
      minCost: 300000,
      maxCost: 5000000,
      stepCost: 100000,
      defaultYears: 4,
      minYears: 1,
      maxYears: 8,
      inflationKey: "macro.cpiInflation",
      fallbackInflation: 5.4,
      recommendedRecipe: { equity: 35, debt: 55, gold: 10 },
      recipeRationale: "For a 3–5 year horizon, a conservative hybrid blend (mostly Fixed Income + moderate Large-Cap Index + 10% Gold) beats FD tax drag without risking a deep crash.",
      primaryWords: ["purchasing_power", "effective_apr", "horizon_matching"]
    },
    {
      id: "home_downpayment",
      icon: "🏠",
      title: "Home Down Payment / Prepayment",
      subtitle: "Build a 25%–35% down payment to keep EMIs light",
      defaultCostToday: 2500000,
      minCost: 500000,
      maxCost: 15000000,
      stepCost: 250000,
      defaultYears: 5,
      minYears: 2,
      maxYears: 12,
      inflationKey: "macro.cpiInflation",
      fallbackInflation: 6.0,
      recommendedRecipe: { equity: 50, debt: 40, gold: 10 },
      recipeRationale: "A 5+ year runway lets Equities do the heavy lifting in Years 1–3, before shifting gains into safe Debt 18 months prior to buying.",
      primaryWords: ["amortizing", "horizon_matching", "asset_allocation"]
    },
    {
      id: "child_education",
      icon: "🎓",
      title: "Child's Higher Education",
      subtitle: "Outrun 9%–10% college fee inflation with time",
      defaultCostToday: 3000000,
      minCost: 1000000,
      maxCost: 20000000,
      stepCost: 250000,
      defaultYears: 12,
      minYears: 3,
      maxYears: 20,
      inflationKey: "macro.educationInflation",
      fallbackInflation: 9.0,
      recommendedRecipe: { equity: 70, debt: 20, gold: 10 },
      recipeRationale: "Education inflates at ~9% per year! Only an equity-heavy allocation (70% Index/Flexi-Cap + 20% PPF/SSY + 10% Gold) can outpace 9% fee compounding over 10+ years.",
      primaryWords: ["inflation", "compounding", "rebalancing"]
    },
    {
      id: "work_optional_freedom",
      icon: "🌴",
      title: "Work-Optional Freedom (FI Corpus)",
      subtitle: "Build a portfolio that pays your monthly paycheck forever",
      defaultCostToday: 30000000,
      minCost: 10000000,
      maxCost: 150000000,
      stepCost: 2500000,
      defaultYears: 18,
      minYears: 5,
      maxYears: 35,
      inflationKey: "macro.cpiInflation",
      fallbackInflation: 6.0,
      recommendedRecipe: { equity: 75, debt: 15, gold: 10 },
      recipeRationale: "Long-term wealth requires high equity compounding during accumulation, transitioning into a 3-Bucket SWP strategy as you near your freedom date.",
      primaryWords: ["fi_corpus", "safe_withdrawal_rate", "bucket_strategy"]
    }
  ],

  // ==========================================================================
  // 4. CHAPTER 1 STEALTH REFLEX DIAGNOSTIC (5 SCENARIOS)
  // ==========================================================================
  reflexQuestions: [
    {
      id: "q1_money_illusion",
      title: "The 'Safe Deposit' Mirage",
      scenario: "You lock ₹10 Lakhs in a bank FD paying 6.8% interest. Everyday prices (inflation) rise by 5.4%, and you are in the 20% tax bracket. After 1 year, what happened to your actual buying power?",
      unlockedWord: "purchasing_power",
      options: [
        {
          id: "a",
          text: "It grew by 6.8% (₹68,000 richer).",
          isOptimal: false,
          blindSpotTag: "Money Illusion",
          feedback: "Your bank statement shows ₹10,54,400 after 20% tax, which feels like a gain—but the same basket of goods now costs ₹10,54,000. You stood completely still!"
        },
        {
          id: "b",
          text: "It grew by 1.4% (6.8% interest minus 5.4% inflation).",
          isOptimal: false,
          blindSpotTag: "Tax Drag Blind Spot",
          feedback: "Close! You remembered inflation, but forgot the tax collector. 20% tax slices your 6.8% return down to 5.44% net—leaving almost 0% real gain."
        },
        {
          id: "c",
          text: "It barely stood still (~0% real growth after tax and inflation).",
          isOptimal: true,
          blindSpotTag: "Real-Return Thinker",
          feedback: "Spot on! 6.8% minus 20% tax = 5.44% post-tax return. Subtract 5.4% inflation and your real purchasing power grew by just 0.04%."
        }
      ]
    },
    {
      id: "q2_compounding_time",
      title: "The Early Starter vs. Late Heavy Saver",
      scenario: "Rahul invests ₹5,000/month from age 25 to 35 (only 10 years, ₹6L put in) and stops adding money. Priya starts at 35 and invests ₹5,000/month for 25 straight years until 60 (₹15L put in). At 12% growth, who has more at 60?",
      unlockedWord: "compounding",
      options: [
        {
          id: "a",
          text: "Priya, because she invested ₹15 Lakhs over 25 years vs. Rahul's ₹6 Lakhs.",
          isOptimal: false,
          blindSpotTag: "Linear Math Bias",
          feedback: "Human brains think linearly! Even though Priya put in 2.5x more money, Rahul ends up with ~₹1.95 Crore while Priya gets ~₹95 Lakhs—because Rahul's money had 10 extra years of doubling!"
        },
        {
          id: "b",
          text: "Rahul, by a huge margin—10 extra years of compounding beats 2.5x more capital.",
          isOptimal: true,
          blindSpotTag: "Compounding Native",
          feedback: "Bullseye! At 12%, money doubles every 6 years (Rule of 72). Rahul's early start gave his pot nearly two extra doubling cycles."
        }
      ]
    },
    {
      id: "q3_zero_cost_emi",
      title: "The 'Zero-Cost EMI' X-Ray",
      scenario: "You are buying a ₹60,000 laptop. Store A offers a 6-month 'No-Cost EMI' of ₹10,000/month (with a ₹500 fee). Store B offers a ₹3,000 instant discount if paid upfront. How expensive is taking the EMI?",
      unlockedWord: "effective_apr",
      options: [
        {
          id: "a",
          text: "Virtually free—just the ₹500 processing fee (~1%).",
          isOptimal: false,
          blindSpotTag: "Anchor Pricing Trap",
          feedback: "By taking the EMI, you gave up the ₹3,000 cash discount + paid ₹500 = ₹3,500 cost on a loan balance that shrinks every month. That equals an Effective APR of ~22% per year!"
        },
        {
          id: "b",
          text: "Over 20% per year (Effective APR), because of the forfeited ₹3,000 discount on a reducing balance.",
          isOptimal: true,
          blindSpotTag: "Fine-Print X-Ray",
          feedback: "Sharp eye! Giving up an upfront cash discount is mathematically identical to paying high interest on a shrinking loan balance."
        }
      ]
    },
    {
      id: "q4_volatility_drag",
      title: "The Average Return Trap",
      scenario: "You invest ₹1,00,000 in a volatile theme fund. In Year 1 it drops -40%. In Year 2 it rebounds +50%. Are you ahead after two years?",
      unlockedWord: "volatility_drag",
      options: [
        {
          id: "a",
          text: "Yes, up +10% overall (-40% + 50% = +10%).",
          isOptimal: false,
          blindSpotTag: "Volatility Drag Blind Spot",
          feedback: "Watch the rupee math: ₹1,00,000 minus 40% drops to ₹60,000. A +50% gain on ₹60,000 adds ₹30,000—leaving you at ₹90,000 (a -10% loss!)."
        },
        {
          id: "b",
          text: "No, I am still down at ₹90,000 (-10% below where I started).",
          isOptimal: true,
          blindSpotTag: "Downside-Aware",
          feedback: "Exactly right. Because losses shrink your base capital, a -40% drop requires a +66.7% gain just to get back to ₹1,00,000."
        }
      ]
    },
    {
      id: "q5_horizon_matching",
      title: "The 18-Month Wedding / Home Cheque",
      scenario: "You have saved ₹12 Lakhs that you MUST pay in exactly 18 months for a home down payment. Small-cap equity funds returned 24% last year. Where should this ₹12 Lakhs sit for the next 18 months?",
      unlockedWord: "time_horizon",
      options: [
        {
          id: "a",
          text: "In a high-performing Equity Fund so it grows to ₹15 Lakhs quickly.",
          isOptimal: false,
          blindSpotTag: "Recency Chasing",
          feedback: "Dangerous mismatch! Equities can drop 20%–35% in any random 18-month window. Short-term goals need certainty, never stock volatility."
        },
        {
          id: "b",
          text: "In a safe Arbitrage Fund, Money Market Fund, or 18-Month Bank FD.",
          isOptimal: true,
          blindSpotTag: "Horizon Matcher",
          feedback: "100% textbook CFP discipline. When a goal is under 2–3 years away, return OF principal matters infinitely more than return ON principal."
        }
      ]
    }
  ],

  // ==========================================================================
  // 5. ZONE 3: THE 10-CHAPTER FIELD MAP (PERSISTENT PROGRESSION)
  // ==========================================================================
  chapters: [
    {
      number: 1,
      id: "ch1_reflexes",
      title: "Test Your Present Money Reflexes",
      subtitle: "Uncover the 5 everyday money illusions & map your starting anchor",
      tier: "Foundation",
      wordIds: ["purchasing_power", "compounding", "effective_apr", "volatility_drag", "time_horizon"],
      interactiveTool: "reflex_diagnostic"
    },
    {
      number: 2,
      id: "ch2_habits",
      title: "How to Talk About Everyday Money Habits",
      subtitle: "Cash flow margin, silent trade-offs & defeating lifestyle creep",
      tier: "Foundation",
      wordIds: ["net_cash_flow", "opportunity_cost", "lifestyle_creep", "pay_yourself_first", "sunk_cost"],
      interactiveTool: "cashflow_margin_slider"
    },
    {
      number: 3,
      id: "ch3_containers",
      title: "Where Money Lives: The 5 Asset Containers",
      subtitle: "Cash, Fixed Income, Equities, Gold & Real Estate compared side-by-side",
      tier: "Foundation",
      wordIds: ["cash_equivalents", "fixed_income_debt", "equities_stocks", "commodities_gold", "real_estate_hard_assets"],
      interactiveTool: "asset_container_xray"
    },
    {
      number: 4,
      id: "ch4_time_value",
      title: "The Invisible Laws of Time & Value",
      subtitle: "Why inflation inflates your goals while compounding multiplies your fuel",
      tier: "Core Mechanics",
      wordIds: ["inflation", "nominal_vs_real", "time_value_of_money", "rule_of_72", "purchasing_power_erosion"],
      interactiveTool: "inflation_vs_doubling_sandbox"
    },
    {
      number: 5,
      id: "ch5_traps",
      title: "Spotting Financial Traps, Fine Print & Illusions",
      subtitle: "Decode No-Cost EMIs, credit card APRs & bundled insurance traps",
      tier: "Street-Smart Defense",
      wordIds: ["money_illusion", "apr_annual_percentage_rate", "negative_compounding", "endowment_trap", "teaser_pricing"],
      interactiveTool: "trap_decoder_calculator"
    },
    {
      number: 6,
      id: "ch6_action_verbs",
      title: "What Your Money Is Doing (Action Verbs)",
      subtitle: "Amortizing loans, liquidating assets, SIP averaging & risk hedging",
      tier: "Core Mechanics",
      wordIds: ["amortizing", "liquidating", "rupee_cost_averaging", "hedging_risk_transfer", "compounding_velocity"],
      interactiveTool: "stepup_and_loan_prepay_sim"
    },
    {
      number: 7,
      id: "ch7_product_signals",
      title: "Reading a Product's True Signal",
      subtitle: "Cut through marketing with XIRR, Rolling Returns, Direct vs. Regular & Drawdowns",
      tier: "Analytical X-Ray",
      wordIds: ["cagr_vs_xirr", "rolling_returns", "expense_ratio_drag", "benchmark_alpha", "drawdown"],
      interactiveTool: "direct_vs_regular_mf_lookup"
    },
    {
      number: 8,
      id: "ch8_goal_architecture",
      title: "Matching Money to Life Timelines",
      subtitle: "Combine Equity, Debt & Gold and rebalance without emotion",
      tier: "Portfolio Blueprint",
      wordIds: ["asset_allocation", "horizon_matching", "correlation", "portfolio_drift", "rebalancing"],
      interactiveTool: "goal_allocation_builder"
    },
    {
      number: 9,
      id: "ch9_taxes",
      title: "Taxes & What You Actually Keep",
      subtitle: "Marginal vs. Effective slabs, Tax Deferral, STCG/LTCG & ₹1.25L Tax Harvesting",
      tier: "Optimization",
      wordIds: ["marginal_vs_effective_tax", "realized_vs_unrealized", "stcg_vs_ltcg", "tax_drag", "tax_harvesting"],
      interactiveTool: "post_tax_keep_calculator"
    },
    {
      number: 10,
      id: "ch10_freedom",
      title: "Work-Optional Freedom (The Endgame)",
      subtitle: "Your 30x FI Corpus, Safe Withdrawal Rates & the 3-Bucket SWP Paycheck",
      tier: "Mastery",
      wordIds: ["fi_corpus", "safe_withdrawal_rate", "sequence_of_returns_risk", "bucket_strategy", "swp_systematic_withdrawal"],
      interactiveTool: "freedom_bucket_simulator"
    }
  ],

  // ==========================================================================
  // 6. PURE MATH HELPERS FOR LIVE REACTIVITY BETWEEN ZONE 1 & ZONE 2
  // ==========================================================================
  math: {
    // Format INR numbers into clean '₹18.9L' or '₹3.60 Cr' strings
    formatINRCompact(amount) {
      if (amount === null || amount === undefined || isNaN(amount)) return "₹0";
      const abs = Math.abs(amount);
      if (abs >= 10000000) return `₹${(amount / 10000000).toFixed(2)} Cr`;
      if (abs >= 100000) return `₹${(amount / 100000).toFixed(1)}L`;
      return `₹${Math.round(amount).toLocaleString("en-IN")}`;
    },

    // Future inflation-adjusted price tag of any goal
    inflateGoalCost(costToday, years, inflationPct) {
      return Math.round(costToday * Math.pow(1 + inflationPct / 100, years));
    },

    // Monthly SIP required to reach a target future corpus given expected annual return %
    calcRequiredMonthlySIP(targetFutureValue, years, annualReturnPct, existingLumpSum = 0) {
      const months = Math.max(1, Math.round(years * 12));
      const r = annualReturnPct / 100 / 12;
      const grownExisting = existingLumpSum * Math.pow(1 + annualReturnPct / 100, years);
      const netGap = Math.max(0, targetFutureValue - grownExisting);
      if (netGap <= 0) return 0;
      if (r <= 0) return Math.round(netGap / months);
      const factor = ((Math.pow(1 + r, months) - 1) / r) * (1 + r);
      return Math.round(netGap / factor);
    }
  }
};