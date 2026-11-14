// The same stock or fund gets the same key wherever it is held; different things never merge.
import vm from "vm"; import fs from "fs";
let passed = 0, failed = 0;
const ok = (c, m) => { if (c) passed++; else { failed++; console.error("✗ " + m); } };
const sb = { console, TextDecoder, TextEncoder }; sb.window = sb; vm.createContext(sb);
for (const f of ["data/market-pulse.js", "data/market-equities.js", "data/market-mf.js", "data/market-us.js", "js/portfolio-engine.js"]) vm.runInContext(fs.readFileSync(new URL("../" + f, import.meta.url), "utf8"), sb, { filename: f });
const E = sb.KYF_PORTFOLIO_ENGINE;
const k = E.instrumentKey;
ok(k({ instrumentMeta: { symbol: "reliance" } }) === k({ instrumentMeta: { symbol: "RELIANCE", isin: "INE002A01018" }, name: "Reliance Industries" }), "symbol case and extra ISIN do not split a stock");
ok(k({ instrumentMeta: { amfiCode: 120503 } }) === k({ instrumentMeta: { amfiCode: "120503" } }), "a fund code is the same as text or number");
ok(k({ instrumentMeta: { symbol: "VOO" }, currency: "USD" }) !== k({ instrumentMeta: { symbol: "VOO" } }), "a US ticker never merges with an Indian symbol of the same letters");
ok(k({ name: "Flat in Pune" }) === k({ name: " flat in pune " }), "manual holdings group by name");
ok(k({ name: "Flat in Pune" }) !== k({ name: "Flat in Goa" }), "different manual holdings stay apart");
const hs = [
  { id: "1", name: "Reliance", member: "Self", custodian: "Zerodha", assetClass: "Equities", currentValue: 100, investedValue: 80, instrumentMeta: { symbol: "RELIANCE" } },
  { id: "2", name: "Reliance Industries", member: "Priya", custodian: "Upstox", assetClass: "Equities", currentValue: 50, investedValue: 40, instrumentMeta: { symbol: "RELIANCE" } },
  { id: "3", name: "ITC", member: "Self", custodian: "Zerodha", assetClass: "Equities", currentValue: 10, investedValue: 10, instrumentMeta: { symbol: "ITC" } }
];
const g = E.groupBySingleDimension(hs, "instrument", "currentValue", "desc", "1y");
ok(g.groups.length === 2, "two instruments => two groups");
const rel = g.groups.find((x) => /Reliance/.test(x.label));
ok(rel && rel.holdings.length === 2 && rel.totalCurrentValue === 150 && rel.totalInvested === 120, "the group adds up both rows");
ok(g.kpis.totalPortfolioValue === 160, "totals are unchanged by the lens");
const f = E.filterHoldings(hs, { activeDimension: "instrument", selectedPills: new Set([k(hs[0])]) });
ok(f.length === 2, "filtering by an instrument keeps all its rows");
console.log(`instrument-key: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
