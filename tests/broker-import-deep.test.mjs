// Deep importer checks with realistic broker-style files (messy headers, preambles, totals, lots,
// second tables, pledged columns, odd number formats) and round-trips over the whole market database.
import assert from "node:assert";
import fs from "node:fs";
import vm from "node:vm";

const sandbox = { console, document: { createElement: () => ({ setAttribute() {}, appendChild() {} }), head: { appendChild() {} } } };
sandbox.window = sandbox;
vm.createContext(sandbox);
for (const f of ["data/market-equities.js", "data/market-mf.js", "data/market-pulse.js", "js/portfolio-engine.js", "js/portfolio-importer.js"]) {
  vm.runInContext(fs.readFileSync(f, "utf8"), sandbox);
}
const imp = sandbox.window.KYF_BROKER_IMPORTER;
const MF = sandbox.window.KYF_MARKET_MF;
const EQ = sandbox.window.KYF_MARKET_EQUITIES;

let n = 0;
const ok = (c, m) => { assert.ok(c, m); n++; };
const parse = (text, member = "Self", src = "zerodha_stocks") => imp.extractHoldingsFromMatrix(imp.parseCSVToMatrix(text), member, src);
const by = (list, re) => list.find((h) => re.test(h.name));

// ---------------------------------------------------------------- column roles
{
  const h = parse([
    "Equity Holdings Statement as on 2026-11-09", "Client ID,AB1234", "",
    "Symbol,ISIN,Sector,Quantity Available,Quantity Discrepant,Quantity Long Term,Average Price,Previous Closing Price,Unrealized P&L,Unrealized P&L Pct.",
    "RELIANCE,INE002A01018,ENERGY,10,0,10,1250.5,1324.4,738.9,5.9", "", "Total,,,10,,,,,,", "Disclaimer: indicative"
  ].join("\r\n"));
  ok(h.length === 1, "preamble, blank row, total and disclaimer are skipped");
  ok(h[0].investedValue === 12505, "Average Price x quantity gives invested when there is no Invested column");
  ok(h[0].instrumentMeta.avgBuyPrice === 1250.5, "average buy price is kept");
  ok(h[0].custodian === "Zerodha", "custodian comes from the chosen source");
}
{
  const h = parse([
    "Stock Symbol,Company Name,ISIN Code,Qty,Average Cost Price,Current Market Price,Value At Cost,Value At Market Price,Realized Profit",
    "RELIND,RELIANCE INDUSTRIES LTD,INE002A01018,10,1250.5,1300,12505,13000,0"
  ].join("\n"));
  ok(h[0].investedValue === 12505, "'Average Cost Price' is a price, not the invested total");
}
{
  const h = parse("Instrument,Qty. ,Avg. cost,LTP\nINFY,5,1500,1600");
  ok(h.length === 1 && h[0].investedValue === 7500, "headers with non-breaking spaces still map");
}

// ---------------------------------------------------------------- file-level quirks
{
  const bom = parse("﻿Instrument;Qty.;Avg. cost;LTP;Invested;Cur. val\nRELIANCE;10;1250.50;1300;12505;13000");
  ok(bom.length === 1 && bom[0].units === 10, "BOM + semicolon delimiter");
  const tab = parse("Symbol\tISIN\tQuantity Available\tAverage Price\nINFY\tINE009A01021\t5\t1500");
  ok(tab.length === 1 && tab[0].investedValue === 7500, "tab-separated");
  const rs = parse("Symbol,ISIN,Quantity Available,Average Price\nINFY,INE009A01021,5,\"Rs. 1,500.00\"\nTCS,INE467B01029,2,INR 3100");
  ok(rs[0].investedValue === 7500 && rs[1].investedValue === 6200, "'Rs.' and 'INR' prefixes on numbers");
  const odd = parse("Instrument,Qty.,Avg. cost,LTP\nINFY,0,1500,1600\nTCS,-3,3000,3400\nWIPRO,\"1,000\",250,260");
  ok(odd.length === 1 && odd[0].units === 1000, "zero and negative quantities skipped, '1,000' read as 1000");
}
{
  const h = parse(["Symbol,ISIN,Quantity Available,Average Price", "TOTAL GAS,INE0000TG001,10,100", "Total Environment Building Systems,INE0000TE002,3,200", "Total,,13,"].join("\n"));
  ok(h.length === 2, "a company whose name starts with 'Total' is a holding; the 'Total' row is not");
}

