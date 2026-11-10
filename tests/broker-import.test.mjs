/**
 * KYF (Know Your Finance) — Broker Importer & ISIN Sync Test Suite
 * Tests:
 * 1. Market Equities & MF ISIN indexing
 * 2. O(1) Engine lookups (lookupByIsin, lookupEquity, lookupMf)
 * 3. Enrichment fallback to ISIN
 * 4. CSV parsing with Indian comma numbers
 * 5. Broker header & profile detection across formats (Zerodha Kite, Console, Groww, ICICI, CAMS)
 * 6. SGB and Gold ETF resolution
 * 7. Smart upsert deduplication and goal envelope allocation preservation
 */

import { strict as assert } from "node:assert";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const BASE_DIR = path.resolve(".");

// Setup global context for browser script loading
const sandbox = {
  window: {},
  console,
  document: {
    createElement: () => ({ setAttribute: () => {}, appendChild: () => {} }),
    head: { appendChild: () => {} }
  }
};
sandbox.window = sandbox;
vm.createContext(sandbox);

function loadScript(relPath) {
  const code = fs.readFileSync(path.join(BASE_DIR, relPath), "utf-8");
  vm.runInContext(code, sandbox);
}

// Load datasets and engine
loadScript("data/market-equities.js");
loadScript("data/market-mf.js");
loadScript("data/market-pulse.js");
loadScript("js/portfolio-engine.js");
loadScript("js/portfolio-importer.js");

const engine = sandbox.window.KYF_PORTFOLIO_ENGINE;
const importer = sandbox.window.KYF_BROKER_IMPORTER;

let totalPassed = 0;
function test(desc, fn) {
  try {
    fn();
    console.log(`  ✓ ${desc}`);
    totalPassed++;
  } catch (err) {
    console.error(`  ✗ ${desc}`);
    console.error(err);
    process.exit(1);
  }
}

console.log("\n=== RUNNING BROKER IMPORT & ISIN SYNC TESTS ===");

console.log("\n[TEST GROUP 1] Market Datasets & ISIN Columns");
test("Equities dataset contains ISIN column at index 8", () => {
  assert.ok(sandbox.window.KYF_MARKET_EQUITIES, "KYF_MARKET_EQUITIES exists");
  assert.equal(sandbox.window.KYF_MARKET_EQUITIES.columns[8], "isin");
  const sampleStock = sandbox.window.KYF_MARKET_EQUITIES.stocks.find(s => s[0] === "360ONE");
  assert.ok(sampleStock, "Found 360ONE");
  assert.equal(sampleStock[8], "INE466L01038", "360ONE has correct ISIN");
});

test("MF dataset contains directIsin & regularIsin columns at index 9 and 10", () => {
  assert.ok(sandbox.window.KYF_MARKET_MF, "KYF_MARKET_MF exists");
  assert.equal(sandbox.window.KYF_MARKET_MF.columns[9], "directIsin");
  assert.equal(sandbox.window.KYF_MARKET_MF.columns[10], "regularIsin");
  const sampleScheme = sandbox.window.KYF_MARKET_MF.schemes.find(s => s[0] === 103490);
  assert.ok(sampleScheme, "Found Quantum Value Fund");
  assert.equal(sampleScheme[9], "INF082J01036", "Direct ISIN matches");
  assert.equal(sampleScheme[10], "INF082J01242", "Regular ISIN matches");
});

console.log("\n[TEST GROUP 2] Engine ISIN Lookup Maps & Helpers");
test("lookupByIsin resolves Equities", () => {
  const res = engine.lookupByIsin("INE466L01038");
  assert.ok(res, "Lookup result returned");
  assert.equal(res.kind, "EQUITY");
  assert.equal(res.stock.symbol, "360ONE");
});

test("lookupByIsin resolves Direct Mutual Funds", () => {
  const res = engine.lookupByIsin("INF082J01036");
  assert.ok(res, "Lookup result returned");
  assert.equal(res.kind, "MF");
  assert.equal(res.scheme.directCode, 103490);
  assert.equal(res.planType, "DIRECT");
});

test("lookupByIsin resolves Regular Mutual Funds", () => {
  const res = engine.lookupByIsin("INF082J01242");
  assert.ok(res, "Lookup result returned");
  assert.equal(res.kind, "MF");
  assert.equal(res.scheme.directCode, 103490);
  assert.equal(res.planType, "REGULAR");
});

test("lookupEquity resolves by ISIN or Symbol", () => {
  const byIsin = engine.lookupEquity(null, "INE466L01038");
  assert.ok(byIsin && byIsin.symbol === "360ONE");
  const bySym = engine.lookupEquity("360ONE");
  assert.ok(bySym && bySym.symbol === "360ONE");
});

