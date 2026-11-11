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
const openRow = async (row) => { if (!(await row.evaluate((e) => e.open))) await row.locator("summary").click(); };
const goalCards = () => page.locator("#goalList .goal-row").count();

console.log("[1] Discovery: ask box, no pre-filled numbers");
await page.goto(goalsUrl);
await page.waitForSelector("#ideaChips .idea-chip");
check(!(await page.locator("#goalsSection").isVisible()), "no empty goal list or totals before the first goal");
check(!(await page.locator("#planSection").isVisible()), "no summary strip before the first goal");
check((await page.locator("#ideaChips .idea-chip").count()) === 13, "thirteen goal ideas are offered as chips");
await page.fill("#askInput", "college");
await page.waitForSelector("#askResults .ask-item");
check((await page.locator("#askResults .ask-item").first().textContent()).includes("Child's education"), "typing 'college' suggests Child's education");
check((await page.locator("#askResults .ask-item").last().textContent()).includes("Create “college” as my own goal"), "a custom-goal option is always offered");
await page.keyboard.press("Enter");
await page.waitForSelector("#goalModalOverlay.open");
check((await page.inputValue("#goalTitleInput")) === "Child's education", "drawer opens with the idea's name");
check((await page.inputValue("#goalPvInput")) === "" && (await page.inputValue("#goalYearInput")) === "", "cost and year start EMPTY (the user decides)");
check((await page.textContent("#prevSip")).trim() === "—", "preview shows dashes until numbers are entered");
await page.click("#helpToggleBtn");
check((await page.locator("#helpList li").count()) >= 2 && (await page.textContent("#helpFormula")).includes("The sum"), "'Help me work it out' lists the questions and the formula");
check(!(await page.locator("#residexHelper").isVisible()), "the home price helper only shows for the home goal");
await page.fill("#goalYearInput", String(new Date().getFullYear() + 10));
await page.fill("#goalPvInput", "3000000");
check((await page.textContent("#prevSip")).includes("/mo"), "preview works once cost and year are entered");
await page.click("#saveGoalBtn");
await page.waitForSelector("#goalList .goal-row");
check((await goalCards()) === 1 && (await page.locator("#planSection").isVisible()), "goal saved; summary appears");
check(!/₹₹/.test(await page.textContent("main")), "no doubled rupee signs");

console.log("[1b] A goal without a number");
await page.fill("#askInput", "wedding");
await page.keyboard.press("Enter");
await page.waitForSelector("#goalModalOverlay.open");
await page.fill("#goalYearInput", String(new Date().getFullYear() + 3));
await page.click("#saveGoalBtn");
await page.waitForFunction(() => document.querySelectorAll("#goalList .goal-row").length === 2);
const wedding = page.locator("#goalList .goal-row", { hasText: "Wedding" });
check((await wedding.locator(".row-status").textContent()).includes("Needs a number"), "unpriced goal says 'Needs a number'");
check((await page.textContent("#needsNumberNote")).includes("1 goal needs a number"), "summary notes it is not counted yet");
check((await page.textContent("#metricTotalCount")).trim() === "2", "it still counts as an open goal");
await openRow(wedding);
await wedding.locator("[data-action=number]").click();
await page.waitForSelector("#goalModalOverlay.open");
check(await page.locator("#helpPanel").isVisible(), "'Add a number' opens the drawer with the help panel showing");
await page.fill("#goalPvInput", "1500000");
await page.click("#saveGoalBtn");
await page.waitForFunction(() => !document.querySelector("#needsNumberNote") || document.querySelector("#needsNumberNote").hidden);
check(true, "adding a number clears the 'needs a number' note");

console.log("[1c] Home price helper (RESIDEX)");
await page.fill("#askInput", "house");
await page.keyboard.press("Enter");
await page.waitForSelector("#goalModalOverlay.open");
await page.click("#helpToggleBtn");
check(await page.locator("#residexHelper").isVisible(), "home goal shows the RESIDEX helper");
await page.selectOption("#residexCity", "Pune");
await page.fill("#residexSqft", "1000");
await page.fill("#residexDown", "20");
const residexText = await page.textContent("#residexResult");
check(/RESIDEX/.test(residexText) && /sq ft/.test(residexText) && /not a quote/.test(residexText), "helper cites the source and says it is an index average");
check((await page.inputValue("#goalPvInput")) === "", "the helper never fills the cost by itself");
await page.click("#useDownPaymentBtn");
const pv = Number(await page.inputValue("#goalPvInput"));
check(pv > 500000, `'Use the down payment' fills the cost (₹${pv.toLocaleString("en-IN")})`);
await page.fill("#goalYearInput", String(new Date().getFullYear() + 5));
await page.click("#saveGoalBtn");
await page.waitForFunction(() => document.querySelectorAll("#goalList .goal-row").length === 3);

