// The three-step plan: portfolio -> goals -> give money a job. Progress only reads what exists.
import vm from "vm"; import fs from "fs";
let passed = 0, failed = 0;
const ok = (c, m) => { if (c) passed++; else { failed++; console.error("✗ " + m); } };
const sb = { console }; sb.window = sb; vm.createContext(sb);
vm.runInContext(fs.readFileSync(new URL("../js/kyf-journey.js", import.meta.url), "utf8"), sb);
const J = sb.KYF_JOURNEY;

let m = J.compute([], []);
ok(m.overall === 0 && m.next.id === "portfolio", "a new visitor starts at step 1");
ok(m.steps.length === 2, "step 3 stays hidden until there is a holding and a goal");

m = J.compute([{ id: "g", name: "Home", status: "ACTIVE", baseTargetINR: 5000000, targetYear: 2035 }], []);
ok(m.steps[1].pct === 100 && m.next.id === "portfolio", "a goal with a cost and a year completes step 2; step 1 is next");

m = J.compute([{ id: "g", status: "ACTIVE", baseTargetINR: 0, targetYear: 2035 }], []);
ok(m.steps[1].pct === 0, "a goal with no cost yet is not counted as complete");

const hs = [{ id: "a", allocations: [] }, { id: "b", allocations: [{ goalId: "g", percentage: 100 }] }, { id: "l", isLiability: true }];
m = J.compute([{ id: "g", status: "ACTIVE", baseTargetINR: 100, targetYear: 2035 }], hs);
ok(m.steps[0].pct === 100 && m.steps[2].pct === 50, "step 3 is the share of holdings with a goal (loans are not counted)");
ok(m.next.id === "assign" && /assign=1/.test(m.next.href), "next is giving money a job, linking straight to the sheet");
ok(m.overall === Math.round((100 + 100 + 50) / 3), "overall is the average of the three");

m = J.compute([{ id: "g", status: "ACTIVE", baseTargetINR: 100, targetYear: 2035 }], [{ id: "a", allocations: [{ goalId: "g", percentage: 100 }] }]);
ok(m.overall === 100 && m.next === null, "all three done: nothing left to push");

m = J.compute([{ id: "g", status: "ACHIEVED", baseTargetINR: 100, targetYear: 2030 }], hs);
ok(m.steps[1].pct === 0, "an achieved goal no longer counts as an open one");

console.log(`journey: ${passed} passed, ${failed} failed`); process.exit(failed ? 1 : 0);
