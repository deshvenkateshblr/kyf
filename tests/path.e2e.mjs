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
// Cadence "money path": stages, up next, ticking, later, not for me, auto-ticks.
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log("  ✗ " + m); } };
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1100, height: 900 } });
let dialogs = 0; p.on("dialog", (d) => { dialogs++; d.dismiss(); });
const errs = []; p.on("pageerror", (e) => errs.push(e.message));
const seed = (hs) => p.evaluate((h) => { localStorage.clear(); if (h) localStorage.setItem("kyf_user_holdings", JSON.stringify(h)); }, hs);
await p.goto(base + "/cadence.html"); await seed(null); await p.reload(); await p.waitForSelector("#stages .stage");
ok(await p.locator("#stages .stage").count() === 6, "six stages");
ok((await p.textContent("#upNext")).includes("Add what you own"), "empty: up next is add holdings");
ok(await p.locator("#pathTrack .seg").count() === 6, "six segments in the bar");

await seed([{ id: "h1", name: "Fund", assetClass: "Mutual Funds", member: "Me", custodian: "X", currentValue: 1000, investedValue: 900, allocations: [] }]);
await p.reload(); await p.waitForSelector("#stages .stage");
ok((await p.textContent("#upNext")).includes("Add what you owe"), "holding added: holdings task ticks itself, next is debts");
ok(await p.locator("#stages .task.is-done .badge", { hasText: "Done for you" }).count() === 1, "auto task labelled");

ok((await p.textContent("#upNext")).includes("I owe nothing"), "debts task offers I owe nothing");
await p.click("#upNext a.btn-action"); await p.waitForSelector("#holding-modal", { state: "visible" });
ok((await p.inputValue("#modal-omni-search-input")).includes("Loan"), "Add a loan opens the loan form on Portfolio");
await p.goto(base + "/cadence.html"); await p.waitForSelector("#stages .stage");
await p.click("#upNext [data-act=done]"); await p.waitForTimeout(300);
ok(!(await p.textContent("#upNext")).includes("Add what you owe"), "marking done moves to the next task");
const doneCount = await p.locator("#stages .task.is-done").count();
ok(doneCount === 2, "two tasks done");

await p.click("#upNext [data-act=later]"); await p.waitForTimeout(300);
ok(await p.locator("#stages .task.is-later").count() === 1, "Later parks a task");

await p.locator("#stages .stage").nth(1).locator("> summary").click();
const t = p.locator("#stages .stage").nth(1).locator(".task").first();
await t.locator("summary").click();
await t.locator("[data-act=na]").click(); await p.waitForTimeout(300);
ok(await p.locator("#stages .task.is-na").count() === 1, "Not for me marks it");
await p.reload(); await p.waitForSelector("#stages .stage");
ok(await p.locator("#stages .task.is-na").count() === 1 && await p.locator("#stages .task.is-later").count() === 1, "state survives reload");

await p.click("#resetCadenceBtn"); await p.click("#resetCadenceBtn"); await p.waitForTimeout(400);
ok(await p.locator("#stages .task.is-na, #stages .task.is-later").count() === 0, "start over (two taps) clears it, no dialog");
ok(dialogs === 0, "no browser dialogs");

await p.setViewportSize({ width: 390, height: 800 }); await p.reload(); await p.waitForSelector("#stages .stage");
ok(!(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)), "no horizontal scroll on phone");
ok(errs.length === 0, "no page errors " + errs.join("|"));
console.log(`path e2e: ${pass} passed, ${fail} failed`); await b.close(); srv.close(); process.exit(fail ? 1 : 0);
