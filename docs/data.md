# Know Your Finance (KYF) — Master Data Architecture (`data.md`)

**Philosophy:** Zero external runtime API dependencies, zero CORS friction, 100% static `.js` bundles committed to Git and served via GitHub Pages CDN.
- **Static Educational Data:** Curated via Admin Editor -> exported as `data/kyf-*.js`.
- **Market & Valuation Data:** Parsed at EOD via `admin/eod-generator.html` -> exported as sorted, diff-friendly `data/market-*.js`.
- **User Personal Data:** Stored strictly on-device inside IndexedDB (`KYF_USER_VAULT`). Never leaves the browser.

---

## Master Checklist of Data Modules (To Address One-by-One)

- [ ] **Module 1: `data/kyf-curriculum.js`** (The 10 Chapters, Discovery Strips, Goal Presets & Reflex Checks)
- [ ] **Module 2: `data/kyf-dictionary.js`** (The "Money Power" Vocabulary Corpus — 50 Anchor Words + ~150 Cousin Terms)
- [ ] **Module 3: `data/market-pulse.js`** (Macro Rates, Inflation, Statutory Yields, Gold/Silver & Core Index Benchmarks)
- [ ] **Module 4: `data/market-equities.js`** (NSE End-of-Day Stock Prices & Valuation Multiples)
- [ ] **Module 5: `data/market-mf.js`** (Filtered AMFI Mutual Fund Direct vs. Regular Growth NAVs)

---

## Detailed Specification Per Module

### Module 1: `data/kyf-curriculum.js` (Static Educational Spine)
* **Update Frequency:** Whenever curriculum or discovery copy is refined.
* **Loaded When:** Immediately on `index.html` boot (`~15 KB`).
* **Global Variable:** `window.KYF_CURRICULUM`
* **What It Contains:**
  1. **`discoveryStrips`**:
     - `lifeStages`: Age brackets (`20s`, `30s`, `40s`, `50s+`), compounding horizon multipliers, default risk notes.
     - `assetContainers`: The 6 core containers (`bank_fd`, `gold`, `epf_ppf`, `mutual_funds`, `stocks`, `real_estate`), their plain-English role, liquidity tier, and linked benchmark key in `market-pulse.js`.
     - `liabilitiesAndShields`: Good vs. Toxic debt flags (`home_loan`, `personal_card_emi`) and protection flags (`health_cover`, `term_life`).
  2. **`goalTemplates`**:
     - The 5 starter milestones (*Car/Upgrade*, *Home Down Payment*, *6-Month Peace Buffer*, *Child's Education*, *Work-Optional Freedom*), default rupee cost in today's terms, default horizon (years), and category-specific inflation rate (e.g., general CPI 6% vs. education/medical inflation 8%–10%).
  3. **`chapters` (1 to 10)**:
     - Chapter ID, title (*"How to Talk About..."*), subtitle, target word IDs (linking to `kyf-dictionary.js`), and the interactive sandbox configuration.
  4. **`reflexQuestions` (Chapter 1 Diagnostic)**:
     - Scenario text, 3 options, blind-spot diagnosis revealed per option, and word ID unlocked.

---

### Module 2: `data/kyf-dictionary.js` (The "Word Power" Corpus)
* **Update Frequency:** Static / Periodic content expansion.
* **Loaded When:** Immediately on `index.html` boot (`~35 KB`).
* **Global Variable:** `window.KYF_DICTIONARY`
* **Primary Sources:** CFPB Public Domain Financial Glossary (plain-English baseline) + SEBI/AMFI/Varsity Indian retail concepts, rewritten into Norman Lewis's *Word Power* format.
* **Schema Per Entry (Keyed by `wordId`):**
  ```javascript
  "money_illusion": {
    id: "money_illusion",
    term: "Money Illusion",
    partOfSpeech: "noun",
    chapter: 1,
    rootFamily: "Value & Purchasing Power",
    humanFriction: "Feeling richer because your bank balance went up, while ignoring that prices rose even faster.",
    plainMeaning: "Mistaking the face value of money (Nominal) for its actual buying power (Real).",
    contextTemplate: "Growing your ₹{principal} to ₹{nominalFinal} at {rate}% feels like a profit—that is Money Illusion, because at {inflation}% inflation, its real buying power is only ₹{realFinal}.",
    relatedWords: ["nominal_value", "real_return", "purchasing_power_erosion"],
    quickCheck: {
      question: "Your salary rises 5% in a year when inflation is 7%. What happened?",
      options: [
        { text: "Nominal income rose, but Real income fell.", correct: true },
        { text: "Both Nominal and Real income rose by 5%.", correct: false }
      ]
    }
  }