// tests/goals.test.mjs — unified goal model, maths, checklists
import assert from "node:assert";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const ctx = { window: {}, console };
ctx.window.KYF_MARKET_PULSE = { macro: { cpiInflation: 5.4, educationInflation: 9, medicalInflation: 11.5 } };
vm.createContext(ctx);
vm.runInContext(readFileSync("js/kyf-goals.js", "utf8"), ctx);
const K = ctx.window.KYF_GOALS;

let passed = 0;
const ok = (c, l) => { assert.ok(c, l); passed++; console.log(`  ✓ ${l}`); };
const near = (a, b, t = 1) => Math.abs(a - b) <= t;

console.log("Normalisation");
const planner = K.normalizeGoal({ id: "p", title: "Retire", category: "retirement", priority: "essential", years: 20, presentValue: 25000000, inflationRate: 6, expectedReturn: 12, currentSavings: 3500000, status: "in_progress", description: "x" }, 2026);
ok(planner.name === "Retire" && planner.targetYear === 2046 && planner.baseTargetINR === 25000000, "planner goal → name, targetYear (2026+20), baseTargetINR");
ok(planner.inflationCategory === "CUSTOM" && planner.inflationRate === 6, "planner inflation kept as a custom rate");
ok(planner.manualSavedINR === 3500000 && planner.status === "ACTIVE" && planner.priority === "ESSENTIAL", "savings, status, priority mapped");
const edu = K.normalizeGoal({ id: "e", title: "College", category: "education", years: 10, presentValue: 1, inflationRate: 10 }, 2026);
ok(edu.inflationCategory === "EDUCATION" && edu.inflationRate === null, "education goals use the education rate");
const done = K.normalizeGoal({ id: "h", name: "Home", baseTargetINR: 1, targetYear: 2026, priority: "COMPLETED" });
ok(done.status === "ACHIEVED" && done.priority === "ESSENTIAL", "legacy 'COMPLETED' priority → ACHIEVED status");
ok(K.normalizeGoal(K.normalizeGoal(planner, 2026), 2026).targetYear === 2046, "normalising twice changes nothing (idempotent)");
ok(K.mergeGoalLists([{ id: "a", name: "A", baseTargetINR: 1, targetYear: 2030 }], [{ id: "a", name: "A2", baseTargetINR: 2, targetYear: 2030 }])[0].name === "A2", "merge: later list wins on the same id");
ok(K.inferCategory({ name: "Dream home down payment" }) === "realestate" && K.inferCategory({ name: "Wedding" }) === "wedding", "category inferred from the name");

console.log("Maths");
const g = K.normalizeGoal({ id: "m", name: "Home", baseTargetINR: 2500000, targetYear: 2031, inflationCategory: "CPI", manualSavedINR: 0 });
const c = K.computeGoal(g, 0, { baseYear: 2026 });
ok(c.years === 5 && c.inflationRate === 5.4, "5 years at CPI 5.4%");
ok(near(c.futureCost, Math.round(2500000 * Math.pow(1.054, 5)), 1), `future cost compounds (${c.futureCost})`);
ok(c.expectedReturn === 9 && c.horizon.key === "medium", "5-year goal defaults to the medium-horizon return");
ok(c.sip > 0 && c.gap === c.futureCost, "with nothing saved the whole future cost is the gap, so a SIP is needed");
const funded = K.computeGoal(g, 3000000, { baseYear: 2026 });
ok(funded.gap === 0 && funded.sip === 0 && funded.health === "funded", "enough saved → no SIP needed");
const withPortfolio = K.computeGoal(Object.assign({}, g, { manualSavedINR: 100000 }), 400000, { baseYear: 2026 });
ok(withPortfolio.saved === 500000 && withPortfolio.portfolioSaved === 400000, "saved = Portfolio funding + manual amount");
ok(K.computeGoal(Object.assign({}, g, { status: "ACHIEVED" }), 0, { baseYear: 2026 }).health === "achieved", "achieved goals report 'achieved'");
const due = K.computeGoal(Object.assign({}, g, { targetYear: 2026 }), 0, { baseYear: 2026 });
ok(due.years === 0 && due.health === "due" && due.sip === due.gap, "a goal due now needs the whole gap at once");
const override = K.computeGoal(Object.assign({}, g, { expectedReturn: 12 }), 0, { baseYear: 2026 });
ok(override.expectedReturn === 12 && override.sip < c.sip, "a higher expected return lowers the SIP");

console.log("Affordability");
const a1 = K.affordability([{ sip: 20000 }, { sip: 15000 }], 50000);
ok(a1.status === "ok" && a1.totalSip === 35000, "SIPs within surplus → ok");
const a2 = K.affordability([{ sip: 40000 }, { sip: 30000 }], 50000);
ok(a2.status === "stretched" && a2.coveragePct === 71, "SIPs above surplus → stretched, 71% covered");
ok(K.affordability([{ sip: 1 }], 0).status === "unknown", "no surplus entered → unknown");

console.log("Templates & checklists");
const t = K.goalFromTemplate(K.templateById("child_education"), 2026);
ok(t.inflationCategory === "EDUCATION" && t.targetYear === 2038 && t.templateId === "child_education", "template → goal with education inflation and 12-yr horizon");
const list = K.checklistFor(t);
ok(list.length === 4 && list.every((x) => x.goalId === t.id && x.section === "goals"), "template checklist: 4 steps linked by goalId");
ok(K.withChecklist(K.withChecklist([], t), t).length === 4, "adding a checklist twice does not duplicate steps");
const withDone = K.withChecklist([], t).map((x, i) => (i < 2 ? Object.assign({}, x, { status: "done" }) : x));
ok(K.taskProgress(withDone, t.id).done === 2 && K.taskProgress(withDone, t.id).total === 4, "progress counts done steps");
ok(K.withoutGoalTasks(withDone, t.id).length === 0, "deleting a goal removes its steps");
const custom = K.normalizeGoal({ name: "Sabbatical", baseTargetINR: 1, targetYear: 2030 });
ok(K.checklistFor(custom).length === 4, "custom goals get the generic checklist");

console.log("Cadence migration");
const migrated = K.migrateCadence([
  { id: "goal-home", section: "goals", status: "active" },
  { id: "goal-car", section: "goals", status: "done" },
  { id: "house-networth", section: "housekeeping", status: "active" },
  { id: "my-own", section: "goals", status: "active" }
]);
ok(migrated.length === 3 && !migrated.some((a) => a.id === "goal-home"), "untouched generic milestone cards removed; done, housekeeping and user-made cards kept");

console.log("Funding cache");
const store = {};
ctx.localStorage = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } };
K.writeFundingCache({ goal_a: 1234 });
ok(K.readFundingCache().byGoal.goal_a === 1234, "funding cache round-trips");

console.log(`\n${passed} passed`);
