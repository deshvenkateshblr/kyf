import assert from "assert";
globalThis.window = globalThis;
await import("../data/kyf-terms.js");
const { terms } = globalThis.KYF_TERMS;
let n = 0;
const ids = new Set();
for (const t of terms) {
  assert(!ids.has(t.id), "duplicate id " + t.id); ids.add(t.id); n++;
  assert(t.term && t.tip, "missing text on " + t.id);
  assert(t.tip.length <= 170, `tip too long (${t.tip.length}) for ${t.id}`);
  assert((t.exact && t.exact.length) || (t.words && t.words.length), "no match words for " + t.id);
  assert(/[.]$/.test(t.tip), "tip should end with a full stop: " + t.id);
  n += 4;
}
// A spelling must not be claimed by two terms
const seen = new Map();
for (const t of terms) for (const w of [...(t.exact || []), ...(t.words || [])]) {
  const k = w.toLowerCase(); assert(!seen.has(k), `"${w}" used by ${seen.get(k)} and ${t.id}`); seen.set(k, t.id); n++;
}
console.log(`terms: ${n} checks passed (${terms.length} terms)`);
