/**
 * End-to-end test: adding a US ETF (asset class, rate when bought, edit round trip).
 *
 * Run:  node tests/us-holdings.e2e.mjs
 * Needs Playwright (playwright-core is in devDependencies) and a Chromium browser.
 *
 */
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
const base = `http://127.0.0.1:${server.address().port}/portfolio.html`;

let passed = 0;
let failed = 0;
const check = (ok, label, extra = "") => {
  if (ok) { passed++; console.log(`  ✓ ${label}`); }
  else { failed++; console.log(`  ✗ ${label} ${extra}`); }
};

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));

const holdingCount = () => page.locator(".btn-edit-leaf").count();
const netWorth = async () => (await page.textContent("#kpi-net-worth")).trim();

async function fillAndSave({ units, curval }) {
  if (units != null) await page.fill("#input-holding-units", String(units));
  if (curval != null) await page.fill("#input-holding-curval", String(curval));
  await page.click("#btn-save-holding");
  await page.waitForSelector("#holding-modal", { state: "hidden" });
}

try {
  await page.goto(base);
  await page.waitForSelector("#empty-omni-search-input");
  await page.fill("#empty-omni-search-input", "GLD");
  await page.waitForSelector("#empty-omni-search-results .omni-result-item");
  const tags = await page.locator("#empty-omni-search-results .omni-tag").allTextContents();
  check(tags.some((t) => /US ETF/i.test(t)), "searching GLD offers the US ETF: " + tags.join(","));
  await page.locator("#empty-omni-search-results .omni-result-item", { hasText: "SPDR Gold" }).first().click();
  await page.waitForSelector("#holding-modal", { state: "visible" });
  await page.click("#holding-more-details summary");
  check(await page.locator("#field-holding-purchasefx").isVisible(), "a US holding asks for the optional rate when bought");
  check(/\$/.test(await page.textContent("#label-holding-invval")), "invested amount is in dollars");
  check((await page.inputValue("#select-holding-assetclass")) === "Commodities & Gold", "a gold ETF is filed as Commodities & Gold, got " + await page.inputValue("#select-holding-assetclass"));
  await page.fill("#input-holding-units", "10");
  await page.fill("#input-holding-invval", "3000");
  await page.fill("#input-holding-purchasefx", "83");
  await page.click("#btn-save-holding");
  await page.waitForSelector(".btn-edit-leaf");
  const text = await page.textContent("body");
  check(/Commodities & Gold/.test(text), "the holding is grouped under Commodities & Gold");
  await page.locator(".btn-edit-leaf").first().click();
  await page.waitForSelector("#holding-modal", { state: "visible" });
  await page.evaluate(() => { document.getElementById("holding-more-details").open = true; });
  check((await page.inputValue("#input-holding-purchasefx")) === "83", "rate when bought is remembered on edit");
  check((await page.inputValue("#input-holding-invval")) === "3000", "dollar cost is remembered on edit");
  await page.fill("#input-holding-purchasefx", "");
  await page.click("#btn-save-holding");
  await page.locator(".btn-edit-leaf").first().click();
  await page.waitForSelector("#holding-modal", { state: "visible" });
  await page.evaluate(() => { document.getElementById("holding-more-details").open = true; });
  check((await page.inputValue("#input-holding-purchasefx")) === "", "clearing the rate when bought sticks");
  await page.click("#btn-cancel-holding");
  check(errors.length === 0, "no page errors " + errors.join("|"));
} catch (e) {
  failed++; console.log("  ✗ test crashed: " + e.message);
}
await browser.close();
server.close();
console.log(`us-holdings e2e: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
