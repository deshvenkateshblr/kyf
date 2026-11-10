// tests/qa-regressions.test.mjs
// Regression tests for the engine-side defects in the QA log (KYF-QA-002, 003, 004, 005).
import assert from "node:assert";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const ctx = { window: {}, console };
ctx.window.KYF_MARKET_PULSE = { asOf: "2026-11-08", preciousMetals: { gold24kPerGram: 14280, gold22kPerGram: 13090 } };
ctx.window.KYF_MARKET_EQUITIES = { stocks: [] };
ctx.window.KYF_MARKET_MF = { schemes: [] };
vm.createContext(ctx);
vm.runInContext(readFileSync("js/portfolio-engine.js", "utf8"), ctx);
const E = ctx.window.KYF_PORTFOLIO_ENGINE;

let passed = 0;
const ok = (cond, label) => { assert.ok(cond, label); passed++; console.log(`  ✓ ${label}`); };
const enrich = (h) => E.enrichHoldingsWithLiveMarket([h], "1y")[0];

console.log("KYF-QA-002  Gold taxonomy");
const legacyGold = enrich({ id: "g1", name: "Gold coins", assetClass: "Gold", pricingMode: "LIVE_GOLD", instrumentMeta: { grams: 10, purity: "24K" } });
ok(legacyGold.assetClass === "Commodities & Gold", "legacy 'Gold' holdings join the 'Commodities & Gold' group");
const gp = E.groupBySingleDimension(
  E.enrichHoldingsWithLiveMarket([
    { id: "g1", name: "Gold coins", assetClass: "Gold", pricingMode: "LIVE_GOLD", instrumentMeta: { grams: 10, purity: "24K" } },
    { id: "g2", name: "Gold bar", assetClass: "Commodities & Gold", pricingMode: "LIVE_GOLD", instrumentMeta: { grams: 20, purity: "24K" } }
  ], "1y"), "assetClass", "currentValue", "desc", "1y");
ok(gp.groups.length === 1 && gp.groups[0].key === "Commodities & Gold", "both spellings land in ONE group");
ok(gp.groups[0].physicalSummary && gp.groups[0].physicalSummary.totalUnits === 30, "group carries the aggregated 24K-equivalent grams (10g + 20g = 30g)");

console.log("KYF-QA-003  Live gold / property without a quantity");
const goldNoGrams = enrich({ id: "g3", name: "Gold", assetClass: "Commodities & Gold", pricingMode: "LIVE_GOLD", manualCurrentValue: 150000, currentValue: 150000, instrumentMeta: { purity: "24K" } });
ok(goldNoGrams.currentValue === 150000, `gold with no grams keeps the typed ₹1,50,000 (got ${goldNoGrams.currentValue})`);
const reNoSqft = enrich({ id: "r1", name: "Flat", assetClass: "Real Estate", pricingMode: "LIVE_RESIDEX", manualCurrentValue: 5000000, currentValue: 5000000, instrumentMeta: { city: "Bengaluru" } });
ok(reNoSqft.currentValue === 5000000, `property with no sq.ft keeps the typed value (got ${reNoSqft.currentValue})`);

console.log("KYF-QA-004  Mutual fund without an AMFI code");
const mfNoCode = enrich({ id: "m1", name: "Custom Debt Fund", assetClass: "Mutual Funds", pricingMode: "LIVE_MF", manualCurrentValue: 50000, currentValue: 50000, instrumentMeta: { planType: "DIRECT" } });
ok(!/NaN/.test(JSON.stringify(mfNoCode)), "no 'NaN' anywhere in the enriched holding");
ok(mfNoCode.currentValue === 50000, "typed value is kept");

console.log("KYF-QA-005  A real zero value");
const writtenOff = enrich({ id: "z1", name: "Written-off bond", assetClass: "Fixed Income", pricingMode: "MANUAL", manualCurrentValue: 0, currentValue: 0, investedValue: 100000, instrumentMeta: {} });
ok(writtenOff.currentValue === 0, `current value stays ₹0 (got ${writtenOff.currentValue})`);
ok(writtenOff.gainLoss === -100000 && Math.abs(writtenOff.totalReturnPct + 100) < 0.01, `gain/loss is −₹1,00,000 (−100%) (got ${writtenOff.gainLoss}, ${writtenOff.totalReturnPct})`);
const noTyped = enrich({ id: "z2", name: "FD", assetClass: "Fixed Income", pricingMode: "MANUAL", manualCurrentValue: null, investedValue: 80000, instrumentMeta: {} });
ok(noTyped.currentValue === 80000, "with no current value at all, cost is still the fallback");

console.log(`\n${passed} passed`);
