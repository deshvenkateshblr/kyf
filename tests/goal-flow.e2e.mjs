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
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log("  ✗ " + m); } };
const b = await chromium.launch();
const errs = [];
const fresh = async () => { const p = await b.newPage({ viewport: { width: 1100, height: 900 } }); p.on("pageerror", (e) => errs.push(e.message)); return p; };

// --- Flow 1: goal first, no holdings yet -> add one for it -> back, goal is funded live
let p = await fresh();
await p.goto(base + "/goals.html"); await p.evaluate(() => localStorage.clear()); await p.reload();
await p.fill("#askInput", "College"); await p.keyboard.press("Enter");
await p.fill("#goalYearInput", "2036"); await p.fill("#goalPvInput", "2000000");
ok((await p.locator("#prevSip").innerText()).includes("after you answer"), "SIP waits until we know what the user already has");
await p.click("#fundingAddBtn");
await p.waitForURL(/portfolio\.html\?addFor=/);
await p.waitForSelector("#holding-modal", { state: "visible" });
const sel = await p.locator("#select-holding-goal").evaluate((e) => e.options[e.selectedIndex].text);
ok(/education/i.test(sel), "Portfolio opens with the goal already chosen: " + sel);
await p.selectOption("#select-holding-assetclass", { index: 0 }).catch(() => {});
await p.fill("#modal-omni-search-input", "Emergency FD");
await p.fill("#input-holding-curval", "300000");
await p.click("#btn-save-holding");
await p.waitForTimeout(600);
ok(await p.locator(".toast-action-btn", { hasText: "Back to my goal" }).count() === 1, "toast offers the way back to the goal");
await p.goto(base + "/goals.html"); await p.waitForSelector("#goalList .goal-row");
const status = await p.locator("#goalList .goal-row .row-status").first().innerText();
ok(/month/i.test(status), "goal now shows its monthly SIP once something is set aside: " + status);

// --- Flow 2: holding first -> new goal inline
p = await fresh();
await p.goto(base + "/portfolio.html"); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(800);
await p.click("#btn-add-holding").catch(async () => { await p.click("text=Add Holding"); });
await p.waitForSelector("#holding-modal", { state: "visible" });
await p.fill("#modal-omni-search-input", "Gold coins");
await p.fill("#input-holding-curval", "150000");
await p.selectOption("#select-holding-goal", "__new__");
ok(await p.locator("#new-goal-inline").isVisible(), "new-goal fields appear inline");
await p.fill("#new-goal-name", "Wedding"); await p.fill("#new-goal-year", "2030");
await p.click("#btn-save-holding"); await p.waitForTimeout(700);
const gs = await p.evaluate(() => JSON.parse(localStorage.getItem("kyf_user_goals") || "[]"));
const hs = await p.evaluate(() => JSON.parse(localStorage.getItem("kyf_user_holdings") || "[]"));
ok(gs.length === 1 && gs[0].name === "Wedding", "goal created from the holding form");
ok(hs.length === 1 && hs[0].allocations && hs[0].allocations[0].goalId === gs[0].id, "holding tagged to the new goal");

// --- Flow 3: holding with no goal -> nudge
await p.reload(); await p.waitForTimeout(800);
await p.click("#btn-add-holding").catch(async () => { await p.click("text=Add Holding"); });
await p.fill("#modal-omni-search-input", "Spare cash");
await p.fill("#input-holding-curval", "50000");
await p.click("#btn-save-holding"); await p.waitForTimeout(600);
ok(await p.locator(".toast-action-btn", { hasText: "Is this for a goal?" }).count() === 1, "untagged holding gets a goal nudge");

ok(errs.length === 0, "no page errors " + errs.join(";"));
await b.close(); srv.close();
console.log(`goal-flow: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
