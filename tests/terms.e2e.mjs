import { createRequire } from "module";
import http from "http"; import fs from "fs"; import path from "path";
const require = createRequire("/opt/npm-tools/node_modules/");
const { chromium } = require("playwright");
const root = path.resolve(new URL("..", import.meta.url).pathname);
const mime = { ".html":"text/html", ".js":"text/javascript", ".css":"text/css", ".json":"application/json" };
const srv = http.createServer((q, r) => {
  const p = path.join(root, decodeURIComponent(q.url.split("?")[0]));
  if (!fs.existsSync(p) || fs.statSync(p).isDirectory()) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { "content-type": mime[path.extname(p)] || "application/octet-stream" }); r.end(fs.readFileSync(p));
}).listen(0);
const base = `http://127.0.0.1:${srv.address().port}`;
let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : (fail++, console.log("FAIL", m)); };
const b = await chromium.launch();

async function audit(page, label) {
  const info = await page.evaluate(() => {
    const tags = [...document.querySelectorAll("button.kyf-term")];
    const bad = tags.filter(t => t.parentElement.closest("a,button:not(.kyf-term),summary,h1,h2,h3,h4,h5,h6,th,label,nav,footer,input,select,textarea")).length;
    const keys = tags.map(t => (t.closest(".drawer-overlay")?.id || "page") + "|" + t.dataset.term);
    return { count: tags.length, bad, dup: keys.length - new Set(keys).size, over: document.documentElement.scrollWidth - document.documentElement.clientWidth };
  });
  ok(info.count > 0, `${label}: some terms are tagged`);
  ok(info.bad === 0, `${label}: none inside links/buttons/headings (${info.bad})`);
  ok(info.dup === 0, `${label}: one tag per term per region (${info.dup})`);
  return info;
}

for (const vp of [{ width: 390, height: 844 }, { width: 1200, height: 800 }]) {
  const page = await b.newPage({ viewport: vp });
  const errs = []; page.on("pageerror", e => errs.push(e.message));
  await page.addInitScript(() => { try { localStorage.setItem("kyf_demo_mode", "true"); } catch (e) {} });

  // ---- Portfolio (demo data) ----
  await page.goto(base + "/portfolio.html");
  await page.waitForSelector("button.kyf-term", { timeout: 8000 });
  await audit(page, `portfolio ${vp.width}`);
  const first = page.locator("button.kyf-term").first();
  const id = await first.getAttribute("data-term");
  await first.click();
  ok(await page.locator(".kyf-tip").isVisible(), "tip opens on tap");
  ok(await first.getAttribute("aria-expanded") === "true", "button reports expanded");
  const box = await page.locator(".kyf-tip").boundingBox();
  ok(box.x >= 0 && box.x + box.width <= vp.width + 1, `tip fits the screen (${Math.round(box.x)}..${Math.round(box.x + box.width)} of ${vp.width})`);
  const tipText = await page.locator(".kyf-tip-body").innerText();
  ok(tipText.length > 20, "tip has text for " + id);
  await page.keyboard.press("Escape");
  ok(await page.locator(".kyf-tip").isHidden(), "Escape closes the tip");
  await first.click();
  await page.mouse.click(5, vp.height - 5);
  ok(await page.locator(".kyf-tip").isHidden(), "tap elsewhere closes the tip");

  // ---- switch off / on, remembered across reload ----
  await page.locator("#kyf-tips-switch").click();
  ok(await page.locator("button.kyf-term").count() === 0, "tips off removes every ?");
  await page.reload();
  await page.waitForTimeout(1200);
  ok(await page.locator("button.kyf-term").count() === 0, "off stays off after reload");
  await page.locator("#kyf-tips-switch").click();
  await page.waitForSelector("button.kyf-term", { timeout: 4000 });
  ok(true, "tips come back when switched on");

  // ---- Goals with one goal on file ----
  await page.goto(base + "/goals.html");
  await page.waitForSelector("button.kyf-term", { timeout: 8000 });
  await audit(page, `goals ${vp.width}`);
  ok(errs.length === 0, "no page errors: " + errs.join("|"));
  await page.close();
}
await b.close(); srv.close();
console.log(`terms e2e: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