test("lookupMf resolves by ISIN or AMFI code", () => {
  const byIsin = engine.lookupMf(null, "INF082J01036");
  assert.ok(byIsin && byIsin.scheme.directCode === 103490);
  const byCode = engine.lookupMf(103490);
  assert.ok(byCode && byCode.scheme.directCode === 103490);
});

console.log("\n[TEST GROUP 3] Live Enrichment Fallback to ISIN");
test("LIVE_EQUITY enriches via ISIN when symbol is omitted", () => {
  const raw = [{
    id: "h_test_1",
    name: "360 One WAM",
    assetClass: "Equities",
    pricingMode: "LIVE_EQUITY",
    units: 10,
    investedValue: 10000,
    instrumentMeta: { isin: "INE466L01038" } // No symbol!
  }];
  const enriched = engine.enrichHoldingsWithLiveMarket(raw);
  assert.equal(enriched.length, 1);
  assert.ok(enriched[0].currentValue > 0, "Calculated current value from ISIN price");
  assert.ok(enriched[0].priceLabel.includes("/sh"), "Has price per share label");
});

test("LIVE_MF enriches via ISIN when amfiCode is omitted", () => {
  const raw = [{
    id: "h_test_2",
    name: "Quantum Value Fund",
    assetClass: "Mutual Funds",
    pricingMode: "LIVE_MF",
    units: 100,
    investedValue: 10000,
    instrumentMeta: { isin: "INF082J01036" } // No amfiCode!
  }];
  const enriched = engine.enrichHoldingsWithLiveMarket(raw);
  assert.equal(enriched.length, 1);
  assert.ok(enriched[0].currentValue > 0, "Calculated current value from ISIN NAV");
  assert.ok(enriched[0].priceLabel.includes("Dir"), "Auto-detected Direct plan");
});

console.log("\n[TEST GROUP 4] Broker Statement Parsing & Fingerprinting");
test("RFC-4180 CSV parser handles Indian commas inside quotes", () => {
  const csv = 'Symbol,ISIN,Qty,Avg Price\n"RELIANCE","INE002A01018","50","1,250.50"\n';
  const matrix = importer.parseCSVToMatrix(csv);
  assert.equal(matrix.length, 2);
  assert.equal(matrix[1][0], "RELIANCE");
  assert.equal(matrix[1][3], "1,250.50");
});

test("Detects Zerodha Console statement", () => {
  const matrix = [
    ["Zerodha Broking Limited - Holdings"],
    ["Client ID: AB1234"],
    ["Symbol", "ISIN", "Sector", "Quantity Available", "Average Price", "Previous Closing Price"]
  ];
  const detected = importer.detectHeaderAndBroker(matrix);
  assert.ok(detected);
  assert.equal(detected.profile.id, "ZERODHA_CONSOLE");
});

test("Detects Zerodha Kite statement", () => {
  const matrix = [
    ["Holdings (12)"],
    ["Instrument", "Qty.", "Avg. cost", "LTP", "Cur. val", "P&L", "Net chg."]
  ];
  const detected = importer.detectHeaderAndBroker(matrix);
  assert.ok(detected);
  assert.equal(detected.profile.id, "ZERODHA_KITE");
});

test("Detects Groww Mutual Fund statement", () => {
  const matrix = [
    ["Scheme Name", "Folio No.", "Units", "Invested Value", "Current Value"]
  ];
  const detected = importer.detectHeaderAndBroker(matrix);
  assert.ok(detected);
  assert.equal(detected.profile.id, "GROWW_MF");
});

test("Detects ICICI Direct statement", () => {
  const matrix = [
    ["Stock Symbol", "Company Name", "ISIN Code", "Qty", "Book Value", "Average Cost Price"]
  ];
  const detected = importer.detectHeaderAndBroker(matrix);
  assert.ok(detected);
  assert.equal(detected.profile.id, "ICICI_DIRECT");
});

test("Detects CAMS / KFintech Consolidated Statement", () => {
  const matrix = [
    ["Consolidated Account Statement"],
    ["Scheme Name", "Folio No", "Closing Unit Balance", "Cost Value", "Valuation (Market Value)"]
  ];
  const detected = importer.detectHeaderAndBroker(matrix);
  assert.ok(detected);
  assert.equal(detected.profile.id, "CAMS_KFINTECH");
});

console.log("\n[TEST GROUP 5] Instrument Resolution & SGB / Gold BEES");
test("Resolves Sovereign Gold Bond by IN0020 ISIN prefix", () => {
  const res = importer.resolveMarketInstrument({
    isin: "IN0020160124",
    symbol: "SGB2024",
    rawName: "Sovereign Gold Bond 2.50% 2024-25"
  });
  assert.equal(res.assetClass, "Commodities & Gold");
  assert.equal(res.subCategory, "Sovereign Gold Bond (SGB)");
  assert.equal(res.pricingMode, "LIVE_GOLD");
});

