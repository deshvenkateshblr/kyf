// tests/social-share.test.mjs
// Verifies that no unauthorized social handles (@knowyourfinance) exist anywhere in the codebase,
// and ensures social share on the markets page correctly uses @vividalerts and vividnova.com.

import assert from "node:assert";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";

let passed = 0;
const ok = (cond, label) => {
  assert.ok(cond, label);
  passed++;
  console.log(`  ✓ ${label}`);
};

console.log("\n[TEST GROUP 1] Codebase-Wide Hygiene Scan (Zero Unauthorized Handles)");

const FORBIDDEN_HANDLE = "@" + "knowyourfinance";
const FORBIDDEN_REGEX = new RegExp("@" + "knowyourfinance", "i");
const FORBIDDEN_DOMAIN = "knowyourfinance" + ".in";

const ignoreDirs = new Set([".git", "node_modules", "dist", ".gemini", "brain"]);
const checkExtensions = new Set([".html", ".js", ".mjs", ".css", ".json", ".md"]);

function walkDir(dir, fileList = []) {
  const entries = readdirSync(dir);
  for (const entry of entries) {
    if (ignoreDirs.has(entry)) continue;
    const fullPath = path.join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      walkDir(fullPath, fileList);
    } else {
      const ext = path.extname(entry).toLowerCase();
      if (checkExtensions.has(ext)) {
        fileList.push(fullPath);
      }
    }
  }
  return fileList;
}

const allFiles = walkDir(".");
const violations = [];

for (const file of allFiles) {
  // Do not flag the test file itself which constructs the pattern
  if (file.endsWith("social-share.test.mjs")) continue;
  const content = readFileSync(file, "utf8");
  if (FORBIDDEN_REGEX.test(content)) {
    violations.push(`${file}: contains unauthorized handle ${FORBIDDEN_HANDLE}`);
  }
  if (content.toLowerCase().includes(FORBIDDEN_DOMAIN)) {
    violations.push(`${file}: contains unauthorized domain ${FORBIDDEN_DOMAIN}`);
  }
}

ok(violations.length === 0, `Zero occurrences of ${FORBIDDEN_HANDLE} across ${allFiles.length} files`);
if (violations.length > 0) {
  console.error("Violations found:\n" + violations.join("\n"));
}

console.log("\n[TEST GROUP 2] Markets Performance Script Static Analysis");

const mpContent = readFileSync("js/market-performance.js", "utf8");

ok(!FORBIDDEN_REGEX.test(mpContent), "js/market-performance.js does NOT contain unauthorized handle");
ok(mpContent.includes("@vividalerts"), "js/market-performance.js contains official handle @vividalerts");
ok(mpContent.includes("vividnova.com"), "js/market-performance.js references official domain vividnova.com");

