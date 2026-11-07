# KYF (Know Your Finance) — Family Portfolio Tracker

**Governing Architecture, Live Market Data Engine, UX Design System & Agile Handoff Document**

* **Application:** `vividnova.com/kyf` (Know Your Finance)
* **Module:** Multi-Dimensional Family Portfolio & Goal Tracker
* **Stack Mandate:** Pure Vanilla HTML5, CSS3 (Grid / Custom Properties), and ES6+ JavaScript separated into modular static files. Zero external runtime frameworks, 100% client-side execution.
* **Storage & Privacy Model:** Ephemeral IndexedDB runtime cache (`kyf_portfolio_db`) paired with explicit **`user.kyf`** local file vault persistence (Open on session start, Save/Export on update, Clear & Lock on exit).
* **Live Valuation Model:** Holdings store **units/quantities and instrument identifiers** (`symbol`, `amfiCode`, `city` + `carpetSqft`, `grams`), while current INR values, momentum returns (`1M`, `3M`, `6M`, `1Y`), and inflation-adjusted goal targets are dynamically computed on every load from KYF's daily auto-generated market scripts.
* **Document Purpose:** Master reference and living handoff log to maintain architectural continuity, file versioning standards, live market data bindings, UX design tokens, and sprint progress across development sessions.

---

## 1. Executive Summary & Core Intent

