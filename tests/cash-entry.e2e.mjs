import { createRequire } from "module";
import http from "http"; import fs from "fs"; import path from "path";
const require = createRequire("/opt/npm-tools/node_modules/");
const { chromium } = require("playwright");
const root = path.resolve(new URL("..", import.meta.url).pathname);
const mime = { ".html":"text/html", ".js":"text/javascript", ".css":"text/css", ".json":"application/json" };
const srv = http.createServer((q, r) => {
  const p = path.join(root, decodeURIComponent(q.url.split("?")[0]).replace(/^\/$/, "/index.html"));
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { "content-type": mime[path.extname(p)] || "application/octet-stream" }); r.end(fs.readFileSync(p));
}).listen(0);
const base = `http://127.0.0.1:${srv.address().port}`;
// Adding a bank savings balance: balance, as-of date and rate. No units, price or cost basis.
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log("  ✗ " + m); } };
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1100, height: 900 } });
await p.goto(base + "/portfolio.html"); await p.evaluate(() => localStorage.clear());
await p.goto(base + "/portfolio.html?add=cash"); await p.waitForSelector("#holding-modal", { state: "visible" });
const vis = (id) => p.locator("#" + id).isVisible();
ok(!(await vis("field-holding-units")) && !(await vis("field-holding-price")) && !(await vis("field-holding-invval")), "no units, price or amount-invested for a savings account");
ok(await vis("field-holding-rate") && await vis("field-holding-asof"), "interest rate and balance date are asked");
ok((await p.textContent("#label-holding-curval")).includes("Balance"), "the amount is called Balance");
ok((await p.inputValue("#input-holding-asof")) === new Date().toISOString().slice(0, 10), "the date starts as today");
await p.fill("#input-holding-curval", "250000"); await p.fill("#input-holding-rate", "2.7"); await p.fill("#input-holding-asof", "2026-11-01");
await p.click("#btn-save-holding"); await p.waitForTimeout(500);
const h = await p.evaluate(() => JSON.parse(localStorage.getItem("kyf_user_holdings") || "[]")[0]);
ok(h && h.currentValue === 250000 && h.units == null && h.investedValue == null, "saved as a plain balance");
ok(h && h.instrumentMeta.interestRate === 2.7 && h.instrumentMeta.asOf === "2026-11-01", "rate and as-of date are kept");
await p.goto(base + "/cadence.html"); await p.waitForSelector("#stages .stage");
ok((await p.textContent("#upNext")).includes("1 added so far"), "Cadence counts the savings account");
const p2 = await (await b.newContext({ viewport: { width: 1100, height: 900 } })).newPage();
await p2.goto(base + "/cadence.html");
await p2.evaluate(() => { localStorage.clear(); localStorage.setItem("kyf_user_holdings", JSON.stringify([{ id: "e", name: "INFY", assetClass: "Equities", member: "Self", currentValue: 10, allocations: [], instrumentMeta: {} }, { id: "f", name: "Liquid Fund", assetClass: "Mutual Funds", subCategory: "Liquid Fund", member: "Self", currentValue: 10, allocations: [], instrumentMeta: {} }])); });
await p2.reload(); await p2.waitForSelector("#stages .stage");
ok(!(await p2.textContent("#upNext")).includes("added so far"), "equity and a liquid fund are not counted as savings");
console.log(`cash-entry: ${pass} passed, ${fail} failed`); await b.close(); srv.close(); process.exit(fail ? 1 : 0);
