// Independent re-computation of the money maths (month-by-month / year-by-year simulation),
// so the closed-form formulas in js/kyf-goals.js are checked against a different method.
import assert from "node:assert";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const ctx = { window: {}, console };
vm.createContext(ctx);
vm.runInContext(readFileSync("data/market-pulse.js", "utf8"), ctx);
vm.runInContext(readFileSync("js/kyf-goals.js", "utf8"), ctx);
const K = ctx.window.KYF_GOALS;
const pulse = ctx.window.KYF_MARKET_PULSE;
let n = 0;
const ok = (c, m) => { assert.ok(c, m); n++; };

// ---- seeded random so a failure is reproducible
let seed = 20261112;
const rnd = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
const between = (a, b) => a + rnd() * (b - a);

// 1. SIP: simulate paying the SIP at the start of every month; the pot must reach the gap
for (let t = 0; t < 400; t++) {
  const base = Math.round(between(1e5, 5e7));
  const years = Math.floor(between(1, 30));
  const infl = Math.round(between(3, 12) * 10) / 10;
  const ret = Math.round(between(4, 14) * 10) / 10;
  const saved = Math.round(between(0, base * 0.6));
  const g = K.normalizeGoal({ id: "g" + t, name: "x", baseTargetINR: base, targetYear: 2026 + years, inflationCategory: "CUSTOM", inflationRate: infl, expectedReturn: ret, manualSavedINR: saved }, 2026);
  const c = K.computeGoal(g, 0, { baseYear: 2026 });
  const future = base * Math.pow(1 + infl / 100, years);
  ok(Math.abs(c.futureCost - future) <= 1, `future cost ${base} @${infl}% x${years}y`);
  const savedFV = saved * Math.pow(1 + ret / 100, years);
  const gap = Math.max(0, future - savedFV);
  let pot = 0;
  const rm = ret / 100 / 12;
  for (let m = 0; m < years * 12; m++) pot = (pot + c.sip) * (1 + rm);
  if (gap > 0) ok(Math.abs(pot - gap) / gap < 0.0005 + (years * 12) / gap, `SIP simulation reaches the gap (pot ${Math.round(pot)} vs gap ${Math.round(gap)})`);
  else ok(c.sip === 0, "no SIP when the saved amount already covers the goal");
}

// 2. Retirement: withdraw (inflation-rising) at the start of each year; pot must run out at life expectancy
for (let t = 0; t < 200; t++) {
  const age = Math.floor(between(25, 50));
  const retireAge = age + Math.floor(between(5, 25));
  const life = retireAge + Math.floor(between(15, 35));
  const exp = Math.round(between(2e5, 3e6));
  const infl = Math.round(between(4, 8) * 10) / 10;
  const post = Math.round(between(5, 10) * 10) / 10;
  const p = K.retirementPlan({ age, retireAge, lifeExpectancy: life, yearlyExpensesToday: exp, pctNeeded: 100, postReturn: post }, infl, 2026);
  let pot = p.corpusAtRetirement;
  let w = p.yearlyAtRetirement;
  for (let y = 0; y < life - retireAge; y++) { pot -= w; pot *= 1 + post / 100; w *= 1 + infl / 100; }
  ok(Math.abs(pot) / p.corpusAtRetirement < 0.001, `retirement corpus is spent down to ~0 (left ${Math.round(pot)} of ${p.corpusAtRetirement})`);
  ok(p.yearsToRetire === retireAge - age && p.retireYear === 2026 + retireAge - age, "retirement years and year");
}

// 3. Term cover: the two methods
const tc = K.termCoverPlan({ yearlyIncome: 1200000, loans: 3000000, goalsToFund: 5000000, yearlyFamilyExpenses: 600000, yearsOfSupport: 10, savings: 2000000, existingCover: 5000000 });
ok(tc.ruleLow === 12000000 && tc.ruleHigh === 18000000, "10x to 15x income");
ok(tc.gross === 3000000 + 5000000 + 6000000 && tc.needsBased === 14000000 - 7000000, "needs-based = loans + goals + living - existing");

// 4. Home price helper
const sample = { KYF_RESIDEX: { cities: { Testville: { summary: { carpet_price_sqft: 10000, latest_quarter: "Q" } } } } };
ctx.window.KYF_RESIDEX = sample.KYF_RESIDEX;
const h = K.residexEstimate("Testville", 800, 20);
ok(h.price === 8000000 && h.friction === 560000 && h.downPayment === 1600000 + 560000 && h.fullCost === 8560000, "home price, 7% friction, down payment");

// 5. Market pulse sanity (these numbers appear in copy and in tips)
const m = pulse.macro, g = pulse.preciousMetals;
ok(m.cpiInflation > 0 && m.cpiInflation < 15 && m.educationInflation >= m.cpiInflation && m.medicalInflation >= m.cpiInflation, "inflation figures are in a believable order");
ok(Math.abs(g.gold22kPerGram / g.gold24kPerGram - 22 / 24) < 0.005, "22K gold is 22/24 of 24K");
ok(Math.abs(g.gold18kPerGram / g.gold24kPerGram - 0.75) < 0.005, "18K gold is 18/24 of 24K");
ok(Math.abs(g.silverPerKg - g.silverPerGram * 1000) < 1, "silver per kg = 1000 x per gram");
ok(m.ppfRate > 5 && m.ppfRate < 10 && m.epfRate > 5 && m.epfRate < 10 && m.sbiFd1Yr > 3 && m.sbiFd1Yr < 10, "scheme rates are plausible");

// 6. Worked figures quoted in the vocabulary draft (kept honest)
const FD = 6.8;
ok(Math.round(1e6 * Math.pow(1 + FD / 100, 5)) === 1389493, "Dadaji FD, 5 years compounded");
ok(Math.abs((Math.pow(1 + FD / 400, 4) - 1) * 100 - 6.975) < 0.001, "6.8% quarterly = 6.975% effective");
ok(Math.abs(72 / FD - 10.588) < 0.001, "Rule of 72 at 6.8%");

console.log(`accuracy: ${n} checks passed`);
