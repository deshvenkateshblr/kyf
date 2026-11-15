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
// Moving between pages never shows a "Leave site?" alert; unsaved changes are only a quiet pulse on Save.
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log("  ✗ " + m); } };
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1100, height: 900 } });
let dialogs = 0; p.on("dialog", (d) => { dialogs++; d.dismiss(); });
const errs = []; p.on("pageerror", (e) => errs.push(e.message));
await p.goto(base + "/portfolio.html"); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(800);
await p.click('.portfolio-empty-box .quick-pick-tile[data-quick="fd"]');
await p.waitForSelector("#holding-modal", { state: "visible" });
await p.fill("#modal-omni-search-input", "SBI FD"); await p.fill("#input-holding-curval", "100000");
await p.click("#btn-save-holding"); await p.waitForTimeout(700);
if (await p.locator("#assign-modal.open").count()) await p.click("#btn-cancel-assign");
ok(await p.locator("#navSaveDataBtn.has-unsaved").count() === 1, "Save pulses after a change on Portfolio");

// into Goals through the nav, the way a person would
await p.click('nav a[href="goals.html"]'); await p.waitForURL(/goals\.html/);
ok(dialogs === 0, "no leave-page alert going from Portfolio to Goals");
await p.waitForTimeout(500);
ok(await p.locator("#navSaveDataBtn.has-unsaved").count() === 1, "the Save reminder follows you to Goals");

// and through a goal's own hand-off
await p.fill("#askInput", "Trip"); await p.keyboard.press("Enter"); await p.waitForTimeout(500);
await p.fill("#goalYearInput", "2030"); await p.fill("#goalPvInput", "100000");
await p.click("#fundingAddBtn"); await p.waitForURL(/portfolio\.html/);
ok(dialogs === 0, "no leave-page alert when a goal sends you to Portfolio");

// closing the tab is also silent
await p.close({ runBeforeUnload: true });
ok(dialogs === 0, "no leave-page alert when closing the tab");
ok(errs.length === 0, "no page errors " + errs.join(";"));
await b.close(); srv.close();
console.log(`no-leave-prompt: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
