/**
 * Test Suite: VividVault Generic Module & KYF Vault Integration
 */
import fs from "fs";
import path from "path";

// 1. Mock Browser Environment (window, localStorage, indexedDB, document)
class LocalStorageMock {
  constructor() {
    this.store = {};
  }
  getItem(key) {
    return Object.prototype.hasOwnProperty.call(this.store, key) ? this.store[key] : null;
  }
  setItem(key, value) {
    this.store[key] = String(value);
  }
  removeItem(key) {
    delete this.store[key];
  }
  clear() {
    this.store = {};
  }
}

class FakeDOMElement {
  constructor(id) {
    this.id = id;
    this.listeners = {};
    this.value = "";
    this.files = [];
    this.style = {};
    this.classList = {
      add: () => {},
      remove: () => {},
      contains: () => false
    };
  }
  addEventListener(event, fn) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(fn);
  }
  click() {
    if (this.listeners["click"]) {
      this.listeners["click"].forEach(fn => fn({ target: this }));
    }
  }
}

const mockLocalStorage = new LocalStorageMock();
const elements = {};

global.window = global;
global.localStorage = mockLocalStorage;
global.document = {
  readyState: "complete",
  getElementById: (id) => {
    if (!elements[id]) elements[id] = new FakeDOMElement(id);
    return elements[id];
  },
  createElement: (tag) => new FakeDOMElement(tag),
  body: {
    appendChild: () => {},
    removeChild: () => {}
  },
  addEventListener: () => {}
};
global.URL = {
  createObjectURL: () => "blob://fake-url",
  revokeObjectURL: () => {}
};
global.Blob = class Blob {
  constructor(content, opts) {
    this.content = content;
    this.opts = opts;
  }
};

// Simple in-memory mock for IndexedDB
const idbDatabases = {};
global.indexedDB = {
  open: (name, version) => {
    const req = {
      onsuccess: null,
      onerror: null,
      onupgradeneeded: null,
      result: null
    };
    setTimeout(() => {
      if (!idbDatabases[name]) {
        idbDatabases[name] = {
          name,
          version,
          objectStoreNames: {
            contains: (s) => !!idbDatabases[name].stores[s]
          },
          stores: {},
          createObjectStore: (s, opts) => {
            idbDatabases[name].stores[s] = { items: {}, opts };
          },
          transaction: (storeNames, mode) => {
            const arr = Array.isArray(storeNames) ? storeNames : [storeNames];
            return {
              oncomplete: null,
              onerror: null,
              objectStore: (s) => ({
                getAll: () => {
                  const getReq = { onsuccess: null, onerror: null, result: [] };
                  setTimeout(() => {
                    const st = idbDatabases[name].stores[s];
                    getReq.result = st ? Object.values(st.items) : [];
                    if (getReq.onsuccess) getReq.onsuccess();
                  }, 0);
                  return getReq;
                },
                put: (item) => {
                  const st = idbDatabases[name].stores[s];
                  if (st) {
                    const key = st.opts && st.opts.keyPath ? item[st.opts.keyPath] : JSON.stringify(item);
                    st.items[key] = item;
                  }
                },
                clear: () => {
                  const st = idbDatabases[name].stores[s];
                  if (st) st.items = {};
                }
              })
            };
          }
        };
        if (req.onupgradeneeded) {
          req.onupgradeneeded({ target: { result: idbDatabases[name] } });
        }
      }
      req.result = idbDatabases[name];
      if (req.onsuccess) req.onsuccess();
    }, 0);
    return req;
  }
};

// Load kyf-vault.js code
const vaultCode = fs.readFileSync(path.resolve("js/kyf-vault.js"), "utf8");
eval(vaultCode);

console.log("=== RUNNING VAULT VERIFICATION TESTS ===");

let passed = 0;
let failed = 0;

function assert(condition, testName) {
  if (condition) {
    console.log(`  ✓ ${testName}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${testName}`);
    failed++;
  }
}

