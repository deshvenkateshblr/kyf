import assert from "assert";
globalThis.window = globalThis;
await import("../data/kyf-terms.js");
const { terms } = globalThis.KYF_TERMS;
let n = 0;
const ids = new Set();
for (const t of terms) {
  assert(!ids.has(t.id), "duplicate id " + t.id); ids.add(t.id); n++;
  assert(t.term && t.tip, "missing text on " + t.id);
  const bubble = (t.exact && t.exact.length) || (t.words && t.words.length);
  assert(t.tip.length <= (bubble ? 170 : 240), `tip too long (${t.tip.length}) for ${t.id}`);
  assert(Number.isInteger(t.chapter) && t.chapter >= 1 && t.chapter <= 10, "chapter 1-10 needed on " + t.id);
  if (t.quickCheck) {
    assert(t.humanFriction && t.plainMeaning && t.contextTemplate, "lesson fields missing on " + t.id);
    assert(t.quickCheck.options.filter((o) => o.correct).length === 1, "exactly one right answer on " + t.id);
    assert(t.quickCheck.explanation, "quick check needs an explanation on " + t.id);
    (t.relatedWords || []).forEach((r) => assert(globalThis.KYF_TERMS.find(r), `${t.id} relates to unknown word ${r}`));
    assert(!/\{\w+\}/.test(globalThis.KYF_TERMS.renderContext(t.id)), "unfilled placeholder in the example for " + t.id);
  }
  assert(/[.]$/.test(t.tip), "tip should end with a full stop: " + t.id);
  n += 4;
}
// A spelling must not be claimed by two terms
const seen = new Map();
for (const t of terms) for (const w of [...(t.exact || []), ...(t.words || [])]) {
  const k = w.toLowerCase(); assert(!seen.has(k), `"${w}" used by ${seen.get(k)} and ${t.id}`); seen.set(k, t.id); n++;
}
console.log(`terms: ${n} checks passed (${terms.length} terms)`);
