# KYF (Know Your Finance) — Lean Broker Import & ISIN Sync Specification

**Target Agent:** Google Antigravity  
**Architecture Constraints:** 100% Client-Side Vanilla HTML5 / CSS3 / ES6+ JS (Zero Server, Local IndexedDB + `.kyf` Vault)  
**Design Principle:** Minimalist, zero bloat. No hardcoded dummy datasets or dynamic style injection in JS. Reuse existing KYF modal & table classes.

---

## Task 1: Upgrade `admin/sync_market_data.py` (Add ISINs to Market Bundles)

Appending ISINs to the end of each tuple in `market-equities.js` and `market-mf.js` gives the browser $O(1)$ exact matching across all Indian brokers without breaking positional array destructuring in existing code.

### 1.1 `parse_nse_csv(csv_text: str)` & `build_equities_js(...)`
* **In `parse_nse_csv`:**
  * Update ISIN column lookup: `i_isin = idx(["ISIN", "ISIN_CODE", "FinInstrmId"])`.
  * Validate 12-character Indian ISIN format (`^IN[EF0][0-9A-Z]{9}$`) so numeric `FinInstrmId` tokens are ignored:
    ```python
    raw_isin = row[i_isin].strip().upper() if (i_isin != -1 and i_isin < len(row)) else ""
    isin = raw_isin if re.match(r"^IN[EF0][0-9A-Z]{9}$", raw_isin) else ""
    ```
* **In `build_equities_js`:**
  * Append `cur_isin or None` at index `8` of each stock tuple:
    ```python
    tuples.append([
        sym, name, c,
        calc_h("m1", 70.0), calc_h("m3", 130.0), calc_h("m6", 220.0), calc_h("y1", 320.0),
        1 if sym in n500_symbols else 0,
        cur_isin or None,
    ])
    ```
  * Update `columns` metadata: `["symbol", "companyName", "closePrice", "ret1m", "ret3m", "ret6m", "ret1y", "isN500", "isin"]`.

### 1.2 `parse_amfi_txt(...)` & `build_mf_js(...)`
* **In `parse_amfi_txt` (when `is_latest` is `True`):**
  * Extract the 12-character Growth ISIN (`^INF[0-9A-Z]{9}$`) from `parts[1:3]`:
    ```python
    scheme_isin = None
    for p_cand in parts[1:3]:
        cand = p_cand.strip().upper()
        if re.match(r"^INF[0-9A-Z]{9}$", cand):
            scheme_isin = cand
            break
    ```
  * Add `"directIsin": None` and `"regularIsin": None` to `grouped[base_key]`.
  * Set `grouped[base_key]["directIsin"] = scheme_isin` when `is_direct` is `True`, and `grouped[base_key]["regularIsin"] = scheme_isin` when `is_regular` is `True`.
* **In `build_mf_js`:**
  * Append `item.get("directIsin")` (index `9`) and `item.get("regularIsin")` (index `10`) to each scheme tuple.
  * Update `columns` metadata: `["directCode", "fundName", "category", "directNav", "regularNav", "ret1m", "ret3m", "ret6m", "ret1y", "directIsin", "regularIsin"]`.

---

## Task 2: Upgrade `js/portfolio-engine.js` ($O(1)$ ISIN Lookup Maps)

1. Add two module-scoped `Map` instances alongside `equityMap` and `mfMap`:
   * `let equityIsinMap = null;` (`ISIN` $\rightarrow$ stock object)
   * `let mfIsinMap = null;` (`ISIN` $\rightarrow$ `{ scheme, planType: "DIRECT" | "REGULAR" }`)
2. In `ensureIndexed()`:
   * Read `row[8]` (`isin`) from `window.KYF_MARKET_EQUITIES.stocks` and populate `equityIsinMap`.
   * Read `row[9]` (`directIsin`) and `row[10]` (`regularIsin`) from `window.KYF_MARKET_MF.schemes` and populate `mfIsinMap` with the corresponding `planType`.
3. In `enrichHoldingsWithLiveMarket()`:
   * In `LIVE_EQUITY`, if `equityMap.get(sym)` misses and `meta.isin` exists, fallback to `equityIsinMap.get(meta.isin)`.
   * In `LIVE_MF`, if `mfMap.get(code)` misses and `meta.isin` exists, fallback to `mfIsinMap.get(meta.isin)`.
4. Expose two helper lookups on `window.KYF_PORTFOLIO_ENGINE`:
   * `lookupEquity(symbol, isin, name)`
   * `lookupMf(amfiCode, isin, name)`

---

## Task 3: Create `js/portfolio-importer.js` (Pure Parser & Upsert Engine)

Create a lean vanilla ES6 module `window.KYF_BROKER_IMPORTER` (~250 lines) with **no hardcoded sample strings or injected CSS**.

