// tests/liabilities.test.mjs
// Loans and debts must SUBTRACT from net worth, never add to it.
import assert from "node:assert";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const ctx = { window: {}, console };
ctx.window.KYF_MARKET_PULSE = { asOf: "2026-11-08", preciousMetals: { gold24kPerGram: 14280 } };
ctx.window.KYF_MARKET_EQUITIES = { stocks: [] };
ctx.window.KYF_MARKET_MF = { schemes: [] };
vm.createContext(ctx);
vm.runInContext(readFileSync("js/portfolio-engine.js", "utf8"), ctx);
const E = ctx.window.KYF_PORTFOLIO_ENGINE;

let passed = 0;
const ok = (cond, label) => { assert.ok(cond, label); passed++; console.log(`  ✓ ${label}`); };

const holdings = [
  { id: "a", name: "FD", member: "Self", assetClass: "Fixed Income", pricingMode: "MANUAL", manualCurrentValue: 1000000, investedValue: 900000, instrumentMeta: {} },
  { id: "b", name: "Cash", member: "Self", assetClass: "Cash & Liquid", pricingMode: "MANUAL", manualCurrentValue: 500000, investedValue: null, instrumentMeta: {} },
  { id: "c", name: "Home Loan", member: "Self", assetClass: "Liabilities", isLiability: true, pricingMode: "MANUAL", manualCurrentValue: 400000, investedValue: null, instrumentMeta: { interestRate: 8.65 } }
];

console.log("Enrichment");
const enriched = E.enrichHoldingsWithLiveMarket(holdings, "1y");
const loan = enriched.find((h) => h.id === "c");
ok(loan.currentValue === -400000, "loan value is carried as a negative amount");
ok(loan.isLiability === true && loan.activeHorizonReturn === null && loan.gainLoss === null, "loan has no return or gain/loss");
ok(loan.priceLabel === "Interest: 8.65% p.a.", `loan shows its interest rate (${loan.priceLabel})`);

console.log("Totals");
const pivot = E.groupBySingleDimension(enriched, "assetClass", "currentValue", "desc", "1y");
ok(pivot.kpis.totalPortfolioValue === 1100000, `net worth = assets − debt (${pivot.kpis.totalPortfolioValue})`);
ok(pivot.kpis.totalAssets === 1500000 && pivot.kpis.totalLiabilities === 400000, "assets and debt are reported separately");
ok(pivot.kpis.totalPortfolioInvested === 900000, "debt does not change invested capital");
const debtGroup = pivot.groups.find((g) => g.key === "Liabilities");
ok(debtGroup && debtGroup.totalCurrentValue === -400000, "debt shows as its own negative group");
const fdGroup = pivot.groups.find((g) => g.key === "Fixed Income");
ok(Math.abs(fdGroup.allocationPct - (1000000 / 1500000) * 100) < 0.01, "allocation % is measured against gross assets, not net worth");
ok(pivot.kpis.totalPortfolioReturnPct > 0, "portfolio return ignores the loan");

console.log("Goal lens");
const sl = E.expandGoalSlices(enriched, [], null, 2026).slices;
const goalPivot = E.groupBySingleDimension(sl, "goal", "currentValue", "desc", "1y");
ok(goalPivot.kpis.totalPortfolioValue === 1100000, "net worth is the same in the goal lens");
ok(goalPivot.kpis.totalPortfolioReturnPct === pivot.kpis.totalPortfolioReturnPct, "no-cost-basis holdings no longer distort returns in the goal lens");

console.log("Legacy data");
const legacy = { id: "d", name: "Home Loan Outstanding", assetClass: "Alternative", custodian: "Lending Bank", subCategory: "Home Loan (8.65%)", pricingMode: "MANUAL", manualCurrentValue: 250000, instrumentMeta: {} };
ok(E.isLiabilityHolding(legacy), "an early-build 'Home Loan Outstanding' is recognised as a liability");
ok(E.enrichHoldingsWithLiveMarket([legacy], "1y")[0].currentValue === -250000, "...and now subtracts");
ok(!E.isLiabilityHolding({ assetClass: "Alternative", custodian: "Zerodha", subCategory: "Crypto" }), "ordinary alternative assets are untouched");

console.log(`\n${passed} passed`);