const cardFootersWithHandle = mpContent.match(/fillText\("@vividalerts",/g) || [];
ok(cardFootersWithHandle.length >= 2, `Both visual card generators stamp @vividalerts (found ${cardFootersWithHandle.length})`);

const shareLinksWithHandle = mpContent.match(/vividnova\.com\/kyf\/market-performance\.html • @vividalerts/g) || [];
ok(shareLinksWithHandle.length >= 7, `All share sections include vividnova.com and @vividalerts (found ${shareLinksWithHandle.length})`);

console.log("\n[TEST GROUP 3] Markets Social Share Behavioral & Canvas Card Verification");

// Set up mock DOM & Canvas context to execute market-performance.js in VM
const createMockEl = (extra = {}) => ({
  textContent: "",
  innerHTML: "",
  value: "",
  src: "",
  alt: "",
  style: {},
  classList: { add() {}, remove() {}, contains: () => false },
  addEventListener() {},
  removeEventListener() {},
  setAttribute() {},
  getAttribute: () => null,
  appendChild() {},
  removeChild() {},
  querySelectorAll: () => [],
  querySelector: () => null,
  ...extra
});

const textPreviewEl = createMockEl();
const imgPreviewEl = createMockEl();
const modalEl = createMockEl();
const titleEl = createMockEl();
const subEl = createMockEl();
const toastEl = createMockEl();

const filledTexts = [];

class MockCanvasContext {
  constructor() {
    this.fillStyle = "";
    this.font = "";
    this.textAlign = "left";
    this.textBaseline = "alphabetic";
    this.lineWidth = 1;
    this.strokeStyle = "";
  }
  fillRect() {}
  strokeRect() {}
  beginPath() {}
  closePath() {}
  moveTo() {}
  lineTo() {}
  arcTo() {}
  fill() {}
  stroke() {}
  createLinearGradient() {
    return { addColorStop() {} };
  }
  measureText(str) {
    return { width: (str || "").length * 8 };
  }
  fillText(text, x, y) {
    filledTexts.push({ text: String(text), x, y });
  }
}

const mockCanvas = {
  width: 1200,
  height: 800,
  getContext: () => new MockCanvasContext(),
  toBlob: (cb) => cb(new Blob(["mock-blob"], { type: "image/png" })),
  toDataURL: () => "data:image/png;base64,mock"
};

const domElements = {
  shareTextPreview: textPreviewEl,
  shareImgPreview: imgPreviewEl,
  shareModal: modalEl,
  shareModalTitle: titleEl,
  shareModalSubtitle: subEl,
  shareToast: toastEl
};

const mockDocument = {
  getElementById: (id) => {
    if (!domElements[id]) {
      domElements[id] = createMockEl();
    }
    return domElements[id];
  },
  querySelectorAll: () => [],
  querySelector: () => null,
  createElement: (tag) => {
    if (tag.toLowerCase() === "canvas") return mockCanvas;
    return createMockEl();
  },
  body: createMockEl(),
  addEventListener() {}
};

const sandbox = {
  window: {},
  document: mockDocument,
  navigator: { clipboard: {}, canShare: () => false },
  console,
  setTimeout: (fn) => fn(),
  clearTimeout: () => {},
  Blob,
  File: class File {},
  URL: { createObjectURL: () => "blob:mock", revokeObjectURL: () => {} }
};
sandbox.window = sandbox;

vm.createContext(sandbox);

// Load required datasets
vm.runInContext(readFileSync("data/market-pulse.js", "utf8"), sandbox);
vm.runInContext(readFileSync("data/market-equities.js", "utf8"), sandbox);
vm.runInContext(readFileSync("data/market-mf.js", "utf8"), sandbox);
vm.runInContext(readFileSync("data/market-realestate.js", "utf8"), sandbox);

// Run market-performance.js
vm.runInContext(readFileSync("js/market-performance.js", "utf8"), sandbox);

ok(typeof sandbox.KYF_MARKET_VIEW === "object", "KYF_MARKET_VIEW exposed on window");
ok(typeof sandbox.KYF_MARKET_VIEW.share === "function", "KYF_MARKET_VIEW.share is a function");
ok(typeof sandbox.KYF_MARKET_VIEW.shareSummary === "function", "KYF_MARKET_VIEW.shareSummary is a function");

// Test Section Share (e.g., Equities)
filledTexts.length = 0;
sandbox.KYF_MARKET_VIEW.share("equities");

ok(textPreviewEl.value.includes("@vividalerts"), "Equities share text preview contains @vividalerts");
ok(textPreviewEl.value.includes("vividnova.com"), "Equities share text preview contains vividnova.com");
ok(!FORBIDDEN_REGEX.test(textPreviewEl.value), "Equities share text preview does NOT contain unauthorized handle");

const cardDrawnStrings = filledTexts.map(f => f.text);
ok(cardDrawnStrings.some(s => s.includes("@vividalerts")), "Section canvas card drew @vividalerts");
ok(cardDrawnStrings.some(s => s.includes("vividnova.com")), "Section canvas card drew vividnova.com link");
ok(!cardDrawnStrings.some(s => FORBIDDEN_REGEX.test(s)), "Section canvas card contains NO unauthorized handle");

// Test Overview Summary Share (e.g., Metals summary)
filledTexts.length = 0;
sandbox.KYF_MARKET_VIEW.shareSummary({
  key: "metals",
  title: "Gold & silver",
  subtitle: "Price per gram and returns",
  text: "• Gold 24K: ₹14,280/g\n• Silver: ₹98/g",
  columns: ["Metal", "Per gram", "1M"],
  rows: [[{ t: "Gold 24K", tone: null }, { t: "₹14,280", tone: null }, { t: "+5.2%", tone: "up" }]],
  footnote: "Returns via ETFs."
});

ok(textPreviewEl.value.includes("@vividalerts"), "Summary share text preview contains @vividalerts");
ok(textPreviewEl.value.includes("vividnova.com"), "Summary share text preview contains vividnova.com");
ok(!FORBIDDEN_REGEX.test(textPreviewEl.value), "Summary share text preview does NOT contain unauthorized handle");

const summaryDrawnStrings = filledTexts.map(f => f.text);
ok(summaryDrawnStrings.some(s => s.includes("@vividalerts")), "Summary canvas card drew @vividalerts");
ok(summaryDrawnStrings.some(s => s.includes("vividnova.com")), "Summary canvas card drew vividnova.com link");
ok(!summaryDrawnStrings.some(s => FORBIDDEN_REGEX.test(s)), "Summary canvas card contains NO unauthorized handle");

console.log(`\n========================================`);
console.log(`TEST SUMMARY: ${passed} passed, 0 failed`);
console.log(`========================================\n`);