test("Resolves Gold ETF (GOLDBEES)", () => {
  const res = importer.resolveMarketInstrument({
    symbol: "GOLDBEES",
    rawName: "Nippon India ETF Gold BeES"
  });
  assert.equal(res.assetClass, "Commodities & Gold");
  assert.equal(res.pricingMode, "LIVE_GOLD");
});

console.log("\n[TEST GROUP 6] Smart Upsert & Goal Envelope Preservation");
test("Upsert adds new holding and updates existing holding matching ISIN", () => {
  const existing = [
    {
      id: "hold_orig_1",
      name: "360 ONE WAM LIMITED",
      member: "Self",
      custodian: "Zerodha",
      assetClass: "Equities",
      subCategory: "Nifty 500 Equities",
      pricingMode: "LIVE_EQUITY",
      units: 10,
      investedValue: 10000,
      currentValue: 11000,
      allocations: [{ goalId: "goal_retire", percentage: 100 }], // Existing goal allocation!
      instrumentMeta: { symbol: "360ONE", isin: "INE466L01038" }
    }
  ];

  const incoming = [
    // 1. Update existing holding (increased quantity from 10 to 25)
    {
      id: "hold_temp_1",
      name: "360 ONE WAM LIMITED",
      member: "Self",
      custodian: "Zerodha Console", // Custodian normalized to Zerodha
      assetClass: "Equities",
      subCategory: "Nifty 500 Equities",
      pricingMode: "LIVE_EQUITY",
      units: 25,
      investedValue: 27000,
      currentValue: 28450,
      allocations: [],
      instrumentMeta: { symbol: "360ONE", isin: "INE466L01038" }
    },
    // 2. New holding
    {
      id: "hold_temp_2",
      name: "Quantum Value Fund",
      member: "Self",
      custodian: "Zerodha Coin",
      assetClass: "Mutual Funds",
      subCategory: "Equity Value Fund",
      pricingMode: "LIVE_MF",
      units: 50,
      investedValue: 5000,
      currentValue: 6389,
      allocations: [],
      instrumentMeta: { amfiCode: 103490, isin: "INF082J01036" }
    }
  ];

  const { holdings: updated, addedCount, updatedCount } = importer.upsertHoldings(existing, incoming);
  assert.equal(addedCount, 1, "Added 1 new holding");
  assert.equal(updatedCount, 1, "Updated 1 existing holding");
  assert.equal(updated.length, 2, "Total holdings is 2");

  const updated360 = updated.find(h => h.instrumentMeta.isin === "INE466L01038");
  assert.ok(updated360);
  assert.equal(updated360.id, "hold_orig_1", "Original ID was preserved");
  assert.equal(updated360.units, 25, "Units updated to 25");
  assert.equal(updated360.investedValue, 27000, "Invested value updated to 27,000");
  assert.equal(updated360.allocations.length, 1, "Goal allocations PRESERVED");
  assert.equal(updated360.allocations[0].goalId, "goal_retire");
});

test("Upsert matches hand-entered holding without ISIN by symbol and enriches it", () => {
  const existing = [
    {
      id: "hold_hand_1",
      name: "360 ONE",
      member: "Self",
      custodian: "Zerodha",
      assetClass: "Equities",
      subCategory: "Equities",
      pricingMode: "LIVE_EQUITY",
      units: 5,
      investedValue: 5000,
      currentValue: 5690,
      allocations: [{ goalId: "goal_car", percentage: 50 }],
      instrumentMeta: { symbol: "360ONE" } // Had no ISIN originally!
    }
  ];

  const incoming = [
    {
      id: "hold_temp_broker",
      name: "360 ONE WAM LIMITED",
      member: "Self",
      custodian: "Zerodha",
      assetClass: "Equities",
      subCategory: "Nifty 500 Equities",
      pricingMode: "LIVE_EQUITY",
      units: 15,
      investedValue: 16000,
      currentValue: 17070,
      allocations: [],
      instrumentMeta: { symbol: "360ONE", isin: "INE466L01038" }
    }
  ];

  const { holdings: updated, addedCount, updatedCount } = importer.upsertHoldings(existing, incoming);
  assert.equal(addedCount, 0);
  assert.equal(updatedCount, 1);
  assert.equal(updated.length, 1);
  assert.equal(updated[0].id, "hold_hand_1", "ID preserved");
  assert.equal(updated[0].units, 15, "Units updated");
  assert.equal(updated[0].instrumentMeta.isin, "INE466L01038", "ISIN enriched into existing holding");
  assert.equal(updated[0].allocations[0].goalId, "goal_car", "Goal allocation preserved");
});

console.log(`\n========================================`);
console.log(`TEST SUMMARY: ${totalPassed} passed, 0 failed`);
console.log(`========================================\n`);

