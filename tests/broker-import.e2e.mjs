// Upload real files through the Import screen: CSV, Excel (.xlsx, two sheets) and an HTML table saved as .xls.
// The Excel reader is loaded from a CDN in the app; here the request is answered from a local copy of SheetJS.
import { createRequire } from "module";
import http from "http"; import fs from "fs"; import path from "path";
const require = createRequire("/opt/npm-tools/node_modules/");
const { chromium } = require("playwright");
const root = path.resolve(new URL("..", import.meta.url).pathname);

let XLSX = null, xlsxJs = null;
for (const base of ["/opt/npm-tools/node_modules/xlsx", "/tmp/xl/node_modules/xlsx"]) {
  if (fs.existsSync(base + "/dist/xlsx.full.min.js")) { XLSX = require(base); xlsxJs = fs.readFileSync(base + "/dist/xlsx.full.min.js"); break; }
}

const mime = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json" };
const srv = http.createServer((q, r) => {
  const p = path.join(root, decodeURIComponent(q.url.split("?")[0]));
  if (!fs.existsSync(p) || fs.statSync(p).isDirectory()) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { "content-type": mime[path.extname(p)] || "application/octet-stream" }); r.end(fs.readFileSync(p));
}).listen(0);
const base = `http://127.0.0.1:${srv.address().port}`;

let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : (fail++, console.log("FAIL", m)); };
const b = await chromium.launch();

async function freshPage() {
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
  if (xlsxJs) await ctx.route(/xlsx(\.full)?\.min\.js/, (route) => route.fulfill({ status: 200, contentType: "text/javascript", body: xlsxJs }));
  const p = await ctx.newPage();
  p.errs = []; p.on("pageerror", (e) => p.errs.push(e.message));
  await p.goto(base + "/portfolio.html");
  await p.waitForTimeout(600);
  return p;
}

async function importFile(p, file, member, source = "zerodha_stocks") {
  await p.click("#btn-open-import-modal");
  await p.selectOption("#import-source-select", source);
  if (member) await p.selectOption("#import-member-select", member).catch(() => {});
  await p.setInputFiles("#broker-file-input", file);
  await p.waitForSelector("#import-preview-tbody tr", { timeout: 8000 });
  const rows = await p.locator("#import-preview-tbody tr").count();
  await p.click("#btn-confirm-import");
  await p.waitForTimeout(700);
  return rows;
}
const holdingsCount = (p) => p.evaluate(() => (document.getElementById("kpi-net-worth-sub")?.textContent.match(/\((\d+) holdings?\)/) || [])[1] | 0);

