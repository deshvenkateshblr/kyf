/**
 * End-to-end smoke test for the "build a portfolio from scratch" flow.
 *
 * Run:  node tests/portfolio-entry.e2e.mjs
 * Needs Playwright (playwright-core is in devDependencies) and a Chromium browser.
 *
 * Covers: empty state -> add 5 holdings (stock, fund, gold, FD, cash) -> save ->
 * reload -> identical net worth -> delete with Undo -> unsaved-changes cue.
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
  console.log("[1] Empty state");
  await page.goto(base);
  await page.waitForSelector("#empty-omni-search-input");
  check(true, "fresh visit shows the empty state with the search box");
  check(await page.isChecked("#demo-data-toggle") === false, "demo mode is off by default");
  check((await page.locator(".quick-pick-tile").count()) >= 5, "quick-pick tiles are shown");

  console.log("[2] Add five holdings");
  // Stock via unified search
  await page.fill("#empty-omni-search-input", "sbin");
  await page.waitForSelector("#empty-omni-search-results .omni-result-item");
  await page.locator("#empty-omni-search-results .omni-result-item").first().click();
  await page.waitForSelector("#holding-modal", { state: "visible" });
  check(!(await page.locator("#holding-more-details").evaluate((d) => d.open)), "optional fields are collapsed on add");
  await fillAndSave({ units: 100 });
  await page.waitForSelector(".btn-edit-leaf");
  check((await holdingCount()) === 1, "stock holding added");

  // Mutual fund via the single "What do you own?" box (it is both search and name field)
  await page.click("#btn-open-holding-modal");
  check((await page.locator("#input-holding-name").count()) === 0, "no separate name text box in the modal");
  await page.fill("#modal-omni-search-input", "parag");
  await page.waitForSelector("#modal-omni-search-results .omni-result-item");
  const firstTag = (await page.locator("#modal-omni-search-results .omni-result-item .omni-tag").first().textContent()).trim();
  const firstName = (await page.locator("#modal-omni-search-results .omni-result-name").first().textContent()).trim();
  check(firstTag === "Fund" && /parag parikh/i.test(firstName), `"parag" ranks the fund first (${firstTag}: ${firstName})`);
  await page.locator("#modal-omni-search-results .omni-result-item").first().click();
  check(/parag parikh/i.test(await page.inputValue("#modal-omni-search-input")), "picked name stays in the box");
  await fillAndSave({ curval: 150000 });
  check((await holdingCount()) === 2, "mutual fund added");

  // Gold, FD, Cash by manual entry
  const manual = [
    { name: "Gold coins", cls: "Gold", curval: 280000 },
    { name: "SBI FD", cls: "Fixed Income", curval: 100000 },
    { name: "Savings account", cls: "Cash & Liquid", curval: 50000 }
  ];
  for (const m of manual) {
    await page.click("#btn-open-holding-modal");
    await page.fill("#modal-omni-search-input", m.name);
    await page.selectOption("#select-holding-assetclass", m.cls);
    await fillAndSave({ curval: m.curval });
  }
  check((await holdingCount()) === 5, "five holdings are listed");

  console.log("[2b] Row actions and drawer");
  check(await page.locator(".btn-edit-leaf").first().isVisible(), "Edit button is visible without hovering");
  check((await page.locator("#holding-more-details").count()) === 1 && (await page.locator(".leaf-name-text.is-editable").count()) === 5, "holding names are click-to-edit");
  await page.locator(".leaf-name-text.is-editable").first().click();
  await page.waitForSelector("#holding-modal", { state: "visible" });
  await page.waitForTimeout(400); // let the slide-in animation finish
  const box = await page.locator("#holding-modal .drawer-panel").boundingBox();
  const vp = page.viewportSize();
  check(Math.abs(box.x + box.width - vp.width) < 2 && box.height >= vp.height - 2, "edit opens as a right-hand slide-over drawer");
  check(await page.locator("#btn-save-holding").isVisible(), "Save stays in view");
  await page.click("#btn-cancel-holding");

  console.log("[2c] Fund units follow the selected plan");
  await page.click("#btn-open-holding-modal");
  await page.fill("#modal-omni-search-input", "parag parikh flexi");
  await page.waitForSelector("#modal-omni-search-results .omni-result-item");
  await page.locator("#modal-omni-search-results .omni-result-item").first().click();
  await page.fill("#input-holding-curval", "100000");
  const directPrice = parseFloat(await page.inputValue("#input-holding-price"));
  const directUnits = parseFloat(await page.inputValue("#input-holding-units"));
  await page.click("#label-variant-regular");
  const regPrice = parseFloat(await page.inputValue("#input-holding-price"));
  const regUnits = parseFloat(await page.inputValue("#input-holding-units"));
  check(directPrice > 0 && regPrice > 0 && regPrice !== directPrice, `NAV changes with the plan (${directPrice} -> ${regPrice})`);
  check(Math.abs(regUnits * regPrice - 100000) < regPrice && regUnits > directUnits, `units recomputed from the Regular NAV (${directUnits} -> ${regUnits}); worth stays ₹1,00,000`);
  check((await page.inputValue("#input-holding-curval")) === "100000", "worth today is unchanged by the plan switch");
  await page.click("#btn-cancel-holding");

  console.log("[2d] Family members drawer");
  await page.click("#btn-open-member-modal");
  await page.waitForSelector("#member-modal", { state: "visible" });
  await page.waitForTimeout(400);
  const mbox = await page.locator("#member-modal .drawer-panel").boundingBox();
  check(Math.abs(mbox.x + mbox.width - page.viewportSize().width) < 2, "member dialog is a right-hand drawer too");
  await page.fill("#input-member-name", "Asha");
  await page.selectOption("#select-member-role", "Spouse");
  await page.click("#form-add-member button[type=submit]");
  await page.waitForFunction(() => document.getElementById("modal-members-list").textContent.includes("Asha"));
  check(true, "a family member can be added from the drawer");
  await page.click("#btn-close-member-modal");
  await page.waitForSelector("#member-modal", { state: "hidden" });

  console.log("[3] Footer");
  check((await page.textContent("#kyf-footer")).includes("Questions, comments, feedback write to info@vividnova.com"), "footer shows the feedback line");
  check(/^KYF v\d+\.\d+\.\d+$/.test((await page.textContent(".kyf-footer-version")).trim()), "footer shows the app version");
  check((await page.locator(".kyf-footer-refresh").count()) === 1 && (await page.locator(".sticky-footer").count()) === 0, "one Refresh button, no duplicate bars");

  console.log("[4] Unsaved-changes cue");
  check(await page.locator("#navSaveDataBtn").evaluate((b) => b.classList.contains("has-unsaved")), "Save button flags unsaved changes");

  console.log("[5] Reload keeps numbers identical");
  const before = await netWorth();
  await page.reload();
  await page.waitForSelector(".btn-edit-leaf");
  const after = await netWorth();
  check(before === after && before !== "₹0", `net worth identical after reload (${before} vs ${after})`);
  check((await holdingCount()) === 5, "all five holdings still present after reload");

  console.log("[6] Delete with Undo");
  await page.locator(".btn-delete-leaf").first().click().catch(async () => {
    await page.locator(".btn-edit-leaf").first().click();
    await page.click("#btn-delete-holding");
  });
  await page.waitForSelector(".toast-action-btn");
  check((await holdingCount()) === 4, "holding removed without a blocking confirm dialog");
  await page.click(".toast-action-btn");
  await page.waitForFunction(() => document.querySelectorAll(".btn-edit-leaf").length === 5);
  check((await netWorth()) === before, "Undo restores the holding and the net worth");

  console.log("[7] Demo mode is a read-only sandbox");
  const demoPage = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  const demoErrors = [];
  demoPage.on("pageerror", (e) => demoErrors.push(e.message));
  await demoPage.goto(base);
  await demoPage.waitForSelector("#empty-state-demo-link");
  await demoPage.click("#empty-state-demo-link");
  await demoPage.waitForSelector(".btn-edit-leaf", { state: "attached" });
  const demoRows = await demoPage.locator(".btn-edit-leaf").count();
  check(demoRows > 0, `demo family loads (${demoRows} holdings)`);
  check(!(await demoPage.locator(".btn-edit-leaf").first().isVisible()), "edit/delete buttons are hidden on demo rows");
  await demoPage.click("#btn-open-holding-modal");
  await demoPage.waitForSelector("#holding-modal", { state: "visible" });
  check((await demoPage.isChecked("#demo-data-toggle")) === false, "Add leaves demo mode");
  check((await demoPage.locator(".btn-edit-leaf").count()) === 0, "demo holdings are not copied into the new portfolio");
  const memberOptions = await demoPage.locator("#select-holding-member option").allTextContents();
  check(!memberOptions.some((t) => /rajesh|priya/i.test(t)), `demo members are not offered (${memberOptions.join(", ")})`);
  await demoPage.fill("#modal-omni-search-input", "My FD");
  await demoPage.fill("#input-holding-curval", "50000");
  await demoPage.click("#btn-save-holding");
  await demoPage.waitForSelector("#holding-modal", { state: "hidden" });
  check((await demoPage.locator(".btn-edit-leaf").count()) === 1, "only the one new holding exists");
  await demoPage.reload();
  await demoPage.waitForSelector(".btn-edit-leaf");
  check((await demoPage.locator(".btn-edit-leaf").count()) === 1, "your holding survives a reload (demo stays off)");
  check(demoErrors.length === 0, "no page errors in demo flow", demoErrors.join(" | "));

  check(errors.length === 0, "no uncaught page errors", errors.join(" | "));
} catch (err) {
  failed++;
  console.log("  ✗ test run aborted:", err.message);
} finally {
  await browser.close();
  server.close();
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
