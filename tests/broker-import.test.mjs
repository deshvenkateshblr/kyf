/**
 * KYF (Know Your Finance) — Broker Importer & ISIN Sync Test Suite
 * Tests:
 * 1. Market Equities & MF ISIN indexing
 * 2. O(1) Engine lookups (lookupByIsin, lookupEquity, lookupMf)
 * 3. Enrichment fallback to ISIN
 * 4. CSV parsing with Indian comma numbers
 * 5. Header row detection (broker is chosen by the user) across formats (Zerodha Kite, Console, Groww, ICICI, CAMS)
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
loadScript("data/market-us.js");
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
  const detected = importer.detectHeader(matrix);
  assert.ok(detected);
  assert.ok(detected.headerRowIndex >= 0);
});

test("Detects Zerodha Kite statement", () => {
  const matrix = [
    ["Holdings (12)"],
    ["Instrument", "Qty.", "Avg. cost", "LTP", "Cur. val", "P&L", "Net chg."]
  ];
  const detected = importer.detectHeader(matrix);
  assert.ok(detected);
  assert.ok(detected.headerRowIndex >= 0);
});

test("Detects Groww Mutual Fund statement", () => {
  const matrix = [
    ["Scheme Name", "Folio No.", "Units", "Invested Value", "Current Value"]
  ];
  const detected = importer.detectHeader(matrix);
  assert.ok(detected);
  assert.ok(detected.headerRowIndex >= 0);
});

test("Detects ICICI Direct statement", () => {
  const matrix = [
    ["Stock Symbol", "Company Name", "ISIN Code", "Qty", "Book Value", "Average Cost Price"]
  ];
  const detected = importer.detectHeader(matrix);
  assert.ok(detected);
  assert.ok(detected.headerRowIndex >= 0);
});

test("Detects CAMS / KFintech Consolidated Statement", () => {
  const matrix = [
    ["Consolidated Account Statement"],
    ["Scheme Name", "Folio No", "Closing Unit Balance", "Cost Value", "Valuation (Market Value)"]
  ];
  const detected = importer.detectHeader(matrix);
  assert.ok(detected);
  assert.ok(detected.headerRowIndex >= 0);
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

  const { holdings: updated, addedCount, updatedCount } = importer.replaceBucket(existing, incoming, "Self", "zerodha_stocks");
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

  const { holdings: updated, addedCount, updatedCount } = importer.replaceBucket(existing, incoming, "Self", "zerodha_stocks");
  assert.equal(addedCount, 0);
  assert.equal(updatedCount, 1);
  assert.equal(updated.length, 1);
  assert.equal(updated[0].id, "hold_hand_1", "ID preserved");
  assert.equal(updated[0].units, 15, "Units updated");
  assert.equal(updated[0].instrumentMeta.isin, "INE466L01038", "ISIN enriched into existing holding");
  assert.equal(updated[0].allocations[0].goalId, "goal_car", "Goal allocation preserved");
});

console.log("\n[TEST GROUP 7] Explicit Member Assignment (No Auto-Guessing)");
test("Explicit member decision strictly assigns all extracted holdings to chosen member", () => {
  const matrix = [
    ["Scheme Name", "Folio No", "Closing Unit Balance", "Cost Value", "Valuation (Market Value)", "Investor Name"],
    ["Quantum Value Fund", "12345/0", "100", "10000", "12500", "Rajesh Kumar (Auto Guess Trait)"]
  ];
  // User explicitly selected member "GVD"
  const holdings = importer.extractHoldingsFromMatrix(matrix, "GVD", "zerodha_stocks");
  assert.equal(holdings.length, 1);
  assert.equal(holdings[0].member, "GVD", "Member is explicitly GVD, never Rajesh or auto-guessed");
});

console.log("\n[TEST GROUP 8] Real-World Mutual Fund Statement Import & Edge Cases");
test("Imports Zerodha Coin MF statements with Parag Parikh & HDFC schemes", () => {
  const coinCsv = `Fund Name,Folio Number,Quantity Available,Average Price,Invested Amount,Current Value
Parag Parikh Flexi Cap Fund - Direct Plan - Growth,123456/78,125.456,65.20,8179.73,9500.00
HDFC Balanced Advantage Fund - Growth Option,987654/32,250.000,42.50,10625.00,12100.00`;

  const matrix = importer.parseCSVToMatrix(coinCsv);
  const holdings = importer.extractHoldingsFromMatrix(matrix, "GVD", "zerodha_stocks");
  assert.equal(holdings.length, 2, "Both holdings extracted from Zerodha Coin");
  assert.equal(holdings[0].member, "GVD");
  assert.equal(holdings[0].assetClass, "Mutual Funds");
  assert.equal(holdings[0].pricingMode, "LIVE_MF");
  assert.ok(holdings[0].units > 0, "Units parsed");
  assert.ok(holdings[0].currentValue > 0, "Current value computed");
  assert.equal(holdings[0].notes, "Folio: 123456/78");
});

test("Imports CAMS CAS statement with blank column 0 (spacer column)", () => {
  const camsCasCsv = `,Scheme Name,Folio No,Closing Unit Balance,Cost Value,Valuation (Market Value)
,Parag Parikh Flexi Cap Fund - Direct Plan - Growth,998877/11,150.000,9000,14092
,SBI Small Cap Fund - Direct Plan - Growth,665544/22,200.000,12000,41378`;

  const matrix = importer.parseCSVToMatrix(camsCasCsv);
  const holdings = importer.extractHoldingsFromMatrix(matrix, "GVD", "zerodha_stocks");
  assert.equal(holdings.length, 2, "Both holdings extracted despite empty Col 0");
  assert.equal(holdings[0].member, "GVD");
  assert.equal(holdings[0].assetClass, "Mutual Funds");
  assert.equal(holdings[0].pricingMode, "LIVE_MF");
  assert.equal(holdings[0].units, 150);
});

test("Imports KFintech CAS statement with short column headers", () => {
  const kfinCsv = `Scheme,Folio,Units,Cost,Market Value
Mirae Asset Large & Midcap Fund - Direct Plan - Growth,112233/44,80.500,8000,14399
DSP Midcap Fund - Regular Plan - Growth,556677/88,100.000,10000,14983`;

  const matrix = importer.parseCSVToMatrix(kfinCsv);
  const holdings = importer.extractHoldingsFromMatrix(matrix, "Priya", "zerodha_stocks");
  assert.equal(holdings.length, 2, "Short headers matched");
  assert.equal(holdings[0].member, "Priya");
  assert.equal(holdings[0].assetClass, "Mutual Funds");
  assert.equal(holdings[0].units, 80.5);
  assert.equal(holdings[1].instrumentMeta.planType, "REGULAR");
});

test("Auto-detects TSV delimiter in Mutual Fund statements", () => {
  const tsv = `Scheme Name\tFolio No\tUnits\tCost Value\tMarket Value\nUTI Nifty 50 Index Fund - Direct Plan - Growth\t443322/11\t50.000\t5000\t8821`;
  const matrix = importer.parseCSVToMatrix(tsv);
  assert.equal(matrix.length, 2);
  assert.equal(matrix[0].length, 5);
  const holdings = importer.extractHoldingsFromMatrix(matrix, "GVD", "zerodha_stocks");
  assert.equal(holdings.length, 1);
  assert.equal(holdings[0].assetClass, "Mutual Funds");
  assert.equal(holdings[0].units, 50);
});

test("Auto-detects Semicolon delimiter in Mutual Fund statements", () => {
  const semi = `Scheme Name;Folio No;Units;Cost Value;Market Value\nNippon India Small Cap Fund - Direct Growth;778899/00;60.000;6000;12056`;
  const matrix = importer.parseCSVToMatrix(semi);
  assert.equal(matrix.length, 2);
  assert.equal(matrix[0].length, 5);
  const holdings = importer.extractHoldingsFromMatrix(matrix, "GVD", "zerodha_stocks");
  assert.equal(holdings.length, 1);
  assert.equal(holdings[0].units, 60);
});

test("Mutual Fund not indexed in AMFI retains LIVE_MF pricingMode with statement NAV", () => {
  const customMfCsv = `Fund Name,Folio,Units,NAV,Current Value
Custom Offshore Global Equity Fund,12345/67,100.000,25.50,2550`;
  const matrix = importer.parseCSVToMatrix(customMfCsv);
  const holdings = importer.extractHoldingsFromMatrix(matrix, "GVD", "zerodha_stocks");
  assert.equal(holdings.length, 1);
  assert.equal(holdings[0].assetClass, "Mutual Funds");
  assert.equal(holdings[0].pricingMode, "LIVE_MF");
  assert.equal(holdings[0].units, 100);
  assert.equal(holdings[0].currentValue, 2550);
  assert.equal(holdings[0].instrumentMeta.price, 25.5);
});

console.log("\n[TEST GROUP 9] Mutual Fund Plan Type Detection (Regular vs Direct)");
test("Maps scheme without 'Direct' to REGULAR with regular NAV and regular ISIN", () => {
  // Common statement naming: Parag Parikh Flexi Cap Fund - Growth (no "regular", no "direct")
  const res = importer.resolveMarketInstrument({
    rawName: "Parag Parikh Flexi Cap Fund - Growth",
    defaultAssetClass: "Mutual Funds"
  });
  assert.equal(res.instrumentMeta.planType, "REGULAR", "Plan type must be REGULAR");
  assert.equal(res.instrumentMeta.isin, "INF879O01019", "Must map to regular ISIN");
  const ppScheme = engine.lookupMfByCode(122639);
  assert.ok(Math.abs(res.livePrice - ppScheme.regularNav) < 0.01, "Must use live regular NAV");
});

test("Maps scheme with 'Direct' to DIRECT with direct NAV and direct ISIN", () => {
  const res = importer.resolveMarketInstrument({
    rawName: "Parag Parikh Flexi Cap Fund - Direct Plan - Growth",
    defaultAssetClass: "Mutual Funds"
  });
  assert.equal(res.instrumentMeta.planType, "DIRECT", "Plan type must be DIRECT");
  assert.equal(res.instrumentMeta.isin, "INF879O01027", "Must map to direct ISIN");
  const ppScheme = engine.lookupMfByCode(122639);
  assert.ok(Math.abs(res.livePrice - ppScheme.directNav) < 0.01, "Must use live direct NAV");
});

test("Maps abbreviations 'Reg', 'Reg.', 'RP' to REGULAR", () => {
  const r1 = importer.resolveMarketInstrument({
    rawName: "SBI Small Cap Fund - Reg Growth",
    defaultAssetClass: "Mutual Funds"
  });
  assert.equal(r1.instrumentMeta.planType, "REGULAR");
  assert.equal(r1.instrumentMeta.isin, "INF200K01T28");

  const r2 = importer.resolveMarketInstrument({
    rawName: "SBI Small Cap Fund - RP - Growth",
    defaultAssetClass: "Mutual Funds"
  });
  assert.equal(r2.instrumentMeta.planType, "REGULAR");
});

test("Imports mixed statement with both Regular and Direct holdings accurately", () => {
  const mixedCsv = `Scheme Name,Folio No,Units,Cost Value,Market Value
Parag Parikh Flexi Cap Fund - Growth,1111/00,100,7000,8550
Parag Parikh Flexi Cap Fund - Direct Plan - Growth,2222/00,100,7000,9395`;

  const matrix = importer.parseCSVToMatrix(mixedCsv);
  const holdings = importer.extractHoldingsFromMatrix(matrix, "GVD", "zerodha_stocks");
  assert.equal(holdings.length, 2);

  const regHolding = holdings.find(h => h.notes === "Folio: 1111/00");
  const dirHolding = holdings.find(h => h.notes === "Folio: 2222/00");

  assert.ok(regHolding, "Found regular holding");
  assert.ok(dirHolding, "Found direct holding");

  assert.equal(regHolding.instrumentMeta.planType, "REGULAR");
  assert.equal(regHolding.instrumentMeta.isin, "INF879O01019");

  assert.equal(dirHolding.instrumentMeta.planType, "DIRECT");
  assert.equal(dirHolding.instrumentMeta.isin, "INF879O01027");

  // Enrich with engine and verify live market valuation and regular plan alert
  const enriched = engine.enrichHoldingsWithLiveMarket(holdings);
  const enrichedReg = enriched.find(h => h.notes === "Folio: 1111/00");
  const enrichedDir = enriched.find(h => h.notes === "Folio: 2222/00");

  assert.ok(enrichedReg.priceLabel.includes("Reg"), "Price label indicates Reg");
  assert.ok(enrichedDir.priceLabel.includes("Dir"), "Price label indicates Dir");
  assert.ok(enrichedReg.regularAlert != null, "Regular holding triggers Regular Alert");
  assert.ok(enrichedReg.regularAlert.gapPct > 0, "Shows positive corpus gap for direct plan");
  assert.equal(enrichedDir.regularAlert, null, "Direct holding has no regular alert");
});

console.log("\n[TEST GROUP 10] US Equities & Mutual Funds (LIVE_US Engine Valuation)");
test("lookupUsByTicker resolves US stocks and US mutual funds", () => {
  const aapl = engine.lookupUsByTicker("AAPL");
  assert.ok(aapl, "AAPL must resolve in US market dataset");
  assert.equal(aapl.ticker, "AAPL");
  assert.equal(aapl.type, "EQUITY");
  assert.ok(aapl.closePrice > 0, "AAPL must have positive close price");

  const fxaix = engine.lookupUsByTicker("FXAIX");
  assert.ok(fxaix, "FXAIX must resolve in US market dataset");
  assert.equal(fxaix.ticker, "FXAIX");
  assert.equal(fxaix.type, "MUTUAL_FUND");
  assert.ok(fxaix.closePrice > 0, "FXAIX must have positive close price");

  const voog = engine.lookupUsByTicker("VOOG");
  assert.ok(voog, "VOOG ETF must resolve in US market dataset");
  assert.equal(voog.ticker, "VOOG");
  assert.equal(voog.type, "ETF");
  assert.ok(voog.closePrice > 0, "VOOG must have positive close price");

  const qqqm = engine.lookupUsByTicker("QQQM");
  assert.ok(qqqm, "QQQM ETF must resolve in US market dataset");
  assert.equal(qqqm.ticker, "QQQM");
  assert.equal(qqqm.type, "ETF");
  assert.ok(qqqm.closePrice > 0, "QQQM must have positive close price");

  const tan = engine.lookupUsByTicker("TAN");
  assert.ok(tan, "TAN ETF must resolve in US market dataset");
  assert.equal(tan.ticker, "TAN");
  assert.equal(tan.type, "ETF");
  assert.equal(tan.name, "Invesco Solar ETF");
  assert.ok(tan.closePrice > 0, "TAN must have positive close price");
});

test("LIVE_US enriches US equity holding with USD price, INR converted value, and fractional shares", () => {
  const holding = {
    id: "us_stock_test",
    name: "Apple Inc.",
    pricingMode: "LIVE_US",
    currency: "USD",
    instrumentMeta: {
      ticker: "AAPL",
      quantity: 12.5,
      avgBuyPrice: 300
    }
  };

  const [enriched] = engine.enrichHoldingsWithLiveMarket([holding]);
  assert.equal(enriched.currency, "USD");
  assert.ok(enriched.priceUSD > 0, "Enriched priceUSD must be positive");
  assert.equal(enriched.currentValueUSD, Math.round(12.5 * enriched.priceUSD * 100) / 100);
  assert.equal(enriched.investedValueUSD, 3750);
  assert.ok(enriched.currentValue > 0, "Current value in INR must be positive");
  assert.ok(enriched.investedValue > 0, "Invested value in INR must be auto-calculated");
  assert.ok(enriched.priceLabel.includes("$"), "Price label includes dollar sign");
  assert.ok(enriched.priceLabel.includes("₹"), "Price label includes rupee equivalent");
  assert.ok(enriched.physicalUnitsLabel.includes("shares"), "Units label specifies shares for equities");
});

test("LIVE_US enriches US mutual fund with units label and accurate USD/INR basis calculation", () => {
  const holding = {
    id: "us_fund_test",
    name: "Fidelity 500 Index Fund",
    pricingMode: "LIVE_US",
    currency: "USD",
    instrumentMeta: {
      ticker: "FXAIX",
      quantity: 35.819,
      avgBuyPrice: 200
    }
  };

  const [enriched] = engine.enrichHoldingsWithLiveMarket([holding]);
  assert.equal(enriched.currency, "USD");
  assert.ok(enriched.priceUSD > 0);
  assert.ok(enriched.physicalUnitsLabel.includes("units"), "Units label specifies units for mutual funds");
  assert.equal(enriched.investedValueUSD, Math.round(35.819 * 200 * 100) / 100);
  assert.ok(enriched.gainLossUSD != null, "Calculates USD gain/loss");
  assert.ok(enriched.returnPctUSD != null, "Calculates USD return percentage");
});

test("computeHoldingPhysicalUnits correctly distinguishes US stocks (shares) and US funds (units)", () => {
  const stockHolding = {
    pricingMode: "LIVE_US",
    instrumentMeta: { ticker: "AAPL", quantity: 15.5 }
  };
  const fundHolding = {
    pricingMode: "LIVE_US",
    instrumentMeta: { ticker: "FXAIX", quantity: 28.25 }
  };

  const stockUnits = engine.computeHoldingPhysicalUnits(stockHolding);
  assert.equal(stockUnits.sharesQty, 15.5);
  assert.equal(stockUnits.mfUnits, 0);

  const fundUnits = engine.computeHoldingPhysicalUnits(fundHolding);
  assert.equal(fundUnits.sharesQty, 0);
  assert.equal(fundUnits.mfUnits, 28.25);
});

// ============================================================================
// TEST GROUP 11: Market Data Health Status & Metadata Feeds
// ============================================================================
console.log("\n[TEST GROUP 11] Market Data Health Status & Metadata Feeds");

test("Market status files exist and report all 6 feeds healthy", () => {
  assert.ok(fs.existsSync(path.join(BASE_DIR, "data/market-status.json")), "market-status.json must exist");
  assert.ok(fs.existsSync(path.join(BASE_DIR, "data/market-status.js")), "market-status.js must exist");

  const statusJson = JSON.parse(fs.readFileSync(path.join(BASE_DIR, "data/market-status.json"), "utf8"));
  assert.equal(statusJson.overallStatus, "HEALTHY");
  assert.equal(statusJson.totalFeeds, 6);
  assert.equal(statusJson.healthyFeeds, 6);

  const feeds = statusJson.feeds;
  assert.ok(feeds.equities && feeds.equities.status === "HEALTHY", "NSE Equities feed must be healthy");
  assert.ok(feeds.equities.count > 2000, "NSE Equities count > 2000");
  assert.ok(feeds.equities.asOf, "NSE Equities has valid asOf");

  assert.ok(feeds.mutualFunds && feeds.mutualFunds.status === "HEALTHY", "AMFI MF feed must be healthy");
  assert.ok(feeds.mutualFunds.count > 1500, "AMFI MF count > 1500");

  assert.ok(feeds.usMarket && feeds.usMarket.status === "HEALTHY", "US Market feed must be healthy");
  assert.ok(feeds.usMarket.count >= 80, "US Market count >= 80");
  assert.ok(feeds.usMarket.fxRateUsdInr > 80, "USD/INR FX rate present");

  assert.ok(feeds.bullion && feeds.bullion.status === "HEALTHY", "Bullion feed must be healthy");
  assert.ok(feeds.bullion.gold24kPerGram > 5000, "Gold rate present");

  assert.ok(feeds.macro && feeds.macro.status === "HEALTHY", "Macro feed must be healthy");
  assert.ok(feeds.realEstate && feeds.realEstate.status === "HEALTHY", "Real estate feed must be healthy");
});

test("portfolio.html embeds market-status.js and contains data-status-modal with feeds health", () => {
  const html = fs.readFileSync(path.join(BASE_DIR, "portfolio.html"), "utf8");
  assert.ok(html.includes("data/market-status.js"), "portfolio.html must load data/market-status.js");
  assert.ok(html.includes('id="data-status-modal"'), "portfolio.html must have data-status-modal");
  assert.ok(html.includes('id="portfolio-top-asof"'), "portfolio.html must have portfolio-top-asof");
  assert.ok(html.includes("asof-feeds-badge"), "portfolio.html must have asof-feeds-badge beside portfolio overview");
  assert.ok(html.includes("clickable-status-pill"), "as-of pills must have clickable-status-pill class");
});

test("US Holding typed in USD ($807 VFIAX) auto-promotes to LIVE_US, converts to INR, and retains USD metadata", () => {
  const holding = {
    id: "hold_us_test_1",
    name: "Vanguard 500 Index Fund Admiral (VFIAX)",
    member: "Self",
    assetClass: "Mutual Funds",
    currency: "USD",
    pricingMode: "MANUAL",
    currentValue: 807,
    investedValue: null
  };

  const enriched = engine.enrichHoldingsWithLiveMarket([holding], "1y")[0];
  assert.strictEqual(enriched.pricingMode, "LIVE_US", "Must auto-promote to LIVE_US");
  assert.strictEqual(enriched.currency, "USD", "Must set currency to USD");
  assert.strictEqual(enriched.currentValueUSD, 807, "Must retain $807 USD current value");
  const expectedInr = Math.round(807 * (enriched.fxRate || 93.85));
  assert.strictEqual(enriched.currentValue, expectedInr, `Must convert USD to INR (@ ₹${enriched.fxRate}): ${expectedInr}`);
  assert.ok(enriched.physicalUnitsLabel.includes("units"), "Must format physical units for US fund");
  assert.ok(enriched.priceLabel.includes("$"), "Must format price in USD");
});

test("Indian stock with US ticker collision (BIL, ON, TEAM) does NOT promote to LIVE_US", () => {
  const holdingBil = {
    id: "hold_bil_1",
    name: "Bhartiya International Ltd (BIL)",
    member: "Self",
    assetClass: "Equities",
    currency: "INR",
    pricingMode: "LIVE_EQUITY",
    currentValue: 1167,
    investedValue: 1000,
    instrumentMeta: { symbol: "BIL" }
  };
  const holdingOn = {
    id: "hold_on_1",
    name: "ON",
    member: "Self",
    assetClass: "Equities",
    currency: "INR",
    pricingMode: "MANUAL",
    currentValue: 50000,
    investedValue: 40000
  };

  const enriched = engine.enrichHoldingsWithLiveMarket([holdingBil, holdingOn], "1y");
  assert.strictEqual(enriched[0].pricingMode, "LIVE_EQUITY", "BIL must remain LIVE_EQUITY");
  assert.strictEqual(enriched[0].currency, "INR", "BIL must remain INR");
  assert.strictEqual(enriched[1].pricingMode, "MANUAL", "ON must remain MANUAL");
  assert.strictEqual(enriched[1].currency, "INR", "ON must remain INR");
});

console.log("\n[TEST GROUP 12] US Broker & Chase Portfolio Import");
test("sniffSource auto-detects Chase from filename or content", () => {
  assert.strictEqual(importer.sniffSource("Chase_Positions_2026.csv"), "chase");
  assert.strictEqual(importer.sniffSource("JPMorgan_Holdings.csv"), "chase");
  assert.strictEqual(importer.sniffSource("positions.csv", "Account Number,Symbol,Shares,Cost Basis"), "chase");
  assert.strictEqual(importer.sniffSource("schwab_export.csv"), "us_broker");
});

test("Detects Chase / J.P. Morgan positions statement headers", () => {
  const matrix = [
    ["Portfolio as of 11/12/2026"],
    ["Account Number", "Symbol", "Description", "Shares", "Price", "Market Value", "Cost Basis"]
  ];
  const detected = importer.detectHeader(matrix);
  assert.ok(detected);
  assert.strictEqual(detected.headerRowIndex, 1);
});

test("Imports Chase positions CSV for family member with USD valuation and INR conversion", () => {
  const matrix = [
    ["Account Number", "Symbol", "Description", "Shares", "Price", "Market Value", "Cost Basis"],
    ["...1234", "VOOG", "Vanguard S&P 500 Growth ETF", "10", "80.43", "804.30", "750.00"],
    ["...1234", "QQQM", "Invesco NASDAQ 100 ETF", "5", "283.39", "1416.95", "1300.00"],
    ["...1234", "CASH", "JPMorgan Chase Bank NA Deposit Sweep", "500", "1.00", "500.00", "500.00"]
  ];

  const chaseSource = importer.getSource("chase");
  assert.ok(chaseSource, "Chase source must exist in IMPORT_SOURCES");
  assert.strictEqual(chaseSource.currency, "USD");

  const holdings = importer.extractHoldingsFromMatrix(matrix, "VAISH", chaseSource);
  assert.strictEqual(holdings.length, 3, "Extracted 3 holdings");

  const voog = holdings.find(h => h.name.includes("Vanguard") || h.instrumentMeta.ticker === "VOOG");
  assert.ok(voog, "Found VOOG");
  assert.strictEqual(voog.member, "VAISH", "Assigned to VAISH");
  assert.strictEqual(voog.currency, "USD", "Currency is USD");
  assert.strictEqual(voog.pricingMode, "LIVE_US", "PricingMode is LIVE_US");
  assert.strictEqual(voog.units, 10, "10 shares");
  assert.strictEqual(voog.currentValueUSD, 804.3, "USD current value $804.30");
  assert.strictEqual(voog.investedValueUSD, 750, "USD cost basis $750");
  assert.ok(voog.currentValue > 70000, `INR value converted: ${voog.currentValue}`);
  assert.ok(voog.investedValue > 65000, `INR invested converted: ${voog.investedValue}`);

  const qqqm = holdings.find(h => h.instrumentMeta.ticker === "QQQM");
  assert.ok(qqqm, "Found QQQM");
  assert.strictEqual(qqqm.member, "VAISH");
  assert.strictEqual(qqqm.currency, "USD");
  assert.strictEqual(qqqm.units, 5);

  const cash = holdings.find(h => h.assetClass === "Cash & Bank");
  assert.ok(cash, "Found Cash & Bank sweep");
  assert.strictEqual(cash.member, "VAISH");
  assert.strictEqual(cash.currency, "USD");
});

console.log("\n[TEST GROUP 13] Inline Import Error Banner in DOM & UI");
test("portfolio.html contains import-error-banner with title and detail containers", () => {
  const html = fs.readFileSync(path.join(BASE_DIR, "portfolio.html"), "utf-8");
  assert.ok(html.includes('id="import-error-banner"'), "import-error-banner element present");
  assert.ok(html.includes('id="import-error-title"'), "import-error-title element present");
  assert.ok(html.includes('id="import-error-detail"'), "import-error-detail element present");
  assert.ok(html.includes('role="alert"'), "banner has accessible role=alert");
});

test("css/portfolio.css includes styling for .import-error-banner and children", () => {
  const css = fs.readFileSync(path.join(BASE_DIR, "css/portfolio.css"), "utf-8");
  assert.ok(css.includes(".import-error-banner"), ".import-error-banner selector styled");
  assert.ok(css.includes(".import-error-icon"), ".import-error-icon selector styled");
  assert.ok(css.includes(".import-error-title"), ".import-error-title selector styled");
  assert.ok(css.includes(".import-error-detail"), ".import-error-detail selector styled");
});

test("js/portfolio-app.js defines showImportError and hideImportError handlers", () => {
  const js = fs.readFileSync(path.join(BASE_DIR, "js/portfolio-app.js"), "utf-8");
  assert.ok(js.includes("showImportError"), "showImportError function defined");
  assert.ok(js.includes("hideImportError"), "hideImportError function defined");
  assert.ok(js.includes("importErrorBanner: document.getElementById(\"import-error-banner\")"), "importErrorBanner cached in els");
});

console.log(`\n========================================`);
console.log(`TEST SUMMARY: ${totalPassed} passed, 0 failed`);
console.log(`========================================\n`);

