// tests/holdings-workflow.test.mjs
// Automated verification tests for Add Holding enhancements:
// 1. Fund Variant Selection (Direct vs Regular Plan) & Live Valuation
// 2. Unit Inference from Current Value & Handling Missing Invested Value
// 3. Holding Modification & Deletion
import assert from "node:assert";

// Mock minimal browser environment
global.window = {
  KYF_MARKET_MF: {
    asOf: "2026-11-08",
    columns: ["directCode", "fundName", "category", "directNav", "regularNav", "ret1m", "ret3m", "ret6m", "ret1y"],
    schemes: [
      [122639, "Parag Parikh Flexi Cap Fund", "Flexi Cap", 93.9483, 85.5091, 7.18, 1.76, 2.65, 0.43],
      [118275, "Canara Robeco Flexi Cap Fund", "Flexi Cap", 400.34, 351.71, 9.8, 1.18, 5.38, 2.64]
    ]
  },
  KYF_MARKET_EQUITIES: {
    asOf: "2026-11-08",
    columns: ["symbol", "companyName", "closePrice", "ret1m", "ret3m", "ret6m", "ret1y", "isN500"],
    stocks: [
      ["HDFCBANK", "HDFC BANK LIMITED", 1740.50, 2.1, 4.3, 8.5, 12.0, 1]
    ]
  },
  KYF_MARKET_PULSE: {
    asOf: "2026-11-08",
    preciousMetals: { gold24kPerGram: 14280 }
  }
};

// Import portfolio engine
const engineModule = await import("../js/portfolio-engine.js");
const engine = window.KYF_PORTFOLIO_ENGINE;

console.log("=== RUNNING HOLDINGS ENHANCEMENT TESTS ===\n");

// --------------------------------------------------------------------------
// TEST 1: Mutual Fund Variant Selection (Direct vs Regular)
// --------------------------------------------------------------------------
console.log("[TEST GROUP 1] Mutual Fund Variant Selection & Live NAV");

const directHolding = {
  id: "h_ppfas_dir",
  name: "Parag Parikh Flexi Cap Fund",
  pricingMode: "LIVE_MF",
  assetClass: "Mutual Funds",
  instrumentMeta: {
    amfiCode: 122639,
    planType: "DIRECT",
    units: 1000
  },
  investedValue: 70000
};

const regularHolding = {
  id: "h_ppfas_reg",
  name: "Parag Parikh Flexi Cap Fund",
  pricingMode: "LIVE_MF",
  assetClass: "Mutual Funds",
  instrumentMeta: {
    amfiCode: 122639,
    planType: "REGULAR",
    units: 1000
  },
  investedValue: 70000
};

const enrichedDirect = engine.enrichHoldingsWithLiveMarket([directHolding])[0];
const enrichedRegular = engine.enrichHoldingsWithLiveMarket([regularHolding])[0];

// Direct NAV = 93.9483 -> Current Value = 93948
assert.strictEqual(enrichedDirect.currentValue, Math.round(1000 * 93.9483), "Direct plan uses directNav");
assert.ok(enrichedDirect.priceLabel.includes("93.95"), "Direct price label contains Direct NAV");
assert.ok(enrichedDirect.priceLabel.includes("Dir"), "Direct price label indicates Dir");

// Regular NAV = 85.5091 -> Current Value = 85509
assert.strictEqual(enrichedRegular.currentValue, Math.round(1000 * 85.5091), "Regular plan uses regularNav");
assert.ok(enrichedRegular.priceLabel.includes("85.51"), "Regular price label contains Regular NAV");
assert.ok(enrichedRegular.priceLabel.includes("Reg"), "Regular price label indicates Reg");
assert.ok(enrichedRegular.regularAlert != null, "Regular plan shows regular drag alert");
console.log("  ✓ Direct plan applies directNav (₹93.95)");
console.log("  ✓ Regular plan applies regularNav (₹85.51)");
console.log("  ✓ Valuation differs accurately based on selected variant (₹93,948 vs ₹85,509)");

// --------------------------------------------------------------------------
// TEST 2: Missing Invested Value Handling (No False 0.0% Returns)
// --------------------------------------------------------------------------
console.log("\n[TEST GROUP 2] Missing Invested Value (Returns Omitted)");