// ---------------------------------------------------------------- lots, tables, ids
{
  const h = parse(["Instrument,Qty.,Avg. cost,LTP,Invested,Cur. val", "ITC,100,400,420,40000,42000", "ITC,50,380,420,19000,21000"].join("\n"));
  ok(h.length === 1 && h[0].units === 150, "two lots of one stock become one holding (quantities add)");
  ok(h[0].investedValue === 59000 && h[0].instrumentMeta.avgBuyPrice === 393.33, "invested adds, average price is recomputed");
}
{
  const h = parse([
    "Instrument,Qty.,Avg. cost,LTP,Invested,Cur. val", "INFY,5,1500,1600,7500,8000", "",
    "Mutual Fund Holdings", "Scheme Name,Folio No.,Units,Invested Value,Current Value",
    "Parag Parikh Flexi Cap Fund Direct Growth,123,100,9000,9500"
  ].join("\n"));
  const mf = by(h, /Parag/);
  ok(h.length === 2 && mf && mf.units === 100 && mf.instrumentMeta.folio === "123", "a second table in the same sheet is read with its own columns (folio is not the quantity)");
  ok(mf.assetClass === "Mutual Funds" && mf.investedValue === 9000, "second table: asset class and invested");
}
{
  const a = parse("Instrument,Qty.,Avg. cost\nINFY,5,1500\nTCS,2,3000");
  const b = parse("Instrument,Qty.,Avg. cost\nINFY,5,1500\nTCS,2,3000");
  const ids = new Set([...a, ...b].map((h) => h.id));
  ok(ids.size === 4, "ids are unique even across files read in the same millisecond");
}

// ---------------------------------------------------------------- mutual funds
{
  const h = parse([
    "Name,Deepak Sharma", "Mutual Funds Holdings Statement,Report date 09-11-2026", "",
    "Scheme Name,AMC,Category,Sub-category,Folio No.,Source,Units,Invested Value,Current Value,Returns,XIRR",
    "Parag Parikh Flexi Cap Fund Direct Growth,PPFAS,Equity,Flexi Cap,12345678/90,Groww,\"1,234.567\",\"1,00,000.00\",\"1,15,900.50\",\"15,900.50\",14.2%",
    "Parag Parikh Flexi Cap Fund Direct Growth,PPFAS,Equity,Flexi Cap,99999999/01,Groww,100.5,\"10,000\",\"9,440\",-560,-5.6%",
    "HDFC Flexi Cap Fund Regular Plan Growth,HDFC,Equity,Flexi Cap,5551234,Other,50.123,\"₹ 80,000.00\",\"₹ 1,00,000.00\",20000,25%"
  ].join("\n"));
  ok(h.length === 3, "same fund in two folios stays two holdings");
  ok(h[0].units === 1234.567 && h[0].investedValue === 100000, "Indian number grouping and 3-decimal units");
  ok(h[0].instrumentMeta.planType === "DIRECT" && h[2].instrumentMeta.planType === "REGULAR", "Direct / Regular read from the name");
  ok(h.every((x) => x.instrumentMeta.amfiCode), "all three resolve to an AMFI code");
}
{
  const pp = MF.schemes.find((s) => /Parag Parikh Flexi Cap/.test(s[1]));
  const h = parse([
    "Folio No,Scheme Name,ISIN,Closing Unit Balance,NAV,Cost Value,Market Value",
    `1234567,Parag Parikh Flexi Cap Fund - Direct Plan - Growth,${pp[9]},500.123,93.9,40000,46985`,
    `7654321,Parag Parikh Flexi Cap Fund - Regular Plan - Growth,${pp[10]},10,85.5,800,855`,
    ",Grand Total,,,,40800,47840"
  ].join("\n"));
  ok(h.length === 2 && h[0].instrumentMeta.planType === "DIRECT" && h[1].instrumentMeta.planType === "REGULAR", "ISIN decides Direct vs Regular; grand total row skipped");
  ok(h[0].currentValue === Math.round(500.123 * pp[3]) && h[1].currentValue === Math.round(10 * pp[4]), "live NAV of the right plan is used");
}
{
  const h = parse("Scheme Name,Folio No.,Units,Invested Value,Current Value\nSome Obscure Retired Fund - Direct Plan - Growth,111,100,10000,12345");
  ok(h[0].currentValue === 12345, "a fund we cannot price keeps the value printed in the statement");
}

