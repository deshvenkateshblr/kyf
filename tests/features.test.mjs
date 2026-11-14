import fs from "fs"; import assert from "assert";
globalThis.window = globalThis;
await import("../js/kyf-features.js");
const F = globalThis.KYF_FEATURES;
let n = 0;
for (const f of F.menu()) { assert(fs.existsSync(f.href.split(/[?#]/)[0]), "missing page " + f.href); n++; }
assert.equal(F.features.length, 6); n++;
for (const f of F.features) { assert(f.can.length >= 2 && f.cta && F.groups.some(g => g.id === f.group)); n++; }
console.log(`features: ${n} passed`);
