// Importing into a broker bucket overwrites that bucket and nothing else in the portfolio.
import vm from "vm";
import fs from "fs";

let passed = 0, failed = 0;
const ok = (c, m) => { if (c) passed++; else { failed++; console.error("✗ " + m); } };

const sb = { console, TextDecoder, TextEncoder }; sb.window = sb; vm.createContext(sb);
for (const f of ["data/market-pulse.js", "data/market-equities.js", "data/market-mf.js", "data/market-us.js", "js/portfolio-engine.js", "js/portfolio-importer.js"]) {
  vm.runInContext(fs.readFileSync(new URL("../" + f, import.meta.url), "utf8"), sb, { filename: f });
}
const I = sb.KYF_BROKER_IMPORTER;
const parse = (csv, src, member = "Self") => I.extractHoldingsFromMatrix(I.parseCSVToMatrix(csv), member, src);
const deepFreeze = (o) => { if (o && typeof o === "object" && !Object.isFrozen(o)) { Object.freeze(o); Object.values(o).forEach(deepFreeze); } return o; };
const clone = (o) => JSON.parse(JSON.stringify(o));
const kite = (rows) => "Instrument,Qty.,Avg. cost,LTP\n" + rows.map((r) => r.join(",")).join("\n");

// ---- a realistic portfolio built from imports, manual entries and an old import
const base = [];
let st = { holdings: base };
const put = (holdings, incoming, member, source) => I.replaceBucket(holdings, incoming, member, source);
let hs = [];
hs = put(hs, parse(kite([["RELIANCE", 10, 1200, 1300], ["INFY", 5, 1400, 1600], ["ITC", 100, 400, 420]]), "zerodha_stocks"), "Self", "zerodha_stocks").holdings;
hs = put(hs, parse(kite([["RELIANCE", 3, 1250, 1300], ["TCS", 2, 3000, 3200]]), "upstox"), "Self", "upstox").holdings;
hs = put(hs, parse(kite([["RELIANCE", 7, 1100, 1300], ["INFY", 1, 1500, 1600]]), "zerodha_stocks", "Priya"), "Priya", "zerodha_stocks").holdings;
hs = put(hs, parse("Symbol,Description,Quantity,Price,Value,Cost Basis\nVOO,VANGUARD S&P 500 ETF,10,690,6900,6000", "chase"), "Self", "chase").holdings;
// goal allocations on the Zerodha bucket
hs.forEach((h) => { if (/INFY|Infosys/i.test(h.name) && h.member === "Self" && h.importSource === "zerodha_stocks") h.allocations = [{ goalId: "g1", percent: 100 }]; });
const manualFlat = { id: "hold_manual_1", name: "Flat in Pune", member: "Self", custodian: "", assetClass: "Real Estate", currentValue: 9000000, allocations: [] };
const manualReliance = { id: "hold_manual_2", name: "Reliance Industries", member: "Self", custodian: "Zerodha", assetClass: "Equities", pricingMode: "LIVE_EQUITY", units: 4, instrumentMeta: { symbol: "RELIANCE", quantity: 4 }, allocations: [] };
const manualFd = { id: "hold_manual_3", name: "SBI FD", member: "Self", custodian: "SBI", assetClass: "Fixed Income", currentValue: 100000, allocations: [] };
const oldImport = { id: "hold_imp_1699999999_1", name: "Tata Consultancy Services", member: "Self", custodian: "Zerodha", assetClass: "Equities", pricingMode: "LIVE_EQUITY", units: 8, instrumentMeta: { symbol: "TCS", quantity: 8 }, allocations: [{ goalId: "g2", percent: 50 }] };
hs = [manualFlat, manualReliance, ...hs, manualFd, oldImport];
const before = deepFreeze(clone(hs));
const input = deepFreeze(clone(hs));

const inBucket = (h, member, src) => (h.member || "Self").toLowerCase() === member.toLowerCase() && h.importSource === src;
const others = (list, member, src) => list.filter((h) => !inBucket(h, member, src));