async function runTests() {
  // Test 1: VividVault Generic Module standalone capability
  console.log("\n[TEST GROUP 1] Generic VividVault Module");
  assert(typeof global.VividVault === "function", "VividVault class is exposed globally");

  const myAppVault = new global.VividVault({
    appName: "WordPower",
    appSlug: "wordpower",
    fileExtension: ".wp",
    fileType: "wordpower-vault",
    defaultBaseName: "my-words"
  });

  let savedWords = [];
  myAppVault.registerSection("vocabulary", {
    read: async () => savedWords,
    write: async (data) => { savedWords = data; },
    summary: (data) => `${data.length} vocabulary words`
  });

  savedWords = [{ word: "compounding", mastered: true }, { word: "inflation", mastered: false }];
  const payload1 = await myAppVault.createPayload();
  assert(payload1.app === "WordPower", "Payload has correct app metadata");
  assert(payload1.fileType === "wordpower-vault", "Payload has correct fileType");
  assert(payload1.data.vocabulary.length === 2, "Payload contains registered section data");

  // Test 2: Non-destructive round-trip with unknown extra sections
  console.log("\n[TEST GROUP 2] Non-Destructive Extra / Unknown Section Preservation");
  const foreignData = {
    app: "WordPower",
    version: "1.0",
    data: {
      vocabulary: [{ word: "yield", mastered: true }],
      userNotes: "Keep this safe!",
      customTheme: { font: "serif", mode: "dark" }
    }
  };

  const importResult = await myAppVault.importPayload(foreignData, "user-data.wp");
  assert(importResult.success === true, "Import succeeded");
  assert(savedWords.length === 1 && savedWords[0].word === "yield", "Section handler was invoked with new data");

  // Now create a payload again — extra data should be non-destructively preserved!
  const roundTripPayload = await myAppVault.createPayload();
  assert(roundTripPayload.data.userNotes === "Keep this safe!", "Unknown key userNotes was preserved");
  assert(roundTripPayload.data.customTheme.mode === "dark", "Unknown object customTheme was preserved");
  assert(roundTripPayload.data.vocabulary.length === 1, "Registered section vocabulary is intact");

  // Test 3: KYF_VAULT Application Specialization
  console.log("\n[TEST GROUP 3] KYF_VAULT Multi-Section Integration");
  assert(global.KYF_VAULT !== undefined, "KYF_VAULT instance is exposed globally");

  // Populate mock data in different stores:
  // 1. Cadence in localStorage
  const mockCadence = [
    { id: "cad_tax", title: "Advance Tax Q4", status: "active", cadenceCategory: "Quarterly" },
    { id: "cad_rebal", title: "Annual Rebalancing", status: "done", cadenceCategory: "Annual" }
  ];
  mockLocalStorage.setItem("kyf_cadence_v3", JSON.stringify(mockCadence));

  // 2. Life Goals in localStorage
  const mockLifeGoals = [
    { id: "g_retire", title: "Retirement Corpus", presentValue: 25000000, inflationRate: 6.0, expectedReturn: 12.0 }
  ];
  mockLocalStorage.setItem("kyf_goals_v1", JSON.stringify(mockLifeGoals));

  // 3. Portfolio Holdings in IndexedDB & localStorage cache
  const mockHoldings = [
    { id: "hold_sbin", name: "State Bank of India", assetClass: "Equities", investedValue: 320000 },
    { id: "hold_gold", name: "24K Gold Bar", assetClass: "Commodities & Gold", investedValue: 720000 }
  ];
  mockLocalStorage.setItem("kyf_user_holdings", JSON.stringify(mockHoldings));

  // 4. Portfolio Goals (Envelopes)
  const mockPortfolioGoals = [
    { id: "pgoal_home", name: "Buy Family Home", baseTargetINR: 15000000, targetYear: 2026 }
  ];
  mockLocalStorage.setItem("kyf_user_goals", JSON.stringify(mockPortfolioGoals));

  // Create unified payload
  const kyfPayload = await global.KYF_VAULT.createPayload();
  assert(kyfPayload.app === "Know Your Finance", "KYF app name correct");
  assert(kyfPayload.fileType === "kyf-vault", "KYF fileType correct");
  assert(Array.isArray(kyfPayload.data.cadence) && kyfPayload.data.cadence.length === 2, "Unified payload includes cadence");
  assert(Array.isArray(kyfPayload.data.portfolio) && kyfPayload.data.portfolio.length === 2, "Unified payload includes portfolio holdings");
  assert(Array.isArray(kyfPayload.data.portfolioGoals) && kyfPayload.data.portfolioGoals.length === 1, "Unified payload includes portfolio goals");
  assert(Array.isArray(kyfPayload.data.goals) && kyfPayload.data.goals.length === 1, "Unified payload includes life planner goals");

  // Test 4: Cadence Page Save / Open Round-Trip
  console.log("\n[TEST GROUP 4] Cadence Page Saving & Opening (The Primary Bug Fix)");
  // Simulate Cadence page active hook
  let cadencePageActivities = [
    { id: "cad_tax", title: "Advance Tax Q4", status: "done", cadenceCategory: "Quarterly" },
    { id: "cad_health", title: "Health Shield Review", status: "active", cadenceCategory: "Annual" }
  ];

  global.KYF_VAULT.registerPageHook({
    pageName: "cadence",
    getLocalData: () => ({ cadence: cadencePageActivities }),
    onAfterOpen: (vaultData) => {
      cadencePageActivities = vaultData.cadence;
    }
  });

  // Cadence page triggers a save
  const cadenceSavePayload = await global.KYF_VAULT.createPayload();
  assert(cadenceSavePayload.data.cadence.length === 2, "Cadence data is freshest from page hook");
  assert(cadenceSavePayload.data.cadence[0].status === "done", "Checked off item in cadence is updated");
  assert(cadenceSavePayload.data.portfolio.length === 2, "PORTFOLIO WAS NOT LOST when saving from cadence page!");
  assert(cadenceSavePayload.data.portfolioGoals.length === 1, "PORTFOLIO GOALS WERE NOT LOST when saving from cadence page!");
  assert(cadenceSavePayload.data.goals.length === 1, "LIFE GOALS WERE NOT LOST when saving from cadence page!");

  // Test 5: Market Performance Save Round-Trip
  console.log("\n[TEST GROUP 5] Market Performance Page Saving");
  global.KYF_VAULT.registerPageHook({
    pageName: "market-performance",
    getLocalData: () => ({ marketReviewDate: "2026-11-09T06:00:00.000Z" })
  });

  const mpSavePayload = await global.KYF_VAULT.createPayload();
  assert(mpSavePayload.data.marketReviewDate === "2026-11-09T06:00:00.000Z", "Market review date included");
  assert(mpSavePayload.data.cadence.length === 2, "Cadence not lost when saving from market-performance");
  assert(mpSavePayload.data.portfolio.length === 2, "Portfolio not lost when saving from market-performance");
  assert(mpSavePayload.data.goals.length === 1, "Goals not lost when saving from market-performance");

  // Test 6: Legacy Payloads Backward Compatibility
  console.log("\n[TEST GROUP 6] Legacy Format Backward Compatibility");

  // Case A: Old cadence-only export
  const legacyCadenceOnly = {
    app: "Know Your Finance",
    version: "1.0",
    fileType: "kyf-vault",
    data: {
      cadence: [{ id: "legacy_item", title: "Old Cadence Task", recurrence: "Monthly" }]
    }
  };
  const parseResultA = await global.KYF_VAULT.parseFile(JSON.stringify(legacyCadenceOnly));
  assert(parseResultA.payload.data.cadence.length === 1, "Legacy cadence-only payload correctly parsed");

  // Case B: Old portfolio export where data.goals were portfolio envelopes
  const legacyPortfolioFile = {
    app: "Know Your Finance",
    version: "1.3.0",
    fileType: "kyf-vault",
    data: {
      cadence: [],
      portfolio: [{ id: "h1", name: "Reliance", assetClass: "Equities" }],
      goals: [{ id: "g1", name: "Buy Home", baseTargetINR: 10000000, targetYear: 2028 }]
    }
  };
  const parseResultB = await global.KYF_VAULT.parseFile(JSON.stringify(legacyPortfolioFile));
  assert(parseResultB.payload.data.portfolio.length === 1, "Portfolio holdings mapped");
  assert(parseResultB.payload.data.portfolioGoals.length === 1, "Portfolio goals disambiguated from life goals");

  // Case C: Raw array of cadence activities
  const rawArray = [
    { id: "act1", title: "SIP Auto-Debit", recurrence: "Monthly" }
  ];
  const parseResultC = await global.KYF_VAULT.parseFile(JSON.stringify(rawArray));
  assert(Array.isArray(parseResultC.payload.data.cadence), "Raw array normalized to cadence section");

  // Test 7: parseAndExtractKyfData adapter
  console.log("\n[TEST GROUP 7] KYF_VAULT.parseAndExtractKyfData adapter for portfolio-data.js");
  const extracted = global.KYF_VAULT.parseAndExtractKyfData(JSON.stringify(legacyPortfolioFile));
  assert(extracted.holdings.length === 1, "Adapter returned holdings");
  assert(extracted.goals.length === 1, "Adapter returned goals");

  console.log(`\n========================================`);
  console.log(`TEST SUMMARY: ${passed} passed, ${failed} failed`);
  console.log(`========================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error("Test execution threw error:", err);
  process.exit(1);
});
