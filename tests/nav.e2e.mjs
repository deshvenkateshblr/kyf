/** End-to-end test for the shared top navigation (desktop links + phone ☰ menu). Run: node tests/nav.e2e.mjs */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const { chromium } = (() => {
  for (const name of ["playwright-core", "playwright"]) {
    try { return require(name); } catch { /* try next */ }
  }
  return require(require.resolve("playwright", { paths: ["/opt/npm-tools/node_modules"] }));
})();

const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png" };
const server = http.createServer((req, res) => {
  const rel = decodeURIComponent(req.url.split("?")[0]);
  const file = path.join(root, rel === "/" ? "index.html" : rel);
  if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404); res.end("not found"); return;
  }
  res.writeHead(200, { "Content-Type": MIME[path.extname(file)] || "application/octet-stream" });
  fs.createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, r));
const base = `http://127.0.0.1:${server.address().port}/`;

let passed = 0;
let failed = 0;
const check = (ok, label, extra = "") => {
  if (ok) { passed++; console.log(`  ✓ ${label}`); }
  else { failed++; console.log(`  ✗ ${label} ${extra}`); }
};

const browser = await chromium.launch();
const pages = ["index", "goals", "cadence", "portfolio", "market-performance", "real-estate-calculator"];
const errors = [];

for (const name of pages) {
  console.log(`[${name}]`);
  const ctx = await browser.newContext({ viewport: { width: 390, height: 800 } });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(`${name}: ${e.message}`));
  await page.goto(`${base}${name}.html`);
  await page.waitForSelector("#kyfMenuBtn");
  check(await page.locator("#kyfMenuBtn").isVisible(), "phone: ☰ menu button is visible");
  check(!(await page.locator("#kyfMenuPanel").isVisible()), "phone: menu starts closed");
  const hdr = await page.locator("header.nav").boundingBox();
  check(hdr.height <= 80, `phone: header stays a single row (${Math.round(hdr.height)}px)`);
  if (name !== "index") check(await page.locator("#navSaveDataBtn").isVisible(), "phone: Save Data stays reachable in the header");
  await page.click("#kyfMenuBtn");
  check(await page.locator("#kyfMenuPanel").isVisible(), "tapping ☰ opens the menu");
  check((await page.getAttribute("#kyfMenuBtn", "aria-expanded")) === "true", "aria-expanded reflects the state");
  const labels = await page.locator("#kyfMenuPanel .kyf-menu-label").allTextContents();
  check(["Home", "Goals", "Cadence", "Portfolio", "Market Benchmarks", "Real Estate Calculator", "Framework"].every((l) => labels.includes(l)), "menu lists every area of the app");
  const current = await page.locator("#kyfMenuPanel [aria-current=page]").count();
  check(current === (name === "index" ? 1 : 1), `current page is marked (${current})`);
  const box = await page.locator("#kyfMenuPanel").boundingBox();
  check(box.x >= 0 && box.x + box.width <= 391, "menu fits the phone width");
  await page.keyboard.press("Escape");
  check(!(await page.locator("#kyfMenuPanel").isVisible()), "Escape closes the menu");
  await page.click("#kyfMenuBtn");
  await page.click('#kyfMenuPanel a[href="goals.html"]');
  await page.waitForURL(/goals\.html/);
  check(true, "a menu link navigates");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  check(!overflow, "no horizontal scroll at phone width");
  await ctx.close();
}

console.log("[desktop]");
const dctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const dpage = await dctx.newPage();
const seenBars = new Set();
for (const name of ["index", "goals", "cadence", "portfolio", "market-performance", "real-estate-calculator"]) {
  await dpage.goto(`${base}${name}.html`);
  await dpage.waitForSelector(".nav-links");
  await dpage.waitForSelector("#navSaveDataBtn");
  seenBars.add((await dpage.locator(".nav-links > a, .nav-links > button").allTextContents()).join("|"));
  check(!(await dpage.locator("#kyfMenuBtn").isVisible()), `${name}: no ☰ button on desktop`);
  const links = await dpage.locator(".nav-links > a").allTextContents();
  check(["Goals", "Cadence", "Portfolio", "Markets"].every((l) => links.includes(l)), `${name}: same primary links on every page`);
}
check([...seenBars][0].startsWith("Markets|Goals|Portfolio|Cadence|"), "top bar order is Markets, Goals, Portfolio, Cadence, then Open and Save: " + [...seenBars][0]);
check(seenBars.size === 1, "the top bar is identical on every page, home included: " + [...seenBars].join(" // "));
await dpage.goto(`${base}goals.html`);
check((await dpage.locator(".nav-links > a.active").textContent()) === "Goals", "the current page's link is highlighted");

check(errors.length === 0, "no uncaught page errors", errors.join(" | "));
console.log(`\n${passed} passed, ${failed} failed`);
await browser.close();
server.close();
process.exit(failed ? 1 : 0);