// ---- 1. re-import Zerodha for Self with a smaller file
{
  const incoming = parse(kite([["RELIANCE", 12, 1210, 1310], ["WIPRO", 20, 250, 260]]), "zerodha_stocks");
  const r = put(input, incoming, "Self", "zerodha_stocks");
  const keepIds = (list) => list.map((h) => h.id);
  const untouched = others(before, "Self", "zerodha_stocks").filter((h) => h.id !== "hold_imp_1699999999_1");
  ok(untouched.every((h) => { const now = r.holdings.find((x) => x.id === h.id); return now && JSON.stringify(now) === JSON.stringify(h); }),
    "every holding outside this broker's list is exactly as it was (manual, other brokers, other people, US)");
  ok(r.holdings.some((h) => h.id === "hold_manual_1") && r.holdings.some((h) => h.id === "hold_manual_2") && r.holdings.some((h) => h.id === "hold_manual_3"), "manual holdings all remain");
  ok(JSON.stringify(input) === JSON.stringify(before), "the saved portfolio passed in is never modified");
  const zSelf = r.holdings.filter((h) => inBucket(h, "Self", "zerodha_stocks"));
  ok(zSelf.length === 2 && zSelf.some((h) => /RELIANCE/i.test(h.name)) && zSelf.some((h) => /WIPRO/i.test(h.name)), "the bucket holds exactly the file's holdings (Reliance, Wipro)");
  ok(r.holdings.some((h) => h.id === "hold_imp_1699999999_1" && !h.importSource), "an older import the file does not list is never removed");
  ok(!zSelf.some((h) => /INFY|ITC/i.test(h.name)), "holdings missing from the file left the bucket (sold)");
  ok(r.removedCount === 2 && r.addedCount === 1 && r.updatedCount === 1, `counts: ${r.addedCount} new, ${r.updatedCount} updated, ${r.removedCount} removed`);
  const rel = zSelf.find((h) => /RELIANCE/i.test(h.name));
  ok(rel.units === 12, "an updated holding takes the new quantity");
  ok(r.holdings.filter((h) => /RELIANCE/i.test(h.name)).length === 4, "Reliance now sits separately in Zerodha/Self, Upstox/Self, Zerodha/Priya and as the manual entry");
  // order of untouched holdings is preserved
  const idsBefore = before.map((h) => h.id).filter((id) => r.holdings.some((h) => h.id === id) && !zSelf.some((h) => h.id === id));
  const idsAfter = keepIds(r.holdings).filter((id) => idsBefore.includes(id));
  ok(JSON.stringify(idsBefore) === JSON.stringify(idsAfter), "the order of other holdings is unchanged");
}

// ---- 2. a hand-entered holding is never adopted, even when it matches the incoming stock and broker name
{
  const r = put(input, parse(kite([["RELIANCE", 10, 1200, 1300]]), "zerodha_stocks"), "Self", "zerodha_stocks");
  const manual = r.holdings.find((h) => h.id === "hold_manual_2");
  ok(manual && JSON.stringify(manual) === JSON.stringify(before.find((h) => h.id === "hold_manual_2")), "a manual Reliance typed under Zerodha is left exactly as it was");
  ok(!manual.importSource, "and it is not tagged as imported");
}

// ---- 3. older imports (no source recorded) are adopted by the matching broker only
{
  const z = put(input, parse(kite([["TCS", 9, 3000, 3200]]), "zerodha_stocks"), "Self", "zerodha_stocks");
  const adopted = z.holdings.find((h) => h.id === "hold_imp_1699999999_1");
  ok(adopted && adopted.importSource === "zerodha_stocks" && adopted.units === 9, "an older Zerodha import is adopted and updated, not duplicated");
  ok(JSON.stringify(adopted.allocations) === JSON.stringify([{ goalId: "g2", percent: 50 }]), "its goal allocation is kept");
  ok(z.holdings.filter((h) => /TCS|Tata Consultancy/i.test(h.name) && h.member === "Self" && h.importSource !== "upstox").length === 1, "no duplicate TCS");
  const u = put(input, parse(kite([["TCS", 9, 3000, 3200]]), "groww_stocks"), "Self", "groww_stocks");
  ok(u.holdings.find((h) => h.id === "hold_imp_1699999999_1").importSource === undefined, "another broker does not take over an older Zerodha import");
  ok(u.holdings.length === input.length + 1, "it adds its own holding instead");
}