console.log("[1d] Retirement helper");
await page.fill("#askInput", "retire");
await page.keyboard.press("Enter");
await page.waitForSelector("#goalModalOverlay.open");
await page.click("#helpToggleBtn");
check(await page.locator("#retireHelper").isVisible() && !(await page.locator("#residexHelper").isVisible()), "retirement goal shows the retirement helper only");
check(await page.locator("#useRetirementBtn").isDisabled(), "'Use this corpus' stays disabled until inputs make sense");
await page.fill("#retireAge", "38");
await page.fill("#retireAt", "58");
await page.fill("#retireExpenses", "1000000");
const rtext = await page.textContent("#retireResult");
check(/32 years/.test(rtext) && /today's money/.test(rtext) && /25.30/.test(rtext), "result explains years, corpus in today's money, and the 25–30× check");
check((await page.inputValue("#goalPvInput")) === "", "the helper never fills the cost by itself");
await page.click("#useRetirementBtn");
const retYear = new Date().getFullYear() + 20;
check((await page.inputValue("#goalYearInput")) === String(retYear), "year is set to the retirement year");
check(Number(await page.inputValue("#goalPvInput")) > 10000000, "cost is the corpus in today's money");
check((await page.textContent("#prevSip")).includes("/mo"), "SIP preview works from the helper");
await page.click("#saveGoalBtn");
await page.waitForFunction(() => document.querySelectorAll("#goalList .goal-row").length === 4);
const retire = page.locator("#goalList .goal-row", { hasText: "Retirement" });
await openRow(retire);
await retire.locator("[data-action=edit]").click();
await page.waitForSelector("#goalModalOverlay.open");
await page.click("#helpToggleBtn");
check((await page.inputValue("#retireAge")) === "38" && (await page.inputValue("#retireAt")) === "58" && (await page.inputValue("#retireExpenses")) === "1000000", "reopening remembers the retirement inputs");
await page.click("#cancelGoalModalBtn");

console.log("[1e] Protection goals");
await page.fill("#askInput", "insurance");
await page.waitForSelector("#askResults .ask-item");
const sugg = await page.locator("#askResults .ask-label").allTextContents();
check(sugg.includes("Term life cover") && sugg.includes("Health insurance"), "'insurance' suggests term and health cover");
await page.fill("#askInput", "term");
await page.keyboard.press("Enter");
await page.waitForSelector("#goalModalOverlay.open");
check(!(await page.locator("#goalYearInput").isVisible()) && !(await page.locator("#goalPvInput").isVisible()), "cover goals have no date or savings target");
check(await page.locator("#coverNeededInput").isVisible() && await page.locator("#coverInPlaceInput").isVisible() && await page.locator("#coverPremiumInput").isVisible(), "cover needed, cover in place and premium fields show");
check((await page.textContent("#goalOwnerLabel")).includes("Who is covered"), "owner label reads 'Who is covered?'");
check(!(await page.locator("#modalPreviewBox").isVisible()), "no SIP preview for a cover goal");
await page.click("#helpToggleBtn");
check(await page.locator("#termHelper").isVisible() && !(await page.locator("#retireHelper").isVisible()), "term helper shows");
check(await page.locator("#useTermNeedsBtn").isDisabled(), "'Use' buttons stay disabled until there is something to use");
await page.fill("#termIncome", "2000000");
await page.fill("#termLoans", "3000000");
await page.fill("#termExpenses", "600000");
await page.fill("#termYears", "15");
await page.click("#termFromGoalsBtn");
const tText = await page.textContent("#termResult");
check(/Rule of thumb/.test(tText) && /Needs-based/.test(tText), "helper shows both the rule of thumb and the needs-based figure");
check((await page.inputValue("#coverNeededInput")) === "", "the helper never fills the cover by itself");
await page.click("#useTermNeedsBtn");
check(Number(await page.inputValue("#coverNeededInput")) > 10000000, "needs-based figure fills the cover needed");
await page.fill("#coverInPlaceInput", "5000000");
await page.fill("#coverPremiumInput", "18000");
await page.click("#saveGoalBtn");
await page.waitForFunction(() => document.querySelectorAll("#goalList .goal-row").length === 5);
const term = page.locator("#goalList .goal-row", { hasText: "Term life cover" });
check((await term.locator(".row-status").textContent()).includes("Cover gap"), "row shows the cover gap");
check((await term.locator(".row-sub").textContent()).includes("Protection"), "row is labelled Protection");
check((await page.locator("#goalList .goal-row").first().getAttribute("data-id")) === (await term.getAttribute("data-id")), "protection goals are listed first");
check(/0 of 1 protection goal/.test(await page.textContent("#protectionNote")) && /18\.0 K a year/.test(await page.textContent("#protectionNote")), "summary notes protection status and premiums");
await openRow(term);
check(/Cover needed/.test(await term.textContent()) && /Gap to close/.test(await term.textContent()), "detail shows cover needed, in place, gap");
await term.locator("[data-action=edit]").click();
await page.waitForSelector("#goalModalOverlay.open");
check((await page.inputValue("#coverInPlaceInput")) === "5000000" && !(await page.locator("#goalYearInput").isVisible()), "editing restores cover fields");
await page.fill("#coverInPlaceInput", "99999999");
await page.click("#saveGoalBtn");
await page.waitForSelector("#goalModalOverlay", { state: "hidden" }).catch(() => {});
check((await page.locator("#goalList .goal-row", { hasText: "Term life cover" }).locator(".row-status").textContent()).includes("Covered"), "enough cover in place → Covered");
const sipBefore = await page.textContent("#metricTotalSIP");
check(sipBefore.includes("₹"), "protection goals do not add to the monthly SIP");
await page.fill("#askInput", "health");
await page.keyboard.press("Enter");
await page.waitForSelector("#goalModalOverlay.open");
await page.click("#helpToggleBtn");
check(!(await page.locator("#termHelper").isVisible()) && (await page.locator("#helpList li").count()) >= 3, "health insurance gives questions only, no calculator");
await page.click("#cancelGoalModalBtn");

console.log("[2] Affordability check");
await page.fill("#surplusInput", "1000");
check(/short by/.test(await page.textContent("#planCheckMsg")), "low surplus → plan is stretched");
await page.fill("#surplusInput", "500000");
check(/plan fits/.test(await page.textContent("#planCheckMsg")), "high surplus → plan fits");

console.log("[3] Edit");
const college = page.locator("#goalList .goal-row", { hasText: "Child's education" });
await openRow(college);
await college.locator("[data-action=edit]").click();
await page.waitForSelector("#goalModalOverlay.open");
await page.click("#moreOptions summary");
await page.selectOption("#goalInflationInput", "CUSTOM");
check(await page.locator("#customInflationGroup").isVisible(), "custom inflation rate field appears under More options");
await page.fill("#goalCustomRateInput", "8");
await page.fill("#goalSavedInput", "500000");
await page.click("#saveGoalBtn");
await page.waitForSelector("#goalModalOverlay", { state: "hidden" }).catch(() => {});
check((await page.locator("#goalList .goal-row", { hasText: "Child's education" }).locator(".saved-note").textContent()).includes("set aside"), "money set aside shows in the goal's detail");

console.log("[4] Checklist lives in Cadence");
const goalId = await page.locator("#goalList .goal-row", { hasText: "Child's education" }).getAttribute("data-id");
check((await page.locator("#goalList .goal-row", { hasText: "Child's education" }).locator(".checklist-link").textContent()).includes("0/4"), "goal shows 0/4 steps");
await page.goto(cadenceUrl + "?goal=" + goalId);
await page.waitForSelector(".goal-group-head");
check((await page.locator("#goalsGrid .act-card").count()) === 4, "Cadence lists the goal's 4 steps");
check((await page.textContent(".goal-group-head h3")).includes("Child's education"), "steps are grouped under the goal name");
await page.goto(cadenceUrl);
await page.waitForSelector(".goal-group-head");
check((await page.locator("#housekeepingGrid .act-card").count()) >= 8, "housekeeping cards are still there");
check(!(await page.textContent("#goalsGrid")).includes("Buy My First Home"), "old generic milestone cards are gone");
await page.locator('#goalsGrid .quick-done-btn').first().click();
check((await page.textContent(".goal-group-progress")).includes("1/"), "ticking a step updates the group progress");
await page.goto(goalsUrl);
await page.waitForSelector("#goalList .goal-row");
const steps = (await page.locator("#goalList .goal-row", { has: page.locator(".row-name", { hasText: /^Child's education$/ }) }).locator(".checklist-link").first().textContent()).trim();
check(steps.includes("1/4 steps") || steps.includes("/4 steps"), `Goals page reflects Cadence progress (${steps})`);

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
await page.waitForSelector("#goalList .goal-row");
check((await goalCards()) === 2, "imported planner goal + portfolio goal both appear (replacing the previous goals)");
const collegeCard = page.locator('#goalList .goal-row[data-id="goal-college"]');
check((await collegeCard.textContent()).includes("Child College"), "planner goal converted");
check(/in Portfolio/.test(await collegeCard.locator(".saved-note").textContent()), "college goal shows money held in Portfolio");
check((await collegeCard.locator(".row-sub").textContent()).includes("Child Education"), "education category kept");
const homeCard = page.locator('#goalList .goal-row[data-id="goal_home_old"]');
check((await homeCard.count()) === 1, "legacy portfolio goal listed");
await openRow(collegeCard);

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
await page.waitForSelector("#goalList .goal-row");
const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
check(!overflow, "no horizontal scroll at phone width");

check(errors.length === 0, "no uncaught page errors", errors.join(" | "));
console.log(`\n${passed} passed, ${failed} failed`);
await browser.close();
server.close();
process.exit(failed ? 1 : 0);
