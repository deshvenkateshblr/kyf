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
// After one holding is added you can keep adding others (FD, EPF, PPF, cash...) and each one lands.
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log("  ✗ " + m); } };
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1100, height: 900 } });
const errs = []; p.on("pageerror", (e) => errs.push(e.message));
await p.goto(base + "/portfolio.html"); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(800);

async function addQuick(kind, name, amount) {
  if (await p.locator(".portfolio-empty-box").count()) await p.click(`.portfolio-empty-box .quick-pick-tile[data-quick="${kind}"]`);
  else {
    await p.click("#btn-open-holding-modal");
    await p.waitForSelector("#holding-modal", { state: "visible" });
    await p.click(`#modal-quick-picks .quick-pick-tile[data-quick="${kind}"]`);
  }
  await p.waitForSelector("#holding-modal", { state: "visible" });
  await p.waitForTimeout(250);
  if (name) await p.fill("#modal-omni-search-input", name);
  await p.fill("#input-holding-curval", String(amount));
  await p.click("#btn-save-holding");
  await p.waitForTimeout(600);
  // the sheet only opens after imports, but close anything that is in the way
  if (await p.locator("#assign-modal.open").count()) await p.click("#btn-cancel-assign");
}
const stored = () => p.evaluate(() => JSON.parse(localStorage.getItem("kyf_user_holdings") || "[]"));

await addQuick("fd", "SBI FD", 200000);
ok((await stored()).length === 1, "first holding (FD) saved");
ok(await p.locator("#assign-banner").isVisible(), "banner appears after the first holding");
await addQuick("epf", "EPF", 450000);
ok((await stored()).length === 2, "EPF added after the FD");
await addQuick("epf", "PPF", 300000);
ok((await stored()).length === 3, "PPF added (EPF/PPF tile, renamed)");
await addQuick("cash", "Salary account", 80000);
ok((await stored()).length === 4, "cash added too");
const names = (await stored()).map((h) => h.name);
ok(["SBI FD", "EPF", "PPF", "Salary account"].every((n) => names.includes(n)), "all four are there: " + names.join(", "));
ok(await p.locator("#assign-banner").isVisible(), "banner still offers to give them a job");
ok(errs.length === 0, "no page errors " + errs.join(";"));
await b.close(); srv.close();
console.log(`add-many: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
