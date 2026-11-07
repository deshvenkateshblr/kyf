# Know Your Finance (KYF) — Cadence Activity Pages Roadmap & Master TODO

**Project Vision:** Transform each of the 21 action activities from the **Action Cadence** (`cadence.html`) into an interactive, privacy-first, standalone web tool or field-guide page. Each page gives the user concrete numbers, calculators, benchmarks, and actionable checklists—running 100% client-side in the browser.

---

AD1:  Change Pyramid to Goals, Cadence and Freedom

## 🚀 Immediate Next Implementation: Review Market Performance

> **Status:** 🟡 In Design & Architecture (First Priority)  
> **Target Page:** `market-performance.html` (Linked directly from `cadence.html` card `#house-market-performance`)  
> **Key Goal:** Provide an institutional-grade, distraction-free market dashboard tracking key Indian and global benchmarks, indices, and precious metals across **1D, 5D, 1M, 3M, 6M, and 1Y** windows.

### Detailed Scope & Features for `market-performance.html`:
1. **Multi-Window Return Matrix (1D, 5D, 1M, 3M, 6M, 1Y)**:
   - Interactive window selector tabs allowing instant toggling across timeframes:
     - **1D** (1 Day / Yesterday's close)
     - **5D** (5 Days / 1 Week trailing)
     - **1M** (1 Month trailing)
     - **3M** (1 Quarter trailing)
     - **6M** (Half-Year trailing)
     - **1Y** (1 Year trailing)
   - Color-coded percentage changes (+green / -amber-red) with level readouts.
2. **Core Equity Indices**:
   - **Nifty 50**: Large-cap benchmark (Top 50 companies). Displays Level, Trailing P/E (19.3), P/B, Dividend Yield, and Return across 1D–1Y.
   - **Nifty Next 50**: Large-cap incubator (Rank 51–100).
   - **Nifty Midcap 150**: Mid-sized business engine (Rank 101–250).
   - **Nifty Smallcap 250**: Emerging growth companies (High volatility).
   - **Nifty 500 / Broad Market**: Total market breadth.
3. **Precious Metals & Real Assets**:
   - **Gold 24K** (999 Purity) per gram & per sovereign (8g).
   - **Gold 22K** (Jewellery standard) per gram.
   - **Silver** (per gram & per kg).
   - Trailing returns across 1D, 5D, 1M, 3M, 6M, and 1Y vs. equity benchmarks.
4. **Macro & Fixed Income Shock Absorbers**:
   - 10-Year Indian Government Bond Benchmark Yield (G-Sec).
   - RBI Repo Rate & Statutory Savings (EPF 8.25%, PPF 7.1%, SSY 8.2%, SCSS 8.2%).
   - Liquid Fund Average Yield vs. 1-Year Bank FD.
5. **Contextual Plain-English Insights**:
   - "Is the market expensive?" — P/E valuation zone thermometer (Fair Value: 18–22, Overvalued >24, Undervalued <17).
   - Real Return Check: Trailing returns net of current CPI inflation (5.4%).
6. **Data Pipeline Integration**:
   - Extend `admin/sync_market_data.py` horizons to compute `d1` (1 trading day prior) and `d5` (5 trading days prior) alongside `m1`, `m3`, `m6`, and `y1`.
   - Update `data/market-pulse.js` schema to export `ret1d`, `ret5d`, `ret1m`, `ret3m`, `ret6m`, `cagr1y` for all indices and commodities.

---

## 📋 Master Cadence Activity Registry & TODO Checklist

Below is the complete inventory of all 21 activities defined in `cadence.html`. Each will be developed into its own dedicated page.

### Section 1: 🎯 Life Milestones & Major Goals (10 Activities)

- [ ] **1. Buy My First Home**
  - **ID:** `goal-home`
  - **Target Page:** `pages/buy-home.html` (or `buy-home.html`)
  - **Scope:** 20% down-payment savings tracker, stamp duty & registration calculator (6%–8%), home loan EMI stress-tester, affordability multiplier (max 4x–5x annual household income), and rent vs. buy simulator.

- [ ] **2. Buy a Car**
  - **ID:** `goal-car`
  - **Target Page:** `pages/buy-car.html`
  - **Scope:** 20/4/10 vehicle rule calculator (20% down payment, 4-year max loan, <=10% of monthly income for total auto costs), cash payment vs. auto loan interest comparison, and recurring insurance/maintenance cost projection.

- [ ] **3. Save for Wedding**
  - **ID:** `goal-wedding`
  - **Target Page:** `pages/wedding-planning.html`
  - **Scope:** Category-by-category ceremony budget planner, short-term capital preservation allocation (Arbitrage & Sweep FDs), anti-debt checklist (avoiding high-cost personal loans).

- [ ] **4. Plan for a Child**
  - **ID:** `goal-child`
  - **Target Page:** `pages/child-planning.html`
  - **Scope:** Maternity healthcare buffer estimator, term insurance enhancement calculator based on dependants, recurring monthly baby budget checklist, and paediatric emergency fund setup.

- [ ] **5. Save for College & Higher Education**
  - **ID:** `goal-college`
  - **Target Page:** `pages/college-education.html`
  - **Scope:** 9% higher-education inflation repricer (undergrad in India vs. post-grad abroad), required monthly equity SIP calculator, asset allocation glide-path (shifting from equity to debt 3 years before college).

- [ ] **6. Build 6-to-9 Month Peace Buffer**
  - **ID:** `goal-emergency-fund`
  - **Target Page:** `pages/peace-buffer.html`
  - **Scope:** Essential living expense audit (burn rate calculation), single vs. dual-income runway sizing, Sweep-in FD vs. Liquid mutual fund allocation matrix.

- [ ] **7. Plan for Financial Independence (Retirement / FIRE)**
  - **ID:** `goal-retirement`
  - **Target Page:** `pages/retirement-fire.html`
  - **Scope:** 25x–33x annual expense corpus calculator, monthly Step-Up SIP engine, 3-Bucket withdrawal strategy (Bucket 1: Cash 3 yrs, Bucket 2: Debt 5 yrs, Bucket 3: Equity Growth), Safe Withdrawal Rate (SWR 3%–3.5% in India).

- [ ] **8. Plan Sabbatical or World Travel**
  - **ID:** `goal-sabbatical`
  - **Target Page:** `pages/sabbatical-travel.html`
  - **Scope:** Career-break runway budget, foreign exchange buffer (hedging USD/EUR inflation), health insurance continuity checklist during non-employment.

- [ ] **9. Start a Business or Angel Seed Fund**
  - **ID:** `goal-venture`
  - **Target Page:** `pages/business-seed.html`
  - **Scope:** Risk-capital ring-fencing (protecting family wealth), separating personal collateral from business debt, 18-month startup survival runway calculator.

- [ ] **10. Prepay High-APR Debt & Home Loan**
  - **ID:** `goal-debt-freedom`
  - **Target Page:** `pages/debt-prepayment.html`
  - **Scope:** Debt avalanche vs. debt snowball calculator, prepayment interest-savings engine (e.g. paying 1 extra EMI per year reduces a 20-year home loan by ~4.5 years), credit card APR comparison (39% vs. 8.65%).

---

### Section 2: 🧹 Financial Hygiene & Housekeeping (11 Activities)

- [ ] **11. Review Market Performance & Benchmarks**  *(★ Priority 1)*
  - **ID:** `house-market-performance`
  - **Target Page:** `market-performance.html`
  - **Scope:** Multi-window return engine (1D, 5D, 1M, 3M, 6M, 1Y) for Nifty 50, Next 50, Midcap 150, Smallcap 250, Gold (24K/22K), Silver, and 10Y G-Sec. Real returns adjusted for inflation.

- [ ] **12. Compute Net Worth Statement**
  - **ID:** `house-networth`
  - **Target Page:** `pages/net-worth.html`
  - **Scope:** Liquid Assets + Semi-Liquid Assets + Illiquid Assets minus Short-Term & Long-Term Liabilities. Historical net worth progress chart and Debt-to-Asset ratio.

- [ ] **13. Track Savings & Operating Accounts**
  - **ID:** `house-savings-audit`
  - **Target Page:** `pages/savings-audit.html`
  - **Scope:** Bank statement audit checklist, detecting idle cash earning <3% interest, auto-sweep FD setup instructions across major Indian banks, hidden fee audit (SMS charges, debit card annual fees).

- [ ] **14. Audit Mutual Funds & Direct Plans**
  - **ID:** `house-mf-xray`
  - **Target Page:** `pages/mf-audit.html`
  - **Scope:** AMFI Direct vs. Regular plan search & commission drag calculator (cumulative wealth lost over 15 years at 0.8% expense ratio difference), fund overlap detector, portfolio pruning guide.

- [ ] **15. Review Equity & Demat Accounts**
  - **ID:** `house-equity-check`
  - **Target Page:** `pages/equity-review.html`
  - **Scope:** Concentration risk diagnostic (identifying holdings >10% of portfolio), sector allocation audit, dividend tracker, quarterly earnings checklist.

- [ ] **16. Verify EPF, PPF & NPS Passbooks**
  - **ID:** `house-epf-ppf-nps`
  - **Target Page:** `pages/statutory-savings.html`
  - **Scope:** Annual EPFO UAN passbook verification guide (checking employer contribution matching & 8.25% interest credit), April 5th PPF deposit deadline reminder, NPS Tier-1 asset allocation check (Active Choice vs. Auto Choice).

- [ ] **17. Audit Credit Cards & Check CIBIL Score**
  - **ID:** `house-credit-card-debt`
  - **Target Page:** `pages/credit-cards-cibil.html`
  - **Scope:** Credit utilization ratio calculator (<30% target), auto-debit setup check (Total Amount Due vs. Minimum Due trap), free annual CIBIL/Experian score retrieval guide, subscription audit.

- [ ] **18. Annual Term & Health Insurance Review**
  - **ID:** `house-insurance-audit`
  - **Target Page:** `pages/insurance-audit.html`
  - **Scope:** Pure term insurance sum assured sizing (15x–20x annual expenses), ULIP / Endowment trap diagnostic, family floater base cover + Super Top-up deductible alignment, waiting period checklist.

- [ ] **19. Annual Portfolio Rebalancing**
  - **ID:** `house-rebalance`
  - **Target Page:** `pages/portfolio-rebalancing.html`
  - **Scope:** Target vs. Current Equity : Debt : Gold asset allocation variance calculator, 5% rebalance band trigger, tax-efficient rebalancing strategies (using new SIP inflows instead of selling to avoid capital gains).

- [ ] **20. Tax Optimization & LTCG Harvesting**
  - **ID:** `house-tax-harvesting`
  - **Target Page:** `pages/tax-harvesting.html`
  - **Scope:** Old vs. New Tax Regime comparative simulator, annual ₹1.25 Lakh tax-free Equity LTCG harvesting calculator, Advance Tax quarterly calendar (15% by June, 45% by Sep, 75% by Dec, 100% by March).

- [ ] **21. Update Nominees & Emergency Digital Vault**
  - **ID:** `house-nominees-will`
  - **Target Page:** `pages/nominees-vault.html`
  - **Scope:** Master nomination status checklist across Bank Accounts, Demats, EPF, Mutual Funds, Life & Health Policies; emergency family access instruction document (offline/private).

---

## 🛠️ Technical Design & Component Standards for All Pages

1. **Shared Visual System**:
   - Uses the unified KYF theme tokens: `--paper (#eef1ea)`, `--panel (#ffffff)`, `--ink (#182620)`, `--teal (#1f7a6c)`, `--amber (#c97a2b)`, `--green (#2e7d32)`, and serif headings.
   - Sticky top navigation with brand logo, links to home, 3 dimensions, cadence, and data actions.
   - Sticky feedback footer: *Comments, questions, feedback? Write to info@vividnova.com*.
2. **Persistence & Portability**:
   - Every page that saves user data saves to `localStorage` under namespaced keys (e.g. `kyf_cadence_v2`, `kyf_networth_v1`, etc.).
   - Integrated with the **`Save Data (.kyf)`** and **`Open File (.kyf)`** pipeline.
3. **Zero-Server Guarantee**:
   - All calculation math, search, filtering, and charts execute locally in browser.
   - Market figures read from lightweight, static `.js` bundles (`data/market-pulse.js`, `data/market-equities.js`).

