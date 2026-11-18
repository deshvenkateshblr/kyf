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
ok(await p.locator("#stages .stage").count() === 3, "three groups");
const inDays = (n) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
ok((await p.textContent("#upNext")).includes("Savings accounts"), "empty: up next is the first asset type");
ok((await p.textContent("#upNext")).includes("Have you added every savings account?"), "it asks a plain question");
ok(await p.locator("#pathTrack .seg").count() === 3, "three segments in the bar");
ok(await p.locator("#scheduleWrap:visible").count() === 0, "nothing scheduled yet, no Coming up box");

await seed([{ id: "h1", name: "Fund", assetClass: "Mutual Funds", member: "Me", custodian: "X", currentValue: 1000, investedValue: 900, allocations: [] }, { id: "h2", name: "Bank", assetClass: "Cash & Liquid", member: "Me", custodian: "X", currentValue: 500, investedValue: 500, allocations: [] }]);
await p.reload(); await p.waitForSelector("#stages .stage");
ok(await p.locator("#stages .task.is-done").count() === 0, "adding a fund does not tick anything by itself");
ok(await p.locator("#stages .task", { hasText: "Mutual funds" }).locator(".badge", { hasText: "1 added so far" }).count() === 1, "but the fund task shows how many it can see");

await p.click("#upNext [data-act=done]"); await p.waitForTimeout(300);
ok(await p.locator("#stages .task.is-done").count() === 1, "confirming the savings task ticks it");
ok((await p.textContent("#upNext")).includes("Fixed deposits"), "up next moves on to FDs");

await p.fill("#upNext [data-field=plan]", inDays(5)); await p.waitForTimeout(400);
ok(await p.locator("#stages .task.is-later").count() === 1, "'I'll do this by' parks the task");
ok(await p.locator("#scheduleWrap:visible").count() === 1 && (await p.textContent("#schedule")).includes("Fixed deposits"), "and it appears under Coming up");

await p.click("#upNext [data-act=na]"); await p.waitForTimeout(300);
ok(await p.locator("#stages .task.is-na").count() === 1, "'I don't have any' takes the next one off the list");

await p.goto(base + "/portfolio.html?add=equity"); await p.waitForSelector("#holding-modal", { state: "visible" });
ok((await p.inputValue("#select-holding-assetclass")) === "Equities", "Add shares opens the form on Equities");
await p.goto(base + "/portfolio.html?add=loan"); await p.waitForSelector("#holding-modal", { state: "visible" });
ok((await p.inputValue("#modal-omni-search-input")).includes("Loan"), "Add a loan opens the loan form");
await p.goto(base + "/cadence.html"); await p.waitForSelector("#stages .stage");

const owed = p.locator("#stages .task", { hasText: "Loans and card dues" });
await owed.locator("summary").click();
await owed.locator("[data-act=na]", { hasText: "I owe nothing" }).click(); await p.waitForTimeout(300);
ok(await p.locator("#stages .task.is-na", { hasText: "Loans and card dues" }).count() === 1, "I owe nothing completes the debts task");

await p.locator('#stages .stage[data-stage="3"] > summary').click();
const car = p.locator("#stages .task", { hasText: "Car insurance" });
await car.locator("summary").click();
await car.locator("[data-field=renewal]").fill(inDays(12)); await p.waitForTimeout(400);
ok(await p.locator("#stages .task.is-done", { hasText: "Car insurance" }).count() === 1, "entering a renewal date marks the policy as held");
ok((await p.locator(".sch-col.is-soon").textContent()).includes("Car insurance"), "renewal in 12 days is listed under Next 30 days");
const bike = p.locator("#stages .task", { hasText: "Two-wheeler insurance" });
await bike.locator("summary").click();
await bike.locator("[data-field=renewal]").fill(inDays(120)); await p.waitForTimeout(400);
ok((await p.locator(".sch-col.is-later").textContent()).includes("Two-wheeler"), "renewal in 4 months is listed under Later");
ok(await p.locator("#stages .task", { hasText: "Nominees: bank accounts" }).count() === 1, "nominees are listed by account type");

const nw = p.locator("#stages .task", { hasText: "Check your net worth" });
await nw.locator(".tick").click(); await p.waitForTimeout(300);
await nw.locator("summary").click();
ok(await nw.locator("[data-field=nextOn]").count() === 1, "a done recurring task shows its next date");
await nw.locator("[data-field=every]").selectOption("30"); await p.waitForTimeout(300);
const due = await p.locator("#stages .task", { hasText: "Check your net worth" }).locator("[data-field=nextOn]").inputValue();
const days = Math.round((Date.parse(due) - Date.now()) / 864e5);
ok(days >= 28 && days <= 31, "choosing monthly puts the next date about 30 days out (" + due + ")");

await p.reload(); await p.waitForSelector("#stages .stage");
ok(await p.locator("#stages .task.is-later").count() === 1 && await p.locator("#stages .task.is-na").count() === 2, "dates and choices survive a reload");

await p.click("#resetCadenceBtn"); await p.click("#resetCadenceBtn"); await p.waitForTimeout(400);
ok(await p.locator("#stages .task.is-na, #stages .task.is-later, #stages .task.is-done").count() === 0, "start over (two taps) clears it, no dialog");
ok(dialogs === 0, "no browser dialogs");

await p.setViewportSize({ width: 390, height: 800 }); await p.reload(); await p.waitForSelector("#stages .stage");
ok(!(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)), "no horizontal scroll on phone");
ok(errs.length === 0, "no page errors " + errs.join("|"));
console.log(`path e2e: ${pass} passed, ${fail} failed`); await b.close(); srv.close(); process.exit(fail ? 1 : 0);