// ---- 4. people and brokers are separate buckets; member names ignore case
{
  const p = put(input, parse(kite([["RELIANCE", 99, 1, 1]]), "zerodha_stocks", "Priya"), "priya", "zerodha_stocks");
  ok(p.holdings.filter((h) => h.member === "Priya" && h.importSource === "zerodha_stocks").length === 1 && p.removedCount === 1, "'priya' and 'Priya' are the same person");
  ok(others(p.holdings, "Priya", "zerodha_stocks").length === input.length - 2, "Self's holdings are untouched by a Priya import");
  const us = put(input, parse("Symbol,Description,Quantity,Price,Value,Cost Basis\nGLD,SPDR GOLD SHARES,5,350,1750,1500", "chase"), "Self", "chase");
  ok(us.removedCount === 1 && us.holdings.some((h) => /Zerodha/i.test(h.custodian)), "importing a US statement does not touch Indian brokers");
}

// ---- 5. importing twice, and an empty file
{
  const f = parse(kite([["RELIANCE", 10, 1200, 1300], ["INFY", 5, 1400, 1600]]), "zerodha_stocks");
  const once = put(input, f, "Self", "zerodha_stocks");
  const twice = put(once.holdings, f, "Self", "zerodha_stocks");
  ok(twice.addedCount === 0 && twice.removedCount === 0 && twice.holdings.length === once.holdings.length, "importing the same file twice changes nothing");
  const infy = twice.holdings.find((h) => inBucket(h, "Self", "zerodha_stocks") && /INFY|Infosys/i.test(h.name));
  ok(JSON.stringify(infy.allocations) === JSON.stringify([{ goalId: "g1", percent: 100 }]), "goal allocations survive re-imports");
}

// ---- 6. brokers that are not in the list
{
  const dhan = I.registerCustomSource({ label: "Dhan", kind: "stocks", currency: "INR" });
  ok(dhan.id === "custom_dhan" && I.getSource("custom_dhan") && I.IMPORT_SOURCES.includes(dhan), "a new broker is added to the list");
  ok(I.registerCustomSource({ label: "  DHAN ", kind: "stocks" }).id === "custom_dhan", "the same name gives the same bucket, whatever the case or spacing");
  ok(I.customSources().some((c) => c.label === "Dhan"), "custom brokers can be saved and restored");
  const d = put(input, parse(kite([["RELIANCE", 2, 1, 1]]), "custom_dhan"), "Self", "custom_dhan");
  ok(d.addedCount === 1 && d.removedCount === 0 && d.holdings.length === input.length + 1, "a first import into a new broker only adds");
  ok(others(d.holdings, "Self", "custom_dhan").every((h) => JSON.stringify(h) === JSON.stringify(before.find((x) => x.id === h.id))), "nothing else changes");
  const again = put(d.holdings, parse(kite([["INFY", 3, 1, 1]]), "custom_dhan"), "Self", "custom_dhan");
  ok(again.removedCount === 1 && again.addedCount === 1 && again.holdings.length === d.holdings.length, "the second import replaces just that broker's list");
  const mf = I.registerCustomSource({ label: "Dhan", kind: "mf" });
  ok(mf.id === "custom_dhan", "a name is one broker; it is not split by type");
  const us = I.registerCustomSource({ label: "Moomoo", kind: "stocks", currency: "USD" });
  ok(us.currency === "USD" && parse("Symbol,Description,Quantity,Price,Value,Cost Basis\nVOO,VANGUARD S&P 500 ETF,1,690,690,600", "custom_moomoo")[0].currency === "USD", "a US broker added by the person reads in dollars");
  let threw = 0; try { I.registerCustomSource({ label: "  " }); } catch (e) { threw++; } try { I.registerCustomSource({ label: "!!!" }); } catch (e) { threw++; }
  ok(threw === 2, "an empty or symbol-only name is refused");
}

// ---- 7. no broker chosen: the file can be previewed but not imported
{
  ok(I.PREVIEW_SOURCE && I.PREVIEW_SOURCE.id === "" && I.getSource("") === null, "previewing uses a placeholder that is not a real broker");
  const preview = parse(kite([["RELIANCE", 1, 1, 1]]), I.PREVIEW_SOURCE);
  ok(preview.length === 1, "a file can still be read for the preview");
  let threw = false; try { put(input, preview, "Self", ""); } catch (e) { threw = true; }
  ok(threw, "importing without choosing a broker is refused");
  ok(JSON.stringify(input) === JSON.stringify(before), "and the portfolio is unchanged");
}

console.log(`broker-overwrite: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