Indian family wealth is inherently multi-dimensional. A single pool of capital is held across multiple **Family Members** (Self, Spouse, Parents, Children), parked across diverse **Custodians/Brokers** (SBI, HDFC, Zerodha, CAMS, KFintech, Physical Bank Lockers), spanning various **Asset Classes** (NSE Equities, AMFI Mutual Funds, Fixed Deposits, Sovereign Gold Bonds, Physical Gold, Residential Real Estate), and mentally ear-marked for distinct **Life Goals** (Buy Home, Daughter's Wedding, Child Education, Retirement, Emergency Reserve).

Traditional retail portfolio trackers fail families because they lock users into a rigid, single-hierarchy view, store sensitive wealth data on third-party cloud servers, and rely on stale manual valuations instead of live market and macroeconomic benchmarks.

### What We Are Building

An **OLAP-style Dynamic Pivot-Accordion Portfolio Tracker** that treats every investment holding as an atomic, multi-attribute record, enriches it in real time against KYF's daily market & macroeconomic feeds, and constructs a precision-aligned, collapsible TreeGrid on the fly—backed by a privacy-first **`user.kyf`** portable file workflow.

### Key Innovations

1. **Live Auto-Valuation & Macro Engine:** Directly binds user holdings to KYF's daily-synced global datasets (`KYF_MARKET_EQUITIES`, `KYF_MARKET_MF`, `KYF_MARKET_PULSE`, `KYF_RESIDEX`, `KYF_CORPORATE_ACTIONS`, `KYF_MARKET_CALENDAR`) so stocks, mutual funds, gold, silver, FDs, EPF/PPF, and city-specific real estate mark-to-market automatically.
2. **Dynamic Multi-Attribute Pivoting:** Users can re-order the accordion hierarchy on the fly (e.g., `Goal ➔ Asset Class`, `Member ➔ Custodian`, or `Asset Class ➔ Member`) in a single click without altering underlying storage.
3. **Faceted Cross-Filter Slicers:** Capping accordion depth at 2 levels to prevent "click fatigue," paired with top-level 1-click Slicer Chips (by Member or Custodian) for instant cross-filtering.
4. **Mental Accounting & Virtual Lot Splitting:** A single physical holding (e.g., a ₹10 Lakh SBI FD or a core Flexi Cap folio) can be split across multiple family goals via percentage sliders (e.g., 60% *Buy Home*, 40% *Emergency Fund*). Unassigned portions automatically roll into an **Unallocated / General Wealth** bucket so family net worth always reconciles to the exact rupee.
5. **Dual-Unit Target Tracking (INR + Physical Units):** Solves Indian mental-accounting nuances where goals like a **Wedding** require tracking **Gold in both physical grams (e.g., 500g target) and INR value**, and a **Buy Home** goal tracks **RERA Carpet Area (`Sq. Ft.` in a target NHB RESIDEX city) alongside INR value**, preventing price rallies from masking physical accumulation shortfalls.
6. **Zero-Knowledge `user.kyf` Session Lifecycle:** Combines fast IndexedDB working storage with a portable `user.kyf` file backup. Users load their `user.kyf` file at session start, save changes back to `user.kyf`, and wipe browser storage (`Clear & Lock Session`) when done.

---

## 2. File Organization, Separation of Concerns & Versioning Mandate

To guarantee zero stale-cache issues on GitHub Pages (`vividnova.com/kyf`) and maintain clean, modular code without build bundlers, every sprint must strictly follow these file separation and versioning rules:

### 2.1 Multi-File Separation Mandate

HTML, CSS, and JavaScript must **never** be lumped into a single monolithic file in production repository commits. They must be cleanly separated into dedicated files, loading the shared daily market data scripts first:

```
/kyf/
  ├── data/                              # Auto-generated daily by sync_market_data.py & sync_nhb_residex.mjs
  │   ├── market-holidays.js             # window.KYF_MARKET_CALENDAR (NSE trading days & staleness helper)
  │   ├── market-pulse.js                # window.KYF_MARKET_PULSE (Macro rates, Gold/Silver/ETF factors, Indices)
  │   ├── market-equities.js             # window.KYF_MARKET_EQUITIES (NSE stocks, closePrice, 1m/3m/6m/1y returns)
  │   ├── market-mf.js                   # window.KYF_MARKET_MF (AMFI Direct/Regular NAVs & horizon returns)
  │   ├── market-realestate.js           # window.KYF_RESIDEX (NHB RESIDEX 11-city HPI & Carpet Sq.Ft rates)
  │   └── market-corporate-actions.js    # window.KYF_CORPORATE_ACTIONS (Splits, bonuses, dividends)
  ├── docs/
  │   └── kyf_family_portfolio_tracker_architecture_roadmap.md # Governing Spec & Handoff Log (this file)
  ├── portfolio.html                     # Sibling root page with unified app toolbar (v1.1.0)
  ├── css/
  │   └── portfolio.css                  # KYF design tokens, shared CSS Grid & TreeGrid styling (?v=1.1.0)
  └── js/
      ├── portfolio-data.js              # IndexedDB (KYF_PORTFOLIO_DB), demo seed & unified .kyf I/O (?v=1.1.0)
      ├── portfolio-engine.js            # O(1) Map indexers, live valuation, search/filter & 1-level reducer (?v=1.1.0)
      └── portfolio-app.js               # Stateless DOM TreeGrid renderer, sortable headers & app toolbar wiring (?v=1.1.0)
```

### 2.2 Strict Cache-Busting & Versioning Rules

1. **Semantic Sprint Versioning (`vMajor.Sprint.Patch`):**
   * Sprint 1 = `v1.1.0`, Sprint 2 = `v1.2.0`, Sprint 3 = `v1.3.0`, Sprint 4 = `v1.4.0`, Sprint 5 = `v1.5.0`.
2. **Explicit Asset Query Strings & Filenames:**
   * Every HTML file must reference its stylesheet and scripts with matching explicit version tags (e.g., `<link rel="stylesheet" href="css/portfolio-v1.1.0.css?v=1.1.0">` and `<script type="module" src="js/portfolio-app-v1.1.0.js?v=1.1.0"></script>`) to defeat browser and CDN caching.
3. **Anti-Cache Meta Headers in HTML `<head>`:**
   * Include `<meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate">` so returning users always fetch the latest HTML shell.
4. **Visible UI Version Stamp & Live Market As-Of Badge:**
   * The top navigation bar must display both the app build version and the live market sync date (e.g., `KYF Portfolio v1.1.0 • Market Data: 05 Nov 2026 (EOD Synced)`).

---

## 3. Live Market & Macroeconomic Data Integration Architecture

Instead of asking users to manually type current prices every week, `portfolio-market-v1.X.0.js` builds `O(1)` lookup Maps in memory at startup from the six global `window.KYF_*` objects and enriches every holding before it enters the Pivot Reducer.

### 3.1 Global Feed Specifications & Lookup Indexing

| Global Object | Source Script | Primary Structure | How the Portfolio Engine Uses It |
| :--- | :--- | :--- | :--- |
| **`window.KYF_MARKET_PULSE`** | `market-pulse.js` | `macro`, `preciousMetals`, `indices`, `asOf` | • **Gold & Silver Valuation:** Uses `gold24kPerGram` (`₹14,470`), `gold22kPerGram` (`₹13,260`), `gold18kPerGram` (`₹10,850`), `silverPerGram` (`₹205.2`).<br>• **ETF-to-Physical Conversion:** Converts Gold ETF units to 24K gram-equivalent via `units / goldEtfTo24kFactor` (`122.5`) and Silver ETF units via `silverEtfToKgFactor` (`1153.8`).<br>• **Macro Rates & Inflation:** Auto-fills default rates for `EPF` (`8.25%`), `PPF` (`7.1%`), `SSY` (`8.2%`), `SCSS` (`8.2%`), `SBI FD` (`6.8%`), and compounds future Goal targets using `cpiInflation` (`5.4%`), `educationInflation` (`9.0%`), or `medicalInflation` (`11.5%`).<br>• **Benchmark Alpha:** Compares portfolio 1Y return against `NIFTY50` (`24,536.6`), `NIFTYMID150`, etc. |
| **`window.KYF_MARKET_EQUITIES`** | `market-equities.js` | `stocks[]`: `[symbol, companyName, closePrice, ret1m, ret3m, ret6m, ret1y, isN500]` | Indexed into `Map<symbol, stockObj>`. Automatically computes `currentValue = quantity * closePrice`, attaches `ret1m`, `ret3m`, `ret6m`, `ret1y` momentum badges, and flags Nifty 500 core stocks (`isN500 === 1`). Also prices Exchange Traded Funds (`GOLDBEES`, `NIFTYBEES`, `SILVERBEES`) listed on NSE. |
| **`window.KYF_MARKET_MF`** | `market-mf.js` | `schemes[]`: `[directCode, fundName, category, directNav, regularNav, ret1m, ret3m, ret6m, ret1y]` | Indexed into `Map<directCode, schemeObj>`. Supports both `"DIRECT"` (`directNav`) and `"REGULAR"` (`regularNav`) plan types. Computes `currentValue = units * activeNav` (and displays an advisory badge showing how much extra wealth Direct plan would yield if the user holds Regular). |
| **`window.KYF_RESIDEX`** | `market-realestate.js` | `national_composite_50_cities` + `cities[cityName]` (`Bengaluru`, `Mumbai`, `Delhi`, `Chennai`, `Hyderabad`, `Pune`, `Kolkata`, `Ahmedabad`, `Gurugram`, `Noida`, `Faridabad`) | • **Property Valuation:** Values residential property holdings by `carpetSqft * cities[city].carpet_price_sqft_by2024[tier]["Jun 2026"]` (supports `composite`, `compact_lte_646_sqft`, `mid_646_to_1184_sqft`, `large_gt_1184_sqft`) or HPI index appreciation from purchase quarter.<br>• **Buy Home Goal Target:** Tracks target carpet area (e.g., `1,400 Sq. Ft.` in `Bengaluru` @ `₹14,650/sqft`) alongside INR corpus. |
| **`window.KYF_MARKET_CALENDAR`** | `market-holidays.js` | `isTradingDay()`, `getLastCompletedTradingDay()` | Powers the **Market Data Freshness Badge** in the header. Compares `KYF_MARKET_PULSE.asOf` against `getLastCompletedTradingDay().isoDate` and displays holiday/special session notes (e.g., *Diwali Muhurat Session on 2026-11-08*). |
| **`window.KYF_CORPORATE_ACTIONS`** | `market-corporate-actions.js` | `actions[]`: `[symbol, companyName, series, purpose, exDate, type, multiplier, factor]` | Scans user equity symbols against `actions[]` and displays an inline Terracotta alert badge on any holding with an upcoming or recent split, bonus, or dividend. |

---

## 4. Aesthetic Direction & Editorial UX Design System

The KYF Portfolio Tracker rejects cold, neon-on-black crypto/trading terminal clichés in favor of a **Warm Editorial Private-Bank Ledger** aesthetic.

### 4.1 Color Palette & Atmospheric Tokens (`portfolio.css`)

```css
:root {
  /* Core Surfaces — Warm Alabaster & Soft Linen */
  --bg-canvas: #FAF7F2;          /* Warm Alabaster / Parchment main background */
  --bg-surface: #F3EFE6;         /* Soft Linen for cards, slicer bars, and L1 accordions */
  --bg-surface-elevated: #FFFFFF;/* Crisp ivory-white for leaf rows & slide-over drawer */
  --bg-surface-subtle: #EAE4D7;  /* Warm stone for nested L2 sub-group headers & hover states */

  /* Brand & Editorial Accents */
  --color-sage: #1E3A2F;         /* Deep Forest Sage — Primary brand, headers, active pills */
  --color-sage-muted: #2E5244;   /* Secondary sage for interactive hover & L1 border accents */
  --color-sage-tint: #E6EFEA;    /* Soft sage wash for positive badges & active filter chips */

  --color-terracotta: #C86D51;   /* Terracotta — Primary accent, action CTAs, split badges */
  --color-terracotta-tint: #F9EBE6; /* Warm terracotta wash for alerts & dirty vault state */

  --color-gold: #B8860B;         /* Antique Bullion Gold — Dual-unit gram pills & SGBs */
  --color-gold-tint: #FBF3DC;    /* Soft gold wash for commodity target badges */

  /* Typography & Ink Hierarchy */
  --ink-primary: #18241E;        /* Deep charcoal-sage ink for high-contrast readability */
  --ink-secondary: #4A5550;      /* Muted slate-sage for metadata, tags, and secondary labels */
  --ink-tertiary: #7A847E;       /* Subtle warm grey for column headers & timestamps */

  /* Semantic Financial Indicators */
  --gain-positive: #1F6E43;      /* Botanical Emerald for positive returns / XIRR */
  --gain-negative: #B93829;      /* Rust Crimson for drawdowns / shortfall warnings */
  --border-hairline: #DFD8CA;    /* Warm parchment rule for table & accordion dividers */
}
```

### 4.2 Typography System

* **Editorial Headings (`--font-serif: 'Fraunces', Georgia, serif`):** Used for page titles, Goal Envelope titles, Net Worth hero figures, and section headers. Gives the warmth and authority of a family office wealth report.
* **UI & Analytical Labels (`--font-sans: 'Plus Jakarta Sans', -apple-system, sans-serif`):** Used for slicer chips, custodian badges, instrument names, and navigation controls.
* **Indian Rupee & Unit Math (`--font-mono: 'JetBrains Mono', monospace`):** Strictly applied to all INR amounts (`₹18,45,000` / `₹18.45L` / `₹2.40Cr`), percentages (`+14.8%`), NAVs, gram weights (`320.0g`), and carpet areas (`1,250 sq.ft`) with `font-variant-numeric: tabular-nums` enforced globally.

---

## 5. Dual-Layer Storage & `user.kyf` Session Lifecycle

To give families total ownership of their financial data and protection on shared devices, KYF uses a **Two-Tier Ephemeral + File Vault Architecture**:

1. **Layer 1: Portable Master Vault (`user.kyf` File):**
   * Canonical source of truth stored on the user's local drive.
   * Uses the **File System Access API** (`showOpenFilePicker` / `showSaveFilePicker`) on Chromium/Edge with automatic fallback to `<input type="file" accept=".kyf,.json">` and Blob download across all browsers.
2. **Layer 2: Active Session Working Cache (`IndexedDB: kyf_portfolio_db`):**
   * Mirrors active state during a session for zero-latency pivoting, filtering, and editing.
3. **Top-Bar Vault Session Controls:**
   * **`📂 Open user.kyf`**: Validates schema, hydrates IndexedDB, and immediately re-values all holdings against today's `window.KYF_MARKET_*` feeds.
   * **`💾 Save user.kyf` *(Pulses Terracotta `#C86D51` when Dirty)*:** Serializes current holdings, goals, and UI preferences to `user.kyf`.
   * **`🧪 Load Demo Family`**: Hydrates a realistic Indian family portfolio (holding `SBIN`, `LT`, `BLUESTARCO`, `TITAN`, `GOLDBEES`, `Parag Parikh Flexi Cap`, `HDFC Mid Cap`, `SGBs`, `SBI FD`, `EPF`, and a `Bengaluru` apartment) mapped to real NSE/AMFI codes.
   * **`🧹 Clear & Lock Session`**: Wipes IndexedDB and clears memory to a locked parchment state.

---

## 6. Core Data Contracts & Transformation Pipeline

### 6.1 Architectural Golden Rule: Flat Storage + Live Enrichment + Pure Pivot

**Never store hierarchical JSON.** Store normalized flat arrays of `holdings` and `goals`. Pass them through a pure 5-step JavaScript pipeline:

```
[user.kyf File] ⇄ [IndexedDB Working Cache: Holdings[] + Goals[]]
                            │
                            ▼  Step 0: Live Market Enricher (enrichWithMarketData)
                  [Holdings Enriched with Live NSE/AMFI/Gold/RESIDEX Prices & 1M/1Y Returns]
                            │
                            ▼  Step 1: Faceted Slicer Pass (filterHoldings)
                  [Filtered Atomic Holdings]
                            │
                            ▼  Step 2: Goal Slice Virtualizer (expandGoalSlices)
                  [Normalized Holding Slices (includes auto-generated 'Unallocated' slices)]
                            │
                            ▼  Step 3: Recursive Pivot Reducer (buildPivotTree)
                  [Standardized Tree JSON: { id, label, level, metrics, children[] }]
                            │
                            ▼  Step 4: Stateless DOM Renderer (renderTreeGrid)
                  [Semantic <details> & <summary> TreeGrid with CSS Grid Alignment]
```

### 6.2 Canonical Entity Schemas (`v1.1`)

#### A. Goal Schema (`goals[]`)

Supports inflation-adjusted compounding via `KYF_MARKET_PULSE.macro` and dual-unit physical targets (`GRAMS_GOLD` or `SQFT_REALESTATE`):

```json
{
  "id": "goal_wedding",
  "name": "Daughter's Wedding",
  "icon": "💍",
  "targetYear": 2032,
  "baseTargetINR": 3500000,
  "inflationCategory": "CPI",
  "secondaryTarget": {
    "enabled": true,
    "unitType": "GRAMS_GOLD",
    "purity": "22K",
    "targetUnits": 500
  },
  "priority": "HIGH"
}
```

*(For a **Buy Home** goal, `secondaryTarget` can specify `{ "enabled": true, "unitType": "SQFT_REALESTATE", "city": "Bengaluru", "sizeTier": "large_gt_1184_sqft", "targetUnits": 1500 }`, dynamically benchmarking against `KYF_RESIDEX.cities.Bengaluru`!).*

#### B. Holding Schema (`holdings[]`)

Supports automatic live pricing via `pricingMode: "LIVE_EQUITY" | "LIVE_MF" | "LIVE_GOLD" | "LIVE_SILVER" | "LIVE_RESIDEX" | "MACRO_LINKED" | "MANUAL"`:

```json
{
  "id": "hold_eq_sbin",
  "name": "State Bank of India",
  "member": "Self",
  "custodian": "Zerodha",
  "assetClass": "Equities",
  "subCategory": "Large Cap Stock",
  "pricingMode": "LIVE_EQUITY",
  "instrumentMeta": {
    "symbol": "SBIN",
    "quantity": 500,
    "avgBuyPrice": 640.00
  },
  "investedValue": 320000,
  "manualCurrentValue": null,
  "allocations": [
    { "goalId": "goal_home", "percentage": 70 },
    { "goalId": "goal_retirement", "percentage": 30 }
  ]
}
```

* **For Mutual Funds (`pricingMode: "LIVE_MF"`):** `instrumentMeta` stores `{ "amfiCode": 122639, "planType": "DIRECT", "units": 4850.25 }`. Live NAV (`92.7055`) is pulled from `KYF_MARKET_MF`.
* **For Gold (`pricingMode: "LIVE_GOLD"`):**
  * Physical / SGB: `instrumentMeta` stores `{ "purity": "24K" | "22K", "grams": 200 }`, valued via `KYF_MARKET_PULSE.preciousMetals`.
  * Gold ETF (`GOLDBEES`): `instrumentMeta` stores `{ "symbol": "GOLDBEES", "units": 14700 }`, priced via `KYF_MARKET_EQUITIES` and converted to physical gram-equivalent via `units / KYF_MARKET_PULSE.preciousMetals.goldEtfTo24kFactor` (`14700 / 122.5 = 120g`).
* **For Real Estate (`pricingMode: "LIVE_RESIDEX"`):** `instrumentMeta` stores `{ "city": "Bengaluru", "sizeTier": "large_gt_1184_sqft", "carpetSqft": 1450 }`, valued via `KYF_RESIDEX.cities["Bengaluru"].carpet_price_sqft_by2024`.

---

## 7. Agile Vertical-Slice Roadmap & Sprint Tracker

Each sprint delivers a **100% working, shippable increment** with explicit file versioning (`v1.1.0` through `v1.5.0`), the Warm Alabaster / Deep Forest Sage / Terracotta design system, and live `window.KYF_*` market data integration.

### Sprint Status Legend

* `[ ]` Pending
* `[~]` In Progress
* `[x]` Completed & Verified

### Sprint 1 (`v1.1.0`): Live Market Enricher, 1-Level Aligned TreeGrid & `user.kyf` Vault Lifecycle

* **Goal:** Establish root sibling page (`portfolio.html`), modular file structure, unified KYF design system tokens, live valuation hookups to `window.KYF_MARKET_*`, app-level Open & Save Data toolbar + IndexedDB, and the 1-level aligned, sortable & filterable TreeGrid.
* **Deliverables:**
  * `[x]` **1.1:** Setup versioned HTML shell (`portfolio.html`) loading Google Fonts (`Fraunces`, `Plus Jakarta Sans`, `JetBrains Mono`), the 6 `data/market-*.js` scripts, anti-cache headers, market freshness badge (`KYF_MARKET_CALENDAR`), and unified KYF app navigation.
  * `[x] ` **1.2:** Build `js/portfolio-engine.js` with `O(1)` lookup maps for `KYF_MARKET_EQUITIES`, `KYF_MARKET_MF`, `KYF_MARKET_PULSE`, and `KYF_RESIDEX`, enriching holdings with live prices, `1M`/`1Y` returns, and Direct-vs-Regular MF expense gap alerts.
  * `[x]` **1.3:** Implement app-level **Open & Save Data Toolbar** (`📂 Open`, `💾 Save Data`) backed by IndexedDB (`KYF_PORTFOLIO_DB`), unified `.kyf` payload support (cadence + portfolio), and demo loader.
  * `[x]` **1.4:** Build `groupBySingleDimension(holdings, dimensionKey)` (`assetClass`, `member`, `custodian`) and render the sortable, filterable semantic `<details>`/`<summary>` TreeGrid with shared CSS Grid template (`--tree-cols: minmax(280px, 2.5fr) 1.2fr 1.15fr 1.15fr 130px`) and top KPI ribbon.
* **Acceptance Check:** Demo Family portfolio auto-calculates live INR values from `SBIN`, `LT`, `TITAN`, `Parag Parikh Flexi Cap`, `22K/24K Gold + GOLDBEES`, and `Bengaluru Real Estate` (₹2.95 Cr net worth); switches cleanly between *Asset Class*, *Member*, and *Custodian*; sorts across all 5 columns; filters via text search and slicers; and completes app-level `.kyf` Save ➔ Clear ➔ Re-Open round-trip.

### Sprint 2 (`v1.2.0`): View Lenses, Multi-Select Pill Strip & Horizon Return Toggle

* **Goal:** Deliver a lean, mobile-first multi-dimensional slicing experience using View Lenses (`Asset Class`, `Family Member`, `Custodian / Broker`) paired with 1-click Multi-Select Pill Strips and dynamic Return Horizon toggling (`1M | 3M | 6M | 1Y | All-Time`), avoiding nested accordion click fatigue.
* **Deliverables:**
  * `[x]` **2.1:** Upgrade reducer in `js/portfolio-engine.js` with weighted-average return rollups for active horizons (`1m`, `3m`, `6m`, `1y`, `all`) at parent group levels:
    $$\sum (\text{holding.return} \times \text{holding.currentValue}) / \text{group.totalCurrentValue}$$
  * `[x]` **2.2:** Build the interactive **View Tabs & Horizon Bar** (`View Lens: [ Asset Class | Member | Custodian ]` + `Horizon: [ 1M | 3M | 6M | 1Y | All ]`).
  * `[x]` **2.3:** Build the **1-Click Multi-Select Pill Strip** for active view entities with live valuations (e.g. `[✓ Self (₹31.7L)] [✓ Spouse (₹7.0L)]`) that dynamically recalculates the top KPI cards and filters the tree with zero latency.
  * `[x]` **2.4:** Mobile-friendly horizontal scrolling pill strip (`-webkit-overflow-scrolling: touch; scrollbar-width: none;`) taking just ~38px of vertical height without modal pickers.
* **Acceptance Check:** Multi-selecting `Self + Spouse` dynamically recalculates the couple's net worth to ₹38.68 L (+8.8% 1Y weighted return); switching horizon to `1M` updates column 5 and group averages cleanly; sorting across all columns preserved.

### Sprint 3 (`v1.3.0`): Goal Envelopes, Macro Inflation Compounding & Virtual Lot Splitting

* **Goal:** Introduce Goal-based mental accounting with inflation-adjusted targets (from `KYF_MARKET_PULSE.macro`) and percentage-based virtual lot splitting.
* **Deliverables:**
  * `[x]` **3.1:** Add `goals[]` schema (Buy Home, Daughter's Wedding, Child Education, Retirement, Emergency Reserve) with automatic future value compounding using `cpiInflation` (`5.4%`), `educationInflation` (`9.0%`), or `medicalInflation` (`11.5%`).
  * `[x]` **3.2:** Build `expandGoalSlices(holdings, goals)` virtualizer: splits holdings by `allocations[]` percentages and routes any `< 100%` remainder into the system `Unallocated / General Wealth` bucket.
  * `[x]` **3.3:** Enhance Level-1 Goal accordion headers with **Goal Progress Bars & Labels** (`XX% of ₹YY L`), inflation-adjusted vs. present-value compounding, and time-horizon badges (`⏳ N yrs (TargetYear)`).
  * `[x]` **3.4:** Add Terracotta **"Split Slice" badges** (`🍰 XX% slice`) on leaf rows when viewed inside Goal hierarchies, with dynamic Column 2 showing `Asset Class & Owner`.
* **Acceptance Check:** Sum of all Goal buckets + *Unallocated* bucket strictly equals 100% of total live family net worth at all times (verified ₹2,95,89,431 net worth across 18 virtual slices).

### Sprint 4 (`v1.4.0`): Dual-Unit Engine, Top-Level Family Scope & Mobile TreeGrid Optimization [~ IN PROGRESS]

* **Goal:** Track physical quantity targets (Gold in grams for Wedding; RERA Carpet Sq.Ft in NHB RESIDEX cities for Buy Home) alongside INR financial targets, promote Family Member selection to a top-level global hero scope with individual names, and optimize the mobile viewing experience with a zero-wrapping 3-column TreeGrid.
* **Deliverables:**
  * `[x]` **4.1:** Extend reducer rollup math to aggregate `GRAMS_GOLD` (combining 22K/24K physical gold, SGBs, and `GOLDBEES` ETF converted via `goldEtfTo24kFactor: 122.5`) and `SQFT_REALESTATE`. Build `convertHoldingToGoldGrams` and `computeHoldingPhysicalUnits`. Implement Price-vs-Quantity Divergence formula ($\Delta = \text{INR Progress \%} - \text{Physical Progress \%} \ge 15\%$) and Asset Class physical summaries (`249.5g 24K eq` and `1,450 sq.ft`).
  * `[x]` **4.2:** **Top-Level Family Member Scope Selector & Individual-Only Chips:** Promoted Family Member selection into a top-level global Hero Selector adjacent to hero text (desktop 2-column layout; stacked on mobile). Replaced relationship names with individual names (`Rajesh`, `Priya`, `Ramesh`, `Sunita`). Removed redundant combination chips (e.g. `Rajesh & Priya`), letting users multi-select any arbitrary combination of individuals cleanly. Entire dashboard (KPIs, active view, pill strip, and treegrid) operates dynamically in the context of `All Family` or multi-selected individuals.
  * `[x]` **4.3:** **Mobile UI/UX Optimization & 3-Column TreeGrid:** Resolved vertical spacing bug on mobile by zeroing out `flex-basis` on `.hero-content` when stacked in column flex direction, positioning the Family Scope Selector snugly beneath the hero text above the fold. Allowed member chips to wrap cleanly with `flex-wrap: wrap` on mobile screens so no family member chips are hidden or pushed off-screen. Eliminated table cell wrapping on mobile screens (`<= 768px`) with a strict 3-column TreeGrid (`Holding / Instrument`, `Current Value`, `Return`), hiding columns 2 & 3 in both headers and rows, embedding secondary details into Column 1 subtext, and implementing compact 2x2 KPI ribbon with smooth touch-scrolling strips.
  * `[x]` **4.4:** **Market Performance Benchmark Accuracy & Fallback:** Resolved missing Nifty 50 and benchmark index horizon returns in `market-performance.html` by computing live NSE index returns across 1M (+8.78%), 3M (-0.36%), 6M (+2.10%), and 1Y (-4.15%) from cached historical EOD index bhavcopies in `market-pulse.js`, with ETF fallback via `NIFTYBEES`.
  * `[ ]` **4.5:** Render the **Dual-Unit Progress Badge** (`🪙 233g / 500g (22K) Target • 46.6%` and `🏠 1,450 / 1,450 Sq.Ft Bengaluru Target • 100%`) and **Price-vs-Quantity Divergence Alert Pill** inside Goal accordions when $\Delta \ge 15\%$.
  * `[ ]` **4.6:** Add an interactive **What-If Macro & Market Simulator Bar** (test how +/-15% Gold, Nifty 50, or RESIDEX city price changes impact Goal completion).
* **Acceptance Check:** Selecting individual members (`Rajesh + Priya`) dynamically scopes KPIs and active views; mobile view renders clean 3-column TreeGrid without horizontal wrapping; physical units and INR valuations reconcile across all slices.

### Sprint 5 (`v1.5.0`): Slide-Over Inspector, Live Instrument Search & Goal Split Sliders

* **Goal:** Full CRUD editing via a slide-over inspector drawer with autocomplete search over the 500+ NSE Equities, AMFI Mutual Funds, and 11 NHB RESIDEX cities, plus interactive 100% allocation sliders.
* **Deliverables:**
  * `[ ]` **5.1:** Build the right-hand **Slide-Over Inspector Drawer** with instant typeahead search over `KYF_MARKET_EQUITIES.stocks`, `KYF_MARKET_MF.schemes`, and `KYF_RESIDEX.cities`.
  * `[ ]` **5.2:** Create interactive **100% Clamped Goal Allocation Sliders** inside the drawer so users can visually split any holding across multiple goals.
  * `[ ]` **5.3:** Add **Direct vs. Regular MF Optimizer Card** (automatically flags any holding in `"REGULAR"` plan and calculates exact 10-year compounding loss using the spread between `directNav` and `regularNav`).
  * `[ ]` **5.4:** Finalize responsive mobile card collapse (`@media (max-width: 768px)`) and `beforeunload` dirty-vault guard.
* **Acceptance Check:** Complete offline-first CRUD lifecycle with live market autocomplete, full `user.kyf` round-trip persistence, zero console errors, responsive on desktop and mobile viewports.

---

## 8. Session Handoff & Context Continuity Protocol

When transitioning to a new conversation thread as this project grows, start the new session by sharing this `portfolio.md` file along with the `data/market-*.js` files and current `v1.X.0` code files, using a prompt like:

> *"Here is our governing `portfolio.md` specification, our `data/market-*.js` feeds, and our current `v1.X.0` files. We have completed up to Sprint [X]. Let's verify the acceptance criteria and begin Sprint [X+1]."*

### Handoff Changelog

* **v1.0 (Initial Spec):** Established core OLAP Pivot-Accordion architecture, normalized schemas for Holdings and Goals, Virtual Lot Splitting rules, Dual-Unit (INR + Gold Grams) specifications, and the 5-Sprint Vertical Slice roadmap.
* **v1.1 (Storage & Versioning Spec Update):** Added strict multi-file separation mandate (`HTML`, `CSS`, `JS`), semantic sprint versioning (`?v=1.X.0`) with visible UI version stamps for GitHub Pages cache busting, and the two-tier IndexedDB + `user.kyf` portable file vault lifecycle.
* **v1.2 (Live Market Feeds & Editorial UX Spec Update):** Integrated the 6 daily/quarterly auto-generated market feeds (`KYF_MARKET_PULSE`, `KYF_MARKET_EQUITIES`, `KYF_MARKET_MF`, `KYF_RESIDEX`, `KYF_CORPORATE_ACTIONS`, `KYF_MARKET_CALENDAR`) for automatic unit-to-INR valuation, `GOLDBEES`-to-24K gram conversion (`122.5` factor), Direct-vs-Regular NAV comparison, NHB RESIDEX city carpet-area benchmarking, and macro inflation goal compounding.
* **v1.1.0 (Sprint 1 Completed):** Delivered `portfolio.html` at repository root with unified KYF app navigation and Open & Save Data toolbar. Implemented `css/portfolio.css`, `js/portfolio-data.js`, `js/portfolio-engine.js`, and `js/portfolio-app.js`. Full live market valuation, 1-level pivot reducer (`Asset Class`, `Family Member`, `Custodian`), 5-column sortable header, instant text search, and facet slicers verified with realistic Indian family demo dataset (₹2.95 Cr net worth).
* **v1.2.0 (Sprint 2 Completed):** Replaced over-engineered nested accordions with lean View Lenses (`Asset Class`, `Family Member`, `Custodian`) and 1-Click Multi-Select Pill Strips with live entity valuations. Added Multi-Horizon Return Toggle (`1M | 3M | 6M | 1Y | All-Time`) with weighted-average parent group rollups. Implemented Dynamic Column 2 context (`Member` in Asset Class View, `Asset Class` in Member View) with bidirectional click-to-switch filtering and dedicated column sorting. Verified dynamic multi-select net worth recalculation (e.g. Self + Spouse = ₹38.68L) and mobile horizontal touch scrolling.
* **v1.3.0 (Sprint 3 Completed):** Integrated Goal Envelopes as a 4th View Lens (`🎯 Goals`) with 1-Click Multi-Select Pill Strip. Implemented macro inflation future compounding ($FV = \text{Base} \times (1 + r/100)^N$) using `KYF_MARKET_PULSE.macro` (CPI 5.4%, Education 9.0%). Built `expandGoalSlices` virtualizer with exact rupee net worth conservation, routing unallocated fractions to General Wealth. Added goal time-horizon tags (`⏳ N yrs`), funding progress bars, and Terracotta split-slice badges (`🍰 XX% slice`). Unified `.kyf` vault schema updated with backwards-compatible `goals[]` import/export.
* **v1.4.2 (Scope Chips Wrapping & Nifty 50 Index Fix):** Switched `.hero-member-chips` to `flex-wrap: wrap` on mobile viewports so that all individual chips (`All Family`, `Rajesh`, `Priya`, `Ramesh`, `Sunita`) are simultaneously visible across 2 rows without requiring horizontal touch scrolling or hiding names. Corrected Nifty 50 index level (`24,536.60`) and computed exact trailing returns across all horizons (`1M: +8.78%`, `3M: -0.36%`, `6M: +2.10%`, `1Y: -4.15%`) from official cached NSE index archives in `data/market-pulse.js`. Enhanced `market-performance.js` with multi-horizon fallback logic for all benchmark indices. Bumped cache-busting to `?v=1.4.2`.
* **v1.4.3 (Nifty 50 Live Google Finance Sync & Cache-Busting Refresh):** Synced Nifty 50 index level to `25,030.35` (+493.75, +2.01% live day gain) matching user's live Google Finance benchmark. Updated valuation multiples (P/E 20.66 Fair zone, P/B 3.07, Div Yield 1.39%) and calculated exact trailing returns against historical baselines: `1M: +10.97%` (Ticker: `+11.0% 1M`), `3M: +1.65%`, `6M: +4.15%`, `1Y: -2.22%`. Added cache-busting query parameter `?v=1.4.3` to all data feeds and app scripts across `portfolio.html` and `market-performance.html` to eliminate stale browser caching. Updated baselines in `admin/pulse_config.json`, `admin/sync_market_data.py`, and `admin/eod-generator.html`.