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
const ok = (c, m) => { c ? pass++ : (fail++, console.log("FAIL", m)); };
const b = await chromium.launch();
const page = await b.newPage({ viewport: { width: 390, height: 800 } });
const errs = []; page.on("pageerror", e => errs.push(e.message));
await page.goto(base + "/index.html");
ok(await page.locator(".tool-card").count() === 5, "5 tool cards");
for (const h of ["goals.html","cadence.html","portfolio.html","market-performance.html","real-estate-calculator.html"])
  ok(await page.locator(`.tool-card a[href="${h}"]`).count() === 1, "card link " + h);
ok(await page.locator("#welcomeBack").isHidden(), "welcome hidden for new visitor");
ok(await page.locator('.start-path li').count() === 3, "3-step path");
ok(await page.locator("#tools").isVisible(), "tools section visible");
await page.evaluate(() => { localStorage.setItem("kyf_user_goals", JSON.stringify([{id:"a"},{id:"b"}])); localStorage.setItem("kyf_user_holdings", JSON.stringify([{id:"h"}])); });
await page.reload();
ok(/2 goals and 1 holding/.test(await page.locator("#welcomeBack").innerText()), "welcome back counts");
await page.goto(base + "/portfolio.html?demo=1");
await page.waitForTimeout(800);
ok(await page.evaluate(() => localStorage.getItem("kyf_demo_mode")) === "true", "demo flag set");
ok(errs.length === 0, "no page errors: " + errs.join("|"));
await b.close(); srv.close();
console.log(`home e2e: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
