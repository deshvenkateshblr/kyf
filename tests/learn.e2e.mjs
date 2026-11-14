// Learn page: index by chapter, a lesson with the person's own goal, quick check, related words, Money Word and tip links.
import { createRequire } from "module";
import http from "http"; import fs from "fs"; import path from "path";
const require = createRequire("/opt/npm-tools/node_modules/");
const { chromium } = require("playwright");
const root = path.resolve(new URL("..", import.meta.url).pathname);
const mime = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png" };
const srv = http.createServer((q, r) => {
  const p = path.join(root, decodeURIComponent(q.url.split("?")[0]));
  if (!fs.existsSync(p) || fs.statSync(p).isDirectory()) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { "content-type": mime[path.extname(p)] || "application/octet-stream" }); r.end(fs.readFileSync(p));
}).listen(0);
const base = `http://127.0.0.1:${srv.address().port}`;
let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : (fail++, console.log("FAIL", m)); };
const b = await chromium.launch();

async function page(vp = { width: 1200, height: 800 }) {
  const p = await b.newPage({ viewport: vp });
  p.errs = []; p.on("pageerror", (e) => p.errs.push(e.message));
  return p;
}

// ---- index ----
{
  const p = await page();
  await p.goto(base + "/learn.html");
  await p.waitForSelector(".learn-word");
  ok(await p.locator(".learn-chapter").count() === 10, "index: ten chapters");
  ok(await p.locator(".learn-word").count() === 72, "index: every word is listed once");
  ok(/Test Your Present Money Reflexes/.test(await p.locator(".learn-chapter h2").first().innerText()), "index: chapter names come from the curriculum");
  ok(p.errs.length === 0, "index: no page errors " + p.errs.join("|"));
  await p.close();
}

// ---- a lesson, sample numbers ----
{
  const p = await page();
  await p.goto(base + "/learn.html?term=purchasing_power");
  await p.waitForSelector("h1");
  ok((await p.locator("h1").innerText()) === "Purchasing Power", "lesson: title");
  ok(await p.locator(".learn-block.is-trap").count() === 1, "lesson: the trap is shown");
  const ex = await p.locator(".learn-block", { hasText: "An example" }).innerText();
  ok(!/\{\w+\}/.test(ex) && /inflation/.test(ex), "lesson: example has no unfilled placeholders");
  ok(/Add a goal/.test(ex), "lesson: sample numbers point to Goals");
  // quick check: wrong then right shows the answer
  const wrong = p.locator('.learn-option[data-correct="false"]').first();
  await wrong.click();
  ok(await p.locator(".learn-option.is-right").count() === 1 && await p.locator(".learn-option.is-wrong").count() === 1, "quick check: wrong pick shows the right answer");
  ok(await p.locator(".learn-option:not(:disabled)").count() === 0 && /Not quite/.test(await p.locator(".learn-result").innerText()), "quick check: locked with an explanation");
  // related word and next
  await p.locator(".learn-related a").first().click();
  await p.waitForSelector("h1");
  ok(/term=/.test(p.url()), "related word opens its own lesson");
  ok(p.errs.length === 0, "lesson: no page errors " + p.errs.join("|"));
  await p.close();
}

// ---- a lesson with the person's own goal ----
{
  const p = await page();
  await p.addInitScript(() => {
    try { localStorage.setItem("kyf_user_goals", JSON.stringify([{ id: "g1", name: "Dream Flat", baseTargetINR: 5000000, targetYear: new Date().getFullYear() + 10, kind: "SAVE", inflationCategory: "CPI" }])); } catch (e) {}
  });
  await p.goto(base + "/learn.html?term=purchasing_power");
  await p.waitForSelector("h1");
  const ex = await p.locator(".learn-block", { hasText: "In your numbers" }).innerText();
  ok(/Dream Flat/.test(ex) && /50\.0L/.test(ex) && /10 years/.test(ex), "lesson: uses the person's goal " + ex.slice(0, 120));
  await p.close();
}

// ---- a short word, an unknown word, prev/next ----
{
  const p = await page({ width: 390, height: 844 });
  await p.goto(base + "/learn.html?term=sip");
  await p.waitForSelector("h1");
  ok(await p.locator(".learn-soon").count() === 1 && await p.locator(".learn-option").count() === 0, "short word: says a fuller lesson is coming");
  ok(await p.locator(".learn-pager .is-next").count() === 1, "short word: has a next word");
  ok(await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth) <= 0, "phone: no sideways scroll");
  await p.goto(base + "/learn.html?term=nope");
  await p.waitForSelector("h1");
  ok(/don't have that word/.test(await p.locator("h1").innerText()), "unknown word is handled");
  await p.close();
}

// ---- links in from the app ----
{
  const p = await page();
  await p.addInitScript(() => { try { localStorage.removeItem("kyf_money_word"); sessionStorage.clear(); } catch (e) {} });
  await p.goto(base + "/index.html");
  await p.waitForSelector("#kyf-money-word.mw-in", { timeout: 6000 });
  await p.locator(".mw-btn", { hasText: "Tell me more" }).click();
  await p.waitForURL(/learn\.html\?term=sip/);
  ok((await p.locator("h1").innerText()) === "SIP", "Money Word: Tell me more opens that word");
  await p.goto(base + "/goals.html");
  await p.waitForSelector("button.kyf-term", { timeout: 8000 });
  await p.locator("button.kyf-term").first().click();
  const more = p.locator(".kyf-tip-more");
  ok(await more.isVisible() && /learn\.html\?term=/.test(await more.getAttribute("href")), "tip: Learn more points to the lesson");
  await p.close();
}

await b.close(); srv.close();
console.log(`learn e2e: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
