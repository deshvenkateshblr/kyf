// US holdings: valuation, asset classes, rate when bought, single USD/INR source.
import vm from "vm";
import fs from "fs";
import assert from "assert";

let passed = 0, failed = 0;
const ok = (c, m) => { if (c) passed++; else { failed++; console.error("✗ " + m); } };

function load(drop = []) {
  const sb = { console }; sb.window = sb; vm.createContext(sb);
  for (const f of ["data/market-pulse.js", "data/market-equities.js", "data/market-mf.js", "data/market-us.js", "js/portfolio-engine.js"]) {
    vm.runInContext(fs.readFileSync(new URL("../" + f, import.meta.url), "utf8"), sb, { filename: f });
  }
  drop.forEach((d) => vm.runInContext(d, sb));
  return sb;
}
const sb = load();
const E = sb.KYF_PORTFOLIO_ENGINE;
const US = sb.KYF_MARKET_US;
const fx = US.fxRateUsdInr;
const us = (name, ticker, qty, avg, extra = {}) => ({
  id: name, name, pricingMode: "LIVE_US", assetClass: "Mutual Funds", units: qty, investedValue: null,
  instrumentMeta: { ticker, quantity: qty, avgBuyPrice: avg, ...extra }
});
const val = (h) => E.enrichHoldingsWithLiveMarket([h])[0];

// --- valuation
{
  const r = val(us("VOO", "VOO", 10, 600));
  const px = US.byTicker.VOO.closePrice;
  ok(r.currentValue === Math.round(10 * px * fx), "value = shares x close x rate");
  ok(r.currentValueUSD === Number((10 * px).toFixed(2)), "USD value kept");
  ok(r.investedValueUSD === 6000, "USD cost = shares x average price");
  ok(r.investedValue === Math.round(6000 * fx), "rupee cost without a rate-when-bought uses today's rate");
  ok(Math.abs(r.totalReturnPct - r.returnPctUSD) < 0.01, "no rate when bought: rupee return equals dollar return");
  ok(r.fxEffectIncluded === false, "currency effect is not claimed without a rate when bought");
}

// --- rate when bought
{
  const r = val(us("VOO", "VOO", 10, 600, { purchaseFxRate: 83 }));
  ok(r.investedValue === 6000 * 83, "rupee cost = dollar cost x rate when bought");
  const expectGain = r.currentValue - 6000 * 83;
  ok(r.gainLoss === Math.round(expectGain), "rupee gain includes the rupee moving");
  ok(r.totalReturnPct > r.returnPctUSD + 5, "rupee return is higher than the dollar return when the rupee weakened");
  ok(r.fxEffectIncluded === true && r.purchaseFxRate === 83, "flagged as including the currency effect");
  // a stale rupee amount saved earlier can no longer disagree with the dollar cost
  const stale = val({ ...us("VOO", "VOO", 10, 600), investedValue: 50000, investedValueUSD: 6000 });
  ok(stale.investedValue === Math.round(6000 * fx), "rupee cost is derived from the dollar cost, never a stale rupee amount");
  ok(stale.totalReturnPct < 100, "no absurd return from mismatched amounts");
}

// --- asset classes
{
  const want = { AAPL: "Equities", VOO: "Equities", VFIAX: "Mutual Funds", AGG: "Fixed Income", BND: "Fixed Income", TLT: "Fixed Income", HYG: "Fixed Income", VBTLX: "Fixed Income", GLD: "Commodities & Gold", IAU: "Commodities & Gold", SLV: "Commodities & Gold", VNQ: "Real Estate", IBIT: "Alternative" };
  for (const [t, cls] of Object.entries(want)) {
    const r = val(us(t, t, 1, 1));
    ok(r.assetClass === cls, `${t} is ${cls}, got ${r.assetClass}`);
  }
  ok(val(us("GLD", "GLD", 1, 1)).subCategory === "US Gold ETF", "sub-category says what it is");
}

// --- data: every instrument has a known category
{
  const allowed = new Set(["EQUITY", "BOND", "GOLD", "SILVER", "REIT", "CRYPTO", "HYBRID"]);
  const bad = US.instruments.filter((r) => !allowed.has(r[6]));
  ok(bad.length === 0, "every US instrument has a category: " + bad.map((r) => r[0]).join(","));
  ok(US.columns[6] === "category", "category is a declared column");
  ok(Object.keys(US.byTicker).length === US.instruments.length, "lookup and list hold the same instruments");
}

// --- one USD/INR source
{
  ok(E.getUsdInr().source === "market-us" && E.getUsdInr().rate === fx, "rate comes from the US data first");
  const noUs = load(["delete window.KYF_MARKET_US"]);
  const g = noUs.KYF_PORTFOLIO_ENGINE.getUsdInr();
  ok(g.source === "pulse" && g.rate === noUs.KYF_MARKET_PULSE.macro.usdInrRate, "then the macro feed");
  const none = load(["delete window.KYF_MARKET_US", "window.KYF_MARKET_PULSE.macro.usdInrRate = 0"]);
  const f = none.KYF_PORTFOLIO_ENGINE.getUsdInr();
  ok(f.source === "fallback" && f.rate > 0, "then a flagged last resort, never silent");
  ok(!/\b(87\.5|93\.85)\b/.test(fs.readFileSync(new URL("../js/portfolio-app.js", import.meta.url), "utf8")), "no rate typed into portfolio-app.js");
  const eng = fs.readFileSync(new URL("../js/portfolio-engine.js", import.meta.url), "utf8");
  ok((eng.match(/93\.85/g) || []).length === 1 && !/87\.5/.test(eng), "the only typed rate is the single last-resort constant");
}

// --- unknown ticker
{
  const r = val(us("Mystery", "ZZZZ", 3, 50));
  ok(/No live price/.test(r.priceLabel), "unknown ticker says there is no live price");
  ok(r.currentValue === Math.round(150 * fx), "valued at cost, not zero");
}

console.log(`us-holdings: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
