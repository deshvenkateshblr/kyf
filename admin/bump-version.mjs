// Usage: node admin/bump-version.mjs 1.10.0
// Updates KYF_APP_VERSION, every ?v= cache-buster in the HTML pages, and "Version: vX" headers in js/ and css/.
import { readFileSync, writeFileSync, readdirSync } from "fs";
const next = process.argv[2];
if (!/^\d+\.\d+\.\d+$/.test(next || "")) { console.error("Give a version like 1.10.0"); process.exit(1); }
const edit = (f, fn) => { const a = readFileSync(f, "utf8"), b = fn(a); if (a !== b) writeFileSync(f, b); };
edit("js/kyf-footer.js", t => t.replace(/(KYF_APP_VERSION\s*=\s*")[^"]+"/, `$1${next}"`));
for (const f of readdirSync(".").filter(n => n.endsWith(".html") && n !== "index_bkup.html")) edit(f, t => t.replace(/\?v=\d+\.\d+\.\d+/g, `?v=${next}`));
for (const d of ["js", "css"]) for (const f of readdirSync(d)) if (/\.(js|css)$/.test(f)) edit(`${d}/${f}`, t => t.replace(/(Version: v)\d+\.\d+\.\d+/, `$1${next}`));
console.log("Version set to", next);
