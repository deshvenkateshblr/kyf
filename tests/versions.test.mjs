// Every page, cache-buster and file header must carry the current app version.
// Fix a failure with: node admin/bump-version.mjs <version>
import { readFileSync, readdirSync } from "fs";
import assert from "assert";
const current = /KYF_APP_VERSION\s*=\s*"([^"]+)"/.exec(readFileSync("js/kyf-footer.js", "utf8"))[1];
let n = 0;
const stale = [];
for (const f of readdirSync(".").filter(x => x.endsWith(".html") && x !== "index_bkup.html")) {
  for (const m of readFileSync(f, "utf8").matchAll(/\?v=(\d+\.\d+\.\d+)/g)) { n++; if (m[1] !== current) stale.push(`${f}: ?v=${m[1]}`); }
}
for (const d of ["js", "css"]) for (const f of readdirSync(d)) {
  if (!/\.(js|css)$/.test(f)) continue;
  const m = /Version: v(\d+\.\d+\.\d+)/.exec(readFileSync(`${d}/${f}`, "utf8"));
  if (m) { n++; if (m[1] !== current) stale.push(`${d}/${f}: header v${m[1]}`); }
}
assert.deepEqual(stale, [], `Stale versions (current is ${current}):\n  ${stale.join("\n  ")}\nRun: node admin/bump-version.mjs ${current}`);
console.log(`versions: ${n} references all at ${current}`);
