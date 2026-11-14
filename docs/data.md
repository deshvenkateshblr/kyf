# Know Your Finance (KYF) — Master Data Architecture (`data.md`)

**Philosophy:** Zero external runtime API dependencies, zero CORS friction, 100% static `.js` bundles committed to Git and served via GitHub Pages CDN.
- **Static Educational Data:** Curated via Admin Editor -> exported as `data/kyf-*.js`.
- **Market & Valuation Data:** Parsed at EOD via `admin/eod-generator.html` -> exported as sorted, diff-friendly `data/market-*.js`.
- **User Personal Data:** Stored strictly on-device inside IndexedDB (`KYF_USER_VAULT`). Never leaves the browser.

---

## Master Checklist of Data Modules (To Address One-by-One)

- [ ] **Module 1: `data/kyf-curriculum.js`** (The 10 Chapters, Discovery Strips, Goal Presets & Reflex Checks)
- [x] **Module 2: `data/kyf-terms.js`** (The one vocabulary: 72 words, 50 of them full lessons; replaces the old `kyf-dictionary.js`)
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
     - Chapter ID, title (*"How to Talk About..."*), subtitle, target word IDs (linking to `kyf-terms.js`), and the interactive sandbox configuration.
  4. **`reflexQuestions` (Chapter 1 Diagnostic)**:
     - Scenario text, 3 options, blind-spot diagnosis revealed per option, and word ID unlocked.

---

### Module 2: `data/kyf-terms.js` (The one vocabulary)
* **Global Variable:** `window.KYF_TERMS` (`terms[]`, `find(id)`, `renderContext(id, vars)`, `topicPage: "learn.html"`)
* **Used by:** the "?" tips (Goals, Portfolio), the Money Word card (Home) and the Learn page (`learn.html?term=<id>`).
* **Every term:** `id`, `term`, `chapter` (1-10), `tip` (plain meaning; "?" bubble terms keep it to 170 characters or fewer).
* **"?" bubble terms also have:** `exact` / `words` (spellings matched in page text).
* **Lesson terms also have:** `pronunciation`, `partOfSpeech`, `rootFamily`, `humanFriction`, `plainMeaning`, `contextTemplate` (filled with the person's first goal and today's rates), `relatedWords`, `quickCheck { question, options[{text, correct}], explanation }`.
* **Order matters:** Money Word walks `terms` in order (the original "?" words first, then lessons by chapter); the Learn page orders by chapter.

## NHB RESIDEX (real estate) refresh
- NHB publishes the housing price index quarterly. The daily cloud sync skips it (`--skip-nhb`), because the scraper needs Microsoft Edge.
- Refresh it by hand, about once a quarter, on a machine with Edge: `node admin/sync_nhb_residex.mjs --force-nhb` (from the admin repo), then commit `data/market-realestate.js` and `data/nhb_residex_kyf.json`.
- Feeds Health shows the latest quarter and the days since the last refresh, and turns to a warning after 90 days (the top status dot follows). The browser console also prints the refresh command.
- The market data sync lives in the admin repo (`sync_market_data.py`, `pulse_config.json`, `sync_nhb_residex.mjs`); this repo only holds the generated `data/` files.
