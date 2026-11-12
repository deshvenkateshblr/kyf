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
for (const w of [360, 390, 768]) {
  await page.setViewportSize({ width: w, height: 800 });
  const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  ok(over <= 0, `no sideways scroll at ${w}px (over by ${over})`);
}
await page.setViewportSize({ width: 390, height: 800 });
const styled = await page.evaluate(() => {
  const li = document.querySelector(".start-path");
  const card = document.querySelector(".tool-card");
  return { listStyle: getComputedStyle(li).listStyleType, cardBorder: getComputedStyle(card).borderTopWidth, cardRadius: getComputedStyle(card).borderTopLeftRadius };
});
ok(styled.listStyle === "none", "start path has no default bullets/numbers");
ok(styled.cardBorder !== "0px" && styled.cardRadius !== "0px", "tool cards are styled");
const btnBg = await page.evaluate(() => getComputedStyle(document.querySelector(".tool-card .btn")).display);
ok(btnBg !== "inline", "tool card button styled");
await page.evaluate(() => { localStorage.setItem("kyf_user_goals", JSON.stringify([{id:"a"},{id:"b"}])); localStorage.setItem("kyf_user_holdings", JSON.stringify([{id:"h"}])); });
await page.reload();
ok(/2 goals and 1 holding/.test(await page.locator("#welcomeBack").innerText()), "welcome back counts");
await page.goto(base + "/portfolio.html?demo=1");
await page.waitForTimeout(800);
ok(await page.evaluate(() => localStorage.getItem("kyf_demo_mode")) === "true", "demo flag set");
ok(errs.length === 0, "no page errors: " + errs.join("|"));

// ---------- Money Word ----------
{
  const ctx = await b.newContext({ viewport: { width: 390, height: 800 } });
  const p = await ctx.newPage();
  const perrs = []; p.on("pageerror", e => perrs.push(e.message));
  await p.goto(base + "/index.html");
  await p.waitForSelector("#kyf-money-word.mw-in", { timeout: 6000 });
  const first = await p.locator(".mw-term").innerText();
  ok(first === "SIP", "Money Word starts with the first curriculum word, got " + first);
  ok((await p.locator(".mw-tip").innerText()).length > 20, "shows the plain meaning");
  ok(await p.locator(".mw-btn", { hasText: "Tell me more" }).count() === 0, "no Tell me more until topic pages exist");
  const box = await p.locator("#kyf-money-word").boundingBox();
  ok(box.x >= 0 && box.x + box.width <= 390 && box.y + box.height <= 800, "card fits the phone screen");
  const over = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  ok(over <= 0, "card adds no sideways scroll");
  await p.click(".mw-btn:has-text('Next word')");
  ok(await p.locator(".mw-term").innerText() === "Step-up", "Next word moves on");
  await p.click(".mw-btn:has-text('I know this')");
  ok(await p.locator(".mw-term").innerText() === "NAV", "I know this moves on");
  await p.reload();
  await p.waitForSelector("#kyf-money-word.mw-in", { timeout: 6000 });
  ok(await p.locator(".mw-term").innerText() === "NAV" || (await p.locator(".mw-term").innerText()) === "CAGR", "resumes after the last word shown, never repeats a known one");
  await p.click(".mw-close");
  ok(await p.locator("#kyf-money-word").count() === 0, "x hides the card");
  await p.reload();
  await p.waitForTimeout(3200);
  ok(await p.locator("#kyf-money-word").count() === 0, "stays hidden for the rest of the visit");
  await p.click("#kyf-mw-switch");
  ok(/off/.test(await p.locator("#kyf-mw-switch").innerText()), "footer switch turns it off");
  await p.click("#kyf-mw-switch");
  await p.waitForSelector("#kyf-money-word");
  await p.click(".mw-off");
  ok(await p.locator("#kyf-money-word").count() === 0, "Don't show again hides it");
  ok(/off/.test(await p.locator("#kyf-mw-switch").innerText()), "footer shows it is off");
  const ctx2p = await p.context().newPage();
  await ctx2p.goto(base + "/index.html");
  await ctx2p.waitForTimeout(3200);
  ok(await ctx2p.locator("#kyf-money-word").count() === 0, "off persists in a new visit");
  ok(perrs.length === 0, "Money Word: no page errors " + perrs.join("|"));
  await ctx.close();
}
await b.close(); srv.close();
console.log(`home e2e: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