### 3.1 File Readers (Zero Server)
1. **CSV / TSV / Text:** RFC-4180 state-machine parser handling quoted numbers with Indian commas (`"1,26,322.50"`) and auto-detecting `,` vs `\t`.
2. **HTML-Table `.xls`:** If file text starts with `<html`, `<!DOCTYPE`, or `<table` (used by HDFC/SBI/ICICI `.xls` exports), parse rows via `DOMParser`.
3. **Binary `.xlsx` / `.xls`:** Check magic bytes (`0x50 0x4B` or `0xD0 0xCF`). Lazy-load SheetJS (`https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js`) only when a binary Excel file is selected.

### 3.2 Dynamic Header Detection & Broker Fingerprinting
* Scan the first 35 rows; pick the first row matching $\ge 3$ known column tokens (`isin`, `instrument`, `symbol`, `scrip`, `scheme`, `qty`, `quantity`, `units`, `avg`, `invested`, `ltp`, `nav`).
* Extract preamble client metadata (`Name`, `Client Name`, `Investor Name`, `Client ID`, `Client Code`) if present above the header row.
* Ignore footer/summary rows (`Total`, `Grand Total`, `Disclaimer`, `Note`, or `qty <= 0`).

| Broker / Source | Custodian Tag | Header Signature Tokens |
| :--- | :--- | :--- |
| **Zerodha Kite** | `Zerodha` | `instrument`, `qty.`, `avg. cost`, `cur. val` |
| **Zerodha Console** | `Zerodha` | `quantity available`, `quantity discrepant`, `average price` |
| **Groww Stocks** | `Groww` | `stock name`, `isin`, `average buy price`, `buy value` |
| **HDFC Securities** | `HDFC Securities` | `isin code`, `avg cost price`, `current market value` |
| **SBI Securities** | `SBI Securities` | `scrip code`, `holdings qty`, `invested value` |
| **ICICI Direct** | `ICICI Direct` | `stock symbol`, `isin code`, `book value` |
| **Angel One** | `Angel One` | `scrip/contract`, `free qty`, `avg price` |
| **Upstox** | `Upstox` | `instrument`, `net qty`, `holding qty` |
| **Zerodha Coin** | `Zerodha Coin` | `fund name`, `folio number`, `quantity available` |
| **Groww MF** | `Groww` | `scheme name`, `amc`, `units`, `invested value` |
| **Kuvera / Generic MF** | `MF Folio` | `name of the fund`, `folio number`, `units` |
| **CAMS / KFintech CAS** | `CAMS / MFCentral` | `closing unit balance`, `rta`, `amc name` |

### 3.3 Asset Class & Pricing Resolution (Using Engine Maps)
1. **Gold (`Commodities & Gold` / `LIVE_GOLD`):**
   * If `isin.startsWith("IN0020")`, `/^SGB/i.test(symbol)`, `symbol === "GOLDBEES"`, or `isin === "INF204KB17I5"`.
2. **Mutual Funds (`Mutual Funds` / `LIVE_MF`):**
   * If `isin.startsWith("INF")` (and not an ETF in `equityIsinMap`) or broker is MF type.
   * Resolve via `KYF_PORTFOLIO_ENGINE.lookupMf(code, isin, name)`. `mfIsinMap` automatically determines both `amfiCode` and `planType` (`"DIRECT"` vs `"REGULAR"`).
3. **Equities (`Equities` / `LIVE_EQUITY`):**
   * Resolve via `KYF_PORTFOLIO_ENGINE.lookupEquity(symbol, isin, name)` (prioritizing `isin` first so ICICI Direct codes like `STABAN` and Groww ISIN rows resolve with 100% accuracy).

### 3.4 Smart Upsert (Default & Only Merge Strategy)
* Match incoming holdings against existing `rawHoldings` using `${memberLower}|${custodianLower}|${isin || amfiCode || symbol || nameLower}`.
* If matched: update `units`, `investedValue`, `currentValue`, and `instrumentMeta`, **preserving existing `id` and `allocations`** (so multi-goal splits are never lost).
* If unmatched: append as a new holding.
* If row-level `Investor Name` (e.g., CAMS family CAS) introduces a new family member, add them to `rawMembers`.

---

## Task 4: Clean HTML & CSS Integration (`portfolio.html`, `css/portfolio.css`, `js/portfolio-app.js`)

1. **`portfolio.html`:**
   * Add `<button type="button" class="action-pill-btn" id="btn-open-import-modal">📥 Import CSV / XLSX</button>` next to `#btn-open-holding-modal` in `.toolbar-right-utils`.
   * Add a clean `#import-modal` `.modal-overlay` dialog containing:
     * File dropzone (`<input type="file" id="broker-file-input" accept=".csv,.tsv,.xlsx,.xls" hidden>`).
     * Family Member `<select id="import-member-select">` (`Auto-detect from file` + existing members).
     * Compact preview summary (`Detected: <Broker> • X holdings • Live Value ₹Y`) and scrollable preview table.
     * `Cancel` and `＋ Import Holdings` buttons.
   * Include `<script src="js/portfolio-importer.js?v=1.5.0"></script>` before `portfolio-app.js`.