// ---------------------------------------------------------------- bonds and gold
{
  const h = parse(["Symbol,ISIN,Quantity Available,Average Price,Previous Closing Price", "GS2033,IN0020230013,10,100.5,101.2", "SGBFEB32IV-GB,IN0020210111,8,5100,13000"].join("\n"));
  const g = by(h, /GS2033/), s = by(h, /SGB/);
  ok(g.assetClass === "Fixed Income" && g.pricingMode === "MANUAL", "a G-Sec with an IN00 ISIN is fixed income, not gold");
  ok(g.currentValue === 1012, "G-Sec value comes from its own price");
  ok(s.assetClass === "Commodities & Gold" && s.pricingMode === "LIVE_GOLD" && s.instrumentMeta.grams === 8, "SGB by symbol is gold, weighed in grams");
}

// ---------------------------------------------------------------- scheme-name matching safety
{
  const r = (name) => imp.resolveMarketInstrument({ isin: "", rawName: name, defaultAssetClass: "Mutual Funds" });
  ok(r("Axis Small Cap Fund Segregated Portfolio 1 - Direct Plan - Growth").instrumentMeta.amfiCode == null, "side-pocket funds are not priced as the main fund");
  ok(r("Axis Small Cap Fund Series II Direct Growth").instrumentMeta.amfiCode == null, "numbered series are not priced as the main fund");
  ok(r("Axis Fund").instrumentMeta.amfiCode == null, "a vague name does not pick a random fund");
  ok(r("Axis Small Cap Fund - Direct Plan - Growth").instrumentMeta.amfiCode === 125354, "the real fund still matches");
}

// ---------------------------------------------------------------- whole database round trips
{
  let bad = 0;
  for (const s of MF.schemes) {
    for (const [isin, plan] of [[s[9], "DIRECT"], [s[10], "REGULAR"]]) {
      if (!isin) continue;
      const r = imp.resolveMarketInstrument({ isin, rawName: s[1], defaultAssetClass: "Mutual Funds" });
      if (r.pricingMode === "LIVE_MF" && (r.instrumentMeta.amfiCode !== s[0] || r.instrumentMeta.planType !== plan)) bad++;
    }
  }
  ok(bad === 0, `every fund ISIN resolves to its own fund and plan (${bad} wrong)`);
  let nameBad = 0;
  for (const s of MF.schemes) for (const p of ["Direct", "Regular"]) {
    const r = imp.resolveMarketInstrument({ isin: "", rawName: `${s[1]} - ${p} Plan - Growth`, defaultAssetClass: "Mutual Funds" });
    if (r.instrumentMeta.amfiCode !== s[0] || r.instrumentMeta.planType !== p.toUpperCase()) nameBad++;
  }
  ok(nameBad === 0, `every fund resolves by name in the common broker style (${nameBad} wrong)`);
  let eqBad = 0;
  for (const st of EQ.stocks) {
    if (!st[8]) continue;
    const byIsin = imp.resolveMarketInstrument({ isin: st[8], rawName: st[1], defaultAssetClass: "Equities" });
    const bySym = imp.resolveMarketInstrument({ isin: "", symbol: st[0] + "-EQ", rawName: "", defaultAssetClass: "Equities" });
    if (byIsin.instrumentMeta.symbol !== st[0] || bySym.instrumentMeta.symbol !== st[0]) eqBad++;
  }
  ok(eqBad === 0, `every listed stock resolves by ISIN and by symbol (${eqBad} wrong)`);
}

