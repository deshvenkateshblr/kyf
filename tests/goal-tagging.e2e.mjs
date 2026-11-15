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
const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
const errs = []; p.on("pageerror", (e) => errs.push(e.message));
await p.goto(base + "/portfolio.html");
await p.evaluate(() => {
  localStorage.setItem("kyf_user_goals", JSON.stringify([{ id: "g1", name: "Home", baseTargetINR: 5000000, targetYear: 2035 }, { id: "g2", name: "Trip", baseTargetINR: 100000, targetYear: 2028 }]));
  const mk = (i) => ({ id: "h" + i, name: "Fund " + i, assetClass: "Mutual Funds", member: "Me", custodian: "X", currentValue: 1000 * i, investedValue: 900 * i, allocations: [] });
  localStorage.setItem("kyf_user_holdings", JSON.stringify([mk(1), mk(2), mk(3)]));
});
await p.reload(); await p.waitForTimeout(1200);
await p.evaluate(() => document.querySelectorAll("details.tree-group").forEach((d) => (d.open = true)));
ok(await p.locator(".btn-goal-chip").count() === 3, "one goal chip per holding");
ok(await p.locator(".btn-bulk-tag").count() === 1, "one bulk button for the group");
ok(await p.locator("#assign-banner").isVisible(), "banner says there is money without a goal");
await p.locator(".btn-goal-chip").first().click();
await p.waitForSelector("#assign-modal.open");
ok(await p.locator("#assign-modal .as-row").count() === 1, "a row chip opens the sheet for just that holding");
await p.locator("#assign-modal .as-chip", { hasText: "Home" }).click();
await p.click("#btn-save-assign"); await p.waitForTimeout(400);
let st = await p.evaluate(() => JSON.parse(localStorage.getItem("kyf_user_holdings")).map((h) => h.allocations[0] && h.allocations[0].goalId));
ok(st.filter((x) => x === "g1").length === 1, "single tag saved to one holding");
await p.evaluate(() => document.querySelectorAll("details.tree-group").forEach((d) => (d.open = true)));
await p.locator(".btn-bulk-tag").first().click();
await p.waitForSelector("#assign-modal.open");
ok(await p.locator("#assign-modal .as-row").count() === 3, "the group button opens the sheet for the group");
await p.locator("#assign-modal [data-suggest]").click();
ok(await p.locator("#assign-modal .as-chip.on").count() >= 1, "Suggest proposes goals for the money");
for (const r of await p.locator("#assign-modal .as-row").all()) {
  const on = await r.locator(".as-chip.on").count();
  if (!on) await r.locator(".as-chip", { hasText: "Trip" }).click();
}
await p.click("#btn-save-assign"); await p.waitForTimeout(400);
st = await p.evaluate(() => JSON.parse(localStorage.getItem("kyf_user_holdings")).map((h) => h.allocations[0] && h.allocations[0].goalId));
ok(st.every(Boolean), "every holding has a goal after assigning");
ok(!(await p.locator("#assign-banner").isVisible()), "banner goes away when nothing is left unassigned");
ok(errs.length === 0, "no page errors " + errs.join(";"));
await b.close(); srv.close();
console.log(`goal-tagging: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