// ---------- CSV ----------
{
  const p = await freshPage();
  const csv = ["Instrument,Qty.,Avg. cost,LTP,Invested,Cur. val,P&L,Net chg.,Day chg.",
    "RELIANCE,10,\"1,250.50\",1300,\"12,505.00\",\"13,000.00\",495,3.9%,0.5%",
    "ITC,100,400,420,40000,42000,2000,5%,1%", "ITC,50,380,420,19000,21000,2000,10%,1%", ""].join("\r\n");
  const rows = await importFile(p, { name: "holdings.csv", mimeType: "text/csv", buffer: Buffer.from("﻿" + csv) });
  ok(rows === 2, `csv preview shows 2 holdings (two ITC lots merged), got ${rows}`);
  ok(await holdingsCount(p) === 2, "csv: two holdings on the page");
  const again = await importFile(p, { name: "holdings.csv", mimeType: "text/csv", buffer: Buffer.from(csv) });
  ok(await holdingsCount(p) === 2, "csv: importing the same file again adds nothing");
  // overwrite: a smaller file means the missing holding was sold
  const smaller = "Instrument,Qty.,Avg. cost,LTP\r\nRELIANCE,10,1250.5,1300\r\n";
  await p.click("#btn-open-import-modal");
  await p.selectOption("#import-source-select", "zerodha_stocks");
  await p.setInputFiles("#broker-file-input", { name: "h2.csv", mimeType: "text/csv", buffer: Buffer.from(smaller) });
  await p.waitForSelector("#import-preview-tbody tr");
  const summary = await p.textContent("#import-stats-summary");
  ok(/1 updated/.test(summary) && /1 no longer held/.test(summary), "csv: preview says what will be removed: " + summary);
  await p.click("#btn-confirm-import"); await p.waitForTimeout(600);
  ok(await holdingsCount(p) === 1, "csv: the holding missing from the new file is gone");
  // a second broker is a separate bucket
  await importFile(p, { name: "u.csv", mimeType: "text/csv", buffer: Buffer.from("Instrument,Qty.,Avg. cost,LTP\r\nRELIANCE,3,1200,1300\r\n") }, null, "upstox");
  ok(await holdingsCount(p) === 2, "csv: the same stock at another broker is kept separately");
  // no source chosen: nothing is read
  await p.click("#btn-open-import-modal");
  await p.setInputFiles("#broker-file-input", { name: "h.csv", mimeType: "text/csv", buffer: Buffer.from(csv) });
  await p.waitForTimeout(400);
  ok(await p.locator("#import-preview-tbody tr").count() === 0 && await p.isDisabled("#btn-confirm-import"), "csv: without a broker choice nothing is previewed");
  await p.selectOption("#import-source-select", "groww_stocks");
  await p.waitForSelector("#import-preview-tbody tr");
  ok(await p.locator("#import-preview-tbody tr").count() === 2, "csv: choosing the broker afterwards reads the file");
  ok(p.errs.length === 0, "csv: no page errors " + p.errs.join("|"));
  await p.context().close();
}

// ---------- XLSX with two sheets ----------
if (XLSX) {
  const p = await freshPage();
  const wb = XLSX.utils.book_new();
  const eq = [["Equity Holdings Statement as on 2026-11-09"], ["Client ID", "AB1234"], [],
    ["Symbol", "ISIN", "Sector", "Quantity Available", "Average Price", "Previous Closing Price", "Unrealized P&L"],
    ["RELIANCE", "INE002A01018", "ENERGY", 10, 1250.5, 1324.4, 738.9],
    ["INFY", "INE009A01021", "IT", 5, 1500, 1600, 500], [], ["Total", "", "", 15]];
  const mf = [["Mutual Funds Holdings"], [], ["Symbol", "ISIN", "Quantity Available", "Average Price", "Previous Closing Price"],
    ["PARAG PARIKH FLEXI CAP FUND - DIRECT PLAN - GROWTH", "INF879O01027", 500.123, 80, 93.9],
    ["HDFC FLEXI CAP FUND - REGULAR PLAN - GROWTH", "INF179K01VQ9", 20.5, 1500, 1700]];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(eq), "Equity");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(mf), "Mutual Funds");
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  const rows = await importFile(p, { name: "console.xlsx", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", buffer: buf });
  ok(rows === 4, `xlsx: both sheets imported (2 + 2 = 4), got ${rows}`);
  ok(await holdingsCount(p) === 4, "xlsx: four holdings on the page (sheets did not overwrite each other)");
  ok(p.errs.length === 0, "xlsx: no page errors " + p.errs.join("|"));
  await p.context().close();
} else {
  console.log("note: SheetJS not found locally, Excel cases skipped");
}

// ---------- HTML table saved as .xls (some brokers do this) ----------
{
  const p = await freshPage();
  const html = `<html><body><table><tr><td>Holdings Report</td></tr><tr><th>Scrip Name</th><th>ISIN</th><th>Qty</th><th>Average Cost Price</th><th>Current Market Price</th></tr>
    <tr><td>TCS</td><td>INE467B01029</td><td>4</td><td>3,100.00</td><td>3,400.00</td></tr></table></body></html>`;
  try {
    const rows = await importFile(p, { name: "report.xls", mimeType: "application/vnd.ms-excel", buffer: Buffer.from(html) });
    ok(rows === 1, `html .xls: one holding, got ${rows}`);
  } catch (e) { ok(false, "html .xls did not preview: " + e.message.split("\n")[0]); }
  await p.context().close();
}

await b.close(); srv.close();
console.log(`broker import e2e: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
