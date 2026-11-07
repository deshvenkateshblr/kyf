/**
 * KYF Family Portfolio Tracker — Live Market Valuation & Aggregation Engine (`js/portfolio-engine.js`)
 * Version: v1.4.0
 * Pure Vanilla ES6+ | O(1) Indexing, Live Valuation, Multi-Horizon Returns (1M, 3M, 6M, 1Y),
 * Goal Envelopes, Macro Inflation Compounding, Virtual Lot Splitting,
 * Dual-Unit Commodity & Real Estate Engine (Gold Grams + RESIDEX Sq.Ft + INR) & Divergence Detection
 */

window.KYF_PORTFOLIO_ENGINE = (() => {
  // Pre-indexed in-memory O(1) Lookup Maps
  let equityMap = null;
  let mfMap = null;
  let isIndexed = false;

  function ensureIndexed() {
    if (isIndexed) return;

    // 1. Index NSE Equities (2,700+ stocks)
    equityMap = new Map();
    if (window.KYF_MARKET_EQUITIES && Array.isArray(window.KYF_MARKET_EQUITIES.stocks)) {
      for (const row of window.KYF_MARKET_EQUITIES.stocks) {
        // columns: ["symbol", "companyName", "closePrice", "ret1m", "ret3m", "ret6m", "ret1y", "isN500"]
        const [symbol, companyName, closePrice, ret1m, ret3m, ret6m, ret1y, isN500] = row;
        equityMap.set(symbol.toUpperCase(), {
          symbol,
          companyName,
          closePrice: Number(closePrice) || 0,
          ret1m: ret1m != null ? Number(ret1m) : null,
          ret3m: ret3m != null ? Number(ret3m) : null,
          ret6m: ret6m != null ? Number(ret6m) : null,
          ret1y: ret1y != null ? Number(ret1y) : null,
          isN500: isN500 === 1
        });
      }
    }

    // 2. Index AMFI Mutual Funds (1,700+ schemes)
    mfMap = new Map();
    if (window.KYF_MARKET_MF && Array.isArray(window.KYF_MARKET_MF.schemes)) {
      for (const row of window.KYF_MARKET_MF.schemes) {
        // columns: ["directCode", "fundName", "category", "directNav", "regularNav", "ret1m", "ret3m", "ret6m", "ret1y"]
        const [directCode, fundName, category, directNav, regularNav, ret1m, ret3m, ret6m, ret1y] = row;
        mfMap.set(Number(directCode), {
          directCode: Number(directCode),
          fundName,
          category,
          directNav: Number(directNav) || 0,
          regularNav: Number(regularNav) || 0,
          ret1m: ret1m != null ? Number(ret1m) : null,
          ret3m: ret3m != null ? Number(ret3m) : null,
          ret6m: ret6m != null ? Number(ret6m) : null,
          ret1y: ret1y != null ? Number(ret1y) : null
        });
      }
    }

    isIndexed = true;
  }

  // ==========================================================================
  // Helper: Get Live Real Estate Rate from NHB RESIDEX
  // ==========================================================================
  function getResidexRate(city, sizeTier = "composite") {
    if (!window.KYF_RESIDEX || !window.KYF_RESIDEX.cities) {
      return 12000;
    }
    const cityData = window.KYF_RESIDEX.cities[city];
    if (!cityData || !cityData.carpet_price_sqft_by2024) {
      return 12000;
    }

    const rates = cityData.carpet_price_sqft_by2024;
    const tierObj = rates[sizeTier] || rates.composite || {};
    const quarters = Object.keys(tierObj);
    if (quarters.length > 0) {
      const latestQtr = quarters[quarters.length - 1];
      return tierObj[latestQtr] || 12000;
    }
    return 12000;
  }

  // ==========================================================================
  // Dual-Unit Engine: Physical Gold Harmonizer & Purity Conversion
  // Converts 24K Bar, 22K Jewellery, 18K, and GOLDBEES ETF into target purity
  // ==========================================================================
  function convertHoldingToGoldGrams(holding, targetPurity = "24K") {
    const meta = holding.instrumentMeta || {};
    let pureGrams24k = 0;

    const isGoldAsset = holding.pricingMode === "LIVE_GOLD" ||
      holding.assetClass === "Commodities & Gold" ||
      (meta.symbol || "").toUpperCase() === "GOLDBEES";

    if (!isGoldAsset) return 0;

    if ((meta.symbol || "").toUpperCase() === "GOLDBEES") {
      const units = Number(meta.units) || 0;
      const pulse = window.KYF_MARKET_PULSE || {};
      const precious = pulse.preciousMetals || {};
      const factor = precious.goldEtfTo24kFactor || 122.5;
      pureGrams24k = units / factor;
    } else {
      const grams = Number(meta.grams) || 0;
      const purity = (meta.purity || "24K").toUpperCase();
      if (purity === "24K") {
        pureGrams24k = grams;
      } else if (purity === "22K") {
        pureGrams24k = grams * (22 / 24);
      } else if (purity === "18K") {
        pureGrams24k = grams * (18 / 24);
      } else {
        pureGrams24k = grams;
      }
    }

    const normTarget = (targetPurity || "24K").toUpperCase();
    if (normTarget === "22K") {
      return pureGrams24k * (24 / 22);
    }
    if (normTarget === "18K") {
      return pureGrams24k * (24 / 18);
    }
    return pureGrams24k;
  }

  // ==========================================================================
  // Dual-Unit Engine: Extract Holding Physical Units
  // ==========================================================================
  function computeHoldingPhysicalUnits(holding, targetPurity = "24K") {
    const meta = holding.instrumentMeta || {};
    const gramsGold = convertHoldingToGoldGrams(holding, targetPurity);
    const carpetSqft = Number(meta.carpetSqft) || 0;

    return {
      gramsGold: Number(gramsGold.toFixed(2)),
      carpetSqft: Number(carpetSqft.toFixed(2)),
      sharesQty: Number(meta.quantity) || 0,
      mfUnits: Number(meta.units) || 0
    };
  }

  // ==========================================================================
  // Macro Inflation Compounding for Goals
  // FV = BaseTarget * (1 + inflationRate/100) ^ yearsRemaining
  // ==========================================================================
  function calculateInflationAdjustedTarget(goal, macroRates = null, currentYear = null) {
    const pulse = window.KYF_MARKET_PULSE || {};
    const rates = macroRates || pulse.macro || {
      cpiInflation: 5.4,
      educationInflation: 9.0,
      medicalInflation: 11.5
    };

    let baseYear = currentYear;
    if (!baseYear) {
      if (pulse.asOf && typeof pulse.asOf === "string") {
        baseYear = parseInt(pulse.asOf.slice(0, 4), 10) || new Date().getFullYear();
      } else {
        baseYear = new Date().getFullYear();
      }
    }

    const baseTarget = Number(goal.baseTargetINR) || 0;
    const targetYear = Number(goal.targetYear) || baseYear;
    const yearsRemaining = Math.max(0, targetYear - baseYear);

    let inflationRate = 5.4;
    const category = (goal.inflationCategory || "CPI").toUpperCase();
    if (category === "EDUCATION") {
      inflationRate = Number(rates.educationInflation) || 9.0;
    } else if (category === "HEALTHCARE" || category === "MEDICAL") {
      inflationRate = Number(rates.medicalInflation) || 11.5;
    } else {
      inflationRate = Number(rates.cpiInflation) || 5.4;
    }

    let adjustedTargetINR = baseTarget;
    if (yearsRemaining > 0 && baseTarget > 0) {
      adjustedTargetINR = Math.round(baseTarget * Math.pow(1 + inflationRate / 100, yearsRemaining));
    }

    const multiplier = baseTarget > 0 ? Number((adjustedTargetINR / baseTarget).toFixed(2)) : 1;

    return {
      baseTargetINR: baseTarget,
      targetYear,
      baseYear,
      yearsRemaining,
      inflationRate,
      inflationCategory: category,
      adjustedTargetINR,
      multiplier
    };
  }

  // ==========================================================================
  // Virtual Lot Splitting: Expand Holdings into Goal Slices
  // Unallocated portions automatically flow into "goal_unallocated"
  // Guarantees 100% net worth conservation down to the exact rupee
  // ==========================================================================
  function expandGoalSlices(holdings = [], goals = [], macroRates = null, currentYear = null) {
    const pulse = window.KYF_MARKET_PULSE || {};
    let baseYear = currentYear;
    if (!baseYear) {
      if (pulse.asOf && typeof pulse.asOf === "string") {
        baseYear = parseInt(pulse.asOf.slice(0, 4), 10) || new Date().getFullYear();
      } else {
        baseYear = new Date().getFullYear();
      }
    }

    const goalMap = new Map();
    for (const g of goals) {
      const infl = calculateInflationAdjustedTarget(g, macroRates, baseYear);
      goalMap.set(g.id, { ...g, inflation: infl });
    }

    const UNALLOCATED_ID = "goal_unallocated";
    const UNALLOCATED_GOAL = {
      id: UNALLOCATED_ID,
      name: "General Wealth / Unallocated",
      icon: "🌱",
      targetYear: baseYear,
      baseTargetINR: 0,
      priority: "LOW",
      inflation: {
        baseTargetINR: 0,
        targetYear: baseYear,
        baseYear,
        yearsRemaining: 0,
        inflationRate: 0,
        inflationCategory: "NONE",
        adjustedTargetINR: 0,
        multiplier: 1
      }
    };
    goalMap.set(UNALLOCATED_ID, UNALLOCATED_GOAL);

    const slices = [];

    for (const h of holdings) {
      const rawAllocs = Array.isArray(h.allocations) && h.allocations.length > 0 ? h.allocations : [];

      let allocList = rawAllocs
        .map((a) => ({
          goalId: a.goalId,
          percentage: Number(a.percentage) || 0
        }))
        .filter((a) => a.percentage > 0);

      const totalPct = allocList.reduce((sum, a) => sum + a.percentage, 0);

      if (totalPct < 100) {
        allocList.push({
          goalId: UNALLOCATED_ID,
          percentage: 100 - totalPct
        });
      }

      let allocatedInvested = 0;
      let allocatedCurrent = 0;

      allocList.forEach((alloc, index) => {
        const isLast = index === allocList.length - 1;
        const pct = alloc.percentage;
        const ratio = pct / 100;

        const sliceInvested = isLast
          ? (h.investedValue || 0) - allocatedInvested
          : Math.round((h.investedValue || 0) * ratio);

        const sliceCurrent = isLast
          ? (h.currentValue || 0) - allocatedCurrent
          : Math.round((h.currentValue || 0) * ratio);

        const sliceGainLoss = sliceCurrent - sliceInvested;

        allocatedInvested += sliceInvested;
        allocatedCurrent += sliceCurrent;

        const goalObj = goalMap.get(alloc.goalId) || UNALLOCATED_GOAL;

        // Scale physical units proportionally into slice instrumentMeta
        const sliceMeta = { ...(h.instrumentMeta || {}) };
        if (sliceMeta.grams != null) {
          sliceMeta.grams = Number((Number(sliceMeta.grams) * ratio).toFixed(2));
        }
        if (sliceMeta.units != null) {
          sliceMeta.units = Number((Number(sliceMeta.units) * ratio).toFixed(2));
        }
        if (sliceMeta.carpetSqft != null) {
          sliceMeta.carpetSqft = Number((Number(sliceMeta.carpetSqft) * ratio).toFixed(2));
        }
        if (sliceMeta.quantity != null) {
          sliceMeta.quantity = Number((Number(sliceMeta.quantity) * ratio).toFixed(2));
        }

        slices.push({
          ...h,
          id: `${h.id}_slice_${alloc.goalId}`,
          originalHoldingId: h.id,
          goal: alloc.goalId,
          goalId: alloc.goalId,
          goalName: goalObj.name,
          goalIcon: goalObj.icon,
          goalMeta: goalObj,
          instrumentMeta: sliceMeta,
          slicePercentage: pct,
          isSlice: pct < 100,
          sliceLabel: pct < 100 ? `${pct}% slice` : "",
          investedValue: sliceInvested,
          currentValue: sliceCurrent,
          gainLoss: sliceGainLoss,
          originalCurrentValue: h.currentValue,
          originalInvestedValue: h.investedValue
        });
      });
    }

    return {
      slices,
      goals: Array.from(goalMap.values())
    };
  }

  // ==========================================================================
  // Core Valuation: Enrich Holdings with Live Market Prices & Horizons
  // ==========================================================================
  function enrichHoldingsWithLiveMarket(holdings = [], activeHorizon = "1y") {
    ensureIndexed();

    const pulse = window.KYF_MARKET_PULSE || {};
    const precious = pulse.preciousMetals || {
      gold24kPerGram: 14470,
      gold22kPerGram: 13260,
      goldEtfTo24kFactor: 122.5,
      goldRet1m: -2.84,
      goldRet3m: -1.06,
      goldRet6m: -3.3,
      goldRet1y: 18.37
    };

    return holdings.map((h) => {
      const enriched = { ...h };
      const meta = h.instrumentMeta || {};
      let livePrice = 0;
      let calculatedValue = Number(h.investedValue) || 0;
      let priceLabel = "";
      let ret1m = null;
      let ret3m = null;
      let ret6m = null;
      let ret1y = null;
      let regularAlert = null;
      let physicalUnitsLabel = "";

      switch (h.pricingMode) {
        case "LIVE_EQUITY": {
          const sym = (meta.symbol || "").toUpperCase();
          const stock = equityMap.get(sym);
          const qty = Number(meta.quantity) || 0;
          if (stock && stock.closePrice > 0) {
            livePrice = stock.closePrice;
            calculatedValue = qty * livePrice;
            ret1m = stock.ret1m;
            ret3m = stock.ret3m;
            ret6m = stock.ret6m;
            ret1y = stock.ret1y;
            priceLabel = `₹${livePrice.toLocaleString("en-IN", { minimumFractionDigits: 2 })}/sh`;
            physicalUnitsLabel = `${qty.toLocaleString("en-IN")} shares`;
          } else {
            priceLabel = `Symbol: ${sym}`;
            physicalUnitsLabel = `${qty.toLocaleString("en-IN")} shares`;
          }
          break;
        }

        case "LIVE_MF": {
          const code = Number(meta.amfiCode);
          const scheme = mfMap.get(code);
          const units = Number(meta.units) || 0;
          const isDirect = (meta.planType || "DIRECT").toUpperCase() === "DIRECT";

          if (scheme) {
            livePrice = isDirect ? scheme.directNav : scheme.regularNav;
            calculatedValue = units * livePrice;
            ret1m = scheme.ret1m;
            ret3m = scheme.ret3m;
            ret6m = scheme.ret6m;
            ret1y = scheme.ret1y;
            priceLabel = `NAV ₹${livePrice.toFixed(2)} (${isDirect ? "Dir" : "Reg"})`;
            physicalUnitsLabel = `${units.toLocaleString("en-IN", { maximumFractionDigits: 2 })} units`;

            if (!isDirect && scheme.directNav > scheme.regularNav) {
              const diffPct = ((scheme.directNav - scheme.regularNav) / scheme.regularNav) * 100;
              regularAlert = {
                planType: "REGULAR",
                directNav: scheme.directNav,
                regularNav: scheme.regularNav,
                gapPct: Number(diffPct.toFixed(2)),
                message: `Direct plan is NAV ₹${scheme.directNav.toFixed(2)} (+${diffPct.toFixed(1)}% higher corpus)`
              };
            }
          } else {
            priceLabel = `AMFI ${code}`;
            physicalUnitsLabel = `${units.toLocaleString("en-IN", { maximumFractionDigits: 2 })} units`;
          }
          break;
        }

        case "LIVE_GOLD": {
          const purity = (meta.purity || "24K").toUpperCase();
          const grams = Number(meta.grams) || 0;
          const isEtf = (meta.symbol || "").toUpperCase() === "GOLDBEES";

          if (isEtf) {
            const sym = "GOLDBEES";
            const stock = equityMap.get(sym);
            const units = Number(meta.units) || 0;
            if (stock && stock.closePrice > 0) {
              livePrice = stock.closePrice;
              calculatedValue = units * livePrice;
              ret1m = stock.ret1m;
              ret3m = stock.ret3m;
              ret6m = stock.ret6m;
              ret1y = stock.ret1y;
              priceLabel = `₹${livePrice.toFixed(2)}/unit`;
              const factor = precious.goldEtfTo24kFactor || 122.5;
              const eqGrams = (units / factor).toFixed(1);
              physicalUnitsLabel = `${units.toLocaleString("en-IN")} units (≈${eqGrams}g 24K)`;
            }
          } else {
            livePrice = purity === "22K" ? precious.gold22kPerGram : precious.gold24kPerGram;
            calculatedValue = grams * livePrice;
            ret1m = precious.goldRet1m;
            ret3m = precious.goldRet3m;
            ret6m = precious.goldRet6m;
            ret1y = precious.goldRet1y;
            priceLabel = `₹${livePrice.toLocaleString("en-IN")}/g (${purity})`;
            physicalUnitsLabel = `${grams.toLocaleString("en-IN")}g (${purity})`;
          }
          break;
        }

        case "LIVE_RESIDEX": {
          const sqft = Number(meta.carpetSqft) || 0;
          const city = meta.city || "Bengaluru";
          const sizeTier = meta.sizeTier || "large_gt_1184_sqft";
          livePrice = getResidexRate(city, sizeTier);
          calculatedValue = sqft * livePrice;
          priceLabel = `₹${livePrice.toLocaleString("en-IN")}/sq.ft (NHB)`;
          physicalUnitsLabel = `${sqft.toLocaleString("en-IN")} sq.ft (${city})`;
          ret1y = 9.8;
          break;
        }

        case "MACRO_LINKED":
        case "MANUAL":
        default: {
          calculatedValue = Number(h.manualCurrentValue) || Number(h.investedValue) || 0;
          if (meta.interestRate) {
            priceLabel = `Coupon: ${meta.interestRate}% p.a.`;
            ret1y = Number(meta.interestRate);
            ret6m = Number((meta.interestRate / 2).toFixed(1));
            ret3m = Number((meta.interestRate / 4).toFixed(1));
            ret1m = Number((meta.interestRate / 12).toFixed(2));
          } else {
            priceLabel = "Fixed/Manual Valued";
          }
          physicalUnitsLabel = h.subCategory || "Principal Amount";
          break;
        }
      }

      const invested = Number(h.investedValue) || 0;
      const gainLoss = calculatedValue - invested;
      const totalReturnPct = invested > 0 ? (gainLoss / invested) * 100 : 0;

      let activeHorizonReturn = totalReturnPct;
      let activeHorizonLabel = "All-Time Gain";

      switch (activeHorizon) {
        case "1m":
          activeHorizonReturn = ret1m != null ? ret1m : 0;
          activeHorizonLabel = "1M Momentum";
          break;
        case "3m":
          activeHorizonReturn = ret3m != null ? ret3m : 0;
          activeHorizonLabel = "3M Momentum";
          break;
        case "6m":
          activeHorizonReturn = ret6m != null ? ret6m : 0;
          activeHorizonLabel = "6M Momentum";
          break;
        case "1y":
          activeHorizonReturn = ret1y != null ? ret1y : totalReturnPct;
          activeHorizonLabel = "1Y Trailing";
          break;
        case "all":
        default:
          activeHorizonReturn = totalReturnPct;
          activeHorizonLabel = "Absolute Return";
          break;
      }

      enriched.currentValue = Math.round(calculatedValue);
      enriched.investedValue = Math.round(invested);
      enriched.gainLoss = Math.round(gainLoss);
      enriched.totalReturnPct = Number(totalReturnPct.toFixed(2));
      enriched.returnPct = Number(totalReturnPct.toFixed(2));
      enriched.activeHorizonReturn = Number(activeHorizonReturn.toFixed(2));
      enriched.activeHorizonLabel = activeHorizonLabel;
      enriched.priceLabel = priceLabel;
      enriched.physicalUnitsLabel = physicalUnitsLabel;
      enriched.ret1m = ret1m != null ? Number(ret1m) : null;
      enriched.ret3m = ret3m != null ? Number(ret3m) : null;
      enriched.ret6m = ret6m != null ? Number(ret6m) : null;
      enriched.ret1y = ret1y != null ? Number(ret1y) : null;
      enriched.regularAlert = regularAlert;

      return enriched;
    });
  }

  // ==========================================================================
  // Filter Engine (Search Text + Selected View Pills)
  // Supports atomic holdings and goal slices
  // ==========================================================================
  function filterHoldings(holdings = [], filterCriteria = {}) {
    const query = (filterCriteria.search || "").trim().toLowerCase();
    const activeDimension = filterCriteria.activeDimension || "assetClass";
    const selectedPills = filterCriteria.selectedPills;

    return holdings.filter((h) => {
      // 1. Text Search across name, symbol, subCategory, member, custodian, assetClass, goalName
      if (query) {
        const sym = (h.instrumentMeta && h.instrumentMeta.symbol) || "";
        const matchesName = (h.name || "").toLowerCase().includes(query);
        const matchesSym = sym.toLowerCase().includes(query);
        const matchesSub = (h.subCategory || "").toLowerCase().includes(query);
        const matchesMember = (h.member || "").toLowerCase().includes(query);
        const matchesCust = (h.custodian || "").toLowerCase().includes(query);
        const matchesAsset = (h.assetClass || "").toLowerCase().includes(query);
        const matchesGoal = (h.goalName || "").toLowerCase().includes(query);

        if (!matchesName && !matchesSym && !matchesSub && !matchesMember && !matchesCust && !matchesAsset && !matchesGoal) {
          return false;
        }
      }

      // 2. Multi-Select Pill Filter in Active View
      if (selectedPills && selectedPills !== "ALL" && selectedPills.size > 0) {
        let itemKey = "";
        if (activeDimension === "goal") {
          itemKey = h.goalId || h.goal || "goal_unallocated";
        } else {
          itemKey = h[activeDimension] || "Other / Unassigned";
        }

        if (!selectedPills.has(itemKey)) {
          return false;
        }
      }

      // Legacy direct facet filters
      if (filterCriteria.member && filterCriteria.member !== "ALL" && h.member !== filterCriteria.member) {
        return false;
      }
      if (filterCriteria.custodian && filterCriteria.custodian !== "ALL" && h.custodian !== filterCriteria.custodian) {
        return false;
      }
      if (filterCriteria.assetClass && filterCriteria.assetClass !== "ALL" && h.assetClass !== filterCriteria.assetClass) {
        return false;
      }

      return true;
    });
  }

  // ==========================================================================
  // Sorting Engine for Holdings & Groups
  // ==========================================================================
  function sortHoldings(holdings = [], sortKey = "currentValue", sortDirection = "desc") {
    const factor = sortDirection === "asc" ? 1 : -1;

    return [...holdings].sort((a, b) => {
      let valA, valB;
      switch (sortKey) {
        case "name":
          valA = (a.name || "").toLowerCase();
          valB = (b.name || "").toLowerCase();
          return valA.localeCompare(valB) * factor;

        case "member":
          valA = (a.member || "").toLowerCase();
          valB = (b.member || "").toLowerCase();
          if (valA === valB) {
            return (b.currentValue || 0) - (a.currentValue || 0);
          }
          return valA.localeCompare(valB) * factor;

        case "assetClass":
          valA = (a.assetClass || "").toLowerCase();
          valB = (b.assetClass || "").toLowerCase();
          if (valA === valB) {
            return (b.currentValue || 0) - (a.currentValue || 0);
          }
          return valA.localeCompare(valB) * factor;

        case "investedValue":
          valA = a.investedValue || 0;
          valB = b.investedValue || 0;
          break;

        case "returnPct":
          valA = a.activeHorizonReturn != null ? a.activeHorizonReturn : (a.totalReturnPct || 0);
          valB = b.activeHorizonReturn != null ? b.activeHorizonReturn : (b.totalReturnPct || 0);
          break;

        case "units":
          valA = (a.instrumentMeta && (a.instrumentMeta.quantity || a.instrumentMeta.units || a.instrumentMeta.grams || a.instrumentMeta.carpetSqft)) || 0;
          valB = (b.instrumentMeta && (b.instrumentMeta.quantity || b.instrumentMeta.units || b.instrumentMeta.grams || b.instrumentMeta.carpetSqft)) || 0;
          break;

        case "currentValue":
        default:
          valA = a.currentValue || 0;
          valB = b.currentValue || 0;
          break;
      }

      return (valA - valB) * factor;
    });
  }

  // ==========================================================================
  // 1-Level Pivot Reducer (GroupBy with Dual-Unit Rollups & Divergence Detection)
  // ==========================================================================
  function groupBySingleDimension(
    holdings = [],
    dimensionKey = "assetClass",
    sortKey = "currentValue",
    sortDirection = "desc",
    activeHorizon = "1y"
  ) {
    // 1. Calculate Active Portfolio Totals
    let grandInvested = 0;
    let grandCurrent = 0;
    let grandWeightedHorizonReturn = 0;

    for (const h of holdings) {
      grandInvested += h.investedValue || 0;
      grandCurrent += h.currentValue || 0;
      if (h.activeHorizonReturn != null) {
        grandWeightedHorizonReturn += (h.activeHorizonReturn * (h.currentValue || 0));
      }
    }

    const grandGainLoss = grandCurrent - grandInvested;
    const grandReturnPct = grandInvested > 0 ? (grandGainLoss / grandInvested) * 100 : 0;
    const grandActiveHorizonReturn = grandCurrent > 0 ? (grandWeightedHorizonReturn / grandCurrent) : grandReturnPct;

    // 2. Bucket into groups
    const groupsMap = new Map();

    for (const h of holdings) {
      let groupKey = "";
      let groupLabel = "";
      let goalMeta = null;

      if (dimensionKey === "goal") {
        groupKey = h.goalId || h.goal || "goal_unallocated";
        groupLabel = h.goalName ? `${h.goalIcon || "🎯"} ${h.goalName}` : "🌱 General Wealth / Unallocated";
        goalMeta = h.goalMeta || null;
      } else {
        groupKey = h[dimensionKey] || "Other / Unassigned";
        groupLabel = groupKey;
      }

      if (!groupsMap.has(groupKey)) {
        groupsMap.set(groupKey, {
          id: `grp_${dimensionKey}_${groupKey.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase()}`,
          dimension: dimensionKey,
          key: groupKey,
          label: groupLabel,
          goalMeta,
          holdings: [],
          totalInvested: 0,
          totalCurrentValue: 0,
          totalGainLoss: 0,
          totalReturnPct: 0,
          horizonReturnPct: 0,
          allocationPct: 0,
          progressPct: null,
          adjustedTargetINR: (goalMeta && goalMeta.inflation && goalMeta.inflation.adjustedTargetINR) || 0,
          dualUnit: null,
          physicalSummary: null
        });
      }

      const grp = groupsMap.get(groupKey);
      grp.holdings.push(h);
      grp.totalInvested += h.investedValue || 0;
      grp.totalCurrentValue += h.currentValue || 0;
    }

    // 3. Finalize group rollups with weighted-average returns, dual-unit math & divergence
    const groupsArray = Array.from(groupsMap.values()).map((grp) => {
      grp.totalGainLoss = grp.totalCurrentValue - grp.totalInvested;
      grp.totalReturnPct = grp.totalInvested > 0 ? (grp.totalGainLoss / grp.totalInvested) * 100 : 0;
      grp.allocationPct = grandCurrent > 0 ? (grp.totalCurrentValue / grandCurrent) * 100 : 0;

      // Goal progress calculation against inflation-adjusted target
      if (grp.adjustedTargetINR > 0) {
        grp.progressPct = Number(((grp.totalCurrentValue / grp.adjustedTargetINR) * 100).toFixed(1));
      } else {
        grp.progressPct = null;
      }

      // Dual-Unit Physical Metric Calculation (for Goals with secondary physical targets)
      if (dimensionKey === "goal" && grp.goalMeta && grp.goalMeta.secondaryTarget && grp.goalMeta.secondaryTarget.enabled) {
        const sec = grp.goalMeta.secondaryTarget;
        let physicalAccumulated = 0;
        let unitLabel = "";

        if (sec.unitType === "GRAMS_GOLD") {
          const targetPurity = (sec.purity || "24K").toUpperCase();
          unitLabel = `${targetPurity} Gold`;
          for (const h of grp.holdings) {
            physicalAccumulated += convertHoldingToGoldGrams(h, targetPurity);
          }
        } else if (sec.unitType === "SQFT_REALESTATE") {
          unitLabel = `sq.ft (${sec.city || "Residential"})`;
          for (const h of grp.holdings) {
            if (h.instrumentMeta && h.instrumentMeta.carpetSqft != null) {
              physicalAccumulated += Number(h.instrumentMeta.carpetSqft) || 0;
            }
          }
        }

        physicalAccumulated = Number(physicalAccumulated.toFixed(1));
        const physicalTarget = Number(sec.targetUnits) || 0;
        const physicalProgressPct = physicalTarget > 0 ? Number(((physicalAccumulated / physicalTarget) * 100).toFixed(1)) : 0;
        const inrProgressPct = grp.progressPct != null ? grp.progressPct : 0;
        const divergencePct = Number((inrProgressPct - physicalProgressPct).toFixed(1));
        const hasDivergence = divergencePct >= 15.0;

        grp.dualUnit = {
          enabled: true,
          unitType: sec.unitType,
          purity: sec.purity,
          targetUnits: physicalTarget,
          accumulatedUnits: physicalAccumulated,
          progressPct: physicalProgressPct,
          unitLabel,
          inrProgressPct,
          divergencePct,
          hasDivergence,
          divergenceMessage: hasDivergence
            ? `Price Divergence: INR target is ${inrProgressPct}% funded, but physical accumulation is only ${physicalProgressPct}% (${physicalAccumulated} / ${physicalTarget} ${unitLabel}).`
            : null
        };
      }

      // Physical Summary for Asset Class View (Total Gold Grams & Total Carpet Area)
      if (dimensionKey === "assetClass") {
        if (grp.key === "Commodities & Gold") {
          let totalGoldGrams24k = 0;
          for (const h of grp.holdings) {
            totalGoldGrams24k += convertHoldingToGoldGrams(h, "24K");
          }
          grp.physicalSummary = {
            unitType: "GRAMS_GOLD",
            totalUnits: Number(totalGoldGrams24k.toFixed(1)),
            label: `${Number(totalGoldGrams24k.toFixed(1))}g (24K eq)`
          };
        } else if (grp.key === "Real Estate") {
          let totalSqft = 0;
          for (const h of grp.holdings) {
            if (h.instrumentMeta && h.instrumentMeta.carpetSqft != null) {
              totalSqft += Number(h.instrumentMeta.carpetSqft) || 0;
            }
          }
          grp.physicalSummary = {
            unitType: "SQFT_REALESTATE",
            totalUnits: Math.round(totalSqft),
            label: `${Math.round(totalSqft).toLocaleString("en-IN")} sq.ft`
          };
        }
      }

      // Weighted-average return of child holdings for the active horizon
      let weightedSum = 0;
      let weightedBase = 0;
      for (const h of grp.holdings) {
        if (h.activeHorizonReturn != null && h.currentValue > 0) {
          weightedSum += h.activeHorizonReturn * h.currentValue;
          weightedBase += h.currentValue;
        }
      }
      grp.horizonReturnPct = weightedBase > 0 ? Number((weightedSum / weightedBase).toFixed(2)) : Number(grp.totalReturnPct.toFixed(2));

      grp.holdings = sortHoldings(grp.holdings, sortKey, sortDirection);
      return grp;
    });

    // 4. Sort the groups themselves by the selected column
    const groupFactor = sortDirection === "asc" ? 1 : -1;
    groupsArray.sort((a, b) => {
      if (sortKey === "name" || sortKey === dimensionKey) {
        return a.label.localeCompare(b.label) * groupFactor;
      }
      if (sortKey === "investedValue") {
        return (a.totalInvested - b.totalInvested) * groupFactor;
      }
      if (sortKey === "returnPct") {
        return (a.horizonReturnPct - b.horizonReturnPct) * groupFactor;
      }
      return (a.totalCurrentValue - b.totalCurrentValue) * groupFactor;
    });

    // 5. Determine Top Allocation
    let topGroup = null;
    for (const g of groupsArray) {
      if (!topGroup || g.totalCurrentValue > topGroup.totalCurrentValue) {
        topGroup = g;
      }
    }

    return {
      dimensionKey,
      sortKey,
      sortDirection,
      activeHorizon,
      kpis: {
        totalPortfolioValue: grandCurrent,
        totalPortfolioInvested: grandInvested,
        totalPortfolioGainLoss: grandGainLoss,
        totalPortfolioReturnPct: Number(grandReturnPct.toFixed(2)),
        activeHorizonReturnPct: Number(grandActiveHorizonReturn.toFixed(2)),
        topAllocationLabel: topGroup ? topGroup.label : "None",
        topAllocationPct: topGroup ? Number(topGroup.allocationPct.toFixed(1)) : 0,
        holdingsCount: holdings.length
      },
      groups: groupsArray
    };
  }

  return {
    ensureIndexed,
    convertHoldingToGoldGrams,
    computeHoldingPhysicalUnits,
    calculateInflationAdjustedTarget,
    expandGoalSlices,
    enrichHoldingsWithLiveMarket,
    filterHoldings,
    sortHoldings,
    groupBySingleDimension
  };
})();