2. **`css/portfolio.css`:**
   * Add ~35 lines of styling for `.import-dropzone` and `.import-preview-table` using existing KYF design tokens (`--teal`, `--paper`, `--line`, `--mono`).
3. **`js/portfolio-app.js`:**
   * Wire `#btn-open-import-modal` to open `#import-modal`, call `KYF_BROKER_IMPORTER.parseFile(file)` on file selection, and on confirm, save merged holdings/members to IndexedDB, exit Demo Mode if active, call `markDataChanged()`, `renderApp()`, and `showToast()`.
---

## Addendum (v1.10.0): decisions that supersede the sections above

1. **No auto-detection.** The user chooses the *person* and the *source* (broker or statement type) for every import. The importer only finds the header row and maps columns; it never guesses the broker or the family member. The old "Auto-detect" member and the broker fingerprint (`BROKER_PROFILES`) are removed.
2. **Buckets.** A bucket is one family member plus one source (`importSource` on each holding, with `importedAt`). Importing into a bucket **overwrites** it: holdings in the file are added or updated, holdings the bucket had that the file no longer lists are removed (treated as sold). There is no separate "sold" state.
   - Matched holdings keep `id`, `allocations` and `notes`.
   - Manual holdings (no `importSource`) are never touched.
   - Older imports with no `importSource` are adopted by the matching custodian rather than duplicated, and are never removed.
   - An empty parse never reaches the bucket. The preview shows "new / updated / no longer held", flags removed holdings that were set aside for goals, and warns when the file is far smaller than the saved bucket.
3. **Overlapping sources** (same stock at two brokers, or one folio in CAMS and in Groww) stay in their own buckets. Totals, asset-class, goal and member views add them up; rows are not merged per instrument.
4. **Pledged shares** are counted as held: Quantity Pledged (Margin) and (Loan) are added to Quantity Available. This assumes the broker's available quantity excludes pledged shares; verify against a real file.
5. **ISINs starting IN00/IN0020** are government securities (fixed income), not gold. Only SGB names or symbols are valued as gold.
6. API: `replaceBucket`, `previewBucket`, `IMPORT_SOURCES`, `getSource`, `detectHeader` replace `upsertHoldings` and `detectHeaderAndBroker`.

### Addendum 2: broker choice and overwrite safety

- **Auto-detection is removed again** (`sniffSource` is gone; it misread file names such as `cash_report.csv`). A file dropped before choosing a broker is previewed only: the broker list stays empty, the preview says "Choose where this file is from", and the import button is disabled until a broker is picked.
- **Brokers not in the list:** "＋ Add another broker…" opens a small form (name, stocks or mutual funds, ₹ or $). The id comes from the name (`custom_<name>`), so the same name is the same bucket on any device. Custom brokers are remembered in `localStorage.kyf_custom_sources` and recovered from holdings' `importSource` when a `.kyf` file is opened.
- **Overwrite safety:** an import changes only holdings whose member and `importSource` match. Manual holdings, other brokers, other people and US holdings are left untouched. Older imports (no `importSource`) are adopted only when their id starts with `hold_imp_`, so a hand-entered holding is never taken over. The member spelling already in the portfolio is kept ("priya" and "Priya" are one person). `tests/broker-overwrite.test.mjs` and the e2e "never touches the rest of the portfolio" scenario cover this.

## Addendum 3: broker account wording and separate stock / mutual fund files

- The unit is the person's **broker account** (member + source). Preview and button say so: "Add Priya's Chase holdings (n)" on a first import, "Update Priya's Zerodha holdings (n)" afterwards, with "Other brokers and family members are not changed."
- Brokers often send stocks and mutual funds as separate files. A file replaces only the **kinds it contains** (mutual funds vs. stocks/ETFs/bonds/gold); the other kind in the same account is kept and the preview says so. A file with both kinds replaces both. An empty file removes nothing.

## Addendum 4: US data and consolidation clean-up (v1.11.2)

- Feeds Health shows the US trading day (`horizons.latest`), labelled New York time, and turns to a warning when it is more than 5 days old. `admin/sync_market_data.py` writes the same into `data/market-status.js`.
- The hard-coded popular-ETF list (with stale prices) is gone; search reads only `KYF_MARKET_US`.
- `isUsMutualFund` lives only in the engine; the importer delegates to it.
- New view lens **By Holding** groups the same stock or fund held at several brokers or by several people (`KYF_PORTFOLIO_ENGINE.instrumentKey`: fund code, then symbol (US kept apart), then ISIN, then name). Totals are unchanged by the lens.
- A second account at one broker is added as its own broker name ("Zerodha Joint"), so its file never replaces the first account's list.