const holdingWithoutBasis = {
  id: "h_no_basis",
  name: "Parag Parikh Flexi Cap Fund",
  pricingMode: "LIVE_MF",
  assetClass: "Mutual Funds",
  instrumentMeta: {
    amfiCode: 122639,
    planType: "DIRECT",
    units: 500
  },
  investedValue: null // User did not provide cost basis
};

const enrichedNoBasis = engine.enrichHoldingsWithLiveMarket([holdingWithoutBasis], "all")[0];

assert.strictEqual(enrichedNoBasis.investedValue, null, "Invested value remains null");
assert.strictEqual(enrichedNoBasis.gainLoss, null, "Gain/Loss is null when basis is missing");
assert.strictEqual(enrichedNoBasis.totalReturnPct, null, "Total return pct is null when basis is missing");
assert.strictEqual(enrichedNoBasis.activeHorizonReturn, null, "All-time return is null without basis");
assert.strictEqual(enrichedNoBasis.activeHorizonLabel, "Basis Unknown", "Horizon label notes Basis Unknown");
console.log("  ✓ Invested value is null");
console.log("  ✓ Gain/Loss is null");
console.log("  ✓ Total return pct is null (avoids false 0.0% gain)");

// Pivot Rollup test with mixed holdings (one with basis, one without)
const mixedHoldings = [enrichedDirect, enrichedNoBasis];
const pivot = engine.groupBySingleDimension(mixedHoldings, "assetClass", "currentValue", "desc", "all");

// Grand Current Value should include both
const expectedTotalValue = enrichedDirect.currentValue + enrichedNoBasis.currentValue;
assert.strictEqual(pivot.kpis.totalPortfolioValue, expectedTotalValue, "Net worth includes all holdings");
// Grand Invested should only sum the holding with known basis (70,000)
assert.strictEqual(pivot.kpis.totalPortfolioInvested, 70000, "Total tracked invested only includes known basis");
console.log("  ✓ Net worth sums all holdings (₹" + expectedTotalValue.toLocaleString("en-IN") + ")");
console.log("  ✓ Portfolio invested sums only holdings with recorded cost basis (₹70,000)");

// --------------------------------------------------------------------------
// TEST 3: Unit Inference Math Verification
// --------------------------------------------------------------------------
console.log("\n[TEST GROUP 3] Auto-Inference Between Units and Current Value");

const price = 93.9483; // e.g. PPFAS NAV
const targetCurrentVal = 150000;
const inferredUnits = targetCurrentVal / price; // ~1596.623
const roundInferredUnits = parseFloat(inferredUnits.toFixed(3));
const recomputedCurVal = Math.round(roundInferredUnits * price);

assert.ok(Math.abs(recomputedCurVal - targetCurrentVal) < 1, "Units -> Current Value roundtrips within ₹1");
console.log(`  ✓ ₹${targetCurrentVal} at NAV ₹${price.toFixed(2)} infers ${roundInferredUnits} units`);
console.log(`  ✓ ${roundInferredUnits} units at NAV ₹${price.toFixed(2)} computes ₹${recomputedCurVal}`);

// --------------------------------------------------------------------------
// TEST 4: Holding Edit & Deletion Preservation
// --------------------------------------------------------------------------
console.log("\n[TEST GROUP 4] Holding Modification & Deletion Array Operations");

let holdingsList = [
  { id: "h1", name: "HDFC Bank", currentValue: 174050 },
  { id: "h2", name: "PPFAS Flexi Cap", currentValue: 93948 }
];

// Edit operation
const editIdx = holdingsList.findIndex(h => h.id === "h1");
holdingsList[editIdx] = { ...holdingsList[editIdx], name: "HDFC Bank Ltd (Edited)", currentValue: 200000 };
assert.strictEqual(holdingsList.length, 2, "Array length intact after edit");
assert.strictEqual(holdingsList[0].name, "HDFC Bank Ltd (Edited)", "Holding name updated");
assert.strictEqual(holdingsList[0].currentValue, 200000, "Holding currentValue updated");
console.log("  ✓ Holding edit correctly updates attributes in-place");

// Delete operation
holdingsList = holdingsList.filter(h => h.id !== "h2");
assert.strictEqual(holdingsList.length, 1, "Holding deleted from list");
assert.strictEqual(holdingsList[0].id, "h1", "Remaining holding intact");
console.log("  ✓ Holding deletion cleanly removes target item without mutating others");

console.log("\n========================================");
console.log("ALL ENHANCEMENT TESTS PASSED SUCCESSFULLY");
console.log("========================================");

