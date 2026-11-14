/**
 * KYF Family Portfolio Tracker — Live Market Valuation & Aggregation Engine (`js/portfolio-engine.js`)
 * Version: v1.11.2
 * Pure Vanilla ES6+ | O(1) Indexing, Live Valuation, Multi-Horizon Returns (1M, 3M, 6M, 1Y),
 * Goal Envelopes, Macro Inflation Compounding, Virtual Lot Splitting,
 * Dual-Unit Commodity & Real Estate Engine (Gold Grams + RESIDEX Sq.Ft + INR) & Divergence Detection
 */

window.KYF_PORTFOLIO_ENGINE = (() => {
  // Pre-indexed in-memory O(1) Lookup Maps
  let equityMap = null;

  // Shared outlier guard: unadjusted splits / bad NAV history must not flow into portfolio returns.
  // Mirrors the thresholds used on the Market Performance screen (stocks) and adds a tight band for debt funds.
  const RETURN_BOUNDS = {
    equity: { ret1m: [-45, 60], ret3m: [-55, 100], ret6m: [-65, 180], ret1y: [-75, 280] },
    debt: { ret1m: [-5, 5], ret3m: [-8, 10], ret6m: [-12, 15], ret1y: [-20, 25] }
  };

  function returnBoundsFor(kind, category) {
    if (kind === "fund" && /debt|liquid|money market|overnight|gilt|fixed income|bond|ultra short|low duration/i.test(category || "")) {
      return RETURN_BOUNDS.debt;
    }
    return RETURN_BOUNDS.equity;
  }

  function isSuspectReturn(value, horizon, kind, category) {
    if (value == null || isNaN(value)) return false;
    const b = returnBoundsFor(kind, category)[horizon];
    return !!b && (Number(value) < b[0] || Number(value) > b[1]);
  }

  let mfMap = null;
  let equityIsinMap = null;
  let mfIsinMap = null;
  let usMap = null;
  let isIndexed = false;

  function ensureIndexed() {
    if (isIndexed) return;

    // 1. Index NSE Equities (2,700+ stocks) by Symbol & ISIN
    equityMap = new Map();
    equityIsinMap = new Map();
    if (window.KYF_MARKET_EQUITIES && Array.isArray(window.KYF_MARKET_EQUITIES.stocks)) {
      for (const row of window.KYF_MARKET_EQUITIES.stocks) {
        // columns: ["symbol", "companyName", "closePrice", "ret1m", "ret3m", "ret6m", "ret1y", "isN500", "isin"]
        const [symbol, companyName, closePrice, ret1m, ret3m, ret6m, ret1y, isN500, isin] = row;
        const stockObj = {
          symbol,
          companyName,
          closePrice: Number(closePrice) || 0,
          ret1m: ret1m != null ? Number(ret1m) : null,
          ret3m: ret3m != null ? Number(ret3m) : null,
          ret6m: ret6m != null ? Number(ret6m) : null,
          ret1y: ret1y != null ? Number(ret1y) : null,
          isN500: isN500 === 1,
          isin: isin ? String(isin).toUpperCase() : null
        };
        equityMap.set(symbol.toUpperCase(), stockObj);
        if (stockObj.isin) {
          equityIsinMap.set(stockObj.isin, stockObj);
        }
      }
    }

    // 2. Index AMFI Mutual Funds (1,700+ schemes) by Direct Code & Direct/Regular ISIN
    mfMap = new Map();
    mfIsinMap = new Map();
    if (window.KYF_MARKET_MF && Array.isArray(window.KYF_MARKET_MF.schemes)) {
      for (const row of window.KYF_MARKET_MF.schemes) {
        // columns: ["directCode", "fundName", "category", "directNav", "regularNav", "ret1m", "ret3m", "ret6m", "ret1y", "directIsin", "regularIsin"]
        const [directCode, fundName, category, directNav, regularNav, ret1m, ret3m, ret6m, ret1y, directIsin, regularIsin] = row;
        const schemeObj = {
          directCode: Number(directCode),
          fundName,
          category,
          directNav: Number(directNav) || 0,
          regularNav: Number(regularNav) || 0,
          ret1m: ret1m != null ? Number(ret1m) : null,
          ret3m: ret3m != null ? Number(ret3m) : null,
          ret6m: ret6m != null ? Number(ret6m) : null,
          ret1y: ret1y != null ? Number(ret1y) : null,
          directIsin: directIsin ? String(directIsin).toUpperCase() : null,
          regularIsin: regularIsin ? String(regularIsin).toUpperCase() : null
        };
        mfMap.set(Number(directCode), schemeObj);
        if (schemeObj.directIsin) {
          mfIsinMap.set(schemeObj.directIsin, { scheme: schemeObj, planType: "DIRECT" });
        }
        if (schemeObj.regularIsin) {
          mfIsinMap.set(schemeObj.regularIsin, { scheme: schemeObj, planType: "REGULAR" });
        }
      }
    }

    // 3. Index US Equities & Mutual Funds (from window.KYF_MARKET_US)
    usMap = new Map();
    if (window.KYF_MARKET_US) {
      if (window.KYF_MARKET_US.byTicker && typeof window.KYF_MARKET_US.byTicker === "object") {
        for (const [ticker, obj] of Object.entries(window.KYF_MARKET_US.byTicker)) {
          usMap.set(ticker.toUpperCase(), {
            ticker: ticker.toUpperCase(),
            name: obj.name || ticker,
            closePrice: Number(obj.closePrice) || 0,
            type: obj.type || "EQUITY",
            currency: obj.currency || "USD",
            lastUpdated: obj.lastUpdated || null,
            category: obj.category || "EQUITY",
            ret1m: obj.ret1m != null ? Number(obj.ret1m) : null,
            ret3m: obj.ret3m != null ? Number(obj.ret3m) : null,
            ret6m: obj.ret6m != null ? Number(obj.ret6m) : null,
            ret1y: obj.ret1y != null ? Number(obj.ret1y) : null
          });
        }
      } else if (Array.isArray(window.KYF_MARKET_US.instruments)) {
        for (const row of window.KYF_MARKET_US.instruments) {
          if (row.length >= 11) {
            const [ticker, name, closePrice, type, currency, lastUpdated, category, ret1m, ret3m, ret6m, ret1y] = row;
            usMap.set(String(ticker).toUpperCase(), {
              ticker: String(ticker).toUpperCase(),
              name: name || ticker,
              closePrice: Number(closePrice) || 0,
              type: type || "EQUITY",
              currency: currency || "USD",
              lastUpdated: lastUpdated || null,
              category: category || "EQUITY",
              ret1m: ret1m != null ? Number(ret1m) : null,
              ret3m: ret3m != null ? Number(ret3m) : null,
              ret6m: ret6m != null ? Number(ret6m) : null,
              ret1y: ret1y != null ? Number(ret1y) : null
            });
          } else {
            const [ticker, name, closePrice, type, currency, lastUpdated, category] = row;
            usMap.set(String(ticker).toUpperCase(), {
              ticker: String(ticker).toUpperCase(),
              name: name || ticker,
              closePrice: Number(closePrice) || 0,
              type: type || "EQUITY",
              currency: currency || "USD",
              lastUpdated: lastUpdated || null,
              category: category || "EQUITY"
            });
          }
        }
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
      normalizeAssetClass(holding.assetClass) === "Commodities & Gold" ||
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

  // One USD/INR rate for the whole app: US market data, then the macro feed, then a last-resort constant.
  // `source` tells the UI when the rate is only an assumption.
  const FX_LAST_RESORT = 93.85;
  function getUsdInr() {
    const us = window.KYF_MARKET_US && Number(window.KYF_MARKET_US.fxRateUsdInr);
    if (us > 0) return { rate: us, source: "market-us" };
    const pulse = window.KYF_MARKET_PULSE && window.KYF_MARKET_PULSE.macro && Number(window.KYF_MARKET_PULSE.macro.usdInrRate);
    if (pulse > 0) return { rate: pulse, source: "pulse" };
    return { rate: FX_LAST_RESORT, source: "fallback" };
  }

  // US instrument -> the app's asset classes (an ETF is not a mutual fund; gold is gold; bonds are fixed income)
  function usAssetInfo(item) {
    const cat = (item && item.category) || "EQUITY";
    const isFund = item && item.type === "MUTUAL_FUND";
    switch (cat) {
      case "BOND": return { assetClass: "Fixed Income", subCategory: isFund ? "US Bond Fund" : "US Bond ETF" };
      case "GOLD": return { assetClass: "Commodities & Gold", subCategory: "US Gold ETF" };
      case "SILVER": return { assetClass: "Commodities & Gold", subCategory: "US Silver ETF" };
      case "REIT": return { assetClass: "Real Estate", subCategory: "US REIT ETF" };
      case "CRYPTO": return { assetClass: "Alternative", subCategory: "US Bitcoin ETF" };
      case "HYBRID": return { assetClass: isFund ? "Mutual Funds" : "Equities", subCategory: "US Balanced Fund" };
      default:
        if (isFund) return { assetClass: "Mutual Funds", subCategory: "US Index / Mutual Fund" };
        if (item && item.type === "ETF") return { assetClass: "Equities", subCategory: "US Index ETF" };
        return { assetClass: "Equities", subCategory: "US Equities" };
    }
  }

  function extractUsTicker(name) {
    if (!name) return null;
    const str = String(name).trim();
    const parenMatch = str.match(/\(([A-Za-z0-9.]+)\)/);
    if (parenMatch) return parenMatch[1].toUpperCase();
    if (/^[A-Za-z0-9.]{1,6}$/.test(str)) return str.toUpperCase();
    return null;
  }

  function isUsMutualFund({ symbol = "", name = "", rawType = "", usItem = null, defaultAssetClass = "" } = {}) {
    if (usItem && usItem.type === "MUTUAL_FUND") return true;
    if (defaultAssetClass === "Mutual Funds") return true;

    const typeStr = String(rawType || "").toLowerCase();
    if (typeStr.includes("mutual fund") || typeStr.includes("open-end") || typeStr.includes("oe fund") || typeStr === "mf") {
      return true;
    }

    const cleanSym = String(symbol || "").trim().toUpperCase();
    const cleanName = String(name || "").trim();

    // If explicitly designated as an ETF in name or type, it is an ETF, not an open-end mutual fund
    const isExplicitEtf = /\b(etf|etfs|exchange traded fund|trust|etn)\b/i.test(cleanName) ||
                          typeStr.includes("etf") || (usItem && usItem.type === "ETF");
    if (isExplicitEtf) return false;

    // Standard US Mutual Fund Ticker: 5 letters ending in 'X' (e.g. FBALX, VFIAX, VTSAX, FXAIX, FBGRX, PRGFX)
    if (/^[A-Z]{4}X$/i.test(cleanSym)) {
      return true;
    }

    // Mutual fund keywords in instrument name
    const isFundKeyword = /\b(fund|funds|balanced|allocation|lifestyle|lifecycle|target retirement|target date|admiral|investor shares|institutional|instl)\b/i.test(cleanName);
    if (isFundKeyword) {
      return true;
    }

    // Major US mutual fund families followed by fund strategy keywords (e.g. "FIDELITY BALANCED", "VANGUARD WELLINGTON")
    const isFundFamily = /^(fidelity|vanguard|t\.?\s*rowe|american funds|dodge\s*&\s*cox|schwab|pimco|franklin|putnam|blackrock|invesco)\b/i.test(cleanName);
    if (isFundFamily && /\b(balanced|growth|value|income|treasury|bond|equity|index|strategy|portfolio|dividend|select)\b/i.test(cleanName)) {
      return true;
    }

    return false;
  }

  // ==========================================================================
  // Dual-Unit Engine: Extract Holding Physical Units
  // ==========================================================================
  function computeHoldingPhysicalUnits(holding, targetPurity = "24K") {
    const meta = holding.instrumentMeta || {};
    const gramsGold = convertHoldingToGoldGrams(holding, targetPurity);
    const carpetSqft = Number(meta.carpetSqft) || 0;
    const detectedTicker = (meta.ticker || meta.symbol || extractUsTicker(holding.name) || "").toUpperCase();
    const isUs = holding.pricingMode === "LIVE_US" || (holding.currency === "USD" && holding.pricingMode !== "LIVE_EQUITY");
    const sym = detectedTicker;
    const usItem = isUs && usMap ? usMap.get(sym) : null;
    const isUsFund = (usItem && usItem.type === "MUTUAL_FUND") ||
                     holding.assetClass === "Mutual Funds" ||
                     isUsMutualFund({ symbol: sym, name: holding.name, rawType: meta.type, usItem, defaultAssetClass: holding.assetClass });
    let qty = Number(meta.quantity) || Number(holding.units) || 0;
    if (qty === 0 && isUs && usItem && usItem.closePrice > 0) {
      const usdVal = Number(holding.currentValueUSD) || (holding.currency === "USD" ? Number(holding.currentValue) : 0);
      if (usdVal > 0) qty = Number((usdVal / usItem.closePrice).toFixed(3));
    }

    return {
      gramsGold: Number(gramsGold.toFixed(2)),
      carpetSqft: Number(carpetSqft.toFixed(2)),
      sharesQty: isUs ? (isUsFund ? 0 : qty) : (Number(meta.quantity) || 0),
      mfUnits: isUs ? (isUsFund ? qty : 0) : (Number(meta.units) || 0)
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

    // Protection (cover) goals are not funded from holdings
    goals = (goals || []).filter((g) => g.kind !== "COVER");
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

      // Allocations to goals that no longer exist (or are protection goals) fall to Unallocated
      const merged = new Map();
      allocList.forEach((a) => {
        const gid = goalMap.has(a.goalId) ? a.goalId : UNALLOCATED_ID;
        merged.set(gid, (merged.get(gid) || 0) + a.percentage);
      });
      allocList = Array.from(merged, ([goalId, percentage]) => ({ goalId, percentage }));

      const totalPct = allocList.reduce((sum, a) => sum + a.percentage, 0);
      const unallocatedAt = allocList.findIndex((a) => a.goalId === UNALLOCATED_ID);

      if (totalPct < 100 && unallocatedAt >= 0) {
        allocList[unallocatedAt].percentage += 100 - totalPct;
      } else if (totalPct < 100) {
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

        // No cost basis (or a liability): the slice has none either, so it never counts as gain/loss
        const hasBasis = h.investedValue != null;

        const sliceInvested = !hasBasis
          ? null
          : isLast
            ? (h.investedValue || 0) - allocatedInvested
            : Math.round((h.investedValue || 0) * ratio);

        const sliceCurrent = isLast
          ? (h.currentValue || 0) - allocatedCurrent
          : Math.round((h.currentValue || 0) * ratio);

        const sliceGainLoss = hasBasis ? sliceCurrent - sliceInvested : null;

        if (hasBasis) allocatedInvested += sliceInvested;
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
  // Liabilities (loans, credit-card dues): stored as a positive "amount owed", carried through
  // the engine as a NEGATIVE currentValue so every total, group and member roll-up nets it off.
  // ==========================================================================
  // "Gold" was the form's spelling, "Commodities & Gold" the engine's: one canonical name for both
  function normalizeAssetClass(assetClass) {
    return assetClass === "Gold" ? "Commodities & Gold" : assetClass;
  }

  function isLiabilityHolding(h) {
    if (!h) return false;
    if (h.isLiability === true || h.assetClass === "Liabilities") return true;
    // Early builds saved the "Loan / Debt" quick-pick as an "Alternative" asset: recognise that exact signature
    return h.assetClass === "Alternative" && h.custodian === "Lending Bank" && /^home loan/i.test(h.subCategory || "");
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
      const enriched = { ...h, assetClass: normalizeAssetClass(h.assetClass) };
      const meta = h.instrumentMeta || {};
      let livePrice = 0;
      // The value the person typed (a real 0 counts); cost is only the last resort
      const typedValue = (() => {
        for (const v of [h.manualCurrentValue, h.currentValue]) {
          if (v != null && v !== "" && !isNaN(Number(v))) return Number(v);
        }
        return Number(h.investedValue) || 0;
      })();
      let calculatedValue = typedValue;
      let priceLabel = "";
      let ret1m = null;
      let ret3m = null;
      let ret6m = null;
      let ret1y = null;
      let regularAlert = null;
      let physicalUnitsLabel = "";

      // Auto-detect US Assets only when currency is USD (never promote LIVE_EQUITY or MANUAL INR holdings solely due to ticker collision)
      let effectivePricingMode = h.pricingMode;
      const detectedUsTicker = (meta.ticker || meta.symbol || extractUsTicker(h.name) || "").toUpperCase();
      if (effectivePricingMode !== "LIVE_US" && effectivePricingMode !== "LIVE_EQUITY" && h.currency === "USD") {
        if (detectedUsTicker && usMap && usMap.has(detectedUsTicker)) {
          effectivePricingMode = "LIVE_US";
          meta.ticker = detectedUsTicker;
        }
      }

      switch (effectivePricingMode) {
        case "LIVE_EQUITY": {
          const sym = (meta.symbol || "").toUpperCase();
          let stock = equityMap.get(sym);
          if (!stock && meta.isin && equityIsinMap) {
            stock = equityIsinMap.get(String(meta.isin).trim().toUpperCase());
          }
          const qty = Number(meta.quantity) || Number(h.units) || 0;
          if (stock && stock.closePrice > 0) {
            livePrice = stock.closePrice;
            calculatedValue = qty > 0 ? (qty * livePrice) : typedValue;
            ret1m = stock.ret1m;
            ret3m = stock.ret3m;
            ret6m = stock.ret6m;
            ret1y = stock.ret1y;
            priceLabel = `₹${livePrice.toLocaleString("en-IN", { minimumFractionDigits: 2 })}/sh`;
            physicalUnitsLabel = `${qty.toLocaleString("en-IN")} shares`;
          } else {
            priceLabel = sym ? `Symbol: ${sym}` : (meta.isin ? `ISIN: ${meta.isin}` : "Manual valuation");
            physicalUnitsLabel = `${qty.toLocaleString("en-IN")} shares`;
          }
          break;
        }

        case "LIVE_MF": {
          const code = Number(meta.amfiCode);
          let scheme = mfMap.get(code);
          let isDirect = null;

          // 1. ISIN lookup in mfIsinMap (unambiguous ground truth if ISIN is known)
          if (meta.isin && mfIsinMap) {
            const hit = mfIsinMap.get(String(meta.isin).trim().toUpperCase());
            if (hit) {
              if (!scheme) scheme = hit.scheme;
              isDirect = hit.planType === "DIRECT";
            }
          }

          // 2. Check meta.planType
          if (isDirect === null) {
            if (meta.planType) {
              isDirect = String(meta.planType).toUpperCase() === "DIRECT";
            } else {
              // In India, a mutual fund is Direct ONLY if explicitly named Direct or Dir
              const rawNm = h.name || "";
              isDirect = /\b(direct|dir|dp)\b/i.test(rawNm);
            }
          }

          const units = Number(meta.units) || Number(h.units) || 0;

          if (scheme) {
            livePrice = isDirect ? (scheme.directNav || scheme.regularNav) : (scheme.regularNav || scheme.directNav);
            calculatedValue = units > 0 && livePrice > 0 ? (units * livePrice) : typedValue;
            ret1m = scheme.ret1m;
            ret3m = scheme.ret3m;
            ret6m = scheme.ret6m;
            ret1y = scheme.ret1y;
            priceLabel = `NAV ₹${livePrice.toFixed(2)} (${isDirect ? "Dir" : "Reg"})`;
            physicalUnitsLabel = `${units.toLocaleString("en-IN", { maximumFractionDigits: 3 })} units`;

            if (!isDirect && scheme.directNav && scheme.regularNav && scheme.directNav > scheme.regularNav) {
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
            livePrice = Number(meta.price) || 0;
            if (livePrice > 0 && units > 0) calculatedValue = units * livePrice;
            priceLabel = Number.isFinite(code) && code > 0 ? `AMFI ${code} (${isDirect ? "Dir" : "Reg"})` : (meta.isin ? `ISIN: ${meta.isin} (${isDirect ? "Dir" : "Reg"})` : `Manual (${isDirect ? "Dir" : "Reg"})`);
            physicalUnitsLabel = `${units.toLocaleString("en-IN", { maximumFractionDigits: 3 })} units`;
          }
          break;
        }

        case "LIVE_US": {
          const sym = (meta.ticker || meta.symbol || extractUsTicker(h.name) || "").toUpperCase();
          const usItem = usMap ? usMap.get(sym) : null;
          const fxInfo = getUsdInr();
          const fxRate = fxInfo.rate;
          enriched.fxSource = fxInfo.source;
          let qty = Number(meta.quantity) != null && !isNaN(Number(meta.quantity)) && Number(meta.quantity) > 0
            ? Number(meta.quantity)
            : (Number(h.units) || 0);

          if (usItem && usItem.closePrice > 0) {
            livePrice = usItem.closePrice;
            let curValUSD = 0;
            if (qty > 0) {
              curValUSD = qty * livePrice;
            } else if (Number(h.currentValueUSD) > 0) {
              curValUSD = Number(h.currentValueUSD);
              qty = Number((curValUSD / livePrice).toFixed(3));
            } else if (h.currency === "USD") {
              curValUSD = typedValue;
              qty = Number((curValUSD / livePrice).toFixed(3));
            } else if (typedValue > 0 && typedValue < 100000 && !h.isLiability) {
              // The user typed the value in USD into the form ($807)
              curValUSD = typedValue;
              qty = Number((curValUSD / livePrice).toFixed(3));
            } else if (typedValue > 0) {
              curValUSD = typedValue / fxRate;
              qty = Number((curValUSD / livePrice).toFixed(3));
            } else if (Number(h.investedValueUSD) > 0) {
              curValUSD = Number(h.investedValueUSD);
              qty = Number((curValUSD / livePrice).toFixed(3));
            }

            calculatedValue = Math.round(curValUSD * fxRate);
            ret1m = usItem.ret1m;
            ret3m = usItem.ret3m;
            ret6m = usItem.ret6m;
            ret1y = usItem.ret1y;

            const finalQty = qty > 0 ? qty : Number((curValUSD / livePrice).toFixed(3));
            const formattedUnits = finalQty % 1 === 0
              ? finalQty.toLocaleString("en-US")
              : finalQty.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 4 });
            const unitName = usItem.type === "MUTUAL_FUND" ? "units" : "shares";

            priceLabel = `$${livePrice.toFixed(2)} (₹${Math.round(livePrice * fxRate).toLocaleString("en-IN")})`;
            physicalUnitsLabel = `${formattedUnits} ${unitName}`;

            const usInfo = usAssetInfo(usItem);
            enriched.assetClass = usInfo.assetClass;
            enriched.subCategory = usInfo.subCategory;
            enriched.currency = "USD";
            enriched.fxRate = fxRate;
            enriched.priceUSD = livePrice;
            enriched.currentValueUSD = Number(curValUSD.toFixed(2));
            if (meta.avgBuyPrice != null && meta.avgBuyPrice !== "") {
              enriched.avgBuyPriceUSD = Number(meta.avgBuyPrice);
            }
            // The cost the person entered or imported wins; average price x quantity is only the fallback
            if (Number(h.investedValueUSD) > 0) {
              enriched.investedValueUSD = Number(h.investedValueUSD);
            } else if (qty > 0 && enriched.avgBuyPriceUSD > 0) {
              enriched.investedValueUSD = Number((qty * enriched.avgBuyPriceUSD).toFixed(2));
            }
          } else {
            livePrice = Number(meta.price) || Number(meta.avgBuyPrice) || 0;
            let curValUSD = 0;
            if (qty > 0 && livePrice > 0) {
              curValUSD = qty * livePrice;
            } else if (Number(h.currentValueUSD) > 0) {
              curValUSD = Number(h.currentValueUSD);
            } else if (h.currency === "USD") {
              curValUSD = typedValue;
            } else if (typedValue > 0 && typedValue < 100000 && !h.isLiability) {
              curValUSD = typedValue;
            } else {
              curValUSD = typedValue > 0 ? (typedValue / fxRate) : 0;
            }
            calculatedValue = Math.round(curValUSD * fxRate);
            priceLabel = sym ? `No live price for ${sym} ($)` : "Manual US ($)";
            if (Number(h.investedValueUSD) > 0) {
              enriched.investedValueUSD = Number(h.investedValueUSD);
            } else if (meta.avgBuyPrice != null && meta.avgBuyPrice !== "" && qty > 0) {
              enriched.avgBuyPriceUSD = Number(meta.avgBuyPrice);
              enriched.investedValueUSD = Number((qty * enriched.avgBuyPriceUSD).toFixed(2));
            }
            const isFund = (h.assetClass === "Mutual Funds") ||
              isUsMutualFund({ symbol: sym, name: h.name, rawType: meta.type, usItem, defaultAssetClass: h.assetClass });
            const unitName = isFund ? "units" : "shares";
            const formattedUnits = qty % 1 === 0
              ? qty.toLocaleString("en-US")
              : qty.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 4 });
            physicalUnitsLabel = `${formattedUnits} ${unitName}`;
            if (isFund) {
              enriched.assetClass = "Mutual Funds";
              if (!enriched.subCategory || enriched.subCategory === "US Equities") {
                enriched.subCategory = /balanced|allocation/i.test(h.name) ? "US Balanced Fund" : "US Index / Mutual Fund";
              }
            }
            enriched.currency = "USD";
            enriched.fxRate = fxRate;
            enriched.currentValueUSD = Number(curValUSD.toFixed(2));
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
          } else if (!(grams > 0)) {
            // No weight entered: keep the value the person typed instead of showing ₹0
            priceLabel = "Manual valuation";
            physicalUnitsLabel = `${purity} gold (weight not set)`;
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
          if (sqft > 0) {
            calculatedValue = sqft * livePrice;
            priceLabel = `₹${livePrice.toLocaleString("en-IN")}/sq.ft (NHB)`;
            physicalUnitsLabel = `${sqft.toLocaleString("en-IN")} sq.ft (${city})`;
          } else {
            // No area entered: keep the typed value instead of showing ₹0
            priceLabel = "Manual valuation";
            physicalUnitsLabel = `${city} (area not set)`;
          }

          // Real Estate Returns from NHB RESIDEX City Summary
          const residexCity = window.KYF_RESIDEX && window.KYF_RESIDEX.cities && window.KYF_RESIDEX.cities[city];
          const citySum = residexCity && residexCity.summary ? residexCity.summary : null;
          const yoy = citySum && citySum.carpet_price_yoy_pct != null
            ? Number(citySum.carpet_price_yoy_pct)
            : (citySum && citySum.hpi_yoy_pct != null ? Number(citySum.hpi_yoy_pct) : 9.8);
          const qoq = citySum && citySum.carpet_price_qoq_pct != null
            ? Number(citySum.carpet_price_qoq_pct)
            : (citySum && citySum.hpi_qoq_pct != null ? Number(citySum.hpi_qoq_pct) : 2.5);

          ret1y = Number(yoy.toFixed(1));
          ret3m = Number(qoq.toFixed(1));
          ret6m = Number((((1 + qoq / 100) ** 2 - 1) * 100).toFixed(1));
          ret1m = Number((((1 + qoq / 100) ** (1 / 3) - 1) * 100).toFixed(1));
          break;
        }

        case "MACRO_LINKED":
        case "MANUAL":
        default: {
          calculatedValue = typedValue;
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

      if (isLiabilityHolding(h)) {
        const owed = Math.abs(Math.round(Number(h.manualCurrentValue) || Number(calculatedValue) || 0));
        const rate = meta.interestRate != null && meta.interestRate !== "" ? Number(meta.interestRate) : null;
        enriched.isLiability = true;
        enriched.assetClass = "Liabilities";
        enriched.currentValue = -owed;
        enriched.investedValue = null;
        enriched.gainLoss = null;
        enriched.totalReturnPct = null;
        enriched.returnPct = null;
        enriched.activeHorizonReturn = null;
        enriched.activeHorizonLabel = "Debt";
        enriched.priceLabel = rate != null && !isNaN(rate) ? `Interest: ${rate}% p.a.` : "Outstanding balance";
        enriched.physicalUnitsLabel = h.subCategory || "Loan outstanding";
        enriched.ret1m = enriched.ret3m = enriched.ret6m = enriched.ret1y = null;
        enriched.regularAlert = null;
        return enriched;
      }

      // US holdings: the rupee cost is always the dollar cost x the rate on the day it was bought.
      // Without a "rate when bought" the rupee gain equals the dollar gain (no currency effect is claimed).
      let investedForGain = h.investedValue;
      if (effectivePricingMode === "LIVE_US" && enriched.investedValueUSD > 0) {
        const boughtFx = Number(meta.purchaseFxRate) > 0 ? Number(meta.purchaseFxRate) : (enriched.fxRate || getUsdInr().rate);
        investedForGain = Math.round(enriched.investedValueUSD * boughtFx);
        enriched.purchaseFxRate = Number(meta.purchaseFxRate) > 0 ? Number(meta.purchaseFxRate) : null;
        enriched.fxEffectIncluded = enriched.purchaseFxRate != null;
      }

      const hasBasis = investedForGain != null && investedForGain !== "" && !isNaN(Number(investedForGain)) && Number(investedForGain) > 0;
      const invested = hasBasis ? Number(investedForGain) : null;
      const gainLoss = hasBasis ? (calculatedValue - invested) : null;
      const totalReturnPct = hasBasis && invested > 0 ? ((gainLoss / invested) * 100) : null;

      let activeHorizonReturn = totalReturnPct;
      let activeHorizonLabel = hasBasis ? "All-Time Gain" : "Basis Unknown";

      switch (activeHorizon) {
        case "1m":
          activeHorizonReturn = ret1m != null ? ret1m : totalReturnPct;
          activeHorizonLabel = ret1m != null ? "1M Momentum" : (hasBasis ? "1M Momentum" : "Basis Unknown");
          break;
        case "3m":
          activeHorizonReturn = ret3m != null ? ret3m : totalReturnPct;
          activeHorizonLabel = ret3m != null ? "3M Momentum" : (hasBasis ? "3M Momentum" : "Basis Unknown");
          break;
        case "6m":
          activeHorizonReturn = ret6m != null ? ret6m : totalReturnPct;
          activeHorizonLabel = ret6m != null ? "6M Momentum" : (hasBasis ? "6M Momentum" : "Basis Unknown");
          break;
        case "1y":
          activeHorizonReturn = ret1y != null ? ret1y : totalReturnPct;
          activeHorizonLabel = ret1y != null ? "1Y Trailing" : (hasBasis ? "1Y Trailing" : "Basis Unknown");
          break;
        case "all":
        default:
          activeHorizonReturn = totalReturnPct;
          activeHorizonLabel = hasBasis ? "Absolute Return" : "Basis Unknown";
          break;
      }

      // Outlier guard on market-sourced returns
      const isUsHolding = effectivePricingMode === "LIVE_US";
      const usItem = isUsHolding && usMap ? usMap.get((meta.ticker || meta.symbol || "").toUpperCase()) : null;
      const guardKind = (effectivePricingMode === "LIVE_MF" || (isUsHolding && usItem && usItem.type === "MUTUAL_FUND")) ? "fund" : "stock";
      const guardCategory = effectivePricingMode === "LIVE_MF" && mfMap ? ((mfMap.get(Number(meta.amfiCode)) || {}).category || "") : "";
      const suspectHorizons = [];
      if (effectivePricingMode === "LIVE_MF" || effectivePricingMode === "LIVE_EQUITY" || effectivePricingMode === "LIVE_US") {
        const rets = { ret1m, ret3m, ret6m, ret1y };
        for (const k of Object.keys(rets)) {
          if (isSuspectReturn(rets[k], k, guardKind, guardCategory)) suspectHorizons.push(k);
        }
        if (suspectHorizons.includes("ret1m")) ret1m = null;
        if (suspectHorizons.includes("ret3m")) ret3m = null;
        if (suspectHorizons.includes("ret6m")) ret6m = null;
        if (suspectHorizons.includes("ret1y")) ret1y = null;
        const activeKey = "ret" + activeHorizon;
        if (suspectHorizons.includes(activeKey)) {
          activeHorizonReturn = null;
          activeHorizonLabel = "Data suspect";
        }
      }
      enriched.suspectHorizons = suspectHorizons;
      enriched.pricingMode = effectivePricingMode;

      enriched.currentValue = Math.round(calculatedValue);
      enriched.investedValue = invested != null ? Math.round(invested) : null;
      enriched.gainLoss = gainLoss != null ? Math.round(gainLoss) : null;
      enriched.totalReturnPct = totalReturnPct != null ? Number(totalReturnPct.toFixed(2)) : null;
      enriched.returnPct = enriched.totalReturnPct;
      if (effectivePricingMode === "LIVE_US") {
        if (enriched.currentValueUSD != null && enriched.investedValueUSD != null && enriched.investedValueUSD > 0) {
          enriched.gainLossUSD = Number((enriched.currentValueUSD - enriched.investedValueUSD).toFixed(2));
          enriched.returnPctUSD = Number((((enriched.currentValueUSD - enriched.investedValueUSD) / enriched.investedValueUSD) * 100).toFixed(2));
        }
      }
      enriched.activeHorizonReturn = activeHorizonReturn != null ? Number(activeHorizonReturn.toFixed(2)) : null;
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
        const itemKey = dimensionValue(h, activeDimension);

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

  // Same stock / fund / ETF => same key, wherever and by whomever it is held
  function instrumentKey(h) {
    const m = (h && h.instrumentMeta) || {};
    const usd = (h && (h.currency === "USD" || h.pricingMode === "LIVE_US")) ? "us:" : "";
    const code = m.amfiCode || m.schemeCode;
    if (code) return "mf:" + String(code).trim();
    const sym = String(m.symbol || m.ticker || "").trim().toUpperCase();
    if (sym) return usd + "sym:" + sym;
    const isin = String(m.isin || "").trim().toUpperCase();
    if (isin) return "isin:" + isin;
    return "name:" + String((h && h.name) || "").trim().toLowerCase();
  }

  // What a holding is grouped / filtered by in the active view lens
  function dimensionValue(h, dimensionKey) {
    if (dimensionKey === "goal") return h.goalId || h.goal || "goal_unallocated";
    if (dimensionKey === "instrument") return instrumentKey(h);
    return h[dimensionKey] || "Other / Unassigned";
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
    let grandWeightedHorizonBase = 0;
    let grandTrackedInvested = 0;
    let grandTrackedGainLoss = 0;
    let grandAssets = 0;
    let grandLiabilities = 0;

    for (const h of holdings) {
      if ((h.currentValue || 0) < 0) grandLiabilities += -h.currentValue;
      else grandAssets += h.currentValue || 0;
      if (h.investedValue != null) {
        grandInvested += h.investedValue;
        grandTrackedInvested += h.investedValue;
        if (h.gainLoss != null) {
          grandTrackedGainLoss += h.gainLoss;
        }
      }
      grandCurrent += h.currentValue || 0;
      if (h.activeHorizonReturn != null && (h.currentValue || 0) > 0) {
        grandWeightedHorizonReturn += (h.activeHorizonReturn * h.currentValue);
        grandWeightedHorizonBase += h.currentValue;
      }
    }

    const grandGainLoss = grandTrackedGainLoss;
    const grandReturnPct = grandTrackedInvested > 0 ? (grandTrackedGainLoss / grandTrackedInvested) * 100 : null;
    const grandActiveHorizonReturn = grandWeightedHorizonBase > 0 ? (grandWeightedHorizonReturn / grandWeightedHorizonBase) : grandReturnPct;

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
      } else if (dimensionKey === "instrument") {
        groupKey = instrumentKey(h);
        groupLabel = h.name || groupKey;
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
          trackedInvested: 0,
          trackedGainLoss: 0,
          totalCurrentValue: 0,
          totalGainLoss: 0,
          totalReturnPct: null,
          horizonReturnPct: null,
          allocationPct: 0,
          progressPct: null,
          adjustedTargetINR: (goalMeta && goalMeta.inflation && goalMeta.inflation.adjustedTargetINR) || 0,
          dualUnit: null,
          physicalSummary: null
        });
      }

      const grp = groupsMap.get(groupKey);
      grp.holdings.push(h);
      if (h.investedValue != null) {
        grp.totalInvested += h.investedValue;
        grp.trackedInvested += h.investedValue;
        if (h.gainLoss != null) {
          grp.trackedGainLoss += h.gainLoss;
        }
      }
      grp.totalCurrentValue += h.currentValue || 0;
    }

    // 3. Finalize group rollups with weighted-average returns, dual-unit math & divergence
    const groupsArray = Array.from(groupsMap.values()).map((grp) => {
      grp.totalGainLoss = grp.trackedGainLoss;
      grp.totalReturnPct = grp.trackedInvested > 0 ? (grp.trackedGainLoss / grp.trackedInvested) * 100 : null;
      // Share of gross assets (a debt group therefore shows as a negative % of what you own)
      grp.allocationPct = grandAssets > 0 ? (grp.totalCurrentValue / grandAssets) * 100 : 0;

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
      grp.horizonReturnPct = weightedBase > 0 ? Number((weightedSum / weightedBase).toFixed(2)) : (grp.totalReturnPct != null ? Number(grp.totalReturnPct.toFixed(2)) : null);

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
        const retA = a.horizonReturnPct != null ? a.horizonReturnPct : -Infinity;
        const retB = b.horizonReturnPct != null ? b.horizonReturnPct : -Infinity;
        return (retA - retB) * groupFactor;
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
        totalAssets: grandAssets,
        totalLiabilities: grandLiabilities,
        totalPortfolioInvested: grandInvested,
        totalPortfolioGainLoss: grandGainLoss,
        totalPortfolioReturnPct: grandReturnPct != null ? Number(grandReturnPct.toFixed(2)) : null,
        activeHorizonReturnPct: grandActiveHorizonReturn != null ? Number(grandActiveHorizonReturn.toFixed(2)) : null,
        topAllocationLabel: topGroup ? topGroup.label : "None",
        topAllocationPct: topGroup ? Number(topGroup.allocationPct.toFixed(1)) : 0,
        holdingsCount: holdings.length
      },
      groups: groupsArray
    };
  }

  function lookupByIsin(isin) {
    ensureIndexed();
    if (!isin) return null;
    const key = String(isin).trim().toUpperCase();
    if (equityIsinMap && equityIsinMap.has(key)) {
      return { kind: "EQUITY", stock: equityIsinMap.get(key) };
    }
    if (mfIsinMap && mfIsinMap.has(key)) {
      const hit = mfIsinMap.get(key);
      return { kind: "MF", scheme: hit.scheme, planType: hit.planType };
    }
    return null;
  }

  function lookupEquityBySymbol(symbol) {
    ensureIndexed();
    if (!symbol) return null;
    return equityMap.get(String(symbol).trim().toUpperCase()) || null;
  }

  function lookupMfByCode(amfiCode) {
    ensureIndexed();
    return mfMap.get(Number(amfiCode)) || null;
  }

  function lookupEquity(symbol, isin, name) {
    ensureIndexed();
    if (isin) {
      const cleanIsin = String(isin).trim().toUpperCase();
      if (equityIsinMap && equityIsinMap.has(cleanIsin)) {
        return equityIsinMap.get(cleanIsin);
      }
    }
    if (symbol) {
      const cleanSym = String(symbol).trim().toUpperCase();
      if (equityMap && equityMap.has(cleanSym)) {
        return equityMap.get(cleanSym);
      }
    }
    return null;
  }

  function lookupMf(amfiCode, isin, name) {
    ensureIndexed();
    if (isin) {
      const cleanIsin = String(isin).trim().toUpperCase();
      if (mfIsinMap && mfIsinMap.has(cleanIsin)) {
        return mfIsinMap.get(cleanIsin);
      }
    }
    if (amfiCode) {
      const numCode = Number(amfiCode);
      if (mfMap && mfMap.has(numCode)) {
        return { scheme: mfMap.get(numCode), planType: "DIRECT" };
      }
    }
    return null;
  }

  function lookupUsByTicker(ticker) {
    ensureIndexed();
    if (!ticker) return null;
    return usMap ? (usMap.get(String(ticker).trim().toUpperCase()) || null) : null;
  }

  return {
    ensureIndexed,
    lookupByIsin,
    lookupEquityBySymbol,
    lookupMfByCode,
    lookupEquity,
    lookupMf,
    lookupUsByTicker,
    isUsMutualFund,
    instrumentKey,
    dimensionValue,
    getUsdInr,
    usAssetInfo,
    convertHoldingToGoldGrams,
    computeHoldingPhysicalUnits,
    calculateInflationAdjustedTarget,
    expandGoalSlices,
    enrichHoldingsWithLiveMarket,
    isLiabilityHolding,
    normalizeAssetClass,
    isSuspectReturn,
    filterHoldings,
    sortHoldings,
    groupBySingleDimension
  };
})();

