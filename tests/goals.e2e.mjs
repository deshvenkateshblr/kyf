/**
 * End-to-end test for the unified Goals flow.
 * Run:  node tests/goals.e2e.mjs
 *
 * Covers: discovery from templates -> goal cards & SIP -> affordability check ->
 * checklist in Cadence -> v2 .kyf import (planner + portfolio goals merged) ->
 * Portfolio funding shows on the goal -> save writes a v3 file -> delete cleans up.
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
const base = `http://127.0.0.1:${server.address().port}/`;

let passed = 0;
let failed = 0;
const check = (ok, label, extra = "") => {
  if (ok) { passed++; console.log(`  ✓ ${label}`); }
  else { failed++; console.log(`  ✗ ${label} ${extra}`); }
};

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true });
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const goalsUrl = base + "goals.html";
const cadenceUrl = base + "cadence.html";
const portfolioUrl = base + "portfolio.html";
const goalCards = () => page.locator("#goalSections .goal-card").count();

console.log("[1] Discovery from templates");
await page.goto(goalsUrl);
await page.waitForSelector("#templateGrid .template-card");
check(await page.locator("#discoverPanel").isVisible(), "empty page shows the discovery panel");
check((await page.locator("#templateGrid .template-card").count()) === 5, "five starter goals offered");
check(!(await page.locator("#goalSections").isVisible()), "no empty goal sections while there are no goals");
await page.click('#templateGrid [data-template="home_downpayment"]');
await page.waitForSelector("#goalModalOverlay.open");
check((await page.inputValue("#goalTitleInput")) === "Home Down Payment / Prepayment", "template pre-fills the name");
check((await page.inputValue("#goalPvInput")) === "2500000", "template pre-fills the cost");
check((await page.textContent("#prevSip")).includes("/mo"), "drawer previews the monthly SIP live");
await page.click("#saveGoalBtn");
await page.waitForSelector("#goalModalOverlay", { state: "hidden" }).catch(() => {});
await page.waitForSelector("#goalSections .goal-card");
check((await goalCards()) === 1, "goal card created");
check(!(await page.locator("#discoverPanel").isVisible()), "discovery panel hides once a goal exists");
check((await page.textContent("#metricTotalCount")).trim() === "1", "summary shows 1 open goal");
check((await page.textContent("#metricTotalSIP")).includes("₹"), "summary shows a monthly SIP");
check((await page.textContent("#groupESSENTIAL .goal-card h3")).includes("Home Down Payment"), "essential goals sit under Essential");
check(!/₹₹/.test(await page.textContent("main")), "no doubled rupee signs");

console.log("[2] Affordability check");
await page.fill("#surplusInput", "1000");
check(/short by/.test(await page.textContent("#planCheckMsg")), "low surplus → plan is stretched");
await page.fill("#surplusInput", "500000");
check(/plan fits/.test(await page.textContent("#planCheckMsg")), "high surplus → plan fits");

console.log("[3] Edit");
await page.click("#goalSections [data-action=edit]");
await page.waitForSelector("#goalModalOverlay.open");
check((await page.locator("#templatePick").isVisible()) === false, "template picker is hidden when editing");
await page.selectOption("#goalInflationInput", "CUSTOM");
check(await page.locator("#customInflationGroup").isVisible(), "custom inflation rate field appears");
await page.fill("#goalCustomRateInput", "8");
await page.fill("#goalSavedInput", "500000");
await page.click("#saveGoalBtn");
await page.waitForSelector("#goalModalOverlay", { state: "hidden" }).catch(() => {});
check((await page.textContent("#goalSections .saved-note")).includes("set aside"), "money set aside shows on the card");

console.log("[4] Checklist lives in Cadence");
const goalId = await page.getAttribute("#goalSections .goal-card", "data-id");
check((await page.textContent("#goalSections .checklist-link")).includes("0/4"), "card shows 0/4 steps");
await page.goto(cadenceUrl + "?goal=" + goalId);
await page.waitForSelector(".goal-group-head");
check((await page.locator("#goalsGrid .act-card").count()) === 4, "Cadence lists the goal's 4 steps");
check((await page.textContent(".goal-group-head h3")).includes("Home Down Payment"), "steps are grouped under the goal name");
await page.goto(cadenceUrl);
await page.waitForSelector(".goal-group-head");
check((await page.locator("#housekeepingGrid .act-card").count()) >= 8, "housekeeping cards are still there");
check(!(await page.textContent("#goalsGrid")).includes("Buy My First Home"), "old generic milestone cards are gone");
await page.locator('#goalsGrid .quick-done-btn').first().click();
check((await page.textContent(".goal-group-progress")).includes("1/"), "ticking a step updates the group progress");
await page.goto(goalsUrl);
await page.waitForSelector("#goalSections .goal-card");
const steps = (await page.textContent("#goalSections .checklist-link")).trim();
check(steps.includes("1/4 steps"), `Goals page reflects Cadence progress (${steps})`);

console.log("[5] Import an older (v2) file: both goal lists merge, Portfolio funds the goal");
const v2 = {
  app: "Know Your Finance", version: "2.0.0", fileType: "kyf-vault",
  data: {
    cadence: [],
    portfolio: [
      { id: "h1", name: "Index Fund", assetClass: "Mutual Funds", pricingMode: "MANUAL", currentValue: 800000, investedValue: 700000, instrumentMeta: {}, allocations: [{ goalId: "goal-college", percentage: 100 }] }
    ],
    members: [{ id: "m1", name: "Asha", role: "Self" }],
    goals: [{ id: "goal-college", title: "Child College", category: "education", priority: "essential", years: 10, presentValue: 4000000, inflationRate: 10, expectedReturn: 12, currentSavings: 100000, status: "in_progress", description: "" }],
    portfolioGoals: [{ id: "goal_home_old", name: "Family Home", icon: "🏠", targetYear: 2032, baseTargetINR: 9000000, inflationCategory: "CPI", priority: "HIGH" }]
  }
};
const tmp = path.join(root, "tests", ".tmp-v2.kyf");
fs.writeFileSync(tmp, JSON.stringify(v2));
await page.goto(portfolioUrl);
await page.waitForSelector("#kyfFileInput", { state: "attached" });
await page.setInputFiles("#kyfFileInput", tmp);
await page.waitForTimeout(1200);
fs.unlinkSync(tmp);
await page.goto(portfolioUrl);
await page.waitForSelector("#kpi-net-worth");
await page.waitForTimeout(800);
await page.goto(goalsUrl);
await page.waitForSelector("#goalSections .goal-card");
check((await goalCards()) === 2, "imported planner goal + portfolio goal both appear (and the old template goal was replaced)");
const collegeCard = page.locator('#goalSections .goal-card[data-id="goal-college"]');
check((await collegeCard.textContent()).includes("Child College"), "planner goal converted");
check(/in Portfolio/.test(await collegeCard.locator(".saved-note").textContent()), "college goal shows money held in Portfolio");
check((await collegeCard.locator(".tag-cat").textContent()).includes("Child Education"), "education category kept");
const homeCard = page.locator('#goalSections .goal-card[data-id="goal_home_old"]');
check((await homeCard.count()) === 1 && (await page.locator("#groupESSENTIAL #gridESSENTIAL .goal-card").count()) === 2, "legacy priority HIGH → Essential");

console.log("[6] Save writes ONE v3 goals list");
const [download] = await Promise.all([page.waitForEvent("download"), page.click("#navSaveDataBtn")]);
const saved = JSON.parse(fs.readFileSync(await download.path(), "utf8"));
check(saved.version === "3.0.0", "file is stamped 3.0.0");
check(Array.isArray(saved.data.goals) && saved.data.goals.length === 2 && saved.data.portfolioGoals === undefined, "one goals list, no portfolioGoals");
check(saved.data.settings && saved.data.settings.monthlySurplusINR === 500000, "monthly surplus saved in the file");
check(saved.data.goals.every((g) => g.targetYear && g.baseTargetINR && g.priority && g.status), "every goal has the full unified schema");

console.log("[7] Delete cleans up");
page.on("dialog", (d) => d.accept());
await collegeCard.locator("[data-action=delete]").click();
await page.waitForTimeout(300);
check((await goalCards()) === 1, "goal removed");
await page.goto(cadenceUrl);
await page.waitForSelector("#goalsGrid");
check(!(await page.textContent("#goalsGrid")).includes("Child's Higher Education"), "its checklist is removed from Cadence");

console.log("[8] Mobile layout");
await page.setViewportSize({ width: 390, height: 800 });
await page.goto(goalsUrl);
await page.waitForSelector("#goalSections .goal-card");
const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
check(!overflow, "no horizontal scroll at phone width");

check(errors.length === 0, "no uncaught page errors", errors.join(" | "));
console.log(`\n${passed} passed, ${failed} failed`);
await browser.close();
server.close();
process.exit(failed ? 1 : 0);