// ---------------------------------------------------------------- re-import = overwrite the bucket
{
  const kite = (q, avg, extra = "") => parse(`Instrument,Qty.,Avg. cost,LTP,Invested,Cur. val\nITC,${q},${avg},420,${q * avg},${q * 420}\nINFY,10,1500,1600,15000,16000${extra}`);
  const put = (ex, inc, member = "Self", src = "zerodha_stocks") => imp.replaceBucket(ex, inc, member, src);
  const first = put([], kite(100, 400));
  ok(first.addedCount === 2 && first.holdings.every((h) => h.importSource === "zerodha_stocks" && h.importedAt), "first import fills the bucket and tags the source");
  first.holdings.find((h) => /ITC/.test(h.name)).allocations = [{ goalId: "g1", percent: 60 }];
  const again = put(first.holdings, kite(100, 400));
  ok(again.addedCount === 0 && again.removedCount === 0 && again.holdings.length === 2, "importing the same file twice changes nothing");
  const more = put(again.holdings, kite(150, 410));
  const itc = more.holdings.find((h) => /ITC/.test(h.name));
  ok(itc.units === 150 && itc.investedValue === 61500, "a later file updates quantity and cost");
  ok(JSON.stringify(itc.allocations) === JSON.stringify([{ goalId: "g1", percent: 60 }]), "goal allocations survive an update");
  ok(itc.id === first.holdings.find((h) => /ITC/.test(h.name)).id, "id survives an update");

  // sold: INFY missing from the new file leaves the bucket
  const sold = put(more.holdings, parse("Instrument,Qty.,Avg. cost,LTP\nITC,150,410,420"));
  ok(sold.removedCount === 1 && sold.holdings.length === 1 && /ITC/.test(sold.holdings[0].name), "a holding missing from the new file is treated as sold");

  // another person / another broker are separate buckets
  const priya = put(more.holdings, parse("Instrument,Qty.,Avg. cost,LTP\nITC,10,400,420", "Priya"), "Priya");
  ok(priya.addedCount === 1 && priya.removedCount === 0 && priya.holdings.length === 3, "same stock for another member is a separate holding and does not touch Self");
  const upstox = put(more.holdings, parse("Instrument,Qty.,Avg. cost,LTP\nITC,5,400,420", "Self", "upstox"), "Self", "upstox");
  ok(upstox.addedCount === 1 && upstox.removedCount === 0 && upstox.holdings.length === 3, "same stock at another broker sits in its own bucket");
  const fromEmpty = put(more.holdings, []);
  ok(fromEmpty.removedCount === 0 && fromEmpty.holdings.length === more.holdings.length, "an empty file removes nothing (there is no kind to replace)");

  // manual and legacy holdings
  const manual = { id: "m1", name: "Flat", member: "Self", custodian: "", assetClass: "Real Estate", allocations: [] };
  const legacy = { id: "hold_imp_l1", name: "ITC LIMITED", member: "Self", custodian: "Zerodha", assetClass: "Equities", instrumentMeta: { symbol: "ITC" }, allocations: [{ goalId: "g2", percent: 100 }] };
  const adopt = put([manual, legacy], kite(100, 400));
  ok(adopt.holdings.some((h) => h.id === "m1"), "manual holdings are never touched");
  const adoptedItc = adopt.holdings.find((h) => h.id === "hold_imp_l1");
  ok(adoptedItc && adoptedItc.importSource === "zerodha_stocks" && adoptedItc.allocations[0].goalId === "g2", "an older unsourced import is adopted, keeping its goal allocation");
  ok(adopt.holdings.length === 3, "adoption does not duplicate");
  const legacyOther = put([manual, legacy], kite(100, 400), "Self", "upstox");
  ok(legacyOther.holdings.some((h) => h.id === "hold_imp_l1" && !h.importSource), "legacy Zerodha holdings are not adopted by another broker");

  // preview warnings
  const big = put([], parse("Instrument,Qty.,Avg. cost,LTP\n" + ["ITC", "INFY", "TCS", "RELIANCE", "HDFCBANK"].map((s) => `${s},1,100,100`).join("\n")));
  const pv = imp.previewBucket(big.holdings.map((h, i) => i === 0 ? { ...h, allocations: [{ goalId: "g" }] } : h), parse("Instrument,Qty.,Avg. cost,LTP\nITC,1,100,100"), "Self", "zerodha_stocks");
  ok(pv.muchSmaller && pv.removedCount === 4 && pv.bucketSize === 5, "a file much smaller than the saved bucket is flagged");
  ok(pv.removedWithGoals.length === 0 || pv.removedWithGoals.length === 1, "removed holdings with goal allocations are listed");
  let threw = false; try { imp.replaceBucket([], [], "Self", ""); } catch (e) { threw = true; }
  ok(threw, "no source chosen means no import");
}

// ---------------------------------------------------------------- pledged shares count as held
{
  const h = parse("Symbol,ISIN,Quantity Available,Quantity Pledged (Margin),Quantity Pledged (Loan),Average Price,Previous Closing Price\nRELIANCE,INE002A01018,6,3,1,1250,1324");
  ok(h.length === 1 && h[0].units === 10, "pledged (margin) and pledged (loan) are added to available");
  const only = parse("Symbol,ISIN,Quantity Available,Quantity Pledged (Margin),Average Price,Previous Closing Price\nRELIANCE,INE002A01018,0,5,1250,1324");
  ok(only.length === 1 && only[0].units === 5, "a fully pledged holding is still listed");
}

console.log(`broker-import-deep: ${n} checks passed`);
